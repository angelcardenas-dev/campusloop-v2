import { montarAgente, desmontarAgente } from './agente-ui.js';

/* Datos: una conexión de ciclo de página por Window, incluso si se reinicia. */
const conexiones = new WeakMap();

/* Funciones */
export function iniciarAgente(documento = globalThis.document) {
  const ventana = documento?.defaultView;
  if (!ventana || !documento.body) throw new TypeError('Se requiere una página cargada.');
  if (conexiones.has(ventana)) { montarAgente({ documento }); return conexiones.get(ventana); }
  const alOcultar = () => desmontarAgente(documento);
  const alMostrar = () => montarAgente({ documento });
  const desconectar = () => {
    ventana.removeEventListener('pagehide', alOcultar); ventana.removeEventListener('pageshow', alMostrar);
    desmontarAgente(documento); conexiones.delete(ventana);
  };
  conexiones.set(ventana, desconectar);
  ventana.addEventListener('pagehide', alOcultar); ventana.addEventListener('pageshow', alMostrar);
  montarAgente({ documento }); return desconectar;
}

/* Eventos: módulos ES diferidos; no suscripciones Auth ni llamadas de red. */
if (typeof document !== 'undefined') iniciarAgente(document);
