import { validarConfiguracionPublica } from './config-publica.js';
import { obtenerClienteSupabase } from './supabase-cliente.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROLES = /[\u0000-\u001f\u007f]/;
const ESTADOS = ['disponible', 'reservado', 'vendido'];
const CONDICIONES = ['nuevo', 'como_nuevo', 'buen_estado', 'usado'];
const ORDENES = {
  recientes: 'creado_en.desc,id.asc',
  'precio-menor': 'precio_centimos.asc,id.asc',
  'precio-mayor': 'precio_centimos.desc,id.asc',
};
const CAMPOS_FILTROS = ['busqueda', 'categorias', 'universidad', 'campus', 'estados', 'condiciones',
  'precioMinimoCentimos', 'precioMaximoCentimos', 'orden'];
const COLUMNAS = [
  'id', 'vendedor_id', 'titulo', 'descripcion', 'categoria_id', 'condicion', 'precio_centimos::text',
  'moneda', 'campus_id', 'estado', 'creado_en', 'actualizado_en', 'version',
  'imagen_bucket', 'imagen_ruta', 'imagen_url', 'imagen_formato', 'imagen_bytes::text',
  'imagen_ancho', 'imagen_alto',
];
// Tamaño inicial provisional del contrato, dentro del máximo que admite el controlador.
const LIMITE_INICIAL = 24;
const EXTENSIONES_IMAGEN = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'],
};

const exito = datos => ({ ok: true, datos, error: null });
const fallo = (codigo, mensaje) => ({ ok: false, datos: null, error: { codigo, mensaje } });
const esId = valor => typeof valor === 'string' && UUID.test(valor);
const enteroPositivo = valor => Number.isSafeInteger(valor) && valor > 0;
const precioFiltroValido = valor => valor === null || (Number.isSafeInteger(valor) && valor >= 0);
const listaValida = (lista, validar) => Array.isArray(lista) && Array.from(lista).every(validar);
const textoValido = (valor, maximo) => typeof valor === 'string' && valor.trim().length > 0
  && Array.from(valor).length <= maximo;

function filtrosValidos(filtros) {
  if (!filtros || typeof filtros !== 'object' || Array.isArray(filtros)
    || Object.keys(filtros).length !== CAMPOS_FILTROS.length
    || !CAMPOS_FILTROS.every(campo => Object.hasOwn(filtros, campo))) return false;

  const { busqueda, categorias, universidad, campus, estados, condiciones,
    precioMinimoCentimos: minimo, precioMaximoCentimos: maximo, orden } = filtros;
  return typeof busqueda === 'string' && Array.from(busqueda).length <= 120 && !CONTROLES.test(busqueda)
    && listaValida(categorias, esId) && (universidad === '' || esId(universidad)) && (campus === '' || esId(campus))
    && listaValida(estados, estado => ESTADOS.includes(estado))
    && listaValida(condiciones, condicion => CONDICIONES.includes(condicion))
    && precioFiltroValido(minimo) && precioFiltroValido(maximo)
    && (minimo === null || maximo === null || minimo <= maximo)
    && typeof orden === 'string' && Object.hasOwn(ORDENES, orden);
}

