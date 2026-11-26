import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { crearHandlerFotos, inspeccionarFoto } from '../../netlify/functions/fotos-tb4.mjs';

const actor = '00000000-0000-4000-8000-000000000031';
const id = '00000000-0000-4000-8000-000000000034';
const ruta = actor + '/foto.png';
const bytes = await sharp({ create: { width: 12, height: 10, channels: 3, background: '#f00' } }).png().toBuffer();
const env = { TB4_FOTOS_HABILITADAS: 'true', TB4_FOTOS_ORIGEN: 'https://app.example.invalid',
  SUPABASE_URL: 'https://db.example.invalid', TB4_STORAGE_SERVICE_KEY: 'admin-simulado', SUPABASE_PUBLISHABLE_KEY: 'publica-simulada' };
const solicitud = (datos) => new Request('https://app.example.invalid/.netlify/functions/fotos-tb4', {
  method: 'POST', headers: { origin: env.TB4_FOTOS_ORIGEN, authorization: 'Bearer cliente-simulado', 'content-type': 'application/json' },
  body: JSON.stringify({ actorEsperado: actor, ...datos }),
});
const auth = async () => ({ ok: true, actor });

test('decodifica la imagen y rechaza un formato disfrazado, truncado o excedido', async () => {
  const r = await inspeccionarFoto(bytes, 'png');
  assert.equal(r.formato, 'image/png');
  assert.equal(r.ancho, 12);
  assert.equal(r.alto, 10);
  assert.equal(r.sha256.length, 64);
  assert.equal(await inspeccionarFoto(bytes, 'jpg'), null);
  assert.equal(await inspeccionarFoto(bytes.subarray(0, 30), 'png'), null);
  assert.equal(await inspeccionarFoto(Buffer.alloc(2097153), 'png'), null);
});

test('registra evidencia calculada desde el objeto y la versión leída', async () => {
  let evidencia;
  const handler = crearHandlerFotos({ env, verificar: auth, fetchImpl: async (url, opciones) => {
    if (url.endsWith('tb4_foto_objeto_verificable')) return Response.json('version-simulada');
    if (url.endsWith('/object/authenticated/articulos/' + ruta)) return new Response(bytes);
    evidencia = JSON.parse(opciones.body);
    return Response.json(true);
  } });
  const r = await handler(solicitud({ accion: 'verificar', ruta, bytes: 1 }));
  assert.equal(r.status, 200);
  assert.equal(evidencia.p_objeto_version, 'version-simulada');
  assert.equal(evidencia.p_bytes, bytes.length);
  assert.equal(evidencia.p_actor, actor);
  assert.equal((await handler(solicitud({ accion: 'verificar', ruta, actorEsperado: id }))).status, 403);
});

test('limita TTL y usa el token del lector para comprobar visibilidad antes y después', async () => {
  const llamadas = [];
  let visible = true;
  const handler = crearHandlerFotos({ env, verificar: auth, fetchImpl: async (url, opciones) => {
    llamadas.push([url, opciones]);
    if (url.includes('/rest/v1/articulos?')) return Response.json(visible
      ? [{ vendedor_id: actor, imagen_bucket: 'articulos', imagen_ruta: ruta, imagen_url: null }] : []);
    if (url.endsWith('tb4_foto_vinculada')) return Response.json(true);
    return Response.json({ signedURL: '/object/sign/articulos/' + ruta + '?token=simulado' });
  } });
  assert.equal((await handler(solicitud({ accion: 'firmar', articuloId: id, ttl: 301 }))).status, 400);
  assert.equal(llamadas.length, 0);
  const r = await handler(solicitud({ accion: 'firmar', articuloId: id }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(JSON.parse(llamadas[2][1].body).expiresIn, 60);
  assert.deepEqual([llamadas[0][1].headers.authorization, llamadas[3][1].headers.authorization],
    ['Bearer cliente-simulado', 'Bearer cliente-simulado']);
  visible = false;
  assert.equal((await handler(solicitud({ accion: 'firmar', articuloId: id }))).status, 404);
});
