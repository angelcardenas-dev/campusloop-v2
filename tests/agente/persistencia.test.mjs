import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { conectarMemoriaAgente } from '../../js/agente-memoria-conexion.js';
import { crearAdaptadorStorageAgente } from '../../js/agente-storage-adaptador.js';
import { crearAlmacenamientoLocal } from '../../js/localstorage.js';
import { crearClaveMemoria, POLITICA_PROVISIONAL_MEMORIA as politica } from '../../js/agente-memoria.js';

// Identidad, reloj y Storage sintéticos. Web Storage nativo se prueba en navegador.test.mjs.
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const clave = id => crearClaveMemoria(id).datos;
const contexto = () => ({ tipo: 'busqueda_catalogo', orden: 'recientes', precioMaximoCentimos: 10000 });
const bien = datos => ({ ok: true, datos, error: null });
const pausa = () => new Promise(r => setImmediate(r));
function diferida() { let resolver; const promesa = new Promise(r => { resolver = r; }); return { promesa, resolver }; }
function widget() {
  const w = { estado: null, eleccion: null, acciones: new Set(), borrador: 'texto efímero', limpiezas: 0, historial: [] };
  w.prepararConsentimientoMemoria = o => { w.eleccion = { ...o }; };
  w.presentarMemoria = o => { w.estado = { ...o }; };
  w.limpiarMemoria = () => { w.estado = null; };
  w.borrarHistorial = () => { w.historial = []; w.limpiarMemoria(); };
  w.limpiarPorIdentidad = () => { w.limpiezas++; w.borrador = ''; w.borrarHistorial(); };
  w.escucharAccionesMemoria = cb => { w.acciones.add(cb); return () => w.acciones.delete(cb); };
  w.emitir = accion => Promise.all([...w.acciones].map(cb => cb(accion)));
  return w;
}
function storage() {
  return { valores: new Map(), operaciones: [], fallos: {},
    getItem(k) { this.operaciones.push(['leer', k]); if (this.fallos.leer) throw this.fallos.leer; return this.valores.get(k) ?? null; },
    setItem(k, v) { this.operaciones.push(['guardar', k]); if (this.fallos.guardar) throw this.fallos.guardar; this.valores.set(k, v); },
    removeItem(k) { this.operaciones.push(['eliminar', k]); if (this.fallos.eliminar) throw this.fallos.eliminar; this.valores.delete(k); } };
}
function entorno() {
  const e = { almacen: storage(), w: widget(), id: A, reloj: Date.parse('2026-11-22T18:00:00Z'),
    entrada: contexto(), consultas: 0, notificaciones: new Set(), cancelaciones: 0 };
  e.auth = { obtenerUsuarioActual: () => { e.consultas++; return bien(e.id === null ? null : { id: e.id, correo: 'no debe proyectarse' }); },
    escucharCambiosAuth: cb => { e.notificaciones.add(cb); return () => { e.cancelaciones++; e.notificaciones.delete(cb); }; } };
  e.crear = (w = e.w, extra = {}) => conectarMemoriaAgente({ widget: w, autorizada: true, politica,
    producirContexto: () => e.entrada, ahora: () => e.reloj, almacenamiento: e.almacen, auth: e.auth, ...extra });
  e.c = e.crear(); e.consentir = () => e.w.emitir('consentir');
  e.notificar = () => { for (const cb of e.notificaciones) cb({ evento: 'SIGNED_OUT', usuario: null }); };
  return e;
}

