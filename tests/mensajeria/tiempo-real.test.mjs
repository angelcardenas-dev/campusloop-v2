import test from 'node:test';
import assert from 'node:assert/strict';
import { suscribirMensajes } from '../../js/mensajeria-tiempo-real.js';

const actor = '00000000-0000-4000-8000-000000000072';
const otro = '00000000-0000-4000-8000-000000000073';
const sesionA = '00000000-0000-4000-8000-000000000074';
const sesionB = '00000000-0000-4000-8000-000000000075';
const conversacionId = '00000000-0000-4000-8000-000000000079';
const fecha = '2026-11-25T00:00:00.123456+00:00';
const esperar = () => new Promise(resolve => setTimeout(resolve, 15));

function doble({ usuario = actor, sesion = sesionA } = {}) {
  let evento, estado, authEvento;
  let actual = usuario, sesionActual = sesion, eliminados = 0, consultas = 0;
  const canal = { on(_tipo, _filtro, callback) { evento = callback; return this; },
    subscribe(callback) { estado = callback; return this; } };
  const sdk = {
    auth: { getUser: async () => ({ data: { user: actual ? { id: actual, is_anonymous: false } : null } }),
      getSession: async () => ({ data: { session: { access_token: 'token-sintetico-a', user: { id: actor } } } }),
      onAuthStateChange(callback) { authEvento = callback; return { data: { subscription: { unsubscribe() {} } } }; } },
    from() { return { select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: { id: conversacionId, comprador_id: actor, vendedor_id: otro } }) }; },
    channel: () => canal,
    async removeChannel() { eliminados++; },
  };
  return { sdk, disparar: () => evento?.(), conectar: valor => estado?.(valor ?? 'SUBSCRIBED'),
    cambiar: id => { actual = id; authEvento?.('SIGNED_IN', { user: { id } }); },
    cambiarSesion: id => { sesionActual = id; authEvento?.('SIGNED_IN', { user: { id: actual } }); },
    renovar: () => authEvento?.('TOKEN_REFRESHED', { user: { id: actual } }),
    perder: () => { actual = null; },
    eventoAuth: (nombre, payload) => authEvento?.(nombre, payload),
    identidad: async () => actual ? { ok: true, datos: { id: actual, sesionId: sesionActual } }
      : { ok: true, datos: null },
    consultas: () => consultas++, eliminados: () => eliminados };
}

test('Realtime solo avisa; la consulta autorizada entrega mensajes y deduplica eventos', async () => {
  const d = doble();
  const recibidos = [];
  let lecturas = 0;
  const r = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: d.sdk }),
    obtenerIdentidad: d.identidad,
    consultar: async () => {
      lecturas++;
      return { ok: true, datos: [{ id: '00000000-0000-4000-8000-000000000075', creadoEn: fecha, posicion: 1 }] };
    },
    alRecibir: nuevos => recibidos.push(...nuevos), intervaloMs: 30000 });
  assert.equal(r.ok, true);
  await esperar(); d.disparar(); await esperar();
  assert.equal(recibidos.length, 1);
  assert.ok(lecturas >= 2);
  r.datos.desmontar(); await esperar();
  assert.equal(d.eliminados(), 1);
});

test('rechaza terceros y deja de presentar resultados al cambiar la cuenta', async () => {
  const d = doble({ usuario: '00000000-0000-4000-8000-000000000078' });
  const rechazado = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: d.sdk }), obtenerIdentidad: d.identidad, alRecibir() {} });
  assert.equal(rechazado.error.codigo, 'NO_AUTORIZADO');
  const a = doble();
  let entregas = 0;
  const r = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: a.sdk }),
    obtenerIdentidad: a.identidad,
    consultar: async () => ({ ok: true, datos: [] }), alRecibir: () => entregas++, intervaloMs: 30000 });
  a.cambiar(otro); a.disparar(); await esperar();
  assert.equal(entregas, 0);
  assert.equal(a.eliminados(), 1);
  r.datos.desmontar();
});

test('recupera mas de 50 mensajes perdidos con fechas iguales y UUID distintos', async () => {
  const d = doble();
  const vistos = [];
  const filas = Array.from({ length: 55 }, (_, i) => ({
    id: '00000000-0000-4000-8000-' + (i + 100).toString(16).padStart(12, '0'), creadoEn: fecha, posicion: i + 2,
  }));
  const cursor = { id: '00000000-0000-4000-8000-000000000001', creadoEn: fecha, posicion: 1 };
  let llamadas = 0;
  const r = await suscribirMensajes(conversacionId, { actorEsperado: actor, cursor,
    obtenerCliente: async () => ({ ok: true, datos: d.sdk }),
    obtenerIdentidad: d.identidad,
    consultar: async (_id, opciones) => {
      assert.equal(opciones.posteriores, true);
      llamadas++;
      return { ok: true, datos: llamadas === 1 ? filas.slice(0, 50) : llamadas === 2 ? filas.slice(50) : [] };
    }, alRecibir: nuevos => vistos.push(...nuevos), intervaloMs: 30000 });
  await esperar();
  assert.equal(vistos.length, 55);
  assert.equal(new Set(vistos.map(x => x.id)).size, 55);
  assert.ok(llamadas >= 2);
  r.datos.desmontar();
});

