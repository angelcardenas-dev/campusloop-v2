import { crearControladorCatalogo } from './catalogo.js';

/* Datos: Inicio (inicio.html), no la portada pública index.html. */
const montajesInicio = new WeakMap();
const PENDIENTE = 'Integración pendiente: estos artículos son ejemplos de Figma, no resultados de Supabase ni recomendaciones personalizadas.';
const copiar = valor => JSON.parse(JSON.stringify(valor));

/* Funciones: reutiliza validación, contratos, abortos y plazos de Explorar.
   Los adaptadores y la consulta solo pueden habilitarse en modo de prueba.
   No se conoce aquí el DTO, orden REST, tamaño de página o IDs definitivos. */
export function crearControladorInicio({ alCambiar = () => {}, ...dependencias } = {}) {
  const presentar = estado => {
    const resultado = copiar(estado);
    if (resultado.estado === 'pendiente') resultado.mensaje = PENDIENTE;
    if (resultado.estado === 'preparado') resultado.mensaje = 'Prueba offline preparada. Puedes consultar artículos sintéticos; no hay personalización real.';
    if (resultado.estado === 'listo') resultado.mensaje = `Prueba offline: ${resultado.vistas.length} artículos en esta respuesta. Sin personalización ni total global confirmado.`;
    if (resultado.estado === 'vacio') resultado.mensaje = 'Prueba offline: esta respuesta no contiene artículos. Puedes volver a consultar o ir a Explorar.';
    return resultado;
  };
  const controlador = crearControladorCatalogo({ ...dependencias, alCambiar: estado => alCambiar(presentar(estado)) });
  return {
    obtenerEstado: () => presentar(controlador.obtenerEstado()),
    preparar: () => controlador.preparar(),
    // Recientes es una intención de UI existente, no un campo ni orden SQL.
    consultar: async () => {
      const resultado = await controlador.aplicar({ orden: 'recientes' });
      return resultado ? presentar(resultado) : null;
    },
    desconectar: () => controlador.desconectar(),
  };
}

/* Elementos: recibe únicamente la vista pública ya validada por el controlador. */
function tarjetaInicio(documento, vista) {
  const nodo = (tipo, clase, texto) => {
    const e = documento.createElement(tipo); e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  };
  const tarjeta = nodo('article', 'product-card home-product');
  const media = nodo('div', 'product-card-media');
  const sinFoto = () => nodo('div', 'home-photo-empty', 'Sin fotografía');
  if (vista.foto) {
    const foto = nodo('img', ''); foto.src = vista.foto.url; foto.alt = vista.foto.alt;
    foto.loading = 'lazy'; foto.decoding = 'async'; foto.referrerPolicy = 'no-referrer';
    foto.addEventListener('error', () => foto.replaceWith(sinFoto()), { once: true }); media.append(foto);
  } else media.append(sinFoto());
  if (vista.estadoTexto) media.append(nodo('span', `status ${vista.tono === 'positivo' ? 'status-available' : vista.tono === 'aviso' ? 'status-reserved' : ''}`, vista.estadoTexto));
  const titulo = nodo('h3', 'product-card-title', vista.titulo); titulo.id = `home-live-${vista.id}`;
  tarjeta.setAttribute('aria-labelledby', titulo.id); tarjeta.append(media, titulo);
  for (const [clave, clase] of [['categoriaTexto', 'home-product-category'], ['ubicacionTexto', 'home-product-campus']]) {
    if (vista[clave]) tarjeta.append(nodo('p', `product-card-meta ${clase}`, vista[clave]));
  }
  const entero = Math.floor(vista.precioCentimos / 100), decimal = vista.precioCentimos % 100;
  tarjeta.append(nodo('p', 'product-card-price', `S/ ${new Intl.NumberFormat('es-PE').format(entero)}${decimal ? '.' + String(decimal).padStart(2, '0') : ''}`));
  if (vista.vendedorTexto) tarjeta.append(nodo('p', 'home-product-seller', vista.vendedorTexto));
  if (vista.detalle) {
    const enlace = nodo('a', 'button button-primary', 'Ver detalle'); enlace.href = vista.detalle;
    enlace.setAttribute('aria-label', `Ver detalle de ${vista.titulo}`); tarjeta.append(enlace);
  } else {
    const pendiente = nodo('span', 'button button-primary', 'Detalle pendiente'); pendiente.setAttribute('aria-disabled', 'true'); tarjeta.append(pendiente);
  }
  return tarjeta;
}

