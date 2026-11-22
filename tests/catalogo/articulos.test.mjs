import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const [fuente, fuenteConfig] = await Promise.all(['articulos.js', 'config-publica.js'].map(nombre =>
  readFile(new URL('../../js/' + nombre, import.meta.url), 'utf8')));
const ORIGEN = 'https://supabase.example.invalid';
const CLAVE = 'sb_publishable_' + 'x'.repeat(32);
const TOKEN = 'ACCESO_SIMULADO';
const ID = '591cc1f4-8e7d-46d0-a752-d9bfad1a4590';
const VENDEDOR = 'e1dcf222-0c13-4b20-8b43-43183a881f26';
const CATEGORIA = 'e7cff5f1-1df8-406e-bfa8-49daef23ab33';
const UNIVERSIDAD = 'c2caa088-b06e-4486-955a-5fd15abe11a9';
const CAMPUS = 'a7af2d30-5802-4ab1-a207-87da7c54a598';
const RUTA = VENDEDOR + '/foto.webp';
const FOTO = ORIGEN + '/storage/v1/object/public/articulos/' + RUTA;
const plano = valor => JSON.parse(JSON.stringify(valor));
const filtros = cambios => ({
  busqueda: '', categorias: [], universidad: '', campus: '', estados: [], condiciones: [],
  precioMinimoCentimos: null, precioMaximoCentimos: null, orden: 'recientes', ...cambios,
});
const fila = cambios => ({
  id: ID, vendedor_id: VENDEDOR, categoria_id: CATEGORIA, campus_id: CAMPUS, titulo: 'Calculadora',
  descripcion: 'Pantalla funcional.', condicion: 'usado', estado: 'disponible', moneda: 'PEN',
  precio_centimos: '12345', creado_en: '2026-11-15T07:00:00.123456-05:00',
  actualizado_en: '2026-11-15T12:00:01+00:00', version: 1,
  imagen_bucket: 'articulos', imagen_ruta: RUTA, imagen_url: FOTO, imagen_formato: 'image/webp',
  imagen_bytes: '125000', imagen_ancho: 1200, imagen_alto: 900, ...cambios,
});
const respuesta = filas => ({ ok: true, status: 200, json: async () => filas });

async function cargar({
  configuracion = { supabaseUrl: ORIGEN, supabasePublishableKey: CLAVE },
  sesion = { data: { session: { access_token: TOKEN } }, error: null },
  obtenerSesion = async () => sesion,
  fetchDoble = async () => respuesta([]),
} = {}) {
  const actividad = { config: 0, cliente: 0, sesion: 0, fetch: [], intentosImportacion: 0 };
  function importacionProhibida() {
    actividad.intentosImportacion++;
    throw new Error('Importación dinámica prohibida en pruebas');
  }
  const contexto = createContext({
    URL, URLSearchParams, TypeError,
    fetch(url, opciones) {
      actividad.fetch.push({ url, opciones });
      assert.equal(url.origin, ORIGEN);
      return fetchDoble(url, opciones);
    },
  });
  const configReal = new SourceTextModule(fuenteConfig, { context: contexto });
  await configReal.link(importacionProhibida);
  await configReal.evaluate();
  const config = new SyntheticModule(['validarConfiguracionPublica'], function () {
    this.setExport('validarConfiguracionPublica', () => {
      actividad.config++;
      return configReal.namespace.validarConfiguracionPublica(configuracion);
    });
  }, { context: contexto });
  const cliente = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => {
      actividad.cliente++;
      const auth = { getSession() { actividad.sesion++; return obtenerSesion(); } };
      return { ok: true, datos: { auth }, error: null };
    });
  }, { context: contexto });
  const mod = new SourceTextModule(fuente, { context: contexto, importModuleDynamically: importacionProhibida });
  const dependencias = { './config-publica.js': config, './supabase-cliente.js': cliente };
  await mod.link(nombre => dependencias[nombre] ?? importacionProhibida());
  await mod.evaluate();
  return { consultar: mod.namespace.consultarCatalogo, actividad };
}

