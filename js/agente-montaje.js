import { montarAgente, desmontarAgente } from './agente-ui.js';
import { conectarMemoriaAgente } from './agente-memoria-conexion.js';

/* Datos: una conexión de ciclo de página por Window, incluso si se reinicia. */
const conexiones = new WeakMap();

/* Funciones */
export function iniciarAgente(documento = globalThis.document, opciones = {}) {
  const ventana = documento?.defaultView;
  if (!ventana || !documento.body) throw new TypeError('Se requiere una página cargada.');
  if (conexiones.has(ventana)) {
    const anterior = conexiones.get(ventana); anterior.mostrar(); return anterior.desconectar;
  }
  let memoria = null, widgetAnterior = null, activa = true;
  const alOcultar = () => { memoria?.desmontar(); memoria = null; desmontarAgente(documento); };
  const alMostrar = () => {
    const widget = montarAgente({ documento });
    if (widget !== widgetAnterior) { memoria?.desmontar(); memoria = null; widgetAnterior = widget; }
    if (!memoria) {
      memoria = conectarMemoriaAgente({ ...opciones.memoria, widget });
      opciones.alMontar?.(widget, memoria);
    }
  };
  const desconectar = () => {
    if (!activa) return;
    activa = false;
    ventana.removeEventListener('pagehide', alOcultar); ventana.removeEventListener('pageshow', alMostrar);
    alOcultar(); conexiones.delete(ventana);
  };
  conexiones.set(ventana, { mostrar: alMostrar, desconectar });
  ventana.addEventListener('pagehide', alOcultar); ventana.addEventListener('pageshow', alMostrar);
  alMostrar(); return desconectar;
}

/* Eventos: módulos ES diferidos; no suscripciones Auth ni llamadas de red. */
if (typeof document !== 'undefined') iniciarAgente(document);
