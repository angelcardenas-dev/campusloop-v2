/*
 * Controlador de Publicar. No implementa consultas REST ni crea un cliente.
 * El contrato del servicio CRUD sigue pendiente de acuerdo con Bernabé.
 * Estas son dependencias de prueba/preparación, no importaciones aprobadas:
 * - prepararPublicacion(datosFormulario) valida catálogos, precio, campus,
 *   fotografía y devuelve el DTO de escritura completo o un error seguro.
 * - servicios.crearPublicacion(dto, { signal }) devuelve { ok, datos, error }.
 * - consultar propias, actualizar y eliminar lógicamente también requieren
 *   acuerdo de parámetros/DTO, respuesta, sesión, permisos, errores,
 *   concurrencia e idempotencia antes de conectarse.
 */
(function (global) {
    "use strict";

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ESTADOS = new Set(["disponible", "reservado", "vendido"]);
    const TIMEOUT_MS = 15000;
    const CONDICIONES = new Set(["nuevo", "como_nuevo", "buen_estado", "usado"]);
    const EXTENSIONES_IMAGEN = Object.freeze({ "image/jpeg": /\.(?:jpe?g)$/i, "image/png": /\.png$/i, "image/webp": /\.webp$/i });
    const MAX_BYTES_IMAGEN = 2 * 1024 * 1024;
    const MIN_DIMENSION_IMAGEN = 100;
    const MAX_DIMENSION_IMAGEN = 12000;
    const MENSAJES = Object.freeze({
        VALIDACION: "Revisa los datos ingresados.",
        NO_AUTORIZADO: "No tienes permiso para realizar esta operación.",
        CONFLICTO: "La publicación cambió. Actualiza la información e inténtalo de nuevo.",
        RED: "No se pudo conectar con el servicio. Tus datos siguen en el formulario.",
        LIMITE: "Se alcanzó el límite de solicitudes. Inténtalo más tarde.",
        RESPUESTA_INVALIDA: "El servicio devolvió una respuesta que no pudimos validar.",
        SERVIDOR: "No se pudo completar la operación. Tus datos siguen en el formulario.",
    });
    const fallo = codigo => ({ ok: false, datos: null, error: {
        codigo, mensaje: MENSAJES[codigo] || MENSAJES.SERVIDOR,
    } });
    const resultadoSeguro = error => fallo(error && Object.hasOwn(MENSAJES, error.codigo) ? error.codigo : "SERVIDOR");

    function esperarConLimite(invocar, signal, timeoutMs) {
        if (signal?.aborted) return Promise.reject(Object.assign(new Error("Operación cancelada."), { name: "AbortError" }));
        return new Promise((resolve, reject) => {
            let terminado = false;
            const limpiar = () => { global.clearTimeout(temporizador); signal?.removeEventListener("abort", abortar); };
            const finalizar = (fn, resultado) => { if (terminado) return; terminado = true; limpiar(); fn(resultado); };
            const abortar = () => finalizar(reject, Object.assign(new Error("Operación cancelada."), { name: "AbortError" }));
            const temporizador = global.setTimeout(() => finalizar(reject, Object.assign(
                new Error("Tiempo de espera agotado."), { name: "TimeoutError" })), timeoutMs);
            signal?.addEventListener("abort", abortar, { once: true });
            Promise.resolve().then(() => {
                if (signal?.aborted) throw Object.assign(new Error("Operación cancelada."), { name: "AbortError" });
                return invocar();
            }).then(r => finalizar(resolve, r), e => finalizar(reject, e));
        });
    }

    const camposPublicacionCoinciden = (publicada, enviada) => ["titulo", "descripcion", "categoriaId", "condicion", "precioCentimos", "moneda", "campusId"]
        .every(campo => publicada[campo] === enviada[campo])
        && imagenesCoinciden(publicada.imagen, enviada.imagen);

    function imagenesCoinciden(a, b) {
        return !!a && !!b && ["proveedor", "bucket", "ruta", "formato", "bytes", "ancho", "alto"]
            .every(campo => a[campo] === b[campo]);
    }

    const controles = new WeakMap();

    function validarContextoStorage(contexto) {
        if (!contexto || typeof contexto !== "object" || Array.isArray(contexto) || Object.keys(contexto).length !== 4
            || !["proveedor", "bucket", "propietarioId", "origenStorage"].every(k => Object.hasOwn(contexto, k))
            || contexto.proveedor !== "supabase" || typeof contexto.bucket !== "string"
            || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(contexto.bucket)
            || typeof contexto.propietarioId !== "string" || !UUID.test(contexto.propietarioId)
            || typeof contexto.origenStorage !== "string") return false;
        try {
            const origen = new URL(contexto.origenStorage);
            return origen.protocol === "https:" && origen.origin === contexto.origenStorage
                && !origen.username && !origen.password;
        } catch { return false; }
    }

    function validarImagen(imagen, contextoStorage, propietario = contextoStorage?.propietarioId) {
        const claves = ["proveedor", "bucket", "ruta", "formato", "bytes", "ancho", "alto"];
        if (!validarContextoStorage(contextoStorage) || !imagen || typeof imagen !== "object" || Array.isArray(imagen)
            || Object.keys(imagen).length !== claves.length || !claves.every(k => Object.hasOwn(imagen, k))
            || imagen.proveedor !== contextoStorage.proveedor || imagen.bucket !== contextoStorage.bucket
            || typeof imagen.ruta !== "string" || imagen.ruta.length > 500
            || !Object.hasOwn(EXTENSIONES_IMAGEN, imagen.formato) || !EXTENSIONES_IMAGEN[imagen.formato].test(imagen.ruta)
            || !Number.isSafeInteger(imagen.bytes) || imagen.bytes <= 0 || imagen.bytes > MAX_BYTES_IMAGEN
            || !Number.isSafeInteger(imagen.ancho) || imagen.ancho < MIN_DIMENSION_IMAGEN || imagen.ancho > MAX_DIMENSION_IMAGEN
            || !Number.isSafeInteger(imagen.alto) || imagen.alto < MIN_DIMENSION_IMAGEN || imagen.alto > MAX_DIMENSION_IMAGEN) return false;
        const [dueno, nombre, extra] = imagen.ruta.split("/");
        return extra === undefined && UUID.test(dueno || "") && dueno === propietario.toLowerCase()
            && dueno === contextoStorage.propietarioId.toLowerCase()
            && /^[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(nombre || "");
    }

    // DTO mínimo de escritura. No acepta identidad/estado suministrados por UI;
    // el servicio autorizado deriva el vendedor y asigna el estado inicial.
    function validarDtoPublicacion(dto, contextoStorage) {
        const claves = ["titulo", "descripcion", "categoriaId", "condicion", "precioCentimos", "moneda", "campusId", "imagen"];
        if (!dto || typeof dto !== "object" || Array.isArray(dto)
            || Object.keys(dto).length !== claves.length || !claves.every(clave => Object.hasOwn(dto, clave))) return false;
        return typeof dto.titulo === "string" && dto.titulo.trim().length > 0 && dto.titulo.length <= 100
            && typeof dto.descripcion === "string" && dto.descripcion.trim().length > 0 && dto.descripcion.length <= 1000
            && typeof dto.categoriaId === "string" && UUID.test(dto.categoriaId)
            && typeof dto.campusId === "string" && UUID.test(dto.campusId)
            && typeof dto.condicion === "string" && CONDICIONES.has(dto.condicion)
            && Number.isSafeInteger(dto.precioCentimos) && dto.precioCentimos > 0
            && dto.moneda === "PEN" && validarImagen(dto.imagen, contextoStorage);
    }

    function validarArticulo(dto, contextoStorage) {
        if (!validarContextoStorage(contextoStorage) || !dto || typeof dto !== "object" || Array.isArray(dto)) return false;
        return typeof dto.id === "string" && UUID.test(dto.id)
            && typeof dto.vendedorId === "string" && UUID.test(dto.vendedorId)
            && typeof dto.categoriaId === "string" && UUID.test(dto.categoriaId)
            && typeof dto.campusId === "string" && UUID.test(dto.campusId)
            && typeof dto.titulo === "string" && dto.titulo.trim().length > 0 && dto.titulo.length <= 100
            && typeof dto.descripcion === "string" && dto.descripcion.trim().length > 0 && dto.descripcion.length <= 1000
            && Number.isSafeInteger(dto.precioCentimos) && dto.precioCentimos > 0 && dto.moneda === "PEN"
            && CONDICIONES.has(dto.condicion) && ESTADOS.has(dto.estado)
            && dto.vendedorId.toLowerCase() === contextoStorage?.propietarioId?.toLowerCase()
            && validarImagen(dto.imagen, contextoStorage, dto.vendedorId)
            && typeof dto.creadoEn === "string" && Number.isFinite(Date.parse(dto.creadoEn))
            && typeof dto.actualizadoEn === "string" && Number.isFinite(Date.parse(dto.actualizadoEn))
            && Number.isSafeInteger(dto.version) && dto.version > 0;
    }

    // Presentación aislada de las publicaciones propias. No consulta ni altera
    // servicios: los estados `listo` y `vacio` solo deben recibir datos de una
    // futura dependencia autorizada (en pruebas se pueden inyectar fixtures).
    function presentarMisPublicaciones({ documento = global.document, estado = "pendiente", publicaciones = [], mensaje } = {}) {
        const region = documento?.getElementById("estado-mis-publicaciones");
        const lista = documento?.getElementById("lista-mis-publicaciones");
        if (!region || !lista) return false;
        const textos = {
            pendiente: "Integración pendiente: las publicaciones propias se mostrarán cuando esté conectado el servicio autorizado.",
            cargando: "Consultando tus publicaciones…",
            error: "No se pudieron consultar tus publicaciones. Conservamos el formulario; puedes volver a intentarlo cuando el servicio esté disponible.",
            vacio: "Todavía no tienes publicaciones.",
            listo: "",
        };
        if (!Object.hasOwn(textos, estado)) return false;
        region.textContent = typeof mensaje === "string" && mensaje.trim() ? mensaje : textos[estado];
        region.dataset.estado = estado;
        lista.replaceChildren();
        if (estado !== "listo" || !Array.isArray(publicaciones)) return true;
        for (const articulo of publicaciones) {
            if (!articulo || typeof articulo !== "object" || typeof articulo.id !== "string"
                || typeof articulo.titulo !== "string" || typeof articulo.descripcion !== "string"
                || !ESTADOS.has(articulo.estado) || !Number.isSafeInteger(articulo.precioCentimos)
                || articulo.precioCentimos <= 0 || articulo.moneda !== "PEN") continue;
            const tarjeta = documento.createElement("article");
            tarjeta.className = "own-publication-card";
            const titulo = documento.createElement("h3");
            titulo.textContent = articulo.titulo;
            const descripcion = documento.createElement("p");
            descripcion.textContent = articulo.descripcion;
            const precio = documento.createElement("p");
            precio.textContent = `S/ ${(articulo.precioCentimos / 100).toFixed(2)}`;
            const estadoArticulo = documento.createElement("p");
            estadoArticulo.className = "own-publication-status";
            estadoArticulo.textContent = `Estado: ${articulo.estado}`;
            tarjeta.append(titulo, descripcion, precio, estadoArticulo);
            lista.append(tarjeta);
        }
        if (!lista.children.length) {
            region.textContent = "El servicio no devolvió publicaciones con un formato reconocido.";
            region.dataset.estado = "error";
        } else region.textContent = `${lista.children.length} ${lista.children.length === 1 ? "publicación" : "publicaciones"} consultadas.`;
        return true;
    }

    function crearControladorPublicaciones({ documento = global.document, servicios = {}, prepararPublicacion,
        opcionesCatalogo, verificarVendedor, resolverContextoStorage, observarCambioIdentidad,
        serviciosImagenes = {}, imagenes = global.CampusLoopImagenes, timeoutMs = TIMEOUT_MS } = {}) {
        let desmontado = false;
        let enCurso = false;
        let publicacionIndeterminada = false;
        let creacionPendiente = false;
        let observadorIdentidadListo = false;
        let generacion = 0;
        let abortador = null;
        const limpiezas = [];
        const btn = documento?.getElementById("btn-publicar");
        const titulo = documento?.getElementById("input-titulo");
        const descripcion = documento?.getElementById("input-descripcion");
        const mensaje = documento?.getElementById("mensaje-formulario");
        const categoria = documento?.getElementById("input-categoria");
        const condicion = documento?.getElementById("input-condicion");
        const precio = documento?.getElementById("input-precio");
        const campus = documento?.getElementById("input-campus");
        const estadoCatalogos = documento?.getElementById("estado-catalogos");
        if (!btn || !titulo || !descripcion || !mensaje) return { desmontar() {} };

        if (controles.has(btn)) return controles.get(btn);
        let restaurarBoton = null;
        const campos = new Map([
            [titulo, { error: documento.getElementById("error-titulo"), vacio: "Por favor, ingresa un título para tu artículo." }],
            [descripcion, { error: documento.getElementById("error-descripcion"), vacio: "Por favor, ingresa una descripción para tu artículo." }],
            [categoria, { error: documento.getElementById("error-categoria"), vacio: "Selecciona una categoría del catálogo." }],
            [condicion, { error: documento.getElementById("error-condicion"), vacio: "Selecciona la condición del artículo." }],
            [precio, { error: documento.getElementById("error-precio"), vacio: "Ingresa un precio positivo en soles." }],
            [campus, { error: documento.getElementById("error-campus"), vacio: "Selecciona un campus del catálogo." }],
        ]);
        for (const [campo, config] of [...campos]) if (!campo) campos.delete(campo);
        const registrar = (elemento, tipo, listener) => {
            if (!elemento) return;
            elemento.addEventListener(tipo, listener);
            limpiezas.push(() => elemento.removeEventListener(tipo, listener));
        };
        function actualizarErrorCampo(campo, texto = "") {
            const error = campos.get(campo)?.error;
            const invalido = texto !== "";
            campo.classList.toggle("input-error", invalido);
            campo.setAttribute("aria-invalid", String(invalido));
            if (!error) return;
            error.textContent = texto;
            error.hidden = !invalido;
            const referencias = new Set((campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
            if (invalido) referencias.add(error.id);
            else referencias.delete(error.id);
            if (referencias.size) campo.setAttribute("aria-describedby", [...referencias].join(" "));
            else campo.removeAttribute("aria-describedby");
        }
        function validarCampo(campo) {
            const config = campos.get(campo);
            let texto = "";
            if (!campo.value.trim()) texto = config.vacio;
            else if (campo === categoria && !Array.from(categoria.options || []).some(o => o.value === campo.value && o.value)) texto = config.vacio;
            else if (campo === campus && !Array.from(campus.options || []).some(o => o.value === campo.value && o.value)) texto = config.vacio;
            else if (campo === condicion && !CONDICIONES.has(campo.value)) texto = config.vacio;
            else if (campo === precio && (precioACentimos(campo.value) === null || precioACentimos(campo.value) <= 0)) texto = "El precio debe ser válido, positivo y tener hasta dos decimales.";
            else if (campo.maxLength >= 0 && campo.value.length > campo.maxLength) {
                texto = `El campo admite un máximo de ${campo.maxLength} caracteres.`;
            }
            actualizarErrorCampo(campo, texto);
            return texto === "";
        }
        function mostrarMensaje(texto, tipo = "info") {
            if (desmontado) return;
            mensaje.className = "msj-dinamico";
            mensaje.textContent = texto;
            if (tipo === "error") mensaje.classList.add("is-error");
            else if (tipo === "info" || tipo === "integracion_pendiente") mensaje.classList.add("is-info");
        }
        function validarFormulario() {
            let primero = null;
            for (const campo of campos.keys()) if (!validarCampo(campo) && !primero) primero = campo;
            const foto = imagenesControl?.obtenerArchivo?.();
            const fotoValida = !!foto;
            const errorFoto = documento.getElementById("error-fotografia");
            const inputFoto = documento.getElementById("input-fotografia");
            if (errorFoto) { errorFoto.hidden = fotoValida; errorFoto.textContent = fotoValida ? "" : "Selecciona una fotografía válida para continuar."; }
            if (inputFoto) inputFoto.setAttribute("aria-invalid", String(!fotoValida));
            if (!fotoValida && !primero) primero = inputFoto;
            if (primero) {
                mostrarMensaje(campos.get(primero)?.error?.textContent || "Selecciona una fotografía válida.", "error");
                primero?.focus?.();
                return false;
            }
            return true;
        }
        function precioACentimos(valor) {
            if (typeof valor !== "string" || !/^\d{1,12}(?:[.,]\d{1,2})?$/.test(valor.trim())) return null;
            const [entero, fraccion = ""] = valor.trim().split(/[.,]/);
            const total = Number(entero) * 100 + Number(fraccion.padEnd(2, "0"));
            return Number.isSafeInteger(total) ? total : null;
        }
        const imagenesControl = typeof imagenes?.crearControladorImagenes === "function"
            ? imagenes.crearControladorImagenes({ documento, subirFotografia: serviciosImagenes.subirFotografia }) : null;
        function cargarSelect(select, lista) {
            if (!select || !Array.isArray(lista)) return false;
            const validas = lista.filter(item => item && UUID.test(item.id) && typeof item.etiqueta === "string" && item.etiqueta.trim());
            if (validas.length !== lista.length || new Set(validas.map(o => o.id)).size !== validas.length) return false;
            while (select.options.length > 1) select.remove(1);
            for (const item of validas) { const option = documento.createElement("option"); option.value = item.id; option.textContent = item.etiqueta; select.append(option); }
            return validas.length > 0;
        }
        const catalogosListos = cargarSelect(categoria, opcionesCatalogo?.categorias)
            && cargarSelect(campus, opcionesCatalogo?.campus);
        if (estadoCatalogos && catalogosListos) estadoCatalogos.textContent = "Opciones inyectadas en modo preparatorio; se debe verificar su origen antes de conectar la publicación.";
        const dtoFormulario = () => ({ titulo: titulo.value.trim(), descripcion: descripcion.value.trim(),
            categoriaId: categoria?.value || "", condicion: condicion?.value || "",
            precioCentimos: precioACentimos(precio?.value || ""), moneda: "PEN", campusId: campus?.value || "" });
        const capturarFormularioVisible = () => Object.freeze({ titulo: titulo.value, descripcion: descripcion.value,
            categoriaId: categoria?.value || "", condicion: condicion?.value || "", precio: precio?.value || "",
            campusId: campus?.value || "" });
        const formularioVisibleCoincide = captura => {
            const actual = capturarFormularioVisible();
            return Object.keys(captura).every(campo => actual[campo] === captura[campo]);
        };
        const respuestaValida = r => r && typeof r === "object" && typeof r.ok === "boolean"
            && Object.hasOwn(r, "datos") && Object.hasOwn(r, "error")
            && (r.ok ? r.error === null && !!r.datos && typeof r.datos === "object" && !Array.isArray(r.datos)
                : r.datos === null && !!r.error && typeof r.error === "object" && typeof r.error.codigo === "string");

        async function publicar(evento) {
            evento.preventDefault();
            if (desmontado || enCurso) return;
            if (publicacionIndeterminada) {
                mostrarMensaje("No se puede reenviar: el resultado anterior requiere reconciliación con el servicio autorizado.", "error");
                return;
            }
            if (!validarFormulario()) return;
            const seleccionFotografia = imagenesControl?.capturarSeleccion?.() ?? null;
            if (imagenesControl?.capturarSeleccion && !seleccionFotografia) {
                mostrarMensaje("Selecciona una fotografía válida para continuar.", "error");
                documento.getElementById("input-fotografia")?.focus?.();
                return;
            }
            if (typeof verificarVendedor !== "function") {
                mostrarMensaje("Integración pendiente: falta consultar al servicio autorizado para confirmar el perfil vendedor.", "integracion_pendiente");
                return;
            }
            if (typeof servicios.crearPublicacion !== "function" || typeof prepararPublicacion !== "function") {
                mostrarMensaje("Integración pendiente: falta conectar el servicio autorizado de publicaciones.", "integracion_pendiente");
                return;
            }
            if (typeof resolverContextoStorage !== "function" || !observadorIdentidadListo) {
                mostrarMensaje("Integración pendiente: faltan el contexto autorizado de Storage y la vigilancia de cambios de sesión.", "integracion_pendiente");
                return;
            }
            const entrada = dtoFormulario();
            const capturaFormulario = capturarFormularioVisible();
            enCurso = true;
            const operacion = ++generacion;
            abortador = new AbortController();
            const textoBoton = btn.textContent;
            const disabledAnterior = btn.disabled;
            const busyAnterior = btn.getAttribute("aria-busy");
            restaurarBoton = () => {
                btn.textContent = textoBoton;
                btn.disabled = disabledAnterior;
                if (busyAnterior === null) btn.removeAttribute("aria-busy"); else btn.setAttribute("aria-busy", busyAnterior);
                restaurarBoton = null;
            };
            btn.disabled = true;
            btn.setAttribute("aria-busy", "true");
            btn.textContent = "Procesando…";
            let preparado;
            let estadoVendedor;
            let errorEspera = null;
            try { estadoVendedor = await esperarConLimite(() => verificarVendedor({ signal: abortador.signal }), abortador.signal, timeoutMs); }
            catch (error) { errorEspera = error; if (error?.name === "TimeoutError") abortador.abort(); estadoVendedor = null; }
            if (desmontado || operacion !== generacion) return;
            if (!respuestaValida(estadoVendedor) || estadoVendedor?.ok !== true || estadoVendedor?.datos?.estado !== "APROBADO") {
                mostrarMensaje(errorEspera?.name === "TimeoutError"
                    ? "La consulta de vendedor tardó demasiado. Tus datos siguen en el formulario; verifica el estado antes de reintentar."
                    : estadoVendedor?.datos?.estado === "PENDIENTE"
                    ? "Tu perfil vendedor sigue pendiente de revisión humana; no se puede publicar todavía."
                    : "No se pudo confirmar un perfil vendedor aprobado. Conservamos los datos del formulario.", "error");
                enCurso = false; abortador = null; restaurarBoton();
                return;
            }
            let contextoStorage = null;
            try {
                const contextoRespuesta = await esperarConLimite(() => resolverContextoStorage({ signal: abortador.signal }), abortador.signal, timeoutMs);
                if (desmontado || operacion !== generacion) return;
                if (respuestaValida(contextoRespuesta) && contextoRespuesta.ok
                    && validarContextoStorage(contextoRespuesta.datos)) contextoStorage = Object.freeze({ ...contextoRespuesta.datos });
            } catch (error) {
                errorEspera = error;
                if (error?.name === "TimeoutError") abortador.abort();
            }
            if (desmontado || operacion !== generacion) return;
            if (!contextoStorage) {
                mostrarMensaje("No se pudo verificar el contexto de almacenamiento del propietario. Conservamos el formulario.", "error");
                enCurso = false; abortador = null; restaurarBoton();
                return;
            }
            let resultadoFotografia = null;
            const fotografiaOperacion = seleccionFotografia ? Object.freeze({
                obtenerArchivo: () => seleccionFotografia.datos,
                preparar: async opciones => {
                    const resultado = await imagenesControl.preparar({ ...opciones, seleccion: seleccionFotografia, contextoStorage });
                    if (resultado?.ok === true && resultado.error === null && resultado.datos && typeof resultado.datos === "object") {
                        resultadoFotografia = resultado.datos;
                    }
                    return resultado;
                },
                esSeleccionActual: () => imagenesControl.esSeleccionActual(seleccionFotografia),
            }) : imagenesControl;
            try { preparado = await esperarConLimite(() => prepararPublicacion(entrada, {
                signal: abortador.signal, fotografia: fotografiaOperacion, seleccionFotografia,
            }), abortador.signal, timeoutMs); }
            catch (error) { errorEspera = error; if (error?.name === "TimeoutError") abortador.abort(); preparado = null; }
            if (desmontado || operacion !== generacion) return;
            if (!preparado || preparado.ok !== true || (preparado.error !== undefined && preparado.error !== null)
                || !validarDtoPublicacion(preparado.datos, contextoStorage)
                || preparado.datos.titulo !== entrada.titulo || preparado.datos.descripcion !== entrada.descripcion
                || preparado.datos.categoriaId !== entrada.categoriaId || preparado.datos.condicion !== entrada.condicion
                || preparado.datos.precioCentimos !== entrada.precioCentimos || preparado.datos.moneda !== entrada.moneda
                || preparado.datos.campusId !== entrada.campusId
                || (seleccionFotografia && (preparado.seleccionFotografia !== seleccionFotografia
                    || imagenesControl?.esSeleccionActual?.(seleccionFotografia) !== true
                    || !resultadoFotografia || !imagenesCoinciden(preparado.datos.imagen, resultadoFotografia)
                    || (() => { const foto = imagenesControl.obtenerDatosSeleccion?.(seleccionFotografia); return !foto
                        || foto.formato !== preparado.datos.imagen.formato || foto.bytes !== preparado.datos.imagen.bytes
                        || foto.ancho !== preparado.datos.imagen.ancho || foto.alto !== preparado.datos.imagen.alto; })()))
                || errorEspera?.name === "TimeoutError") {
                // Códigos provisionales del controlador. Nunca mostrar mensajes del preparador.
                const rechazado = respuestaValida(preparado) && !preparado.ok;
                mostrarMensaje(errorEspera?.name === "TimeoutError"
                    ? "La preparación tardó demasiado. Tus datos siguen en el formulario; verifica el estado antes de reintentar."
                    : rechazado ? resultadoSeguro(preparado.error).error.mensaje : MENSAJES_VALIDACION_DTO, "error");
                if (rechazado) {
                    const campo = [...campos.keys()].find(c => c.id === preparado.campo);
                    campo?.focus();
                }
                enCurso = false; abortador = null; restaurarBoton();
                return;
            }
            mostrarMensaje("Enviando la publicación…", "info");
            try {
                creacionPendiente = true;
                const r = await esperarConLimite(() => servicios.crearPublicacion(preparado.datos, { signal: abortador.signal }), abortador.signal, timeoutMs);
                if (desmontado || operacion !== generacion) return;
                if (!respuestaValida(r)) { publicacionIndeterminada = true; mostrarMensaje(MENSAJES.RESPUESTA_INVALIDA + " El resultado requiere reconciliación antes de reintentar.", "error"); return; }
                if (!r.ok) {
                    // Sin contrato de resultado definitivo del servicio, el artículo pudo crearse.
                    publicacionIndeterminada = true;
                    mostrarMensaje(`${resultadoSeguro(r.error).error.mensaje} El resultado requiere reconciliación antes de reintentar.`, "error");
                    return;
                }
                if (!validarArticulo(r.datos, contextoStorage) || !camposPublicacionCoinciden(r.datos, preparado.datos)) {
                    publicacionIndeterminada = true;
                    mostrarMensaje(MENSAJES.RESPUESTA_INVALIDA + " El resultado requiere reconciliación antes de reintentar.", "error"); return;
                }
                creacionPendiente = false;
                mostrarMensaje(formularioVisibleCoincide(capturaFormulario)
                    && (!seleccionFotografia || imagenesControl?.esSeleccionActual?.(seleccionFotografia) === true)
                    ? "Respuesta válida del servicio de prueba. Revisa los datos antes de continuar."
                    : "La respuesta corresponde al envío anterior. Tus cambios siguen en el formulario.", "info");
            } catch (error) {
                if (desmontado || operacion !== generacion) return;
                if (error?.name === "AbortError" || error?.name === "TimeoutError") {
                    if (error?.name === "TimeoutError") abortador?.abort();
                    if (creacionPendiente) publicacionIndeterminada = true;
                    mostrarMensaje("La espera terminó. El servicio pudo haber recibido la publicación; comprueba su estado antes de reintentar. Tus datos siguen en el formulario.", "error");
                    return;
                }
                if (creacionPendiente) publicacionIndeterminada = true;
                mostrarMensaje(`${resultadoSeguro(error).error.mensaje} El resultado requiere reconciliación con el servicio antes de volver a enviar.`, "error");
            } finally {
                if (!desmontado && operacion === generacion) {
                    enCurso = false;
                    abortador = null;
                    restaurarBoton();
                    if (publicacionIndeterminada) btn.disabled = true;
                }
            }
        }

        registrar(btn, "click", publicar);
        for (const [campo, config] of campos) registrar(campo, "input", () => {
            if (campo.getAttribute("aria-invalid") !== "true") return;
            const mensajeAnterior = config.error.textContent;
            if (!validarCampo(campo) || mensaje.textContent !== mensajeAnterior) return;
            const pendiente = [...campos].find(([otro]) => otro.getAttribute("aria-invalid") === "true");
            mostrarMensaje(pendiente ? pendiente[1].error.textContent : "Campo corregido. Puedes revisar los datos antes de continuar.", pendiente ? "error" : "info");
        });
        for (const [campo] of campos) if (campo === categoria || campo === condicion || campo === campus) registrar(campo, "change", () => {
            if (campo.getAttribute("aria-invalid") !== "true") return;
            const anterior = mensaje.textContent;
            if (!validarCampo(campo) || anterior !== campos.get(campo).error.textContent) return;
            mostrarMensaje("Campo corregido. Puedes revisar los datos antes de continuar.", "info");
        });

        const aplicarBorradorValidado = borrador => {
            if (desmontado || enCurso || !borrador || typeof borrador !== "object" || Array.isArray(borrador)
                || Object.keys(borrador).length !== 2 || !Object.hasOwn(borrador, "titulo") || !Object.hasOwn(borrador, "descripcion")
                || typeof borrador.titulo !== "string" || typeof borrador.descripcion !== "string"
                || !borrador.titulo.trim() || borrador.titulo.length > 100
                || !borrador.descripcion.trim() || borrador.descripcion.length > 1000) return false;
            titulo.value = borrador.titulo;
            descripcion.value = borrador.descripcion;
            validarCampo(titulo);
            validarCampo(descripcion);
            mostrarMensaje("Borrador cargado para revisión. Revisa los datos y confirma la publicación.", "info");
            titulo.focus();
            return true;
        };

        limpiezas.push(() => imagenesControl?.desmontar?.());
        if (typeof observarCambioIdentidad === "function") {
            try {
                const desuscribir = observarCambioIdentidad(() => {
                    if (desmontado) return;
                    if (creacionPendiente) publicacionIndeterminada = true;
                    generacion++;
                    abortador?.abort();
                    enCurso = false;
                    abortador = null;
                    if (restaurarBoton) restaurarBoton();
                    if (publicacionIndeterminada) btn.disabled = true;
                    mostrarMensaje(publicacionIndeterminada
                        ? "Cambió la sesión durante una publicación. Comprueba el resultado con el servicio autorizado antes de continuar."
                        : "Cambió la sesión. Se canceló la operación; vuelve a verificar tu perfil vendedor.", "error");
                });
                if (typeof desuscribir === "function") {
                    observadorIdentidadListo = true;
                    limpiezas.push(desuscribir);
                } else {
                    mostrarMensaje("Integración pendiente: no se pudo confirmar la limpieza del observador de sesión.", "integracion_pendiente");
                }
            } catch {
                mostrarMensaje("No se pudo observar el ciclo de identidad. La publicación permanece deshabilitada.", "integracion_pendiente");
                btn.disabled = true;
            }
        }
        limpiezas.push(montarInterfazIA(documento, validarFormulario, () => enCurso || desmontado));
        const control = {
            publicar,
            aplicarBorradorValidado,
            validarFormulario: () => !desmontado && !enCurso && validarFormulario(),
            validarArticulo: (dto, contexto) => validarArticulo(dto, contexto),
            validarDtoPublicacion: (dto, contexto) => validarDtoPublicacion(dto, contexto),
            desmontar() {
                if (desmontado) return;
                desmontado = true;
                generacion++;
                abortador?.abort();
                for (const limpiar of limpiezas.splice(0)) limpiar();
                enCurso = false;
                abortador = null;
                if (restaurarBoton) {
                    mensaje.textContent = "";
                    restaurarBoton();
                }
                controles.delete(btn);
            },
        };
        controles.set(btn, control);
        return control;
    }

    const MENSAJES_VALIDACION_DTO = "Completa una categoría, campus, precio y fotografía válidos antes de publicar.";

    // Conserva los mensajes, foco y ARIA aprobados en PR #40. Este panel sigue
    // siendo una demostración local hasta su sustitución coordinada.
    function montarInterfazIA(documento, validarFormulario, bloqueada) {
        const titulo = documento.getElementById("input-titulo");
        const descripcion = documento.getElementById("input-descripcion");
        const boton = documento.getElementById("btn-generar-ia");
        const panel = documento.getElementById("ia-propuesta");
        const propuestaTitulo = documento.getElementById("ia-titulo-sugerido");
        const propuestaDescripcion = documento.getElementById("ia-desc-sugerido");
        const aceptar = documento.getElementById("btn-aceptar-ia");
        const descartar = documento.getElementById("btn-descartar-ia");
        const region = documento.getElementById("mensaje-formulario");
        if (![titulo, descripcion, boton, panel, propuestaTitulo, propuestaDescripcion, aceptar, descartar, region].every(Boolean)) return () => {};
        const limpiar = [];
        const configs = new Map([
            [propuestaTitulo, { error: documento.getElementById("error-ia-titulo"), vacio: "El título de la sugerencia está vacío. Edítalo o descarta la propuesta." }],
            [propuestaDescripcion, { error: documento.getElementById("error-ia-descripcion"), vacio: "La descripción de la sugerencia está vacía. Edítala o descarta la propuesta." }],
        ]);
        const on = (elemento, tipo, fn) => {
            const listener = () => { if (!bloqueada()) fn(); };
            elemento.addEventListener(tipo, listener);
            limpiar.push(() => elemento.removeEventListener(tipo, listener));
        };
        const actualizar = (campo, texto = "") => {
            const error = configs.get(campo).error;
            const invalido = texto !== "";
            campo.classList.toggle("input-error", invalido);
            campo.setAttribute("aria-invalid", String(invalido));
            error.textContent = texto;
            error.hidden = !invalido;
            const ids = new Set((campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
            if (invalido) ids.add(error.id); else ids.delete(error.id);
            if (ids.size) campo.setAttribute("aria-describedby", [...ids].join(" ")); else campo.removeAttribute("aria-describedby");
        };
        const validar = campo => {
            const config = configs.get(campo);
            const texto = !campo.value.trim() ? config.vacio
                : campo.maxLength >= 0 && campo.value.length > campo.maxLength
                    ? `El campo admite un máximo de ${campo.maxLength} caracteres.` : "";
            actualizar(campo, texto);
            return texto === "";
        };
        const mostrar = (texto, tipo = "info") => {
            region.className = "msj-dinamico";
            region.textContent = texto;
            region.classList.add(tipo === "error" ? "is-error" : "is-info");
        };
        for (const [campo, config] of configs) on(campo, "input", () => {
            if (campo.getAttribute("aria-invalid") !== "true") return;
            const anterior = config.error.textContent;
            if (!validar(campo) || region.textContent !== anterior) return;
            const pendiente = [...configs].find(([otro]) => otro.getAttribute("aria-invalid") === "true");
            mostrar(pendiente ? pendiente[1].error.textContent : "Campo corregido. Puedes revisar los datos antes de continuar.", pendiente ? "error" : "info");
        });
        on(boton, "click", () => {
            propuestaTitulo.value = titulo.value;
            propuestaDescripcion.value = descripcion.value;
            actualizar(propuestaTitulo);
            actualizar(propuestaDescripcion);
            panel.style.display = "block";
            mostrar("Generación simulada: Esta es una demostración visual. La IA real se conectará en el futuro.");
        });
        on(aceptar, "click", () => {
            const validoTitulo = validar(propuestaTitulo);
            const validaDescripcion = validar(propuestaDescripcion);
            if (!validoTitulo || !validaDescripcion) {
                const primero = !validoTitulo ? propuestaTitulo : propuestaDescripcion;
                mostrar(configs.get(primero).error.textContent, "error");
                primero.focus();
                return;
            }
            titulo.value = propuestaTitulo.value;
            descripcion.value = propuestaDescripcion.value;
            panel.style.display = "none";
            if (!validarFormulario()) return;
            const otrosErrores = documento.querySelector(".publish-form-area .input-error, .publish-form-area [aria-invalid='true']");
            let texto = "Sugerencia aceptada (Simulación). Los textos editados se han aplicado al formulario.";
            if (otrosErrores) texto += " Revisa los otros campos marcados.";
            mostrar(texto, otrosErrores ? "error" : "info");
            titulo.focus();
        });
        on(descartar, "click", () => {
            panel.style.display = "none";
            actualizar(propuestaTitulo);
            actualizar(propuestaDescripcion);
            mostrar("Propuesta descartada. El formulario conserva sus datos originales.");
            boton.focus();
        });
        return () => { for (const fn of limpiar.splice(0)) fn(); };
    }

    global.CampusLoopPublicaciones = Object.freeze({ crearControladorPublicaciones, validarArticulo, validarDtoPublicacion, presentarMisPublicaciones });
    if (global.document) global.document.addEventListener("DOMContentLoaded", () => {
        const dependencias = global.CampusLoopPublicacionesDependencias || {};
        const controlador = crearControladorPublicaciones({ documento: global.document, imagenes: global.CampusLoopImagenes, ...dependencias });
        global.campusLoopPublicaciones = controlador;
    }, { once: true });
})(typeof window === "undefined" ? globalThis : window);
