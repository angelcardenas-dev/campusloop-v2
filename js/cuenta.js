import { requerirAutenticacion, cerrarSesion, escucharCambiosAuth } from './auth.js';

/* Elementos: IDs y atributos verificados contra cuenta.html */
const IDS = Object.freeze({
  raiz: 'contenido',
  descripcion: 'account-demo',
  mensaje: 'cuenta-mensaje',
  zonaReintentar: 'cuenta-reintentar-zona',
  reintentar: 'cuenta-reintentar',
  acceso: 'cuenta-acceso',
  zonaCerrar: 'cuenta-cerrar-sesion-zona',
  cerrar: 'cuenta-cerrar-sesion',
  nombre: 'account-name',
  universidad: 'cuenta-universidad',
  correo: 'cuenta-correo',
  verificado: 'cuenta-verificado',
  avatar: 'cuenta-avatar',
  vendedor: 'cuenta-vendedor-estado',
  pendiente: 'cuenta-pendiente',
});
// Secciones de ejemplo de Figma (métricas, aviso, operación, reputación y actividad).
const SELECTOR_DEMO = '[data-cuenta-demo]';

/* Datos */
const TONOS = Object.freeze({ info: 'alert', aviso: 'alert alert-warning', error: 'alert alert-error' });
// Códigos de auth.js para los que repetir la comprobación tiene sentido.
const REINTENTABLES = Object.freeze(['RED', 'LIMITE', 'SERVIDOR']);
const MENSAJES = Object.freeze({
  CARGANDO: 'Comprobando tu sesión…',
  SIN_SESION: 'Necesitas iniciar sesión para ver tu cuenta.',
  SESION_FINALIZADA: 'Tu sesión terminó. Inicia sesión de nuevo para ver tu cuenta.',
  CERRANDO: 'Cerrando sesión…',
  SESION_CERRADA: 'Cerraste sesión en este navegador.',
  MEMORIA_NO_BORRADA: 'Se cerró la sesión, pero no se pudo confirmar el borrado del contexto recordado en este navegador.',
  COMPROBACION_FALLIDA: 'No pudimos comprobar tu sesión. Inténtalo de nuevo.',
  CIERRE_FALLIDO: 'No pudimos cerrar la sesión. Inténtalo de nuevo.',
  CORREO_NO_DISPONIBLE: 'Correo no disponible',
  NOMBRE_PENDIENTE: 'Perfil pendiente de integración',
  UNIVERSIDAD_PENDIENTE: 'Universidad y campus pendientes de integración',
  VENDEDOR_PENDIENTE: 'Pendiente',
  DESCRIPCION: 'Mi cuenta muestra el correo de la sesión iniciada. El nombre, la universidad, el campus, el estado de vendedor, las métricas, la reputación y la actividad están pendientes de integración.',
});
const montajes = new WeakMap();
const cierresPendientes = new WeakMap();
const ESPERA_AUTH_MS = 8000; // Límite defensivo provisional de UI; no cancela físicamente Auth.
function esperarAuth(operacion, limite = ESPERA_AUTH_MS) {
  let temporizador;
  let trabajo;
  try { trabajo = Promise.resolve(operacion()); } catch (error) { trabajo = Promise.reject(error); }
  return Promise.race([trabajo, new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(Object.assign(new Error('ESPERA_AGOTADA'), { codigo: 'ESPERA_AGOTADA' })), limite);
  })]).finally(() => clearTimeout(temporizador));
}

/* Funciones: interpretación de resultados de auth.js, sin DOM (exportadas para pruebas offline) */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENSAJE_ERROR = Object.freeze({ RED: 'No hay conexión. Inténtalo de nuevo.', LIMITE: 'Demasiados intentos. Espera un momento.',
  SERVIDOR: 'Servicio temporalmente no disponible.', CONFIGURACION: 'La verificación de cuenta no está disponible.',
  MEMORIA_NO_BORRADA: MENSAJES.MEMORIA_NO_BORRADA });
const errorCoherente = r => r?.ok === false && r.datos === null && typeof r.error?.codigo === 'string';
const mensajeDe = (resultado, respaldo) => {
  const codigo = resultado?.error?.codigo;
  return typeof codigo === 'string' && Object.hasOwn(MENSAJE_ERROR, codigo) ? MENSAJE_ERROR[codigo] : respaldo;
};

