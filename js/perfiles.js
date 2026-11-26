import { obtenerClienteSupabase } from './supabase-cliente.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLUMNAS = 'id,nombre_visible,campus_id,vendedor_activado,creado_en,actualizado_en,version';
const MENSAJES = {
  VALIDACION: 'Revisa el nombre y la selección de universidad y campus.',
  NO_AUTORIZADO: 'Inicia sesión con una cuenta registrada para continuar.',
  CORREO_PENDIENTE: 'Confirma tu correo antes de guardar el perfil.',
  NO_ENCONTRADO: 'No encontramos tu perfil.',
  CONFLICTO: 'Tu perfil cambió. Vuelve a consultarlo antes de guardar.',
  RED: 'No pudimos conectar con el servicio de perfiles.',
  LIMITE: 'Espera antes de volver a consultar el servicio de perfiles.',
  SERVIDOR: 'No pudimos completar la operación de perfil.',
};
const fallo = codigo => ({ ok: false, datos: null, error: { codigo, mensaje: MENSAJES[codigo] } });
const esId = valor => typeof valor === 'string' && UUID.test(valor);
const versionValida = valor => Number.isInteger(valor) && valor > 0 && valor <= 2147483647;

function errorPerfil(error, status = error?.status) {
  if (status === 401 || status === 403 || error?.code === '42501'
    || ['AuthSessionMissingError', 'AuthInvalidJwtError'].includes(error?.name)) return fallo('NO_AUTORIZADO');
  if (error?.code === 'PT404') return fallo('NO_ENCONTRADO');
  if (error?.code === 'PT409') return fallo('CONFLICTO');
  if (['22023', '22P02'].includes(error?.code)) return fallo('VALIDACION');
  if (status === 429) return fallo('LIMITE');
  if (status === 0 || error?.name === 'AuthRetryableFetchError') return fallo('RED');
  return fallo('SERVIDOR');
}

async function conPerfil(operacion, { guardar = false, actorEsperado } = {}) {
  try {
    const cliente = await obtenerClienteSupabase();
    if (!cliente.ok) return cliente;
    const { data, error } = await cliente.datos.auth.getUser();
    if (error) return errorPerfil(error);
    const usuario = data?.user;
    if (!esId(usuario?.id) || usuario.is_anonymous !== false) return fallo('NO_AUTORIZADO');
    if (guardar && usuario.id.toLowerCase() !== actorEsperado.toLowerCase()) return fallo('NO_AUTORIZADO');
    if (guardar && !usuario.email_confirmed_at) return fallo('CORREO_PENDIENTE');

    const respuesta = await operacion(cliente.datos, usuario.id);
    if (respuesta.error) return errorPerfil(respuesta.error, respuesta.status);
    const fila = respuesta.data;
    if (fila === null) return fallo(guardar ? 'SERVIDOR' : 'NO_ENCONTRADO');
    if (fila?.id !== usuario.id || !versionValida(fila.version)
      || (fila.nombre_visible !== null && typeof fila.nombre_visible !== 'string')
      || (fila.campus_id !== null && !esId(fila.campus_id))
      || typeof fila.vendedor_activado !== 'boolean'
      || typeof fila.creado_en !== 'string' || typeof fila.actualizado_en !== 'string') return fallo('SERVIDOR');

    const datos = {
      id: fila.id,
      nombreVisible: fila.nombre_visible,
      campusId: fila.campus_id,
      vendedorActivado: fila.vendedor_activado,
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
      version: fila.version,
    };
    if (!guardar) datos.completo = datos.nombreVisible !== null && datos.campusId !== null;
    return { ok: true, datos, error: null };
  } catch (error) {
    return errorPerfil(error);
  }
}

export function consultarMiPerfil() {
  return conPerfil((cliente, id) => cliente.from('perfiles').select(COLUMNAS).eq('id', id).maybeSingle());
}

export async function actualizarMiPerfil(entrada, opciones = {}) {
  const actorEsperado = opciones?.actorEsperado;
  if (!esId(actorEsperado)) return fallo('NO_AUTORIZADO');
  const { nombreVisible, universidadId, campusId, versionEsperada } = entrada ?? {};
  const nombre = typeof nombreVisible === 'string' ? nombreVisible.trim() : '';
  if ([...nombre].length < 2 || [...nombre].length > 100 || /[\u0000-\u001f\u007f-\u009f<>]/u.test(nombreVisible)
    || !esId(universidadId) || !esId(campusId) || !versionValida(versionEsperada)) return fallo('VALIDACION');

  return conPerfil(cliente => cliente.rpc('actualizar_mi_perfil', {
    p_nombre_visible: nombre,
    p_universidad_id: universidadId,
    p_campus_id: campusId,
    p_version_esperada: versionEsperada,
    p_actor_esperado: actorEsperado,
  }).single(), { guardar: true, actorEsperado });
}
