const RUTA = '/api/agente';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENSAJES = Object.freeze({
  VALIDACION: 'Revisa el mensaje antes de enviarlo.', NO_AUTORIZADO: 'Inicia sesión para usar el agente.',
  CANCELADA: 'La solicitud fue cancelada.',
  SOLICITUD_CANCELADA: 'La solicitud fue cancelada.',
  LIMITE: 'Se alcanzó el límite de uso.', TIEMPO_AGOTADO: 'El agente tardó demasiado.',
  AGENTE_DESHABILITADO: 'El agente todavía no está habilitado.',
  RED: 'No pudimos conectar con el agente.', SERVIDOR: 'El agente no pudo completar la solicitud.',
});
const ESTADOS_ERROR = Object.freeze({ METODO_NO_PERMITIDO: 405, TIPO_NO_PERMITIDO: 415,
  CUERPO_GRANDE: 413, VALIDACION: 400, SOLICITUD_CANCELADA: 408, NO_AUTORIZADO: 401,
  ORIGEN_NO_PERMITIDO: 403, LIMITE: 429, TIEMPO_AGOTADO: 504,
  AGENTE_DESHABILITADO: 503, SERVIDOR: 502 });
const fallo = codigo => ({ ok: false, datos: null, error: { codigo: Object.hasOwn(MENSAJES, codigo) ? codigo : 'SERVIDOR',
  mensaje: Object.hasOwn(MENSAJES, codigo) ? MENSAJES[codigo] : MENSAJES.SERVIDOR } });
const objetoExacto = (v, claves) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === claves.length && claves.every(k => Object.hasOwn(v, k));
function esperarConCancelacion(promesa, signal) {
  return new Promise((resolve, reject) => {
    let finalizada = false;
    const limpiar = () => signal.removeEventListener('abort', cancelar);
    const terminar = (fn, valor) => { if (finalizada) return; finalizada = true; limpiar(); fn(valor); };
    const cancelar = () => terminar(reject, Object.assign(new Error('cancelada'), { codigo: 'CANCELADA' }));
    signal.addEventListener('abort', cancelar, { once: true });
    Promise.resolve(promesa).then(v => terminar(resolve, v), () => terminar(reject, Object.assign(new Error('fallo'), { codigo: 'DEPENDENCIA' })));
    if (signal.aborted) cancelar();
  });
}
async function leerJsonAcotado(response, signal) {
  const longitud = response.headers?.get('content-length');
  if (longitud !== null && longitud !== undefined && (!/^\d+$/.test(longitud) || Number(longitud) > 32768)) return null;
  const reader = response.body?.getReader(); if (!reader) return null;
  let bytes = 0; const partes = [];
  const cancelar = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancelar, { once: true });
  try {
    while (true) {
      const parte = await esperarConCancelacion(reader.read(), signal);
      if (parte.done) break;
      bytes += parte.value.byteLength;
      if (bytes > 32768) { void reader.cancel().catch(() => {}); return null; }
      partes.push(parte.value.slice());
    }
    const contenido = new Uint8Array(bytes); let offset = 0;
    for (const parte of partes) { contenido.set(parte, offset); offset += parte.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contenido));
  } catch { return null; }
  finally {
    signal.removeEventListener('abort', cancelar);
    if (!signal.aborted) reader.releaseLock();
  }
}
const UUID_VALIDO = valor => typeof valor === 'string' && UUID.test(valor);
export function validarResultado(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return false;
  if (datos.tipo === 'mensaje') return Object.keys(datos).sort().join(',') === 'mensaje,tipo'
    && typeof datos.mensaje === 'string' && datos.mensaje.trim().length > 0 && datos.mensaje.length <= 4000;
  if (datos.tipo === 'resultado_titular') {
    const privado = datos.datos;
    if (Object.keys(datos).sort().join(',') !== 'datos,tipo' || !objetoExacto(privado, ['destino', 'reservas'])
      || privado.destino !== 'titular' || !Array.isArray(privado.reservas) || privado.reservas.length > 24) return false;
    const ids = new Set();
    return Array.from({ length: privado.reservas.length }, (_, i) => {
      const reserva = privado.reservas[i];
      if (!Object.hasOwn(privado.reservas, i) || !objetoExacto(reserva, ['id', 'estado']) || !UUID_VALIDO(reserva.id)
        || !['pendiente', 'confirmada', 'cancelada', 'completada'].includes(reserva.estado)) return false;
      const id = reserva.id.toLowerCase(); if (ids.has(id)) return false; ids.add(id); return true;
    }).every(Boolean);
  }
  if (datos.tipo === 'borrador_revisable') {
    const d = datos.datos;
    return Object.keys(datos).sort().join(',') === 'datos,tipo' && objetoExacto(d, ['tipo', 'borrador', 'requiereRevisionHumana'])
      && d.tipo === 'borrador_publicacion' && d.requiereRevisionHumana === true
      && objetoExacto(d.borrador, ['titulo', 'descripcion'])
      && typeof d.borrador.titulo === 'string' && d.borrador.titulo.trim().length > 0 && Array.from(d.borrador.titulo).length <= 100
      && typeof d.borrador.descripcion === 'string' && d.borrador.descripcion.trim().length > 0 && Array.from(d.borrador.descripcion).length <= 1000;
  }
  return false;
}

