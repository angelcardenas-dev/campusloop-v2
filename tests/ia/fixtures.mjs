// Datos exclusivamente sintéticos. No son cuentas, modelos o credenciales reales.
export const ID_SOLICITUD = 'f5aec7a4-4346-4130-9e06-945f37aa4d84';
export const OTRO_ID = 'f44d2736-428c-458d-8ee2-c7896cdc2f13';
export const ID_USUARIO = '3f926c15-550b-42b9-8aa0-b08279954bcb';
export const TOKEN = 'SESION_SIMULADA_OFFLINE';
export const CLAVE = 'CLAVE_PROVEEDOR_SIMULADA';
export const ORIGEN = 'https://campusloop.example.invalid';
export const plano = valor => JSON.parse(JSON.stringify(valor));
export const pausa = () => new Promise(resolve => setImmediate(resolve));
export function diferida() {
  let resolver;
  const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}
export function articulo() {
  return { tituloActual: 'Calculadora Casio FX-991EX', descripcionActual: '',
    categoriaId: null, condicion: 'Usada', caracteristicas: ['Operativa', 'Incluye tapa'] };
}
export function solicitud() {
  return { schemaVersion: 1, solicitudId: ID_SOLICITUD, revisionFormulario: 1,
    operacion: 'proponer_publicacion', articulo: articulo() };
}
export function cuerpoHttp() {
  const { revisionFormulario, ...cuerpo } = solicitud();
  return cuerpo;
}
export function sugerencias() {
  return { titulo: 'Calculadora Casio FX-991EX', descripcion: 'Usada\nOperativa\nIncluye tapa' };
}
export function entorno() {
  return { IA_HABILITADA: 'true', IA_ORIGEN_PERMITIDO: ORIGEN,
    NVIDIA_API_KEY: CLAVE, NVIDIA_MODEL: 'fixture/modelo-inexistente',
    NVIDIA_MODELOS_APROBADOS: 'fixture/modelo-inexistente' };
}
export function json(valor, status = 200) {
  return new Response(JSON.stringify(valor), { status, headers: { 'Content-Type': 'application/json' } });
}
export function respuestaProveedor(valor = sugerencias()) {
  return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valor), reasoning_content: 'RAZONAMIENTO_NO_PUBLICAR' } }], usage: { total_tokens: 100 } });
}
export function request(cuerpo = cuerpoHttp(), opciones = {}) {
  const headers = { Origin: ORIGEN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...opciones.headers };
  const method = opciones.method ?? 'POST';
  return new Request(`${ORIGEN}/api/asistente`, { method, headers, signal: opciones.signal,
    ...(!['GET', 'HEAD'].includes(method) ? { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } : {}) });
}
