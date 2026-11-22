import { crearClaveMemoria } from './agente-memoria.js';

/* Puerto del agente. El actor procede del puente Auth verificado, no del JSON. */
export function crearAdaptadorStorageAgente({ almacenamiento, obtenerActor } = {}) {
  const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: 'No se pudo acceder al contexto permitido.' } });
  async function operar(tipo, clave, json, signal) {
    signal?.throwIfAborted();
    try {
      const actor = obtenerActor();
      const esperada = crearClaveMemoria(actor);
      if (!esperada.ok || clave !== esperada.datos) return fallo('ALMACENAMIENTO');
      const nombre = { leer: 'leerContextoAgente', guardar: 'guardarContextoAgente', eliminar: 'eliminarContextoAgente' }[tipo];
      signal?.throwIfAborted();
      const r = tipo === 'guardar' ? almacenamiento[nombre](actor, json) : almacenamiento[nombre](actor);
      // Storage es síncrono. Comprobar de nuevo evita publicar un resultado obsoleto.
      signal?.throwIfAborted();
      if (obtenerActor() !== actor) return fallo('ALMACENAMIENTO');
      return r?.ok === true ? { ok: true, datos: r.datos, error: null }
        : fallo(r?.error?.codigo === 'CUOTA_EXCEDIDA' ? 'CUOTA' : 'ALMACENAMIENTO');
    } catch {
      signal?.throwIfAborted(); return fallo('ALMACENAMIENTO');
    }
  }
  return Object.freeze({ leer: (clave, { signal } = {}) => operar('leer', clave, null, signal),
    guardar: (clave, json, { signal } = {}) => operar('guardar', clave, json, signal),
    eliminar: (clave, { signal } = {}) => operar('eliminar', clave, null, signal) });
}
