import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearCoordinadorMemoria } from '../../js/agente-memoria-coordinador.js';
import { crearClaveMemoria, POLITICA_PROVISIONAL_MEMORIA } from '../../js/agente-memoria.js';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const contexto = () => ({ tipo: 'busqueda_catalogo', orden: 'recientes', precioMaximoCentimos: 10000 });
const clave = id => crearClaveMemoria(id).datos;
const ok = datos => ({ ok: true, datos, error: null });
const pausa = () => new Promise(resolve => setImmediate(resolve));
function diferida() { let resolve; const promesa = new Promise(r => { resolve = r; }); return { promesa, resolve }; }
function dobleWidget() {
  const w = { presentacion: null, acciones: new Set(), historial: [], borrados: 0, limpiezasIdentidad: 0 };
  w.presentarMemoria = datos => { w.presentacion = { ...datos }; };
  w.limpiarMemoria = () => { w.presentacion = null; };
  w.borrarHistorial = () => { w.historial.length = 0; w.borrados++; w.limpiarMemoria(); };
  w.limpiarPorIdentidad = () => { w.limpiezasIdentidad++; w.borrarHistorial(); };
  w.escucharAccionesMemoria = callback => { w.acciones.add(callback); return () => w.acciones.delete(callback); };
  w.emitir = accion => {
    if (accion === 'borrar') w.borrarHistorial(); // El botón real notifica después de limpiar la vista.
    return Promise.all([...w.acciones].map(callback => callback(accion)));
  };
  return w;
}
function entorno() {
  const e = { identidad: { id: A }, entrada: contexto(), tiempo: Date.parse('2026-11-22T18:00:00Z'),
    valores: new Map(), llamadas: [], widget: dobleWidget() };
  const puerto = {
    leer: async (k, { signal }) => { e.llamadas.push({ op: 'leer', k, signal }); return ok(e.valores.get(k) ?? null); },
    guardar: async (k, v, { signal }) => { e.llamadas.push({ op: 'guardar', k, signal }); e.valores.set(k, v); return ok(null); },
    eliminar: async (k, { signal }) => { e.llamadas.push({ op: 'eliminar', k, signal }); e.valores.delete(k); return ok(null); },
  };
  e.puerto = puerto;
  e.crear = (widget = e.widget, extra = {}) => crearCoordinadorMemoria({ widget, almacenamiento: puerto,
    obtenerIdentidad: () => e.identidad, producirContexto: () => e.entrada, ahora: () => e.tiempo,
    politica: POLITICA_PROVISIONAL_MEMORIA, ...extra });
  e.control = e.crear(); return e;
}

test('composición explícita y único coordinador por widget; sin llamadas al crear', () => {
  const e = entorno(); assert.equal(e.crear(), e.control); assert.equal(e.widget.acciones.size, 1);
  assert.equal(e.llamadas.length, 0); assert.equal(e.widget.presentacion, null);
  e.control.desmontar(); assert.equal(e.widget.acciones.size, 0); assert.notEqual(e.crear(), e.control);
});

test('continuidad temática entre instancias: presupuesto de S/ 100, sin afirmar resultados', async () => {
  const e = entorno(); assert.equal((await e.control.actualizar()).datos.persistido, true);
  const guardado = e.valores.get(clave(A)); e.control.desmontar();
  const widget = dobleWidget(), otra = e.crear(widget); assert.equal(widget.presentacion, null);
  const r = await otra.restaurar(); assert.equal(r.ok, true); assert.equal(widget.presentacion.estado, 'recordado');
  assert.equal(widget.presentacion.resumen,
    'Estábamos buscando artículos con presupuesto máximo de S/ 100.00 ordenados por los más recientes. Debemos volver a consultar el catálogo.');
  assert.equal(e.valores.get(clave(A)), guardado); assert.deepEqual(widget.historial, []);
  assert.deepEqual(e.llamadas.map(c => c.op), ['guardar', 'leer']);
});

