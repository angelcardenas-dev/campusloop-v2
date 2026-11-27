import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

// Solo archivos locales y módulos estándar. Sin npm, SDK, auth.js real, Supabase, HTML ni navegador.
const fuente = await readFile(new URL('../../js/acceso-ui.js', import.meta.url), 'utf8');
const plano = valor => JSON.parse(JSON.stringify(valor));
const pausa = () => new Promise(resolve => setTimeout(resolve, 5));
function diferida() {
  let resolver;
  const promesa = new Promise(resolve => { resolver = resolve; });
  return { promesa, resolver };
}

// Identificadores sintéticos SOLO para este DOM simulado: no son catálogo, universidades ni campus reales.
const UUID_UNIVERSIDAD_PRUEBA = '6a1f0c2e-8b3d-4e5f-9a7b-1c2d3e4f5a6b';
const UUID_CAMPUS_PRUEBA = '7b2e1d3f-9c4e-4f6a-8b8c-2d3e4f5a6b7c';
const UUID_UNIVERSIDAD_B = '8c3f2e4a-0d5f-4a7b-9c9d-3e4f5a6b7c8d';
const UUID_CAMPUS_B = '9d4a3f5b-1e6a-4b8c-8dae-4f5a6b7c8d9e';
// Directorio sintético inyectado: nombres de prueba, sin relación con datos reales de Supabase.
const UNIVERSIDADES = [{ id: UUID_UNIVERSIDAD_PRUEBA, nombre: 'Universidad de prueba', sigla: 'UP' },
  { id: UUID_UNIVERSIDAD_B, nombre: 'Universidad de prueba B', sigla: 'UPB' }];
const CAMPUS = {
  [UUID_UNIVERSIDAD_PRUEBA]: [{ id: UUID_CAMPUS_PRUEBA, universidadId: UUID_UNIVERSIDAD_PRUEBA, nombre: 'Campus de prueba', distrito: null, ciudad: null }],
  [UUID_UNIVERSIDAD_B]: [{ id: UUID_CAMPUS_B, universidadId: UUID_UNIVERSIDAD_B, nombre: 'Campus de prueba B', distrito: null, ciudad: null }],
};
const directorio = datos => ({ ok: true, datos, error: null });
const USUARIO = { id: '3f926c15-550b-42b9-8aa0-b08279954bcb', correo: 'comprador@example.invalid' };
const NO_AUTENTICADO = { ok: true, datos: { estado: 'NO_AUTENTICADO', usuario: null }, error: null };
const AUTENTICADO = { ok: true, datos: { estado: 'AUTENTICADO', usuario: USUARIO }, error: null };
const fallo = (codigo, mensaje = `Mensaje simulado de auth.js: ${codigo}`) => ({ ok: false, datos: null, error: { codigo, mensaje } });

/* DOM mínimo: solo lo que usa acceso-ui.js */
class Elemento {
  constructor(documento, tagName, propiedades = {}) {
    Object.assign(this, { ownerDocument: documento, tagName, padre: null, hijos: [], atributos: new Map(),
      oyentes: new Map(), textContent: '', value: '', checked: false, disabled: false, hidden: false, type: '' }, propiedades);
  }
  get className() { return this.atributos.get('class') ?? ''; }
  set className(valor) { this.atributos.set('class', String(valor)); }
  get options() { return this.hijos.filter(hijo => hijo.tagName === 'OPTION'); }
  agregar(...hijos) { for (const hijo of hijos) { hijo.padre = this; this.hijos.push(hijo); } return this; }
  replaceChildren(...hijos) { for (const hijo of this.hijos) hijo.padre = null; this.hijos = []; return this.agregar(...hijos); }
  contains(otro) { for (let e = otro; e; e = e.padre) if (e === this) return true; return false; }
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
  disparar(tipo, target = this) {
    const evento = { type: tipo, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const funcion of [...(this.oyentes.get(tipo) ?? [])]) funcion(evento);
    return evento;
  }
  querySelectorAll(selector) {
    assert.equal(selector, 'button[type="submit"].auth-submit', 'Selector no previsto en la prueba');
    const encontrados = [];
    const recorrer = e => { for (const h of e.hijos) {
      if (h.tagName === 'BUTTON' && h.type === 'submit' && h.className.split(' ').includes('auth-submit')) encontrados.push(h);
      recorrer(h);
    } };
    recorrer(this);
    return encontrados;
  }
}

function crearDocumento() {
  const porId = new Map();
  const documento = {
    activeElement: null,
    defaultView: { requestAnimationFrame: funcion => setTimeout(funcion, 0) },
    getElementById: id => porId.get(id) ?? null,
    createElement: etiqueta => new Elemento(documento, etiqueta.toUpperCase()),
  };
  const crear = (tagName, propiedades = {}) => {
    const elemento = new Elemento(documento, tagName, propiedades);
    if (propiedades.id) porId.set(propiedades.id, elemento);
    return elemento;
  };
  return { documento, crear };
}

function campo(crear, id, tagName, type) {
  return [crear(tagName, { id, type }), crear('P', { id: `${id}-error`, hidden: true })];
}

// Reproduce un selector de registro.html: opción inicial, estado aria-live, reintento y error.
function selectCatalogo(crear, id, disabled) {
  const select = crear('SELECT', { id, type: 'select-one', disabled });
  select.agregar(crear('OPTION', { value: '', disabled: true }));
  return [select, crear('P', { id: `${id}-estado`, hidden: true }),
    crear('P', { id: `${id}-reintentar-zona`, hidden: true }).agregar(crear('BUTTON', { id: `${id}-reintentar`, type: 'button' })),
    crear('P', { id: `${id}-error`, hidden: true })];
}

function boton(crear) {
  const b = crear('BUTTON', { type: 'submit', disabled: true });
  b.className = 'button button-primary auth-submit';
  return b;
}

// Reproduce IDs, etiquetas y tipos de login.html.
function domLogin() {
  const { documento, crear } = crearDocumento();
  const form = crear('FORM', { id: 'login-form' });
  form.agregar(...campo(crear, 'correo', 'INPUT', 'email'), ...campo(crear, 'contrasena', 'INPUT', 'password'),
    crear('INPUT', { id: 'recordarme', type: 'checkbox', disabled: true }), boton(crear),
    crear('DIV', { id: 'login-mensaje', hidden: true }));
  return elementos(documento, form, 'login-mensaje');
}

