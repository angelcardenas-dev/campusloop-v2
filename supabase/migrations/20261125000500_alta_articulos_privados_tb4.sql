-- Activar junto al adaptador de cat?logo compatible con referencias privadas.
BEGIN;
ALTER TABLE public.articulos ALTER COLUMN imagen_url DROP NOT NULL;
CREATE TABLE tb4_ventas_privado.fotos_verificadas (
    ruta text PRIMARY KEY,
    vendedor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    formato text NOT NULL,
    bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 2097152),
    ancho integer NOT NULL CHECK (ancho > 0),
    alto integer NOT NULL CHECK (alto > 0),
    objeto_version text NOT NULL CHECK (char_length(objeto_version)>0),
    sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    verificada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    articulo_id uuid UNIQUE REFERENCES public.articulos(id) ON DELETE RESTRICT,
    clave_idempotencia uuid,
    CHECK (char_length(ruta) <= 500 AND split_part(ruta,'/',1)=vendedor_id::text
        AND ruta ~ '^[0-9a-f-]+/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'),
    CHECK ((formato='image/jpeg' AND ruta ~ '\.(jpg|jpeg)$')
        OR (formato='image/png' AND ruta ~ '\.png$') OR (formato='image/webp' AND ruta ~ '\.webp$')),
    CHECK ((articulo_id IS NULL) = (clave_idempotencia IS NULL)),
    UNIQUE (vendedor_id,clave_idempotencia)
);
CREATE TABLE tb4_ventas_privado.fotos_en_limpieza (
 ruta text PRIMARY KEY, excluida_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON tb4_ventas_privado.fotos_en_limpieza FROM PUBLIC,anon,authenticated;
GRANT SELECT ON tb4_ventas_privado.fotos_en_limpieza TO tb4_editor_articulos;
REVOKE ALL ON tb4_ventas_privado.fotos_verificadas FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA tb4_ventas_privado TO tb4_editor_articulos;
GRANT SELECT, UPDATE (articulo_id,clave_idempotencia) ON tb4_ventas_privado.fotos_verificadas TO tb4_editor_articulos;
ALTER TABLE tb4_ventas_privado.fotos_verificadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY fotos_verificadas_editor ON tb4_ventas_privado.fotos_verificadas TO tb4_editor_articulos
  USING (vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()))
  WITH CHECK (vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()));

GRANT INSERT (vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
    imagen_bucket,imagen_ruta,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
    ON public.articulos TO tb4_editor_articulos;
CREATE POLICY articulos_editor_alta ON public.articulos FOR INSERT TO tb4_editor_articulos WITH CHECK (
    vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()) AND estado='disponible' AND eliminado_en IS NULL
    AND EXISTS (SELECT FROM public.perfiles p WHERE p.id=vendedor_id AND p.vendedor_activado)
);
GRANT SELECT (titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,creado_en) ON public.articulos TO tb4_editor_articulos;
GRANT SELECT (id,universidad_id,activo),UPDATE(id) ON public.campus TO tb4_editor_articulos;
GRANT SELECT (id,activa),UPDATE(id) ON public.universidades TO tb4_editor_articulos;
CREATE POLICY campus_editor_articulo_lectura ON public.campus FOR SELECT TO tb4_editor_articulos USING (activo);
CREATE POLICY campus_editor_articulo_bloqueo ON public.campus FOR UPDATE TO tb4_editor_articulos USING (activo) WITH CHECK (false);
CREATE POLICY universidades_editor_articulo_lectura ON public.universidades FOR SELECT TO tb4_editor_articulos USING (activa);
CREATE POLICY universidades_editor_articulo_bloqueo ON public.universidades FOR UPDATE TO tb4_editor_articulos USING (activa) WITH CHECK (false);

