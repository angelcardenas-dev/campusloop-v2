document.addEventListener("DOMContentLoaded", () => {
    console.log("Módulo de publicaciones cargado (modo demostración).");

    const btnPublicar = document.getElementById("btn-publicar");
    const btnIA = document.getElementById("btn-generar-ia");
    const inputTitulo = document.querySelector('.publish-card-single input[type="text"]');
    const msjFormulario = document.getElementById("mensaje-formulario");

    // Función auxiliar para mostrar el mensaje
    function mostrarMensaje(texto, tipo) {
        msjFormulario.className = "msj-dinamico"; // Limpia clases anteriores
        msjFormulario.textContent = texto;
    
        if (tipo === "error") {
            msjFormulario.classList.add("is-error");
            inputTitulo.classList.add("input-error");
        } else {
            msjFormulario.classList.add("is-exito");
            inputTitulo.classList.remove("input-error");
        }
    }

    // 1. VALIDACIÓN AL PUBLICAR
    if (btnPublicar) {
        btnPublicar.addEventListener("click", (e) => {
            e.preventDefault();
            msjFormulario.style.display = "none"; // Ocultamos mensaje previo

            if (!inputTitulo.value.trim()) {
                mostrarMensaje("Por favor, ingresa un título para tu artículo antes de publicar.", "error");
                inputTitulo.focus();
                return;
            }

            // Si todo está bien:
            mostrarMensaje("¡Validación exitosa! Redirigiendo...", "éxito");
            
            setTimeout(() => {
                window.location.href = "publicar-exito.html";
            }, 1500);
        });
    }

    // 2. BOTÓN DE IA
    if (btnIA) {
        btnIA.addEventListener("click", () => {
            mostrarMensaje("El asistente de IA estará disponible próximamente.", "error");
        });
    }
});