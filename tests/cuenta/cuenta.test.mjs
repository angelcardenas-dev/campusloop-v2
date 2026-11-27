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
const MENSAJE_MEMORIA = 'Se cerró la sesión, pero no se pudo confirmar el borrado del contexto recordado en este navegador.';
const MENSAJES_ERROR = { RED: 'No hay conexión. Inténtalo de nuevo.', LIMITE: 'Demasiados intentos. Espera un momento.',
  SERVIDOR: 'Servicio temporalmente no disponible.' };
// Directorio y perfil sintéticos SOLO para estas pruebas: no son datos de Supabase.
const UNI = '6a1f0c2e-8b3d-4e5f-9a7b-1c2d3e4f5a6b';
const UNI_B = '8c3f2e4a-0d5f-4a7b-9c9d-3e4f5a6b7c8d';
const CAMPUS_A = '7b2e1d3f-9c4e-4f6a-8b8c-2d3e4f5a6b7c';
const CAMPUS_B = '9d4a3f5b-1e6a-4b8c-8dae-4f5a6b7c8d9e';
const UNIVERSIDADES = [{ id: UNI, nombre: 'Universidad de prueba', sigla: 'UP' }, { id: UNI_B, nombre: 'Universidad de prueba B', sigla: '' }];
const CAMPUS = {
  [UNI]: [{ id: CAMPUS_A, universidadId: UNI, nombre: 'Campus de prueba', distrito: null, ciudad: null }],
  [UNI_B]: [{ id: CAMPUS_B, universidadId: UNI_B, nombre: 'Campus de prueba B', distrito: null, ciudad: null }],
};
const ok = datos => ({ ok: true, datos, error: null });
// Campos privados del perfil que nunca deben mostrarse.
const PRIVADOS = { creadoEn: '2026-11-20T10:00:00.123Z', actualizadoEn: '2026-11-21T11:30:00.456Z', version: 7 };
const perfilDe = (id, cambios = {}) => {
  const perfil = { id, nombreVisible: 'Nombre de prueba', campusId: CAMPUS_A, vendedorActivado: false, ...PRIVADOS, ...cambios };
  return ok({ ...perfil, completo: perfil.nombreVisible !== null && perfil.campusId !== null });
};

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
      oyentes: new Map(), style: new Estilo(), textContent: '', disabled: false, hidden: false, value: '' }, propiedades);
  }
  replaceChildren(...hijos) { this.hijos = []; this.agregar(...hijos); }
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
    const evento = { type: tipo, target: this, prevenido: false, preventDefault() { this.prevenido = true; } };
    for (const funcion of [...(this.oyentes.get(tipo) ?? [])]) funcion(evento);
    return evento;
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
    createElement: tagName => new Elemento(documento, tagName.toUpperCase()),
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
    crear('P', { id: 'cuenta-perfil-estado', hidden: true }),
    crear('P', { id: 'cuenta-perfil-reintentar-zona', hidden: true }).agregar(crear('BUTTON', { id: 'cuenta-perfil-reintentar' })),
    crear('P', { id: 'cuenta-correo', textContent: 'maria.lopez@pucp.edu.pe' }),
    crear('P', { id: 'cuenta-verificado', textContent: 'Correo universitario verificado' }),
    crear('BUTTON', { id: 'cuenta-editar', atributos: new Map([['aria-disabled', 'true'], ['aria-describedby', 'account-static']]) }),
    crear('DIV', { id: 'cuenta-editar-zona', hidden: true }).agregar(crear('FORM', { id: 'cuenta-editar-form' }).agregar(
      crear('INPUT', { id: 'cuenta-editar-nombre' }), crear('P', { id: 'cuenta-editar-nombre-error', hidden: true }),
      crear('SELECT', { id: 'cuenta-editar-universidad', disabled: true }), crear('P', { id: 'cuenta-editar-universidad-error', hidden: true }),
      crear('SELECT', { id: 'cuenta-editar-campus', disabled: true }), crear('P', { id: 'cuenta-editar-campus-error', hidden: true }),
      crear('P', { id: 'cuenta-editar-mensaje', hidden: true }),
      crear('P', { id: 'cuenta-editar-reintentar-zona', hidden: true }).agregar(crear('BUTTON', { id: 'cuenta-editar-reintentar' })),
      crear('BUTTON', { id: 'cuenta-editar-guardar' }), crear('BUTTON', { id: 'cuenta-editar-cancelar' }))),
    crear('P', { id: 'cuenta-cerrar-sesion-zona', hidden: true }).agregar(crear('BUTTON', { id: 'cuenta-cerrar-sesion' })),
    crear('SPAN', { id: 'cuenta-vendedor-estado', textContent: 'Inactivo' }),
    crear('P', { id: 'cuenta-pendiente', hidden: true }),
    ...secciones);
  crear('P', { id: 'account-demo', textContent: 'El perfil de María López… son datos de ejemplo de Figma.' });
  crear('P', { id: 'account-static', textContent: 'Editar perfil se habilita cuando tu sesión y tu perfil terminan de cargarse.' });
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
  const real = () => { control.serviciosReales++; throw new Error('Servicio real no permitido'); };
  const sintetico = nombres => new SyntheticModule(nombres, function () {
    for (const nombre of nombres) this.setExport(nombre, real);
  }, { context: contexto });
  // auth.js, perfiles.js y directorios.js reales nunca se cargan: solo dependencias inyectadas.
  const dependencias = {
    './auth.js': sintetico(['requerirAutenticacion', 'cerrarSesion', 'escucharCambiosAuth']),
    './perfiles.js': sintetico(['consultarMiPerfil', 'actualizarMiPerfil']),
    './directorios.js': sintetico(['consultarUniversidades', 'consultarCampus']),
  };
  const modulo = new SourceTextModule(fuente, { context: contexto, identifier: 'cuenta.js' });
  await modulo.link(nombre => { assert.ok(Object.hasOwn(dependencias, nombre), `import inesperado: ${nombre}`); return dependencias[nombre]; });
  await modulo.evaluate();
  return { api: modulo.namespace, control };
}

// Respuesta de actualizarMiPerfil() simulada: la fila confirmada del actor con la versión siguiente.
const guardadoDe = (entrada, opciones) => ok({ id: opciones.actorEsperado, nombreVisible: entrada.nombreVisible.trim(),
  campusId: entrada.campusId, vendedorActivado: false, creadoEn: PRIVADOS.creadoEn, actualizadoEn: PRIVADOS.actualizadoEn,
  version: entrada.versionEsperada + 1 });

function servicios({ auth = autenticado(), cierre = CERRADA, escuchar, perfil, universidades = ok(UNIVERSIDADES),
  campus = id => ok(CAMPUS[id] ?? []), actualizar = guardadoDe } = {}) {
  const llamadas = { auth: 0, cierre: 0, suscripciones: 0, cancelaciones: 0, perfil: 0, universidades: 0, campus: [], actualizar: [] };
  const responder = (valor, ...argumentos) => (typeof valor === 'function' ? valor(...argumentos) : valor);
  const s = { llamadas, oyente: null, ultimoUsuarioId: null };
  // Por defecto, el perfil corresponde a la última cuenta que devolvió requerirAutenticacion.
  s.respuestas = { auth, cierre, perfil: perfil ?? (() => perfilDe(s.ultimoUsuarioId ?? USUARIO.id)), universidades, campus, actualizar };
  s.emitir = notificacion => s.oyente?.(notificacion);
  s.servicios = {
    requerirAutenticacion: async () => {
      llamadas.auth++;
      const resultado = await responder(s.respuestas.auth);
      if (resultado?.datos?.usuario?.id) s.ultimoUsuarioId = resultado.datos.usuario.id;
      return resultado;
    },
    cerrarSesion: async () => { llamadas.cierre++; return responder(s.respuestas.cierre); },
    consultarMiPerfil: async () => { llamadas.perfil++; return responder(s.respuestas.perfil); },
    actualizarMiPerfil: async (...argumentos) => {
      llamadas.actualizar.push({ argumentos: argumentos.length, entrada: plano(argumentos[0]), opciones: plano(argumentos[1]) });
      return responder(s.respuestas.actualizar, ...argumentos);
    },
    consultarUniversidades: async () => { llamadas.universidades++; return responder(s.respuestas.universidades); },
    consultarCampus: async id => { llamadas.campus.push(id); return responder(s.respuestas.campus, id); },
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
  const montaje = carga.api.montarCuenta({ documento: dom.documento, servicios: s.servicios, esperaAuthMs: opciones.esperaAuthMs });
  await pausa();
  return { ...carga, dom, s, montaje };
}

const mensaje = dom => dom.$('cuenta-mensaje');
const sinEfectos = control => assert.deepEqual(control, { intentosRed: 0, mensajesConsola: 0, serviciosReales: 0 });

// Textos neutros del perfil cuando no hay datos de la cuenta que mostrar.
function perfilNeutro(dom) {
  assert.equal(dom.$('account-name').textContent, 'Perfil pendiente de integración');
  assert.equal(dom.$('cuenta-universidad').textContent, 'Universidad y campus pendientes de integración');
  assert.equal(dom.$('cuenta-vendedor-estado').textContent, 'Pendiente');
  assert.equal(visible(dom.$('cuenta-perfil-reintentar-zona')), false);
}

// Ningún dato de ejemplo de Figma queda visible como información de la cuenta.
function sinDemoVisible(dom) {
  for (const seccion of dom.secciones) assert.equal(visible(seccion), false, `sección de ejemplo visible: ${seccion.textContent}`);
  assert.equal(visible(dom.$('cuenta-avatar')), false);
  assert.equal(visible(dom.$('cuenta-verificado')), false);
  assert.doesNotMatch(dom.$('account-demo').textContent, /María|Figma/);
  for (const id of ['account-name', 'cuenta-universidad', 'cuenta-correo', 'cuenta-vendedor-estado', 'cuenta-mensaje']) {
    assert.doesNotMatch(dom.$(id).textContent, /María|López|PUCP|maria\.lopez|San Miguel/);
  }
}

function vistaSinSesion(dom) {
  perfilNeutro(dom);
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
  assert.deepEqual(Object.keys(api).sort(), ['clasificarActualizacion', 'clasificarAutenticacion', 'clasificarCierre', 'clasificarPerfil',
    'montarCuenta', 'resolverCampus', 'validarNombreVisible']);
  sinEfectos(control);
});

