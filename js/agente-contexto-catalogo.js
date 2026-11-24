import { validarContextoPermitido } from './agente-memoria.js';

// Puerto propuesto: la fuente debe entregar solo la proyección pública validada
// por el catálogo; ni el chat ni la salida del modelo son fuentes confiables.
// No se conecta al montaje ni obtiene categorías de producción por sí mismo.
export function crearProductorContextoCatalogo({ obtenerSeleccion, categoriasPermitidas = [] } = {}) {
  if (typeof obtenerSeleccion !== 'function' || !Array.isArray(categoriasPermitidas)) {
    throw new TypeError('Productor de contexto no configurado.');
  }
  const categorias = [...categoriasPermitidas];
  return async function producirContexto({ signal } = {}) {
    try {
      signal?.throwIfAborted();
      const seleccion = await obtenerSeleccion({ signal });
      signal?.throwIfAborted();
      const resultado = validarContextoPermitido(seleccion, { categoriasPermitidas: categorias });
      if (!resultado.ok) throw new Error();
      return resultado.datos;
    } catch {
      throw new Error('No se pudo obtener un contexto público válido.');
    }
  };
}
