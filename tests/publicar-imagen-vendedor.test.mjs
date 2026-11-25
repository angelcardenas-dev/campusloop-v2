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
  runInNewContext(fuente, { window: ventana, URL, Date, Set, Object, Number, Promise, WeakMap, AbortController, Error });
  return { api: ventana.CampusLoopImagenes, ventana, urlsRevocadas };
}

async function cargarVendedor() {
  const fuente = await readFile(new URL('../js/vendedor.js', import.meta.url), 'utf8');
  const ventana = { setTimeout, clearTimeout };
  runInNewContext(fuente, { window: ventana, Set, Object, AbortController, Promise, Error });
  return ventana.CampusLoopVendedor;
}

const CONTEXTO_STORAGE = Object.freeze({ proveedor: 'supabase', bucket: 'bucket-pruebas',
  propietarioId: 'e1dcf222-0c13-4b20-8b43-43183a881f26', origenStorage: 'https://storage.example.invalid' });
function respuestaSubida(datos, { presentacion } = {}) {
  const extension = datos.formato === 'image/jpeg' ? 'jpg' : datos.formato === 'image/png' ? 'png' : 'webp';
  return { ok: true, datos: { referencia: { proveedor: 'supabase', bucket: CONTEXTO_STORAGE.bucket,
    ruta: `${CONTEXTO_STORAGE.propietarioId}/foto.${extension}`, formato: datos.formato, bytes: datos.bytes,
    ancho: datos.ancho, alto: datos.alto }, ...(presentacion ? { presentacion } : {}) }, error: null };
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
    subirFotografia: async datos => ++subida === 1
      ? respuestaSubida(datos)
      : { ok: false, datos: null, error: { codigo: 'RED' } },
  });
  const seleccionar = async archivo => { e('input-fotografia').files = [archivo]; await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn())); };
  await seleccionar(archivos[0]);
  await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  await seleccionar(archivos[1]);
  assert.equal(e('vista-fotografia').src, 'blob:local-preview-2');
  await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
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
      : Promise.resolve(respuestaSubida({ ...datos })) });
  const seleccionar = async archivo => { e('input-fotografia').files = [archivo]; await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn())); };
  await seleccionar(archivos[0]);
  const subidaA = controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  await new Promise(resolve => setImmediate(resolve));
  await seleccionar(archivos[1]);
  resolverA(respuestaSubida({ formato: 'image/jpeg', bytes: 1000, ancho: 640, alto: 480 }));
  assert.equal((await subidaA).codigo, 'CANCELADO');
  assert.equal(controlador.obtenerArchivo().archivo, archivos[1]);
  assert.equal(e('vista-fotografia').src, 'blob:local-preview-2');
  assert.equal((await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE })).datos.ruta,
    `${CONTEXTO_STORAGE.propietarioId}/foto.png`);
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
  const subida = controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  await new Promise(resolve => setImmediate(resolve));
  await e('retirar-fotografia').click();
  resolver(respuestaSubida({ formato: 'image/jpeg', bytes: 1000, ancho: 1200, alto: 900 }));
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
  const subida = controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  await new Promise(resolve => setImmediate(resolve));
  controlador.desmontar();
  resolver(respuestaSubida({ formato: 'image/jpeg', bytes: 1000, ancho: 1200, alto: 900 }));
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
  const primera = controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  await new Promise(resolve => setImmediate(resolve));
  const segunda = controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  await new Promise(resolve => setImmediate(resolve));
  resolvers[0](respuestaSubida({ formato: 'image/jpeg', bytes: 1000, ancho: 1200, alto: 900 }));
  assert.equal((await primera).codigo, 'CANCELADO');
  resolvers[1](respuestaSubida({ formato: 'image/jpeg', bytes: 1000, ancho: 1200, alto: 900 }));
  assert.equal((await segunda).datos.ruta, `${CONTEXTO_STORAGE.propietarioId}/foto.jpg`);
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
  assert.equal((await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE })).codigo, 'TIEMPO_AGOTADO');
  resolver(respuestaSubida({ formato: 'image/jpeg', bytes: 1000, ancho: 1200, alto: 900 }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controlador.obtenerArchivo().archivo, e('input-fotografia').files[0]);
  controlador.desmontar();
});

test('subida valida referencia privada y separa la URL firmada temporal', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  const temporal = { url: `${CONTEXTO_STORAGE.origenStorage}/storage/v1/object/sign/${CONTEXTO_STORAGE.bucket}/${CONTEXTO_STORAGE.propietarioId}/foto.jpg?token=solo-prueba`,
    expiraEn: new Date(Date.now() + 60000).toISOString() };
  const controlador = api.crearControladorImagenes({ documento: document,
    subirFotografia: datos => Promise.resolve(respuestaSubida(datos, { presentacion: temporal })) });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  const resultado = await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.datos.ruta, `${CONTEXTO_STORAGE.propietarioId}/foto.jpg`);
  assert.equal(Object.hasOwn(resultado.datos, 'url'), false);
  assert.equal(resultado.presentacionTemporal.url, temporal.url);
  assert.equal(api.validarPresentacionTemporal({ ...temporal, expiraEn: '2000-01-01T00:00:00Z' }, CONTEXTO_STORAGE, resultado.datos), false);
  controlador.desmontar();
});