test('clasificarAutenticacion: usuario autenticado, sin sesión, errores y respuestas fuera de contrato', async () => {
  const { api } = await cargar();
  assert.deepEqual(plano(api.clasificarAutenticacion(autenticado())), { tipo: 'AUTENTICADO', id: USUARIO.id, correo: USUARIO.correo });
  assert.equal(api.clasificarAutenticacion(autenticado({ id: USUARIO.id, correo: null })).correo, null);
  assert.deepEqual(plano(api.clasificarAutenticacion(fallo('NO_AUTORIZADO'))), { tipo: 'SIN_SESION' });
  for (const codigo of ['RED', 'LIMITE', 'SERVIDOR']) {
    assert.deepEqual(plano(api.clasificarAutenticacion(fallo(codigo))),
      { tipo: 'ERROR', mensaje: MENSAJES_ERROR[codigo], reintentable: true });
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
  assert.deepEqual(plano(api.clasificarCierre(fallo('RED'))), { tipo: 'FALLIDO', mensaje: MENSAJES_ERROR.RED });
  for (const respuesta of [undefined, null, {}]) {
    assert.deepEqual(plano(api.clasificarCierre(respuesta)), { tipo: 'FALLIDO', mensaje: 'No pudimos cerrar la sesión. Inténtalo de nuevo.' });
  }
});

/* Montaje y estados */
test('carga: neutraliza los datos de ejemplo antes de conocer la sesión', async () => {
  const pendiente = diferida();
  const { dom, s, control } = await montar({ auth: () => pendiente.promesa });
  sinDemoVisible(dom);
  perfilNeutro(dom);
  assert.equal(s.llamadas.perfil, 0, 'el perfil no se consulta antes de confirmar la sesión');
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
  assert.equal(mensaje(dom).textContent, MENSAJES_ERROR.RED);
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

test('SIGNED_IN durante comprobación pendiente invalida la identidad anterior', async () => {
  const primera = diferida();
  const { dom, s } = await montar({ auth: () => primera.promesa });
  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  primera.resolver(autenticado(USUARIO));
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
});

test('respuesta contradictoria y mensajes privados no se presentan', async () => {
  const { api } = await cargar();
  assert.equal(api.clasificarAutenticacion({ ...autenticado(), error: { codigo: 'SERVIDOR', mensaje: 'token privado' } }).tipo, 'ERROR');
  assert.equal(api.clasificarAutenticacion(fallo('SERVIDOR', 'token privado')).mensaje, MENSAJES_ERROR.SERVIDOR);
  assert.equal(api.clasificarAutenticacion(autenticado({ ...USUARIO, is_anonymous: true })).tipo, 'ERROR');
  assert.equal(api.clasificarCierre({ ok: true, datos: null, error: null }).tipo, 'FALLIDO');
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

test('cierre fallido: reconciliar la sesión antes de permitir reintento', async () => {
  const { dom, s } = await montar({ cierre: fallo('RED') });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  await pausa();
  assert.equal(mensaje(dom).textContent, MENSAJES_ERROR.RED);
  assert.equal(mensaje(dom).className, 'alert alert-error');
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  assert.equal(visible(dom.$('cuenta-cerrar-sesion-zona')), true);
  assert.equal(dom.$('cuenta-cerrar-sesion').disabled, false);
  assert.equal(visible(dom.$('cuenta-acceso')), false);
  assert.equal(dom.raiz.getAttribute('aria-busy'), null);
  s.respuestas.cierre = () => Promise.reject(new Error('fallo interno'));
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
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
  assert.match(mensaje(dom).textContent, /sesión anterior se cerró/);
  assert.match(mensaje(dom).textContent, /verificó por separado la sesión actual/);
});

test('logout ambiguo con SIGNED_OUT reconcilia sin restaurar correo anterior', async () => {
  const pendiente = diferida();
  const { dom, s } = await montar({ cierre: () => pendiente.promesa });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null });
  s.respuestas.auth = fallo('NO_AUTORIZADO');
  pendiente.resolver(fallo('RED', 'token interno'));
  await pausa(); await pausa();
  vistaSinSesion(dom);
  assert.equal(dom.$('cuenta-correo').textContent, '');
  assert.equal(s.llamadas.auth, 2);
});

test('logout ambiguo con cambio de cuenta solo muestra la identidad revalidada', async () => {
  const pendiente = diferida();
  const { dom, s } = await montar({ cierre: () => pendiente.promesa });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  s.respuestas.auth = autenticado(OTRO);
  pendiente.resolver(fallo('SERVIDOR', 'token interno'));
  await pausa(); await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  assert.doesNotMatch(mensaje(dom).textContent, /token interno/);
});

for (const resultado of [CERRADA, fallo('MEMORIA_NO_BORRADA')]) {
  test(`cambio a cuenta B durante logout ${resultado.error?.codigo ?? 'exitoso'} reconcilia identidad`, async () => {
    const pendiente = diferida();
    const { dom, s } = await montar({ cierre: () => pendiente.promesa });
    dom.$('cuenta-cerrar-sesion').disparar('click');
    s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
    s.respuestas.auth = autenticado(OTRO);
    pendiente.resolver(resultado);
    await pausa(); await pausa();
    assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
    assert.doesNotMatch(mensaje(dom).textContent, /la sesión anterior|contexto recordado/);
  });
}

test('timeout de logout no confirma ni repite cierre pendiente; recheck y respuesta tardía', async () => {
  const pendiente = diferida();
  const { dom, s, montaje } = await montar({ cierre: () => pendiente.promesa, esperaAuthMs: 1 });
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa(); await pausa();
  assert.equal(s.llamadas.cierre, 1);
  assert.match(mensaje(dom).textContent, /sigue pendiente/);
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(s.llamadas.cierre, 1, 'la segunda pulsación solo comprueba Auth');
  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  await pausa();
  pendiente.resolver(CERRADA);
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  montaje.desmontar();
});

for (const terminaRechazando of [false, true]) {
  test(`timeout permite nuevo cierre después de ${terminaRechazando ? 'rechazo' : 'resolución'} tardía`, async () => {
    const pendiente = diferida();
    const { dom, s } = await montar({ cierre: () => pendiente.promesa, esperaAuthMs: 1 });
    dom.$('cuenta-cerrar-sesion').disparar('click');
    await pausa(); await pausa();
    assert.equal(s.llamadas.cierre, 1);
    if (terminaRechazando) pendiente.resolver(Promise.reject(new Error('detalle interno')));
    else pendiente.resolver(CERRADA);
    await pausa(); await pausa();
    s.respuestas.cierre = CERRADA;
    assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo, 'la reconciliación confirma la sesión activa');
    dom.$('cuenta-cerrar-sesion').disparar('click');
    await pausa();
    assert.equal(s.llamadas.cierre, 2);
  });
}

test('desmontaje durante logout con timeout no restaura datos al montaje nuevo', async () => {
  const pendiente = diferida();
  const anterior = await montar({ cierre: () => pendiente.promesa, esperaAuthMs: 1 });
  anterior.dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa(); await pausa();
  anterior.montaje.desmontar();
  pendiente.resolver(autenticado(USUARIO));
  await pausa(); await pausa();
  assert.equal(anterior.dom.$('cuenta-correo').textContent, '');
  anterior.s.respuestas.auth = autenticado(OTRO);
  const nuevo = anterior.api.montarCuenta({ documento: anterior.dom.documento, servicios: anterior.s.servicios, esperaAuthMs: 20 });
  await pausa();
  assert.equal(anterior.dom.$('cuenta-correo').textContent, OTRO.correo);
  nuevo.desmontar();
});

test('remontaje antes de terminar logout: permite cerrar luego de terminar', async () => {
  const pendiente = diferida();
  const a = await montar({ cierre: () => pendiente.promesa, esperaAuthMs: 1 });
  a.dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa(); await pausa();
  a.montaje.desmontar();
  a.s.respuestas.auth = autenticado(OTRO);
  const nuevo = a.api.montarCuenta({ documento: a.dom.documento, servicios: a.s.servicios, esperaAuthMs: 20 });
  await pausa();
  a.dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(a.s.llamadas.cierre, 1);
  pendiente.resolver(CERRADA);
  await pausa(); await pausa();
  a.s.respuestas.cierre = CERRADA;
  a.dom.$('cuenta-cerrar-sesion').disparar('click');
  await pausa();
  assert.equal(a.s.llamadas.cierre, 2);
  nuevo.desmontar();
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

/* Perfil: consulta y visualización */
const perfilEstado = dom => dom.$('cuenta-perfil-estado');
// Todo el texto visible de la página simulada, para comprobar que no se filtran datos privados.
const textoPagina = dom => {
  const textos = [];
  const recorrer = e => { textos.push(e.textContent, ...[...e.atributos.values()]); e.hijos.forEach(recorrer); };
  recorrer(dom.raiz);
  return textos.join('\n');
};

test('clasificarPerfil: contrato de consultarMiPerfil, identidad esperada y errores por código', async () => {
  const { api } = await cargar();
  assert.deepEqual(plano(api.clasificarPerfil(perfilDe(USUARIO.id), USUARIO.id)),
    { tipo: 'PERFIL', perfil: { nombreVisible: 'Nombre de prueba', campusId: CAMPUS_A, vendedorActivado: false, completo: true, version: 7 } });
  assert.equal(api.clasificarPerfil(perfilDe(USUARIO.id.toUpperCase()), USUARIO.id).tipo, 'PERFIL');
  assert.deepEqual(plano(api.clasificarPerfil(perfilDe(OTRO.id), USUARIO.id)), { tipo: 'OTRA_IDENTIDAD' });
  for (const respuesta of [ok({ ...perfilDe(USUARIO.id).datos, completo: false }), ok({ ...perfilDe(USUARIO.id).datos, campusId: 'no-uuid' }),
    ok({ ...perfilDe(USUARIO.id).datos, nombreVisible: '   ' }), ok({ ...perfilDe(USUARIO.id).datos, vendedorActivado: 'true' }),
    ok({ ...perfilDe(USUARIO.id).datos, version: 0 }), ok({ ...perfilDe(USUARIO.id).datos, version: '7' }),
    { ...perfilDe(USUARIO.id), error: { codigo: 'SERVIDOR' } }, ok(null), null, undefined]) {
    assert.equal(api.clasificarPerfil(respuesta, USUARIO.id).codigo, 'RESPUESTA_INVALIDA');
  }
  assert.equal(api.clasificarPerfil(fallo('CONFIGURACION', 'Falta configurar una URL HTTPS de Supabase'), USUARIO.id).mensaje,
    'No se pudo conectar con el servicio. Inténtalo más tarde.');
  assert.equal(api.clasificarPerfil(fallo('NO_ENCONTRADO'), USUARIO.id).mensaje, 'No encontramos tu perfil.');
  assert.equal(api.clasificarPerfil(fallo('OTRO'), USUARIO.id).mensaje, 'No pudimos cargar tu perfil.');
});

test('resolverCampus: recorre las universidades y verifica la relación universidad-campus', async () => {
  const { api } = await cargar();
  const s = servicios();
  assert.deepEqual(plano(await api.resolverCampus(CAMPUS_B, s.servicios)),
    { tipo: 'ENCONTRADO', texto: 'Universidad de prueba B · Campus de prueba B', universidadId: UNI_B });
  assert.deepEqual(s.llamadas.campus, [UNI, UNI_B]);
  assert.deepEqual(plano(await api.resolverCampus(CAMPUS_A, s.servicios)), { tipo: 'ENCONTRADO', texto: 'UP · Campus de prueba', universidadId: UNI });
  // La respuesta de UNI incluye un campus que declara pertenecer a UNI_B: no se acepta.
  const ajeno = servicios({ campus: id => ok(id === UNI ? [{ id: CAMPUS_A, universidadId: UNI_B, nombre: 'Campus de prueba' }] : []) });
  assert.deepEqual(plano(await api.resolverCampus(CAMPUS_A, ajeno.servicios)), { tipo: 'NO_ENCONTRADO' }, 'campus de otra universidad');
  assert.deepEqual(plano(await api.resolverCampus(CAMPUS_A, servicios({ universidades: fallo('RED') }).servicios)), { tipo: 'ERROR', codigo: 'RED' });
  assert.deepEqual(plano(await api.resolverCampus(CAMPUS_A, servicios({ universidades: ok([{ id: 'x', nombre: 'X' }]) }).servicios)),
    { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA' });
  assert.equal(await api.resolverCampus(CAMPUS_A, servicios().servicios, () => false), null);
});

test('perfil completo: nombre real, campus resuelto, estado de vendedor y perfil completo', async () => {
  const { dom, s, control } = await montar();
  assert.equal(s.llamadas.perfil, 1);
  assert.equal(dom.$('account-name').textContent, 'Nombre de prueba');
  assert.equal(dom.$('cuenta-universidad').textContent, 'UP · Campus de prueba');
  assert.equal(dom.$('cuenta-vendedor-estado').textContent, 'Inactivo');
  assert.equal(perfilEstado(dom).textContent, 'Perfil completo.');
  assert.equal(perfilEstado(dom).getAttribute('data-codigo'), null);
  assert.equal(visible(dom.$('cuenta-perfil-reintentar-zona')), false);
  assert.equal(dom.$('cuenta-correo').textContent, USUARIO.correo);
  sinEfectos(control);
  const vendedor = await montar({ perfil: perfilDe(USUARIO.id, { vendedorActivado: true, campusId: CAMPUS_B }) });
  assert.equal(vendedor.dom.$('cuenta-vendedor-estado').textContent, 'Activo');
  assert.equal(vendedor.dom.$('cuenta-universidad').textContent, 'Universidad de prueba B · Campus de prueba B');
});

test('perfil incompleto: indica qué falta, sin inventar nombre ni campus', async () => {
  const sinNombre = await montar({ perfil: perfilDe(USUARIO.id, { nombreVisible: null }) });
  assert.equal(sinNombre.dom.$('account-name').textContent, 'Nombre sin completar');
  assert.match(perfilEstado(sinNombre.dom).textContent, /incompleto: falta tu nombre\./);
  assert.equal(sinNombre.dom.$('cuenta-universidad').textContent, 'UP · Campus de prueba');
  const sinCampus = await montar({ perfil: perfilDe(USUARIO.id, { campusId: null }) });
  assert.equal(sinCampus.dom.$('cuenta-universidad').textContent, 'Campus sin completar');
  assert.match(perfilEstado(sinCampus.dom).textContent, /falta tu campus\./);
  assert.equal(sinCampus.s.llamadas.universidades, 0, 'sin campus no se consulta el directorio');
  const minimo = await montar({ perfil: perfilDe(USUARIO.id, { nombreVisible: null, campusId: null }) });
  assert.match(perfilEstado(minimo.dom).textContent, /falta tu nombre y tu campus\. Usa «Editar perfil» para completarlo\./);
});

test('perfil: error con texto propio y código de diagnóstico, reintento y carga posterior', async () => {
  const tecnico = 'Falta configurar una URL HTTPS de Supabase y una publishable key pública válida.';
  for (const [respuesta, codigo, texto] of [
    [fallo('RED', tecnico), 'RED', 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.'],
    [fallo('CONFIGURACION', tecnico), 'CONFIGURACION', 'No se pudo conectar con el servicio. Inténtalo más tarde.'],
    [fallo('NO_ENCONTRADO', tecnico), 'NO_ENCONTRADO', 'No encontramos tu perfil.'],
    [fallo('NO_AUTORIZADO', tecnico), 'NO_AUTORIZADO', 'No pudimos verificar tu acceso al perfil. Vuelve a iniciar sesión si el problema continúa.'],
    [() => { throw new Error(tecnico); }, 'RESPUESTA_INVALIDA', 'No pudimos cargar tu perfil.'],
  ]) {
    const { dom, s } = await montar({ perfil: respuesta });
    assert.equal(perfilEstado(dom).textContent, texto, codigo);
    assert.equal(perfilEstado(dom).getAttribute('data-codigo'), codigo);
    assert.equal(visible(dom.$('cuenta-perfil-reintentar-zona')), true);
    assert.equal(dom.$('account-name').textContent, 'Perfil pendiente de integración');
    assert.equal(dom.$('cuenta-vendedor-estado').textContent, 'Pendiente');
    assert.doesNotMatch(textoPagina(dom), /Supabase|URL|HTTPS|publishable/);
    assert.equal(s.llamadas.auth, 1, `${codigo}: sin reverificaciones automáticas`);
    // Reintento: solo vuelve a consultar el perfil.
    s.respuestas.perfil = () => perfilDe(USUARIO.id);
    dom.$('cuenta-perfil-reintentar').focus();
    dom.$('cuenta-perfil-reintentar').disparar('click');
    assert.equal(dom.documento.activeElement, dom.raiz, 'el foco no queda en un botón oculto');
    await pausa();
    assert.equal(s.llamadas.perfil, 2); assert.equal(s.llamadas.auth, 1);
    assert.equal(dom.$('account-name').textContent, 'Nombre de prueba');
    assert.equal(visible(dom.$('cuenta-perfil-reintentar-zona')), false);
    assert.equal(perfilEstado(dom).getAttribute('data-codigo'), null);
  }
});

test('sesión inexistente o con error: el perfil no se consulta', async () => {
  for (const auth of [fallo('NO_AUTORIZADO'), fallo('RED')]) {
    const { dom, s } = await montar({ auth });
    assert.equal(s.llamadas.perfil, 0); assert.equal(s.llamadas.universidades, 0);
    perfilNeutro(dom);
    assert.equal(perfilEstado(dom).hidden, true);
  }
});

test('cambio de identidad durante la consulta: el perfil anterior nunca se muestra', async () => {
  const primera = diferida();
  const respuestas = [() => primera.promesa];
  const { dom, s } = await montar({ perfil: () => (respuestas.shift() ?? (() => perfilDe(s.ultimoUsuarioId, { nombreVisible: 'Nombre de la otra cuenta' })))() });
  assert.equal(dom.$('account-name').textContent, 'Cargando tu perfil…');
  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  await pausa();
  assert.equal(dom.$('account-name').textContent, 'Nombre de la otra cuenta');
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  primera.resolver(perfilDe(USUARIO.id, { nombreVisible: 'Nombre de la cuenta anterior' }));
  await pausa();
  assert.equal(dom.$('account-name').textContent, 'Nombre de la otra cuenta');
  assert.doesNotMatch(textoPagina(dom), /cuenta anterior/);
});

test('perfil de otra cuenta: una sola reverificación y luego error de identidad, sin mostrar sus datos', async () => {
  const { dom, s } = await montar({ perfil: () => perfilDe(OTRO.id, { nombreVisible: 'Datos ajenos' }) });
  assert.equal(s.llamadas.auth, 2, 'una reverificación de la sesión');
  assert.equal(s.llamadas.perfil, 2);
  assert.equal(perfilEstado(dom).getAttribute('data-codigo'), 'IDENTIDAD');
  assert.equal(perfilEstado(dom).textContent, 'La sesión cambió mientras se cargaba el perfil. Vuelve a intentarlo.');
  assert.doesNotMatch(textoPagina(dom), /Datos ajenos/);
  // Reintentar tras IDENTIDAD revalida la sesión antes de consultar.
  s.respuestas.perfil = () => perfilDe(USUARIO.id);
  dom.$('cuenta-perfil-reintentar').disparar('click'); await pausa();
  assert.equal(s.llamadas.auth, 3);
  assert.equal(dom.$('account-name').textContent, 'Nombre de prueba');
});

test('respuestas fuera de orden: una consulta de perfil o de campus antigua no sobrescribe la nueva', async () => {
  const perfiles = [diferida(), diferida()];
  const colaPerfil = [...perfiles];
  const { dom, s, montaje } = await montar({ perfil: () => colaPerfil.shift().promesa });
  void montaje.comprobar(); await pausa();
  assert.equal(s.llamadas.perfil, 2);
  perfiles[1].resolver(perfilDe(USUARIO.id, { nombreVisible: 'Consulta reciente' })); await pausa();
  perfiles[0].resolver(perfilDe(USUARIO.id, { nombreVisible: 'Consulta antigua', vendedorActivado: true })); await pausa();
  assert.equal(dom.$('account-name').textContent, 'Consulta reciente');
  assert.equal(dom.$('cuenta-vendedor-estado').textContent, 'Inactivo');
  // Campus: la resolución antigua queda pendiente y llega después de una nueva carga.
  const campusAntiguo = diferida();
  s.respuestas.perfil = () => perfilDe(USUARIO.id);
  s.respuestas.campus = () => campusAntiguo.promesa;
  void montaje.comprobar(); await pausa();
  assert.equal(dom.$('cuenta-universidad').textContent, 'Cargando campus…');
  s.respuestas.campus = id => ok(CAMPUS[id] ?? []);
  s.respuestas.perfil = () => perfilDe(USUARIO.id, { campusId: CAMPUS_B });
  void montaje.comprobar(); await pausa();
  assert.equal(dom.$('cuenta-universidad').textContent, 'Universidad de prueba B · Campus de prueba B');
  campusAntiguo.resolver(ok(CAMPUS[UNI])); await pausa();
  assert.equal(dom.$('cuenta-universidad').textContent, 'Universidad de prueba B · Campus de prueba B');
});

test('campus no encontrado o directorio con error: sin inventar nombres', async () => {
  const ausente = '0e1f2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b';
  const noEncontrado = await montar({ perfil: perfilDe(USUARIO.id, { campusId: ausente }) });
  assert.equal(noEncontrado.dom.$('cuenta-universidad').textContent, 'Campus no disponible en el directorio');
  assert.deepEqual(noEncontrado.s.llamadas.campus, [UNI, UNI_B]);
  assert.equal(visible(noEncontrado.dom.$('cuenta-perfil-reintentar-zona')), false);
  assert.equal(noEncontrado.dom.$('account-name').textContent, 'Nombre de prueba', 'el resto del perfil se muestra');
  const error = await montar({ campus: fallo('RED', 'No se pudo conectar al directorio (simulado).') });
  assert.equal(error.dom.$('cuenta-universidad').textContent, 'No se pudo cargar el nombre del campus');
  assert.equal(perfilEstado(error.dom).getAttribute('data-codigo'), 'RED');
  assert.equal(visible(error.dom.$('cuenta-perfil-reintentar-zona')), true);
  assert.doesNotMatch(textoPagina(error.dom), /simulado/);
  error.s.respuestas.campus = id => ok(CAMPUS[id] ?? []);
  error.dom.$('cuenta-perfil-reintentar').disparar('click'); await pausa();
  assert.equal(error.dom.$('cuenta-universidad').textContent, 'UP · Campus de prueba');
});

test('cierre de sesión durante la consulta del perfil: la respuesta tardía no escribe', async () => {
  const perfil = diferida();
  const { dom, s } = await montar({ perfil: () => perfil.promesa });
  dom.$('cuenta-cerrar-sesion').disparar('click'); await pausa();
  vistaSinSesion(dom);
  perfil.resolver(perfilDe(USUARIO.id, { nombreVisible: 'No debe aparecer' })); await pausa();
  vistaSinSesion(dom);
  assert.doesNotMatch(textoPagina(dom), /No debe aparecer/);
  assert.equal(s.llamadas.cierre, 1);
  // Cierre externo (SIGNED_OUT) con la consulta de campus pendiente.
  const campus = diferida();
  const otra = await montar({ campus: () => campus.promesa });
  otra.s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null }); await pausa();
  campus.resolver(ok(CAMPUS[UNI])); await pausa();
  vistaSinSesion(otra.dom);
  assert.doesNotMatch(textoPagina(otra.dom), /Nombre de prueba|Campus de prueba/);
});

test('cierre de sesión con el perfil cargado: el perfil se oculta mientras el cierre está pendiente', async () => {
  const cierre = diferida();
  const { dom } = await montar({ cierre: () => cierre.promesa });
  assert.equal(dom.$('account-name').textContent, 'Nombre de prueba');
  dom.$('cuenta-cerrar-sesion').disparar('click');
  perfilNeutro(dom);
  assert.equal(perfilEstado(dom).hidden, true);
  assert.doesNotMatch(textoPagina(dom), /Nombre de prueba|Campus de prueba|Inactivo/);
  cierre.resolver(CERRADA); await pausa();
  vistaSinSesion(dom);
});

test('protección de datos privados: solo se muestran nombre, campus, vendedor y estado del perfil', async () => {
  const literal = '<img src=x onerror=alert(1)>';
  const { dom } = await montar({ perfil: perfilDe(USUARIO.id, { nombreVisible: literal }) });
  assert.equal(dom.$('account-name').textContent, literal);
  assert.equal(dom.$('account-name').hijos.length, 0);
  const pagina = textoPagina(dom);
  for (const privado of [USUARIO.id, CAMPUS_A, UNI, PRIVADOS.creadoEn, PRIVADOS.actualizadoEn, '2026-11-2']) {
    assert.ok(!pagina.includes(privado), `dato privado visible: ${privado}`);
  }
  assert.doesNotMatch(pagina, /versi[oó]n\s*7|"version"/i);
});

test('desmontar durante la consulta del perfil: retira el reintento y descarta la respuesta', async () => {
  const perfil = diferida();
  const { dom, montaje } = await montar({ perfil: () => perfil.promesa });
  montaje.desmontar();
  assert.equal(dom.$('cuenta-perfil-reintentar').cantidadOyentes(), 0);
  perfil.resolver(perfilDe(USUARIO.id)); await pausa();
  perfilNeutro(dom);
  assert.equal(perfilEstado(dom).hidden, true);
});

/* Perfil: edición con actualizarMiPerfil(entrada, { actorEsperado }) */
const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));
const editarDisponible = dom => dom.$('cuenta-editar').getAttribute('aria-disabled') !== 'true';
const formularioAbierto = dom => visible(dom.$('cuenta-editar-zona'));
const opcionesDe = select => select.hijos.map(opcion => [opcion.value, opcion.textContent]);
async function abrirFormulario(dom) {
  dom.$('cuenta-editar').disparar('click');
  await pausa();
}
async function elegir(dom, campo, valor) {
  dom.$(`cuenta-editar-${campo}`).value = valor;
  dom.$(`cuenta-editar-${campo}`).disparar(campo === 'nombre' ? 'input' : 'change');
  await pausa();
}
function enviar(dom) {
  const evento = dom.$('cuenta-editar-form').disparar('submit');
  assert.equal(evento.prevenido, true, 'el envío no recarga la página');
}
const mensajeEdicion = dom => dom.$('cuenta-editar-mensaje');

test('validarNombreVisible y clasificarActualizacion: reglas del contrato y fila del actor', async () => {
  const { api } = await cargar();
  for (const valido of ['Ana', '  Ana Prueba  ', 'Ñandú Pérez', 'a'.repeat(100), '😀'.repeat(100)]) assert.equal(api.validarNombreVisible(valido), null, valido);
  for (const vacio of ['', '   ', null, undefined, 5]) assert.equal(api.validarNombreVisible(vacio), 'NOMBRE_VACIO');
  for (const invalido of ['a', ' b ', 'a'.repeat(101), 'Ana <b>', 'Ana>', 'Ana\u0007', 'Ana\nLópez', 'Ana\u0085', 'Ana \ud800', '\udc00Ana']) {
    assert.equal(api.validarNombreVisible(invalido), 'NOMBRE_INVALIDO', JSON.stringify(invalido));
  }
  const entrada = { nombreVisible: 'Ana', universidadId: UNI, campusId: CAMPUS_A, versionEsperada: 7 };
  assert.deepEqual(plano(api.clasificarActualizacion(guardadoDe(entrada, { actorEsperado: USUARIO.id }), USUARIO.id)), { tipo: 'GUARDADO' });
  for (const respuesta of [guardadoDe(entrada, { actorEsperado: OTRO.id }), ok(null), ok({ id: USUARIO.id, version: 0 }),
    { ...guardadoDe(entrada, { actorEsperado: USUARIO.id }), error: { codigo: 'SERVIDOR' } }]) {
    assert.deepEqual(plano(api.clasificarActualizacion(respuesta, USUARIO.id)), { tipo: 'NO_CONFIRMADO' });
  }
  assert.deepEqual(plano(api.clasificarActualizacion(fallo('CONFLICTO'), USUARIO.id)), { tipo: 'ERROR', codigo: 'CONFLICTO' });
  assert.deepEqual(plano(api.clasificarActualizacion(undefined, USUARIO.id)), { tipo: 'ERROR', codigo: 'RESPUESTA_INVALIDA' });
});

test('Editar perfil: no disponible sin sesión ni mientras el perfil carga; disponible con el perfil cargado', async () => {
  const perfil = diferida();
  const { dom, s } = await montar({ perfil: () => perfil.promesa });
  assert.equal(editarDisponible(dom), false);
  assert.equal(dom.$('cuenta-editar').getAttribute('aria-describedby'), 'account-static');
  await abrirFormulario(dom);
  assert.equal(formularioAbierto(dom), false, 'sin perfil cargado no se abre');
  assert.equal(s.llamadas.universidades, 0);
  perfil.resolver(perfilDe(USUARIO.id)); await pausa();
  assert.equal(editarDisponible(dom), true);
  assert.equal(dom.$('cuenta-editar').getAttribute('aria-describedby'), null);
  assert.equal(dom.$('cuenta-editar').getAttribute('aria-expanded'), 'false');
  for (const auth of [fallo('NO_AUTORIZADO'), fallo('RED')]) {
    const otra = await montar({ auth });
    assert.equal(editarDisponible(otra.dom), false);
    await abrirFormulario(otra.dom);
    assert.equal(formularioAbierto(otra.dom), false);
  }
  const errorPerfil = await montar({ perfil: fallo('RED') });
  assert.equal(editarDisponible(errorPerfil.dom), false, 'con error de perfil no hay versión que editar');
  // Mientras se resuelve el campus todavía no se conoce la universidad que precargar.
  const campus = diferida();
  const resolviendo = await montar({ campus: () => campus.promesa });
  assert.equal(resolviendo.dom.$('account-name').textContent, 'Nombre de prueba');
  assert.equal(editarDisponible(resolviendo.dom), false);
  campus.resolver(ok(CAMPUS[UNI])); await pausa();
  assert.equal(editarDisponible(resolviendo.dom), true);
});

test('completar perfil sin nombre ni campus: elegir universidad y campus, guardar y mostrar lo confirmado', async () => {
  const { dom, s, control } = await montar({ perfil: perfilDe(USUARIO.id, { nombreVisible: null, campusId: null, version: 1 }) });
  assert.equal(s.llamadas.universidades, 0, 'sin campus el perfil no consulta el directorio');
  await abrirFormulario(dom);
  assert.equal(formularioAbierto(dom), true);
  assert.equal(dom.$('cuenta-editar').getAttribute('aria-expanded'), 'true');
  assert.equal(editarDisponible(dom), false, 'el botón no reabre el formulario');
  assert.equal(dom.documento.activeElement, dom.$('cuenta-editar-nombre'));
  assert.equal(dom.$('cuenta-editar-nombre').value, '');
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-universidad')),
    [['', 'Selecciona tu universidad'], [UNI, 'Universidad de prueba (UP)'], [UNI_B, 'Universidad de prueba B']]);
  assert.equal(dom.$('cuenta-editar-universidad').value, '');
  assert.equal(dom.$('cuenta-editar-universidad').disabled, false);
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), [['', 'Selecciona primero una universidad']]);
  assert.equal(dom.$('cuenta-editar-campus').disabled, true);
  assert.deepEqual(s.llamadas.campus, []);
  await elegir(dom, 'nombre', '  Ana Prueba  ');
  await elegir(dom, 'universidad', UNI);
  assert.deepEqual(s.llamadas.campus, [UNI]);
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), [['', 'Selecciona tu campus'], [CAMPUS_A, 'Campus de prueba']]);
  assert.equal(dom.$('cuenta-editar-campus').disabled, false);
  await elegir(dom, 'campus', CAMPUS_A);
  // Ni UUID ni versión aparecen en el texto ni en los atributos de la página mientras se edita.
  const pagina = textoPagina(dom);
  for (const privado of [USUARIO.id, UNI, CAMPUS_A]) assert.ok(!pagina.includes(privado), `dato privado visible: ${privado}`);
  assert.doesNotMatch(pagina, /versi[oó]n/i);
  s.respuestas.perfil = perfilDe(USUARIO.id, { nombreVisible: 'Ana Prueba', campusId: CAMPUS_A, version: 2 });
  enviar(dom); await pausa();
  assert.deepEqual(s.llamadas.actualizar, [{ argumentos: 2,
    entrada: { nombreVisible: '  Ana Prueba  ', universidadId: UNI, campusId: CAMPUS_A, versionEsperada: 1 },
    opciones: { actorEsperado: USUARIO.id } }]);
  // Tras guardar se vuelve a consultar el perfil y se muestra lo que confirma el servidor.
  assert.equal(s.llamadas.perfil, 2);
  assert.equal(formularioAbierto(dom), false);
  assert.equal(dom.$('cuenta-editar-nombre').value, '');
  assert.equal(dom.$('account-name').textContent, 'Ana Prueba');
  assert.equal(dom.$('cuenta-universidad').textContent, 'UP · Campus de prueba');
  assert.equal(perfilEstado(dom).textContent, 'Guardamos tu perfil. Perfil completo.');
  assert.equal(editarDisponible(dom), true);
  sinEfectos(control);
});

