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
    this.options = id.startsWith('input-categoria') || id.startsWith('input-campus') ? [{ value: '' }] : [];
    this.attrs = new Map(); this.listeners = new Map(); this.focused = false; this.maxLength = -1;
    const clases = new Set();
    this.classList = { add: x => clases.add(x), remove: x => clases.delete(x), contains: x => clases.has(x), toggle: (x, v) => v ? clases.add(x) : clases.delete(x) };
    this.style = {};
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  removeAttribute(k) { this.attrs.delete(k); }
  addEventListener(k, fn) { if (!this.listeners.has(k)) this.listeners.set(k, new Set()); this.listeners.get(k).add(fn); }
  removeEventListener(k, fn) { const grupo = this.listeners.get(k); grupo?.delete(fn); if (!grupo?.size) this.listeners.delete(k); }
  focus() { this.focused = true; }
  click() { return Promise.all(Array.from(this.listeners.get('click') ?? [], fn => fn({ preventDefault() {} }))); }
  append(option) { this.options.push(option); }
  remove(index) { this.options.splice(index, 1); }
}

function cargar({ servicios = {}, titulo = 'Calculadora', descripcion = 'En buen estado.', prepararPublicacion,
  verificarVendedor = async () => ({ ok: true, datos: { estado: 'APROBADO' }, error: null }),
  origenStorage = 'https://campus.example.invalid', montar = false, timeoutMs = 15000 } = {}) {
  const ids = ['btn-publicar', 'input-titulo', 'input-descripcion', 'input-categoria', 'input-condicion', 'input-precio', 'input-campus',
    'input-fotografia', 'error-fotografia', 'estado-catalogos', 'error-categoria', 'error-condicion', 'error-precio', 'error-campus',
    'mensaje-formulario', 'error-titulo', 'error-descripcion',
    'btn-generar-ia', 'ia-propuesta', 'ia-titulo-sugerido', 'ia-desc-sugerido', 'btn-aceptar-ia', 'btn-descartar-ia',
    'error-ia-titulo', 'error-ia-descripcion'];
  const elementos = new Map(ids.map(id => [id, new Elemento(id,
    id === 'input-titulo' ? titulo : id === 'input-descripcion' ? descripcion
      : id === 'input-categoria' ? 'e7cff5f1-1df8-406e-bfa8-49daef23ab33'
        : id === 'input-campus' ? 'a7af2d30-5802-4ab1-a207-87da7c54a598'
          : id === 'input-condicion' ? 'buen_estado' : id === 'input-precio' ? '25,00' : '')]));
  elementos.get('input-titulo').maxLength = 100;
  elementos.get('input-descripcion').maxLength = 1000;
  elementos.get('ia-titulo-sugerido').maxLength = 100;
  elementos.get('ia-desc-sugerido').maxLength = 1000;
  elementos.get('input-categoria').options.push({ value: 'e7cff5f1-1df8-406e-bfa8-49daef23ab33' });
  elementos.get('input-campus').options.push({ value: 'a7af2d30-5802-4ab1-a207-87da7c54a598' });
  let ready;
  const document = {
    getElementById: id => elementos.get(id) ?? null,
    createElement: () => new Elemento('option'),
    addEventListener(tipo, listener) { if (tipo === 'DOMContentLoaded') ready = listener; },
    querySelector() { return null; },
  };
  const window = { document, setTimeout, clearTimeout };
  runInNewContext(fuente, { window, document, AbortController, Object, Set, Map, Promise, URL, Date, Number, RegExp, String, Error });
  const seleccion = Object.freeze({ generacion: 1 });
  const datosFoto = { archivo: { nombre: 'seleccionada' }, formato: 'image/webp', bytes: 1200, ancho: 1200, alto: 900 };
  const controladorImagenes = { seleccionActual: true, obtenerArchivo: () => datosFoto,
    capturarSeleccion: () => seleccion,
    esSeleccionActual: token => token === seleccion && controladorImagenes.seleccionActual,
    obtenerDatosSeleccion: token => token === seleccion && controladorImagenes.seleccionActual ? datosFoto : null,
    preparar: async () => ({ ok: true, datos: articulo.imagen, error: null }),
    desmontar() {} };
  const preparar = prepararPublicacion ?? (Object.keys(servicios).length ? async (datos, opciones) => {
    const fotografiaPreparada = await opciones.fotografia.preparar({ signal: opciones.signal });
    if (fotografiaPreparada?.ok !== true) return fotografiaPreparada;
    return { ok: true, seleccionFotografia: opciones.seleccionFotografia,
      datos: dtoDeFormulario(datos, fotografiaPreparada.datos) };
  } : undefined);
  const imagenes = { crearControladorImagenes: () => controladorImagenes };
  const controlador = window.CampusLoopPublicaciones.crearControladorPublicaciones({ documento: document, servicios, origenStorage,
    prepararPublicacion: preparar, imagenes, timeoutMs,
    opcionesCatalogo: { categorias: [{ id: 'e7cff5f1-1df8-406e-bfa8-49daef23ab33', etiqueta: 'Académico' }],
      campus: [{ id: 'a7af2d30-5802-4ab1-a207-87da7c54a598', etiqueta: 'San Miguel' }] },
    verificarVendedor });
  if (montar) ready();
  return { controlador: window.campusLoopPublicaciones ?? controlador, e: id => elementos.get(id), window, document, imagenes, controladorImagenes, datosFoto };
}
const respuesta = datos => ({ ok: true, datos, error: null });
const dtoDeFormulario = (datos, imagen = articulo.imagen) => ({ titulo: datos.titulo, descripcion: datos.descripcion,
  categoriaId: datos.categoriaId, condicion: datos.condicion, precioCentimos: datos.precioCentimos,
  moneda: 'PEN', campusId: datos.campusId, imagen });

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