function comprobarError(resultado, codigo, mensaje) {
  assert.equal(resultado.ok, false);
  assert.equal(resultado.datos, null);
  assert.equal(resultado.error.codigo, codigo);
  if (mensaje) assert.match(resultado.error.mensaje, mensaje);
  assert.doesNotMatch(JSON.stringify(resultado), /ACCESO_SIMULADO|DETALLE_PRIVADO/);
}

test('importar el servicio solo expone la consulta y no carga configuración, cliente, sesión o red', async () => {
  const { consultar, actividad } = await cargar();
  assert.equal(typeof consultar, 'function');
  assert.deepEqual(actividad, { config: 0, cliente: 0, sesion: 0, fetch: [], intentosImportacion: 0 });
});

test('GET exitoso proyecta el DTO completo, fotografía y fechas UTC sin campos privados', async () => {
  const { consultar, actividad } = await cargar({
    fetchDoble: async () => respuesta([fila({ correo: 'DETALLE_PRIVADO', token: TOKEN, eliminado_en: null,
      campus: { universidad_id: UNIVERSIDAD }, perfiles: { correo: 'DETALLE_PRIVADO' } })]),
  });
  assert.deepEqual(plano(await consultar(filtros())), {
    ok: true, error: null, datos: [{
      id: ID, vendedorId: VENDEDOR, categoriaId: CATEGORIA, campusId: CAMPUS, titulo: 'Calculadora',
      descripcion: 'Pantalla funcional.', condicion: 'usado', estado: 'disponible', moneda: 'PEN',
      precioCentimos: 12345, creadoEn: '2026-11-15T12:00:00.123456Z',
      actualizadoEn: '2026-11-15T12:00:01Z', version: 1,
      imagen: { proveedor: 'supabase', bucket: 'articulos', ruta: RUTA, url: FOTO, formato: 'image/webp',
        bytes: 125000, ancho: 1200, alto: 900 },
    }],
  });
  assert.equal(actividad.fetch.length, 1);
  const [{ url, opciones }] = actividad.fetch;
  assert.equal(url.pathname, '/rest/v1/articulos');
  assert.equal(opciones.method, 'GET');
  assert.equal(opciones.redirect, 'error');
  assert.equal(opciones.body, undefined);
  assert.deepEqual(plano(opciones.headers), { Accept: 'application/json', apikey: CLAVE, Authorization: 'Bearer ' + TOKEN });
  assert.ok(!url.href.includes(TOKEN) && !url.href.includes(CLAVE));
  assert.deepEqual(url.searchParams.get('select').split(','), [
    'id', 'vendedor_id', 'titulo', 'descripcion', 'categoria_id', 'condicion', 'precio_centimos::text',
    'moneda', 'campus_id', 'estado', 'creado_en', 'actualizado_en', 'version', 'imagen_bucket',
    'imagen_ruta', 'imagen_url', 'imagen_formato', 'imagen_bytes::text', 'imagen_ancho', 'imagen_alto',
  ]);
  assert.equal(url.searchParams.get('eliminado_en'), 'is.null');
  assert.equal(url.searchParams.get('limit'), '24');
});

