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
    const CONDICIONES = new Set(["nuevo", "como_nuevo", "buen_estado", "usado"]);
    const FORMATOS_IMAGEN = Object.freeze({ "image/jpeg": /\.(?:jpe?g)$/i, "image/png": /\.png$/i, "image/webp": /\.webp$/i });
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

    function validarImagen(imagen) {
        if (!imagen || typeof imagen !== "object" || Array.isArray(imagen)
            || imagen.proveedor !== "supabase" || typeof imagen.bucket !== "string"
            || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(imagen.bucket)
            || typeof imagen.ruta !== "string" || imagen.ruta.length > 500
            || !/^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(imagen.ruta)
            || typeof imagen.url !== "string" || imagen.url.length > 2048
            || !Object.hasOwn(FORMATOS_IMAGEN, imagen.formato)
            || !FORMATOS_IMAGEN[imagen.formato].test(imagen.ruta)
            || !Number.isSafeInteger(imagen.bytes) || imagen.bytes <= 0
            || !Number.isSafeInteger(imagen.ancho) || imagen.ancho <= 0
            || !Number.isSafeInteger(imagen.alto) || imagen.alto <= 0) return false;
        try {
            const url = new URL(imagen.url);
            return url.protocol === "https:" && !url.username && !url.password
                && !url.search && !url.hash && url.hostname.includes(".")
                && url.pathname.endsWith(`/storage/v1/object/public/${imagen.bucket}/${imagen.ruta}`);
        } catch { return false; }
    }

    // DTO mínimo de escritura. No acepta identidad/estado suministrados por UI;
    // el servicio autorizado deriva el vendedor y asigna el estado inicial.
    function validarDtoPublicacion(dto) {
        const claves = ["titulo", "descripcion", "categoriaId", "condicion", "precioCentimos", "moneda", "campusId", "imagen"];
        if (!dto || typeof dto !== "object" || Array.isArray(dto)
            || Object.keys(dto).length !== claves.length || !claves.every(clave => Object.hasOwn(dto, clave))) return false;
        return typeof dto.titulo === "string" && dto.titulo.trim().length > 0 && dto.titulo.length <= 100
            && typeof dto.descripcion === "string" && dto.descripcion.trim().length > 0 && dto.descripcion.length <= 1000
            && typeof dto.categoriaId === "string" && UUID.test(dto.categoriaId)
            && typeof dto.campusId === "string" && UUID.test(dto.campusId)
            && typeof dto.condicion === "string" && CONDICIONES.has(dto.condicion)
            && Number.isSafeInteger(dto.precioCentimos) && dto.precioCentimos > 0
            && dto.moneda === "PEN" && validarImagen(dto.imagen);
    }

    function validarArticulo(dto) {
        if (!dto || typeof dto !== "object" || Array.isArray(dto)) return false;
        return typeof dto.id === "string" && UUID.test(dto.id)
            && typeof dto.vendedorId === "string" && UUID.test(dto.vendedorId)
            && typeof dto.categoriaId === "string" && UUID.test(dto.categoriaId)
            && typeof dto.campusId === "string" && UUID.test(dto.campusId)
            && typeof dto.titulo === "string" && dto.titulo.trim().length > 0 && dto.titulo.length <= 100
            && typeof dto.descripcion === "string" && dto.descripcion.trim().length > 0 && dto.descripcion.length <= 1000
            && Number.isSafeInteger(dto.precioCentimos) && dto.precioCentimos > 0 && dto.moneda === "PEN"
            && CONDICIONES.has(dto.condicion) && ESTADOS.has(dto.estado)
            && dto.estado === "disponible" && validarImagen(dto.imagen)
            && typeof dto.creadoEn === "string" && Number.isFinite(Date.parse(dto.creadoEn))
            && typeof dto.actualizadoEn === "string" && Number.isFinite(Date.parse(dto.actualizadoEn))
            && Number.isSafeInteger(dto.version) && dto.version > 0;
    }

    function crearControladorPublicaciones({ documento = global.document, servicios = {}, prepararPublicacion } = {}) {
        let desmontado = false;
        let enCurso = false;
        let generacion = 0;
        let abortador = null;
        const limpiezas = [];
        const btn = documento?.getElementById("btn-publicar");
        const titulo = documento?.getElementById("input-titulo");
        const descripcion = documento?.getElementById("input-descripcion");
        const mensaje = documento?.getElementById("mensaje-formulario");
        if (!btn || !titulo || !descripcion || !mensaje) return { desmontar() {} };

        const campos = new Map([
            [titulo, { error: documento.getElementById("error-titulo"), vacio: "Por favor, ingresa un título para tu artículo." }],
            [descripcion, { error: documento.getElementById("error-descripcion"), vacio: "Por favor, ingresa una descripción para tu artículo." }],
        ]);
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
            const tituloValido = validarCampo(titulo);
            const descripcionValida = validarCampo(descripcion);
            if (!tituloValido || !descripcionValida) {
                const primero = !tituloValido ? titulo : descripcion;
                mostrarMensaje(campos.get(primero).error.textContent, "error");
                primero.focus();
                return false;
            }
            return true;
        }
        const dtoFormulario = () => ({ titulo: titulo.value.trim(), descripcion: descripcion.value.trim() });
        const respuestaValida = r => r && typeof r === "object" && typeof r.ok === "boolean"
            && Object.hasOwn(r, "datos") && Object.hasOwn(r, "error");

        async function publicar(evento) {
            evento.preventDefault();
            if (desmontado || enCurso) return;
            if (!validarFormulario()) return;
            if (typeof servicios.crearPublicacion !== "function" || typeof prepararPublicacion !== "function") {
                mostrarMensaje("Integración pendiente: falta conectar el servicio autorizado de publicaciones.", "integracion_pendiente");
                return;
            }
            let preparado;
            try { preparado = prepararPublicacion(dtoFormulario()); }
            catch { preparado = null; }
            if (!preparado || preparado.ok !== true || !validarDtoPublicacion(preparado.datos)) {
                const campo = preparado?.campo && documento.getElementById(preparado.campo);
                mostrarMensaje(preparado?.error?.mensaje || MENSAJES_VALIDACION_DTO, "error");
                campo?.focus();
                return;
            }
            enCurso = true;
            const operacion = ++generacion;
            abortador = new AbortController();
            const textoBoton = btn.textContent;
            btn.disabled = true;
            btn.setAttribute("aria-busy", "true");
            btn.textContent = "Procesando…";
            mostrarMensaje("Enviando la publicación…", "info");
            try {
                const r = await servicios.crearPublicacion(preparado.datos, { signal: abortador.signal });
                if (desmontado || operacion !== generacion) return;
                if (!respuestaValida(r)) { mostrarMensaje(MENSAJES.RESPUESTA_INVALIDA, "error"); return; }
                if (!r.ok) { mostrarMensaje(resultadoSeguro(r.error).error.mensaje, "error"); return; }
                if (!validarArticulo(r.datos)) { mostrarMensaje(MENSAJES.RESPUESTA_INVALIDA, "error"); return; }
                mostrarMensaje("Publicación confirmada por el servicio.", "info");
            } catch (error) {
                if (desmontado || operacion !== generacion || error?.name === "AbortError") return;
                mostrarMensaje(resultadoSeguro(error).error.mensaje, "error");
            } finally {
                if (!desmontado && operacion === generacion) {
                    enCurso = false;
                    abortador = null;
                    btn.disabled = false;
                    btn.removeAttribute("aria-busy");
                    btn.textContent = textoBoton;
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

        const aplicarBorradorValidado = borrador => {
            if (desmontado || !borrador || typeof borrador !== "object"
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

        return {
            publicar,
            aplicarBorradorValidado,
            validarFormulario,
            validarArticulo,
            validarDtoPublicacion,
            desmontar() {
                if (desmontado) return;
                desmontado = true;
                generacion++;
                abortador?.abort();
                for (const limpiar of limpiezas.splice(0)) limpiar();
                enCurso = false;
                abortador = null;
                btn.disabled = false;
                btn.removeAttribute("aria-busy");
            },
        };
    }

    const MENSAJES_VALIDACION_DTO = "Completa una categoría, campus, precio y fotografía válidos antes de publicar.";

    // Conserva los mensajes, foco y ARIA aprobados en PR #40. Este panel sigue
    // siendo una demostración local hasta su sustitución coordinada.
    function montarInterfazIA(documento, validarFormulario) {
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
        const on = (elemento, tipo, fn) => { elemento.addEventListener(tipo, fn); limpiar.push(() => elemento.removeEventListener(tipo, fn)); };
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

    global.CampusLoopPublicaciones = Object.freeze({ crearControladorPublicaciones, validarArticulo, validarDtoPublicacion });
    if (global.document) global.document.addEventListener("DOMContentLoaded", () => {
        const controlador = crearControladorPublicaciones({});
        const desmontarIA = montarInterfazIA(global.document, controlador.validarFormulario);
        const desmontar = controlador.desmontar;
        controlador.desmontar = () => { desmontar(); desmontarIA(); };
        global.campusLoopPublicaciones = controlador;
    }, { once: true });
})(typeof window === "undefined" ? globalThis : window);
