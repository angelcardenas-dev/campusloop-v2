import { obtenerEstadoAuth, obtenerUsuarioActual } from '../../js/auth.js';

// Arnés de pruebas, no callback de producción. Derivado del flujo de bb882f4.
// No abre enlaces, canjea códigos manualmente, navega ni escribe almacenamiento.
const PARAMETROS_AUTH = ['code', 'error', 'error_code', 'error_description'];
const resultado = (estado, mensaje) => ({ estado, mensaje });

export function crearPruebaRetorno({ leerUrl, reemplazarUrl }) {
  let procesamiento;

  function limpiarUrl() {
    const url = new URL(leerUrl());
    for (const clave of PARAMETROS_AUTH) url.searchParams.delete(clave);
    const fragmento = new URLSearchParams(url.hash.slice(1));
    if (PARAMETROS_AUTH.some(clave => fragmento.has(clave))) {
      for (const clave of PARAMETROS_AUTH) fragmento.delete(clave);
      url.hash = fragmento.toString();
    }
    // Solo ruta local; conservar parámetros ajenos al retorno y no guardar state.
    reemplazarUrl(url.pathname + url.search + url.hash);
  }

  async function procesar() {
    const url = new URL(leerUrl());
    const fragmento = new URLSearchParams(url.hash.slice(1));
    if (PARAMETROS_AUTH.slice(1).some(clave => url.searchParams.has(clave) || fragmento.has(clave))) {
      limpiarUrl();
      return resultado('ERROR_CONFIRMACION', 'El proveedor comunicó un error de confirmación. No se intentó un canje; sus detalles se ocultan.');
    }
    if (!url.searchParams.get('code')) {
      return resultado('SIN_RETORNO', 'No se detectó código PKCE. Esto no crea ni demuestra una sesión nueva.');
    }

    // getSession espera la inicialización del SDK: él realiza el único canje.
    // Si no se pudo inicializar/comprobar, no borrar anticipadamente el código.
    let estado;
    try { estado = await obtenerEstadoAuth(); } catch { /* Estado indeterminado. */ }
    if (!estado?.ok) {
      return resultado('INICIALIZACION_NO_VERIFICADA', 'No se pudo comprobar el retorno. No se deduce el estado del correo ni se repite el canje.');
    }
    limpiarUrl();

    let usuario;
    try { usuario = await obtenerUsuarioActual(); } catch { /* Verificación independiente del canje. */ }
    if (!usuario?.ok) {
      return resultado('VERIFICACION_PENDIENTE', 'El SDK terminó su inicialización, pero no se pudo verificar el usuario. Este fallo no determina el estado de confirmación del correo.');
    }
    if (estado.datos?.estado === 'AUTENTICADO' && usuario.datos?.id
      && usuario.datos.id === estado.datos.usuario?.id) {
      return resultado('SESION_VERIFICADA', 'Hay una sesión verificada; puede ser previa. Esto no acredita por sí solo una confirmación nueva.');
    }
    return resultado('SIN_SESION_VERIFICADA', 'No se verificó una sesión para el retorno. No se puede deducir el estado de confirmación del correo.');
  }

  // Una instancia por retorno: llamadas concurrentes o posteriores no lo repiten.
  return { procesar: () => (procesamiento ??= procesar()) };
}
