import { obtenerClienteSupabase } from './supabase-cliente.js';
import { escucharCambiosAuth } from './auth.js';

/* Datos */
// Interruptor de preparación. El servidor conserva sus propios controles.
const IA_HABILITADA = false;
const RUTA_ASISTENTE = '/api/asistente';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENSAJES = Object.freeze({
  VALIDACION: 'Revisa los datos del artículo y los límites de texto.',
  CONTEXTO_INSUFICIENTE: 'Añade el nombre y características concretas del artículo.',
  IA_DESHABILITADA: 'El asistente todavía no está habilitado. Puedes redactar manualmente.',
  CONFIGURACION: 'El asistente no está configurado para completar esta operación.',
  CONTROLES_NO_DISPONIBLES: 'Los controles de acceso y consumo todavía no están disponibles.',
  ORIGEN_NO_PERMITIDO: 'El asistente no está disponible desde este origen.',
  CUERPO_GRANDE: 'Reduce el contexto del artículo antes de volver a solicitar una sugerencia.',
  TIPO_NO_PERMITIDO: 'El asistente recibió un formato de solicitud incompatible.',
  METODO_NO_PERMITIDO: 'El asistente recibió una operación incompatible.',
  NO_AUTORIZADO: 'Inicia sesión para solicitar una sugerencia.',
  NO_VENDEDOR: 'Necesitas un perfil vendedor activado para usar el asistente.',
  LIMITE: 'Se alcanzó el límite de uso. Conserva tu texto y vuelve más tarde.',
  RED: 'No pudimos conectar con el asistente. Tu formulario se conserva.',
  TIEMPO_AGOTADO: 'El asistente tardó demasiado. Tu formulario se conserva.',
  RESPUESTA_INVALIDA: 'La sugerencia no cumple el contrato. Revisa o redacta el artículo manualmente.',
  CANCELADO: 'La solicitud fue cancelada; no se aplicaron cambios.',
  CONFLICTO: 'La solicitud o el formulario cambiaron. Genera y revisa una nueva sugerencia.',
  SERVIDOR: 'El asistente no pudo completar la operación. Puedes continuar manualmente.',
});
const conexiones = new WeakMap();
const CODIGOS_HTTP = Object.freeze({
  400: ['VALIDACION', 'CONTEXTO_INSUFICIENTE'], 401: ['NO_AUTORIZADO'],
  403: ['NO_VENDEDOR', 'ORIGEN_NO_PERMITIDO'], 405: ['METODO_NO_PERMITIDO'],
  408: ['CANCELADO'], 409: ['CONFLICTO'], 413: ['CUERPO_GRANDE'], 415: ['TIPO_NO_PERMITIDO'],
  429: ['LIMITE'], 502: ['RESPUESTA_INVALIDA', 'SERVIDOR'],
  503: ['IA_DESHABILITADA', 'CONFIGURACION', 'CONTROLES_NO_DISPONIBLES'], 504: ['TIEMPO_AGOTADO'],
});
const exito = datos => ({ ok: true, datos, error: null });
const fallo = codigo => ({ ok: false, datos: null, error: {
  codigo: Object.hasOwn(MENSAJES, codigo) ? codigo : 'SERVIDOR',
  mensaje: Object.hasOwn(MENSAJES, codigo) ? MENSAJES[codigo] : MENSAJES.SERVIDOR,
} });

/* Funciones */
class FalloAsistente extends Error {
  constructor(codigo) { super('Operación del asistente no completada'); this.codigo = codigo; }
}
const clavesExactas = (valor, claves) => valor !== null && typeof valor === 'object'
  && !Array.isArray(valor) && Object.keys(valor).length === claves.length
  && claves.every(clave => Object.hasOwn(valor, clave));
