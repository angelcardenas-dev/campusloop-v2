import { obtenerUsuarioActual, escucharCambiosAuth, escucharCierreSesionLocal } from './auth.js';
import { validarConfiguracionPublica } from './config-publica.js';
import { crearAlmacenamientoLocal } from './localstorage.js';
import { crearClaveMemoria, CLAVE_CONSENTIMIENTO_MEMORIA } from './agente-memoria.js';
import { crearAdaptadorStorageAgente } from './agente-storage-adaptador.js';
import { crearCoordinadorMemoria } from './agente-memoria-coordinador.js';
import { conBloqueoMemoriaCuenta, revocarMemoriaCuenta } from './agente-memoria-lock.js';

/* El montaje funcional liga la elección de esta pestaña a la sesión verificada.
   Sin autorización explícita no se abre Auth ni Storage. */
const conexiones = new WeakMap();
export function conectarMemoriaAgente({ widget, autorizada = false, politica = null, producirContexto,
  categoriasPermitidas = [], ahora = Date.now, almacenamiento, auth, obtenerStorageSesion, locks } = {}) {
  if (conexiones.has(widget)) return conexiones.get(widget);
  const oficial = auth == null;
  auth ??= { obtenerUsuarioActual, escucharCambiosAuth };
  let disponible = autorizada === true && politica !== null && typeof producirContexto === 'function'
    && typeof auth.obtenerUsuarioActual === 'function' && typeof auth.escucharCambiosAuth === 'function'
    && (!oficial || validarConfiguracionPublica().ok);
  const ventana = widget?.raiz?.ownerDocument?.defaultView;
  locks ??= ventana?.navigator?.locks;
  if (obtenerStorageSesion && (!locks || typeof locks.request !== 'function')) disponible = false;
  let viva = true, consentido = false, actor = null, generacion = 0, coordinador = null;
  let tuvoIdentidad = false;
  const claveEleccion = CLAVE_CONSENTIMIENTO_MEMORIA;
  let marcaActiva = null;
  let cuentaVerificada = null, cuentaIdVerificada = null, marcaConsentimientoNumero = null;
  let marcaOperacionActiva = null;
  const marcasOperacion = new WeakMap();

  async function verificarCuenta() {
    const r = await auth.obtenerUsuarioActual({ verificarSesionMemoria: !!obtenerStorageSesion });
    if (!r?.ok || r.datos?.is_anonymous === true) throw new Error();
    if (r.datos === null) return null;
    if (!crearClaveMemoria(r.datos?.id).ok) throw new Error();
    const id = r.datos.id.toLowerCase();
    if (!obtenerStorageSesion) return { id, marca: null };
    if (!crearClaveMemoria(r.datos.sesionId).ok) throw new Error();
    // Huella de consentimiento. No se guarda el identificador de sesión ni el token.
    const bytes = new TextEncoder().encode(id + '/' + r.datos.sesionId);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return { id, marca: Array.from(hash, b => b.toString(16).padStart(2, '0')).join('') };
  }
  const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: 'La memoria no está disponible para esta operación.' } });
  widget.prepararConsentimientoMemoria({ disponible: disponible && !obtenerStorageSesion });
  widget.presentarMemoria({ estado: disponible ? 'sin-consentimiento' : 'inactiva' });
  const compartido = disponible ? crearAlmacenamientoLocal({ ...(almacenamiento !== undefined ? { almacenamiento } : {}),
    ahora, memoriaAgente: { politica, categoriasPermitidas } }) : null;
  const puerto = crearAdaptadorStorageAgente({ almacenamiento: compartido, obtenerActor: () => consentido ? actor : null,
    ...(obtenerStorageSesion ? { locks, obtenerMarcaOperacion: signal => marcasOperacion.get(signal), revocarGeneracionOperacion: true,
      confirmarBorrado: (signal, marca) => {
        if (!viva || !consentido || signal?.aborted) return;
        marcasOperacion.set(signal, { consentimiento: marca.consentimiento, operacion: marca.operacion });
        marcaOperacionActiva = marca.operacion;
      } } : {}) });

  function leerConsentimiento() {
    try {
      const valor = JSON.parse(obtenerStorageSesion()?.getItem(claveEleccion));
      return valor?.version === 1 && typeof valor.huella === 'string'
        && Number.isSafeInteger(valor.generacion) && valor.generacion >= 0 ? valor : null;
    } catch { return null; }
  }
  async function leerMarca(id, signal) {
    return conBloqueoMemoriaCuenta(locks, id, () => compartido.leerMarcaContextoAgente(id), signal);
  }

  function olvidarEleccion(eliminarContexto) {
    if (!obtenerStorageSesion) return true;
    let ok = true;
    try { obtenerStorageSesion().removeItem(claveEleccion); } catch { ok = false; }
    if (eliminarContexto && actor) {
      ok = compartido.eliminarContextoAgente(actor).ok && ok;
    }
    return ok;
  }
  function revocar(privacidad = false, estado = 'sin-consentimiento') {
    if (privacidad || estado === 'error' || estado === 'sin-sesion') { cuentaVerificada = null; cuentaIdVerificada = null; }
    generacion++; consentido = false; actor = null; marcaActiva = null;
    marcaConsentimientoNumero = null; marcaOperacionActiva = null;
    const teniaCoordinador = coordinador !== null;
    coordinador?.desmontar({ limpiarWidget: privacidad }); coordinador = null;
    if (privacidad && !teniaCoordinador) widget.limpiarPorIdentidad();
    if (viva) {
      widget.prepararConsentimientoMemoria({ disponible: disponible && (!obtenerStorageSesion || !!cuentaVerificada) }); widget.presentarMemoria({ estado });
    }
  }
  async function identidad({ signal }) {
    const turno = generacion;
    try {
      if (!viva || !consentido) throw new Error();
      const cuenta = await verificarCuenta();
      signal.throwIfAborted();
      if (!viva || !consentido || turno !== generacion) throw new Error();
      if (!cuenta) {
        const anterior = actor ?? cuentaIdVerificada;
        olvidarEleccion(false); revocar(true, 'sin-sesion');
        if (anterior && obtenerStorageSesion) {
          void revocarMemoriaCuenta({ locks, almacenamiento: compartido, usuarioId: anterior });
        }
        throw new Error();
      }
      if (obtenerStorageSesion) {
        const vigente = await leerMarca(cuenta.id, signal);
        const eleccion = leerConsentimiento();
        if (!vigente.ok || !eleccion || cuenta.marca !== marcaActiva
          || eleccion.huella !== cuenta.marca || eleccion.generacion !== vigente.datos?.consentimiento) {
          olvidarEleccion(false); revocar(true); throw new Error();
        }
        const capturada = marcasOperacion.get(signal);
        if (capturada && (capturada.consentimiento !== vigente.datos.consentimiento
          || capturada.operacion !== vigente.datos.operacion)) throw 'CANCELADA';
        if (!capturada) marcasOperacion.set(signal, { consentimiento: vigente.datos.consentimiento, operacion: vigente.datos.operacion });
        marcaOperacionActiva = vigente.datos.operacion;
      }
      const siguiente = cuenta.id;
      if (actor !== null && actor !== siguiente) { revocar(true); throw new Error(); }
      actor = siguiente; tuvoIdentidad = true;
      return { id: siguiente }; // Nunca entregar correo, sesión ni tokens al dominio.
    } catch (error) {
      if (error === 'CANCELADA') throw error;
      if (viva && consentido && turno === generacion && !signal.aborted) {
        olvidarEleccion(false); revocar(true, 'error');
      }
      throw new Error('No se pudo verificar la identidad.');
    }
  }
  async function revalidarGeneracion() {
    const turno = generacion;
    if (!viva || !consentido || !obtenerStorageSesion) return;
    let cuenta;
    try { cuenta = await verificarCuenta(); } catch { /* Una sesión no verificable pierde acceso. */ }
    if (!viva || turno !== generacion || !consentido) return;
    if (!cuenta || cuenta.marca !== marcaActiva) {
      olvidarEleccion(false); revocar(true, cuenta ? 'sin-consentimiento' : 'error');
      if (cuenta) void activar(false);
      return;
    }
    const vigente = await leerMarca(cuenta.id);
    const eleccion = leerConsentimiento();
    if (!viva || turno !== generacion || !consentido) return;
    if (!vigente.ok || !eleccion || eleccion.huella !== cuenta.marca
      || eleccion.generacion !== vigente.datos?.consentimiento
      || vigente.datos.consentimiento !== marcaConsentimientoNumero) {
      olvidarEleccion(false);
      const ausente = !vigente.ok && vigente.error?.codigo === 'MARCA_AUSENTE';
      revocar(true, vigente.ok || ausente ? 'sin-consentimiento' : 'error');
      if (vigente.ok || ausente) void activar(false);
      return;
    }
    if (vigente.datos.operacion !== marcaOperacionActiva) {
      // Borrado manual/operación remota: cancelar cualquier productor anterior,
      // mantener consentimiento y volver a leer solo el documento vigente.
      await coordinador?.restaurar();
    }
  }
  async function ejecutar(tipo) {
    if (!viva) return fallo('CANCELADA');
    if (!disponible || !consentido || !coordinador) return fallo('CONFIGURACION');
    return coordinador[tipo]();
  }
  async function activar(explicito) {
    if (!disponible || !viva || consentido) return;
    if (obtenerStorageSesion) {
      const turno = ++generacion;
      try {
        const sesion = obtenerStorageSesion();
        const cuenta = await verificarCuenta();
        if (!viva || turno !== generacion) return;
        if (!cuenta) {
          olvidarEleccion(false); revocar(false, 'sin-sesion'); return;
        }
        if (explicito && cuentaVerificada && cuentaVerificada !== cuenta.marca) {
          olvidarEleccion(false); revocar(true); void activar(false); return;
        }
        const sincronizada = await conBloqueoMemoriaCuenta(locks, cuenta.id, () => {
          let marca = compartido.leerMarcaContextoAgente(cuenta.id);
          if (!marca.ok && marca.error?.codigo === 'MARCA_AUSENTE' && explicito) {
            // Si se perdiÃ³ la marca, no reactivar un documento huÃ©rfano. La
            // limpieza queda marcada hasta confirmar su eliminaciÃ³n selectiva.
            marca = compartido.inicializarMarcaContextoAgente(cuenta.id, true);
          }
          if (!marca.ok && marca.error?.codigo === 'MARCA_AUSENTE' && !explicito) {
            // La ausencia nunca reconstruye una generación que pudo invalidarse
            // mientras la pestaña estaba suspendida. Hace falta elección nueva.
            olvidarEleccion(false);
            return { ok: true, datos: { consentimientoVigente: false, consentimiento: null,
              operacion: null, marcaAusente: true }, error: null };
          }
          if (!marca.ok) return marca;
          if (explicito && marca.datos.revocacionPendiente) {
            // Un borrado anterior fallido no puede reaparecer tras una nueva
            // elección. Confirma primero la eliminación, bajo este mismo lock.
            const eliminado = compartido.eliminarContextoAgente(cuenta.id);
            if (!eliminado.ok) return eliminado;
            marca = compartido.avanzarMarcaContextoAgente(cuenta.id, { revocacionPendiente: false });
            if (!marca.ok) return marca;
          }
          const previa = leerConsentimiento();
          const consentimientoVigente = !!previa && previa.huella === cuenta.marca
            && previa.generacion === marca.datos.consentimiento;
          if (explicito) obtenerStorageSesion().setItem(claveEleccion, JSON.stringify({ version: 1,
            huella: cuenta.marca, generacion: marca.datos.consentimiento }));
          return { ok: true, datos: { ...marca.datos, consentimientoVigente: explicito || consentimientoVigente }, error: null };
        });
        if (!sincronizada.ok || !viva || turno !== generacion) {
          if (explicito && viva) { olvidarEleccion(false); revocar(false, 'error'); }
          return;
        }
        actor = cuenta.id;
        cuentaIdVerificada = cuenta.id;
        cuentaVerificada = cuenta.marca;
        marcaConsentimientoNumero = sincronizada.datos.consentimiento;
        marcaOperacionActiva = sincronizada.datos.operacion;
        widget.prepararConsentimientoMemoria({ disponible });
        widget.presentarMemoria({ estado: 'sin-consentimiento' });
        marcaActiva = cuenta.marca;
        tuvoIdentidad = true;
        widget.prepararConsentimientoMemoria({ disponible, marcado: sincronizada.datos.consentimientoVigente });
        if (!sincronizada.datos.consentimientoVigente) {
          // Retira una elecciÃ³n antigua invalidada por otra pestaÃ±a o logout;
          // nunca se convierte en consentimiento de la generaciÃ³n actual.
          olvidarEleccion(false);
          actor = null; consentido = false; widget.presentarMemoria({ estado: 'sin-consentimiento' }); return;
        }
      } catch {
        if (viva && turno === generacion) { olvidarEleccion(false); revocar(false, 'error'); }
        return;
      }
    }
    consentido = true;
    coordinador = crearCoordinadorMemoria({ widget, obtenerIdentidad: identidad, almacenamiento: puerto,
      producirContexto, categoriasPermitidas, politica, ahora });
    return coordinador.restaurar();
  }
  const cancelarAcciones = widget.escucharAccionesMemoria(accion => {
    if (!viva) return;
    if (accion === 'desmontar') return desmontar();
    if (accion === 'revocar') {
      if (!obtenerStorageSesion) { revocar(false, 'sin-consentimiento'); return; }
      const id = actor ?? cuentaIdVerificada;
      revocar(false, 'sin-consentimiento');
      if (!id) return;
      olvidarEleccion(false);
      return revocarMemoriaCuenta({ locks, almacenamiento: compartido, usuarioId: id })
        .then(r => { if (!r.ok && viva) widget.presentarMemoria({ estado: 'error-borrado' }); });
    }
    if (accion === 'consentir') return activar(true);
  });
  // Una sola suscripción; nunca se utilizan sus datos como identidad verificada.
  let cancelarAuth = () => {};
  const cancelarCierreLocal = oficial && disponible ? escucharCierreSesionLocal(() => {
    if (!viva) return;
    const ok = olvidarEleccion(false);
    revocar(true, ok ? 'sin-consentimiento' : 'error-borrado');
  }) : () => {};
  const cambioStorage = evento => {
    if (!viva || !actor || evento.key !== `campusloop_tb4_v1_agente_generacion_${actor}`) return;
    // No confiar en el payload del evento (puede ser tardío): leer bajo el mismo
    // Web Lock que usan las escrituras y la revocación.
    void revalidarGeneracion();
  };
  const alRecuperarVisibilidad = () => {
    if (ventana?.document?.visibilityState === 'visible') void revalidarGeneracion();
  };
  if (disponible && ventana) {
    ventana.addEventListener('storage', cambioStorage);
    ventana.addEventListener('pageshow', alRecuperarVisibilidad);
    ventana.document?.addEventListener('visibilitychange', alRecuperarVisibilidad);
  }
  if (disponible) {
    try {
      const cancelar = auth.escucharCambiosAuth(notificacion => {
        if (!viva) return;
        try {
          const evento = notificacion?.evento;
          if (evento === 'SIGNED_OUT') {
            const turno = generacion;
            const identidadAnterior = actor ?? cuentaIdVerificada;
            const marcaAnterior = marcaActiva ?? cuentaVerificada;
            if (!identidadAnterior && !consentido && !tuvoIdentidad) return;
            // SIGNED_OUT es un aviso, no prueba de que la sesiÃ³n siga ausente.
            // Una notificaciÃ³n tardÃ­a no debe invalidar el consentimiento nuevo.
            void (async () => {
              let cuenta;
              try { cuenta = await verificarCuenta(); } catch { /* Denegar abajo. */ }
              if (!viva || turno !== generacion) return;
              if (cuenta && cuenta.id === identidadAnterior && cuenta.marca === marcaAnterior) return;
              olvidarEleccion(false);
              if (cuenta) {
                // Se verificÃ³ una cuenta/sesiÃ³n vigente: descartar solo la vista
                // previa y volver a comprobar si la elecciÃ³n de esta sesiÃ³n aplica.
                revocar(true, 'sin-consentimiento');
                void activar(false);
                return;
              }
              revocar(true, 'sin-sesion');
              if (identidadAnterior && obtenerStorageSesion) {
                void revocarMemoriaCuenta({ locks, almacenamiento: compartido, usuarioId: identidadAnterior });
              }
            })();
            return;
          }
          if (!['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(evento)) throw new Error();
          const usuario = notificacion.usuario, id = usuario?.id;
          const sinSesion = evento === 'INITIAL_SESSION' && usuario === null;
          if (!sinSesion && (usuario?.is_anonymous === true || !crearClaveMemoria(id).ok)) throw new Error();
          if (notificacion.estado !== undefined
            && notificacion.estado !== (sinSesion ? 'NO_AUTENTICADO' : 'AUTENTICADO')) throw new Error();
          // El primer aviso no debe borrar un chat efímero todavía ajeno a Auth.
          // No extender esta excepción a datos de una identidad usada previamente.
          if (evento === 'INITIAL_SESSION' && !consentido && actor === null
            && coordinador === null && !tuvoIdentidad) {
            if (obtenerStorageSesion && sinSesion) { olvidarEleccion(false); revocar(false, 'sin-sesion'); }
            return;
          }
          if (!sinSesion && actor === null && !consentido && cuentaIdVerificada) {
            // Un aviso para la misma cuenta ya verificada no debe vaciar un borrador.
            // El payload solo dispara la comprobación; Auth oficial decide si la
            // identidad y la huella siguen vigentes.
            const turno = generacion, identidadAnterior = cuentaVerificada;
            void (async () => {
              let actual;
              try { actual = await verificarCuenta(); } catch { /* Denegar abajo. */ }
              if (!viva || turno !== generacion || consentido) return;
              if (actual?.id === cuentaIdVerificada && actual.marca === identidadAnterior) return;
              olvidarEleccion(false); revocar(true, actual ? 'sin-consentimiento' : 'error');
              if (actual) void activar(false);
            })();
            return;
          }
          // Coincidir con el actor YA verificado conserva la continuidad; el aviso
          // nunca asigna identidad y cada IO vuelve a verificarla mediante Auth.
          if (!sinSesion && actor !== null && id.toLowerCase() === actor) {
            if (obtenerStorageSesion && consentido) void revalidarGeneracion();
            else if (obtenerStorageSesion) void activar(false);
            return;
          }
          if (obtenerStorageSesion && !sinSesion && !tuvoIdentidad && !consentido) {
            void activar(false); return;
          }
          olvidarEleccion(false); revocar(true);
          if (obtenerStorageSesion && !sinSesion) void activar(false);
        } catch { olvidarEleccion(false); revocar(true, 'error'); }
      });
      if (typeof cancelar !== 'function') throw new Error();
      cancelarAuth = cancelar;
    } catch { disponible = false; revocar(true, 'error'); }
  }
  function desmontar() {
    if (!viva) return;
    viva = false; revocar(); cancelarAcciones();
    cancelarCierreLocal();
    if (ventana) ventana.removeEventListener('storage', cambioStorage);
    if (ventana) ventana.removeEventListener('pageshow', alRecuperarVisibilidad);
    ventana?.document?.removeEventListener('visibilitychange', alRecuperarVisibilidad);
    try { cancelarAuth(); } catch { /* La limpieza local continúa sin exponer el error del SDK. */ }
    conexiones.delete(widget);
  }
  if (disponible && obtenerStorageSesion) void activar(false);
  const control = Object.freeze({ restaurar: () => ejecutar('restaurar'), actualizar: () => ejecutar('actualizar'),
    borrar: () => ejecutar('borrar'), invalidarIdentidad: () => { if (viva) { olvidarEleccion(false); revocar(true); } }, desmontar });
  conexiones.set(widget, control); return control;
}