test('valida la respuesta de la dependencia inyectada e identifica la prueba', async () => {
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
  assert.match(e('mensaje-formulario').textContent, /Respuesta válida del servicio de prueba/);
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
  await new Promise(resolve => setImmediate(resolve));
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
  await new Promise(resolve => setImmediate(resolve));
  controlador.desmontar();
  assert.equal(signal.aborted, true);
  resolver(respuesta(articulo));
  await pendiente;
  assert.equal(e('mensaje-formulario').textContent, '');
});

test('no inventa identificación y valida campos permitidos del artículo', () => {
  const { controlador } = cargar();
  assert.equal(controlador.validarArticulo(articulo), true);
  assert.equal(controlador.validarArticulo({ ...articulo, precioCentimos: 0 }), false);
  assert.equal(controlador.validarArticulo({ ...articulo, id: 'falso' }), false);
  assert.equal(controlador.validarArticulo({ ...articulo, estado: 'eliminado' }), false);
  assert.equal(controlador.validarArticulo({ ...articulo, estado: 'reservado' }), true);
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

for (const [caso, cambiar] of Object.entries({
  dominio: i => ({ url: i.url.replace('campus.', 'otro.') }),
  bucket: i => ({ url: i.url.replace('/articulos/', '/otro/') }),
  foto: i => ({ url: i.url.replace('foto.webp', 'otra.webp') }),
  endpoint: i => ({ url: i.url.replace('/public/', '/sign/') }),
  prefijo: i => ({ url: i.url.replace('/storage/', '/otro/storage/') }),
  segmentos: i => ({ url: i.url.replace('/storage/', '/otro/../storage/') }),
  escape: i => ({ url: i.url.replace('/foto.', '/%66oto.') }),
  consulta: i => ({ url: i.url + '?' }),
  fragmento: i => ({ url: i.url + '#' }),
  credenciales: i => ({ url: i.url.replace('https://', 'https://a@') }),
  uuid: i => ({ ruta: i.ruta.replace(articulo.vendedorId, '-'.repeat(36)), url: i.url.replace(articulo.vendedorId, '-'.repeat(36)) }),
  propietario: i => ({ ruta: i.ruta.replace(articulo.vendedorId, ID), url: i.url.replace(articulo.vendedorId, ID) }),
  formato: () => ({ formato: 'image/png' }),
})) test('rechaza fotografía con ' + caso, () => {
  const { controlador } = cargar();
  assert.equal(controlador.validarArticulo({ ...articulo, imagen: { ...articulo.imagen, ...cambiar(articulo.imagen) } }), false);
});

test('origen ausente impide escribir', async () => {
  let llamadas = 0;
  const { e } = cargar({ origenStorage: '', servicios: { crearPublicacion() { llamadas++; } } });
  await e('btn-publicar').click();
  assert.equal(llamadas, 0);
});

test('preparador solo expone mensajes controlados', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: assert.fail }, prepararPublicacion: () => ({
    ok: false, datos: null, error: { codigo: 'NO_AUTORIZADO', mensaje: 'interno' },
  }) });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /No tienes permiso/);
});

test('respuesta contradictoria no confirma', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: () => ({ ...respuesta(articulo), error: {} }) } });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /no pudimos validar/);
});