const texto = (valor, maximo, vacio = false, multilinea = false) => typeof valor === 'string'
  && (vacio || valor.trim().length > 0) && Array.from(valor).length <= maximo
  && !(multilinea ? /[\u0000-\u0008\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(valor);
const revisionValida = valor => Number.isSafeInteger(valor) && valor >= 0;
const copiar = valor => JSON.parse(JSON.stringify(valor));

function validarSolicitud(datos) {
  if (!clavesExactas(datos, ['schemaVersion', 'solicitudId', 'revisionFormulario', 'operacion', 'articulo'])
    || datos.schemaVersion !== 1 || typeof datos.solicitudId !== 'string' || !UUID.test(datos.solicitudId) || !revisionValida(datos.revisionFormulario)
    || datos.operacion !== 'proponer_publicacion') return fallo('VALIDACION');
  const a = datos.articulo;
  if (!clavesExactas(a, ['tituloActual', 'descripcionActual', 'categoriaId', 'condicion', 'caracteristicas'])
    || !texto(a.tituloActual, 100, true) || !texto(a.descripcionActual, 1000, true, true)
    || !(a.categoriaId === null || (typeof a.categoriaId === 'string' && UUID.test(a.categoriaId)))
    || !texto(a.condicion, 80) || !Array.isArray(a.caracteristicas) || a.caracteristicas.length > 10
    || !Array.from(a.caracteristicas).every(valor => texto(valor, 150))) return fallo('VALIDACION');
  const fuentes = [a.tituloActual, a.descripcionActual, ...a.caracteristicas].filter(valor => valor.trim());
  if (fuentes.length < 2) return fallo('CONTEXTO_INSUFICIENTE');
  // Minimización: no enviar contactos, enlaces ni posibles credenciales.
  const contexto = [a.tituloActual, a.descripcionActual, a.condicion, ...a.caracteristicas].join('\n');
  if (/[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/|\b(?:sb_secret_|sb_publishable_|eyJ)[A-Za-z0-9_-]{10,}/i.test(contexto)) return fallo('VALIDACION');
  return exito(copiar(datos));
}

function sugerenciasValidas(valor) {
  return clavesExactas(valor, ['titulo', 'descripcion'])
    && texto(valor.titulo, 100) && texto(valor.descripcion, 1000, false, true);
}

async function obtenerTokenSesion() {
  const proveedor = await obtenerClienteSupabase();
  if (!proveedor.ok) throw new FalloAsistente(proveedor.error?.codigo === 'RED' ? 'RED' : 'CONFIGURACION');
  const respuesta = await proveedor.datos.auth.getSession();
  if (respuesta.error) throw new FalloAsistente(respuesta.error.name === 'AuthRetryableFetchError' ? 'RED' : 'NO_AUTORIZADO');
  const sesion = respuesta.data?.session;
  if (!sesion?.access_token || !sesion.user?.id || sesion.user.is_anonymous === true) throw new FalloAsistente('NO_AUTORIZADO');
  // Solo memoria y cabecera HTTPS. El servidor debe verificar el token de nuevo.
  return sesion.access_token;
}

async function leerRespuesta(respuesta, signal) {
  if (!respuesta || typeof respuesta.ok !== 'boolean'
    || !/^application\/json(?:\s*;|$)/i.test(respuesta.headers?.get('content-type') ?? '')
    || !respuesta.body?.getReader) throw new FalloAsistente('RESPUESTA_INVALIDA');
  const lector = respuesta.body.getReader();
  const cancelar = () => { void lector.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancelar, { once: true });
  const partes = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new FalloAsistente('CANCELADO');
      const parte = await lector.read();
      if (parte.done) break;
      bytes += parte.value.byteLength;
      if (bytes > 16384) { cancelar(); throw new FalloAsistente('RESPUESTA_INVALIDA'); }
      partes.push(parte.value);
    }
    const contenido = new Uint8Array(bytes);
    let posicion = 0;
    for (const parte of partes) { contenido.set(parte, posicion); posicion += parte.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contenido));
  } catch (error) {
    if (error instanceof FalloAsistente) throw error;
    throw new FalloAsistente('RESPUESTA_INVALIDA');
  } finally {
    signal.removeEventListener('abort', cancelar);
    lector.releaseLock();
  }
}