// Reproduce IDs, etiquetas y tipos de registro.html; el catálogo lo cargan los servicios inyectados.
function domRegistro({ sinElemento } = {}) {
  const { documento, crear } = crearDocumento();
  const form = crear('FORM', { id: 'registro-form' });
  form.agregar(...campo(crear, 'nombre', 'INPUT', 'text'),
    ...selectCatalogo(crear, 'universidad', false),
    ...selectCatalogo(crear, 'campus', true),
    ...campo(crear, 'correo', 'INPUT', 'email'), ...campo(crear, 'contrasena', 'INPUT', 'password'),
    ...campo(crear, 'confirmar-contrasena', 'INPUT', 'password'), ...campo(crear, 'terminos', 'INPUT', 'checkbox'),
    boton(crear), crear('DIV', { id: 'registro-mensaje', hidden: true }));
  if (sinElemento) { const quitado = documento.getElementById(sinElemento); quitado.padre.hijos = quitado.padre.hijos.filter(h => h !== quitado); quitado.padre = null; }
  return elementos(documento, form, 'registro-mensaje');
}

function elementos(documento, form, idMensaje) {
  const $ = id => documento.getElementById(id);
  return { documento, form, $, boton: form.querySelectorAll('button[type="submit"].auth-submit')[0], region: $(idMensaje) };
}

/* Carga aislada: auth.js se sustituye por un módulo sintético que no debe usarse */
async function cargar({ relojManual = false } = {}) {
  const control = { intentosRed: 0, mensajesConsola: 0, serviciosReales: 0 };
  const reloj = { pendientes: new Map(), siguiente: 1 };
  const temporizadores = relojManual
    ? {
      setTimeout(funcion, ms) { const id = reloj.siguiente++; reloj.pendientes.set(id, { funcion, ms }); return id; },
      clearTimeout(id) { reloj.pendientes.delete(id); },
    }
    : { setTimeout, clearTimeout };
  const contexto = createContext({
    ...temporizadores,
    fetch() { control.intentosRed++; throw new Error('Red deshabilitada en pruebas'); },
    console: { log() { control.mensajesConsola++; }, warn() { control.mensajesConsola++; }, error() { control.mensajesConsola++; } },
    // Sin document ni window: el montaje automático no se ejecuta.
  });
  const real = () => { control.serviciosReales++; throw new Error('Servicio real no permitido'); };
  const sintetico = nombres => new SyntheticModule(nombres, function () {
    for (const nombre of nombres) this.setExport(nombre, real);
  }, { context: contexto });
  // auth.js y directorios.js reales nunca se cargan: solo dependencias inyectadas.
  const dependencias = {
    './auth.js': sintetico(['registrar', 'iniciarSesion', 'obtenerEstadoAuth']),
    './directorios.js': sintetico(['consultarUniversidades', 'consultarCampus']),
  };
  const modulo = new SourceTextModule(fuente, { context: contexto, identifier: 'acceso-ui.js' });
  await modulo.link(nombre => { assert.ok(Object.hasOwn(dependencias, nombre), `import inesperado: ${nombre}`); return dependencias[nombre]; });
  await modulo.evaluate();
  const disparar = () => { for (const [id, t] of [...reloj.pendientes]) { reloj.pendientes.delete(id); t.funcion(); } };
  return { api: modulo.namespace, control, reloj, disparar };
}

function servicios({ estado = NO_AUTENTICADO, login = AUTENTICADO, registro = AUTENTICADO,
  universidades = directorio(UNIVERSIDADES), campus = id => directorio(CAMPUS[id] ?? []) } = {}) {
  const llamadas = { estado: 0, login: [], registro: [], universidades: 0, campus: [] };
  const responder = (valor, ...argumentos) => (typeof valor === 'function' ? valor(...argumentos) : valor);
  const respuestas = { universidades, campus };
  return {
    llamadas,
    respuestas,
    servicios: {
      obtenerEstadoAuth: async () => { llamadas.estado++; return responder(estado); },
      iniciarSesion: async (correo, contrasena) => { llamadas.login.push([correo, contrasena]); return responder(login); },
      registrar: async datos => { llamadas.registro.push(plano(datos)); return responder(registro); },
      consultarUniversidades: async () => { llamadas.universidades++; return responder(respuestas.universidades); },
      consultarCampus: async id => { llamadas.campus.push(id); return responder(respuestas.campus, id); },
    },
  };
}

async function montar(tipo, { dom, cargaOpciones, ...opciones } = {}) {
  const carga = await cargar(cargaOpciones);
  const d = dom ?? (tipo === 'login' ? domLogin() : domRegistro());
  const s = servicios(opciones);
  const navegaciones = [];
  const montarTipo = tipo === 'login' ? carga.api.montarLogin : carga.api.montarRegistro;
  const montaje = montarTipo({ form: d.form, servicios: s.servicios, navegar: url => navegaciones.push(url) });
  return { ...carga, dom: d, s, navegaciones, montaje, montarTipo };
}

function completarLogin(dom, correo = ' comprador@example.invalid ', contrasena = ' clave ') {
  dom.$('correo').value = correo;
  dom.$('contrasena').value = contrasena;
}

// Elige universidad (evento change real), espera sus campus y elige uno.
async function elegirCatalogo(dom, universidadId = UUID_UNIVERSIDAD_PRUEBA, campusId = CAMPUS[universidadId]?.[0]?.id) {
  dom.$('universidad').value = universidadId;
  dom.form.disparar('change', dom.$('universidad'));
  await pausa();
  if (campusId) {
    dom.$('campus').value = campusId;
    dom.form.disparar('change', dom.$('campus'));
  }
}

function completarCampos(dom) {
  dom.$('nombre').value = ' Usuario de prueba ';
  dom.$('correo').value = ' comprador@example.invalid ';
  dom.$('contrasena').value = 'clave solo de prueba';
  dom.$('confirmar-contrasena').value = 'clave solo de prueba';
  dom.$('terminos').checked = true;
  dom.form.disparar('change', dom.$('terminos'));
}

async function completarRegistro(dom) {
  await elegirCatalogo(dom);
  completarCampos(dom);
}

const textos = select => select.options.map(opcion => opcion.textContent);
const valores = select => select.options.filter(opcion => !opcion.disabled).map(opcion => opcion.value);

const sinEfectos = control => assert.deepEqual(control, { intentosRed: 0, mensajesConsola: 0, serviciosReales: 0 });

/* Funciones puras */
test('importar acceso-ui no monta formularios ni usa red, consola o Auth real', async () => {
  const { api, control } = await cargar();
  assert.deepEqual(Object.keys(api).sort(), ['clasificarSesion', 'datosRegistro', 'montarLogin', 'montarRegistro', 'validarLogin', 'validarRegistro']);
  sinEfectos(control);
});