test('preparación conserva todos los datos confirmados y no llama al servicio si alguno cambia', async () => {
  const casos = {
    titulo: 'Otro título', descripcion: 'Otra descripción', categoriaId: 'b7cff5f1-1df8-406e-bfa8-49daef23ab33',
    condicion: 'nuevo', precioCentimos: 2600, moneda: 'USD', campusId: 'b7af2d30-5802-4ab1-a207-87da7c54a598',
  };
  for (const [campo, valor] of Object.entries(casos)) {
    let llamadas = 0;
    const { e } = cargar({ servicios: { crearPublicacion: async () => { llamadas++; return respuesta(articulo); } },
      prepararPublicacion: async (datos, opciones) => {
        const foto = await opciones.fotografia.preparar({ signal: opciones.signal });
        return { ok: true, seleccionFotografia: opciones.seleccionFotografia,
          datos: { ...dtoDeFormulario(datos, foto.datos), [campo]: valor } };
      } });
    await e('btn-publicar').click();
    assert.equal(llamadas, 0, `no debe crear si cambió ${campo}`);
    assert.match(e('mensaje-formulario').textContent, /categoría, campus, precio y fotografía válidos/);
  }
});

test('el preparador no puede asociar una fotografía distinta a la selección capturada', async () => {
  let llamadas = 0;
  const { e } = cargar({ servicios: { crearPublicacion: async () => { llamadas++; return respuesta(articulo); } },
    prepararPublicacion: async (datos, opciones) => {
      await opciones.fotografia.preparar({ signal: opciones.signal });
      return { ok: true, seleccionFotografia: opciones.seleccionFotografia,
      datos: dtoDeFormulario(datos, { ...articulo.imagen, ruta: `${articulo.vendedorId}/otra.webp`,
        url: `https://campus.example.invalid/storage/v1/object/public/articulos/${articulo.vendedorId}/otra.webp` }) };
    } });
  await e('btn-publicar').click();
  assert.equal(llamadas, 0);
  assert.match(e('mensaje-formulario').textContent, /categoría, campus, precio y fotografía válidos/);
});

test('si cambia la foto mientras prepara, no crea con la selección anterior ni posterior', async () => {
  let llamadas = 0; let resolverPreparacion;
  const { e, controladorImagenes } = cargar({ servicios: { crearPublicacion: async () => { llamadas++; return respuesta(articulo); } },
    prepararPublicacion: async (datos, opciones) => {
      const foto = await opciones.fotografia.preparar({ signal: opciones.signal });
      await new Promise(resolve => { resolverPreparacion = resolve; });
      return { ok: true, seleccionFotografia: opciones.seleccionFotografia, datos: dtoDeFormulario(datos, foto.datos) };
    } });
  const pendiente = e('btn-publicar').click();
  await new Promise(resolve => setImmediate(resolve));
  controladorImagenes.seleccionActual = false;
  resolverPreparacion();
  await pendiente;
  assert.equal(llamadas, 0);
  assert.match(e('mensaje-formulario').textContent, /categoría, campus, precio y fotografía válidos/);
});

test('respuesta de creación debe corresponder a todos los datos enviados y acepta estado válido del servicio', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: async () => respuesta({ ...articulo, campusId: 'b7af2d30-5802-4ab1-a207-87da7c54a598' }) } });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /respuesta que no pudimos validar/);
  const aceptada = cargar({ servicios: { crearPublicacion: async () => respuesta({ ...articulo, estado: 'reservado' }) } });
  await aceptada.e('btn-publicar').click();
  assert.match(aceptada.e('mensaje-formulario').textContent, /Respuesta válida del servicio de prueba/);
});

test('consulta de vendedor que no responde expira sin iniciar preparación o creación', async () => {
  let crear = 0; let resolverVendedor;
  const { e } = cargar({ timeoutMs: 5, verificarVendedor: () => new Promise(resolve => { resolverVendedor = resolve; }),
    servicios: { crearPublicacion: async () => { crear++; return respuesta(articulo); } },
    prepararPublicacion: () => assert.fail('no debe preparar sin confirmación') });
  const pendiente = e('btn-publicar').click();
  await new Promise(resolve => setTimeout(resolve, 15));
  await pendiente;
  resolverVendedor({ ok: true, datos: { estado: 'APROBADO' }, error: null });
  assert.equal(crear, 0);
  assert.match(e('mensaje-formulario').textContent, /consulta de vendedor tardó demasiado/);
  assert.equal(e('btn-publicar').disabled, false);
});

test('preparación sin respuesta expira y no deja el formulario bloqueado', async () => {
  let crear = 0;
  const { e } = cargar({ timeoutMs: 5, servicios: { crearPublicacion: async () => { crear++; return respuesta(articulo); } },
    prepararPublicacion: () => new Promise(() => {}) });
  await e('btn-publicar').click();
  assert.equal(crear, 0);
  assert.match(e('mensaje-formulario').textContent, /preparación tardó demasiado/);
  assert.equal(e('btn-publicar').disabled, false);
});

