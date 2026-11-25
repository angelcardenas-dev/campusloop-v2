import test from 'node:test';
import assert from 'node:assert/strict';
import handlerDefault, { crearHandlerAgente } from '../../netlify/functions/agente.mjs';
import { crearProveedorNvidia, ENDPOINT_NVIDIA } from '../../netlify/functions/lib/agente-nvidia.mjs';
import { crearVerificadorAuth } from '../../netlify/functions/lib/agente-auth.mjs';
import { proyectarArticulos, validarSolicitud } from '../../netlify/functions/lib/agente-seguridad.mjs';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
const origen = 'https://campus.example';
const body = (patch = {}) => ({ schemaVersion: 1, solicitudId: ID, mensaje: 'Ayúdame a buscar libros.', contexto: [], ...patch });
const req = ({ method = 'POST', headers = {}, data = body() } = {}) => new Request('https://campus.example/api/agente', {
  method, headers: { origin: origen, 'content-type': 'application/json', authorization: 'Bearer token-sintetico', ...headers },
  body: method === 'GET' ? undefined : JSON.stringify(data),
});
const envActivo = { IA_HABILITADA: 'true', NVIDIA_API_KEY: 'no-usar-secreto-de-prueba',
  NVIDIA_MODEL: 'org/model', NVIDIA_MODELOS_APROBADOS: 'org/model' };
const config = (overrides = {}) => {
  const { servicios, ...rest } = overrides;
  return { env: envActivo, origenPermitido: origen,
    verificarUsuario: async () => ({ ok: true, actor: ACTOR }), reservarCuota: async () => ({ permitida: true }),
    crearServiciosAutorizados: async () => servicios ?? {},
    proveedor: { completar: async () => ({ ok: true, mensaje: { content: 'Respuesta', tool_calls: [] } }) }, ...rest };
};

test('handler desplegado cerrado por defecto y respuestas no cacheables', async () => {
  const response = await handlerDefault(req());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal((await response.json()).error.codigo, 'AGENTE_DESHABILITADO');
});

test('método, tipo, origen, auth y cuota controlados antes de proveedor', async () => {
  let calls = 0;
  const h = crearHandlerAgente(config({ proveedor: { completar: async () => { calls++; return { ok: true, mensaje: { content: '', tool_calls: [] } }; } } }));
  assert.equal((await h(req({ method: 'GET' }))).status, 405);
  assert.equal((await h(req({ method: 'GET' }))).headers.get('allow'), 'POST');
  assert.equal((await h(req({ headers: { 'content-type': 'text/plain' } }))).status, 415);
  assert.equal((await h(req({ headers: { origin: 'https://attacker.example' } }))).status, 403);
  assert.equal((await crearHandlerAgente(config({ verificarUsuario: async () => ({ ok: false }) }))(req())).status, 401);
  assert.equal((await crearHandlerAgente(config({ reservarCuota: undefined }))(req())).status, 503);
  assert.equal(calls, 0);
});

test('esquema rechaza campos extra, roles privilegiados, contexto excesivo y texto sospechoso', async () => {
  assert.equal(validarSolicitud(body({ system: 'override' })), null);
  assert.equal(validarSolicitud(body({ contexto: [{ role: 'system', content: 'root' }] })), null);
  assert.equal(validarSolicitud(body({ contexto: Array(9).fill({ role: 'user', content: 'x' }) })), null);
  let modelCalls = 0;
  const h = crearHandlerAgente(config({ proveedor: { completar: async () => { modelCalls++; } } }));
  assert.equal((await h(req({ data: body({ mensaje: 'mi contraseña: secreto' }) }))).status, 400);
  assert.equal((await h(req({ data: body({ mensaje: 'llámame al +51 987 654 321' }) }))).status, 400);
  assert.equal((await h(req({ data: body({ contexto: [{ role: 'assistant', content: 'Reserva privada' }] }) }))).status, 400);
  assert.equal(modelCalls, 0);
});

test('límite del servidor termina esperas de Auth y proveedor aunque ignoren AbortSignal', async () => {
  const never = () => new Promise(() => {});
  const auth = crearHandlerAgente(config({ verificarUsuario: never, timeoutMs: 15 }));
  const authResponse = await auth(req());
  assert.equal(authResponse.status, 504);
  const provider = crearHandlerAgente(config({ proveedor: { completar: never }, timeoutMs: 15 }));
  const providerResponse = await provider(req());
  assert.equal(providerResponse.status, 504);
});

