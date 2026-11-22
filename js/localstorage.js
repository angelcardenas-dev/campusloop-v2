/* Persistencia local de CampusLoop (SPEC_TB4 §6.5).
   Categorías: borrador de publicación, última selección de filtros y preferencias
   de interfaz. Sin DOM, red, SDK, Auth, sesiones ni memoria del agente global.

   Identidad: cada operación recibe el `usuarioId` obtenido del servicio oficial
   `js/auth.js` (`obtenerUsuarioActual()` → `datos.id`, o `obtenerEstadoAuth()` →
   `datos.usuario.id`). Este módulo no decodifica JWT, no genera identificadores y
   no autoriza operaciones: localStorage solo separa datos del mismo navegador y
   origen por cuenta. No es una frontera de seguridad, puede conservarse después
   del cierre de sesión y no se sincroniza entre dispositivos.

   Resultados (operaciones síncronas que no propagan excepciones):
   - Éxito con datos:     { ok: true,  datos: { version, guardadoEn, contenido }, error: null }
   - Éxito sin datos:     { ok: true,  datos: null, error: null }  (clave inexistente / eliminación)
   - Fallo controlado:    { ok: false, datos: null, error: { codigo, mensaje } }
   Los mensajes son fijos: nunca incluyen la clave, el usuario, el valor guardado
   ni el error original del navegador.

   API pública
   - crearAlmacenamientoLocal(opciones?) → objeto congelado con las operaciones:
       opciones.almacenamiento  Objeto compatible con Storage (getItem, setItem,
                                removeItem). Si se omite, se usa globalThis.localStorage
                                en cada operación; `null` equivale a no disponible.
       opciones.ahora           Función que devuelve el instante en milisegundos
                                para `guardadoEn`. Por defecto, Date.now.
     · comprobarDisponibilidad()               → { disponible: true } o fallo.
     · guardarBorrador(usuarioId, borrador)     → { version, guardadoEn, contenido } o fallo.
     · leerBorrador(usuarioId)                  → { version, guardadoEn, contenido }, null o fallo.
     · eliminarBorrador(usuarioId)              → null o fallo.
     · guardarFiltros(usuarioId, filtros)       → { version, guardadoEn, contenido } o fallo.
     · leerFiltros(usuarioId)                   → { version, guardadoEn, contenido }, null o fallo.
     · eliminarFiltros(usuarioId)               → null o fallo.
     · guardarPreferencias(usuarioId, prefs)    → { version, guardadoEn, contenido } o fallo.
     · leerPreferencias(usuarioId)              → { version, guardadoEn, contenido }, null o fallo.
     · eliminarPreferencias(usuarioId)          → null o fallo.
     `usuarioId`: UUID del usuario autenticado. `contenido`: copia normalizada del
     dato. Leer una clave inexistente o eliminarla devuelve éxito con `datos: null`.
     Cada operación usa solo la clave de su categoría y de ese usuario.
   - validarBorrador(entrada), validarFiltros(entrada), validarPreferencias(entrada)
     → { ok: true, datos: copiaNormalizada } o fallo VALIDACION / DATO_NO_PERMITIDO.
     No acceden al almacenamiento.
   - crearClave(categoria, usuarioId) → { ok: true, datos: 'campusloop_tb4_v1_<categoria>_<id>' }
     o fallo CONFIGURACION (categoría desconocida) / IDENTIDAD_INVALIDA.
   - VERSION_FORMATO, LIMITES: constantes de solo lectura.

   Sin usuario autenticado: si `usuarioId` no es un UUID válido (ausente, null,
   vacío, texto u objeto), toda operación devuelve IDENTIDAD_INVALIDA sin acceder
   al almacenamiento ni construir clave alguna; no se usa un identificador común.

   Sin localStorage: si no existe, no expone getItem/setItem/removeItem o acceder a
   él lanza (p. ej. SecurityError por bloqueo del navegador), las operaciones
   devuelven ALMACENAMIENTO_NO_DISPONIBLE. Un fallo durante la operación se informa
   como ALMACENAMIENTO_NO_DISPONIBLE, CUOTA_EXCEDIDA, ERROR_LECTURA, ERROR_ESCRITURA
   o ERROR_ELIMINACION. El formulario conserva sus datos en pantalla en todos los
   casos; el módulo nunca borra otros datos para recuperarse. */