test('editar perfil existente: datos y selección precargados, versionEsperada del perfil consultado', async () => {
  const { dom, s } = await montar({ perfil: perfilDe(USUARIO.id, { campusId: CAMPUS_B }) });
  assert.deepEqual(s.llamadas.campus, [UNI, UNI_B], 'resolución del campus para mostrarlo');
  await abrirFormulario(dom);
  assert.equal(dom.$('cuenta-editar-nombre').value, 'Nombre de prueba');
  assert.equal(dom.$('cuenta-editar-universidad').value, UNI_B);
  assert.equal(dom.$('cuenta-editar-campus').value, CAMPUS_B);
  assert.deepEqual(s.llamadas.campus, [UNI, UNI_B, UNI_B]);
  await elegir(dom, 'nombre', 'Nombre editado');
  s.respuestas.perfil = perfilDe(USUARIO.id, { nombreVisible: 'Nombre editado', campusId: CAMPUS_B, version: 8 });
  enviar(dom); await pausa();
  assert.deepEqual(s.llamadas.actualizar[0].entrada,
    { nombreVisible: 'Nombre editado', universidadId: UNI_B, campusId: CAMPUS_B, versionEsperada: 7 });
  assert.equal(dom.$('account-name').textContent, 'Nombre editado');
  // Una segunda edición usa la versión del perfil vuelto a consultar, no la anterior.
  await abrirFormulario(dom);
  enviar(dom); await pausa();
  assert.equal(s.llamadas.actualizar[1].entrada.versionEsperada, 8);
  // Campus que ya no está en el directorio: el formulario no inventa la selección.
  const ausente = await montar({ perfil: perfilDe(USUARIO.id, { campusId: '0e1f2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b' }) });
  await abrirFormulario(ausente.dom);
  assert.equal(ausente.dom.$('cuenta-editar-universidad').value, '');
  assert.equal(ausente.dom.$('cuenta-editar-campus').disabled, true);
});

