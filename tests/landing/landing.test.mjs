import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, createContext } from 'node:vm';
// Reutiliza fixtures marcados como sintéticos, no DTO ni catálogos aprobados.
import { IDS, adaptarRegistroPrueba, respuestaPrueba, diferida, pausa } from '../catalogo/fixtures.mjs';
const fuentes = await Promise.all(['landing', 'catalogo'].map(n => readFile(new URL(`../../js/${n}.js`, import.meta.url), 'utf8')));
const plano = valor => JSON.parse(JSON.stringify(valor));
async function cargar() {
  const registro = { red: 0, logs: 0 };
  const contexto = createContext({ AbortController, URL, URLSearchParams, Intl, setTimeout, clearTimeout,
    fetch() { registro.red++; throw new Error('Red prohibida'); }, console: { log() { registro.logs++; } } });
  const catalogo = new SourceTextModule(fuentes[1], { context: contexto });
  const landing = new SourceTextModule(fuentes[0], { context: contexto });
  await catalogo.link(() => { throw new Error('Dependencia inesperada'); });
  await landing.link(nombre => { assert.equal(nombre, './catalogo.js'); return catalogo; });
  await landing.evaluate();
  return { api: landing.namespace, registro };
}
function crear(api, extra = {}) {
  const estados = [], consultas = [];
  const controlador = api.crearControladorInicio({ modo: 'prueba',
    adaptarFiltros: seleccion => ({ seleccionSoloPrueba: seleccion }), adaptarArticulo: adaptarRegistroPrueba,
    consultarCatalogo: async (filtros, opciones) => { consultas.push({ filtros, opciones }); return respuestaPrueba(); },
    alCambiar: estado => estados.push(plano(estado)), ...extra });
  return { controlador, estados, consultas };
}
test('importar Inicio reutiliza un módulo local, sin SDK, REST ni logs', async () => {
  const { api, registro } = await cargar(); assert.ok(api.montarInicio); assert.deepEqual(registro, { red: 0, logs: 0 });
});
test('sin habilitación no consulta; identifica Figma y ausencia de personalización', async () => {
  const { api } = await cargar(); const c = crear(api, { modo: 'pendiente' });
  const r = await c.controlador.consultar(); assert.equal(r.estado, 'pendiente'); assert.equal(c.consultas.length, 0);
  assert.match(r.mensaje, /Figma.*no resultados de Supabase.*personalizadas/);
});
test('no existe un modo remoto implícito que active el proveedor', async () => {
  const { api } = await cargar(); const c = crear(api, { modo: 'remoto' });
  assert.equal((await c.controlador.consultar()).estado, 'pendiente'); assert.equal(c.consultas.length, 0);
});
for (const dependencia of ['adaptarFiltros', 'adaptarArticulo', 'consultarCatalogo']) {
  test(`sin ${dependencia} conserva integración pendiente`, async () => {
    const { api } = await cargar(); const c = crear(api, { [dependencia]: undefined });
    assert.equal((await c.controlador.consultar()).estado, 'pendiente'); assert.equal(c.consultas.length, 0);
  });
}
test('preparar no consulta, carga/listo delegan filtros y signal; no corta ni reordena', async () => {
  const { api } = await cargar(); const c = crear(api); c.controlador.preparar();
  assert.equal(c.consultas.length, 0); assert.equal(c.controlador.obtenerEstado().estado, 'preparado');
  const r = await c.controlador.consultar();
  assert.deepEqual(c.estados.map(e => e.estado), ['preparado', 'cargando', 'listo']);
  const seleccion = plano(c.consultas[0].filtros.seleccionSoloPrueba);
  assert.equal(seleccion.orden, 'recientes'); assert.equal(seleccion.busqueda, ''); assert.equal(seleccion.campus, '');
  assert.ok(c.consultas[0].opciones.signal instanceof AbortSignal);
  assert.deepEqual(plano(r.vistas.map(v => v.id)), [IDS.articulo, IDS.otro]);
  assert.match(r.mensaje, /Prueba offline.*Sin personalización ni total global/);
});
test('vacío no restaura ejemplos de Figma ni crea recomendaciones', async () => {
  const { api } = await cargar(); const c = crear(api, { consultarCatalogo: async () => ({ ok: true, datos: [], error: null }) });
  const r = await c.controlador.consultar(); assert.equal(r.estado, 'vacio'); assert.deepEqual(plano(r.vistas), []);
  assert.match(r.mensaje, /respuesta no contiene artículos/);
});
test('error y reintento no reflejan datos crudos del proveedor', async () => {
  const { api } = await cargar(); let veces = 0;
  const c = crear(api, { consultarCatalogo: async () => ++veces === 1 ? { ok: false, datos: null, error: { codigo: 'RED', mensaje: 'NO_REFLEJAR' } } : respuestaPrueba() });
  const r = await c.controlador.consultar(); assert.equal(r.estado, 'error'); assert.equal(JSON.stringify(r).includes('NO_REFLEJAR'), false);
  assert.equal((await c.controlador.consultar()).estado, 'listo'); assert.equal(veces, 2);
});
test('configuración incompatible se muestra como error antes de consultar', async () => {
  const { api } = await cargar(); const c = crear(api, { adaptarFiltros: () => null });
  assert.equal((await c.controlador.consultar()).codigo, 'CONFIGURACION'); assert.equal(c.consultas.length, 0);
});
for (const respuesta of [null, { ok: true, datos: {}, error: null }, { ok: true, datos: Array(1), error: null }]) {
  test('una respuesta incompatible no se anuncia como catálogo válido', async () => {
    const { api } = await cargar(); const c = crear(api, { consultarCatalogo: async () => respuesta });
    const r = await c.controlador.consultar(); assert.equal(r.estado, 'error'); assert.deepEqual(plano(r.vistas), []);
  });
}
test('no agrega identidad, estadísticas o campos privados a las vistas', async () => {
  const { api } = await cargar(); const c = crear(api, { adaptarArticulo: item => ({ ...adaptarRegistroPrueba(item), token: 'NO_REFLEJAR', reservas: 999 }) });
  const r = await c.controlador.consultar(); assert.equal(JSON.stringify(r).includes('NO_REFLEJAR'), false);
  assert.equal(Object.hasOwn(r.vistas[0], 'reservas'), false);
  const copia = c.controlador.obtenerEstado(); copia.vistas.length = 0; assert.equal(c.controlador.obtenerEstado().vistas.length, 2);
});
test('Detalle solo admite UUID y parámetro acordado explícitamente', async () => {
  const { api } = await cargar(); const c = crear(api); assert.equal((await c.controlador.consultar()).vistas[0].detalle, null);
  const activo = crear(api, { detalle: { habilitado: true, parametro: 'articuloPrueba' } });
  assert.equal((await activo.controlador.consultar()).vistas[0].detalle, `detalle.html?articuloPrueba=${IDS.articulo}`);
});
test('conserva texto no confiable como datos y rechaza URL de foto insegura', async () => {
  const { api } = await cargar(); const c = crear(api, { adaptarArticulo: item => ({ ...adaptarRegistroPrueba(item), titulo: '<img src=x onerror=alert(1)>', foto: { url: 'javascript:alert(1)', alt: 'Prueba' } }) });
  const r = await c.controlador.consultar(); assert.equal(r.vistas[0].foto, null); assert.match(r.vistas[0].titulo, /<img/);
});
test('una solicitud obsoleta no sustituye la respuesta nueva', async () => {
  const { api } = await cargar(); const espera = diferida(); let veces = 0, signal;
  const c = crear(api, { consultarCatalogo: (_, opciones) => { signal ??= opciones.signal; return ++veces === 1 ? espera.promesa : Promise.resolve({ ok: true, datos: [], error: null }); } });
  const primera = c.controlador.consultar(); await pausa(); assert.equal((await c.controlador.consultar()).estado, 'vacio');
  assert.equal(signal.aborted, true); assert.equal(await primera, null);
  espera.resolver(respuestaPrueba()); await pausa(); assert.equal(c.controlador.obtenerEstado().estado, 'vacio');
});
test('timeout conserva un error seguro sin esperar indefinidamente al proveedor', async () => {
  const { api } = await cargar(); const c = crear(api, { consultarCatalogo: () => new Promise(() => {}), timeoutMs: 5 });
  assert.equal((await c.controlador.consultar()).codigo, 'TIEMPO_AGOTADO');
});
test('desconectar cancela, impide nuevas consultas y descarta respuestas tardías', async () => {
  const { api } = await cargar(); const espera = diferida(); let signal;
  const c = crear(api, { consultarCatalogo: (_, opciones) => { signal = opciones.signal; return espera.promesa; } });
  const pendiente = c.controlador.consultar(); await pausa(); c.controlador.desconectar(); c.controlador.desconectar();
  assert.equal(signal.aborted, true); assert.equal(await pendiente, null); assert.equal(await c.controlador.consultar(), null);
  espera.resolver(respuestaPrueba()); await pausa(); assert.notEqual(c.controlador.obtenerEstado().estado, 'listo');
});
