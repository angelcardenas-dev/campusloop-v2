-- Debe instalarse junto con el lote de alta privada y el verificador de fotos.
BEGIN;
ALTER TABLE tb4_ventas_privado.fotos_verificadas DROP CONSTRAINT fotos_verificadas_articulo_id_key;
CREATE INDEX fotos_verificadas_articulo_idx ON tb4_ventas_privado.fotos_verificadas(articulo_id) WHERE articulo_id IS NOT NULL;
-- Identidad p_actor solo se admite desde el servidor que verifico Auth.
CREATE FUNCTION public.tb4_foto_objeto_verificable(p_actor uuid,p_ruta text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT o.version FROM storage.objects o
 WHERE o.bucket_id='articulos' AND o.name=p_ruta AND o.owner_id=p_actor::text
 AND split_part(o.name,'/',1)=p_actor::text AND o.version IS NOT NULL
 AND EXISTS (SELECT FROM public.perfiles p WHERE p.id=p_actor AND p.vendedor_activado)
 AND NOT EXISTS (SELECT FROM tb4_ventas_privado.fotos_en_limpieza l WHERE l.ruta=p_ruta);
$f$;

CREATE FUNCTION public.tb4_registrar_foto_verificada(p_actor uuid,p_ruta text,p_objeto_version text,p_sha256 text,
 p_formato text,p_bytes integer,p_ancho integer,p_alto integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF p_objeto_version IS NULL OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$' THEN RAISE invalid_parameter_value; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ruta,41));
 IF public.tb4_foto_objeto_verificable(p_actor,p_ruta) IS DISTINCT FROM p_objeto_version THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
 END IF;
 INSERT INTO tb4_ventas_privado.fotos_verificadas(ruta,vendedor_id,formato,bytes,ancho,alto,objeto_version,sha256)
 VALUES(p_ruta,p_actor,p_formato,p_bytes,p_ancho,p_alto,p_objeto_version,p_sha256) ON CONFLICT(ruta) DO NOTHING;
 IF NOT FOUND AND NOT EXISTS(SELECT FROM tb4_ventas_privado.fotos_verificadas f WHERE f.ruta=p_ruta
    AND (f.vendedor_id,f.objeto_version,f.sha256,f.formato,f.bytes,f.ancho,f.alto)
      IS NOT DISTINCT FROM (p_actor,p_objeto_version,p_sha256,p_formato,p_bytes,p_ancho,p_alto)) THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
 END IF;
 RETURN true;
END;
$f$;

CREATE FUNCTION public.tb4_foto_vinculada(p_articulo uuid,p_vendedor uuid,p_ruta text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$
 SELECT EXISTS (
  SELECT FROM tb4_ventas_privado.fotos_verificadas f
  JOIN storage.objects o ON o.bucket_id='articulos' AND o.name=f.ruta
    AND o.owner_id=f.vendedor_id::text AND o.version=f.objeto_version
  WHERE f.articulo_id=p_articulo AND f.vendedor_id=p_vendedor AND f.ruta=p_ruta
    AND NOT EXISTS (SELECT FROM tb4_ventas_privado.fotos_en_limpieza l WHERE l.ruta=f.ruta)
 );
$f$;
REVOKE ALL ON FUNCTION public.tb4_foto_vinculada(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tb4_foto_vinculada(uuid,uuid,text) TO service_role;
GRANT SELECT (imagen_ruta),UPDATE(imagen_bucket,imagen_ruta,imagen_url,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
 ON public.articulos TO tb4_editor_articulos;
CREATE FUNCTION public.reemplazar_mi_foto(p_id uuid,p_version integer,p_clave uuid,p_ruta text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid:=tb4_perfiles_privado.actor_confirmado();
 foto tb4_ventas_privado.fotos_verificadas;
 a record;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado
   OR NOT EXISTS(SELECT FROM public.perfiles WHERE id=actor AND vendedor_activado) THEN RAISE insufficient_privilege; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<1 OR p_clave IS NULL OR p_ruta IS NULL OR char_length(p_ruta)>500 THEN
   RAISE invalid_parameter_value;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ruta,41));
 SELECT * INTO foto FROM tb4_ventas_privado.fotos_verificadas WHERE ruta=p_ruta AND vendedor_id=actor FOR UPDATE;
 IF NOT FOUND OR foto.objeto_version IS NULL OR foto.sha256 IS NULL OR
   EXISTS(SELECT FROM tb4_ventas_privado.fotos_en_limpieza WHERE ruta=p_ruta) THEN RAISE invalid_parameter_value; END IF;
 SELECT imagen_ruta,version,estado INTO a FROM public.articulos WHERE id=p_id AND vendedor_id=actor
   AND eliminado_en IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
 IF foto.articulo_id=p_id AND foto.clave_idempotencia=p_clave AND a.imagen_ruta=p_ruta THEN
    RETURN pg_catalog.jsonb_build_object('id',p_id,'version',a.version,'ruta',p_ruta);
 END IF;
 IF foto.articulo_id IS NOT NULL OR a.version<>p_version OR a.estado<>'disponible'
    OR a.imagen_ruta=p_ruta OR EXISTS(SELECT FROM public.reservas
       WHERE articulo_id=p_id AND estado IN ('pendiente','confirmada')) THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
 END IF;
 UPDATE public.articulos SET imagen_bucket='articulos',imagen_ruta=foto.ruta,imagen_url=NULL,
   imagen_formato=foto.formato,imagen_bytes=foto.bytes,imagen_ancho=foto.ancho,imagen_alto=foto.alto,
   version=version+1,actualizado_en=GREATEST(actualizado_en,clock_timestamp()) WHERE id=p_id;
 UPDATE tb4_ventas_privado.fotos_verificadas SET articulo_id=p_id,clave_idempotencia=p_clave WHERE ruta=p_ruta;
 RETURN pg_catalog.jsonb_build_object('id',p_id,'version',p_version+1,'ruta',p_ruta);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
END;
$f$;
REVOKE ALL ON FUNCTION public.tb4_foto_objeto_verificable(uuid,text),
 public.tb4_registrar_foto_verificada(uuid,text,text,text,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tb4_foto_objeto_verificable(uuid,text),
 public.tb4_registrar_foto_verificada(uuid,text,text,text,text,integer,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.reemplazar_mi_foto(uuid,integer,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reemplazar_mi_foto(uuid,integer,uuid,text,uuid) TO authenticated;
GRANT tb4_editor_articulos TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_editor_articulos;
ALTER FUNCTION public.reemplazar_mi_foto(uuid,integer,uuid,text,uuid) OWNER TO tb4_editor_articulos;
REVOKE CREATE ON SCHEMA public FROM tb4_editor_articulos;
REVOKE tb4_editor_articulos FROM CURRENT_USER;
COMMIT;