test('actorEsperado: se captura al abrir y se conserva; Guardar no vuelve a obtener la identidad', async () => {
  const { dom, s } = await montar();
  await abrirFormulario(dom);
  const comprobaciones = s.llamadas.auth;
  // Un refresco de token de la misma cuenta no cambia el actor ni descarta el formulario.
  s.emitir({ evento: 'TOKEN_REFRESHED', estado: 'AUTENTICADO', usuario: USUARIO });
  await pausa();
  assert.equal(formularioAbierto(dom), true);
  enviar(dom); await pausa();
  assert.equal(s.llamadas.auth, comprobaciones, 'sin requerirAutenticacion al guardar');
  assert.equal(s.llamadas.actualizar.length, 1);
  assert.deepEqual(s.llamadas.actualizar[0].opciones, { actorEsperado: USUARIO.id });
  assert.equal(s.llamadas.actualizar[0].argumentos, 2);
});

test('cambio de universidad: limpia el campus anterior, carga los nuevos y descarta respuestas antiguas', async () => {
  const { dom, s } = await montar();
  await abrirFormulario(dom);
  assert.equal(dom.$('cuenta-editar-campus').value, CAMPUS_A);
  const campusUni = diferida();
  s.respuestas.campus = id => (id === UNI ? campusUni.promesa : ok(CAMPUS[id] ?? []));
  dom.$('cuenta-editar-universidad').value = UNI_B;
  dom.$('cuenta-editar-universidad').disparar('change');
  assert.equal(dom.$('cuenta-editar-campus').value, '', 'el campus anterior se limpia en el acto');
  assert.equal(dom.$('cuenta-editar-campus').disabled, true);
  await pausa();
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), [['', 'Selecciona tu campus'], [CAMPUS_B, 'Campus de prueba B']]);
  assert.equal(dom.$('cuenta-editar-campus').value, '', 'no se preselecciona un campus de otra universidad');
  // Sin campus elegido no se envía.
  enviar(dom); await pausa();
  assert.equal(s.llamadas.actualizar.length, 0);
  assert.equal(dom.$('cuenta-editar-campus-error').textContent, 'Selecciona tu campus.');
  assert.equal(dom.$('cuenta-editar-campus').getAttribute('aria-invalid'), 'true');
  // Respuesta fuera de orden: UNI queda pendiente, se vuelve a UNI_B y la respuesta de UNI llega tarde.
  await elegir(dom, 'universidad', UNI);
  await elegir(dom, 'universidad', UNI_B);
  campusUni.resolver(ok(CAMPUS[UNI])); await pausa();
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), [['', 'Selecciona tu campus'], [CAMPUS_B, 'Campus de prueba B']]);
  await elegir(dom, 'campus', CAMPUS_B);
  assert.equal(dom.$('cuenta-editar-campus-error').hidden, true);
  // Volver a «Selecciona tu universidad» también descarta el campus elegido, sin consultar campus.
  const consultas = s.llamadas.campus.length;
  await elegir(dom, 'universidad', '');
  assert.equal(dom.$('cuenta-editar-campus').value, '');
  assert.equal(dom.$('cuenta-editar-campus').disabled, true);
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), [['', 'Selecciona primero una universidad']]);
  assert.equal(s.llamadas.campus.length, consultas);
  await elegir(dom, 'universidad', UNI_B);
  await elegir(dom, 'campus', CAMPUS_B);
  enviar(dom); await pausa();
  assert.deepEqual(s.llamadas.actualizar[0].entrada, { nombreVisible: 'Nombre de prueba', universidadId: UNI_B, campusId: CAMPUS_B, versionEsperada: 7 });
});

