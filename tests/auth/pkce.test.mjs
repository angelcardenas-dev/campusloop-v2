import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuentes = Object.fromEntries(await Promise.all([
  ['config', '../../js/config-publica.js'], ['cliente', '../../js/supabase-cliente.js'],
  ['auth', '../../js/auth.js'], ['retorno', './retorno-pkce.mjs'],
].map(async ([nombre, ruta]) => [nombre, await readFile(new URL(ruta, import.meta.url), 'utf8')])));
const BASE = 'http://127.0.0.1:5501/tests/auth/prueba-navegador.html';
const CODIGO = 'codigo-exclusivamente-sintetico';
const diferida = () => {
  let resolver;
  const promesa = new Promise(r => { resolver = r; });
  return { promesa, resolver };
};

async function preparar(url, { esperarSDK = Promise.resolve(), falloVerificacion = false } = {}) {
  let actual = url;
  const cambios = [], pasos = [], codigoLeido = diferida();
  const cuenta = { creaciones: 0, canjes: 0, manuales: 0, estado: 0, usuario: 0, red: 0 };
  const prohibido = () => { cuenta.red++; throw new Error('Red prohibida en la suite PKCE'); };
  const contexto = createContext({ URL, URLSearchParams, setTimeout, clearTimeout,
    fetch: prohibido, console: { log: prohibido, warn: prohibido, error: prohibido } });
  const modulo = nombre => new SourceTextModule(fuentes[nombre], {
    context: contexto, identifier: nombre, importModuleDynamically: prohibido,
  });
  const config = modulo('config');
  await config.link(() => { throw new Error('Import inesperado'); }); await config.evaluate();
  const cliente = modulo('cliente');
  await cliente.link(() => config); await cliente.evaluate();
  const proveedor = cliente.namespace.crearProveedorCliente({
    // Configuración exclusivamente sintética, inyectada sin editar producción.
    configuracion: { supabaseUrl: 'https://backend.example.invalid', supabasePublishableKey: 'sb_publishable_' + 'x'.repeat(32) },
    cargarSdk: async () => ({ createClient(_url, _clave, opciones) {
      cuenta.creaciones++;
      assert.equal(opciones.auth.flowType, 'pkce');
      assert.equal(opciones.auth.detectSessionInUrl, true);
      const hayCodigo = new URL(actual).searchParams.has('code');
      pasos.push('sdk-lee-url'); codigoLeido.resolver();
      let sesion = null;
      const inicializacion = (async () => {
        await esperarSDK;
        if (hayCodigo) {
          cuenta.canjes++;
          // Identidad y respuesta locales: no son usuario ni sesión reales.
          sesion = { user: { id: '11111111-1111-4111-8111-111111111111', email: 'pkce@example.invalid' } };
        }
        pasos.push('sdk-listo');
      })();
      const manualProhibido = () => { cuenta.manuales++; throw new Error('No debe existir un segundo canje'); };
      return { auth: {
        async getSession() { cuenta.estado++; await inicializacion; return { data: { session: sesion }, error: null }; },
        async getUser() {
          cuenta.usuario++; pasos.push('verificar-usuario'); await inicializacion;
          return falloVerificacion
            ? { data: { user: null }, error: { name: 'AuthRetryableFetchError' } }
            : { data: { user: sesion?.user ?? null }, error: null };
        },
        exchangeCodeForSession: manualProhibido, verifyOtp: manualProhibido,
      } };
    } }),
  });
  const inyectado = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', proveedor);
  }, { context: contexto });
  const auth = modulo('auth');
  await auth.link(ruta => ruta === './config-publica.js' ? config : inyectado); await auth.evaluate();
  const retorno = modulo('retorno');
  await retorno.link(() => auth); await retorno.evaluate();
  const control = retorno.namespace.crearPruebaRetorno({
    leerUrl: () => actual,
    reemplazarUrl: ruta => { pasos.push('limpiar-url'); cambios.push(ruta); actual = new URL(ruta, actual).href; },
  });
  return { control, cuenta, cambios, pasos, codigoLeido: codigoLeido.promesa, url: () => new URL(actual) };
}

