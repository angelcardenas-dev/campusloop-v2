import { consultarUniversidades, consultarCampus, consultarCategorias } from '../js/directorios.js';
import { obtenerClienteSupabase } from '../js/supabase-cliente.js';

const universidades = [
  { id: '5a5623f3-6f07-4f15-97b8-2061cd5c61b3', nombre: 'Pontificia Universidad Católica del Perú', sigla: 'PUCP' },
  { id: '486a935d-f0f9-4437-891e-62bc48bde10a', nombre: 'Universidad Peruana de Ciencias Aplicadas', sigla: 'UPC' },
  { id: '035d83f5-bf9d-4032-90e2-abd7a2172159', nombre: 'Universidad Nacional Mayor de San Marcos', sigla: 'UNMSM' },
  { id: '6ab6b6a8-0f6b-4149-8036-30a56eba20ba', nombre: 'Universidad de Lima', sigla: 'ULIMA' },
];
const campus = [
  ['6fc0d006-f5ec-4936-ab83-a15ef417c648', 'San Miguel', 'San Miguel'],
  ['82d7186a-920c-49e2-bcc5-9aaa03ad655e', 'Monterrico', 'Santiago de Surco'],
  ['105fb795-dc41-4f56-8dce-baa386d3b021', 'Campus Central', 'Lima (Cercado de Lima)'],
  ['8214f236-d4ba-4b94-bcfe-bb029136a5cd', 'Surco', 'Santiago de Surco'],
];
const categorias = [
  { id: '7065c00d-bfe8-4460-ae0c-6978fd7107d9', nombre: 'Académico', descripcion: 'Materiales y artículos de estudio', orden: 1 },
  { id: 'cfc40a13-ce57-4532-969c-e21bd6737216', nombre: 'Tecnológico', descripcion: 'Equipos y accesorios tecnológicos', orden: 2 },
  { id: '27193cb6-fcc8-49f4-9992-0adcc2ec1b25', nombre: 'Entretenimiento', descripcion: 'Artículos de ocio y entretenimiento', orden: 3 },
];

class FalloIntegracion extends Error {}

function mismosCampos(valor, esperado) {
  return valor && Object.keys(valor).length === Object.keys(esperado).length
    && Object.entries(esperado).every(([clave, dato]) => Object.hasOwn(valor, clave) && valor[clave] === dato);
}

function verificarLista(resultado, esperada, nombre) {
  if (!mismosCampos(resultado, { ok: true, datos: resultado?.datos, error: null })
    || !Array.isArray(resultado.datos) || resultado.datos.length !== esperada.length
    || !esperada.every(fila => resultado.datos.some(dto => mismosCampos(dto, fila)))) {
    throw new FalloIntegracion(`La respuesta de ${nombre} difiere del manifiesto o del DTO esperado.`);
  }
}

async function verificarSinSesion(cliente) {
  const { data, error } = await cliente.auth.getSession();
  if (error || data?.session !== null) throw new FalloIntegracion('No se pudo confirmar una sesión vacía.');
}

async function ejecutar() {
  const cliente = await obtenerClienteSupabase();
  if (!cliente.ok) throw new FalloIntegracion('No se pudo inicializar el cliente compartido. Revisa configuración y acceso al CDN.');
  await verificarSinSesion(cliente.datos);
  verificarLista(await consultarUniversidades(), universidades, 'universidades');
  for (const [indice, { id: universidadId, sigla }] of universidades.entries()) {
    const [id, nombre, distrito] = campus[indice];
    verificarLista(await consultarCampus(universidadId), [{ id, universidadId, nombre, distrito, ciudad: 'Lima' }], `campus de ${sigla}`);
  }
  verificarLista(await consultarCategorias(), categorias, 'categorías');
  verificarLista(await consultarCampus(crypto.randomUUID()), [], 'campus de universidad inexistente');
  const invalido = await consultarCampus('uuid-invalido');
  if (!mismosCampos(invalido, { ok: false, datos: null, error: invalido?.error })
    || invalido.error?.codigo !== 'VALIDACION'
    || typeof invalido.error.mensaje !== 'string' || !invalido.error.mensaje) {
    throw new FalloIntegracion('El UUID inválido debía devolver VALIDACION.');
  }
  await verificarSinSesion(cliente.datos);
}

const resultado = document.querySelector('#resultado');
let estado = 'fallo';
try {
  await ejecutar();
  resultado.textContent = 'OK: cuatro universidades, cuatro campus, tres categorías y casos vacío e inválido, sin sesión.';
  estado = 'ok';
} catch (error) {
  resultado.textContent = error instanceof FalloIntegracion ? error.message : 'Falló la prueba de integración.';
}
await fetch(location.pathname + '/' + estado, { method: 'POST' });
