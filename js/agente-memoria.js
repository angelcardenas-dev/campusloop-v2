/* ANGEL / D1.2. Dominio offline: sin SDK, DOM, red ni almacenamiento global.
   Puertos, clave y retención provisionales; no montar en producción todavía. */
export const POLITICA_PROVISIONAL_MEMORIA = Object.freeze({ maxBytes: 24 * 1024, ttlMs: 7 * 86400000 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDENES = ['recientes', 'precio-menor', 'precio-mayor'];
const ESTADOS = ['disponible', 'reservado', 'vendido'];
const CONDICIONES = ['nuevo', 'como_nuevo', 'buen_estado', 'usado'];
const CAMPOS = ['tipo', 'categorias', 'estados', 'condiciones', 'precioMinimoCentimos', 'precioMaximoCentimos', 'orden'];
const MENSAJES = {
  CONTEXTO_INVALIDO: 'El contexto no cumple la lista de campos públicos permitidos.',
  IDENTIDAD_INVALIDA: 'No pudimos resolver una identidad válida; no se accederá al almacenamiento.',
  CONFIGURACION: 'La memoria no tiene una configuración de prueba válida.',
  TAMANO: 'El contexto supera el tamaño permitido.',
  FORMATO: 'La memoria guardada está dañada o no cumple su esquema.',
  VERSION: 'La versión de memoria guardada no es compatible.',
  EXPIRADO: 'El contexto guardado ha caducado.',
  ALMACENAMIENTO: 'No se pudo completar el acceso al almacenamiento. El chat puede continuar sin persistencia.',
  CUOTA: 'No hay espacio para guardar el contexto. Puede seguir usándose en esta página.',
  CANCELADA: 'La operación de memoria fue invalidada.',
};
const bien = datos => ({ ok: true, datos, error: null });
const mal = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: MENSAJES[codigo] } });
const copiar = contexto => contexto === null ? null : { ...contexto, categorias: [...contexto.categorias], estados: [...contexto.estados], condiciones: [...contexto.condiciones] };
const bytes = texto => new TextEncoder().encode(texto).byteLength;

// No ejecutar getters/toJSON, admitir símbolos ni aceptar propiedades heredadas.
function registro(valor, campos, obligatorios = []) {
  if (!valor || typeof valor !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(valor))) return false;
  return Reflect.ownKeys(valor).every(k => typeof k === 'string' && campos.includes(k)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(valor, k), 'value')
    && Object.getOwnPropertyDescriptor(valor, k).enumerable)
    && obligatorios.every(k => Object.hasOwn(valor, k));
}
function lista(valor, acepta) {
  if (!Array.isArray(valor) || valor.length > 600) return null; // Guardia de tamaño previa a recorrer UUID; no límite de turnos.
  const claves = Reflect.ownKeys(valor);
  if (claves.length !== valor.length + 1) return null;
  const salida = [];
  for (let i = 0; i < valor.length; i++) {
    const d = Object.getOwnPropertyDescriptor(valor, String(i));
    if (!d || !Object.hasOwn(d, 'value') || !acepta(d.value)) return null;
    salida.push(typeof d.value === 'string' ? d.value.toLowerCase() : d.value);
  }
  if (new Set(salida).size !== salida.length) return null;
  return salida.sort();
}
function validar(contexto, categoriasPermitidas) {
  if (!registro(contexto, CAMPOS, ['tipo', 'orden']) || contexto.tipo !== 'busqueda_catalogo' || !ORDENES.includes(contexto.orden)) return mal('CONTEXTO_INVALIDO');
  const campo = (nombre, defecto) => Object.hasOwn(contexto, nombre) ? contexto[nombre] : defecto;
  const categorias = lista(campo('categorias', []), v => typeof v === 'string' && UUID.test(v) && categoriasPermitidas.has(v.toLowerCase()));
  const estados = lista(campo('estados', []), v => ESTADOS.includes(v));
  const condiciones = lista(campo('condiciones', []), v => CONDICIONES.includes(v));
  const minimo = campo('precioMinimoCentimos', null), maximo = campo('precioMaximoCentimos', null);
  if (!categorias || !estados || !condiciones || [minimo, maximo].some(p => p !== null && (!Number.isSafeInteger(p) || p < 0))
    || (minimo !== null && maximo !== null && minimo > maximo)) return mal('CONTEXTO_INVALIDO');
  return bien({ tipo: 'busqueda_catalogo', categorias, estados, condiciones, precioMinimoCentimos: minimo, precioMaximoCentimos: maximo, orden: contexto.orden });
}
function catalogoSeguro(ids) {
  const valores = lista(ids, id => typeof id === 'string' && UUID.test(id));
  return valores ? new Set(valores) : null;
}

