import { obtenerUsuarioActual, escucharCambiosAuth, escucharCierreSesionLocal } from './auth.js';
import { validarResultado } from './agente-cliente.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENSAJES = Object.freeze({
  NO_AUTORIZADO: 'Inicia sesión con una cuenta registrada para usar el agente.',
  VALIDACION: 'Revisa el mensaje antes de enviarlo.',
  CANCELADA: 'Solicitud cancelada. Puedes intentarlo de nuevo.',
  SOLICITUD_CANCELADA: 'Solicitud cancelada. Puedes intentarlo de nuevo.',
  TIEMPO_AGOTADO: 'Se agotó el tiempo de espera. Comprueba el estado antes de volver a enviar.',
  AGENTE_DESHABILITADO: 'El agente todavía no está disponible.',
  CONFIGURACION: 'El acceso todavía no está configurado para el agente.',
  LIMITE: 'Se alcanzó el límite de solicitudes. Espera antes de volver a intentar.',
  RED: 'No se pudo conectar con el servicio. Tu texto sigue disponible.',
  SERVIDOR: 'No se pudo completar la solicitud. Tu texto sigue disponible.',
});
const errorSeguro = codigo => Object.hasOwn(MENSAJES, codigo) ? MENSAJES[codigo] : MENSAJES.SERVIDOR;
const identidadValida = r => r?.ok === true && r.error === null && r.datos
  && typeof r.datos === 'object' && !Array.isArray(r.datos)
  && Object.keys(r.datos).sort().join(',') === 'id,sesionId'
  && typeof r.datos.id === 'string' && typeof r.datos.sesionId === 'string'
  && UUID.test(r.datos.id) && UUID.test(r.datos.sesionId);
const huella = datos => `${datos.id.toLowerCase()}:${datos.sesionId.toLowerCase()}`;
const borradorValido = b => b && typeof b === 'object' && !Array.isArray(b)
  && Object.keys(b).sort().join(',') === 'descripcion,titulo'
  && typeof b.titulo === 'string' && b.titulo.trim() && b.titulo.length <= 100
  && typeof b.descripcion === 'string' && b.descripcion.trim() && b.descripcion.length <= 1000;

function esperar(promesa, signal) {
  return new Promise((resolve, reject) => {
    let terminada = false;
    const limpiar = () => signal.removeEventListener('abort', cancelar);
    const terminar = (fn, valor) => { if (terminada) return; terminada = true; limpiar(); fn(valor); };
    const cancelar = () => terminar(reject, new Error('CANCELADA'));
    signal.addEventListener('abort', cancelar, { once: true });
    Promise.resolve(promesa).then(v => terminar(resolve, v), () => terminar(reject, new Error('DEPENDENCIA')));
    if (signal.aborted) cancelar();
  });
}

