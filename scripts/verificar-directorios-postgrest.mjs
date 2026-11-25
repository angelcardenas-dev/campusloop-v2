import assert from 'node:assert/strict';

const origen = 'https://xxatvftmozlpqehhvgpv.supabase.co';
const clave = process.env.TB4_PUBLISHABLE_KEY;
if (!/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(clave ?? '')) {
  throw new Error('Configura TB4_PUBLISHABLE_KEY con la clave publicable del proyecto.');
}

const upc = '486a935d-f0f9-4437-891e-62bc48bde10a';
const monterrico = '82d7186a-920c-49e2-bcc5-9aaa03ad655e';

async function solicitar(tabla, parametros, metodo = 'GET', dato) {
  const url = new URL(`/rest/v1/${tabla}`, origen);
  url.search = new URLSearchParams(parametros).toString();
  const respuesta = await fetch(url, {
    method: metodo,
    headers: { apikey: clave, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: dato === undefined ? undefined : JSON.stringify(dato),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  return { status: respuesta.status, datos: await respuesta.json().catch(() => null) };
}

async function filas(tabla, parametros) {
  const { status, datos } = await solicitar(tabla, parametros);
  assert.equal(status, 200, `${tabla}: lectura de visitante`);
  assert.ok(Array.isArray(datos), `${tabla}: respuesta esperada como lista`);
  return datos;
}

async function verificarDenegacion(tabla, parametros, metodo, dato) {
  const { status, datos } = await solicitar(tabla, parametros, metodo, dato);
  assert.ok([401, 403].includes(status) && datos?.code === '42501',
    `${metodo} ${tabla}: se esperaba denegación 42501, estado recibido ${status}`);
}

const universidades = await filas('universidades', { select: 'id,nombre,sigla', order: 'nombre.asc,id.asc' });
assert.ok(universidades.some(fila => fila.id === upc && fila.sigla === 'UPC'), 'UPC debe estar visible para el ensayo.');

const campus = await filas('campus', {
  select: 'id,universidad_id,nombre,distrito,ciudad', universidad_id: `eq.${upc}`, order: 'nombre.asc,id.asc',
});
assert.ok(campus.every(fila => fila.universidad_id === upc), 'El filtro debe devolver solo campus de UPC.');
assert.ok(campus.some(fila => fila.id === monterrico && fila.nombre === 'Monterrico'
  && fila.distrito === 'Santiago de Surco' && fila.ciudad === 'Lima'), 'Monterrico debe tener la ubicación aprobada.');

const categorias = await filas('categorias', { select: 'id,nombre,descripcion,orden', order: 'orden.asc,nombre.asc,id.asc' });
assert.ok(categorias.some(fila => fila.id === '7065c00d-bfe8-4460-ae0c-6978fd7107d9'), 'Académico debe estar visible para el ensayo.');
console.log('OK directorios sin sesión');

for (const tabla of ['articulos', 'perfiles', 'reservas', 'conversaciones', 'mensajes']) {
  await verificarDenegacion(tabla, { select: 'id', limit: '1' }, 'GET');
}

// id es PK NOT NULL. Si los permisos cambian por error, el filtro no afecta filas.
await verificarDenegacion('universidades', { id: 'is.null' }, 'PATCH', { nombre: 'Verificación de permisos' });
console.log('OK lectura privada y escritura anónima denegadas');
