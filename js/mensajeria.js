import { obtenerClienteSupabase } from './supabase-cliente.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const MENSAJES = {
  VALIDACION: 'Revisa los datos de la conversación o del mensaje.',
  NO_AUTORIZADO: 'Inicia sesión con una cuenta registrada.',
  NO_ENCONTRADO: 'No encontramos el recurso solicitado.',
  CONFLICTO: 'La operación entra en conflicto con un registro existente.',
  RED: 'No pudimos conectar con el servicio.',
  LIMITE: 'Espera antes de volver a intentarlo.',
  SERVIDOR: 'No pudimos completar la operación.',
};
const esId = valor => typeof valor === 'string' && UUID.test(valor);
const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: MENSAJES[codigo] } });
const exito = datos => ({ ok: true, datos, error: null });

function errorServicio(error, status = error?.status) {
  if (status === 401 || status === 403 || error?.code === '42501'
    || error?.name === 'AuthSessionMissingError') return fallo('NO_AUTORIZADO');
  if (status === 404 || error?.code === 'PT404') return fallo('NO_ENCONTRADO');
  if (status === 409 || ['PT409', '40001'].includes(error?.code)) return fallo('CONFLICTO');
  if (['22023', '22P02'].includes(error?.code)) return fallo('VALIDACION');
  if (status === 429) return fallo('LIMITE');
  if (status === 0 || error?.name === 'AuthRetryableFetchError') return fallo('RED');
  return fallo('SERVIDOR');
}

async function conCuenta(operacion) {
  try {
    const sdk = await obtenerClienteSupabase();
    if (!sdk.ok) return sdk;
    const { data, error } = await sdk.datos.auth.getUser();
    if (error) return errorServicio(error);
    const usuario = data?.user;
    if (!esId(usuario?.id) || usuario.is_anonymous !== false) return fallo('NO_AUTORIZADO');
    return await operacion(sdk.datos, usuario.id);
  } catch (error) {
    return errorServicio(error);
  }
}

async function ejecutarRPC(cliente, nombre, parametros, comprobar) {
  const { data, error, status } = await cliente.rpc(nombre, parametros);
  if (error) return errorServicio(error, status);
  return comprobar(data) ? exito(data) : fallo('SERVIDOR');
}

export async function iniciarMiConversacion(articuloId) {
  if (!esId(articuloId)) return fallo('VALIDACION');
  return conCuenta((cliente, actor) => ejecutarRPC(cliente, 'iniciar_mi_conversacion',
    { p_articulo_id: articuloId, p_actor_esperado: actor },
    fila => esId(fila?.id) && fila.articuloId === articuloId.toLowerCase() && fila.compradorId === actor
      && esId(fila.vendedorId) && fila.vendedorId !== actor));
}

export async function enviarMiMensaje({ conversacionId, mensajeId, texto } = {}) {
  const contenido = typeof texto === 'string' ? texto.trim() : '';
  if (!esId(conversacionId) || !esId(mensajeId) || !contenido || [...contenido].length > 1000 || contenido.includes('\0')) {
    return fallo('VALIDACION');
  }
  return conCuenta((cliente, actor) => ejecutarRPC(cliente, 'enviar_mi_mensaje', {
    p_conversacion_id: conversacionId, p_mensaje_id: mensajeId, p_texto: contenido, p_actor_esperado: actor,
  }, fila => fila?.id === mensajeId.toLowerCase() && fila.conversacionId === conversacionId.toLowerCase()
    && fila.remitenteId === actor && fila.texto === contenido));
}

function paginaValida(limite, cursor) {
  return Number.isInteger(limite) && limite >= 1 && limite <= 50 && (cursor == null
    || (esId(cursor.id) && typeof cursor.creadoEn === 'string' && FECHA.test(cursor.creadoEn)
      && Number.isFinite(Date.parse(cursor.creadoEn))));
}

async function leer(consulta, { cursor, limite, ascendente, signal }, convertir) {
  if (cursor) {
    const operador = ascendente ? 'gt' : 'lt';
    consulta = consulta.or('creado_en.' + operador + '.' + cursor.creadoEn
      + ',and(creado_en.eq.' + cursor.creadoEn + ',id.' + operador + '.' + cursor.id + ')');
  }
  consulta = consulta.order('creado_en', { ascending: ascendente }).order('id', { ascending: ascendente }).limit(limite);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error, status } = await consulta;
  if (error) return errorServicio(error, status);
  if (!Array.isArray(data)) return fallo('SERVIDOR');
  const filas = data.map(convertir);
  return filas.every(Boolean) ? exito(filas) : fallo('SERVIDOR');
}

export async function consultarMisConversaciones({ limite = 50, cursor, signal } = {}) {
  if (!paginaValida(limite, cursor)) return fallo('VALIDACION');
  return conCuenta((cliente, actor) => leer(
    cliente.from('conversaciones').select('id,articulo_id,comprador_id,vendedor_id,creado_en')
      .or('comprador_id.eq.' + actor + ',vendedor_id.eq.' + actor),
    { cursor, limite, ascendente: false, signal },
    fila => esId(fila?.id) && esId(fila.articulo_id) && esId(fila.comprador_id) && esId(fila.vendedor_id)
      && typeof fila.creado_en === 'string' && [fila.comprador_id, fila.vendedor_id].includes(actor) ? {
        id: fila.id, articuloId: fila.articulo_id, compradorId: fila.comprador_id, vendedorId: fila.vendedor_id, creadoEn: fila.creado_en,
      } : null,
  ));
}

export async function consultarMensajes(conversacionId, { limite = 50, cursor, signal } = {}) {
  if (!esId(conversacionId) || !paginaValida(limite, cursor)) return fallo('VALIDACION');
  return conCuenta((cliente, actor) => leer(
    cliente.from('mensajes').select('id,conversacion_id,remitente_id,texto,creado_en,conversaciones!inner(comprador_id,vendedor_id)')
      .eq('conversacion_id', conversacionId)
      .or('comprador_id.eq.' + actor + ',vendedor_id.eq.' + actor, { referencedTable: 'conversaciones' }),
    { cursor, limite, ascendente: true, signal },
    fila => esId(fila?.id) && fila.conversacion_id === conversacionId.toLowerCase() && esId(fila.remitente_id)
      && typeof fila.texto === 'string' && typeof fila.creado_en === 'string' ? {
        id: fila.id, conversacionId: fila.conversacion_id, remitenteId: fila.remitente_id, texto: fila.texto, creadoEn: fila.creado_en,
      } : null,
  ));
}
