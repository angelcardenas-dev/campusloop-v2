import { crearClaveMemoria } from './agente-memoria.js';
import { conBloqueoMemoriaCuenta, falloMemoriaControlado } from './agente-memoria-lock.js';

/* Puerto del agente. El actor procede del puente Auth verificado, no del JSON. */
export function crearAdaptadorStorageAgente({ almacenamiento, obtenerActor, locks, obtenerMarcaOperacion,
  revocarGeneracionOperacion = false, confirmarBorrado } = {}) {
  const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: 'No se pudo acceder al contexto permitido.' } });
  async function operar(tipo, clave, json, signal) {
    signal?.throwIfAborted();
    try {
      const actor = obtenerActor();
      const esperada = crearClaveMemoria(actor);
      if (!esperada.ok || clave !== esperada.datos) return fallo('ALMACENAMIENTO');
      const ejecutar = () => {
        signal?.throwIfAborted();
        if (obtenerActor() !== actor) return fallo('ALMACENAMIENTO');
        if (obtenerMarcaOperacion) {
          const esperado = obtenerMarcaOperacion(signal);
          const vigente = almacenamiento.leerMarcaContextoAgente(actor);
          if (!vigente.ok) return falloMemoriaControlado(vigente.error?.codigo);
          if (!esperado || esperado.consentimiento !== vigente.datos.consentimiento
            || esperado.operacion !== vigente.datos.operacion) return fallo('CANCELADA');
        }
        const r = tipo === 'guardar' ? almacenamiento.guardarContextoAgente(actor, json)
          : tipo === 'leer' ? almacenamiento.leerContextoAgente(actor)
            : revocarGeneracionOperacion
              ? almacenamiento.avanzarMarcaContextoAgente(actor, { operacion: true }, true)
              : almacenamiento.eliminarContextoAgente(actor);
        // Solo este borrado confirmado puede avanzar la generación de su propia
        // operación. Nunca adoptar una generación observada en otra verificación.
        if (r?.ok === true && tipo === 'eliminar' && revocarGeneracionOperacion) confirmarBorrado?.(signal, r.datos);
        signal?.throwIfAborted();
        if (obtenerActor() !== actor) return fallo('ALMACENAMIENTO');
        return r?.ok === true ? { ok: true, datos: r.datos, error: null }
          : falloMemoriaControlado(r?.error?.codigo === 'CUOTA_EXCEDIDA' ? 'CUOTA' : r?.error?.codigo);
      };
      const r = locks ? await conBloqueoMemoriaCuenta(locks, actor, ejecutar, signal) : ejecutar();
      return r?.ok === true ? r : falloMemoriaControlado(r?.error?.codigo);
    } catch {
      signal?.throwIfAborted(); return fallo('ALMACENAMIENTO');
    }
  }
  return Object.freeze({ leer: (clave, { signal } = {}) => operar('leer', clave, null, signal),
    guardar: (clave, json, { signal } = {}) => operar('guardar', clave, json, signal),
    eliminar: (clave, { signal } = {}) => operar('eliminar', clave, null, signal) });
}
