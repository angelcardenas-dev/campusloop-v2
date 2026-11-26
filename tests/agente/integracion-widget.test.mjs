import test from 'node:test';
import assert from 'node:assert/strict';
import { conectarClienteWidget } from '../../js/agente-integracion-widget.js';
import { crearClienteAgente } from '../../js/agente-cliente.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const bien = datos => ({ ok: true, datos, error: null });
const diferida = () => { let resolver, rechazar; const promesa = new Promise((a, b) => { resolver = a; rechazar = b; }); return { promesa, resolver, rechazar }; };
const pausa = () => new Promise(resolve => setTimeout(resolve, 0));
const mensaje = texto => bien({ tipo: 'mensaje', mensaje: texto });

function entorno({ id = A, sesionId = S1, verificar, solicitar = async () => mensaje('Respuesta sintética'),
  timeoutMs = 1000 } = {}) {
  const estado = { id, sesionId, consultas: 0, llamadas: [], salidas: [], avisos: [], limpiezas: 0,
    auth: null, cierre: null, envios: null, cancelacion: null, desmontado: false };
  const widget = {
    escucharEnvios(f) { estado.envios = f; return () => { estado.envios = null; }; },
    escucharCancelacion(f) { estado.cancelacion = f; return () => { estado.cancelacion = null; }; },
    finalizarSolicitud(aviso) { estado.avisos.push(aviso); },
    presentarSalida(datos) { estado.salidas.push(structuredClone(datos)); return true; },
    limpiarPorIdentidad() { estado.limpiezas++; estado.salidas.length = 0; estado.cancelacion?.(); },
    limpiarSesionAgente() { estado.limpiezas++; estado.salidas.length = 0; },
  };
  const cliente = { solicitar(args) { estado.llamadas.push(structuredClone({ mensaje: args.mensaje, contexto: args.contexto })); return solicitar(args); },
    cancelarPendientes() {} };
  const auth = {
    obtenerUsuarioActual: verificar ?? (async opciones => {
      estado.consultas++; assert.equal(opciones.verificarSesionMemoria, true);
      return estado.id ? bien({ id: estado.id, sesionId: estado.sesionId }) : bien(null);
    }),
    escucharCambiosAuth(f) { estado.auth = f; return () => { estado.auth = null; }; },
    escucharCierreSesionLocal(f) { estado.cierre = f; return () => { estado.cierre = null; }; },
  };
  const conexion = conectarClienteWidget({ widget, cliente, auth, timeoutMs });
  return { estado, conexion, widget };
}

test('envío válido usa solo mensaje actual y contexto vacío; no persiste datos', async () => {
  const e = entorno(); await e.estado.envios('Hola');
  assert.deepEqual(e.estado.llamadas, [{ mensaje: 'Hola', contexto: [] }]);
  assert.equal(e.estado.salidas[0].mensaje, 'Respuesta sintética');
  assert.equal(e.estado.consultas, 2); e.conexion.desmontar();
});

test('sin sesión, identidad anónima o respuesta incompatible no invocan el cliente', async () => {
  const e = entorno({ id: null }); await e.estado.envios('Hola');
  assert.equal(e.estado.llamadas.length, 0); e.conexion.desmontar();
  const f = entorno(); f.estado.id = 'anon'; await f.estado.envios('Hola');
  assert.equal(f.estado.llamadas.length, 0); f.conexion.desmontar();
});

test('id y sesionId exigen strings UUID, sin conversión implícita', async () => {
  for (const datos of [{ id: { toString: () => A }, sesionId: S1 },
    { id: A, sesionId: { toString: () => S1 } }, { id: A, sesionId: 123 },
    { id: [A], sesionId: S1 }]) {
    const e = entorno({ verificar: () => bien(datos) });
    await e.estado.envios('Hola'); assert.equal(e.estado.llamadas.length, 0);
    e.conexion.desmontar();
  }
});

