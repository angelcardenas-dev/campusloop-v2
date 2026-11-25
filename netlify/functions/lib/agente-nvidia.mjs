const ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const modeloValido = valor => typeof valor === 'string' && /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]{1,160}$/.test(valor);
const objeto = valor => valor && typeof valor === 'object' && !Array.isArray(valor);
export function validarMensajeProveedor(mensaje, razon = null) {
  if (!objeto(mensaje) || typeof mensaje.content !== 'string' || mensaje.content.length > 4000) return null;
  const calls = mensaje.tool_calls ?? [];
  if (!Array.isArray(calls) || calls.length > 3) return null;
  if (razon === 'stop' && calls.length !== 0 || razon === 'tool_calls' && calls.length === 0) return null;
  if (!calls.length) return mensaje.content.trim() ? { content: mensaje.content, tool_calls: [] } : null;
  if (mensaje.content.trim()) return null;
  const ids = new Set(); const normalizadas = [];
  for (let i = 0; i < calls.length; i++) {
    if (!Object.hasOwn(calls, i)) return null;
    const call = calls[i];
    if (!objeto(call) || Object.keys(call).sort().join(',') !== 'function,id,type' || call.type !== 'function'
      || !objeto(call.function) || Object.keys(call.function).sort().join(',') !== 'arguments,name'
      || typeof call.function.name !== 'string' || typeof call.function.arguments !== 'string'
      || call.function.arguments.length > 8192 || typeof call.id !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(call.id) || ids.has(call.id)) return null;
    let argumentos;
    try { argumentos = JSON.parse(call.function.arguments); } catch { return null; }
    if (!objeto(argumentos)) return null;
    ids.add(call.id);
    normalizadas.push({ id: call.id, type: 'function', function: {
      name: call.function.name, arguments: JSON.stringify(argumentos),
    } });
  }
  return { content: '', tool_calls: normalizadas };
}
function esperarConCancelacion(promesa, signal) {
  return new Promise((resolve, reject) => {
    let finalizada = false;
    const limpiar = () => signal.removeEventListener('abort', cancelar);
    const terminar = (fn, valor) => { if (finalizada) return; finalizada = true; limpiar(); fn(valor); };
    const cancelar = () => terminar(reject, Object.assign(new Error('cancelada'), { codigo: 'CANCELADO' }));
    signal.addEventListener('abort', cancelar, { once: true });
    Promise.resolve(promesa).then(v => terminar(resolve, v), () => terminar(reject, Object.assign(new Error('proveedor'), { codigo: 'PROVEEDOR_ERROR' })));
    if (signal.aborted) cancelar();
  });
}

export function crearProveedorNvidia({ env = process.env, fetchImpl = globalThis.fetch,
  endpoint = ENDPOINT, timeoutMs = 12000,
} = {}) {
  return Object.freeze({
    async completar({ mensajes, herramientas = [], signal }) {
      if (signal?.aborted) return { ok: false, codigo: 'CANCELADO' };
      if (env.IA_HABILITADA !== 'true' || typeof env.NVIDIA_API_KEY !== 'string'
        || !env.NVIDIA_API_KEY.trim() || !modeloValido(env.NVIDIA_MODEL)
        || !env.NVIDIA_MODELOS_APROBADOS?.split(',').map(x => x.trim()).includes(env.NVIDIA_MODEL)
        || endpoint !== ENDPOINT || typeof fetchImpl !== 'function'
        || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) {
        return { ok: false, codigo: 'PROVEEDOR_NO_DISPONIBLE' };
      }
      const abort = new AbortController();
      const onAbort = () => abort.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) abort.abort();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        if (abort.signal.aborted) return { ok: false, codigo: 'CANCELADO' };
        const response = await esperarConCancelacion(fetchImpl(ENDPOINT, { method: 'POST', redirect: 'error', signal: abort.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${env.NVIDIA_API_KEY}` },
          body: JSON.stringify({ model: env.NVIDIA_MODEL, messages: mensajes, tools: herramientas,
            tool_choice: herramientas.length ? 'auto' : 'none', max_tokens: 700, stream: false }) }), abort.signal);
        if (response.status === 429) { void response.body?.cancel().catch(() => {}); return { ok: false, codigo: 'LIMITE' }; }
        if (!response.ok) { void response.body?.cancel().catch(() => {}); return { ok: false, codigo: 'PROVEEDOR_ERROR' }; }
        const type = response.headers.get('content-type') ?? '';
        if (!/^application\/json(?:\s*;|$)/i.test(type)) {
          void response.body?.cancel().catch(() => {}); return { ok: false, codigo: 'RESPUESTA_INVALIDA' };
        }
        const reader = response.body?.getReader(); if (!reader) return { ok: false, codigo: 'RESPUESTA_INVALIDA' };
        let size = 0; const chunks = [];
        const cancelarLectura = () => { void reader.cancel().catch(() => {}); };
        abort.signal.addEventListener('abort', cancelarLectura, { once: true });
        try {
          while (true) {
            const part = await esperarConCancelacion(reader.read(), abort.signal); if (part.done) break;
            size += part.value.byteLength;
            if (size > 32768) { void reader.cancel().catch(() => {}); return { ok: false, codigo: 'RESPUESTA_INVALIDA' }; }
            chunks.push(Buffer.from(part.value));
          }
        } finally {
          abort.signal.removeEventListener('abort', cancelarLectura);
          if (!abort.signal.aborted) reader.releaseLock();
        }
        let json;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return { ok: false, codigo: 'RESPUESTA_INVALIDA' }; }
        const choice = json?.choices;
        if (!Array.isArray(choice) || choice.length !== 1 || !Object.hasOwn(choice, 0)
          || !objeto(choice[0]) || !objeto(choice[0].message)
          || !['stop', 'tool_calls'].includes(choice[0].finish_reason)) return { ok: false, codigo: 'RESPUESTA_INVALIDA' };
        const message = choice[0].message;
        if (!Object.hasOwn(message, 'content')) return { ok: false, codigo: 'RESPUESTA_INVALIDA' };
        const normalizado = validarMensajeProveedor({ content: message.content ?? '', tool_calls: message.tool_calls }, choice[0].finish_reason);
        return normalizado ? { ok: true, mensaje: normalizado } : { ok: false, codigo: 'RESPUESTA_INVALIDA' };
      } catch {
        return { ok: false, codigo: signal?.aborted ? 'CANCELADO' : abort.signal.aborted ? 'TIEMPO_AGOTADO' : 'PROVEEDOR_ERROR' };
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
    },
  });
}

export const ENDPOINT_NVIDIA = ENDPOINT;
