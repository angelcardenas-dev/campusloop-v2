import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

class Elemento {
  constructor(id) { this.id = id; this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.checked = false; this.dataset = {}; this.attrs = new Map(); this.listeners = new Map(); this.files = []; }
  addEventListener(k, fn) { if (!this.listeners.has(k)) this.listeners.set(k, new Set()); this.listeners.get(k).add(fn); }
  removeEventListener(k, fn) { this.listeners.get(k)?.delete(fn); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  removeAttribute(k) { this.attrs.delete(k); }
  focus() { this.focused = true; }
  click() { return Promise.all(Array.from(this.listeners.get('click') || [], fn => fn({ preventDefault() {} }))); }
}

function entorno(ids, { body = {} } = {}) {
  const items = new Map(ids.map(id => [id, new Elemento(id)]));
  const document = { body: { dataset: {}, ...body }, getElementById: id => items.get(id) || null };
  return { document, e: id => items.get(id) };
}

async function cargarImagenes() {
  const fuente = await readFile(new URL('../js/imagenes.js', import.meta.url), 'utf8');
  const urlsRevocadas = [];
  let siguienteUrl = 0;
  const ventana = { URL: { createObjectURL: () => `blob:local-preview-${++siguienteUrl}`, revokeObjectURL: url => urlsRevocadas.push(url) },
    setTimeout, clearTimeout, createImageBitmap: async () => ({ width: 1200, height: 900, close() {} }) };
  runInNewContext(fuente, { window: ventana, URL: ventana.URL, Set, Object, Number, Promise, WeakMap, AbortController, Error });
  return { api: ventana.CampusLoopImagenes, ventana, urlsRevocadas };
}

async function cargarVendedor() {
  const fuente = await readFile(new URL('../js/vendedor.js', import.meta.url), 'utf8');
  const ventana = { setTimeout, clearTimeout };
  runInNewContext(fuente, { window: ventana, Set, Object, AbortController, Promise, Error });
  return ventana.CampusLoopVendedor;
}

test('fotografía: valida tipo, tamaño y dimensiones antes de previsualizar', async () => {
  const { api } = await cargarImagenes();
  assert.equal((await api.validarArchivo({ type: 'image/svg+xml', size: 50 }, { crearBitmap: async () => ({ width: 500, height: 500 }) })).codigo, 'TIPO');
  assert.equal((await api.validarArchivo({ type: 'image/jpeg', size: api.MAX_BYTES + 1 }, { crearBitmap: async () => ({ width: 500, height: 500 }) })).codigo, 'TAMANO');
  assert.equal((await api.validarArchivo({ type: 'image/webp', size: 50 }, { crearBitmap: async () => ({ width: 20, height: 20 }) })).codigo, 'DIMENSIONES');
  const resultado = await api.validarArchivo({ type: 'image/png', size: 1000 }, { crearBitmap: async () => ({ width: 640, height: 480 }) });
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.datos && { formato: resultado.datos.formato, bytes: resultado.datos.bytes, ancho: resultado.datos.ancho, alto: resultado.datos.alto })),
    { formato: 'image/png', bytes: 1000, ancho: 640, alto: 480 });
});

test('fotografía: no entrega la selección anterior mientras valida una sustitución', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let validarSiguiente;
  let pendiente = false;
  const controlador = api.crearControladorImagenes({ documento: document, crearBitmap: async () => {
    if (pendiente) return new Promise(resolve => { validarSiguiente = () => resolve({ width: 640, height: 480, close() {} }); });
    return { width: 640, height: 480, close() {} };
  } });
  const seleccionar = async archivo => { e('input-fotografia').files = [archivo]; await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn())); };
  const anterior = { type: 'image/jpeg', size: 1000 };
  await seleccionar(anterior);
  pendiente = true;
  e('input-fotografia').files = [{ type: 'image/png', size: 900 }];
  const cambio = Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  assert.equal(controlador.capturarSeleccion(), null);
  assert.equal((await controlador.preparar()).codigo, 'VALIDACION');
  validarSiguiente();
  await cambio;
  assert.equal(controlador.obtenerArchivo().archivo, e('input-fotografia').files[0]);
  controlador.desmontar();
});