test('respeta el catálogo vacío y conserva los nueve filtros en la URL', async () => {
  const { consultar, actividad } = await cargar();
  const resultado = await consultar(filtros({
    busqueda: 'cálculo', categorias: [CATEGORIA, ID], universidad: UNIVERSIDAD, campus: CAMPUS,
    estados: ['disponible', 'vendido'], condiciones: ['usado', 'nuevo'],
    precioMinimoCentimos: 0, precioMaximoCentimos: 20000, orden: 'precio-mayor',
  }));
  assert.deepEqual(plano(resultado), { ok: true, datos: [], error: null });
  const p = actividad.fetch[0].url.searchParams;
  assert.ok(p.get('select').endsWith(',campus!inner(universidad_id)'));
  assert.equal(p.get('or'), '(titulo.imatch."cálculo",descripcion.imatch."cálculo")');
  assert.equal(p.get('categoria_id'), 'in.(' + CATEGORIA + ',' + ID + ')');
  assert.equal(p.get('campus.universidad_id'), 'eq.' + UNIVERSIDAD);
  assert.equal(p.get('campus_id'), 'eq.' + CAMPUS);
  assert.equal(p.get('estado'), 'in.(disponible,vendido)');
  assert.equal(p.get('condicion'), 'in.(usado,nuevo)');
  assert.deepEqual(p.getAll('precio_centimos'), ['gte.0', 'lte.20000']);
  assert.equal(p.get('order'), 'precio_centimos.desc,id.asc');
});

test('la búsqueda conserva puntuación literal dentro del filtro fijo', async () => {
  const { consultar, actividad } = await cargar();
  const texto = 'a"),b.*\\&x';
  await consultar(filtros({ busqueda: texto }));
  const p = actividad.fetch[0].url.searchParams;
  assert.equal(p.has('x'), false);
  const patron = '"a\\"\\\\),b\\\\.\\\\*\\\\\\\\&x"';
  assert.equal(p.get('or'), '(titulo.imatch.' + patron + ',descripcion.imatch.' + patron + ')');
});

test('orden estable y filtro de campus independiente de universidad', async () => {
  const { consultar, actividad } = await cargar();
  for (const orden of ['recientes', 'precio-menor', 'precio-mayor']) {
    await consultar(filtros({ orden, campus: CAMPUS }));
  }
  assert.deepEqual(actividad.fetch.map(({ url }) => url.searchParams.get('order')),
    ['creado_en.desc,id.asc', 'precio_centimos.asc,id.asc', 'precio_centimos.desc,id.asc']);
  for (const { url: { searchParams: p } } of actividad.fetch) {
    assert.equal(p.get('campus_id'), 'eq.' + CAMPUS);
    assert.equal(p.has('campus.universidad_id'), false);
    assert.equal(p.has('estado'), false);
    assert.equal(p.get('eliminado_en'), 'is.null');
  }
});

test('rechaza filtros incompatibles antes de cargar configuración o iniciar solicitudes', async () => {
  const { consultar, actividad } = await cargar();
  const incompleto = filtros();
  delete incompleto.orden;
  for (const entrada of [null, incompleto, ...[
    { busqueda: '🍎'.repeat(121) }, { busqueda: 'a\u0000b' }, { selector: '*' },
    { categorias: ['uuid'] }, { categorias: Array(1) }, { universidad: 'UPC' },
    { campus: 'San Miguel' }, { estados: ['Disponible'] }, { condiciones: ['nueva'] },
    { precioMinimoCentimos: -1 }, { precioMaximoCentimos: 1.5 }, { precioMinimoCentimos: '0' },
    { precioMaximoCentimos: Number.MAX_SAFE_INTEGER + 1 }, { precioMinimoCentimos: 20, precioMaximoCentimos: 10 },
    { orden: 'precio_centimos.desc' }, { orden: ['recientes'] },
  ].map(filtros)]) {
    comprobarError(await consultar(entrada), 'VALIDACION');
  }
  assert.equal(actividad.config, 0);
  assert.equal(actividad.fetch.length, 0);
});

test('diferencia configuración ausente, sesión ausente y fallo del SDK', async () => {
  const sinConfig = await cargar({ configuracion: {} });
  comprobarError(await sinConfig.consultar(filtros()), 'CONFIGURACION');
  assert.equal(sinConfig.actividad.cliente, 0);
  const sinSesion = await cargar({ sesion: { data: { session: null }, error: null } });
  comprobarError(await sinSesion.consultar(filtros()), 'NO_AUTORIZADO', /requiere una sesión/);
  assert.equal(sinSesion.actividad.sesion, 1);
  assert.equal(sinSesion.actividad.fetch.length, 0);
  const falloSdk = await cargar({ sesion: { error: { name: 'AuthRetryableFetchError', message: 'DETALLE_PRIVADO' } } });
  comprobarError(await falloSdk.consultar(filtros()), 'RED', /recuperar la sesión/);
  assert.equal(falloSdk.actividad.fetch.length, 0);
});

