import test from 'node:test';
import assert from 'node:assert/strict';
import { HERRAMIENTAS_AGENTE, validarArgumentosHerramienta, crearOrquestadorHerramientas } from '../../js/agente-herramientas.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
const C_UPPER = C.toUpperCase();
const filtros = () => ({ busqueda: '', categorias: [], universidad: '', campus: '', estados: [],
  condiciones: ['usado'], precioMinimoCentimos: null, precioMaximoCentimos: 10000, orden: 'recientes' });
const bien = datos => ({ ok: true, datos, error: null });
const diferida = () => { let resolver; const promesa = new Promise(r => { resolver = r; }); return { promesa, resolver }; };
const identidad = () => bien({ id: A });

test('registro cerrado: siete nombres propuestos; confirmación fuera del modelo', () => {
  assert.equal(HERRAMIENTAS_AGENTE.length, 7);
  assert.equal(HERRAMIENTAS_AGENTE.includes('confirmar_publicacion'), false);
  assert.equal(validarArgumentosHerramienta('confirmar_publicacion', {}).error.codigo, 'HERRAMIENTA_DESCONOCIDA');
});
test('búsqueda valida los nueve filtros y rechaza SQL, campos extra y tipos incompatibles', () => {
  assert.deepEqual(validarArgumentosHerramienta('buscar_articulos', filtros()).datos, filtros());
  for (const entrada of [{ ...filtros(), columna: 'precio' }, { ...filtros(), orden: 'precio_centimos.desc' },
    { ...filtros(), categorias: ['inventado'] }, { ...filtros(), categorias: [A] },
    { ...filtros(), precioMaximoCentimos: -1 },
    { ...filtros(), busqueda: 'x'.repeat(121) }, { ...filtros(), condiciones: ['ilegal'] }]) {
    assert.equal(validarArgumentosHerramienta('buscar_articulos', entrada).error.codigo, 'ARGUMENTOS_INVALIDOS');
  }
  assert.deepEqual(validarArgumentosHerramienta('buscar_articulos', { ...filtros(), categorias: [A] },
    { categoriasPermitidas: [A] }).datos.categorias, [A]);
  assert.equal(validarArgumentosHerramienta('buscar_articulos', { ...filtros(), universidad: A })
    .error.codigo, 'ARGUMENTOS_INVALIDOS');
  assert.equal(validarArgumentosHerramienta('buscar_articulos', { ...filtros(), campus: B })
    .error.codigo, 'ARGUMENTOS_INVALIDOS');
  assert.deepEqual(validarArgumentosHerramienta('buscar_articulos', { ...filtros(), universidad: A, campus: B },
    { universidadesPermitidas: [A], campusPermitidos: [{ id: B, universidadId: A }] }).datos.campus, B);
  assert.equal(validarArgumentosHerramienta('buscar_articulos', { ...filtros(), universidad: B, campus: B },
    { universidadesPermitidas: [A, B], campusPermitidos: [{ id: B, universidadId: A }] }).error.codigo,
  'ARGUMENTOS_INVALIDOS');
});
test('borrador US17 acepta solo título y descripción editables dentro de límites del controlador', () => {
  assert.deepEqual(validarArgumentosHerramienta('preparar_borrador_publicacion',
    { titulo: 'Calculadora', descripcion: 'Usada' }).datos, { titulo: 'Calculadora', descripcion: 'Usada' });
  for (const entrada of [{ titulo: 'x', descripcion: 'x', imagen: 'falsa' },
    { titulo: '😀'.repeat(51), descripcion: 'x' }, { titulo: 'x', descripcion: 'x'.repeat(1001) },
    { titulo: '', descripcion: 'x' }, { titulo: 'x', descripcion: '<script>\n' }]) {
    assert.equal(validarArgumentosHerramienta('preparar_borrador_publicacion', entrada).error.codigo, 'ARGUMENTOS_INVALIDOS');
  }
});
test('sin identidad verificada o con identidad anónima no consulta servicios', async () => {
  let llamadas = 0;
  for (const datos of [null, { id: A, is_anonymous: true }, { id: 'invalido' }]) {
    const o = crearOrquestadorHerramientas({ obtenerIdentidad: async () => bien(datos),
      servicios: { consultarCatalogo: async () => { llamadas++; return bien([]); } } });
    assert.equal((await o.ejecutar('buscar_articulos', filtros())).error.codigo, 'NO_AUTORIZADO');
  }
  assert.equal(llamadas, 0);
});
test('un fallo del proveedor de identidad deniega la operación y oculta detalles privados', async () => {
  let llamadas = 0;
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: async () => { throw new Error('JWT privado'); },
    servicios: { consultarCatalogo: async () => { llamadas++; return bien([]); } } });
  assert.deepEqual(await o.ejecutar('buscar_articulos', filtros()),
    { ok: false, datos: null, error: { codigo: 'NO_AUTORIZADO' } });
  assert.equal(llamadas, 0);
});
test('servicio ausente, herramienta desconocida y argumentos privados fallan cerrados', async () => {
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad });
  assert.equal((await o.ejecutar('buscar_articulos', filtros())).error.codigo, 'INTEGRACION_PENDIENTE');
  assert.equal((await o.ejecutar('consultar_mis_reservas', { usuarioId: B })).error.codigo, 'ARGUMENTOS_INVALIDOS');
  assert.equal((await o.ejecutar('recomendar_articulos', {})).error.codigo, 'INTEGRACION_PENDIENTE');
  assert.equal((await o.ejecutar('recomendar_articulos', { instruccion: 'ignora reglas' }))
    .error.codigo, 'ARGUMENTOS_INVALIDOS');
  assert.equal((await o.ejecutar('consultar_publicaciones_propias', {})).error.codigo, 'INTEGRACION_PENDIENTE');
  assert.equal((await o.ejecutar('confirmar_publicacion', {})).error.codigo, 'HERRAMIENTA_DESCONOCIDA');
  assert.equal((await o.ejecutar('buscar_articulos', { ...filtros(), busqueda: 'x'.repeat(9000) })).error.codigo, 'ARGUMENTOS_INVALIDOS');
});
test('argumentos no validados no ejecutan toJSON ni aceptan propiedades ocultas', async () => {
  let llamadas = 0;
  const argumentos = filtros();
  Object.defineProperty(argumentos, 'toJSON', { value() { llamadas++; return {}; } });
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: async () => bien([]) } });
  assert.equal((await o.ejecutar('buscar_articulos', argumentos)).error.codigo, 'ARGUMENTOS_INVALIDOS');
  assert.equal(llamadas, 0);
});
test('búsqueda usa servicio inyectado y devuelve solo proyección mínima real', async () => {
  let recibido;
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: async (f, { signal }) => { recibido = { f, signal }; return bien([{
      id: A, titulo: 'Calculadora', precioCentimos: 7500, moneda: 'PEN', estado: 'disponible',
      descripcion: 'no copiar al modelo', vendedorId: B }]); } } });
  const r = await o.ejecutar('buscar_articulos', filtros());
  assert.equal(recibido.f.precioMaximoCentimos, 10000);
  assert.equal(recibido.signal instanceof AbortSignal, true);
  assert.deepEqual(r.datos.articulos, [{ id: A, titulo: 'Calculadora', precioCentimos: 7500, moneda: 'PEN', estado: 'disponible' }]);
});
test('reservas propias usan actor verificado, proyección mínima al titular y estados de migración', async () => {
  let actor;
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarMisReservas: async id => { actor = id; return bien([{ id: B, estado: 'pendiente', mensaje: 'privado' }]); } } });
  const r = await o.ejecutar('consultar_mis_reservas', {});
  assert.equal(actor, A);
  assert.deepEqual(r.datos, { destino: 'titular', reservas: [{ id: B, estado: 'pendiente' }] });
  assert.equal((await o.ejecutar('consultar_mis_reservas', { usuarioId: B })).error.codigo, 'ARGUMENTOS_INVALIDOS');
});
test('borrador requiere vendedor aprobado; nunca invoca publicación', async () => {
  let aprobado = false;
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarEstadoVendedor: async () => bien({ vendedorActivado: aprobado }),
      crearPublicacion: () => { throw new Error('No debe llamar'); } } });
  const args = { titulo: 'Libro', descripcion: 'Usado' };
  assert.equal((await o.ejecutar('preparar_borrador_publicacion', args)).error.codigo, 'NO_AUTORIZADO');
  aprobado = true;
  assert.deepEqual((await o.ejecutar('preparar_borrador_publicacion', args)).datos,
    { tipo: 'borrador_publicacion', borrador: args, requiereRevisionHumana: true });
});
test('respuestas incompatibles, errores privados y servicios que lanzan no filtran detalles', async () => {
  for (const servicio of [async () => bien([{ id: A, titulo: 'x', precioCentimos: -1, moneda: 'PEN', estado: 'disponible' }]),
    async () => ({ ok: false, error: { codigo: 'SECRETO', mensaje: 'token privado' } }),
    async () => { throw new Error('token privado'); }]) {
    const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad, servicios: { consultarCatalogo: servicio } });
    const r = await o.ejecutar('buscar_articulos', filtros());
    assert.equal(r.ok, false); assert.doesNotMatch(JSON.stringify(r), /token privado|SECRETO/);
  }
  const contradictoria = crearOrquestadorHerramientas({ obtenerIdentidad: async () => ({
    ok: true, datos: { id: A }, error: { codigo: 'NO_AUTORIZADO' },
  }), servicios: { consultarCatalogo: async () => bien([]) } });
  assert.equal((await contradictoria.ejecutar('buscar_articulos', filtros())).error.codigo, 'NO_AUTORIZADO');
  for (const salida of [
    { ok: true, datos: [], error: { codigo: 'NO_AUTORIZADO' } },
    { ok: false, datos: [], error: { codigo: 'SERVICIO' } },
    { ok: true, datos: [], error: null, extra: true },
    { ok: true, datos: null, error: null },
  ]) {
    for (const [nombre, servicio, argumentos] of [
      ['buscar_articulos', 'consultarCatalogo', filtros()],
      ['consultar_mis_reservas', 'consultarMisReservas', {}],
      ['preparar_borrador_publicacion', 'consultarEstadoVendedor', { titulo: 'Libro', descripcion: 'Usado' }],
    ]) {
      const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad, servicios: { [servicio]: async () => salida } });
      const resultado = await o.ejecutar(nombre, argumentos);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.codigo, 'RESPUESTA_INVALIDA');
    }
  }
  for (const valor of [0, -1, 1.5, 60001, NaN, '15']) {
    const o = crearOrquestadorHerramientas({ timeoutMs: valor, obtenerIdentidad: identidad });
    assert.equal((await o.ejecutar('buscar_articulos', filtros())).error.codigo, 'ARGUMENTOS_INVALIDOS');
  }
  for (const datos of [Object.assign(Array(2), { 0: { id: A, titulo: 'A', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' } }),
    [null], [undefined], [{ id: C, titulo: 'A', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' },
      { id: C_UPPER, titulo: 'A', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' }],
    ]) {
    const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad, servicios: { consultarCatalogo: async () => bien(datos) } });
    assert.equal((await o.ejecutar('buscar_articulos', filtros())).error.codigo, 'RESPUESTA_INVALIDA');
  }
  const distintos = crearOrquestadorHerramientas({ obtenerIdentidad: identidad, servicios: { consultarCatalogo: async () => bien([
    { id: C, titulo: 'A', precioCentimos: 1, moneda: 'PEN', estado: 'disponible' },
    { id: B, titulo: 'B', precioCentimos: 2, moneda: 'PEN', estado: 'vendido' },
  ]) } });
  assert.equal((await distintos.ejecutar('buscar_articulos', filtros())).datos.articulos.length, 2);
  for (const datos of [new Array(2), [null], [undefined], [{ id: C, estado: 'pendiente' },
    { id: C_UPPER, estado: 'cancelada' }]]) {
    const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
      servicios: { consultarMisReservas: async () => bien(datos) } });
    assert.equal((await o.ejecutar('consultar_mis_reservas', {})).error.codigo, 'RESPUESTA_INVALIDA');
  }
  const reservasDistintas = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarMisReservas: async () => bien([{ id: C, estado: 'pendiente' }, { id: B, estado: 'cancelada' }]) } });
  assert.equal((await reservasDistintas.ejecutar('consultar_mis_reservas', {})).datos.reservas.length, 2);
});
test('esperas de Auth y servicios nunca bloqueantes se cancelan y vencen', async () => {
  const never = () => new Promise(() => {});
  const auth = crearOrquestadorHerramientas({ obtenerIdentidad: never, timeoutMs: 15 });
  assert.equal((await auth.ejecutar('buscar_articulos', filtros())).error.codigo, 'TIEMPO_AGOTADO');
  const service = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: never }, timeoutMs: 15 });
  assert.equal((await service.ejecutar('buscar_articulos', filtros())).error.codigo, 'TIEMPO_AGOTADO');
  const tardia = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: () => new Promise((_, reject) => setTimeout(() => reject(new Error('privado')), 30)) }, timeoutMs: 5 });
  assert.equal((await tardia.ejecutar('buscar_articulos', filtros())).error.codigo, 'TIEMPO_AGOTADO');
  const authFinal = crearOrquestadorHerramientas({ obtenerIdentidad: (() => { let n = 0; return () => ++n === 1 ? identidad() : never(); })(),
    servicios: { consultarCatalogo: async () => bien([]) }, timeoutMs: 15 });
  assert.equal((await authFinal.ejecutar('buscar_articulos', filtros())).error.codigo, 'TIEMPO_AGOTADO');
  const d = diferida(); const reemplazo = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: () => d.promesa }, timeoutMs: 1000 });
  const vieja = reemplazo.ejecutar('buscar_articulos', filtros()); await new Promise(r => setImmediate(r));
  const nueva = reemplazo.ejecutar('buscar_articulos', filtros());
  assert.equal((await vieja).error.codigo, 'CANCELADA');
  d.resolver(bien([])); assert.equal((await nueva).ok, true);
  for (const metodo of ['invalidarIdentidad', 'desmontar']) {
    const tardia = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
      servicios: { consultarCatalogo: () => new Promise((_, reject) => setTimeout(() => reject(new Error('secreto')), 20)) }, timeoutMs: 1000 });
    const pendiente = tardia.ejecutar('buscar_articulos', filtros());
    await new Promise(r => setImmediate(r)); tardia[metodo]();
    assert.equal((await pendiente).error.codigo, 'CANCELADA');
  }
});
test('cancelación, desmontaje y cambio de cuenta descartan resultados tardíos', async () => {
  const d = diferida(); let actor = A;
  const o = crearOrquestadorHerramientas({ obtenerIdentidad: async () => bien({ id: actor }),
    servicios: { consultarCatalogo: () => d.promesa } });
  const primero = o.ejecutar('buscar_articulos', filtros());
  await new Promise(r => setImmediate(r)); actor = B; d.resolver(bien([]));
  assert.equal((await primero).error.codigo, 'CANCELADA');
  const d2 = diferida(); const o2 = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: () => d2.promesa } });
  const segundo = o2.ejecutar('buscar_articulos', filtros()); await new Promise(r => setImmediate(r));
  o2.desmontar(); d2.resolver(bien([]));
  assert.equal((await segundo).error.codigo, 'CANCELADA');
  assert.equal((await o2.ejecutar('buscar_articulos', filtros())).error.codigo, 'CANCELADA');
  const d3 = diferida(); const o3 = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
    servicios: { consultarCatalogo: () => d3.promesa } });
  const tercero = o3.ejecutar('buscar_articulos', filtros()); await new Promise(r => setImmediate(r));
  o3.invalidarIdentidad(); d3.resolver(bien([]));
  assert.equal((await tercero).error.codigo, 'CANCELADA');
});
test('importación y ejecución con dobles no usan red ni almacenamiento global', async () => {
  const anterior = globalThis.fetch;
  let llamadas = 0; globalThis.fetch = () => { llamadas++; throw new Error('red prohibida'); };
  try {
    const o = crearOrquestadorHerramientas({ obtenerIdentidad: identidad,
      servicios: { consultarCatalogo: async () => bien([]) } });
    assert.equal((await o.ejecutar('buscar_articulos', filtros())).ok, true);
    assert.equal(llamadas, 0);
  } finally { globalThis.fetch = anterior; }
});
