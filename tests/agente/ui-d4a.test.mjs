import test from 'node:test';
import assert from 'node:assert/strict';
import { montarAgente } from '../../js/agente-ui.js';
import { conectarClienteWidget } from '../../js/agente-integracion-widget.js';

class Nodo {
  constructor(tag, documento) {
    this.tag = tag; this.documento = documento; this.hijos = []; this.padre = null;
    this.eventos = new Map(); this.atributos = new Map(); this.dataset = {};
    this.style = { setProperty() {} }; this.hidden = false; this.disabled = false;
    this.value = ''; this.className = ''; this.texto = '';
    this.scrollHeight = 0; this.scrollTop = 0; this.clientHeight = 0;
  }
  get textContent() { return this.texto + this.hijos.map(h => h.textContent).join(''); }
  set textContent(valor) { this.replaceChildren(); this.texto = String(valor); }
  get isConnected() { let n = this; while (n) { if (n === this.documento.body) return true; n = n.padre; } return false; }
  append(...nodos) { for (const n of nodos) { n.remove?.(); n.padre = this; this.hijos.push(n); } }
  replaceChildren(...nodos) { for (const n of this.hijos) n.padre = null; this.hijos = []; this.texto = ''; this.append(...nodos); }
  remove() { if (!this.padre) return; this.padre.hijos = this.padre.hijos.filter(n => n !== this); this.padre = null; }
  setAttribute(k, v) { this.atributos.set(k, String(v)); }
  getAttribute(k) { return this.atributos.get(k) ?? null; }
  addEventListener(k, f) { if (!this.eventos.has(k)) this.eventos.set(k, new Set()); this.eventos.get(k).add(f); }
  removeEventListener(k, f) { this.eventos.get(k)?.delete(f); }
  disparar(k, extra = {}) { for (const f of this.eventos.get(k) ?? []) f({ type: k, preventDefault() {}, ...extra }); }
  focus() { this.documento.activeElement = this; }
  contains(n) { for (let p = n; p; p = p.padre) if (p === this) return true; return false; }
  querySelector(selector) { return buscar(this, selector); }
}
function buscar(raiz, selector) {
  const cola = [...raiz.hijos];
  while (cola.length) {
    const n = cola.shift();
    if (selector.startsWith('.') && n.className.split(' ').includes(selector.slice(1))) return n;
    cola.push(...n.hijos);
  }
  return null;
}
function documentoPrueba() {
  const d = { activeElement: null, eventos: new Map(), hidden: false };
  d.body = new Nodo('body', d);
  d.defaultView = { innerHeight: 800, addEventListener() {}, removeEventListener() {}, getComputedStyle: () => ({ display: 'none' }) };
  d.createElement = tag => new Nodo(tag, d);
  d.createElementNS = (_, tag) => new Nodo(tag, d);
  d.createTextNode = texto => { const n = new Nodo('#text', d); n.textContent = texto; return n; };
  d.getElementById = id => {
    const cola = [d.body];
    while (cola.length) { const n = cola.shift(); if (n.id === id) return n; cola.push(...n.hijos); }
    return null;
  };
  d.querySelector = selector => buscar(d.body, selector);
  d.addEventListener = (k, f) => { if (!d.eventos.has(k)) d.eventos.set(k, new Set()); d.eventos.get(k).add(f); };
  d.removeEventListener = (k, f) => d.eventos.get(k)?.delete(f);
  return d;
}
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const S = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const bien = datos => ({ ok: true, datos, error: null });
const pausa = () => new Promise(resolve => setTimeout(resolve, 0));
const diferida = () => { let resolver, rechazar; const promesa = new Promise((a, b) => { resolver = a; rechazar = b; }); return { promesa, resolver, rechazar }; };
function preparar(solicitar = async () => bien({ tipo: 'mensaje', mensaje: 'Respuesta sintética' }), aplicarBorrador,
  identidad = { valor: bien({ id: A, sesionId: S }) }, { timeoutMs = 20000 } = {}) {
  const d = documentoPrueba();
  const widget = montarAgente({ documento: d, Reconocimiento: null, sintesis: null, Locucion: null });
  widget.abrir();
  let consultas = 0, authCambio;
  const conexion = conectarClienteWidget({ widget, cliente: { solicitar, cancelarPendientes() {} }, aplicarBorrador, timeoutMs, auth: {
    obtenerUsuarioActual: async () => { consultas++; return identidad.valor; },
    escucharCambiosAuth: f => { authCambio = f; return () => { authCambio = null; }; },
    escucharCierreSesionLocal: () => () => {},
  } });
  const texto = d.querySelector('.cl-agente-texto');
  const enviar = mensaje => { texto.value = mensaje; d.querySelector('.cl-agente-formulario').disparar('submit'); };
  return { d, widget, conexion, texto, enviar, identidad, consultas: () => consultas, authCambio: () => authCambio };
}