test('validación antes de enviar: nombre, universidad y campus, sin llamar al servicio', async () => {
  const { dom, s } = await montar({ perfil: perfilDe(USUARIO.id, { nombreVisible: null, campusId: null, version: 1 }) });
  await abrirFormulario(dom);
  enviar(dom); await pausa();
  assert.equal(dom.$('cuenta-editar-nombre-error').textContent, 'Escribe tu nombre visible.');
  assert.equal(dom.$('cuenta-editar-universidad-error').textContent, 'Selecciona tu universidad.');
  assert.equal(dom.$('cuenta-editar-campus-error').textContent, 'Selecciona tu campus.');
  assert.equal(dom.documento.activeElement, dom.$('cuenta-editar-nombre'), 'el foco va al primer campo inválido');
  for (const nombre of ['A', 'Ana <script>', 'Ana \ud800']) {
    await elegir(dom, 'nombre', nombre);
    assert.equal(dom.$('cuenta-editar-nombre-error').hidden, true, 'escribir limpia el error');
    enviar(dom); await pausa();
    assert.match(dom.$('cuenta-editar-nombre-error').textContent, /entre 2 y 100 caracteres/);
    assert.equal(dom.$('cuenta-editar-nombre').getAttribute('aria-invalid'), 'true');
  }
  // Un valor que no proviene de la lista cargada no se acepta.
  await elegir(dom, 'nombre', 'Ana Prueba');
  dom.$('cuenta-editar-universidad').value = OTRO.id;
  enviar(dom); await pausa();
  assert.equal(dom.$('cuenta-editar-universidad-error').textContent, 'Selecciona tu universidad.');
  assert.equal(s.llamadas.actualizar.length, 0);
});

