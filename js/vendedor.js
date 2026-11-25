/*
 * Presentación de activación de vendedor. No concede roles ni implementa REST.
 * consultarEstado y solicitarActivacion son puertos provisionales inyectables;
 * Bernabé debe confirmar sus firmas, DTO, sesión, permisos e idempotencia.
 */
(function (global) {
  'use strict';

  const ESTADOS = new Set(['NO_SOLICITADO', 'PENDIENTE', 'APROBADO', 'RECHAZADO']);
  const TIMEOUT_MS = 15000;
  const etiquetas = Object.freeze({
    NO_SOLICITADO: 'No has enviado una solicitud de activación.',
    PENDIENTE: 'Tu solicitud está pendiente de revisión humana. El plazo máximo es de 48 horas corridas; no se aprueba automáticamente.',
    APROBADO: 'El servicio confirmó que tu perfil vendedor está activo.',
    RECHAZADO: 'Tu solicitud fue rechazada. Conservas las funciones de comprador.',
    CARGANDO: 'Consultando el estado de tu perfil vendedor…',
    ERROR: 'No se pudo consultar el estado. Conservas las funciones de comprador; puedes reintentar.',
    INTEGRACION: 'Integración pendiente: el servicio autorizado de perfiles aún no está conectado.',
  });

  function respuestaValida(respuesta) {
    if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)
      || typeof respuesta.ok !== 'boolean' || !Object.hasOwn(respuesta, 'datos') || !Object.hasOwn(respuesta, 'error')) return false;
    if (respuesta.ok) return respuesta.error === null && !!respuesta.datos
      && typeof respuesta.datos === 'object' && !Array.isArray(respuesta.datos);
    return respuesta.datos === null && !!respuesta.error && typeof respuesta.error === 'object'
      && !Array.isArray(respuesta.error) && typeof respuesta.error.codigo === 'string';
  }

  function errorAbortado() { const error = new Error('Operación cancelada.'); error.name = 'AbortError'; return error; }
  function esperarConLimite(valor, signal, timeoutMs) {
    if (signal?.aborted) return Promise.reject(errorAbortado());
    return new Promise((resolve, reject) => {
      let terminado = false;
      const limpiar = () => { global.clearTimeout(temporizador); signal?.removeEventListener('abort', abortar); };
      const finalizar = (fn, resultado) => { if (terminado) return; terminado = true; limpiar(); fn(resultado); };
      const abortar = () => finalizar(reject, errorAbortado());
      const temporizador = global.setTimeout(() => {
        const error = new Error('Tiempo de espera agotado.'); error.name = 'TimeoutError'; finalizar(reject, error);
      }, timeoutMs);
      signal?.addEventListener('abort', abortar, { once: true });
      Promise.resolve(valor).then(r => finalizar(resolve, r), e => finalizar(reject, e));
    });
  }

  function crearControladorVendedor({ documento = global.document, servicios = {}, ubicacion = global.location,
    observarCambioIdentidad, timeoutMs = TIMEOUT_MS } = {}) {
    const estado = documento?.getElementById('estado-vendedor');
    const insignia = documento?.getElementById('insignia-estado-vendedor');
    const boton = documento?.getElementById('solicitar-activacion');
    const formulario = documento?.getElementById('formulario-activacion');
    const terminos = documento?.getElementById('terminos');
    const panelAprobado = documento?.getElementById('perfil-vendedor-aprobado');
    const botonPublicar = documento?.getElementById('enlace-publicar-aprobado');
    if (!estado) return { desmontar() {} };
    let desmontado = false;
    let enCurso = false;
    let peticion = null;
    let tipoPeticion = null;
    let solicitudIndeterminada = false;
    const listeners = [];
    const registrar = (e, tipo, fn) => { if (!e) return; e.addEventListener(tipo, fn); listeners.push(() => e.removeEventListener(tipo, fn)); };
    const mostrar = (valor, tipo = 'status') => {
      if (desmontado) return;
      estado.textContent = etiquetas[valor] || etiquetas.ERROR;
      estado.dataset.estado = valor;
      estado.setAttribute('role', tipo === 'alert' ? 'alert' : 'status');
      if (insignia) insignia.textContent = ({ NO_SOLICITADO: 'No solicitado', PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', CARGANDO: 'Cargando', ERROR: 'Error', INTEGRACION: 'Integración pendiente' })[valor] || 'Estado desconocido';
      if (panelAprobado) panelAprobado.hidden = valor !== 'APROBADO';
      if (botonPublicar) botonPublicar.hidden = valor !== 'APROBADO';
      if (boton) boton.disabled = enCurso || solicitudIndeterminada || ['PENDIENTE', 'APROBADO'].includes(valor);
    };
    async function consultar() {
      if (desmontado || enCurso) return;
      if (typeof servicios.consultarEstado !== 'function') { mostrar('INTEGRACION'); return; }
      enCurso = true;
      const actual = new AbortController(); peticion = actual; tipoPeticion = 'consultar'; mostrar('CARGANDO');
      try {
        const r = await esperarConLimite(servicios.consultarEstado({ signal: actual.signal }), actual.signal, timeoutMs);
        if (desmontado || peticion !== actual || actual.signal.aborted) return;
        if (!respuestaValida(r) || !r.ok || !ESTADOS.has(r.datos.estado)) { mostrar('ERROR', 'alert'); return; }
        const estabaIndeterminada = solicitudIndeterminada;
        // NO_SOLICITADO no reconcilia una petición que pudo seguir procesándose
        // tras el timeout. Se requiere un resultado autoritativo no ambiguo.
        if (estabaIndeterminada && r.datos.estado !== 'NO_SOLICITADO') solicitudIndeterminada = false;
        mostrar(r.datos.estado, r.datos.estado === 'RECHAZADO' ? 'alert' : 'status');
        if (estabaIndeterminada && r.datos.estado === 'NO_SOLICITADO') {
          estado.textContent = 'El servicio aún no confirma el resultado de la solicitud anterior. No la vuelvas a enviar hasta reconciliarla.';
          estado.setAttribute('role', 'alert');
        }
      } catch (error) {
        if (error?.name === 'TimeoutError') actual.abort();
        if (!desmontado && peticion === actual && error?.name !== 'AbortError') mostrar('ERROR', 'alert');
      } finally {
        if (peticion === actual) {
          enCurso = false; peticion = null; tipoPeticion = null;
          if (boton) boton.disabled = solicitudIndeterminada || ['PENDIENTE', 'APROBADO'].includes(estado.dataset.estado);
        }
      }
    }
    async function solicitar(evento) {
      evento?.preventDefault?.();
      if (desmontado || enCurso || solicitudIndeterminada || ['PENDIENTE', 'APROBADO'].includes(estado.dataset.estado)) return;
      if (terminos && !terminos.checked) {
        estado.textContent = 'Acepta las normas de publicación para enviar la solicitud.';
        estado.setAttribute('role', 'alert');
        terminos.focus?.();
        return;
      }
      if (typeof servicios.solicitarActivacion !== 'function') { mostrar('INTEGRACION'); return; }
      enCurso = true;
      const actual = new AbortController(); peticion = actual; tipoPeticion = 'solicitar';
      if (boton) { boton.disabled = true; boton.setAttribute('aria-busy', 'true'); }
      mostrar('CARGANDO');
      try {
        const r = await esperarConLimite(servicios.solicitarActivacion({ signal: actual.signal }), actual.signal, timeoutMs);
        if (desmontado || peticion !== actual || actual.signal.aborted) return;
        // La solicitud nunca puede producir una aprobación automática.
        if (!respuestaValida(r) || !r.ok || r.datos.estado !== 'PENDIENTE') {
          solicitudIndeterminada = true;
          mostrar('ERROR', 'alert');
          estado.textContent = 'No se pudo confirmar el resultado de la solicitud. Consulta el estado antes de volver a intentarlo.';
          return;
        }
        mostrar('PENDIENTE');
      } catch (error) {
        if (error?.name === 'TimeoutError') actual.abort();
        if (!desmontado && peticion === actual && error?.name !== 'AbortError') {
          solicitudIndeterminada = true;
          mostrar('ERROR', 'alert');
          estado.textContent = error?.name === 'TimeoutError'
            ? 'No se pudo confirmar si la solicitud llegó al servicio. Consulta el estado antes de volver a solicitarla.'
            : 'No se pudo confirmar el resultado de la solicitud. Consulta el estado antes de volver a intentarlo.';
        }
      } finally {
        if (peticion === actual) {
          enCurso = false; peticion = null; tipoPeticion = null;
          boton?.removeAttribute('aria-busy');
          if (boton) boton.disabled = solicitudIndeterminada || ['PENDIENTE', 'APROBADO'].includes(estado.dataset.estado);
        }
      }
    }
    registrar(boton, 'click', solicitar);
    registrar(documento.getElementById('reintentar-estado-vendedor'), 'click', consultar);
    if (formulario) registrar(formulario, 'submit', solicitar);
    if (typeof observarCambioIdentidad === 'function') {
      try {
        const desuscribir = observarCambioIdentidad(() => {
          if (desmontado) return;
          if (tipoPeticion === 'solicitar') solicitudIndeterminada = true;
          peticion?.abort();
          peticion = null;
          tipoPeticion = null;
          enCurso = false;
          mostrar('CARGANDO');
          // El evento solo invalida estado visual; la consulta vuelve a resolver
          // la identidad mediante el servicio confiable, nunca desde el evento.
          if (typeof servicios.consultarEstado === 'function') void consultar();
          else mostrar('INTEGRACION');
        });
        if (typeof desuscribir === 'function') listeners.push(desuscribir);
      } catch {
        solicitudIndeterminada = true;
        mostrar('INTEGRACION');
      }
    }
    const modoResultado = documento.body?.dataset.vendedorResultado === 'true';
    if (modoResultado) {
      mostrar('CARGANDO');
      if (typeof servicios.consultarEstado === 'function') void consultar();
      else mostrar('INTEGRACION');
    } else void consultar();
    return {
      consultar,
      solicitar,
      presentarEstado(valor) { if (ESTADOS.has(valor)) mostrar(valor); else mostrar('ERROR', 'alert'); },
      desmontar() { if (desmontado) return; desmontado = true; peticion?.abort(); listeners.splice(0).forEach(f => f()); },
    };
  }

  global.CampusLoopVendedor = Object.freeze({ ESTADOS: Object.freeze([...ESTADOS]), etiquetas, respuestaValida, crearControladorVendedor });
  if (global.document) global.document.addEventListener('DOMContentLoaded', () => {
    global.campusLoopVendedor = crearControladorVendedor({ servicios: global.CampusLoopVendedorDependencias || {} });
  }, { once: true });
})(typeof window === 'undefined' ? globalThis : window);
