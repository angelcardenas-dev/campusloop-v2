const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_TEXTO = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
export const CODIGOS = Object.freeze({
  METODO: [405, 'METODO_NO_PERMITIDO'], TIPO: [415, 'TIPO_NO_PERMITIDO'],
  GRANDE: [413, 'CUERPO_GRANDE'], INVALIDO: [400, 'VALIDACION'],
  CANCELADO: [408, 'SOLICITUD_CANCELADA'],
  NO_AUTH: [401, 'NO_AUTORIZADO'], ORIGEN: [403, 'ORIGEN_NO_PERMITIDO'],
  LIMITE: [429, 'LIMITE'], TIEMPO: [504, 'TIEMPO_AGOTADO'],
  CERRADO: [503, 'AGENTE_DESHABILITADO'], ERROR: [502, 'SERVIDOR'],
});
export const MENSAJES = Object.freeze({
  METODO_NO_PERMITIDO: 'Usa POST para enviar una solicitud.',
  TIPO_NO_PERMITIDO: 'El formato de solicitud no es compatible.',
  CUERPO_GRANDE: 'La solicitud excede el tamaño permitido.',
  VALIDACION: 'La solicitud no cumple el formato esperado.',
  SOLICITUD_CANCELADA: 'La solicitud fue cancelada.',
  NO_AUTORIZADO: 'Inicia sesión para usar el agente.',
  ORIGEN_NO_PERMITIDO: 'El origen de la solicitud no está autorizado.',
  LIMITE: 'Se alcanzó el límite de uso.',
  TIEMPO_AGOTADO: 'El agente tardó demasiado en responder.',
  AGENTE_DESHABILITADO: 'El agente todavía no está habilitado.',
  SERVIDOR: 'El agente no pudo completar la solicitud.',
});
export const respuesta = (codigo, solicitudId = null) => {
  const [status, code] = CODIGOS[codigo] ?? CODIGOS.ERROR;
  return new Response(JSON.stringify({ ok: false, datos: null,
    error: { codigo: code, mensaje: MENSAJES[code] }, solicitudId }), {
    status, headers: { 'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0', pragma: 'no-cache', vary: 'Origin',
      'x-content-type-options': 'nosniff', ...(status === 405 ? { allow: 'POST' } : {}) },
  });
};
export const resultado = (datos, solicitudId) => new Response(JSON.stringify({
  ok: true, datos, error: null, solicitudId,
}), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0', pragma: 'no-cache', vary: 'Origin', 'x-content-type-options': 'nosniff' } });

// Defensa contra patrones evidentes; no prueba que texto libre esté anonimizado.
export function contienePatronesPrivados(texto) {
  return typeof texto !== 'string'
    || /[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/|\bwww\.|\b(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,})|\b(?:contraseña|contrasena|password|token|tarjeta bancaria)\s*[:=]/i.test(texto)
    || UUID_TEXTO.test(texto) || /(?:\+\d[\d\s().-]{7,}\d|\b9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b)/.test(texto);
}

export function validarSolicitud(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).sort().join(',') !== 'contexto,mensaje,schemaVersion,solicitudId'
    || value.schemaVersion !== 1 || typeof value.solicitudId !== 'string' || !UUID.test(value.solicitudId)
    || typeof value.mensaje !== 'string' || value.mensaje.trim().length < 1
    || Array.from(value.mensaje).length > 2000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value.mensaje)
    || !Array.isArray(value.contexto) || value.contexto.length > 8) return null;
  const contexto = [];
  for (const turn of value.contexto) {
    if (!turn || Object.getPrototypeOf(turn) !== Object.prototype
      || Object.keys(turn).sort().join(',') !== 'content,role'
      || !['user', 'assistant'].includes(turn.role) || typeof turn.content !== 'string'
      || !turn.content.trim() || Array.from(turn.content).length > 2000
      || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(turn.content)) return null;
    contexto.push({ role: turn.role, content: turn.content });
  }
  // Texto libre permanece no confiable. No admitir roles/instrucciones del cliente.
  return { solicitudId: value.solicitudId, mensaje: value.mensaje, contexto };
}

export async function leerCuerpo(request, maxBytes = 8192, signal) {
  const rawLength = request.headers.get('content-length');
  if (rawLength !== null && (!/^\d+$/.test(rawLength) || Number(rawLength) > maxBytes)) throw new Error('BODY_LIMIT');
  if (!request.body) throw new Error('BODY_INVALID');
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  const cancelar = () => { void reader.cancel().catch(() => {}); };
  if (signal?.aborted) { cancelar(); throw Object.assign(new Error('BODY_ABORTED'), { codigo: 'CANCELADO' }); }
  signal?.addEventListener('abort', cancelar, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      if (signal?.aborted) throw Object.assign(new Error('BODY_ABORTED'), { codigo: 'CANCELADO' });
      size += value.byteLength; if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new Error('BODY_LIMIT'); }
      chunks.push(value);
    }
    if (signal?.aborted) throw Object.assign(new Error('BODY_ABORTED'), { codigo: 'CANCELADO' });
  } finally { signal?.removeEventListener('abort', cancelar); reader.releaseLock(); }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks.map(x => Buffer.from(x))));
}

// Proyección mínima de artículo consultable por cuenta autorizada; no acepta metadatos, URLs ni campos privados.
export function proyectarArticulos(value) {
  if (!Array.isArray(value) || value.length > 24) return null;
  const salida = []; const ids = new Set();
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i)) return null;
    const item = value[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || typeof item.id !== 'string' || !UUID.test(item.id)
      || typeof item.titulo !== 'string' || item.titulo.length > 100 || contienePatronesPrivados(item.titulo)
      || !Number.isSafeInteger(item.precioCentimos) || item.precioCentimos < 0
      || item.moneda !== 'PEN' || !['disponible', 'reservado', 'vendido'].includes(item.estado)) return null;
    const canonicalId = item.id.toLowerCase(); if (ids.has(canonicalId)) return null; ids.add(canonicalId);
    salida.push({ id: item.id, titulo: item.titulo, precioCentimos: item.precioCentimos,
      moneda: 'PEN', estado: item.estado });
  }
  return salida;
}

// Termina la espera aunque una dependencia inyectada ignore AbortSignal.
// El rechazo/resolución tardíos siguen conectados a handlers y no quedan unhandled.
export function esperarConCancelacion(promesa, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const limpiar = () => signal.removeEventListener('abort', cancelar);
    const finish = (fn, value) => { if (settled) return; settled = true; limpiar(); fn(value); };
    const cancelar = () => finish(reject, Object.assign(new Error('cancelled'), { codigo: 'CANCELADO' }));
    signal.addEventListener('abort', cancelar, { once: true });
    Promise.resolve(promesa).then(value => finish(resolve, value), error => finish(reject,
      { codigo: ['CANCELADO', 'CANCELADA', 'TIEMPO_AGOTADO'].includes(error?.codigo) ? error.codigo : 'DEPENDENCIA' }));
    if (signal.aborted) cancelar();
  });
}
