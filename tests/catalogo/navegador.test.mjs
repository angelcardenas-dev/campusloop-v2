import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { opcionesPrueba, registrosPrueba, adaptarRegistroPrueba } from './fixtures.mjs';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseCommit = 'e6433813b8ec3da03fa040bc1fecd57775797ff9';
const root = path.resolve(import.meta.dirname, '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('Chrome local sin servicios externos: responsive, filtros, teclado, estados y baseline',
  { skip: !existsSync(chrome) && 'Chrome local no disponible; no se descarga', timeout: 90000 }, async t => {
  const temporal = await mkdtemp(path.join(tmpdir(), 'campusloop-catalogo-'));
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
      if (!['explorar.html', 'inicio.html', 'index.html', 'login.html', 'registro.html', 'css/styles.css', 'js/catalogo.js'].includes(ruta)
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
    assert.ok(path.basename(temporal).startsWith('campusloop-catalogo-'));
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
  const medir = () => evaluar(`(() => { const c=document.querySelector('.explore-product'), s=document.querySelector('.home-scroll'), b=c.getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth||s.scrollWidth>s.clientWidth,cards:document.querySelectorAll('#explore-demo-products article,.explore-products:not([id]) article').length,card:{width:b.width,height:b.height,y:b.y},font:getComputedStyle(c).fontFamily,imagenes:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}; })()`);
  const comprobarVisibilidad = async (estado, { reintento = false, paso = estado } = {}) => {
    const actual = await evaluar(`(() => {
      const ids=['explore-demo-products','explore-live-products','explore-retry','explore-pagination'];
      const elementos=Object.fromEntries(ids.map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return [id,{hidden:e.hidden,display:s.display,visibility:s.visibility,rectangulos:e.getClientRects().length}]}));
      const visibles=id=>[...document.querySelectorAll('#'+id+' article')].filter(e=>e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible').length;
      const aviso=document.getElementById('explore-status'),scroll=document.querySelector('.home-scroll');
      return {ancho:innerWidth,estado:document.getElementById('explore-notice').dataset.estado,elementos,
        tarjetasFigma:visibles('explore-demo-products'),tarjetasPrueba:visibles('explore-live-products'),
        aviso:{display:getComputedStyle(aviso).display,rectangulos:aviso.getClientRects().length,role:aviso.getAttribute('role'),live:aviso.getAttribute('aria-live'),texto:aviso.textContent,ocupado:!!aviso.closest('[aria-busy="true"]')},
        overflow:document.documentElement.scrollWidth>innerWidth||scroll.scrollWidth>scroll.clientWidth};
    })()`);
    assert.equal(actual.estado, estado);
    const esperados = {
      'explore-demo-products': estado === 'pendiente' ? 'grid' : 'none',
      'explore-live-products': ['listo', 'vacio'].includes(estado) ? 'grid' : 'none',
      // .button declara inline-flex; al ser hijo de .alert (flex) computa como flex.
      'explore-retry': reintento ? 'flex' : 'none',
      'explore-pagination': estado === 'pendiente' ? 'block' : 'none',
    };
    for (const [id, display] of Object.entries(esperados)) {
      const elemento = actual.elementos[id];
      assert.equal(elemento.display, display, `${actual.ancho}px / ${paso} / ${id}: display efectivo`);
      assert.equal(elemento.hidden, display === 'none');
      if (display === 'none') assert.equal(elemento.rectangulos, 0, `${id}: sin caja de renderizado`);
      else { assert.ok(elemento.rectangulos > 0, `${id}: tiene caja de renderizado`); assert.equal(elemento.visibility, 'visible'); }
    }
    assert.equal(actual.tarjetasFigma, estado === 'pendiente' ? 8 : 0);
    assert.equal(actual.tarjetasPrueba, estado === 'listo' ? registrosPrueba().length : 0);
    assert.equal(actual.tarjetasFigma > 0 && actual.tarjetasPrueba > 0, false);
    assert.notEqual(actual.aviso.display, 'none'); assert.ok(actual.aviso.rectangulos > 0);
    assert.equal(actual.aviso.role, 'status'); assert.equal(actual.aviso.live, 'polite');
    assert.equal(actual.aviso.ocupado, false); assert.ok(actual.aviso.texto.trim());
    if (estado === 'pendiente') assert.match(actual.aviso.texto, /Integración pendiente.*Figma.*no resultados de Supabase/);
    assert.equal(actual.overflow, false, `${actual.ancho}px / ${paso}: sin desbordamiento`);
    visibilidades.push({ paso, ...actual });
  };
  for (const ancho of [320, 390, 768, 1024, 1280, 1440, 1920]) {
    await t.test(`Explorar ${ancho}px, sin overflow ni recursos rotos`, async () => {
      await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: ancho < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
      let antes;
      if ([390, 1440].includes(ancho)) {
        await navegar('/__baseline__/explorar.html'); antes = await medir();
        const foto = await enviar('Page.captureScreenshot', { captureBeyondViewport: true });
        await writeFile(path.join(evidencias, `baseline-${ancho}.png`), Buffer.from(foto.data, 'base64'));
      }
      await navegar('/explorar.html'); const despues = await medir();
      assert.equal(despues.overflow, false); assert.equal(despues.imagenes, true); assert.equal(despues.cards, 8);
      if (antes) { assert.equal(despues.card.width, antes.card.width); assert.equal(despues.card.height, antes.card.height); }
      const foto = await enviar('Page.captureScreenshot', { captureBeyondViewport: true });
      await writeFile(path.join(evidencias, `explorar-${ancho}.png`), Buffer.from(foto.data, 'base64'));
      resultados.push({ ancho, antes, despues });
    });
  }
  await t.test('teclado Mobile, filtros honestos sin servicio y validación de precio', async () => {
    await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }); await navegar('/explorar.html');
    await enviar('Page.bringToFront'); await enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
    await evaluar(`document.getElementById('explore-toggle-filters').focus()`);
    assert.equal(await evaluar('document.activeElement.id'), 'explore-toggle-filters');
    await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
    await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluar(`document.getElementById('explore-toggle-filters').getAttribute('aria-expanded')`), 'true');
    await enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    assert.equal(await evaluar('document.activeElement.id'), 'explore-toggle-filters');
    assert.equal(await evaluar(`getComputedStyle(document.activeElement).outlineWidth`), '3px');
    await evaluar(`document.getElementById('explore-search').value='sin coincidencias'; document.getElementById('explore-search').dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('explore-apply').click()`);
    assert.equal(await evaluar(`document.getElementById('explore-header-search').value`), 'sin coincidencias');
    assert.equal(await evaluar(`document.getElementById('explore-demo-products').hidden`), false);
    await evaluar(`document.getElementById('explore-min-price').value='-1'; document.getElementById('explore-apply').click()`);
    assert.equal(await evaluar('document.activeElement.id'), 'explore-min-price');
    assert.equal(await evaluar(`document.getElementById('explore-min-price').getAttribute('aria-invalid')`), 'true');
    await evaluar(`document.getElementById('explore-clear').click()`);
    assert.equal(await evaluar(`document.getElementById('explore-min-price').value`), '');
    assert.equal(await evaluar(`document.fonts.check('14px Inter')`), true);
    assert.equal(await evaluar(`(()=>{const s=document.querySelector('.home-scroll');s.scrollTop=s.scrollHeight;return document.getElementById('explore-pagination').getBoundingClientRect().bottom<=document.querySelector('.home-bottom').getBoundingClientRect().top;})()`), true);
    await evaluar(`document.querySelector('.home-scroll').scrollTop=0`);
    await evaluar(`window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));document.getElementById('explore-toggle-filters').click()`);
    assert.equal(await evaluar(`document.getElementById('explore-toggle-filters').getAttribute('aria-expanded')`), 'false');
    await evaluar(`document.getElementById('explore-toggle-filters').click()`);
    assert.equal(await evaluar(`document.getElementById('explore-toggle-filters').getAttribute('aria-expanded')`), 'true');
  });
  await t.test('consulta inyectada solo en prueba: IDs, campus, DOM seguro, vacío, error y reintento', async () => {
    await evaluar(`(async()=>{const m=await import('/js/catalogo.js');m.desmontarCatalogo(document.body);window.__prueba={llamadas:[],respuesta:'datos'};m.montarCatalogo({raiz:document.body,modo:'prueba',opciones:${JSON.stringify(opcionesPrueba())},detalle:{habilitado:true,parametro:'articuloPrueba'},adaptarFiltros:f=>({soloFixture:f}),adaptarArticulo:${adaptarRegistroPrueba.toString()},consultarCatalogo:async(f,{signal})=>{window.__prueba.llamadas.push(f);await new Promise(r=>setTimeout(r,40));if(window.__prueba.respuesta==='error')return {ok:false,datos:null,error:{codigo:'RED',mensaje:'NO_REFLEJAR'}};return {ok:true,datos:window.__prueba.respuesta==='vacio'?[]:${JSON.stringify(registrosPrueba())},error:null};}});})()`);
    await evaluar(`const u=document.getElementById('explore-university');u.value=${JSON.stringify(opcionesPrueba().universidades[0].id)};u.dispatchEvent(new Event('change',{bubbles:true}));`);
    assert.equal(await evaluar(`document.getElementById('explore-campus').options.length`), 2);
    await evaluar(`document.getElementById('explore-apply').click()`);
    assert.equal(await evaluar(`document.getElementById('explore-results').getAttribute('aria-busy')`), 'true');
    await esperar(`document.getElementById('explore-notice').dataset.estado==='listo'`);
    assert.equal(await evaluar(`document.querySelectorAll('#explore-live-products article').length`), 2);
    assert.equal(await evaluar(`document.querySelectorAll('#explore-live-products h3 img').length`), 0);
    assert.ok((await evaluar(`document.querySelector('#explore-live-products a').getAttribute('href')`)).includes(registrosPrueba()[0].claveSoloPrueba));
    assert.equal(await evaluar(`document.getElementById('explore-demo-products').hidden`), true);
    await evaluar(`window.__prueba.respuesta='vacio';document.getElementById('explore-apply').click()`);
    await esperar(`document.getElementById('explore-notice').dataset.estado==='vacio'`);
    assert.equal(await evaluar(`document.querySelectorAll('#explore-live-products article').length`), 0);
    await evaluar(`window.__prueba.respuesta='error';document.getElementById('explore-apply').click()`);
    await esperar(`document.getElementById('explore-notice').dataset.estado==='error'`);
    assert.equal(await evaluar(`document.getElementById('explore-retry').hidden`), false);
    assert.equal(await evaluar(`document.getElementById('explore-status').textContent.includes('NO_REFLEJAR')`), false);
    await evaluar(`window.__prueba.respuesta='datos';document.getElementById('explore-retry').click()`);
    await esperar(`document.getElementById('explore-notice').dataset.estado==='listo'`);
    const llamadasAntes = await evaluar('window.__prueba.llamadas.length');
    await evaluar(`window.dispatchEvent(new PageTransitionEvent('pagehide'));document.getElementById('explore-apply').click()`);
    assert.equal(await evaluar('window.__prueba.llamadas.length'), llamadasAntes);
  });
  for (const ancho of [320, 390, 768, 1024, 1280, 1440, 1920]) {
    await t.test(`visibilidad CSS efectiva en todos los estados a ${ancho}px`, async () => {
      await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
      await navegar('/explorar.html');
      await comprobarVisibilidad('pendiente');
      await evaluar(`document.getElementById('explore-search').value='búsqueda sin servicio';document.getElementById('explore-search').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('explore-apply').click()`);
      await comprobarVisibilidad('pendiente', { paso: 'filtros sin servicio: ocho ejemplos íntegros' });
      // Solo el test inyecta la consulta; la promesa controlada permite observar cargando sin depender de temporizadores.
      await evaluar(`(async()=>{const m=await import('/js/catalogo.js');m.desmontarCatalogo(document.body);window.__visibilidad={llamadas:0};m.montarCatalogo({raiz:document.body,modo:'prueba',opciones:${JSON.stringify(opcionesPrueba())},adaptarFiltros:f=>({soloFixture:f}),adaptarArticulo:${adaptarRegistroPrueba.toString()},consultarCatalogo:()=>{window.__visibilidad.llamadas++;return new Promise(resolve=>{window.__visibilidad.resolver=resolve;});}});})()`);
      const completar = async (respuesta, estado) => {
        await evaluar(`window.__visibilidad.resolver(${JSON.stringify(respuesta)})`);
        await esperar(`document.getElementById('explore-notice').dataset.estado===${JSON.stringify(estado)}`);
      };
      const exito = { ok: true, datos: registrosPrueba(), error: null };
      await evaluar(`document.getElementById('explore-apply').click()`);
      await comprobarVisibilidad('cargando');
      await completar(exito, 'listo'); await comprobarVisibilidad('listo');
      await evaluar(`document.getElementById('explore-apply').click()`);
      await comprobarVisibilidad('cargando', { paso: 'cargando después de resultados' });
      await completar({ ok: true, datos: [], error: null }, 'vacio'); await comprobarVisibilidad('vacio');
      await evaluar(`document.getElementById('explore-apply').click()`);
      await comprobarVisibilidad('cargando', { paso: 'cargando después de vacío' });
      await completar({ ok: false, datos: null, error: { codigo: 'RED', mensaje: 'NO_REFLEJAR' } }, 'error');
      await comprobarVisibilidad('error', { reintento: true, paso: 'error de consulta' });
      const consultas = await evaluar('window.__visibilidad.llamadas');
      await evaluar(`document.getElementById('explore-retry').click()`);
      await comprobarVisibilidad('cargando', { paso: 'reintento en curso' });
      assert.equal(await evaluar('window.__visibilidad.llamadas'), consultas + 1);
      await completar(exito, 'listo'); await comprobarVisibilidad('listo', { paso: 'reintento correcto' });
      const consultasAntesDeValidacion = await evaluar('window.__visibilidad.llamadas');
      await evaluar(`document.getElementById('explore-min-price').value='-1';document.getElementById('explore-apply').click()`);
      await comprobarVisibilidad('error', { paso: 'validación: reintentar oculto' });
      assert.equal(await evaluar('window.__visibilidad.llamadas'), consultasAntesDeValidacion);
    });
  }
  for (const pagina of ['index.html', 'login.html', 'registro.html', 'inicio.html']) {
    for (const ancho of [390, 1440]) await t.test(`regresión ${pagina} a ${ancho}px`, async () => {
      await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
      const geometria = () => evaluar(`JSON.stringify([...document.querySelectorAll('h1,h2,.button,.product-card,.brand,.home-bottom')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.x,r.y,r.width,r.height,s.color,s.backgroundColor,s.fontSize]}))`);
      await navegar('/__baseline__/' + pagina); const antes = await geometria();
      await navegar('/' + pagina); assert.equal(await geometria(), antes);
    });
  }
  assert.deepEqual(excepciones, []); assert.deepEqual(bloqueados, []);
  assert.equal(pedidos.some(p => /articulos\.js|rest\/v1|api\/|supabase|nvidia/i.test(p)), false);
  await writeFile(path.join(evidencias, 'comparacion.json'), JSON.stringify(resultados, null, 2));
  await writeFile(path.join(evidencias, 'visibilidad.json'), JSON.stringify(visibilidades, null, 2));
});
