import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, createContext } from 'node:vm';
import { IDS, opcionesPrueba, pausa, diferida } from './fixtures.mjs';

// Contrato ejercitado con DTO, IDs y orígenes sintéticos. Ninguna consulta real.
const fuente = await readFile(new URL('../../js/catalogo.js', import.meta.url), 'utf8');
const ORIGEN = 'https://imagenes.example.invalid';
const plano = valor => JSON.parse(JSON.stringify(valor));
const exito = datos => ({ ok: true, datos, error: null });
const fallo = () => ({ ok: false, datos: null, error: { codigo: 'RED', mensaje: 'NO_REFLEJAR' } });

async function cargar() {
  const actividad = { red: 0, logs: 0 };
  const contexto = createContext({ AbortController, URL, URLSearchParams, Intl, setTimeout, clearTimeout,
    fetch() { actividad.red++; throw new Error('Red prohibida'); },
    console: { log() { actividad.logs++; }, warn() { actividad.logs++; }, error() { actividad.logs++; } } });
  const modulo = new SourceTextModule(fuente, { context: contexto,
    importModuleDynamically() { actividad.red++; throw new Error('Importación remota prohibida'); } });
  await modulo.link(() => { throw new Error('No se permite importar servicios'); });
  await modulo.evaluate();
  return { api: modulo.namespace, actividad };
}

function filtrosNormalizados() {
  return { busqueda: 'calculadora', categorias: [IDS.categoria], universidad: IDS.universidad,
    campus: IDS.campus, estados: ['disponible', 'reservado'], condiciones: ['usado'],
    precioMinimoCentimos: 1001, precioMaximoCentimos: 20000, orden: 'precio-mayor' };
}
function articulo(cambios = {}) {
  return { id: IDS.articulo, titulo: 'Calculadora sintética', descripcion: 'Datos exclusivos de la prueba.',
    vendedorId: IDS.otro, categoriaId: IDS.categoria, condicion: 'usado', precioCentimos: 12345, moneda: 'PEN',
    campusId: IDS.campus, estado: 'disponible', categoriaNombre: 'Categoría sintética',
    campusNombre: 'Campus sintético', vendedorNombre: 'Vendedor sintético',
    imagen: { proveedor: 'supabase', bucket: 'articulos-prueba', ruta: `${IDS.otro}/foto.webp`,
      url: `${ORIGEN}/foto.webp`, formato: 'image/webp', bytes: 120000, ancho: 1000, alto: 800 },
    creadoEn: '2026-11-17T12:00:00Z', actualizadoEn: '2026-11-17T12:00:00Z', version: 1, ...cambios };
}
function crear(api, extra = {}) {
  const estados = [], consultas = [];
  const opciones = opcionesPrueba();
  opciones.estados = ['disponible', 'reservado', 'vendido'].map(valor => ({ valor, etiqueta: valor }));
  opciones.condiciones = [{ valor: 'usado', etiqueta: 'Condición sintética' }];
  const dependencias = { modo: 'real', opciones, origenesImagen: [ORIGEN],
    consultarCatalogo: async (filtros, { signal }) => { consultas.push({ filtros: plano(filtros), signal }); return exito([articulo()]); },
    adaptarFiltros: api.adaptarFiltros,
    adaptarArticulo: dto => api.adaptarArticulo(dto, { origenesImagen: [ORIGEN] }),
    alCambiar: estado => estados.push(plano(estado)), ...extra };
  return { controlador: api.crearControladorCatalogo(dependencias), dependencias, estados, consultas };
}

test('adaptarFiltros conserva los nueve campos, valores y arrays sin alias ni omisiones', async () => {
  const { api } = await cargar();
  const seleccion = filtrosNormalizados();
  const resultado = api.adaptarFiltros(seleccion);
  assert.deepEqual(plano(resultado), seleccion);
  for (const campo of ['categorias', 'estados', 'condiciones']) {
    assert.notEqual(resultado[campo], seleccion[campo]);
    resultado[campo].length = 0; assert.ok(seleccion[campo].length > 0);
  }
  const vacios = { ...seleccion, universidad: '', campus: '', precioMinimoCentimos: null, precioMaximoCentimos: null };
  assert.deepEqual(plano(api.adaptarFiltros(vacios)), vacios);
  for (const cambios of [{ filtroNuevo: true }, { precioMinimoCentimos: undefined }, { estados: ['inventado'] },
    { condiciones: ['inventada'] }, { categorias: ['no-uuid'] }, { campus: 'campus-texto' },
    { precioMinimoCentimos: -1 }, { precioMinimoCentimos: 1.5 }, { precioMaximoCentimos: Number.MAX_SAFE_INTEGER + 1 },
    { precioMinimoCentimos: 30000 }, { orden: 'precio_centimos.desc' }]) {
    assert.throws(() => api.adaptarFiltros({ ...seleccion, ...cambios }));
  }
  const incompleto = { ...seleccion }; delete incompleto.busqueda;
  assert.throws(() => api.adaptarFiltros(incompleto));
});

