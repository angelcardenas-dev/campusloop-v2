import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as vm from 'node:vm';
import {
  crearAlmacenamientoLocal, crearClave, validarBorrador, validarFiltros, validarPreferencias,
  VERSION_FORMATO, LIMITES,
} from '../../js/localstorage.js';

// Pruebas OFFLINE con un doble de Storage en memoria. Sin navegador, Supabase, red,
// auth.js real ni credenciales. UUID exclusivamente sintéticos, no cuentas reales.
const URL_MODULO = new URL('../../js/localstorage.js', import.meta.url);
const fuente = await readFile(URL_MODULO, 'utf8');
// Código sin comentarios y con saltos normalizados para el análisis estático en LF/CRLF.
const codigo = fuente.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
// SourceTextModule requiere `node --experimental-vm-modules`; sin él, solo se omiten
// las pruebas de contexto aislado.
const { SourceTextModule } = vm;
const SIN_VM = typeof SourceTextModule === 'function' ? false
  : 'SourceTextModule no disponible: ejecutar con node --experimental-vm-modules';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const CAT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNI = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CAMPUS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const INSTANTE = Date.parse('2026-11-22T18:00:00.000Z');
const ISO = '2026-11-22T18:00:00.000Z';
const clave = (categoria, id) => crearClave(categoria, id).datos;
const plano = valor => JSON.parse(JSON.stringify(valor));
const rechaza = (resultado, codigo) => {
  assert.equal(resultado.ok, false);
  assert.equal(resultado.datos, null);
  assert.equal(resultado.error.codigo, codigo);
  assert.equal(typeof resultado.error.mensaje, 'string');
};

// Doble compatible con Storage: registra operaciones y permite inyectar fallos.
class StorageSimulado {
  constructor() {
    this.valores = new Map();
    this.operaciones = [];
    this.fallos = {};
  }
  get length() { this.operaciones.push(['length']); return this.valores.size; }
  key(indice) { this.operaciones.push(['key', indice]); return [...this.valores.keys()][indice] ?? null; }
  getItem(k) {
    this.operaciones.push(['getItem', k]);
    if (Object.hasOwn(this.fallos, 'getItem')) throw this.fallos.getItem;
    return this.valores.has(k) ? this.valores.get(k) : null;
  }
  setItem(k, v) {
    this.operaciones.push(['setItem', k]);
    if (Object.hasOwn(this.fallos, 'setItem')) throw this.fallos.setItem;
    this.valores.set(k, String(v));
  }
  removeItem(k) {
    this.operaciones.push(['removeItem', k]);
    if (Object.hasOwn(this.fallos, 'removeItem')) throw this.fallos.removeItem;
    this.valores.delete(k);
  }
  clear() { this.operaciones.push(['clear']); this.valores.clear(); }
}
const errorNombrado = (name, code) => Object.assign(new Error('fallo sintético'), { name, code });
// Error cuyas propiedades lanzan al leerse (`name`, `code`, etc.).
const errorHostil = () => new Proxy({}, { get() { throw new Error('propiedad hostil'); } });

function entorno() {
  const almacen = new StorageSimulado();
  return { almacen, api: crearAlmacenamientoLocal({ almacenamiento: almacen, ahora: () => INSTANTE }) };
}
const borrador = () => ({ titulo: 'Apuntes de Cálculo', descripcion: 'Ordenados por temas.\nIncluye carpeta.',
  categoriaId: CAT, precioCentimos: 2500 });
const filtros = () => ({ busqueda: 'calculadora', categorias: [CAT], universidad: UNI, campus: CAMPUS,
  estados: ['disponible'], condiciones: ['buen_estado', 'usado'], precioMinimoCentimos: 1000,
  precioMaximoCentimos: 50000, orden: 'precio-menor' });
const filtrosIniciales = () => ({ busqueda: '', categorias: [], universidad: '', campus: '', estados: [], condiciones: [],
  precioMinimoCentimos: null, precioMaximoCentimos: null, orden: 'recientes' });
const borradorVacio = () => ({ titulo: '', descripcion: '', categoriaId: null, precioCentimos: null });
const sobre = (tipo, datos, extra = {}) => JSON.stringify({ version: VERSION_FORMATO, tipo, guardadoEn: ISO, datos, ...extra });
// Base64 determinista de bytes sintéticos, como el de una imagen codificada.
const BASE64 = Buffer.from(Array.from({ length: 150 }, (_, i) => (i * 37 + 11) % 256)).toString('base64');
const BASE64URL = Buffer.from(Array.from({ length: 150 }, (_, i) => (i * 53 + 7) % 256)).toString('base64url');

test('claves: formato exacto del SPEC por categoría y usuario validado', () => {
  assert.equal(clave('borrador', A), `campusloop_tb4_v1_borrador_${A}`);
  assert.equal(clave('filtros', A), `campusloop_tb4_v1_filtros_${A}`);
  assert.equal(clave('preferencias', A), `campusloop_tb4_v1_preferencias_${A}`);
  assert.equal(clave('borrador', A.replace(/1/, 'A').toUpperCase()).endsWith(A.replace(/1/, 'a')), true,
    'el identificador del usuario se normaliza a minúsculas solo en la clave');
  // La memoria del agente no es una categoría de este módulo.
  rechaza(crearClave('agente_historial', A), 'CONFIGURACION');
});

test('1. guardar y recuperar un borrador', () => {
  const { api, almacen } = entorno();
  const guardado = api.guardarBorrador(A, borrador());
  assert.deepEqual(plano(guardado), { ok: true, error: null,
    datos: { version: 1, guardadoEn: ISO, contenido: borrador() } });
  assert.deepEqual(JSON.parse(almacen.valores.get(clave('borrador', A))),
    { version: 1, tipo: 'borrador', guardadoEn: ISO, datos: borrador() });
  assert.deepEqual(plano(api.leerBorrador(A)), plano(guardado));
  // Borrador parcial: campos ausentes se normalizan, el texto no se recorta.
  const parcial = api.guardarBorrador(A, { titulo: '  En curso ' });
  assert.deepEqual(plano(parcial.datos.contenido), { titulo: '  En curso ', descripcion: '', categoriaId: null, precioCentimos: null });
});