test('montaje predeterminado: sin configuración ni consentimiento, cero Auth y cero IO', async () => {
  const e = entorno(); e.c.desmontar();
  e.c = conectarMemoriaAgente({ widget: e.w, auth: e.auth, almacenamiento: e.almacen });
  assert.equal(e.w.eleccion.disponible, false); assert.equal(e.w.estado.estado, 'inactiva');
  await e.consentir(); assert.equal((await e.c.actualizar()).ok, false);
  assert.equal(e.consultas, 0); assert.equal(e.almacen.operaciones.length, 0);
});
test('sin configuración pública real no se inicia Auth oficial aunque se solicite activar', async () => {
  for (const auth of [undefined, null]) {
    const w = widget(), c = conectarMemoriaAgente({ widget: w, autorizada: true, politica, producirContexto: contexto, auth });
    assert.equal(w.eleccion.disponible, false); assert.equal((await c.restaurar()).ok, false); c.desmontar();
  }
});
test('consentimiento inicialmente desactivado: ni recuperación ni persistencia automática', async () => {
  const e = entorno(); assert.equal(e.consultas, 0); assert.equal(e.w.estado.estado, 'sin-consentimiento');
  assert.equal((await e.c.restaurar()).ok, false); assert.equal(e.almacen.valores.size, 0);
  await e.consentir(); assert.equal(e.w.estado.estado, 'sin-contexto'); assert.equal(e.almacen.valores.size, 0);
});
test('una conexión por widget: doble inicialización no duplica suscripciones ni consentimiento', async () => {
  const e = entorno(); assert.equal(e.crear(), e.c); assert.equal(e.notificaciones.size, 1);
  await e.consentir(); assert.equal(e.crear(), e.c); assert.equal(e.w.estado.estado, 'sin-contexto');
});
test('refresh de identidad ya verificada no borra el borrador; no autentica al actor nuevo', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  for (const evento of ['INITIAL_SESSION', 'TOKEN_REFRESHED']) {
    for (const cb of e.notificaciones) cb({ evento, usuario: { id: A } });
    assert.equal(e.w.borrador, 'texto efímero'); assert.equal(e.w.estado.estado, 'preparado');
  }
  e.id = B; for (const cb of e.notificaciones) cb({ evento: 'TOKEN_REFRESHED', usuario: { id: B } });
  assert.equal(e.w.borrador, ''); assert.equal((await e.c.restaurar()).ok, false);
});
test('continuidad con módulo compartido entre instancias y elección renovada por página', async () => {
  const e = entorno(); await e.consentir(); const r = await e.c.actualizar();
  assert.equal(r.datos.persistido, true); const json = e.almacen.valores.get(clave(A));
  assert.equal(JSON.parse(json).contexto.precioMaximoCentimos, 10000);
  assert.equal(json.includes('correo'), false); assert.equal(json.includes('texto efímero'), false);
  e.c.desmontar(); const w = widget(), otra = e.crear(w);
  assert.equal(w.estado.estado, 'sin-consentimiento'); await w.emitir('consentir');
  assert.equal(w.estado.estado, 'recordado'); assert.match(w.estado.resumen, /S\/ 100.00/);
  assert.equal(w.borrador, 'texto efímero'); assert.equal(e.almacen.valores.get(clave(A)), json);
  assert.equal(e.almacen.valores.size, 1, 'sin clave extra para consentimiento'); otra.desmontar();
});
test('revocar cancela memoria sin perder el borrador visible ni decidir borrado persistente', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  await e.w.emitir('revocar'); assert.equal(e.w.borrador, 'texto efímero');
  assert.equal(e.w.estado.estado, 'sin-consentimiento'); assert.equal((await e.c.actualizar()).ok, false);
  assert.equal(e.almacen.valores.has(clave(A)), true);
});
test('anónimo: no restaura cuenta anterior ni crea clave invitada', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); e.c.desmontar();
  e.id = null; e.w = widget(); e.c = e.crear(); const antes = e.almacen.operaciones.length;
  await e.consentir(); assert.equal(e.w.estado.estado, 'sin-sesion'); assert.equal(e.w.borrador, '');
  assert.equal(e.almacen.operaciones.length, antes); assert.equal(e.almacen.valores.size, 1);
});
test('cuentas A/B: invalida RAM inmediatamente y recupera únicamente la clave propia', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  e.id = B; e.notificar(); assert.equal(e.w.borrador, ''); assert.equal(e.w.estado.estado, 'sin-consentimiento');
  await e.consentir(); assert.equal(e.w.estado.estado, 'sin-contexto');
  assert.equal(e.almacen.operaciones.at(-1)[1], clave(B)); assert.equal(e.almacen.valores.has(clave(A)), true);
});
test('cambio de identidad detectado en verificación, aunque no haya evento', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); e.id = B;
  const r = await e.c.restaurar(); assert.equal(r.ok, false); assert.equal(e.w.borrador, '');
  assert.notEqual(e.w.estado?.estado, 'recordado');
});
for (const caso of ['error', 'uuid']) test('Auth no verificable: ' + caso, async () => {
  const e = entorno(); e.auth.obtenerUsuarioActual = () => caso === 'error' ? { ok: false } : bien({ id: 'no-uuid' });
  await e.consentir(); assert.equal(e.almacen.operaciones.length, 0);
  assert.equal(e.w.estado.estado, 'error'); assert.equal(e.w.borrador, '');
});
test('suscripción Auth fallida degrada sin excepción y sin IO', async () => {
  const e = entorno(); e.c.desmontar(); e.auth.escucharCambiosAuth = () => { throw new Error('privado'); };
  e.c = e.crear(); assert.equal(e.w.eleccion.disponible, false); await e.consentir();
  assert.equal(e.almacen.operaciones.length, 0);
});
test('logout durante restauración: respuesta Auth tardía no revela memoria', async () => {
  const e = entorno(); const d = diferida(); e.auth.obtenerUsuarioActual = () => d.promesa;
  const tarea = e.consentir(); await pausa(); e.notificar(); d.resolver(bien({ id: A })); await tarea;
  assert.equal(e.almacen.operaciones.length, 0); assert.notEqual(e.w.estado?.estado, 'recordado');
});
test('cambio de cuenta durante productor pendiente: no persiste resultado de A', async () => {
  const e = entorno(); await e.consentir(); const d = diferida(); e.c.desmontar();
  e.c = e.crear(e.w, { producirContexto: () => d.promesa }); await e.consentir();
  const tarea = e.c.actualizar(); await pausa(); e.id = B; e.notificar(); d.resolver(contexto());
  assert.equal((await tarea).ok, false); assert.equal(e.almacen.valores.size, 0);
});
test('desmontaje cancela suscripciones, productor y posteriores acciones', async () => {
  const e = entorno(), d = diferida(); e.auth.obtenerUsuarioActual = () => d.promesa;
  const tarea = e.consentir(); e.c.desmontar(); d.resolver(bien({ id: A })); await tarea;
  assert.equal(e.notificaciones.size, 0); assert.equal(e.w.acciones.size, 0);
  assert.equal(e.almacen.operaciones.length, 0); assert.equal((await e.c.restaurar()).error.codigo, 'CANCELADA');
});
test('borrado selectivo confirmado y ausencia tras nueva instancia', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); e.almacen.valores.set('ajena', 'intacta');
  assert.equal((await e.c.borrar()).ok, true); assert.equal(e.w.estado.estado, 'borrado');
  assert.deepEqual([...e.almacen.valores], [['ajena', 'intacta']]);
  await e.c.restaurar(); assert.equal(e.w.estado.estado, 'sin-contexto');
});
test('borrado fallido no anuncia éxito ni elimina otras claves', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); e.almacen.fallos.eliminar = new Error('privado');
  assert.equal((await e.c.borrar()).ok, false); assert.equal(e.w.estado.estado, 'error-borrado');
  assert.equal(e.almacen.valores.has(clave(A)), true);
});
for (const caso of ['corrupto', 'version', 'caducado', 'propietario', 'privado']) test('recuperación rechazada: ' + caso, async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  const d = JSON.parse(e.almacen.valores.get(clave(A)));
  if (caso === 'version') d.version = 9;
  if (caso === 'caducado') e.reloj += politica.ttlMs;
  if (caso === 'propietario') d.usuarioId = B;
  if (caso === 'privado') d.contexto.busqueda = '<script>texto privado sintético</script>';
  e.almacen.valores.set(clave(A), caso === 'corrupto' ? '{' : JSON.stringify(d));
  const r = await e.c.restaurar(); assert.equal(r.ok, false); assert.notEqual(e.w.estado?.estado, 'recordado');
  assert.equal(e.w.borrador, 'texto efímero');
});
for (const caso of ['lectura', 'escritura', 'cuota']) test('fallo Storage: ' + caso, async () => {
  const e = entorno(); await e.consentir();
  e.almacen.fallos[caso === 'lectura' ? 'leer' : 'guardar'] = Object.assign(new Error('no exponer'),
    { name: caso === 'cuota' ? 'QuotaExceededError' : 'SecurityError' });
  const r = await (caso === 'lectura' ? e.c.restaurar() : e.c.actualizar());
  assert.equal(r.ok, false); assert.equal(r.datos, null); assert.equal(e.almacen.valores.size, 0);
  assert.equal(e.w.borrador, 'texto efímero'); assert.doesNotMatch(JSON.stringify(r), /no exponer/);
});
test('productor inválido no persiste chat, datos privados ni campos nuevos', async () => {
  const e = entorno(); await e.consentir(); e.entrada = { ...contexto(), busqueda: 'no autorizado' };
  assert.equal((await e.c.actualizar()).ok, false); assert.equal(e.almacen.valores.size, 0);
  assert.equal(e.w.borrador, 'texto efímero');
});
test('operación superada: resultado viejo no sustituye el nuevo contexto', async () => {
  const e = entorno(); await e.consentir(); const d = diferida(); let veces = 0; e.c.desmontar();
  e.c = e.crear(e.w, { producirContexto: () => ++veces === 1 ? d.promesa : { ...contexto(), precioMaximoCentimos: 20000 } });
  await e.consentir(); const vieja = e.c.actualizar(); await pausa(); const nueva = e.c.actualizar();
  d.resolver(contexto()); await vieja; assert.equal((await nueva).ok, true);
  assert.equal(JSON.parse(e.almacen.valores.get(clave(A))).contexto.precioMaximoCentimos, 20000);
});
test('adaptador: clave ajena/arbitraria, actor anónimo y señal abortada no acceden al puerto', async () => {
  const s = storage(); let actor = A;
  const api = crearAlmacenamientoLocal({ almacenamiento: s });
  const p = crearAdaptadorStorageAgente({ almacenamiento: api, obtenerActor: () => actor });
  for (const k of [clave(B), 'sb-proyecto-auth-token', 'campusloop_tb4_v1_filtros_' + A]) assert.equal((await p.leer(k)).ok, false);
  actor = null; assert.equal((await p.eliminar(clave(A))).ok, false);
  const c = new AbortController(); c.abort(); await assert.rejects(p.leer(clave(A), { signal: c.signal }));
  assert.equal(s.operaciones.length, 0);
});
test('adaptador: cambio de actor o abort después de operación síncrona descarta resultado', async () => {
  let actor = A; const c = new AbortController();
  const p = crearAdaptadorStorageAgente({ obtenerActor: () => actor,
    almacenamiento: { leerContextoAgente: () => { actor = B; return bien('no mostrar'); },
      eliminarContextoAgente: () => { c.abort(); return bien(null); } } });
  assert.equal((await p.leer(clave(A))).ok, false); actor = A;
  await assert.rejects(p.eliminar(clave(A), { signal: c.signal }));
});
test('fronteras estáticas: sin red ni Storage directo en dominio/adaptador/conexión', async () => {
  for (const nombre of ['agente-memoria', 'agente-storage-adaptador', 'agente-memoria-conexion']) {
    const fuente = await readFile(new URL(`../../js/${nombre}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(fuente, /\bfetch\s*\(|XMLHttpRequest|\.localStorage|\.clear\s*\(/);
  }
});

// Corrección Auth D1.3B: eventos como avisos, nunca como fuente de identidad.
test('Auth evento 01: INITIAL_SESSION sin consentimiento ni identidad previa conserva el borrador', () => {
  for (const usuario of [{ id: A }, null]) {
    const e = entorno(); e.w.historial.push('mensaje local');
    const estado = { ...e.w.estado }, eleccion = { ...e.w.eleccion };
    for (const cb of e.notificaciones) cb({ evento: 'INITIAL_SESSION', usuario,
      estado: usuario ? 'AUTENTICADO' : 'NO_AUTENTICADO' });
    assert.equal(e.w.borrador, 'texto efímero'); assert.deepEqual(e.w.historial, ['mensaje local']);
    assert.equal(e.w.limpiezas, 0); assert.deepEqual(e.w.estado, estado); assert.deepEqual(e.w.eleccion, eleccion);
    assert.equal(e.consultas, 0); assert.equal(e.almacen.operaciones.length, 0); e.c.desmontar();
  }
});
for (const [n, evento] of [[2, 'INITIAL_SESSION'], [3, 'SIGNED_IN'], [5, 'TOKEN_REFRESHED']]) {
  test(`Auth evento 0${n}: ${evento} de la identidad verificada preserva contexto y consentimiento`, async () => {
    const e = entorno(); await e.consentir(); await e.c.actualizar(); e.w.historial.push('mensaje efímero');
    const estado = { ...e.w.estado }, json = e.almacen.valores.get(clave(A));
    const consultas = e.consultas, operaciones = e.almacen.operaciones.length;
    for (const cb of e.notificaciones) cb({ evento, estado: 'AUTENTICADO', usuario: { id: A } });
    assert.equal(e.w.borrador, 'texto efímero'); assert.deepEqual(e.w.historial, ['mensaje efímero']);
    assert.equal(e.w.limpiezas, 0); assert.deepEqual(e.w.estado, estado);
    assert.equal(e.almacen.valores.get(clave(A)), json, 'no renovar fecha ni TTL por un aviso');
    assert.equal(e.almacen.operaciones.length, operaciones); assert.equal(e.consultas, consultas);
    assert.equal((await e.c.restaurar()).ok, true, 'el consentimiento sigue vigente');
    assert.ok(e.consultas > consultas, 'el siguiente IO revalida con el proveedor oficial'); e.c.desmontar();
  });
}
test('Auth evento 04: SIGNED_IN diferente cancela A y su resultado tardío no sustituye B', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); const jsonA = e.almacen.valores.get(clave(A));
  e.c.desmontar(); const d = diferida(); let signal;
  e.c = e.crear(e.w, { producirContexto: o => { signal = o.signal; return d.promesa; } });
  await e.consentir(); e.w.historial.push('mensaje de A'); const pendiente = e.c.actualizar(); await pausa();
  e.id = B; for (const cb of e.notificaciones) cb({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: { id: B } });
  assert.equal(signal.aborted, true); assert.equal(e.w.borrador, ''); assert.deepEqual(e.w.historial, []);
  assert.equal((await e.c.actualizar()).ok, false, 'la cuenta B requiere nueva elección');
  await e.consentir(); assert.equal(e.w.estado.estado, 'sin-contexto');
  d.resolver(contexto()); assert.equal((await pendiente).ok, false);
  assert.equal(e.w.estado.estado, 'sin-contexto'); assert.equal(e.almacen.valores.get(clave(A)), jsonA);
  assert.equal(e.almacen.valores.has(clave(B)), false); e.c.desmontar();
});
test('Auth evento 06: SIGNED_OUT limpia RAM y cancela restauración sin borrar claves persistentes', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  const json = e.almacen.valores.get(clave(A)), original = e.auth.obtenerUsuarioActual, d = diferida();
  e.w.historial.push('mensaje privado efímero'); e.auth.obtenerUsuarioActual = () => d.promesa;
  const pendiente = e.c.restaurar(); await pausa(); e.notificar();
  assert.equal(e.w.borrador, ''); assert.deepEqual(e.w.historial, []);
  assert.equal((await e.c.actualizar()).ok, false); assert.equal(e.w.estado.estado, 'sin-consentimiento');
  e.id = null; e.auth.obtenerUsuarioActual = original; await e.consentir();
  assert.equal(e.w.estado.estado, 'sin-sesion'); d.resolver(bien({ id: A }));
  assert.equal((await pendiente).ok, false); assert.equal(e.w.estado.estado, 'sin-sesion');
  assert.equal(e.almacen.valores.get(clave(A)), json);
  assert.equal(e.almacen.operaciones.some(([op]) => op === 'eliminar'), false); e.c.desmontar();
});
test('Auth evento 07: callback antiguo después de desmontar no altera un montaje nuevo', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  const callbackViejo = [...e.notificaciones][0]; e.c.desmontar();
  e.id = B; e.w.borrador = 'borrador nuevo de B'; e.c = e.crear(); await e.consentir(); await e.c.actualizar();
  const estado = { ...e.w.estado }, limpiezas = e.w.limpiezas, operaciones = e.almacen.operaciones.length;
  for (const evento of ['SIGNED_OUT', 'INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'ERROR']) {
    callbackViejo({ evento, usuario: { id: A } });
  }
  assert.equal(e.w.borrador, 'borrador nuevo de B'); assert.deepEqual(e.w.estado, estado);
  assert.equal(e.w.limpiezas, limpiezas); assert.equal(e.almacen.operaciones.length, operaciones);
  assert.equal(e.notificaciones.size, 1); assert.equal((await e.c.restaurar()).ok, true); e.c.desmontar();
});
test('control desmontado no invalida una conexión nueva del mismo widget', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar();
  const viejo = e.c, callbackViejo = [...e.notificaciones][0]; viejo.desmontar();
  e.id = B; e.c = e.crear(); await e.consentir(); await e.c.actualizar();
  e.w.borrador = 'borrador nuevo'; e.w.historial.push('mensaje nuevo');
  const estado = { ...e.w.estado }, limpiezas = e.w.limpiezas;
  viejo.invalidarIdentidad(); callbackViejo({ evento: 'SIGNED_OUT', usuario: null }); viejo.desmontar();
  assert.equal(e.w.borrador, 'borrador nuevo'); assert.deepEqual(e.w.historial, ['mensaje nuevo']);
  assert.deepEqual(e.w.estado, estado); assert.equal(e.w.limpiezas, limpiezas);
  assert.equal(e.notificaciones.size, 1); assert.equal(e.w.acciones.size, 2);
  e.notificar(); assert.equal(e.w.borrador, ''); assert.deepEqual(e.w.historial, []);
  e.c.desmontar(); assert.equal(e.notificaciones.size, 0); assert.equal(e.w.acciones.size, 0);
});
test('Auth evento 08: avisos incompletos, incompatibles, desconocidos o ilegibles se deniegan', async () => {
  const hostil = Object.defineProperty({}, 'evento', { get() { throw new Error('no exponer'); } });
  const invalidos = [null, {}, { evento: 'INITIAL_SESSION' },
    { evento: 'INITIAL_SESSION', usuario: { id: 'invalido' } },
    { evento: 'SIGNED_IN', usuario: null },
    { evento: 'TOKEN_REFRESHED', estado: 'NO_AUTENTICADO', usuario: { id: A } },
    { evento: 'INITIAL_SESSION', estado: 'SERVIDOR', usuario: { id: A } },
    { evento: 'ERROR', usuario: { id: A } }, { evento: 'desconocido', usuario: { id: A } }, hostil];
  for (const notificacion of invalidos) {
    const e = entorno(); await e.consentir(); await e.c.actualizar(); e.w.historial.push('mensaje local');
    const json = e.almacen.valores.get(clave(A)), operaciones = e.almacen.operaciones.length;
    for (const cb of e.notificaciones) assert.doesNotThrow(() => cb(notificacion));
    assert.equal(e.w.borrador, ''); assert.deepEqual(e.w.historial, []);
    assert.notEqual(e.w.estado?.estado, 'preparado'); assert.equal((await e.c.restaurar()).ok, false);
    assert.equal(e.almacen.operaciones.length, operaciones); assert.equal(e.almacen.valores.get(clave(A)), json);
    assert.doesNotMatch(JSON.stringify(e.w.estado), /no exponer/); e.c.desmontar();
  }
});
test('Auth evento: un aviso coincidente no sustituye la revalidación de Auth antes del siguiente IO', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); const operaciones = e.almacen.operaciones.length;
  e.id = B; for (const cb of e.notificaciones) cb({ evento: 'SIGNED_IN', usuario: { id: A } });
  assert.equal((await e.c.restaurar()).ok, false);
  assert.equal(e.w.borrador, ''); assert.equal(e.almacen.operaciones.length, operaciones); e.c.desmontar();
});
test('Auth evento: INITIAL_SESSION después de revocar una identidad anterior no conserva datos ajenos', async () => {
  const e = entorno(); await e.consentir(); await e.c.actualizar(); await e.w.emitir('revocar');
  e.id = B; for (const cb of e.notificaciones) cb({ evento: 'INITIAL_SESSION', usuario: { id: B } });
  assert.equal(e.w.borrador, ''); assert.equal((await e.c.restaurar()).ok, false); e.c.desmontar();
});
