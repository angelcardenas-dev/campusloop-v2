import { obtenerClienteSupabase } from './supabase-cliente.js';
import { consultarMensajes } from './mensajeria.js';
import { obtenerUsuarioActual } from './auth.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fallo = codigo => ({ ok: false, datos: null, error: { codigo,
  mensaje: codigo === 'NO_AUTORIZADO' ? 'La sesión no puede consultar esta conversación.'
    : 'No pudimos mantener la conversación actualizada.' } });

// Realtime es solo una señal. Las filas que llegan a la UI proceden siempre de consultas con RLS.
export async function suscribirMensajes(conversacionId, { actorEsperado, cursor = null,
  alRecibir, alError = () => {}, obtenerCliente = obtenerClienteSupabase,
  obtenerIdentidad = obtenerUsuarioActual, consultar = consultarMensajes, intervaloMs = 15000 } = {}) {
  if (typeof conversacionId !== 'string' || !UUID.test(conversacionId)
    || typeof actorEsperado !== 'string' || !UUID.test(actorEsperado)
    || typeof alRecibir !== 'function' || typeof alError !== 'function'
    || !Number.isInteger(intervaloMs) || intervaloMs < 1000) return fallo('VALIDACION');
  let sdk, canal, suscripcion, temporizador, activo = true, ocupado = false, repetir = false;
  let posicion = cursor, turno = 0, sesionEsperada = null, verificandoAuth = false;
  const conocidos = new Set();
  const pendiente = new AbortController();
  const desmontar = () => {
    if (!activo) return;
    activo = false; turno++; pendiente.abort();
    clearInterval(temporizador);
    suscripcion?.data?.subscription?.unsubscribe();
    if (canal) void sdk.removeChannel(canal).catch(() => {});
  };
  const cerrar = codigo => { if (activo) { desmontar(); alError(codigo); } };
  const identidad = async () => {
    try {
      const r = await obtenerIdentidad({ verificarSesionMemoria: true });
      return r?.ok && typeof r.datos?.id === 'string' && typeof r.datos?.sesionId === 'string'
        ? { id: r.datos.id.toLowerCase(), sesionId: r.datos.sesionId.toLowerCase() } : null;
    } catch { return false; }
  };
  const identidadVigente = async () => {
    const actual = await identidad();
    return actual && actual.id === actorEsperado.toLowerCase() && actual.sesionId === sesionEsperada;
  };
  const reconciliar = async () => {
    if (!activo) return;
    if (ocupado) { repetir = true; return; }
    ocupado = true;
    const actual = turno;
    try {
      do {
        repetir = false;
        if (!await identidadVigente() || !activo || actual !== turno) { cerrar('NO_AUTORIZADO'); return; }
        let cursorPagina = posicion;
        for (let pagina = 0; pagina < 100; pagina++) {
          const r = await consultar(conversacionId, { limite: 50, cursor: cursorPagina,
            posteriores: !!cursorPagina, signal: pendiente.signal });
          if (!activo || actual !== turno) return;
          if (!r?.ok || !Array.isArray(r.datos)) { alError('SERVIDOR'); break; }
          if (!await identidadVigente() || !activo || actual !== turno) { cerrar('NO_AUTORIZADO'); return; }
          const nuevos = r.datos.filter(m => m && typeof m.id === 'string' && !conocidos.has(m.id));
          for (const m of nuevos) conocidos.add(m.id);
          if (nuevos.length) alRecibir(nuevos);
          if (!r.datos.length) break;
          const ultimo = r.datos.at(-1);
          if (!ultimo?.id || !ultimo?.creadoEn || !Number.isSafeInteger(ultimo.posicion)
            || ultimo.posicion === cursorPagina?.posicion) break;
          posicion = { id: ultimo.id, creadoEn: ultimo.creadoEn, posicion: ultimo.posicion };
          cursorPagina = posicion;
          if (r.datos.length < 50) break;
        }
      } while (repetir && activo);
    } catch { if (activo) alError('RED'); }
    finally { ocupado = false; }
  };
  try {
    const r = await obtenerCliente();
    if (!r?.ok) return fallo('SERVIDOR');
    sdk = r.datos;
    const inicial = await identidad();
    if (!inicial || inicial.id !== actorEsperado.toLowerCase()) return fallo('NO_AUTORIZADO');
    sesionEsperada = inicial.sesionId;
    const { data, error } = await sdk.from('conversaciones')
      .select('id,comprador_id,vendedor_id').eq('id', conversacionId).maybeSingle();
    if (error || data?.id !== conversacionId.toLowerCase()
      || ![data.comprador_id, data.vendedor_id].includes(actorEsperado.toLowerCase())
      || !await identidadVigente()) return fallo('NO_AUTORIZADO');
    suscripcion = sdk.auth.onAuthStateChange?.((evento, sesion) => {
      if (evento === 'SIGNED_OUT') { cerrar('NO_AUTORIZADO'); return; }
      if (evento === 'SIGNED_IN' && sesion?.user?.id
        && sesion.user.id.toLowerCase() !== actorEsperado.toLowerCase()) { cerrar('NO_AUTORIZADO'); return; }
      if (['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(evento) && !verificandoAuth) {
        verificandoAuth = true;
        queueMicrotask(async () => {
          try {
            if (!activo) return;
            const actual = await identidad();
            if (!activo) return;
            if (!actual || actual.id !== actorEsperado.toLowerCase() || actual.sesionId !== sesionEsperada) {
              cerrar('NO_AUTORIZADO'); return;
            }
            void reconciliar();
          } finally { verificandoAuth = false; }
        });
      }
    });
    if (!activo) { suscripcion?.data?.subscription?.unsubscribe(); return fallo('NO_AUTORIZADO'); }
    canal = sdk.channel('tb4-mensajes-' + conversacionId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: 'conversacion_id=eq.' + conversacionId }, () => { void reconciliar(); })
      .subscribe(estado => {
        if (!activo) return;
        if (estado === 'SUBSCRIBED') void reconciliar();
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) alError('RED');
      });
    temporizador = setInterval(() => { void reconciliar(); }, intervaloMs);
    void reconciliar();
    return { ok: true, datos: { desmontar }, error: null };
  } catch {
    desmontar();
    return fallo('SERVIDOR');
  }
}