test('la renovación de URL temporal no cambia la identidad persistente de la fotografía', async () => {
  const { api } = await cargarImagenes();
  const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
  let tanda = 0;
  const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: datos => {
    tanda++;
    return respuestaSubida(datos, { presentacion: { url: `${CONTEXTO_STORAGE.origenStorage}/storage/v1/object/sign/${CONTEXTO_STORAGE.bucket}/${CONTEXTO_STORAGE.propietarioId}/foto.jpg?token=t${tanda}`,
      expiraEn: new Date(Date.now() + 60000).toISOString() } });
  } });
  e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
  await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
  const primero = await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  const segundo = await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE });
  assert.deepEqual(JSON.parse(JSON.stringify(primero.datos)), JSON.parse(JSON.stringify(segundo.datos)));
  assert.notEqual(primero.presentacionTemporal.url, segundo.presentacionTemporal.url);
  controlador.desmontar();
});

test('subida rechaza URL en referencia, bucket ajeno, ruta ajena y metadatos incompatibles', async () => {
  const { api } = await cargarImagenes();
  const casos = [
    ref => ({ ...ref, url: 'https://storage.example.invalid/storage/v1/object/public/bucket-pruebas/foto.jpg' }),
    ref => ({ ...ref, urlFirmada: 'https://storage.example.invalid/storage/v1/object/sign/bucket-pruebas/foto.jpg?token=x' }),
    ref => ({ ...ref, bucket: 'bucket-ajeno' }),
    ref => ({ ...ref, ruta: '591cc1f4-8e7d-46d0-a752-d9bfad1a4590/foto.jpg' }),
    ref => ({ ...ref, formato: 'image/png' }),
    ref => ({ ...ref, bytes: ref.bytes + 1 }),
    ref => ({ ...ref, ancho: 99 }),
    ref => ({ ...ref, alto: 12001 }),
  ];
  for (const alterar of casos) {
    const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
    const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: datos => {
      const referencia = respuestaSubida(datos).datos.referencia;
      return { ok: true, datos: { referencia: alterar(referencia) }, error: null };
    } });
    e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
    await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
    assert.equal((await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE })).codigo, 'SUBIDA');
    controlador.desmontar();
  }
});

test('subida rechaza presentación firmada vencida o de otro origen', async () => {
  const { api } = await cargarImagenes();
  for (const url of [
    'https://other.example.invalid/storage/v1/object/sign/bucket-pruebas/e1dcf222-0c13-4b20-8b43-43183a881f26/foto.jpg?token=x',
    `${CONTEXTO_STORAGE.origenStorage}/storage/v1/object/sign/bucket-pruebas/e1dcf222-0c13-4b20-8b43-43183a881f26/foto.jpg?token=x&extra=y`,
  ]) {
    const { document, e } = entorno(['input-fotografia', 'vista-fotografia', 'retirar-fotografia', 'mensaje-fotografia']);
    const controlador = api.crearControladorImagenes({ documento: document, subirFotografia: datos =>
      respuestaSubida(datos, { presentacion: { url, expiraEn: new Date(Date.now() + 60000).toISOString() } }) });
    e('input-fotografia').files = [{ type: 'image/jpeg', size: 1000 }];
    await Promise.all([...e('input-fotografia').listeners.get('change')].map(fn => fn()));
    assert.equal((await controlador.preparar({ contextoStorage: CONTEXTO_STORAGE })).codigo, 'SUBIDA');
    controlador.desmontar();
  }
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

test('cambio de identidad invalida aprobación visible y descarta consulta tardía', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado']);
  let cambiarIdentidad; let resolverVieja; let consultas = 0;
  const controlador = api.crearControladorVendedor({ documento: document,
    observarCambioIdentidad: callback => { cambiarIdentidad = callback; return () => {}; },
    servicios: { consultarEstado: () => {
      consultas++;
      if (consultas === 1) return new Promise(resolve => { resolverVieja = resolve; });
      return Promise.resolve({ ok: true, datos: { estado: 'NO_SOLICITADO' }, error: null });
    } } });
  cambiarIdentidad();
  await new Promise(resolve => setImmediate(resolve));
  resolverVieja({ ok: true, datos: { estado: 'APROBADO' }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e('estado-vendedor').dataset.estado, 'NO_SOLICITADO');
  assert.equal(e('perfil-vendedor-aprobado').hidden, true);
  assert.equal(e('enlace-publicar-aprobado').hidden, true);
  controlador.desmontar();
});

test('cambio de identidad durante solicitud de activación exige consultar antes de reintentar', async () => {
  const api = await cargarVendedor();
  const { document, e } = entorno(['estado-vendedor', 'solicitar-activacion', 'terminos', 'perfil-vendedor-aprobado', 'enlace-publicar-aprobado']);
  let cambiarIdentidad; let resolverSolicitud; let solicitudes = 0;
  const controlador = api.crearControladorVendedor({ documento: document,
    observarCambioIdentidad: callback => { cambiarIdentidad = callback; return () => {}; },
    servicios: {
      consultarEstado: async () => ({ ok: true, datos: { estado: 'NO_SOLICITADO' }, error: null }),
      solicitarActivacion: () => { solicitudes++; return new Promise(resolve => { resolverSolicitud = resolve; }); },
    } });
  await new Promise(resolve => setImmediate(resolve));
  e('terminos').checked = true;
  const solicitud = controlador.solicitar();
  await new Promise(resolve => setImmediate(resolve));
  cambiarIdentidad();
  await new Promise(resolve => setImmediate(resolve));
  resolverSolicitud({ ok: true, datos: { estado: 'APROBADO' }, error: null });
  await solicitud;
  assert.equal(e('estado-vendedor').dataset.estado, 'NO_SOLICITADO');
  assert.equal(e('enlace-publicar-aprobado').hidden, true);
  assert.equal(e('solicitar-activacion').disabled, true);
  await controlador.solicitar();
  assert.equal(solicitudes, 1);
  controlador.desmontar();
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