test('fotografía: muestra preview, permite retirarla y revoca su URL local', async () => {
  const { api, ventana, urlsRevocadas } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  const controlador = api.crearControladorImagenes({ documento: document, crearBitmap: async () => ({ width: 640, height: 480 }) });
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  assert.equal(e('vista-fotografia').src, 'blob:local-preview-1');
  assert.equal(e('vista-fotografia').hidden, false);
  assert.equal(e('retirar-fotografia').disabled, false);
  assert.equal((await controlador.preparar()).codigo, 'PENDIENTE');
  await e('retirar-fotografia').click();
  assert.equal(controlador.obtenerArchivo(), null);
  controlador.desmontar();
  assert.ok(ventana.URL);
  assert.deepEqual(urlsRevocadas, ['blob:local-preview-1']);
});

test('fotografía: ante fallo al reemplazar conserva la anterior', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let subida = 0;
  const archivos = [{ type: 'image/jpeg', size: 1000 }, { type: 'image/png', size: 900 }];
  const controlador = api.crearControladorImagenes({ documento: document,
    crearBitmap: async () => ({ width: 640, height: 480 }),
    subirFotografia: async () => ++subida === 1
      ? { ok: true, datos: { proveedor: 'supabase' }, error: null }
      : { ok: false, datos: null, error: { codigo: 'RED' } },
  });
  const seleccionar = async archivo => { e('input-fotografia').files = [archivo]; await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn())); };
  await seleccionar(archivos[0]);
  await controlador.preparar();
  await seleccionar(archivos[1]);
  assert.equal(e('vista-fotografia').src, 'blob:local-preview-2');
  await controlador.preparar();
  assert.equal(e('vista-fotografia').src, 'blob:local-preview-1');
  assert.equal(controlador.obtenerArchivo().archivo, archivos[0]);
  assert.match(e('mensaje-fotografia').textContent, /Se conserva la anterior/);
  controlador.desmontar();
});

test('fotografía: respuesta tardía de A tras elegir B no confirma ni altera B', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let resolverA;
  const archivos = [{ type: 'image/jpeg', size: 1000, nombre: 'A' }, { type: 'image/png', size: 900, nombre: 'B' }];
  const controlador = api.crearControladorImagenes({ documento: document, crearBitmap: async () => ({ width: 640, height: 480 }),
    subirFotografia: datos => datos.archivo.nombre === 'A'
      ? new Promise(resolve => { resolverA = resolve; })
      : Promise.resolve({ ok: true, datos: { version: 'B' }, error: null }) });
  const seleccionar = async archivo => { e('input-fotografia').files = [archivo]; await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn())); };
  await seleccionar(archivos[0]);
  const subidaA = controlador.preparar();
  await new Promise(resolve => setImmediate(resolve));
  await seleccionar(archivos[1]);
  resolverA({ ok: true, datos: { version: 'A' }, error: null });
  assert.equal((await subidaA).codigo, 'CANCELADO');
  assert.equal(controlador.obtenerArchivo().archivo, archivos[1]);
  assert.equal(e('vista-fotografia').src, 'blob:local-preview-2');
  assert.equal((await controlador.preparar()).datos.version, 'B');
  assert.equal(controlador.obtenerArchivo().archivo, archivos[1]);
  controlador.desmontar();
});

test('fotografía: una señal ya cancelada impide invocar la subida', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let llamadas = 0;
  const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: async () => { llamadas++; return { ok: true, datos: {}, error: null }; } });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  const abortador = new AbortController(); abortador.abort();
  assert.equal((await controlador.preparar({ signal: abortador.signal })).codigo, 'CANCELADO');
  assert.equal(llamadas, 0);
  controlador.desmontar();
});