test('cambio de cuenta elimina presentación e historial anterior y solo recupera la clave de B', async () => {
  const e = entorno(); await e.control.actualizar(); e.widget.historial.push('texto efímero de A');
  e.identidad = { id: B }; const r = await e.control.restaurar(); assert.equal(r.datos.contexto, null);
  assert.equal(e.widget.presentacion.estado, 'sin-contexto'); assert.deepEqual(e.widget.historial, []);
  assert.equal(e.widget.limpiezasIdentidad, 1); assert.equal(e.llamadas.at(-1).k, clave(B));
});

test('sesión ausente: chat efímero, sin puerto persistente ni cuenta de invitado', async () => {
  const e = entorno(); e.identidad = null;
  assert.equal((await e.control.actualizar()).datos.persistido, false);
  assert.equal((await e.control.restaurar()).datos.contexto, null);
  assert.equal(e.widget.presentacion.estado, 'sin-sesion'); assert.equal(e.llamadas.length, 0);
  assert.equal(e.valores.size, 0);
});

test('fallo de identidad descarta contexto e historial sin exponer errores o DTO privados', async () => {
  for (const respuesta of [{ id: A, correo: 'privado@example.invalid' }, { id: 'invalido' }, undefined, new Error('EXCEPCION_PRIVADA')]) {
    const e = entorno(); e.control.desmontar(); let fallar = false;
    const c = e.crear(e.widget, { obtenerIdentidad: () => {
      if (!fallar) return { id: A }; if (respuesta instanceof Error) throw respuesta; return respuesta;
    } });
    await c.actualizar(); e.widget.historial.push('privado'); fallar = true;
    const r = await c.restaurar(); assert.equal(r.error.codigo, 'IDENTIDAD_INVALIDA');
    assert.equal(e.widget.presentacion.estado, 'error'); assert.deepEqual(e.widget.historial, []);
    assert.equal(e.llamadas.length, 1); assert.doesNotMatch(JSON.stringify([r, e.widget.presentacion]), /EXCEPCION_PRIVADA|privado@example/);
  }
});

test('logout explícito limpia síncronamente y cancela lectura aunque el puerto ignore abort', async () => {
  const e = entorno(); await e.control.actualizar(); const d = diferida();
  e.puerto.leer = () => d.promesa;
  const p = e.control.restaurar(); await pausa(); e.identidad = null; e.control.invalidarIdentidad();
  assert.equal(e.widget.presentacion, null); assert.equal((await p).error.codigo, 'CANCELADA');
  d.resolve(ok(e.valores.get(clave(A)))); await pausa(); assert.equal(e.widget.presentacion, null);
  assert.equal(e.valores.has(clave(A)), true, 'No elegir aún el borrado persistente automático en logout');
});

test('identidad pendiente y respuesta tardía de A nunca muestran su contexto después de B', async () => {
  const e = entorno(); e.control.desmontar(); const d = diferida(); let primera = true;
  const c = e.crear(e.widget, { obtenerIdentidad: () => primera ? (primera = false, d.promesa) : e.identidad });
  const vieja = c.restaurar(); assert.equal(e.widget.presentacion.estado, 'comprobando'); await pausa();
  e.identidad = { id: B }; c.invalidarIdentidad(); assert.equal((await vieja).error.codigo, 'CANCELADA');
  await c.restaurar(); const vigente = e.widget.presentacion; d.resolve({ id: A }); await pausa();
  assert.deepEqual(e.widget.presentacion, vigente); assert.equal(vigente.estado, 'sin-contexto');
  assert.deepEqual(e.llamadas.map(c => c.k), [clave(B)]);
});

