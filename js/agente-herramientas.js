import { adaptarFiltros } from './catalogo.js';

// Registro offline: los nombres proceden de la propuesta §7 del contrato del agente.
// El ensamblaje productivo y sus permisos de servidor siguen pendientes.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nombres = Object.freeze(['buscar_articulos', 'recomendar_articulos', 'consultar_mi_cuenta',
  'consultar_mis_reservas', 'consultar_estado_vendedor', 'preparar_borrador_publicacion',
  'consultar_publicaciones_propias']);
const sinArgumentos = new Set(['consultar_mi_cuenta', 'consultar_mis_reservas',
  'consultar_estado_vendedor', 'consultar_publicaciones_propias']);
const camposBusqueda = ['busqueda', 'categorias', 'universidad', 'campus', 'estados',
  'condiciones', 'precioMinimoCentimos', 'precioMaximoCentimos', 'orden'];
const fallo = codigo => ({ ok: false, datos: null, error: { codigo } });
const exito = datos => ({ ok: true, datos, error: null });
// Topes defensivos offline; no fijan cuotas ni límites HTTP del futuro agente.
const plano = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor)
  && [Object.prototype, null].includes(Object.getPrototypeOf(valor))
  && Reflect.ownKeys(valor).every(clave => typeof clave === 'string'
    && Object.hasOwn(Object.getOwnPropertyDescriptors(valor)[clave], 'value'));
const exacto = (valor, campos) => plano(valor) && Reflect.ownKeys(valor).length === campos.length
  && campos.every(campo => Object.hasOwn(valor, campo));
const resultadoCoherente = valor => exacto(valor, ['ok', 'datos', 'error'])
  && (valor.ok === true ? valor.error === null && valor.datos !== null
    : valor.ok === false && valor.datos === null && plano(valor.error) && typeof valor.error.codigo === 'string');
const arregloDensoUnico = (valores, validar) => Array.isArray(valores) && valores.length <= 24
  && Array.from({ length: valores.length }, (_, i) => Object.hasOwn(valores, i)
    && validar(valores[i])).every(Boolean);
const id = valor => typeof valor === 'string' && UUID.test(valor);
const texto = (valor, maximo) => typeof valor === 'string' && valor.trim().length > 0
  && Array.from(valor).length <= maximo && !/[\u0000-\u001f\u007f]/.test(valor);
const esperaLimitada = (promesa, signal, timeoutMs) => new Promise((resolve, reject) => {
  let terminado = false;
  const limpiar = () => { clearTimeout(temporizador); signal.removeEventListener('abort', cancelar); };
  const finalizar = (fn, valor) => { if (terminado) return; terminado = true; limpiar(); fn(valor); };
  const cancelar = () => finalizar(reject, { codigo: 'CANCELADA' });
  const temporizador = setTimeout(() => finalizar(reject, { codigo: 'TIEMPO_AGOTADO' }), timeoutMs);
  signal.addEventListener('abort', cancelar, { once: true });
  Promise.resolve(promesa).then(valor => finalizar(resolve, valor), () => finalizar(reject, { codigo: 'SERVICIO' }));
  if (signal.aborted) cancelar();
});

