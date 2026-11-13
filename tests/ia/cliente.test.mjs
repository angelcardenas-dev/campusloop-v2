import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { crearHandlerAsistente } from '../../netlify/functions/asistente.mjs';
import { ID_SOLICITUD, OTRO_ID, ID_USUARIO, TOKEN, CLAVE, ORIGEN, entorno, plano, solicitud,
  sugerencias, json, respuestaProveedor, diferida, pausa } from './fixtures.mjs';

globalThis.fetch = () => { throw new Error('Red real prohibida en pruebas'); };

const fuente = await readFile(new URL('../../js/asistente.js', import.meta.url), 'utf8');
async function cargar() {
  const control = { clientes: 0, red: 0, logs: 0, escuchas: 0 };
  const contexto = createContext({ URL, TextEncoder, TextDecoder, AbortController, CustomEvent,
    setTimeout, clearTimeout,
    fetch() { control.red++; throw new Error('Red real prohibida'); },
    console: { log() { control.logs++; }, warn() { control.logs++; }, error() { control.logs++; } },
  });
  const proveedor = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => { control.clientes++; return { ok: false, error: { codigo: 'CONFIGURACION' } }; });
  }, { context: contexto });
  const auth = new SyntheticModule(['escucharCambiosAuth'], function () {
    this.setExport('escucharCambiosAuth', () => { control.escuchas++; return () => {}; });
  }, { context: contexto });
  const modulo = new SourceTextModule(fuente, { context: contexto,
    importModuleDynamically() { control.red++; throw new Error('Importación remota prohibida'); } });
  await modulo.link(nombre => {
    if (nombre === './supabase-cliente.js') return proveedor;
    assert.equal(nombre, './auth.js'); return auth;
  });
  await modulo.evaluate();
  return { api: modulo.namespace, control };
}
function correcto(id = ID_SOLICITUD) { return json({ solicitudId: id, sugerencias: sugerencias() }); }
function opciones(cambios = {}) {
  return { habilitada: true, obtenerToken: async () => TOKEN, fetchImpl: async () => correcto(), ...cambios };
}
function sinSecretos(valor) {
  const contenido = JSON.stringify(valor);
  for (const secreto of [TOKEN, CLAVE, 'SDK_ERROR_PRIVADO', 'access_token', 'refresh_token']) assert.equal(contenido.includes(secreto), false);
}
function conectar(api, servicio, extras = {}) {
  const destino = new EventTarget(); const estados = []; const aplicaciones = [];
  destino.addEventListener('campusloop:ia-estado', evento => estados.push(plano(evento.detail)));
  destino.addEventListener('campusloop:ia-aplicar', evento => aplicaciones.push(plano(evento.detail)));
  const controlador = api.conectarAsistente({ destino, servicio, ...extras });
  const pedir = datos => destino.dispatchEvent(new CustomEvent('campusloop:ia-solicitar', { detail: datos }));
  return { destino, controlador, estados, aplicaciones, pedir };
}

