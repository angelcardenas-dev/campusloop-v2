import { registrar, iniciarSesion, obtenerEstadoAuth } from './auth.js';
import { consultarUniversidades, consultarCampus } from './directorios.js';

/* Elementos: IDs y tipos verificados contra login.html y registro.html */
const SELECTOR_BOTON = 'button[type="submit"].auth-submit';
const CAMPOS_LOGIN = Object.freeze([
  { id: 'correo', etiqueta: 'INPUT', tipo: 'email' },
  { id: 'contrasena', etiqueta: 'INPUT', tipo: 'password' },
]);
const CAMPOS_REGISTRO = Object.freeze([
  { id: 'nombre', etiqueta: 'INPUT', tipo: 'text' },
  { id: 'universidad', etiqueta: 'SELECT' },
  { id: 'campus', etiqueta: 'SELECT' },
  { id: 'correo', etiqueta: 'INPUT', tipo: 'email' },
  { id: 'contrasena', etiqueta: 'INPUT', tipo: 'password' },
  { id: 'confirmar-contrasena', etiqueta: 'INPUT', tipo: 'password' },
  { id: 'terminos', etiqueta: 'INPUT', tipo: 'checkbox' },
]);
const CAMPOS_PENDIENTE_CONFIRMACION = Object.freeze(['contrasena', 'confirmar-contrasena']);
// Estado y reintento de cada directorio: verificados contra registro.html.
const ELEMENTOS_CATALOGO = Object.freeze(['universidad-estado', 'universidad-reintentar-zona', 'universidad-reintentar',
  'campus-estado', 'campus-reintentar-zona', 'campus-reintentar']);