test('creación sin respuesta expira con aviso de verificar antes de reintentar', async () => {
  let resolver;
  const { e } = cargar({ timeoutMs: 5, servicios: { crearPublicacion: () => new Promise(resolve => { resolver = resolve; }) } });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /comprueba su estado antes de reintentar/);
  assert.equal(e('btn-publicar').disabled, false);
  resolver(respuesta(articulo));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(e('mensaje-formulario').textContent, /comprueba su estado antes de reintentar/);
});

test('edición durante envío conserva el nuevo texto y separa la respuesta', async () => {
  let resolver;
  const { e, controlador } = cargar({ montar: true, servicios: { crearPublicacion: () => new Promise(r => { resolver = r; }) } });
  await e('btn-generar-ia').click();
  const pendiente = e('btn-publicar').click();
  await new Promise(resolve => setImmediate(resolve));
  e('input-titulo').value = 'Edición manual';
  for (const id of ['btn-aceptar-ia', 'btn-descartar-ia', 'btn-generar-ia']) await e(id).click();
  assert.equal(controlador.aplicarBorradorValidado({ titulo: 'Otro', descripcion: 'Texto' }), false);
  assert.match(e('mensaje-formulario').textContent, /Enviando/);
  resolver(respuesta(articulo));
  await pendiente;
  assert.equal(e('input-titulo').value, 'Edición manual');
  assert.match(e('mensaje-formulario').textContent, /envío anterior/);
});

test('montaje único, desmontaje pendiente y nuevo montaje', async () => {
  let resolver;
  const { e, window, controlador, document, imagenes } = cargar({ servicios: { crearPublicacion: () => new Promise(r => { resolver = r; }) } });
  const montar = () => window.CampusLoopPublicaciones.crearControladorPublicaciones({ documento: document, imagenes,
    opcionesCatalogo: { categorias: [{ id: 'e7cff5f1-1df8-406e-bfa8-49daef23ab33', etiqueta: 'Académico' }],
      campus: [{ id: 'a7af2d30-5802-4ab1-a207-87da7c54a598', etiqueta: 'San Miguel' }] } });
  assert.equal(montar(), controlador);
  const boton = e('btn-publicar');
  boton.textContent = 'Publicar';
  boton.setAttribute('aria-busy', 'false');
  const pendiente = boton.click();
  await new Promise(resolve => setImmediate(resolve));
  controlador.desmontar();
  assert.equal(boton.textContent, 'Publicar');
  assert.equal(boton.getAttribute('aria-busy'), 'false');
  const nuevo = montar();
  await boton.click();
  resolver(respuesta(articulo));
  await pendiente;
  assert.match(e('mensaje-formulario').textContent, /Integración pendiente/);
  assert.equal(boton.listeners.get('click').size, 1);
  assert.equal(controlador.aplicarBorradorValidado({ titulo: 'Viejo', descripcion: 'Texto' }), false);
  nuevo.desmontar();
});

test('borrador rechaza propiedades adicionales', () => {
  const { controlador } = cargar();
  assert.equal(controlador.aplicarBorradorValidado({ titulo: 'Texto', descripcion: 'Texto', id: ID }), false);
});

test('descartar conserva originales y aceptar aplica edición con foco', async () => {
  const { e } = cargar({ montar: true });
  await e('btn-generar-ia').click();
  e('ia-titulo-sugerido').value = 'Descartado';
  await e('btn-descartar-ia').click();
  assert.equal(e('input-titulo').value, 'Calculadora');
  assert.equal(e('btn-generar-ia').focused, true);
  await e('btn-generar-ia').click();
  e('ia-titulo-sugerido').value = 'Editado';
  await e('btn-aceptar-ia').click();
  assert.equal(e('input-titulo').value, 'Editado');
  assert.equal(e('input-titulo').focused, true);
});

test('borrador inválido o demasiado largo conserva ambos campos', () => {
  const { controlador, e } = cargar();
  for (const dato of [null, [], { titulo: 'a'.repeat(101), descripcion: 'b' }, { titulo: 'a', descripcion: 'b'.repeat(1001) }]) {
    assert.equal(controlador.aplicarBorradorValidado(dato), false);
  }
  assert.equal(e('input-titulo').value, 'Calculadora');
});

test('código desconocido del preparador conserva los datos y oculta detalles', async () => {
  const { e } = cargar({ servicios: { crearPublicacion: assert.fail }, prepararPublicacion: () => ({
    ok: false, datos: null, error: { codigo: 'OTRO', mensaje: 'detalle privado' },
  }) });
  await e('btn-publicar').click();
  assert.match(e('mensaje-formulario').textContent, /No se pudo completar/);
  assert.equal(e('input-descripcion').value, 'En buen estado.');
});
