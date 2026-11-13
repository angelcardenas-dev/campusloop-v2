/* Datos */
// Este módulo no conoce el DTO, los filtros REST ni los catálogos definitivos.
// Los adaptadores de presentación se acordarán con Bernabé antes de integrar.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDENES_UI = ['recientes', 'precio-menor', 'precio-mayor'];
const MENSAJES = Object.freeze({
  PENDIENTE: 'Integración pendiente: ejemplos de Figma, no resultados de Supabase. Los filtros no modifican estos ejemplos.',
  VALIDACION: 'Revisa la búsqueda, las opciones y los precios. Usa importes no negativos con hasta dos decimales.',
  RED: 'No se pudo consultar el catálogo. Conservamos tus filtros; puedes reintentar.',
  LIMITE: 'El servicio alcanzó su límite. Espera antes de reintentar.',
  NO_AUTORIZADO: 'El servicio necesita un acceso autorizado. No se consultaron datos privados.',
  CONFIGURACION: 'Falta completar el contrato del catálogo. No se muestran resultados inventados.',
  RESPUESTA_INVALIDA: 'La respuesta no cumple el contrato de presentación. No se muestran artículos inventados.',
  TIEMPO_AGOTADO: 'La consulta tardó demasiado. Conservamos tus filtros; puedes reintentar.',
  SERVIDOR: 'No se pudo completar la consulta. Conservamos tus filtros; puedes reintentar.',
});
const montajes = new WeakMap();
const copia = valor => JSON.parse(JSON.stringify(valor));
const texto = (valor, maximo) => typeof valor === 'string' && valor.trim().length > 0
  && Array.from(valor).length <= maximo && !/[\u0000-\u001f\u007f]/.test(valor);
const esId = valor => typeof valor === 'string' && UUID.test(valor);
const mensajeError = codigo => Object.hasOwn(MENSAJES, codigo) ? MENSAJES[codigo] : MENSAJES.SERVIDOR;

