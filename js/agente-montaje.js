import { montarAgente, desmontarAgente } from './agente-ui.js';
import { conectarMemoriaAgente } from './agente-memoria-conexion.js';

import { escucharSeleccionCatalogo } from './catalogo.js';
import { crearProductorContextoCatalogo } from './agente-contexto-catalogo.js';
import { POLITICA_PROVISIONAL_MEMORIA } from './agente-memoria.js';
import { conectarClienteWidget } from './agente-integracion-widget.js';

/* Datos: una conexión de ciclo de página por Window, incluso si se reinicia. */
const conexiones = new WeakMap();

/* Funciones */
export function iniciarAgente(documento = globalThis.document, opciones = {}) {
  const ventana = documento?.defaultView;
  if (!ventana || !documento.body) throw new TypeError('Se requiere una página cargada.');
  if (conexiones.has(ventana)) {
    const anterior = conexiones.get(ventana); anterior.mostrar(); return anterior.desconectar;
  }
  let memoria = null, clienteWidget = null, widgetAnterior = null, activa = true;
  let dejarSeleccion = () => {};
  const alOcultar = () => {
    dejarSeleccion(); clienteWidget?.desmontar(); clienteWidget = null;
    memoria?.desmontar(); memoria = null; desmontarAgente(documento);
  };
  const alMostrar = () => {
    const widget = montarAgente({ documento });
    if (widget !== widgetAnterior) { memoria?.desmontar(); memoria = null; widgetAnterior = widget; }
    if (!memoria) {
      dejarSeleccion();
      let seleccion = null;
      const categoriasPermitidas = opciones.memoria?.categoriasPermitidas ?? [];
      const producirContexto = crearProductorContextoCatalogo({ obtenerSeleccion: () => seleccion, categoriasPermitidas });
      memoria = conectarMemoriaAgente({ politica: POLITICA_PROVISIONAL_MEMORIA, producirContexto,
        obtenerStorageSesion: () => ventana.sessionStorage, ...opciones.memoria, widget });
      dejarSeleccion = escucharSeleccionCatalogo(documento.querySelector('[data-catalogo]'), filtros => {
        seleccion = filtros;
        void memoria.actualizar().finally(() => {
          if (seleccion === filtros) seleccion = null;
        });
      });
      opciones.alMontar?.(widget, memoria);
      // Sin esta dependencia explícita, el montaje normal sigue siendo local.
      if (opciones.integracion?.habilitada === true && opciones.integracion?.cliente) {
        try { clienteWidget = conectarClienteWidget({ ...opciones.integracion, widget }); }
        catch { widget.finalizarSolicitud('El agente no está disponible. Puedes seguir escribiendo localmente.'); }
      }
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