export function desmontarInicio(raiz) { montajesInicio.get(raiz)?.desconectar(); }
export function montarInicio({ raiz, ...dependencias } = {}) {
  if (!raiz?.querySelector || montajesInicio.has(raiz)) throw new TypeError('Se requiere una raíz de Inicio sin otro montaje.');
  const documento = raiz.ownerDocument;
  const buscar = id => { const e = raiz.querySelector(`#${id}`); if (!e) throw new TypeError('Falta un elemento de Inicio.'); return e; };
  const elementos = Object.fromEntries(['demo-products', 'live-products', 'catalog-status', 'catalog-results',
    'catalog-count', 'retry', 'refresh', 'catalog-notice', 'recommendations-title'].map(nombre => [nombre, buscar(`home-${nombre}`)]));
  function renderizar(estado) {
    elementos['catalog-notice'].dataset.estado = estado.estado;
    elementos['catalog-status'].textContent = estado.mensaje;
    elementos['catalog-results'].setAttribute('aria-busy', String(estado.estado === 'cargando'));
    elementos['demo-products'].hidden = estado.estado !== 'pendiente';
    elementos['live-products'].hidden = !['listo', 'vacio'].includes(estado.estado);
    elementos['live-products'].replaceChildren(...estado.vistas.map(v => tarjetaInicio(documento, v)));
    elementos.retry.hidden = estado.estado !== 'error' || ['VALIDACION', 'CONFIGURACION'].includes(estado.codigo);
    elementos.refresh.hidden = estado.estado === 'pendiente';
    elementos.refresh.disabled = estado.estado === 'cargando';
    elementos['recommendations-title'].textContent = estado.estado === 'pendiente' ? 'Recomendados para ti' : 'Artículos de prueba';
    elementos['catalog-count'].textContent = estado.estado === 'pendiente' ? '4 artículos de ejemplo de Figma'
      : estado.estado === 'listo' || estado.estado === 'vacio' ? `${estado.vistas.length} artículos en esta respuesta sintética; no es un total global`
        : 'No hay una respuesta completada para mostrar';
  }
  const controlador = crearControladorInicio({ ...dependencias, alCambiar: renderizar });
  const consultar = () => { void controlador.consultar(); };
  elementos.refresh.addEventListener('click', consultar); elementos.retry.addEventListener('click', consultar);
  let desconectado = false;
  const montaje = { consultar: controlador.consultar, obtenerEstado: controlador.obtenerEstado, desconectar() {
    if (desconectado) return;
    desconectado = true; controlador.desconectar();
    elementos.refresh.removeEventListener('click', consultar); elementos.retry.removeEventListener('click', consultar);
    if (montajesInicio.get(raiz) === montaje) montajesInicio.delete(raiz);
  } };
  montajesInicio.set(raiz, montaje); controlador.preparar();
  return montaje;
}

/* Eventos: sin SDK, datos personales, persistencia, imports ausentes ni red. */
if (typeof document !== 'undefined') {
  const raiz = document.querySelector('[data-inicio]');
  if (raiz) {
    montarInicio({ raiz });
    document.defaultView.addEventListener('pagehide', () => desmontarInicio(raiz));
    document.defaultView.addEventListener('pageshow', evento => {
      if (evento.persisted && !montajesInicio.has(raiz)) montarInicio({ raiz });
    });
  }
}
