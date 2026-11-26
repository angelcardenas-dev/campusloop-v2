import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/perfiles.js', import.meta.url), 'utf8');
const id = '00000000-0000-4000-8000-000000000021';
const otroId = '00000000-0000-4000-8000-000000000022';
const campusId = '82d7186a-920c-49e2-bcc5-9aaa03ad655e';
const universidadId = '486a935d-f0f9-4437-891e-62bc48bde10a';
const usuario = { id, is_anonymous: false, email_confirmed_at: '2026-11-25T00:00:00Z' };
const entrada = { nombreVisible: ' Nombre ', campusId, universidadId, versionEsperada: 1 };
const fila = {
  id, nombre_visible: null, campus_id: null, vendedor_activado: false,
  creado_en: usuario.email_confirmed_at, actualizado_en: usuario.email_confirmed_at, version: 1,
};

async function cargar({ actor = usuario, respuesta = { data: fila }, authError = null, alRpc } = {}) {
  const llamadas = [];
  const context = createContext();
  const cliente = {
    auth: { getUser: async () => ({ data: { user: actor }, error: authError }) },
    from(tabla) {
      llamadas.push(tabla);
      return {
        select(columnas) { llamadas.push(columnas); return this; },
        eq(campo, valor) { llamadas.push(campo, valor); return this; },
        maybeSingle: async () => respuesta,
      };
    },
    rpc(nombre, parametros) {
      llamadas.push(nombre, { ...parametros });
      return { single: async () => alRpc ? alRpc(parametros) : respuesta };
    },
  };
  const dependencia = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => ({ ok: true, datos: cliente }));
  }, { context });
  const modulo = new SourceTextModule(fuente, { context });
  await modulo.link(() => dependencia);
  await modulo.evaluate();
  return { servicio: modulo.namespace, llamadas };
}

test('lee solo el perfil propio y devuelve versión y completitud', async () => {
  const { servicio, llamadas } = await cargar({ respuesta: { data: { ...fila, correo: 'privado' } } });
  const resultado = await servicio.consultarMiPerfil();
  assert.equal(resultado.ok, true);
  assert.equal(resultado.datos.version, 1);
  assert.equal(resultado.datos.completo, false);
  assert.equal(Object.hasOwn(resultado.datos, 'correo'), false);
  assert.deepEqual(llamadas, ['perfiles', 'id,nombre_visible,campus_id,vendedor_activado,creado_en,actualizado_en,version', 'id', id]);
});

test('rechaza visitante y Anonymous Sign-In antes de consultar datos', async () => {
  for (const actor of [null, { ...usuario, is_anonymous: true }]) {
    const { servicio, llamadas } = await cargar({ actor });
    assert.equal((await servicio.consultarMiPerfil()).error.codigo, 'NO_AUTORIZADO');
    assert.equal((await servicio.actualizarMiPerfil(entrada, { actorEsperado: id })).error.codigo, 'NO_AUTORIZADO');
    assert.deepEqual(llamadas, []);
  }
});

test('envía únicamente campos permitidos y la precondición de identidad', async () => {
  const { servicio, llamadas } = await cargar({
    respuesta: { data: { ...fila, nombre_visible: 'Nombre', campus_id: campusId, version: 2 } },
  });
  const resultado = await servicio.actualizarMiPerfil({ ...entrada, vendedorActivado: true, id: campusId }, { actorEsperado: id });
  assert.equal(resultado.datos.version, 2);
  assert.equal(resultado.datos.vendedorActivado, false);
  assert.deepEqual(llamadas, ['actualizar_mi_perfil', {
    p_nombre_visible: 'Nombre', p_universidad_id: universidadId, p_campus_id: campusId,
    p_version_esperada: 1, p_actor_esperado: id,
  }]);
});

test('normaliza el conflicto y no envía cambios con correo pendiente', async () => {
  const pendiente = await cargar({ actor: { ...usuario, email_confirmed_at: null } });
  assert.equal((await pendiente.servicio.actualizarMiPerfil(entrada, { actorEsperado: id })).error.codigo, 'CORREO_PENDIENTE');
  assert.deepEqual(pendiente.llamadas, []);
  const conflicto = await cargar({ respuesta: { status: 409, error: { code: 'PT409', message: 'detalle interno' } } });
  const resultado = await conflicto.servicio.actualizarMiPerfil(entrada, { actorEsperado: id });
  assert.equal(resultado.error.codigo, 'CONFLICTO');
  assert.doesNotMatch(resultado.error.mensaje, /detalle interno/);
});

test('B01: una edicion iniciada por A no ejecuta RPC bajo B', async () => {
  const { servicio, llamadas } = await cargar({ actor: { ...usuario, id: otroId } });
  const resultado = await servicio.actualizarMiPerfil(entrada, { actorEsperado: id });
  assert.equal(resultado.error.codigo, 'NO_AUTORIZADO');
  assert.deepEqual(llamadas, []);
});

test('exige actor esperado valido antes de consultar Auth o ejecutar RPC', async () => {
  const { servicio, llamadas } = await cargar();
  for (const opciones of [undefined, null, {}, { actorEsperado: null }, { actorEsperado: 42 }, { actorEsperado: 'otro' }]) {
    assert.equal((await servicio.actualizarMiPerfil(entrada, opciones)).error.codigo, 'NO_AUTORIZADO');
  }
  assert.deepEqual(llamadas, []);
});

test('sesion expirada o ausente y correo sin confirmar impiden escritura', async () => {
  for (const config of [{ actor: null }, { authError: { status: 401 } }, { actor: { ...usuario, email_confirmed_at: null } }]) {
    const { servicio, llamadas } = await cargar(config);
    const resultado = await servicio.actualizarMiPerfil(entrada, { actorEsperado: id });
    assert.equal(resultado.error.codigo, config.actor?.email_confirmed_at === null ? 'CORREO_PENDIENTE' : 'NO_AUTORIZADO');
    assert.deepEqual(llamadas, []);
  }
});

test('cambio posterior a la verificacion conserva el actor original ante la RPC', async () => {
  const { servicio, llamadas } = await cargar({ alRpc: async parametros => {
    assert.equal(parametros.p_actor_esperado, id);
    return { error: { status: 403, message: 'detalle interno' } };
  } });
  const resultado = await servicio.actualizarMiPerfil(entrada, { actorEsperado: id });
  assert.equal(resultado.error.codigo, 'NO_AUTORIZADO');
  assert.doesNotMatch(resultado.error.mensaje, /detalle interno/);
  assert.equal(llamadas[0], 'actualizar_mi_perfil');
});