test('respuesta contradictoria e incompleta no se presentan', async () => {
  for (const respuesta of [{ ok: true, datos: { tipo: 'mensaje', mensaje: 'falso' }, error: { codigo: 'RED' } },
    { ok: true, datos: { tipo: 'mensaje', mensaje: '' }, error: null }, { ok: false, datos: { tipo: 'mensaje', mensaje: 'falso' }, error: null }]) {
    const e = entorno({ solicitar: async () => respuesta }); await e.estado.envios('Hola');
    assert.equal(e.estado.salidas.length, 0); assert.match(e.estado.avisos.at(-1), /No se pudo/); e.conexion.desmontar();
  }
});

test('logout y cambio de cuenta descartan resultados tardíos; misma cuenta con nueva sesión también', async () => {
  for (const cambio of ['logout', 'otra-cuenta', 'misma-cuenta']) {
    const d = diferida(), e = entorno({ solicitar: () => d.promesa });
    const envio = e.estado.envios('Primero'); await pausa();
    if (cambio === 'logout') { e.estado.id = null; e.estado.cierre(); }
    if (cambio === 'otra-cuenta') { e.estado.id = B; e.estado.sesionId = S2; e.estado.auth(); }
    if (cambio === 'misma-cuenta') { e.estado.sesionId = S2; e.estado.auth(); }
    d.resolver(mensaje('Privado anterior')); await envio;
    assert.equal(e.estado.salidas.length, 0); assert.equal(e.estado.limpiezas, 1);
    e.conexion.desmontar();
  }
});

test('doble envío, cancelación, timeout y rechazo tardío no alteran una operación nueva', async () => {
  const d = diferida(), e = entorno({ solicitar: ({ mensaje: texto }) => texto === 'Primero' ? d.promesa : Promise.resolve(mensaje('Segundo')), timeoutMs: 30 });
  const primero = e.estado.envios('Primero'); await pausa();
  await e.estado.envios('Duplicado'); assert.equal(e.estado.llamadas.length, 1);
  e.estado.cancelacion(); await primero;
  await e.estado.envios('Segundo'); assert.equal(e.estado.salidas.at(-1).mensaje, 'Segundo');
  d.rechazar(new Error('token privado')); await pausa();
  assert.equal(e.estado.salidas.length, 1); e.conexion.desmontar();
  const nunca = entorno({ solicitar: () => new Promise(() => {}), timeoutMs: 5 });
  await nunca.estado.envios('Espera'); assert.match(nunca.estado.avisos.at(-1), /tiempo de espera/); nunca.conexion.desmontar();
});

test('revalidación final impide respuesta de otra sesión aun sin evento Auth', async () => {
  const d = diferida(), e = entorno({ solicitar: () => d.promesa });
  const envio = e.estado.envios('Hola'); await pausa(); e.estado.sesionId = S2;
  d.resolver(mensaje('Privado')); await envio;
  assert.equal(e.estado.salidas.length, 0); assert.equal(e.estado.limpiezas, 1); e.conexion.desmontar();
});

test('desmontaje cancela y elimina suscripciones, sin escribir en montaje posterior', async () => {
  const d = diferida(), e = entorno({ solicitar: () => d.promesa });
  const envio = e.estado.envios('Hola'); await pausa(); e.conexion.desmontar();
  d.resolver(mensaje('Viejo')); await envio;
  assert.equal(e.estado.salidas.length, 0); assert.equal(e.estado.auth, null);
  assert.equal(e.estado.envios, null);
});

test('identidad pendiente cancelada y timeout no invocan el cliente', async () => {
  const d = diferida(), e = entorno({ verificar: () => d.promesa });
  const envio = e.estado.envios('Hola'); e.estado.cancelacion(); await envio;
  assert.equal(e.estado.llamadas.length, 0);
  d.rechazar(new Error('credencial interna')); await pausa(); e.conexion.desmontar();
  const t = entorno({ verificar: () => new Promise(() => {}), timeoutMs: 5 });
  await t.estado.envios('Hola'); assert.equal(t.estado.llamadas.length, 0);
  assert.match(t.estado.avisos.at(-1), /tiempo de espera/); t.conexion.desmontar();
});

