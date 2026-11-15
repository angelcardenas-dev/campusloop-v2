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

    let estadoActual = "inicial";

    function mostrarMensaje(texto, tipo) {
        msjFormulario.className = "msj-dinamico";
        msjFormulario.textContent = texto;
        
        if (tipo === "error") {
            msjFormulario.classList.add("is-error");
        } else if (tipo === "integracion_pendiente" || tipo === "info") {
            msjFormulario.classList.add("is-info");
        }
    }

    // --- 1. BOTÓN PUBLICAR ---
    if (btnPublicar) {
        btnPublicar.addEventListener("click", (e) => {
            e.preventDefault();
            if (estadoActual === "enviando") return;

            estadoActual = "validando";
            msjFormulario.className = "msj-dinamico";
            inputTitulo.classList.remove("input-error");
            inputTitulo.setAttribute("aria-invalid", "false");

            if (!inputTitulo.value.trim()) {
                estadoActual = "error";
                msjFormulario.classList.add("is-error");
                inputTitulo.classList.add("input-error");
                inputTitulo.setAttribute("aria-invalid", "true");
                msjFormulario.textContent = "Por favor, ingresa un título para tu artículo.";
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
            
            contenedorIA.style.display = "block";
            mostrarMensaje("Generación simulada: Esta es una demostración visual. La IA real se conectará en el futuro.", "info");
        });
    }

    // --- 3. ACEPTAR PROPUESTA IA ---
    if (btnAceptarIA) {
        btnAceptarIA.addEventListener("click", () => {
            // Marcar y enfocar el campo de sugerencia vacío
            if (!iaTituloSug.value.trim()) {
                iaTituloSug.classList.add("input-error");
                iaTituloSug.focus();
                mostrarMensaje("El título de la sugerencia está vacío. Edítalo o descarta la propuesta.", "error");
                return;
            }
            if (!iaDescSug.value.trim()) {
                iaDescSug.classList.add("input-error");
                iaDescSug.focus();
                mostrarMensaje("La descripción de la sugerencia está vacía. Edítala o descarta la propuesta.", "error");
                return;
            }

            // Limpiamos errores visuales
            iaTituloSug.classList.remove("input-error");
            iaDescSug.classList.remove("input-error");

            // Aplicamos los valores
            inputTitulo.value = iaTituloSug.value;
            inputDescripcion.value = iaDescSug.value;
            
            contenedorIA.style.display = "none";
            // No modificamos el estado de validación del formulario principal
            mostrarMensaje("Sugerencia aceptada (Simulación). Los textos editados se han aplicado al formulario.", "info");
        });
    }

    // --- 4. DESCARTAR PROPUESTA IA ---
    if (btnDescartarIA) {
        btnDescartarIA.addEventListener("click", () => {
            contenedorIA.style.display = "none";
            iaTituloSug.classList.remove("input-error");
            iaDescSug.classList.remove("input-error");
            mostrarMensaje("Propuesta descartada. El formulario conserva sus datos originales.", "info");
        });
    }
});