import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/directorios.js', import.meta.url), 'utf8');
const id = '72984568-e4a5-43f1-8285-e762d281e8a3';
const universidad = 'b20a09af-5f1b-4ad1-9422-dad50ffdc909';
const plano = valor => JSON.parse(JSON.stringify(valor));

async function cargar(respuesta, falloCliente) {
  const llamadas = [];
  const contexto = createContext({ TypeError });
  const dependencia = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => {
      llamadas.push(['cliente']);
      if (falloCliente) return falloCliente;
      return { ok: true, datos: {
        from(tabla) {
          llamadas.push(['from', tabla]);
          return {
            select(columnas) { llamadas.push(['select', columnas]); return this; },
            eq(columna, valor) { llamadas.push(['eq', columna, valor]); return this; },
            order(columna) { llamadas.push(['order', columna]); return this; },
            then(resolve, reject) { return Promise.resolve().then(respuesta).then(resolve, reject); },
          };
        },
      } };
    });
  }, { context: contexto });
  const modulo = new SourceTextModule(fuente, { context: contexto });
  await modulo.link(nombre => {
    assert.equal(nombre, './supabase-cliente.js');
    return dependencia;
  });
  await modulo.evaluate();
  return { servicio: modulo.namespace, llamadas };
}

for (const caso of [
  {
    funcion: 'consultarUniversidades', tabla: 'universidades', columnas: 'id,nombre,sigla',
    orden: ['nombre', 'id'], fila: { id, nombre: 'Institución sintética', sigla: 'SINT' },
    dto: { id, nombre: 'Institución sintética', sigla: 'SINT' },
  },
  {
    funcion: 'consultarCampus', tabla: 'campus', columnas: 'id,universidad_id,nombre,distrito,ciudad',
    orden: ['nombre', 'id'], argumento: universidad.toUpperCase(),
    fila: { id, universidad_id: universidad, nombre: 'Sede sintética', distrito: null, ciudad: null },
    dto: { id, universidadId: universidad, nombre: 'Sede sintética', distrito: null, ciudad: null },
  },
  {
    funcion: 'consultarCategorias', tabla: 'categorias', columnas: 'id,nombre,descripcion,orden',
    orden: ['orden', 'nombre', 'id'], fila: { id, nombre: 'Categoría sintética', descripcion: null, orden: 0 },
    dto: { id, nombre: 'Categoría sintética', descripcion: null, orden: 0 },
  },
]) {
  test(`${caso.funcion} usa proyección concedida, orden estable y DTO explícito`, async () => {
    const { servicio, llamadas } = await cargar(() => ({ data: [{ ...caso.fila, extra: 'ignorar' }] }));
    assert.deepEqual(llamadas, []);
    const resultado = await servicio[caso.funcion](caso.argumento);
    assert.deepEqual(plano(resultado), { ok: true, datos: [caso.dto], error: null });
    assert.deepEqual(llamadas, [
      ['cliente'], ['from', caso.tabla], ['select', caso.columnas],
      ...(caso.argumento ? [['eq', 'universidad_id', universidad]] : []),
      ...caso.orden.map(columna => ['order', columna]),
    ]);
  });
}

test('un filtro de campus inválido falla antes de cargar el cliente', async () => {
  const { servicio, llamadas } = await cargar(() => assert.fail('Consulta inesperada'));
  assert.equal((await servicio.consultarCampus('in.(a,b)')).error.codigo, 'VALIDACION');
  assert.deepEqual(llamadas, []);
});

test('devuelve un directorio vacío cuando RLS no muestra filas', async () => {
  const { servicio } = await cargar(() => ({ data: [] }));
  assert.deepEqual(plano(await servicio.consultarCampus(universidad)), { ok: true, datos: [], error: null });
});

test('rechaza un campus que no corresponde al filtro', async () => {
  const { servicio } = await cargar(() => ({
    data: [{ id, universidad_id: id, nombre: 'Sede sintética', distrito: null, ciudad: null }],
  }));
  assert.equal((await servicio.consultarCampus(universidad)).error.codigo, 'SERVIDOR');
});

test('preserva distrito y ciudad cuando están informados', async () => {
  const { servicio } = await cargar(() => ({
    data: [{ id, universidad_id: universidad, nombre: 'Sede sintética', distrito: 'Distrito sintético', ciudad: 'Ciudad sintética' }],
  }));
  assert.deepEqual(plano((await servicio.consultarCampus(universidad)).datos), [{
    id, universidadId: universidad, nombre: 'Sede sintética', distrito: 'Distrito sintético', ciudad: 'Ciudad sintética',
  }]);
});

test('normaliza errores de permisos, límite, red y respuesta inesperada', async () => {
  for (const [respuesta, codigo] of [
    [{ status: 403, error: { message: 'detalle privado' } }, 'NO_AUTORIZADO'],
    [{ status: 429, error: {} }, 'LIMITE'],
    [{ status: 0, error: {} }, 'RED'],
    [{ data: null }, 'SERVIDOR'],
  ]) {
    const { servicio } = await cargar(() => respuesta);
    const resultado = await servicio.consultarCategorias();
    assert.equal(resultado.error.codigo, codigo);
    assert.equal(resultado.datos, null);
    assert.doesNotMatch(JSON.stringify(resultado), /detalle privado/);
  }
});

test('propaga el fallo normalizado de configuración del cliente compartido', async () => {
  const fallo = { ok: false, datos: null, error: { codigo: 'CONFIGURACION', mensaje: 'Faltan valores públicos.' } };
  const { servicio, llamadas } = await cargar(() => assert.fail('Consulta inesperada'), fallo);
  assert.deepEqual(await servicio.consultarUniversidades(), fallo);
  assert.deepEqual(llamadas, [['cliente']]);
});