test('validarLogin: 1–128 caracteres sin mínimo de registro; correo obligatorio y con formato', async () => {
  const { api } = await cargar();
  assert.deepEqual(plano(api.validarLogin({ correo: ' a@b.pe ', contrasena: 'x' })), {});
  assert.deepEqual(Object.keys(api.validarLogin({ correo: '', contrasena: '' })).sort(), ['contrasena', 'correo']);
  assert.match(api.validarLogin({ correo: 'a@b.pe', contrasena: 'x'.repeat(129) }).contrasena, /128/);
  assert.match(api.validarLogin({ correo: 'a@b.pe', contrasena: '   ' }).contrasena, /solo espacios/);
  assert.equal(api.validarLogin({ correo: 'a@b.pe', contrasena: 'corta' }).contrasena, undefined);
  for (const correo of ['sin-arroba', 'a@b', `${'a'.repeat(250)}@b.pe`]) assert.ok(api.validarLogin({ correo, contrasena: 'x' }).correo);
});

test('validarRegistro: sin catálogo bloquea universidad y no duplica error de campus', async () => {
  const { api } = await cargar();
  const errores = api.validarRegistro({ nombre: 'Ana', universidad: '', campus: '', correo: 'a@b.pe',
    contrasena: '12345678', 'confirmar-contrasena': '12345678', terminos: true }, { catalogoDisponible: false });
  assert.deepEqual(Object.keys(errores), ['universidad']);
  assert.match(errores.universidad, /catálogo/);
});

test('validarRegistro: reglas alineadas con auth.js y caso válido con IDs sintéticos', async () => {
  const { api } = await cargar();
  const valido = { nombre: 'Ana', universidad: UUID_UNIVERSIDAD_PRUEBA, campus: UUID_CAMPUS_PRUEBA, correo: 'a@b.pe',
    contrasena: '12345678', 'confirmar-contrasena': '12345678', terminos: true };
  assert.deepEqual(plano(api.validarRegistro(valido, { catalogoDisponible: true })), {});
  const errores = api.validarRegistro({ nombre: 'A', universidad: 'PUCP', campus: '', correo: 'x', contrasena: '1234567',
    'confirmar-contrasena': 'otra', terminos: 'true' }, { catalogoDisponible: true });
  assert.deepEqual(Object.keys(errores).sort(), ['confirmar-contrasena', 'contrasena', 'correo', 'nombre', 'terminos', 'universidad']);
  assert.match(api.validarRegistro({ ...valido, nombre: 'Ana\tLópez' }, { catalogoDisponible: true }).nombre, /control/);
  assert.match(api.validarRegistro({ ...valido, campus: 'San Miguel' }, { catalogoDisponible: true }).campus, /catálogo/);
});

test('validarRegistro (nombre): intersección de auth.js y perfiles.js, sin regresiones en nombres válidos', async () => {
  const { api } = await cargar();
  const base = { universidad: UUID_UNIVERSIDAD_PRUEBA, campus: UUID_CAMPUS_PRUEBA, correo: 'a@b.pe',
    contrasena: '12345678', 'confirmar-contrasena': '12345678', terminos: true };
  const errorNombre = nombre => api.validarRegistro({ ...base, nombre }, { catalogoDisponible: true }).nombre ?? null;
  // Reglas de los servicios, copiadas de auth.js:71-73 y perfiles.js:75-76, solo para comprobar la intersección.
  const auth = v => v.trim().length >= 2 && v.trim().length <= 100 && !/[\u0000-\u001f\u007f<>]/.test(v);
  const perfiles = v => [...v.trim()].length >= 2 && [...v.trim()].length <= 100 && !/[\u0000-\u001f\u007f-\u009f<>]/u.test(v);
  const validos = ['Ana', 'Jo', 'María José Pérez', "O'Neil-Ramírez", ' Ana ', 'a'.repeat(100), 'A😀', '😀😀',
    '😀'.repeat(50), 'a'.repeat(98) + '😀', 'José', 'Ana López', ' Ana', 'Zoë Ñañez'];
  for (const nombre of validos) {
    assert.equal(errorNombre(nombre), null, `nombre válido rechazado: ${JSON.stringify(nombre)}`);
    assert.ok(auth(nombre) && perfiles(nombre), `aceptado sin cumplir ambos servicios: ${JSON.stringify(nombre)}`);
  }
  const casos = [
    // Emojis y límites: mínimo 2 puntos de código, máximo 100 unidades UTF-16.
    ['😀', /entre 2 y 100/], ['A', /entre 2 y 100/], [' A ', /entre 2 y 100/], ['a'.repeat(101), /entre 2 y 100/],
    ['😀'.repeat(51), /entre 2 y 100/], ['a'.repeat(99) + '😀', /entre 2 y 100/],
    // Controles C0, DEL y C1, y < >.
    ['Ana\tLópez', /control/], ['Ana\nLópez', /control/], ['Ana\u007FLópez', /control/],
    ['Ana\u0080López', /control/], ['Ana\u0085López', /control/], ['Ana\u009FLópez', /control/],
    ['Ana <b>', /< o >/], ['Ana>', /< o >/],
    // Surrogados sueltos (alto sin bajo, bajo sin alto, invertidos), también en los extremos.
    ['Ana\uD800', /no se pueden procesar/], ['\uDC00Ana', /no se pueden procesar/], ['An\uDC00\uD83Da', /no se pueden procesar/],
    ['Ana \uD83D', /no se pueden procesar/], ['\uD800\uD800Ana', /no se pueden procesar/],
  ];
  for (const [nombre, mensaje] of casos) assert.match(errorNombre(nombre) ?? '', mensaje, JSON.stringify(nombre));
  // Lo rechazado por al menos un servicio también se rechaza aquí.
  for (const nombre of ['😀', '😀'.repeat(51), 'a'.repeat(99) + '😀', 'Ana\u0085López']) {
    assert.ok(!(auth(nombre) && perfiles(nombre)));
  }
  assert.equal(errorNombre(''), 'Ingresa tu nombre completo.');
  assert.equal(errorNombre('   '), 'Ingresa tu nombre completo.');
});

test('datosRegistro: siete nombres del contrato y contraseña sin modificar', async () => {
  const { api } = await cargar();
  assert.deepEqual(plano(api.datosRegistro({ nombre: ' Ana ', universidad: UUID_UNIVERSIDAD_PRUEBA, campus: UUID_CAMPUS_PRUEBA,
    correo: ' A@b.pe ', contrasena: ' p ', 'confirmar-contrasena': ' p ', terminos: true })), {
    nombreVisible: 'Ana', universidadId: UUID_UNIVERSIDAD_PRUEBA, campusId: UUID_CAMPUS_PRUEBA, correo: 'A@b.pe',
    contrasena: ' p ', confirmarContrasena: ' p ', aceptaTerminos: true });
});

