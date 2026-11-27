import { obtenerClienteSupabase } from './supabase-cliente.js';
import { validarConfiguracionPublica } from './config-publica.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERRORES = {
  CONFIGURACION: 'El servicio de fotografías aún no está configurado.',
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
  if (error?.codigo === 'CONFIGURACION') return fallo('CONFIGURACION');
  if (http === 400 || error?.code === '22023' || error?.code === '22P02') return fallo('VALIDACION');
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

function escribirRPC(nombre, parametros, actorEsperado) {
  if (!idValido(actorEsperado)) return Promise.resolve(fallo('NO_AUTORIZADO'));
  return ejecutarRPC(nombre, { ...parametros, p_actor_esperado: actorEsperado });
}
export function enviarSolicitudVendedor({ claveIdempotencia, tieneExperiencia, aceptaNormas, normasVersion } = {}, { actorEsperado } = {}) {
  return escribirRPC('enviar_solicitud_vendedor', {
    p_clave_idempotencia: claveIdempotencia, p_tiene_experiencia: tieneExperiencia,
    p_acepta_normas: aceptaNormas, p_normas_version: normasVersion,
  }, actorEsperado);
}
export function consultarNormasVendedor() {
  return ejecutarRPC('consultar_normas_vendedor', {});
}

export function consultarMisSolicitudes({ limite = 20, cursor } = {}) {
  return ejecutarRPC('consultar_mis_solicitudes', {
    p_limite: limite, p_antes_de: cursor?.enviadaEn ?? null, p_antes_id: cursor?.id ?? null,
  });
}
export async function consultarEstadoVendedor({ signal } = {}) {
  if (signal?.aborted) return fallo('RED');
  try {
    const sdk = await obtenerClienteSupabase();
    if (!sdk.ok) return sdk;
    const identidad = async () => {
      const { data, error } = await sdk.datos.auth.getUser();
      return !error && data?.user?.is_anonymous === false && idValido(data.user.id) ? data.user.id.toLowerCase() : null;
    };
    const actor = await identidad();
    if (!actor || signal?.aborted) return fallo('NO_AUTORIZADO');
    const resultado = await sdk.datos.rpc('consultar_estado_vendedor_tb4', { p_actor_esperado: actor });
    if (signal?.aborted) return fallo('RED');
    if (resultado.error) return errorOperacion(resultado.error, resultado.status);
    if (resultado.data?.actorId !== actor
      || !['APROBADO', 'PENDIENTE', 'RECHAZADO', 'NO_SOLICITADO'].includes(resultado.data.estado)) return fallo('SERVIDOR');
    if (await identidad() !== actor || signal?.aborted) return fallo('NO_AUTORIZADO');
    return exito({ estado: resultado.data.estado });
  } catch (error) { return errorOperacion(error); }
}
export function consultarSolicitudesRevision({ limite = 20, cursor } = {}) {
  return ejecutarRPC('consultar_solicitudes_revision', {
    p_limite: limite, p_despues_de: cursor?.responderAntesDe ?? null, p_despues_id: cursor?.id ?? null,
  });
}
export function decidirSolicitudVendedor({ solicitudId, versionEsperada, decision, motivo } = {}, { actorEsperado } = {}) {
  return escribirRPC('decidir_solicitud_vendedor', {
    p_solicitud_id: solicitudId, p_version_esperada: versionEsperada, p_decision: decision, p_motivo: motivo,
  }, actorEsperado);
}
export function consultarMisNotificaciones({ limite = 20, soloNoLeidas = false, cursor } = {}) {
  return ejecutarRPC('consultar_mis_notificaciones', {
    p_limite: limite, p_solo_no_leidas: soloNoLeidas,
    p_antes_de: cursor?.creadaEn ?? null, p_antes_id: cursor?.id ?? null,
  });
}
export function marcarNotificacionLeida(id, { actorEsperado } = {}) {
  return escribirRPC('marcar_notificacion_leida', { p_notificacion_id: id }, actorEsperado);
}
export async function crearMiArticulo({ claveIdempotencia, titulo, descripcion, categoriaId, condicion,
  precioCentimos, moneda = 'PEN', campusId, imagen } = {}, { actorEsperado } = {}) {
  if (!idValido(claveIdempotencia) || !idValido(categoriaId) || !idValido(campusId)
    || moneda !== 'PEN' || !Number.isSafeInteger(precioCentimos) || precioCentimos <= 0
    || imagen?.proveedor !== 'supabase' || imagen.bucket !== 'articulos'
    || typeof imagen.ruta !== 'string' || imagen.ruta.length > 500) return fallo('VALIDACION');
  return escribirRPC('crear_mi_articulo', {
    p_clave: claveIdempotencia, p_titulo: titulo, p_descripcion: descripcion,
    p_categoria_id: categoriaId, p_condicion: condicion, p_precio_centimos: precioCentimos,
    p_campus_id: campusId, p_ruta: imagen.ruta,
  }, actorEsperado);
}
export async function editarMiArticulo({ id, versionEsperada, titulo, descripcion, categoriaId, condicion, precioCentimos } = {}, { actorEsperado } = {}) {
  if (!Number.isSafeInteger(precioCentimos) || precioCentimos <= 0) return fallo('VALIDACION');
  return escribirRPC('editar_o_retirar_mi_articulo', {
    p_id: id, p_version: versionEsperada, p_retirar: false, p_titulo: titulo,
    p_descripcion: descripcion, p_categoria_id: categoriaId, p_condicion: condicion, p_precio_centimos: precioCentimos,
  }, actorEsperado);
}
export function retirarMiArticulo({ id, versionEsperada } = {}, { actorEsperado } = {}) {
  return escribirRPC('editar_o_retirar_mi_articulo', { p_id: id, p_version: versionEsperada, p_retirar: true }, actorEsperado);
}