/* Funciones: estado de filtros de UI, no parámetros SQL ni REST */
export function filtrosIniciales() {
  return { busqueda: '', categorias: [], universidad: '', campus: '', estados: [], condiciones: [],
    precioMinimo: '', precioMaximo: '', orden: 'recientes' };
}
export function precioACentimos(valor) {
  if (typeof valor !== 'string') throw new TypeError('Importe inválido');
  const limpio = valor.trim();
  if (!limpio) return null;
  if (!/^\d{1,16}(?:[.,]\d{1,2})?$/.test(limpio)) throw new TypeError('Importe inválido');
  const [entero, fraccion = ''] = limpio.split(/[.,]/);
  const centimos = Number(entero) * 100 + Number(fraccion.padEnd(2, '0'));
  if (!Number.isSafeInteger(centimos)) throw new TypeError('Importe inválido');
  return centimos;
}
export function opcionesDePresentacion(opciones = {}) {
  const resultado = {};
  for (const grupo of ['categorias', 'universidades', 'campus', 'estados', 'condiciones']) {
    const lista = opciones[grupo] ?? [];
    if (!Array.isArray(lista) || lista.length > 200) throw new TypeError('Opciones de catálogo inválidas');
    const valores = new Set();
    resultado[grupo] = Array.from(lista, item => {
      const valor = grupo === 'estados' || grupo === 'condiciones' ? item?.valor : item?.id;
      if (!texto(item?.etiqueta, 100) || !texto(valor, 100) || valores.has(valor)
        || (!['estados', 'condiciones'].includes(grupo) && !esId(valor))) throw new TypeError('Opciones de catálogo inválidas');
      valores.add(valor);
      if (grupo === 'campus' && !esId(item.universidadId)) throw new TypeError('Relación de campus inválida');
      return grupo === 'campus' ? { id: valor, etiqueta: item.etiqueta, universidadId: item.universidadId }
        : ['estados', 'condiciones'].includes(grupo) ? { valor, etiqueta: item.etiqueta } : { id: valor, etiqueta: item.etiqueta };
    });
  }
  if (resultado.campus.some(c => !resultado.universidades.some(u => u.id === c.universidadId))) throw new TypeError('Universidad de campus desconocida');
  return resultado;
}
function validarFiltros(entrada, opciones) {
  const iniciales = filtrosIniciales();
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)
    || Object.keys(entrada).some(clave => !Object.hasOwn(iniciales, clave))) throw new TypeError('Filtros inválidos');
  const f = { ...iniciales, ...entrada };
  if (typeof f.busqueda !== 'string' || Array.from(f.busqueda).length > 120
    || /[\u0000-\u001f\u007f]/.test(f.busqueda) || !ORDENES_UI.includes(f.orden)) throw new TypeError('Filtros inválidos');
  for (const grupo of ['categorias', 'estados', 'condiciones']) {
    if (!Array.isArray(f[grupo]) || f[grupo].length > 200 || new Set(f[grupo]).size !== f[grupo].length
      || !Array.from(f[grupo]).every(v => opciones[grupo].some(o => (o.id ?? o.valor) === v))) throw new TypeError('Selección inválida');
  }
  if (typeof f.universidad !== 'string' || typeof f.campus !== 'string'
    || (f.universidad && !opciones.universidades.some(u => u.id === f.universidad))
    || (f.campus && !opciones.campus.some(c => c.id === f.campus && c.universidadId === f.universidad))) throw new TypeError('Campus inválido');
  const minimo = precioACentimos(f.precioMinimo), maximo = precioACentimos(f.precioMaximo);
  if (minimo !== null && maximo !== null && minimo > maximo) throw new TypeError('Rango inválido');
  return { busqueda: f.busqueda.trim(), categorias: [...f.categorias], universidad: f.universidad,
    campus: f.campus, estados: [...f.estados], condiciones: [...f.condiciones],
    precioMinimoCentimos: minimo, precioMaximoCentimos: maximo, orden: f.orden };
}
export function crearRutaDetalle(id, parametro) {
  if (!esId(id) || typeof parametro !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(parametro)) return null;
  return `detalle.html?${new URLSearchParams({ [parametro]: id })}`;
}
function fotoSegura(foto, origenes) {
  if (!foto || !texto(foto.alt, 300) || typeof foto.url !== 'string') return null;
  if (/^assets\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(foto.url)) return { url: foto.url, alt: foto.alt };
  try {
    const url = new URL(foto.url);
    if (url.protocol === 'https:' && origenes.includes(url.origin) && !url.username && !url.password && !url.search && !url.hash) return { url: url.href, alt: foto.alt };
  } catch { /* Una foto insegura se sustituye, sin intentar cargarla. */ }
  return null;
}
function validarVista(vista, origenes, detalle) {
  if (!vista || !esId(vista.id) || !texto(vista.titulo, 100) || vista.moneda !== 'PEN'
    || !Number.isSafeInteger(vista.precioCentimos) || vista.precioCentimos < 0) throw new TypeError('Vista inválida');
  for (const clave of ['categoriaTexto', 'ubicacionTexto', 'vendedorTexto', 'estadoTexto']) {
    if (vista[clave] != null && !texto(vista[clave], 200)) throw new TypeError('Texto de vista inválido');
  }
  if (vista.tono != null && !['neutral', 'positivo', 'aviso'].includes(vista.tono)) throw new TypeError('Tono de vista inválido');
  return { id: vista.id, titulo: vista.titulo, moneda: 'PEN', precioCentimos: vista.precioCentimos,
    categoriaTexto: vista.categoriaTexto ?? null, ubicacionTexto: vista.ubicacionTexto ?? null,
    vendedorTexto: vista.vendedorTexto ?? null, estadoTexto: vista.estadoTexto ?? null, tono: vista.tono ?? 'neutral',
    foto: fotoSegura(vista.foto, origenes), detalle: detalle.habilitado === true ? crearRutaDetalle(vista.id, detalle.parametro) : null };
}