test('clasificarSesion: solo NO_AUTENTICADO y CONFIGURACION determinan; NO_AUTORIZADO es indeterminado', async () => {
  const { api } = await cargar();
  const casos = [
    [AUTENTICADO, 'AUTENTICADO'], [NO_AUTENTICADO, 'NO_AUTENTICADO'], [fallo('CONFIGURACION'), 'SIN_CONFIGURACION'],
    [fallo('NO_AUTORIZADO'), 'INDETERMINADO'], [fallo('RED'), 'INDETERMINADO'], [fallo('SERVIDOR'), 'INDETERMINADO'],
    [{ ok: true, datos: {} }, 'INDETERMINADO'], [{ ok: false, error: { codigo: 'CONFIGURACION' } }, 'INDETERMINADO'],
    [null, 'INDETERMINADO'], ['texto', 'INDETERMINADO'],
  ];
  for (const [resultado, tipo] of casos) assert.equal(api.clasificarSesion(resultado).tipo, tipo);
});

/* Montaje y comprobación de sesión */
test('login: el botón sigue deshabilitado hasta resolver la sesión; NO_AUTENTICADO lo habilita', async () => {
  const sesion = diferida();
  const m = await montar('login', { estado: () => sesion.promesa });
  assert.equal(m.dom.boton.disabled, true);
  await pausa(); assert.equal(m.dom.boton.disabled, true);
  sesion.resolver(NO_AUTENTICADO); await pausa();
  assert.equal(m.dom.boton.disabled, false); assert.equal(m.dom.region.hidden, true);
  assert.deepEqual(m.navegaciones, []); sinEfectos(m.control);
});

test('login: sesión AUTENTICADA redirige a inicio.html y nunca habilita el botón', async () => {
  const m = await montar('login', { estado: AUTENTICADO }); await pausa();
  assert.deepEqual(m.navegaciones, ['inicio.html']); assert.equal(m.dom.boton.disabled, true);
});

test('login: CONFIGURACION habilita el formulario y muestra el mensaje de auth.js', async () => {
  const m = await montar('login', { estado: fallo('CONFIGURACION', 'Acceso sin configurar (simulado).') }); await pausa();
  assert.equal(m.dom.boton.disabled, false);
  assert.equal(m.dom.region.hidden, false); assert.equal(m.dom.region.className, 'alert alert-warning');
  assert.equal(m.dom.region.textContent, 'Acceso sin configurar (simulado).');
});

for (const [nombre, estado] of [['NO_AUTORIZADO', fallo('NO_AUTORIZADO')], ['RED', fallo('RED')],
  ['respuesta mal formada', { ok: true }], ['excepción', () => { throw new Error('inesperado'); }]]) {
  test(`login: sesión indeterminada (${nombre}) mantiene el botón deshabilitado y pide recargar`, async () => {
    const m = await montar('login', { estado }); await pausa();
    assert.equal(m.dom.boton.disabled, true); assert.deepEqual(m.navegaciones, []);
    assert.match(m.dom.region.textContent, /No pudimos comprobar/);
  });
}

test('montaje: falta un elemento o se repite el montaje; no se registran oyentes extra', async () => {
  const { api } = await cargar();
  const incompleto = domLogin(); const quitado = incompleto.$('contrasena-error');
  incompleto.form.hijos = incompleto.form.hijos.filter(h => h !== quitado); quitado.padre = null;
  const s = servicios();
  assert.equal(api.montarLogin({ form: incompleto.form, servicios: s.servicios, navegar() {} }), null);
  assert.equal(incompleto.boton.disabled, true); assert.equal(s.llamadas.estado, 0);
  assert.equal(api.montarLogin({ form: null }), null); assert.equal(api.montarRegistro(), null);
  const dom = domLogin();
  assert.ok(api.montarLogin({ form: dom.form, servicios: s.servicios, navegar() {} }));
  assert.equal(api.montarLogin({ form: dom.form, servicios: s.servicios, navegar() {} }), null);
  assert.equal(dom.form.cantidadOyentes(), 3);
});

/* Login */
test('login: envío inválido no llama al servicio; marca errores, aria-invalid y foco', async () => {
  const m = await montar('login'); await pausa();
  m.dom.$('correo').value = 'correo-invalido';
  const evento = m.dom.form.disparar('submit');
  await pausa();
  assert.equal(evento.defaultPrevented, true); assert.equal(m.s.llamadas.login.length, 0);
  assert.equal(m.dom.$('correo').getAttribute('aria-invalid'), 'true');
  assert.equal(m.dom.$('correo-error').hidden, false); assert.ok(m.dom.$('correo-error').textContent);
  assert.equal(m.dom.$('contrasena-error').hidden, false);
  assert.equal(m.dom.documento.activeElement, m.dom.$('correo'));
  m.dom.form.disparar('input', m.dom.$('correo'));
  assert.equal(m.dom.$('correo').getAttribute('aria-invalid'), null);
  assert.equal(m.dom.$('correo-error').textContent, ''); assert.equal(m.dom.$('correo-error').hidden, true);
});

test('login: contraseña de 1 carácter válida, sin recortar; éxito redirige y no rehabilita', async () => {
  const m = await montar('login'); await pausa();
  completarLogin(m.dom, ' comprador@example.invalid ', ' ');
  m.dom.$('contrasena').value = 'x';
  m.dom.form.disparar('submit'); await pausa();
  assert.deepEqual(m.s.llamadas.login, [['comprador@example.invalid', 'x']]);
  assert.deepEqual(m.navegaciones, ['inicio.html']); assert.equal(m.dom.boton.disabled, true);
  assert.equal(m.dom.form.getAttribute('aria-busy'), null);
});

for (const [codigo, clase] of [['CREDENCIALES_INVALIDAS', 'alert alert-error'], ['CORREO_PENDIENTE', 'alert alert-warning'],
  ['RED', 'alert alert-error'], ['LIMITE', 'alert alert-error'], ['SERVIDOR', 'alert alert-error']]) {
  test(`login: error del servicio ${codigo} muestra el mensaje de auth.js y conserva los campos`, async () => {
    const m = await montar('login', { login: fallo(codigo) }); await pausa();
    completarLogin(m.dom); m.dom.boton.focus();
    m.dom.form.disparar('submit'); await pausa();
    assert.equal(m.dom.region.textContent, `Mensaje simulado de auth.js: ${codigo}`);
    assert.equal(m.dom.region.className, clase);
    assert.equal(m.dom.$('correo').value, ' comprador@example.invalid '); assert.equal(m.dom.$('contrasena').value, ' clave ');
    assert.equal(m.dom.boton.disabled, false); assert.equal(m.dom.documento.activeElement, m.dom.boton);
    assert.deepEqual(m.navegaciones, []);
  });
}

