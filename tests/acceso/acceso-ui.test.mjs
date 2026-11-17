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

function selectCatalogo(crear, id, uuid, conCatalogo, disabled) {
  const select = crear('SELECT', { id, type: 'select-one', disabled: disabled && !conCatalogo });
  select.agregar(crear('OPTION', { value: '', disabled: true }));
  if (conCatalogo) select.agregar(crear('OPTION', { value: uuid }));
  return [select, crear('P', { id: `${id}-error`, hidden: true })];
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

// Reproduce IDs, etiquetas y tipos de registro.html; el catálogo solo existe si la prueba lo pide.
function domRegistro({ conCatalogo = false } = {}) {
  const { documento, crear } = crearDocumento();
  const form = crear('FORM', { id: 'registro-form' });
  form.agregar(...campo(crear, 'nombre', 'INPUT', 'text'),
    ...selectCatalogo(crear, 'universidad', UUID_UNIVERSIDAD_PRUEBA, conCatalogo, false),
    ...selectCatalogo(crear, 'campus', UUID_CAMPUS_PRUEBA, conCatalogo, true),
    ...campo(crear, 'correo', 'INPUT', 'email'), ...campo(crear, 'contrasena', 'INPUT', 'password'),
    ...campo(crear, 'confirmar-contrasena', 'INPUT', 'password'), ...campo(crear, 'terminos', 'INPUT', 'checkbox'),
    boton(crear), crear('DIV', { id: 'registro-mensaje', hidden: true }));
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
  const real = () => { control.serviciosReales++; throw new Error('Servicio Auth real no permitido'); };
  const auth = new SyntheticModule(['registrar', 'iniciarSesion', 'obtenerEstadoAuth'], function () {
    for (const nombre of ['registrar', 'iniciarSesion', 'obtenerEstadoAuth']) this.setExport(nombre, real);
  }, { context: contexto });
  const modulo = new SourceTextModule(fuente, { context: contexto, identifier: 'acceso-ui.js' });
  await modulo.link(nombre => { assert.equal(nombre, './auth.js'); return auth; });
  await modulo.evaluate();
  const disparar = () => { for (const [id, t] of [...reloj.pendientes]) { reloj.pendientes.delete(id); t.funcion(); } };
  return { api: modulo.namespace, control, reloj, disparar };
}

function servicios({ estado = NO_AUTENTICADO, login = AUTENTICADO, registro = AUTENTICADO } = {}) {
  const llamadas = { estado: 0, login: [], registro: [] };
  const responder = valor => (typeof valor === 'function' ? valor() : valor);
  return {
    llamadas,
    servicios: {
      obtenerEstadoAuth: async () => { llamadas.estado++; return responder(estado); },
      iniciarSesion: async (correo, contrasena) => { llamadas.login.push([correo, contrasena]); return responder(login); },
      registrar: async datos => { llamadas.registro.push(plano(datos)); return responder(registro); },
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

function completarRegistro(dom) {
  dom.$('nombre').value = ' Usuario de prueba ';
  dom.$('universidad').value = dom.$('universidad').options.at(-1).value;
  dom.$('campus').value = dom.$('campus').options.at(-1).value;
  dom.$('correo').value = ' comprador@example.invalid ';
  dom.$('contrasena').value = 'clave solo de prueba';
  dom.$('confirmar-contrasena').value = 'clave solo de prueba';
  dom.$('terminos').checked = true;
}

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

/* Registro */
test('registro sin catálogo: aviso al cargar, error en universidad y ninguna llamada a registrar()', async () => {
  const m = await montar('registro'); await pausa();
  assert.equal(m.dom.boton.disabled, false); assert.match(m.dom.region.textContent, /catálogo/);
  completarRegistro(m.dom);
  m.dom.form.disparar('submit'); await pausa();
  assert.equal(m.s.llamadas.registro.length, 0);
  assert.match(m.dom.$('universidad-error').textContent, /catálogo/);
  assert.equal(m.dom.$('campus-error').hidden, true);
  assert.equal(m.dom.documento.activeElement, m.dom.$('universidad'));
  sinEfectos(m.control);
});

test('registro PENDIENTE_CONFIRMACION: mensaje neutro, solo se vacían las contraseñas y no navega', async () => {
  const pendiente = { ok: true, datos: { estado: 'PENDIENTE_CONFIRMACION', usuario: USUARIO }, error: null };
  const m = await montar('registro', { dom: domRegistro({ conCatalogo: true }), registro: pendiente }); await pausa();
  assert.equal(m.dom.region.hidden, true);
  completarRegistro(m.dom);
  m.dom.form.disparar('submit'); await pausa();
  assert.deepEqual(m.s.llamadas.registro, [{ nombreVisible: 'Usuario de prueba', universidadId: UUID_UNIVERSIDAD_PRUEBA,
    campusId: UUID_CAMPUS_PRUEBA, correo: 'comprador@example.invalid', contrasena: 'clave solo de prueba',
    confirmarContrasena: 'clave solo de prueba', aceptaTerminos: true }]);
  assert.equal(m.dom.region.className, 'alert');
  assert.match(m.dom.region.textContent, /confirmar tu cuenta.*todavía no se han guardado/);
  assert.equal(m.dom.$('contrasena').value, ''); assert.equal(m.dom.$('confirmar-contrasena').value, '');
  assert.equal(m.dom.$('nombre').value, ' Usuario de prueba '); assert.equal(m.dom.$('correo').value, ' comprador@example.invalid ');
  assert.equal(m.dom.$('terminos').checked, true); assert.deepEqual(m.navegaciones, []);
});

test('registro: error del servicio se muestra sin borrar ningún campo', async () => {
  const m = await montar('registro', { dom: domRegistro({ conCatalogo: true }), registro: fallo('VALIDACION') }); await pausa();
  completarRegistro(m.dom); m.dom.form.disparar('submit'); await pausa();
  assert.equal(m.dom.region.textContent, 'Mensaje simulado de auth.js: VALIDACION');
  assert.equal(m.dom.$('contrasena').value, 'clave solo de prueba'); assert.deepEqual(m.navegaciones, []);
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