test('B04: SIGNED_IN de la misma cuenta conserva canal; logout y desconexion avisan', async () => {
  const d = doble();
  const errores = [];
  let consultas = 0;
  const r = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: d.sdk }),
    obtenerIdentidad: d.identidad,
    consultar: async () => { consultas++; return { ok: true, datos: [] }; },
    alRecibir() {}, alError: codigo => errores.push(codigo), intervaloMs: 30000 });
  await esperar();
  d.eventoAuth('SIGNED_IN', { user: { id: actor } });
  await esperar();
  assert.equal(d.eliminados(), 0);
  assert.ok(consultas >= 2);
  d.conectar('CHANNEL_ERROR');
  assert.deepEqual(errores, ['RED']);
  d.eventoAuth('SIGNED_OUT');
  assert.equal(d.eliminados(), 1);
  assert.deepEqual(errores, ['RED', 'NO_AUTORIZADO']);
  r.datos.desmontar();
  assert.equal(d.eliminados(), 1);
});

test('B04: nueva sesion de la misma cuenta y perdida silenciosa cierran con aviso', async () => {
  const a = doble(); const errores = [];
  const primera = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: a.sdk }), consultar: async () => ({ ok: true, datos: [] }),
    obtenerIdentidad: a.identidad,
    alRecibir() {}, alError: codigo => errores.push(codigo), intervaloMs: 30000 });
  try {
    a.cambiarSesion(sesionB);
    await esperar();
    assert.equal(a.eliminados(), 1);
    assert.deepEqual(errores, ['NO_AUTORIZADO']);
  } finally { primera.datos.desmontar(); }
  const b = doble(); const erroresB = [];
  const segunda = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: b.sdk }), consultar: async () => ({ ok: true, datos: [] }),
    obtenerIdentidad: b.identidad,
    alRecibir() {}, alError: codigo => erroresB.push(codigo), intervaloMs: 30000 });
  try {
    b.perder(); b.disparar(); await esperar();
    assert.equal(b.eliminados(), 1);
    assert.deepEqual(erroresB, ['NO_AUTORIZADO']);
  } finally { segunda.datos.desmontar(); }
});

test('B05: mensaje confirmado tarde mantiene posicion posterior aunque su fecha sea anterior', async () => {
  const d = doble();
  const vistos = [];
  const viejo = { id: '00000000-0000-4000-8000-000000000080', creadoEn: fecha, posicion: 1 };
  const tardio = { id: '00000000-0000-4000-8000-000000000081',
    creadoEn: '2026-11-24T23:59:59.123456+00:00', posicion: 2 };
  let insertado = false;
  const r = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: d.sdk }),
    obtenerIdentidad: d.identidad,
    consultar: async (_id, { cursor }) => ({ ok: true, datos: cursor ? (insertado ? [tardio] : []) : [viejo] }),
    alRecibir: filas => vistos.push(...filas), intervaloMs: 30000 });
  await esperar(); insertado = true; d.disparar(); await esperar();
  assert.deepEqual(vistos.map(f => f.id), [viejo.id, tardio.id]);
  r.datos.desmontar();
});

test('B04: refresh y SIGNED_IN de misma sesion conservan canal; sesion nueva y A/B/A cierran', async () => {
  const d = doble(); const errores = [];
  const r = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: d.sdk }), obtenerIdentidad: d.identidad,
    consultar: async () => ({ ok: true, datos: [] }), alRecibir() {}, alError: e => errores.push(e), intervaloMs: 30000 });
  d.renovar(); d.eventoAuth('SIGNED_IN', { user: { id: actor }, session_id: sesionA }); await esperar();
  assert.equal(d.eliminados(), 0);
  d.cambiarSesion(sesionB); await esperar();
  assert.equal(d.eliminados(), 1);
  assert.deepEqual(errores, ['NO_AUTORIZADO']);
  r.datos.desmontar();

  const ab = doble(); const erroresAB = [];
  const segundo = await suscribirMensajes(conversacionId, { actorEsperado: actor,
    obtenerCliente: async () => ({ ok: true, datos: ab.sdk }), obtenerIdentidad: ab.identidad,
    consultar: async () => ({ ok: true, datos: [] }), alRecibir() {}, alError: e => erroresAB.push(e), intervaloMs: 30000 });
  ab.cambiar(otro); ab.cambiar(actor); await esperar();
  assert.equal(ab.eliminados(), 1);
  assert.deepEqual(erroresAB, ['NO_AUTORIZADO']);
  segundo.datos.desmontar();
});