test('login: respuesta mal formada o excepción del servicio usan el mensaje genérico', async () => {
  for (const login of [{ ok: true, datos: { estado: 'OTRO' } }, () => { throw new Error('inesperado'); }]) {
    const m = await montar('login', { login }); await pausa();
    completarLogin(m.dom); m.dom.form.disparar('submit'); await pausa();
    assert.match(m.dom.region.textContent, /No pudimos completar la operación/);
    assert.equal(m.dom.boton.disabled, false); assert.deepEqual(m.navegaciones, []);
  }
});

test('login: un segundo envío durante la solicitud no genera otra llamada', async () => {
  const pendiente = diferida();
  const m = await montar('login', { login: () => pendiente.promesa }); await pausa();
  completarLogin(m.dom);
  m.dom.form.disparar('submit'); m.dom.form.disparar('submit');
  assert.equal(m.dom.boton.disabled, true); assert.equal(m.dom.form.getAttribute('aria-busy'), 'true');
  pendiente.resolver(fallo('CREDENCIALES_INVALIDAS')); await pausa();
  assert.equal(m.s.llamadas.login.length, 1); assert.equal(m.dom.boton.disabled, false);
});

/* Registro: catálogo de universidades y campus */
test('universidades: estado de carga anunciado y lista cargada desde el servicio inyectado', async () => {
  const pendiente = diferida();
  const m = await montar('registro', { universidades: () => pendiente.promesa });
  const universidad = m.dom.$('universidad');
  assert.equal(universidad.disabled, true);
  assert.deepEqual(textos(universidad), ['Cargando universidades…']);
  await pausa();
  assert.equal(m.dom.$('universidad-estado').hidden, false);
  assert.equal(m.dom.$('universidad-estado').textContent, 'Cargando universidades…');
  assert.equal(m.dom.$('campus').disabled, true);
  assert.equal(m.dom.boton.disabled, true, 'sesión comprobada pero catálogo cargando');
  pendiente.resolver(directorio(UNIVERSIDADES)); await pausa();
  assert.equal(universidad.disabled, false);
  assert.deepEqual(textos(universidad), ['Selecciona tu universidad', 'Universidad de prueba (UP)', 'Universidad de prueba B (UPB)']);
  assert.deepEqual(valores(universidad), [UUID_UNIVERSIDAD_PRUEBA, UUID_UNIVERSIDAD_B]);
  assert.equal(universidad.value, '');
  assert.equal(m.dom.$('universidad-estado').hidden, true);
  assert.equal(m.dom.$('universidad-reintentar-zona').hidden, true);
  assert.deepEqual(textos(m.dom.$('campus')), ['Primero selecciona una universidad']);
  assert.equal(m.dom.$('campus').disabled, true);
  assert.equal(m.s.llamadas.universidades, 1); assert.deepEqual(m.s.llamadas.campus, []);
  assert.equal(m.dom.region.hidden, true, 'el catálogo no usa la región general');
  sinEfectos(m.control);
});

test('universidades: error con mensaje propio, reintento y foco devuelto al selector', async () => {
  const m = await montar('registro', { universidades: fallo('RED', 'No se pudo conectar al directorio (simulado).') }); await pausa();
  const universidad = m.dom.$('universidad');
  assert.equal(universidad.disabled, true);
  assert.deepEqual(textos(universidad), ['Universidades no disponibles']);
  assert.equal(m.dom.$('universidad-estado').textContent, 'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.');
  assert.equal(m.dom.$('universidad-estado').getAttribute('data-codigo'), 'RED');
  assert.equal(m.dom.$('universidad-reintentar-zona').hidden, false);
  assert.equal(m.dom.boton.disabled, true);
  m.s.respuestas.universidades = directorio(UNIVERSIDADES);
  m.dom.$('universidad-reintentar').focus();
  m.dom.$('universidad-reintentar').disparar('click');
  assert.equal(m.dom.$('universidad-reintentar-zona').hidden, true, 'el reintento se oculta mientras carga');
  await pausa();
  assert.equal(m.s.llamadas.universidades, 2);
  assert.equal(universidad.disabled, false);
  assert.equal(m.dom.documento.activeElement, universidad);
  assert.equal(m.dom.$('universidad-estado').getAttribute('data-codigo'), null, 'el éxito retira el diagnóstico');
  // Excepción y filas fuera de contrato: error genérico, sin crear opciones.
  for (const universidades of [() => { throw new Error('fallo interno'); }, directorio([{ id: 'no-uuid', nombre: 'X' }]), { ok: true, datos: null }]) {
    const otro = await montar('registro', { universidades }); await pausa();
    assert.equal(otro.dom.$('universidad-estado').textContent, 'No se pudieron cargar las universidades.');
    assert.deepEqual(valores(otro.dom.$('universidad')), []);
  }
});

test('universidades: catálogo vacío deja el registro bloqueado y ofrece reintentar', async () => {
  const m = await montar('registro', { universidades: directorio([]) }); await pausa();
  assert.equal(m.dom.$('universidad').disabled, true);
  assert.match(m.dom.$('universidad-estado').textContent, /No hay universidades disponibles/);
  assert.equal(m.dom.$('universidad-reintentar-zona').hidden, false);
  completarCampos(m.dom);
  assert.equal(m.dom.boton.disabled, true);
  m.dom.form.disparar('submit'); await pausa();
  assert.equal(m.s.llamadas.registro.length, 0);
  assert.match(m.dom.$('universidad-error').textContent, /catálogo/);
});

test('campus: universidad sin campus deshabilita el selector, informa y bloquea el registro', async () => {
  const m = await montar('registro', { campus: directorio([]) }); await pausa();
  completarCampos(m.dom);
  await elegirCatalogo(m.dom, UUID_UNIVERSIDAD_PRUEBA, null);
  assert.deepEqual(m.s.llamadas.campus, [UUID_UNIVERSIDAD_PRUEBA]);
  assert.equal(m.dom.$('campus').disabled, true);
  assert.deepEqual(textos(m.dom.$('campus')), ['Campus no disponibles']);
  assert.equal(m.dom.$('campus-estado').textContent, 'Esta universidad no tiene campus disponibles por ahora.');
  assert.equal(m.dom.$('campus-reintentar-zona').hidden, false);
  assert.equal(m.dom.boton.disabled, true);
});

