import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearMemoriaAgente, crearClaveMemoria, validarContextoPermitido, resumirContexto, POLITICA_PROVISIONAL_MEMORIA } from '../../js/agente-memoria.js';

// UUID exclusivamente sintéticos: no identifican cuentas o catálogos de Supabase.
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const CAT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAT2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const instante = Date.parse('2026-11-22T18:00:00.000Z');
const contexto = () => ({ tipo: 'busqueda_catalogo', precioMaximoCentimos: 10000, orden: 'recientes' });
const opciones = { categoriasPermitidas: [CAT] };
const ok = datos => ({ ok: true, datos, error: null });
const rechaza = (r, codigo) => { assert.equal(r.ok, false); assert.equal(r.datos, null); assert.equal(r.error.codigo, codigo); };
const clave = id => crearClaveMemoria(id).datos;
function entorno() {
  const e = { sujeto: { id: A }, entrada: contexto(), tiempo: instante, valores: new Map(), llamadas: [] };
  e.puerto = {
    async leer(k, { signal }) { e.llamadas.push({ op: 'leer', k, signal }); return ok(e.valores.get(k) ?? null); },
    async guardar(k, v, { signal }) { e.llamadas.push({ op: 'guardar', k, signal }); e.valores.set(k, v); return ok(null); },
    async eliminar(k, { signal }) { e.llamadas.push({ op: 'eliminar', k, signal }); e.valores.delete(k); return ok(null); },
  };
  e.crear = (extra = {}) => crearMemoriaAgente({ almacenamiento: e.puerto, obtenerIdentidad: () => e.sujeto,
    producirContexto: () => e.entrada, ahora: () => e.tiempo, categoriasPermitidas: [CAT],
    politica: { ...POLITICA_PROVISIONAL_MEMORIA }, ...extra });
  e.memoria = e.crear(); return e;
}
const pausa = () => new Promise(resolve => setImmediate(resolve));
function diferida() { let resolve; const promesa = new Promise(r => { resolve = r; }); return { promesa, resolve }; }

