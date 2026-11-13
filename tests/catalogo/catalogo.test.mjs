import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, createContext } from 'node:vm';
import { IDS, opcionesPrueba, registrosPrueba, adaptarRegistroPrueba, respuestaPrueba, pausa, diferida } from './fixtures.mjs';
const fuente = await readFile(new URL('../../js/catalogo.js', import.meta.url), 'utf8');
const plano = valor => JSON.parse(JSON.stringify(valor));
async function cargar() {
  const control = { red: 0, logs: 0 };
  const contexto = createContext({ AbortController, URL, URLSearchParams, Intl, setTimeout, clearTimeout,
    fetch() { control.red++; throw new Error('Red prohibida'); },
    console: { log() { control.logs++; }, warn() { control.logs++; }, error() { control.logs++; } } });
  const modulo = new SourceTextModule(fuente, { context: contexto,
    importModuleDynamically() { control.red++; throw new Error('Importación remota prohibida'); } });
  await modulo.link(() => { throw new Error('Dependencia no permitida'); }); await modulo.evaluate();
  return { api: modulo.namespace, control };
}
function crear(api, extra = {}) {
  const estados = [], llamadas = [];
  const controlador = api.crearControladorCatalogo({ modo: 'prueba', opciones: opcionesPrueba(),
    consultarCatalogo: async (filtros, opciones) => { llamadas.push({ filtros, opciones }); return respuestaPrueba(); },
    adaptarFiltros: filtros => ({ seleccionDePrueba: filtros }), adaptarArticulo: adaptarRegistroPrueba,
    alCambiar: estado => estados.push(plano(estado)), ...extra });
  return { controlador, estados, llamadas };
}
test('importar no carga SDK, servicio ausente ni red', async () => {
  const { api, control } = await cargar(); let consultas = 0;
  const c = api.crearControladorCatalogo({ consultarCatalogo: () => { consultas++; } });
  assert.equal((await c.aplicar()).estado, 'pendiente'); assert.equal(consultas, 0);
  assert.deepEqual(control, { red: 0, logs: 0 });
});
test('sin adaptadores no se interpreta un DTO supuesto', async () => {
  const { api } = await cargar(); let consultas = 0;
  const c = api.crearControladorCatalogo({ modo: 'prueba', consultarCatalogo: () => { consultas++; } });
  assert.equal((await c.aplicar()).estado, 'pendiente'); assert.equal(consultas, 0);
});
for (const [entrada, esperado] of [['', null], ['  ', null], ['0', 0], ['12.30', 1230], ['12,3', 1230], ['001.01', 101]]) {
  test(`precio decimal exacto: ${JSON.stringify(entrada)}`, async () => {
    const { api } = await cargar(); assert.equal(api.precioACentimos(entrada), esperado);
  });
}
for (const entrada of ['-1', '1.001', '1e3', 'NaN', '1,000.00', '9007199254740991', null]) {
  test(`precio rechazado: ${entrada}`, async () => {
    const { api } = await cargar(); assert.throws(() => api.precioACentimos(entrada));
  });
}
for (const filtros of [null, { secreto: 'no enviar' }, { busqueda: 'a'.repeat(121) }, { orden: 'SQL arbitrario' },
  { categorias: [IDS.categoria, IDS.categoria] }, { categorias: ['inventada'] }, { estados: ['disponible-no-aprobado'] },
  { campus: IDS.otroCampus, universidad: IDS.universidad }, { precioMinimo: '20', precioMaximo: '10' }]) {
  test(`filtros inválidos sin consultar: ${JSON.stringify(filtros)}`, async () => {
    const { api } = await cargar(); const c = crear(api);
    assert.equal((await c.controlador.aplicar(filtros)).codigo, 'VALIDACION'); assert.equal(c.llamadas.length, 0);
  });
}
test('IDs/opciones, precios y orden se delegan completos; no filtra una respuesta local', async () => {
  const { api } = await cargar(); const c = crear(api);
  const r = await c.controlador.aplicar({ busqueda: 'sin coincidencia local', categorias: [IDS.categoria], universidad: IDS.universidad,
    campus: IDS.campus, estados: ['estado-fixture'], condiciones: ['condicion-fixture'], precioMinimo: '10,01', precioMaximo: '20', orden: 'precio-mayor' });
  assert.deepEqual(c.estados.map(e => e.estado), ['cargando', 'listo']); assert.equal(r.vistas.length, 2);
  const f = plano(c.llamadas[0].filtros.seleccionDePrueba);
  assert.equal(f.precioMinimoCentimos, 1001); assert.equal(f.precioMaximoCentimos, 2000); assert.equal(f.campus, IDS.campus);
  assert.equal(f.orden, 'precio-mayor'); assert.equal(f.busqueda, 'sin coincidencia local');
  assert.ok(c.llamadas[0].opciones.signal instanceof AbortSignal);
  assert.equal(r.vistas[0].id, IDS.articulo); assert.equal(r.vistas[1].id, IDS.otro);
  assert.ok(r.mensaje.includes('Total del catálogo no informado')); assert.ok(r.mensaje.includes('Prueba offline'));
});
test('vacío válido no se sustituye por artículos Figma', async () => {
  const { api } = await cargar(); const c = crear(api, { consultarCatalogo: async () => ({ ok: true, datos: [], error: null }) });
  const r = await c.controlador.aplicar(); assert.equal(r.estado, 'vacio'); assert.deepEqual(plano(r.vistas), []);
});
test('error seguro y reintento sin exponer mensaje crudo', async () => {
  const { api } = await cargar(); let intentos = 0;
  const c = crear(api, { consultarCatalogo: async () => ++intentos === 1 ? { ok: false, datos: null, error: { codigo: 'RED', mensaje: 'SECRETO_NO_REFLEJAR' } } : respuestaPrueba() });
  const r = await c.controlador.aplicar({ busqueda: 'texto' }); assert.equal(r.estado, 'error'); assert.equal(JSON.stringify(r).includes('SECRETO'), false);
  assert.equal((await c.controlador.aplicar({ busqueda: 'texto' })).estado, 'listo'); assert.equal(intentos, 2);
});
for (const respuesta of [null, { ok: 'true', datos: [], error: null }, { ok: true, datos: {}, error: null },
  { ok: true, datos: [], error: {} }, { ok: true, datos: Array(101).fill({}), error: null },
  { ok: true, datos: [registrosPrueba()[0], registrosPrueba()[0]], error: null }]) {
  test('respuesta inesperada rechazada sin catálogo inventado', async () => {
    const { api } = await cargar(); const c = crear(api, { consultarCatalogo: async () => respuesta });
    const r = await c.controlador.aplicar(); assert.equal(r.estado, 'error'); assert.deepEqual(plano(r.vistas), []);
  });
}
test('adaptación y proyección no publican campos privados adicionales', async () => {
  const { api } = await cargar(); const c = crear(api, { adaptarArticulo: item => ({ ...adaptarRegistroPrueba(item), correo: 'PRIVADO', token: 'TOKEN_PRIVADO' }) });
  const r = await c.controlador.aplicar(); assert.equal(JSON.stringify(r).includes('PRIVADO'), false);
  const copia = c.controlador.obtenerEstado(); copia.vistas.length = 0; assert.equal(c.controlador.obtenerEstado().vistas.length, 2);
});
test('imagen externa insegura sustituida; origen aprobado solo explícito', async () => {
  const { api } = await cargar(); const adaptar = item => ({ ...adaptarRegistroPrueba(item), foto: { url: 'https://imagenes.example.invalid/foto.jpg', alt: 'Foto de prueba' } });
  const c = crear(api, { adaptarArticulo: adaptar }); assert.equal((await c.controlador.aplicar()).vistas[0].foto, null);
  const permitido = crear(api, { adaptarArticulo: adaptar, origenesImagen: ['https://imagenes.example.invalid'] });
  assert.equal((await permitido.controlador.aplicar()).vistas[0].foto.url, 'https://imagenes.example.invalid/foto.jpg');
});
test('detalle pendiente por defecto; ID del resultado cuando el receptor sea dinámico', async () => {
  const { api } = await cargar(); const c = crear(api); assert.equal((await c.controlador.aplicar()).vistas[0].detalle, null);
  const activo = crear(api, { detalle: { habilitado: true, parametro: 'articuloPrueba' } });
  assert.equal((await activo.controlador.aplicar()).vistas[0].detalle, 'detalle.html?articuloPrueba=' + IDS.articulo);
  assert.equal(api.crearRutaDetalle('inventado', 'id'), null); assert.equal(api.crearRutaDetalle(IDS.articulo, null), null);
});
test('cancelación al editar ignora respuesta tardía y termina espera', async () => {
  const { api } = await cargar(); const espera = diferida(); let signal;
  const c = crear(api, { consultarCatalogo: (_, opciones) => { signal = opciones.signal; return espera.promesa; } });
  const pendiente = c.controlador.aplicar(); await pausa(); c.controlador.preparar();
  assert.equal(signal.aborted, true); assert.equal(await pendiente, null);
  espera.resolver(respuestaPrueba()); await pausa(); assert.equal(c.controlador.obtenerEstado().estado, 'preparado');
});
test('nueva consulta gana aunque la anterior resuelva después', async () => {
  const { api } = await cargar(); const espera = diferida(); let veces = 0;
  const c = crear(api, { consultarCatalogo: () => ++veces === 1 ? espera.promesa : Promise.resolve({ ok: true, datos: [], error: null }) });
  const primera = c.controlador.aplicar(); await pausa(); const segunda = await c.controlador.aplicar({ busqueda: 'nueva' });
  assert.equal(segunda.estado, 'vacio'); assert.equal(await primera, null);
  espera.resolver(respuestaPrueba()); await pausa(); assert.equal(c.controlador.obtenerEstado().estado, 'vacio');
});
test('timeout y desconexión no permiten mostrar éxitos tardíos', async () => {
  const { api } = await cargar(); const espera = diferida();
  const c = crear(api, { consultarCatalogo: () => espera.promesa, timeoutMs: 5 });
  assert.equal((await c.controlador.aplicar()).codigo, 'TIEMPO_AGOTADO'); c.controlador.desconectar();
  espera.resolver(respuestaPrueba()); await pausa(); assert.equal(await c.controlador.aplicar(), null);
});
test('catálogos inválidos o relaciones inventadas fallan antes de consultar', async () => {
  const { api } = await cargar(); const o = opcionesPrueba(); o.campus[0].universidadId = IDS.categoria;
  assert.throws(() => crear(api, { opciones: o })); assert.throws(() => api.opcionesDePresentacion({ estados: Array(1) }));
});