test('botón de borrar preparado: cancela recuperación, borra vista y únicamente la clave propia', async () => {
  const e = entorno(); e.valores.set(clave(B), 'contexto de otra cuenta'); e.valores.set('otra-funcion', 'intacto');
  await e.control.actualizar(); e.widget.historial.push('efímero');
  const d = diferida(), guardado = e.valores.get(clave(A)); e.puerto.leer = () => d.promesa;
  const lectura = e.control.restaurar(); await pausa(); const borrado = e.widget.emitir('borrar');
  assert.deepEqual(e.widget.historial, []); assert.equal((await lectura).error.codigo, 'CANCELADA');
  d.resolve(ok(guardado)); await borrado;
  assert.equal(e.widget.borrados, 1, 'Un clic no repite el borrado ni el anuncio de bienvenida');
  assert.equal(e.widget.presentacion.estado, 'borrado'); assert.equal(e.valores.has(clave(A)), false);
  assert.equal(e.valores.size, 2); assert.equal(e.valores.get('otra-funcion'), 'intacto');
});

test('borrado fallido se comunica sin éxito falso ni restaurar datos de RAM', async () => {
  const e = entorno(); await e.control.actualizar(); e.puerto.eliminar = () => { throw new Error('NO_EXPONER'); };
  const r = await e.control.borrar(); assert.equal(r.error.codigo, 'ALMACENAMIENTO');
  assert.equal(e.widget.presentacion.estado, 'error-borrado'); assert.equal(e.valores.has(clave(A)), true);
  assert.doesNotMatch(JSON.stringify([r, e.widget.presentacion]), /NO_EXPONER|S\/ 100/);
});

test('JSON corrupto, versión incompatible y contexto expirado no se presentan', async () => {
  for (const tipo of ['corrupto', 'version', 'expirado']) {
    const e = entorno(); await e.control.actualizar(); e.control.desmontar();
    if (tipo === 'corrupto') e.valores.set(clave(A), '{');
    if (tipo === 'version') { const d = JSON.parse(e.valores.get(clave(A))); d.version = 99; e.valores.set(clave(A), JSON.stringify(d)); }
    if (tipo === 'expirado') e.tiempo += POLITICA_PROVISIONAL_MEMORIA.ttlMs;
    const r = await e.crear().restaurar(); assert.equal(r.ok, false); assert.equal(e.widget.presentacion.estado, 'error');
    assert.equal(e.widget.presentacion.resumen, undefined);
  }
});

test('lectura bloqueada se degrada a error seguro, sin historial inventado', async () => {
  const e = entorno(); e.puerto.leer = () => { throw new Error('EXCEPCION_STORAGE'); };
  const r = await e.control.restaurar(); assert.equal(r.error.codigo, 'ALMACENAMIENTO');
  assert.equal(e.widget.presentacion.estado, 'error'); assert.deepEqual(e.widget.historial, []);
  assert.doesNotMatch(JSON.stringify(r), /EXCEPCION_STORAGE/);
});

test('cuota de almacenamiento: conserva solo contexto permitido en la instancia y comunica fallo', async () => {
  const e = entorno(); e.puerto.guardar = () => ({ ok: false, error: { codigo: 'CUOTA' } });
  const r = await e.control.actualizar(); assert.equal(r.error.codigo, 'CUOTA'); assert.equal(e.valores.size, 0);
  assert.equal(e.widget.presentacion.estado, 'conservado'); assert.match(e.widget.presentacion.resumen, /S\/ 100.00/);
});

test('actualización inválida no pierde el contexto anterior ni renueva fecha o TTL', async () => {
  const e = entorno(); await e.control.actualizar(); const guardado = e.valores.get(clave(A));
  e.entrada = { ...contexto(), busqueda: 'privado@example.invalid' }; e.tiempo += 1;
  const r = await e.control.actualizar(); assert.equal(r.error.codigo, 'CONTEXTO_INVALIDO');
  assert.equal(e.widget.presentacion.estado, 'conservado'); assert.equal(e.valores.get(clave(A)), guardado);
  assert.doesNotMatch(JSON.stringify(e.widget.presentacion), /privado@example/);
});

