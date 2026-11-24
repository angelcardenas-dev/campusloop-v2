import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const fuente = await readFile(new URL('../js/publicaciones.js', import.meta.url), 'utf8');
const ID = '591cc1f4-8e7d-46d0-a752-d9bfad1a4590';
const articulo = {
  id: ID, vendedorId: 'e1dcf222-0c13-4b20-8b43-43183a881f26', categoriaId: 'e7cff5f1-1df8-406e-bfa8-49daef23ab33',
  campusId: 'a7af2d30-5802-4ab1-a207-87da7c54a598', titulo: 'Calculadora', descripcion: 'En buen estado.',
  precioCentimos: 2500, moneda: 'PEN', condicion: 'buen_estado', estado: 'disponible',
  imagen: { proveedor: 'supabase', bucket: 'articulos', ruta: 'e1dcf222-0c13-4b20-8b43-43183a881f26/foto.webp',
    url: 'https://campus.example.invalid/storage/v1/object/public/articulos/e1dcf222-0c13-4b20-8b43-43183a881f26/foto.webp',
    formato: 'image/webp', bytes: 1200, ancho: 1200, alto: 900 },
  creadoEn: '2026-11-22T12:00:00Z', actualizadoEn: '2026-11-22T12:00:00Z', version: 1,
};

class Elemento {
  constructor(id, value = '') {
    this.id = id; this.value = value; this.textContent = ''; this.hidden = true; this.disabled = false;
    this.attrs = new Map(); this.listeners = new Map(); this.focused = false; this.maxLength = -1;
    const clases = new Set();
    this.classList = { add: x => clases.add(x), remove: x => clases.delete(x), contains: x => clases.has(x), toggle: (x, v) => v ? clases.add(x) : clases.delete(x) };
    this.style = {};
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  removeAttribute(k) { this.attrs.delete(k); }
  addEventListener(k, fn) { this.listeners.set(k, fn); }
  removeEventListener(k) { this.listeners.delete(k); }
  focus() { this.focused = true; }
  click() { return this.listeners.get('click')?.({ preventDefault() {} }); }
}

function cargar({ servicios = {}, titulo = 'Calculadora', descripcion = 'En buen estado.', prepararPublicacion, montar = false } = {}) {
  const ids = ['btn-publicar', 'input-titulo', 'input-descripcion', 'mensaje-formulario', 'error-titulo', 'error-descripcion',
    'btn-generar-ia', 'ia-propuesta', 'ia-titulo-sugerido', 'ia-desc-sugerido', 'btn-aceptar-ia', 'btn-descartar-ia',
    'error-ia-titulo', 'error-ia-descripcion'];
  const elementos = new Map(ids.map(id => [id, new Elemento(id,
    id === 'input-titulo' ? titulo : id === 'input-descripcion' ? descripcion : '')]));
  elementos.get('input-titulo').maxLength = 100;
  elementos.get('input-descripcion').maxLength = 1000;
  elementos.get('ia-titulo-sugerido').maxLength = 100;
  elementos.get('ia-desc-sugerido').maxLength = 1000;
  let ready;
  const document = {
    getElementById: id => elementos.get(id) ?? null,
    addEventListener(tipo, listener) { if (tipo === 'DOMContentLoaded') ready = listener; },
    querySelector() { return null; },
  };
  const window = { document };
  runInNewContext(fuente, { window, document, AbortController, Object, Set, Map, Promise, URL, Date, Number, RegExp, String });
  const preparar = prepararPublicacion ?? (Object.keys(servicios).length ? datos => ({ ok: true, datos: {
    ...datos, categoriaId: 'e7cff5f1-1df8-406e-bfa8-49daef23ab33', campusId: 'a7af2d30-5802-4ab1-a207-87da7c54a598',
    condicion: 'buen_estado', precioCentimos: 2500, moneda: 'PEN', imagen: articulo.imagen,
  } }) : undefined);
  const controlador = window.CampusLoopPublicaciones.crearControladorPublicaciones({ documento: document, servicios, prepararPublicacion: preparar });
  if (montar) ready();
  return { controlador: window.campusLoopPublicaciones ?? controlador, e: id => elementos.get(id), window };
}
const respuesta = datos => ({ ok: true, datos, error: null });

test('sin servicio informa integración pendiente y no finge publicación', async () => {
  const { e } = cargar();
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /Integración pendiente/);
  assert.equal(e('mensaje-formulario').textContent.includes('confirmada'), false);
  assert.equal(e('btn-publicar').disabled, false);
});

test('validación informa cada campo inválido y enfoca el primero', async () => {
  const { e } = cargar({ titulo: ' ', descripcion: ' ' });
  e('input-descripcion').setAttribute('aria-describedby', 'descripcion-ayuda');
  await e('btn-publicar').click();
  assert.equal(e('input-titulo').getAttribute('aria-invalid'), 'true');
  assert.equal(e('input-descripcion').getAttribute('aria-invalid'), 'true');
  assert.equal(e('error-titulo').hidden, false);
  assert.equal(e('error-descripcion').hidden, false);
  assert.equal(e('input-descripcion').getAttribute('aria-describedby'), 'descripcion-ayuda error-descripcion');
  assert.equal(e('input-titulo').focused, true);
});

