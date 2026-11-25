import test from 'node:test';
import assert from 'node:assert/strict';
import { crearClienteAgente } from '../../js/agente-cliente.js';
const ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef';

test('cliente envía Bearer solo en encabezado, nunca persiste y valida esquema', async () => {
  let sent;
  const client = crearClienteAgente({ obtenerToken: async () => 'token-sintetico', fetchImpl: async (url, options) => {
    sent = { url, options }; return Response.json({ ok: true, datos: { tipo: 'mensaje', mensaje: 'Hola' }, error: null, solicitudId: ID });
  } });
  const r = await client.solicitar({ mensaje: 'hola', solicitudId: ID });
  assert.equal(r.ok, true); assert.equal(sent.url, '/api/agente');
  assert.equal(sent.options.headers.authorization, 'Bearer token-sintetico');
  assert.doesNotMatch(sent.options.body, /token-sintetico/);
  assert.equal(globalThis.localStorage, undefined);
});
test('cliente valida respuestas y normaliza errores sin consumir mensajes crudos', async () => {
  const client = crearClienteAgente({ obtenerToken: async () => 'token', fetchImpl: async () => Response.json({
    ok: false, datos: null, error: { codigo: 'SECRETO', mensaje: 'token privado' }, solicitudId: ID,
  }, { status: 500 }) });
  const r = await client.solicitar({ mensaje: 'hola', solicitudId: ID });
  assert.equal(r.error.codigo, 'SERVIDOR'); assert.doesNotMatch(JSON.stringify(r), /token privado/);
  assert.equal((await client.solicitar({ mensaje: '', solicitudId: ID })).error.codigo, 'VALIDACION');
});

test('cliente valida estrictamente resultado privado y borrador revisable', async () => {
  const validos = [
    { tipo: 'resultado_titular', datos: { destino: 'titular', reservas: [{ id: ID, estado: 'pendiente' }] } },
    { tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion', borrador: { titulo: 'Libro', descripcion: 'Usado' }, requiereRevisionHumana: true } },
  ];
  for (const datos of validos) {
    const client = crearClienteAgente({ obtenerToken: async () => 'token', fetchImpl: async () => Response.json({
      ok: true, datos, error: null, solicitudId: ID,
    }) });
    assert.equal((await client.solicitar({ mensaje: 'consulta', solicitudId: ID })).ok, true);
  }
  const invalidos = [
    { tipo: 'mensaje', mensaje: '   ' },
    { tipo: 'resultado_titular', datos: { destino: 'titular', reservas: [{ id: ID, estado: 'pendiente', email: 'privado' }] } },
    { tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion', borrador: { titulo: 'Libro', descripcion: 'Usado' }, requiereRevisionHumana: false } },
  ];
  for (const datos of invalidos) {
    const client = crearClienteAgente({ obtenerToken: async () => 'token', fetchImpl: async () => Response.json({
      ok: true, datos, error: null, solicitudId: ID,
    }) });
    assert.equal((await client.solicitar({ mensaje: 'consulta', solicitudId: ID })).error.codigo, 'SERVIDOR');
  }
});

test('cancelación y timeout terminan token/fetch que ignoran AbortSignal', async () => {
  const never = () => new Promise(() => {});
  const timed = crearClienteAgente({ obtenerToken: never, timeoutMs: 5 });
  assert.equal((await timed.solicitar({ mensaje: 'hola', solicitudId: ID })).error.codigo, 'TIEMPO_AGOTADO');

  const cancelled = crearClienteAgente({ obtenerToken: async () => 'token', fetchImpl: never });
  const pending = cancelled.solicitar({ mensaje: 'hola', solicitudId: ID });
  await Promise.resolve(); cancelled.cancelarPendientes();
  assert.equal((await pending).error.codigo, 'CANCELADA');
});

test('respuesta demasiado grande se rechaza y no se interpreta parcialmente', async () => {
  const client = crearClienteAgente({ obtenerToken: async () => 'token', fetchImpl: async () =>
    new Response(' '.repeat(33000), { headers: { 'content-type': 'application/json' } }) });
  assert.equal((await client.solicitar({ mensaje: 'hola', solicitudId: ID })).error.codigo, 'SERVIDOR');
});

test('cliente rechaza envelopes cuyo estado HTTP contradice el resultado', async () => {
  const casos = [
    { status: 503, body: { ok: true, datos: { tipo: 'mensaje', mensaje: 'falso éxito' }, error: null, solicitudId: ID } },
    { status: 200, body: { ok: false, datos: null, error: { codigo: 'AGENTE_DESHABILITADO' }, solicitudId: ID } },
  ];
  for (const item of casos) {
    const client = crearClienteAgente({ obtenerToken: async () => 'token', fetchImpl: async () => Response.json(item.body, { status: item.status }) });
    assert.equal((await client.solicitar({ mensaje: 'hola', solicitudId: ID })).error.codigo, 'SERVIDOR');
  }
});

test('señal cancelada antes de solicitar no obtiene token ni hace fetch', async () => {
  const stop = new AbortController(); stop.abort(); let tokens = 0, requests = 0;
  const client = crearClienteAgente({ obtenerToken: async () => { tokens++; return 'privado'; },
    fetchImpl: async () => { requests++; return Response.json({}); } });
  assert.equal((await client.solicitar({ mensaje: 'hola', solicitudId: ID, signal: stop.signal })).error.codigo, 'CANCELADA');
  assert.deepEqual([tokens, requests], [0, 0]);
});

test('historial del navegador no autorizado no obtiene token', async () => {
  let tokens = 0;
  const client = crearClienteAgente({ obtenerToken: async () => { tokens++; return 'privado'; }, fetchImpl: async () => { throw Error('sin red'); } });
  const response = await client.solicitar({ mensaje: 'hola', solicitudId: ID, contexto: [{ role: 'assistant', content: 'reserva pendiente' }] });
  assert.equal(response.error.codigo, 'VALIDACION'); assert.equal(tokens, 0);
});
