import { obtenerClienteSupabase } from './supabase-cliente.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAMPOS = 'id,articulo_id,comprador_id,vendedor_id,conversacion_id,estado,lugar_publico_id,lugar_personalizado_nombre,lugar_referencia_publica,punto_propuesto_por,estado_punto,creado_en,actualizado_en,version,motivo_cierre,confirmada_compra_en,confirmada_venta_en';
const MENSAJES = {
  VALIDACION: 'Revisa los datos de la reserva.',
  NO_AUTORIZADO: 'Inicia sesión con una cuenta registrada.',
  NO_ENCONTRADO: 'No encontramos el recurso solicitado.',
  CONFLICTO: 'El artículo cambió o ya no está disponible. Vuelve a consultarlo.',
  RED: 'No pudimos conectar con el servicio de reservas.',
  LIMITE: 'Espera antes de intentarlo de nuevo.',
  SERVIDOR: 'No pudimos completar la operación de reserva.',
};

const esId = valor => typeof valor === 'string' && UUID.test(valor);
const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: MENSAJES[codigo] } });
const exito = datos => ({ ok: true, datos, error: null });

function errorReserva(error, status = error?.status) {
  if (status === 401 || status === 403 || error?.code === '42501'
    || error?.name === 'AuthSessionMissingError') return fallo('NO_AUTORIZADO');
  if (status === 404 || error?.code === 'PT404') return fallo('NO_ENCONTRADO');
  if (status === 409 || error?.code === 'PT409') return fallo('CONFLICTO');
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
    if (error) return errorReserva(error);
    const usuario = data?.user;
    if (!esId(usuario?.id) || usuario.is_anonymous !== false) return fallo('NO_AUTORIZADO');
    return await operacion(sdk.datos, usuario.id);
  } catch (error) {
    return errorReserva(error);
  }
}

export async function crearMiReserva({ articuloId, versionArticulo } = {}) {
  if (!esId(articuloId) || !Number.isInteger(versionArticulo)
    || versionArticulo < 1 || versionArticulo > 2147483647) return fallo('VALIDACION');
  return conCuenta(async (sdk, actor) => {
    const { data, error, status } = await sdk.rpc('crear_mi_reserva', {
      p_articulo_id: articuloId, p_version_articulo: versionArticulo, p_actor_esperado: actor,
    });
    if (error) return errorReserva(error, status);
    if (!esId(data?.id) || data.compradorId !== actor || data.articuloId !== articuloId.toLowerCase()
      || !esId(data.vendedorId) || data.vendedorId === actor || data.estado !== 'pendiente' || data.version !== 1) {
      return fallo('SERVIDOR');
    }
    const { id, vendedorId, estado, creadoEn, actualizadoEn, version } = data;
    return exito({ id, articuloId: data.articuloId, compradorId: actor, vendedorId, estado, creadoEn, actualizadoEn, version });
  });
}

export function consultarMisReservas({ signal } = {}) {
  return conCuenta(async (sdk, actor) => {
    let consulta = sdk.from('reservas').select(CAMPOS).or('comprador_id.eq.' + actor + ',vendedor_id.eq.' + actor)
      .order('creado_en', { ascending: false }).order('id').limit(50);
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error, status } = await consulta;
    if (error) return errorReserva(error, status);
    if (!Array.isArray(data) || data.some(fila => !esId(fila?.id) || (fila.comprador_id !== actor && fila.vendedor_id !== actor))) {
      return fallo('SERVIDOR');
    }
    return exito(data.map(fila => ({
      id: fila.id, articuloId: fila.articulo_id, compradorId: fila.comprador_id, vendedorId: fila.vendedor_id,
      conversacionId: fila.conversacion_id, estado: fila.estado, version: fila.version,
      creadoEn: fila.creado_en, actualizadoEn: fila.actualizado_en,
      motivoCierre: fila.motivo_cierre, confirmadaCompraEn: fila.confirmada_compra_en, confirmadaVentaEn: fila.confirmada_venta_en,
      puntoEncuentro: { lugarId: fila.lugar_publico_id, nombre: fila.lugar_personalizado_nombre,
        referencia: fila.lugar_referencia_publica, propuestoPor: fila.punto_propuesto_por, estado: fila.estado_punto },
    })));
  });
}

export async function gestionarMiReserva({ id, versionEsperada, accion } = {}, { actorEsperado } = {}) {
  if (!esId(actorEsperado)) return fallo('NO_AUTORIZADO');
  if (!esId(id) || !Number.isInteger(versionEsperada) || versionEsperada < 1 || versionEsperada > 2147483647
    || !['confirmar', 'rechazar', 'cancelar', 'confirmar_intercambio'].includes(accion)) return fallo('VALIDACION');
  return conCuenta(async (sdk, actor) => {
    if (actor !== actorEsperado) return fallo('NO_AUTORIZADO');
    const { data, error, status } = await sdk.rpc('gestionar_mi_reserva', {
      p_id: id, p_version: versionEsperada, p_accion: accion, p_actor_esperado: actorEsperado,
    });
    if (error) return errorReserva(error, status);
    return data?.id === id.toLowerCase() && [data.compradorId, data.vendedorId].includes(actor)
      ? exito(data) : fallo('SERVIDOR');
  });
}

export async function calificarMiIntercambio({ reservaId, estrellas, comentario = null } = {}, { actorEsperado } = {}) {
  if (!esId(actorEsperado)) return fallo('NO_AUTORIZADO');
  if (!esId(reservaId) || !Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5
    || (comentario !== null && (typeof comentario !== 'string' || [...comentario.trim()].length > 1000))) {
    return fallo('VALIDACION');
  }
  return conCuenta(async (sdk, actor) => {
    if (actor !== actorEsperado) return fallo('NO_AUTORIZADO');
    const { data, error, status } = await sdk.rpc('calificar_mi_intercambio', {
      p_reserva_id: reservaId, p_estrellas: estrellas, p_comentario: comentario, p_actor_esperado: actorEsperado,
    });
    if (error) return errorReserva(error, status);
    return data?.reservaId === reservaId.toLowerCase() && data.autorId === actor ? exito(data) : fallo('SERVIDOR');
  });
}
