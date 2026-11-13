/* Datos */
// Completar únicamente con valores públicos reales, en una tarea autorizada.
// Vacío intencionalmente: no hay proyecto, clave ni credenciales de ejemplo.
export const CONFIGURACION_PUBLICA = Object.freeze({
  supabaseUrl: '',
  supabasePublishableKey: '',
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
