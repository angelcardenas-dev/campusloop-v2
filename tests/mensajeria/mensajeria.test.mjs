import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/mensajeria.js', import.meta.url), 'utf8');
const actor = '00000000-0000-4000-8000-000000000072';
const otroActor = '00000000-0000-4000-8000-000000000073';
const vendedor = '00000000-0000-4000-8000-000000000071';
const articuloId = '00000000-0000-4000-8000-000000000074';
const conversacionId = '00000000-0000-4000-8000-000000000079';
const mensajeId = '00000000-0000-4000-8000-000000000075';
const creadoEn = '2026-11-25T00:00:00.123456+00:00';

async function cargar({ anonimo = false, error = null, usuarioId = actor, authError = null } = {}) {
  const llamadas = [];
  const context = createContext();
  const consulta = {
    select(columnas) { llamadas.push(['select', columnas]); return this; },
    eq(campo, valor) { llamadas.push(['eq', campo, valor]); return this; },
    or(filtro, opciones) { llamadas.push(['or', filtro, opciones?.referencedTable]); return this; },
    order(campo, { ascending }) { llamadas.push(['order', campo, ascending]); return this; },
    limit(limite) { llamadas.push(['limit', limite]); return this; },
    then(resolve) { return Promise.resolve({ data: [] }).then(resolve); },
  };
  const sdk = {
    auth: { getUser: async () => ({ data: { user: usuarioId ? { id: usuarioId, is_anonymous: anonimo } : null }, error: authError }) },
    async rpc(nombre, parametros) {
      llamadas.push([nombre, { ...parametros }]);
      const data = nombre === 'iniciar_mi_conversacion'
        ? { id: conversacionId, articuloId, compradorId: actor, vendedorId: vendedor, creadoEn }
        : { id: mensajeId, conversacionId, remitenteId: actor, texto: parametros.p_texto, creadoEn, posicion: 1 };
      return { error, data };
    },
    from(tabla) { llamadas.push(['from', tabla]); return consulta; },
  };
  const dep = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => ({ ok: true, datos: sdk }));
  }, { context });
  const modulo = new SourceTextModule(fuente, { context });
  await modulo.link(() => dep);
  await modulo.evaluate();
  return { api: modulo.namespace, llamadas };
}

test('la conversación envía solo el artículo y la precondición de identidad', async () => {
  const { api, llamadas } = await cargar();
  assert.equal((await api.iniciarMiConversacion(articuloId, { actorEsperado: actor })).datos.vendedorId, vendedor);
  assert.deepEqual(llamadas, [['iniciar_mi_conversacion', { p_articulo_id: articuloId, p_actor_esperado: actor }]]);
});

test('los mensajes mantienen el UUID de reintento y el texto plano', async () => {
  const { api, llamadas } = await cargar();
  const respuesta = await api.enviarMiMensaje({ conversacionId, mensajeId, texto: ' <hola> ', remitenteId: vendedor }, { actorEsperado: actor });
  assert.equal(respuesta.datos.texto, '<hola>');
  assert.deepEqual(llamadas, [['enviar_mi_mensaje', {
    p_conversacion_id: conversacionId, p_mensaje_id: mensajeId, p_texto: '<hola>', p_actor_esperado: actor,
  }]]);
  assert.equal((await api.enviarMiMensaje({ conversacionId, mensajeId, texto: ' '.repeat(3) }, { actorEsperado: actor })).error.codigo, 'VALIDACION');
  assert.equal(llamadas.length, 1);
});

test('el historial filtra al participante y pagina por posicion sin truncar microsegundos', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.consultarMensajes(conversacionId, { limite: 20, cursor: { id: mensajeId, creadoEn, posicion: 7 } });
  assert.equal(resultado.ok, true);
  assert.ok(llamadas.some(([m, , tabla]) => m === 'or' && tabla === 'conversaciones'));
  assert.ok(llamadas.some(([m, valor]) => m === 'or' && valor.includes('posicion.lt.7')));
  assert.deepEqual(llamadas.filter(([m]) => m === 'order'), [['order', 'posicion', false]]);
  assert.equal((await api.consultarMensajes(conversacionId, { cursor: { id: mensajeId, creadoEn: '2026,otro' } })).error.codigo, 'VALIDACION');
});

test('las cuentas anónimas quedan fuera y el conflicto se normaliza', async () => {
  const a = await cargar({ anonimo: true });
  assert.equal((await a.api.consultarMisConversaciones()).error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(a.llamadas, []);
  const c = await cargar({ error: { code: 'PT409', message: 'detalle privado' } });
  const resultado = await c.api.enviarMiMensaje({ conversacionId, mensajeId, texto: 'hola' }, { actorEsperado: actor });
  assert.equal(resultado.error.codigo, 'CONFLICTO');
  assert.doesNotMatch(resultado.error.mensaje, /detalle privado/);
});

test('B03: conversacion y mensaje preparados por A no ejecutan RPC bajo B', async () => {
  const { api, llamadas } = await cargar({ usuarioId: otroActor });
  assert.equal((await api.iniciarMiConversacion(articuloId, { actorEsperado: actor })).error.codigo, 'NO_AUTORIZADO');
  assert.equal((await api.enviarMiMensaje({ conversacionId, mensajeId, texto: 'hola' }, { actorEsperado: actor })).error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(llamadas, []);
});

test('B03: actor ausente o invalido se rechaza sin RPC', async () => {
  const { api, llamadas } = await cargar();
  for (const opciones of [undefined, null, {}, { actorEsperado: 123 }, { actorEsperado: 'otro' }]) {
    assert.equal((await api.iniciarMiConversacion(articuloId, opciones)).error.codigo, 'NO_AUTORIZADO');
    assert.equal((await api.enviarMiMensaje({ conversacionId, mensajeId, texto: 'hola' }, opciones)).error.codigo, 'NO_AUTORIZADO');
  }
  assert.deepEqual(llamadas, []);
});

test('cursor posterior usa orden ascendente para recuperar eventos perdidos', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.consultarMensajes(conversacionId, {
    cursor: { id: mensajeId, creadoEn, posicion: 7 }, posteriores: true,
  });
  assert.equal(resultado.ok, true);
  assert.ok(llamadas.some(([m, valor]) => m === 'or' && valor.includes('posicion.gt.7')));
  assert.deepEqual(llamadas.filter(([m]) => m === 'order'), [['order', 'posicion', true]]);
});

test('B03: sin sesion o con Auth vencido no muta y mantiene actor original ante rechazo servidor', async () => {
  for (const config of [{ usuarioId: null }, { authError: { status: 401 } }]) {
    const { api, llamadas } = await cargar(config);
    assert.equal((await api.iniciarMiConversacion(articuloId, { actorEsperado: actor })).error.codigo, 'NO_AUTORIZADO');
    assert.equal((await api.enviarMiMensaje({ conversacionId, mensajeId, texto: 'hola' }, { actorEsperado: actor })).error.codigo,
      'NO_AUTORIZADO');
    assert.deepEqual(llamadas, []);
  }
  const rechazo = await cargar({ error: { status: 403, message: 'privado' } });
  assert.equal((await rechazo.api.enviarMiMensaje({ conversacionId, mensajeId, texto: 'hola' }, { actorEsperado: actor })).error.codigo,
    'NO_AUTORIZADO');
  assert.equal(rechazo.llamadas[0][1].p_actor_esperado, actor);
});
