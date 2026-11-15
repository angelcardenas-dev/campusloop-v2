document.addEventListener("DOMContentLoaded", () => {
    console.log("Módulo de publicaciones cargado (Corrección PR34).");

    // Capturamos elementos del formulario
    const btnPublicar = document.getElementById("btn-publicar");
    const inputTitulo = document.getElementById("input-titulo");
    const inputDescripcion = document.getElementById("input-descripcion");
    const msjFormulario = document.getElementById("mensaje-formulario");

    // Capturamos elementos de la IA
    const btnIA = document.getElementById("btn-generar-ia");
    const contenedorIA = document.getElementById("ia-propuesta");
    const iaTituloSug = document.getElementById("ia-titulo-sugerido");
    const iaDescSug = document.getElementById("ia-desc-sugerido");
    const btnAceptarIA = document.getElementById("btn-aceptar-ia");
    const btnDescartarIA = document.getElementById("btn-descartar-ia");

    const validaciones = new Map([
        [inputTitulo, { error: document.getElementById("error-titulo"), vacio: "Por favor, ingresa un título para tu artículo." }],
        [inputDescripcion, { error: document.getElementById("error-descripcion"), vacio: "Por favor, ingresa una descripción para tu artículo." }],
        [iaTituloSug, { error: document.getElementById("error-ia-titulo"), vacio: "El título de la sugerencia está vacío. Edítalo o descarta la propuesta." }],
        [iaDescSug, { error: document.getElementById("error-ia-descripcion"), vacio: "La descripción de la sugerencia está vacía. Edítala o descarta la propuesta." }],
    ]);

    let estadoActual = "inicial";

    function actualizarErrorCampo(campo, texto = "") {
        const error = validaciones.get(campo).error;
        const invalido = texto !== "";
        campo.classList.toggle("input-error", invalido);
        campo.setAttribute("aria-invalid", String(invalido));
        error.textContent = texto;
        error.hidden = !invalido;
        // Añadir o retirar solo la referencia de este error, conservando ayudas previas.
        const referencias = new Set((campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
        if (invalido) referencias.add(error.id);
        else referencias.delete(error.id);
        if (referencias.size) campo.setAttribute("aria-describedby", [...referencias].join(" "));
        else campo.removeAttribute("aria-describedby");
    }

    function validarCampo(campo) {
        let texto = "";
        if (!campo.value.trim()) texto = validaciones.get(campo).vacio;
        else if (campo.maxLength >= 0 && campo.value.length > campo.maxLength) {
            texto = `El campo admite un máximo de ${campo.maxLength} caracteres.`;
        }
        actualizarErrorCampo(campo, texto);
        return texto === "";
    }

    function mostrarMensaje(texto, tipo) {
        msjFormulario.className = "msj-dinamico";
        msjFormulario.textContent = texto;

        if (tipo === "error") {
            msjFormulario.classList.add("is-error");
        } else if (tipo === "integracion_pendiente" || tipo === "info") {
            msjFormulario.classList.add("is-info");
        }
    }

    for (const [campo, configuracion] of validaciones) {
        campo.addEventListener("input", () => {
            if (campo.getAttribute("aria-invalid") !== "true") return;
            const mensajeAnterior = configuracion.error.textContent;
            if (!validarCampo(campo) || msjFormulario.textContent !== mensajeAnterior) return;
            const pendiente = [...validaciones].find(([otro]) => otro.getAttribute("aria-invalid") === "true");
            mostrarMensaje(pendiente ? pendiente[1].error.textContent : "Campo corregido. Puedes revisar los datos antes de continuar.", pendiente ? "error" : "info");
        });
    }

    // --- 1. BOTÓN PUBLICAR ---
    if (btnPublicar) {
        btnPublicar.addEventListener("click", (e) => {
            e.preventDefault();
            if (estadoActual === "enviando") return;

            estadoActual = "validando";
            msjFormulario.className = "msj-dinamico";
            if (!validarCampo(inputTitulo)) {
                estadoActual = "error";
                mostrarMensaje(validaciones.get(inputTitulo).error.textContent, "error");
                inputTitulo.focus();
                return;
            }

            // Estado de envío simulado
            estadoActual = "enviando";
            btnPublicar.disabled = true;
            btnPublicar.textContent = "Procesando...";
            mostrarMensaje("Validación local completada. Simulando proceso de publicación (sin conexión real)...", "info");

            setTimeout(() => {
                estadoActual = "integracion_pendiente";
                btnPublicar.disabled = false;
                btnPublicar.textContent = "Publicar artículo";
                mostrarMensaje("El formulario está listo, pero la publicación real aún no se ha completado porque falta conectar el servicio de artículos.", "integracion_pendiente");
            }, 1500);
        });
    }

    // --- 2. BOTÓN GENERAR IA ---
    if (btnIA) {
        btnIA.addEventListener("click", () => {
            // Corregido punto 4: Tomar valores actuales del formulario
            iaTituloSug.value = inputTitulo.value;
            iaDescSug.value = inputDescripcion.value;
            actualizarErrorCampo(iaTituloSug);
            actualizarErrorCampo(iaDescSug);

            contenedorIA.style.display = "block";
            mostrarMensaje("Generación simulada: Esta es una demostración visual. La IA real se conectará en el futuro.", "info");
        });
    }

    // --- 3. ACEPTAR PROPUESTA IA ---
    if (btnAceptarIA) {
        btnAceptarIA.addEventListener("click", () => {
            // Validar ambos sin retornos tempranos: cada error es independiente.
            const tituloValido = validarCampo(iaTituloSug);
            const descripcionValida = validarCampo(iaDescSug);
            if (!tituloValido || !descripcionValida) {
                const primeroInvalido = !tituloValido ? iaTituloSug : iaDescSug;
                mostrarMensaje(validaciones.get(primeroInvalido).error.textContent, "error");
                primeroInvalido.focus();
                return;
            }

            // Aplicamos los valores
            inputTitulo.value = iaTituloSug.value;
            inputDescripcion.value = iaDescSug.value;
            validarCampo(inputTitulo);
            validarCampo(inputDescripcion);

            contenedorIA.style.display = "none";
            // Conservar errores ajenos y el estado general de envío; aceptar no publica.
            const otrosErrores = document.querySelector(".publish-form-area .input-error, .publish-form-area [aria-invalid='true']");
            let mensaje = "Sugerencia aceptada (Simulación). Los textos editados se han aplicado al formulario.";
            if (otrosErrores) mensaje += " Revisa los otros campos marcados.";
            if (estadoActual === "enviando") mensaje = "Simulando proceso de publicación (sin conexión real)... " + mensaje;
            mostrarMensaje(mensaje, otrosErrores ? "error" : "info");
            inputTitulo.focus();
        });
    }

    // --- 4. DESCARTAR PROPUESTA IA ---
    if (btnDescartarIA) {
        btnDescartarIA.addEventListener("click", () => {
            contenedorIA.style.display = "none";
            actualizarErrorCampo(iaTituloSug);
            actualizarErrorCampo(iaDescSug);
            mostrarMensaje("Propuesta descartada. El formulario conserva sus datos originales.", "info");
            btnIA.focus();
        });
    }
});
