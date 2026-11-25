import { obtenerClienteSupabase } from './supabase-cliente.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const esId = valor => typeof valor === 'string' && UUID.test(valor);
const texto = valor => typeof valor === 'string' && valor.trim().length > 0;
const textoOpcional = valor => valor === null || texto(valor);

const fallo = (codigo, mensaje) => ({ ok: false, datos: null, error: { codigo, mensaje } });
const errorServidor = () => fallo('SERVIDOR', 'No se pudo consultar el directorio.');

function errorConsulta(status, error) {
  if (status === 401 || status === 403 || error?.code === '42501') {
    return fallo('NO_AUTORIZADO', 'El servidor denegó el acceso al directorio.');
  }
  if (status === 429) return fallo('LIMITE', 'Espera antes de volver a consultar el directorio.');
  if (status === 0 || error instanceof TypeError) {
    return fallo('RED', 'No se pudo conectar al directorio.');
  }
  return errorServidor();
}

async function consultar(crearConsulta, convertir) {
  try {
    const cliente = await obtenerClienteSupabase();
    if (!cliente.ok) return cliente;

    const { data, error, status } = await crearConsulta(cliente.datos);
    if (error) return errorConsulta(status, error);
    if (!Array.isArray(data)) return errorServidor();

    const datos = [];
    for (const fila of data) {
      const dto = esId(fila?.id) && texto(fila.nombre) ? convertir(fila) : null;
      if (!dto) return errorServidor();
      datos.push(dto);
    }
    return { ok: true, datos, error: null };
  } catch (error) {
    return errorConsulta(undefined, error);
  }
}

// RLS resuelve visibilidad. Las columnas activa y activo no están concedidas.
export function consultarUniversidades() {
  return consultar(
    cliente => cliente.from('universidades').select('id,nombre,sigla').order('nombre').order('id'),
    ({ id, nombre, sigla }) => texto(sigla) ? { id, nombre, sigla } : null,
  );
}

export async function consultarCampus(universidadId) {
  if (!esId(universidadId)) return fallo('VALIDACION', 'Selecciona una universidad válida.');
  const universidad = universidadId.toLowerCase();
  return consultar(
    cliente => cliente.from('campus').select('id,universidad_id,nombre,distrito,ciudad')
      .eq('universidad_id', universidad).order('nombre').order('id'),
    ({ id, universidad_id, nombre, distrito, ciudad }) =>
      universidad_id === universidad && textoOpcional(distrito) && textoOpcional(ciudad)
        ? { id, universidadId: universidad_id, nombre, distrito, ciudad } : null,
  );
}

export function consultarCategorias() {
  return consultar(
    cliente => cliente.from('categorias').select('id,nombre,descripcion,orden')
      .order('orden').order('nombre').order('id'),
    ({ id, nombre, descripcion, orden }) => textoOpcional(descripcion) && Number.isInteger(orden) && orden >= 0
      ? { id, nombre, descripcion, orden } : null,
  );
}