export function clasificarAutenticacion(resultado) {
  const usuario = resultado?.datos?.usuario;
  if (resultado?.ok === true && resultado.error === null && resultado.datos?.estado === 'AUTENTICADO'
    && typeof usuario?.id === 'string' && UUID.test(usuario.id) && usuario?.is_anonymous !== true) {
    return { tipo: 'AUTENTICADO', id: usuario.id, correo: typeof usuario.correo === 'string' && usuario.correo ? usuario.correo : null };
  }
  if (errorCoherente(resultado) && resultado.error.codigo === 'NO_AUTORIZADO') return { tipo: 'SIN_SESION' };
  if (errorCoherente(resultado)) {
    return { tipo: 'ERROR', mensaje: mensajeDe(resultado, MENSAJES.COMPROBACION_FALLIDA),
      reintentable: REINTENTABLES.includes(resultado.error?.codigo) };
  }
  // Respuesta fuera de contrato: no se interpreta como sesión válida.
  return { tipo: 'ERROR', mensaje: MENSAJES.COMPROBACION_FALLIDA, reintentable: true };
}

export function clasificarCierre(resultado) {
  if (resultado?.ok === true && resultado.error === null && resultado.datos?.estado === 'NO_AUTENTICADO'
    && resultado.datos.usuario === null) return { tipo: 'CERRADA' };
  // La sesión sí se cerró; solo falta confirmar el borrado del contexto local del agente.
  if (errorCoherente(resultado) && resultado.error.codigo === 'MEMORIA_NO_BORRADA') {
    return { tipo: 'CERRADA_SIN_BORRADO', mensaje: mensajeDe(resultado, MENSAJES.MEMORIA_NO_BORRADA) };
  }
  return { tipo: 'FALLIDO', mensaje: mensajeDe(resultado, MENSAJES.CIERRE_FALLIDO) };
}

/* Funciones: DOM */
function buscarElementos(documento) {
  const elementos = {};
  for (const [nombre, id] of Object.entries(IDS)) {
    elementos[nombre] = documento.getElementById(id);
    if (!elementos[nombre]) return null;
  }
  elementos.demo = [...elementos.raiz.querySelectorAll(SELECTOR_DEMO)];
  return elementos;
}

// Varias clases del diseño declaran `display`, que anula el atributo hidden.
function alternar(elemento, visible) {
  elemento.hidden = !visible;
  if (visible) elemento.style.removeProperty('display');
  else elemento.style.setProperty('display', 'none');
}

function crearRegion(region) {
  const ventana = region.ownerDocument.defaultView;
  const enSiguienteCuadro = ventana?.requestAnimationFrame?.bind(ventana) ?? (funcion => setTimeout(funcion, 0));
  let turno = 0;
  return {
    mostrar(texto, tono) {
      turno += 1;
      const actual = turno;
      region.textContent = '';
      region.className = TONOS[tono];
      region.hidden = false;
      // Escribir tras mostrar la región para que el lector de pantalla lo anuncie.
      enSiguienteCuadro(() => { if (actual === turno) region.textContent = texto; });
    },
    ocultar() {
      turno += 1;
      region.textContent = '';
      // .alert declara display: flex y anula hidden: retirar la clase al ocultar.
      region.removeAttribute('class');
      region.hidden = true;
    },
  };
}

// Las secciones de ejemplo nunca se presentan como datos de la cuenta.
function neutralizarDemo(e) {
  for (const seccion of e.demo) alternar(seccion, false);
  alternar(e.avatar, false);
  alternar(e.verificado, false);
  e.nombre.textContent = MENSAJES.NOMBRE_PENDIENTE;
  e.universidad.textContent = MENSAJES.UNIVERSIDAD_PENDIENTE;
  e.vendedor.textContent = MENSAJES.VENDEDOR_PENDIENTE;
  e.descripcion.textContent = MENSAJES.DESCRIPCION;
}