function consultaRest(origen, filtros) {
  const url = new URL('/rest/v1/articulos', origen);
  const parametros = new URLSearchParams({
    select: [...COLUMNAS, ...(filtros.universidad ? ['campus!inner(universidad_id)'] : [])].join(','),
    eliminado_en: 'is.null',
    order: ORDENES[filtros.orden],
    limit: String(LIMITE_INICIAL),
  });
  const busqueda = filtros.busqueda.trim();
  if (busqueda) {
    // imatch usa una expresión regular de PostgreSQL. Escapar primero su sintaxis
    // y luego las comillas y barras del literal dentro del grupo or de PostgREST.
    const literal = busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const valor = '"' + literal.replace(/["\\]/g, '\\$&') + '"';
    parametros.set('or', `(titulo.imatch.${valor},descripcion.imatch.${valor})`);
  }
  for (const [columna, valores] of [['categoria_id', filtros.categorias],
    ['estado', filtros.estados], ['condicion', filtros.condiciones]]) {
    if (valores.length) parametros.set(columna, `in.(${valores.join(',')})`);
  }
  if (filtros.universidad) parametros.set('campus.universidad_id', `eq.${filtros.universidad}`);
  if (filtros.campus) parametros.set('campus_id', `eq.${filtros.campus}`);
  for (const [operador, valor] of [['gte', filtros.precioMinimoCentimos], ['lte', filtros.precioMaximoCentimos]]) {
    if (valor !== null) parametros.append('precio_centimos', `${operador}.${valor}`);
  }
  url.search = parametros.toString();
  return url;
}

function enteroDeRest(valor) {
  if (typeof valor === 'number') return Number.isSafeInteger(valor) ? valor : null;
  if (typeof valor !== 'string' || !/^\d{1,16}$/.test(valor)) return null;
  const entero = Number(valor);
  return Number.isSafeInteger(entero) ? entero : null;
}

function fechaUtc(valor) {
  if (typeof valor !== 'string') return null;
  const partes = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(valor);
  if (!partes) return null;
  const [, fecha, fraccion = '', zona] = partes;
  const local = new Date(fecha + 'Z');
  const utc = new Date(fecha + zona);
  if (!Number.isFinite(utc.getTime()) || !Number.isFinite(local.getTime())
    || local.toISOString().slice(0, 19) !== fecha) return null;
  return utc.toISOString().replace(/\.000Z$/, fraccion + 'Z');
}

function normalizarImagen(fila, origen) {
  const { imagen_bucket: bucket, imagen_ruta: ruta, imagen_url: url, imagen_formato: formato,
    imagen_ancho: ancho, imagen_alto: alto } = fila;
  const bytes = enteroDeRest(fila.imagen_bytes);
  if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(bucket)
    || typeof ruta !== 'string' || ruta.length > 500
    || typeof formato !== 'string' || !Object.hasOwn(EXTENSIONES_IMAGEN, formato)
    || !enteroPositivo(bytes) || !enteroPositivo(ancho) || !enteroPositivo(alto)) return null;
  const archivo = /^([0-9a-f-]+)\/[A-Za-z0-9_-]+\.([a-z]+)$/.exec(ruta);
  if (!archivo || archivo[1] !== fila.vendedor_id.toLowerCase()
    || !EXTENSIONES_IMAGEN[formato].includes(archivo[2])) return null;

  if (url === null) {
    if (bucket !== 'articulos' || bytes > 2097152) return null;
    return { proveedor: 'supabase', acceso: 'privado', bucket, ruta, formato, bytes, ancho, alto };
  }

  // El origen HTTPS ya está validado. Comparar el texto evita normalizar segmentos de la ruta.
  const urlEsperada = `${origen}/storage/v1/object/public/${bucket}/${ruta}`;
  if (url !== urlEsperada || CONTROLES.test(url)) return null;
  return { proveedor: 'supabase', bucket, ruta, url, formato, bytes, ancho, alto };
}

function normalizarArticulo(fila, origen) {
  if (!fila || ![fila.id, fila.vendedor_id, fila.categoria_id, fila.campus_id].every(esId)
    || !textoValido(fila.titulo, 100) || CONTROLES.test(fila.titulo) || !textoValido(fila.descripcion, 1000)
    || !CONDICIONES.includes(fila.condicion) || !ESTADOS.includes(fila.estado)
    || fila.moneda !== 'PEN' || !enteroPositivo(fila.version)) {
    return fallo('RESPUESTA_INVALIDA', 'El catálogo devolvió un artículo incompatible.');
  }
  const creadoEn = fechaUtc(fila.creado_en);
  const actualizadoEn = fechaUtc(fila.actualizado_en);
  if (!creadoEn || !actualizadoEn) return fallo('RESPUESTA_INVALIDA', 'El artículo tiene fechas incompatibles.');

  const precioCentimos = enteroDeRest(fila.precio_centimos);
  if (!enteroPositivo(precioCentimos)) {
    return fallo('RESPUESTA_INVALIDA', 'El artículo tiene un precio inválido o fuera del rango seguro.');
  }
  const imagen = normalizarImagen(fila, origen);
  if (!imagen) return fallo('RESPUESTA_INVALIDA', 'El artículo tiene una fotografía inválida.');

  return exito({
    id: fila.id, vendedorId: fila.vendedor_id, titulo: fila.titulo, descripcion: fila.descripcion,
    categoriaId: fila.categoria_id, condicion: fila.condicion, precioCentimos, moneda: fila.moneda,
    campusId: fila.campus_id, estado: fila.estado, creadoEn, actualizadoEn, version: fila.version, imagen,
  });
}

function errorHttp(status) {
  if (status === 401 || status === 403) return fallo('NO_AUTORIZADO', 'El servidor denegó el acceso al catálogo.');
  if (status === 429) return fallo('LIMITE', 'El servicio alcanzó su límite. Espera antes de reintentar.');
  return fallo('SERVIDOR', 'El servidor no pudo completar la consulta del catálogo.');
}

function errorSesion(error) {
  if (error?.status === 429) return errorHttp(429);
  if (error?.name === 'AuthRetryableFetchError') return fallo('RED', 'No se pudo recuperar la sesión.');
  if (error?.status >= 500) return fallo('SERVIDOR', 'No se pudo recuperar la sesión.');
  return fallo('NO_AUTORIZADO', 'Se requiere una sesión válida para consultar el catálogo.');
}

export async function consultarCatalogo(filtros, opciones = {}) {
  const { signal } = opciones;
  signal?.throwIfAborted();
  if (!filtrosValidos(filtros)) return fallo('VALIDACION', 'Revisa los filtros del catálogo.');

  const configuracion = validarConfiguracionPublica();
  if (!configuracion.ok) return configuracion;
  const { supabaseUrl, supabasePublishableKey } = configuracion.datos;
  const cliente = await obtenerClienteSupabase();
  signal?.throwIfAborted();
  if (!cliente.ok) return cliente;

  // Las funciones públicas de Auth devuelven datos reducidos. El mismo SDK
  // recupera o renueva la sesión y PostgREST comprueba el token y los permisos.
  let sesion;
  try {
    sesion = await cliente.datos.auth.getSession();
  } catch (error) {
    signal?.throwIfAborted();
    return errorSesion(error);
  }
  signal?.throwIfAborted();
  const token = sesion?.data?.session?.access_token;
  if (sesion?.error || typeof token !== 'string' || !token.trim()) return errorSesion(sesion?.error);

  let respuesta;
  try {
    respuesta = await fetch(consultaRest(supabaseUrl, filtros), {
      method: 'GET',
      headers: { Accept: 'application/json', apikey: supabasePublishableKey, Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal,
    });
  } catch (error) {
    signal?.throwIfAborted();
    if (error?.name === 'AbortError') throw error;
    return fallo('RED', 'No se pudo conectar al catálogo.');
  }
  signal?.throwIfAborted();
  if (!respuesta || typeof respuesta.ok !== 'boolean'
    || (respuesta.ok && typeof respuesta.json !== 'function')) {
    return fallo('RESPUESTA_INVALIDA', 'El catálogo devolvió una respuesta inesperada.');
  }
  if (!respuesta.ok) return errorHttp(respuesta.status);

  let filas;
  try {
    filas = await respuesta.json();
  } catch (error) {
    signal?.throwIfAborted();
    if (error?.name === 'AbortError') throw error;
    if (error instanceof TypeError) return fallo('RED', 'No se pudo leer la respuesta del catálogo.');
    return fallo('RESPUESTA_INVALIDA', 'El catálogo devolvió JSON inválido.');
  }
  signal?.throwIfAborted();
  if (!Array.isArray(filas) || filas.length > LIMITE_INICIAL) {
    return fallo('RESPUESTA_INVALIDA', 'El catálogo devolvió una respuesta inesperada.');
  }
  const articulos = [];
  const ids = new Set();
  for (const fila of filas) {
    const resultado = normalizarArticulo(fila, supabaseUrl);
    if (!resultado.ok) return resultado;
    const id = resultado.datos.id.toLowerCase();
    if (ids.has(id)) return fallo('RESPUESTA_INVALIDA', 'El catálogo devolvió artículos repetidos.');
    ids.add(id);
    articulos.push(resultado.datos);
  }
  return exito(articulos);
}