test('conflicto de versión: vuelve a consultar el perfil, explica el cambio y no sobrescribe', async () => {
  const { dom, s } = await montar({ actualizar: fallo('CONFLICTO', 'Mensaje técnico PT409') });
  await abrirFormulario(dom);
  await elegir(dom, 'nombre', 'Mis cambios');
  s.respuestas.perfil = perfilDe(USUARIO.id, { nombreVisible: 'Cambiado en otra sesión', version: 8 });
  enviar(dom); await pausa();
  assert.equal(s.llamadas.actualizar.length, 1, 'sin reintento automático');
  assert.equal(s.llamadas.perfil, 2);
  assert.equal(formularioAbierto(dom), false);
  assert.equal(dom.$('account-name').textContent, 'Cambiado en otra sesión');
  assert.match(perfilEstado(dom).textContent, /^Tu perfil cambió desde que abriste el formulario y tus cambios no se guardaron\./);
  assert.doesNotMatch(textoPagina(dom), /PT409|Mis cambios/);
  // Al volver a editar se parte de los datos y la versión actuales.
  await abrirFormulario(dom);
  assert.equal(dom.$('cuenta-editar-nombre').value, 'Cambiado en otra sesión');
  s.respuestas.actualizar = guardadoDe;
  enviar(dom); await pausa();
  assert.equal(s.llamadas.actualizar[1].entrada.versionEsperada, 8);
});

test('correo pendiente: conserva el formulario y explica que debe confirmar su correo', async () => {
  const { dom, s } = await montar({ actualizar: fallo('CORREO_PENDIENTE', 'detalle interno') });
  await abrirFormulario(dom);
  await elegir(dom, 'nombre', 'Nombre por guardar');
  enviar(dom); await pausa();
  assert.equal(formularioAbierto(dom), true);
  assert.equal(dom.$('cuenta-editar-nombre').value, 'Nombre por guardar');
  assert.equal(mensajeEdicion(dom).textContent, 'Confirma tu correo antes de guardar el perfil. Tus cambios siguen en el formulario.');
  assert.equal(mensajeEdicion(dom).getAttribute('data-codigo'), 'CORREO_PENDIENTE');
  assert.equal(dom.$('cuenta-editar-guardar').disabled, false);
  assert.equal(s.llamadas.perfil, 1);
  assert.equal(dom.$('account-name').textContent, 'Nombre de prueba', 'no se muestra como guardado');
  assert.doesNotMatch(textoPagina(dom), /detalle interno/);
});

