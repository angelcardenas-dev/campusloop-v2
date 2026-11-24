import { crearClaveMemoria } from './agente-memoria.js';

/* Bloqueo cooperativo por cuenta para los metadatos y el documento del agente. */
export async function conBloqueoMemoriaCuenta(locks, usuarioId, trabajo, signal) {
  const clave = crearClaveMemoria(usuarioId);
  if (!clave.ok || !locks || typeof locks.request !== 'function' || typeof trabajo !== 'function') {
    return { ok: false, datos: null, error: { codigo: 'BLOQUEO_NO_DISPONIBLE' } };
  }
  try {
    const datos = await locks.request(`campusloop:agente:memoria:v1:${usuarioId.toLowerCase()}`,
      { mode: 'exclusive', ...(signal ? { signal } : {}) }, async () => {
        signal?.throwIfAborted();
        return trabajo();
      });
    return datos?.ok === true ? datos : { ok: false, datos: null, error: { codigo: 'ALMACENAMIENTO' } };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, datos: null, error: { codigo: 'BLOQUEO_NO_DISPONIBLE' } };
  }
}

export async function revocarMemoriaCuenta({ locks, almacenamiento, usuarioId } = {}) {
  return conBloqueoMemoriaCuenta(locks, usuarioId, () => {
    let marca = almacenamiento.leerMarcaContextoAgente(usuarioId);
    if (!marca.ok && marca.error?.codigo === 'MARCA_AUSENTE') {
      marca = almacenamiento.inicializarMarcaContextoAgente(usuarioId, true);
    }
    if (!marca.ok) return marca;
    return almacenamiento.avanzarMarcaContextoAgente(usuarioId,
      { consentimiento: true, operacion: true, revocacionPendiente: true }, true);
  });
}