test('campos privados, instrucciones y texto del chat nunca entran a persistencia o presentación', async () => {
  for (const extra of [{ correo: 'privado@example.invalid' }, { contrasena: 'NO_ES_REAL' }, { token: 'JWT_SINTETICO' },
    { reserva: { mensajes: ['privado'] } }, { role: 'system' }, { esPublico: true }, { busqueda: '<img src=x>' }]) {
    const e = entorno(); e.entrada = { ...contexto(), ...extra }; e.widget.historial.push('mensaje libre no clasificado');
    const r = await e.control.actualizar(); assert.equal(r.error.codigo, 'CONTEXTO_INVALIDO');
    assert.equal(e.llamadas.length, 0); assert.equal(e.widget.presentacion.estado, 'error');
    assert.doesNotMatch(JSON.stringify(e.widget.presentacion), /privado|JWT|system|img/);
  }
});

test('respuesta obsoleta de productor no sustituye la presentación nueva', async () => {
  const e = entorno(), d = diferida(); e.entrada = d.promesa;
  const vieja = e.control.actualizar(); await pausa(); e.entrada = { ...contexto(), precioMaximoCentimos: 20000 };
  await e.control.actualizar(); const vigente = e.widget.presentacion;
  assert.equal((await vieja).error.codigo, 'CANCELADA'); d.resolve(contexto()); await pausa();
  assert.deepEqual(e.widget.presentacion, vigente); assert.match(vigente.resumen, /S\/ 200.00/);
  assert.equal(e.llamadas.length, 1);
});

test('desmontaje del widget cancela operaciones, retira resumen y limpia la suscripción', async () => {
  const e = entorno(), d = diferida(); e.puerto.leer = () => d.promesa;
  const p = e.control.restaurar(); await pausa(); await e.widget.emitir('desmontar');
  assert.equal(e.widget.acciones.size, 0); assert.equal(e.widget.presentacion, null);
  assert.equal((await p).error.codigo, 'CANCELADA'); d.resolve(ok(null)); await pausa();
  assert.equal(e.widget.presentacion, null); assert.equal((await e.control.actualizar()).error.codigo, 'CANCELADA');
});

test('sin política o puerto explícitos no hay acceso al almacenamiento', async () => {
  for (const extra of [{ politica: null }, { almacenamiento: null }]) {
    const e = entorno(); e.control.desmontar(); const c = e.crear(e.widget, extra);
    assert.equal((await c.actualizar()).datos.persistido, false); await c.restaurar(); assert.equal(e.llamadas.length, 0);
  }
});

test('composición inválida falla sin exponer datos privados', () => {
  assert.throws(() => crearCoordinadorMemoria({ widget: {}, obtenerIdentidad: () => null }), /widget compatible/);
});

test('importación y ciclo del coordinador no acceden a red ni Web Storage global', async t => {
  const nombres = ['fetch', 'localStorage', 'sessionStorage'], originales = nombres.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  let accesos = 0;
  for (const n of nombres) Object.defineProperty(globalThis, n, { configurable: true, get() { accesos++; throw new Error('PROHIBIDO'); } });
  t.after(() => nombres.forEach((n, i) => originales[i] ? Object.defineProperty(globalThis, n, originales[i]) : delete globalThis[n]));
  const mod = await import('../../js/agente-memoria-coordinador.js?sin-red');
  const e = entorno(); e.control.desmontar(); const c = mod.crearCoordinadorMemoria({ widget: e.widget, obtenerIdentidad: () => ({ id: A }),
    producirContexto: contexto, almacenamiento: e.puerto, politica: POLITICA_PROVISIONAL_MEMORIA });
  await c.actualizar(); await c.restaurar(); await c.borrar(); c.desmontar(); assert.equal(accesos, 0);
  for (const f of ['../../js/agente-memoria-coordinador.js', '../../js/agente-ui.js']) {
    const fuente = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(fuente, /\bfetch\s*\(|\b(?:localStorage|sessionStorage)\s*[.(]|innerHTML/);
  }
  const montaje = await readFile(new URL('../../js/agente-montaje.js', import.meta.url), 'utf8');
  assert.doesNotMatch(montaje, /agente-memoria/);
});