test('validación del servidor y perfil no encontrado', async () => {
  const validacion = await montar({ actualizar: fallo('VALIDACION', 'violates check constraint 22023') });
  await abrirFormulario(validacion.dom);
  enviar(validacion.dom); await pausa();
  assert.equal(formularioAbierto(validacion.dom), true);
  assert.equal(mensajeEdicion(validacion.dom).textContent, 'No se pudo guardar: revisa el nombre y la selección de universidad y campus.');
  assert.doesNotMatch(textoPagina(validacion.dom), /22023|constraint/);

  const { dom, s } = await montar({ actualizar: fallo('NO_ENCONTRADO', 'PT404') });
  await abrirFormulario(dom);
  s.respuestas.perfil = fallo('NO_ENCONTRADO', 'PT404');
  enviar(dom); await pausa();
  assert.equal(formularioAbierto(dom), false);
  assert.equal(s.llamadas.perfil, 2, 'se vuelve a consultar el estado del perfil');
  assert.equal(perfilEstado(dom).textContent, 'Tu perfil ya no está disponible. Tus cambios no se guardaron. No encontramos tu perfil.');
  assert.equal(editarDisponible(dom), false);
  assert.doesNotMatch(textoPagina(dom), /PT404/);
});

test('no autorizado: descarta el formulario, protege los datos y vuelve a verificar la sesión', async () => {
  const { dom, s } = await montar({ actualizar: fallo('NO_AUTORIZADO') });
  await abrirFormulario(dom);
  await elegir(dom, 'nombre', 'Dato escrito');
  s.respuestas.auth = fallo('NO_AUTORIZADO');
  enviar(dom); await pausa();
  assert.equal(s.llamadas.auth, 2);
  assert.equal(formularioAbierto(dom), false);
  assert.equal(dom.$('cuenta-editar-nombre').value, '');
  vistaSinSesion(dom);
  // Si la sesión sigue siendo válida, se recarga el perfil y se explica lo ocurrido.
  const sigue = await montar({ actualizar: fallo('NO_AUTORIZADO') });
  await abrirFormulario(sigue.dom);
  enviar(sigue.dom); await pausa();
  assert.equal(sigue.s.llamadas.auth, 2);
  assert.match(perfilEstado(sigue.dom).textContent, /^No pudimos verificar tu acceso y tus cambios no se guardaron\./);
});

test('error de red o servidor: conserva los datos y permite reintentar; espera agotada sin confirmar', async () => {
  for (const [codigo, texto] of [['RED', /Tus cambios siguen en el formulario/], ['SERVIDOR', /No pudimos guardar tu perfil/],
    ['LIMITE', /demasiados intentos/], ['CONFIGURACION', /Inténtalo más tarde/]]) {
    const { dom, s } = await montar({ actualizar: fallo(codigo, 'Falta configurar una URL HTTPS de Supabase') });
    await abrirFormulario(dom);
    await elegir(dom, 'nombre', 'Nombre conservado');
    enviar(dom); await pausa();
    assert.equal(formularioAbierto(dom), true, codigo);
    assert.equal(dom.$('cuenta-editar-nombre').value, 'Nombre conservado');
    assert.equal(dom.$('cuenta-editar-campus').value, CAMPUS_A);
    assert.match(mensajeEdicion(dom).textContent, texto);
    assert.equal(mensajeEdicion(dom).getAttribute('data-codigo'), codigo);
    assert.doesNotMatch(textoPagina(dom), /Supabase|HTTPS/);
    assert.equal(dom.documento.activeElement, dom.$('cuenta-editar-guardar'));
    s.respuestas.actualizar = guardadoDe;
    s.respuestas.perfil = perfilDe(USUARIO.id, { nombreVisible: 'Nombre conservado', version: 8 });
    enviar(dom); await pausa();
    assert.equal(s.llamadas.actualizar.length, 2);
    assert.equal(s.llamadas.actualizar[1].entrada.versionEsperada, 7, 'el reintento usa la misma versión');
    assert.equal(dom.$('account-name').textContent, 'Nombre conservado');
  }
  const pendiente = diferida();
  const lento = await montar({ actualizar: () => pendiente.promesa, esperaAuthMs: 30 });
  await abrirFormulario(lento.dom);
  enviar(lento.dom);
  await esperar(60);
  assert.equal(formularioAbierto(lento.dom), true);
  assert.match(mensajeEdicion(lento.dom).textContent, /No pudimos confirmar si se guardó/);
  pendiente.resolver(guardadoDe(lento.s.llamadas.actualizar[0].entrada, { actorEsperado: USUARIO.id })); await pausa();
  assert.doesNotMatch(perfilEstado(lento.dom).textContent, /Guardamos/, 'una respuesta tras agotar la espera no se presenta');
});

test('cambio de identidad con el formulario abierto: se descarta el formulario y lo escrito', async () => {
  const { dom, s } = await montar();
  await abrirFormulario(dom);
  await elegir(dom, 'nombre', 'Escrito por la cuenta anterior');
  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO });
  assert.equal(formularioAbierto(dom), false);
  assert.equal(dom.$('cuenta-editar-nombre').value, '');
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-universidad')), []);
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), []);
  assert.equal(dom.$('cuenta-editar').getAttribute('aria-expanded'), 'false');
  await pausa();
  assert.equal(dom.$('cuenta-correo').textContent, OTRO.correo);
  // La nueva cuenta abre su propio formulario con su propio actor.
  await abrirFormulario(dom);
  assert.equal(dom.$('cuenta-editar-nombre').value, 'Nombre de prueba');
  enviar(dom); await pausa();
  assert.deepEqual(s.llamadas.actualizar.map(l => l.opciones.actorEsperado), [OTRO.id]);
  // Cierre externo con el formulario abierto.
  const otra = await montar();
  await abrirFormulario(otra.dom);
  otra.s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null });
  assert.equal(formularioAbierto(otra.dom), false);
  vistaSinSesion(otra.dom);
});

test('cierre de sesión durante el envío: la operación no se presenta como exitosa', async () => {
  for (const cerrar of [dom => dom.$('cuenta-cerrar-sesion').disparar('click'),
    (dom, s) => s.emitir({ evento: 'SIGNED_OUT', estado: 'NO_AUTENTICADO', usuario: null })]) {
    const envio = diferida();
    const { dom, s } = await montar({ actualizar: () => envio.promesa });
    await abrirFormulario(dom);
    enviar(dom);
    assert.equal(mensajeEdicion(dom).hidden, false);
    cerrar(dom, s); await pausa();
    vistaSinSesion(dom);
    assert.equal(formularioAbierto(dom), false);
    envio.resolver(guardadoDe(s.llamadas.actualizar[0].entrada, { actorEsperado: USUARIO.id })); await pausa();
    vistaSinSesion(dom);
    assert.equal(s.llamadas.perfil, 1, 'no se recarga el perfil tras el cierre');
    assert.doesNotMatch(textoPagina(dom), /Guardamos|Nombre de prueba/);
  }
});

test('doble envío: una sola llamada, controles bloqueados mientras se procesa', async () => {
  const envio = diferida();
  const { dom, s } = await montar({ actualizar: () => envio.promesa });
  await abrirFormulario(dom);
  enviar(dom);
  enviar(dom);
  dom.$('cuenta-editar-cancelar').disparar('click');
  dom.$('cuenta-editar-universidad').disparar('change');
  await pausa();
  assert.equal(s.llamadas.actualizar.length, 1);
  assert.equal(formularioAbierto(dom), true, 'Cancelar no actúa durante el envío');
  for (const id of ['cuenta-editar-guardar', 'cuenta-editar-cancelar', 'cuenta-editar-nombre', 'cuenta-editar-universidad', 'cuenta-editar-campus']) {
    assert.equal(dom.$(id).disabled, true, `${id} habilitado durante el envío`);
  }
  assert.equal(dom.$('cuenta-editar-form').getAttribute('aria-busy'), 'true');
  assert.equal(mensajeEdicion(dom).textContent, 'Guardando tu perfil…');
  envio.resolver(guardadoDe(s.llamadas.actualizar[0].entrada, { actorEsperado: USUARIO.id })); await pausa();
  assert.equal(s.llamadas.perfil, 2);
  assert.equal(formularioAbierto(dom), false);
  assert.equal(dom.$('cuenta-editar-form').getAttribute('aria-busy'), null);
});