test('importación y servicio predeterminado: cero SDK, Auth, DOM o red', async () => {
  const e = await cargar();
  assert.deepEqual(e.control, { clientes: 0, red: 0, logs: 0, escuchas: 0 });
  assert.equal((await e.api.solicitarSugerencia(solicitud())).error.codigo, 'IA_DESHABILITADA');
  assert.deepEqual(e.control, { clientes: 0, red: 0, logs: 0, escuchas: 0 });
  assert.equal(fuente.includes('innerHTML'), false);
  assert.equal(fuente.includes('NVIDIA_API_KEY'), false);
});
for (const [etiqueta, cambiar, codigo = 'VALIDACION'] of [
  ['schema incompatible', d => { d.schemaVersion = 2; }],
  ['UUID inválido', d => { d.solicitudId = 'incorrecto'; }],
  ['UUID como array', d => { d.solicitudId = [ID_SOLICITUD]; }],
  ['revisión inválida', d => { d.revisionFormulario = -1; }],
  ['campo sensible', d => { d.usuarioId = ID_USUARIO; }],
  ['título excesivo', d => { d.articulo.tituloActual = 'a'.repeat(101); }],
  ['descripción excesiva', d => { d.articulo.descripcionActual = 'a'.repeat(1001); }],
  ['demasiadas características', d => { d.articulo.caracteristicas = Array(11).fill('Operativa'); }],
  ['array disperso', d => { d.articulo.caracteristicas = Array(1); }],
  ['característica excesiva', d => { d.articulo.caracteristicas = ['a'.repeat(151)]; }],
  ['contacto privado', d => { d.articulo.caracteristicas = ['persona@example.invalid']; }],
  ['sin contexto', d => { d.articulo.tituloActual = ''; d.articulo.caracteristicas = []; }, 'CONTEXTO_INSUFICIENTE'],
]) {
  test(`validación antes de Auth/fetch: ${etiqueta}`, async () => {
    const e = await cargar(); let llamadas = 0;
    const servicio = e.api.crearServicioAsistente(opciones({ obtenerToken: async () => { llamadas++; return TOKEN; } }));
    const datos = solicitud(); cambiar(datos);
    assert.equal((await servicio(datos)).error.codigo, codigo);
    assert.equal(llamadas, 0); assert.equal(e.control.red, 0);
  });
}
test('límite UTF-8 de 8 KiB comprobado antes de obtener sesión', async () => {
  const e = await cargar(); let tokens = 0;
  const datos = solicitud(); datos.articulo.caracteristicas = Array(10).fill('😀'.repeat(150));
  datos.articulo.descripcionActual = '😀'.repeat(1000);
  const servicio = e.api.crearServicioAsistente(opciones({ obtenerToken: async () => { tokens++; return TOKEN; } }));
  assert.equal((await servicio(datos)).error.codigo, 'VALIDACION');
  assert.equal(tokens, 0);
});
test('opciones nulas y timeout fuera de contrato no inician solicitudes', async () => {
  const e = await cargar();
  assert.equal((await e.api.solicitarSugerencia(solicitud(), null)).error.codigo, 'VALIDACION');
  const servicio = e.api.crearServicioAsistente(opciones({ timeoutMs: 20001 }));
  assert.equal((await servicio(solicitud())).error.codigo, 'CONFIGURACION');
});
test('configuración SDK incompleta y ausencia de token no crean usuario ficticio', async () => {
  const e = await cargar();
  const sinConfig = e.api.crearServicioAsistente({ habilitada: true });
  assert.equal((await sinConfig(solicitud())).error.codigo, 'CONFIGURACION');
  const sinToken = e.api.crearServicioAsistente(opciones({ obtenerToken: async () => null }));
  assert.equal((await sinToken(solicitud())).error.codigo, 'NO_AUTORIZADO');
  assert.equal(e.control.red, 0);
});
test('POST local, bearer solo en cabecera y respuesta reducida', async () => {
  const e = await cargar(); let llamadas = 0;
  const servicio = e.api.crearServicioAsistente(opciones({ fetchImpl: async (url, init) => {
    llamadas++;
    assert.equal(url, '/api/asistente'); assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    const cuerpo = JSON.parse(init.body);
    assert.equal('revisionFormulario' in cuerpo, false); assert.equal(init.body.includes(TOKEN), false);
    assert.deepEqual(cuerpo.articulo, solicitud().articulo);
    return correcto();
  } }));
  const resultado = await servicio(solicitud());
  assert.equal(resultado.ok, true); assert.equal(llamadas, 1);
  assert.deepEqual(plano(resultado.datos), { solicitudId: ID_SOLICITUD, revisionFormulario: 1, sugerencias: sugerencias() });
  sinSecretos(resultado);
});
for (const [etiqueta, fetchImpl, codigo] of [
  ['red', async () => { throw new TypeError('SDK_ERROR_PRIVADO'); }, 'RED'],
  ['límite', async () => json({ solicitudId: null, codigo: 'LIMITE', mensaje: CLAVE }, 429), 'LIMITE'],
  ['sin vendedor', async () => json({ solicitudId: ID_SOLICITUD, codigo: 'NO_VENDEDOR', mensaje: CLAVE }, 403), 'NO_VENDEDOR'],
  ['controles pendientes', async () => json({ solicitudId: null, codigo: 'CONTROLES_NO_DISPONIBLES', mensaje: CLAVE }, 503), 'CONTROLES_NO_DISPONIBLES'],
  ['HTML', async () => new Response('<p>SDK_ERROR_PRIVADO</p>'), 'RESPUESTA_INVALIDA'],
  ['JSON malformado', async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }), 'RESPUESTA_INVALIDA'],
  ['respuesta grande', async () => new Response(' '.repeat(16385), { headers: { 'Content-Type': 'application/json' } }), 'RESPUESTA_INVALIDA'],
  ['correlación incorrecta', async () => correcto(OTRO_ID), 'RESPUESTA_INVALIDA'],
  ['título excesivo', async () => json({ solicitudId: ID_SOLICITUD, sugerencias: { ...sugerencias(), titulo: 'x'.repeat(101) } }), 'RESPUESTA_INVALIDA'],
  ['metadatos inesperados', async () => json({ solicitudId: ID_SOLICITUD, sugerencias: sugerencias(), session: TOKEN }), 'RESPUESTA_INVALIDA'],
  ['HTTP y código incoherentes', async () => json({ solicitudId: null, codigo: 'NO_AUTORIZADO', mensaje: 'No disponible' }, 429), 'RESPUESTA_INVALIDA'],
]) {
  test(`cliente: ${etiqueta}`, async () => {
    const e = await cargar(); const servicio = e.api.crearServicioAsistente(opciones({ fetchImpl }));
    const resultado = await servicio(solicitud());
    assert.equal(resultado.error.codigo, codigo); sinSecretos(resultado);
  });
}
test('TypeError ajeno a fetch es servidor, sin filtrar su mensaje', async () => {
  const e = await cargar();
  const servicio = e.api.crearServicioAsistente(opciones({ obtenerToken: async () => { throw new TypeError('SDK_ERROR_PRIVADO'); } }));
  const resultado = await servicio(solicitud());
  assert.equal(resultado.error.codigo, 'SERVIDOR'); sinSecretos(resultado);
});
test('una solicitud activa, sin reintento automático', async () => {
  const e = await cargar(); const espera = diferida(); let llamadas = 0;
  const servicio = e.api.crearServicioAsistente(opciones({ fetchImpl: () => { llamadas++; return espera.promesa; } }));
  const primera = servicio(solicitud()); await pausa();
  assert.equal((await servicio(solicitud())).error.codigo, 'CONFLICTO');
  espera.resolver(correcto()); assert.equal((await primera).ok, true);
  assert.equal(llamadas, 1);
});
test('timeout durante sesión no envía después una petición tardía', async () => {
  const e = await cargar(); const espera = diferida(); let llamadas = 0;
  const servicio = e.api.crearServicioAsistente(opciones({ timeoutMs: 5, obtenerToken: () => espera.promesa,
    fetchImpl: async () => { llamadas++; return correcto(); } }));
  assert.equal((await servicio(solicitud())).error.codigo, 'TIEMPO_AGOTADO');
  espera.resolver(TOKEN); await pausa(); assert.equal(llamadas, 0);
});
test('timeout de lectura cancela un cuerpo que no termina', async () => {
  const e = await cargar(); let cancelado = false;
  const flujo = new ReadableStream({ cancel() { cancelado = true; } });
  const servicio = e.api.crearServicioAsistente(opciones({ timeoutMs: 5,
    fetchImpl: async () => new Response(flujo, { headers: { 'Content-Type': 'application/json' } }) }));
  assert.equal((await servicio(solicitud())).error.codigo, 'TIEMPO_AGOTADO');
  await pausa(); assert.equal(cancelado, true);
});
test('aborto previo no obtiene token; aborto activo libera la siguiente solicitud', async () => {
  const e = await cargar(); const espera = diferida(); const cancelar = new AbortController(); let llamadas = 0;
  const servicio = e.api.crearServicioAsistente(opciones({ fetchImpl: () => { llamadas++; return llamadas === 1 ? espera.promesa : Promise.resolve(correcto()); } }));
  const primera = servicio(solicitud(), { signal: cancelar.signal }); await pausa();
  cancelar.abort();
  assert.equal((await servicio(solicitud())).ok, true);
  assert.equal((await primera).error.codigo, 'CANCELADO');
  assert.equal((await servicio(solicitud(), { signal: cancelar.signal })).error.codigo, 'CANCELADO');
  espera.resolver(correcto()); await pausa(); assert.equal(llamadas, 2);
});
test('eventos listos no aplican ni publican; aceptar solo tras decisión explícita', async () => {
  const e = await cargar(); const entrada = solicitud(); const previa = plano(entrada);
  const c = conectar(e.api, async () => ({ ok: true, datos: { solicitudId: ID_SOLICITUD, sugerencias: sugerencias() }, error: null }));
  c.pedir(entrada); await pausa();
  assert.deepEqual(c.estados.map(v => v.estado), ['cargando', 'listo']);
  assert.equal(c.aplicaciones.length, 0); assert.deepEqual(entrada, previa);
  const copia = c.controlador.obtenerPropuesta();
  assert.deepEqual(plano(copia.originales), { titulo: entrada.articulo.tituloActual, descripcion: '' });
  copia.originales.titulo = 'no mutar almacenamiento interno';
  assert.equal(c.controlador.obtenerPropuesta().originales.titulo, entrada.articulo.tituloActual);
  const aceptados = { titulo: 'Texto editado por el vendedor' };
  assert.equal(c.controlador.aceptar({ solicitudId: ID_SOLICITUD, revisionFormulario: 1, camposAceptados: aceptados }).ok, true);
  assert.deepEqual(c.aplicaciones, [{ solicitudId: ID_SOLICITUD, revisionFormulario: 1, camposAceptados: aceptados }]);
  assert.equal(c.controlador.aceptar({ solicitudId: ID_SOLICITUD, revisionFormulario: 1, camposAceptados: aceptados }).error.codigo, 'CONFLICTO');
  assert.equal(e.control.escuchas, 0); c.controlador.desconectar();
});
test('cambio de revisión ignora respuesta tardía y conserva el formulario', async () => {
  const e = await cargar(); const espera = diferida(); let signal;
  const c = conectar(e.api, (datos, opciones) => { signal = opciones.signal; return espera.promesa; });
  c.pedir(solicitud()); c.controlador.actualizarRevision(2);
  assert.equal(signal.aborted, true);
  espera.resolver({ ok: true, datos: { solicitudId: ID_SOLICITUD, sugerencias: sugerencias() } }); await pausa();
  assert.deepEqual(c.estados.map(v => v.estado), ['cargando', 'descartado']);
  assert.equal(c.controlador.obtenerPropuesta(), null); assert.equal(c.aplicaciones.length, 0);
  c.controlador.desconectar();
});
test('nueva solicitud sustituye a la anterior sin aceptar su resultado tardío', async () => {
  const e = await cargar(); const primera = diferida();
  const c = conectar(e.api, async datos => datos.solicitudId === ID_SOLICITUD ? primera.promesa : { ok: true, datos: { solicitudId: OTRO_ID, sugerencias: sugerencias() } });
  c.pedir(solicitud()); c.pedir({ ...solicitud(), solicitudId: OTRO_ID }); await pausa();
  primera.resolver({ ok: true, datos: { solicitudId: ID_SOLICITUD, sugerencias: sugerencias() } }); await pausa();
  assert.equal(c.controlador.obtenerPropuesta().solicitudId, OTRO_ID);
  assert.equal(c.estados.filter(v => v.estado === 'listo').length, 1); c.controlador.desconectar();
});
test('descartar, logout y desconectar cancelan sin modificar campos', async () => {
  const e = await cargar(); const espera = diferida(); let callback; let cancelaciones = 0;
  const c = conectar(e.api, () => espera.promesa, { habilitada: true,
    escucharAuth: cb => { callback = cb; return () => { cancelaciones++; }; } });
  c.pedir(solicitud()); callback({ evento: 'SIGNED_OUT', usuario: null });
  espera.resolver({ ok: true, datos: { solicitudId: ID_SOLICITUD, sugerencias: sugerencias() } }); await pausa();
  assert.equal(c.controlador.obtenerPropuesta(), null);
  c.controlador.desconectar(); c.controlador.desconectar();
  assert.equal(cancelaciones, 1);
  const cantidad = c.estados.length; c.pedir(solicitud()); await pausa();
  assert.equal(c.estados.length, cantidad); assert.equal(c.aplicaciones.length, 0);
});
test('solo una conexión por destino; se permite reconectar tras limpieza', async () => {
  const e = await cargar(); const c = conectar(e.api);
  assert.throws(() => e.api.conectarAsistente({ destino: c.destino }));
  c.controlador.desconectar();
  const otra = e.api.conectarAsistente({ destino: c.destino }); otra.desconectar();
});
test('cambio de identidad descarta propuesta y revisión antigua no se acepta', async () => {
  const e = await cargar(); let callback;
  const c = conectar(e.api, async () => ({ ok: true, datos: { solicitudId: ID_SOLICITUD, sugerencias: sugerencias() } }),
    { habilitada: true, escucharAuth: cb => { callback = cb; return () => {}; } });
  callback({ evento: 'INITIAL_SESSION', usuario: { id: ID_USUARIO } });
  c.pedir(solicitud()); await pausa();
  assert.equal(c.controlador.aceptar({ solicitudId: ID_SOLICITUD, revisionFormulario: 0, camposAceptados: { titulo: 'Otro' } }).error.codigo, 'CONFLICTO');
  assert.equal(c.controlador.aceptar({ solicitudId: ID_SOLICITUD, revisionFormulario: 1, camposAceptados: {} }).error.codigo, 'VALIDACION');
  callback({ evento: 'SIGNED_IN', usuario: { id: OTRO_ID } });
  assert.equal(c.controlador.obtenerPropuesta(), null); assert.equal(c.aplicaciones.length, 0);
  c.controlador.desconectar();
});
test('integración offline cliente-servidor con cuerpos HTTP y proveedor sintético', async () => {
  const e = await cargar(); let cuotas = 0; let proveedor = 0;
  const handler = crearHandlerAsistente({ leerEntorno: entorno,
    verificarUsuario: async () => ({ id: ID_USUARIO, esAnonimo: false }),
    verificarVendedor: async () => true,
    reservarCuota: async () => { cuotas++; return { permitida: true, nueva: true, reservaId: OTRO_ID }; },
    fetchImpl: async () => { proveedor++; return respuestaProveedor(); },
  });
  const servicio = e.api.crearServicioAsistente(opciones({ fetchImpl: (ruta, init) => handler(new Request(ORIGEN + ruta,
    { ...init, headers: { ...init.headers, Origin: ORIGEN } })) }));
  const resultado = await servicio(solicitud());
  assert.equal(resultado.ok, true); assert.equal(cuotas, 1); assert.equal(proveedor, 1);
  assert.deepEqual(plano(resultado.datos.sugerencias), sugerencias()); sinSecretos(resultado);
});