export function validarContextoPermitido(contexto, { categoriasPermitidas = [] } = {}) {
  try {
    const permitidas = catalogoSeguro(categoriasPermitidas);
    return permitidas ? validar(contexto, permitidas) : mal('CONFIGURACION');
  } catch { return mal('CONTEXTO_INVALIDO'); }
}

export function crearClaveMemoria(usuarioId) {
  return typeof usuarioId === 'string' && UUID.test(usuarioId)
    ? bien('campusloop_tb4_v1_agente_historial_' + usuarioId.toLowerCase()) : mal('IDENTIDAD_INVALIDA');
}

export function resumirContexto(contexto, opciones) {
  const resultado = validarContextoPermitido(contexto, opciones);
  if (!resultado.ok) return resultado;
  const c = resultado.datos, partes = ['Estábamos buscando artículos'];
  const soles = n => { const v = BigInt(n); return 'S/ ' + (v / 100n) + '.' + String(v % 100n).padStart(2, '0'); };
  if (c.categorias.length) partes.push(c.categorias.length === 1 ? 'de una categoría pública validada' : `de ${c.categorias.length} categorías públicas validadas`);
  if (c.estados.length) partes.push('con estado: ' + c.estados.join(', '));
  if (c.condiciones.length) partes.push('con condición: ' + c.condiciones.map(v => v.replaceAll('_', ' ')).join(', '));
  if (c.precioMinimoCentimos !== null) partes.push('con presupuesto mínimo de ' + soles(c.precioMinimoCentimos));
  if (c.precioMaximoCentimos !== null) partes.push('con presupuesto máximo de ' + soles(c.precioMaximoCentimos));
  partes.push('ordenados por ' + ({ recientes: 'los más recientes', 'precio-menor': 'menor precio', 'precio-mayor': 'mayor precio' })[c.orden]);
  return bien(partes.join(' ') + '. Debemos volver a consultar el catálogo.');
}

/* Propuesta de composición: proveedores confiables inyectados, sin datos de prompt
   en los argumentos de actualizar(). No es la API de localstorage.js de Maricielo. */