/* Funciones: montaje */
export function montarCuenta({
  documento,
  esperaAuthMs = ESPERA_AUTH_MS,
  servicios = { requerirAutenticacion, cerrarSesion, escucharCambiosAuth },
} = {}) {
  if (typeof documento?.getElementById !== 'function') return null;
  const e = buscarElementos(documento);
  if (!e || montajes.has(e.raiz)) return null; // Sin elementos, la página conserva su HTML.
  const region = crearRegion(e.mensaje);
  const estado = { vista: 'cargando', usuarioId: null, turno: 0, cerrando: false,
    desmontado: false, cierreIndeterminado: false, authCambioDuranteCierre: false, cancelar: null };

  function ocupado(valor) {
    if (valor) e.raiz.setAttribute('aria-busy', 'true');
    else e.raiz.removeAttribute('aria-busy');
  }

  function limpiarCorreo() {
    e.correo.textContent = '';
    alternar(e.correo, false);
  }

  // Si el control enfocado se oculta, el foco pasa al contenido principal.
  function conservarFoco(control) {
    if (documento.activeElement === control) e.raiz.focus();
  }

  function mostrarCargando() {
    estado.vista = 'cargando';
    estado.usuarioId = null;
    ocupado(true);
    conservarFoco(e.reintentar);
    limpiarCorreo();
    for (const zona of [e.zonaReintentar, e.acceso, e.zonaCerrar, e.pendiente]) alternar(zona, false);
    region.mostrar(MENSAJES.CARGANDO, 'info');
  }

  function mostrarAutenticado({ id, correo }) {
    estado.vista = 'autenticado';
    estado.usuarioId = id;
    ocupado(false);
    e.correo.textContent = correo ?? MENSAJES.CORREO_NO_DISPONIBLE;
    alternar(e.correo, true);
    e.cerrar.disabled = false;
    for (const zona of [e.zonaReintentar, e.acceso]) alternar(zona, false);
    for (const zona of [e.zonaCerrar, e.pendiente]) alternar(zona, true);
    region.ocultar();
  }

  function mostrarSinSesion(texto, tono) {
    estado.vista = 'sin-sesion';
    estado.usuarioId = null;
    ocupado(false);
    conservarFoco(e.cerrar);
    limpiarCorreo();
    for (const zona of [e.zonaReintentar, e.zonaCerrar, e.pendiente]) alternar(zona, false);
    alternar(e.acceso, true);
    region.mostrar(texto, tono);
  }

  function mostrarError({ mensaje, reintentable }) {
    estado.vista = 'error';
    estado.usuarioId = null;
    ocupado(false);
    limpiarCorreo();
    for (const zona of [e.acceso, e.zonaCerrar, e.pendiente]) alternar(zona, false);
    alternar(e.zonaReintentar, reintentable);
    region.mostrar(mensaje, 'error');
  }

  async function comprobar() {
    if (estado.desmontado || estado.cerrando) return;
    estado.turno += 1;
    const turno = estado.turno;
    mostrarCargando();
    let clasificacion;
    try {
      clasificacion = clasificarAutenticacion(await esperarAuth(() => servicios.requerirAutenticacion(), esperaAuthMs));
    } catch {
      clasificacion = { tipo: 'ERROR', mensaje: MENSAJES.COMPROBACION_FALLIDA, reintentable: true };
    }
    // Una comprobación antigua o desmontada no escribe nada.
    if (turno !== estado.turno || estado.desmontado || estado.cerrando) return;
    if (clasificacion.tipo === 'AUTENTICADO') mostrarAutenticado(clasificacion);
    else if (clasificacion.tipo === 'SIN_SESION') mostrarSinSesion(MENSAJES.SIN_SESION, 'aviso');
    else mostrarError(clasificacion);
  }

  async function cerrar() {
    if (estado.desmontado || estado.cerrando) return;
    const cierreCompartido = cierresPendientes.get(servicios.cerrarSesion);
    if (cierreCompartido) {
      estado.cierreIndeterminado = true;
      try { await esperarAuth(() => cierreCompartido, esperaAuthMs); } catch { /* Sigue indeterminado; no repetir signOut. */ }
      if (estado.desmontado) return;
      if (cierresPendientes.get(servicios.cerrarSesion) === cierreCompartido) {
        await comprobar();
        if (!estado.desmontado) {
          e.cerrar.disabled = false;
          region.mostrar('No pudimos confirmar el cierre. Se comprobó tu sesión; vuelve a comprobarla antes de cerrar otra vez.', 'aviso');
        }
        return;
      }
      estado.cierreIndeterminado = false;
      await comprobar();
      if (estado.desmontado || estado.vista !== 'autenticado') return;
      return cerrar();
    }
    if (estado.cierreIndeterminado) {
      estado.cierreIndeterminado = false;
      await comprobar();
      if (estado.desmontado || estado.vista !== 'autenticado') return;
      return cerrar();
    }
    if (estado.vista !== 'autenticado') return;
    estado.cerrando = true;
    estado.authCambioDuranteCierre = false;
    estado.turno += 1; // Invalida comprobaciones en curso.
    limpiarCorreo();
    e.cerrar.disabled = true;
    ocupado(true);
    region.mostrar(MENSAJES.CERRANDO, 'info');
    let clasificacion;
    try {
      let operacionCierre;
      try { operacionCierre = Promise.resolve(servicios.cerrarSesion()); }
      catch (error) { operacionCierre = Promise.reject(error); }
      const cerrarServicio = servicios.cerrarSesion;
      cierresPendientes.set(cerrarServicio, operacionCierre);
      const liberarCierre = () => {
        if (cierresPendientes.get(cerrarServicio) === operacionCierre) cierresPendientes.delete(cerrarServicio);
        if (estado.desmontado || !estado.cierreIndeterminado) return;
        estado.cierreIndeterminado = false;
        // Si ya hay una comprobación más nueva en curso, su resultado gobierna la vista.
        if (estado.vista !== 'cargando' && !estado.cerrando) void comprobar();
      };
      operacionCierre.then(liberarCierre, liberarCierre).catch(() => {});
      clasificacion = clasificarCierre(await esperarAuth(() => operacionCierre, esperaAuthMs));
    } catch (error) {
      if (error?.codigo === 'ESPERA_AGOTADA') estado.cierreIndeterminado = true;
      clasificacion = { tipo: 'FALLIDO', mensaje: error?.codigo === 'ESPERA_AGOTADA'
        ? 'El cierre sigue pendiente; no se puede confirmar todavía.' : MENSAJES.CIERRE_FALLIDO };
    }
    estado.cerrando = false;
    if (estado.desmontado) return;
    if (estado.authCambioDuranteCierre) {
      await comprobar();
      if (estado.desmontado) return;
      if (clasificacion.tipo === 'CERRADA_SIN_BORRADO') {
        region.mostrar('La sesión anterior se cerró, pero no se pudo confirmar el borrado de su contexto. Se verificó por separado la sesión actual.', 'aviso');
      } else if (clasificacion.tipo === 'FALLIDO' && estado.vista === 'autenticado') {
        region.mostrar(clasificacion.mensaje, 'error');
      }
      return;
    }
    if (clasificacion.tipo === 'CERRADA') {
      mostrarSinSesion(MENSAJES.SESION_CERRADA, 'info');
    } else if (clasificacion.tipo === 'CERRADA_SIN_BORRADO') {
      // Se abandona el área autenticada y no se ofrece repetir el cierre.
      mostrarSinSesion(clasificacion.mensaje, 'aviso');
    } else {
      // Un error no prueba que la sesión anterior siga activa: reconciliar con Auth.
      await comprobar();
      if (!estado.desmontado && estado.vista === 'autenticado') {
        if (estado.cierreIndeterminado) {
          e.cerrar.disabled = false;
          region.mostrar('El cierre sigue pendiente. La sesión fue verificada; vuelve a comprobar antes de intentar cerrar de nuevo.', 'aviso');
        } else region.mostrar(clasificacion.mensaje, 'error');
      }
    }
  }

  function alCambiarAuth(notificacion) {
    if (estado.desmontado) return;
    if (estado.cerrando) {
      estado.authCambioDuranteCierre = true;
      estado.turno += 1;
      limpiarCorreo();
      return;
    }
    const estadoAuth = notificacion?.estado;
    if (notificacion?.evento === 'SIGNED_OUT' || estadoAuth === 'NO_AUTENTICADO') {
      if (estado.vista === 'sin-sesion') return; // Conserva el aviso vigente.
      estado.turno += 1;
      mostrarSinSesion(MENSAJES.SESION_FINALIZADA, 'aviso');
      return;
    }
    if (estadoAuth === 'AUTENTICADO' &&
      (estado.vista !== 'autenticado' || notificacion.usuario?.id !== estado.usuarioId)) {
      void comprobar();
    }
    // Otros eventos (p. ej. ERROR) no modifican la vista.
  }

  const alReintentar = () => { void comprobar(); };
  const alCerrar = () => { void cerrar(); };

  const montaje = {
    comprobar,
    desmontar() {
      if (estado.desmontado) return;
      estado.desmontado = true;
      estado.turno += 1;
      limpiarCorreo();
      e.reintentar.removeEventListener('click', alReintentar);
      e.cerrar.removeEventListener('click', alCerrar);
      try { estado.cancelar?.(); } catch { /* La suscripción ya no entrega eventos. */ }
      estado.cancelar = null;
      region.ocultar(); // También cancela escrituras pendientes de la región.
      ocupado(false);
      if (montajes.get(e.raiz) === montaje) montajes.delete(e.raiz);
    },
  };

  neutralizarDemo(e);
  e.reintentar.addEventListener('click', alReintentar);
  e.cerrar.addEventListener('click', alCerrar);
  montajes.set(e.raiz, montaje);
  try {
    const cancelar = servicios.escucharCambiosAuth(alCambiarAuth);
    estado.cancelar = typeof cancelar === 'function' ? cancelar : null;
  } catch {
    estado.cancelar = null; // Sin suscripción, la vista depende de la comprobación inicial.
  }
  void comprobar();
  return montaje;
}

/* Eventos: el módulo se evalúa una sola vez por página */
if (typeof document !== 'undefined') {
  let montaje = null;
  const iniciar = () => {
    try {
      montaje = montarCuenta({ documento: document });
    } catch {
      montaje = null;
    }
  };
  iniciar();
  window.addEventListener('pagehide', () => {
    montaje?.desmontar();
    montaje = null;
  });
  // Al volver desde el bfcache el módulo no se evalúa de nuevo: montar y comprobar otra vez.
  window.addEventListener('pageshow', evento => {
    if (evento.persisted && !montaje) iniciar();
  });
}