test('cuerpo lento respeta el timeout y cancela el stream antes de Auth o cuota', async () => {
  let cancelado = false; let authCalls = 0;
  const stream = new ReadableStream({ cancel() { cancelado = true; } });
  const request = new Request('https://campus.example/api/agente', { method: 'POST', duplex: 'half', body: stream,
    headers: { origin: origen, 'content-type': 'application/json', authorization: 'Bearer token-sintetico' } });
  const response = await crearHandlerAgente(config({ timeoutMs: 10,
    verificarUsuario: async () => { authCalls++; return { ok: true, actor: ACTOR }; } }))(request);
  assert.equal(response.status, 504); assert.equal(authCalls, 0); assert.equal(cancelado, true);
});

test('JSON malformado, exceso real de bytes, token y actor del cuerpo se rechazan', async () => {
  const h = crearHandlerAgente(config());
  const raw = headers => new Request('https://campus.example/api/agente', { method: 'POST',
    headers: { origin: origen, 'content-type': 'application/json', authorization: 'Bearer token-sintetico', ...headers }, body: '{' });
  assert.equal((await h(raw({}))).status, 400);
  const grande = new Request('https://campus.example/api/agente', { method: 'POST',
    headers: { origin: origen, 'content-type': 'application/json', authorization: 'Bearer token-sintetico' }, body: ' '.repeat(8193) });
  assert.equal((await h(grande)).status, 413);
  assert.equal((await h(req({ headers: { authorization: '' } }))).status, 401);
  assert.equal((await h(req({ data: body({ actor: ACTOR }) }))).status, 400);
});

test('cuota denegada o fallida y config NVIDIA incompleta nunca contactan al proveedor', async () => {
  let providerCalls = 0;
  const proveedor = { completar: async () => { providerCalls++; return { ok: true, mensaje: { content: 'no', tool_calls: [] } }; } };
  assert.equal((await crearHandlerAgente(config({ proveedor, reservarCuota: async () => ({ permitida: false }) }))(req())).status, 429);
  assert.equal((await crearHandlerAgente(config({ proveedor, reservarCuota: async () => { throw Error('privado'); } }))(req())).status, 503);
  const incompleto = crearHandlerAgente(config({ proveedor: crearProveedorNvidia({ env: { IA_HABILITADA: 'true' } }) }));
  assert.equal((await incompleto(req())).status, 503);
  assert.equal(providerCalls, 0);
});

test('tool-call de reservas se devuelve al titular sin enviarlo en llamada posterior a NVIDIA', async () => {
  const pedidos = []; let reservaCalls = 0;
  const provider = { completar: async ({ mensajes, herramientas }) => {
    pedidos.push(structuredClone({ mensajes, herramientas }));
    return { ok: true, mensaje: { content: '', tool_calls: [{ id: 'c1', type: 'function',
      function: { name: 'consultar_mis_reservas', arguments: '{}' } }] } };
  } };
  const services = { consultarMisReservas: async actor => { reservaCalls++; assert.equal(actor, ACTOR);
    return { ok: true, datos: [{ id: ID, estado: 'pendiente', detallePrivado: 'no model' }], error: null }; } };
  const response = await crearHandlerAgente(config({ proveedor: provider, servicios: services }))(req());
  const json = await response.json();
  assert.equal(json.datos?.tipo, 'resultado_titular', JSON.stringify(json)); assert.equal(reservaCalls, 1);
  assert.equal(pedidos.length, 1); assert.doesNotMatch(JSON.stringify(pedidos), /pendiente|abcdefab/);
  assert.doesNotMatch(JSON.stringify(pedidos), /token-sintetico|11111111-1111-4111-8111-111111111111/);
  assert.equal(pedidos[0].mensajes[0].content.includes('No solicites contraseñas'), true);
});