test('limita título/descripción a los máximos del formulario', async () => {
  const { e } = cargar({ titulo: 'a'.repeat(101), descripcion: 'b'.repeat(1001) });
  await e('btn-publicar').click();
  assert.equal(e('input-titulo').getAttribute('aria-invalid'), 'true');
  assert.equal(e('input-descripcion').getAttribute('aria-invalid'), 'true');
});

test('crea vía dependencia inyectada y confirma solo respuesta válida', async () => {
  let recibido;
  const { e } = cargar({ servicios: { crearPublicacion: async (dto, opciones) => {
    recibido = { dto, opciones };
    return respuesta(articulo);
  } } });
  await e('btn-publicar').click();
  assert.equal(recibido.dto.titulo, 'Calculadora');
  assert.equal(recibido.dto.descripcion, 'En buen estado.');
  assert.equal(recibido.dto.moneda, 'PEN');
  assert.ok(recibido.dto.categoriaId && recibido.dto.campusId);
  assert.ok(recibido.opciones.signal instanceof AbortSignal);
  assert.match(e('mensaje-formulario').textContent, /confirmada por el servicio/);
  assert.equal(e('btn-publicar').disabled, false);
});

test('ignora respuesta sin DTO válido y no navega a éxito', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: async () => respuesta({ id: ID }) } });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /respuesta que no pudimos validar/);
});

test('rechazo conserva valores y oculta detalles internos', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: async () => ({ ok: false, datos: null,
    error: { codigo: 'NO_AUTORIZADO', mensaje: 'detalle privado' } }) } });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /No tienes permiso/);
  assert.doesNotMatch(e('mensaje-formulario').textContent, /detalle privado/);
  assert.equal(e('input-titulo').value, 'Calculadora');
  assert.equal(e('input-descripcion').value, 'En buen estado.');
});

test('falla del servicio conserva datos y recupera botón', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: async () => { throw new Error('secreto'); } } });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /No se pudo completar/);
  assert.equal(e('input-titulo').value, 'Calculadora');
  assert.equal(e('btn-publicar').disabled, false);
});

test('doble envío solo ejecuta una operación concurrente', async () => {
  let resolver; let llamadas = 0;
  const { e } = cargar({ servicios: { crearPublicacion: () => {
    llamadas++;
    return new Promise(resolve => { resolver = resolve; });
  } } });
  const primera = e('btn-publicar').click();
  const segunda = e('btn-publicar').click();
  assert.equal(llamadas, 1);
  resolver(respuesta(articulo));
  await Promise.all([primera, segunda]);
});

test('desmontar invalida respuesta tardía y aborta señal', async () => {
  let resolver; let signal;
  const { controlador, e } = cargar({ servicios: { crearPublicacion: (_dto, opciones) => {
    signal = opciones.signal;
    return new Promise(resolve => { resolver = resolve; });
  } } });
  const pendiente = e('btn-publicar').click();
  controlador.desmontar();
  assert.equal(signal.aborted, true);
  resolver(respuesta(articulo));
  await pendiente;
  assert.equal(e('mensaje-formulario').textContent, 'Enviando la publicación…');
});

test('no inventa identificación y valida campos permitidos del artículo', () => {
  const { controlador } = cargar();
  assert.equal(controlador.validarArticulo(articulo), true);
  assert.equal(controlador.validarArticulo({ ...articulo, precioCentimos: 0 }), false);
  assert.equal(controlador.validarArticulo({ ...articulo, id: 'falso' }), false);
  assert.equal(controlador.validarArticulo({ ...articulo, estado: 'eliminado' }), false);
});

test('rechaza DTO incompleto o precio no positivo antes de llamar al servicio', async () => {
  let llamadas = 0;
  const { e } = cargar({ servicios: { crearPublicacion: async () => { llamadas++; return respuesta(articulo); } },
    prepararPublicacion: () => ({ ok: true, datos: { titulo: 'Calculadora', precioCentimos: 0 } }) });
  await e('btn-publicar').click();
  assert.equal(llamadas, 0);
  assert.match(e('mensaje-formulario').textContent, /categoría, campus, precio y fotografía válidos/);
});

test('aplica un borrador de texto revisable, sin publicar ni crear IDs', () => {
  const { controlador, e } = cargar();
  assert.equal(controlador.aplicarBorradorValidado({ titulo: 'Borrador', descripcion: 'Texto' }), true);
  assert.equal(e('input-titulo').value, 'Borrador');
  assert.equal(e('input-descripcion').value, 'Texto');
  assert.match(e('mensaje-formulario').textContent, /para revisión/);
});

test('restaura los mensajes/ARIA aprobados para IA y limpia listeners al desmontar', () => {
  const { controlador, e } = cargar({ montar: true });
  e('btn-generar-ia').click();
  assert.equal(e('ia-propuesta').style.display, 'block');
  e('ia-titulo-sugerido').value = '';
  e('ia-desc-sugerido').value = '';
  e('btn-aceptar-ia').click();
  assert.equal(e('error-ia-titulo').textContent, 'El título de la sugerencia está vacío. Edítalo o descarta la propuesta.');
  assert.equal(e('ia-titulo-sugerido').getAttribute('aria-invalid'), 'true');
  assert.equal(e('ia-titulo-sugerido').focused, true);
  controlador.desmontar();
  assert.equal(e('btn-publicar').listeners.size, 0);
  assert.equal(e('input-titulo').listeners.size, 0);
  assert.equal(e('btn-generar-ia').listeners.size, 0);
  assert.equal(e('btn-aceptar-ia').listeners.size, 0);
});