test('widget real en DOM simulado: montaje local, respuesta como texto y borrador conservado ante fallo', async () => {
  const d = documentoPrueba(); const local = montarAgente({ documento: d, Reconocimiento: null, sintesis: null, Locucion: null });
  assert.match(d.querySelector('.cl-agente-estado').textContent, /Demostración local/);
  local.desmontar();
  const e = preparar(); e.enviar('<script>dato</script>'); await pausa(); await pausa();
  assert.match(e.d.querySelector('.cl-agente-mensajes').textContent, /Respuesta sintética/);
  const leer = e.d.querySelector('.cl-agente-leer');
  assert.match(leer.padre.textContent, /Pronto podré ayudarte/);
  assert.doesNotMatch(leer.padre.textContent, /Respuesta sintética/);
  assert.equal(e.texto.value, ''); assert.equal(e.consultas(), 2);
  assert.equal(e.d.querySelector('.cl-agente-cancelar-solicitud').hidden, true);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('widget conserva texto ante error y el botón Cancelar termina la espera local', async () => {
  const e = preparar(async () => ({ ok: false, datos: null, error: { codigo: 'RED', mensaje: 'privado' } }));
  e.enviar('Consulta'); await pausa(); await pausa();
  assert.equal(e.texto.value, 'Consulta');
  assert.doesNotMatch(e.d.querySelector('.cl-agente-estado').textContent, /privado/);
  e.conexion.desmontar(); e.widget.desmontar();
  const f = preparar(() => new Promise(() => {})); f.enviar('Pendiente'); await pausa();
  f.d.querySelector('.cl-agente-cancelar-solicitud').disparar('click'); await pausa();
  assert.match(f.d.querySelector('.cl-agente-estado').textContent, /cancelada/);
  assert.equal(f.texto.value, 'Pendiente'); f.conexion.desmontar(); f.widget.desmontar();
});

test('widget presenta reservas propias y borrador editable sin publicación automática', async () => {
  let n = 0;
  const respuestas = [bien({ tipo: 'resultado_titular', datos: { destino: 'titular',
    reservas: [{ id: A, estado: 'pendiente' }] } }),
  bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título sintético', descripcion: 'Descripción sintética' }, requiereRevisionHumana: true } })];
  const e = preparar(async () => respuestas[n++]);
  e.enviar('Reservas'); await pausa(); await pausa();
  assert.match(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  e.enviar('Borrador'); await pausa(); await pausa();
  assert.equal(e.d.querySelector('.cl-agente-borrador-titulo').value, 'Título sintético');
  assert.equal(e.d.querySelector('.cl-agente-borrador-usar').disabled, true);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('el borrador requiere clic; el puerto puede conservar un formulario previamente editado', async () => {
  let usos = 0; const formulario = { titulo: 'Cambio previo del usuario' };
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Sugerencia', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  borrador => { usos++; if (formulario.titulo) return false; formulario.titulo = borrador.titulo; return true; });
  e.enviar('Preparar'); await pausa(); await pausa();
  assert.equal(usos, 0); assert.equal(formulario.titulo, 'Cambio previo del usuario');
  const usar = e.d.querySelector('.cl-agente-borrador-usar'); assert.equal(usar.disabled, false);
  usar.disparar('click'); await pausa(); assert.equal(usos, 1);
  assert.equal(formulario.titulo, 'Cambio previo del usuario');
  assert.match(e.d.querySelector('.cl-agente-estado').textContent, /Conservamos tus cambios/);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('el cambio Auth limpia reservas privadas del widget sin esperar otra petición', async () => {
  const e = preparar(async () => bien({ tipo: 'resultado_titular', datos: { destino: 'titular',
    reservas: [{ id: A, estado: 'pendiente' }] } }));
  e.enviar('Reservas'); await pausa(); await pausa();
  assert.match(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  e.authCambio()();
  assert.doesNotMatch(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('regresión 1: pérdida de sesión sin evento borra reservas ya visibles', async () => {
  const e = preparar(async () => bien({ tipo: 'resultado_titular', datos: { destino: 'titular',
    reservas: [{ id: A, estado: 'pendiente' }] } }));
  e.enviar('Reservas'); await pausa(); await pausa();
  assert.match(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  e.identidad.valor = bien(null); e.enviar('Otra consulta'); await pausa(); await pausa();
  assert.doesNotMatch(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('regresión 2: borrador de A no se aplica tras cambio a B sin evento', async () => {
  let usos = 0;
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  () => { usos++; return true; });
  e.enviar('Borrador'); await pausa(); await pausa();
  e.identidad.valor = bien({ id: B, sesionId: S2 });
  e.d.querySelector('.cl-agente-borrador-usar').disparar('click'); await pausa();
  assert.equal(usos, 0); e.conexion.desmontar(); e.widget.desmontar();
});

test('regresión 3: desmontar solo la conexión invalida un borrador visible', async () => {
  let usos = 0;
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  () => { usos++; return true; });
  e.enviar('Borrador'); await pausa(); await pausa();
  const usar = e.d.querySelector('.cl-agente-borrador-usar');
  e.conexion.desmontar(); usar.disparar('click'); await pausa();
  assert.equal(usos, 0); e.widget.desmontar();
});

test('identidad ausente, inválida, contradictoria o fallida limpia resultados previos del DOM', async () => {
  for (const valor of [bien(null), bien({ id: 'anon', sesionId: S }),
    { ok: true, datos: { id: A, sesionId: S }, error: { codigo: 'RED' } },
    { ok: false, datos: null, error: { codigo: 'RED', mensaje: 'token privado' } },
    () => Promise.reject(new Error('token privado'))]) {
    const e = preparar(async () => bien({ tipo: 'resultado_titular', datos: { destino: 'titular',
      reservas: [{ id: A, estado: 'pendiente' }] } }));
    e.enviar('Reservas'); await pausa(); await pausa();
    assert.match(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
    e.identidad.valor = typeof valor === 'function' ? valor() : valor;
    e.enviar('Otra'); await pausa(); await pausa();
    assert.doesNotMatch(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
    assert.doesNotMatch(e.d.querySelector('.cl-agente-estado').textContent, /token privado/);
    e.conexion.desmontar(); e.widget.desmontar();
  }
});

test('timeout al verificar identidad retira reservas anteriores y conserva aviso final', async () => {
  const e = preparar(async () => bien({ tipo: 'resultado_titular', datos: { destino: 'titular',
    reservas: [{ id: A, estado: 'pendiente' }] } }), undefined,
  { valor: bien({ id: A, sesionId: S }) }, { timeoutMs: 100 });
  e.enviar('Reservas'); await pausa(); await pausa();
  assert.match(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  e.identidad.valor = new Promise(() => {}); e.enviar('Otra consulta');
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.doesNotMatch(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  assert.match(e.d.querySelector('.cl-agente-estado').textContent, /tiempo de espera/);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('NO_AUTORIZADO HTTP limpia reservas; RED conserva borrador y texto editado', async () => {
  let n = 0; const e = preparar(async () => n++ === 0
    ? bien({ tipo: 'resultado_titular', datos: { destino: 'titular', reservas: [{ id: A, estado: 'pendiente' }] } })
    : { ok: false, datos: null, error: { codigo: 'NO_AUTORIZADO', mensaje: 'privado' } });
  e.enviar('Reservas'); await pausa(); await pausa(); e.enviar('Otra'); await pausa(); await pausa();
  assert.doesNotMatch(e.d.querySelector('.cl-agente-mensajes').textContent, /Reserva aaaaaaaa/);
  assert.match(e.d.querySelector('.cl-agente-estado').textContent, /Inicia sesión/);
  e.conexion.desmontar(); e.widget.desmontar();
  n = 0; const f = preparar(async () => n++ === 0
    ? bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
      borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } })
    : { ok: false, datos: null, error: { codigo: 'RED', mensaje: 'privado' } });
  f.enviar('Borrador'); await pausa(); await pausa();
  f.enviar('Texto editado'); await pausa(); await pausa();
  assert.equal(f.texto.value, 'Texto editado');
  assert.equal(f.d.querySelector('.cl-agente-borrador-titulo').value, 'Título');
  f.conexion.desmontar(); f.widget.desmontar();
});

test('borrador de A se invalida con nueva sesión de A sin evento', async () => {
  let usos = 0; const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  () => { usos++; return true; });
  e.enviar('Borrador'); await pausa(); await pausa();
  e.identidad.valor = bien({ id: A, sesionId: S2 });
  e.d.querySelector('.cl-agente-borrador-usar').disparar('click'); await pausa();
  assert.equal(usos, 0); e.conexion.desmontar(); e.widget.desmontar();
});

test('logout y desmontaje durante revalidación descartan resolución tardía', async () => {
  for (const accion of ['logout', 'desmontar']) {
    const espera = diferida(); let usos = 0;
    const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
      borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
    () => { usos++; return true; });
    e.enviar('Borrador'); await pausa(); await pausa();
    e.identidad.valor = espera.promesa;
    e.d.querySelector('.cl-agente-borrador-usar').disparar('click'); await pausa();
    if (accion === 'logout') e.authCambio()(); else e.conexion.desmontar();
    espera.resolver(bien({ id: A, sesionId: S })); await pausa();
    assert.equal(usos, 0); e.conexion.desmontar(); e.widget.desmontar();
  }
});

test('timeout de verificación del borrador y rechazo tardío no aplican ni filtran errores', async () => {
  const espera = diferida(); let usos = 0;
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  () => { usos++; return true; }, { valor: bien({ id: A, sesionId: S }) }, { timeoutMs: 5 });
  e.enviar('Borrador'); await pausa(); await pausa();
  e.identidad.valor = espera.promesa;
  e.d.querySelector('.cl-agente-borrador-usar').disparar('click');
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(usos, 0); assert.match(e.d.querySelector('.cl-agente-estado').textContent, /tiempo de espera/);
  espera.rechazar(new Error('token privado')); await pausa();
  assert.doesNotMatch(e.d.querySelector('.cl-agente-estado').textContent, /token privado/);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('doble clic espera una sola revalidación y aplica una sola vez', async () => {
  const espera = diferida(); let usos = 0;
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  () => { usos++; return true; });
  e.enviar('Borrador'); await pausa(); await pausa();
  e.identidad.valor = espera.promesa;
  const boton = e.d.querySelector('.cl-agente-borrador-usar'); boton.disparar('click'); boton.disparar('click');
  await pausa(); assert.equal(e.consultas(), 3); assert.equal(usos, 0);
  espera.resolver(bien({ id: A, sesionId: S })); await pausa();
  assert.equal(usos, 1); assert.match(e.d.querySelector('.cl-agente-estado').textContent, /trasladado/);
  boton.disparar('click'); await pausa(); assert.equal(usos, 1);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('borrador Unicode admitido para editar se ajusta al límite UTF-16 antes de trasladarlo', async () => {
  let usos = 0; const largo = '😀'.repeat(60);
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: largo, descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
  () => { usos++; return true; });
  e.enviar('Borrador'); await pausa(); await pausa();
  const titulo = e.d.querySelector('.cl-agente-borrador-titulo');
  assert.equal(titulo.value, largo);
  const usar = e.d.querySelector('.cl-agente-borrador-usar'); usar.disparar('click'); await pausa();
  assert.equal(usos, 0);
  titulo.value = '😀'.repeat(50); usar.disparar('click'); await pausa();
  assert.equal(usos, 1); e.conexion.desmontar(); e.widget.desmontar();
});

test('editar o retirar borrador durante revalidación impide aplicar datos anteriores', async () => {
  for (const cambio of ['editar', 'retirar']) {
    const espera = diferida(); let usos = 0;
    const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
      borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }),
    () => { usos++; return true; });
    e.enviar('Borrador'); await pausa(); await pausa(); e.identidad.valor = espera.promesa;
    const usar = e.d.querySelector('.cl-agente-borrador-usar'); usar.disparar('click'); await pausa();
    if (cambio === 'editar') e.d.querySelector('.cl-agente-borrador-titulo').value = 'Nuevo';
    else e.widget.borrarHistorial();
    espera.resolver(bien({ id: A, sesionId: S })); await pausa();
    assert.equal(usos, 0); e.conexion.desmontar(); e.widget.desmontar();
  }
});

test('límite temporal incluye respuestas y borradores y retira sus listeners', async () => {
  const e = preparar(async () => bien({ tipo: 'borrador_revisable', datos: { tipo: 'borrador_publicacion',
    borrador: { titulo: 'Título', descripcion: 'Descripción' }, requiereRevisionHumana: true } }), () => true);
  e.enviar('Uno'); await pausa(); await pausa();
  const antiguo = e.d.querySelector('.cl-agente-borrador-usar');
  for (let i = 0; i < 11; i++) { e.enviar('Otro ' + i); await pausa(); await pausa(); }
  assert.ok(e.d.querySelector('.cl-agente-mensajes').hijos.length <= 21);
  assert.equal(antiguo.eventos.get('click')?.size, 0);
  assert.match(e.d.querySelector('.cl-agente-mensajes').hijos[0].textContent, /Pronto podré ayudarte/);
  e.conexion.desmontar(); e.widget.desmontar();
});

test('cerrar, abrir y editar compositor no ocultan estado de procesamiento', async () => {
  const espera = diferida(); const e = preparar(() => espera.promesa);
  e.enviar('Pendiente'); await pausa(); e.widget.cerrar(); e.widget.abrir();
  e.texto.value = 'Edición'; e.texto.disparar('input');
  assert.match(e.d.querySelector('.cl-agente-estado').textContent, /Procesando solicitud/);
  assert.equal(e.d.querySelector('.cl-agente-enviar').disabled, true);
  e.conexion.cancelar(); espera.resolver(bien({ tipo: 'mensaje', mensaje: 'Viejo' })); await pausa();
  e.conexion.desmontar(); e.widget.desmontar();
});
