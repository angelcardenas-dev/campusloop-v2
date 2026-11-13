import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

// Solo archivos locales y módulos estándar. No npm, SDK real, HTML ni servidor.
const fuentes = Object.fromEntries(await Promise.all(
  ['auth.js', 'config-publica.js', 'supabase-cliente.js'].map(async nombre => [
    nombre, await readFile(new URL(`../../js/${nombre}`, import.meta.url), 'utf8'),
  ]),
));
const plano = valor => JSON.parse(JSON.stringify(valor));
const esperar = () => new Promise(resolve => setTimeout(resolve, 10));
const USUARIO = { id: '3f926c15-550b-42b9-8aa0-b08279954bcb', email: 'comprador@example.invalid' };
const SESION = { user: { ...USUARIO, user_metadata: { privado: 'no devolver' } }, access_token: 'TOKEN_SIMULADO', refresh_token: 'REFRESH_SIMULADO' };
const registro = () => ({
  nombreVisible: 'Usuario de prueba',
  universidadId: '32743dbf-f51c-46c4-a3cc-05309394a338',
  campusId: '45c7a23e-3d10-49dd-a27a-27dfce6d2471',
  correo: '  Comprador@example.invalid  ',
  contrasena: 'clave solo de prueba',
  confirmarContrasena: 'clave solo de prueba',
  aceptaTerminos: true,
});
// Valores sintéticos reservados: no corresponden al proyecto CampusLoop.
const configuracionPrueba = () => ({
  supabaseUrl: 'https://supabase.example.invalid',
  supabasePublishableKey: 'sb_publishable_' + 'x'.repeat(32),
});

function entorno() {
  const control = { intentosRed: 0, mensajesConsola: 0 };
  const prohibido = () => { control.intentosRed++; throw new Error('Red deshabilitada en pruebas'); };
  const contexto = createContext({
    URL, setTimeout, clearTimeout, fetch: prohibido,
    console: { log() { control.mensajesConsola++; }, warn() { control.mensajesConsola++; }, error() { control.mensajesConsola++; } },
    // Sin document, window ni storage: el servicio no necesita DOM ni tokens propios.
  });
  const modulo = nombre => new SourceTextModule(fuentes[nombre], {
    context: contexto, identifier: nombre, importModuleDynamically: prohibido,
  });
  return { control, contexto, modulo };
}

async function cargarCliente() {
  const e = entorno();
  const config = e.modulo('config-publica.js');
  await config.link(() => { throw new Error('Importación inesperada'); });
  await config.evaluate();
  const cliente = e.modulo('supabase-cliente.js');
  await cliente.link(nombre => {
    assert.equal(nombre, './config-publica.js');
    return config;
  });
  await cliente.evaluate();
  return { ...e, config: config.namespace, cliente: cliente.namespace };
}

function sdkSimulado() {
  const llamadas = [];
  const listeners = new Set();
  const estado = { session: SESION, cancelaciones: 0, dentroCallback: false };
  const auth = {
    async signUp(datos) { llamadas.push(['signUp', datos]); return { data: { user: SESION.user, session: estado.session }, error: null }; },
    async signInWithPassword(datos) { llamadas.push(['signInWithPassword', datos]); return { data: { user: SESION.user, session: estado.session }, error: null }; },
    async getUser() {
      assert.equal(estado.dentroCallback, false, 'No consultar SDK dentro del callback');
      llamadas.push(['getUser']);
      return { data: { user: estado.session?.user ?? null }, error: null };
    },
    async getSession() { llamadas.push(['getSession']); return { data: { session: estado.session }, error: null }; },
    async signOut(opciones) { llamadas.push(['signOut', opciones]); estado.session = null; return { error: null }; },
    onAuthStateChange(fn) {
      llamadas.push(['onAuthStateChange']); listeners.add(fn);
      fn('INITIAL_SESSION', estado.session);
      return { data: { subscription: { unsubscribe() { estado.cancelaciones++; listeners.delete(fn); } } } };
    },
  };
  const emitir = (evento, session = estado.session) => {
    estado.dentroCallback = true;
    try { for (const fn of listeners) fn(evento, session); }
    finally { estado.dentroCallback = false; }
  };
  return { auth, estado, llamadas, listeners, emitir };
}