test('artículos enviados al proveedor se minimizan; herramienta desconocida nunca se ejecuta', async () => {
  const requests = []; let catalogoCalls = 0;
  const provider = { completar: async ({ mensajes }) => {
    requests.push(structuredClone(mensajes));
    if (requests.length === 1) return { ok: true, mensaje: { content: '', tool_calls: [{ id: 'c1', type: 'function',
      function: { name: 'buscar_articulos', arguments: JSON.stringify({ busqueda: '', categorias: [], universidad: '', campus: '',
        estados: [], condiciones: ['usado'], precioMinimoCentimos: null, precioMaximoCentimos: 10000, orden: 'recientes' }) } }] } };
    return { ok: true, mensaje: { content: 'Encontré una opción.', tool_calls: [] } };
  } };
  const services = { consultarCatalogo: async () => { catalogoCalls++; return { ok: true, error: null, datos: [
    { id: ID, titulo: 'Libro', precioCentimos: 5000, moneda: 'PEN', estado: 'disponible', vendedorId: ACTOR,
      correo: 'private@example.test', signedUrl: 'https://secret.test' }] }; } };
  const response = await crearHandlerAgente(config({ proveedor: provider, servicios: services }))(req());
  assert.equal(response.status, 200, await response.clone().text()); assert.equal(catalogoCalls, 1);
  assert.match(JSON.stringify(requests[1]), /Libro/);
  for (const ronda of requests) assert.doesNotMatch(JSON.stringify(ronda), /private@example|signedUrl|secret\.test|vendedorId|token-sintetico|11111111-1111-4111-8111-111111111111/);
});

test('el total de ejecuciones de herramientas queda limitado a tres por solicitud', async () => {
  let providerCalls = 0; let serviceCalls = 0;
  const call = n => ({ id: `call-${n}`, type: 'function', function: { name: 'buscar_articulos',
    arguments: JSON.stringify({ busqueda: '', categorias: [], universidad: '', campus: '', estados: [], condiciones: [],
      precioMinimoCentimos: null, precioMaximoCentimos: null, orden: 'recientes' }) } });
  const proveedor = { completar: async () => ({ ok: true, mensaje: { content: '', tool_calls:
    ++providerCalls === 1 ? [call(1), call(2), call(3)] : [call(4)] } }) };
  const servicios = { consultarCatalogo: async () => { serviceCalls++; return { ok: true, datos: [], error: null }; } };
  const response = await crearHandlerAgente(config({ proveedor, servicios }))(req());
  assert.equal(response.status, 502); assert.equal(providerCalls, 2); assert.equal(serviceCalls, 3);
});