test('clasifica HTTP sin leer el cuerpo ni exponer datos internos', async () => {
  for (const [status, codigo] of [[400, 'SERVIDOR'], [401, 'NO_AUTORIZADO'], [403, 'NO_AUTORIZADO'],
    [429, 'LIMITE'], [500, 'SERVIDOR']]) {
    let lecturas = 0;
    const { consultar } = await cargar({ fetchDoble: async () => ({
      ok: false, status, json: async () => { lecturas++; return { detalle: 'DETALLE_PRIVADO' }; },
    }) });
    comprobarError(await consultar(filtros()), codigo);
    assert.equal(lecturas, 0);
  }
});

test('diferencia error de red, JSON inválido y respuesta inesperada', async () => {
  for (const [fetchDoble, codigo, mensaje] of [
    [async () => { throw new TypeError('DETALLE_PRIVADO'); }, 'RED', /conectar/],
    [async () => ({ ok: true, json: async () => { throw new TypeError('DETALLE_PRIVADO'); } }), 'RED', /leer/],
    [async () => ({ ok: true, json: async () => JSON.parse('DETALLE_PRIVADO') }), 'RESPUESTA_INVALIDA', /JSON/],
    [async () => undefined, 'RESPUESTA_INVALIDA', /inesperada/],
    [async () => ({ ok: true }), 'RESPUESTA_INVALIDA', /inesperada/],
    [async () => respuesta({ datos: [] }), 'RESPUESTA_INVALIDA', /inesperada/],
    [async () => respuesta(Array.from({ length: 25 }, () => fila())), 'RESPUESTA_INVALIDA', /inesperada/],
  ]) {
    const { consultar } = await cargar({ fetchDoble });
    comprobarError(await consultar(filtros()), codigo, mensaje);
  }
});

test('propaga el AbortSignal antes del GET, durante fetch y al leer el cuerpo', async () => {
  const cancelado = new AbortController();
  cancelado.abort();
  const inicial = await cargar();
  await assert.rejects(inicial.consultar(filtros(), { signal: cancelado.signal }), { name: 'AbortError' });
  assert.equal(inicial.actividad.cliente, 0);

  const duranteSesion = new AbortController();
  const auth = await cargar({ obtenerSesion: async () => {
    duranteSesion.abort();
    return { data: { session: { access_token: TOKEN } } };
  } });
  await assert.rejects(auth.consultar(filtros(), { signal: duranteSesion.signal }), { name: 'AbortError' });
  assert.equal(auth.actividad.fetch.length, 0);

  const duranteFetch = new AbortController();
  const red = await cargar({ fetchDoble: async (_, { signal }) => {
    assert.equal(signal, duranteFetch.signal);
    duranteFetch.abort();
    signal.throwIfAborted();
  } });
  await assert.rejects(red.consultar(filtros(), { signal: duranteFetch.signal }), { name: 'AbortError' });

  const duranteCuerpo = new AbortController();
  const cuerpo = await cargar({ fetchDoble: async () => ({
    ok: true, status: 200, json: async () => { duranteCuerpo.abort(); return []; },
  }) });
  await assert.rejects(cuerpo.consultar(filtros(), { signal: duranteCuerpo.signal }), { name: 'AbortError' });
});

test('rechaza DTO incompleto, UUID inválido, fechas incompatibles y duplicados', async () => {
  for (const [filas, mensaje] of [
    [[fila(), fila({ descripcion: undefined })], /incompatible/],
    [[fila({ vendedor_id: 'vendedor' })], /incompatible/],
    [[fila({ moneda: 'USD' })], /incompatible/],
    [[fila({ creado_en: '2026-02-30T12:00:00Z' })], /fechas/],
    [[fila(), fila({ id: ID.toUpperCase() })], /repetidos/],
  ]) {
    const { consultar } = await cargar({ fetchDoble: async () => respuesta(filas) });
    comprobarError(await consultar(filtros()), 'RESPUESTA_INVALIDA', mensaje);
  }
});

