/* Datos */
// Completar únicamente con valores públicos reales, en una tarea autorizada.
// Vacío intencionalmente: no hay proyecto, clave ni credenciales de ejemplo.
export const CONFIGURACION_PUBLICA = Object.freeze({
  supabaseUrl: '',
  supabasePublishableKey: '',
  // Opcionales para registro. Origen del frontend y retorno del mismo origen.
  // Sin destino explícito, Supabase utiliza su Site URL configurado.
  appOrigin: '',
  authEmailRedirectTo: '',
});

/* Funciones */
export function validarConfiguracionPublica(configuracion = CONFIGURACION_PUBLICA) {
  const error = {
    codigo: 'CONFIGURACION',
    mensaje: 'Falta configurar una URL HTTPS de Supabase y una publishable key pública válida.',
  };
  const fallo = () => ({ ok: false, datos: null, error: { ...error } });

  if (!configuracion || typeof configuracion.supabaseUrl !== 'string'
    || typeof configuracion.supabasePublishableKey !== 'string') return fallo();

  const clave = configuracion.supabasePublishableKey.trim();
  // Solo publishable keys modernas. Rechaza secret keys y JWT heredados.
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(clave)) return fallo();

  try {
    const url = new URL(configuracion.supabaseUrl.trim());
    if (url.protocol !== 'https:' || !url.hostname.includes('.')
      || url.username || url.password || url.search || url.hash
      || (url.pathname !== '/' && url.pathname !== '')) return fallo();
    return {
      ok: true,
      datos: { supabaseUrl: url.origin, supabasePublishableKey: clave },
      error: null,
    };
  } catch {
    return fallo();
  }
}

// URLs controladas por despliegue; nunca se obtienen de formularios, query o storage.
function urlDeAplicacion(valor) {
  if (typeof valor !== 'string' || valor.length > 2048
    || /[^\x21-\x7e]|[\\%?#@]/.test(valor)) return null;
  const partes = /^(https?):\/\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?(\/.*)?$/.exec(valor);
  if (!partes) return null;
  const ruta = partes[4] ?? '/';
  // HTML o rutas limpias: sin doble slash, segmentos . / .. ni escapes codificados.
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*(?:[A-Za-z0-9_-]+(?:\.html)?)?$/.test(ruta)) return null;
  try {
    const url = new URL(valor);
    if (url.hostname !== partes[2].toLowerCase() || !url.hostname.includes('.')
      || !url.hostname.split('.').every(segmento => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(segmento))) return null;
    // Única excepción HTTP para el origen local aprobado; producción requiere HTTPS.
    if (url.protocol !== 'https:' && url.origin !== 'http://127.0.0.1:5501') return null;
    return url;
  } catch { return null; }
}

export function validarDestinoConfirmacion(configuracion = CONFIGURACION_PUBLICA) {
  const fallo = () => ({ ok: false, datos: null, error: {
    codigo: 'CONFIGURACION', mensaje: 'El destino de confirmación no es válido para el origen de CampusLoop.',
  } });
  if (!configuracion || typeof configuracion !== 'object' || Array.isArray(configuracion)) return fallo();
  const destino = configuracion.authEmailRedirectTo;
  if (destino === undefined || destino === '') {
    return { ok: true, datos: { emailRedirectTo: null }, error: null };
  }
  const url = urlDeAplicacion(destino);
  const origen = urlDeAplicacion(configuracion.appOrigin);
  if (!url || !origen || origen.pathname !== '/' || url.origin !== origen.origin) return fallo();
  return { ok: true, datos: { emailRedirectTo: url.href }, error: null };
}