test('respuestas fuera de orden: un envío o un directorio antiguos no afectan al formulario actual', async () => {
  const envio = diferida();
  const { dom, s } = await montar({ actualizar: () => envio.promesa });
  await abrirFormulario(dom);
  enviar(dom);
  // Cambio de cuenta durante el envío; la nueva cuenta abre su formulario.
  s.respuestas.auth = autenticado(OTRO);
  s.emitir({ evento: 'SIGNED_IN', estado: 'AUTENTICADO', usuario: OTRO }); await pausa();
  await abrirFormulario(dom);
  await elegir(dom, 'nombre', 'Formulario de la cuenta nueva');
  const perfiles = s.llamadas.perfil;
  envio.resolver(guardadoDe(s.llamadas.actualizar[0].entrada, { actorEsperado: USUARIO.id })); await pausa();
  assert.equal(formularioAbierto(dom), true);
  assert.equal(dom.$('cuenta-editar-nombre').value, 'Formulario de la cuenta nueva');
  assert.equal(mensajeEdicion(dom).hidden, true);
  assert.equal(s.llamadas.perfil, perfiles, 'la respuesta antigua no recarga el perfil');
  assert.doesNotMatch(perfilEstado(dom).textContent, /Guardamos/);
  // Universidades: una carga de un formulario cancelado llega después de reabrirlo.
  const universidades = diferida();
  const otra = await montar();
  otra.s.respuestas.universidades = () => universidades.promesa; // Solo la carga del formulario queda pendiente.
  await abrirFormulario(otra.dom);
  assert.equal(formularioAbierto(otra.dom), true);
  otra.dom.$('cuenta-editar-cancelar').disparar('click');
  assert.equal(otra.dom.documento.activeElement, otra.dom.$('cuenta-editar'), 'Cancelar devuelve el foco a Editar perfil');
  otra.s.respuestas.universidades = ok([UNIVERSIDADES[1]]);
  await abrirFormulario(otra.dom);
  universidades.resolver(ok(UNIVERSIDADES)); await pausa();
  assert.deepEqual(opcionesDe(otra.dom.$('cuenta-editar-universidad')), [['', 'Selecciona tu universidad'], [UNI_B, 'Universidad de prueba B']]);
});

test('directorio en el formulario: error con código, lista vacía y reintento', async () => {
  const { dom, s } = await montar({ perfil: perfilDe(USUARIO.id, { campusId: null }), universidades: fallo('RED', 'detalle técnico') });
  await abrirFormulario(dom);
  assert.equal(mensajeEdicion(dom).textContent, 'No pudimos cargar las universidades. Revisa tu conexión e inténtalo de nuevo.');
  assert.equal(mensajeEdicion(dom).getAttribute('data-codigo'), 'RED');
  assert.equal(visible(dom.$('cuenta-editar-reintentar-zona')), true);
  assert.equal(dom.$('cuenta-editar-universidad').disabled, true);
  s.respuestas.universidades = ok(UNIVERSIDADES);
  s.respuestas.campus = ok([]);
  dom.$('cuenta-editar-reintentar').focus();
  dom.$('cuenta-editar-reintentar').disparar('click');
  assert.equal(dom.documento.activeElement, dom.$('cuenta-editar-nombre'), 'el foco no queda en un botón oculto');
  await pausa();
  assert.equal(visible(dom.$('cuenta-editar-reintentar-zona')), false);
  await elegir(dom, 'universidad', UNI);
  assert.equal(mensajeEdicion(dom).textContent, 'No hay campus disponibles para esta universidad. Inténtalo de nuevo.');
  assert.equal(mensajeEdicion(dom).getAttribute('data-codigo'), 'SIN_DATOS');
  s.respuestas.campus = id => ok(CAMPUS[id] ?? []);
  dom.$('cuenta-editar-reintentar').disparar('click'); await pausa();
  assert.deepEqual(opcionesDe(dom.$('cuenta-editar-campus')), [['', 'Selecciona tu campus'], [CAMPUS_A, 'Campus de prueba']]);
  assert.doesNotMatch(textoPagina(dom), /detalle técnico/);
});

test('desmontar con el formulario abierto: retira oyentes y descarta lo escrito', async () => {
  const envio = diferida();
  const { dom, s, montaje } = await montar({ actualizar: () => envio.promesa });
  await abrirFormulario(dom);
  enviar(dom);
  montaje.desmontar();
  for (const id of ['cuenta-editar', 'cuenta-editar-form', 'cuenta-editar-cancelar', 'cuenta-editar-reintentar',
    'cuenta-editar-universidad', 'cuenta-editar-campus', 'cuenta-editar-nombre']) {
    assert.equal(dom.$(id).cantidadOyentes(), 0, id);
  }
  assert.equal(formularioAbierto(dom), false);
  envio.resolver(guardadoDe(s.llamadas.actualizar[0].entrada, { actorEsperado: USUARIO.id })); await pausa();
  assert.equal(s.llamadas.perfil, 1);
  perfilNeutro(dom);
});

/* Contrato con cuenta.html y código fuente */
test('cuenta.html: carga el controlador y contiene los IDs y marcas que usa cuenta.js', () => {
  assert.equal((html.match(/<script type="module" src="js\/cuenta\.js"><\/script>/g) ?? []).length, 1);
  for (const id of ['contenido', 'account-demo', 'cuenta-mensaje', 'cuenta-reintentar-zona', 'cuenta-reintentar', 'cuenta-acceso',
    'cuenta-cerrar-sesion-zona', 'cuenta-cerrar-sesion', 'account-name', 'cuenta-universidad', 'cuenta-correo',
    'cuenta-verificado', 'cuenta-avatar', 'cuenta-vendedor-estado', 'cuenta-pendiente',
    'cuenta-perfil-estado', 'cuenta-perfil-reintentar-zona', 'cuenta-perfil-reintentar', 'account-static', 'cuenta-editar',
    'cuenta-editar-zona', 'cuenta-editar-form', 'cuenta-editar-nombre', 'cuenta-editar-nombre-error', 'cuenta-editar-universidad',
    'cuenta-editar-universidad-error', 'cuenta-editar-campus', 'cuenta-editar-campus-error', 'cuenta-editar-mensaje',
    'cuenta-editar-reintentar-zona', 'cuenta-editar-reintentar', 'cuenta-editar-guardar', 'cuenta-editar-cancelar']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `id ${id}`);
  }
  assert.equal((html.match(/data-cuenta-demo/g) ?? []).length, 0);
  assert.doesNotMatch(html, /María López|maria\.lopez@|MacBook Air M1|4\.9 · 5 opiniones/);
  // Los contenedores nuevos no tienen clase: hidden los oculta aunque el script no se cargue.
  for (const id of ['cuenta-mensaje', 'cuenta-reintentar-zona', 'cuenta-acceso', 'cuenta-cerrar-sesion-zona', 'cuenta-perfil-reintentar-zona',
    'cuenta-editar-zona', 'cuenta-editar-mensaje', 'cuenta-editar-reintentar-zona']) {
    const etiqueta = html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))[0];
    assert.match(etiqueta, /\shidden[\s>]/, `${id} sin hidden`);
    assert.doesNotMatch(etiqueta, /class=/, `${id} con clase`);
  }
  // El estado del perfil se anuncia y empieza oculto; «Editar perfil» empieza no disponible hasta cargar el perfil.
  assert.match(html, /<p class="account-university" id="cuenta-perfil-estado" role="status" aria-live="polite" hidden><\/p>/);
  assert.match(html, /<button id="cuenta-editar" class="button button-outline account-action" type="button" aria-disabled="true" aria-describedby="account-static" aria-controls="cuenta-editar-zona" aria-expanded="false">Editar perfil<\/button>/);
  assert.doesNotMatch(html, /Acción demostrativa sin funcionamiento\. No edita el perfil/);
  assert.match(html, /<p id="cuenta-editar-mensaje" role="status" aria-live="polite" hidden><\/p>/);
  assert.match(html, /<form id="cuenta-editar-form"[^>]*novalidate>/);
  assert.match(html, /<button id="cuenta-editar-guardar" class="button button-primary account-action" type="submit">/);
  for (const campo of ['nombre', 'universidad', 'campus']) {
    assert.match(html, new RegExp(`<label for="cuenta-editar-${campo}">`), `etiqueta de ${campo}`);
    assert.match(html, new RegExp(`id="cuenta-editar-${campo}"[^>]*aria-describedby="cuenta-editar-${campo}-error"`), `ayuda de ${campo}`);
  }
  assert.match(html, /<a class="button button-primary" href="login\.html">Iniciar sesión<\/a>/);
  assert.match(html, /aria-current="page" aria-label="Mi cuenta">/);
});

test('cuenta.js: sin HTML dinámico, red, cliente Supabase ni servicios fuera de alcance', () => {
  assert.doesNotMatch(fuente, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.deepEqual(fuente.match(/^import .*$/gm), [
    "import { requerirAutenticacion, cerrarSesion, escucharCambiosAuth } from './auth.js';",
    "import { consultarMiPerfil, actualizarMiPerfil } from './perfiles.js';",
    "import { consultarUniversidades, consultarCampus } from './directorios.js';",
  ]);
  // Sin cliente propio, sin almacenamiento local ni estado de vendedor por la migración 00200.
  assert.doesNotMatch(fuente, /fetch\(|supabase|localstorage|localStorage|sessionStorage|indexedDB|reservas-ui|mensajeria/i);
  assert.doesNotMatch(fuente, /consultarEstadoVendedor|operaciones-tb4/);
  // La única llamada de actualización pasa siempre el actor capturado al abrir el formulario.
  assert.deepEqual(fuente.match(/servicios\.actualizarMiPerfil\([^)]*\)/g), ['servicios.actualizarMiPerfil(entrada, { actorEsperado: ed.actor })']);
});