// Factoría de aislamiento: no sustituir el cliente oficial en la aplicación.
export function crearServicioAsistente({
  habilitada = IA_HABILITADA,
  obtenerToken = obtenerTokenSesion,
  fetchImpl = (...args) => globalThis.fetch(...args),
  timeoutMs = 20000,
} = {}) {
  let activa = null;
  return async function solicitar(datos, opciones = {}) {
    if (!opciones || typeof opciones !== 'object' || Array.isArray(opciones)) return fallo('VALIDACION');
    const { signal } = opciones;
    const validacion = validarSolicitud(datos);
    if (!validacion.ok) return validacion;
    const solicitud = validacion.datos;
    const { revisionFormulario, ...cuerpo } = solicitud;
    const json = JSON.stringify(cuerpo);
    if (new TextEncoder().encode(json).byteLength > 8192) return fallo('VALIDACION');
    if (habilitada !== true) return fallo('IA_DESHABILITADA');
    if (activa && !activa.signal.aborted) return fallo('CONFLICTO');
    if (typeof obtenerToken !== 'function' || typeof fetchImpl !== 'function'
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) return fallo('CONFIGURACION');
    if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) return fallo('VALIDACION');
    if (signal?.aborted) return fallo('CANCELADO');
    const controlador = new AbortController();
    let interrupcion;
    let rechazar;
    const interrumpida = new Promise((_, reject) => { rechazar = reject; });
    const interrumpir = codigo => {
      if (interrupcion) return;
      interrupcion = codigo;
      controlador.abort();
      rechazar(new FalloAsistente(codigo));
    };
    const cancelar = () => interrumpir('CANCELADO');
    const temporizador = setTimeout(() => interrumpir('TIEMPO_AGOTADO'), timeoutMs);
    signal?.addEventListener('abort', cancelar, { once: true });
    activa = controlador;
    async function ejecutar() {
      const token = await obtenerToken();
      if (controlador.signal.aborted) throw new FalloAsistente('CANCELADO');
      if (typeof token !== 'string' || !/^[A-Za-z0-9._~-]{1,8192}$/.test(token)) throw new FalloAsistente('NO_AUTORIZADO');
      let respuesta;
      try {
        respuesta = await fetchImpl(RUTA_ASISTENTE, {
          method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: json, signal: controlador.signal,
        });
      } catch { throw new FalloAsistente('RED'); }
      const jsonRespuesta = await leerRespuesta(respuesta, controlador.signal);
      if (!respuesta.ok) {
        if (!clavesExactas(jsonRespuesta, ['solicitudId', 'codigo', 'mensaje'])
          || !(jsonRespuesta.solicitudId === null || jsonRespuesta.solicitudId === solicitud.solicitudId)
          || !texto(jsonRespuesta.mensaje, 200)
          || !CODIGOS_HTTP[respuesta.status]?.includes(jsonRespuesta.codigo)) throw new FalloAsistente('RESPUESTA_INVALIDA');
        // Mensaje local fijo: nunca reflejar el texto crudo del servidor.
        throw new FalloAsistente(jsonRespuesta.codigo);
      }
      if (!clavesExactas(jsonRespuesta, ['solicitudId', 'sugerencias'])
        || jsonRespuesta.solicitudId !== solicitud.solicitudId || !sugerenciasValidas(jsonRespuesta.sugerencias)) throw new FalloAsistente('RESPUESTA_INVALIDA');
      return exito({ ...copiar(jsonRespuesta), revisionFormulario });
    }
    try { return await Promise.race([ejecutar(), interrumpida]); }
    catch (error) { return fallo(interrupcion ?? (error instanceof FalloAsistente ? error.codigo : 'SERVIDOR')); }
    finally {
      clearTimeout(temporizador);
      signal?.removeEventListener('abort', cancelar);
      if (activa === controlador) activa = null;
    }
  };
}

export const solicitarSugerencia = crearServicioAsistente();

