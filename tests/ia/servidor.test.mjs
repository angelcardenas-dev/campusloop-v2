import test from 'node:test';
import assert from 'node:assert/strict';
import handlerPredeterminado, { crearHandlerAsistente, config } from '../../netlify/functions/asistente.mjs';
import { ID_SOLICITUD, ID_USUARIO, OTRO_ID, TOKEN, CLAVE, ORIGEN, articulo,
  cuerpoHttp, entorno, request, json, sugerencias, respuestaProveedor, diferida, pausa } from './fixtures.mjs';

// Ninguna prueba puede recurrir a la red real, ni siquiera por accidente.
globalThis.fetch = () => { throw new Error('Red real prohibida en pruebas'); };
function preparar(cambios = {}) {
  const llamadas = [];
  const dependencias = {
    leerEntorno: entorno,
    verificarUsuario: async datos => { llamadas.push('auth'); assert.equal(datos.token, TOKEN); return { id: ID_USUARIO, esAnonimo: false }; },
    verificarVendedor: async datos => { llamadas.push('vendedor'); assert.equal(datos.usuarioId, ID_USUARIO); return true; },
    reservarCuota: async datos => { llamadas.push('cuota'); assert.equal(datos.usuarioId, ID_USUARIO); assert.equal(datos.solicitudId, ID_SOLICITUD); return { permitida: true, nueva: true, reservaId: OTRO_ID }; },
    fetchImpl: async (url, opciones) => {
      llamadas.push('proveedor');
      assert.equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
      assert.equal(opciones.headers.Authorization, `Bearer ${CLAVE}`);
      assert.equal(opciones.redirect, 'error');
      const payload = JSON.parse(opciones.body);
      assert.equal(payload.model, entorno().NVIDIA_MODEL);
      assert.equal(payload.stream, false);
      assert.equal(payload.max_tokens, 512);
      assert.equal(payload.messages.length, 2);
      assert.equal(opciones.body.includes(TOKEN), false);
      assert.equal(opciones.body.includes(ID_USUARIO), false);
      return respuestaProveedor();
    },
    ...cambios,
  };
  return { handler: crearHandlerAsistente(dependencias), llamadas };
}
async function errorSeguro(respuesta, status, codigo) {
  assert.equal(respuesta.status, status);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  assert.equal(respuesta.headers.get('access-control-allow-origin'), null);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.codigo, codigo);
  assert.deepEqual(Object.keys(cuerpo).sort(), ['codigo', 'mensaje', 'solicitudId']);
  for (const secreto of [TOKEN, CLAVE, 'SDK_ERROR_PRIVADO', 'RAZONAMIENTO_NO_PUBLICAR']) assert.equal(JSON.stringify(cuerpo).includes(secreto), false);
  return cuerpo;
}

