import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

// Solo archivos locales y módulos estándar. Sin npm, SDK, auth.js real, Supabase, navegador ni red.
const fuente = await readFile(new URL('../../js/cuenta.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../../cuenta.html', import.meta.url), 'utf8');
const plano = valor => JSON.parse(JSON.stringify(valor));
const pausa = () => new Promise(resolve => setTimeout(resolve, 5));
function diferida() {
  let resolver;
  const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}

// Usuario sintético SOLO para estas pruebas: no corresponde a ninguna cuenta real.
const USUARIO = { id: '3f926c15-550b-42b9-8aa0-b08279954bcb', correo: 'comprador@example.invalid' };
const OTRO = { id: '5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d', correo: 'otra@example.invalid' };
const autenticado = (usuario = USUARIO) => ({ ok: true, datos: { estado: 'AUTENTICADO', usuario }, error: null });
const CERRADA = { ok: true, datos: { estado: 'NO_AUTENTICADO', usuario: null }, error: null };
const fallo = (codigo, mensaje = `Mensaje simulado de auth.js: ${codigo}`) => ({ ok: false, datos: null, error: { codigo, mensaje } });
const MENSAJE_MEMORIA = 'Mensaje simulado de auth.js: sesión cerrada sin confirmar borrado.';

/* DOM mínimo: solo lo que usa cuenta.js */
class Estilo {
  constructor() { this.propiedades = new Map(); }
  setProperty(nombre, valor) { this.propiedades.set(nombre, String(valor)); }
  removeProperty(nombre) { this.propiedades.delete(nombre); }
  getPropertyValue(nombre) { return this.propiedades.get(nombre) ?? ''; }
}

class Elemento {
  constructor(documento, tagName, propiedades = {}) {
    Object.assign(this, { ownerDocument: documento, tagName, padre: null, hijos: [], atributos: new Map(),
      oyentes: new Map(), style: new Estilo(), textContent: '', disabled: false, hidden: false }, propiedades);
  }
  get className() { return this.atributos.get('class') ?? ''; }
  set className(valor) { this.atributos.set('class', String(valor)); }
  agregar(...hijos) { for (const hijo of hijos) { hijo.padre = this; this.hijos.push(hijo); } return this; }
  setAttribute(nombre, valor) { this.atributos.set(nombre, String(valor)); }
  getAttribute(nombre) { return this.atributos.has(nombre) ? this.atributos.get(nombre) : null; }
  removeAttribute(nombre) { this.atributos.delete(nombre); }
  focus() { this.ownerDocument.activeElement = this; }
  addEventListener(tipo, funcion) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, new Set());
    this.oyentes.get(tipo).add(funcion);
  }
  removeEventListener(tipo, funcion) { this.oyentes.get(tipo)?.delete(funcion); }
  cantidadOyentes() { return [...this.oyentes.values()].reduce((total, s) => total + s.size, 0); }
  disparar(tipo) {
    for (const funcion of [...(this.oyentes.get(tipo) ?? [])]) funcion({ type: tipo, target: this });
  }
  querySelectorAll(selector) {
    assert.equal(selector, '[data-cuenta-demo]', 'Selector no previsto en la prueba');
    const encontrados = [];
    const recorrer = e => { for (const h of e.hijos) { if (h.atributos.has('data-cuenta-demo')) encontrados.push(h); recorrer(h); } };
    recorrer(this);
    return encontrados;
  }
}