test('adaptarArticulo proyecta DTO, estados, céntimos, nombres y foto HTTPS sin datos privados', async () => {
  const { api } = await cargar();
  for (const [estado, estadoTexto, tono] of [['disponible', 'Disponible', 'positivo'], ['reservado', 'Reservado', 'aviso'], ['vendido', 'Vendido', 'neutral']]) {
    const dto = articulo({ estado, correo: 'NO_REFLEJAR', token: 'NO_REFLEJAR', detalle: 'https://no-autorizado.invalid' });
    const vista = api.adaptarArticulo(dto, { origenesImagen: [ORIGEN] });
    assert.deepEqual(plano(vista), { id: dto.id, titulo: dto.titulo, moneda: 'PEN', precioCentimos: 12345,
      categoriaTexto: dto.categoriaNombre, ubicacionTexto: dto.campusNombre, vendedorTexto: dto.vendedorNombre,
      estadoTexto, tono, foto: { url: dto.imagen.url, alt: dto.titulo } });
    assert.equal(JSON.stringify(vista).includes('NO_REFLEJAR'), false);
  }
  const sinNombres = api.adaptarArticulo(articulo({ categoriaNombre: undefined, campusNombre: null, vendedorNombre: undefined }), { origenesImagen: [ORIGEN] });
  assert.equal(sinNombres.categoriaTexto, null); assert.equal(sinNombres.ubicacionTexto, null); assert.equal(sinNombres.vendedorTexto, null);
  // Los textos no se interpretan como HTML en el renderizador existente.
  const titulo = '<img src=x onerror=alert(1)>';
  const vista = api.adaptarArticulo(articulo({ titulo }), { origenesImagen: [ORIGEN] });
  const nodos = [];
  const documento = { createElement(tag) {
    const nodo = { tag, textContent: '', hijos: [], append(...hijos) { this.hijos.push(...hijos); },
      setAttribute() {}, addEventListener() {}, set innerHTML(_) { throw new Error('HTML prohibido'); } };
    nodos.push(nodo); return nodo;
  } };
  api.crearTarjeta(documento, vista);
  assert.equal(nodos.find(n => n.tag === 'h3').textContent, titulo);
});

test('DTO o fotografía incompatible se rechazan sin inventar imagen ni convertir importes', async () => {
  const { api } = await cargar();
  for (const cambios of [{ id: 'inventado' }, { titulo: '' }, { moneda: 'USD' }, { precioCentimos: '12345' },
    { precioCentimos: -1 }, { precioCentimos: 1.5 }, { precioCentimos: Number.MAX_SAFE_INTEGER + 1 },
    { estado: 'estado-no-aprobado' }, { categoriaNombre: '' }, { imagen: null },
    { imagen: undefined, imagen_url: `${ORIGEN}/foto.webp` }]) {
    assert.throws(() => api.adaptarArticulo(articulo(cambios), { origenesImagen: [ORIGEN] }));
  }
  for (const url of ['javascript:alert(1)', 'http://imagenes.example.invalid/foto.webp', 'https://otro.example.invalid/foto.webp',
    `${ORIGEN}/foto.webp?token=no-permitido`, `${ORIGEN}/foto.webp#fragmento`, 'https://usuario:clave@imagenes.example.invalid/foto.webp',
    'assets/images/productos/calculadora-casio-fx991ex.jpg', 'url-invalida']) {
    assert.throws(() => api.adaptarArticulo(articulo({ imagen: { ...articulo().imagen, url } }), { origenesImagen: [ORIGEN] }));
  }
  assert.throws(() => api.adaptarArticulo(articulo())); // Ningún origen habilitado por defecto.
});

test('pendiente y dependencias ausentes nunca consultan; modo real tampoco consulta al construirse', async () => {
  const { api, actividad } = await cargar();
  for (const extra of [{ modo: 'pendiente' }, { modo: undefined }, ...['consultarCatalogo', 'adaptarFiltros', 'adaptarArticulo'].map(k => ({ [k]: undefined }))]) {
    const c = crear(api, extra); c.controlador.preparar();
    assert.equal((await c.controlador.aplicar()).estado, 'pendiente'); assert.equal(c.consultas.length, 0);
    assert.match(c.controlador.obtenerEstado().mensaje, /Figma.*no resultados de Supabase/);
  }
  const c = crear(api); assert.equal(c.consultas.length, 0);
  c.controlador.preparar(); assert.equal(c.controlador.obtenerEstado().estado, 'preparado'); assert.equal(c.consultas.length, 0);
  assert.deepEqual(actividad, { red: 0, logs: 0 });
});