/* Datos */
export const VERSION_FORMATO = 1;
const PREFIJO = 'campusloop_tb4_v1_';
const CATEGORIAS = Object.freeze(['borrador', 'filtros', 'preferencias']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Límites de contenido. Origen: SPEC_TB4 §6.1 y migración de `articulos` (título y
// descripción) y CONTRATO_ARTICULOS_CATALOGO_TB4 §3 (búsqueda). Los demás son
// límites técnicos del módulo.
export const LIMITES = Object.freeze({
  tituloCaracteres: 100,          // Contrato: 1–100; el borrador admite vacío.
  descripcionCaracteres: 1000,    // Contrato: 1–1000; el borrador admite vacía.
  busquedaCaracteres: 120,        // Contrato: máximo 120.
  seleccionesPorGrupo: 200,       // Técnico: mismo tope que valida js/catalogo.js.
  bytesBorrador: 8 * 1024,        // Técnico: JSON UTF-8 serializado, sobre incluido.
  bytesFiltros: 16 * 1024,        // Técnico: admite 200 UUID por grupo.
  bytesPreferencias: 1024,        // Técnico.
});
const BYTES_POR_CATEGORIA = Object.freeze({
  borrador: LIMITES.bytesBorrador, filtros: LIMITES.bytesFiltros, preferencias: LIMITES.bytesPreferencias,
});

const CAMPOS_BORRADOR = Object.freeze(['titulo', 'descripcion', 'categoriaId', 'precioCentimos']);
const CAMPOS_FILTROS = Object.freeze(['busqueda', 'categorias', 'universidad', 'campus', 'estados',
  'condiciones', 'precioMinimoCentimos', 'precioMaximoCentimos', 'orden']);
const ORDENES = Object.freeze(['recientes', 'precio-menor', 'precio-mayor']);
const ESTADOS = Object.freeze(['disponible', 'reservado', 'vendido']);
const CONDICIONES = Object.freeze(['nuevo', 'como_nuevo', 'buen_estado', 'usado']);
// Preferencias admitidas: ninguna; solo se acepta `{}`. Cada campo se declara
// como nombre → función que valida su valor.
const CAMPOS_PREFERENCIAS = Object.freeze({});
const CAMPOS_SOBRE = Object.freeze(['version', 'tipo', 'guardadoEn', 'datos']);

// Defensa en profundidad: estos patrones no garantizan ausencia de datos privados.
const PATRONES_PROHIBIDOS = Object.freeze([
  /\bdata:(?:[a-z]+\/[a-z0-9.+-]+(?:;[a-z0-9.+=-]+)*,|[^\s,]*;base64,)/i, // Data URL con tipo MIME o base64
  /\bblob:(?:https?:\/\/|null\/|file:)/i,                 // URL blob temporal
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/, // JWT
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/i,       // Claves de API de Supabase
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,                   // Clave privada PEM
]);
// Bloque base64 o base64url: 120 o más caracteres del alfabeto que combinan
// mayúsculas, minúsculas y dígitos. Las rachas de un solo tipo (guiones,
// separadores, palabras largas) no se consideran contenido codificado.
const RACHA_BASE64 = /[A-Za-z0-9+/_-]{120,}/g;
// Nombres de campo prohibidos, comparados por segmento completo del nombre
// (camelCase, snake_case o kebab-case), no por subcadena.
const SEGMENTOS_PROHIBIDOS = new Set(['foto', 'fotos', 'fotografia', 'fotografias', 'imagen', 'imagenes',
  'image', 'images', 'archivo', 'archivos', 'file', 'files', 'blob', 'base64', 'contrasena', 'contraseña',
  'password', 'passwd', 'token', 'tokens', 'jwt', 'sesion', 'session', 'apikey', 'secret', 'secreto',
  'credencial', 'credenciales', 'rol', 'roles', 'role', 'permiso', 'permisos', 'privilegio', 'privilegios']);
const CONTROL_TEXTO = /[\u0000-\u001f\u007f-\u009f]/;
const CONTROL_MULTILINEA = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
const SURROGADO_SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const MENSAJES = Object.freeze({
  IDENTIDAD_INVALIDA: 'No hay un usuario autenticado válido; no se accedió al almacenamiento local.',
  VALIDACION: 'Los datos no cumplen el formato permitido y no se guardaron.',
  DATO_NO_PERMITIDO: 'Los datos incluyen contenido que no se guarda localmente, como fotografías, archivos o credenciales.',
  TAMANO_EXCEDIDO: 'Los datos superan el tamaño permitido para el almacenamiento local.',
  JSON_INVALIDO: 'Los datos guardados están dañados y no se pudieron leer. Se conservaron sin cambios.',
  ESTRUCTURA_INVALIDA: 'Los datos guardados no tienen el formato esperado. Se conservaron sin cambios.',
  TIPO_INESPERADO: 'Los datos guardados tienen un tipo inesperado. Se conservaron sin cambios.',
  VERSION_INCOMPATIBLE: 'Los datos guardados pertenecen a una versión incompatible. Se conservaron sin cambios.',
  ALMACENAMIENTO_NO_DISPONIBLE: 'El almacenamiento local no está disponible en este navegador. Puedes continuar sin guardar.',
  ERROR_LECTURA: 'No se pudieron leer los datos locales. Puedes continuar sin ellos.',
  ERROR_ESCRITURA: 'No se pudieron guardar los datos locales. Tus datos en pantalla se mantienen.',
  CUOTA_EXCEDIDA: 'No hay espacio suficiente en el almacenamiento local. Tus datos en pantalla se mantienen.',
  ERROR_ELIMINACION: 'No se pudieron eliminar los datos locales. Inténtalo de nuevo.',
  CONFIGURACION: 'El almacenamiento local no tiene una configuración válida.',
});

/* Funciones: resultados */
const exito = datos => ({ ok: true, datos, error: null });
const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: MENSAJES[codigo] } });

