import { registrar, iniciarSesion, obtenerEstadoAuth } from './auth.js';

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

/* Datos */
const DESTINO = 'inicio.html'; // SPEC_TB4 §10.1: login.html → inicio.html
// Reglas copiadas de auth.js (correoValido, contrasenaValida, registroValido): mantenerlas alineadas.
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_PROHIBIDO = /[\u0000-\u001f\u007f<>]/;
// Solo formato. No prueba que el ID pertenezca al catálogo: eso corresponde al catálogo de Bernabé y a RLS.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIEMPO_AVISO_MS = 10000;
const TONOS = Object.freeze({ info: 'alert', aviso: 'alert alert-warning', error: 'alert alert-error' });
const MENSAJES = Object.freeze({
  NOMBRE_VACIO: 'Ingresa tu nombre completo.',
  NOMBRE_LONGITUD: 'El nombre debe tener entre 2 y 100 caracteres.',
  NOMBRE_CARACTERES: 'El nombre no puede contener los caracteres < o > ni caracteres de control, como saltos de línea o tabulaciones.',
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
  CATALOGO: 'El catálogo de universidades y campus todavía no está integrado; por ahora no es posible completar el registro.',
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
      : nombre.length < 2 || nombre.length > 100 ? MENSAJES.NOMBRE_LONGITUD
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
    inicializado: false, comprobado: false, enviando: false, redirigiendo: false, turnoSesion: 0,
    // Único punto que escribe disabled: ningún finally habilita el botón directamente.
    actualizar() {
      boton.disabled = !(estado.inicializado && estado.comprobado && !estado.enviando && !estado.redirigiendo);
      if (estado.enviando) form.setAttribute('aria-busy', 'true');
      else form.removeAttribute('aria-busy');
    },
  };
  return estado;
}

/* Funciones: redirección */
function redirigir(ctx) {
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
  if (estado.redirigiendo) return;
  estado.turnoSesion += 1;
  const turno = estado.turnoSesion;
  const vigente = () => turno === estado.turnoSesion && !estado.redirigiendo;
  estado.comprobado = false;
  estado.actualizar();
  const aviso = setTimeout(() => { if (vigente()) region.mostrarDeSesion(MENSAJES.SESION_DEMORA, 'info'); }, TIEMPO_AVISO_MS);
  let clasificacion;
  try {
    clasificacion = clasificarSesion(await ctx.servicios.obtenerEstadoAuth());
  } catch {
    clasificacion = { tipo: 'INDETERMINADO' };
  } finally {
    clearTimeout(aviso);
  }
  // Una comprobación antigua no escribe nada si ya empezó otra más reciente.
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
    ctx.interpretar(await ctx.enviar(valores), ctx);
  } catch {
    // Se conservan los datos del formulario.
    region.mostrar(MENSAJES.INESPERADO, 'error', 'envio');
  } finally {
    estado.enviando = false;
    estado.actualizar();
    if (teniaFoco && !boton.disabled) boton.focus();
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
  Object.assign(ctx, crearConfig(elementos));
  const alEnviar = evento => {
    evento.preventDefault();
    void procesarEnvio(ctx);
  };
  const alEditar = evento => {
    const campo = ctx.campos.find(({ control }) => control === evento.target);
    if (campo) limpiarErrorCampo(campo);
  };
  const montaje = {
    comprobar: () => comprobarSesion(ctx),
    desmontar() {
      form.removeEventListener('submit', alEnviar);
      form.removeEventListener('input', alEditar);
      form.removeEventListener('change', alEditar);
      ctx.estado.inicializado = false;
      ctx.estado.actualizar();
      if (montajes.get(form) === montaje) montajes.delete(form);
    },
  };
  try {
    form.addEventListener('submit', alEnviar);
    form.addEventListener('input', alEditar);
    form.addEventListener('change', alEditar);
    montajes.set(form, montaje);
    ctx.estado.inicializado = true; // El botón sigue deshabilitado hasta comprobar la sesión.
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

export function montarRegistro({
  form,
  servicios = { registrar, obtenerEstadoAuth },
  navegar = url => form.ownerDocument.defaultView.location.replace(url),
} = {}) {
  return montarFormulario(form, CAMPOS_REGISTRO, 'registro-mensaje', ({ porId }) => {
    const universidad = porId.universidad.control;
    return {
      servicios,
      navegar,
      avisosAlCargar: () => (catalogoDisponible(universidad) ? [] : [MENSAJES.CATALOGO]),
      validar: valores => validarRegistro(valores, { catalogoDisponible: catalogoDisponible(universidad) }),
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
