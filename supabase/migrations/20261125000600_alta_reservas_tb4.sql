-- Alta atomica de reservas. Las transiciones posteriores quedan sin DML cliente.
BEGIN;
CREATE ROLE tb4_creador_reservas NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,tb4_perfiles_privado TO tb4_creador_reservas;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_creador_reservas;

CREATE POLICY reservas_lectura_cuenta_registrada ON public.reservas
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
   (SELECT auth.uid()) IS NOT NULL
   AND ((SELECT auth.jwt() -> 'is_anonymous')='false'::jsonb) IS TRUE
 );

GRANT SELECT (id,vendedor_id,estado,eliminado_en,version,actualizado_en),
      UPDATE (estado,version,actualizado_en) ON public.articulos TO tb4_creador_reservas;
CREATE POLICY articulos_creador_reservas_lectura ON public.articulos FOR SELECT TO tb4_creador_reservas
 USING (eliminado_en IS NULL AND vendedor_id<>(SELECT tb4_perfiles_privado.actor_confirmado()));
CREATE POLICY articulos_creador_reservas_actualizacion ON public.articulos FOR UPDATE TO tb4_creador_reservas
 USING (eliminado_en IS NULL AND vendedor_id<>(SELECT tb4_perfiles_privado.actor_confirmado()))
 WITH CHECK (estado='reservado' AND eliminado_en IS NULL AND vendedor_id<>(SELECT tb4_perfiles_privado.actor_confirmado()));

GRANT INSERT (articulo_id,comprador_id,vendedor_id),
   SELECT (id,articulo_id,comprador_id,vendedor_id,estado,creado_en,actualizado_en,version)
   ON public.reservas TO tb4_creador_reservas;
CREATE POLICY reservas_creador_lectura ON public.reservas FOR SELECT TO tb4_creador_reservas
 USING (comprador_id=(SELECT tb4_perfiles_privado.actor_confirmado()));
CREATE POLICY reservas_creador_alta ON public.reservas FOR INSERT TO tb4_creador_reservas WITH CHECK (
 comprador_id=(SELECT tb4_perfiles_privado.actor_confirmado()) AND comprador_id<>vendedor_id
 AND estado='pendiente' AND conversacion_id IS NULL AND estado_punto='sin_proponer' AND version=1
);

CREATE FUNCTION public.crear_mi_reserva(p_articulo_id uuid,p_version_articulo integer,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 comprador uuid := tb4_perfiles_privado.actor_confirmado();
 articulo record;
 reserva record;
BEGIN
 IF comprador IS NULL OR comprador IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 IF p_articulo_id IS NULL OR p_version_articulo IS NULL OR p_version_articulo < 1 THEN RAISE invalid_parameter_value; END IF;

 -- El mismo bloqueo de fila que usan la edici?n y el retiro de art?culos.
 SELECT a.vendedor_id,a.estado,a.version INTO articulo FROM public.articulos a
 WHERE a.id=p_articulo_id AND a.eliminado_en IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
 IF articulo.estado <> 'disponible' OR articulo.version <> p_version_articulo THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
 END IF;

 UPDATE public.articulos SET estado='reservado',version=version+1,
    actualizado_en=GREATEST(actualizado_en,pg_catalog.clock_timestamp())
 WHERE id=p_articulo_id AND estado='disponible' AND version=p_version_articulo;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;

 -- El ?ndice parcial de las primeras migraciones protege incluso frente a
 -- una inconsistencia previa. Si falla la inserci?n, se revierte el UPDATE.
 INSERT INTO public.reservas(articulo_id,comprador_id,vendedor_id)
 VALUES(p_articulo_id,comprador,articulo.vendedor_id)
 RETURNING id,articulo_id,comprador_id,vendedor_id,estado,creado_en,actualizado_en,version INTO reserva;
 RETURN pg_catalog.jsonb_build_object('id',reserva.id,'articuloId',reserva.articulo_id,
   'compradorId',reserva.comprador_id,'vendedorId',reserva.vendedor_id,'estado',reserva.estado,
   'creadoEn',reserva.creado_en,'actualizadoEn',reserva.actualizado_en,'version',reserva.version);
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
END;
$f$;

DO $acl$
DECLARE firma regprocedure := 'public.crear_mi_reserva(uuid,integer,uuid)'::regprocedure;
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
GRANT EXECUTE ON FUNCTION public.crear_mi_reserva(uuid,integer,uuid) TO authenticated;
GRANT tb4_creador_reservas TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_creador_reservas;
ALTER FUNCTION public.crear_mi_reserva(uuid,integer,uuid) OWNER TO tb4_creador_reservas;
REVOKE CREATE ON SCHEMA public FROM tb4_creador_reservas;
REVOKE tb4_creador_reservas FROM CURRENT_USER;
COMMIT;