test('campus: cambiar de universidad limpia de inmediato el campus anterior, sus opciones y su error', async () => {
  const segundaConsulta = diferida();
  const m = await montar('registro'); await pausa();
  await elegirCatalogo(m.dom);
  assert.equal(m.dom.$('campus').value, UUID_CAMPUS_PRUEBA);
  m.dom.$('campus-error').hidden = false; m.dom.$('campus-error').textContent = 'Error anterior';
  m.dom.$('campus').setAttribute('aria-invalid', 'true');
  m.s.respuestas.campus = () => segundaConsulta.promesa;
  m.dom.$('universidad').value = UUID_UNIVERSIDAD_B;
  m.dom.form.disparar('change', m.dom.$('universidad'));
  // Antes de la respuesta: sin campus anterior, sin sus opciones, deshabilitado y sin error.
  assert.equal(m.dom.$('campus').value, '');
  assert.deepEqual(textos(m.dom.$('campus')), ['Cargando campus…']);
  assert.equal(m.dom.$('campus').disabled, true);
  assert.equal(m.dom.$('campus-error').hidden, true); assert.equal(m.dom.$('campus').getAttribute('aria-invalid'), null);
  assert.equal(m.dom.boton.disabled, true);
  segundaConsulta.resolver(directorio(CAMPUS[UUID_UNIVERSIDAD_B])); await pausa();
  assert.deepEqual(valores(m.dom.$('campus')), [UUID_CAMPUS_B]);
  assert.equal(m.dom.$('campus').disabled, false);
  // Volver a la opción inicial de universidad vacía el campus sin consultar.
  m.dom.$('universidad').value = '';
  m.dom.form.disparar('change', m.dom.$('universidad'));
  assert.deepEqual(textos(m.dom.$('campus')), ['Primero selecciona una universidad']);
  assert.equal(m.s.llamadas.campus.length, 2);
});

for (const orden of ['la más reciente responde primero', 'la antigua responde después']) {
  test(`campus: respuestas fuera de orden (${orden}) no sobrescriben la selección actual`, async () => {
    const consultas = { [UUID_UNIVERSIDAD_PRUEBA]: diferida(), [UUID_UNIVERSIDAD_B]: diferida() };
    const m = await montar('registro', { campus: id => consultas[id].promesa }); await pausa();
    m.dom.$('universidad').value = UUID_UNIVERSIDAD_PRUEBA; m.dom.form.disparar('change', m.dom.$('universidad'));
    m.dom.$('universidad').value = UUID_UNIVERSIDAD_B; m.dom.form.disparar('change', m.dom.$('universidad'));
    const resolver = id => consultas[id].resolver(directorio(CAMPUS[id]));
    if (orden.startsWith('la más reciente')) { resolver(UUID_UNIVERSIDAD_B); await pausa(); resolver(UUID_UNIVERSIDAD_PRUEBA); }
    else { resolver(UUID_UNIVERSIDAD_PRUEBA); await pausa(); assert.deepEqual(textos(m.dom.$('campus')), ['Cargando campus…']); resolver(UUID_UNIVERSIDAD_B); }
    await pausa();
    assert.deepEqual(valores(m.dom.$('campus')), [UUID_CAMPUS_B]);
    assert.equal(m.dom.$('campus-estado').hidden, true);
  });
}

test('directorios: mensajes comprensibles por código, sin detalle técnico y con código para diagnóstico', async () => {
  const tecnico = 'Falta configurar una URL HTTPS de Supabase y una publishable key pública válida.';
  const casos = [
    [fallo('CONFIGURACION', tecnico), 'CONFIGURACION', 'No se pudo conectar con el servicio. Inténtalo más tarde.'],
    [fallo('RED', 'No pudimos cargar el cliente de Supabase. Revisa la conexión e inténtalo de nuevo.'), 'RED',
      'No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.'],
    [fallo('NO_AUTORIZADO', 'El servidor denegó el acceso al directorio.'), 'NO_AUTORIZADO',
      'El servicio no permitió consultar el catálogo. Inténtalo más tarde.'],
    [fallo('LIMITE', 'Espera antes de volver a consultar el directorio.'), 'LIMITE',
      'Se hicieron demasiadas consultas. Espera un momento antes de reintentar.'],
    [fallo('SERVIDOR', tecnico), 'SERVIDOR', 'No se pudieron cargar las universidades.'],
    [fallo('OTRO_CODIGO', tecnico), 'OTRO_CODIGO', 'No se pudieron cargar las universidades.'],
    [fallo('código <inválido>', tecnico), 'RESPUESTA_INVALIDA', 'No se pudieron cargar las universidades.'],
    [() => { throw new Error(tecnico); }, 'RESPUESTA_INVALIDA', 'No se pudieron cargar las universidades.'],
  ];
  for (const [universidades, codigo, mensaje] of casos) {
    const m = await montar('registro', { universidades }); await pausa();
    const estado = m.dom.$('universidad-estado');
    assert.equal(estado.textContent, mensaje, codigo);
    assert.equal(estado.getAttribute('data-codigo'), codigo);
    assert.equal(m.dom.$('universidad-reintentar-zona').hidden, false, `${codigo}: reintento disponible`);
    for (const id of ['universidad-estado', 'campus-estado', 'registro-mensaje', 'universidad-error']) {
      assert.doesNotMatch(m.dom.$(id).textContent, /Supabase|URL|HTTPS|publishable|key|clave|cliente/i);
    }
    assert.doesNotMatch(JSON.stringify([...estado.atributos]), /Supabase|URL|publishable/i);
    sinEfectos(m.control);
  }
  // Campus: misma traducción y respaldo propio de campus.
  const m = await montar('registro', { campus: fallo('CONFIGURACION', tecnico) }); await pausa();
  await elegirCatalogo(m.dom, UUID_UNIVERSIDAD_PRUEBA, null);
  assert.equal(m.dom.$('campus-estado').textContent, 'No se pudo conectar con el servicio. Inténtalo más tarde.');
  assert.equal(m.dom.$('campus-estado').getAttribute('data-codigo'), 'CONFIGURACION');
  m.s.respuestas.campus = fallo('SERVIDOR', tecnico);
  m.dom.$('campus-reintentar').disparar('click'); await pausa();
  assert.equal(m.dom.$('campus-estado').textContent, 'No se pudieron cargar los campus.');
  m.s.respuestas.campus = id => directorio(CAMPUS[id]);
  m.dom.$('campus-reintentar').disparar('click'); await pausa();
  assert.equal(m.dom.$('campus-estado').getAttribute('data-codigo'), null);
});

