import { CONFIGURACION_PUBLICA, validarConfiguracionPublica } from './config-publica.js';

/* Datos */
// SDK oficial supabase-js, MIT. Distribución ES por esm.sh; versión fija.
// Origen/licencia y limitaciones: tests/auth/README.md.
export const VERSION_SDK_SUPABASE = '2.119.0';
export const URL_SDK_SUPABASE = 'https://esm.sh/@supabase/supabase-js@2.119.0?bundle&target=es2022';

/* Funciones */
async function cargarSdkOficial() {
  return import(URL_SDK_SUPABASE);
}

// Factoría para pruebas aisladas. Los consumidores de la aplicación deben usar
// obtenerClienteSupabase, nunca crear otro proveedor/cliente por formulario.
export function crearProveedorCliente({
  configuracion = CONFIGURACION_PUBLICA,
  cargarSdk = cargarSdkOficial,
} = {}) {
  let promesaCliente;

  return async function obtenerCliente() {
    const validacion = validarConfiguracionPublica(configuracion);
    if (!validacion.ok) return validacion;

    if (!promesaCliente) {
      promesaCliente = (async () => {
        let sdk;
        try {
          sdk = await cargarSdk();
        } catch {
          return {
            ok: false, datos: null,
            error: { codigo: 'RED', mensaje: 'No pudimos cargar el cliente de Supabase. Revisa la conexión e inténtalo de nuevo.' },
          };
        }

        try {
          if (typeof sdk?.createClient !== 'function') {
            return {
              ok: false, datos: null,
              error: { codigo: 'CONFIGURACION', mensaje: 'No se pudo inicializar el cliente de Supabase.' },
            };
          }
          const cliente = sdk.createClient(
            validacion.datos.supabaseUrl,
            validacion.datos.supabasePublishableKey,
            { auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              flowType: 'pkce',
              debug: false,
            } },
          );
          return { ok: true, datos: cliente, error: null };
        } catch {
          return {
            ok: false, datos: null,
            error: { codigo: 'CONFIGURACION', mensaje: 'No se pudo inicializar el cliente de Supabase.' },
          };
        }
      })();
    }

    const creacion = promesaCliente;
    const resultado = await creacion;
    // Permitir reintento explícito después de una carga fallida, sin bucles.
    if (!resultado.ok && promesaCliente === creacion) promesaCliente = undefined;
    return resultado;
  };
}

// El módulo ES se evalúa una sola vez por página; incluso llamadas concurrentes
// comparten la misma creación. Importar el archivo no descarga el SDK.
export const obtenerClienteSupabase = crearProveedorCliente();