test('proyección rechaza dispersos, duplicados privados y estructuras no autorizadas', () => {
  const sparse = new Array(1);
  assert.equal(proyectarArticulos(sparse), null);
  assert.equal(proyectarArticulos([{ id: ID, titulo: 'x', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' },
    { id: ID.toUpperCase(), titulo: 'x', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' }]), null);
  assert.deepEqual(proyectarArticulos([{ id: ID, titulo: 'x', precioCentimos: 1, moneda: 'PEN', estado: 'disponible', email: 'x' }]),
    [{ id: ID, titulo: 'x', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' }]);
  assert.equal(proyectarArticulos([{ id: ID, titulo: 'Contacto persona@example.test', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' }]), null);
  assert.equal(proyectarArticulos([{ id: ID, titulo: 'Llamar +51 987 654 321', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' }]), null);
});

test('verificador Auth exige usuario registrado y no usa identidad del cuerpo', async () => {
  let urlSeen; let headersSeen;
  const verify = crearVerificadorAuth({ env: { SUPABASE_URL: 'https://project.example', SUPABASE_PUBLISHABLE_KEY: 'public' },
    fetchImpl: async (url, options) => { urlSeen = url; headersSeen = options.headers;
      return Response.json({ id: ACTOR, is_anonymous: false }); } });
  assert.deepEqual(await verify({ token: 'opaque-token' }), { ok: true, actor: ACTOR });
  assert.equal(urlSeen, 'https://project.example/auth/v1/user'); assert.equal(headersSeen.authorization, 'Bearer opaque-token');
  const anon = crearVerificadorAuth({ env: { SUPABASE_URL: 'https://project.example', SUPABASE_PUBLISHABLE_KEY: 'public' },
    fetchImpl: async () => Response.json({ id: ACTOR, is_anonymous: true }) });
  assert.equal((await anon({ token: 'opaque-token' })).codigo, 'NO_AUTORIZADO');
});

test('verificador Auth limita el cuerpo remoto y no conserva metadatos innecesarios', async () => {
  const verify = crearVerificadorAuth({ env: { SUPABASE_URL: 'https://project.example', SUPABASE_PUBLISHABLE_KEY: 'public' },
    fetchImpl: async () => Response.json({ id: ACTOR, is_anonymous: false, user_metadata: { bio: 'x'.repeat(9000) } }) });
  assert.deepEqual(await verify({ token: 'opaque-token' }), { ok: false, codigo: 'AUTH_NO_DISPONIBLE' });
});

test('verificador Auth no hace fetch con señal previamente cancelada', async () => {
  const control = new AbortController(); control.abort(); let llamadas = 0;
  const verify = crearVerificadorAuth({ env: { SUPABASE_URL: 'https://project.example', SUPABASE_PUBLISHABLE_KEY: 'public' },
    fetchImpl: async () => { llamadas++; throw Error('no debe llamarse'); } });
  assert.deepEqual(await verify({ token: 'opaque-token', signal: control.signal }), { ok: false, codigo: 'CANCELADO' });
  assert.equal(llamadas, 0);
});

test('adaptador NVIDIA conserva endpoint, modelo server-side y normaliza secretos', async () => {
  let sent;
  const provider = crearProveedorNvidia({ env: envActivo, fetchImpl: async (url, options) => {
    sent = { url, options }; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Hola' } }] });
  } });
  const result = await provider.completar({ mensajes: [{ role: 'user', content: 'hola' }] });
  assert.equal(result.ok, true, JSON.stringify({ result, sent })); assert.equal(sent.url, ENDPOINT_NVIDIA);
  assert.equal(sent.options.headers.authorization, `Bearer ${envActivo.NVIDIA_API_KEY}`);
  assert.equal(JSON.parse(sent.options.body).model, 'org/model');
  const cuerpo = JSON.parse(sent.options.body);
  assert.deepEqual(Object.keys(cuerpo).sort(), ['max_tokens', 'messages', 'model', 'stream', 'tool_choice', 'tools']);
  assert.deepEqual(cuerpo.messages, [{ role: 'user', content: 'hola' }]);
  assert.equal(JSON.stringify(cuerpo).includes('opaque-token'), false);
  const disabled = await crearProveedorNvidia({ env: { ...envActivo, IA_HABILITADA: 'false' }, fetchImpl: async () => { throw Error('no'); } }).completar({ mensajes: [] });
  assert.equal(disabled.ok, false);
});

test('NVIDIA normaliza errores, rechaza respuestas incompatibles y mapea su timeout', async () => {
  const crear = fetchImpl => crearProveedorNvidia({ env: envActivo, fetchImpl });
  const error = await crear(async () => new Response('API_KEY_PRIVADA', { status: 500 })).completar({ mensajes: [] });
  assert.deepEqual(error, { ok: false, codigo: 'PROVEEDOR_ERROR' });
  const malformed = await crear(async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'x' } }] }))
    .completar({ mensajes: [] });
  assert.deepEqual(malformed, { ok: false, codigo: 'RESPUESTA_INVALIDA' });
  const tipoInvalido = await crear(async () => Response.json({ choices: [{ finish_reason: 'stop', message: 7 }] }))
    .completar({ mensajes: [] });
  assert.deepEqual(tipoInvalido, { ok: false, codigo: 'RESPUESTA_INVALIDA' });
  const timed = await crearProveedorNvidia({ env: envActivo, fetchImpl: () => new Promise(() => {}), timeoutMs: 5 })
    .completar({ mensajes: [] });
  assert.equal(timed.codigo, 'TIEMPO_AGOTADO');
});

test('señal cancelada previamente no inicia Auth, cuota ni NVIDIA', async () => {
  const stop = new AbortController(); stop.abort();
  let auth = 0, cuota = 0, modelo = 0;
  const h = crearHandlerAgente(config({ verificarUsuario: async () => { auth++; return { ok: true, actor: ACTOR }; },
    reservarCuota: async () => { cuota++; return { permitida: true }; },
    proveedor: { completar: async () => { modelo++; return { ok: true, mensaje: { content: 'sí', tool_calls: [] } }; } } }));
  const response = await h(new Request(req(), { signal: stop.signal }));
  assert.equal(response.status, 408); assert.deepEqual([auth, cuota, modelo], [0, 0, 0]);
  let fetches = 0;
  const provider = crearProveedorNvidia({ env: envActivo, fetchImpl: async () => { fetches++; return Response.json({}); } });
  assert.deepEqual(await provider.completar({ mensajes: [], signal: stop.signal }), { ok: false, codigo: 'CANCELADO' });
  assert.equal(fetches, 0);
});

test('respuestas contradictorias del modelo se rechazan antes de ejecutar herramientas', async () => {
  let servicios = 0;
  const calls = [{ id: 'c1', type: 'function', function: { name: 'consultar_mis_reservas', arguments: '{}' } }];
  for (const mensaje of [
    { content: '', tool_calls: [] },
    { content: '', tool_calls: new Array(1) },
    { content: '', tool_calls: [{ ...calls[0], id: 'x' }, { ...calls[0], id: 'x' }] },
    { content: '', tool_calls: [{ ...calls[0], function: { ...calls[0].function, arguments: '{' } }] },
  ]) {
    const h = crearHandlerAgente(config({ proveedor: { completar: async () => ({ ok: true, mensaje }) },
      servicios: { consultarMisReservas: async () => { servicios++; return { ok: true, datos: [], error: null }; } } }));
    assert.notEqual((await h(req())).status, 200);
  }
  assert.equal(servicios, 0);
  const bad = crearProveedorNvidia({ env: envActivo, fetchImpl: async () => Response.json({
    choices: [{ finish_reason: 'tool_calls', message: { content: null } }],
  }) });
  assert.equal((await bad.completar({ mensajes: [] })).ok, false);
});

test('cuota cancelada o vencida conserva interrupción sin llegar al modelo', async () => {
  let llamadas = 0;
  const proveedor = { completar: async () => { llamadas++; return { ok: true, mensaje: { content: 'no', tool_calls: [] } }; } };
  const vencido = crearHandlerAgente(config({ proveedor, timeoutMs: 10, reservarCuota: () => new Promise(() => {}) }));
  assert.equal((await vencido(req())).status, 504);
  const controlado = crearHandlerAgente(config({ proveedor, reservarCuota: async () => { throw { codigo: 'TIEMPO_AGOTADO', mensaje: 'privado' }; } }));
  assert.equal((await controlado(req())).status, 504);
  assert.equal(llamadas, 0);
});

test('abortar HTTP desmonta D2 y evita inferencias posteriores', async () => {
  const stop = new AbortController(); let iniciar;
  const iniciado = new Promise(resolve => { iniciar = resolve; });
  let servicioSignal; let modelo = 0;
  const h = crearHandlerAgente(config({ proveedor: { completar: async () => {
    modelo++; return { ok: true, mensaje: { content: '', tool_calls: [{ id: 'x', type: 'function',
      function: { name: 'consultar_mis_reservas', arguments: '{}' } }] } };
  } }, servicios: { consultarMisReservas: (_actor, { signal }) => {
    servicioSignal = signal; iniciar(); return new Promise(() => {});
  } } }));
  const pendiente = h(new Request(req(), { signal: stop.signal }));
  await iniciado; stop.abort();
  assert.equal((await pendiente).status, 408);
  assert.equal(servicioSignal.aborted, true); assert.equal(modelo, 1);
});

test('fábrica de servicios vincula solicitudes simultáneas a su actor sin filtrar tokens', async () => {
  const actorB = '22222222-2222-4222-8222-222222222222';
  const reservaB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const vistos = []; const nvidia = [];
  const h = crearHandlerAgente(config({
    verificarUsuario: async ({ token }) => ({ ok: true, actor: token === 'token-A' ? ACTOR : actorB }),
    crearServiciosAutorizados: ({ actor, token }) => ({ consultarMisReservas: async titular => {
      vistos.push({ actor, titular, token });
      return { ok: true, datos: [{ id: actor === ACTOR ? ID : reservaB, estado: 'pendiente', metadataPrivada: 'NUNCA_MODELO' }], error: null };
    } }),
    proveedor: { completar: async ({ mensajes }) => {
      nvidia.push(structuredClone(mensajes));
      return { ok: true, mensaje: { content: '', tool_calls: [{ id: 'r1', type: 'function',
        function: { name: 'consultar_mis_reservas', arguments: '{}' } }] } };
    } },
  }));
  const [a, b] = await Promise.all([h(req({ headers: { authorization: 'Bearer token-A' } })),
    h(req({ headers: { authorization: 'Bearer token-B' } }))]);
  assert.equal((await a.json()).datos.datos.reservas[0].id, ID);
  assert.equal((await b.json()).datos.datos.reservas[0].id, reservaB);
  assert.deepEqual(vistos.map(v => v.actor).sort(), [ACTOR, actorB].sort());
  assert.ok(vistos.every(v => v.actor === v.titular));
  for (const payload of nvidia) assert.doesNotMatch(JSON.stringify(payload), /token-A|token-B|NUNCA_MODELO|11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222/);
});