// Puerto offline: el cliente D3 recibe su proveedor de token por separado.
// Ninguna dependencia de aquí lee Storage, sesiones crudas ni credenciales.
export function conectarClienteWidget({ widget, cliente, auth, aplicarBorrador,
  timeoutMs = 20000 } = {}) {
  if (typeof widget?.escucharEnvios !== 'function' || typeof widget?.presentarSalida !== 'function'
    || typeof widget?.finalizarSolicitud !== 'function' || typeof widget?.limpiarSesionAgente !== 'function'
    || typeof cliente?.solicitar !== 'function' || !Number.isSafeInteger(timeoutMs)
    || timeoutMs < 1 || timeoutMs > 30000) throw new TypeError('Integración del agente incompatible.');
  const fuenteAuth = auth ?? { obtenerUsuarioActual, escucharCambiosAuth, escucharCierreSesionLocal };
  const verificar = fuenteAuth.obtenerUsuarioActual;
  const escuchar = fuenteAuth.escucharCambiosAuth;
  const escucharCierre = fuenteAuth.escucharCierreSesionLocal;
  if (typeof verificar !== 'function' || typeof escuchar !== 'function'
    || typeof escucharCierre !== 'function') throw new TypeError('Identidad no disponible.');
  let viva = true, turno = 0, controlador = null, identidadVista = null, generacionSesion = 0;
  const accionesBorrador = new Set();
  let canceladaPorTiempo = false;
  function cancelar() {
    const pendiente = !!controlador;
    turno++; controlador?.abort(); controlador = null;
    try { cliente.cancelarPendientes?.(); } catch { /* Fallo de un puerto inyectado. */ }
    if (pendiente && viva) widget.finalizarSolicitud(MENSAJES.CANCELADA);
  }
  function invalidar(mensaje = 'La sesión cambió. Comprueba tu identidad antes de continuar.') {
    if (!viva) return;
    cancelar(); generacionSesion++; identidadVista = null;
    for (const accion of accionesBorrador) accion.abort();
    widget.limpiarSesionAgente?.();
    widget.finalizarSolicitud(mensaje);
  }
  let dejarAuth = null, dejarCierre = null, dejarCancelacion = null;
  try {
    dejarAuth = escuchar(invalidar);
    dejarCierre = escucharCierre(invalidar);
    dejarCancelacion = widget.escucharCancelacion?.(cancelar);
    if (typeof dejarAuth !== 'function' || typeof dejarCierre !== 'function'
      || typeof dejarCancelacion !== 'function') throw new TypeError('Observación de sesión no disponible.');
  } catch {
    try { dejarAuth?.(); dejarCierre?.(); dejarCancelacion?.(); } catch { /* Cerrado por defecto. */ }
    throw new TypeError('Observación de sesión no disponible.');
  }

  function accionBorrador(identidad, generacion) {
    return async (borrador, esVigente) => {
      if (!viva || accionesBorrador.size || typeof aplicarBorrador !== 'function' || typeof esVigente !== 'function'
        || !borradorValido(borrador)
        || generacion !== generacionSesion || identidadVista !== identidad || !esVigente()) return false;
      const abortador = new AbortController(); accionesBorrador.add(abortador);
      const temporizador = setTimeout(() => abortador.abort(), timeoutMs);
      const vigente = () => viva && !abortador.signal.aborted && generacion === generacionSesion
        && identidadVista === identidad && esVigente();
      try {
        const respuesta = await esperar(verificar({ verificarSesionMemoria: true }), abortador.signal);
        if (!vigente()) return false;
        if (!identidadValida(respuesta) || huella(respuesta.datos) !== identidad) {
          invalidar(respuesta?.ok === true && respuesta.datos === null ? MENSAJES.NO_AUTORIZADO
            : 'La sesión cambió. Comprueba tu identidad antes de continuar.');
          return false;
        }
        // Solo el puerto local y síncrono de Publicar. Una Promise no confirma aplicación.
        const aplicado = aplicarBorrador(borrador);
        return vigente() && aplicado === true;
      } catch {
        if (viva && generacion === generacionSesion) invalidar(abortador.signal.aborted
          ? MENSAJES.TIEMPO_AGOTADO : MENSAJES.SERVIDOR);
        return false;
      } finally {
        clearTimeout(temporizador); accionesBorrador.delete(abortador);
      }
    };
  }

  async function enviar(mensaje) {
    if (!viva || controlador) return;
    const actual = ++turno;
    const abortador = new AbortController(); controlador = abortador; canceladaPorTiempo = false;
    const timer = setTimeout(() => { canceladaPorTiempo = true; abortador.abort(); }, timeoutMs);
    const vigente = () => viva && actual === turno && controlador === abortador && !abortador.signal.aborted;
    const finalizar = (texto, enviado = null) => { if (viva && actual === turno) widget.finalizarSolicitud(texto, enviado); };
    let fase = 'identidad';
    try {
      const primera = await esperar(verificar({ verificarSesionMemoria: true }), abortador.signal);
      if (!vigente()) return;
      if (!identidadValida(primera)) {
        invalidar(primera?.ok === true && primera.datos === null ? MENSAJES.NO_AUTORIZADO
          : errorSeguro(['NO_AUTORIZADO', 'RED', 'CONFIGURACION'].includes(primera?.error?.codigo)
            ? primera.error.codigo : 'SERVIDOR'));
        return;
      }
      const identidad = huella(primera.datos);
      if (identidadVista && identidadVista !== identidad) {
        invalidar('La sesión cambió. Comprueba tu identidad antes de continuar.'); return;
      }
      identidadVista = identidad;
      if (!vigente()) return;
      // contexto siempre vacío: ni historial ni memoria ni reservas se reenvían al modelo.
      fase = 'servicio';
      const respuesta = await esperar(cliente.solicitar({ mensaje, contexto: [], signal: abortador.signal }), abortador.signal);
      if (!vigente()) return;
      if (respuesta?.ok !== true || respuesta.error !== null || !validarResultado(respuesta.datos)) {
        const codigo = respuesta?.ok === false && respuesta.datos === null ? respuesta.error?.codigo : 'SERVIDOR';
        if (codigo === 'NO_AUTORIZADO') invalidar(MENSAJES.NO_AUTORIZADO);
        else finalizar(errorSeguro(codigo));
        return;
      }
      fase = 'identidad-final';
      const ultima = await esperar(verificar({ verificarSesionMemoria: true }), abortador.signal);
      if (!vigente()) return;
      if (!identidadValida(ultima) || huella(ultima.datos) !== identidad) {
        invalidar(ultima?.ok === true && ultima.datos === null ? MENSAJES.NO_AUTORIZADO
          : 'La sesión cambió. Comprueba tu identidad antes de continuar.'); return;
      }
      if (!widget.presentarSalida(respuesta.datos, typeof aplicarBorrador === 'function'
        ? accionBorrador(identidad, generacionSesion) : undefined)) {
        finalizar(MENSAJES.SERVIDOR); return;
      }
      finalizar('Respuesta recibida. Comprueba su contenido antes de actuar.', mensaje);
    } catch {
      if (viva && actual === turno) {
        const aviso = canceladaPorTiempo ? MENSAJES.TIEMPO_AGOTADO
          : abortador.signal.aborted ? MENSAJES.CANCELADA : MENSAJES.SERVIDOR;
        if (fase !== 'servicio') invalidar(aviso);
        else finalizar(aviso);
      }
    } finally {
      clearTimeout(timer);
      if (controlador === abortador) controlador = null;
    }
  }
  let dejarEnvio;
  try { dejarEnvio = widget.escucharEnvios(enviar); }
  catch {
    dejarAuth(); dejarCierre(); dejarCancelacion();
    throw new TypeError('Envío del widget no disponible.');
  }
  return Object.freeze({ cancelar, desmontar() {
    if (!viva) return;
    cancelar(); generacionSesion++; identidadVista = null;
    for (const accion of accionesBorrador) accion.abort();
    widget.limpiarSesionAgente?.();
    widget.finalizarSolicitud('Integración desconectada. Puedes seguir escribiendo localmente.');
    viva = false; dejarEnvio?.(); dejarCancelacion?.();
    if (typeof dejarAuth === 'function') dejarAuth();
    if (typeof dejarCierre === 'function') dejarCierre();
  } });
}