CREATE FUNCTION public.crear_mi_articulo(p_clave uuid,p_titulo text,p_descripcion text,p_categoria_id uuid,
  p_condicion text,p_precio_centimos bigint,p_campus_id uuid,p_ruta text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid := tb4_perfiles_privado.actor_confirmado();
 titulo_limpio text := pg_catalog.btrim(p_titulo);
 descripcion_limpia text := pg_catalog.btrim(p_descripcion);
 foto tb4_ventas_privado.fotos_verificadas;
 articulo record;
 universidad uuid;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado OR NOT EXISTS(SELECT FROM public.perfiles WHERE id=actor AND vendedor_activado) THEN
   RAISE insufficient_privilege;
 END IF;
 IF p_clave IS NULL OR p_ruta IS NULL OR char_length(p_ruta)>500 OR p_categoria_id IS NULL OR p_campus_id IS NULL
    OR titulo_limpio IS NULL OR char_length(titulo_limpio) NOT BETWEEN 1 AND 100 OR p_titulo ~ '[[:cntrl:]]'
    OR descripcion_limpia IS NULL OR char_length(descripcion_limpia) NOT BETWEEN 1 AND 1000
    OR p_condicion IS NULL OR p_condicion NOT IN ('nuevo','como_nuevo','buen_estado','usado')
    OR p_precio_centimos IS NULL OR p_precio_centimos NOT BETWEEN 1 AND 9007199254740991 THEN
   RAISE invalid_parameter_value;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ruta,41));
 IF EXISTS(SELECT FROM tb4_ventas_privado.fotos_en_limpieza WHERE ruta=p_ruta) THEN RAISE invalid_parameter_value; END IF;
 SELECT * INTO foto FROM tb4_ventas_privado.fotos_verificadas
    WHERE ruta=p_ruta AND vendedor_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
 IF public.tb4_foto_objeto_verificable(actor,p_ruta) IS DISTINCT FROM foto.objeto_version THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
 END IF;
 IF foto.articulo_id IS NOT NULL THEN
   SELECT id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,version,eliminado_en,estado,creado_en,actualizado_en
     INTO STRICT articulo FROM public.articulos WHERE id=foto.articulo_id;
   IF foto.clave_idempotencia<>p_clave OR articulo.version<>1 OR articulo.eliminado_en IS NOT NULL
      OR (articulo.titulo,articulo.descripcion,articulo.categoria_id,articulo.condicion,articulo.precio_centimos,articulo.campus_id)
         IS DISTINCT FROM (titulo_limpio,descripcion_limpia,p_categoria_id,p_condicion,p_precio_centimos,p_campus_id) THEN
     RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
   END IF;
 ELSE
   SELECT universidad_id INTO universidad FROM public.campus WHERE id=p_campus_id;
   PERFORM FROM public.universidades WHERE id=universidad AND activa FOR SHARE;
   IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
   PERFORM FROM public.campus WHERE id=p_campus_id AND universidad_id=universidad AND activo FOR SHARE;
   IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
   PERFORM FROM public.categorias WHERE id=p_categoria_id AND activa FOR SHARE;
   IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
   INSERT INTO public.articulos(vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
     imagen_bucket,imagen_ruta,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
     VALUES(actor,titulo_limpio,descripcion_limpia,p_categoria_id,p_condicion,p_precio_centimos,p_campus_id,
       'articulos',foto.ruta,foto.formato,foto.bytes,foto.ancho,foto.alto)
     RETURNING id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,version,eliminado_en,estado,creado_en,actualizado_en INTO articulo;
   UPDATE tb4_ventas_privado.fotos_verificadas SET articulo_id=articulo.id,clave_idempotencia=p_clave WHERE ruta=foto.ruta;
 END IF;
 RETURN pg_catalog.jsonb_build_object('id',articulo.id,'version',articulo.version,'vendedorId',actor,
   'titulo',articulo.titulo,'descripcion',articulo.descripcion,'categoriaId',articulo.categoria_id,
   'condicion',articulo.condicion,'precioCentimos',articulo.precio_centimos,'moneda','PEN','campusId',articulo.campus_id,
   'estado',articulo.estado,'creadoEn',articulo.creado_en,'actualizadoEn',articulo.actualizado_en,
   'imagen',pg_catalog.jsonb_build_object('proveedor','supabase','bucket','articulos','ruta',foto.ruta,
     'formato',foto.formato,'bytes',foto.bytes,'ancho',foto.ancho,'alto',foto.alto));
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
END;
$f$;

DO $acl$
DECLARE firma regprocedure := 'public.crear_mi_articulo(uuid,text,text,uuid,text,bigint,uuid,text,uuid)'::regprocedure;
        permiso record;
BEGIN
 EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',firma);
 FOR permiso IN SELECT r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
   JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid=firma AND a.grantee<>p.proowner
 LOOP
   EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM %I CASCADE',firma,permiso.rolname);
 END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.crear_mi_articulo(uuid,text,text,uuid,text,bigint,uuid,text,uuid) TO authenticated;
GRANT tb4_editor_articulos TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_editor_articulos;
ALTER FUNCTION public.crear_mi_articulo(uuid,text,text,uuid,text,bigint,uuid,text,uuid) OWNER TO tb4_editor_articulos;
REVOKE CREATE ON SCHEMA public FROM tb4_editor_articulos;
REVOKE tb4_editor_articulos FROM CURRENT_USER;
COMMIT;
