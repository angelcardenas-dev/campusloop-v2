import { consultarMiPerfil } from './perfiles.js';
import { obtenerClienteSupabase } from './supabase-cliente.js';
import { validarConfiguracionPublica } from './config-publica.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERRORES = {
  VALIDACION: 'Revisa los datos enviados.',
  NO_AUTORIZADO: 'La sesión no puede realizar esta operación.',
  NO_ENCONTRADO: 'No encontramos el recurso solicitado.',
  CONFLICTO: 'El recurso cambió o su estado impide la operación.',
  YA_ACTIVADO: 'La capacidad de vendedor ya está activa.',
  SOLICITUD_PENDIENTE: 'Ya existe una solicitud pendiente.',
  RED: 'No pudimos conectar con el servicio.',
  LIMITE: 'Espera antes de volver a intentarlo.',
  SERVIDOR: 'No pudimos completar la operación.',
};
const exito = datos => ({ ok: true, datos, error: null });
const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: ERRORES[codigo] } });
const idValido = valor => typeof valor === 'string' && UUID.test(valor);

function errorOperacion(error, status = error?.status) {
  const http = Number(status);
  if (error?.code === '42501' || http === 401 || http === 403) return fallo('NO_AUTORIZADO');
  if (error?.code === '22023' || error?.code === '22P02') return fallo('VALIDACION');
  if (error?.code === 'PT404' || http === 404) return fallo('NO_ENCONTRADO');
  if (error?.code === 'PT409' || http === 409) {
    const codigo = ['YA_ACTIVADO', 'SOLICITUD_PENDIENTE'].includes(error?.message) ? error.message : 'CONFLICTO';
    return fallo(codigo);
  }
  if (http === 429) return fallo('LIMITE');
  if (http === 0 || error instanceof TypeError) return fallo('RED');
  return fallo('SERVIDOR');
}

async function ejecutarRPC(nombre, parametros) {
  try {
    const sdk = await obtenerClienteSupabase();
    if (!sdk.ok) return sdk;
    const resultado = await sdk.datos.rpc(nombre, parametros);
    if (resultado.error) return errorOperacion(resultado.error, resultado.status);
    return resultado.data == null ? fallo('SERVIDOR') : exito(resultado.data);
  } catch (error) {
    return errorOperacion(error);
  }
}

export function enviarSolicitudVendedor({ claveIdempotencia, tieneExperiencia, aceptaNormas, normasVersion } = {}) {
  return ejecutarRPC('enviar_solicitud_vendedor', {
    p_clave_idempotencia: claveIdempotencia, p_tiene_experiencia: tieneExperiencia,
    p_acepta_normas: aceptaNormas, p_normas_version: normasVersion,
  });
}
export function consultarMisSolicitudes({ limite = 20, cursor } = {}) {
  return ejecutarRPC('consultar_mis_solicitudes', {
    p_limite: limite, p_antes_de: cursor?.enviadaEn ?? null, p_antes_id: cursor?.id ?? null,
  });
}
export async function consultarEstadoVendedor({ signal } = {}) {
  if (signal?.aborted) return fallo('RED');
  const perfil = await consultarMiPerfil();
  if (signal?.aborted) return fallo('RED');
  if (!perfil.ok) return perfil;
  if (perfil.datos.vendedorActivado) return exito({ estado: 'APROBADO' });
  const solicitudes = await consultarMisSolicitudes({ limite: 1 });
  if (signal?.aborted) return fallo('RED');
  if (!solicitudes.ok) return solicitudes;
  if (!Array.isArray(solicitudes.datos)) return fallo('SERVIDOR');
  const estado = solicitudes.datos[0]?.estado ?? 'no_solicitado';
  if (!['no_solicitado', 'pendiente', 'rechazado'].includes(estado)) return fallo('SERVIDOR');
  return exito({ estado: estado.toUpperCase() });
}
export function consultarSolicitudesRevision({ limite = 20, cursor } = {}) {
  return ejecutarRPC('consultar_solicitudes_revision', {
    p_limite: limite, p_despues_de: cursor?.responderAntesDe ?? null, p_despues_id: cursor?.id ?? null,
  });
}
export function decidirSolicitudVendedor({ solicitudId, versionEsperada, decision, motivo } = {}) {
  return ejecutarRPC('decidir_solicitud_vendedor', {
    p_solicitud_id: solicitudId, p_version_esperada: versionEsperada, p_decision: decision, p_motivo: motivo,
  });
}
export function consultarMisNotificaciones({ limite = 20, soloNoLeidas = false, cursor } = {}) {
  return ejecutarRPC('consultar_mis_notificaciones', {
    p_limite: limite, p_solo_no_leidas: soloNoLeidas,
    p_antes_de: cursor?.creadaEn ?? null, p_antes_id: cursor?.id ?? null,
  });
}
export function marcarNotificacionLeida(id) {
  return ejecutarRPC('marcar_notificacion_leida', { p_notificacion_id: id });
}
export async function crearMiArticulo({ claveIdempotencia, titulo, descripcion, categoriaId, condicion,
  precioCentimos, moneda = 'PEN', campusId, imagen } = {}) {
  if (!idValido(claveIdempotencia) || !idValido(categoriaId) || !idValido(campusId)
    || moneda !== 'PEN' || !Number.isSafeInteger(precioCentimos) || precioCentimos <= 0
    || imagen?.proveedor !== 'supabase' || imagen.bucket !== 'articulos'
    || typeof imagen.ruta !== 'string' || imagen.ruta.length > 500) return fallo('VALIDACION');
  return ejecutarRPC('crear_mi_articulo', {
    p_clave: claveIdempotencia, p_titulo: titulo, p_descripcion: descripcion,
    p_categoria_id: categoriaId, p_condicion: condicion, p_precio_centimos: precioCentimos,
    p_campus_id: campusId, p_ruta: imagen.ruta,
  });
}
export async function editarMiArticulo({ id, versionEsperada, titulo, descripcion, categoriaId, condicion, precioCentimos } = {}) {
  if (!Number.isSafeInteger(precioCentimos) || precioCentimos <= 0) return fallo('VALIDACION');
  return ejecutarRPC('editar_o_retirar_mi_articulo', {
    p_id: id, p_version: versionEsperada, p_retirar: false, p_titulo: titulo,
    p_descripcion: descripcion, p_categoria_id: categoriaId, p_condicion: condicion, p_precio_centimos: precioCentimos,
  });
}
export function retirarMiArticulo({ id, versionEsperada } = {}) {
  return ejecutarRPC('editar_o_retirar_mi_articulo', { p_id: id, p_version: versionEsperada, p_retirar: true });
}