export const HERRAMIENTAS_AGENTE = nombres;
export function validarArgumentosHerramienta(nombre, argumentos, {
  categoriasPermitidas = [], universidadesPermitidas = [], campusPermitidos = [],
} = {}) {
  if (!nombres.includes(nombre)) return fallo('HERRAMIENTA_DESCONOCIDA');
  if (sinArgumentos.has(nombre)) return exacto(argumentos, []) ? exito({}) : fallo('ARGUMENTOS_INVALIDOS');
  if (nombre === 'recomendar_articulos') return exacto(argumentos, [])
    ? fallo('INTEGRACION_PENDIENTE') : fallo('ARGUMENTOS_INVALIDOS');
  if (nombre === 'preparar_borrador_publicacion') {
    if (!exacto(argumentos, ['titulo', 'descripcion']) || !texto(argumentos.titulo, 100)
      || argumentos.titulo.length > 100 || !texto(argumentos.descripcion, 1000)
      || argumentos.descripcion.length > 1000) return fallo('ARGUMENTOS_INVALIDOS');
    return exito({ titulo: argumentos.titulo, descripcion: argumentos.descripcion });
  }
  try {
    if (!exacto(argumentos, camposBusqueda)) return fallo('ARGUMENTOS_INVALIDOS');
    const normalizados = adaptarFiltros(argumentos); // Nueve campos exactos; sin expresiones REST.
    if (!Array.isArray(categoriasPermitidas) || !categoriasPermitidas.every(id)
      || !normalizados.categorias.every(categoria => categoriasPermitidas.includes(categoria))) return fallo('ARGUMENTOS_INVALIDOS');
    if (!Array.isArray(universidadesPermitidas) || !universidadesPermitidas.every(id)
      || (normalizados.universidad && !universidadesPermitidas.includes(normalizados.universidad))) return fallo('ARGUMENTOS_INVALIDOS');
    if (!Array.isArray(campusPermitidos) || !campusPermitidos.every(campus =>
      exacto(campus, ['id', 'universidadId']) && id(campus.id) && id(campus.universidadId)
      && universidadesPermitidas.includes(campus.universidadId))) return fallo('ARGUMENTOS_INVALIDOS');
    if (normalizados.campus && !campusPermitidos.some(campus => campus.id === normalizados.campus
      && (!normalizados.universidad || campus.universidadId === normalizados.universidad))) return fallo('ARGUMENTOS_INVALIDOS');
    if (!texto(normalizados.busqueda, 120) && normalizados.busqueda !== '') return fallo('ARGUMENTOS_INVALIDOS');
    return exito(normalizados);
  } catch { return fallo('ARGUMENTOS_INVALIDOS'); }
}

