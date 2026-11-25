import { crearOrquestadorHerramientas, validarArgumentosHerramienta } from '../../js/agente-herramientas.js';
import { crearVerificadorAuth } from './lib/agente-auth.mjs';
import { crearProveedorNvidia, validarMensajeProveedor } from './lib/agente-nvidia.mjs';
import { DEFINICIONES_HERRAMIENTAS, INSTRUCCIONES_AGENTE } from './lib/agente-instrucciones.mjs';
import { contienePatronesPrivados, esperarConCancelacion, leerCuerpo, proyectarArticulos, respuesta, resultado, validarSolicitud } from './lib/agente-seguridad.mjs';

const bearer = value => /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(value ?? '')?.[1] ?? null;
const responseError = (code, solicitudId = null) => respuesta(code, solicitudId);

export function crearHandlerAgente({ env = process.env, verificarUsuario, reservarCuota,
  proveedor, crearServiciosAutorizados, fetchImpl = globalThis.fetch, timeoutMs = 15000,
  origenPermitido = env.AGENTE_ORIGEN_PERMITIDO,
} = {}) {
  const verify = verificarUsuario ?? crearVerificadorAuth({ env, fetchImpl });
  const model = proveedor ?? crearProveedorNvidia({ env, fetchImpl });
  return async function handler(request) {
    if (request.signal.aborted) return responseError('CANCELADO');
    if (request.method !== 'POST') return responseError('METODO');
    if (request.headers.get('content-type')?.toLowerCase() !== 'application/json'
      && !/^application\/json\s*;\s*charset=utf-8$/i.test(request.headers.get('content-type') ?? '')) return responseError('TIPO');
    if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') return responseError('TIPO');
    if (!origenPermitido) return responseError('CERRADO');
    if (request.headers.get('origin') !== origenPermitido) return responseError('ORIGEN');
    // No hay cuota transaccional aprobada/instalada en esta base: no abrir el proveedor,
    // incluso si alguien cambia IA_HABILITADA accidentalmente.
    if (env.IA_HABILITADA !== 'true' || typeof reservarCuota !== 'function'
      || typeof crearServiciosAutorizados !== 'function'
      || typeof verify !== 'function' || !model || typeof model.completar !== 'function') return responseError('CERRADO');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) return responseError('CERRADO');
    const token = bearer(request.headers.get('authorization'));
    if (!token) return responseError('NO_AUTH');
    const controller = new AbortController(); let tools = null;
    const detener = () => { controller.abort(); tools?.desmontar(); };
    const relay = () => detener(); request.signal.addEventListener('abort', relay, { once: true });
    if (request.signal.aborted) detener();
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; detener(); }, timeoutMs);
    const codigoInterrupcion = () => timeout ? 'TIEMPO' : 'CANCELADO';
    let solicitudId = null;
    try {
      let raw;
      try { raw = await leerCuerpo(request, 8192, controller.signal); }
      catch (error) {
        if (controller.signal.aborted) return responseError(timeout ? 'TIEMPO' : 'CANCELADO');
        return responseError(error.message === 'BODY_LIMIT' ? 'GRANDE' : 'INVALIDO');
      }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return responseError('INVALIDO'); }
      const solicitud = validarSolicitud(parsed); if (!solicitud) return responseError('INVALIDO');
      solicitudId = solicitud.solicitudId;
      // El historial aportado por navegador no acredita clasificaciÃ³n de privacidad.
      if (solicitud.contexto.length) return responseError('INVALIDO', solicitudId);
      if (contienePatronesPrivados([solicitud.mensaje, ...solicitud.contexto.map(x => x.content)].join('\n'))) return responseError('INVALIDO', solicitudId);
      if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
      let identity;
      try { identity = await esperarConCancelacion(verify({ token, signal: controller.signal }), controller.signal); }
      catch (error) { return responseError(controller.signal.aborted ? codigoInterrupcion()
        : error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO' : 'CERRADO', solicitudId); }
      if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
      if (!identity?.ok || typeof identity.actor !== 'string') return responseError(
        ['CONFIGURACION', 'AUTH_NO_DISPONIBLE'].includes(identity?.codigo) ? 'CERRADO' : 'NO_AUTH', solicitudId);
      let quota;
      try { quota = await esperarConCancelacion(reservarCuota({ actor: identity.actor, solicitudId, signal: controller.signal }), controller.signal); }
      catch (error) { return responseError(controller.signal.aborted ? codigoInterrupcion()
        : error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO' : error?.codigo === 'CANCELADO' ? 'CANCELADO' : 'CERRADO', solicitudId); }
      if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
      if (typeof quota?.permitida !== 'boolean' || quota.error) return responseError('CERRADO', solicitudId);
      if (!quota.permitida) return responseError('LIMITE', solicitudId);

      let serviciosSolicitud;
      try { serviciosSolicitud = await esperarConCancelacion(
        crearServiciosAutorizados({ actor: identity.actor, token, signal: controller.signal }), controller.signal); }
      catch (error) { return responseError(controller.signal.aborted ? codigoInterrupcion()
        : error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO' : 'CERRADO', solicitudId); }
      if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
      if (!serviciosSolicitud || typeof serviciosSolicitud !== 'object' || Array.isArray(serviciosSolicitud)) return responseError('CERRADO', solicitudId);

      const identityProvider = async () => {
        if (controller.signal.aborted) return { ok: false, datos: null, error: { codigo: 'CANCELADA' } };
        const current = await verify({ token, signal: controller.signal });
        return current?.ok && current.actor === identity.actor
          ? { ok: true, datos: { id: current.actor }, error: null }
          : { ok: false, datos: null, error: { codigo: 'NO_AUTORIZADO' } };
      };
      tools = crearOrquestadorHerramientas({ obtenerIdentidad: identityProvider, servicios: serviciosSolicitud,
        categoriasPermitidas: serviciosSolicitud.categoriasPermitidas ?? [],
        universidadesPermitidas: serviciosSolicitud.universidadesPermitidas ?? [],
        campusPermitidos: serviciosSolicitud.campusPermitidos ?? [], timeoutMs: Math.min(timeoutMs, 15000) });
      const enabledNames = ['buscar_articulos', 'consultar_mis_reservas', 'preparar_borrador_publicacion']
        .filter(name => name === 'buscar_articulos' ? typeof serviciosSolicitud.consultarCatalogo === 'function'
          : name === 'consultar_mis_reservas' ? typeof serviciosSolicitud.consultarMisReservas === 'function'
            : typeof serviciosSolicitud.consultarEstadoVendedor === 'function');
      const toolDefs = DEFINICIONES_HERRAMIENTAS.filter(t => enabledNames.includes(t.function.name));
      const messages = [{ role: 'system', content: INSTRUCCIONES_AGENTE },
        { role: 'user', content: solicitud.mensaje }];
      let herramientasEjecutadas = 0;
      for (let ciclo = 0; ciclo < 3; ciclo++) {
        if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
        if (Buffer.byteLength(JSON.stringify(messages)) > 32768) return responseError('GRANDE', solicitudId);
        let completion;
        try { completion = await esperarConCancelacion(model.completar({ mensajes: messages, herramientas: toolDefs,
          signal: controller.signal }), controller.signal); }
        catch (error) { return responseError(controller.signal.aborted ? codigoInterrupcion()
          : error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO' : 'ERROR', solicitudId); }
        if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
        if (!completion || typeof completion !== 'object' || Array.isArray(completion)
          || Object.keys(completion).sort().join(',') !== (completion.ok === true ? 'mensaje,ok' : 'codigo,ok')) return responseError('ERROR', solicitudId);
        if (!completion?.ok) {
          if (completion?.codigo === 'TIEMPO_AGOTADO') return responseError('TIEMPO', solicitudId);
          if (completion?.codigo === 'CANCELADO') return responseError(controller.signal.aborted ? codigoInterrupcion() : 'ERROR', solicitudId);
          if (completion?.codigo === 'LIMITE') return responseError('LIMITE', solicitudId);
          if (completion?.codigo === 'PROVEEDOR_NO_DISPONIBLE') return responseError('CERRADO', solicitudId);
          return responseError('ERROR', solicitudId);
        }
        const limpio = validarMensajeProveedor(completion.mensaje);
        if (!limpio) return responseError('ERROR', solicitudId);
        const calls = limpio.tool_calls;
        if (!calls.length) {
          return resultado({ tipo: 'mensaje', mensaje: limpio.content }, solicitudId);
        }
        if (ciclo === 2 || calls.length > 3 || herramientasEjecutadas + calls.length > 3) return responseError('ERROR', solicitudId);
        const lote = [];
        for (const call of calls) {
          const name = call?.function?.name; const idCall = call?.id;
          if (!enabledNames.includes(name)) return responseError('INVALIDO', solicitudId);
          let args;
          try { args = JSON.parse(call.function.arguments); } catch { return responseError('INVALIDO', solicitudId); }
          const validado = validarArgumentosHerramienta(name, args, {
            categoriasPermitidas: serviciosSolicitud.categoriasPermitidas ?? [],
            universidadesPermitidas: serviciosSolicitud.universidadesPermitidas ?? [],
            campusPermitidos: serviciosSolicitud.campusPermitidos ?? [],
          });
          if (!validado.ok || JSON.stringify(validado.datos).includes(identity.actor)
            || JSON.stringify(validado.datos).includes(token)
            || ['busqueda', 'titulo', 'descripcion'].some(campo =>
              typeof validado.datos[campo] === 'string' && contienePatronesPrivados(validado.datos[campo]))) {
            return responseError('INVALIDO', solicitudId);
          }
          lote.push({ name, idCall, args: validado.datos });
        }
        const respuestasCatalogo = [];
        for (const { name, idCall, args } of lote) {
          herramientasEjecutadas++;
          const result = await esperarConCancelacion(tools.ejecutar(name, args), controller.signal);
          if (controller.signal.aborted) return responseError(codigoInterrupcion(), solicitudId);
          if (!result.ok) return responseError(result.error?.codigo === 'NO_AUTORIZADO' ? 'NO_AUTH'
            : result.error?.codigo === 'TIEMPO_AGOTADO' ? 'TIEMPO'
              : result.error?.codigo === 'CANCELADA' ? 'CANCELADO'
                : result.error?.codigo === 'INTEGRACION_PENDIENTE' ? 'CERRADO' : 'ERROR', solicitudId);
          // Resultados privados nunca se adjuntan a messages ni se reenvían a NVIDIA.
          if (name === 'consultar_mis_reservas' || name === 'preparar_borrador_publicacion') {
            return resultado({ tipo: name === 'consultar_mis_reservas' ? 'resultado_titular' : 'borrador_revisable',
              datos: result.datos }, solicitudId);
          }
          const safe = proyectarArticulos(result.datos.articulos);
          if (!safe) return responseError('ERROR', solicitudId);
          respuestasCatalogo.push({ tool_call_id: idCall, role: 'tool', content: JSON.stringify(safe) });
        }
        // Títulos del catálogo son contenido no confiable, etiquetado como datos.
        messages.push({ role: 'assistant', content: '', tool_calls: lote.map(({ name, idCall, args }) => ({
          id: idCall, type: 'function', function: { name, arguments: JSON.stringify(args) },
        })) });
        messages.push(...respuestasCatalogo);
      }
      return responseError('ERROR', solicitudId);
    } catch {
      return responseError(controller.signal.aborted ? codigoInterrupcion() : 'ERROR', solicitudId);
    } finally { clearTimeout(timer); request.signal.removeEventListener('abort', relay); tools?.desmontar(); }
  };
}

// La función desplegada permanece cerrada: faltan cuotas atómicas y servicios verificados.
export default async function agente(request) { return crearHandlerAgente()(request); }
