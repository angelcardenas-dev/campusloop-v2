import { crearMemoriaAgente, crearClaveMemoria, resumirContexto } from './agente-memoria.js';

/* D1.3A/B: composición explícita de puertos; el puente controla su habilitación.
   La identidad mínima debe proceder de Auth, nunca del chat ni de una URL. */
const coordinadores = new WeakMap();
const fallo = codigo => ({ ok: false, datos: null, error: { codigo,
  mensaje: codigo === 'CANCELADA' ? 'La operación de memoria fue invalidada.' : 'No se pudo preparar la memoria del agente.' } });

export function crearCoordinadorMemoria({ widget, obtenerIdentidad, almacenamiento = null,
  producirContexto, categoriasPermitidas = [], politica = null, ahora = Date.now } = {}) {
  const metodos = ['presentarMemoria', 'limpiarMemoria', 'limpiarPorIdentidad', 'borrarHistorial', 'escucharAccionesMemoria'];
  if (!widget || metodos.some(nombre => typeof widget[nombre] !== 'function') || typeof obtenerIdentidad !== 'function') {
    throw new TypeError('Se requieren el widget compatible y un proveedor de identidad.');
  }
  if (coordinadores.has(widget)) return coordinadores.get(widget);
  let activa = true, secuencia = 0, actor = null, identidadConocida = false;

  async function resolverIdentidad({ signal }) {
    try {
      const valor = await obtenerIdentidad({ signal });
      if (!activa || signal.aborted) throw new Error('CANCELADA');
      if (valor !== null) {
        // No proyectar silenciosamente un DTO privado o una sesión al puerto mínimo.
        const descriptor = valor && typeof valor === 'object' ? Object.getOwnPropertyDescriptor(valor, 'id') : null;
        if (!valor || ![Object.prototype, null].includes(Object.getPrototypeOf(valor))
          || Reflect.ownKeys(valor).length !== 1 || !descriptor || !Object.hasOwn(descriptor, 'value')
          || !descriptor.enumerable || !crearClaveMemoria(descriptor.value).ok) throw new Error('IDENTIDAD_INVALIDA');
      }
      const siguiente = valor === null ? null : valor.id.toLowerCase();
      if (identidadConocida && actor !== siguiente) widget.limpiarPorIdentidad();
      actor = siguiente; identidadConocida = true;
      return siguiente === null ? null : { id: siguiente };
    } catch (error) {
      if (error === 'CANCELADA') throw error;
      // Una respuesta antigua no puede limpiar la interfaz de una identidad nueva.
      if (activa && !signal.aborted) {
        actor = null; identidadConocida = false; widget.limpiarPorIdentidad();
      }
      throw new Error('No se pudo verificar la identidad.');
    }
  }
  const memoria = crearMemoriaAgente({ almacenamiento, obtenerIdentidad: resolverIdentidad,
    producirContexto, categoriasPermitidas, politica, ahora });

  function invalidarIdentidad() {
    if (!activa) return;
    secuencia++; memoria.invalidarIdentidad(); actor = null; identidadConocida = false;
    widget.limpiarPorIdentidad();
  }
  async function operar(tipo, borrarVista = true) {
    if (!activa) return fallo('CANCELADA');
    const turno = ++secuencia;
    if (tipo === 'borrar' && borrarVista) widget.borrarHistorial();
    widget.limpiarMemoria(); widget.presentarMemoria({ estado: 'comprobando' });
    const resultado = await memoria[tipo]();
    if (!activa || turno !== secuencia) return fallo('CANCELADA');
    if (!resultado.ok && resultado.error.codigo === 'CANCELADA') {
      widget.limpiarMemoria(); return resultado;
    }
    if (!identidadConocida || actor === null) {
      widget.presentarMemoria({ estado: resultado.ok ? 'sin-sesion' : 'error' }); return resultado;
    }
    if (tipo === 'borrar') {
      widget.presentarMemoria({ estado: resultado.ok ? 'borrado' : 'error-borrado' }); return resultado;
    }
    const contexto = memoria.obtenerContexto();
    if (!contexto) {
      widget.presentarMemoria({ estado: resultado.ok ? 'sin-contexto' : 'error' }); return resultado;
    }
    const resumen = resumirContexto(contexto, { categoriasPermitidas });
    if (!resumen.ok) { memoria.invalidarIdentidad(); widget.presentarMemoria({ estado: 'error' }); return resumen; }
    widget.presentarMemoria({ estado: resultado.ok ? (tipo === 'recuperar' ? 'recordado' : 'preparado') : 'conservado',
      resumen: resumen.datos });
    return resultado;
  }
  function desmontar({ limpiarWidget = true } = {}) {
    if (!activa) return;
    activa = false; secuencia++; memoria.desmontar(); actor = null; identidadConocida = false;
    cancelarEscucha();
    if (limpiarWidget) widget.limpiarPorIdentidad(); else widget.limpiarMemoria();
    coordinadores.delete(widget);
  }
  const control = { restaurar: () => operar('recuperar'), actualizar: () => operar('actualizar'),
    borrar: () => operar('borrar'), invalidarIdentidad, desmontar };
  const cancelarEscucha = widget.escucharAccionesMemoria(accion => {
    // El botón ya limpió su historial: no volver a anunciar la bienvenida.
    if (accion === 'borrar') return operar('borrar', false);
    if (accion === 'desmontar') desmontar();
  });
  coordinadores.set(widget, control);
  return control;
}