test('revalidación pendiente puede cancelarse y no presenta el dato privado', async () => {
  const d = diferida(); let consultas = 0;
  const e = entorno({ verificar: () => ++consultas === 1 ? bien({ id: A, sesionId: S1 }) : d.promesa,
    solicitar: () => mensaje('No mostrar') });
  const envio = e.estado.envios('Hola'); await pausa(); e.estado.cancelacion();
  d.resolver(bien({ id: A, sesionId: S1 })); await envio;
  assert.equal(e.estado.salidas.length, 0); e.conexion.desmontar();
});

test('reservas y borrador se mantienen separados y nunca regresan en contexto', async () => {
  const reserva = bien({ tipo: 'resultado_titular', datos: { destino: 'titular', reservas: [{ id: B, estado: 'pendiente' }] } });
  const borrador = bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título sintético', descripcion: 'Descripción sintética' }, requiereRevisionHumana: true } });
  let n = 0; const e = entorno({ solicitar: async () => [reserva, borrador][n++] });
  await e.estado.envios('Mis reservas'); await e.estado.envios('Preparar borrador');
  assert.deepEqual(e.estado.salidas.map(s => s.tipo), ['resultado_titular', 'borrador_revisable']);
  assert.deepEqual(e.estado.llamadas.map(s => s.contexto), [[], []]);
  assert.equal(e.estado.llamadas.some(s => JSON.stringify(s).includes(B)), false);
  e.conexion.desmontar();
});

test('error de red y sesión vencida se clasifican sin mensajes privados', async () => {
  const e = entorno({ solicitar: async () => ({ ok: false, datos: null,
    error: { codigo: 'NO_AUTORIZADO', mensaje: 'token secreto' } }) });
  await e.estado.envios('Hola'); assert.match(e.estado.avisos.at(-1), /Inicia sesión/);
  assert.doesNotMatch(e.estado.avisos.at(-1), /secreto/); e.conexion.desmontar();
  const f = entorno({ verificar: () => ({ ok: false, datos: null, error: { codigo: 'RED', mensaje: 'url privada' } }) });
  await f.estado.envios('Hola'); assert.match(f.estado.avisos.at(-1), /No se pudo conectar/);
  assert.doesNotMatch(f.estado.avisos.at(-1), /privada/); f.conexion.desmontar();
});

test('flujo offline real del cliente D3: POST propio, token solo en cabecera y ninguna fuga en contexto', async () => {
  const pedidos = [], secreto = 'token-sintetico-solo-prueba';
  const cliente = crearClienteAgente({ obtenerToken: async () => secreto,
    fetchImpl: async (ruta, opciones) => {
      const cuerpo = JSON.parse(opciones.body);
      pedidos.push({ ruta, metodo: opciones.method, cuerpo, cabecera: opciones.headers.authorization });
      return Response.json({ ok: true, datos: { tipo: 'mensaje', mensaje: 'Respuesta sintética' },
        error: null, solicitudId: cuerpo.solicitudId });
    } });
  const e = entorno(); e.conexion.desmontar();
  const conexion = conectarClienteWidget({ widget: e.widget, cliente, auth: {
    obtenerUsuarioActual: async () => bien({ id: A, sesionId: S1 }),
    escucharCambiosAuth: () => () => {}, escucharCierreSesionLocal: () => () => {},
  } });
  await e.estado.envios('Consulta sintética');
  assert.equal(pedidos[0].ruta, '/api/agente'); assert.equal(pedidos[0].metodo, 'POST');
  assert.equal(pedidos[0].cabecera, `Bearer ${secreto}`);
  assert.deepEqual(pedidos[0].cuerpo.contexto, []);
  assert.doesNotMatch(JSON.stringify(pedidos[0].cuerpo), /token-sintetico|aaaaaaaa-aaaa/);
  assert.equal(e.estado.salidas[0].mensaje, 'Respuesta sintética'); conexion.desmontar();
});
