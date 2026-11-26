import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/mensajeria.js', import.meta.url), 'utf8');
const actor = '00000000-0000-4000-8000-000000000072';
const vendedor = '00000000-0000-4000-8000-000000000071';
const articuloId = '00000000-0000-4000-8000-000000000074';
const conversacionId = '00000000-0000-4000-8000-000000000079';
const mensajeId = '00000000-0000-4000-8000-000000000075';
const creadoEn = '2026-11-25T00:00:00.123456+00:00';

async function cargar({ anonimo = false, error = null } = {}) {
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
    auth: { getUser: async () => ({ data: { user: { id: actor, is_anonymous: anonimo } } }) },
    async rpc(nombre, parametros) {
      llamadas.push([nombre, { ...parametros }]);
      const data = nombre === 'iniciar_mi_conversacion'
        ? { id: conversacionId, articuloId, compradorId: actor, vendedorId: vendedor, creadoEn }
        : { id: mensajeId, conversacionId, remitenteId: actor, texto: parametros.p_texto, creadoEn };
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
  assert.equal((await api.iniciarMiConversacion(articuloId)).datos.vendedorId, vendedor);
  assert.deepEqual(llamadas, [['iniciar_mi_conversacion', { p_articulo_id: articuloId, p_actor_esperado: actor }]]);
});

test('los mensajes mantienen el UUID de reintento y el texto plano', async () => {
  const { api, llamadas } = await cargar();
  const respuesta = await api.enviarMiMensaje({ conversacionId, mensajeId, texto: ' <hola> ', remitenteId: vendedor });
  assert.equal(respuesta.datos.texto, '<hola>');
  assert.deepEqual(llamadas, [['enviar_mi_mensaje', {
    p_conversacion_id: conversacionId, p_mensaje_id: mensajeId, p_texto: '<hola>', p_actor_esperado: actor,
  }]]);
  assert.equal((await api.enviarMiMensaje({ conversacionId, mensajeId, texto: ' '.repeat(3) })).error.codigo, 'VALIDACION');
  assert.equal(llamadas.length, 1);
});

test('el historial filtra al participante y pagina por fecha e ID sin truncar microsegundos', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.consultarMensajes(conversacionId, { limite: 20, cursor: { id: mensajeId, creadoEn } });
  assert.equal(resultado.ok, true);
  assert.ok(llamadas.some(([m, , tabla]) => m === 'or' && tabla === 'conversaciones'));
  assert.ok(llamadas.some(([m, valor]) => m === 'or' && valor.includes('creado_en.gt.' + creadoEn)));
  assert.deepEqual(llamadas.filter(([m]) => m === 'order'), [['order', 'creado_en', true], ['order', 'id', true]]);
  assert.equal((await api.consultarMensajes(conversacionId, { cursor: { id: mensajeId, creadoEn: '2026,otro' } })).error.codigo, 'VALIDACION');
});

test('las cuentas anónimas quedan fuera y el conflicto se normaliza', async () => {
  const a = await cargar({ anonimo: true });
  assert.equal((await a.api.consultarMisConversaciones()).error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(a.llamadas, []);
  const c = await cargar({ error: { code: 'PT409', message: 'detalle privado' } });
  const resultado = await c.api.enviarMiMensaje({ conversacionId, mensajeId, texto: 'hola' });
  assert.equal(resultado.error.codigo, 'CONFLICTO');
  assert.doesNotMatch(resultado.error.mensaje, /detalle privado/);
});