const FORMATOS = {
  'image/jpeg': /\.(?:jpg|jpeg)$/,
  'image/png': /\.png$/,
  'image/webp': /\.webp$/,
};
const TTL_SEGUNDOS = 60;

export async function resolverFotoPrivada(id, { signal } = {}) {
  if (!idValido(id)) return fallo('VALIDACION');
  if (signal?.aborted) return fallo('RED');
  try {
    const configuracion = validarConfiguracionPublica();
    if (!configuracion.ok) return configuracion;
    const sdk = await obtenerClienteSupabase();
    if (!sdk.ok) return sdk;
    let consulta = sdk.datos.from('articulos').select(
      'vendedor_id,imagen_bucket,imagen_ruta,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto',
    ).eq('id', id);
    if (signal) consulta = consulta.abortSignal(signal);
    const { data: foto, error, status } = await consulta.maybeSingle();
    if (error) return errorOperacion(error, status);
    if (signal?.aborted) return fallo('RED');
    if (!foto) return fallo('NO_ENCONTRADO');
    const { vendedor_id: vendedor, imagen_ruta: ruta, imagen_formato: formato, imagen_bytes: bytes } = foto;
    if (!idValido(vendedor) || foto.imagen_bucket !== 'articulos' || typeof ruta !== 'string' || ruta.length > 500
      || !ruta.startsWith(vendedor + '/') || !/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(ruta.slice(vendedor.length + 1))
      || !Object.hasOwn(FORMATOS, formato) || !FORMATOS[formato].test(ruta)
      || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 2097152
      || ![foto.imagen_ancho, foto.imagen_alto].every(n => Number.isInteger(n) && n > 0)) return fallo('SERVIDOR');

    const expiraEn = new Date(Date.now() + TTL_SEGUNDOS * 1000).toISOString();
    const firma = await sdk.datos.storage.from('articulos').createSignedUrl(ruta, TTL_SEGUNDOS);
    if (signal?.aborted) return fallo('RED');
    if (firma.error) return errorOperacion(firma.error);
    const url = new URL(firma.data.signedUrl);
    const tokens = url.searchParams.getAll('token');
    if (url.origin !== configuracion.datos.supabaseUrl || url.username || url.password || url.hash
      || url.pathname !== '/storage/v1/object/sign/articulos/' + ruta || tokens.length !== 1 || !tokens[0]
      || [...url.searchParams.keys()].length !== 1) return fallo('SERVIDOR');
    return exito({ url: url.href, expiraEn });
  } catch (error) {
    return errorOperacion(error);
  }
}