test('fotografía: retirar durante subida invalida su respuesta tardía', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let resolver;
  const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: () => new Promise(resolve => { resolver = resolve; }) });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  const subida = controlador.preparar();
  await new Promise(resolve => setImmediate(resolve));
  await e('retirar-fotografia').click();
  resolver({ ok: true, datos: {}, error: null });
  assert.equal((await subida).codigo, 'CANCELADO');
  assert.equal(controlador.obtenerArchivo(), null);
  assert.equal(e('vista-fotografia').hidden, true);
  controlador.desmontar();
});

test('fotografía: desmontar durante subida invalida la respuesta tardía', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let resolver;
  const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: () => new Promise(resolve => { resolver = resolve; }) });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  const subida = controlador.preparar();
  await new Promise(resolve => setImmediate(resolve));
  controlador.desmontar();
  resolver({ ok: true, datos: {}, error: null });
  assert.equal((await subida).codigo, 'CANCELADO');
  assert.equal(controlador.obtenerArchivo(), null);
});

test('fotografía: de dos subidas concurrentes solo la actual puede confirmar', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  const resolvers = [];
  const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: () => new Promise(resolve => resolvers.push(resolve)) });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  const primera = controlador.preparar();
  await new Promise(resolve => setImmediate(resolve));
  const segunda = controlador.preparar();
  await new Promise(resolve => setImmediate(resolve));
  resolvers[0]({ ok: true, datos: { intento: 1 }, error: null });
  assert.equal((await primera).codigo, 'CANCELADO');
  resolvers[1]({ ok: true, datos: { intento: 2 }, error: null });
  assert.equal((await segunda).datos.intento, 2);
  assert.equal(controlador.obtenerArchivo().archivo, e('input-fotografia').files[0]);
  controlador.desmontar();
});

test('fotografía: timeout termina la espera e ignora resultado posterior', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let resolver;
  const controlador = api.crearControladorImagenes({ documento: document, timeoutMs: 5,
    subirFotografia: () => new Promise(resolve => { resolver = resolve; }) });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  assert.equal((await controlador.preparar()).codigo, 'TIEMPO_AGOTADO');
  resolver({ ok: true, datos: {}, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controlador.obtenerArchivo().archivo, e('input-fotografia').files[0]);
  controlador.desmontar();
});

test('activación sin servicios no activa al abrir la página ni habilita publicación', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado', 'reintentar-estado-vendedor']);
  api.crearControladorVendedor({ documento: document, servicios: {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'INTEGRACION');
  assert.match(e('estado-vendedor').textContent, /Integración pendiente/);
  assert.equal(e('enlace-publicar-aprobado').hidden, true);
});

test('solicitud de vendedor requiere normas y nunca acepta aprobación automática', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'terminos', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado']);
  let solicitudes = 0;
  api.crearControladorVendedor({ documento: document, servicios: {
    solicitarActivacion: async () => { solicitudes++; return { ok: true, datos: { estado: 'APROBADO' }, error: null }; },
  } });
  e('terminos').checked = false;
  await e('solicitar-activacion').click();
  assert.equal(solicitudes, 0);
  e('terminos').checked = true;
  await e('solicitar-activacion').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'ERROR');
  assert.equal(e('enlace-publicar-aprobado').hidden, true);
});

test('el enlace de publicar se muestra solo tras estado APROBADO consultado al servicio', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado'], { body: { dataset: { vendedorResultado: 'true' } } });
  api.crearControladorVendedor({ documento: document, servicios: { consultarEstado: async () => ({ ok: true, datos: { estado: 'APROBADO' }, error: null }) } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'APROBADO');
  assert.equal(e('perfil-vendedor-aprobado').hidden, false);
  assert.equal(e('enlace-publicar-aprobado').hidden, false);
});

test('respuesta contradictoria de consulta no presenta un perfil aprobado', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado'], { body: { dataset: { vendedorResultado: 'true' } } });
  api.crearControladorVendedor({ documento: document, servicios: {
    consultarEstado: async () => ({ ok: true, datos: { estado: 'APROBADO' }, error: { codigo: 'CONFLICTO' } }),
  } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'ERROR');
  assert.equal(e('perfil-vendedor-aprobado').hidden, true);
  assert.equal(e('enlace-publicar-aprobado').hidden, true);
});