/* Datos */
const DESTINO = 'inicio.html'; // SPEC_TB4 §10.1: login.html → inicio.html
// Reglas copiadas de auth.js (correoValido, contrasenaValida, registroValido): mantenerlas alineadas.
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Nombre: intersección de auth.js (máximo 100 unidades UTF-16) y perfiles.js (mínimo 2 puntos
// de código, sin C1). Así ningún nombre aceptado aquí lo rechaza después ninguno de los dos.
// Alineación definitiva del contrato pendiente de coordinación con Auth.
const NOMBRE_PROHIBIDO = /[\u0000-\u001f\u007f-\u009f<>]/;
const SURROGADO_SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// Solo formato. No prueba que el ID pertenezca al catálogo: eso corresponde al catálogo de Bernabé y a RLS.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIEMPO_AVISO_MS = 10000;
const TONOS = Object.freeze({ info: 'alert', aviso: 'alert alert-warning', error: 'alert alert-error' });
const MENSAJES = Object.freeze({
  NOMBRE_VACIO: 'Ingresa tu nombre completo.',
  NOMBRE_LONGITUD: 'El nombre debe tener entre 2 y 100 caracteres.',
  NOMBRE_CARACTERES: 'El nombre no puede contener los caracteres < o > ni caracteres de control, como saltos de línea o tabulaciones.',
  NOMBRE_INVALIDO: 'El nombre contiene caracteres que no se pueden procesar. Vuelve a escribirlo.',
  UNIVERSIDAD_VACIA: 'Selecciona tu universidad.',
  UNIVERSIDAD_INVALIDA: 'Selecciona una universidad del catálogo.',
  CAMPUS_VACIO: 'Selecciona tu campus.',
  CAMPUS_INVALIDO: 'Selecciona un campus del catálogo.',
  CORREO_VACIO: 'Ingresa tu correo universitario.',
  CORREO_INVALIDO: 'Ingresa un correo válido.',
  CONTRASENA_VACIA: 'Ingresa tu contraseña.',
  CONTRASENA_CORTA: 'La contraseña debe tener al menos 8 caracteres.',
  CONTRASENA_LARGA: 'La contraseña no puede superar 128 caracteres.',
  CONTRASENA_ESPACIOS: 'La contraseña no puede contener solo espacios.',
  CONFIRMAR_VACIA: 'Confirma tu contraseña.',
  CONFIRMAR_DISTINTA: 'Las contraseñas no coinciden.',
  TERMINOS: 'Debes aceptar los Términos y Condiciones y la Política de Privacidad.',
  CATALOGO: 'El catálogo de universidades no está disponible. Reintenta la carga para continuar.',
  UNIVERSIDADES_CARGANDO: 'Cargando universidades…',
  UNIVERSIDADES_SELECCIONA: 'Selecciona tu universidad',
  UNIVERSIDADES_NO_DISPONIBLES: 'Universidades no disponibles',
  UNIVERSIDADES_VACIO: 'No hay universidades disponibles por ahora. Puedes reintentar más tarde.',
  UNIVERSIDADES_ERROR: 'No se pudieron cargar las universidades.',
  CAMPUS_SIN_UNIVERSIDAD: 'Primero selecciona una universidad',
  CAMPUS_CARGANDO: 'Cargando campus…',
  CAMPUS_SELECCIONA: 'Selecciona tu campus',
  CAMPUS_NO_DISPONIBLES: 'Campus no disponibles',
  CAMPUS_VACIO_ESTADO: 'Esta universidad no tiene campus disponibles por ahora.',
  CAMPUS_ERROR: 'No se pudieron cargar los campus.',
  DIRECTORIO_CONFIGURACION: 'No se pudo conectar con el servicio. Inténtalo más tarde.',
  DIRECTORIO_RED: 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.',
  DIRECTORIO_LIMITE: 'Se hicieron demasiadas consultas. Espera un momento antes de reintentar.',
  DIRECTORIO_NO_AUTORIZADO: 'El servicio no permitió consultar el catálogo. Inténtalo más tarde.',
  SESION_INDETERMINADA: 'No pudimos comprobar si ya tienes una sesión iniciada. Revisa tu conexión y recarga la página.',
  SESION_DEMORA: 'La comprobación de tu sesión está tardando más de lo habitual.',
  PENDIENTE_CONFIRMACION: 'Si el correo puede registrarse, recibirás un enlace para confirmar tu cuenta. Revísalo antes de iniciar sesión. Tu nombre, universidad y campus todavía no se han guardado en tu perfil.',
  INESPERADO: 'No pudimos completar la operación. Inténtalo más tarde.',
});
const montajes = new WeakMap();

/* Funciones: validación y contrato, sin DOM (exportadas para pruebas offline) */
function errorCorreo(correo) {
  const limpio = correo.trim();
  if (!limpio) return MENSAJES.CORREO_VACIO;
  if (limpio.length > 254 || !CORREO.test(limpio)) return MENSAJES.CORREO_INVALIDO;
  return null;
}

// = auth.js contrasenaValida(contrasena, 1), usada por iniciarSesion().
function errorContrasenaLogin(contrasena) {
  if (!contrasena) return MENSAJES.CONTRASENA_VACIA;
  if (contrasena.length > 128) return MENSAJES.CONTRASENA_LARGA;
  if (!contrasena.trim()) return MENSAJES.CONTRASENA_ESPACIOS;
  return null;
}

// = auth.js contrasenaValida(contrasena, 8), usada por registroValido().
function errorContrasenaRegistro(contrasena) {
  if (!contrasena) return MENSAJES.CONTRASENA_VACIA;
  if (contrasena.length < 8) return MENSAJES.CONTRASENA_CORTA;
  if (contrasena.length > 128) return MENSAJES.CONTRASENA_LARGA;
  if (!contrasena.trim()) return MENSAJES.CONTRASENA_ESPACIOS;
  return null;
}

function sinNulos(errores) {
  return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}

export function validarLogin(valores) {
  // Login acepta 1–128 caracteres: no imponer el mínimo de registro a cuentas existentes.
  return sinNulos({
    correo: errorCorreo(valores.correo),
    contrasena: errorContrasenaLogin(valores.contrasena),
  });
}

export function validarRegistro(valores, { catalogoDisponible }) {
  const nombre = valores.nombre.trim();
  let universidad = null;
  if (!catalogoDisponible) universidad = MENSAJES.CATALOGO;
  else if (!valores.universidad) universidad = MENSAJES.UNIVERSIDAD_VACIA;
  else if (!UUID.test(valores.universidad)) universidad = MENSAJES.UNIVERSIDAD_INVALIDA;
  let campus = null;
  if (!universidad) {
    if (!valores.campus) campus = MENSAJES.CAMPUS_VACIO;
    else if (!UUID.test(valores.campus)) campus = MENSAJES.CAMPUS_INVALIDO;
  }
  let confirmar = null;
  if (!valores['confirmar-contrasena']) confirmar = MENSAJES.CONFIRMAR_VACIA;
  else if (valores['confirmar-contrasena'] !== valores.contrasena) confirmar = MENSAJES.CONFIRMAR_DISTINTA;
  return sinNulos({
    nombre: !nombre ? MENSAJES.NOMBRE_VACIO
      : SURROGADO_SUELTO.test(valores.nombre) ? MENSAJES.NOMBRE_INVALIDO
        : Array.from(nombre).length < 2 || nombre.length > 100 ? MENSAJES.NOMBRE_LONGITUD
          : NOMBRE_PROHIBIDO.test(valores.nombre) ? MENSAJES.NOMBRE_CARACTERES : null,
    universidad,
    campus,
    correo: errorCorreo(valores.correo),
    contrasena: errorContrasenaRegistro(valores.contrasena),
    'confirmar-contrasena': confirmar,
    terminos: valores.terminos === true ? null : MENSAJES.TERMINOS,
  });
}

export function clasificarSesion(resultado) {
  if (!resultado || typeof resultado !== 'object') return { tipo: 'INDETERMINADO' };
  if (resultado.ok === true) {
    if (resultado.datos?.estado === 'AUTENTICADO') return { tipo: 'AUTENTICADO' };
    if (resultado.datos?.estado === 'NO_AUTENTICADO') return { tipo: 'NO_AUTENTICADO' };
    return { tipo: 'INDETERMINADO' };
  }
  if (resultado.error?.codigo === 'CONFIGURACION' && typeof resultado.error.mensaje === 'string') {
    return { tipo: 'SIN_CONFIGURACION', mensaje: resultado.error.mensaje };
  }
  // NO_AUTORIZADO incluido: auth.js también lo usa para cualquier 401/403 y no garantiza ausencia de sesión.
  return { tipo: 'INDETERMINADO' };
}

export function datosRegistro(valores) {
  // Contrato de registrar(); la contraseña se envía sin modificar.
  return {
    nombreVisible: valores.nombre.trim(),
    universidadId: valores.universidad,
    campusId: valores.campus,
    correo: valores.correo.trim(),
    contrasena: valores.contrasena,
    confirmarContrasena: valores['confirmar-contrasena'],
    aceptaTerminos: valores.terminos === true,
  };
}

/* Funciones: DOM */
function buscarElementos(form, definiciones, idMensaje) {
  const documento = form.ownerDocument;
  const dentro = id => {
    const elemento = documento.getElementById(id);
    return elemento && form.contains(elemento) ? elemento : null;
  };
  const botones = form.querySelectorAll(SELECTOR_BOTON);
  const region = dentro(idMensaje);
  if (botones.length !== 1 || region?.tagName !== 'DIV') return null;
  const campos = [];
  for (const definicion of definiciones) {
    const control = dentro(definicion.id);
    const error = dentro(`${definicion.id}-error`);
    if (control?.tagName !== definicion.etiqueta || (definicion.tipo && control.type !== definicion.tipo)
      || error?.tagName !== 'P') return null;
    campos.push({ id: definicion.id, control, error });
  }
  return { boton: botones[0], region, campos, porId: Object.fromEntries(campos.map(campo => [campo.id, campo])) };
}

function leerValores(campos) {
  return Object.fromEntries(campos.map(({ id, control }) => [id, control.type === 'checkbox' ? control.checked : control.value]));
}

function catalogoDisponible(select) {
  return Array.from(select.options).some(opcion => !opcion.disabled && opcion.value !== '');
}

function mostrarErrorCampo({ control, error }, texto) {
  error.textContent = texto;
  error.hidden = false;
  control.setAttribute('aria-invalid', 'true');
}

function limpiarErrorCampo({ control, error }) {
  // aria-describedby lee también el texto oculto: vaciarlo además de ocultarlo.
  error.textContent = '';
  error.hidden = true;
  control.removeAttribute('aria-invalid');
}

function enfocarPrimerInvalido(campos, errores) {
  campos.find(campo => errores[campo.id] && !campo.control.disabled)?.control.focus();
}

function vaciarContrasenas(porId) {
  for (const id of CAMPOS_PENDIENTE_CONFIRMACION) {
    const campo = porId[id];
    if (campo?.control.type !== 'password') continue;
    campo.control.value = '';
    limpiarErrorCampo(campo);
  }
}

function crearRegion(region) {
  const ventana = region.ownerDocument.defaultView;
  const enSiguienteCuadro = ventana?.requestAnimationFrame?.bind(ventana) ?? (funcion => setTimeout(funcion, 0));
  let turno = 0;
  let origen = null; // 'sesion' | 'envio' | null
  const ocultar = () => {
    turno += 1;
    origen = null;
    region.textContent = '';
    // .alert declara display: flex y anula hidden: retirar la clase al ocultar.
    region.removeAttribute('class');
    region.hidden = true;
  };
  const mostrar = (texto, tono, de) => {
    turno += 1;
    const actual = turno;
    origen = de;
    region.textContent = '';
    region.className = TONOS[tono];
    region.hidden = false;
    // Escribir tras mostrar la región para que el lector de pantalla lo anuncie.
    enSiguienteCuadro(() => { if (actual === turno) region.textContent = texto; });
  };
  return {
    mostrar,
    mostrarDeSesion(texto, tono) {
      // Un mensaje de envío visible tiene prioridad sobre los de sesión.
      if (origen === 'envio') return false;
      mostrar(texto, tono, 'sesion');
      return true;
    },
    ocultar,
    ocultarSi(de) { if (origen === de) ocultar(); },
  };
}

function crearEstado(boton, form) {
  const estado = {
    inicializado: false, comprobado: false, enviando: false, redirigiendo: false, desmontado: false,
    turnoSesion: 0,
    // Un temporizador por comprobación: cada una limpia el suyo y desmontar() cancela los pendientes.
    avisosSesion: new Set(),
    // Condición propia del formulario (Registro: catálogo y validez). Login no la usa.
    condicion: () => true,
    // Único punto que escribe disabled: ningún finally habilita el botón directamente.
    actualizar() {
      let cumple = false;
      try { cumple = estado.condicion() === true; } catch { cumple = false; }
      boton.disabled = !(estado.inicializado && estado.comprobado && !estado.enviando
        && !estado.redirigiendo && !estado.desmontado && cumple);
      if (estado.enviando && !estado.desmontado) form.setAttribute('aria-busy', 'true');
      else form.removeAttribute('aria-busy');
    },
  };
  return estado;
}

/* Funciones: redirección */
function redirigir(ctx) {
  if (ctx.estado.desmontado) return;
  ctx.estado.redirigiendo = true;
  ctx.estado.actualizar();
  try {
    ctx.navegar(DESTINO);
  } catch {
    ctx.region.mostrar(MENSAJES.INESPERADO, 'error', 'envio');
  }
}

/* Funciones: comprobación de sesión */
async function comprobarSesion(ctx) {
  const { estado, region } = ctx;
  if (estado.redirigiendo || estado.desmontado) return;
  estado.turnoSesion += 1;
  const turno = estado.turnoSesion;
  const vigente = () => turno === estado.turnoSesion && !estado.redirigiendo && !estado.desmontado;
  estado.comprobado = false;
  estado.actualizar();
  const aviso = setTimeout(() => {
    estado.avisosSesion.delete(aviso);
    if (vigente()) region.mostrarDeSesion(MENSAJES.SESION_DEMORA, 'info');
  }, TIEMPO_AVISO_MS);
  estado.avisosSesion.add(aviso);
  let clasificacion;
  try {
    clasificacion = clasificarSesion(await ctx.servicios.obtenerEstadoAuth());
  } catch {
    clasificacion = { tipo: 'INDETERMINADO' };
  } finally {
    clearTimeout(aviso);
    estado.avisosSesion.delete(aviso);
  }
  // Una comprobación antigua o desmontada no escribe nada.
  if (!vigente()) return;

  if (clasificacion.tipo === 'AUTENTICADO') {
    redirigir(ctx);
    return;
  }
  if (clasificacion.tipo === 'INDETERMINADO') {
    // comprobado sigue false: el botón permanece deshabilitado.
    region.mostrarDeSesion(MENSAJES.SESION_INDETERMINADA, 'aviso');
    return;
  }
  const avisos = [...(clasificacion.tipo === 'SIN_CONFIGURACION' ? [clasificacion.mensaje] : []), ...ctx.avisosAlCargar()];
  if (avisos.length) region.mostrarDeSesion(avisos.join(' '), 'aviso');
  else region.ocultarSi('sesion');
  estado.comprobado = true;
  estado.actualizar();
}

/* Funciones: procesamiento del envío */
async function procesarEnvio(ctx) {
  const { estado, region, campos, boton } = ctx;
  if (!estado.inicializado || !estado.comprobado || estado.enviando || estado.redirigiendo) return;
  region.ocultar();
  campos.forEach(limpiarErrorCampo);
  const valores = leerValores(campos);
  const errores = ctx.validar(valores);
  if (Object.keys(errores).length) {
    for (const campo of campos) if (errores[campo.id]) mostrarErrorCampo(campo, errores[campo.id]);
    enfocarPrimerInvalido(campos, errores);
    return;
  }
  const teniaFoco = boton.ownerDocument.activeElement === boton;
  estado.enviando = true;
  estado.actualizar();
  try {
    const resultado = await ctx.enviar(valores);
    // Tras desmontar no se interpreta: ni mensajes ni redirección.
    if (!estado.desmontado) ctx.interpretar(resultado, ctx);
  } catch {
    // Se conservan los datos del formulario.
    if (!estado.desmontado) region.mostrar(MENSAJES.INESPERADO, 'error', 'envio');
  } finally {
    estado.enviando = false;
    // Un montaje desmontado no vuelve a escribir en el botón: podría pertenecer ya a otro montaje.
    if (!estado.desmontado) {
      estado.actualizar();
      if (teniaFoco && !boton.disabled) boton.focus();
    }
  }
}

function mostrarErrorServicio(ctx, resultado, tono = 'error') {
  if (resultado?.ok === false && typeof resultado.error?.mensaje === 'string') {
    ctx.region.mostrar(resultado.error.mensaje, tono, 'envio');
  } else {
    ctx.region.mostrar(MENSAJES.INESPERADO, 'error', 'envio');
  }
}

/* Funciones: montaje */
function montarFormulario(form, definiciones, idMensaje, crearConfig) {
  if (!form || montajes.has(form)) return null;
  const elementos = buscarElementos(form, definiciones, idMensaje);
  if (!elementos) return null; // El botón conserva el disabled del HTML.
  const ctx = { ...elementos, estado: crearEstado(elementos.boton, form), region: crearRegion(elementos.region) };
  Object.assign(ctx, crearConfig(elementos, ctx));
  if (typeof ctx.puedeEnviar === 'function') ctx.estado.condicion = ctx.puedeEnviar;
  const editados = new Set();
  const alEnviar = evento => {
    evento.preventDefault();
    void procesarEnvio(ctx);
  };
  const alEditar = evento => {
    const campo = ctx.campos.find(({ control }) => control === evento.target);
    if (campo) {
      editados.add(campo.id);
      limpiarErrorCampo(campo);
    }
    if (evento.type === 'change') ctx.alCambiar?.(evento.target);
    ctx.estado.actualizar();
  };
  // Solo con validarAlSalir (Registro): explica por qué el botón sigue deshabilitado.
  const alSalir = evento => {
    const campo = ctx.campos.find(({ control }) => control === evento.target);
    if (!campo || !editados.has(campo.id) || ctx.estado.enviando || ctx.estado.desmontado) return;
    const error = ctx.validar(leerValores(ctx.campos))[campo.id];
    if (error) mostrarErrorCampo(campo, error);
    else limpiarErrorCampo(campo);
  };
  const montaje = {
    comprobar: () => comprobarSesion(ctx),
    desmontar() {
      if (ctx.estado.desmontado) return;
      ctx.estado.desmontado = true;
      ctx.estado.turnoSesion += 1; // Invalida comprobaciones en curso.
      for (const aviso of ctx.estado.avisosSesion) clearTimeout(aviso);
      ctx.estado.avisosSesion.clear();
      form.removeEventListener('submit', alEnviar);
      form.removeEventListener('input', alEditar);
      form.removeEventListener('change', alEditar);
      if (ctx.validarAlSalir) form.removeEventListener('focusout', alSalir);
      try { ctx.alDesmontar?.(); } catch { /* El catálogo ya no escribe tras desmontar. */ }
      ctx.estado.inicializado = false;
      ctx.region.ocultar(); // También cancela escrituras pendientes de la región.
      ctx.estado.actualizar();
      if (montajes.get(form) === montaje) montajes.delete(form);
    },
  };
  try {
    form.addEventListener('submit', alEnviar);
    form.addEventListener('input', alEditar);
    form.addEventListener('change', alEditar);
    if (ctx.validarAlSalir) form.addEventListener('focusout', alSalir);
    montajes.set(form, montaje);
    ctx.estado.inicializado = true; // El botón sigue deshabilitado hasta comprobar la sesión.
    ctx.alMontar?.();
  } catch {
    montaje.desmontar();
    return null;
  }
  void montaje.comprobar();
  return montaje;
}

export function montarLogin({
  form,
  servicios = { iniciarSesion, obtenerEstadoAuth },
  navegar = url => form.ownerDocument.defaultView.location.replace(url),
} = {}) {
  return montarFormulario(form, CAMPOS_LOGIN, 'login-mensaje', () => ({
    servicios,
    navegar,
    avisosAlCargar: () => [],
    validar: validarLogin,
    enviar: valores => servicios.iniciarSesion(valores.correo.trim(), valores.contrasena),
    interpretar(resultado, ctx) {
      if (resultado?.ok === true && resultado.datos?.estado === 'AUTENTICADO') {
        redirigir(ctx);
        return;
      }
      mostrarErrorServicio(ctx, resultado, resultado?.error?.codigo === 'CORREO_PENDIENTE' ? 'aviso' : 'error');
    },
  }));
}

/* Funciones: catálogo de universidades y campus (servicios de directorios.js) */
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

function reemplazarOpciones(select, textoInicial, elementos = []) {
  const crear = (valor, texto, inicial) => {
    const opcion = select.ownerDocument.createElement('option');
    opcion.value = valor;
    opcion.textContent = texto;
    if (inicial) { opcion.disabled = true; opcion.selected = true; }
    return opcion;
  };
  select.replaceChildren(crear('', textoInicial, true), ...elementos.map(({ id, texto }) => crear(id, texto, false)));
  select.value = '';
}

const textoValido = valor => typeof valor === 'string' && valor.trim().length > 0;

// El mensaje del servicio no se muestra: puede contener detalle técnico de configuración.
// Cada código conocido tiene un texto propio; SERVIDOR y lo desconocido usan el respaldo.
const MENSAJES_DIRECTORIO = Object.freeze({
  CONFIGURACION: MENSAJES.DIRECTORIO_CONFIGURACION,
  RED: MENSAJES.DIRECTORIO_RED,
  LIMITE: MENSAJES.DIRECTORIO_LIMITE,
  NO_AUTORIZADO: MENSAJES.DIRECTORIO_NO_AUTORIZADO,
});
function errorDirectorio(resultado, respaldo) {
  const original = resultado?.ok === false ? resultado.error?.codigo : null;
  // Solo el código normalizado queda disponible para diagnóstico, nunca el mensaje original.
  const codigo = typeof original === 'string' && /^[A-Z_]{1,40}$/.test(original) ? original : 'RESPUESTA_INVALIDA';
  return { codigo, mensaje: Object.hasOwn(MENSAJES_DIRECTORIO, codigo) ? MENSAJES_DIRECTORIO[codigo] : respaldo };
}

// Solo se aceptan filas con la forma de directorios.js; nunca se completan datos.
function universidadesDe(resultado) {
  if (resultado?.ok !== true || !Array.isArray(resultado.datos)) return null;
  const lista = resultado.datos.map(u => (UUID.test(u?.id ?? '') && textoValido(u.nombre)
    ? { id: u.id, texto: textoValido(u.sigla) ? `${u.nombre} (${u.sigla})` : u.nombre } : null));
  return lista.every(Boolean) ? lista : null;
}

function campusDe(resultado, universidadId) {
  if (resultado?.ok !== true || !Array.isArray(resultado.datos)) return null;
  const lista = resultado.datos.map(c => (UUID.test(c?.id ?? '') && textoValido(c.nombre)
    && typeof c.universidadId === 'string' && c.universidadId.toLowerCase() === universidadId.toLowerCase()
    ? { id: c.id, texto: c.nombre } : null));
  return lista.every(Boolean) ? lista : null;
}

function crearCatalogo({ universidad, campus, extras, servicios, alActualizar, limpiarCampus }) {
  const anuncioUniversidad = crearAnuncio(extras['universidad-estado']);
  const anuncioCampus = crearAnuncio(extras['campus-estado']);
  const estado = { universidades: 'cargando', campus: 'sin-universidad', campusIds: new Set(),
    turnoUniversidades: 0, turnoCampus: 0, desmontado: false };
  const zona = (nombre, visible) => { extras[`${nombre}-reintentar-zona`].hidden = !visible; };
  // Diagnóstico: el código del último error queda en data-codigo del estado (visible en DevTools).
  const diagnostico = (nombre, codigo) => {
    const elemento = extras[`${nombre}-estado`];
    if (codigo) elemento.setAttribute('data-codigo', codigo);
    else elemento.removeAttribute('data-codigo');
  };
  const documento = universidad.ownerDocument;

  function devolverFoco(nombre, select, teniaFoco) {
    if (!teniaFoco || estado.desmontado) return;
    if (!select.disabled) select.focus();
    else if (!extras[`${nombre}-reintentar-zona`].hidden) extras[`${nombre}-reintentar`].focus();
  }

  async function cargarCampus(universidadId, { teniaFoco = false } = {}) {
    estado.turnoCampus += 1;
    const turno = estado.turnoCampus;
    // El campus anterior se descarta de inmediato, antes de cualquier respuesta.
    estado.campusIds = new Set();
    limpiarCampus();
    campus.disabled = true;
    zona('campus', false);
    diagnostico('campus', null);
    if (!universidadId || !UUID.test(universidadId)) {
      estado.campus = 'sin-universidad';
      reemplazarOpciones(campus, MENSAJES.CAMPUS_SIN_UNIVERSIDAD);
      anuncioCampus.ocultar();
      alActualizar();
      return;
    }
    estado.campus = 'cargando';
    reemplazarOpciones(campus, MENSAJES.CAMPUS_CARGANDO);
    anuncioCampus.mostrar(MENSAJES.CAMPUS_CARGANDO);
    alActualizar();
    let resultado;
    try { resultado = await servicios.consultarCampus(universidadId); } catch { resultado = null; }
    // Una respuesta de una selección anterior o tras desmontar no escribe nada.
    if (estado.desmontado || turno !== estado.turnoCampus || universidad.value !== universidadId) return;
    const lista = campusDe(resultado, universidadId);
    if (lista?.length) {
      estado.campus = 'listo';
      estado.campusIds = new Set(lista.map(c => c.id));
      reemplazarOpciones(campus, MENSAJES.CAMPUS_SELECCIONA, lista);
      campus.disabled = false;
      anuncioCampus.ocultar();
    } else {
      estado.campus = lista ? 'vacio' : 'error';
      reemplazarOpciones(campus, MENSAJES.CAMPUS_NO_DISPONIBLES);
      const error = lista ? null : errorDirectorio(resultado, MENSAJES.CAMPUS_ERROR);
      anuncioCampus.mostrar(error ? error.mensaje : MENSAJES.CAMPUS_VACIO_ESTADO);
      diagnostico('campus', error?.codigo ?? null);
      zona('campus', true);
    }
    alActualizar();
    devolverFoco('campus', campus, teniaFoco);
  }

  async function cargarUniversidades({ teniaFoco = false } = {}) {
    estado.turnoUniversidades += 1;
    const turno = estado.turnoUniversidades;
    estado.universidades = 'cargando';
    universidad.disabled = true;
    reemplazarOpciones(universidad, MENSAJES.UNIVERSIDADES_CARGANDO);
    zona('universidad', false);
    diagnostico('universidad', null);
    anuncioUniversidad.mostrar(MENSAJES.UNIVERSIDADES_CARGANDO);
    void cargarCampus('');
    let resultado;
    try { resultado = await servicios.consultarUniversidades(); } catch { resultado = null; }
    if (estado.desmontado || turno !== estado.turnoUniversidades) return;
    const lista = universidadesDe(resultado);
    if (lista?.length) {
      estado.universidades = 'listo';
      reemplazarOpciones(universidad, MENSAJES.UNIVERSIDADES_SELECCIONA, lista);
      universidad.disabled = false;
      anuncioUniversidad.ocultar();
    } else {
      estado.universidades = lista ? 'vacio' : 'error';
      reemplazarOpciones(universidad, MENSAJES.UNIVERSIDADES_NO_DISPONIBLES);
      const error = lista ? null : errorDirectorio(resultado, MENSAJES.UNIVERSIDADES_ERROR);
      anuncioUniversidad.mostrar(error ? error.mensaje : MENSAJES.UNIVERSIDADES_VACIO);
      diagnostico('universidad', error?.codigo ?? null);
      zona('universidad', true);
    }
    alActualizar();
    devolverFoco('universidad', universidad, teniaFoco);
  }

  const reintentarUniversidades = () => {
    void cargarUniversidades({ teniaFoco: documento.activeElement === extras['universidad-reintentar'] });
  };
  const reintentarCampus = () => {
    void cargarCampus(universidad.value, { teniaFoco: documento.activeElement === extras['campus-reintentar'] });
  };

  return {
    // El campus seleccionado debe pertenecer a la lista cargada para la universidad actual.
    listo: () => estado.universidades === 'listo' && estado.campus === 'listo' && estado.campusIds.has(campus.value),
    montar() {
      extras['universidad-reintentar'].addEventListener('click', reintentarUniversidades);
      extras['campus-reintentar'].addEventListener('click', reintentarCampus);
      void cargarUniversidades();
    },
    cambiarUniversidad: () => { void cargarCampus(universidad.value); },
    desmontar() {
      estado.desmontado = true;
      estado.turnoUniversidades += 1;
      estado.turnoCampus += 1;
      extras['universidad-reintentar'].removeEventListener('click', reintentarUniversidades);
      extras['campus-reintentar'].removeEventListener('click', reintentarCampus);
      anuncioUniversidad.ocultar();
      anuncioCampus.ocultar();
    },
  };
}

export function montarRegistro({
  form,
  servicios = { registrar, obtenerEstadoAuth, consultarUniversidades, consultarCampus },
  navegar = url => form.ownerDocument.defaultView.location.replace(url),
} = {}) {
  if (!form?.ownerDocument) return null;
  const extras = {};
  for (const id of ELEMENTOS_CATALOGO) {
    const elemento = form.ownerDocument.getElementById(id);
    if (!elemento || !form.contains(elemento)) return null; // El botón conserva el disabled del HTML.
    extras[id] = elemento;
  }
  return montarFormulario(form, CAMPOS_REGISTRO, 'registro-mensaje', ({ porId, campos }, ctx) => {
    const universidad = porId.universidad.control;
    const validar = valores => validarRegistro(valores, { catalogoDisponible: catalogoDisponible(universidad) });
    const catalogo = crearCatalogo({
      universidad, campus: porId.campus.control, extras, servicios,
      alActualizar: () => ctx.estado.actualizar(),
      limpiarCampus: () => limpiarErrorCampo(porId.campus),
    });
    return {
      servicios,
      navegar,
      // El estado del catálogo se anuncia junto a cada selector, no en la región general.
      avisosAlCargar: () => [],
      validar,
      validarAlSalir: true,
      puedeEnviar: () => catalogo.listo() && Object.keys(validar(leerValores(campos))).length === 0,
      alMontar: catalogo.montar,
      alCambiar: objetivo => { if (objetivo === universidad) catalogo.cambiarUniversidad(); },
      alDesmontar: catalogo.desmontar,
      enviar: valores => servicios.registrar(datosRegistro(valores)),
      interpretar(resultado, ctx) {
        // AUTENTICADO: sin mensaje sobre el perfil; completarlo depende del servicio de perfiles (Bernabé).
        if (resultado?.ok === true && resultado.datos?.estado === 'AUTENTICADO') {
          redirigir(ctx);
          return;
        }
        if (resultado?.ok === true && resultado.datos?.estado === 'PENDIENTE_CONFIRMACION') {
          // No conservar contraseñas para reintentar; evita otro signUp que consuma la cuota de correo.
          vaciarContrasenas(porId);
          ctx.region.mostrar(MENSAJES.PENDIENTE_CONFIRMACION, 'info', 'envio');
          return;
        }
        mostrarErrorServicio(ctx, resultado);
      },
    };
  });
}

/* Eventos: el módulo se evalúa una sola vez por página */
if (typeof document !== 'undefined') {
  const FORMULARIOS = Object.freeze({ 'registro-form': montarRegistro, 'login-form': montarLogin });
  for (const [id, montar] of Object.entries(FORMULARIOS)) {
    const form = document.getElementById(id);
    if (!form) continue;
    try {
      montar({ form });
    } catch {
      // El botón conserva el disabled del HTML.
    }
  }
  // Al volver desde el bfcache, otra pestaña pudo iniciar sesión.
  window.addEventListener('pageshow', evento => {
    if (!evento.persisted) return;
    for (const id of Object.keys(FORMULARIOS)) {
      const form = document.getElementById(id);
      if (form) void montajes.get(form)?.comprobar();
    }
  });
}