export function crearClienteAgente({ obtenerToken, fetchImpl = (...args) => globalThis.fetch(...args),
  ruta = RUTA, timeoutMs = 20000 } = {}) {
  let secuencia = 0; let activa = null;
  return Object.freeze({ async solicitar({ mensaje, contexto = [], solicitudId, signal } = {}) {
    if (typeof mensaje !== 'string' || !mensaje.trim() || Array.from(mensaje).length > 2000
      || !Array.isArray(contexto) || contexto.length !== 0 || typeof obtenerToken !== 'function'
      || typeof fetchImpl !== 'function' || ruta !== RUTA || !Number.isSafeInteger(timeoutMs)
      || timeoutMs < 1 || timeoutMs > 30000) return fallo('VALIDACION');
    const idSolicitud = solicitudId ?? (globalThis.crypto?.randomUUID?.() ?? '');
    if (!UUID.test(idSolicitud)) return fallo('VALIDACION');
    for (const item of contexto) if (!objetoExacto(item, ['role', 'content'])
      || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string'
      || !item.content.trim() || Array.from(item.content).length > 2000) return fallo('VALIDACION');
    if (signal?.aborted) return fallo('CANCELADA');
    const actual = ++secuencia; activa?.abort();
    const controller = new AbortController(); activa = controller; let vencido = false; let fase = 'token';
    const cancelar = () => controller.abort(); signal?.addEventListener('abort', cancelar, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => { vencido = true; controller.abort(); }, timeoutMs);
    try {
      if (controller.signal.aborted) return fallo('CANCELADA');
      const token = await esperarConCancelacion(obtenerToken({ signal: controller.signal }), controller.signal);
      if (controller.signal.aborted) return fallo(vencido ? 'TIEMPO_AGOTADO' : 'CANCELADA');
      if (typeof token !== 'string' || !token.trim() || token.length > 8192) return fallo('NO_AUTORIZADO');
      fase = 'fetch';
      const response = await esperarConCancelacion(fetchImpl(ruta, { method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ schemaVersion: 1, solicitudId: idSolicitud, mensaje, contexto }) }), controller.signal);
      if (actual !== secuencia) return fallo('CANCELADA');
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers?.get('content-type') ?? '')) return fallo('SERVIDOR');
      fase = 'respuesta';
      const body = await leerJsonAcotado(response, controller.signal);
      if (controller.signal.aborted) return fallo(vencido ? 'TIEMPO_AGOTADO' : 'CANCELADA');
      if (actual !== secuencia) return fallo('CANCELADA');
      if (!body) return fallo('SERVIDOR');
      if (!objetoExacto(body, ['ok', 'datos', 'error', 'solicitudId'])) return fallo('SERVIDOR');
      if (response.ok === true && body.ok === true && body.error === null && body.solicitudId === idSolicitud
        && validarResultado(body.datos)) {
        return { ok: true, datos: body.datos, error: null };
      }
      if (body.ok === false && body.datos === null && body.error && typeof body.error.codigo === 'string'
        && ESTADOS_ERROR[body.error.codigo] === response.status
        && (body.solicitudId === null || body.solicitudId === idSolicitud)) return fallo(body.error.codigo);
      return fallo('SERVIDOR');
    } catch {
      if (vencido) return fallo('TIEMPO_AGOTADO');
      if (actual !== secuencia || signal?.aborted || controller.signal.aborted) return fallo('CANCELADA');
      return fallo(fase === 'token' ? 'NO_AUTORIZADO' : 'RED');
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancelar);
      if (activa === controller) activa = null;
    }
  }, cancelarPendientes() { secuencia++; activa?.abort(); activa = null; } });
}