// Reproduce los IDs y marcas de cuenta.html con el contenido de ejemplo de Figma.
function domCuenta({ sinElemento } = {}) {
  const porId = new Map();
  const documento = {
    activeElement: null,
    defaultView: { requestAnimationFrame: funcion => setTimeout(funcion, 0) },
    getElementById: id => porId.get(id) ?? null,
  };
  const crear = (tagName, propiedades = {}) => {
    const elemento = new Elemento(documento, tagName, propiedades);
    if (propiedades.id && propiedades.id !== sinElemento) porId.set(propiedades.id, elemento);
    return elemento;
  };
  const demo = texto => { const e = crear('SECTION', { textContent: texto }); e.setAttribute('data-cuenta-demo', ''); return e; };
  const raiz = crear('MAIN', { id: 'contenido' });
  const secciones = [demo('Compras completadas 5'), demo('Tienes una calificación pendiente'),
    demo('Ver operación completada'), demo('4.9 · 5 opiniones'), demo('MacBook Air M1 256 GB')];
  raiz.agregar(
    crear('DIV', { id: 'cuenta-mensaje', hidden: true }),
    crear('P', { id: 'cuenta-reintentar-zona', hidden: true }).agregar(crear('BUTTON', { id: 'cuenta-reintentar' })),
    crear('P', { id: 'cuenta-acceso', hidden: true }),
    crear('IMG', { id: 'cuenta-avatar' }),
    crear('H2', { id: 'account-name', textContent: 'María López' }),
    crear('P', { id: 'cuenta-universidad', textContent: 'PUCP · Campus San Miguel' }),
    crear('P', { id: 'cuenta-correo', textContent: 'maria.lopez@pucp.edu.pe' }),
    crear('P', { id: 'cuenta-verificado', textContent: 'Correo universitario verificado' }),
    crear('P', { id: 'cuenta-cerrar-sesion-zona', hidden: true }).agregar(crear('BUTTON', { id: 'cuenta-cerrar-sesion' })),
    crear('SPAN', { id: 'cuenta-vendedor-estado', textContent: 'Inactivo' }),
    crear('P', { id: 'cuenta-pendiente', hidden: true }),
    ...secciones);
  crear('P', { id: 'account-demo', textContent: 'El perfil de María López… son datos de ejemplo de Figma.' });
  const $ = id => documento.getElementById(id);
  return { documento, raiz, secciones, $ };
}

const visible = elemento => !elemento.hidden && elemento.style.getPropertyValue('display') !== 'none';

/* Carga aislada: auth.js se sustituye por un módulo sintético que no debe usarse */
async function cargar() {
  const control = { intentosRed: 0, mensajesConsola: 0, serviciosReales: 0 };
  const contexto = createContext({
    setTimeout, clearTimeout,
    fetch() { control.intentosRed++; throw new Error('Red deshabilitada en pruebas'); },
    console: { log() { control.mensajesConsola++; }, warn() { control.mensajesConsola++; }, error() { control.mensajesConsola++; } },
    // Sin document ni window: el montaje automático no se ejecuta.
  });
  const real = () => { control.serviciosReales++; throw new Error('Servicio Auth real no permitido'); };
  const nombres = ['requerirAutenticacion', 'cerrarSesion', 'escucharCambiosAuth'];
  const auth = new SyntheticModule(nombres, function () {
    for (const nombre of nombres) this.setExport(nombre, real);
  }, { context: contexto });
  const modulo = new SourceTextModule(fuente, { context: contexto, identifier: 'cuenta.js' });
  await modulo.link(nombre => { assert.equal(nombre, './auth.js'); return auth; });
  await modulo.evaluate();
  return { api: modulo.namespace, control };
}

function servicios({ auth = autenticado(), cierre = CERRADA, escuchar } = {}) {
  const llamadas = { auth: 0, cierre: 0, suscripciones: 0, cancelaciones: 0 };
  const responder = valor => (typeof valor === 'function' ? valor() : valor);
  const s = { llamadas, oyente: null };
  s.respuestas = { auth, cierre };
  s.emitir = notificacion => s.oyente?.(notificacion);
  s.servicios = {
    requerirAutenticacion: async () => { llamadas.auth++; return responder(s.respuestas.auth); },
    cerrarSesion: async () => { llamadas.cierre++; return responder(s.respuestas.cierre); },
    escucharCambiosAuth: escuchar ?? (callback => {
      llamadas.suscripciones++;
      s.oyente = callback;
      return () => { llamadas.cancelaciones++; s.oyente = null; };
    }),
  };
  return s;
}