async function cargarAuth({ sdk = sdkSimulado(), proveedor } = {}) {
  const e = entorno();
  let consultasCliente = 0;
  const obtener = proveedor ?? (async () => {
    consultasCliente++;
    return { ok: true, datos: { auth: sdk.auth }, error: null };
  });
  const inyectado = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', obtener);
  }, { context: e.contexto });
  const modulo = e.modulo('auth.js');
  await modulo.link(nombre => {
    assert.equal(nombre, './supabase-cliente.js');
    return inyectado;
  });
  await modulo.evaluate();
  return { ...e, sdk, auth: modulo.namespace, consultasCliente: () => consultasCliente };
}

function sinSecretos(valor) {
  const texto = JSON.stringify(valor);
  for (const prohibido of ['access_token', 'refresh_token', 'TOKEN_SIMULADO', 'REFRESH_SIMULADO', 'password', 'contrasena', 'user_metadata', 'no devolver']) {
    assert.equal(texto.includes(prohibido), false, prohibido);
  }
}

test('configuración vacía: error normalizado, sin cargar SDK ni red', async () => {
  const e = await cargarCliente();
  const resultado = await e.cliente.obtenerClienteSupabase();
  assert.equal(resultado.error.codigo, 'CONFIGURACION');
  assert.equal(e.control.intentosRed, 0);
  assert.equal(e.control.mensajesConsola, 0);
});

test('configuración pública: HTTPS/publishable únicamente; no JWT ni secret', async () => {
  const { config } = await cargarCliente();
  assert.equal(config.validarConfiguracionPublica(configuracionPrueba()).ok, true);
  const casos = [null, {}, { ...configuracionPrueba(), supabaseUrl: 'http://supabase.example.invalid' },
    { ...configuracionPrueba(), supabaseUrl: 'https://usuario:clave@example.invalid' },
    { ...configuracionPrueba(), supabaseUrl: 'https://example.invalid/ruta' },
    { ...configuracionPrueba(), supabaseUrl: 'https://example.invalid?key=no' },
    { ...configuracionPrueba(), supabasePublishableKey: 'sb_secret_' + 'x'.repeat(32) },
    { ...configuracionPrueba(), supabasePublishableKey: 'eyJ.solo.simulado' }];
  for (const valor of casos) assert.equal(config.validarConfiguracionPublica(valor).error.codigo, 'CONFIGURACION');
});