/* Eventos */
// Puente optativo; no se conecta al document ni consulta Auth al importar.
export function conectarAsistente({
  destino, servicio = solicitarSugerencia, escucharAuth = escucharCambiosAuth,
  habilitada = IA_HABILITADA,
} = {}) {
  if (!destino?.addEventListener || !destino?.dispatchEvent || !destino?.removeEventListener
    || conexiones.has(destino)) throw new TypeError('Se requiere un destino de eventos sin otra conexión IA.');
  let revisionActual = null;
  let actual = null;
  let propuesta = null;
  let secuencia = 0;
  let cerrada = false;
  let usuarioAuth;
  const emitir = (nombre, detalle) => destino.dispatchEvent(new CustomEvent(nombre, { detail: copiar(detalle) }));
  function descartar() {
    const anterior = actual;
    secuencia++;
    actual?.controlador.abort();
    actual = null;
    propuesta = null;
    if (anterior && !cerrada) emitir('campusloop:ia-estado', {
      solicitudId: anterior.solicitudId, revisionFormulario: anterior.revisionFormulario, estado: 'descartado',
    });
  }
  async function alSolicitar(evento) {
    if (cerrada) return;
    const valida = validarSolicitud(evento.detail);
    if (!valida.ok) {
      emitir('campusloop:ia-estado', { solicitudId: null, estado: 'error', error: valida.error });
      return;
    }
    const datos = valida.datos;
    if (revisionActual !== null && datos.revisionFormulario < revisionActual) {
      emitir('campusloop:ia-estado', { solicitudId: datos.solicitudId, estado: 'error', error: fallo('CONFLICTO').error });
      return;
    }
    descartar();
    revisionActual = datos.revisionFormulario;
    const turno = ++secuencia;
    const controlador = new AbortController();
    actual = { solicitudId: datos.solicitudId, revisionFormulario: revisionActual, controlador };
    emitir('campusloop:ia-estado', { solicitudId: datos.solicitudId, revisionFormulario: revisionActual, estado: 'cargando' });
    let resultado;
    try { resultado = await servicio(datos, { signal: controlador.signal }); }
    catch { resultado = fallo('SERVIDOR'); }
    if (cerrada || turno !== secuencia || revisionActual !== datos.revisionFormulario) return;
    if (!resultado?.ok) {
      emitir('campusloop:ia-estado', { solicitudId: datos.solicitudId, revisionFormulario: revisionActual, estado: 'error', error: fallo(resultado?.error?.codigo).error });
      return;
    }
    if (resultado.datos?.solicitudId !== datos.solicitudId || !sugerenciasValidas(resultado.datos.sugerencias)) {
      emitir('campusloop:ia-estado', { solicitudId: datos.solicitudId, estado: 'error', error: fallo('RESPUESTA_INVALIDA').error });
      return;
    }
    propuesta = { solicitudId: datos.solicitudId, revisionFormulario: revisionActual,
      originales: { titulo: datos.articulo.tituloActual, descripcion: datos.articulo.descripcionActual },
      sugerencias: copiar(resultado.datos.sugerencias), aplicada: false };
    emitir('campusloop:ia-estado', { solicitudId: datos.solicitudId, revisionFormulario: revisionActual, estado: 'listo', sugerencias: propuesta.sugerencias });
  }
  const cancelarAuth = habilitada ? escucharAuth(notificacion => {
    if (notificacion.evento === 'SIGNED_OUT'
      || (usuarioAuth !== undefined && notificacion.usuario?.id !== usuarioAuth)) descartar();
    usuarioAuth = notificacion.usuario?.id ?? null;
  }) : () => {};
  const controlador = {
    actualizarRevision(revision) {
      if (cerrada || !revisionValida(revision) || (revisionActual !== null && revision < revisionActual)) return fallo('VALIDACION');
      if (revision !== revisionActual) descartar();
      revisionActual = revision;
      return exito(null);
    },
    obtenerPropuesta() { return propuesta ? copiar(propuesta) : null; },
    aceptar({ solicitudId, revisionFormulario, camposAceptados } = {}) {
      if (cerrada || !propuesta || propuesta.aplicada || propuesta.solicitudId !== solicitudId
        || propuesta.revisionFormulario !== revisionFormulario || revisionActual !== revisionFormulario) return fallo('CONFLICTO');
      if (!camposAceptados || typeof camposAceptados !== 'object' || Array.isArray(camposAceptados)
        || !Object.keys(camposAceptados).length || Object.keys(camposAceptados).some(clave => !['titulo', 'descripcion'].includes(clave))
        || (Object.hasOwn(camposAceptados, 'titulo') && !texto(camposAceptados.titulo, 100))
        || (Object.hasOwn(camposAceptados, 'descripcion') && !texto(camposAceptados.descripcion, 1000, false, true))) return fallo('VALIDACION');
      propuesta.aplicada = true;
      emitir('campusloop:ia-aplicar', { solicitudId, revisionFormulario, camposAceptados });
      return exito(null);
    },
    descartar,
    desconectar() {
      if (cerrada) return;
      cerrada = true;
      descartar();
      cancelarAuth();
      destino.removeEventListener('campusloop:ia-solicitar', alSolicitar);
      conexiones.delete(destino);
    },
  };
  destino.addEventListener('campusloop:ia-solicitar', alSolicitar);
  conexiones.set(destino, controlador);
  return controlador;
}
