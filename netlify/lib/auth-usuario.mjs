/* Datos */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9._~-]{1,8192}$/;
const RECHAZOS_AUTH = new Set([
  'bad_jwt', 'session_expired', 'session_not_found',
  'user_not_found', 'user_banned',
]);

/* Funciones */
function servicioNoDisponible() {
  const error = new Error('No se pudo verificar la identidad en este momento.');
  error.codigo = 'CONTROLES_NO_DISPONIBLES';
  return error;
}

function comprobarCancelacion(signal) {
  if (!signal?.aborted) return;
  // No propagar signal.reason: podría contener información interna.
  const error = new Error('La verificación fue cancelada.');
  error.name = 'AbortError';
  throw error;
}

function tokenRechazado(error) {
  // Un límite o fallo del servicio no equivale a credenciales rechazadas.
  if (error?.status === 429 || error?.status >= 500) return false;
  // El SDK convierte session_not_found en AuthSessionMissingError.
  if (error?.name === 'AuthSessionMissingError') return true;
  // El código documentado identifica el rechazo; no fijar una lista de HTTP.
  return error?.name === 'AuthApiError'
    && RECHAZOS_AUTH.has(error.code);
}

// Recibe un cliente oficial supabase-js v2 del servidor, nunca el cliente del
// navegador. No crea sesiones, carga SDK, decodifica JWT ni consulta perfiles.
export function crearVerificadorUsuario({ cliente } = {}) {
  return async function verificarUsuario({ token, signal } = {}) {
    comprobarCancelacion(signal);
    // Evitar getUser(undefined), que podría recurrir a una sesión del cliente.
    if (typeof token !== 'string' || !TOKEN.test(token)) return null;

    let resultado;
    try {
      if (typeof cliente?.auth?.getUser !== 'function') throw servicioNoDisponible();
      // Firma oficial: getUser(jwt). No admite un segundo argumento signal.
      resultado = await cliente.auth.getUser(token);
    } catch (error) {
      comprobarCancelacion(signal);
      if (tokenRechazado(error)) return null;
      throw servicioNoDisponible();
    }
    // getUser no cancela su transporte mediante este contrato. Si termina tarde,
    // nunca entregar una identidad después de la cancelación del handler.
    comprobarCancelacion(signal);
    if (resultado?.error) {
      if (tokenRechazado(resultado.error)) return null;
      throw servicioNoDisponible();
    }
    if (resultado?.error !== null) throw servicioNoDisponible();

    const usuario = resultado?.data?.user;
    if (usuario === null) return null;
    if (!usuario || typeof usuario.id !== 'string' || !UUID.test(usuario.id)
      || typeof usuario.is_anonymous !== 'boolean') throw servicioNoDisponible();
    if (usuario.is_anonymous) return null;
    return { id: usuario.id, esAnonimo: false };
  };
}