// obtenerIdentidad debe verificar Auth real antes de devolver exclusivamente {id}.
// Servicios inyectados: consultarCatalogo(filtros,{signal}), consultarMisReservas(id,{signal}),
// consultarEstadoVendedor(id,{signal}). Ninguno se importa ni se invoca al construir.
export function crearOrquestadorHerramientas({ obtenerIdentidad, servicios = {}, categoriasPermitidas = [],
  universidadesPermitidas = [], campusPermitidos = [], timeoutMs = 15000,
} = {}) {
  let activo = true, turno = 0, operacion = null;
  async function ejecutar(nombre, argumentos) {
    if (!activo) return fallo('CANCELADA');
    operacion?.abort();
    const actual = ++turno, control = new AbortController(); operacion = control;
    const vigente = () => activo && actual === turno && !control.signal.aborted;
    try {
      if (typeof nombre !== 'string' || !nombres.includes(nombre)) return fallo('HERRAMIENTA_DESCONOCIDA');
      if (!plano(argumentos)) return fallo('ARGUMENTOS_INVALIDOS');
      const entrada = validarArgumentosHerramienta(nombre, argumentos,
        { categoriasPermitidas, universidadesPermitidas, campusPermitidos });
      if (!entrada.ok) return entrada;
      if (JSON.stringify(entrada.datos).length > 8192) return fallo('ARGUMENTOS_INVALIDOS');
      if (typeof obtenerIdentidad !== 'function') return fallo('INTEGRACION_PENDIENTE');
      let identidad;
      try { identidad = await esperaLimitada(obtenerIdentidad({ signal: control.signal }), control.signal, timeoutMs); }
      catch (error) { return fallo(error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO_AGOTADO' : vigente() ? 'NO_AUTORIZADO' : 'CANCELADA'); }
      if (!vigente()) return fallo('CANCELADA');
      if (!resultadoCoherente(identidad) || !identidad.ok || !exacto(identidad.datos, ['id']) || !id(identidad.datos.id)) return fallo('NO_AUTORIZADO');
      const actor = identidad.datos.id.toLowerCase();
      let salida;
      if (nombre === 'buscar_articulos') {
        if (typeof servicios.consultarCatalogo !== 'function') return fallo('INTEGRACION_PENDIENTE');
        salida = await esperaLimitada(servicios.consultarCatalogo(entrada.datos, { signal: control.signal }), control.signal, timeoutMs);
      } else if (nombre === 'consultar_mis_reservas') {
        if (typeof servicios.consultarMisReservas !== 'function') return fallo('INTEGRACION_PENDIENTE');
        salida = await esperaLimitada(servicios.consultarMisReservas(actor, { signal: control.signal }), control.signal, timeoutMs);
      } else if (nombre === 'preparar_borrador_publicacion') {
        if (typeof servicios.consultarEstadoVendedor !== 'function') return fallo('INTEGRACION_PENDIENTE');
        salida = await esperaLimitada(servicios.consultarEstadoVendedor(actor, { signal: control.signal }), control.signal, timeoutMs);
      } else return fallo('INTEGRACION_PENDIENTE');
      if (!vigente()) return fallo('CANCELADA');
      let identidadFinal;
      try { identidadFinal = await esperaLimitada(obtenerIdentidad({ signal: control.signal }), control.signal, timeoutMs); }
      catch (error) { return fallo(error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO_AGOTADO' : vigente() ? 'NO_AUTORIZADO' : 'CANCELADA'); }
      if (!vigente() || !resultadoCoherente(identidadFinal) || !identidadFinal.ok || !exacto(identidadFinal.datos, ['id'])
        || !id(identidadFinal.datos.id)
        || identidadFinal.datos.id.toLowerCase() !== actor) return fallo('CANCELADA');
      if (!resultadoCoherente(salida)) return fallo('RESPUESTA_INVALIDA');
      if (salida.ok !== true) return fallo(salida.error.codigo === 'NO_AUTORIZADO' ? 'NO_AUTORIZADO' : 'SERVICIO');
      if (nombre === 'preparar_borrador_publicacion') {
        if (!exacto(salida.datos, ['vendedorActivado']) || salida.datos.vendedorActivado !== true) {
          return fallo(salida.datos?.vendedorActivado === false ? 'NO_AUTORIZADO' : 'RESPUESTA_INVALIDA');
        }
        return exito({ tipo: 'borrador_publicacion', borrador: entrada.datos, requiereRevisionHumana: true });
      }
      if (nombre === 'consultar_mis_reservas') {
        if (!arregloDensoUnico(salida.datos, r => plano(r) && id(r.id) && typeof r.estado === 'string'
          && ['pendiente', 'confirmada', 'cancelada', 'completada'].includes(r.estado))
          || new Set(salida.datos.map(r => r.id.toLowerCase())).size !== salida.datos.length) return fallo('RESPUESTA_INVALIDA');
        return exito({ destino: 'titular', reservas: salida.datos.map(r => ({ id: r.id, estado: r.estado })) });
      }
      if (!arregloDensoUnico(salida.datos, a => plano(a) && id(a.id) && texto(a.titulo, 100)
        && Number.isSafeInteger(a.precioCentimos) && a.precioCentimos >= 0
        && a.moneda === 'PEN' && ['disponible', 'reservado', 'vendido'].includes(a.estado))
        || new Set(salida.datos.map(a => a.id.toLowerCase())).size !== salida.datos.length) return fallo('RESPUESTA_INVALIDA');
      return exito({ articulos: salida.datos.map(a => ({ id: a.id, titulo: a.titulo,
        precioCentimos: a.precioCentimos, moneda: 'PEN', estado: a.estado })) });
    } catch (error) { return fallo(error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO_AGOTADO' : vigente() ? 'SERVICIO' : 'CANCELADA'); }
  }
  return Object.freeze({ ejecutar, desmontar() { if (!activo) return; activo = false; turno++; operacion?.abort(); },
    invalidarIdentidad() { if (!activo) return; turno++; operacion?.abort(); } });
}