export function crearControladorCatalogo({ modo = 'pendiente', consultarCatalogo, adaptarFiltros, adaptarArticulo,
  opciones = {}, origenesImagen = [], detalle = {}, alCambiar = () => {}, timeoutMs = 15000 } = {}) {
  const catalogos = opcionesDePresentacion(opciones);
  if (!Array.isArray(origenesImagen) || !origenesImagen.every(o => {
    try { const u = new URL(o); return u.protocol === 'https:' && u.origin === o; } catch { return false; }
  }) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw new TypeError('Configuración de presentación inválida');
  const disponible = modo === 'prueba' && [consultarCatalogo, adaptarFiltros, adaptarArticulo].every(fn => typeof fn === 'function');
  let secuencia = 0, actual = null, cerrada = false;
  let estado = { estado: 'pendiente', mensaje: MENSAJES.PENDIENTE, vistas: [] };
  function publicar(nuevo) {
    estado = nuevo;
    try { alCambiar(copia(nuevo)); } catch { /* El consumidor gestiona sus errores de UI. */ }
    return copia(nuevo);
  }
  function cancelar() {
    secuencia++;
    actual?.cancelar();
    actual = null;
  }
  return {
    obtenerEstado: () => copia(estado),
    preparar() {
      if (cerrada) return;
      cancelar();
      publicar(disponible ? { estado: 'preparado', mensaje: 'Filtros modificados. Pulsa Aplicar para consultar de nuevo.', vistas: [] }
        : { estado: 'pendiente', mensaje: MENSAJES.PENDIENTE, vistas: [] });
    },
    async aplicar(filtros = {}) {
      if (cerrada) return null;
      cancelar();
      let seleccion;
      try { seleccion = validarFiltros(filtros, catalogos); }
      catch { return publicar({ estado: 'error', codigo: 'VALIDACION', mensaje: MENSAJES.VALIDACION, vistas: [] }); }
      if (!disponible) return publicar({ estado: 'pendiente', mensaje: MENSAJES.PENDIENTE, vistas: [] });
      let consulta;
      try {
        consulta = adaptarFiltros(copia(seleccion));
        if (!consulta || typeof consulta !== 'object' || Array.isArray(consulta) || typeof consulta.then === 'function') throw new TypeError();
      } catch { return publicar({ estado: 'error', codigo: 'CONFIGURACION', mensaje: MENSAJES.CONFIGURACION, vistas: [] }); }
      const turno = ++secuencia;
      const aborto = new AbortController();
      let rechazar, motivo;
      const interrumpida = new Promise((_, reject) => { rechazar = reject; });
      const interrumpir = codigo => { if (motivo) return; motivo = codigo; aborto.abort(); rechazar(new Error('Consulta interrumpida')); };
      const timer = setTimeout(() => interrumpir('TIEMPO_AGOTADO'), timeoutMs);
      actual = { cancelar: () => interrumpir('CANCELADO') };
      publicar({ estado: 'cargando', mensaje: 'Prueba offline: consultando la dependencia simulada…', vistas: [] });
      try {
        const respuesta = await Promise.race([Promise.resolve().then(() => {
          if (aborto.signal.aborted) throw new Error('Consulta cancelada');
          return consultarCatalogo(consulta, { signal: aborto.signal });
        }), interrumpida]);
        if (cerrada || turno !== secuencia) return null;
        if (respuesta?.ok === false) return publicar({ estado: 'error', codigo: 'CONSULTA', mensaje: mensajeError(respuesta?.error?.codigo), vistas: [] });
        if (respuesta?.ok !== true || respuesta.error !== null || !Array.isArray(respuesta.datos) || respuesta.datos.length > 100) throw new TypeError('Respuesta inválida');
        const vistas = Array.from(respuesta.datos, item => validarVista(adaptarArticulo(item), origenesImagen, detalle));
        if (new Set(vistas.map(v => v.id)).size !== vistas.length) throw new TypeError('Identificadores repetidos');
        return publicar({ estado: vistas.length ? 'listo' : 'vacio', vistas,
          mensaje: vistas.length ? `Prueba offline: ${vistas.length} artículos en esta respuesta. Total del catálogo no informado.`
            : 'Prueba offline: no hay coincidencias en esta respuesta. Puedes limpiar los filtros.' });
      } catch (error) {
        if (cerrada || turno !== secuencia || motivo === 'CANCELADO') return null;
        const codigo = motivo === 'TIEMPO_AGOTADO' ? motivo : error instanceof TypeError ? 'RESPUESTA_INVALIDA' : 'SERVIDOR';
        return publicar({ estado: 'error', codigo, mensaje: mensajeError(codigo), vistas: [] });
      } finally {
        clearTimeout(timer);
        if (turno === secuencia) actual = null;
      }
    },
    cancelar,
    desconectar() { cerrada = true; cancelar(); },
  };
}

/* Elementos y renderizado: modelo propio de tarjeta, no DTO de PostgreSQL */
export function crearTarjeta(documento, vista) {
  const nodo = (etiqueta, clase, contenido) => {
    const elemento = documento.createElement(etiqueta); elemento.className = clase;
    if (contenido != null) elemento.textContent = contenido;
    return elemento;
  };
  const tarjeta = nodo('article', 'product-card explore-product');
  const media = nodo('div', 'product-card-media');
  const sinFoto = () => nodo('div', 'explore-photo-empty', 'Sin fotografía');
  if (vista.foto) {
    const img = nodo('img', ''); img.src = vista.foto.url; img.alt = vista.foto.alt;
    img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => { img.replaceWith(sinFoto()); }, { once: true });
    media.append(img);
  } else media.append(sinFoto());
  if (vista.estadoTexto) media.append(nodo('span', `status ${vista.tono === 'positivo' ? 'status-available' : vista.tono === 'aviso' ? 'status-reserved' : ''}`, vista.estadoTexto));
  tarjeta.append(media);
  const titulo = nodo('h3', 'product-card-title', vista.titulo);
  titulo.id = `explore-live-${vista.id}`; tarjeta.setAttribute('aria-labelledby', titulo.id); tarjeta.append(titulo);
  for (const [clave, clase] of [['categoriaTexto', 'product-card-meta explore-category'], ['ubicacionTexto', 'product-card-meta explore-campus']]) {
    if (vista[clave]) tarjeta.append(nodo('p', clase, vista[clave]));
  }
  const entero = Math.floor(vista.precioCentimos / 100), decimales = vista.precioCentimos % 100;
  tarjeta.append(nodo('p', 'product-card-price', `S/ ${new Intl.NumberFormat('es-PE').format(entero)}${decimales ? '.' + String(decimales).padStart(2, '0') : ''}`));
  if (vista.vendedorTexto) tarjeta.append(nodo('p', 'explore-seller', vista.vendedorTexto));
  if (vista.detalle) {
    const enlace = nodo('a', 'button button-primary', 'Ver detalle'); enlace.href = vista.detalle;
    enlace.setAttribute('aria-label', `Ver detalle de ${vista.titulo}`); tarjeta.append(enlace);
  } else {
    const pendiente = nodo('span', 'button button-primary', 'Detalle pendiente');
    pendiente.setAttribute('aria-disabled', 'true'); tarjeta.append(pendiente);
  }
  return tarjeta;
}

