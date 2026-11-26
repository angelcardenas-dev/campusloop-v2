import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const fuente = await readFile(new URL('../../js/operaciones-tb4.js', import.meta.url), 'utf8');
const id = '00000000-0000-4000-8000-000000000034';
const vendedor = '00000000-0000-4000-8000-000000000031';
const ruta = vendedor + '/foto.jpg';
const origen = 'https://campusloop.invalid';

async function cargar({ error, foto, url, activo = true } = {}) {
  const llamadas = [];
  const context = createContext({ URL });
  const cliente = {
    async rpc(nombre, parametros) {
      llamadas.push([nombre, { ...parametros }]);
      return error ? { error } : { data: { id } };
    },
    from(tabla) {
      llamadas.push(tabla);
      return {
        select() { return this; },
        eq(columna, valor) { llamadas.push([columna, valor]); return this; },
        async maybeSingle() { return { data: foto }; },
      };
    },
    storage: { from(bucket) {
      return { async createSignedUrl(path, ttl) {
        llamadas.push([bucket, path, ttl]);
        return { data: { signedUrl: url } };
      } };
    } },
  };
  const sdk = new SyntheticModule(['obtenerClienteSupabase'], function () {
    this.setExport('obtenerClienteSupabase', async () => ({ ok: true, datos: cliente }));
  }, { context });
  const config = new SyntheticModule(['validarConfiguracionPublica'], function () {
    this.setExport('validarConfiguracionPublica', () => ({ ok: true, datos: { supabaseUrl: origen } }));
  }, { context });
  const modulo = new SourceTextModule(fuente, { context });
  const perfil = new SyntheticModule(['consultarMiPerfil'], function () {
    this.setExport('consultarMiPerfil', async () => ({ ok: true, datos: { vendedorActivado: activo } }));
  }, { context });
  await modulo.link(nombre => ({
    './supabase-cliente.js': sdk, './config-publica.js': config, './perfiles.js': perfil,
  })[nombre]);
  await modulo.evaluate();
  return { api: modulo.namespace, llamadas };
}

test('la solicitud solo transmite los campos autorizados', async () => {
  const { api, llamadas } = await cargar();
  await api.enviarSolicitudVendedor({
    claveIdempotencia: id, tieneExperiencia: false, aceptaNormas: true,
    normasVersion: 'prueba', vendedorActivado: true, solicitanteId: vendedor,
  }, { actorEsperado: vendedor });
  assert.deepEqual(llamadas, [['enviar_solicitud_vendedor', {
    p_clave_idempotencia: id, p_tiene_experiencia: false, p_acepta_normas: true, p_normas_version: 'prueba', p_actor_esperado: vendedor,
  }]]);
});

test('oculta datos del error y conserva la versión al retirar', async () => {
  const { api, llamadas } = await cargar({ error: { code: 'PT409', message: 'detalle del servidor' } });
  const r = await api.retirarMiArticulo({ id, versionEsperada: 2 }, { actorEsperado: vendedor });
  assert.equal(r.error.codigo, 'CONFLICTO');
  assert.doesNotMatch(r.error.mensaje, /detalle del servidor/);
  assert.deepEqual(llamadas, [['editar_o_retirar_mi_articulo', { p_id: id, p_version: 2, p_retirar: true, p_actor_esperado: vendedor }]]);
});

test('firma solo la ruta de la referencia autorizada y rechaza tokens duplicados', async () => {
  const foto = { vendedor_id: vendedor, imagen_bucket: 'articulos', imagen_ruta: ruta,
    imagen_formato: 'image/jpeg', imagen_bytes: 100, imagen_ancho: 100, imagen_alto: 100 };
  const base = origen + '/storage/v1/object/sign/articulos/' + ruta;
  const valido = await cargar({ foto, url: base + '?token=simulado' });
  assert.equal((await valido.api.resolverFotoPrivada(id)).ok, true);
  assert.deepEqual(valido.llamadas.at(-1), ['articulos', ruta, 60]);
  const invalido = await cargar({ foto, url: base + '?token=uno&token=dos' });
  assert.equal((await invalido.api.resolverFotoPrivada(id)).ok, false);
  const ajena = await cargar({ foto: { ...foto, imagen_ruta: id + '/foto.jpg' }, url: base });
  assert.equal((await ajena.api.resolverFotoPrivada(id)).ok, false);
  assert.equal(ajena.llamadas.length, 2);
});

test('el alta remite una referencia sin URL ni atributos de vendedor', async () => {
  const { api, llamadas } = await cargar();
  const resultado = await api.crearMiArticulo({ claveIdempotencia: id, titulo: 'Título', descripcion: 'Descripción',
    categoriaId: id, condicion: 'nuevo', precioCentimos: 100, campusId: id, vendedorId: vendedor,
    imagen: { proveedor: 'supabase', bucket: 'articulos', ruta, url: 'https://ignorar.invalid', bytes: 999 } }, { actorEsperado: vendedor });
  assert.equal(resultado.ok, true);
  assert.deepEqual(llamadas, [['crear_mi_articulo', { p_clave: id, p_titulo: 'Título', p_descripcion: 'Descripción',
    p_categoria_id: id, p_condicion: 'nuevo', p_precio_centimos: 100, p_campus_id: id, p_ruta: ruta, p_actor_esperado: vendedor }]]);
});