async function montar(opciones = {}) {
  const carga = await cargar();
  const dom = domCuenta();
  const s = servicios(opciones);
  const montaje = carga.api.montarCuenta({ documento: dom.documento, servicios: s.servicios });
  await pausa();
  return { ...carga, dom, s, montaje };
}

const mensaje = dom => dom.$('cuenta-mensaje');
const sinEfectos = control => assert.deepEqual(control, { intentosRed: 0, mensajesConsola: 0, serviciosReales: 0 });

// Ningún dato de ejemplo de Figma queda visible como información de la cuenta.
function sinDemoVisible(dom) {
  for (const seccion of dom.secciones) assert.equal(visible(seccion), false, `sección de ejemplo visible: ${seccion.textContent}`);
  assert.equal(visible(dom.$('cuenta-avatar')), false);
  assert.equal(visible(dom.$('cuenta-verificado')), false);
  assert.equal(dom.$('account-name').textContent, 'Perfil pendiente de integración');
  assert.equal(dom.$('cuenta-universidad').textContent, 'Universidad y campus pendientes de integración');
  assert.equal(dom.$('cuenta-vendedor-estado').textContent, 'Pendiente');
  assert.doesNotMatch(dom.$('account-demo').textContent, /María|Figma/);
  for (const id of ['account-name', 'cuenta-universidad', 'cuenta-correo', 'cuenta-vendedor-estado', 'cuenta-mensaje']) {
    assert.doesNotMatch(dom.$(id).textContent, /María|López|PUCP|maria\.lopez|Inactivo/);
  }
}

function vistaSinSesion(dom) {
  assert.equal(visible(dom.$('cuenta-acceso')), true);
  for (const id of ['cuenta-cerrar-sesion-zona', 'cuenta-reintentar-zona', 'cuenta-pendiente', 'cuenta-correo']) {
    assert.equal(visible(dom.$(id)), false, `${id} visible sin sesión`);
  }
  assert.equal(dom.$('cuenta-correo').textContent, '');
  assert.equal(dom.raiz.getAttribute('aria-busy'), null);
}

/* Funciones puras */
test('importar cuenta.js no monta la página ni usa red, consola o Auth real', async () => {
  const { api, control } = await cargar();
  assert.deepEqual(Object.keys(api).sort(), ['clasificarAutenticacion', 'clasificarCierre', 'montarCuenta']);
  sinEfectos(control);
});

test('clasificarAutenticacion: usuario autenticado, sin sesión, errores y respuestas fuera de contrato', async () => {
  const { api } = await cargar();
  assert.deepEqual(plano(api.clasificarAutenticacion(autenticado())), { tipo: 'AUTENTICADO', id: USUARIO.id, correo: USUARIO.correo });
  assert.equal(api.clasificarAutenticacion(autenticado({ id: USUARIO.id, correo: null })).correo, null);
  assert.deepEqual(plano(api.clasificarAutenticacion(fallo('NO_AUTORIZADO'))), { tipo: 'SIN_SESION' });
  for (const codigo of ['RED', 'LIMITE', 'SERVIDOR']) {
    assert.deepEqual(plano(api.clasificarAutenticacion(fallo(codigo))),
      { tipo: 'ERROR', mensaje: `Mensaje simulado de auth.js: ${codigo}`, reintentable: true });
  }
  assert.equal(api.clasificarAutenticacion(fallo('CONFIGURACION')).reintentable, false);
  for (const respuesta of [undefined, null, {}, { ok: true, datos: null }, autenticado(null), autenticado({ id: '' }),
    { ok: true, datos: { estado: 'NO_AUTENTICADO', usuario: null } }, { ok: false, error: null }]) {
    const clasificacion = api.clasificarAutenticacion(respuesta);
    assert.equal(clasificacion.tipo, 'ERROR');
    assert.equal(clasificacion.mensaje, 'No pudimos comprobar tu sesión. Inténtalo de nuevo.');
  }
});

