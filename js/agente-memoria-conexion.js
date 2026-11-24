import { obtenerUsuarioActual, escucharCambiosAuth } from './auth.js';
import { validarConfiguracionPublica } from './config-publica.js';
import { crearAlmacenamientoLocal } from './localstorage.js';
import { crearClaveMemoria } from './agente-memoria.js';
import { crearAdaptadorStorageAgente } from './agente-storage-adaptador.js';
import { crearCoordinadorMemoria } from './agente-memoria-coordinador.js';

/* Preparación D1.3B. Sin autorización/política/productor explícitos no hay Auth ni IO.
   El consentimiento es efímero, no se inventa una preferencia persistente. */
const conexiones = new WeakMap();
export function conectarMemoriaAgente({ widget, autorizada = false, politica = null, producirContexto,
  categoriasPermitidas = [], ahora = Date.now, almacenamiento, auth } = {}) {
  if (conexiones.has(widget)) return conexiones.get(widget);
  const oficial = auth == null;
  auth ??= { obtenerUsuarioActual, escucharCambiosAuth };
  let disponible = autorizada === true && politica !== null && typeof producirContexto === 'function'
    && typeof auth.obtenerUsuarioActual === 'function' && typeof auth.escucharCambiosAuth === 'function'
    && (!oficial || validarConfiguracionPublica().ok);
  let viva = true, consentido = false, actor = null, generacion = 0, coordinador = null;
  let tuvoIdentidad = false;
  const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: 'La memoria no está disponible para esta operación.' } });
  widget.prepararConsentimientoMemoria({ disponible });
  widget.presentarMemoria({ estado: disponible ? 'sin-consentimiento' : 'inactiva' });
  const compartido = disponible ? crearAlmacenamientoLocal({ ...(almacenamiento !== undefined ? { almacenamiento } : {}),
    ahora, memoriaAgente: { politica, categoriasPermitidas } }) : null;
  const puerto = crearAdaptadorStorageAgente({ almacenamiento: compartido, obtenerActor: () => consentido ? actor : null });

  function revocar(privacidad = false, estado = 'sin-consentimiento') {
    generacion++; consentido = false; actor = null;
    const teniaCoordinador = coordinador !== null;
    coordinador?.desmontar({ limpiarWidget: privacidad }); coordinador = null;
    if (privacidad && !teniaCoordinador) widget.limpiarPorIdentidad();
    if (viva) {
      widget.prepararConsentimientoMemoria({ disponible }); widget.presentarMemoria({ estado });
    }
  }
  async function identidad({ signal }) {
    const turno = generacion;
    try {
      if (!viva || !consentido) throw new Error();
      const r = await auth.obtenerUsuarioActual();
      signal.throwIfAborted();
      if (!viva || !consentido || turno !== generacion) throw new Error();
      if (r?.ok !== true) { revocar(true, 'error'); throw new Error(); }
      if (r.datos === null) { revocar(true, 'sin-sesion'); throw new Error(); }
      if (!crearClaveMemoria(r.datos?.id).ok) { revocar(true, 'error'); throw new Error(); }
      const siguiente = r.datos.id.toLowerCase();
      if (actor !== null && actor !== siguiente) { revocar(true); throw new Error(); }
      actor = siguiente; tuvoIdentidad = true;
      return { id: siguiente }; // Nunca entregar correo, sesión ni tokens al dominio.
    } catch {
      if (viva && consentido && turno === generacion && !signal.aborted) revocar(true, 'error');
      throw new Error('No se pudo verificar la identidad.');
    }
  }
  async function ejecutar(tipo) {
    if (!viva) return fallo('CANCELADA');
    if (!disponible || !consentido || !coordinador) return fallo('CONFIGURACION');
    return coordinador[tipo]();
  }
  const cancelarAcciones = widget.escucharAccionesMemoria(accion => {
    if (accion === 'desmontar') return desmontar();
    if (accion === 'revocar') return revocar();
    if (accion !== 'consentir' || !disponible || !viva || consentido) return;
    consentido = true;
    coordinador = crearCoordinadorMemoria({ widget, obtenerIdentidad: identidad, almacenamiento: puerto,
      producirContexto, categoriasPermitidas, politica, ahora });
    return coordinador.restaurar();
  });
  // Una sola suscripción; nunca se utilizan sus datos como identidad verificada.
  let cancelarAuth = () => {};
  if (disponible) {
    try {
      const cancelar = auth.escucharCambiosAuth(notificacion => {
        if (!viva) return;
        try {
          const evento = notificacion?.evento;
          if (evento === 'SIGNED_OUT') { revocar(true); return; }
          if (!['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(evento)) throw new Error();
          const usuario = notificacion.usuario, id = usuario?.id;
          const sinSesion = evento === 'INITIAL_SESSION' && usuario === null;
          if (!sinSesion && !crearClaveMemoria(id).ok) throw new Error();
          if (notificacion.estado !== undefined
            && notificacion.estado !== (sinSesion ? 'NO_AUTENTICADO' : 'AUTENTICADO')) throw new Error();
          // El primer aviso no debe borrar un chat efímero todavía ajeno a Auth.
          // No extender esta excepción a datos de una identidad usada previamente.
          if (evento === 'INITIAL_SESSION' && !consentido && actor === null
            && coordinador === null && !tuvoIdentidad) return;
          // Coincidir con el actor YA verificado conserva la continuidad; el aviso
          // nunca asigna identidad y cada IO vuelve a verificarla mediante Auth.
          if (!sinSesion && actor !== null && id.toLowerCase() === actor) return;
          revocar(true);
        } catch { revocar(true, 'error'); }
      });
      if (typeof cancelar !== 'function') throw new Error();
      cancelarAuth = cancelar;
    } catch { disponible = false; revocar(true, 'error'); }
  }
  function desmontar() {
    if (!viva) return;
    viva = false; revocar(); cancelarAcciones();
    try { cancelarAuth(); } catch { /* La limpieza local continúa sin exponer el error del SDK. */ }
    conexiones.delete(widget);
  }
  const control = Object.freeze({ restaurar: () => ejecutar('restaurar'), actualizar: () => ejecutar('actualizar'),
    borrar: () => ejecutar('borrar'), invalidarIdentidad: () => { if (viva) revocar(true); }, desmontar });
  conexiones.set(widget, control); return control;
}
