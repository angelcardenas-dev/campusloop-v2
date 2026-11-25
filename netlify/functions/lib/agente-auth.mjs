const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function leerUsuarioAcotado(response, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) {
    void response.body?.cancel().catch(() => {}); return null;
  }
  const reader = response.body?.getReader(); if (!reader) return null;
  const chunks = []; let size = 0;
  const cancelar = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancelar, { once: true });
  try {
    while (true) {
      const part = signal ? await esperarConCancelacion(reader.read(), signal) : await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { void reader.cancel().catch(() => {}); return null; }
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch { return null; }
  finally {
    signal?.removeEventListener('abort', cancelar);
    if (!signal?.aborted) reader.releaseLock();
  }
}

function esperarConCancelacion(promesa, signal) {
  return new Promise((resolve, reject) => {
    let finalizada = false;
    const limpiar = () => signal.removeEventListener('abort', cancelar);
    const terminar = (fn, valor) => { if (finalizada) return; finalizada = true; limpiar(); fn(valor); };
    const cancelar = () => terminar(reject, Object.assign(new Error('cancelada'), { codigo: 'CANCELADO' }));
    signal.addEventListener('abort', cancelar, { once: true });
    Promise.resolve(promesa).then(v => terminar(resolve, v), () => terminar(reject, Object.assign(new Error('auth'), { codigo: 'AUTH_NO_DISPONIBLE' })));
    if (signal.aborted) cancelar();
  });
}

// Verifica el token con Auth remoto. No decodifica JWT ni usa service_role.
export function crearVerificadorAuth({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async ({ token, signal }) => {
    if (signal?.aborted) return { ok: false, codigo: 'CANCELADO' };
    const base = env.SUPABASE_URL;
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    if (typeof base !== 'string' || typeof key !== 'string' || typeof fetchImpl !== 'function') {
      return { ok: false, codigo: 'CONFIGURACION' };
    }
    let url;
    try {
      url = new URL(base);
      if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
        return { ok: false, codigo: 'CONFIGURACION' };
      }
    } catch { return { ok: false, codigo: 'CONFIGURACION' }; }
    let response;
    try {
      if (signal?.aborted) return { ok: false, codigo: 'CANCELADO' };
      response = await fetchImpl(`${url.origin}/auth/v1/user`, { method: 'GET', redirect: 'error',
        headers: { apikey: key, authorization: `Bearer ${token}`, accept: 'application/json' }, signal });
    } catch { return { ok: false, codigo: 'AUTH_NO_DISPONIBLE' }; }
    if (response.status === 401 || response.status === 403) return { ok: false, codigo: 'NO_AUTORIZADO' };
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      void response.body?.cancel().catch(() => {}); return { ok: false, codigo: 'AUTH_NO_DISPONIBLE' };
    }
    const user = await leerUsuarioAcotado(response, signal);
    if (!user) return { ok: false, codigo: 'AUTH_NO_DISPONIBLE' };
    if (!user || typeof user.id !== 'string' || !UUID.test(user.id) || user.is_anonymous !== false) {
      return { ok: false, codigo: 'NO_AUTORIZADO' };
    }
    return { ok: true, actor: user.id.toLowerCase() };
  };
}