async function consultarServidorFotos(datos, signal) {
  if (signal?.aborted) return fallo('RED');
  try {
    const sdk = await obtenerClienteSupabase();
    if (!sdk.ok) return sdk;
    const sesion = await sdk.datos.auth.getSession();
    if (signal?.aborted) return fallo('RED');
    const token = sesion.data?.session?.access_token;
    const actor = sesion.data?.session?.user?.id;
    if (sesion.error || !idValido(actor) || typeof token !== 'string' || !token) return fallo('NO_AUTORIZADO');
    if (datos.actorEsperado && datos.actorEsperado !== actor) return fallo('NO_AUTORIZADO');
    const r = await fetch('/.netlify/functions/fotos-tb4', { method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...datos, actorEsperado: actor }),
    });
    const resultado = await r.json();
    if (signal?.aborted) return fallo('RED');
    if (!r.ok || resultado?.ok !== true) return errorOperacion(resultado?.error, r.status);
    return exito(resultado.datos);
  } catch (error) {
    return signal?.aborted ? fallo('RED') : errorOperacion(error);
  }
}

export async function verificarMiFoto({ ruta, actorEsperado } = {}, { signal } = {}) {
  if (!idValido(actorEsperado)) return fallo('NO_AUTORIZADO');
  if (typeof ruta !== 'string' || ruta.length > 500 || !ruta.startsWith(actorEsperado + '/')) return fallo('VALIDACION');
  return consultarServidorFotos({ accion: 'verificar', ruta, actorEsperado }, signal);
}

export function reemplazarMiFoto({ id, versionEsperada, claveIdempotencia, ruta } = {}, { actorEsperado } = {}) {
  return escribirRPC('reemplazar_mi_foto', {
    p_id: id, p_version: versionEsperada, p_clave: claveIdempotencia, p_ruta: ruta,
  }, actorEsperado);
}

export async function resolverFotoPrivada(id, { signal } = {}) {
  if (!idValido(id)) return fallo('VALIDACION');
  const configuracion = validarConfiguracionPublica();
  if (!configuracion.ok) return configuracion;
  const resultado = await consultarServidorFotos({ accion: 'firmar', articuloId: id }, signal);
  if (!resultado.ok) return resultado;
  try {
    const { url: firma, expiraEn } = resultado.datos;
    const url = new URL(firma);
    const tokens = url.searchParams.getAll('token');
    if (url.origin !== configuracion.datos.supabaseUrl || url.username || url.password || url.hash
      || !/^\/storage\/v1\/object\/sign\/articulos\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/.test(url.pathname)
      || tokens.length !== 1 || !tokens[0] || [...url.searchParams.keys()].length !== 1
      || !(Date.parse(expiraEn) > Date.now())) return fallo('SERVIDOR');
    return exito({ url: url.href, expiraEn });
  } catch {
    return fallo('SERVIDOR');
  }
}
