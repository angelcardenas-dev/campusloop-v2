import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/reservas.js', import.meta.url), 'utf8');
const comprador = '00000000-0000-4000-8000-000000000052';
const otroActor = '00000000-0000-4000-8000-000000000053';
const vendedor = '00000000-0000-4000-8000-000000000051';
const articuloId = '00000000-0000-4000-8000-000000000054';
const id = '00000000-0000-4000-8000-000000000055';

async function cargar({ anonimo = false, error = null, actor = comprador, authError = null, respuestas = {} } = {}) {
  const llamadas = [];
  const context = createContext();
  const sdk = {
    auth: { getUser: async () => ({ data: { user: actor ? { id: actor, is_anonymous: anonimo } : null }, error: authError }) },
    async rpc(nombre, parametros) {
      llamadas.push([nombre, { ...parametros }]);
      return { error, data: Object.hasOwn(respuestas, nombre) ? respuestas[nombre]
        : { id, articuloId, compradorId: comprador, vendedorId: vendedor, estado: 'pendiente', version: 1 } };
    },
    from(tabla) {
      llamadas.push(tabla);
      return {
        select() { return this; },
        or(filtro) { llamadas.push(filtro); return this; },
        order() { return this; },
        async limit() { return { data: [{ id, articulo_id: articuloId, comprador_id: comprador, vendedor_id: vendedor }] }; },
      };
    },
  };
  const dep = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => ({ ok: true, datos: sdk }));
  }, { context });
  const modulo = new SourceTextModule(fuente, { context });
  await modulo.link(() => dep);
  await modulo.evaluate();
  return { api: modulo.namespace, llamadas };
}

test('el alta enlaza la cuenta verificada con la versión leída del artículo', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.crearMiReserva({ articuloId, versionArticulo: 1, compradorId: vendedor }, { actorEsperado: comprador });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.datos.compradorId, comprador);
  assert.deepEqual(llamadas, [['crear_mi_reserva', {
    p_articulo_id: articuloId, p_version_articulo: 1, p_actor_esperado: comprador,
  }]]);
});

test('un conflicto se normaliza y las sesiones anónimas no consultan ni escriben', async () => {
  const conflicto = await cargar({ error: { code: 'PT409' } });
  assert.equal((await conflicto.api.crearMiReserva({ articuloId, versionArticulo: 1 }, { actorEsperado: comprador })).error.codigo, 'CONFLICTO');
  const anonimo = await cargar({ anonimo: true });
  assert.equal((await anonimo.api.crearMiReserva({ articuloId, versionArticulo: 1 }, { actorEsperado: comprador })).error.codigo, 'NO_AUTORIZADO');
  assert.equal((await anonimo.api.consultarMisReservas()).error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(anonimo.llamadas, []);
});

test('la lectura consulta únicamente el ámbito del participante verificado', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.consultarMisReservas();
  assert.equal(resultado.datos[0].id, id);
  assert.deepEqual(llamadas, ['reservas', 'comprador_id.eq.' + comprador + ',vendedor_id.eq.' + comprador]);
});

test('B02: intencion de A bajo sesion B no ejecuta RPC', async () => {
  const { api, llamadas } = await cargar({ actor: otroActor });
  const resultado = await api.crearMiReserva({ articuloId, versionArticulo: 1 }, { actorEsperado: comprador });
  assert.equal(resultado.error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(llamadas, []);
});

test('B02: actor ausente o invalido se rechaza sin RPC', async () => {
  const { api, llamadas } = await cargar();
  for (const opciones of [undefined, null, {}, { actorEsperado: 123 }, { actorEsperado: 'otro' }]) {
    assert.equal((await api.crearMiReserva({ articuloId, versionArticulo: 1 }, opciones)).error.codigo, 'NO_AUTORIZADO');
  }
  assert.deepEqual(llamadas, []);
});

test('reputacion agrega sin comentarios y distingue comprador y vendedor', async () => {
  const { api, llamadas } = await cargar({ respuestas: { consultar_reputacion_tb4: {
    usuarioId: comprador, comprador: { cantidad: 2, promedio: 4.5 }, vendedor: { cantidad: 0, promedio: null },
    comentario: 'privado',
  } } });
  const resultado = await api.consultarReputacion(comprador);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.datos.comprador.cantidad, 2);
  assert.equal(resultado.datos.comprador.promedio, 4.5);
  assert.equal(Object.hasOwn(resultado.datos, 'comentario'), false);
  assert.equal(llamadas[0][0], 'consultar_reputacion_tb4');
});

test('evaluaciones propias no aceptan registros de terceros ni exponen otros campos', async () => {
  const propia = { reservaId: id, autorId: comprador, destinatarioId: vendedor,
    estrellas: 5, comentario: 'bien', creadaEn: '2026-11-25T00:00:00Z', correo: 'privado' };
  const { api } = await cargar({ respuestas: { consultar_mis_evaluaciones_tb4: [propia] } });
  const resultado = await api.consultarMisEvaluaciones();
  assert.equal(resultado.ok, true);
  assert.equal(Object.hasOwn(resultado.datos[0], 'correo'), false);
  const tercero = await cargar({ respuestas: { consultar_mis_evaluaciones_tb4: [{ ...propia, autorId: vendedor, destinatarioId: otroActor }] } });
  assert.equal((await tercero.api.consultarMisEvaluaciones()).error.codigo, 'SERVIDOR');
  const incompleto = await cargar({ respuestas: { consultar_mis_evaluaciones_tb4: new Array(2) } });
  assert.equal((await incompleto.api.consultarMisEvaluaciones()).error.codigo, 'SERVIDOR');
  const anonimo = await cargar({ anonimo: true });
  assert.equal((await anonimo.api.consultarReputacion(comprador)).error.codigo, 'NO_AUTORIZADO');
  assert.equal((await anonimo.api.consultarMisEvaluaciones()).error.codigo, 'NO_AUTORIZADO');
});

test('B02: sesion perdida o vencida impide RPC y el actor enviado sigue siendo el original', async () => {
  for (const config of [{ actor: null }, { authError: { status: 401 } }]) {
    const { api, llamadas } = await cargar(config);
    assert.equal((await api.crearMiReserva({ articuloId, versionArticulo: 1 }, { actorEsperado: comprador })).error.codigo,
      'NO_AUTORIZADO');
    assert.deepEqual(llamadas, []);
  }
  const { api, llamadas } = await cargar({ error: { status: 403 } });
  assert.equal((await api.crearMiReserva({ articuloId, versionArticulo: 1 }, { actorEsperado: comprador })).error.codigo,
    'NO_AUTORIZADO');
  assert.equal(llamadas[0][1].p_actor_esperado, comprador);
});
