import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/reservas.js', import.meta.url), 'utf8');
const comprador = '00000000-0000-4000-8000-000000000052';
const vendedor = '00000000-0000-4000-8000-000000000051';
const articuloId = '00000000-0000-4000-8000-000000000054';
const id = '00000000-0000-4000-8000-000000000055';

async function cargar({ anonimo = false, error = null } = {}) {
  const llamadas = [];
  const context = createContext();
  const sdk = {
    auth: { getUser: async () => ({ data: { user: { id: comprador, is_anonymous: anonimo } } }) },
    async rpc(nombre, parametros) {
      llamadas.push([nombre, { ...parametros }]);
      return { error, data: { id, articuloId, compradorId: comprador, vendedorId: vendedor, estado: 'pendiente', version: 1 } };
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
  const resultado = await api.crearMiReserva({ articuloId, versionArticulo: 1, compradorId: vendedor });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.datos.compradorId, comprador);
  assert.deepEqual(llamadas, [['crear_mi_reserva', {
    p_articulo_id: articuloId, p_version_articulo: 1, p_actor_esperado: comprador,
  }]]);
});

test('un conflicto se normaliza y las sesiones anónimas no consultan ni escriben', async () => {
  const conflicto = await cargar({ error: { code: 'PT409' } });
  assert.equal((await conflicto.api.crearMiReserva({ articuloId, versionArticulo: 1 })).error.codigo, 'CONFLICTO');
  const anonimo = await cargar({ anonimo: true });
  assert.equal((await anonimo.api.crearMiReserva({ articuloId, versionArticulo: 1 })).error.codigo, 'NO_AUTORIZADO');
  assert.equal((await anonimo.api.consultarMisReservas()).error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(anonimo.llamadas, []);
});

test('la lectura consulta únicamente el ámbito del participante verificado', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.consultarMisReservas();
  assert.equal(resultado.datos[0].id, id);
  assert.deepEqual(llamadas, ['reservas', 'comprador_id.eq.' + comprador + ',vendedor_id.eq.' + comprador]);
});
