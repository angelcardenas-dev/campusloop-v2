import { requerirAutenticacion, cerrarSesion, escucharCambiosAuth } from './auth.js';
import { consultarMiPerfil, actualizarMiPerfil } from './perfiles.js';
import { consultarUniversidades, consultarCampus } from './directorios.js';

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
  perfilEstado: 'cuenta-perfil-estado',
  zonaPerfilReintentar: 'cuenta-perfil-reintentar-zona',
  perfilReintentar: 'cuenta-perfil-reintentar',
  editar: 'cuenta-editar',
  editarAyuda: 'account-static',
  zonaEditar: 'cuenta-editar-zona',
  formEditar: 'cuenta-editar-form',
  editarNombre: 'cuenta-editar-nombre',
  editarNombreError: 'cuenta-editar-nombre-error',
  editarUniversidad: 'cuenta-editar-universidad',
  editarUniversidadError: 'cuenta-editar-universidad-error',
  editarCampus: 'cuenta-editar-campus',
  editarCampusError: 'cuenta-editar-campus-error',
  editarMensaje: 'cuenta-editar-mensaje',
  zonaEditarReintentar: 'cuenta-editar-reintentar-zona',
  editarReintentar: 'cuenta-editar-reintentar',
  editarGuardar: 'cuenta-editar-guardar',
  editarCancelar: 'cuenta-editar-cancelar',
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
  DESCRIPCION: 'Mi cuenta muestra el correo de la sesión iniciada y tu perfil: nombre, campus y estado de vendedor. Puedes editar tu nombre y tu campus. Las métricas, la reputación y la actividad están pendientes de integración.',
  PERFIL_CARGANDO: 'Cargando tu perfil…',
  CAMPUS_CARGANDO: 'Cargando campus…',
  NOMBRE_SIN_COMPLETAR: 'Nombre sin completar',
  CAMPUS_SIN_COMPLETAR: 'Campus sin completar',
  CAMPUS_NO_ENCONTRADO: 'Campus no disponible en el directorio',
  CAMPUS_ERROR: 'No se pudo cargar el nombre del campus',
  VENDEDOR_ACTIVO: 'Activo',
  VENDEDOR_INACTIVO: 'Inactivo',
  PERFIL_COMPLETO: 'Perfil completo.',
  PERFIL_INCOMPLETO: 'Tu perfil está incompleto: falta {faltante}. Usa «Editar perfil» para completarlo.',
});
// Edición: textos propios por resultado de actualizarMiPerfil(); el mensaje del servicio no se muestra.
const MENSAJES_EDICION = Object.freeze({
  GUARDANDO: 'Guardando tu perfil…',
  GUARDADO: 'Guardamos tu perfil.',
  NO_CONFIRMADO: 'No pudimos confirmar el guardado. Se muestran los datos actuales de tu perfil.',
  CONFLICTO: 'Tu perfil cambió desde que abriste el formulario y tus cambios no se guardaron. Revisa los datos actuales y vuelve a editarlo si lo necesitas.',
  NO_ENCONTRADO: 'Tu perfil ya no está disponible. Tus cambios no se guardaron.',
  NO_AUTORIZADO: 'No pudimos verificar tu acceso y tus cambios no se guardaron. Se volvió a comprobar tu sesión.',
  CORREO_PENDIENTE: 'Confirma tu correo antes de guardar el perfil. Tus cambios siguen en el formulario.',
  VALIDACION: 'No se pudo guardar: revisa el nombre y la selección de universidad y campus.',
  RED: 'No se pudo conectar con el servicio. Tus cambios siguen en el formulario; inténtalo de nuevo.',
  LIMITE: 'Se hicieron demasiados intentos. Espera un momento y vuelve a guardar.',
  CONFIGURACION: 'No se pudo conectar con el servicio. Inténtalo más tarde.',
  ESPERA_AGOTADA: 'No pudimos confirmar si se guardó. Vuelve a intentarlo: si tu perfil ya cambió, te avisaremos.',
  GENERICO: 'No pudimos guardar tu perfil. Tus cambios siguen en el formulario; inténtalo de nuevo.',
});
const MENSAJES_CAMPO = Object.freeze({
  NOMBRE_VACIO: 'Escribe tu nombre visible.',
  NOMBRE_INVALIDO: 'El nombre debe tener entre 2 y 100 caracteres, sin los símbolos < ni > ni caracteres de control.',
  UNIVERSIDAD: 'Selecciona tu universidad.',
  CAMPUS: 'Selecciona tu campus.',
});
const MENSAJES_DIRECTORIO = Object.freeze({
  CARGANDO_UNIVERSIDADES: 'Cargando universidades…',
  CARGANDO_CAMPUS: 'Cargando campus…',
  ELEGIR_UNIVERSIDAD: 'Selecciona tu universidad',
  ELEGIR_CAMPUS: 'Selecciona tu campus',
  PRIMERO_UNIVERSIDAD: 'Selecciona primero una universidad',
  SIN_UNIVERSIDADES: 'No hay universidades disponibles.',
  SIN_CAMPUS: 'No hay campus disponibles para esta universidad.',
  ERROR_UNIVERSIDADES: 'No pudimos cargar las universidades.',
  ERROR_CAMPUS: 'No pudimos cargar los campus.',
});
const SUFIJOS_DIRECTORIO = Object.freeze({
  RED: 'Revisa tu conexión e inténtalo de nuevo.',
  LIMITE: 'Espera un momento antes de reintentar.',
  CONFIGURACION: 'Inténtalo más tarde.',
});
// Errores de perfil y directorios: textos propios por código; el mensaje del servicio no se muestra.
const MENSAJES_PERFIL = Object.freeze({
  NO_AUTORIZADO: 'No pudimos verificar tu acceso al perfil. Vuelve a iniciar sesión si el problema continúa.',
  NO_ENCONTRADO: 'No encontramos tu perfil.',
  RED: 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.',
  LIMITE: 'Se hicieron demasiadas consultas. Espera un momento antes de reintentar.',
  CONFIGURACION: 'No se pudo conectar con el servicio. Inténtalo más tarde.',
  IDENTIDAD: 'La sesión cambió mientras se cargaba el perfil. Vuelve a intentarlo.',
  GENERICO: 'No pudimos cargar tu perfil.',
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

const codigoDe = resultado => {
  const codigo = resultado?.ok === false ? resultado.error?.codigo : null;
  return typeof codigo === 'string' && /^[A-Z_]{1,40}$/.test(codigo) ? codigo : 'RESPUESTA_INVALIDA';
};
const igualId = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const textoValido = valor => typeof valor === 'string' && valor.trim().length > 0;
const esUuid = valor => typeof valor === 'string' && UUID.test(valor);
const versionValida = valor => Number.isInteger(valor) && valor > 0 && valor <= 2147483647;

// Contrato de consultarMiPerfil() (perfiles.js). Solo se conservan los campos que se muestran.
export function clasificarPerfil(resultado, usuarioIdEsperado) {
  const d = resultado?.datos;
  if (resultado?.ok === true && resultado.error === null && d && typeof d === 'object') {
    const valido = typeof d.id === 'string' && UUID.test(d.id)
      && (d.nombreVisible === null || textoValido(d.nombreVisible))
      && (d.campusId === null || (typeof d.campusId === 'string' && UUID.test(d.campusId)))
      && typeof d.vendedorActivado === 'boolean'
      && versionValida(d.version)
      && d.completo === (d.nombreVisible !== null && d.campusId !== null);
    if (!valido) return { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA', mensaje: MENSAJES_PERFIL.GENERICO };
    // Un perfil de otra cuenta nunca se muestra.
    if (!igualId(d.id, usuarioIdEsperado)) return { tipo: 'OTRA_IDENTIDAD' };
    // `version` no se muestra: solo se conserva como versionEsperada para la edición.
    return { tipo: 'PERFIL', perfil: { nombreVisible: d.nombreVisible, campusId: d.campusId,
      vendedorActivado: d.vendedorActivado, completo: d.completo, version: d.version } };
  }
  const codigo = codigoDe(resultado);
  return { tipo: 'ERROR', codigo, mensaje: Object.hasOwn(MENSAJES_PERFIL, codigo) ? MENSAJES_PERFIL[codigo] : MENSAJES_PERFIL.GENERICO };
}

// Sin consulta de campus por ID: se recorren las universidades visibles hasta encontrarlo.
// `vigente()` corta el recorrido si la vista cambió. Devuelve null si dejó de estar vigente.
export async function resolverCampus(campusId, { consultarUniversidades: universidades, consultarCampus: campus }, vigente = () => true) {
  let respuesta;
  try { respuesta = await universidades(); } catch { respuesta = null; }
  if (!vigente()) return null;
  if (respuesta?.ok !== true || !Array.isArray(respuesta.datos)) return { tipo: 'ERROR', codigo: codigoDe(respuesta) };
  for (const universidad of respuesta.datos) {
    if (!UUID.test(universidad?.id ?? '') || !textoValido(universidad.nombre)) return { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA' };
    let lista;
    try { lista = await campus(universidad.id); } catch { lista = null; }
    if (!vigente()) return null;
    if (lista?.ok !== true || !Array.isArray(lista.datos)) return { tipo: 'ERROR', codigo: codigoDe(lista) };
    const encontrado = lista.datos.find(c => igualId(c?.id, campusId) && igualId(c?.universidadId, universidad.id));
    if (encontrado) {
      if (!textoValido(encontrado.nombre)) return { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA' };
      const etiqueta = textoValido(universidad.sigla) ? universidad.sigla : universidad.nombre;
      return { tipo: 'ENCONTRADO', texto: `${etiqueta} · ${encontrado.nombre}`, universidadId: universidad.id };
    }
  }
  return { tipo: 'NO_ENCONTRADO' };
}

// Mismas reglas que actualizarMiPerfil() y la RPC: 2 a 100 caracteres tras recortar, sin control ni < >.
// Los sustitutos sueltos no son UTF-8 válido y el servidor los rechazaría.
const NOMBRE_PROHIBIDO = /[\u0000-\u001f\u007f-\u009f<>]/;
const SURROGADO_SUELTO = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
export function validarNombreVisible(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return 'NOMBRE_VACIO';
  const largo = [...valor.trim()].length;
  if (largo < 2 || largo > 100 || NOMBRE_PROHIBIDO.test(valor) || SURROGADO_SUELTO.test(valor)) return 'NOMBRE_INVALIDO';
  return null;
}

// Resultado de actualizarMiPerfil(): solo cuenta como guardado si la fila confirmada es del actor esperado.
export function clasificarActualizacion(resultado, actorEsperado) {
  if (resultado?.ok === true) {
    const d = resultado.datos;
    const valido = resultado.error === null && d !== null && typeof d === 'object'
      && esUuid(d.id) && igualId(d.id, actorEsperado) && versionValida(d.version);
    return { tipo: valido ? 'GUARDADO' : 'NO_CONFIRMADO' };
  }
  return { tipo: 'ERROR', codigo: codigoDe(resultado) };
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

// Estado anunciado (aria-live) sin clases de alerta: conserva el estilo del elemento.
function crearAnuncio(elemento) {
  const ventana = elemento.ownerDocument.defaultView;
  const enSiguienteCuadro = ventana?.requestAnimationFrame?.bind(ventana) ?? (funcion => setTimeout(funcion, 0));
  let turno = 0;
  return {
    mostrar(texto) {
      turno += 1;
      const actual = turno;
      elemento.textContent = '';
      elemento.hidden = false;
      enSiguienteCuadro(() => { if (actual === turno) elemento.textContent = texto; });
    },
    ocultar() {
      turno += 1;
      elemento.textContent = '';
      elemento.hidden = true;
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
  servicios = { requerirAutenticacion, cerrarSesion, escucharCambiosAuth, consultarMiPerfil, actualizarMiPerfil,
    consultarUniversidades, consultarCampus },
} = {}) {
  if (typeof documento?.getElementById !== 'function') return null;
  const e = buscarElementos(documento);
  if (!e || montajes.has(e.raiz)) return null; // Sin elementos, la página conserva su HTML.
  const region = crearRegion(e.mensaje);
  const estado = { vista: 'cargando', usuarioId: null, turno: 0, cerrando: false,
    desmontado: false, cierreIndeterminado: false, authCambioDuranteCierre: false, cancelar: null,
    turnoPerfil: 0, reverificoIdentidad: false, perfil: null, turnoEdicion: 0 };
  const anuncioPerfil = crearAnuncio(e.perfilEstado);
  const anuncioEdicion = crearAnuncio(e.editarMensaje);
  // Formulario abierto: { actor, version, inicial, universidades, campus, universidadId, turnoCampus, falla, enviando }.
  let edicion = null;

  // Vuelve a los textos neutros e invalida cualquier consulta de perfil en curso y el formulario abierto.
  function limpiarPerfil() {
    estado.turnoPerfil += 1;
    estado.perfil = null;
    descartarEdicion();
    e.nombre.textContent = MENSAJES.NOMBRE_PENDIENTE;
    e.universidad.textContent = MENSAJES.UNIVERSIDAD_PENDIENTE;
    e.vendedor.textContent = MENSAJES.VENDEDOR_PENDIENTE;
    e.perfilEstado.removeAttribute('data-codigo');
    anuncioPerfil.ocultar();
    if (documento.activeElement === e.perfilReintentar) e.raiz.focus();
    alternar(e.zonaPerfilReintentar, false);
  }

  function mostrarErrorPerfil({ codigo, mensaje }) {
    e.nombre.textContent = MENSAJES.NOMBRE_PENDIENTE;
    e.universidad.textContent = MENSAJES.UNIVERSIDAD_PENDIENTE;
    e.vendedor.textContent = MENSAJES.VENDEDOR_PENDIENTE;
    e.perfilEstado.setAttribute('data-codigo', codigo);
    anuncioPerfil.mostrar(mensaje);
    alternar(e.zonaPerfilReintentar, true);
  }

  // `aviso`: resultado de una edición previa, que se antepone al estado del perfil recargado.
  async function cargarPerfil(aviso = null) {
    const usuarioId = estado.usuarioId;
    const conAviso = texto => (aviso ? `${aviso} ${texto}` : texto);
    if (estado.desmontado || estado.cerrando || estado.vista !== 'autenticado' || !usuarioId) return;
    limpiarPerfil();
    const turno = estado.turnoPerfil;
    // Vigente solo si sigue la misma cuenta, sin cierre en curso y sin una consulta más nueva.
    const vigente = () => !estado.desmontado && !estado.cerrando && estado.vista === 'autenticado'
      && estado.usuarioId === usuarioId && estado.turnoPerfil === turno;
    e.nombre.textContent = MENSAJES.PERFIL_CARGANDO;
    anuncioPerfil.mostrar(MENSAJES.PERFIL_CARGANDO);
    let clasificacion;
    try {
      clasificacion = clasificarPerfil(await esperarAuth(() => servicios.consultarMiPerfil(), esperaAuthMs), usuarioId);
    } catch {
      clasificacion = { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA', mensaje: MENSAJES_PERFIL.GENERICO };
    }
    if (!vigente()) return;
    if (clasificacion.tipo === 'OTRA_IDENTIDAD') {
      // La sesión cambió entre la comprobación y la consulta: se verifica una vez, sin bucles.
      if (estado.reverificoIdentidad) {
        mostrarErrorPerfil({ codigo: 'IDENTIDAD', mensaje: MENSAJES_PERFIL.IDENTIDAD });
        return;
      }
      estado.reverificoIdentidad = true;
      void comprobar();
      return;
    }
    if (clasificacion.tipo === 'ERROR') {
      mostrarErrorPerfil({ codigo: clasificacion.codigo, mensaje: conAviso(clasificacion.mensaje) });
      return;
    }
    estado.reverificoIdentidad = false;
    const { perfil } = clasificacion;
    e.nombre.textContent = perfil.nombreVisible ?? MENSAJES.NOMBRE_SIN_COMPLETAR;
    e.vendedor.textContent = perfil.vendedorActivado ? MENSAJES.VENDEDOR_ACTIVO : MENSAJES.VENDEDOR_INACTIVO;
    const faltante = [perfil.nombreVisible === null && 'tu nombre', perfil.campusId === null && 'tu campus']
      .filter(Boolean).join(' y ');
    anuncioPerfil.mostrar(conAviso(perfil.completo ? MENSAJES.PERFIL_COMPLETO : MENSAJES.PERFIL_INCOMPLETO.replace('{faltante}', faltante)));
    // La edición se habilita cuando el perfil terminó de cargarse, con la universidad deducida del campus si se encontró.
    const habilitarEdicion = (universidadId = null) => {
      estado.perfil = { nombreVisible: perfil.nombreVisible, campusId: perfil.campusId, version: perfil.version, universidadId };
      actualizarEditar();
    };
    if (perfil.campusId === null) {
      e.universidad.textContent = MENSAJES.CAMPUS_SIN_COMPLETAR;
      habilitarEdicion();
      return;
    }
    e.universidad.textContent = MENSAJES.CAMPUS_CARGANDO;
    let campus;
    try {
      campus = await esperarAuth(() => resolverCampus(perfil.campusId, servicios, vigente), esperaAuthMs);
    } catch {
      campus = { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA' };
    }
    if (campus === null || !vigente()) return;
    if (campus.tipo === 'ENCONTRADO') {
      e.universidad.textContent = campus.texto;
      habilitarEdicion(campus.universidadId);
    } else if (campus.tipo === 'NO_ENCONTRADO') {
      e.universidad.textContent = MENSAJES.CAMPUS_NO_ENCONTRADO;
      habilitarEdicion();
    } else {
      e.universidad.textContent = MENSAJES.CAMPUS_ERROR;
      e.perfilEstado.setAttribute('data-codigo', campus.codigo);
      alternar(e.zonaPerfilReintentar, true);
      habilitarEdicion();
    }
  }

  /* Edición del perfil */
  const camposEdicion = () => [[e.editarNombre, e.editarNombreError], [e.editarUniversidad, e.editarUniversidadError],
    [e.editarCampus, e.editarCampusError]];
  const controlesEdicion = () => [e.editarNombre, e.editarUniversidad, e.editarCampus, e.editarGuardar, e.editarCancelar,
    e.editarReintentar];

  function actualizarEditar() {
    const disponible = estado.perfil !== null && edicion === null && !estado.cerrando && !estado.desmontado
      && estado.vista === 'autenticado';
    if (disponible) e.editar.removeAttribute('aria-disabled');
    else e.editar.setAttribute('aria-disabled', 'true');
    // La ayuda explica por qué no está disponible mientras el perfil no esté cargado.
    if (estado.perfil === null) e.editar.setAttribute('aria-describedby', IDS.editarAyuda);
    else e.editar.removeAttribute('aria-describedby');
    e.editar.setAttribute('aria-expanded', String(edicion !== null));
  }

  function marcarError(control, nodo, texto) {
    nodo.textContent = texto ?? '';
    alternar(nodo, Boolean(texto));
    if (texto) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }

  function llenarSelect(select, indicacion, opciones = [], seleccion = '') {
    const crearOpcion = (valor, texto) => {
      const opcion = documento.createElement('option');
      opcion.value = valor;
      opcion.textContent = texto;
      return opcion;
    };
    select.replaceChildren(crearOpcion('', indicacion), ...opciones.map(({ id, texto }) => crearOpcion(id, texto)));
    select.value = opciones.some(({ id }) => id === seleccion) ? seleccion : '';
  }

  function habilitarControles() {
    const enviando = edicion?.enviando === true;
    e.editarNombre.disabled = enviando;
    e.editarUniversidad.disabled = enviando || !edicion || edicion.universidades.size === 0;
    e.editarCampus.disabled = enviando || !edicion || edicion.campus.size === 0;
    for (const control of [e.editarGuardar, e.editarCancelar, e.editarReintentar]) control.disabled = enviando;
    if (enviando) e.formEditar.setAttribute('aria-busy', 'true');
    else e.formEditar.removeAttribute('aria-busy');
  }

  function mostrarMensajeEdicion(texto, codigo = null) {
    if (codigo) e.editarMensaje.setAttribute('data-codigo', codigo);
    else e.editarMensaje.removeAttribute('data-codigo');
    anuncioEdicion.mostrar(texto);
  }

  function ocultarMensajeEdicion() {
    e.editarMensaje.removeAttribute('data-codigo');
    anuncioEdicion.ocultar();
    if (documento.activeElement === e.editarReintentar) e.editarNombre.focus();
    alternar(e.zonaEditarReintentar, false);
  }

  // Cierra el formulario y borra lo escrito. Invalida cargas de directorio y envíos en curso.
  function descartarEdicion() {
    estado.turnoEdicion += 1;
    const conFoco = controlesEdicion().includes(documento.activeElement);
    edicion = null;
    e.editarNombre.value = '';
    for (const select of [e.editarUniversidad, e.editarCampus]) {
      select.replaceChildren();
      select.value = '';
    }
    for (const [control, nodo] of camposEdicion()) marcarError(control, nodo, null);
    ocultarMensajeEdicion();
    habilitarControles();
    alternar(e.zonaEditar, false);
    if (conFoco) e.raiz.focus();
    actualizarEditar();
  }

  // Vigente solo para el mismo formulario y la misma cuenta, sin cierre de sesión en curso.
  const edicionVigente = (ed, turno) => edicion === ed && estado.turnoEdicion === turno && !estado.desmontado
    && !estado.cerrando && estado.vista === 'autenticado' && estado.usuarioId === ed.actor;

  function abrirEdicion() {
    const perfil = estado.perfil;
    if (!perfil || edicion || estado.cerrando || estado.desmontado || estado.vista !== 'autenticado' || !estado.usuarioId) return;
    estado.turnoEdicion += 1;
    // actorEsperado se fija al abrir y se conserva durante toda la operación; Guardar no lo vuelve a obtener.
    edicion = { actor: estado.usuarioId, version: perfil.version,
      inicial: { universidadId: perfil.universidadId, campusId: perfil.campusId },
      universidades: new Map(), campus: new Map(), universidadId: '', turnoCampus: 0, falla: null, enviando: false };
    e.editarNombre.value = perfil.nombreVisible ?? '';
    for (const [control, nodo] of camposEdicion()) marcarError(control, nodo, null);
    ocultarMensajeEdicion();
    alternar(e.zonaEditar, true);
    actualizarEditar();
    e.editarNombre.focus();
    void cargarUniversidadesEdicion();
  }

  function fallaDirectorio(ed, tipo, codigo, base) {
    ed.falla = tipo;
    const sufijo = Object.hasOwn(SUFIJOS_DIRECTORIO, codigo) ? SUFIJOS_DIRECTORIO[codigo] : 'Inténtalo de nuevo.';
    mostrarMensajeEdicion(`${base} ${sufijo}`, codigo);
    alternar(e.zonaEditarReintentar, true);
    habilitarControles();
  }

  async function consultarDirectorio(operacion) {
    try {
      return await esperarAuth(operacion, esperaAuthMs);
    } catch (error) {
      return { ok: false, datos: null, error: { codigo: error?.codigo === 'ESPERA_AGOTADA' ? 'ESPERA_AGOTADA' : 'RESPUESTA_INVALIDA' } };
    }
  }

  async function cargarUniversidadesEdicion() {
    const ed = edicion;
    if (!ed) return;
    const turno = estado.turnoEdicion;
    Object.assign(ed, { universidades: new Map(), campus: new Map(), universidadId: '', falla: null });
    ed.turnoCampus += 1;
    llenarSelect(e.editarUniversidad, MENSAJES_DIRECTORIO.CARGANDO_UNIVERSIDADES);
    llenarSelect(e.editarCampus, MENSAJES_DIRECTORIO.PRIMERO_UNIVERSIDAD);
    ocultarMensajeEdicion();
    habilitarControles();
    const respuesta = await consultarDirectorio(() => servicios.consultarUniversidades());
    if (!edicionVigente(ed, turno)) return;
    llenarSelect(e.editarUniversidad, MENSAJES_DIRECTORIO.ELEGIR_UNIVERSIDAD);
    const lista = respuesta?.ok === true && Array.isArray(respuesta.datos) ? respuesta.datos : null;
    if (!lista) return fallaDirectorio(ed, 'universidades', codigoDe(respuesta), MENSAJES_DIRECTORIO.ERROR_UNIVERSIDADES);
    if (!lista.every(u => esUuid(u?.id) && textoValido(u.nombre))) {
      return fallaDirectorio(ed, 'universidades', 'RESPUESTA_INVALIDA', MENSAJES_DIRECTORIO.ERROR_UNIVERSIDADES);
    }
    if (lista.length === 0) return fallaDirectorio(ed, 'universidades', 'SIN_DATOS', MENSAJES_DIRECTORIO.SIN_UNIVERSIDADES);
    for (const universidad of lista) ed.universidades.set(universidad.id, universidad);
    const preferida = lista.find(u => igualId(u.id, ed.inicial.universidadId));
    llenarSelect(e.editarUniversidad, MENSAJES_DIRECTORIO.ELEGIR_UNIVERSIDAD,
      lista.map(u => ({ id: u.id, texto: textoValido(u.sigla) ? `${u.nombre} (${u.sigla})` : u.nombre })), preferida?.id);
    habilitarControles();
    if (preferida) {
      ed.universidadId = preferida.id;
      void cargarCampusEdicion(preferida.id);
    }
  }

  async function cargarCampusEdicion(universidadId) {
    const ed = edicion;
    if (!ed) return;
    const turno = estado.turnoEdicion;
    ed.turnoCampus += 1;
    const turnoCampus = ed.turnoCampus;
    ed.campus = new Map();
    ed.falla = null;
    llenarSelect(e.editarCampus, MENSAJES_DIRECTORIO.CARGANDO_CAMPUS);
    ocultarMensajeEdicion();
    habilitarControles();
    const respuesta = await consultarDirectorio(() => servicios.consultarCampus(universidadId));
    // Una respuesta de una universidad anterior no reemplaza la lista actual.
    if (!edicionVigente(ed, turno) || ed.turnoCampus !== turnoCampus || ed.universidadId !== universidadId) return;
    llenarSelect(e.editarCampus, MENSAJES_DIRECTORIO.ELEGIR_CAMPUS);
    const lista = respuesta?.ok === true && Array.isArray(respuesta.datos) ? respuesta.datos : null;
    if (!lista) return fallaDirectorio(ed, 'campus', codigoDe(respuesta), MENSAJES_DIRECTORIO.ERROR_CAMPUS);
    if (!lista.every(c => esUuid(c?.id) && igualId(c.universidadId, universidadId) && textoValido(c.nombre))) {
      return fallaDirectorio(ed, 'campus', 'RESPUESTA_INVALIDA', MENSAJES_DIRECTORIO.ERROR_CAMPUS);
    }
    if (lista.length === 0) return fallaDirectorio(ed, 'campus', 'SIN_DATOS', MENSAJES_DIRECTORIO.SIN_CAMPUS);
    for (const campus of lista) ed.campus.set(campus.id, campus);
    const preferido = igualId(universidadId, ed.inicial.universidadId) ? lista.find(c => igualId(c.id, ed.inicial.campusId)) : undefined;
    llenarSelect(e.editarCampus, MENSAJES_DIRECTORIO.ELEGIR_CAMPUS, lista.map(c => ({ id: c.id, texto: c.nombre })), preferido?.id);
    habilitarControles();
  }

  // Valida contra las listas cargadas; devuelve la entrada del contrato o null y marca los campos.
  function validarFormulario(ed) {
    const nombreVisible = e.editarNombre.value;
    const universidadId = e.editarUniversidad.value;
    const campusId = e.editarCampus.value;
    const codigoNombre = validarNombreVisible(nombreVisible);
    const campus = ed.campus.get(campusId);
    const errores = [
      [e.editarNombre, e.editarNombreError, codigoNombre && MENSAJES_CAMPO[codigoNombre]],
      [e.editarUniversidad, e.editarUniversidadError,
        ed.universidades.has(universidadId) && universidadId === ed.universidadId ? null : MENSAJES_CAMPO.UNIVERSIDAD],
      [e.editarCampus, e.editarCampusError, campus && igualId(campus.universidadId, universidadId) ? null : MENSAJES_CAMPO.CAMPUS],
    ];
    for (const [control, nodo, texto] of errores) marcarError(control, nodo, texto);
    const primero = errores.find(([, , texto]) => texto);
    if (primero) {
      primero[0].focus();
      return null;
    }
    return { nombreVisible, universidadId, campusId, versionEsperada: ed.version };
  }

  async function guardarEdicion() {
    const ed = edicion;
    if (!ed || ed.enviando || !edicionVigente(ed, estado.turnoEdicion)) return;
    const turno = estado.turnoEdicion;
    const entrada = validarFormulario(ed);
    if (!entrada) return;
    ed.enviando = true;
    habilitarControles();
    ocultarMensajeEdicion();
    mostrarMensajeEdicion(MENSAJES_EDICION.GUARDANDO);
    let resultado;
    try {
      resultado = clasificarActualizacion(await esperarAuth(
        () => servicios.actualizarMiPerfil(entrada, { actorEsperado: ed.actor }), esperaAuthMs), ed.actor);
    } catch (error) {
      resultado = { tipo: 'ERROR', codigo: error?.codigo === 'ESPERA_AGOTADA' ? 'ESPERA_AGOTADA' : 'RESPUESTA_INVALIDA' };
    }
    // Cambio de cuenta, cierre de sesión o formulario descartado: no se informa nada, tampoco un éxito.
    if (!edicionVigente(ed, turno)) return;
    const codigo = resultado.tipo === 'ERROR' ? resultado.codigo : resultado.tipo;
    if (codigo === 'NO_AUTORIZADO') {
      // Se protegen los datos antes de verificar la sesión.
      limpiarPerfil();
      void comprobar(MENSAJES_EDICION.NO_AUTORIZADO);
      return;
    }
    if (['GUARDADO', 'NO_CONFIRMADO', 'CONFLICTO', 'NO_ENCONTRADO'].includes(codigo)) {
      // Se muestran los datos que confirme el servidor; nunca se reintenta ni se sobrescribe automáticamente.
      descartarEdicion();
      void cargarPerfil(MENSAJES_EDICION[codigo]);
      return;
    }
    // Errores recuperables: se conserva lo escrito (misma cuenta y mismo formulario) y se permite reintentar.
    ed.enviando = false;
    habilitarControles();
    mostrarMensajeEdicion(Object.hasOwn(MENSAJES_EDICION, codigo) ? MENSAJES_EDICION[codigo] : MENSAJES_EDICION.GENERICO, codigo);
    e.editarGuardar.focus();
  }

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
    limpiarPerfil();
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
    limpiarPerfil();
    for (const zona of [e.zonaReintentar, e.zonaCerrar, e.pendiente]) alternar(zona, false);
    alternar(e.acceso, true);
    region.mostrar(texto, tono);
  }

  function mostrarError({ mensaje, reintentable }) {
    estado.vista = 'error';
    estado.usuarioId = null;
    ocupado(false);
    limpiarCorreo();
    limpiarPerfil();
    for (const zona of [e.acceso, e.zonaCerrar, e.pendiente]) alternar(zona, false);
    alternar(e.zonaReintentar, reintentable);
    region.mostrar(mensaje, 'error');
  }

  async function comprobar(avisoPerfil = null) {
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
    if (clasificacion.tipo === 'AUTENTICADO') {
      mostrarAutenticado(clasificacion);
      // El perfil se consulta solo después de confirmar la sesión.
      void cargarPerfil(typeof avisoPerfil === 'string' ? avisoPerfil : null);
    } else if (clasificacion.tipo === 'SIN_SESION') mostrarSinSesion(MENSAJES.SIN_SESION, 'aviso');
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
    limpiarPerfil();
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
      limpiarPerfil();
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
  // Tras un cambio de identidad se revalida la sesión; en otros errores basta reconsultar el perfil.
  const alReintentarPerfil = () => {
    const identidad = e.perfilEstado.getAttribute('data-codigo') === 'IDENTIDAD';
    estado.reverificoIdentidad = false;
    void (identidad ? comprobar() : cargarPerfil());
  };
  const alEditar = () => { abrirEdicion(); };
  const alCancelarEdicion = () => {
    if (!edicion || edicion.enviando) return;
    descartarEdicion();
    if (e.editar.getAttribute('aria-disabled') !== 'true') e.editar.focus();
  };
  const alGuardarEdicion = evento => {
    evento?.preventDefault?.();
    void guardarEdicion();
  };
  const alReintentarDirectorio = () => {
    const ed = edicion;
    if (!ed || ed.enviando) return;
    if (ed.falla === 'universidades') void cargarUniversidadesEdicion();
    else if (ed.falla === 'campus' && ed.universidadId) void cargarCampusEdicion(ed.universidadId);
  };
  const alCambiarUniversidad = () => {
    const ed = edicion;
    if (!ed || ed.enviando) return;
    marcarError(e.editarUniversidad, e.editarUniversidadError, null);
    marcarError(e.editarCampus, e.editarCampusError, null);
    const valor = e.editarUniversidad.value;
    ed.universidadId = ed.universidades.has(valor) ? valor : '';
    // El campus elegido pertenece a la universidad anterior: se descarta antes de cargar los nuevos.
    ed.turnoCampus += 1;
    ed.campus = new Map();
    llenarSelect(e.editarCampus, MENSAJES_DIRECTORIO.PRIMERO_UNIVERSIDAD);
    if (ed.falla === 'campus') {
      ed.falla = null;
      ocultarMensajeEdicion();
    }
    habilitarControles();
    if (ed.universidadId) void cargarCampusEdicion(ed.universidadId);
  };
  const alCambiarCampus = () => { if (edicion) marcarError(e.editarCampus, e.editarCampusError, null); };
  const alEscribirNombre = () => { if (edicion) marcarError(e.editarNombre, e.editarNombreError, null); };
  const oyentesEdicion = [[e.editar, 'click', alEditar], [e.editarCancelar, 'click', alCancelarEdicion],
    [e.formEditar, 'submit', alGuardarEdicion], [e.editarReintentar, 'click', alReintentarDirectorio],
    [e.editarUniversidad, 'change', alCambiarUniversidad], [e.editarCampus, 'change', alCambiarCampus],
    [e.editarNombre, 'input', alEscribirNombre]];

  const montaje = {
    comprobar,
    desmontar() {
      if (estado.desmontado) return;
      estado.desmontado = true;
      estado.turno += 1;
      limpiarCorreo();
      limpiarPerfil();
      e.reintentar.removeEventListener('click', alReintentar);
      e.cerrar.removeEventListener('click', alCerrar);
      e.perfilReintentar.removeEventListener('click', alReintentarPerfil);
      for (const [elemento, tipo, oyente] of oyentesEdicion) elemento.removeEventListener(tipo, oyente);
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
  e.perfilReintentar.addEventListener('click', alReintentarPerfil);
  for (const [elemento, tipo, oyente] of oyentesEdicion) elemento.addEventListener(tipo, oyente);
  descartarEdicion(); // Estado inicial: formulario cerrado y «Editar perfil» no disponible.
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