test('clasificarCierre: éxito, MEMORIA_NO_BORRADA y fallos', async () => {
  const { api } = await cargar();
  assert.deepEqual(plano(api.clasificarCierre(CERRADA)), { tipo: 'CERRADA' });
  assert.deepEqual(plano(api.clasificarCierre(fallo('MEMORIA_NO_BORRADA', MENSAJE_MEMORIA))),
    { tipo: 'CERRADA_SIN_BORRADO', mensaje: MENSAJE_MEMORIA });
  assert.match(api.clasificarCierre({ ok: false, error: { codigo: 'MEMORIA_NO_BORRADA' } }).mensaje, /Se cerró la sesión/);
  assert.deepEqual(plano(api.clasificarCierre(fallo('RED'))), { tipo: 'FALLIDO', mensaje: 'Mensaje simulado de auth.js: RED' });
  for (const respuesta of [undefined, null, {}]) {
    assert.deepEqual(plano(api.clasificarCierre(respuesta)), { tipo: 'FALLIDO', mensaje: 'No pudimos cerrar la sesión. Inténtalo de nuevo.' });
  }
});

/* Montaje y estados */
test('carga: neutraliza los datos de ejemplo antes de conocer la sesión', async () => {
  const pendiente = diferida();
  const { dom, s, control } = await montar({ auth: () => pendiente.promesa });
  sinDemoVisible(dom);
  assert.equal(dom.raiz.getAttribute('aria-busy'), 'true');
  assert.equal(mensaje(dom).textContent, 'Comprobando tu sesión…');
  assert.equal(mensaje(dom).className, 'alert');
  assert.equal(dom.$('cuenta-correo').textContent, '');
  for (const id of ['cuenta-acceso', 'cuenta-reintentar-zona', 'cuenta-cerrar-sesion-zona', 'cuenta-pendiente']) {
    assert.equal(visible(dom.$(id)), false);
  }
  assert.equal(s.llamadas.auth, 1);
  assert.equal(s.llamadas.suscripciones, 1);
  pendiente.resolver(autenticado());
  await pausa();
  sinEfectos(control);
});

test('usuario autenticado: muestra su correo y el cierre de sesión, sin datos de ejemplo', async () => {
  const { dom, control } = await montar();
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  assert.equal(visible(dom.$('cuenta-correo')), true);
  assert.equal(visible(dom.$('cuenta-cerrar-sesion-zona')), true);
  assert.equal(dom.$('cuenta-cerrar-sesion').disabled, false);
  assert.equal(visible(dom.$('cuenta-pendiente')), true);
  for (const id of ['cuenta-acceso', 'cuenta-reintentar-zona']) assert.equal(visible(dom.$(id)), false);
  assert.equal(mensaje(dom).hidden, true);
  assert.equal(mensaje(dom).getAttribute('class'), null);
  assert.equal(dom.raiz.getAttribute('aria-busy'), null);
  sinDemoVisible(dom);
  sinEfectos(control);
});

test('correo: se escribe como texto literal y su ausencia se indica sin inventarlo', async () => {
  const literal = '<img src=x onerror=alert(1)>@example.invalid';
  const { dom } = await montar({ auth: autenticado({ id: USUARIO.id, correo: literal }) });
  assert.equal(dom.$('cuenta-correo').textContent, literal);
  assert.equal(dom.$('cuenta-correo').hijos.length, 0);
  const sinCorreo = await montar({ auth: autenticado({ id: USUARIO.id, correo: null }) });
  assert.equal(sinCorreo.dom.$('cuenta-correo').textContent, 'Correo no disponible');
});