test('modo real: carga, éxito, vacío, error y reintento conservan filtros y distinguen prueba de servicio', async () => {
  const { api } = await cargar(); let intentos = 0; const consultas = [];
  const respuestas = [exito([articulo()]), exito([]), fallo(), exito([articulo(), articulo({ id: IDS.otro })])];
  const c = crear(api, { consultarCatalogo: async (filtros, { signal }) => {
    consultas.push(plano(filtros)); assert.ok(signal instanceof AbortSignal); return respuestas[intentos++];
  } });
  const filtros = { busqueda: ' calculadora ', categorias: [IDS.categoria], universidad: IDS.universidad, campus: IDS.campus,
    estados: ['disponible', 'reservado'], condiciones: ['usado'], precioMinimo: '10,01', precioMaximo: '200', orden: 'precio-mayor' };
  const copia = plano(filtros);
  const listo = await c.controlador.aplicar(filtros);
  assert.equal(listo.estado, 'listo'); assert.equal(listo.vistas[0].id, IDS.articulo);
  assert.match(listo.mensaje, /1 artículo en esta respuesta.*Total del catálogo no informado/);
  assert.equal((await c.controlador.aplicar(filtros)).estado, 'vacio');
  const error = await c.controlador.aplicar(filtros);
  assert.equal(error.estado, 'error'); assert.equal(JSON.stringify(error).includes('NO_REFLEJAR'), false);
  const reintento = await c.controlador.aplicar(filtros);
  assert.equal(reintento.estado, 'listo'); assert.match(reintento.mensaje, /2 artículos en esta respuesta/);
  assert.deepEqual(filtros, copia); consultas.forEach(f => assert.deepEqual(f, filtrosNormalizados()));
  assert.deepEqual(c.estados.map(e => e.estado), ['cargando', 'listo', 'cargando', 'vacio', 'cargando', 'error', 'cargando', 'listo']);
  assert.equal(c.estados.some(e => /Prueba offline|simulada/.test(e.mensaje)), false);
  const prueba = crear(api, { modo: 'prueba' });
  assert.match((await prueba.controlador.aplicar()).mensaje, /Prueba offline/);
});

test('modo real: DTO inválido o adaptador que evade el origen permitido no produce resultados', async () => {
  const { api } = await cargar();
  for (const extra of [{ consultarCatalogo: async () => exito([articulo({ moneda: 'USD' })]) },
    { adaptarArticulo: dto => ({ ...api.adaptarArticulo(dto, { origenesImagen: [ORIGEN] }), foto: { url: 'https://otro.example.invalid/foto.jpg', alt: dto.titulo } }) }]) {
    const c = crear(api, extra); const r = await c.controlador.aplicar();
    assert.equal(r.estado, 'error'); assert.equal(r.codigo, 'RESPUESTA_INVALIDA'); assert.deepEqual(plano(r.vistas), []);
  }
});

test('modo real: editar cancela y una consulta más reciente prevalece sobre respuestas tardías', async () => {
  const { api } = await cargar(); const pendientes = [diferida(), diferida()]; const senales = []; let llamadas = 0;
  const c = crear(api, { consultarCatalogo: (_, { signal }) => { senales.push(signal); return pendientes[llamadas++].promesa; } });
  const primera = c.controlador.aplicar(); await pausa(); c.controlador.preparar();
  assert.equal(senales[0].aborted, true); assert.equal(await primera, null);
  const segunda = c.controlador.aplicar({ busqueda: 'actual' }); await pausa();
  pendientes[0].resolver(exito([articulo()])); await pausa(); assert.equal(c.controlador.obtenerEstado().estado, 'cargando');
  pendientes[1].resolver(exito([])); assert.equal((await segunda).estado, 'vacio');
  const anterior = diferida(); let veces = 0;
  const otro = crear(api, { consultarCatalogo: () => ++veces === 1 ? anterior.promesa : Promise.resolve(exito([])) });
  const vieja = otro.controlador.aplicar(); await pausa(); await otro.controlador.aplicar({ busqueda: 'nueva' });
  assert.equal(await vieja, null); anterior.resolver(exito([articulo()])); await pausa();
  assert.equal(otro.controlador.obtenerEstado().estado, 'vacio');
});

test('modo real: timeout y desconexión abortan e ignoran éxitos tardíos', async () => {
  const { api } = await cargar();
  for (const tipo of ['timeout', 'desconexion']) {
    const pendiente = diferida(); let signal;
    const c = crear(api, { timeoutMs: tipo === 'timeout' ? 5 : 15000,
      consultarCatalogo: (_, opciones) => { signal = opciones.signal; return pendiente.promesa; } });
    const consulta = c.controlador.aplicar(); await pausa();
    if (tipo === 'desconexion') c.controlador.desconectar();
    const resultado = await consulta;
    assert.equal(signal.aborted, true);
    if (tipo === 'timeout') assert.equal(resultado.codigo, 'TIEMPO_AGOTADO'); else assert.equal(resultado, null);
    pendiente.resolver(exito([articulo()])); await pausa(); assert.notEqual(c.controlador.obtenerEstado().estado, 'listo');
    c.controlador.desconectar(); assert.equal(await c.controlador.aplicar(), null);
  }
});