test('cliente: una creación incluso con llamadas concurrentes, opciones SDK y caché', async () => {
  const { cliente, control } = await cargarCliente();
  let cargas = 0; let creaciones = 0;
  const doble = { auth: {} };
  const obtener = cliente.crearProveedorCliente({
    configuracion: configuracionPrueba(),
    cargarSdk: async () => {
      cargas++;
      await esperar();
      return { createClient(url, clave, opciones) {
        creaciones++;
        assert.equal(url, configuracionPrueba().supabaseUrl);
        assert.equal(clave, configuracionPrueba().supabasePublishableKey);
        assert.deepEqual(plano(opciones.auth), { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', debug: false });
        return doble;
      } };
    },
  });
  const resultados = await Promise.all([obtener(), obtener(), obtener()]);
  assert.ok(resultados.every(r => r.datos === doble));
  assert.equal((await obtener()).datos, doble);
  assert.equal(cargas, 1); assert.equal(creaciones, 1); assert.equal(control.intentosRed, 0);
});

test('cliente: carga fallida controlada y reintento explícito', async () => {
  const { cliente } = await cargarCliente(); let intentos = 0;
  const obtener = cliente.crearProveedorCliente({ configuracion: configuracionPrueba(), cargarSdk: async () => {
    intentos++; if (intentos === 1) throw new Error('detalle no público');
    return { createClient: () => ({ auth: {} }) };
  } });
  assert.equal((await obtener()).error.codigo, 'RED');
  assert.equal((await obtener()).ok, true); assert.equal(intentos, 2);
});

test('cliente: excepción createClient es CONFIGURACION, sin detalles, y admite reintento', async () => {
  const { cliente, control } = await cargarCliente(); let intentos = 0;
  const obtener = cliente.crearProveedorCliente({
    configuracion: configuracionPrueba(),
    cargarSdk: async () => ({ createClient() {
      intentos++;
      if (intentos === 1) throw new TypeError('TOKEN_SIMULADO');
      return { auth: {} };
    } }),
  });
  const fallo = await obtener();
  assert.equal(fallo.ok, false); assert.equal(fallo.error.codigo, 'CONFIGURACION');
  sinSecretos(fallo);
  assert.equal((await obtener()).ok, true);
  await obtener();
  assert.equal(intentos, 2); assert.equal(control.intentosRed, 0);
});

test('cliente: SDK sin createClient es CONFIGURACION, no RED', async () => {
  const { cliente } = await cargarCliente();
  const obtener = cliente.crearProveedorCliente({ configuracion: configuracionPrueba(), cargarSdk: async () => ({}) });
  const r = await obtener();
  assert.equal(r.error.codigo, 'CONFIGURACION'); sinSecretos(r);
});

test('auth exporta exactamente las siete funciones acordadas', async () => {
  const e = await cargarAuth();
  assert.deepEqual(Object.keys(e.auth).sort(), ['registrar', 'iniciarSesion', 'obtenerUsuarioActual', 'obtenerEstadoAuth', 'cerrarSesion', 'escucharCambiosAuth', 'requerirAutenticacion'].sort());
  assert.equal(e.control.intentosRed, 0); assert.equal(e.control.mensajesConsola, 0);
});

test('integración offline de proveedor real y Auth: un cliente para dos operaciones concurrentes', async () => {
  const cliente = await cargarCliente(); const sdk = sdkSimulado(); let creaciones = 0;
  const proveedor = cliente.cliente.crearProveedorCliente({
    configuracion: configuracionPrueba(),
    cargarSdk: async () => ({ createClient() { creaciones++; return { auth: sdk.auth }; } }),
  });
  const e = await cargarAuth({ sdk, proveedor });
  const respuestas = await Promise.all([e.auth.iniciarSesion(USUARIO.email, 'prueba'), e.auth.obtenerEstadoAuth()]);
  assert.equal(creaciones, 1);
  for (const r of respuestas) { assert.equal(r.datos.estado, 'AUTENTICADO'); sinSecretos(r); }
  assert.equal(cliente.control.intentosRed, 0); assert.equal(e.control.intentosRed, 0);
});

test('registro válido: solo email/password a signUp, sin datos de perfil ni tokens de salida', async () => {
  const e = await cargarAuth();
  const r = await e.auth.registrar(registro());
  assert.deepEqual(plano(r), { ok: true, datos: { estado: 'AUTENTICADO', usuario: { id: USUARIO.id, correo: USUARIO.email } }, error: null });
  assert.deepEqual(plano(e.sdk.llamadas), [['signUp', { email: 'comprador@example.invalid', password: registro().contrasena }]]);
  sinSecretos(r);
});

const invalidos = [
  ['sin datos', undefined], ['nulo', null], ['array', []],
  ['nombre vacío', { ...registro(), nombreVisible: ' ' }],
  ['correo incorrecto', { ...registro(), correo: 'correo' }],
  ['universidad sin ID', { ...registro(), universidadId: 'PUCP' }],
  ['campus sin ID', { ...registro(), campusId: '' }],
  ['contraseña corta', { ...registro(), contrasena: 'corta', confirmarContrasena: 'corta' }],
  ['contraseñas diferentes', { ...registro(), confirmarContrasena: 'otra' }],
  ['términos no aceptados', { ...registro(), aceptaTerminos: false }],
  ['términos como texto', { ...registro(), aceptaTerminos: 'true' }],
];
for (const [nombre, datos] of invalidos) test(`registro inválido: ${nombre}, cero solicitudes`, async () => {
  const e = await cargarAuth(); const r = await e.auth.registrar(datos);
  assert.equal(r.error.codigo, 'VALIDACION');
  assert.equal(e.sdk.llamadas.length, 0); assert.equal(e.consultasCliente(), 0);
});

test('registro sin sesión: pendiente, nunca autenticado', async () => {
  const e = await cargarAuth(); e.sdk.estado.session = null;
  const r = await e.auth.registrar(registro());
  assert.equal(r.ok, true); assert.equal(r.datos.estado, 'PENDIENTE_CONFIRMACION'); sinSecretos(r);
});

test('login válido: no recorta contraseña ni devuelve sesión', async () => {
  const e = await cargarAuth(); const clave = ' con espacios ';
  const r = await e.auth.iniciarSesion(' Comprador@example.invalid ', clave);
  assert.equal(r.datos.estado, 'AUTENTICADO');
  assert.deepEqual(plano(e.sdk.llamadas), [['signInWithPassword', { email: 'comprador@example.invalid', password: clave }]]);
  sinSecretos(r);
});

test('login inválido no obtiene cliente ni llama SDK', async () => {
  const e = await cargarAuth();
  assert.equal((await e.auth.iniciarSesion('no correo', '')).error.codigo, 'VALIDACION');
  assert.equal((await e.auth.iniciarSesion(123, true)).error.codigo, 'VALIDACION');
  assert.equal(e.consultasCliente(), 0);
});

for (const [nombre, error, codigo] of [
  ['credenciales', { code: 'invalid_credentials', status: 400 }, 'CREDENCIALES_INVALIDAS'],
  ['correo pendiente', { code: 'email_not_confirmed', status: 400 }, 'CORREO_PENDIENTE'],
  ['límite', { status: 429 }, 'LIMITE'],
  ['no autorizado', { status: 401 }, 'NO_AUTORIZADO'],
  ['servicio desactivado', { code: 'signup_disabled' }, 'CONFIGURACION'],
  ['servidor', { status: 503 }, 'SERVIDOR'],
]) test(`error SDK normalizado: ${nombre}`, async () => {
  const e = await cargarAuth();
  e.sdk.auth.signInWithPassword = async () => ({ data: null, error: { ...error, message: 'TOKEN_SIMULADO', session: SESION } });
  const r = await e.auth.iniciarSesion(USUARIO.email, 'clave de prueba');
  assert.equal(r.ok, false); assert.equal(r.error.codigo, codigo); assert.equal(typeof r.error.mensaje, 'string'); sinSecretos(r);
});

test('conexión fallida se distingue de sesión ausente', async () => {
  const e = await cargarAuth();
  e.sdk.auth.getUser = async () => { throw { name: 'AuthRetryableFetchError', status: 0, message: 'TOKEN_SIMULADO' }; };
  assert.equal((await e.auth.obtenerUsuarioActual()).error.codigo, 'RED');
  assert.equal((await e.auth.requerirAutenticacion()).error.codigo, 'RED');
});

for (const origen of ['operación SDK', 'proveedor de cliente']) test(`TypeError interno de ${origen} es SERVIDOR, no RED`, async () => {
  const error = new TypeError('TOKEN_SIMULADO');
  const e = await cargarAuth(origen === 'proveedor de cliente'
    ? { proveedor: async () => { throw error; } } : {});
  if (origen === 'operación SDK') e.sdk.auth.getUser = async () => { throw error; };
  const r = await e.auth.obtenerUsuarioActual();
  assert.equal(r.ok, false); assert.equal(r.error.codigo, 'SERVIDOR'); sinSecretos(r);
});

test('error SDK desconocido con status 0 no se confunde con transporte reconocido', async () => {
  const e = await cargarAuth();
  e.sdk.auth.getUser = async () => ({ data: null, error: { name: 'AuthApiError', code: 'desconocido', status: 0, message: 'TOKEN_SIMULADO' } });
  const r = await e.auth.obtenerUsuarioActual();
  assert.equal(r.error.codigo, 'SERVIDOR'); sinSecretos(r);
});

test('getUser sin sesión: null; guarda sin DOM devuelve NO_AUTORIZADO', async () => {
  const e = await cargarAuth();
  e.sdk.auth.getUser = async () => ({ data: { user: null }, error: { name: 'AuthSessionMissingError' } });
  assert.deepEqual(plano(await e.auth.obtenerUsuarioActual()), { ok: true, datos: null, error: null });
  assert.equal((await e.auth.requerirAutenticacion()).error.codigo, 'NO_AUTORIZADO');
});

test('getUser lanza AuthSessionMissingError: mismo resultado que error devuelto', async () => {
  const e = await cargarAuth();
  e.sdk.auth.getUser = async () => { throw { name: 'AuthSessionMissingError', message: 'TOKEN_SIMULADO' }; };
  const r = await e.auth.obtenerUsuarioActual();
  assert.deepEqual(plano(r), { ok: true, datos: null, error: null }); sinSecretos(r);
  assert.equal((await e.auth.requerirAutenticacion()).error.codigo, 'NO_AUTORIZADO');
});

test('usuario y guarda verificados con getUser, no estado local de getSession', async () => {
  const e = await cargarAuth();
  const u = await e.auth.obtenerUsuarioActual(); const g = await e.auth.requerirAutenticacion();
  assert.deepEqual(plano(u.datos), { id: USUARIO.id, correo: USUARIO.email });
  assert.equal(g.datos.estado, 'AUTENTICADO');
  assert.deepEqual(plano(e.sdk.llamadas), [['getUser'], ['getUser']]); sinSecretos(u); sinSecretos(g);
});

test('estado inicial espera restauración SDK; logout local y siguiente lectura sin sesión', async () => {
  const e = await cargarAuth(); let restaurar;
  e.sdk.auth.getSession = () => new Promise(resolve => { restaurar = resolve; });
  let terminado = false;
  const inicial = e.auth.obtenerEstadoAuth().then(r => { terminado = true; return r; });
  await esperar(); assert.equal(terminado, false);
  restaurar({ data: { session: SESION }, error: null });
  const r = await inicial; assert.equal(r.datos.estado, 'AUTENTICADO'); sinSecretos(r);
  assert.equal((await e.auth.cerrarSesion()).datos.estado, 'NO_AUTENTICADO');
  assert.deepEqual(plano(e.sdk.llamadas), [['signOut', { scope: 'local' }]]);
  e.sdk.auth.getSession = async () => ({ data: { session: null }, error: null });
  assert.equal((await e.auth.obtenerEstadoAuth()).datos.estado, 'NO_AUTENTICADO');
});

test('logout fallido no anuncia cierre y preserva error normalizado', async () => {
  const e = await cargarAuth();
  e.sdk.auth.signOut = async () => ({ error: { name: 'AuthRetryableFetchError', message: 'REFRESH_SIMULADO' } });
  const r = await e.auth.cerrarSesion(); assert.equal(r.error.codigo, 'RED'); sinSecretos(r);
});

test('configuración faltante: todas las operaciones asíncronas fallan sin SDK/red', async () => {
  const cliente = await cargarCliente();
  const e = await cargarAuth({ proveedor: cliente.cliente.obtenerClienteSupabase });
  const resultados = await Promise.all([
    e.auth.registrar(registro()), e.auth.iniciarSesion(USUARIO.email, 'prueba'),
    e.auth.obtenerUsuarioActual(), e.auth.obtenerEstadoAuth(), e.auth.cerrarSesion(), e.auth.requerirAutenticacion(),
  ]);
  for (const r of resultados) { assert.equal(r.error.codigo, 'CONFIGURACION'); sinSecretos(r); }
  assert.equal(cliente.control.intentosRed, 0); assert.equal(e.sdk.llamadas.length, 0);
});

test('eventos INITIAL_SESSION/refresh/signout reducidos, diferidos y cancelación idempotente', async () => {
  const e = await cargarAuth(); const recibidos = []; const consultas = [];
  const cancelar = e.auth.escucharCambiosAuth(async r => {
    recibidos.push(plano(r));
    consultas.push(await e.auth.obtenerUsuarioActual());
  });
  await esperar();
  e.sdk.emitir('TOKEN_REFRESHED'); e.sdk.emitir('SIGNED_OUT', null);
  await esperar();
  assert.deepEqual(recibidos.map(r => r.evento), ['INITIAL_SESSION', 'TOKEN_REFRESHED', 'SIGNED_OUT']);
  assert.equal(recibidos[2].estado, 'NO_AUTENTICADO');
  assert.equal(consultas.length, 3);
  assert.ok(consultas.every(r => r.ok), 'Las consultas del consumidor deben salir del lock SDK');
  for (const r of recibidos) { assert.deepEqual(Object.keys(r).sort(), ['estado', 'evento', 'usuario']); sinSecretos(r); }
  cancelar(); cancelar();
  assert.equal(e.sdk.estado.cancelaciones, 1); assert.equal(e.sdk.listeners.size, 0);
  e.sdk.emitir('SIGNED_IN'); await esperar(); assert.equal(recibidos.length, 3);
});

test('cancelación antes de resolver cliente no deja suscripciones', async () => {
  const sdk = sdkSimulado(); let resolver;
  const e = await cargarAuth({ sdk, proveedor: () => new Promise(resolve => { resolver = resolve; }) });
  const eventos = []; const cancelar = e.auth.escucharCambiosAuth(r => eventos.push(r));
  cancelar(); resolver({ ok: true, datos: { auth: sdk.auth }, error: null });
  await esperar(); assert.equal(sdk.listeners.size, 0); assert.equal(sdk.llamadas.length, 0); assert.equal(eventos.length, 0);
});

test('cancelación elimina también eventos pendientes; errores del consumidor no rompen SDK', async () => {
  const e = await cargarAuth(); let entregados = 0;
  const cancelar = e.auth.escucharCambiosAuth(() => { entregados++; throw new Error('error UI'); });
  await esperar(); assert.equal(entregados, 1);
  e.sdk.emitir('SIGNED_IN'); cancelar(); await esperar();
  assert.equal(entregados, 1); assert.equal(e.control.mensajesConsola, 0);
});

test('eventos: callback inválido no crea cliente; configuración ausente se comunica sin secretos', async () => {
  const e = await cargarAuth(); e.auth.escucharCambiosAuth(null)();
  assert.equal(e.consultasCliente(), 0);
  const cliente = await cargarCliente();
  const faltante = await cargarAuth({ proveedor: cliente.cliente.obtenerClienteSupabase });
  const eventos = []; const cancelar = faltante.auth.escucharCambiosAuth(r => eventos.push(plano(r)));
  await esperar(); cancelar();
  assert.deepEqual(eventos, [{ evento: 'ERROR', estado: 'CONFIGURACION', usuario: null }]);
  sinSecretos(eventos); assert.equal(cliente.control.intentosRed, 0);
});

test('respuestas SDK incompletas no anuncian autenticación', async () => {
  const e = await cargarAuth();
  e.sdk.auth.signUp = async () => ({ data: null, error: null });
  e.sdk.auth.signInWithPassword = async () => ({ data: { user: USUARIO }, error: null });
  e.sdk.auth.getSession = async () => ({ data: { session: { access_token: 'TOKEN_SIMULADO' } }, error: null });
  for (const r of [await e.auth.registrar(registro()), await e.auth.iniciarSesion(USUARIO.email, 'prueba'), await e.auth.obtenerEstadoAuth()]) {
    assert.equal(r.ok, false); assert.equal(r.error.codigo, 'SERVIDOR'); sinSecretos(r);
  }
});