test('usuario no autenticado: aviso y acceso a Iniciar sesión, sin datos de ejemplo', async () => {
  const { dom, control } = await montar({ auth: fallo('NO_AUTORIZADO') });
  vistaSinSesion(dom);
  assert.equal(mensaje(dom).textContent, 'Necesitas iniciar sesión para ver tu cuenta.');
  assert.equal(mensaje(dom).className, 'alert alert-warning');
  sinDemoVisible(dom);
  sinEfectos(control);
});

test('errores de autenticación: mensaje de auth.js y reintento solo cuando corresponde', async () => {
  const { dom, s } = await montar({ auth: fallo('RED') });
  assert.equal(mensaje(dom).textContent, 'Mensaje simulado de auth.js: RED');
  assert.equal(mensaje(dom).className, 'alert alert-error');
  assert.equal(visible(dom.$('cuenta-reintentar-zona')), true);
  for (const id of ['cuenta-acceso', 'cuenta-cerrar-sesion-zona', 'cuenta-pendiente', 'cuenta-correo']) {
    assert.equal(visible(dom.$(id)), false);
  }
  sinDemoVisible(dom);
  // Reintentar: nueva comprobación, foco preservado en el contenido principal.
  s.respuestas.auth = autenticado();
  dom.$('cuenta-reintentar').focus();
  dom.$('cuenta-reintentar').disparar('click');
  assert.equal(dom.documento.activeElement, dom.raiz);
  await pausa();
  assert.equal(s.llamadas.auth, 2);
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  assert.equal(visible(dom.$('cuenta-reintentar-zona')), false);

  const configuracion = await montar({ auth: fallo('CONFIGURACION') });
  assert.equal(visible(configuracion.dom.$('cuenta-reintentar-zona')), false, 'CONFIGURACION no ofrece reintento');
  const rechazo = await montar({ auth: () => Promise.reject(new Error('fallo interno con datos privados')) });
  assert.equal(mensaje(rechazo.dom).textContent, 'No pudimos comprobar tu sesión. Inténtalo de nuevo.');
  assert.equal(visible(rechazo.dom.$('cuenta-reintentar-zona')), true);
  const fueraDeContrato = await montar({ auth: { ok: true, datos: { estado: 'AUTENTICADO', usuario: null }, error: null } });
  assert.equal(visible(fueraDeContrato.dom.$('cuenta-correo')), false);
  assert.equal(mensaje(fueraDeContrato.dom).className, 'alert alert-error');
});

test('respuesta tardía: una comprobación antigua no sobrescribe la más reciente', async () => {
  const primera = diferida();
  const { dom, s } = await montar({ auth: () => primera.promesa });
  // Otra pestaña inicia sesión con otra cuenta mientras la primera comprobación sigue pendiente.
  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null });
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  primera.resolver(autenticado(USUARIO));
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  assert.equal(s.llamadas.auth, 2);
});

/* Cierre de sesión */
test('cierre de sesión exitoso: sale del área autenticada y no repite la llamada', async () => {
  const pendiente = diferida();
  const { dom, s, control } = await montar({ cierre: () => pendiente.promesa });
  const boton = dom.$('cuenta-cerrar-sesion');
  boton.focus();
  boton.disparar('click');
  boton.disparar('click');
  assert.equal(s.llamadas.cierre, 1);
  assert.equal(boton.disabled, true);
  assert.equal(dom.raiz.getAttribute('aria-busy'), 'true');
  await pausa();
  assert.equal(mensaje(dom).textContent, 'Cerrando sesión…');
  pendiente.resolver(CERRADA);
  await pausa();
  vistaSinSesion(dom);
  assert.equal(mensaje(dom).textContent, 'Cerraste sesión en este navegador.');
  assert.equal(mensaje(dom).className, 'alert');
  assert.equal(dom.documento.activeElement, dom.raiz, 'el foco no queda en un botón oculto');
  sinDemoVisible(dom);
  sinEfectos(control);
});

