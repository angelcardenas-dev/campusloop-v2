import test from 'node:test';
import assert from 'node:assert/strict';
import { crearVerificadorUsuario } from '../../netlify/lib/auth-usuario.mjs';
import handlerPredeterminado, { crearHandlerAsistente } from '../../netlify/functions/asistente.mjs';

// Datos sintéticos y cliente inyectado: no se descarga SDK ni se contacta Auth.
globalThis.fetch = () => { throw new Error('Red real prohibida en pruebas'); };
const TOKEN_PRUEBA = 'TOKEN_EXCLUSIVO_PRUEBA_OFFLINE';
const ID = '3f926c15-550b-42b9-8aa0-b08279954bcb';
const PRIVADO = 'DETALLE_INTERNO_NO_PUBLICAR';
const usuario = () => ({ id: ID, is_anonymous: false });
const clienteCon = getUser => ({ auth: { getUser } });
const resultadoCon = valor => ({ data: { user: valor }, error: null });
const errorAuth = (code, status = 401) => ({ name: 'AuthApiError', code, status, message: PRIVADO });
const solicitud = () => new Request('https://campusloop.example.invalid/api/asistente', { method: 'POST' });

function errorSeguro(error) {
  assert.equal(error.codigo, 'CONTROLES_NO_DISPONIBLES');
  assert.equal(error.message, 'No se pudo verificar la identidad en este momento.');
  assert.equal(error.cause, undefined);
  assert.deepEqual(Object.keys(error), ['codigo']);
  for (const privado of [TOKEN_PRUEBA, PRIVADO]) assert.equal(String(error.stack).includes(privado), false);
  return true;
}

test('identidad válida: getUser(token), DTO mínimo, cancelación y handler cerrado', async () => {
  let llamadas = 0;
  const cliente = clienteCon(async function (...argumentos) {
    llamadas++;
    assert.equal(this, cliente.auth);
    assert.deepEqual(argumentos, [TOKEN_PRUEBA]);
    return resultadoCon({ ...usuario(), email: PRIVADO, user_metadata: { vendedor_activado: true } });
  });
  const verificarUsuario = crearVerificadorUsuario({ cliente });
  const identidad = await verificarUsuario({ token: TOKEN_PRUEBA });
  assert.deepEqual(identidad, { id: ID, esAnonimo: false });
  assert.equal(JSON.stringify(identidad).includes(TOKEN_PRUEBA), false);
  assert.equal(JSON.stringify(identidad).includes(PRIVADO), false);

  const antes = new AbortController();
  antes.abort(PRIVADO);
  await assert.rejects(verificarUsuario({ token: TOKEN_PRUEBA, signal: antes.signal }), { name: 'AbortError' });
  assert.equal(llamadas, 1);
  const durante = new AbortController();
  const tardio = crearVerificadorUsuario({ cliente: clienteCon(async () => {
    durante.abort(PRIVADO);
    return resultadoCon(usuario());
  }) });
  await assert.rejects(tardio({ token: TOKEN_PRUEBA, signal: durante.signal }), { name: 'AbortError' });

  assert.equal((await handlerPredeterminado(solicitud())).status, 503);
  // Ni este adaptador disponible permite saltarse vendedor/cuota pendientes.
  const handler = crearHandlerAsistente({ leerEntorno: () => ({ IA_HABILITADA: 'true' }), verificarUsuario });
  const respuesta = await handler(solicitud());
  assert.equal(respuesta.status, 503);
  assert.equal((await respuesta.json()).codigo, 'CONTROLES_NO_DISPONIBLES');
  assert.equal(llamadas, 1);
});

test('token rechazado o expirado: null sin recurrir a una sesión implícita', async () => {
  for (const error of [errorAuth('bad_jwt'), errorAuth('session_expired'),
    errorAuth('session_not_found'), errorAuth('user_not_found', 403),
    errorAuth('user_not_found', 404),
    { name: 'AuthSessionMissingError', status: 400, message: PRIVADO }]) {
    for (const lanzar of [false, true]) {
      const verificarUsuario = crearVerificadorUsuario({ cliente: clienteCon(async () => {
        if (lanzar) throw error;
        return { data: { user: usuario() }, error };
      }) });
      assert.equal(await verificarUsuario({ token: TOKEN_PRUEBA }), null);
    }
  }
  const verificarUsuario = crearVerificadorUsuario({ cliente: clienteCon(() => assert.fail('No llamar sin token explícito')) });
  for (const token of [undefined, null, '', ' ', 123]) assert.equal(await verificarUsuario({ token }), null);
});

test('usuario anónimo o ausente: sin identidad ni autorización por metadata', async () => {
  for (const valor of [null, { ...usuario(), is_anonymous: true, user_metadata: { vendedor_activado: true } }]) {
    const verificarUsuario = crearVerificadorUsuario({ cliente: clienteCon(async () => resultadoCon(valor)) });
    assert.equal(await verificarUsuario({ token: TOKEN_PRUEBA }), null);
  }
});

test('servicio indisponible: error seguro, sin confundirlo con rechazo de token', async () => {
  const errores = [
    { name: 'AuthRetryableFetchError', status: 0, message: PRIVADO },
    errorAuth('unexpected_failure', 503), errorAuth('over_request_rate_limit', 429),
    // Incluso un código de rechazo no convierte un 5xx/429 en credenciales inválidas.
    errorAuth('bad_jwt', 503), errorAuth('bad_jwt', 429),
    errorAuth('codigo_desconocido', 401), new TypeError(PRIVADO),
  ];
  for (const error of errores) {
    for (const lanzar of [false, true]) {
      const verificarUsuario = crearVerificadorUsuario({ cliente: clienteCon(async () => {
        if (lanzar) throw error;
        return { data: { user: null }, error };
      }) });
      await assert.rejects(verificarUsuario({ token: TOKEN_PRUEBA }), errorSeguro);
    }
  }
  await assert.rejects(crearVerificadorUsuario()({ token: TOKEN_PRUEBA }), errorSeguro);
  // Respuestas incompletas tampoco permiten autorizar un usuario.
  for (const resultado of [{}, resultadoCon({ id: ID }), resultadoCon({ ...usuario(), id: 'invalido' })]) {
    const verificarUsuario = crearVerificadorUsuario({ cliente: clienteCon(async () => resultado) });
    await assert.rejects(verificarUsuario({ token: TOKEN_PRUEBA }), errorSeguro);
  }
});
