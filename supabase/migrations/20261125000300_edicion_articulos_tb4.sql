-- TB4: editar metadatos y retirar publicaciones propias conservando el historial.
BEGIN;
CREATE ROLE tb4_editor_articulos NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public, tb4_perfiles_privado TO tb4_editor_articulos;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_editor_articulos;
GRANT SELECT (id,vendedor_activado) ON public.perfiles TO tb4_editor_articulos;
CREATE POLICY perfiles_editor_articulo_lectura ON public.perfiles FOR SELECT TO tb4_editor_articulos
  USING (id=(SELECT tb4_perfiles_privado.actor_confirmado()));

GRANT SELECT (id,vendedor_id,estado,eliminado_en,version,actualizado_en),
    UPDATE (titulo,descripcion,categoria_id,condicion,precio_centimos,eliminado_en,version,actualizado_en)
    ON public.articulos TO tb4_editor_articulos;
CREATE POLICY articulos_editor_lectura ON public.articulos FOR SELECT TO tb4_editor_articulos
    USING (vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()));
CREATE POLICY articulos_editor_cambios ON public.articulos FOR UPDATE TO tb4_editor_articulos
    USING (vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()) AND eliminado_en IS NULL)
    WITH CHECK (vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()));
GRANT SELECT (articulo_id,vendedor_id,estado) ON public.reservas TO tb4_editor_articulos;
CREATE POLICY reservas_editor_articulo_lectura ON public.reservas FOR SELECT TO tb4_editor_articulos
    USING (vendedor_id=(SELECT tb4_perfiles_privado.actor_confirmado()));
GRANT SELECT (id,activa),UPDATE(id) ON public.categorias TO tb4_editor_articulos;
CREATE POLICY categorias_editor_articulo_lectura ON public.categorias FOR SELECT TO tb4_editor_articulos USING (activa);
CREATE POLICY categorias_editor_articulo_bloqueo ON public.categorias FOR UPDATE TO tb4_editor_articulos USING (activa) WITH CHECK (false);

CREATE FUNCTION public.editar_o_retirar_mi_articulo(
    p_id uuid,p_version integer,p_retirar boolean,p_titulo text DEFAULT NULL,p_descripcion text DEFAULT NULL,
    p_categoria_id uuid DEFAULT NULL,p_condicion text DEFAULT NULL,p_precio_centimos bigint DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE
    actor uuid := tb4_perfiles_privado.actor_confirmado();
    titulo_normalizado text := pg_catalog.btrim(p_titulo);
    descripcion_normalizada text := pg_catalog.btrim(p_descripcion);
    articulo record;
    instante timestamptz;
BEGIN
    IF actor IS NULL OR NOT EXISTS(SELECT FROM public.perfiles WHERE id=actor AND vendedor_activado) THEN
        RAISE insufficient_privilege;
    END IF;
    IF p_id IS NULL OR p_version IS NULL OR p_version < 1 OR p_retirar IS NULL THEN RAISE invalid_parameter_value; END IF;
    IF p_retirar THEN
        IF num_nonnulls(p_titulo,p_descripcion,p_categoria_id,p_condicion,p_precio_centimos)<>0 THEN RAISE invalid_parameter_value; END IF;
    ELSE
        IF titulo_normalizado IS NULL OR char_length(titulo_normalizado) NOT BETWEEN 1 AND 100
          OR p_titulo ~ '[[:cntrl:]]' OR descripcion_normalizada IS NULL
          OR char_length(descripcion_normalizada) NOT BETWEEN 1 AND 1000 OR p_categoria_id IS NULL
          OR p_condicion IS NULL OR p_condicion NOT IN ('nuevo','como_nuevo','buen_estado','usado')
          OR p_precio_centimos IS NULL OR p_precio_centimos NOT BETWEEN 1 AND 9007199254740991 THEN
            RAISE invalid_parameter_value;
        END IF;
        PERFORM FROM public.categorias WHERE id=p_categoria_id AND activa FOR SHARE;
        IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
    END IF;

    SELECT estado,version INTO articulo FROM public.articulos
      WHERE id=p_id AND vendedor_id=actor AND eliminado_en IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
    IF articulo.version<>p_version OR articulo.estado='reservado'
      OR (NOT p_retirar AND articulo.estado<>'disponible')
      OR EXISTS (SELECT FROM public.reservas WHERE articulo_id=p_id AND vendedor_id=actor AND estado IN ('pendiente','confirmada')) THEN
      RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
    END IF;

    instante := pg_catalog.clock_timestamp();
    IF p_retirar THEN
       UPDATE public.articulos SET eliminado_en=GREATEST(actualizado_en,instante),
          actualizado_en=GREATEST(actualizado_en,instante),version=version+1 WHERE id=p_id;
    ELSE
       UPDATE public.articulos SET titulo=titulo_normalizado,descripcion=descripcion_normalizada,categoria_id=p_categoria_id,
          condicion=p_condicion,precio_centimos=p_precio_centimos,actualizado_en=GREATEST(actualizado_en,instante),version=version+1
          WHERE id=p_id;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
    RETURN pg_catalog.jsonb_build_object('id',p_id,'version',p_version+1,'retirado',p_retirar);
END;
$f$;

REVOKE ALL ON FUNCTION public.editar_o_retirar_mi_articulo(uuid,integer,boolean,text,text,uuid,text,bigint) FROM PUBLIC;
DO $acl$
DECLARE permiso record;
BEGIN
  FOR permiso IN SELECT r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
    JOIN pg_roles r ON r.oid=a.grantee
    WHERE p.oid='public.editar_o_retirar_mi_articulo(uuid,integer,boolean,text,text,uuid,text,bigint)'::regprocedure AND a.grantee<>p.proowner
  LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.editar_o_retirar_mi_articulo(uuid,integer,boolean,text,text,uuid,text,bigint) FROM %I CASCADE',permiso.rolname);
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.editar_o_retirar_mi_articulo(uuid,integer,boolean,text,text,uuid,text,bigint) TO authenticated;
GRANT tb4_editor_articulos TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_editor_articulos;
ALTER FUNCTION public.editar_o_retirar_mi_articulo(uuid,integer,boolean,text,text,uuid,text,bigint) OWNER TO tb4_editor_articulos;
REVOKE CREATE ON SCHEMA public FROM tb4_editor_articulos;
REVOKE tb4_editor_articulos FROM CURRENT_USER;
COMMIT;