/* Funciones: utilidades de validación (sin ejecutar getters, toJSON ni prototipos ajenos) */
function objetoPlano(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const prototipo = Object.getPrototypeOf(valor);
  if (prototipo !== Object.prototype && prototipo !== null) return false;
  return Reflect.ownKeys(valor).every(clave => {
    if (typeof clave !== 'string') return false;
    const descriptor = Object.getOwnPropertyDescriptor(valor, clave);
    return Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}

function listaPlana(valor) {
  if (!Array.isArray(valor) || Object.getPrototypeOf(valor) !== Array.prototype) return null;
  if (valor.length > LIMITES.seleccionesPorGrupo || Reflect.ownKeys(valor).length !== valor.length + 1) return null;
  const salida = [];
  for (let i = 0; i < valor.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(valor, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    salida.push(descriptor.value);
  }
  return salida;
}

function esBinario(valor) {
  if (!valor || typeof valor !== 'object') return false;
  if (valor instanceof ArrayBuffer || ArrayBuffer.isView(valor)) return true;
  if (typeof Blob === 'function' && valor instanceof Blob) return true;
  const etiqueta = Object.prototype.toString.call(valor);
  return /\[object (?:Blob|File|FileList|ArrayBuffer|SharedArrayBuffer|ImageBitmap|ImageData)\]/.test(etiqueta);
}

function contieneBloqueBase64(texto) {
  return (texto.match(RACHA_BASE64) ?? []).some(racha => /[A-Z]/.test(racha) && /[a-z]/.test(racha) && /[0-9]/.test(racha));
}

function textoProhibido(texto) {
  return PATRONES_PROHIBIDOS.some(patron => patron.test(texto)) || contieneBloqueBase64(texto);
}

// Divide `accessToken`, `refresh_token` o `api-key` en segmentos en minúsculas y
// comprueba cada segmento y cada par contiguo unido (`api` + `key` → `apikey`).
function nombreProhibido(nombre) {
  const segmentos = nombre.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9ñ]+/).filter(Boolean);
  return segmentos.some((segmento, i) => SEGMENTOS_PROHIBIDOS.has(segmento)
    || (i > 0 && SEGMENTOS_PROHIBIDOS.has(segmentos[i - 1] + segmento)));
}

// Detecta fotografías, binarios, URL temporales y credenciales antes del esquema,
// para devolver DATO_NO_PERMITIDO en lugar de un VALIDACION genérico. Los valores
// anidados más profundos no se inspeccionan aquí porque el esquema los rechaza.
function contieneProhibido(valor, profundidad = 0) {
  if (profundidad > 2) return false;
  if (typeof valor === 'string') return textoProhibido(valor);
  if (!valor || typeof valor !== 'object') return false;
  if (esBinario(valor)) return true;
  if (Array.isArray(valor)) return (listaPlana(valor) ?? []).some(item => contieneProhibido(item, profundidad + 1));
  if (!objetoPlano(valor)) return false;
  return Object.keys(valor).some(clave => nombreProhibido(clave) || contieneProhibido(valor[clave], profundidad + 1));
}

function textoValido(valor, maximo, multilinea = false) {
  return typeof valor === 'string' && Array.from(valor).length <= maximo
    && !(multilinea ? CONTROL_MULTILINEA : CONTROL_TEXTO).test(valor)
    && !SURROGADO_SUELTO.test(valor) && !textoProhibido(valor);
}

const esUuid = valor => typeof valor === 'string' && UUID.test(valor);
const enteroNoNegativo = valor => Number.isSafeInteger(valor) && valor >= 0;

function bytesUtf8(texto) {
  return new TextEncoder().encode(texto).byteLength;
}

/* Funciones: esquemas por categoría. Devuelven una copia normalizada o un fallo.
   Los UUID se conservan exactamente como se reciben. */
export function validarBorrador(entrada) {
  try {
    if (contieneProhibido(entrada)) return fallo('DATO_NO_PERMITIDO');
    if (!objetoPlano(entrada) || Object.keys(entrada).some(clave => !CAMPOS_BORRADOR.includes(clave))) return fallo('VALIDACION');
    // Todos los campos son opcionales en la entrada: un borrador está en curso.
    const borrador = {
      titulo: Object.hasOwn(entrada, 'titulo') ? entrada.titulo : '',
      descripcion: Object.hasOwn(entrada, 'descripcion') ? entrada.descripcion : '',
      categoriaId: Object.hasOwn(entrada, 'categoriaId') ? entrada.categoriaId : null,
      precioCentimos: Object.hasOwn(entrada, 'precioCentimos') ? entrada.precioCentimos : null,
    };
    // El borrador conserva el texto sin recortar y no aplica las reglas de publicación.
    if (!textoValido(borrador.titulo, LIMITES.tituloCaracteres)
      || !textoValido(borrador.descripcion, LIMITES.descripcionCaracteres, true)
      || (borrador.categoriaId !== null && !esUuid(borrador.categoriaId))
      || (borrador.precioCentimos !== null && !enteroNoNegativo(borrador.precioCentimos))) return fallo('VALIDACION');
    return exito(borrador);
  } catch {
    return fallo('VALIDACION');
  }
}

export function validarFiltros(entrada) {
  try {
    if (contieneProhibido(entrada)) return fallo('DATO_NO_PERMITIDO');
    // Estructura exacta del contrato de filtros: ni campos ausentes ni extensiones.
    if (!objetoPlano(entrada) || Object.keys(entrada).length !== CAMPOS_FILTROS.length
      || !CAMPOS_FILTROS.every(campo => Object.hasOwn(entrada, campo))) return fallo('VALIDACION');
    if (!textoValido(entrada.busqueda, LIMITES.busquedaCaracteres) || !ORDENES.includes(entrada.orden)) return fallo('VALIDACION');
    const grupos = {};
    for (const [grupo, acepta] of [['categorias', esUuid], ['estados', v => ESTADOS.includes(v)],
      ['condiciones', v => CONDICIONES.includes(v)]]) {
      const lista = listaPlana(entrada[grupo]);
      if (!lista || !lista.every(acepta) || new Set(lista).size !== lista.length) return fallo('VALIDACION');
      grupos[grupo] = lista;
    }
    for (const campo of ['universidad', 'campus']) {
      if (entrada[campo] !== '' && !esUuid(entrada[campo])) return fallo('VALIDACION');
    }
    // Un campus pertenece a una universidad: no se admite campus sin universidad.
    // La correspondencia entre ambos identificadores depende del catálogo remoto.
    if (entrada.campus !== '' && entrada.universidad === '') return fallo('VALIDACION');
    const minimo = entrada.precioMinimoCentimos, maximo = entrada.precioMaximoCentimos;
    if ([minimo, maximo].some(precio => precio !== null && !enteroNoNegativo(precio))
      || (minimo !== null && maximo !== null && minimo > maximo)) return fallo('VALIDACION');
    return exito({ busqueda: entrada.busqueda, categorias: grupos.categorias, universidad: entrada.universidad,
      campus: entrada.campus, estados: grupos.estados, condiciones: grupos.condiciones,
      precioMinimoCentimos: minimo, precioMaximoCentimos: maximo, orden: entrada.orden });
  } catch {
    return fallo('VALIDACION');
  }
}

export function validarPreferencias(entrada) {
  try {
    if (contieneProhibido(entrada)) return fallo('DATO_NO_PERMITIDO');
    if (!objetoPlano(entrada) || Object.keys(entrada).some(clave => !Object.hasOwn(CAMPOS_PREFERENCIAS, clave))) return fallo('VALIDACION');
    const preferencias = {};
    for (const [campo, acepta] of Object.entries(CAMPOS_PREFERENCIAS)) {
      if (!Object.hasOwn(entrada, campo)) continue;
      if (!acepta(entrada[campo])) return fallo('VALIDACION');
      preferencias[campo] = entrada[campo];
    }
    return exito(preferencias);
  } catch {
    return fallo('VALIDACION');
  }
}

const VALIDADORES = Object.freeze({ borrador: validarBorrador, filtros: validarFiltros, preferencias: validarPreferencias });

/* Funciones: claves por usuario validado, solo para las categorías de `CATEGORIAS`.
   El identificador del usuario se normaliza a minúsculas dentro de la clave. */
export function crearClave(categoria, usuarioId) {
  if (!CATEGORIAS.includes(categoria)) return fallo('CONFIGURACION');
  if (!esUuid(usuarioId)) return fallo('IDENTIDAD_INVALIDA');
  return exito(`${PREFIJO}${categoria}_${usuarioId.toLowerCase()}`);
}

/* Funciones: errores de Storage normalizados, sin propagar el error original.
   Un error con propiedades inaccesibles se clasifica como fallo genérico. */
function esCuota(error) {
  try {
    return error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || error?.code === 22 || error?.code === 1014;
  } catch {
    return false;
  }
}
function esBloqueo(error) {
  try {
    return error?.name === 'SecurityError' || error?.code === 18;
  } catch {
    return false;
  }
}

// Interpreta el valor crudo leído. No elimina ni reescribe nada si es inválido.
function interpretarGuardado(categoria, crudo) {
  if (crudo === null) return exito(null);
  if (typeof crudo !== 'string') return fallo('TIPO_INESPERADO');
  const limite = BYTES_POR_CATEGORIA[categoria];
  if (crudo.length > limite || bytesUtf8(crudo) > limite) return fallo('TAMANO_EXCEDIDO');
  let sobre;
  try { sobre = JSON.parse(crudo); } catch { return fallo('JSON_INVALIDO'); }
  if (!sobre || typeof sobre !== 'object' || Array.isArray(sobre)) return fallo('TIPO_INESPERADO');
  if (!Number.isSafeInteger(sobre.version) || sobre.version < 1) return fallo('ESTRUCTURA_INVALIDA');
  // Una versión distinta se conserva sin migrar.
  if (sobre.version !== VERSION_FORMATO) return fallo('VERSION_INCOMPATIBLE');
  if (!objetoPlano(sobre) || Object.keys(sobre).length !== CAMPOS_SOBRE.length
    || !CAMPOS_SOBRE.every(campo => Object.hasOwn(sobre, campo)) || sobre.tipo !== categoria
    || typeof sobre.guardadoEn !== 'string' || !FECHA_ISO.test(sobre.guardadoEn)
    || Number.isNaN(Date.parse(sobre.guardadoEn))
    || new Date(Date.parse(sobre.guardadoEn)).toISOString() !== sobre.guardadoEn) return fallo('ESTRUCTURA_INVALIDA');
  const contenido = VALIDADORES[categoria](sobre.datos);
  // Lo persistido es la forma normalizada completa: todos sus campos son obligatorios.
  if (!contenido.ok || Object.keys(sobre.datos).length !== Object.keys(contenido.datos).length) return fallo('ESTRUCTURA_INVALIDA');
  return exito({ version: sobre.version, guardadoEn: sobre.guardadoEn, contenido: contenido.datos });
}

// Ejecuta una operación pública y convierte cualquier excepción inesperada en un
// resultado de error con el código genérico indicado.
function protegida(operacion, codigoRespaldo) {
  return (...argumentos) => {
    try {
      return operacion(...argumentos);
    } catch {
      return fallo(codigoRespaldo);
    }
  };
}

/* Fábrica pública; opciones y operaciones descritas en la cabecera.
   Si las opciones no se pueden leer, todas las operaciones devuelven CONFIGURACION. */
export function crearAlmacenamientoLocal(opciones = {}) {
  let configuracionValida = true;
  let inyectado = false;
  let almacenamientoInyectado;
  let ahora = Date.now;
  try {
    const config = opciones !== null && typeof opciones === 'object' ? opciones : {};
    inyectado = Object.hasOwn(config, 'almacenamiento') && config.almacenamiento !== undefined;
    almacenamientoInyectado = inyectado ? config.almacenamiento : undefined;
    if (Object.hasOwn(config, 'ahora') && config.ahora !== undefined) ahora = config.ahora;
  } catch {
    configuracionValida = false;
  }

  function resolverAlmacenamiento() {
    try {
      // En navegadores con almacenamiento bloqueado, leer `localStorage` lanza SecurityError.
      const almacen = inyectado ? almacenamientoInyectado : globalThis.localStorage;
      if (almacen && ['getItem', 'setItem', 'removeItem'].every(metodo => typeof almacen[metodo] === 'function')) return almacen;
    } catch { /* Bloqueado: se informa como no disponible. */ }
    return null;
  }

  function preparar(categoria, usuarioId) {
    if (!configuracionValida) return { error: fallo('CONFIGURACION') };
    const clave = crearClave(categoria, usuarioId);
    if (!clave.ok) return { error: clave };
    const almacen = resolverAlmacenamiento();
    if (!almacen) return { error: fallo('ALMACENAMIENTO_NO_DISPONIBLE') };
    return { clave: clave.datos, almacen };
  }

  function leerCrudo(almacen, clave) {
    try {
      return { crudo: almacen.getItem(clave) };
    } catch (error) {
      return { error: fallo(esBloqueo(error) ? 'ALMACENAMIENTO_NO_DISPONIBLE' : 'ERROR_LECTURA') };
    }
  }

  function leer(categoria, usuarioId) {
    const destino = preparar(categoria, usuarioId);
    if (destino.error) return destino.error;
    const lectura = leerCrudo(destino.almacen, destino.clave);
    if (lectura.error) return lectura.error;
    return interpretarGuardado(categoria, lectura.crudo);
  }

  function guardar(categoria, usuarioId, entrada) {
    const destino = preparar(categoria, usuarioId);
    if (destino.error) return destino.error;
    // Validar antes de tocar el almacenamiento.
    const contenido = VALIDADORES[categoria](entrada);
    if (!contenido.ok) return contenido;
    let guardadoEn;
    try {
      if (typeof ahora !== 'function') return fallo('CONFIGURACION');
      const instante = ahora();
      if (!Number.isFinite(instante)) return fallo('CONFIGURACION');
      guardadoEn = new Date(instante).toISOString();
    } catch {
      return fallo('CONFIGURACION');
    }
    const json = JSON.stringify({ version: VERSION_FORMATO, tipo: categoria, guardadoEn, datos: contenido.datos });
    if (bytesUtf8(json) > BYTES_POR_CATEGORIA[categoria]) return fallo('TAMANO_EXCEDIDO');
    // Un dato guardado con otra versión no se sobrescribe.
    const previo = leerCrudo(destino.almacen, destino.clave);
    if (previo.error) return previo.error;
    if (interpretarGuardado(categoria, previo.crudo).error?.codigo === 'VERSION_INCOMPATIBLE') return fallo('VERSION_INCOMPATIBLE');
    try {
      destino.almacen.setItem(destino.clave, json);
    } catch (error) {
      return fallo(esCuota(error) ? 'CUOTA_EXCEDIDA' : esBloqueo(error) ? 'ALMACENAMIENTO_NO_DISPONIBLE' : 'ERROR_ESCRITURA');
    }
    return exito({ version: VERSION_FORMATO, guardadoEn, contenido: contenido.datos });
  }

  function eliminar(categoria, usuarioId) {
    const destino = preparar(categoria, usuarioId);
    if (destino.error) return destino.error;
    try {
      destino.almacen.removeItem(destino.clave);
    } catch (error) {
      return fallo(esBloqueo(error) ? 'ALMACENAMIENTO_NO_DISPONIBLE' : 'ERROR_ELIMINACION');
    }
    return exito(null);
  }

  return Object.freeze({
    // Detecta almacenamiento ausente o bloqueado al acceder. No escribe claves de
    // prueba: la cuota o un bloqueo solo de escritura se informan al guardar.
    comprobarDisponibilidad: protegida(() => {
      if (!configuracionValida) return fallo('CONFIGURACION');
      return resolverAlmacenamiento() ? exito({ disponible: true }) : fallo('ALMACENAMIENTO_NO_DISPONIBLE');
    }, 'ALMACENAMIENTO_NO_DISPONIBLE'),
    guardarBorrador: protegida((usuarioId, borrador) => guardar('borrador', usuarioId, borrador), 'ERROR_ESCRITURA'),
    leerBorrador: protegida(usuarioId => leer('borrador', usuarioId), 'ERROR_LECTURA'),
    // Las eliminaciones son explícitas y este módulo no las invoca de forma
    // automática. Cada una borra solo la clave de su categoría y usuario.
    eliminarBorrador: protegida(usuarioId => eliminar('borrador', usuarioId), 'ERROR_ELIMINACION'),
    guardarFiltros: protegida((usuarioId, filtros) => guardar('filtros', usuarioId, filtros), 'ERROR_ESCRITURA'),
    leerFiltros: protegida(usuarioId => leer('filtros', usuarioId), 'ERROR_LECTURA'),
    eliminarFiltros: protegida(usuarioId => eliminar('filtros', usuarioId), 'ERROR_ELIMINACION'),
    guardarPreferencias: protegida((usuarioId, preferencias) => guardar('preferencias', usuarioId, preferencias), 'ERROR_ESCRITURA'),
    leerPreferencias: protegida(usuarioId => leer('preferencias', usuarioId), 'ERROR_LECTURA'),
    eliminarPreferencias: protegida(usuarioId => eliminar('preferencias', usuarioId), 'ERROR_ELIMINACION'),
  });
}