test('cierre de sesión fallido: la sesión sigue activa y se puede reintentar', async () => {
  const { dom, s } = await montar({ cierre: fallo('RED') });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(mensaje(dom).textContent, 'Mensaje simulado de auth.js: RED');
  assert.equal(mensaje(dom).className, 'alert alert-error');
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  assert.equal(visible(dom.$('cuenta-cerrar-sesion-zona')), true);
  assert.equal(dom.$('cuenta-cerrar-sesion').disabled, false);
  assert.equal(visible(dom.$('cuenta-acceso')), false);
  assert.equal(dom.raiz.getAttribute('aria-busy'), null);
  s.respuestas.cierre = () => Promise.reject(new Error('fallo interno'));
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(mensaje(dom).textContent, 'No pudimos cerrar la sesión. Inténtalo de nuevo.');
  s.respuestas.cierre = CERRADA;
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(s.llamadas.cierre, 3);
  vistaSinSesion(dom);
});

test('MEMORIA_NO_BORRADA: sale del área autenticada, avisa y no ofrece repetir el cierre', async () => {
  const { dom, s } = await montar({ cierre: fallo('MEMORIA_NO_BORRADA', MENSAJE_MEMORIA) });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  vistaSinSesion(dom);
  assert.equal(mensaje(dom).textContent, MENSAJE_MEMORIA);
  assert.equal(mensaje(dom).className, 'alert alert-warning');
  // El SIGNED_OUT posterior no sustituye el aviso de privacidad.
  s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null });
  await pausa();
  assert.equal(mensaje(dom).textContent, MENSAJE_MEMORIA);
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(s.llamadas.cierre, 1);
  assert.equal(s.llamadas.auth, 1, 'no se vuelve a comprobar como si siguiera la sesión');
});

/* Cambios de autenticación y suscripción */
test('cambios de autenticación: cierre externo, nuevo inicio, misma cuenta y eventos ignorados', async () => {
  const { dom, s } = await montar();
  s.emitir({ evento: 'TOKEN_REFRESHED', estado: 'AUTENTICADO', usuario: USUARIO });
  s.emitir({ evento: 'ERROR', estado: 'RED', usuario: null });
  await pausa();
  assert.equal(s.llamadas.auth, 1, 'la misma cuenta no provoca otra comprobación');
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);

  s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null });
  await pausa();
  vistaSinSesion(dom);
  assert.equal(mensaje(dom).textContent, 'Tu sesión terminó. Inicia sesión de nuevo para ver tu cuenta.');

  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  await pausa();
  assert.equal(s.llamadas.auth, 2);
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);

  s.respuestas.auth = autenticado(USUARIO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: USUARIO });
  await pausa();
  assert.equal(s.llamadas.auth, 3, 'otra cuenta se verifica con requerirAutenticacion');
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
});

test('cambios de autenticación durante el cierre: manda el resultado de cerrarSesion', async () => {
  const pendiente = diferida();
  const { dom, s } = await montar({ cierre: () => pendiente.promesa });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null });
  await pausa();
  assert.equal(mensaje(dom).textContent, 'Cerrando sesión…');
  pendiente.resolver(fallo('MEMORIA_NO_BORRADA', MENSAJE_MEMORIA));
  await pausa();
  assert.equal(mensaje(dom).textContent, MENSAJE_MEMORIA);
});