test('2. guardar y recuperar filtros con la estructura del contrato', () => {
  const { api } = entorno();
  assert.equal(api.guardarFiltros(A, filtros()).ok, true);
  const leido = api.leerFiltros(A);
  assert.deepEqual(plano(leido.datos.contenido), filtros());
  const iniciales = filtrosIniciales();
  assert.deepEqual(plano(api.guardarFiltros(A, iniciales).datos.contenido), iniciales);
  // Estructura exacta: ni campos ausentes, ni extensiones, ni valores fuera de contrato.
  const { orden, ...incompleto } = filtros();
  rechaza(api.guardarFiltros(A, incompleto), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), resultados: [] }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), orden: 'precio' }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), estados: ['eliminado'] }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), categorias: [CAT, CAT] }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), categorias: ['tecnologia'] }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), precioMinimoCentimos: 9, precioMaximoCentimos: 1 }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), precioMinimoCentimos: 10.5 }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), busqueda: 'ab '.repeat(41) }), 'VALIDACION');
  rechaza(api.guardarFiltros(A, { ...filtros(), categorias: Array.from({ length: 201 }, (_, i) =>
    `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`) }), 'VALIDACION');
  // Los últimos filtros guardados siguen intactos tras los rechazos.
  assert.deepEqual(plano(api.leerFiltros(A).datos.contenido), iniciales);
  assert.equal(api.guardarFiltros(A, { ...filtros(), busqueda: 'ab '.repeat(40) }).ok, true, '120 caracteres');
});

test('2b. campus independiente de universidad; la correspondencia no se comprueba localmente', () => {
  const { api } = entorno();
  // Corrección coordinada: estos filtros son válidos según el contrato REST.
  for (const entrada of [{ ...filtros(), universidad: '' }, { ...filtrosIniciales(), campus: CAMPUS }]) {
    assert.deepEqual(plano(validarFiltros(entrada).datos), entrada);
    assert.deepEqual(plano(api.guardarFiltros(A, entrada).datos.contenido), entrada);
    assert.deepEqual(plano(api.leerFiltros(A).datos.contenido), entrada);
  }
  assert.equal(api.guardarFiltros(A, { ...filtrosIniciales(), universidad: UNI }).ok, true, 'universidad sin campus');
  assert.equal(api.guardarFiltros(A, { ...filtrosIniciales(), universidad: UNI, campus: CAMPUS }).ok, true, 'ambos');
  // Cualquier par de UUID válidos se acepta: la relación real depende del catálogo.
  assert.equal(validarFiltros({ ...filtrosIniciales(), universidad: B, campus: A }).ok, true);
});

test('3. guardar y recuperar preferencias: objeto vacío compatible con la lista cerrada', () => {
  const { api } = entorno();
  assert.deepEqual(plano(api.guardarPreferencias(A, {}).datos.contenido), {});
  assert.deepEqual(plano(api.leerPreferencias(A).datos), { version: 1, guardadoEn: ISO, contenido: {} });
  // `{}` sigue siendo válido; se rechazan campos no declarados y datos de autorización.
  rechaza(api.guardarPreferencias(A, { tema: 'oscuro' }), 'VALIDACION');
  rechaza(api.guardarPreferencias(A, { rol: 'administrador' }), 'DATO_NO_PERMITIDO');
  rechaza(api.guardarPreferencias(A, { vendedorActivado: true }), 'VALIDACION');
  rechaza(api.guardarPreferencias(A, null), 'VALIDACION');
});

test('2c. campus independiente no omite validación UUID ni admite campos extra', () => {
  const { api, almacen } = entorno();
  for (const campus of ['campus', '../campus', '00000000-0000-0000-0000-000000000000', CAMPUS.slice(0, -1), null, 1]) {
    const entrada = { ...filtrosIniciales(), campus };
    rechaza(validarFiltros(entrada), 'VALIDACION');
    rechaza(api.guardarFiltros(A, entrada), 'VALIDACION');
  }
  for (const extra of [{ universidad: 'universidad' }, { universidad: null }, { desconocido: true }]) {
    const entrada = { ...filtrosIniciales(), campus: CAMPUS, ...extra };
    rechaza(validarFiltros(entrada), 'VALIDACION');
    rechaza(api.guardarFiltros(A, entrada), 'VALIDACION');
  }
  assert.equal(almacen.valores.size, 0);
  assert.ok(!almacen.operaciones.some(([op]) => op === 'setItem'));
});

test('3b. preferencias booleanas opcionales: copia normalizada y sobre versionado', () => {
  const { api, almacen } = entorno();
  const casos = [{}, { reducirMovimiento: true }, { reducirMovimiento: false },
    { filtrosMovilAbiertos: true }, { filtrosMovilAbiertos: false },
    ...[true, false].flatMap(reducirMovimiento => [true, false].map(filtrosMovilAbiertos => ({ reducirMovimiento, filtrosMovilAbiertos })))];
  for (const entrada of casos) {
    const validada = validarPreferencias(entrada);
    assert.equal(validada.ok, true); assert.notEqual(validada.datos, entrada);
    assert.deepEqual(plano(validada.datos), entrada);
    const guardada = api.guardarPreferencias(A, entrada);
    assert.equal(guardada.ok, true); assert.notEqual(guardada.datos.contenido, entrada);
    assert.deepEqual(plano(guardada.datos), { version: 1, guardadoEn: ISO, contenido: entrada });
    assert.deepEqual(JSON.parse(almacen.valores.get(clave('preferencias', A))),
      { version: 1, tipo: 'preferencias', guardadoEn: ISO, datos: entrada });
    assert.deepEqual(plano(api.leerPreferencias(A).datos.contenido), entrada);
  }
});

test('3c. preferencias rechazan tipos no booleanos y propiedades desconocidas sin sobrescribir', () => {
  const { api, almacen } = entorno();
  const valida = { reducirMovimiento: true, filtrosMovilAbiertos: false };
  api.guardarPreferencias(A, valida); const anterior = almacen.valores.get(clave('preferencias', A));
  for (const campo of ['reducirMovimiento', 'filtrosMovilAbiertos']) {
    for (const valor of [undefined, null, 0, 1, 'true', 'false', [], {}, new Boolean(true)]) {
      const entrada = { ...valida, [campo]: valor };
      rechaza(validarPreferencias(entrada), 'VALIDACION');
      rechaza(api.guardarPreferencias(A, entrada), 'VALIDACION');
    }
  }
  for (const campo of ['tema', 'modoOscuro', 'desconocido']) {
    const entrada = { ...valida, [campo]: true };
    rechaza(validarPreferencias(entrada), 'VALIDACION');
    rechaza(api.guardarPreferencias(A, entrada), 'VALIDACION');
  }
  assert.equal(almacen.valores.get(clave('preferencias', A)), anterior);
  assert.deepEqual(plano(api.leerPreferencias(A).datos.contenido), valida);
});