test('entrada Netlify: ruta exacta y export predeterminado cerrado', async () => {
  assert.deepEqual(config, { path: '/api/asistente' });
  assert.equal((await handlerPredeterminado(request())).status, 503);
});
test('IA apagada no invoca Auth, cuota ni proveedor', async () => {
  const p = preparar({ leerEntorno: () => ({ IA_HABILITADA: 'false' }) });
  await errorSeguro(await p.handler(request()), 503, 'IA_DESHABILITADA');
  assert.deepEqual(p.llamadas, []);
});
for (const adaptador of ['verificarUsuario', 'verificarVendedor', 'reservarCuota']) {
  test(`sin ${adaptador}: denegación incluso con entorno habilitado`, async () => {
    const p = preparar({ [adaptador]: undefined });
    await errorSeguro(await p.handler(request()), 503, 'CONTROLES_NO_DISPONIBLES');
    assert.deepEqual(p.llamadas, []);
  });
}
for (const cambio of [{ NVIDIA_API_KEY: '' }, { NVIDIA_MODEL: '' }, { NVIDIA_MODELOS_APROBADOS: '' },
  { NVIDIA_MODEL: 'https://example.invalid' }, { IA_ORIGEN_PERMITIDO: 'https://example.invalid/ruta' }]) {
  test(`configuración incompleta o no aprobada: ${Object.keys(cambio)[0]}`, async () => {
    const p = preparar({ leerEntorno: () => ({ ...entorno(), ...cambio }) });
    await errorSeguro(await p.handler(request()), 503, 'CONFIGURACION');
    assert.deepEqual(p.llamadas, []);
  });
}
test('GET rechazado con Allow POST', async () => {
  const p = preparar();
  const res = await p.handler(request(null, { method: 'GET' }));
  assert.equal(res.headers.get('allow'), 'POST');
  await errorSeguro(res, 405, 'METODO_NO_PERMITIDO');
  assert.deepEqual(p.llamadas, []);
});
for (const [etiqueta, headers, status, codigo] of [
  ['origen ajeno', { Origin: 'https://otro.example.invalid' }, 403, 'ORIGEN_NO_PERMITIDO'],
  ['sin bearer', { Authorization: '' }, 401, 'NO_AUTORIZADO'],
  ['contenido HTML', { 'Content-Type': 'text/html' }, 415, 'TIPO_NO_PERMITIDO'],
  ['compresión no admitida', { 'Content-Encoding': 'gzip' }, 415, 'TIPO_NO_PERMITIDO'],
  ['tamaño declarado', { 'Content-Length': '8193' }, 413, 'CUERPO_GRANDE'],
]) {
  test(`cabecera inválida: ${etiqueta}`, async () => {
    const p = preparar();
    await errorSeguro(await p.handler(request(cuerpoHttp(), { headers })), status, codigo);
    assert.deepEqual(p.llamadas, []);
  });
}
test('usuario no verificado no alcanza permiso ni cuota', async () => {
  const p = preparar({ verificarUsuario: async () => null });
  await errorSeguro(await p.handler(request()), 401, 'NO_AUTORIZADO');
  assert.deepEqual(p.llamadas, []);
});
test('identidad anónima o falsa nunca autoriza consumo', async () => {
  const p = preparar({ verificarUsuario: async () => ({ id: ID_USUARIO, esAnonimo: true }) });
  await errorSeguro(await p.handler(request()), 503, 'CONTROLES_NO_DISPONIBLES');
  assert.deepEqual(p.llamadas, []);
});
test('vendedor inactivo: 403, sin cuota ni proveedor', async () => {
  const p = preparar({ verificarVendedor: async () => false });
  await errorSeguro(await p.handler(request()), 403, 'NO_VENDEDOR');
  assert.deepEqual(p.llamadas, ['auth']);
});
test('fallo SDK o RLS cerrado y sin detalles privados', async () => {
  const p = preparar({ verificarVendedor: async () => { throw new Error('SDK_ERROR_PRIVADO'); } });
  await errorSeguro(await p.handler(request()), 503, 'CONTROLES_NO_DISPONIBLES');
  assert.deepEqual(p.llamadas, ['auth']);
});
for (const [etiqueta, modificar, codigo = 'VALIDACION'] of [
  ['operación arbitraria', d => { d.operacion = 'publicar'; }],
  ['usuario enviado por UI', d => { d.usuarioId = ID_USUARIO; }],
  ['token dentro del JSON', d => { d.token = TOKEN; }],
  ['UUID como array', d => { d.solicitudId = [ID_SOLICITUD]; }],
  ['título excesivo', d => { d.articulo.tituloActual = 'a'.repeat(101); }],
  ['descripción excesiva', d => { d.articulo.descripcionActual = 'a'.repeat(1001); }],
  ['once características', d => { d.articulo.caracteristicas = Array(11).fill('Operativa'); }],
  ['característica excesiva', d => { d.articulo.caracteristicas = ['a'.repeat(151)]; }],
  ['correo personal', d => { d.articulo.descripcionActual = 'Contacta a persona@example.invalid'; }],
  ['URL ajena', d => { d.articulo.caracteristicas = ['https://example.invalid']; }],
  ['sin contexto', d => { d.articulo = { ...articulo(), tituloActual: '', caracteristicas: [] }; }, 'CONTEXTO_INSUFICIENTE'],
]) {
  test(`cuerpo inválido: ${etiqueta}`, async () => {
    const p = preparar(); const d = cuerpoHttp(); modificar(d);
    await errorSeguro(await p.handler(request(d)), 400, codigo);
    assert.deepEqual(p.llamadas, ['auth', 'vendedor']);
  });
}
test('JSON malformado se rechaza antes de reservar consumo', async () => {
  const p = preparar();
  await errorSeguro(await p.handler(request('{')), 400, 'VALIDACION');
  assert.deepEqual(p.llamadas, ['auth', 'vendedor']);
});
test('límite de bytes real, sin confiar en Content-Length', async () => {
  const p = preparar();
  await errorSeguro(await p.handler(request(' '.repeat(8193), { headers: { 'Content-Length': '1' } })), 413, 'CUERPO_GRANDE');
  assert.deepEqual(p.llamadas, ['auth', 'vendedor']);
});
for (const [reserva, status, codigo] of [
  [{ permitida: false }, 429, 'LIMITE'],
  [{ permitida: true, nueva: false }, 409, 'CONFLICTO'],
  [{ permitida: true, nueva: true }, 503, 'CONTROLES_NO_DISPONIBLES'],
]) {
  test(`cuota sin autorización nueva válida: ${codigo}`, async () => {
    const p = preparar({ reservarCuota: async () => reserva });
    await errorSeguro(await p.handler(request()), status, codigo);
    assert.deepEqual(p.llamadas, ['auth', 'vendedor']);
  });
}
test('cuota caída no habilita un contador local alternativo', async () => {
  const p = preparar({ reservarCuota: async () => { throw new Error('SDK_ERROR_PRIVADO'); } });
  await errorSeguro(await p.handler(request()), 503, 'CONTROLES_NO_DISPONIBLES');
  assert.deepEqual(p.llamadas, ['auth', 'vendedor']);
});
test('éxito sintético: controles antes del proveedor, solo sugerencias públicas', async () => {
  const p = preparar(); const res = await p.handler(request());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { solicitudId: ID_SOLICITUD, sugerencias: sugerencias() });
  assert.deepEqual(p.llamadas, ['auth', 'vendedor', 'cuota', 'proveedor']);
});
for (const status of [429, 401, 500]) {
  test(`HTTP upstream ${status} sin exponer su cuerpo`, async () => {
    const p = preparar({ fetchImpl: async () => json({ secreto: CLAVE }, status) });
    await errorSeguro(await p.handler(request()), status === 429 ? 429 : 502, status === 429 ? 'LIMITE' : 'SERVIDOR');
  });
}
for (const [etiqueta, producir] of [
  ['red', async () => { throw new TypeError('SDK_ERROR_PRIVADO'); }],
  ['JSON exterior inválido', async () => new Response('{', { headers: { 'Content-Type': 'application/json' } })],
  ['tipo HTML', async () => new Response('<html>SDK_ERROR_PRIVADO</html>')],
  ['respuesta grande', async () => new Response(' '.repeat(32769), { headers: { 'Content-Type': 'application/json' } })],
  ['sin choices', async () => json({})],
  ['salida truncada', async () => json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })],
  ['bloque Markdown', async () => json({ choices: [{ finish_reason: 'stop', message: { content: '```json\n{}\n```' } }] })],
  ['claves adicionales', async () => respuestaProveedor({ ...sugerencias(), razonamiento: 'no publicar' })],
  ['garantía inventada', async () => respuestaProveedor({ ...sugerencias(), descripcion: 'Garantía de un año' })],
  ['negación eliminada', async () => respuestaProveedor({ ...sugerencias(), descripcion: 'Funciona' })],
  ['título excesivo', async () => respuestaProveedor({ ...sugerencias(), titulo: 'a'.repeat(101) })],
]) {
  test(`respuesta inválida del proveedor: ${etiqueta}`, async () => {
    const p = preparar({ fetchImpl: producir });
    await errorSeguro(await p.handler(request()), 502, etiqueta === 'red' ? 'SERVIDOR' : 'RESPUESTA_INVALIDA');
  });
}
test('contenido con HTML aportado se conserva como datos, sin evaluarlo', async () => {
  const d = cuerpoHttp(); d.articulo.caracteristicas = ['<img src=x onerror=alert(1)>'];
  const p = preparar({ fetchImpl: async () => respuestaProveedor({ titulo: d.articulo.tituloActual, descripcion: d.articulo.caracteristicas[0] }) });
  const res = await p.handler(request(d));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).sugerencias.descripcion, d.articulo.caracteristicas[0]);
});
test('rechaza eliminar una negación dentro de un bloque aportado', async () => {
  const d = cuerpoHttp(); d.articulo.caracteristicas = ['No funciona'];
  const p = preparar({ fetchImpl: async () => respuestaProveedor({ titulo: d.articulo.tituloActual, descripcion: 'funciona' }) });
  await errorSeguro(await p.handler(request(d)), 502, 'RESPUESTA_INVALIDA');
});
test('acepta límites exactos de 100 y 1000 puntos de código', async () => {
  const d = cuerpoHttp(); d.articulo.tituloActual = '😀'.repeat(100); d.articulo.descripcionActual = 'a'.repeat(1000);
  const p = preparar({ fetchImpl: async () => respuestaProveedor({ titulo: d.articulo.tituloActual, descripcion: d.articulo.descripcionActual }) });
  const res = await p.handler(request(d));
  assert.equal(res.status, 200); const datos = await res.json();
  assert.equal(Array.from(datos.sugerencias.titulo).length, 100); assert.equal(datos.sugerencias.descripcion.length, 1000);
});
test('timeout de cuerpo entrante cancela lectura sin reservar cuota', async () => {
  let cancelado = false;
  const flujo = new ReadableStream({ cancel() { cancelado = true; } });
  const req = new Request(ORIGEN + '/api/asistente', { method: 'POST', duplex: 'half', body: flujo,
    headers: { Origin: ORIGEN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } });
  const p = preparar({ timeoutMs: 5 });
  await errorSeguro(await p.handler(req), 504, 'TIEMPO_AGOTADO');
  await pausa(); assert.equal(cancelado, true); assert.deepEqual(p.llamadas, ['auth', 'vendedor']);
});
test('timeout de Auth: no continúa a cuota aunque resuelva tarde', async () => {
  const espera = diferida();
  const p = preparar({ timeoutMs: 5, verificarUsuario: () => espera.promesa });
  await errorSeguro(await p.handler(request()), 504, 'TIEMPO_AGOTADO');
  espera.resolver({ id: ID_USUARIO, esAnonimo: false }); await pausa();
  assert.deepEqual(p.llamadas, []);
});
test('timeout del proveedor sin reintentos ni devolución automática de cuota', async () => {
  const espera = diferida(); let solicitudes = 0;
  const p = preparar({ timeoutMs: 5, fetchImpl: () => { solicitudes++; return espera.promesa; } });
  await errorSeguro(await p.handler(request()), 504, 'TIEMPO_AGOTADO');
  assert.equal(solicitudes, 1);
  espera.resolver(respuestaProveedor()); await pausa();
});
test('aborto del navegador se propaga sin nuevo upstream', async () => {
  const cancelacion = new AbortController(); const espera = diferida();
  const p = preparar({ verificarUsuario: () => espera.promesa });
  const resultado = p.handler(request(cuerpoHttp(), { signal: cancelacion.signal }));
  cancelacion.abort();
  await errorSeguro(await resultado, 408, 'CANCELADO');
  espera.resolver({ id: ID_USUARIO, esAnonimo: false }); await pausa();
  assert.deepEqual(p.llamadas, []);
});
