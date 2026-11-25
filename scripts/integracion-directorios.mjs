import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const clave = process.env.TB4_PUBLISHABLE_KEY?.trim();
if (!/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(clave ?? '')) {
  console.error('Define TB4_PUBLISHABLE_KEY con la clave publicable del proyecto.');
  process.exit(1);
}

const archivos = new Map(await Promise.all([
  '/js/directorios.js',
  '/js/supabase-cliente.js',
  '/js/config-publica-original.js',
  '/scripts/integracion-directorios-navegador.mjs',
].map(async ruta => [
  ruta,
  await readFile(new URL('..' + ruta.replace('/config-publica-original.js', '/config-publica.js'), import.meta.url)),
])));

const rutaPrueba = '/' + randomUUID();
const configuracion = JSON.stringify({
  supabaseUrl: 'https://xxatvftmozlpqehhvgpv.supabase.co',
  supabasePublishableKey: clave,
});
archivos.set('/js/config-publica.js', `
  import { CONFIGURACION_PUBLICA as base } from './config-publica-original.js';
  export { validarConfiguracionPublica } from './config-publica-original.js';
  export const CONFIGURACION_PUBLICA = Object.freeze({ ...base, ...${configuracion} });
`);

const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.headers.host !== `127.0.0.1:${server.address().port}`) {
    res.writeHead(403).end();
    return;
  }
  if (req.method === 'GET' && req.url === rutaPrueba) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`
      <!doctype html><html lang="es"><meta charset="utf-8">
      <title>Integración de directorios TB4</title>
      <pre id="resultado">Consultando Supabase…</pre>
      <script type="module" src="${rutaPrueba}/scripts/integracion-directorios-navegador.mjs"></script>`);
    return;
  }
  const archivo = req.url.startsWith(rutaPrueba + '/') && archivos.get(req.url.slice(rutaPrueba.length));
  if (req.method === 'GET' && archivo) {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(archivo);
    return;
  }
  if (req.method === 'POST' && [rutaPrueba + '/ok', rutaPrueba + '/fallo'].includes(req.url)) {
    const ok = req.url.endsWith('/ok');
    process.exitCode = ok ? 0 : 1;
    console.log(ok ? 'OK integración real de directorios sin sesión' : 'Falló la integración. Revisa el resultado en la pestaña.');
    res.writeHead(204).end();
    cerrar();
    return;
  }
  res.writeHead(404).end();
});

function cerrar() {
  clearTimeout(limite);
  server.close();
}

const limite = setTimeout(() => {
  console.error('Se agotó el tiempo sin resultado del navegador.');
  process.exitCode = 1;
  cerrar();
}, 180_000);

server.listen(0, '127.0.0.1', () => {
  console.log(`Abre http://127.0.0.1:${server.address().port}${rutaPrueba} en una ventana privada.`);
});