export function desmontarCatalogo(raiz) { montajes.get(raiz)?.desconectar(); }
export function montarCatalogo({ raiz, opciones = {}, ...dependencias } = {}) {
  if (!raiz?.querySelector || montajes.has(raiz)) throw new TypeError('Se requiere una raíz sin otro catálogo conectado.');
  const documento = raiz.ownerDocument;
  const buscar = id => { const e = raiz.querySelector(`#${id}`); if (!e) throw new TypeError('Falta un elemento de Explorar'); return e; };
  const e = {};
  for (const nombre of ['header-search', 'search', 'sort', 'sort-mobile', 'toggle-filters', 'filters', 'filters-title', 'close-filters',
    'filter-form', 'university', 'campus', 'min-price', 'max-price', 'apply', 'clear', 'retry', 'status', 'notice', 'results',
    'count', 'demo-products', 'live-products', 'pagination', 'source-hint', 'category-options', 'state-options', 'condition-options']) e[nombre] = buscar(`explore-${nombre}`);
  const catalogos = opcionesDePresentacion(opciones);
  const limpiezas = [];
  const escuchar = (elemento, evento, callback) => { elemento.addEventListener(evento, callback); limpiezas.push(() => elemento.removeEventListener(evento, callback)); };
  const opcionesSelect = (select, lista, etiqueta) => {
    const inicial = documento.createElement('option'); inicial.value = ''; inicial.textContent = etiqueta;
    select.replaceChildren(inicial);
    for (const item of lista) { const o = documento.createElement('option'); o.value = item.id; o.textContent = item.etiqueta; select.append(o); }
    select.disabled = !lista.length;
  };
  const actualizarCampus = () => opcionesSelect(e.campus, catalogos.campus.filter(c => c.universidadId === e.university.value), 'Todos los campus');
  opcionesSelect(e.university, catalogos.universidades, 'Todas las universidades'); actualizarCampus();
  for (const [grupo, contenedor] of [['categorias', 'category-options'], ['estados', 'state-options'], ['condiciones', 'condition-options']]) {
    if (!catalogos[grupo].length) continue; // Conservar etiquetas de Figma sin inventar IDs.
    e[contenedor].replaceChildren();
    for (const item of catalogos[grupo]) {
      const label = documento.createElement('label'); label.className = 'explore-option';
      const input = documento.createElement('input'); input.type = 'checkbox'; input.value = item.id ?? item.valor;
      const textoOpcion = documento.createElement('span'); textoOpcion.textContent = item.etiqueta;
      label.append(input, textoOpcion); e[contenedor].append(label);
    }
  }
  function renderizar(estado) {
    e.notice.dataset.estado = estado.estado; e.status.textContent = estado.mensaje;
    e['source-hint'].textContent = dependencias.modo === 'prueba' ? 'Datos sintéticos y consulta inyectada exclusivamente para pruebas. No se contactó Supabase.' : 'Las opciones sin identificadores confirmados permanecen deshabilitadas.';
    e.results.setAttribute('aria-busy', String(estado.estado === 'cargando'));
    e.retry.hidden = estado.estado !== 'error' || ['VALIDACION', 'CONFIGURACION'].includes(estado.codigo);
    e['demo-products'].hidden = estado.estado !== 'pendiente';
    e['live-products'].hidden = !['listo', 'vacio'].includes(estado.estado);
    e['live-products'].replaceChildren(...estado.vistas.map(v => crearTarjeta(documento, v)));
    e.count.textContent = estado.estado === 'pendiente' ? '8 artículos de ejemplo · Figma'
      : estado.estado === 'listo' ? `${estado.vistas.length} artículos en esta respuesta de prueba`
        : estado.estado === 'vacio' ? '0 artículos en esta respuesta de prueba'
          : estado.estado === 'cargando' ? 'Consulta de prueba en curso…' : 'Sin una consulta completada para estos filtros';
    e.pagination.hidden = estado.estado !== 'pendiente';
    if (estado.codigo === 'VALIDACION') {
      e.filters.dataset.abierto = 'true'; e['toggle-filters'].setAttribute('aria-expanded', 'true');
      for (const input of [e['min-price'], e['max-price']]) input.setAttribute('aria-invalid', 'true');
      e['min-price'].focus();
    }
  }
  const control = crearControladorCatalogo({ ...dependencias, opciones: catalogos, alCambiar: renderizar });
  function leerFiltros() {
    const seleccion = contenedor => [...e[contenedor].querySelectorAll('input:checked')].map(input => input.value);
    return { busqueda: e.search.value, categorias: seleccion('category-options'), universidad: e.university.value,
      campus: e.campus.value, estados: seleccion('state-options'), condiciones: seleccion('condition-options'),
      precioMinimo: e['min-price'].value, precioMaximo: e['max-price'].value, orden: e.sort.value };
  }
  function modificado() {
    for (const input of [e['min-price'], e['max-price']]) input.removeAttribute('aria-invalid');
    control.preparar();
  }
  function aplicar() { return control.aplicar(leerFiltros()); }
  function panel(abierto) {
    e.filters.dataset.abierto = String(abierto); e['toggle-filters'].setAttribute('aria-expanded', String(abierto));
    if (abierto) e['filters-title'].focus(); else e['toggle-filters'].focus();
  }
  for (const campo of [e.search, e['header-search']]) {
    escuchar(campo, 'input', () => { e.search.value = campo.value; e['header-search'].value = campo.value; modificado(); });
    escuchar(campo, 'keydown', evento => { if (evento.key === 'Enter' && !evento.isComposing) { evento.preventDefault(); void aplicar(); } });
  }
  escuchar(e['filter-form'], 'submit', evento => { evento.preventDefault(); void aplicar(); });
  escuchar(e['filter-form'], 'keydown', evento => { if (evento.key === 'Enter' && evento.target.tagName === 'INPUT' && !evento.isComposing) { evento.preventDefault(); void aplicar(); } });
  escuchar(e['filter-form'], 'input', modificado);
  escuchar(e['filter-form'], 'change', evento => { if (evento.target === e.university) actualizarCampus(); modificado(); });
  for (const campo of [e.sort, e['sort-mobile']]) escuchar(campo, 'change', () => { e.sort.value = campo.value; e['sort-mobile'].value = campo.value; void aplicar(); });
  escuchar(e.apply, 'click', () => { void aplicar(); }); escuchar(e.retry, 'click', () => { void aplicar(); });
  escuchar(e.clear, 'click', () => {
    e['filter-form'].reset(); e.search.value = ''; e['header-search'].value = ''; e.sort.value = 'recientes'; e['sort-mobile'].value = 'recientes';
    actualizarCampus(); modificado(); void aplicar();
  });
  escuchar(e['toggle-filters'], 'click', () => panel(e.filters.dataset.abierto !== 'true'));
  escuchar(e['close-filters'], 'click', () => panel(false));
  escuchar(e.filters, 'keydown', evento => {
    if (evento.key === 'Escape' && !documento.defaultView.matchMedia('(min-width: 1024px)').matches) { evento.preventDefault(); panel(false); }
  });
  const media = documento.defaultView.matchMedia('(min-width: 1024px)');
  const alCambiarAncho = () => { if (!media.matches && e.filters.dataset.abierto !== 'true' && e.filters.contains(documento.activeElement)) e['toggle-filters'].focus(); };
  media.addEventListener('change', alCambiarAncho); limpiezas.push(() => media.removeEventListener('change', alCambiarAncho));
  let desconectado = false;
  const montaje = { aplicar, obtenerEstado: control.obtenerEstado, desconectar() {
    if (desconectado) return;
    desconectado = true;
    control.desconectar(); for (const limpiar of limpiezas) limpiar();
    if (montajes.get(raiz) === montaje) montajes.delete(raiz);
  } };
  montajes.set(raiz, montaje); renderizar(control.obtenerEstado());
  return montaje;
}

// Sin import de articulos.js inexistente, SDK, REST ni fixtures de producción.
if (typeof document !== 'undefined') {
  const raiz = document.querySelector('[data-catalogo]');
  if (raiz) {
    montarCatalogo({ raiz });
    document.defaultView.addEventListener('pagehide', () => desmontarCatalogo(raiz));
    document.defaultView.addEventListener('pageshow', evento => {
      // Volver desde bfcache no vuelve a ejecutar el módulo ES.
      if (evento.persisted && !montajes.has(raiz)) montarCatalogo({ raiz });
    });
  }
}
