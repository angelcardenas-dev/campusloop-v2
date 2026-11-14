import { obtenerClienteSupabase } from './supabase-cliente.js';
import { CONFIGURACION_PUBLICA, validarDestinoConfirmacion } from './config-publica.js';

/* Datos */
const MENSAJES = Object.freeze({
  VALIDACION: 'Revisa los datos ingresados, la confirmación de contraseña y los términos.',
  CREDENCIALES_INVALIDAS: 'No pudimos iniciar sesión. Revisa tu correo y contraseña.',
  NO_AUTORIZADO: 'Necesitas iniciar sesión para continuar.',
  CORREO_PENDIENTE: 'Confirma tu correo antes de iniciar sesión.',
  RED: 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.',
  LIMITE: 'Se alcanzó el límite de solicitudes. Espera antes de volver a intentarlo.',
  CONFIGURACION: 'El acceso todavía no está configurado. Comunícalo al equipo de CampusLoop.',
  SERVIDOR: 'El servicio de acceso no pudo completar la operación. Inténtalo más tarde.',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* Funciones */
const exito = datos => ({ ok: true, datos, error: null });
function fallo(codigo) {
  const seguro = Object.hasOwn(MENSAJES, codigo) ? codigo : 'SERVIDOR';
  return { ok: false, datos: null, error: { codigo: seguro, mensaje: MENSAJES[seguro] } };
}

function normalizarError(error) {
  // Nunca devolver error.message, details, response ni el error original.
  const codigo = error?.code;
  if (codigo === 'invalid_credentials') return fallo('CREDENCIALES_INVALIDAS');
  if (codigo === 'email_not_confirmed') return fallo('CORREO_PENDIENTE');
  if (['signup_disabled', 'email_provider_disabled'].includes(codigo)) return fallo('CONFIGURACION');
  if (['weak_password', 'email_address_invalid', 'validation_failed', 'user_already_exists', 'email_exists'].includes(codigo)) {
    return fallo('VALIDACION');
  }
  if (['bad_jwt', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(codigo)) {
    return fallo('NO_AUTORIZADO');
  }
  if (error?.status === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'].includes(codigo)) {
    return fallo('LIMITE');
  }
  // El SDK identifica sus fallos de transporte con este tipo. Un TypeError
  // genérico (o status 0 aislado) también puede ser un fallo interno de lógica.
  if (error?.name === 'AuthRetryableFetchError') return fallo('RED');
  if (error?.status === 401 || error?.status === 403) return fallo('NO_AUTORIZADO');
  if (error?.status === 422) return fallo('VALIDACION');
  return fallo('SERVIDOR');
}

function correoValido(correo) {
  return typeof correo === 'string' && correo.trim().length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function contrasenaValida(contrasena, minimo) {
  return typeof contrasena === 'string' && contrasena.length >= minimo
    && contrasena.length <= 128 && contrasena.trim().length > 0;
}

function registroValido(datos) {
  return datos !== null && typeof datos === 'object' && !Array.isArray(datos)
    && typeof datos.nombreVisible === 'string'
    && datos.nombreVisible.trim().length >= 2 && datos.nombreVisible.trim().length <= 100
    && !/[\u0000-\u001f\u007f<>]/.test(datos.nombreVisible)
    && typeof datos.universidadId === 'string' && UUID.test(datos.universidadId)
    && typeof datos.campusId === 'string' && UUID.test(datos.campusId)
    && correoValido(datos.correo) && contrasenaValida(datos.contrasena, 8)
    && datos.contrasena === datos.confirmarContrasena && datos.aceptaTerminos === true;
}

function reducirUsuario(usuario) {
  if (!usuario || typeof usuario.id !== 'string' || !usuario.id || usuario.is_anonymous === true) return null;
  return { id: usuario.id, correo: typeof usuario.email === 'string' ? usuario.email : null };
}

function estadoSesion(sesion) {
  if (!sesion) return exito({ estado: 'NO_AUTENTICADO', usuario: null });
  const usuario = reducirUsuario(sesion.user);
  return usuario ? exito({ estado: 'AUTENTICADO', usuario }) : fallo('SERVIDOR');
}

async function ejecutar(operacion) {
  try {
    const cliente = await obtenerClienteSupabase();
    if (!cliente.ok) return fallo(cliente.error?.codigo ?? 'CONFIGURACION');
    return await operacion(cliente.datos.auth);
  } catch (error) {
    return normalizarError(error);
  }
}

function comprobarRespuesta(respuesta) {
  if (respuesta?.error) throw respuesta.error;
  return respuesta?.data;
}

export async function registrar(datosRegistro) {
  if (!registroValido(datosRegistro)) return fallo('VALIDACION');
  const destino = validarDestinoConfirmacion(CONFIGURACION_PUBLICA);
  if (!destino.ok) return fallo('CONFIGURACION');
  return ejecutar(async auth => {
    const solicitud = {
      email: datosRegistro.correo.trim().toLowerCase(),
      password: datosRegistro.contrasena,
    };
    if (destino.datos.emailRedirectTo) solicitud.options = { emailRedirectTo: destino.datos.emailRedirectTo };
    const datos = comprobarRespuesta(await auth.signUp(solicitud));
    const usuario = reducirUsuario(datos?.user);
    if (!usuario) return fallo('SERVIDOR');
    // No persistir nombre/campus/roles/metadatos. Perfiles corresponde a Bernabé.
    if (!datos.session) return exito({ estado: 'PENDIENTE_CONFIRMACION', usuario });
    if (datos.session.user?.id !== usuario.id) return fallo('SERVIDOR');
    return estadoSesion(datos.session);
  });
}

export async function iniciarSesion(correo, contrasena) {
  // Permitir cuentas existentes con otra política de longitud mínima.
  if (!correoValido(correo) || !contrasenaValida(contrasena, 1)) return fallo('VALIDACION');
  return ejecutar(async auth => {
    const datos = comprobarRespuesta(await auth.signInWithPassword({
      email: correo.trim().toLowerCase(), password: contrasena,
    }));
    if (!datos?.session) return fallo('SERVIDOR');
    return estadoSesion(datos.session);
  });
}

export async function obtenerUsuarioActual() {
  return ejecutar(async auth => {
    try {
      const datos = comprobarRespuesta(await auth.getUser());
      if (!datos) return fallo('SERVIDOR');
      if (!datos.user) return exito(null);
      const usuario = reducirUsuario(datos.user);
      return usuario ? exito(usuario) : fallo('SERVIDOR');
    } catch (error) {
      // Coherente tanto si getUser devuelve el error como si lo lanza.
      if (error?.name === 'AuthSessionMissingError') return exito(null);
      throw error;
    }
  });
}

export async function obtenerEstadoAuth() {
  return ejecutar(async auth => {
    // getSession espera la restauración inicial y gestiona refresh con el SDK.
    // Este estado es para la UI, no una autorización de datos o del servidor.
    const datos = comprobarRespuesta(await auth.getSession());
    return datos ? estadoSesion(datos.session) : fallo('SERVIDOR');
  });
}

export async function cerrarSesion() {
  return ejecutar(async auth => {
    // Cerrar la sesión actual, sin cerrar otros dispositivos del usuario.
    const respuesta = await auth.signOut({ scope: 'local' });
    if (!respuesta || respuesta.error) {
      if (respuesta?.error) throw respuesta.error;
      return fallo('SERVIDOR');
    }
    return exito({ estado: 'NO_AUTENTICADO', usuario: null });
  });
}

export async function requerirAutenticacion() {
  const resultado = await obtenerUsuarioActual();
  if (!resultado.ok) return resultado;
  return resultado.datos
    ? exito({ estado: 'AUTENTICADO', usuario: resultado.datos })
    : fallo('NO_AUTORIZADO');
}

/* Eventos */
export function escucharCambiosAuth(callback) {
  if (typeof callback !== 'function') return () => {};
  let activa = true;
  let suscripcion;
  const pendientes = new Set();

  function entregar(notificacion) {
    if (!activa) return;
    // Macrotarea: el consumidor se ejecuta FUERA del callback/lock del SDK.
    const temporizador = setTimeout(() => {
      pendientes.delete(temporizador);
      if (!activa) return;
      try {
        Promise.resolve(callback(notificacion)).catch(() => {});
      } catch {
        // Un error del consumidor no expone datos ni rompe el cliente compartido.
      }
    }, 0);
    pendientes.add(temporizador);
  }

  async function iniciar() {
    try {
      const cliente = await obtenerClienteSupabase();
      if (!activa) return;
      if (!cliente.ok) {
        entregar({ evento: 'ERROR', estado: fallo(cliente.error?.codigo).error.codigo, usuario: null });
        return;
      }
      const resultado = cliente.datos.auth.onAuthStateChange((evento, sesion) => {
        const estado = estadoSesion(sesion);
        entregar(estado.ok
          ? { evento, ...estado.datos }
          : { evento: 'ERROR', estado: estado.error.codigo, usuario: null });
      });
      suscripcion = resultado?.data?.subscription;
      if (typeof suscripcion?.unsubscribe !== 'function') {
        entregar({ evento: 'ERROR', estado: 'SERVIDOR', usuario: null });
      }
    } catch (error) {
      entregar({ evento: 'ERROR', estado: normalizarError(error).error.codigo, usuario: null });
    }
  }

  void iniciar();
  return function cancelar() {
    if (!activa) return;
    activa = false;
    for (const pendiente of pendientes) clearTimeout(pendiente);
    pendientes.clear();
    suscripcion?.unsubscribe();
  };
}
