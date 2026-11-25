/*
 * Selección, validación y previsualización local de fotografías.
 * La subida queda detrás de una dependencia inyectada hasta confirmar Storage.
 * El adaptador deberá usar el cliente único de js/supabase-cliente.js.
 * No crea clientes Supabase, buckets, rutas ni permisos.
 */
(function (global) {
  'use strict';

  const MAX_BYTES = 2 * 1024 * 1024;
  const MIN_DIMENSION = 100;
  const MAX_DIMENSION = 12000;
  const SUBIDA_TIMEOUT_MS = 15000;
  const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const EXTENSIONES = Object.freeze({ 'image/jpeg': /\.(?:jpe?g)$/i, 'image/png': /\.png$/i, 'image/webp': /\.webp$/i });
  const MENSAJES = Object.freeze({
    TIPO: 'Selecciona una fotografía JPEG, PNG o WebP.',
    TAMANO: 'La fotografía debe pesar como máximo 2 MiB (límite objetivo, pendiente de confirmar en Storage).',
    DIMENSIONES: 'No se pudieron validar las dimensiones de la fotografía.',
    VISTA: 'No se pudo previsualizar la fotografía seleccionada.',
    SUBIDA_PENDIENTE: 'Integración pendiente: Bernabé debe confirmar Storage y la autorización de subida.',
    SUBIDA: 'No se pudo preparar la fotografía. El formulario conserva sus datos.',
    SUBIDA_TIMEOUT: 'La subida tardó demasiado. Comprueba su estado antes de reintentar.',
  });

  async function validarArchivo(archivo, { crearBitmap = global.createImageBitmap, maxBytes = MAX_BYTES } = {}) {
    if (!archivo || typeof archivo !== 'object' || !TIPOS.has(archivo.type)) return { ok: false, codigo: 'TIPO' };
    const limiteBytes = Number.isSafeInteger(maxBytes) && maxBytes > 0 ? Math.min(maxBytes, MAX_BYTES) : MAX_BYTES;
    if (!Number.isSafeInteger(archivo.size) || archivo.size <= 0 || archivo.size > limiteBytes) return { ok: false, codigo: 'TAMANO' };
    if (typeof crearBitmap !== 'function') return { ok: false, codigo: 'DIMENSIONES' };
    let bitmap;
    try {
      bitmap = await crearBitmap(archivo);
      if (!Number.isSafeInteger(bitmap.width) || bitmap.width < MIN_DIMENSION || bitmap.width > MAX_DIMENSION
        || !Number.isSafeInteger(bitmap.height) || bitmap.height < MIN_DIMENSION || bitmap.height > MAX_DIMENSION) return { ok: false, codigo: 'DIMENSIONES' };
      return { ok: true, datos: Object.freeze({ archivo, formato: archivo.type, bytes: archivo.size, ancho: bitmap.width, alto: bitmap.height }), error: null };
    } catch { return { ok: false, codigo: 'DIMENSIONES' }; }
    finally { bitmap?.close?.(); }
  }

  function contextoStorageValido(contexto) {
    if (!contexto || typeof contexto !== 'object' || Array.isArray(contexto)
      || Object.keys(contexto).length !== 4
      || !['proveedor', 'bucket', 'propietarioId', 'origenStorage'].every(k => Object.hasOwn(contexto, k))) return false;
    if (contexto.proveedor !== 'supabase' || typeof contexto.bucket !== 'string'
      || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(contexto.bucket)
      || typeof contexto.propietarioId !== 'string' || !UUID.test(contexto.propietarioId)
      || typeof contexto.origenStorage !== 'string') return false;
    try {
      const origen = new URL(contexto.origenStorage);
      return origen.protocol === 'https:' && origen.origin === contexto.origenStorage
        && !origen.username && !origen.password;
    } catch { return false; }
  }

  function validarReferencia(referencia, contexto, seleccion) {
    const claves = ['proveedor', 'bucket', 'ruta', 'formato', 'bytes', 'ancho', 'alto'];
    if (!contextoStorageValido(contexto) || !referencia || typeof referencia !== 'object' || Array.isArray(referencia)
      || Object.keys(referencia).length !== claves.length || !claves.every(k => Object.hasOwn(referencia, k))) return false;
    if (referencia.proveedor !== contexto.proveedor || referencia.bucket !== contexto.bucket
      || typeof referencia.ruta !== 'string' || referencia.ruta.length > 500
      || !Object.hasOwn(EXTENSIONES, referencia.formato) || !EXTENSIONES[referencia.formato].test(referencia.ruta)
      || !Number.isSafeInteger(referencia.bytes) || referencia.bytes <= 0 || referencia.bytes > MAX_BYTES
      || !Number.isSafeInteger(referencia.ancho) || referencia.ancho < MIN_DIMENSION || referencia.ancho > MAX_DIMENSION
      || !Number.isSafeInteger(referencia.alto) || referencia.alto < MIN_DIMENSION || referencia.alto > MAX_DIMENSION) return false;
    const [propietario, nombre, extra] = referencia.ruta.split('/');
    if (extra !== undefined || propietario !== contexto.propietarioId.toLowerCase()
      || !UUID.test(propietario) || !/^[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(nombre || '')) return false;
    if (seleccion && (referencia.formato !== seleccion.formato || referencia.bytes !== seleccion.bytes
      || referencia.ancho !== seleccion.ancho || referencia.alto !== seleccion.alto)) return false;
    return true;
  }

  function validarPresentacionTemporal(presentacion, contexto, referencia) {
    if (presentacion === undefined) return true;
    if (!presentacion || typeof presentacion !== 'object' || Array.isArray(presentacion)
      || Object.keys(presentacion).length !== 2 || !Object.hasOwn(presentacion, 'url')
      || !Object.hasOwn(presentacion, 'expiraEn') || typeof presentacion.url !== 'string'
      || typeof presentacion.expiraEn !== 'string' || !Number.isFinite(Date.parse(presentacion.expiraEn))
      || Date.parse(presentacion.expiraEn) <= Date.now()) return false;
    try {
      const url = new URL(presentacion.url);
      const esperado = `${contexto.origenStorage}/storage/v1/object/sign/${contexto.bucket}/${referencia.ruta}`;
      return url.protocol === 'https:' && url.origin === contexto.origenStorage && !url.username && !url.password
        && url.pathname === new URL(esperado).pathname && url.searchParams.has('token')
        && [...url.searchParams.keys()].every(k => k === 'token') && !url.hash;
    } catch { return false; }
  }

  function abortError(mensaje = 'La operación fue cancelada.') {
    const error = new Error(mensaje);
    error.name = 'AbortError';
    return error;
  }

  function esperarConLimite(valor, { signal, timeoutMs }) {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      let terminado = false;
      const limpiar = () => {
        global.clearTimeout?.(temporizador);
        signal?.removeEventListener?.('abort', alAbortar);
      };
      const finalizar = (fn, resultado) => {
        if (terminado) return;
        terminado = true;
        limpiar();
        fn(resultado);
      };
      const alAbortar = () => finalizar(reject, abortError());
      const temporizador = global.setTimeout(() => {
        const error = new Error('La operación superó el tiempo provisional de espera.');
        error.name = 'TimeoutError';
        finalizar(reject, error);
      }, timeoutMs);
      signal?.addEventListener?.('abort', alAbortar, { once: true });
      Promise.resolve(valor).then(
        resultado => finalizar(resolve, resultado),
        error => finalizar(reject, error),
      );
    });
  }

  function crearControladorImagenes({ documento = global.document, subirFotografia, crearBitmap,
    maxBytes = MAX_BYTES, timeoutMs = SUBIDA_TIMEOUT_MS } = {}) {
    const entrada = documento?.getElementById('input-fotografia');
    const vista = documento?.getElementById('vista-fotografia');
    const retirar = documento?.getElementById('retirar-fotografia');
    const mensaje = documento?.getElementById('mensaje-fotografia');
    if (!entrada || !vista || !retirar || !mensaje) return {
      desmontar() {}, obtenerArchivo: () => null, capturarSeleccion: () => null,
      esSeleccionActual: () => false, preparar: async () => ({ ok: false, codigo: 'PENDIENTE' }),
    };
    let archivoActual = null;
    let validacionActual = null;
    let urlActual = null;
    let fotografiaConfirmada = null;
    let generacionSeleccion = 0;
    let secuenciaPreparacion = 0;
    let preparacionActiva = null;
    let seleccionPendiente = false;
    let desmontado = false;
    const capturas = new WeakMap();

    function abortarPreparacion() {
      preparacionActiva?.controlador.abort();
    }

    function esActual(preparacion) {
      return !desmontado && preparacionActiva === preparacion
        && generacionSeleccion === preparacion.seleccion.generacion
        && archivoActual === preparacion.seleccion.archivo
        && validacionActual === preparacion.seleccion.datos
        && urlActual === preparacion.seleccion.url
        && !preparacion.controlador.signal.aborted;
    }

    function capturarSeleccion() {
      if (desmontado || seleccionPendiente || !archivoActual || !validacionActual || !urlActual) return null;
      const captura = Object.freeze({ archivo: archivoActual, datos: validacionActual, url: urlActual, generacion: generacionSeleccion });
      const token = Object.freeze({ generacion: generacionSeleccion, archivo: captura.archivo, datos: captura.datos, url: captura.url });
      capturas.set(token, captura);
      return token;
    }

    function esSeleccionActual(token) {
      const seleccion = token && capturas.get(token);
      return !!seleccion && !desmontado && !seleccionPendiente && seleccion.generacion === generacionSeleccion
        && seleccion.archivo === archivoActual && seleccion.datos === validacionActual && seleccion.url === urlActual;
    }

    function limpiarUrl(url) {
      if (url) global.URL.revokeObjectURL(url);
    }

    const onSeleccion = async () => {
      const operacion = ++generacionSeleccion;
      seleccionPendiente = true;
      abortarPreparacion();
      const anterior = { archivo: archivoActual, validacion: validacionActual };
      const nuevo = entrada.files?.[0] ?? null;
      if (!nuevo) { if (operacion === generacionSeleccion) seleccionPendiente = false; return; }
      const revisar = await validarArchivo(nuevo, { crearBitmap: crearBitmap ?? global.createImageBitmap, maxBytes });
      if (desmontado || operacion !== generacionSeleccion) return;
      seleccionPendiente = false;
      if (!revisar.ok) {
        entrada.value = '';
        archivoActual = anterior.archivo;
        validacionActual = anterior.validacion;
        mensaje.textContent = MENSAJES[revisar.codigo] || MENSAJES.DIMENSIONES;
        if (urlActual) vista.src = urlActual;
        return;
      }
      let urlNueva;
      try { urlNueva = global.URL.createObjectURL(nuevo); }
      catch {
        entrada.value = '';
        archivoActual = anterior.archivo;
        validacionActual = anterior.validacion;
        mensaje.textContent = MENSAJES.VISTA;
        return;
      }
      if (urlActual && urlActual !== fotografiaConfirmada?.url) limpiarUrl(urlActual);
      urlActual = urlNueva;
      archivoActual = nuevo;
      validacionActual = revisar.datos;
      vista.src = urlNueva;
      vista.hidden = false;
      retirar.disabled = false;
      mensaje.textContent = 'Fotografía lista para previsualizar. La subida se confirma al publicar.';
    };

    const onRetirar = () => {
      generacionSeleccion++;
      seleccionPendiente = false;
      abortarPreparacion();
      if (urlActual) limpiarUrl(urlActual);
      if (fotografiaConfirmada?.url && fotografiaConfirmada.url !== urlActual) limpiarUrl(fotografiaConfirmada.url);
      urlActual = null;
      fotografiaConfirmada = null;
      archivoActual = null;
      validacionActual = null;
      entrada.value = '';
      vista.removeAttribute('src');
      vista.hidden = true;
      retirar.disabled = true;
      mensaje.textContent = 'Fotografía retirada.';
    };

    entrada.addEventListener('change', onSeleccion);
    retirar.addEventListener('click', onRetirar);
    return {
      obtenerArchivo: () => validacionActual,
      capturarSeleccion,
      obtenerDatosSeleccion(token) {
        const captura = token && capturas.get(token);
        if (!captura || !esSeleccionActual(token)) return null;
        const { formato, bytes, ancho, alto } = captura.datos;
        return Object.freeze({ archivo: captura.archivo, formato, bytes, ancho, alto });
      },
      esSeleccionActual,
      async preparar({ signal, seleccion = capturarSeleccion(), contextoStorage } = {}) {
        if (signal?.aborted) return { ok: false, codigo: 'CANCELADO' };
        const captura = seleccion && capturas.get(seleccion);
        if (desmontado || !captura || !esSeleccionActual(seleccion)) return { ok: false, codigo: 'VALIDACION' };
        if (!contextoStorageValido(contextoStorage)) return { ok: false, codigo: 'PENDIENTE', mensaje: MENSAJES.SUBIDA_PENDIENTE };
        if (typeof subirFotografia !== 'function') return { ok: false, codigo: 'PENDIENTE', mensaje: MENSAJES.SUBIDA_PENDIENTE };

        abortarPreparacion();
        const controlador = new AbortController();
        const alAbortar = () => controlador.abort();
        signal?.addEventListener?.('abort', alAbortar, { once: true });
        const preparacion = { id: ++secuenciaPreparacion, seleccion: captura, controlador };
        preparacionActiva = preparacion;
        try {
          const llamada = subirFotografia(captura.datos, { signal: controlador.signal, seleccion,
            contextoStorage: Object.freeze({ ...contextoStorage }) });
          const resultado = await esperarConLimite(llamada, { signal: controlador.signal, timeoutMs });
          if (!esActual(preparacion)) return { ok: false, codigo: 'CANCELADO' };
          if (resultado?.ok === true && resultado.error === null && Object.keys(resultado).length === 3
            && Object.hasOwn(resultado, 'datos') && resultado.datos && typeof resultado.datos === 'object'
            && !Array.isArray(resultado.datos)
            && Object.keys(resultado.datos).every(k => k === 'referencia' || k === 'presentacion')
            && Object.hasOwn(resultado.datos, 'referencia')
            && validarReferencia(resultado.datos.referencia, contextoStorage, captura.datos)
            && validarPresentacionTemporal(resultado.datos.presentacion, contextoStorage, resultado.datos.referencia)) {
            if (fotografiaConfirmada?.url && fotografiaConfirmada.url !== captura.url) limpiarUrl(fotografiaConfirmada.url);
            fotografiaConfirmada = captura;
            // El DTO que seguirá hacia la publicación contiene solo identidad persistente.
            return { ok: true, datos: Object.freeze({ ...resultado.datos.referencia }), error: null,
              presentacionTemporal: resultado.datos.presentacion ? Object.freeze({ ...resultado.datos.presentacion }) : null };
          }
          restaurarFotografiaConfirmada();
          return { ok: false, codigo: 'SUBIDA', mensaje: MENSAJES.SUBIDA };
        } catch (error) {
          if (!esActual(preparacion)) return { ok: false, codigo: error?.name === 'TimeoutError' ? 'TIEMPO_AGOTADO' : 'CANCELADO' };
          if (error?.name === 'AbortError') return { ok: false, codigo: 'CANCELADO' };
          if (error?.name === 'TimeoutError') controlador.abort();
          restaurarFotografiaConfirmada();
          return error?.name === 'TimeoutError'
            ? { ok: false, codigo: 'TIEMPO_AGOTADO', mensaje: MENSAJES.SUBIDA_TIMEOUT }
            : { ok: false, codigo: 'SUBIDA', mensaje: MENSAJES.SUBIDA };
        } finally {
          signal?.removeEventListener?.('abort', alAbortar);
          if (preparacionActiva === preparacion) preparacionActiva = null;
        }
      },
      desmontar() {
        if (desmontado) return;
        desmontado = true;
        generacionSeleccion++;
        seleccionPendiente = false;
        abortarPreparacion();
        entrada.removeEventListener('change', onSeleccion);
        retirar.removeEventListener('click', onRetirar);
        const urls = new Set([urlActual, fotografiaConfirmada?.url].filter(Boolean));
        for (const url of urls) limpiarUrl(url);
        urlActual = null;
        fotografiaConfirmada = null;
        archivoActual = null;
        validacionActual = null;
      },
    };

    function restaurarFotografiaConfirmada() {
      if (!fotografiaConfirmada || fotografiaConfirmada.url === urlActual) return;
      if (urlActual) limpiarUrl(urlActual);
      archivoActual = fotografiaConfirmada.archivo;
      validacionActual = fotografiaConfirmada.datos;
      urlActual = fotografiaConfirmada.url;
      generacionSeleccion++;
      seleccionPendiente = false;
      vista.src = urlActual;
      vista.hidden = false;
      entrada.value = '';
      retirar.disabled = false;
      mensaje.textContent = 'No se pudo sustituir la fotografía. Se conserva la anterior.';
    }
  }

  global.CampusLoopImagenes = Object.freeze({ MAX_BYTES, MIN_DIMENSION, MAX_DIMENSION, SUBIDA_TIMEOUT_MS, MENSAJES,
    validarArchivo, contextoStorageValido, validarReferencia, validarPresentacionTemporal, crearControladorImagenes });
})(typeof window === 'undefined' ? globalThis : window);