test('acepta el mayor entero seguro y rechaza precios inválidos sin redondear', async () => {
  for (const precio of ['9007199254740991', Number.MAX_SAFE_INTEGER]) {
    const { consultar } = await cargar({ fetchDoble: async () => respuesta([fila({ precio_centimos: precio })]) });
    assert.equal((await consultar(filtros())).datos[0].precioCentimos, Number.MAX_SAFE_INTEGER);
  }
  for (const precio of ['9007199254740992', '9223372036854775807', 9007199254740992, '1.01', '1e3', 0, -5, null]) {
    const { consultar } = await cargar({ fetchDoble: async () => respuesta([fila({ precio_centimos: precio })]) });
    comprobarError(await consultar(filtros()), 'RESPUESTA_INVALIDA', /precio/);
  }
});

test('rechaza fotos ausentes, inseguras o incoherentes con la migración', async () => {
  for (const cambios of [{ imagen_url: undefined }, { imagen_url: FOTO + '?' }, { imagen_url: FOTO + '#' },
    { imagen_url: 'https://usuario@supabase.example.invalid/foto.webp' },
    { imagen_url: 'https://supabase.example.invalid:99999/foto.webp' },
    { imagen_url: 'https://otra.example.invalid/foto.webp' },
    { imagen_url: FOTO.replace('https:', 'http:') }, { imagen_bytes: '9007199254740992' },
    { imagen_formato: 'image/png' }, { imagen_ruta: ID + '/foto.webp' }, { imagen_ancho: 0 }]) {
    const { consultar } = await cargar({ fetchDoble: async () => respuesta([fila(cambios)]) });
    comprobarError(await consultar(filtros()), 'RESPUESTA_INVALIDA', /fotografía/);
  }
});

test('normaliza una foto cuya URL pública coincide con el bucket y la ruta declarados', async () => {
  const bucket = 'catalogo_fotos-2';
  const ruta = VENDEDOR + '/Foto-2_A.webp';
  const url = ORIGEN + '/storage/v1/object/public/' + bucket + '/' + ruta;
  const { consultar } = await cargar({
    fetchDoble: async () => respuesta([fila({ imagen_bucket: bucket, imagen_ruta: ruta, imagen_url: url })]),
  });
  const resultado = await consultar(filtros());
  assert.equal(resultado.ok, true);
  assert.deepEqual(plano(resultado.datos[0].imagen), {
    proveedor: 'supabase', bucket, ruta, url, formato: 'image/webp', bytes: 125000, ancho: 1200, alto: 900,
  });
});

for (const [caso, urls] of [
  ['otro endpoint', [FOTO.replace('/object/public/', '/render/image/public/')]],
  ['otro bucket', [FOTO.replace('/articulos/', '/otro-bucket/')]],
  ['otra fotografía', [FOTO.replace('/foto.webp', '/otra.webp')]],
  ['una ruta ambigua o manipulada', ['otra/../', '%2e%2e/', 'otra/%2e%2e/', './', '/'].map(
    segmento => FOTO.replace('/foto.webp', '/' + segmento + 'foto.webp'),
  ).concat(FOTO.replace('/foto.webp', '/%66oto.webp'), FOTO.replace('/foto.webp', '%2Ffoto.webp'), FOTO + '/')],
]) {
  test(`rechaza una URL del mismo origen dirigida a ${caso}`, async () => {
    for (const imagen_url of urls) {
      const { consultar } = await cargar({ fetchDoble: async () => respuesta([fila({ imagen_url })]) });
      comprobarError(await consultar(filtros()), 'RESPUESTA_INVALIDA', /fotografía/);
    }
  });
}