test('desmontar: cancela la suscripción, retira oyentes y descarta respuestas posteriores', async () => {
  const pendiente = diferida();
  const { api, dom, s, montaje } = await montar({ auth: () => pendiente.promesa });
  montaje.desmontar();
  montaje.desmontar();
  assert.equal(s.llamadas.cancelaciones, 1);
  assert.equal(dom.$('cuenta-reintentar').cantidadOyentes(), 0);
  assert.equal(dom.$('cuenta-cerrar-sesion').cantidadOyentes(), 0);
  assert.equal(dom.raiz.getAttribute('aria-busy'), null);
  assert.equal(mensaje(dom).hidden, true);
  pendiente.resolver(autenticado());
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, '', 'una respuesta tras desmontar no escribe');
  assert.equal(s.oyente, null);
  // Un montaje nuevo sobre la misma página vuelve a suscribirse; no se duplica mientras está activo.
  const otro = servicios();
  const nuevo = api.montarCuenta({ documento: dom.documento, servicios: otro.servicios });
  assert.ok(nuevo);
  assert.equal(api.montarCuenta({ documento: dom.documento, servicios: otro.servicios }), null);
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  nuevo.desmontar();
  assert.equal(otro.llamadas.cancelaciones, 1);
});

test('suscripción no disponible o elementos ausentes: no rompe la página', async () => {
  const lanza = await montar({ escuchar: () => { throw new Error('sin suscripción'); } });
  assert.equal(lanza.dom.$('cuenta-correo').textContent, USUARIO.correo);
  assert.doesNotThrow(() => lanza.montaje.desmontar());
  const sinFuncion = await montar({ escuchar: () => 'no es una función' });
  assert.doesNotThrow(() => sinFuncion.montaje.desmontar());
  const { api } = await cargar();
  const incompleto = domCuenta({ sinElemento: 'cuenta-cerrar-sesion' });
  const s = servicios();
  assert.equal(api.montarCuenta({ documento: incompleto.documento, servicios: s.servicios }), null);
  assert.equal(s.llamadas.auth, 0);
  assert.equal(incompleto.$('account-name').textContent, 'María López', 'sin montaje el HTML no se altera');
  assert.equal(api.montarCuenta({}), null);
  assert.equal(api.montarCuenta(), null);
});

/* Contrato con cuenta.html y código fuente */
test('cuenta.html: carga el controlador y contiene los IDs y marcas que usa cuenta.js', () => {
  assert.equal((html.match(/<script type="module" src="js\/cuenta\.js"><\/script>/g) ?? []).length, 1);
  for (const id of ['contenido', 'account-demo', 'cuenta-mensaje', 'cuenta-reintentar-zona', 'cuenta-reintentar', 'cuenta-acceso',
    'cuenta-cerrar-sesion-zona', 'cuenta-cerrar-sesion', 'account-name', 'cuenta-universidad', 'cuenta-correo',
    'cuenta-verificado', 'cuenta-avatar', 'cuenta-vendedor-estado', 'cuenta-pendiente']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `id ${id}`);
  }
  assert.equal((html.match(/data-cuenta-demo/g) ?? []).length, 5);
  // Los contenedores nuevos no tienen clase: hidden los oculta aunque el script no se cargue.
  for (const id of ['cuenta-mensaje', 'cuenta-reintentar-zona', 'cuenta-acceso', 'cuenta-cerrar-sesion-zona', 'cuenta-pendiente']) {
    const etiqueta = html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))[0];
    assert.match(etiqueta, /\shidden[\s>]/, `${id} sin hidden`);
    assert.doesNotMatch(etiqueta, /class=/, `${id} con clase`);
  }
  assert.match(html, /<a class="button button-primary" href="login\.html">Iniciar sesión<\/a>/);
  assert.match(html, /aria-current="page" aria-label="Mi cuenta">/);
});

test('cuenta.js: sin HTML dinámico, red, cliente Supabase ni servicios fuera de alcance', () => {
  assert.doesNotMatch(fuente, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.deepEqual(fuente.match(/^import .*$/gm), ["import { requerirAutenticacion, cerrarSesion, escucharCambiosAuth } from './auth.js';"]);
  assert.doesNotMatch(fuente, /fetch\(|supabase|perfiles|localstorage|localStorage|sessionStorage|reservas-ui|mensajeria/i);
});
