import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(import.meta.dirname, '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// Dobles explícitos: nunca se enciende un micrófono ni se llama a síntesis real.
const dobles = `
window.__prueba={voces:[],lecturas:[],cancelaciones:0,red:0,storage:0};
window.fetch=()=>{__prueba.red++;throw new Error('Red de aplicación prohibida');};
for(const nombre of ['localStorage','sessionStorage']) {
  const nativo=Object.getOwnPropertyDescriptor(window,nombre);
  Object.defineProperty(window,nombre,{configurable:true,get(){
    if(window.__permitirStorageReal===true)return nativo.get.call(window);
    __prueba.storage++;throw new Error('Persistencia prohibida');
  }});
}
window.SpeechRecognition=class {
  constructor(){__prueba.voces.push(this);this.inicios=0;this.abortos=0;}
  start(){this.inicios++;this.onstart?.();} abort(){this.abortos++;}
};
window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
  speak(u){__prueba.lecturas.push(u);},cancel(){__prueba.cancelaciones++;},
  getVoices(){return [{lang:'en-US'},{lang:'es-PE',name:'Voz sintética de prueba'}];}
}});`;

test('Chrome D1.1/D1.3: widget, voz simulada y Web Storage nativo con identidad sintética', {
  skip: !existsSync(chrome) && 'Chrome no instalado; no se descarga', timeout: 120000,
}, async t => {
  const temporal = await mkdtemp(path.join(tmpdir(), 'campusloop-agente-'));
  const perfil = path.join(temporal, 'perfil'); await mkdir(perfil);
  const capturas = path.join(temporal, 'evidencias'); await mkdir(capturas);
  const pedidos = [], externos = [], errores = [];
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
  const permitidos = new Set(['index.html', 'inicio.html', 'explorar.html', 'css/styles.css', 'css/agente.css',
    'js/agente-ui.js', 'js/agente-montaje.js', 'js/agente-contexto-catalogo.js', 'js/catalogo.js', 'js/landing.js',
    'js/agente-memoria.js', 'js/agente-memoria-coordinador.js', 'js/agente-memoria-conexion.js',
    'js/agente-storage-adaptador.js', 'js/agente-memoria-lock.js', 'js/localstorage.js', 'js/auth.js', 'js/config-publica.js', 'js/supabase-cliente.js']);
  const servidor = createServer(async (req, res) => {
    try {
      const ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
      pedidos.push(ruta);
      if (ruta === 'favicon.ico') { res.writeHead(204).end(); return; }
      if (ruta === '__agente__/prueba.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/agente.css"></head><body><a href="#prueba" id="afuera">Contenido de prueba</a><script type="module">window.ui=await import('/js/agente-ui.js');window.control=ui.montarAgente();</script></body></html>`); return;
      }
      if (ruta === '__agente__/dos-pestanas.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/agente.css"></head><body><script type="module">
          window.__permitirStorageReal=true;
          const {montarAgente}=await import('/js/agente-ui.js');
          const {conectarMemoriaAgente}=await import('/js/agente-memoria-conexion.js');
          const id=new URLSearchParams(location.search).get('cuenta')==='B'?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111';
          const sesion=id.startsWith('1')?'33333333-3333-4333-8333-333333333333':'44444444-4444-4444-8444-444444444444';
          const query=new URLSearchParams(location.search);
          if(query.has('fresh'))sessionStorage.removeItem('campusloop_tb4_v1_agente_consentimiento');
          if(query.has('reset'))for(const user of ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']){
            localStorage.removeItem('campusloop_tb4_v1_agente_historial_'+user);
            localStorage.removeItem('campusloop_tb4_v1_agente_generacion_'+user);
          }
          history.replaceState(null,'',location.pathname+'?cuenta='+(id.startsWith('1')?'A':'B'));
          window.__storageEvents=[];window.addEventListener('storage',e=>__storageEvents.push(e.key));
          window.__widget=montarAgente();window.__pending=false;window.__resolvePending=null;
          window.__auth={obtenerUsuarioActual:async()=>({ok:true,datos:{id,sesionId:sesion},error:null}),escucharCambiosAuth:()=>()=>{}};
          window.__connection=conectarMemoriaAgente({widget:__widget,autorizada:true,
            politica:{maxBytes:24576,ttlMs:604800000},obtenerStorageSesion:()=>sessionStorage,
            producirContexto:()=>__pending?new Promise(resolve=>{__resolvePending=resolve;window.__producerStarted=true;}):
              ({tipo:'busqueda_catalogo',orden:'recientes',precioMaximoCentimos:10000}),auth:__auth});
          window.__consentir=()=>{const c=document.querySelector('.cl-agente-detalles input[type=checkbox]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));};
          window.__revocar=()=>{const c=document.querySelector('.cl-agente-detalles input[type=checkbox]');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));};
          window.__state=()=>({ready:true,checked:document.querySelector('.cl-agente-detalles input[type=checkbox]').checked,
            disabled:document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled,
            memory:document.querySelector('[data-memoria]')?.dataset.memoria??null,
            text:document.querySelector('[data-memoria]')?.textContent??'',draft:document.querySelector('.cl-agente-texto').value});
          window.__update=()=>__connection.actualizar();window.__ready=true;
          window.__holdAccountLock=userId=>{window.__lockStarted=false;window.__lockDone=navigator.locks.request(
            'campusloop:agente:memoria:v1:'+userId,{mode:'exclusive'},()=>new Promise(resolve=>{
              window.__lockStarted=true;window.__releaseAccountLock=resolve;
            }));};
        </script></body></html>`); return;
      }
      const destino = path.resolve(root, ruta);
      if (!destino.startsWith(root + path.sep) || (!permitidos.has(ruta) && !/^assets\/[\w/.-]+$/.test(ruta))) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': (mime[path.extname(ruta)] ?? 'application/octet-stream') + (['.html', '.js', '.css'].includes(path.extname(ruta)) ? '; charset=utf-8' : ''),
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'", 'Cache-Control': 'no-store' }).end(await readFile(destino));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  const origen = `http://127.0.0.1:${servidor.address().port}`;
  const proceso = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--no-proxy-server',
    '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
  let socket, siguiente = 0;
  const pendientes = new Map();
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++siguiente;
      const timer = setTimeout(() => { pendientes.delete(id); reject(new Error(`CDP: ${method}${params.expression ? ' (' + params.expression.slice(0, 180) + ')' : ''}`)); }, 8000);
      pendientes.set(id, { resolve: r => { clearTimeout(timer); resolve(r); }, reject: e => { clearTimeout(timer); reject(e); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  t.after(async () => {
    try { if (socket?.readyState === WebSocket.OPEN) await cdp('Browser.close'); } catch { /* Proceso ya terminado. */ }
    socket?.close(); if (proceso.exitCode === null) proceso.kill();
    for (const p of pendientes.values()) p.reject(new Error('Cierre de prueba'));
    await new Promise(resolve => servidor.close(resolve));
    // Se conserva el perfil aislado y la evidencia; no se borra ningún worktree.
    console.log('Evidencias y perfil aislado: ' + temporal);
  });
  let puerto;
  for (let i = 0; i < 100; i++) {
    try { puerto = (await readFile(path.join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(puerto, 'Chrome disponible');
  const targets = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  socket = new WebSocket(targets.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pendientes.get(m.id); pendientes.delete(m.id); if (p) m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errores.push(m.params.entry.text);
    if (m.method === 'Fetch.requestPaused') {
      const local = m.params.request.url.startsWith(origen + '/');
      if (!local) externos.push(m.params.request.url.split('?')[0]);
      void cdp(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: m.params.requestId,
        ...(!local ? { errorReason: 'BlockedByClient' } : {}) }).catch(() => {});
    }
  });
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Log.enable');
  await cdp('DOM.enable'); await cdp('CSS.enable');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: dobles });
  const evaluar = async (expression, userGesture = false) => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const esperar = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluar(expression)) return; await delay(30); }
    throw new Error('Condición no alcanzada: ' + expression);
  };
  const navegar = async (ruta = '/__agente__/prueba.html', conWidget = true) => {
    await cdp('Page.navigate', { url: origen + ruta });
    await esperar(`location.pathname+location.search===${JSON.stringify(ruta)} && document.readyState==='complete' && ${conWidget ? '!!' : '!'}document.querySelector('.cl-agente-raiz')`);
    await evaluar('document.fonts.ready');
  };
  const abrir = () => evaluar("if(document.querySelector('.cl-agente-panel').hidden)document.querySelector('.cl-agente-abrir').click()");
  const escribir = s => evaluar(`document.querySelector('.cl-agente-texto').value=${JSON.stringify(s)}`);
  const enviar = () => evaluar("document.querySelector('.cl-agente-formulario').requestSubmit()");
  const moverA = async selector => {
    const p = await evaluar(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p }); return p;
  };
  const contraste = (fondo, frente) => {
    const luz = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((total, v, i) => total + v * [.2126, .7152, .0722][i], 0);
    const a = luz(fondo), b = luz(frente); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  };
  const estilos = [];
  await navegar();
  await t.test('01 montaje y doble montaje idempotente', async () => {
    assert.equal(await evaluar('ui.montarAgente()===control'), true);
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 1);
    assert.equal(await evaluar("getComputedStyle(document.querySelector('.cl-agente-panel')).display"), 'none');
  });
  for (const ancho of [390, 1440]) {
    await t.test(`cascada CSS computada de botones principales ${ancho}px`, async () => {
      await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
      const tokens = await evaluar(`(() => {const s=document.createElement('span');document.body.append(s);const r={};for(const n of ['brand','brand-hover','brand-pressed','surface','brand-light']){s.style.color='var(--'+n+')';r[n]=getComputedStyle(s).color;}s.remove();return r;})()`);
      for (const selector of ['.cl-agente-abrir', '.cl-agente-enviar']) {
        await evaluar(selector.endsWith('abrir') ? 'control.cerrar()' : 'control.abrir()');
        await evaluar('document.activeElement.blur()');
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
        const leerEstilo = () => evaluar(`(() => {const b=document.querySelector('${selector}'),s=getComputedStyle(b);return {fondo:s.backgroundColor,color:s.color,icono:getComputedStyle(b.querySelector('svg')).stroke,outline:s.outlineStyle,grosor:parseFloat(s.outlineWidth),foco:b.matches(':focus-visible')};})()`);
        const normal = await leerEstilo(); assert.equal(normal.fondo, tokens.brand); assert.equal(normal.color, tokens.surface);
        const p = await moverA(selector); const hover = await leerEstilo(); assert.equal(hover.fondo, tokens['brand-hover']);
        await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p });
        const active = await leerEstilo(); assert.equal(active.fondo, tokens['brand-pressed']);
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
        await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', x: 0, y: 0 });
        await evaluar('document.activeElement.blur()');
        const doc = await cdp('DOM.getDocument');
        const { nodeId } = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
        // Se fuerza solo la pseudoclase; las propiedades se resuelven por la cascada real de Chrome.
        await cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus-visible'] });
        const focus = await leerEstilo(); assert.equal(focus.foco, true); assert.ok(focus.grosor >= 2 && focus.outline === 'solid');
        await cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        await evaluar(`document.querySelector('${selector}').disabled=true`); await moverA(selector);
        const disabled = await leerEstilo(); assert.equal(disabled.fondo, tokens['brand-light']); assert.equal(disabled.color, tokens['brand-pressed']);
        await evaluar(`document.querySelector('${selector}').disabled=false`);
        for (const e of [normal, hover, active, focus, disabled]) { assert.equal(e.icono, e.color); assert.ok(contraste(e.fondo, e.icono) >= 4.5); }
        estilos.push({ ancho, selector, normal, hover, active, focus, disabled, contrasteHover: contraste(hover.fondo, hover.icono) });
      }
      await evaluar('control.cerrar()');
    });
  }
  await t.test('02 abrir, dialog no modal y foco inicial', async () => {
    await abrir(); assert.equal(await evaluar("document.activeElement.className"), 'cl-agente-texto');
    assert.equal(await evaluar("document.querySelector('.cl-agente-abrir').getAttribute('aria-expanded')"), 'true');
    assert.equal(await evaluar("document.querySelector('.cl-agente-panel').hasAttribute('aria-modal')"), false);
    assert.equal(await evaluar("getComputedStyle(document.querySelector('.cl-agente-abrir')).display"), 'none');
  });
  await t.test('03 cerrar devuelve foco y oculta realmente', async () => {
    await evaluar("document.querySelector('.cl-agente-cerrar').click()");
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-abrir');
    assert.equal(await evaluar("getComputedStyle(document.querySelector('.cl-agente-panel')).display"), 'none');
  });
  await t.test('04 Escape cierra sin atrapar foco de la página', async () => {
    await abrir(); await evaluar("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-abrir'); await abrir();
  });
  await t.test('teclado nativo: Enter abre, Tab recorre controles y permite salir del panel', async () => {
    await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    const tecla = async (key, codigo, modifiers = 0) => {
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: codigo, modifiers,
        ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: codigo, modifiers });
    };
    await evaluar('control.cerrar()'); await tecla('Enter', 13);
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-texto');
    await tecla('Tab', 9); assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-micro');
    await tecla('Tab', 9); assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-enviar');
    await evaluar("document.querySelector('.cl-agente-enviar').focus()"); await tecla('Tab', 9);
    // Chrome puede pasar por su propia barra antes de volver al primer enlace.
    assert.equal(await evaluar("document.querySelector('.cl-agente-panel').contains(document.activeElement)"), false);
    if (await evaluar('document.activeElement.id') !== 'afuera') await tecla('Tab', 9);
    assert.equal(await evaluar('document.activeElement.id'), 'afuera');
    await evaluar("document.querySelector('.cl-agente-texto').focus()"); await tecla('Escape', 27);
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-abrir'); await abrir();
  });
  await t.test('controles SVG y privacidad accesibles mediante teclado', async () => {
    assert.equal(await evaluar("[...document.querySelectorAll('.cl-agente-raiz button')].every(b=>b.getAttribute('aria-label')&&b.querySelector('svg[aria-hidden=true]'))"), true);
    await evaluar("document.querySelector('.cl-agente-resumen').focus()");
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluar("document.querySelector('.cl-agente-informacion').open"), true);
    assert.notEqual(await evaluar("getComputedStyle(document.querySelector('.cl-agente-detalles')).display"), 'none');
    await evaluar("document.querySelector('.cl-agente-informacion').open=false;document.querySelector('.cl-agente-texto').focus()");
  });
  await t.test('05 vacío valida con mensaje/ARIA y conserva texto', async () => {
    await escribir('  '); await enviar();
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').getAttribute('aria-invalid')"), 'true');
    assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
  });
  await t.test('06 Enter envía localmente una vez, Shift+Enter y composición no envían', async () => {
    await escribir('Mensaje sintético');
    for (const opt of [{ key: 'Enter', shiftKey: true }, { key: 'Enter', isComposing: true }])
      await evaluar(`document.querySelector('.cl-agente-texto').dispatchEvent(new KeyboardEvent('keydown',${JSON.stringify({ ...opt, bubbles: true, cancelable: true })}))`);
    assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
    await evaluar("for(let i=0;i<2;i++)document.querySelector('.cl-agente-texto').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");
    assert.equal(await evaluar('control.obtenerHistorial().length'), 1);
  });
  await t.test('07 HTML se muestra como texto, no nodos activos', async () => {
    await escribir('<img src=x onerror="window.__xss=true">'); await enviar();
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-panel img').length"), 0);
    assert.equal(await evaluar('window.__xss===true'), false);
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /Integración pendiente/);
  });
  await t.test('08 longitud excesiva conserva borrador y rechaza', async () => {
    await escribir('x'.repeat(1001)); await enviar();
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value.length"), 1001);
    assert.equal(await evaluar('control.obtenerHistorial().length'), 2);
  });
  await t.test('09 reconocimiento solo por clic, es-PE y cancelación rápida', async () => {
    assert.equal(await evaluar('__prueba.voces.length'), 0);
    await evaluar("document.querySelector('.cl-agente-micro').click();document.querySelector('.cl-agente-micro').click()");
    assert.deepEqual(await evaluar('({lang:__prueba.voces[0].lang,inicios:__prueba.voces[0].inicios,abortos:__prueba.voces[0].abortos})'), { lang: 'es-PE', inicios: 1, abortos: 1 });
  });
  await t.test('10 transcripción editable, no envío automático', async () => {
    await evaluar("document.querySelector('.cl-agente-micro').click();__prueba.voces.at(-1).onresult({results:[[{transcript:'Texto de voz sintético'}]]})");
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Texto de voz sintético');
    assert.equal(await evaluar('control.obtenerHistorial().length'), 2);
    await escribir('Texto corregido'); await enviar();
    assert.equal(await evaluar('control.obtenerHistorial().at(-1).texto'), 'Texto corregido');
  });
  for (const [codigo, texto] of [['not-allowed', /permisos, privacidad o seguridad/], ['service-not-allowed', /no permite este servicio/], ['audio-capture', /captar audio del micrófono/], ['network', /fallo de conexión o disponibilidad/], ['language-not-supported', /no admite reconocimiento en es-PE/], ['no-speech', /No se detectó/], ['aborted', /cancelado/]]) {
    await t.test('voz: ' + codigo + ' conserva texto y permite continuar', async () => {
      const intentosAntes = await evaluar('__prueba.voces.length');
      await escribir('Borrador que se conserva');
      await evaluar(`document.querySelector('.cl-agente-micro').click();__prueba.voces.at(-1).onerror({error:${JSON.stringify(codigo)}})`);
      assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), texto);
      assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador que se conserva');
      assert.equal(await evaluar('control.obtenerDiagnosticoVoz().eventos.find(e=>e.evento==="error").codigo'), codigo);
      assert.equal(await evaluar('__prueba.voces.at(-1).lang'), 'es-PE');
      assert.equal(await evaluar('__prueba.voces.length'), intentosAntes + 1, 'No reintentar ni cambiar idioma automáticamente');
    });
  }
  await t.test('fin sin resultado, código desconocido y diagnóstico sin texto privado', async () => {
    await evaluar("document.querySelector('.cl-agente-micro').click();__prueba.voces.at(-1).onend()");
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /terminó sin transcripción/);
    assert.equal(await evaluar('control.obtenerDiagnosticoVoz().eventos.some(e=>e.evento==="end")'), true);
    await evaluar("document.querySelector('.cl-agente-micro').click();__prueba.voces.at(-1).onerror({error:'contenido-privado-no-confiable',message:'no exponer'})");
    const d = await evaluar('control.obtenerDiagnosticoVoz()');
    assert.equal(d.apiDisponible, true); assert.equal(d.botonHabilitado, true); assert.equal(d.idiomaSolicitado, 'es-PE');
    assert.deepEqual(d.eventos.map(e=>e.evento), ['start_solicitado', 'start', 'error', 'abort_solicitado']);
    assert.equal(d.eventos.find(e=>e.evento==='error').codigo, 'desconocido');
    assert.doesNotMatch(JSON.stringify(d), /privado|no exponer|Borrador/);
    await evaluar("control.obtenerDiagnosticoVoz().eventos[0].evento='alterado'");
    assert.equal(await evaluar('control.obtenerDiagnosticoVoz().eventos[0].evento'), 'start_solicitado');
  });
  await t.test('11 cierre cancela e ignora resultado tardío', async () => {
    await evaluar("document.querySelector('.cl-agente-micro').click();window.tardia=__prueba.voces.at(-1).onresult;control.cerrar();tardia({results:[[{transcript:'No aplicar'}]]})");
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador que se conserva'); await abrir();
  });
  await t.test('12 editar durante escucha impide sobrescribir con voz tardía', async () => {
    await evaluar("document.querySelector('.cl-agente-micro').click();window.tardia=__prueba.voces.at(-1).onresult;document.querySelector('.cl-agente-texto').value='Edición manual';document.querySelector('.cl-agente-texto').dispatchEvent(new Event('input'));tardia({results:[[{transcript:'Vieja'}]]})");
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Edición manual');
  });
  await t.test('13 TTS solo bienvenida pública, español, detener y cancelar al iniciar voz', async () => {
    await evaluar("document.querySelector('.cl-agente-leer').click()");
    const lectura = await evaluar('({text:__prueba.lecturas.at(-1).text,lang:__prueba.lecturas.at(-1).voice.lang})');
    assert.match(lectura.text, /^¡Hola! Soy el asistente/); assert.equal(lectura.lang, 'es-PE');
    assert.equal(await evaluar("document.querySelector('.cl-agente-leer').getAttribute('aria-pressed')"), 'true');
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /Leyendo bienvenida pública/);
    await evaluar("document.querySelector('.cl-agente-leer').click()");
    assert.equal(await evaluar("document.querySelector('.cl-agente-leer').getAttribute('aria-label')"), 'Leer bienvenida pública');
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /Lectura detenida/);
    await evaluar("document.querySelector('.cl-agente-leer').click();document.querySelector('.cl-agente-micro').click()");
    assert.ok(await evaluar('__prueba.cancelaciones>=2')); await evaluar("document.querySelector('.cl-agente-micro').click()");
    await evaluar("document.querySelector('.cl-agente-leer').click();__prueba.lecturas.at(-1).onend()");
    assert.equal(await evaluar("document.querySelector('.cl-agente-leer').getAttribute('aria-pressed')"), 'false');
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /Lectura finalizada/);
  });
  await t.test('14 borrar historial y copia defensiva, sin borrar borrador', async () => {
    await evaluar("control.obtenerHistorial()[0].texto='Alteración externa'");
    assert.notEqual(await evaluar('control.obtenerHistorial()[0].texto'), 'Alteración externa');
    await evaluar('control.borrarHistorial()'); assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
    await evaluar("document.querySelector('.cl-agente-borrar').click()");
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-leer').length"), 1);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Edición manual');
  });
  await t.test('15 desmontaje idempotente y voz vieja no afecta remontaje', async () => {
    await evaluar("document.querySelector('.cl-agente-micro').click();window.tardia=__prueba.voces.at(-1).onresult;control.desmontar();control.desmontar();window.control=ui.montarAgente();control.abrir();tardia({results:[[{transcript:'Vieja'}]]})");
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 1);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), '');
  });
  await t.test('16 ausencia de voz y TTS, sin impedir texto', async () => {
    await evaluar('control.desmontar();window.control=ui.montarAgente({Reconocimiento:null,sintesis:null,Locucion:null});control.abrir()');
    assert.equal(await evaluar("document.querySelector('.cl-agente-micro').disabled && document.querySelector('.cl-agente-leer').disabled"), true);
    assert.equal(await evaluar('control.obtenerDiagnosticoVoz().apiDisponible'), false);
    await escribir('Texto sin voz'); await enviar(); assert.equal(await evaluar('control.obtenerHistorial().length'), 1);
  });
  await t.test('17 errores síncronos de APIs de voz y TTS no rompen texto', async () => {
    await evaluar("control.desmontar();window.control=ui.montarAgente({Reconocimiento:class {start(){throw new Error('Doble');}abort(){}},sintesis:{speak(){throw new Error('Doble')},cancel(){}},Locucion:class {}});control.abrir();document.querySelector('.cl-agente-micro').click();document.querySelector('.cl-agente-leer').click()");
    await escribir('Continúa'); await enviar(); assert.equal(await evaluar('control.obtenerHistorial().length'), 1);
    assert.equal(await evaluar('control.obtenerDiagnosticoVoz().eventos.find(e=>e.evento==="error").codigo'), 'inicio-fallido');
    await evaluar("control.desmontar();window.control=ui.montarAgente({Reconocimiento:class{start(){throw new DOMException('no exponer','NotAllowedError')}abort(){}}});control.abrir();document.querySelector('.cl-agente-micro').click()");
    assert.equal(await evaluar('control.obtenerDiagnosticoVoz().eventos.find(e=>e.evento==="error").codigo'), 'not-allowed');
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /permisos, privacidad o seguridad/);
  });
  await t.test('18 límite de historial efímero', async () => {
    await evaluar("for(let i=0;i<25;i++){document.querySelector('.cl-agente-texto').value='Prueba '+i;document.querySelector('.cl-agente-formulario').requestSubmit()}");
    assert.equal(await evaluar('control.obtenerHistorial().length'), 20);
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-mensaje-usuario').length"), 20);
  });
  await t.test('19 sin red de aplicación ni almacenamiento automático', async () => {
    assert.deepEqual(await evaluar('({red:__prueba.red,storage:__prueba.storage})'), { red: 0, storage: 0 });
  });
  await t.test('burbujas alineadas, scroll de historial independiente y estado de escritura', async () => {
    await evaluar("document.querySelector('.cl-agente-texto').value='Mensaje de comprobación';document.querySelector('.cl-agente-texto').dispatchEvent(new Event('input'))");
    assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /Escribiendo/);
    const antes = await evaluar("({h:document.querySelector('.cl-agente-panel').clientHeight,y:document.querySelector('.cl-agente-composer').getBoundingClientRect().y})");
    await evaluar("document.querySelector('.cl-agente-mensajes').scrollTop=0"); await enviar();
    const despues = await evaluar("({h:document.querySelector('.cl-agente-panel').clientHeight,y:document.querySelector('.cl-agente-composer').getBoundingClientRect().y,scroll:document.querySelector('.cl-agente-mensajes').scrollTop,izquierda:getComputedStyle(document.querySelector('.cl-agente-mensaje-info')).alignSelf,derecha:getComputedStyle(document.querySelector('.cl-agente-mensaje-usuario')).alignSelf})");
    assert.equal(despues.h, antes.h); assert.equal(despues.y, antes.y); assert.equal(despues.scroll, 0);
    assert.equal(despues.izquierda, 'flex-start'); assert.equal(despues.derecha, 'flex-end');
  });
  await t.test('D1.3A: presentación accesible y opcional, HTML inerte y sin alterar el borrador o foco', async () => {
    await navegar(); await abrir(); await escribir('Borrador que se conserva');
    assert.equal(await evaluar(`control.presentarMemoria({estado:'recordado',resumen:'<img src=x onerror="window.__xss=true">'})`), true);
    assert.equal(await evaluar("!!document.querySelector('[data-memoria] img') || !!window.__xss"), false);
    assert.match(await evaluar("document.querySelector('[data-memoria]').textContent"), /Contexto recordado:.*<img/);
    assert.match(await evaluar("document.querySelector('[data-memoria] .cl-agente-sr').textContent"), /no es una respuesta/);
    assert.equal(await evaluar("document.querySelector('.cl-agente-mensajes').getAttribute('aria-live')"), 'polite');
    assert.equal(await evaluar("document.querySelector('.cl-agente-mensajes').getAttribute('aria-atomic')"), 'false');
    assert.equal(await evaluar("document.activeElement.className"), 'cl-agente-texto');
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador que se conserva');
    assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
    assert.equal(await evaluar("document.querySelectorAll('[data-memoria] .cl-agente-leer').length"), 0);
    await evaluar("control.presentarMemoria({estado:'comprobando'})");
    assert.equal(await evaluar("document.querySelectorAll('[data-memoria]').length"), 1);
    assert.equal(await evaluar("control.presentarMemoria({estado:'recordado',resumen:''})"), false);
    await evaluar('control.limpiarMemoria()'); assert.equal(await evaluar("document.querySelectorAll('[data-memoria]').length"), 0);
  });
  await t.test('D1.3A: widget real y contexto recuperado entre instancias con puerto Map simulado', async () => {
    await navegar();
    await evaluar(`(async () => {window.cm=await import('/js/agente-memoria-coordinador.js');
      window.fixture={id:'11111111-1111-4111-8111-111111111111',datos:new Map(),llamadas:[]};
      window.componer=()=>cm.crearCoordinadorMemoria({widget:control,
        obtenerIdentidad:()=>fixture.id?{id:fixture.id}:null,
        producirContexto:()=>({tipo:'busqueda_catalogo',orden:'recientes',precioMaximoCentimos:10000}),
        ahora:()=>Date.parse('2026-11-22T18:00:00Z'),politica:{maxBytes:24576,ttlMs:604800000},
        almacenamiento:{
          leer:async k=>{fixture.llamadas.push('leer');return {ok:true,datos:fixture.datos.get(k)??null};},
          guardar:async(k,v)=>{fixture.llamadas.push('guardar');fixture.datos.set(k,v);return {ok:true,datos:null};},
          eliminar:async k=>{fixture.llamadas.push('eliminar');fixture.datos.delete(k);return {ok:true,datos:null};}}});
      window.coordinador=componer(); await coordinador.actualizar();
      control.desmontar(); window.control=ui.montarAgente(); window.coordinador=componer();})()`);
    await abrir(); await escribir('Puedo continuar escribiendo');
    await evaluar('coordinador.restaurar()');
    assert.match(await evaluar("document.querySelector('[data-memoria=recordado]').textContent"), /Contexto recordado:.*S\/ 100.00/);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Puedo continuar escribiendo');
    assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
    assert.equal(await evaluar('cm.crearCoordinadorMemoria({widget:control,obtenerIdentidad:()=>null})===coordinador'), true);
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await delay(60);
      assert.equal(await evaluar(`(() => {const p=document.querySelector('.cl-agente-panel').getBoundingClientRect(),
        c=document.querySelector('.cl-agente-composer').getBoundingClientRect();
        return document.documentElement.scrollWidth<=innerWidth && p.x>=0 && p.right<=innerWidth
          && p.top>=0 && p.bottom<=innerHeight && c.top>=p.top && c.bottom<=p.bottom;})()`), true);
      const captura = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(capturas, `d13a-contexto-${width}x${height}.png`), Buffer.from(captura.data, 'base64'));
    }
    await enviar(); assert.equal(await evaluar('control.obtenerHistorial().length'), 1);
    assert.deepEqual(await evaluar('fixture.llamadas'), ['guardar', 'leer']);
    assert.equal(await evaluar('JSON.stringify([...fixture.datos.values()]).includes("Puedo continuar")'), false);
  });
  await t.test('D1.3A: borrado del botón, logout y limpieza de dictado/TTS sin recuperación tardía', async () => {
    await evaluar("fixture.datos.set('otra-funcion','intacto');document.querySelector('.cl-agente-borrar').click()");
    await esperar("!!document.querySelector('[data-memoria=borrado]')");
    assert.equal(await evaluar('fixture.datos.size'), 1); assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
    await evaluar('coordinador.actualizar()');
    await evaluar("document.querySelector('.cl-agente-leer').click();document.querySelector('.cl-agente-micro').click()");
    const abortos = await evaluar('__prueba.voces.at(-1).abortos');
    await evaluar("fixture.id=null;coordinador.invalidarIdentidad()");
    assert.equal(await evaluar('__prueba.voces.at(-1).abortos'), abortos + 1);
    assert.ok(await evaluar('__prueba.cancelaciones') > 0);
    assert.equal(await evaluar("document.querySelectorAll('[data-memoria]').length"), 0);
    assert.equal(await evaluar('control.obtenerHistorial().length'), 0);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), '');
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-abrir');
    await abrir(); await evaluar('coordinador.restaurar()');
    assert.equal(await evaluar("!!document.querySelector('[data-memoria=sin-sesion]')"), true);
    assert.equal(await evaluar('fixture.datos.size'), 2, 'La política de borrado en logout no se decide aquí');
    await evaluar('control.desmontar()'); assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 0);
  });
  await t.test('Landing sin widget ni recursos del agente, incluso al restaurar página', async () => {
    await navegar('/index.html', false);
    await evaluar("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 0);
    assert.equal(await evaluar("!!document.querySelector('script[src*=agente],link[href*=agente]')"), false);
  });
  const geometria = [];
  for (const pagina of ['inicio.html', 'explorar.html']) {
    await t.test('montaje real y ciclo de página: ' + pagina, async () => {
      await navegar('/' + pagina);
      await evaluar("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))");
      assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 0);
      await evaluar("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
      assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 1);
    });
    for (const [ancho, alto] of [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900], [390, 420]]) {
      await t.test(`${pagina}: geometría y accesibilidad ${ancho}x${alto}`, async () => {
        await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });
        await delay(60);
        const cerrado = await evaluar(`(() => {const b=document.querySelector('.cl-agente-abrir'),r=b.getBoundingClientRect(),nav=document.querySelector('.home-bottom'),n=nav?.getBoundingClientRect();return {ancho:r.width,alto:r.height,radio:getComputedStyle(b).borderRadius,visible:getComputedStyle(b).display!=='none',dentro:r.x>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,navNoTapada:!nav||getComputedStyle(nav).display==='none'||r.bottom<=n.top,svg:!!b.querySelector('svg'),panelOculto:getComputedStyle(document.querySelector('.cl-agente-panel')).display==='none'};})()`);
        assert.equal(cerrado.ancho, 56); assert.equal(cerrado.alto, 56); assert.equal(cerrado.radio, '50%');
        assert.ok(cerrado.visible && cerrado.dentro && cerrado.navNoTapada && cerrado.svg && cerrado.panelOculto);
        const guardar = async estado => {
          const captura = await cdp('Page.captureScreenshot', { format: 'png' });
          await writeFile(path.join(capturas, `${pagina}-${ancho}x${alto}-${estado}.png`), Buffer.from(captura.data, 'base64'));
        };
        await guardar('cerrado');
        if ((ancho === 390 && alto === 844) || ancho === 1440) {
          await moverA('.cl-agente-abrir');
          assert.equal(await evaluar("getComputedStyle(document.querySelector('.cl-agente-abrir')).backgroundColor"), 'rgb(31, 52, 144)');
          await guardar('launcher-hover');
          await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
        }
        await abrir(); await delay(60);
        const v = await evaluar(String.raw`(() => {
          const panel=document.querySelector('.cl-agente-panel'), b=document.querySelector('.cl-agente-abrir'), p=panel.getBoundingClientRect(), nav=document.querySelector('.home-bottom'), n=nav?.getBoundingClientRect(), c=document.querySelector('.cl-agente-composer').getBoundingClientRect(),t=document.querySelector('.cl-agente-texto').getBoundingClientRect();
          const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
          return {ancho:innerWidth,alto:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,panel:{x:p.x,y:p.y,right:p.right,bottom:p.bottom,width:p.width,height:p.height},launcherOculto:getComputedStyle(b).display==='none',navNoTapada:!nav||getComputedStyle(nav).display==='none'||p.bottom<=n.top,composerVisible:c.top>=p.top&&c.bottom<=p.bottom&&c.right<=p.right,campoVisible:t.top>=p.top&&t.bottom<=p.bottom,panelSinScroll:panel.scrollHeight===panel.clientHeight,historialScroll:getComputedStyle(document.querySelector('.cl-agente-mensajes')).overflowY==='auto',composerControles:!!document.querySelector('.cl-agente-composer .cl-agente-micro')&&!!document.querySelector('.cl-agente-composer .cl-agente-enviar'),
          idsUnicos:new Set(ids).size===ids.length,refs:[...panel.querySelectorAll('[aria-describedby],[aria-labelledby]')].every(e=>['aria-describedby','aria-labelledby'].every(a=>(e.getAttribute(a)||'').split(/\s+/).filter(Boolean).every(id=>document.getElementById(id)))),ariaLog:panel.querySelector('[role=log]').getAttribute('aria-atomic'),red:__prueba.red,storage:__prueba.storage};})()`);
        geometria.push({ pagina, cerrado, ...v });
        assert.equal(v.overflow, false); assert.ok(v.panel.width > 0 && v.panel.x >= 0 && v.panel.right <= ancho && v.panel.y >= 0);
        assert.ok(v.panel.height <= 550 && v.panel.width <= 380 && v.navNoTapada && v.idsUnicos && v.refs);
        assert.ok(v.launcherOculto && v.composerVisible && v.campoVisible && v.panelSinScroll && v.historialScroll && v.composerControles);
        assert.equal(v.ariaLog, 'false');
        assert.equal(v.red, 0); assert.equal(v.storage, 0);
        assert.equal(await evaluar("document.querySelector('.cl-agente-texto').scrollHeight<=document.querySelector('.cl-agente-texto').clientHeight"), true, 'Campo vacío sin scroll por el placeholder');
        await guardar('abierto');
        if ((ancho === 390 && alto === 844) || ancho === 1440) {
          await moverA('.cl-agente-enviar');
          assert.equal(await evaluar("getComputedStyle(document.querySelector('.cl-agente-enviar')).backgroundColor"), 'rgb(31, 52, 144)');
          await guardar('enviar-hover');
          await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
          await escribir('Quiero encontrar libros de cálculo.'); await enviar();
          assert.equal(await evaluar("document.querySelectorAll('.cl-agente-mensaje-usuario').length"), 1);
          assert.equal(await evaluar("document.querySelectorAll('.cl-agente-mensaje-info:not([data-memoria])').length"), 1);
          assert.match(await evaluar("document.querySelector('.cl-agente-estado').textContent"), /Integración pendiente/);
          await guardar('conversacion-local');
          await evaluar("document.querySelector('.cl-agente-borrar').click()");
        }
        if (alto === 420) {
          await escribir('x'.repeat(1001)); await enviar();
          assert.equal(await evaluar("document.querySelector('.cl-agente-texto').getAttribute('aria-invalid')"), 'true');
          await evaluar("document.querySelector('.cl-agente-texto').value='Borrador multilínea\\n'.repeat(8);document.querySelector('.cl-agente-texto').dispatchEvent(new Event('input'));document.querySelector('.cl-agente-informacion').open=true");
          assert.equal(await evaluar(`(() => {const p=document.querySelector('.cl-agente-panel').getBoundingClientRect(),c=document.querySelector('.cl-agente-composer').getBoundingClientRect(),d=document.querySelector('.cl-agente-detalles').getBoundingClientRect();return c.top>=p.top&&c.bottom<=p.bottom&&d.top>=p.top&&d.bottom<=p.bottom;})()`), true);
          await evaluar("document.querySelector('.cl-agente-informacion').open=false;document.querySelector('.cl-agente-texto').value='';document.querySelector('.cl-agente-texto').dispatchEvent(new Event('input'))");
        }
        await evaluar("document.querySelector('.cl-agente-cerrar').click()");
      });
    }
  }
  // Única habilitación de persistencia: arnés aislado, identidad ficticia y consentimiento por sesión.
  const prepararPersistencia = async (id = '11111111-1111-4111-8111-111111111111', usarCatalogo = false) => {
    await evaluar(`(async()=>{
      window.__permitirStorageReal=true;
      const m=await import('/js/agente-montaje.js');m.iniciarAgente()();
      window.sesionPrueba='33333333-3333-4333-8333-333333333333';window.identidadPrueba=${JSON.stringify(id)};window.notificarAuth=null;window.suscripcionesPrueba=0;
      window.cancelacionesAuthPrueba=0;
      m.iniciarAgente(document,{memoria:{autorizada:true,politica:{maxBytes:24576,ttlMs:604800000},
        ...(${usarCatalogo} ? {} : {producirContexto:()=>({tipo:'busqueda_catalogo',orden:'recientes',precioMaximoCentimos:10000})}),
        auth:{obtenerUsuarioActual:async()=>({ok:true,datos:identidadPrueba?{id:identidadPrueba,sesionId:sesionPrueba}:null,error:null}),
          escucharCambiosAuth:cb=>{suscripcionesPrueba++;notificarAuth=cb;return ()=>{cancelacionesAuthPrueba++;notificarAuth=null;};}}},
        alMontar:(w,c)=>{window.widgetPersistente=w;window.conexionPersistente=c;}});
    })()`);
    await abrir(); await evaluar("document.querySelector('.cl-agente-informacion').open=true");
    await esperar("!document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled");
  };
  const consentirMemoria = async () => {
    await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').click()");
    await esperar("!!document.querySelector('[data-memoria=sin-contexto],[data-memoria=recordado],[data-memoria=sin-sesion]')");
    await evaluar("document.querySelector('.cl-agente-informacion').open=false");
  };
  const claveReal = 'campusloop_tb4_v1_agente_historial_11111111-1111-4111-8111-111111111111';
  await t.test('D1.3B Auth: aviso inicial y confirmaciones de la misma cuenta conservan borrador, foco y consentimiento', async () => {
    await navegar('/inicio.html'); await prepararPersistencia();
    await escribir('Borrador efímero sin enviar');
    await evaluar(`document.querySelector('.cl-agente-texto').focus();
      notificarAuth({evento:'INITIAL_SESSION',estado:'AUTENTICADO',usuario:{id:identidadPrueba}})`);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador efímero sin enviar');
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-texto');
    assert.equal(await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').checked"), false);
    assert.equal(await evaluar("!!document.querySelector('[data-memoria=sin-consentimiento]')"), true);
    await consentirMemoria(); await evaluar('conexionPersistente.actualizar()');
    const json = await evaluar(`localStorage.getItem('${claveReal}')`);
    for (const evento of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED']) {
      await evaluar(`document.querySelector('.cl-agente-texto').focus();
        notificarAuth({evento:${JSON.stringify(evento)},estado:'AUTENTICADO',usuario:{id:identidadPrueba}})`);
      assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador efímero sin enviar');
      assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-texto');
      assert.equal(await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').checked"), true);
      assert.equal(await evaluar("!!document.querySelector('[data-memoria=preparado]')"), true);
      assert.equal(await evaluar(`localStorage.getItem('${claveReal}')`), json, 'sin renovación por eventos');
    }
    assert.equal((await evaluar('conexionPersistente.restaurar()')).ok, true);
    assert.equal((await evaluar('conexionPersistente.borrar()')).ok, true);
    await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').click()");
  });
  await t.test('D1.3B: consentimiento accesible, Web Storage nativo y guardado sin chat ni credenciales', async () => {
    await navegar('/inicio.html');
    assert.equal(await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled"), true);
    assert.equal(await evaluar('__prueba.storage'), 0);
    await prepararPersistencia();
    await evaluar(`localStorage.removeItem('${claveReal}');localStorage.setItem('campusloop_prueba_ajena','intacto')`);
    assert.equal(await evaluar('localStorage instanceof Storage && Object.getPrototypeOf(localStorage)===Storage.prototype'), true);
    assert.equal(await evaluar("document.querySelector('input[type=checkbox][aria-label*=contexto]').disabled"), false);
    // Teclado real: el checkbox etiquetado acepta Space y no secuestra el foco del composer.
    await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').focus()");
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await esperar("!!document.querySelector('[data-memoria=sin-contexto]')");
    await evaluar("document.querySelector('.cl-agente-informacion').open=false");
    await escribir('Borrador local que nunca se persiste');
    const r = await evaluar('conexionPersistente.actualizar()'); assert.equal(r.datos.persistido, true);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador local que nunca se persiste');
    const json = await evaluar(`localStorage.getItem('${claveReal}')`);
    assert.deepEqual(Object.keys(JSON.parse(json)), ['version', 'usuarioId', 'actualizadoEn', 'contexto']);
    assert.equal(JSON.parse(json).contexto.precioMaximoCentimos, 10000);
    assert.doesNotMatch(json, /Borrador|token|correo|historial|password/);
    assert.equal(await evaluar('suscripcionesPrueba'), 1);
  });
  await t.test('D1.3D: navegación Inicio → Explorar recupera contexto con el consentimiento de la sesión', async () => {
    await navegar('/explorar.html');
    assert.equal(await evaluar("!!document.querySelector('[data-memoria=recordado]')"), false);
    await prepararPersistencia(undefined, true); await esperar("!!document.querySelector('[data-memoria=recordado]')");
    assert.match(await evaluar("document.querySelector('[data-memoria=recordado]').textContent"), /Contexto recordado:.*S\/ 100.00/);
    assert.equal(await evaluar('widgetPersistente.obtenerHistorial().length'), 0);
    await escribir('Sigo escribiendo'); await evaluar('conexionPersistente.restaurar()');
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Sigo escribiendo');
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await delay(60);
      assert.equal(await evaluar(`(()=>{const p=document.querySelector('.cl-agente-panel').getBoundingClientRect(),
        c=document.querySelector('.cl-agente-composer').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth
        &&p.x>=0&&p.right<=innerWidth&&p.y>=0&&c.bottom<=p.bottom;})()`), true);
      const s = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(capturas, `d13b-contexto-${width}x${height}.png`), Buffer.from(s.data, 'base64'));
    }
  });
  await t.test('D1.3D: privacidad compacta deja visibles contexto y composer en tres geometrías', async () => {
    await navegar('/explorar.html'); await prepararPersistencia(undefined, true);
    await esperar("!!document.querySelector('[data-memoria=recordado]')");
    const aviso = await evaluar("document.querySelector('#cl-agente-aviso').textContent");
    assert.match(aviso, /Mensajes escritos o dictados: temporales/);
    assert.match(aviso, /solo se guarda con consentimiento/);
    assert.match(aviso, /IA no conectada/);
    for (const [width, height] of [[390, 844], [1440, 900], [390, 420]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await delay(80);
      if (height === 420) await evaluar("document.querySelector('.cl-agente-mensajes').scrollTop=document.querySelector('.cl-agente-mensajes').scrollHeight");
      const g = await evaluar(`(() => {const q=s=>document.querySelector(s).getBoundingClientRect();
        const p=q('.cl-agente-panel'),h=q('.cl-agente-mensajes'),d=q('.cl-agente-detalles'),
          c=q('.cl-agente-composer'),m=q('[data-memoria=recordado]');
        return {panel:p.y>=0&&p.right<=innerWidth,detalle:d.top>=h.bottom-1,
          composer:c.top>=d.bottom-1&&c.bottom<=p.bottom,
          contexto:m.bottom>h.top&&m.top<h.bottom,ancho:document.documentElement.scrollWidth<=innerWidth,
          consentimiento:!document.querySelector('.cl-agente-detalles input').disabled};})()`);
      const s = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(capturas, `d13d-privacidad-${width}x${height}.png`), Buffer.from(s.data, 'base64'));
      assert.deepEqual(g, { panel: true, detalle: true, composer: true, contexto: true, ancho: true, consentimiento: true }, `${width}x${height}`);
    }
    await evaluar("document.querySelector('.cl-agente-informacion').open=false");
  });
  await t.test('D1.3D: aplicar filtros reales de UI proyecta solo contexto estructurado', async () => {
    await evaluar("document.querySelector('#explore-search').value='privado@example.invalid';document.querySelector('#explore-max-price').value='59,50';document.querySelector('#explore-apply').click()");
    await esperar("!!document.querySelector('[data-memoria=preparado]')");
    const json = await evaluar(`localStorage.getItem('${claveReal}')`);
    assert.equal(JSON.parse(json).contexto.precioMaximoCentimos, 5950);
    assert.doesNotMatch(json, /privado|busqueda":|universidad|campus":/);
    for (const ruta of ['/inicio.html', '/explorar.html']) {
      await navegar(ruta); await prepararPersistencia(undefined, true);
      await esperar("!!document.querySelector('[data-memoria=recordado]')");
      assert.match(await evaluar("document.querySelector('[data-memoria=recordado]').textContent"), /59.50/);
      assert.equal(await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').checked"), true);
    }
  });
  await t.test('D1.3D: recarga restaura filtro de Explorar sin un segundo consentimiento', async () => {
    await cdp('Page.reload'); await esperar("document.readyState==='complete' && !!document.querySelector('.cl-agente-raiz')");
    await prepararPersistencia(); await esperar("!!document.querySelector('[data-memoria=recordado]')");
    assert.match(await evaluar("document.querySelector('[data-memoria=recordado]').textContent"), /59.50/);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), '');
    assert.equal(await evaluar("localStorage.getItem('campusloop_prueba_ajena')"), 'intacto');
  });
  await t.test('D1.3B: cuenta B no restaura A; logout cancela voz, lectura y contexto visible', async () => {
    await evaluar("identidadPrueba='22222222-2222-4222-8222-222222222222';notificarAuth({evento:'SIGNED_IN',usuario:{id:identidadPrueba}})");
    assert.equal(await evaluar("!!document.querySelector('[data-memoria=recordado]')"), false);
    await abrir(); await evaluar("document.querySelector('.cl-agente-informacion').open=true"); await esperar("!document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled"); await consentirMemoria();
    assert.equal(await evaluar("!!document.querySelector('[data-memoria=sin-contexto]')"), true);
    const claveB = 'campusloop_tb4_v1_agente_historial_22222222-2222-4222-8222-222222222222';
    assert.equal((await evaluar('conexionPersistente.actualizar()')).datos.persistido, true);
    assert.ok(await evaluar(`localStorage.getItem('${claveB}')`));
    await evaluar("document.querySelector('.cl-agente-leer').click();document.querySelector('.cl-agente-micro').click()");
    const antes = await evaluar('__prueba.voces.at(-1).abortos');
    await evaluar("identidadPrueba=null;notificarAuth({evento:'SIGNED_OUT'})");
    assert.equal(await evaluar('__prueba.voces.at(-1).abortos'), antes + 1);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), '');
    assert.equal(await evaluar('document.activeElement.className'), 'cl-agente-abrir');
    assert.equal(await evaluar(`localStorage.getItem('${claveReal}')!==null`), true, 'El logout de B conserva el contexto de A');
    assert.equal(await evaluar(`localStorage.getItem('${claveB}')`), null);
    assert.equal(await evaluar("sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"), null);
  });
  await t.test('D1.3B: pagehide/pageshow retira suscripción, montaje único y requiere elección nueva', async () => {
    await evaluar("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 1);
    assert.equal(await evaluar('suscripcionesPrueba-cancelacionesAuthPrueba'), 1);
    assert.equal(await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').checked"), false);
    await evaluar("(async()=>{widgetPersistente.desmontar();const m=await import('/js/agente-montaje.js');m.iniciarAgente();m.iniciarAgente();})()");
    assert.equal(await evaluar("document.querySelectorAll('.cl-agente-raiz').length"), 1);
    assert.equal(await evaluar('suscripcionesPrueba-cancelacionesAuthPrueba'), 1);
    await esperar("!!document.querySelector('[data-memoria=sin-sesion]')");
    assert.equal(await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled"), true);
  });
  await t.test('D1.3B: borrado nativo selectivo y recarga sin reaparición', async () => {
    await navegar('/explorar.html'); await prepararPersistencia(); await consentirMemoria();
    assert.equal(await evaluar("!!document.querySelector('[data-memoria=recordado]')"), true);
    await evaluar("document.querySelector('.cl-agente-borrar').click()"); await esperar("!!document.querySelector('[data-memoria=borrado]')");
    assert.equal(await evaluar(`localStorage.getItem('${claveReal}')`), null);
    assert.equal(await evaluar("localStorage.getItem('campusloop_prueba_ajena')"), 'intacto');
    await cdp('Page.reload'); await esperar("document.readyState==='complete' && !!document.querySelector('.cl-agente-raiz')");
    await prepararPersistencia(); await esperar("!!document.querySelector('[data-memoria=sin-contexto]')");
    await evaluar("localStorage.removeItem('campusloop_prueba_ajena')");
  });
  await t.test('D1.3D: Storage nativo corrupto o caducado y fallo de escritura conservan el borrador', async () => {
    await escribir('Borrador efímero');
    await evaluar('conexionPersistente.actualizar()');
    const json = JSON.parse(await evaluar(`localStorage.getItem('${claveReal}')`));
    for (const documento of ['{', JSON.stringify({ ...json, actualizadoEn: '2000-01-01T00:00:00.000Z' })]) {
      await evaluar(`localStorage.setItem('${claveReal}', ${JSON.stringify(documento)})`);
      assert.equal((await evaluar('conexionPersistente.restaurar()')).ok, false);
      assert.equal(await evaluar("!!document.querySelector('[data-memoria=recordado]')"), false);
    }
    const r = await evaluar(`(async()=>{const original=Storage.prototype.setItem;
      try { Storage.prototype.setItem=()=>{throw new DOMException('','QuotaExceededError')};return await conexionPersistente.actualizar(); }
      finally { Storage.prototype.setItem=original; }})()`);
    assert.equal(r.ok, false);
    assert.equal(await evaluar("document.querySelector('.cl-agente-texto').value"), 'Borrador efímero');
    const marcaRevocacion = 'campusloop_tb4_v1_agente_generacion_11111111-1111-4111-8111-111111111111';
    const generacionAntesDeRevocar = await evaluar(`JSON.parse(localStorage.getItem('${marcaRevocacion}')).consentimiento`);
    await evaluar("document.querySelector('.cl-agente-detalles input[type=checkbox]').click()");
    await esperar(`JSON.parse(localStorage.getItem('${marcaRevocacion}')).consentimiento===${generacionAntesDeRevocar + 1} && localStorage.getItem('${claveReal}')===null`);
    assert.equal(await evaluar(`localStorage.getItem('${claveReal}')`), null);
    assert.equal(await evaluar("sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"), null);
  });
  await t.test('D1.3D: una sesión nueva de la misma cuenta requiere nuevo consentimiento', async () => {
    await consentirMemoria();
    assert.equal((await evaluar('conexionPersistente.actualizar()')).ok, true);
    await evaluar("sesionPrueba='44444444-4444-4444-8444-444444444444';notificarAuth({evento:'SIGNED_IN',usuario:{id:identidadPrueba}})");
    await esperar("!document.querySelector('.cl-agente-detalles input[type=checkbox]').checked && !!document.querySelector('[data-memoria=sin-consentimiento]')");
    assert.equal(await evaluar("sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"), null);
    assert.equal((await evaluar('conexionPersistente.actualizar()')).ok, false);
  });
  await t.test('D1.3B: limpieza antigua idempotente no desmonta una conexión nueva', async () => {
    assert.equal(await evaluar(`(async()=>{const m=await import('/js/agente-montaje.js');
      const antigua=m.iniciarAgente();antigua();const nueva=m.iniciarAgente();antigua();
      const cantidad=document.querySelectorAll('.cl-agente-raiz').length;nueva();nueva();
      return cantidad===1&&!document.querySelector('.cl-agente-raiz');})()`), true);
  });
  await t.test('D1.3D: revocación real con dos pestañas Chrome y Web Locks', async () => {
    const idA = '11111111-1111-4111-8111-111111111111';
    const idB = '22222222-2222-4222-8222-222222222222';
    const claveA = `campusloop_tb4_v1_agente_historial_${idA}`;
    const marcaA = `campusloop_tb4_v1_agente_generacion_${idA}`;
    const claveB = `campusloop_tb4_v1_agente_historial_${idB}`;
    await cdp('Page.navigate', { url: origen + '/__agente__/dos-pestanas.html?fresh=1&reset=1' });
    // La ruta elimina fresh/reset de la URL para que una recarga posterior no
    // borre artificialmente el consentimiento de sessionStorage.
    await esperar("location.pathname==='/__agente__/dos-pestanas.html' && document.readyState==='complete' && window.__ready===true");
    await evaluar("__widget.abrir();document.querySelector('.cl-agente-informacion').open=true");
    await esperar("!document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled");
    assert.equal(await evaluar("navigator.locks&&typeof navigator.locks.request==='function'"), true);
    assert.equal(await evaluar(`localStorage.getItem('${claveA}')`), null);
    await evaluar(`window.__tabB=window.open(${JSON.stringify(origen + '/__agente__/dos-pestanas.html?cuenta=A&fresh=1')},'campusloop-tab-b');!!window.__tabB`, true);
    assert.equal(await evaluar('!!window.__tabB'), true, 'Chrome creó una segunda pestaña real');
    await esperar("window.__tabB.__ready===true && !window.__tabB.document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled");
    await evaluar("window.__tabB.__widget.abrir();window.__tabB.document.querySelector('.cl-agente-informacion').open=true");
    const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
    assert.ok(paginas.filter(p => p.type === 'page' && p.url.startsWith(origen + '/__agente__/dos-pestanas.html')).length >= 2,
      'dos targets de página Chrome distintos comparten el origen');
    // Reproduce el defecto nativo anterior: quitar una clave inexistente no envía
    // storage al otro documento, así que ese evento no sirve para revocar.
    await evaluar(`localStorage.removeItem('${claveA}')`); await delay(150);
    assert.deepEqual(await evaluar('window.__tabB.__storageEvents'), [], 'removeItem inexistente no notificó a la otra pestaña');

    await evaluar('__consentir();window.__tabB.__consentir()');
    await esperar("!!document.querySelector('[data-memoria=sin-contexto]')");
    await esperar("!!window.__tabB.document.querySelector('[data-memoria=sin-contexto]')");
    const antes = await evaluar(`JSON.parse(localStorage.getItem('${marcaA}')).consentimiento`);
    assert.equal(await evaluar(`localStorage.getItem('${claveA}')`), null, 'todavía no hay contexto guardado');
    await evaluar("window.__tabB.__pending=true;window.__tabB.__pendingResult=window.__tabB.__update();true");
    await evaluar("window.__tabB.__pendingResult.then(r=>window.__tabB.__pendingValue={ok:r.ok,codigo:r.error?.codigo??null},()=>window.__tabB.__pendingValue={ok:false,codigo:'rechazada'});true");
    await esperar('window.__tabB.__producerStarted===true');
    await evaluar(`window.__tabB.__holdAccountLock('${idA}');true`);
    await esperar('window.__tabB.__lockStarted===true');
    await evaluar('__revocar()');
    await esperar(`window.__tabB.navigator.locks.query().then(q=>q.pending.some(l=>l.name==='campusloop:agente:memoria:v1:${idA}'))`);
    await evaluar(`window.__tabB.__resolvePending({tipo:'busqueda_catalogo',orden:'recientes',precioMaximoCentimos:10000});window.__tabB.__pending=false;true`);
    await delay(100);
    assert.equal(await evaluar(`localStorage.getItem('${claveA}')`), null,
      'la escritura de B no atraviesa el lock retenido mientras la revocación está en cola');
    await evaluar('window.__tabB.__releaseAccountLock();true');
    await esperar(`JSON.parse(localStorage.getItem('${marcaA}')).consentimiento===${antes + 1}`);
    await esperar("window.__tabB.__state().checked===false && !window.__tabB.document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled");
    await esperar('window.__tabB.__pendingValue!==undefined');
    assert.equal(await evaluar('window.__tabB.__pendingValue.ok'), false, 'el productor obsoleto termina como cancelado');
    assert.equal(await evaluar(`localStorage.getItem('${claveA}')`), null,
      'la respuesta tardía no recreó contexto tras completar la revocación');
    assert.equal(await evaluar('window.__tabB.__state().checked'), false);

    await evaluar('window.__tabB.__consentir()');
    await esperar('window.__tabB.__state().checked===true');
    await esperar("!!window.__tabB.sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')");
    await delay(80); // La verificación Auth y la restauración inicial ocurren fuera del handler de click.
    await evaluar('window.__tabB.__connection.actualizar().then(r=>{window.__tabB.__actualizarOk=r.ok;window.__tabB.__actualizarCodigo=r.error?.codigo??null},()=>{window.__tabB.__actualizarOk=false;window.__tabB.__actualizarCodigo="rechazada"});true');
    await esperar('window.__tabB.__actualizarOk!==undefined');
    assert.equal(await evaluar('window.__tabB.__actualizarOk'), true,
      'actualización tras nuevo consentimiento: ' + await evaluar('window.__tabB.__actualizarCodigo'));
    assert.ok(await evaluar(`localStorage.getItem('${claveA}')`), 'una nueva elección explícita habilita la generación vigente');

    // Borrar conversación en B incrementa la generación operativa, conserva el
    // consentimiento y cancela una actualización pendiente en A antes de permitir
    // una selección nueva. La escritura vieja se resuelve tarde y no reaparece.
    await evaluar('__consentir()');
    await esperar("!!sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"); await delay(80);
    const consentimientoAntesDelBorrado = await evaluar(`JSON.parse(localStorage.getItem('${marcaA}')).consentimiento`);
    const operacionAntesDelBorrado = await evaluar(`JSON.parse(localStorage.getItem('${marcaA}')).operacion`);
    await evaluar("window.__pending=true;window.__pendingResult=window.__update();window.__pendingResult.then(r=>window.__pendingValue={ok:r.ok,codigo:r.error?.codigo??null},()=>window.__pendingValue={ok:false,codigo:'rechazada'});true");
    await esperar('window.__producerStarted===true');
    await evaluar("window.__tabB.document.querySelector('.cl-agente-borrar').click();true");
    await esperar(`JSON.parse(localStorage.getItem('${marcaA}')).operacion===${operacionAntesDelBorrado + 1} && localStorage.getItem('${claveA}')===null`);
    assert.equal(await evaluar(`JSON.parse(localStorage.getItem('${marcaA}')).consentimiento`), consentimientoAntesDelBorrado);
    assert.equal(await evaluar("window.__tabB.document.querySelector('.cl-agente-detalles input[type=checkbox]').checked"), true,
      'el borrado manual conserva el consentimiento de B');
    assert.ok(await evaluar("window.__tabB.sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"));
    await esperar("window.__state().memory==='sin-contexto'");
    await evaluar(`window.__resolvePending({tipo:'busqueda_catalogo',orden:'recientes',precioMaximoCentimos:10000});window.__pending=false;true`);
    await esperar('window.__pendingValue!==undefined');
    assert.equal(await evaluar('window.__pendingValue.ok'), false, 'respuesta anterior al borrado manual cancelada');
    assert.equal(await evaluar(`localStorage.getItem('${claveA}')`), null);
    await evaluar('__update().then(r=>window.__actualizarOk=r.ok,()=>window.__actualizarOk=false);true');
    await esperar('window.__actualizarOk===true');
    assert.ok(await evaluar(`localStorage.getItem('${claveA}')`), 'una selección posterior al borrado puede guardarse con consentimiento vigente');

    await evaluar(`window.__tabC=window.open(${JSON.stringify(origen + '/__agente__/dos-pestanas.html?cuenta=B&fresh=1')},'campusloop-tab-c');!!window.__tabC`, true);
    assert.equal(await evaluar('!!window.__tabC'), true);
    await esperar("window.__tabC.__ready===true && !window.__tabC.document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled");
    await evaluar("window.__tabC.__widget.abrir();window.__tabC.document.querySelector('.cl-agente-informacion').open=true;window.__tabC.__consentir()");
    await esperar("!!window.__tabC.document.querySelector('[data-memoria=sin-contexto]')");
    await evaluar('window.__tabC.__connection.actualizar().then(r=>window.__tabC.__actualizarOk=r.ok,()=>window.__tabC.__actualizarOk=false);true');
    await esperar('window.__tabC.__actualizarOk===true');
    const jsonB = await evaluar(`localStorage.getItem('${claveB}')`); assert.ok(jsonB);
    await evaluar('__consentir()');
    await esperar("!!sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')");
    await delay(80);
    await evaluar('__update().then(r=>window.__actualizarOk=r.ok,()=>window.__actualizarOk=false);true');
    await esperar('window.__actualizarOk===true');
    await evaluar('window.__tabB.__connection.desmontar();true');
    const eleccionSuspendida = await evaluar("window.__tabB.sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')");
    assert.ok(eleccionSuspendida, 'la pestaña suspendida conserva su consentimiento antiguo sin recibir storage');
    await evaluar('__revocar()');
    await esperar(`JSON.parse(localStorage.getItem('${marcaA}')).consentimiento>${antes + 1}`);
    assert.equal(await evaluar(`localStorage.getItem('${claveA}')`), null);
    assert.equal(await evaluar(`localStorage.getItem('${claveB}')`), jsonB, 'revocar A conserva el documento de B');
    assert.equal(await evaluar("window.__tabB.sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"), eleccionSuspendida,
      'sin listener, el consentimiento viejo permanece hasta la revalidación real');

    const origenRecarga = await evaluar('window.__tabB.performance.timeOrigin');
    await evaluar('setTimeout(()=>window.__tabB.location.reload(),0);true');
    await esperar(`window.__tabB.performance.timeOrigin!==${origenRecarga} && window.__tabB.__ready===true && !window.__tabB.document.querySelector('.cl-agente-detalles input[type=checkbox]').disabled`);
    await esperar("window.__tabB.document.querySelector('.cl-agente-detalles input[type=checkbox]').checked===false && window.__tabB.sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')===null && window.__tabB.__state().memory==='sin-consentimiento'");
    assert.equal(await evaluar("window.__tabB.document.querySelector('.cl-agente-detalles input[type=checkbox]').checked"), false);
    assert.equal(await evaluar("window.__tabB.sessionStorage.getItem('campusloop_tb4_v1_agente_consentimiento')"), null,
      'el montaje recuperado elimina la elección invalidada antes de restaurar');
    assert.equal(await evaluar(`window.__tabB.localStorage.getItem('${claveA}')`), null);
    await evaluar('window.__tabB.close();window.__tabC.close()');
  });
  await t.test('20 red externa y errores de consola ausentes', () => {
    assert.deepEqual(externos, []); assert.deepEqual(errores, []);
    assert.equal(pedidos.some(p => /api\/|asistente/.test(p)), false);
    assert.equal(pedidos.includes('js/auth.js'), true, 'Módulo oficial estático; sin SDK ni solicitudes Auth');
  });
  await writeFile(path.join(capturas, 'geometria.json'), JSON.stringify(geometria, null, 2));
  await writeFile(path.join(capturas, 'estilos.json'), JSON.stringify(estilos, null, 2));
});