test('3d. preferencias: compatibilidad con {} anterior, persistencia entre módulos y aislamiento por usuario', async () => {
  const { api, almacen } = entorno();
  // Sobre de versión 1 guardado antes de incorporar las dos preferencias.
  const anterior = sobre('preferencias', {}); almacen.valores.set(clave('preferencias', A), anterior);
  const otroModulo = await import(`${URL_MODULO.href}?preferencias-pr53`);
  const otra = otroModulo.crearAlmacenamientoLocal({ almacenamiento: almacen });
  assert.deepEqual(plano(otra.leerPreferencias(A).datos), { version: 1, guardadoEn: ISO, contenido: {} });
  assert.equal(almacen.valores.get(clave('preferencias', A)), anterior, 'la lectura no migra ni reescribe');
  assert.equal(otra.leerPreferencias(B).datos, null);
  const entrada = { reducirMovimiento: true, filtrosMovilAbiertos: false };
  const esperada = { ...entrada }, paraB = { reducirMovimiento: false, filtrosMovilAbiertos: true };
  assert.equal(api.guardarPreferencias(A, entrada).ok, true);
  assert.equal(api.guardarPreferencias(B, paraB).ok, true);
  entrada.reducirMovimiento = false;
  const leida = otra.leerPreferencias(A); assert.deepEqual(plano(leida.datos.contenido), esperada);
  leida.datos.contenido.filtrosMovilAbiertos = true;
  assert.deepEqual(plano(api.leerPreferencias(A).datos.contenido), esperada);
  almacen.operaciones.length = 0;
  assert.deepEqual(plano(otra.leerPreferencias(B).datos.contenido), paraB);
  assert.ok(almacen.operaciones.every(([, k]) => k === clave('preferencias', B)));
  otra.eliminarPreferencias(A);
  assert.deepEqual(plano(api.leerPreferencias(B).datos.contenido), paraB);
});