test('01 contexto público y categoría del manifiesto confiable', () => {
  const r = validarContextoPermitido({ ...contexto(), categorias: [CAT], condiciones: ['usado'], estados: ['disponible'] }, opciones);
  assert.equal(r.ok, true); assert.deepEqual(r.datos.categorias, [CAT]); assert.equal(r.datos.precioMinimoCentimos, null);
});
test('02 contexto incompleto', () => rechaza(validarContextoPermitido({ tipo: 'busqueda_catalogo' }), 'CONTEXTO_INVALIDO'));
test('03 campos desconocidos', () => rechaza(validarContextoPermitido({ ...contexto(), universidad: A }), 'CONTEXTO_INVALIDO'));
test('04 tipos inválidos; no coerción de importes ni null para listas', () => {
  for (const datos of [{ categorias: null }, { estados: 'disponible' }, { precioMaximoCentimos: '10000' }, { orden: undefined }])
    rechaza(validarContextoPermitido({ ...contexto(), ...datos }, opciones), 'CONTEXTO_INVALIDO');
});
test('05 filtros fuera de contrato o categoría no verificada', () => {
  for (const datos of [{ categorias: [CAT2] }, { condiciones: ['seminuevo'] }, { estados: ['activo'] }, { orden: 'precio_asc' }])
    rechaza(validarContextoPermitido({ ...contexto(), ...datos }, opciones), 'CONTEXTO_INVALIDO');
});
test('06 importes seguros y rango coherente', () => {
  for (const p of [-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    rechaza(validarContextoPermitido({ ...contexto(), precioMaximoCentimos: p }), 'CONTEXTO_INVALIDO');
  assert.equal(validarContextoPermitido({ ...contexto(), precioMaximoCentimos: Number.MAX_SAFE_INTEGER }).ok, true);
  rechaza(validarContextoPermitido({ ...contexto(), precioMinimoCentimos: 20000 }), 'CONTEXTO_INVALIDO');
  assert.equal(validarContextoPermitido({ ...contexto(), precioMinimoCentimos: 0 }).ok, true);
});
test('07 presupuesto de tamaño antes de escribir', async () => {
  const e = entorno(), m = e.crear({ politica: { maxBytes: 100, ttlMs: 1000 } });
  rechaza(await m.actualizar(), 'TAMANO'); assert.equal(e.llamadas.length, 0);
});
test('08 resumen determinista que no afirma resultados ni ejecuta búsquedas', () => {
  assert.equal(resumirContexto(contexto()).datos,
    'Estábamos buscando artículos con presupuesto máximo de S/ 100.00 ordenados por los más recientes. Debemos volver a consultar el catálogo.');
  assert.equal(resumirContexto({ ...contexto(), precioMaximoCentimos: 10001 }).datos.includes('S/ 100.01'), true);
});
test('09 HTML rechazado; resumen construido solo de vocabulario cerrado', () => {
  rechaza(resumirContexto({ ...contexto(), orden: '<img src=x>' }), 'CONTEXTO_INVALIDO');
  assert.doesNotMatch(resumirContexto({ ...contexto(), categorias: [CAT] }, opciones).datos, /[<>]/);
});
test('10 búsqueda libre no aprobada', () => rechaza(validarContextoPermitido({ ...contexto(), busqueda: 'Texto libre' }), 'CONTEXTO_INVALIDO'));

const jwtSintetico = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.'
  + Buffer.from(JSON.stringify({ sub: 'fixture-no-real' })).toString('base64url') + '.';
for (const [numero, caso, privado] of [
  [11, 'correo', { correo: 'cuenta@example.invalid' }],
  [12, 'teléfono', { telefono: '999000111' }],
  [13, 'contraseña', { contrasena: 'NO_ES_CREDENCIAL_REAL' }],
  [14, 'JWT sintético sin firma', { token: jwtSintetico }],
  [15, 'reserva privada', { reserva: { mensajes: ['privado'] } }],
  [16, 'resultado de herramienta', { resultadoHerramienta: { cuenta: 'privada' } }],
  [17, 'instrucción de sistema', { role: 'system', content: 'Instrucción no confiable' }],
  [18, 'texto privado del modelo', { mensajeModelo: 'cuenta@example.invalid' }],
  [19, 'autodeclaración pública', { esPublico: true }],
]) {
  test(`${numero} rechazo por esquema: ${caso}`, async () => {
    const e = entorno(); e.entrada = { ...contexto(), ...privado };
    rechaza(await e.memoria.actualizar(), 'CONTEXTO_INVALIDO'); assert.equal(e.llamadas.length, 0);
    assert.equal(e.memoria.obtenerContexto(), null);
  });
}
test('20 JSON persistido con campos exactos, sin DTO ni texto libre', async () => {
  const e = entorno(); await e.memoria.actualizar(); const d = JSON.parse(e.valores.get(clave(A)));
  assert.deepEqual(Object.keys(d).sort(), ['actualizadoEn', 'contexto', 'usuarioId', 'version']);
  assert.deepEqual(Object.keys(d.contexto).sort(), ['categorias', 'condiciones', 'estados', 'orden', 'precioMaximoCentimos', 'precioMinimoCentimos', 'tipo']);
});
test('21 identidad mínima del proveedor confiable', async () => {
  const e = entorno(), r = await e.memoria.actualizar(); assert.equal(r.datos.persistido, true);
  assert.equal(JSON.parse(e.valores.get(clave(A))).usuarioId, A);
});
test('22 anónimo efímero: sin clave de invitado ni acceso al puerto', async () => {
  const e = entorno(); e.sujeto = null;
  const r = await e.memoria.actualizar(); assert.equal(r.ok, true); assert.equal(r.datos.persistido, false);
  assert.equal(e.memoria.obtenerContexto().orden, 'recientes');
  assert.equal((await e.memoria.recuperar()).datos.contexto, null); assert.equal(e.llamadas.length, 0);
});
test('23 cambio de usuario invalida inmediatamente y separa claves', async () => {
  const e = entorno(); await e.memoria.actualizar(); e.sujeto = { id: B }; e.memoria.invalidarIdentidad();
  assert.equal(e.memoria.obtenerContexto(), null);
  e.entrada = { ...contexto(), orden: 'precio-menor' }; await e.memoria.actualizar();
  assert.equal(JSON.parse(e.valores.get(clave(A))).contexto.orden, 'recientes');
  assert.equal(JSON.parse(e.valores.get(clave(B))).contexto.orden, 'precio-menor');
});
test('24 identificador inválido o identidad sobredimensionada', async () => {
  for (const sujeto of [{ id: 'no-uuid' }, { id: A, is_anonymous: true }, { id: A, correo: 'privado' }, undefined]) {
    const e = entorno(); e.sujeto = sujeto; rechaza(await e.memoria.actualizar(), 'IDENTIDAD_INVALIDA'); assert.equal(e.llamadas.length, 0);
  }
});
test('25 claves canónicas y prefijo propio', () => {
  assert.notEqual(clave(A), clave(B)); assert.match(clave(A), /^campusloop_tb4_v1_agente_historial_/);
  assert.equal(clave(A.toUpperCase()), clave(A)); rechaza(crearClaveMemoria('../sb-token'), 'IDENTIDAD_INVALIDA');
});
test('26 no restaurar A en B ni aceptar una copia cruzada del sobre', async () => {
  const e = entorno(); await e.memoria.actualizar(); e.sujeto = { id: B };
  assert.equal((await e.memoria.recuperar()).datos.contexto, null);
  e.valores.set(clave(B), e.valores.get(clave(A)));
  rechaza(await e.memoria.recuperar(), 'IDENTIDAD_INVALIDA'); assert.equal(e.memoria.obtenerContexto(), null);
});
test('27 logout: descartar RAM sin elegir todavía borrado automático persistente', async () => {
  const e = entorno(); await e.memoria.actualizar(); e.sujeto = null; e.memoria.invalidarIdentidad();
  assert.equal(e.memoria.obtenerContexto(), null); const antes = e.llamadas.length;
  assert.equal((await e.memoria.recuperar()).datos.contexto, null); assert.equal(e.llamadas.length, antes);
  assert.equal(e.valores.has(clave(A)), true); // Retención/logout productivos pendientes de ratificación.
});
test('28 guardado y recuperación simulados', async () => {
  const e = entorno(); await e.memoria.actualizar(); e.memoria.invalidarIdentidad();
  assert.equal((await e.memoria.recuperar()).datos.contexto.precioMaximoCentimos, 10000);
});
test('29 instancia nueva continúa el contexto y genera el mismo resumen seguro', async () => {
  const e = entorno(); await e.memoria.actualizar(); const otra = e.crear();
  const r = await otra.recuperar(); assert.equal(r.datos.persistido, true);
  assert.match(resumirContexto(r.datos.contexto).datos, /S\/ 100.00/);
  assert.equal(e.llamadas.filter(c => c.op === 'guardar').length, 1);
});
test('30 borrado selectivo sin clear ni claves del SDK u otra cuenta', async () => {
  const e = entorno(); e.valores.set(clave(B), 'otro-contexto'); e.valores.set('sb-fixture-auth-token', 'NO_ES_TOKEN');
  await e.memoria.actualizar(); assert.equal((await e.memoria.borrar()).ok, true);
  assert.equal(e.valores.has(clave(A)), false); assert.equal(e.valores.size, 2);
  assert.equal(e.memoria.obtenerContexto(), null);
});
test('31 JSON corrupto y forma inválida no se restauran', async () => {
  for (const v of ['{', 'null', '[]', '{"texto":"privado"}']) {
    const e = entorno(); e.valores.set(clave(A), v); rechaza(await e.memoria.recuperar(), 'FORMATO');
  }
});
test('32 versión incompatible', async () => {
  const e = entorno(); await e.memoria.actualizar(); const d = JSON.parse(e.valores.get(clave(A))); d.version = 2;
  e.valores.set(clave(A), JSON.stringify(d)); rechaza(await e.memoria.recuperar(), 'VERSION');
});
test('33 TTL vigente no se extiende al recuperar', async () => {
  const e = entorno(); await e.memoria.actualizar(); const guardado = e.valores.get(clave(A)); e.tiempo += POLITICA_PROVISIONAL_MEMORIA.ttlMs - 1;
  assert.equal((await e.memoria.recuperar()).ok, true); assert.equal(e.valores.get(clave(A)), guardado);
});
test('34 TTL vencido en el límite y en memoria', async () => {
  const e = entorno(); await e.memoria.actualizar(); e.tiempo += POLITICA_PROVISIONAL_MEMORIA.ttlMs;
  assert.equal(e.memoria.obtenerContexto(), null); rechaza(await e.memoria.recuperar(), 'EXPIRADO');
});
test('35 cuota excedida conserva únicamente contexto efímero permitido', async () => {
  const e = entorno(); e.puerto.guardar = () => ({ ok: false, error: { codigo: 'CUOTA', mensaje: 'dato privado' } });
  const r = await e.memoria.actualizar(); rechaza(r, 'CUOTA'); assert.equal(e.memoria.obtenerContexto().orden, 'recientes');
  assert.doesNotMatch(JSON.stringify(r), /dato privado/);
  e.puerto.guardar = () => { throw new DOMException('no exponer', 'QuotaExceededError'); };
  rechaza(await e.memoria.actualizar(), 'CUOTA');
});
test('36 Storage bloqueado se degrada sin excepción', async () => {
  const e = entorno(); e.puerto.guardar = () => { throw new DOMException('no exponer', 'SecurityError'); };
  rechaza(await e.memoria.actualizar(), 'ALMACENAMIENTO'); assert.ok(e.memoria.obtenerContexto());
});
test('37 error de lectura', async () => {
  const e = entorno(); e.puerto.leer = () => ({ ok: false, error: { codigo: 'LECTURA' } });
  rechaza(await e.memoria.recuperar(), 'ALMACENAMIENTO'); assert.equal(e.memoria.obtenerContexto(), null);
});
test('38 error de escritura o rechazo asíncrono', async () => {
  const e = entorno(); e.puerto.guardar = async () => { throw new Error('no exponer'); };
  rechaza(await e.memoria.actualizar(), 'ALMACENAMIENTO'); assert.ok(e.memoria.obtenerContexto());
});
test('39 error de eliminación limpia RAM sin anunciar borrado persistente', async () => {
  const e = entorno(); await e.memoria.actualizar(); e.puerto.eliminar = () => ({ ok: false });
  rechaza(await e.memoria.borrar(), 'ALMACENAMIENTO'); assert.equal(e.memoria.obtenerContexto(), null); assert.equal(e.valores.has(clave(A)), true);
});
test('40 y 41 sin red ni acceso a Web Storage global, incluso al importar', async t => {
  const nombres = ['fetch', 'localStorage', 'sessionStorage']; const originales = nombres.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  let accesos = 0;
  for (const nombre of nombres) Object.defineProperty(globalThis, nombre, { configurable: true, get() { accesos++; throw new Error('Acceso global prohibido'); } });
  t.after(() => nombres.forEach((n, i) => originales[i] ? Object.defineProperty(globalThis, n, originales[i]) : delete globalThis[n]));
  const modulo = await import('../../js/agente-memoria.js?aislado');
  const e = entorno(); const m = modulo.crearMemoriaAgente({ almacenamiento: e.puerto, obtenerIdentidad: () => ({ id: A }), producirContexto: contexto, politica: POLITICA_PROVISIONAL_MEMORIA });
  assert.equal((await m.actualizar()).ok, true); assert.equal((await m.recuperar()).ok, true);
  assert.equal(accesos, 0);
  const fuente = await readFile(new URL('../../js/agente-memoria.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /^import\s|\bfetch\s*\(|\blocalStorage\s*[.(]|\bsessionStorage\s*[.(]/m);
});

test('endurecimiento: getters, símbolos, prototipos, listas dispersas y duplicados', () => {
  const getter = { ...contexto(), get categorias() { throw new Error('No ejecutar'); } };
  for (const c of [getter, { ...contexto(), [Symbol('dato')]: 1 }, Object.assign(Object.create({ oculto: 1 }), contexto()),
    { ...contexto(), condiciones: new Array(1) }, { ...contexto(), categorias: [CAT, CAT] }, JSON.parse('{"tipo":"busqueda_catalogo","orden":"recientes","__proto__":{}}')])
    rechaza(validarContextoPermitido(c, opciones), 'CONTEXTO_INVALIDO');
});
test('restauración rechaza campos adicionales, fecha futura/inválida y exceso de bytes', async () => {
  const e = entorno(); await e.memoria.actualizar(); const d = JSON.parse(e.valores.get(clave(A)));
  for (const alterado of [{ ...d, privado: 'no' }, { ...d, actualizadoEn: 'ayer' }, { ...d, actualizadoEn: new Date(instante + 1).toISOString() }, { ...d, contexto: { ...d.contexto, texto: 'privado' } }]) {
    e.valores.set(clave(A), JSON.stringify(alterado)); rechaza(await e.memoria.recuperar(), 'FORMATO');
  }
  e.valores.set(clave(A), 'x'.repeat(24577)); rechaza(await e.memoria.recuperar(), 'TAMANO');
});
test('sin política o sin puerto explícito: funcionamiento exclusivamente efímero', async () => {
  const e = entorno();
  for (const extra of [{ politica: null }, { almacenamiento: null }]) {
    const m = e.crear(extra); assert.equal((await m.actualizar()).datos.persistido, false); assert.ok(m.obtenerContexto());
  }
  assert.equal(e.llamadas.length, 0);
});
test('invalidación cancela espera de productor y descarta su respuesta tardía', async () => {
  const e = entorno(), d = diferida(); let signal;
  const m = e.crear({ producirContexto: o => { signal = o.signal; return d.promesa; } });
  const p = m.actualizar(); await pausa(); m.invalidarIdentidad();
  assert.equal(signal.aborted, true); rechaza(await p, 'CANCELADA');
  d.resolve(contexto()); await pausa(); assert.equal(m.obtenerContexto(), null); assert.equal(e.llamadas.length, 0);
});
test('lectura tardía de A nunca aparece después del cambio a B', async () => {
  const e = entorno(); await e.memoria.actualizar(); const d = diferida(), normal = e.puerto.leer; let primera = true;
  e.puerto.leer = (...a) => primera ? (primera = false, d.promesa) : normal(...a);
  const p = e.memoria.recuperar(); await pausa(); e.sujeto = { id: B }; e.memoria.invalidarIdentidad();
  rechaza(await p, 'CANCELADA'); d.resolve(ok(e.valores.get(clave(A)))); await pausa();
  assert.equal((await e.memoria.recuperar()).datos.contexto, null);
});
test('identidad cambia sin notificación durante el productor: revalidar antes de guardar', async () => {
  const e = entorno(), d = diferida(); const m = e.crear({ producirContexto: () => d.promesa });
  const p = m.actualizar(); await pausa(); e.sujeto = { id: B }; d.resolve(contexto());
  rechaza(await p, 'CANCELADA'); assert.equal(m.obtenerContexto(), null); assert.equal(e.llamadas.length, 0);
});
test('guardados concurrentes serializados aunque un adaptador ignore abort', async () => {
  const e = entorno(), d = diferida(); let primera = true, escrituras = 0;
  e.puerto.guardar = async (k, v) => { escrituras++; if (primera) { primera = false; await d.promesa; } e.valores.set(k, v); return ok(null); };
  const viejo = e.memoria.actualizar(); await pausa(); e.entrada = { ...contexto(), orden: 'precio-menor' };
  const intermedio = e.memoria.actualizar(); await pausa(); e.entrada = { ...contexto(), orden: 'precio-mayor' };
  const nuevo = e.memoria.actualizar(); rechaza(await viejo, 'CANCELADA'); rechaza(await intermedio, 'CANCELADA'); d.resolve();
  assert.equal((await nuevo).ok, true); assert.equal(JSON.parse(e.valores.get(clave(A))).contexto.orden, 'precio-mayor');
  assert.equal(escrituras, 2, 'Solo un trabajo activo y el pendiente más reciente; sin crecimiento de la cola');
});
test('copias defensivas y desmontaje sin operaciones posteriores', async () => {
  const e = entorno(); await e.memoria.actualizar(); const c = e.memoria.obtenerContexto(); c.orden = 'alterado';
  assert.equal(e.memoria.obtenerContexto().orden, 'recientes'); e.memoria.desmontar();
  assert.equal(e.memoria.obtenerContexto(), null); rechaza(await e.memoria.recuperar(), 'CANCELADA');
});
test('reloj/configuración inválidos o proveedor de identidad fallando se deniegan', async () => {
  const e = entorno();
  for (const extra of [{ ahora: () => NaN }, { politica: { ttlMs: -1, maxBytes: 20 } }, { categoriasPermitidas: ['no-uuid'] }])
    rechaza(await e.crear(extra).actualizar(), 'CONFIGURACION');
  rechaza(await e.crear({ obtenerIdentidad: () => { throw new Error('no exponer'); } }).actualizar(), 'IDENTIDAD_INVALIDA');
});

test('continuidad 01: actualización inválida conserva el último contexto de la misma cuenta en RAM', async () => {
  const e = entorno(); assert.equal((await e.memoria.actualizar()).ok, true);
  const anterior = e.memoria.obtenerContexto();
  e.entrada = { ...contexto(), orden: 'precio-menor', busqueda: 'campo no permitido' };
  rechaza(await e.memoria.actualizar(), 'CONTEXTO_INVALIDO');
  assert.deepEqual(e.memoria.obtenerContexto(), anterior);
});

test('continuidad 02: rechazo sin guardar ni persistir campos inválidos', async () => {
  const e = entorno(); await e.memoria.actualizar();
  const guardado = e.valores.get(clave(A)), llamadas = e.llamadas.length;
  e.entrada = { ...contexto(), busqueda: 'no debe persistirse' };
  const r = await e.memoria.actualizar(); rechaza(r, 'CONTEXTO_INVALIDO');
  assert.equal(e.llamadas.length, llamadas);
  assert.equal(e.valores.get(clave(A)), guardado);
  assert.doesNotMatch(JSON.stringify(r), /no debe persistirse/);
});

test('continuidad 03: fallo no modifica la fecha ni renueva el TTL original', async () => {
  const e = entorno(), m = e.crear({ politica: { maxBytes: 24576, ttlMs: 1000 } });
  await m.actualizar(); const guardado = e.valores.get(clave(A));
  e.tiempo += 900; e.entrada = { ...contexto(), busqueda: 'rechazado' };
  rechaza(await m.actualizar(), 'CONTEXTO_INVALIDO');
  assert.equal(JSON.parse(e.valores.get(clave(A))).actualizadoEn, new Date(instante).toISOString());
  assert.equal(e.valores.get(clave(A)), guardado);
  e.tiempo = instante + 999; assert.ok(m.obtenerContexto());
  e.tiempo = instante + 1000; assert.equal(m.obtenerContexto(), null);
});

test('continuidad 04: contexto vencido antes o durante la actualización inválida no reaparece', async () => {
  for (const durante of [false, true]) {
    const e = entorno(), m = e.crear({ politica: { maxBytes: 24576, ttlMs: 1000 } });
    await m.actualizar(); const guardado = e.valores.get(clave(A)), d = diferida();
    e.tiempo += durante ? 999 : 1000; e.entrada = d.promesa;
    const p = m.actualizar(); await pausa(); e.tiempo = instante + 1000;
    d.resolve({ ...contexto(), busqueda: 'rechazado' });
    rechaza(await p, 'CONTEXTO_INVALIDO');
    assert.equal(m.obtenerContexto(), null); assert.equal(e.valores.get(clave(A)), guardado);
    assert.equal(e.llamadas.length, 1);
  }
});

test('continuidad 05: cambio A a B o identidad no verificable durante el fallo descarta A', async () => {
  for (const fase of ['inicial', 'productor']) {
    for (const sujeto of [{ id: B }, null, { id: 'invalido' }, new Error('identidad privada no disponible')]) {
      const e = entorno(), d = diferida();
      const m = e.crear({ obtenerIdentidad: () => { if (e.sujeto instanceof Error) throw e.sujeto; return e.sujeto; } });
      await m.actualizar(); const guardado = e.valores.get(clave(A)); e.entrada = d.promesa;
      if (fase === 'inicial') e.sujeto = sujeto;
      const p = m.actualizar(); await pausa(); e.sujeto = sujeto;
      d.resolve({ ...contexto(), busqueda: 'rechazado' });
      const r = await p;
      rechaza(r, sujeto === null || sujeto.id === B
        ? (fase === 'inicial' ? 'CONTEXTO_INVALIDO' : 'CANCELADA') : 'IDENTIDAD_INVALIDA');
      assert.equal(m.obtenerContexto(), null); assert.equal(e.valores.get(clave(A)), guardado);
      assert.equal(e.valores.has(clave(B)), false); assert.equal(e.llamadas.length, 1);
      assert.doesNotMatch(JSON.stringify(r), /identidad privada/);
    }
  }
});

test('continuidad 06: logout durante actualización limpia inmediatamente y cancela su recuperación', async () => {
  const e = entorno(); await e.memoria.actualizar(); const guardado = e.valores.get(clave(A)), d = diferida();
  e.entrada = d.promesa; const p = e.memoria.actualizar(); await pausa();
  e.sujeto = null; e.memoria.invalidarIdentidad(); assert.equal(e.memoria.obtenerContexto(), null);
  rechaza(await p, 'CANCELADA'); d.resolve({ ...contexto(), busqueda: 'rechazado' }); await pausa();
  assert.equal(e.memoria.obtenerContexto(), null); assert.equal(e.llamadas.length, 1);
  assert.equal(e.valores.get(clave(A)), guardado); // No decidir borrado persistente automático de logout.
});

test('continuidad 07: desmontaje durante actualización impide que reaparezca contexto anterior o nuevo', async () => {
  const e = entorno(); await e.memoria.actualizar(); const d = diferida();
  e.entrada = d.promesa; const p = e.memoria.actualizar(); await pausa();
  e.memoria.desmontar(); assert.equal(e.memoria.obtenerContexto(), null); rechaza(await p, 'CANCELADA');
  d.resolve({ ...contexto(), orden: 'precio-mayor' }); await pausa();
  assert.equal(e.memoria.obtenerContexto(), null); assert.equal(e.llamadas.length, 1);
  rechaza(await e.memoria.actualizar(), 'CANCELADA');
});

test('continuidad 08: borrar después de conservar un contexto válido limpia RAM y solo la clave propia', async () => {
  const e = entorno(); e.valores.set(clave(B), 'otro-contexto');
  await e.memoria.actualizar(); e.entrada = { ...contexto(), busqueda: 'rechazado' };
  rechaza(await e.memoria.actualizar(), 'CONTEXTO_INVALIDO'); assert.ok(e.memoria.obtenerContexto());
  const p = e.memoria.borrar(); assert.equal(e.memoria.obtenerContexto(), null);
  assert.equal((await p).ok, true); assert.equal(e.valores.has(clave(A)), false);
  assert.equal(e.valores.get(clave(B)), 'otro-contexto');
  assert.deepEqual(e.llamadas.map(c => c.op), ['guardar', 'eliminar']);
});

test('continuidad 09: error de productor se sanitiza sin crear datos; solo conserva contexto verificable', async () => {
  for (const asincrono of [false, true]) {
    for (const previo of [false, true]) {
      const e = entorno(); let fallar = false;
      const m = e.crear({ producirContexto: () => {
        if (fallar) {
          const error = new Error('EXCEPCION_PRIVADA_DEL_PRODUCTOR');
          if (asincrono) return Promise.reject(error);
          throw error;
        }
        return e.entrada;
      } });
      if (previo) await m.actualizar();
      const anterior = m.obtenerContexto(), guardado = e.valores.get(clave(A)), llamadas = e.llamadas.length;
      fallar = true; const r = await m.actualizar(); rechaza(r, 'CONFIGURACION');
      assert.doesNotMatch(JSON.stringify(r), /EXCEPCION_PRIVADA_DEL_PRODUCTOR|stack/);
      assert.deepEqual(m.obtenerContexto(), anterior); assert.equal(e.valores.get(clave(A)), guardado);
      assert.equal(e.llamadas.length, llamadas);
    }
  }
});

test('continuidad 10: productor o revalidación tardíos invalidados no sustituyen el contexto vigente', async () => {
  // Dos intentos consecutivos tampoco deben perder el contexto válido anterior.
  const e = entorno(); await e.memoria.actualizar(); const anterior = e.memoria.obtenerContexto();
  e.entrada = { ...contexto(), busqueda: 'rechazado' };
  const primero = e.memoria.actualizar(), segundo = e.memoria.actualizar();
  rechaza(await primero, 'CANCELADA'); rechaza(await segundo, 'CONTEXTO_INVALIDO');
  assert.deepEqual(e.memoria.obtenerContexto(), anterior); assert.equal(e.llamadas.length, 1);
  for (const fase of ['identidad-inicial', 'productor', 'revalidacion']) {
    const e = entorno(), d = diferida(); let lecturasIdentidad = 0, demorar = false, esperandoIdentidad = false;
    const m = e.crear({ obtenerIdentidad: () => {
      if (demorar) lecturasIdentidad++;
      if (demorar && ((fase === 'identidad-inicial' && lecturasIdentidad === 1)
        || (fase === 'revalidacion' && lecturasIdentidad === 2))) {
        esperandoIdentidad = true; return d.promesa;
      }
      return e.sujeto;
    } });
    await m.actualizar(); demorar = true;
    e.entrada = fase === 'productor' ? d.promesa : { ...contexto(), busqueda: 'rechazado' };
    const viejo = m.actualizar(); await pausa();
    assert.equal(esperandoIdentidad, fase !== 'productor', 'Ejecutar realmente la espera de identidad elegida');
    if (fase === 'identidad-inicial') assert.equal(m.obtenerContexto(), null, 'Identidad sin resolver: no exponer contexto previo');
    m.invalidarIdentidad();
    assert.equal(m.obtenerContexto(), null); rechaza(await viejo, 'CANCELADA');
    e.entrada = { ...contexto(), orden: 'precio-mayor' }; assert.equal((await m.actualizar()).ok, true);
    const vigente = m.obtenerContexto(), guardado = e.valores.get(clave(A));
    // Incluso una identidad tardía distinta no debe invalidar la operación nueva.
    d.resolve(fase === 'productor' ? contexto() : { id: B }); await pausa();
    assert.deepEqual(m.obtenerContexto(), vigente); assert.equal(vigente.orden, 'precio-mayor');
    assert.equal(e.valores.get(clave(A)), guardado); assert.equal(e.llamadas.length, 2);
  }
});