test('campus: error, reintento para la misma universidad y relación universidad-campus verificada', async () => {
  const m = await montar('registro', { campus: fallo('SERVIDOR', 'No se pudo consultar el directorio (simulado).') }); await pausa();
  await elegirCatalogo(m.dom, UUID_UNIVERSIDAD_PRUEBA, null);
  assert.equal(m.dom.$('campus-estado').textContent, 'No se pudieron cargar los campus.');
  assert.equal(m.dom.$('campus-estado').getAttribute('data-codigo'), 'SERVIDOR');
  assert.equal(m.dom.$('campus-reintentar-zona').hidden, false);
  assert.equal(m.dom.$('campus').disabled, true);
  m.s.respuestas.campus = id => directorio(CAMPUS[id]);
  m.dom.$('campus-reintentar').focus();
  m.dom.$('campus-reintentar').disparar('click'); await pausa();
  assert.deepEqual(m.s.llamadas.campus, [UUID_UNIVERSIDAD_PRUEBA, UUID_UNIVERSIDAD_PRUEBA]);
  assert.deepEqual(valores(m.dom.$('campus')), [UUID_CAMPUS_PRUEBA]);
  assert.equal(m.dom.documento.activeElement, m.dom.$('campus'));
  // Un campus de otra universidad en la respuesta se rechaza como error, sin opciones.
  m.s.respuestas.campus = () => directorio(CAMPUS[UUID_UNIVERSIDAD_B]);
  m.dom.$('universidad').value = UUID_UNIVERSIDAD_B; m.dom.form.disparar('change', m.dom.$('universidad')); await pausa();
  m.s.respuestas.campus = () => directorio(CAMPUS[UUID_UNIVERSIDAD_PRUEBA]);
  m.dom.$('campus-reintentar').disparar('click'); await pausa();
  assert.deepEqual(valores(m.dom.$('campus')), []);
  assert.equal(m.dom.$('campus-estado').textContent, 'No se pudieron cargar los campus.');
});

/* Registro: habilitación del botón */
test('registro: botón bloqueado mientras el catálogo no está disponible, aunque el resto sea válido', async () => {
  const pendiente = diferida();
  const m = await montar('registro', { universidades: () => pendiente.promesa }); await pausa();
  completarCampos(m.dom);
  assert.equal(m.dom.boton.disabled, true);
  m.dom.form.disparar('submit'); await pausa();
  assert.equal(m.s.llamadas.registro.length, 0);
  pendiente.resolver(directorio(UNIVERSIDADES)); await pausa();
  assert.equal(m.dom.boton.disabled, true, 'universidad cargada sin campus elegido');
  await elegirCatalogo(m.dom);
  assert.equal(m.dom.boton.disabled, false);
});

test('registro: habilitado solo con sesión comprobada, catálogo listo y formulario válido', async () => {
  const sesion = diferida();
  const m = await montar('registro', { estado: () => sesion.promesa }); await pausa();
  await completarRegistro(m.dom);
  assert.equal(m.dom.boton.disabled, true, 'sesión sin comprobar');
  sesion.resolver(NO_AUTENTICADO); await pausa();
  assert.equal(m.dom.boton.disabled, false);
  m.dom.$('terminos').checked = false; m.dom.form.disparar('change', m.dom.$('terminos'));
  assert.equal(m.dom.boton.disabled, true, 'términos sin aceptar');
  m.dom.$('terminos').checked = true; m.dom.form.disparar('change', m.dom.$('terminos'));
  m.dom.$('confirmar-contrasena').value = 'otra clave'; m.dom.form.disparar('input', m.dom.$('confirmar-contrasena'));
  assert.equal(m.dom.boton.disabled, true, 'contraseñas distintas');
  m.dom.$('confirmar-contrasena').value = 'clave solo de prueba'; m.dom.form.disparar('input', m.dom.$('confirmar-contrasena'));
  assert.equal(m.dom.boton.disabled, false);
  // Un campus con UUID válido pero de otra universidad (no cargado para la actual) no habilita el envío.
  m.dom.$('campus').value = UUID_CAMPUS_B; m.dom.form.disparar('change', m.dom.$('campus'));
  assert.equal(m.dom.boton.disabled, true, 'campus ajeno a la universidad seleccionada');
  m.dom.$('campus').value = UUID_CAMPUS_PRUEBA; m.dom.form.disparar('change', m.dom.$('campus'));
  assert.equal(m.dom.boton.disabled, false);
  // Sesión iniciada en otra pestaña: redirige y no rehabilita.
  const autenticada = await montar('registro', { estado: AUTENTICADO }); await pausa();
  await completarRegistro(autenticada.dom);
  assert.equal(autenticada.dom.boton.disabled, true); assert.deepEqual(autenticada.navegaciones, ['inicio.html']);
});

test('registro: al salir de un campo editado se explica su error; los no editados no muestran errores', async () => {
  const m = await montar('registro'); await pausa();
  m.dom.form.disparar('focusout', m.dom.$('correo'));
  assert.equal(m.dom.$('correo-error').hidden, true, 'campo no editado');
  m.dom.$('correo').value = 'correo-invalido'; m.dom.form.disparar('input', m.dom.$('correo'));
  m.dom.form.disparar('focusout', m.dom.$('correo'));
  assert.equal(m.dom.$('correo-error').hidden, false); assert.ok(m.dom.$('correo-error').textContent);
  assert.equal(m.dom.$('correo').getAttribute('aria-invalid'), 'true');
  m.dom.$('correo').value = 'a@b.pe'; m.dom.form.disparar('input', m.dom.$('correo'));
  assert.equal(m.dom.$('correo-error').hidden, true);
  m.dom.form.disparar('focusout', m.dom.$('correo'));
  assert.equal(m.dom.$('correo-error').hidden, true);
  assert.equal(m.dom.$('nombre-error').hidden, true);
});

test('registro: elementos de catálogo ausentes impiden el montaje sin consultar servicios', async () => {
  const { api } = await cargar();
  for (const id of ['universidad-estado', 'campus-reintentar']) {
    const dom = domRegistro({ sinElemento: id });
    const s = servicios();
    assert.equal(api.montarRegistro({ form: dom.form, servicios: s.servicios, navegar() {} }), null);
    assert.equal(s.llamadas.universidades, 0); assert.equal(s.llamadas.estado, 0); assert.equal(dom.boton.disabled, true);
  }
});

