BEGIN;
GRANT SELECT (campus_id) ON public.articulos TO tb4_gestor_reservas;
GRANT SELECT (lugar_publico_id,estado_punto,punto_propuesto_por),
 UPDATE (lugar_publico_id,estado_punto,punto_propuesto_por) ON public.reservas TO tb4_gestor_reservas;
-- El estado pendiente debe mantenerse al acordar el punto.
ALTER POLICY reservas_gestor_cambio ON public.reservas
 WITH CHECK (estado IN ('pendiente','confirmada','cancelada','completada'));
GRANT SELECT (id,campus_id,activo),UPDATE(id) ON public.lugares_publicos TO tb4_gestor_reservas;
CREATE POLICY lugares_gestor_reservas_lectura ON public.lugares_publicos
 FOR SELECT TO tb4_gestor_reservas USING (activo);
CREATE POLICY lugares_gestor_reservas_bloqueo ON public.lugares_publicos
 FOR UPDATE TO tb4_gestor_reservas USING (activo) WITH CHECK (false);

CREATE FUNCTION public.acordar_lugar_mi_reserva(p_id uuid,p_version integer,p_lugar_id uuid,p_aceptar boolean,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid:=tb4_perfiles_privado.actor_confirmado();
 articulo uuid;
 campus uuid;
 r record;
 estado_nuevo text;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 IF p_id IS NULL OR p_lugar_id IS NULL OR p_version IS NULL OR p_version<1 OR p_aceptar IS NULL THEN RAISE invalid_parameter_value; END IF;
 SELECT articulo_id INTO articulo FROM public.reservas WHERE id=p_id AND actor IN(comprador_id,vendedor_id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
 SELECT campus_id INTO campus FROM public.articulos WHERE id=articulo FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
 SELECT estado,version,creado_en,lugar_publico_id,estado_punto,punto_propuesto_por
   INTO STRICT r FROM public.reservas WHERE id=p_id;
 IF p_aceptar AND actor=r.punto_propuesto_por THEN RAISE insufficient_privilege; END IF;
 IF (p_aceptar AND r.estado_punto='aceptado' AND r.lugar_publico_id=p_lugar_id)
    OR (NOT p_aceptar AND r.estado_punto='propuesto' AND r.lugar_publico_id=p_lugar_id AND r.punto_propuesto_por=actor) THEN
  RETURN pg_catalog.jsonb_build_object('id',p_id,'version',r.version,'lugarId',p_lugar_id,'estadoPunto',r.estado_punto);
 END IF;
 IF r.version<>p_version OR r.estado NOT IN ('pendiente','confirmada')
    OR (r.estado='pendiente' AND r.creado_en+interval '48 hours'<=clock_timestamp())
    OR (p_aceptar AND (r.estado_punto<>'propuesto' OR r.lugar_publico_id IS DISTINCT FROM p_lugar_id))
    OR (NOT p_aceptar AND r.estado_punto<>'sin_proponer') THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
 END IF;
 PERFORM FROM public.lugares_publicos WHERE id=p_lugar_id AND activo
   AND (campus_id=campus OR campus_id IS NULL) FOR SHARE;
 IF NOT FOUND THEN RAISE invalid_parameter_value; END IF;
 estado_nuevo:=CASE WHEN p_aceptar THEN 'aceptado' ELSE 'propuesto' END;
 UPDATE public.reservas SET lugar_publico_id=p_lugar_id,estado_punto=estado_nuevo,
   punto_propuesto_por=CASE WHEN p_aceptar THEN r.punto_propuesto_por ELSE actor END,
   version=version+1,actualizado_en=GREATEST(actualizado_en,clock_timestamp()) WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
 RETURN pg_catalog.jsonb_build_object('id',p_id,'version',p_version+1,'lugarId',p_lugar_id,'estadoPunto',estado_nuevo);
END;
$f$;
REVOKE ALL ON FUNCTION public.acordar_lugar_mi_reserva(uuid,integer,uuid,boolean,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.acordar_lugar_mi_reserva(uuid,integer,uuid,boolean,uuid) TO authenticated;
GRANT tb4_gestor_reservas TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_gestor_reservas;
ALTER FUNCTION public.acordar_lugar_mi_reserva(uuid,integer,uuid,boolean,uuid) OWNER TO tb4_gestor_reservas;
REVOKE CREATE ON SCHEMA public FROM tb4_gestor_reservas;
REVOKE tb4_gestor_reservas FROM CURRENT_USER;
COMMIT;
