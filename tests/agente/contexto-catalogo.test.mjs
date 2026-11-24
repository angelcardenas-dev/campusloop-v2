import test from 'node:test';
import assert from 'node:assert/strict';
import { crearProductorContextoCatalogo } from '../../js/agente-contexto-catalogo.js';
import { crearMemoriaAgente, POLITICA_PROVISIONAL_MEMORIA } from '../../js/agente-memoria.js';

const categoria = '11111111-1111-4111-8111-111111111111'; // Sintético, solo en pruebas.
const usuario = '22222222-2222-4222-8222-222222222222';
const base = () => ({ tipo: 'busqueda_catalogo', categorias: [categoria], estados: ['disponible'],
  condiciones: ['usado'], precioMinimoCentimos: null, precioMaximoCentimos: 10000, orden: 'recientes' });
const crear = (fuente, categoriasPermitidas = [categoria]) => crearProductorContextoCatalogo({ obtenerSeleccion: fuente, categoriasPermitidas });

test('proyecta contexto estructurado validado con copia defensiva', async () => {
  const entrada = base(), resultado = await crear(() => entrada)();
  assert.deepEqual(resultado, entrada); entrada.categorias.length = 0;
  assert.deepEqual(resultado.categorias, [categoria]);
});
for (const [nombre, cambio] of Object.entries({
  busqueda: { busqueda: 'correo@example.invalid' }, privado: { reserva: { telefono: '123' } },
  declaracion: { esPublico: true }, categoria: { categorias: ['33333333-3333-4333-8333-333333333333'] },
  estado: { estados: ['inventado'] }, condicion: { condiciones: ['rota'] },
  precio: { precioMaximoCentimos: -1 }, orden: { orden: 'arbitrario' },
})) test('rechaza campo o valor no permitido: ' + nombre, async () => {
  await assert.rejects(crear(() => ({ ...base(), ...cambio }))(), /contexto público válido/);
});
test('errores de fuente y abortos no filtran información privada', async () => {
  await assert.rejects(crear(() => { throw new Error('dato privado'); })(), e => !e.message.includes('dato privado'));
  const c = new AbortController(); c.abort(); let llamadas = 0;
  await assert.rejects(crear(() => { llamadas++; return base(); })({ signal: c.signal }));
  assert.equal(llamadas, 0);
});
test('una señal abortada descarta respuesta tardía de la fuente', async () => {
  let resolver; const espera = new Promise(r => { resolver = r; }); const c = new AbortController();
  const tarea = crear(() => espera)({ signal: c.signal }); c.abort(); resolver(base());
  await assert.rejects(tarea);
});
test('continuidad entre instancias con identidad y almacenamiento sintéticos', async () => {
  const valores = new Map(); const ok = datos => ({ ok: true, datos, error: null });
  const almacenamiento = { leer: async k => ok(valores.get(k) ?? null),
    guardar: async (k, v) => { valores.set(k, v); return ok(null); },
    eliminar: async k => { valores.delete(k); return ok(null); } };
  const opciones = { almacenamiento, obtenerIdentidad: () => ({ id: usuario }),
    producirContexto: crear(() => base()), categoriasPermitidas: [categoria],
    politica: POLITICA_PROVISIONAL_MEMORIA, ahora: () => 1795370400000 };
  const primera = crearMemoriaAgente(opciones); assert.equal((await primera.actualizar()).datos.persistido, true);
  primera.desmontar(); const segunda = crearMemoriaAgente(opciones);
  assert.equal((await segunda.recuperar()).datos.contexto.precioMaximoCentimos, 10000);
  assert.equal(JSON.stringify([...valores]).includes('correo@example.invalid'), false); segunda.desmontar();
});
