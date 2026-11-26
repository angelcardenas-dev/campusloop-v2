import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { crearVerificadorAuth } from './lib/agente-auth.mjs';
import { leerCuerpo } from './lib/agente-seguridad.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const FORMATOS = { jpeg: /^jpe?g$/, png: /^png$/, webp: /^webp$/ };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUTA = /^([0-9a-f-]{36})\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/;
const respuesta = (status, datos, codigo) => Response.json(
  { ok: status === 200, datos, error: codigo ? { codigo, mensaje: 'No se pudo completar la operación de fotografía.' } : null },
  { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
);

async function leerBytes(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const bloques = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(bloques, total);
      total += value.byteLength;
      if (total > MAX_BYTES) return null;
      bloques.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function inspeccionarFoto(bytes, extension) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) return null;
  try {
    const imagen = sharp(bytes, { limitInputPixels: 24000000, failOn: 'warning' });
    const m = await imagen.metadata();
    if (!Object.hasOwn(FORMATOS, m.format) || !FORMATOS[m.format].test(extension)
      || (m.pages ?? 1) !== 1 || !Number.isInteger(m.width) || !Number.isInteger(m.height)
      || m.width < 1 || m.height < 1 || m.width * m.height > 24000000) return null;
    await imagen.stats(); // Fuerza la decodificación y rechaza archivos dañados.
    return { formato: 'image/' + m.format, bytes: bytes.length, ancho: m.width, alto: m.height,
      sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch {
    return null;
  }
}

export function crearHandlerFotos({ env = process.env, fetchImpl = fetch,
  verificar = crearVerificadorAuth({ env, fetchImpl }) } = {}) {
  return async request => {
    if (request.method !== 'POST') return respuesta(405, null, 'VALIDACION');
    if (env.TB4_FOTOS_HABILITADAS !== 'true' || !env.TB4_FOTOS_ORIGEN
      || !env.TB4_STORAGE_SERVICE_KEY || !env.SUPABASE_PUBLISHABLE_KEY) return respuesta(503, null, 'CONFIGURACION');
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') || request.headers.has('content-encoding')) return respuesta(400, null, 'VALIDACION');
    if (request.headers.get('origin') !== env.TB4_FOTOS_ORIGEN) return respuesta(403, null, 'NO_AUTORIZADO');
    const token = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return respuesta(401, null, 'NO_AUTORIZADO');
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);

    try {
      const base = new URL(env.SUPABASE_URL);
      if (base.protocol !== 'https:' || base.username || base.password || base.href !== base.origin + '/') {
        return respuesta(503, null, 'CONFIGURACION');
      }
      let entrada;
      try { entrada = JSON.parse(await leerCuerpo(request, 2048, signal)); }
      catch { return respuesta(400, null, 'VALIDACION'); }
      const usuario = await verificar({ token, signal });
      if (!usuario.ok) return respuesta(usuario.codigo === 'NO_AUTORIZADO' ? 403 : 503, null, usuario.codigo);
      if (!entrada || entrada.actorEsperado !== usuario.actor) return respuesta(403, null, 'NO_AUTORIZADO');
      const admin = { apikey: env.TB4_STORAGE_SERVICE_KEY, authorization: 'Bearer ' + env.TB4_STORAGE_SERVICE_KEY };
      const cliente = { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + token };
      const pedir = (ruta, headers, opciones = {}) => fetchImpl(base.origin + ruta,
        { ...opciones, headers, redirect: 'error', signal });
      const post = (ruta, datos) => pedir(ruta, { ...admin, 'content-type': 'application/json' },
        { method: 'POST', body: JSON.stringify(datos) });

      if (entrada.accion === 'verificar') {
        const ruta = typeof entrada.ruta === 'string' && entrada.ruta.length <= 500 ? RUTA.exec(entrada.ruta) : null;
        if (!ruta || ruta[1] !== usuario.actor) return respuesta(400, null, 'VALIDACION');
        const parametros = { p_actor: usuario.actor, p_ruta: entrada.ruta };
        const objeto = await post('/rest/v1/rpc/tb4_foto_objeto_verificable', parametros);
        if (!objeto.ok) return respuesta(502, null, 'SERVIDOR');
        const version = await objeto.json();
        if (typeof version !== 'string' || !version) return respuesta(404, null, 'NO_ENCONTRADO');
        const archivo = await pedir('/storage/v1/object/authenticated/articulos/' + entrada.ruta, admin);
        if (!archivo.ok) return respuesta(404, null, 'NO_ENCONTRADO');
        const datos = await inspeccionarFoto(await leerBytes(archivo), ruta[2]);
        if (!datos) return respuesta(400, null, 'VALIDACION');
        const evidencia = await post('/rest/v1/rpc/tb4_registrar_foto_verificada', {
          ...parametros, p_objeto_version: version, p_sha256: datos.sha256,
          p_formato: datos.formato, p_bytes: datos.bytes, p_ancho: datos.ancho, p_alto: datos.alto,
        });
        if (!evidencia.ok || await evidencia.json() !== true) {
          return respuesta(evidencia.status === 409 ? 409 : 502, null, evidencia.status === 409 ? 'CONFLICTO' : 'SERVIDOR');
        }
        const { formato, bytes, ancho, alto } = datos;
        return respuesta(200, { proveedor: 'supabase', bucket: 'articulos', ruta: entrada.ruta, formato, bytes, ancho, alto });
      }

      const ttl = entrada.ttl ?? 60;
      if (entrada.accion !== 'firmar' || !UUID.test(entrada.articuloId ?? '')
        || !Number.isInteger(ttl) || ttl < 1 || ttl > 300) return respuesta(400, null, 'VALIDACION');
      const filtro = new URLSearchParams({ select: 'vendedor_id,imagen_bucket,imagen_ruta,imagen_url',
        id: 'eq.' + entrada.articuloId, eliminado_en: 'is.null', limit: '1' });
      const leerArticulo = async () => {
        const r = await pedir('/rest/v1/articulos?' + filtro, cliente);
        return r.ok ? (await r.json())?.[0] : null;
      };
      const articulo = await leerArticulo();
      const rutaValidada = RUTA.exec(articulo?.imagen_ruta ?? '');
      if (!rutaValidada || articulo.imagen_bucket !== 'articulos' || articulo.imagen_url !== null
        || rutaValidada[1] !== articulo.vendedor_id) {
        return respuesta(404, null, 'NO_ENCONTRADO');
      }
      const ruta = articulo.imagen_ruta;
      const evidencia = await post('/rest/v1/rpc/tb4_foto_vinculada', {
        p_articulo: entrada.articuloId, p_vendedor: articulo.vendedor_id, p_ruta: ruta,
      });
      if (!evidencia.ok || await evidencia.json() !== true) return respuesta(404, null, 'NO_ENCONTRADO');
      const expiraEn = new Date(Date.now() + ttl * 1000).toISOString();
      const firmada = await post('/storage/v1/object/sign/articulos/' + ruta, { expiresIn: ttl });
      if (!firmada.ok) return respuesta(404, null, 'NO_ENCONTRADO');
      const dato = (await firmada.json())?.signedURL;
      if (typeof dato !== 'string') return respuesta(502, null, 'SERVIDOR');
      const url = new URL(dato.startsWith('/object/') ? '/storage/v1' + dato : dato, base);
      const tokens = url.searchParams.getAll('token');
      if (url.origin !== base.origin || url.username || url.password || url.hash
        || url.pathname !== '/storage/v1/object/sign/articulos/' + ruta || tokens.length !== 1 || !tokens[0]
        || [...url.searchParams.keys()].length !== 1) return respuesta(502, null, 'SERVIDOR');
      const despues = await leerArticulo();
      if (despues?.imagen_ruta !== ruta || despues.imagen_url !== null || despues.imagen_bucket !== 'articulos') {
        return respuesta(404, null, 'NO_ENCONTRADO');
      }
      const vigente = await verificar({ token, signal });
      if (!vigente.ok) return respuesta(vigente.codigo === 'NO_AUTORIZADO' ? 403 : 503, null, vigente.codigo);
      if (vigente.actor !== usuario.actor) return respuesta(403, null, 'NO_AUTORIZADO');
      return respuesta(200, { url: url.href, expiraEn });
    } catch {
      return respuesta(502, null, 'SERVIDOR');
    }
  };
}

export default crearHandlerFotos();