test('registro: desmontar durante la carga descarta respuestas y retira los reintentos', async () => {
  const universidades = diferida();
  const m = await montar('registro', { universidades: () => universidades.promesa }); await pausa();
  m.montaje.desmontar();
  universidades.resolver(directorio(UNIVERSIDADES)); await pausa();
  assert.deepEqual(valores(m.dom.$('universidad')), []);
  assert.equal(m.dom.$('universidad-estado').hidden, true);
  assert.equal(m.dom.$('universidad-reintentar').cantidadOyentes(), 0);
  assert.equal(m.dom.$('campus-reintentar').cantidadOyentes(), 0);
  assert.equal(m.dom.form.cantidadOyentes(), 0);
  // Un montaje de registro registra submit, input, change y focusout; login conserva sus tres oyentes.
  const nuevo = await montar('registro'); await pausa();
  assert.equal(nuevo.dom.form.cantidadOyentes(), 4);
});

test('registro PENDIENTE_CONFIRMACION: mensaje neutro, solo se vacían las contraseñas y no navega', async () => {
  const pendiente = { ok: true, datos: { estado: 'PENDIENTE_CONFIRMACION', usuario: USUARIO }, error: null };
  const m = await montar('registro', { registro: pendiente }); await pausa();
  assert.equal(m.dom.region.hidden, true);
  await completarRegistro(m.dom);
  assert.equal(m.dom.boton.disabled, false);
  m.dom.form.disparar('submit'); await pausa();
  assert.deepEqual(m.s.llamadas.registro, [{ nombreVisible: 'Usuario de prueba', universidadId: UUID_UNIVERSIDAD_PRUEBA,
    campusId: UUID_CAMPUS_PRUEBA, correo: 'comprador@example.invalid', contrasena: 'clave solo de prueba',
    confirmarContrasena: 'clave solo de prueba', aceptaTerminos: true }]);
  assert.equal(m.dom.region.className, 'alert');
  assert.match(m.dom.region.textContent, /confirmar tu cuenta.*todavía no se han guardado/);
  assert.equal(m.dom.$('contrasena').value, ''); assert.equal(m.dom.$('confirmar-contrasena').value, '');
  assert.equal(m.dom.$('nombre').value, ' Usuario de prueba '); assert.equal(m.dom.$('correo').value, ' comprador@example.invalid ');
  assert.equal(m.dom.$('terminos').checked, true); assert.deepEqual(m.navegaciones, []);
  assert.equal(m.dom.boton.disabled, true, 'sin contraseñas no se puede repetir el registro');
  sinEfectos(m.control);
});

test('registro: error del servicio se muestra sin borrar ningún campo', async () => {
  const m = await montar('registro', { registro: fallo('VALIDACION') }); await pausa();
  await completarRegistro(m.dom); m.dom.form.disparar('submit'); await pausa();
  assert.equal(m.dom.region.textContent, 'Mensaje simulado de auth.js: VALIDACION');
  assert.equal(m.dom.$('contrasena').value, 'clave solo de prueba'); assert.deepEqual(m.navegaciones, []);
  assert.equal(m.dom.boton.disabled, false);
});

/* Desmontaje y concurrencia */
for (const resultado of [AUTENTICADO, NO_AUTENTICADO]) {
  test(`desmontaje durante la comprobación (${resultado.datos.estado}): no navega, no escribe ni habilita`, async () => {
    const sesion = diferida();
    const m = await montar('login', { estado: () => sesion.promesa, cargaOpciones: { relojManual: true } });
    assert.equal(m.reloj.pendientes.size, 1);
    m.montaje.desmontar();
    assert.equal(m.reloj.pendientes.size, 0, 'desmontar() cancela el aviso de 10 s');
    sesion.resolver(resultado); await pausa();
    assert.deepEqual(m.navegaciones, []); assert.equal(m.dom.boton.disabled, true);
    assert.equal(m.dom.region.hidden, true); assert.equal(m.dom.region.textContent, '');
    assert.equal(m.dom.form.cantidadOyentes(), 0);
  });
}

test('avisos de 10 s independientes: cada comprobación limpia solo su temporizador', async () => {
  const primera = diferida(); const segunda = diferida();
  const respuestas = [primera.promesa, segunda.promesa];
  const m = await montar('login', { estado: () => respuestas.shift(), cargaOpciones: { relojManual: true } });
  void m.montaje.comprobar();
  assert.equal(m.reloj.pendientes.size, 2);
  primera.resolver(AUTENTICADO); await pausa();
  assert.equal(m.reloj.pendientes.size, 1, 'la primera no cancela el aviso de la segunda');
  assert.deepEqual(m.navegaciones, [], 'una comprobación antigua no redirige');
  m.disparar(); await pausa();
  assert.equal(m.dom.region.textContent, 'La comprobación de tu sesión está tardando más de lo habitual.');
  segunda.resolver(NO_AUTENTICADO); await pausa();
  assert.equal(m.dom.boton.disabled, false); assert.equal(m.dom.region.hidden, true);
});

test('desmontaje durante el login: no navega, no muestra mensajes y retira aria-busy', async () => {
  const pendiente = diferida();
  const m = await montar('login', { login: () => pendiente.promesa }); await pausa();
  completarLogin(m.dom); m.dom.form.disparar('submit');
  assert.equal(m.dom.form.getAttribute('aria-busy'), 'true');
  m.montaje.desmontar();
  assert.equal(m.dom.form.getAttribute('aria-busy'), null); assert.equal(m.dom.boton.disabled, true);
  pendiente.resolver(AUTENTICADO); await pausa();
  assert.deepEqual(m.navegaciones, []); assert.equal(m.dom.region.hidden, true);
  assert.equal(m.dom.boton.disabled, true);
});

test('remontaje: una solicitud del montaje anterior no deshabilita ni escribe en el nuevo', async () => {
  const pendiente = diferida();
  const m = await montar('login', { login: () => pendiente.promesa }); await pausa();
  completarLogin(m.dom); m.dom.form.disparar('submit');
  m.montaje.desmontar();
  const nuevos = servicios();
  const navegacionesNuevas = [];
  assert.ok(m.montarTipo({ form: m.dom.form, servicios: nuevos.servicios, navegar: url => navegacionesNuevas.push(url) }));
  await pausa(); assert.equal(m.dom.boton.disabled, false);
  pendiente.resolver(AUTENTICADO); await pausa();
  assert.equal(m.dom.boton.disabled, false); assert.equal(m.dom.region.hidden, true);
  assert.deepEqual(m.navegaciones, []); assert.deepEqual(navegacionesNuevas, []);
  assert.equal(m.dom.form.cantidadOyentes(), 3);
});

test('tras desmontar, un submit ya no llega al servicio y desmontar es idempotente', async () => {
  const m = await montar('login'); await pausa();
  completarLogin(m.dom);
  m.montaje.desmontar(); m.montaje.desmontar();
  m.dom.form.disparar('submit'); await pausa();
  assert.equal(m.s.llamadas.login.length, 0); assert.equal(m.dom.boton.disabled, true);
});
