import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { opcionesPrueba, registrosPrueba, adaptarRegistroPrueba } from '../catalogo/fixtures.mjs';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseCommit = '89c9780ba7f725080da76d396a62faeeb587fac2';
const root = path.resolve(import.meta.dirname, '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('Chrome local sin servicios externos: Inicio responsive, estados efectivos, navegación y regresiones',
  { skip: !existsSync(chrome) && 'Chrome local no disponible; no se descarga', timeout: 90000 }, async t => {
  const temporal = await mkdtemp(path.join(tmpdir(), 'campusloop-inicio-'));
  const perfil = path.join(temporal, 'perfil'); await mkdir(perfil);
  const evidencias = path.join(temporal, 'evidencias'); await mkdir(evidencias);
  const baseline = new Map(['explorar.html', 'inicio.html', 'index.html', 'login.html', 'registro.html', 'css/styles.css'].map(p => [p, execFileSync('git', ['show', `${baseCommit}:${p}`], { cwd: root })]));
  const pedidos = [], bloqueados = [], excepciones = [], resultados = [], visibilidades = [];
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
  const server = createServer(async (req, res) => {
    try {
      pedidos.push(req.url);
      let ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
      const anterior = ruta.startsWith('__baseline__/'); if (anterior) ruta = ruta.slice(13);
      if (!['explorar.html', 'inicio.html', 'index.html', 'login.html', 'registro.html', 'css/styles.css', 'js/catalogo.js', 'js/landing.js'].includes(ruta)
        && !/^assets\/[A-Za-z0-9_./-]+$/.test(ruta)) { res.writeHead(404).end(); return; }
      const destino = path.resolve(root, ruta);
      if (!destino.startsWith(root + path.sep)) throw new Error('Ruta no permitida');
      const datos = anterior && baseline.has(ruta) ? baseline.get(ruta) : await readFile(destino);
      res.writeHead(200, { 'Content-Type': mime[path.extname(ruta)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(datos);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origen = `http://127.0.0.1:${server.address().port}`;
  const proceso = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run',
    '--no-default-browser-check', '--disable-default-apps', '--disable-extensions', '--no-proxy-server',
    '--disable-client-side-phishing-detection', '--safebrowsing-disable-auto-update', '--disable-domain-reliability',
    '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let socket, siguiente = 0, cargas = 0;
  const pendientes = new Map();
  const enviar = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++siguiente;
    const timer = setTimeout(() => { pendientes.delete(id); reject(new Error('CDP sin respuesta: ' + method)); }, 5000);
    pendientes.set(id, { resolve: valor => { clearTimeout(timer); resolve(valor); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  t.after(async () => {
    try { if (socket?.readyState === WebSocket.OPEN) await Promise.race([enviar('Browser.close'), delay(1000)]); } catch { /* Navegador ya cerrado. */ }
    socket?.close();
    for (let i = 0; i < 30 && proceso.exitCode === null; i++) await delay(100);
    if (proceso.exitCode === null) proceso.kill();
    await new Promise(resolve => server.close(resolve));
    // Único borrado recursivo: perfil de prueba con ruta absoluta comprobada.
    assert.equal(path.dirname(perfil), temporal); assert.equal(path.dirname(temporal), path.resolve(tmpdir()));
    assert.ok(path.basename(temporal).startsWith('campusloop-inicio-'));
    await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
    console.log('Evidencias locales: ' + evidencias);
  });
  let puerto;
  for (let i = 0; i < 100; i++) {
    try { puerto = (await readFile(path.join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(puerto, 'Chrome inició su puerto local');
  console.log('Chrome de prueba iniciado; conectando al depurador local.');
  const targets = await (await fetch(`http://127.0.0.1:${puerto}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  socket = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('WebSocket local sin respuesta')), 5000); socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true }); socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket local no disponible')); }, { once: true }); });
  socket.addEventListener('message', evento => {
    const m = JSON.parse(evento.data);
    if (m.method === 'Page.loadEventFired') cargas++;
    if (m.id) { const p = pendientes.get(m.id); pendientes.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') excepciones.push(m.params.exceptionDetails.text);
    if (m.method === 'Fetch.requestPaused') {
      const permitido = m.params.request.url.startsWith(origen + '/');
      if (!permitido) bloqueados.push(m.params.request.url.split('?')[0]);
      void enviar(permitido ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        { requestId: m.params.requestId, ...(!permitido ? { errorReason: 'BlockedByClient' } : {}) }).catch(() => {});
    }
  });
  await enviar('Runtime.enable'); await enviar('Page.enable'); await enviar('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  const evaluar = async expression => {
    const r = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('Falló evaluación de prueba: ' + r.exceptionDetails.text);
    return r.result.value;
  };
  const esperar = async condicion => {
    for (let i = 0; i < 100; i++) { if (await evaluar(condicion)) return; await delay(30); }
    throw new Error('No se alcanzó el estado esperado');
  };
  const navegar = async ruta => {
    const anterior = cargas;
    await enviar('Page.navigate', { url: origen + ruta });
    for (let i = 0; i < 100 && cargas === anterior; i++) await delay(30);
    assert.ok(cargas > anterior, 'Se recibió la carga de la nueva navegación');
    await esperar(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(ruta)}`);
    await evaluar('document.fonts.ready.then(() => true)');
  };
  const observar = async (estado, reintento = false) => {
    const datos = await evaluar(`(() => {
      const nombres=['demo-products','live-products','retry','refresh'];
      const elementos=Object.fromEntries(nombres.map(n=>{const e=document.getElementById('home-'+n);return[n,{display:getComputedStyle(e).display,hidden:e.hidden,rectangulos:e.getClientRects().length,disabled:e.disabled??false}]}));
      const visible=id=>[...document.querySelectorAll('#'+id+' article')].filter(e=>e.getClientRects().length>0).length;
      const s=document.querySelector('.home-scroll'),aviso=document.getElementById('home-catalog-status');
      return {ancho:innerWidth,estado:document.getElementById('home-catalog-notice').dataset.estado,elementos,
        demo:visible('home-demo-products'),prueba:visible('home-live-products'),
        overflow:document.documentElement.scrollWidth>innerWidth||s.scrollWidth>s.clientWidth,
        role:aviso.getAttribute('role'),live:aviso.getAttribute('aria-live'),texto:aviso.textContent,
        avisoVisible:aviso.getClientRects().length>0,ocupado:document.getElementById('home-catalog-results').getAttribute('aria-busy'),
        personal:JSON.stringify([...document.querySelectorAll('.home-metric,.home-activity-list,.home-delivery')].map(e=>e.textContent))};
    })()`);
    assert.equal(datos.estado,estado); assert.equal(datos.overflow,false);
    const esperado={'demo-products':estado==='pendiente'?'grid':'none','live-products':['listo','vacio'].includes(estado)?'grid':'none',retry:reintento?'flex':'none',refresh:estado==='pendiente'?'none':'flex'};
    for(const [nombre,display] of Object.entries(esperado)){
      assert.equal(datos.elementos[nombre].display,display,datos.ancho+'px / '+estado+' / '+nombre);
      assert.equal(datos.elementos[nombre].hidden,display==='none');
      if(display==='none')assert.equal(datos.elementos[nombre].rectangulos,0);
      else assert.ok(datos.elementos[nombre].rectangulos>0);
    }
    assert.equal(datos.demo,estado==='pendiente'?4:0);assert.equal(datos.prueba,estado==='listo'?registrosPrueba().length:0);
    assert.equal(datos.demo>0&&datos.prueba>0,false);assert.equal(datos.ocupado,String(estado==='cargando'));
    assert.equal(datos.role,'status');assert.equal(datos.live,'polite');assert.equal(datos.avisoVisible,true);
    if(estado==='pendiente')assert.match(datos.texto,/Figma.*no resultados de Supabase.*personalizadas/);
    visibilidades.push(datos);return datos;
  };
  const inyectar = () => evaluar(`(async()=>{
    const m=await import('/js/landing.js');m.desmontarInicio(document.body);window.__inicioPrueba={llamadas:0};
    m.montarInicio({raiz:document.body,modo:'prueba',opciones:${JSON.stringify(opcionesPrueba())},
      adaptarFiltros:f=>({soloFixture:f}),adaptarArticulo:${adaptarRegistroPrueba.toString()},
      consultarCatalogo:(f,{signal})=>{window.__inicioPrueba.llamadas++;return new Promise(resolve=>{window.__inicioPrueba.resolver=resolve;});}});
  })()`);
  const completar = async (respuesta,estado) => {
    await evaluar(`window.__inicioPrueba.resolver(${JSON.stringify(respuesta)})`);
    await esperar(`document.getElementById('home-catalog-notice').dataset.estado===${JSON.stringify(estado)}`);
  };
  const medir = () => evaluar("(()=>{const r=document.querySelector('.home-product').getBoundingClientRect();return {width:r.width,height:r.height,y:r.y,imagenes:[...document.images].every(i=>i.complete&&i.naturalWidth>0)};})()");
  for(const ancho of [320,390,768,1024,1280,1440,1920]){
    await t.test('Inicio '+ancho+'px: pendiente, preparado, carga, éxito, vacío, error y reintento',async()=>{
      await enviar('Emulation.setDeviceMetricsOverride',{width:ancho,height:900,deviceScaleFactor:1,mobile:false});
      let antes;
      if([390,1440].includes(ancho)){
        await navegar('/__baseline__/inicio.html');antes=await medir();
        const foto=await enviar('Page.captureScreenshot',{captureBeyondViewport:ancho>=1280});
        await writeFile(path.join(evidencias,'baseline-'+ancho+'.png'),Buffer.from(foto.data,'base64'));
      }
      await navegar('/inicio.html');const despues=await medir();const inicial=await observar('pendiente');
      assert.equal(despues.imagenes,true);assert.equal(await evaluar("document.fonts.check('14px Inter')"),true);
      assert.equal(await evaluar("getComputedStyle(document.getElementById('home-demo-notice')).display==='none'"),false);
      if(antes){assert.equal(despues.width,antes.width);assert.equal(despues.height,antes.height);}
      const foto=await enviar('Page.captureScreenshot',{captureBeyondViewport:ancho>=1280});
      await writeFile(path.join(evidencias,'inicio-'+ancho+'.png'),Buffer.from(foto.data,'base64'));resultados.push({ancho,antes,despues});
      await inyectar();await observar('preparado');
      await evaluar("document.getElementById('home-refresh').click()");await observar('cargando');
      await completar({ok:true,datos:registrosPrueba(),error:null},'listo');assert.equal((await observar('listo')).personal,inicial.personal);
      assert.equal(await evaluar("document.querySelectorAll('#home-live-products h3 img').length"),0);
      assert.equal(await evaluar("document.querySelectorAll('#home-live-products a').length"),0);
      await evaluar("document.getElementById('home-refresh').click()");await observar('cargando');
      await completar({ok:true,datos:[],error:null},'vacio');await observar('vacio');
      await evaluar("document.getElementById('home-refresh').click()");await observar('cargando');
      await completar({ok:false,datos:null,error:{codigo:'RED',mensaje:'NO_REFLEJAR'}},'error');
      assert.equal((await observar('error',true)).texto.includes('NO_REFLEJAR'),false);
      await enviar('Page.bringToFront');await enviar('Emulation.setFocusEmulationEnabled',{enabled:true});
      await evaluar("document.getElementById('home-retry').focus()");
      assert.equal(await evaluar("getComputedStyle(document.activeElement).outlineWidth"),'3px');
      await enviar('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
      await enviar('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await observar('cargando');await completar({ok:true,datos:registrosPrueba(),error:null},'listo');await observar('listo');
    });
  }
  await t.test('pagehide desconecta; pageshow desde bfcache restaura pendiente',async()=>{
    await evaluar("document.getElementById('home-refresh').click()");const llamadas=await evaluar('window.__inicioPrueba.llamadas');
    await evaluar("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));document.getElementById('home-refresh').click()");
    assert.equal(await evaluar('window.__inicioPrueba.llamadas'),llamadas);
    await evaluar("window.__inicioPrueba.resolver({ok:true,datos:[],error:null});window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
    await observar('pendiente');
  });
  await t.test('Inicio → Explorar con teclado; Explorar → Inicio con mouse; barra inferior',async()=>{
    await enviar('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await navegar('/inicio.html');
    await evaluar("document.querySelector('.home-welcome-actions a[href=\"explorar.html\"]').focus()");
    await enviar('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
    await enviar('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await esperar("location.pathname==='/explorar.html'&&document.readyState==='complete'");
    const rect=await evaluar("(()=>{const r=document.querySelector('.home-bottom a[href=\"inicio.html\"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await enviar('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',clickCount:1});
    await enviar('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',clickCount:1});
    await esperar("location.pathname==='/inicio.html'&&document.readyState==='complete'");await observar('pendiente');
    assert.equal(await evaluar("(()=>{const s=document.querySelector('.home-scroll');s.scrollTop=s.scrollHeight;return document.getElementById('home-demo-products').getBoundingClientRect().bottom<=document.querySelector('.home-bottom').getBoundingClientRect().top;})()"),true);
  });
  for(const pagina of ['index.html','login.html','registro.html','explorar.html']){
    for(const ancho of [390,1440])await t.test('regresión '+pagina+' a '+ancho+'px',async()=>{
      await enviar('Emulation.setDeviceMetricsOverride',{width:ancho,height:900,deviceScaleFactor:1,mobile:false});
      const medirPagina=()=>evaluar("JSON.stringify([...document.querySelectorAll('h1,h2,.button,.product-card,.brand,.home-bottom')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.x,r.y,r.width,r.height,s.color,s.backgroundColor,s.fontSize]}))");
      await navegar('/__baseline__/'+pagina);const antes=await medirPagina();await navegar('/'+pagina);assert.equal(await medirPagina(),antes);
    });
  }
  assert.deepEqual(excepciones,[]);assert.deepEqual(bloqueados,[]);
  assert.equal(pedidos.some(p=>/articulos\.js|rest\/v1|supabase|nvidia/i.test(p)),false);
  await writeFile(path.join(evidencias,'comparacion.json'),JSON.stringify(resultados,null,2));
  await writeFile(path.join(evidencias,'visibilidad.json'),JSON.stringify(visibilidades,null,2));
});