function salidaSegura(resultado) {
  assert.deepEqual(Object.keys(resultado).sort(), ['estado', 'mensaje']);
  assert.doesNotMatch(JSON.stringify(resultado), /codigo-exclusivamente-sintetico|access_token|refresh_token|pkce@example|no-publicar/);
}

test('1. Sin código: no inventa sesión ni inicializa el SDK', async () => {
  const e = await preparar(BASE + '?vista=compacta#ayuda');
  const r = await e.control.procesar();
  assert.equal(r.estado, 'SIN_RETORNO'); salidaSegura(r);
  assert.equal(e.cuenta.creaciones, 0); assert.equal(e.cuenta.canjes, 0);
  assert.equal(e.cambios.length, 0); assert.equal(e.cuenta.red, 0);
});

test('2. Retorno válido simulado: un canje SDK, sin exchangeCodeForSession ni verifyOtp manual', async () => {
  const e = await preparar(BASE + '?code=' + CODIGO);
  const primera = e.control.procesar(), segunda = e.control.procesar();
  assert.equal(primera, segunda);
  const r = await primera; await segunda; await e.control.procesar();
  assert.equal(r.estado, 'SESION_VERIFICADA'); salidaSegura(r);
  assert.equal(e.cuenta.creaciones, 1); assert.equal(e.cuenta.canjes, 1);
  assert.equal(e.cuenta.estado, 1); assert.equal(e.cuenta.usuario, 1);
  assert.equal(e.cuenta.manuales, 0); assert.equal(e.cuenta.red, 0);
});

test('3. Error de confirmación: mensaje seguro, sin canje ni detalles del proveedor', async () => {
  const e = await preparar(BASE + '?vista=compacta&error=access_denied&error_code=otp_expired&error_description=no-publicar#ayuda');
  const r = await e.control.procesar();
  assert.equal(r.estado, 'ERROR_CONFIRMACION'); assert.match(r.mensaje, /error de confirmación/); salidaSegura(r);
  assert.equal(e.cuenta.creaciones, 0); assert.equal(e.cuenta.canjes, 0);
  assert.equal(e.url().search, '?vista=compacta'); assert.equal(e.url().hash, '#ayuda');
  assert.equal(e.cuenta.red, 0);
});

test('4. Limpieza: espera al SDK y conserva parámetros ajenos y fragmento', async () => {
  const puerta = diferida();
  const e = await preparar(BASE + '?vista=compacta&code=' + CODIGO + '&etiqueta=a&etiqueta=b#ayuda', { esperarSDK: puerta.promesa });
  const operacion = e.control.procesar(); await e.codigoLeido;
  assert.equal(e.url().searchParams.has('code'), true); assert.equal(e.cambios.length, 0);
  assert.equal(e.cuenta.canjes, 0);
  puerta.resolver(); const r = await operacion;
  assert.equal(r.estado, 'SESION_VERIFICADA'); salidaSegura(r);
  assert.equal(e.url().searchParams.has('code'), false);
  assert.equal(e.url().searchParams.get('vista'), 'compacta');
  assert.deepEqual(e.url().searchParams.getAll('etiqueta'), ['a', 'b']); assert.equal(e.url().hash, '#ayuda');
  assert.ok(e.pasos.indexOf('limpiar-url') > e.pasos.indexOf('sdk-listo'));
  assert.equal(e.cuenta.red, 0);
});

test('5. Verificación posterior fallida: no repite canje ni declara correo sin confirmar', async () => {
  const e = await preparar(BASE + '?code=' + CODIGO + '&vista=compacta', { falloVerificacion: true });
  const r = await e.control.procesar(); await e.control.procesar();
  assert.equal(r.estado, 'VERIFICACION_PENDIENTE'); salidaSegura(r);
  assert.doesNotMatch(r.mensaje, /correo (?:sigue |está )?sin confirmar|PENDIENTE_CONFIRMACION/);
  assert.match(r.mensaje, /no determina el estado de confirmación/);
  assert.equal(e.url().searchParams.has('code'), false); assert.equal(e.url().searchParams.get('vista'), 'compacta');
  assert.equal(e.cuenta.canjes, 1); assert.equal(e.cuenta.estado, 1); assert.equal(e.cuenta.usuario, 1);
  assert.equal(e.cuenta.manuales, 0); assert.equal(e.cuenta.red, 0);
});