export function crearMemoriaAgente({ almacenamiento = null, obtenerIdentidad, producirContexto,
  categoriasPermitidas = [], politica = null, ahora = Date.now } = {}) {
  let contexto = null, actor = null, fecha = null, activa = true, secuencia = 0, operacion = null;
  let identidadConfirmada = false;
  let trabajoActivo = false, pendiente = null;
  let categorias;
  try { categorias = catalogoSeguro(categoriasPermitidas); } catch { categorias = null; }
  // Copiar configuración: cambios posteriores del consumidor no cambian la política.
  let limites = null, politicaSegura = false;
  try {
    politicaSegura = politica === null || registro(politica, ['maxBytes', 'ttlMs'], ['maxBytes', 'ttlMs']);
    if (politica !== null && politicaSegura) limites = { maxBytes: politica.maxBytes, ttlMs: politica.ttlMs };
  } catch { politicaSegura = false; }
  const configurada = categorias && typeof obtenerIdentidad === 'function' && typeof ahora === 'function'
    && politicaSegura && (politica === null || (Number.isSafeInteger(limites.maxBytes)
      && limites.maxBytes > 0 && limites.maxBytes <= 24576 && Number.isSafeInteger(limites.ttlMs)
      && limites.ttlMs > 0 && limites.ttlMs <= 7 * 86400000));
  const persistencia = almacenamiento !== null && limites !== null;
  function reloj() { const v = ahora(); if (!Number.isSafeInteger(v) || !Number.isFinite(new Date(v).getTime())) throw 'CONFIGURACION'; return v; }
  function cancelarOperacion() {
    secuencia++; operacion?.abort(); operacion = null;
    if (pendiente) { pendiente.reject('CANCELADA'); pendiente = null; }
  }
  function limpiarContexto() { contexto = null; actor = null; fecha = null; identidadConfirmada = false; }
  function invalidarIdentidad() { cancelarOperacion(); limpiarContexto(); }
  function iniciar() {
    cancelarOperacion(); identidadConfirmada = false; operacion = new AbortController();
    return { numero: secuencia, signal: operacion.signal };
  }
  function fechaVigente(ms) {
    const instante = reloj();
    return ms !== null && instante >= ms && (!limites || instante - ms < limites.ttlMs);
  }
  function vigente(op) { return activa && op.numero === secuencia && !op.signal.aborted; }
  function comprobar(op) { if (!vigente(op)) throw 'CANCELADA'; }
  // Cancelar la espera incluso si un doble/productor ignora signal, sin aplicar su resultado.
  function esperar(promesa, op) {
    if (!vigente(op)) { Promise.resolve(promesa).catch(() => {}); return Promise.reject('CANCELADA'); }
    return new Promise((resolve, reject) => {
      const cancelar = () => { op.signal.removeEventListener('abort', cancelar); reject('CANCELADA'); };
      op.signal.addEventListener('abort', cancelar, { once: true });
      Promise.resolve(promesa).then(v => { op.signal.removeEventListener('abort', cancelar); resolve(v); }, e => { op.signal.removeEventListener('abort', cancelar); reject(e); });
    });
  }
  async function identidad(op) {
    let valor;
    try { valor = await esperar(obtenerIdentidad({ signal: op.signal }), op); }
    catch (e) { throw e === 'CANCELADA' ? e : 'IDENTIDAD_INVALIDA'; }
    comprobar(op);
    if (valor === null) return null;
    if (!registro(valor, ['id'], ['id']) || !crearClaveMemoria(valor.id).ok) throw 'IDENTIDAD_INVALIDA';
    return valor.id.toLowerCase();
  }
  async function revalidar(op, id) {
    const actual = await identidad(op);
    comprobar(op);
    if (actual !== id) { invalidarIdentidad(); throw 'CANCELADA'; }
  }
  async function puerto(nombre, id, valor, op) {
    if (typeof almacenamiento?.[nombre] !== 'function') throw 'ALMACENAMIENTO';
    const clave = crearClaveMemoria(id).datos;
    // Mantener orden físico: un guardado viejo no puede terminar sobre otro nuevo
    // de esta instancia aunque el adaptador ignore la cancelación.
    const trabajo = new Promise((resolve, reject) => {
      const tarea = { resolve, reject, ejecutar: () => {
        comprobar(op);
        return nombre === 'guardar' ? almacenamiento[nombre](clave, valor, { signal: op.signal })
          : almacenamiento[nombre](clave, { signal: op.signal });
      } };
      if (trabajoActivo) pendiente = tarea;
      else despachar(tarea);
    });
    let r;
    try { r = await esperar(trabajo, op); } catch (e) {
      if (e === 'CANCELADA') throw e;
      throw e?.name === 'QuotaExceededError' ? 'CUOTA' : 'ALMACENAMIENTO';
    }
    comprobar(op);
    if (r?.ok !== true) throw r?.error?.codigo === 'CUOTA' ? 'CUOTA' : 'ALMACENAMIENTO';
    return r.datos;
  }
  function despachar(tarea) {
    trabajoActivo = true;
    Promise.resolve().then(tarea.ejecutar).then(tarea.resolve, tarea.reject).finally(() => {
      trabajoActivo = false;
      const siguiente = pendiente; pendiente = null;
      if (siguiente) despachar(siguiente);
    });
  }
  function leerDocumento(texto, id, instante) {
    if (typeof texto !== 'string') throw 'FORMATO';
    if (texto.length > limites.maxBytes || bytes(texto) > limites.maxBytes) throw 'TAMANO';
    let d; try { d = JSON.parse(texto); } catch { throw 'FORMATO'; }
    if (!registro(d, ['version', 'usuarioId', 'actualizadoEn', 'contexto'], ['version', 'usuarioId', 'actualizadoEn', 'contexto'])) throw 'FORMATO';
    if (d.version !== 1) throw 'VERSION';
    if (d.usuarioId !== id) throw 'IDENTIDAD_INVALIDA';
    const ms = typeof d.actualizadoEn === 'string' ? Date.parse(d.actualizadoEn) : NaN;
    if (!Number.isSafeInteger(ms) || new Date(ms).toISOString() !== d.actualizadoEn || ms > instante) throw 'FORMATO';
    if (instante - ms >= limites.ttlMs) throw 'EXPIRADO';
    const c = validar(d.contexto, categorias); if (!c.ok) throw 'FORMATO';
    return { contexto: c.datos, fecha: ms };
  }
  async function ejecutar(tipo) {
    if (!activa) return mal('CANCELADA');
    if (!configurada) return mal('CONFIGURACION');
    const op = iniciar();
    if (tipo !== 'actualizar') limpiarContexto();
    let id = null;
    try {
      id = await identidad(op); comprobar(op);
      if (!id || actor !== id || (contexto !== null && !fechaVigente(fecha))) limpiarContexto();
      actor = id; identidadConfirmada = true;
      if (tipo === 'actualizar') {
        if (typeof producirContexto !== 'function') throw 'CONFIGURACION';
        const entrada = await esperar(producirContexto({ signal: op.signal }), op); comprobar(op);
        const validacion = validar(entrada, categorias); if (!validacion.ok) throw 'CONTEXTO_INVALIDO';
        await revalidar(op, id); comprobar(op);
        const instante = reloj();
        const documento = { version: 1, usuarioId: id, actualizadoEn: new Date(instante).toISOString(), contexto: validacion.datos };
        const serializado = JSON.stringify(documento);
        if (bytes(serializado) > (limites?.maxBytes ?? 24576)) throw 'TAMANO';
        contexto = validacion.datos; fecha = instante;
        if (!id || !persistencia) return bien({ contexto: copiar(contexto), persistido: false });
        await puerto('guardar', id, serializado, op); await revalidar(op, id); comprobar(op);
        return bien({ contexto: copiar(contexto), persistido: true });
      }
      if (!id || !persistencia) return bien({ contexto: null, persistido: false });
      if (tipo === 'borrar') {
        await puerto('eliminar', id, null, op); await revalidar(op, id); comprobar(op);
        return bien({ contexto: null, persistido: false });
      }
      const valor = await puerto('leer', id, null, op); await revalidar(op, id); comprobar(op);
      if (valor === null) return bien({ contexto: null, persistido: false });
      const d = leerDocumento(valor, id, reloj());
      contexto = d.contexto; fecha = d.fecha;
      return bien({ contexto: copiar(contexto), persistido: true });
    } catch (e) {
      if (!vigente(op)) return mal('CANCELADA');
      let codigo = typeof e === 'string' && Object.hasOwn(MENSAJES, e) ? e : 'CONFIGURACION';
      // Un fallo no renueva el TTL: conservar solo contexto ya validado de la
      // misma cuenta, tras otra comprobación de identidad y de su fecha original.
      if (tipo === 'actualizar' && id && actor === id && contexto !== null && codigo !== 'IDENTIDAD_INVALIDA') {
        try {
          await revalidar(op, id); comprobar(op);
          if (!fechaVigente(fecha)) limpiarContexto();
        } catch (fallo) {
          if (!vigente(op)) return mal('CANCELADA');
          limpiarContexto();
          codigo = typeof fallo === 'string' && Object.hasOwn(MENSAJES, fallo) ? fallo : 'CONFIGURACION';
        }
      } else limpiarContexto();
      return mal(codigo);
    }
  }
  return {
    actualizar: () => ejecutar('actualizar'), recuperar: () => ejecutar('recuperar'), borrar: () => ejecutar('borrar'),
    invalidarIdentidad,
    obtenerContexto() {
      try { if (fecha !== null && !fechaVigente(fecha)) invalidarIdentidad(); }
      catch { invalidarIdentidad(); }
      // Una operación nueva debe verificar la cuenta antes de exponer su contexto.
      return identidadConfirmada ? copiar(contexto) : null;
    },
    desmontar() { invalidarIdentidad(); activa = false; },
  };
}