test('respuesta contradictoria de solicitud no informa que quedó pendiente', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'terminos', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado']);
  e('terminos').checked = true;
  const controlador = api.crearControladorVendedor({ documento: document, servicios: {
    solicitarActivacion: async () => ({ ok: true, datos: { estado: 'PENDIENTE' }, error: { codigo: 'ERROR' } }),
  } });
  await controlador.solicitar();
  assert.equal(e('estado-vendedor').dataset.estado, 'ERROR');
  assert.equal(e('perfil-vendedor-aprobado').hidden, true);
  assert.equal(e('solicitar-activacion').disabled, true);
});

test('el controlador impide solicitudes desde PENDIENTE y APROBADO', async () => {
  const api = await cargarVendedor();
  for (const estado of ['PENDIENTE', 'APROBADO']) {
    const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'terminos', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado'], { body: { dataset: { vendedorResultado: 'true' } } });
    let solicitudes = 0;
    const controlador = api.crearControladorVendedor({ documento: document, servicios: {
      consultarEstado: async () => ({ ok: true, datos: { estado }, error: null }),
      solicitarActivacion: async () => { solicitudes++; return { ok: true, datos: { estado: 'PENDIENTE' }, error: null }; },
    } });
    await new Promise(resolve => setImmediate(resolve));
    e('terminos').checked = true;
    await controlador.solicitar();
    assert.equal(solicitudes, 0);
  }
});

test('consulta de vendedor vence y una respuesta tardía no cambia el estado', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado'], { body: { dataset: { vendedorResultado: 'true' } } });
  let resolver;
  api.crearControladorVendedor({ documento: document, timeoutMs: 5, servicios: { consultarEstado: () => new Promise(resolve => { resolver = resolve; }) } });
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(e('estado-vendedor').dataset.estado, 'ERROR');
  resolver({ ok: true, datos: { estado: 'APROBADO' }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'ERROR');
  assert.equal(e('enlace-publicar-aprobado').hidden, true);
});

test('solicitud de activación que expira no permite reintento hasta consultar estado', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'terminos', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado']);
  let llamadas = 0; let resolver;
  const controlador = api.crearControladorVendedor({ documento: document, timeoutMs: 5, servicios: {
    solicitarActivacion: () => { llamadas++; return new Promise(resolve => { resolver = resolve; }); },
  } });
  e('terminos').checked = true;
  await controlador.solicitar();
  assert.equal(llamadas, 1);
  assert.equal(e('solicitar-activacion').disabled, true);
  assert.match(e('estado-vendedor').textContent, /Consulta el estado antes de volver a solicitarla/);
  resolver({ ok: true, datos: { estado: 'PENDIENTE' }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'ERROR');
  await controlador.solicitar();
  assert.equal(llamadas, 1);
});

test('HTML Publicar arranca sin valores de ejemplo y solicita los siete campos requeridos', async () => {
  const html = await readFile(new URL('../publicar.html', import.meta.url), 'utf8');
  for (const id of ['input-titulo', 'input-descripcion', 'input-categoria', 'input-condicion', 'input-precio', 'input-campus', 'input-fotografia']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /id="(?:input-titulo|input-descripcion|input-categoria|input-condicion|input-precio|input-campus)"[^>]*\svalue=/);
  assert.doesNotMatch(html, /src="assets\/images\/productos\/apuntes-calculo/);
});

test('la página de resultado no declara perfil activo por acceder directamente a su URL', async () => {
  const html = await readFile(new URL('../activar-vendedor-activo.html', import.meta.url), 'utf8');
  assert.match(html, /data-vendedor-resultado="true"/);
  assert.match(html, /abrir esta página no activa tu cuenta/);
  assert.match(html, /id="perfil-vendedor-aprobado" hidden/);
  assert.match(html, /<script src="js\/vendedor.js"><\/script>/);
});