test('3e. preferencias: bloqueo recuperable conserva datos y errores normalizados', () => {
  const { api, almacen } = entorno();
  const anterior = { reducirMovimiento: true, filtrosMovilAbiertos: false };
  api.guardarPreferencias(A, anterior); const crudo = almacen.valores.get(clave('preferencias', A));
  almacen.fallos.getItem = errorNombrado('SecurityError', 18);
  rechaza(api.leerPreferencias(A), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(api.guardarPreferencias(A, {}), 'ALMACENAMIENTO_NO_DISPONIBLE');
  delete almacen.fallos.getItem;
  assert.deepEqual(plano(api.leerPreferencias(A).datos.contenido), anterior);
  almacen.fallos.setItem = errorNombrado('SecurityError', 18);
  rechaza(api.guardarPreferencias(A, { filtrosMovilAbiertos: true }), 'ALMACENAMIENTO_NO_DISPONIBLE');
  assert.equal(almacen.valores.get(clave('preferencias', A)), crudo);
  delete almacen.fallos.setItem;
  assert.equal(api.guardarPreferencias(A, { filtrosMovilAbiertos: true }).ok, true);
  assert.deepEqual(plano(api.leerPreferencias(A).datos.contenido), { filtrosMovilAbiertos: true });
});

test('4. eliminar el borrador propio, también si no existe', () => {
  const { api, almacen } = entorno();
  api.guardarBorrador(A, borrador());
  api.guardarFiltros(A, filtros());
  assert.deepEqual(plano(api.eliminarBorrador(A)), { ok: true, datos: null, error: null });
  assert.equal(almacen.valores.has(clave('borrador', A)), false);
  assert.equal(almacen.valores.has(clave('filtros', A)), true, 'no toca otras categorías');
  assert.deepEqual(plano(api.leerBorrador(A)), { ok: true, datos: null, error: null });
  assert.equal(api.eliminarBorrador(A).ok, true);
});

test('4b. eliminar filtros y preferencias propios, sin tocar otras claves', () => {
  for (const [categoria, guardar, leer, eliminar, valor] of [
    ['filtros', 'guardarFiltros', 'leerFiltros', 'eliminarFiltros', filtros()],
    ['preferencias', 'guardarPreferencias', 'leerPreferencias', 'eliminarPreferencias', {}]]) {
    const { api, almacen } = entorno();
    api.guardarBorrador(A, borrador());
    api.guardarFiltros(A, filtros());
    api.guardarPreferencias(A, {});
    api[guardar](B, valor);
    const ajenas = { 'sb-proyecto-auth-token': '{"sesion":"ajena"}', [`campusloop_tb4_v1_agente_historial_${A}`]: '[]' };
    for (const [k, v] of Object.entries(ajenas)) almacen.valores.set(k, v);
    const antes = new Map(almacen.valores);
    almacen.operaciones.length = 0;
    assert.deepEqual(plano(api[eliminar](A)), { ok: true, datos: null, error: null });
    assert.deepEqual(almacen.operaciones, [['removeItem', clave(categoria, A)]], 'una sola operación sobre la clave propia');
    assert.deepEqual(plano(api[leer](A)), { ok: true, datos: null, error: null });
    for (const [k, v] of antes) {
      if (k !== clave(categoria, A)) assert.equal(almacen.valores.get(k), v, `se conserva ${k}`);
    }
    assert.deepEqual(plano(api[leer](B).datos.contenido), valor, 'el otro usuario conserva su dato');
    assert.deepEqual(plano(api[eliminar](A)), { ok: true, datos: null, error: null }, 'clave inexistente');
    // El contenido guardado no se lee ni interpreta antes de eliminarlo.
    almacen.valores.set(clave(categoria, A), '{roto');
    almacen.operaciones.length = 0;
    assert.equal(api[eliminar](A).ok, true);
    assert.deepEqual(almacen.operaciones.map(([op]) => op), ['removeItem']);
    // Fallos de eliminación y de identidad.
    api[guardar](A, valor);
    almacen.fallos.removeItem = new Error('no se pudo');
    rechaza(api[eliminar](A), 'ERROR_ELIMINACION');
    almacen.fallos.removeItem = errorNombrado('SecurityError', 18);
    rechaza(api[eliminar](A), 'ALMACENAMIENTO_NO_DISPONIBLE');
    delete almacen.fallos.removeItem;
    assert.equal(api[leer](A).ok, true, 'el dato se conserva tras el fallo');
    almacen.operaciones.length = 0;
    for (const id of [undefined, null, '', 'anonimo', `${A}x`]) rechaza(api[eliminar](id), 'IDENTIDAD_INVALIDA');
    assert.equal(almacen.operaciones.length, 0);
    rechaza(crearAlmacenamientoLocal({ almacenamiento: null })[eliminar](A), 'ALMACENAMIENTO_NO_DISPONIBLE');
  }
});

test('API pública: operaciones expuestas sin duplicados', () => {
  const api = crearAlmacenamientoLocal({ almacenamiento: new StorageSimulado() });
  assert.deepEqual(Object.keys(api).sort(), ['comprobarDisponibilidad', 'eliminarBorrador', 'eliminarFiltros',
    'eliminarPreferencias', 'guardarBorrador', 'guardarFiltros', 'guardarPreferencias', 'leerBorrador',
    'leerFiltros', 'leerPreferencias']);
  assert.equal(Object.isFrozen(api), true);
});

test('5. persistencia entre instancias del módulo con el mismo almacenamiento', async () => {
  const almacen = new StorageSimulado();
  const otraInstancia = await import(`${URL_MODULO.href}?instancia=2`);
  assert.notEqual(otraInstancia.crearAlmacenamientoLocal, crearAlmacenamientoLocal);
  crearAlmacenamientoLocal({ almacenamiento: almacen, ahora: () => INSTANTE }).guardarBorrador(A, borrador());
  const recargada = otraInstancia.crearAlmacenamientoLocal({ almacenamiento: almacen });
  assert.deepEqual(plano(recargada.leerBorrador(A).datos.contenido), borrador());
});

test('6. aislamiento entre usuarios: cada operación usa solo su clave', () => {
  const { api, almacen } = entorno();
  api.guardarBorrador(A, borrador());
  api.guardarFiltros(A, filtros());
  almacen.operaciones.length = 0;
  assert.deepEqual(plano(api.leerBorrador(B)), { ok: true, datos: null, error: null });
  assert.deepEqual(plano(api.leerFiltros(B)), { ok: true, datos: null, error: null });
  api.guardarBorrador(B, { titulo: 'Otro' });
  api.eliminarBorrador(B);
  assert.ok(almacen.operaciones.every(([, k]) => k.endsWith(B)), 'B nunca accede a claves de A');
  assert.deepEqual(plano(api.leerBorrador(A).datos.contenido), borrador());
});

test('7. clave inexistente: éxito sin datos, distinto de un error', () => {
  const { api } = entorno();
  for (const lectura of [api.leerBorrador(A), api.leerFiltros(A), api.leerPreferencias(A)]) {
    assert.deepEqual(plano(lectura), { ok: true, datos: null, error: null });
  }
});

test('8. JSON inválido: error controlado y dato conservado', () => {
  const { api, almacen } = entorno();
  almacen.valores.set(clave('borrador', A), '{"version":1,');
  rechaza(api.leerBorrador(A), 'JSON_INVALIDO');
  assert.equal(almacen.valores.get(clave('borrador', A)), '{"version":1,');
  assert.ok(!almacen.operaciones.some(([op]) => op === 'removeItem' || op === 'setItem'));
});

test('9. versión incompatible: se conserva y no se sobrescribe', () => {
  const { api, almacen } = entorno();
  const futuro = JSON.stringify({ version: 2, tipo: 'borrador', guardadoEn: ISO, datos: { otroFormato: true } });
  almacen.valores.set(clave('borrador', A), futuro);
  rechaza(api.leerBorrador(A), 'VERSION_INCOMPATIBLE');
  rechaza(api.guardarBorrador(A, borrador()), 'VERSION_INCOMPATIBLE');
  assert.equal(almacen.valores.get(clave('borrador', A)), futuro);
  // La eliminación explícita del usuario sí está permitida.
  assert.equal(api.eliminarBorrador(A).ok, true);
  assert.equal(api.guardarBorrador(A, borrador()).ok, true);
});

test('10. estructura inválida y tipo inesperado se distinguen', () => {
  const { api, almacen } = entorno();
  const k = clave('borrador', A);
  const casos = [
    ['42', 'TIPO_INESPERADO'], ['"texto"', 'TIPO_INESPERADO'], ['[1,2]', 'TIPO_INESPERADO'], ['null', 'TIPO_INESPERADO'],
    [JSON.stringify({ tipo: 'borrador', guardadoEn: ISO, datos: borrador() }), 'ESTRUCTURA_INVALIDA'],
    [sobre('filtros', borrador()), 'ESTRUCTURA_INVALIDA'],
    [sobre('borrador', borrador(), { usuario: A }), 'ESTRUCTURA_INVALIDA'],
    [sobre('borrador', { ...borrador(), precioCentimos: -1 }), 'ESTRUCTURA_INVALIDA'],
    [sobre('borrador', { titulo: 'x' }), 'ESTRUCTURA_INVALIDA'],
    [sobre('borrador', borrador(), { guardadoEn: 'ayer' }), 'ESTRUCTURA_INVALIDA'],
    [sobre('borrador', { ...borrador(), descripcion: 'data:image/png;base64,AAAA' }), 'ESTRUCTURA_INVALIDA'],
  ];
  for (const [crudo, codigo] of casos) {
    almacen.valores.set(k, crudo);
    rechaza(api.leerBorrador(A), codigo);
    assert.equal(almacen.valores.get(k), crudo, 'no se elimina ni reescribe');
  }
  // Valor no textual devuelto por un Storage no estándar.
  const raro = { getItem: () => 7, setItem() {}, removeItem() {} };
  rechaza(crearAlmacenamientoLocal({ almacenamiento: raro }).leerBorrador(A), 'TIPO_INESPERADO');
  // Datos guardados excesivamente grandes: no se parsean.
  almacen.valores.set(k, ' '.repeat(LIMITES.bytesBorrador + 1));
  rechaza(api.leerBorrador(A), 'TAMANO_EXCEDIDO');
  // Validación de entrada antes de escribir.
  almacen.valores.clear();
  for (const entrada of [null, [], 'texto', { ...borrador(), estado: 'disponible' }, { titulo: 5 },
    { titulo: 'x'.repeat(LIMITES.tituloCaracteres + 1) }, { descripcion: 'ab '.repeat(334) },
    { titulo: 'con\nsalto' }, { categoriaId: 'Académico · Apuntes' }, { precioCentimos: 25.5 },
    { precioCentimos: '2500' }, { precioCentimos: Number.MAX_SAFE_INTEGER + 1 }, { titulo: '\uD800' },
    Object.defineProperty({}, 'titulo', { get() { throw new Error('getter'); }, enumerable: true })]) {
    rechaza(api.guardarBorrador(A, entrada), 'VALIDACION');
  }
  assert.equal(almacen.valores.size, 0);
  // Los límites de caracteres cuentan puntos de código, como char_length en PostgreSQL.
  assert.equal(api.guardarBorrador(A, { titulo: '📚'.repeat(LIMITES.tituloCaracteres) }).ok, true);
});

test('10b. sobre guardado: datos no planos, versiones y fechas inválidas', () => {
  const { api, almacen } = entorno();
  const k = clave('borrador', A);
  const sobreCon = cambios => JSON.stringify({ version: 1, tipo: 'borrador', guardadoEn: ISO, datos: borradorVacio(), ...cambios });
  const casos = [
    [sobreCon({ datos: null }), 'datos nulo'],
    [sobreCon({ datos: [] }), 'datos array'],
    [sobreCon({ datos: [borradorVacio()] }), 'datos array con objeto'],
    [sobreCon({ datos: 'texto' }), 'datos texto'],
    [sobreCon({ version: '1' }), 'versión texto'],
    [sobreCon({ version: 0 }), 'versión 0'],
    [sobreCon({ version: 1.5 }), 'versión 1.5'],
    [sobreCon({ version: -1 }), 'versión negativa'],
    [sobreCon({ guardadoEn: '2026-02-30T00:00:00.000Z' }), 'fecha inexistente'],
    [sobreCon({ guardadoEn: '2026-11-22T18:00:00Z' }), 'fecha sin milisegundos'],
    [sobreCon({ guardadoEn: '2026-11-22T18:00:00.000+05:00' }), 'fecha con zona no UTC'],
    [sobreCon({ guardadoEn: 1764000000000 }), 'fecha numérica'],
  ];
  for (const [crudo, descripcion] of casos) {
    almacen.valores.set(k, crudo);
    rechaza(api.leerBorrador(A), 'ESTRUCTURA_INVALIDA');
    assert.equal(almacen.valores.get(k), crudo, descripcion);
  }
  almacen.valores.set(k, sobreCon({}));
  assert.deepEqual(plano(api.leerBorrador(A).datos.contenido), borradorVacio(), 'el sobre válido mínimo se lee');
});

test('10c. errores de lectura de filtros y preferencias', () => {
  for (const [categoria, leer, valido] of [['filtros', 'leerFiltros', filtrosIniciales()], ['preferencias', 'leerPreferencias', {}]]) {
    const { api, almacen } = entorno();
    const k = clave(categoria, A);
    almacen.valores.set(k, '{roto');
    rechaza(api[leer](A), 'JSON_INVALIDO');
    almacen.valores.set(k, '[]');
    rechaza(api[leer](A), 'TIPO_INESPERADO');
    almacen.valores.set(k, JSON.stringify({ version: 2 }));
    rechaza(api[leer](A), 'VERSION_INCOMPATIBLE');
    almacen.valores.set(k, sobre('borrador', valido));
    rechaza(api[leer](A), 'ESTRUCTURA_INVALIDA');
    almacen.valores.set(k, sobre(categoria, null));
    rechaza(api[leer](A), 'ESTRUCTURA_INVALIDA');
    almacen.valores.set(k, sobre(categoria, valido, { guardadoEn: '2026-13-01T00:00:00.000Z' }));
    rechaza(api[leer](A), 'ESTRUCTURA_INVALIDA');
    almacen.valores.set(k, ' '.repeat(LIMITES[`bytes${categoria[0].toUpperCase()}${categoria.slice(1)}`] + 1));
    rechaza(api[leer](A), 'TAMANO_EXCEDIDO');
    almacen.fallos.getItem = new Error('lectura');
    rechaza(api[leer](A), 'ERROR_LECTURA');
    almacen.fallos.getItem = errorNombrado('SecurityError', 18);
    rechaza(api[leer](A), 'ALMACENAMIENTO_NO_DISPONIBLE');
    delete almacen.fallos.getItem;
    almacen.valores.set(k, sobre(categoria, valido));
    assert.deepEqual(plano(api[leer](A).datos.contenido), valido);
  }
});

test('11. cuota excedida: error controlado sin perder el dato anterior', () => {
  const { api, almacen } = entorno();
  api.guardarBorrador(A, borrador());
  for (const error of [errorNombrado('QuotaExceededError', 22), new DOMException('lleno', 'QuotaExceededError'),
    errorNombrado('NS_ERROR_DOM_QUOTA_REACHED', 1014)]) {
    almacen.fallos.setItem = error;
    rechaza(api.guardarBorrador(A, { titulo: 'Nuevo' }), 'CUOTA_EXCEDIDA');
    rechaza(api.guardarFiltros(A, filtros()), 'CUOTA_EXCEDIDA');
  }
  delete almacen.fallos.setItem;
  assert.deepEqual(plano(api.leerBorrador(A).datos.contenido), borrador());
  almacen.fallos.setItem = new Error('otro');
  rechaza(api.guardarPreferencias(A, {}), 'ERROR_ESCRITURA');
});

test('12. almacenamiento bloqueado o ausente', () => {
  const sinAlmacen = crearAlmacenamientoLocal({ almacenamiento: null });
  rechaza(sinAlmacen.comprobarDisponibilidad(), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(sinAlmacen.guardarBorrador(A, borrador()), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(sinAlmacen.leerFiltros(A), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(sinAlmacen.eliminarBorrador(A), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(crearAlmacenamientoLocal({ almacenamiento: { getItem() {} } }).leerBorrador(A), 'ALMACENAMIENTO_NO_DISPONIBLE');
  const { api, almacen } = entorno();
  assert.deepEqual(plano(api.comprobarDisponibilidad()), { ok: true, datos: { disponible: true }, error: null });
  assert.equal(almacen.operaciones.length, 0, 'comprobar no escribe claves de prueba');
  almacen.fallos.getItem = errorNombrado('SecurityError', 18);
  rechaza(api.leerBorrador(A), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(api.guardarBorrador(A, borrador()), 'ALMACENAMIENTO_NO_DISPONIBLE');
  almacen.fallos.getItem = new Error('lectura');
  rechaza(api.leerBorrador(A), 'ERROR_LECTURA');
  rechaza(api.guardarBorrador(A, borrador()), 'ERROR_LECTURA');
  assert.ok(!almacen.operaciones.some(([op]) => op === 'setItem'), 'sin lectura previa no se escribe');
  delete almacen.fallos.getItem;
  almacen.fallos.setItem = errorNombrado('SecurityError', 18);
  rechaza(api.guardarBorrador(A, borrador()), 'ALMACENAMIENTO_NO_DISPONIBLE');
});

test('12b. acceso a globalThis.localStorage bloqueado (sin inyección)', { skip: SIN_VM }, async () => {
  const { api } = await cargarAislado({ localStorageBloqueado: true });
  rechaza(plano(api.crearAlmacenamientoLocal().comprobarDisponibilidad()), 'ALMACENAMIENTO_NO_DISPONIBLE');
  rechaza(plano(api.crearAlmacenamientoLocal().leerBorrador(A)), 'ALMACENAMIENTO_NO_DISPONIBLE');
});

test('13. fallo de eliminación: error controlado y dato conservado', () => {
  const { api, almacen } = entorno();
  api.guardarBorrador(A, borrador());
  almacen.fallos.removeItem = new Error('no se pudo');
  rechaza(api.eliminarBorrador(A), 'ERROR_ELIMINACION');
  delete almacen.fallos.removeItem;
  assert.equal(api.leerBorrador(A).ok, true);
});

test('13b. valores lanzados que no son Error y errores con propiedades hostiles', () => {
  for (const lanzado of [null, undefined, 'texto', 42, Symbol('x'), errorHostil()]) {
    const { api, almacen } = entorno();
    api.guardarBorrador(A, borrador());
    almacen.fallos.getItem = lanzado;
    rechaza(api.leerBorrador(A), 'ERROR_LECTURA');
    rechaza(api.leerFiltros(A), 'ERROR_LECTURA');
    rechaza(api.guardarBorrador(A, borrador()), 'ERROR_LECTURA');
    delete almacen.fallos.getItem;
    almacen.fallos.setItem = lanzado;
    rechaza(api.guardarBorrador(A, { titulo: 'Nuevo' }), 'ERROR_ESCRITURA');
    rechaza(api.guardarPreferencias(A, {}), 'ERROR_ESCRITURA');
    delete almacen.fallos.setItem;
    almacen.fallos.removeItem = lanzado;
    rechaza(api.eliminarBorrador(A), 'ERROR_ELIMINACION');
    rechaza(api.eliminarFiltros(A), 'ERROR_ELIMINACION');
    rechaza(api.eliminarPreferencias(A), 'ERROR_ELIMINACION');
    delete almacen.fallos.removeItem;
    assert.deepEqual(plano(api.leerBorrador(A).datos.contenido), borrador(), 'el dato anterior se conserva');
  }
});

test('14. sin credenciales ni datos privados en lo guardado', () => {
  const { api, almacen } = entorno();
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJh';
  for (const entrada of [{ ...borrador(), contrasena: 'secreta123' }, { ...borrador(), token: 'abc' },
    { ...borrador(), access_token: 'abc' }, { ...borrador(), sesion: {} }, { titulo: jwt },
    { descripcion: `clave sb_secret_${'x'.repeat(20)}` }, { descripcion: `clave sb_publishable_${'y'.repeat(20)}` },
    { descripcion: '-----BEGIN PRIVATE KEY-----\nMIIE' }]) {
    rechaza(api.guardarBorrador(A, entrada), 'DATO_NO_PERMITIDO');
  }
  rechaza(api.guardarFiltros(A, { ...filtros(), busqueda: jwt }), 'DATO_NO_PERMITIDO');
  rechaza(api.guardarPreferencias(A, { permisos: ['admin'] }), 'DATO_NO_PERMITIDO');
  api.guardarBorrador(A, borrador());
  api.guardarFiltros(A, filtros());
  api.guardarPreferencias(A, {});
  const guardado = [...almacen.valores.values()].join('\n');
  assert.doesNotMatch(guardado, /contrase|password|token|jwt|sesion|session|correo|email|@|eyJ|sb_|service_role|vendedor|rol/i);
  for (const crudo of almacen.valores.values()) {
    assert.deepEqual(Object.keys(JSON.parse(crudo)), ['version', 'tipo', 'guardadoEn', 'datos']);
  }
});

test('14b. nombres de campo: segmentos completos, no subcadenas', () => {
  // Nombres que representan credenciales, permisos o archivos: DATO_NO_PERMITIDO.
  for (const nombre of ['accessToken', 'refresh_token', 'api-key', 'apiKey', 'API_KEY', 'userRoles', 'rol',
    'imagenBase64', 'fotoPrincipal', 'contraseñaNueva', 'permisos', 'session', 'sessionStorageModo', 'passwordHash',
    'privilegios']) {
    rechaza(validarPreferencias({ [nombre]: 'x' }), 'DATO_NO_PERMITIDO');
    rechaza(validarBorrador({ ...borrador(), [nombre]: 'x' }), 'DATO_NO_PERMITIDO');
  }
  // Nombres que solo contienen esas letras por accidente: campo desconocido, VALIDACION.
  for (const nombre of ['control', 'scroll', 'perfil', 'profile', 'enrolado', 'tokenizado', 'sesionado',
    'fotografo', 'imaginario', 'filete', 'permisivo']) {
    rechaza(validarPreferencias({ [nombre]: true }), 'VALIDACION');
    rechaza(validarBorrador({ ...borrador(), [nombre]: true }), 'VALIDACION');
  }
});

test('15. sin limpieza global ni recorrido de claves ajenas', () => {
  const { api, almacen } = entorno();
  const ajenas = { 'sb-proyecto-auth-token': '{"sesion":"ajena"}', [`campusloop_tb4_v1_agente_historial_${A}`]: '[]',
    [clave('borrador', B)]: sobre('borrador', borrador()), otra_app: 'x' };
  for (const [k, v] of Object.entries(ajenas)) almacen.valores.set(k, v);
  api.guardarBorrador(A, borrador());
  api.leerBorrador(A);
  api.eliminarBorrador(A);
  api.guardarFiltros(A, filtros());
  api.leerPreferencias(A);
  api.eliminarFiltros(A);
  api.eliminarPreferencias(A);
  almacen.valores.set(clave('borrador', A), '{roto');
  api.leerBorrador(A);
  api.comprobarDisponibilidad();
  assert.ok(!almacen.operaciones.some(([op]) => ['clear', 'key', 'length'].includes(op)));
  for (const [k, v] of Object.entries(ajenas)) assert.equal(almacen.valores.get(k), v);
  // Estático, sobre el código sin comentarios: sin clear/key y un único acceso a
  // localStorage, el de resolución del almacenamiento por defecto.
  assert.doesNotMatch(codigo, /\.clear\s*\(|\.key\s*\(/);
  assert.deepEqual(codigo.match(/\w*\.?localStorage\b[^\n]*/g), ['globalThis.localStorage;']);
  assert.doesNotMatch(fuente, /agente_historial/, 'no implementa memoria del agente');
});

test('16. rechaza imágenes, archivos y datos binarios', () => {
  const { api, almacen } = entorno();
  const binarios = [new Uint8Array([1, 2, 3]), new ArrayBuffer(4), new Blob(['x']), new File(['x'], 'foto.png')];
  for (const binario of binarios) {
    rechaza(api.guardarBorrador(A, { ...borrador(), titulo: binario }), 'DATO_NO_PERMITIDO');
    rechaza(api.guardarBorrador(A, { ...borrador(), foto: binario }), 'DATO_NO_PERMITIDO');
  }
  for (const texto of ['data:image/png;base64,iVBORw0KGgo=', 'DATA:image/jpeg,abc', 'data:text/plain;charset=utf-8,hola',
    'data:;base64,QUJD', 'blob:http://localhost/1234-abcd', 'blob:https://campusloop.example/abcd', 'blob:null/1234',
    BASE64, BASE64URL, `inicio ${BASE64} fin`]) {
    rechaza(api.guardarBorrador(A, { descripcion: `foto: ${texto}` }), 'DATO_NO_PERMITIDO');
  }
  for (const campo of ['imagen', 'fotos', 'archivo', 'imagenBase64']) {
    rechaza(api.guardarBorrador(A, { ...borrador(), [campo]: 'x' }), 'DATO_NO_PERMITIDO');
  }
  assert.equal(almacen.valores.size, 0);
  // Las funciones de validación son públicas y coherentes con la escritura.
  rechaza(validarBorrador({ foto: new Blob(['x']) }), 'DATO_NO_PERMITIDO');
  assert.equal(validarBorrador(borrador()).ok, true);
  assert.equal(validarFiltros(filtros()).ok, true);
  assert.equal(validarPreferencias({}).ok, true);
});

test('16b. texto legítimo no se confunde con contenido prohibido', () => {
  const { api, almacen } = entorno();
  const descripciones = [
    'Libro de base de datos: SQL, Oracle', 'Curso Big data:2024, edición nueva', 'Big data: libros, apuntes',
    `Incluye:\n${'-'.repeat(120)}\nfin`, '_'.repeat(125), '='.repeat(130), 'A'.repeat(200),
    'Juego de mesa Blob:Party, completo', 'Blob de pintura acrílica', 'Apuntes de seguridad: service_role y RLS',
    `Ver https://ejemplo.pe/${'libro-de-calculo-diferencial-e-integral-stewart-octava-edicion-con-ejercicios-resueltos-y-solucionario-completo-2026'}`,
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing',
    'Cuaderno ñandú 📚✏️ con tildes áéíóú', 'Línea\tcon tabulación', 'Token de metro incluido', 'Rol de pintura',
    'Archivo de palanca A4 y carpeta de fotos', 'eyJ no es un JWT completo',
  ];
  for (const descripcion of descripciones) {
    const resultado = api.guardarBorrador(A, { descripcion });
    assert.equal(resultado.ok, true, `descripción rechazada: ${descripcion.slice(0, 40)}`);
    assert.equal(api.leerBorrador(A).datos.contenido.descripcion, descripcion);
  }
  for (const titulo of ['Big data:2024', 'Blob:Party', 'Calculadora Casio fx-991', 'service_role (libro)']) {
    assert.equal(api.guardarBorrador(A, { titulo }).ok, true, `título rechazado: ${titulo}`);
  }
  for (const busqueda of ['big data:2024', 'blob:party', 'service_role', '-'.repeat(120), 'A'.repeat(120)]) {
    assert.equal(api.guardarFiltros(A, { ...filtrosIniciales(), busqueda }).ok, true, `búsqueda rechazada: ${busqueda}`);
  }
  assert.ok(almacen.valores.size > 0);
});

test('16c. UUID válidos en mayúsculas se conservan exactamente', () => {
  const { api, almacen } = entorno();
  const CAT_M = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  const UNI_M = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';
  const CAMPUS_M = 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC';
  assert.equal(validarBorrador({ categoriaId: CAT_M }).datos.categoriaId, CAT_M);
  assert.equal(api.guardarBorrador(A, { ...borrador(), categoriaId: CAT_M }).datos.contenido.categoriaId, CAT_M);
  assert.equal(JSON.parse(almacen.valores.get(clave('borrador', A))).datos.categoriaId, CAT_M);
  assert.equal(api.leerBorrador(A).datos.contenido.categoriaId, CAT_M);
  const conMayusculas = { ...filtros(), categorias: [CAT_M, CAT], universidad: UNI_M, campus: CAMPUS_M };
  assert.deepEqual(plano(api.guardarFiltros(A, conMayusculas).datos.contenido), conMayusculas);
  assert.deepEqual(JSON.parse(almacen.valores.get(clave('filtros', A))).datos, conMayusculas);
  assert.deepEqual(plano(api.leerFiltros(A).datos.contenido), conMayusculas);
});

test('17. usuario ausente o inválido: no accede al almacenamiento', () => {
  const { api, almacen } = entorno();
  for (const id of [undefined, null, '', 'anonimo', 'usuario-123', A.slice(0, -1), `${A}x`, 123, { id: A },
    '../borrador', '00000000-0000-0000-0000-000000000000']) {
    rechaza(api.guardarBorrador(id, borrador()), 'IDENTIDAD_INVALIDA');
    rechaza(api.leerBorrador(id), 'IDENTIDAD_INVALIDA');
    rechaza(api.eliminarBorrador(id), 'IDENTIDAD_INVALIDA');
    rechaza(api.guardarFiltros(id, filtros()), 'IDENTIDAD_INVALIDA');
    rechaza(api.leerFiltros(id), 'IDENTIDAD_INVALIDA');
    rechaza(api.eliminarFiltros(id), 'IDENTIDAD_INVALIDA');
    rechaza(api.guardarPreferencias(id, {}), 'IDENTIDAD_INVALIDA');
    rechaza(api.leerPreferencias(id), 'IDENTIDAD_INVALIDA');
    rechaza(api.eliminarPreferencias(id), 'IDENTIDAD_INVALIDA');
  }
  assert.equal(almacen.operaciones.length, 0);
  assert.equal(almacen.valores.size, 0);
});

test('mensajes de error sin clave, usuario ni contenido', () => {
  const { api, almacen } = entorno();
  almacen.valores.set(clave('borrador', A), '{"secreto":');
  almacen.fallos.removeItem = new Error(`detalle interno ${A}`);
  const errores = [api.leerBorrador(A), api.eliminarBorrador(A), api.guardarBorrador('x', {}),
    api.guardarBorrador(A, { contrasena: 'x' })].map(r => JSON.stringify(r.error));
  for (const texto of errores) assert.doesNotMatch(texto, new RegExp(`${A}|campusloop_tb4|secreto|detalle interno`));
});

test('fábrica tolerante: opciones inválidas no lanzan', () => {
  for (const opciones of [null, 5, 'x']) {
    assert.doesNotThrow(() => crearAlmacenamientoLocal(opciones));
  }
  const sinReloj = crearAlmacenamientoLocal({ almacenamiento: new StorageSimulado(), ahora: () => NaN });
  rechaza(sinReloj.guardarBorrador(A, borrador()), 'CONFIGURACION');
});

test('fábrica: getters y proxies hostiles devuelven CONFIGURACION sin lanzar', () => {
  const hostiles = [
    { get almacenamiento() { throw new Error('getter'); } },
    { almacenamiento: new StorageSimulado(), get ahora() { throw new Error('getter'); } },
    new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('proxy'); } }),
    new Proxy({ almacenamiento: null }, { get() { throw new Error('proxy'); } }),
  ];
  for (const opciones of hostiles) {
    let api;
    assert.doesNotThrow(() => { api = crearAlmacenamientoLocal(opciones); });
    rechaza(api.comprobarDisponibilidad(), 'CONFIGURACION');
    rechaza(api.guardarBorrador(A, borrador()), 'CONFIGURACION');
    rechaza(api.leerBorrador(A), 'CONFIGURACION');
    rechaza(api.eliminarBorrador(A), 'CONFIGURACION');
    rechaza(api.guardarFiltros(A, filtros()), 'CONFIGURACION');
    rechaza(api.leerFiltros(A), 'CONFIGURACION');
    rechaza(api.guardarPreferencias(A, {}), 'CONFIGURACION');
    rechaza(api.leerPreferencias(A), 'CONFIGURACION');
    rechaza(api.eliminarFiltros(A), 'CONFIGURACION');
    rechaza(api.eliminarPreferencias(A), 'CONFIGURACION');
  }
  // Proxy sin propiedades propias: su trampa `get` no se alcanza y se usan los valores por defecto.
  let porDefecto;
  assert.doesNotThrow(() => { porDefecto = crearAlmacenamientoLocal(errorHostil()); });
  assert.equal(typeof porDefecto.leerBorrador(A).ok, 'boolean');
  // Storage cuyos métodos se definen con getters que lanzan: no disponible.
  const almacenHostil = { get getItem() { throw new Error('x'); }, setItem() {}, removeItem() {} };
  rechaza(crearAlmacenamientoLocal({ almacenamiento: almacenHostil }).leerBorrador(A), 'ALMACENAMIENTO_NO_DISPONIBLE');
});

// Carga del módulo en un contexto aislado: sin imports, red ni globals del navegador.
async function cargarAislado({ localStorageBloqueado = false } = {}) {
  const control = { red: 0 };
  const prohibido = () => { control.red++; throw new Error('Red prohibida'); };
  const globales = { TextEncoder, fetch: prohibido, XMLHttpRequest: prohibido, WebSocket: prohibido,
    EventSource: prohibido, navigator: { sendBeacon: prohibido } };
  if (localStorageBloqueado) {
    Object.defineProperty(globales, 'localStorage', { get() { throw errorNombrado('SecurityError', 18); } });
  }
  const contexto = vm.createContext(globales);
  const modulo = new SourceTextModule(fuente, { context: contexto,
    importModuleDynamically() { control.red++; throw new Error('Importación prohibida'); } });
  await modulo.link(() => { throw new Error('Dependencia no permitida'); });
  await modulo.evaluate();
  return { api: modulo.namespace, contexto, control };
}

test('18. sin dependencias de red: ciclo completo en contexto aislado', { skip: SIN_VM }, async () => {
  const { api, contexto, control } = await cargarAislado();
  // Objetos creados dentro del contexto aislado, como los crearía la propia página.
  contexto.api = api;
  contexto.almacen = vm.runInContext(`({ v: new Map(), getItem(k) { return this.v.has(k) ? this.v.get(k) : null; },
    setItem(k, x) { this.v.set(k, x); }, removeItem(k) { this.v.delete(k); } })`, contexto);
  const resultado = await vm.runInContext(`(() => {
    const a = api.crearAlmacenamientoLocal({ almacenamiento: almacen });
    const id = '${A}';
    return [a.guardarBorrador(id, { titulo: 'Libro' }).ok, a.leerBorrador(id).datos.contenido.titulo,
      a.guardarFiltros(id, { busqueda: '', categorias: [], universidad: '', campus: '', estados: [], condiciones: [],
        precioMinimoCentimos: null, precioMaximoCentimos: null, orden: 'recientes' }).ok,
      a.guardarPreferencias(id, {}).ok, a.eliminarBorrador(id).ok, a.leerBorrador(id).datos];
  })()`, contexto);
  assert.deepEqual(plano(resultado), [true, 'Libro', true, true, true, null]);
  assert.equal(control.red, 0);
});

test('18b. sin dependencias de red: análisis estático del código', () => {
  assert.doesNotMatch(codigo, /^\s*import\s|\bimport\s*\(|\brequire\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/m);
  assert.doesNotMatch(codigo, /supabase|\bdocument\.|\bwindow\./i);
});
