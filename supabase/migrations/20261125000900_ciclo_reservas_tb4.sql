-- Ciclo aprobado de reservas. Cancelado conserva rechazo y vencimiento como motivos.
BEGIN;
ALTER TABLE public.reservas
 ADD COLUMN motivo_cierre text CHECK (motivo_cierre IN ('rechazada','cancelada','expirada')),
 ADD COLUMN confirmada_compra_en timestamptz,
 ADD COLUMN confirmada_venta_en timestamptz;
ALTER TABLE public.reservas ADD CONSTRAINT reservas_confirmacion_coherente CHECK (
 (estado IN ('confirmada','completada','cancelada') OR
  (confirmada_compra_en IS NULL AND confirmada_venta_en IS NULL))
 AND (estado<>'completada' OR (confirmada_compra_en IS NOT NULL AND confirmada_venta_en IS NOT NULL))
 AND (motivo_cierre IS NULL OR estado='cancelada')
) NOT VALID;
CREATE INDEX reservas_expiracion_tb4 ON public.reservas(creado_en,id) WHERE estado='pendiente';
GRANT SELECT (motivo_cierre,confirmada_compra_en,confirmada_venta_en) ON public.reservas TO authenticated;

CREATE ROLE tb4_gestor_reservas NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA tb4_reservas_privado;
REVOKE ALL ON SCHEMA tb4_reservas_privado FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public,tb4_reservas_privado,tb4_perfiles_privado TO tb4_gestor_reservas;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_gestor_reservas;
GRANT SELECT (id,articulo_id,comprador_id,vendedor_id,estado,version,creado_en,actualizado_en,motivo_cierre,
    confirmada_compra_en,confirmada_venta_en),UPDATE(estado,version,actualizado_en,motivo_cierre,
    confirmada_compra_en,confirmada_venta_en) ON public.reservas TO tb4_gestor_reservas;
GRANT SELECT (id,estado,version,actualizado_en,eliminado_en),UPDATE(estado,version,actualizado_en)
    ON public.articulos TO tb4_gestor_reservas;
CREATE POLICY reservas_gestor_lectura ON public.reservas FOR SELECT TO tb4_gestor_reservas USING (true);
CREATE POLICY reservas_gestor_cambio ON public.reservas FOR UPDATE TO tb4_gestor_reservas
    USING (estado IN ('pendiente','confirmada')) WITH CHECK (estado IN ('confirmada','cancelada','completada'));
CREATE POLICY articulos_gestor_reservas_lectura ON public.articulos FOR SELECT TO tb4_gestor_reservas USING (true);
CREATE POLICY articulos_gestor_reservas_cambio ON public.articulos FOR UPDATE TO tb4_gestor_reservas
    USING (eliminado_en IS NULL) WITH CHECK (estado IN ('disponible','vendido') AND eliminado_en IS NULL);

CREATE FUNCTION public.gestionar_mi_reserva(p_id uuid,p_version integer,p_accion text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid := tb4_perfiles_privado.actor_confirmado();
 r record;
 articulo uuid;
 ahora timestamptz;
 estado_nuevo text;
 motivo text;
 compra timestamptz;
 venta timestamptz;
 repetir boolean;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<1 OR p_accion IS NULL
    OR p_accion NOT IN ('confirmar','rechazar','cancelar','confirmar_intercambio') THEN RAISE invalid_parameter_value; END IF;
 SELECT articulo_id INTO articulo FROM public.reservas
  WHERE id=p_id AND actor IN(comprador_id,vendedor_id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;

 -- Orden global: articulo antes de reserva. La expiracion usa el mismo orden.
 PERFORM FROM public.articulos WHERE id=articulo FOR UPDATE;
 SELECT id,articulo_id,comprador_id,vendedor_id,estado,version,creado_en,actualizado_en,motivo_cierre,
   confirmada_compra_en,confirmada_venta_en INTO STRICT r FROM public.reservas WHERE id=p_id;
 IF p_accion IN ('confirmar','rechazar') AND actor<>r.vendedor_id THEN RAISE insufficient_privilege; END IF;
 repetir := CASE p_accion WHEN 'confirmar' THEN r.estado='confirmada'
   WHEN 'rechazar' THEN r.estado='cancelada' AND r.motivo_cierre='rechazada'
   WHEN 'cancelar' THEN r.estado='cancelada' AND r.motivo_cierre='cancelada'
   ELSE r.estado IN ('confirmada','completada') AND
      CASE WHEN actor=r.comprador_id THEN r.confirmada_compra_en ELSE r.confirmada_venta_en END IS NOT NULL END;
 IF repetir IS NOT TRUE THEN
   IF r.version<>p_version OR r.estado NOT IN ('pendiente','confirmada')
      OR (p_accion IN ('confirmar','rechazar') AND r.estado<>'pendiente')
      OR (p_accion='confirmar_intercambio' AND r.estado<>'confirmada') THEN
       RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
   END IF;
   ahora := pg_catalog.clock_timestamp();
   IF r.estado='pendiente' AND r.creado_en+interval '48 hours'<=ahora THEN
     RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='RESERVA_VENCIDA';
   END IF;
   compra := r.confirmada_compra_en;
   venta := r.confirmada_venta_en;
   CASE p_accion
   WHEN 'confirmar' THEN estado_nuevo:='confirmada';
   WHEN 'rechazar' THEN estado_nuevo:='cancelada'; motivo:='rechazada';
   WHEN 'cancelar' THEN estado_nuevo:='cancelada'; motivo:='cancelada';
   ELSE
     IF actor=r.comprador_id THEN compra:=ahora; ELSE venta:=ahora; END IF;
     estado_nuevo:=CASE WHEN compra IS NOT NULL AND venta IS NOT NULL THEN 'completada' ELSE 'confirmada' END;
   END CASE;
   IF estado_nuevo IN ('cancelada','completada') THEN
      UPDATE public.articulos SET estado=CASE estado_nuevo WHEN 'completada' THEN 'vendido' ELSE 'disponible' END,
         version=version+1,actualizado_en=GREATEST(actualizado_en,ahora)
      WHERE id=articulo AND estado='reservado' AND eliminado_en IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO'; END IF;
   END IF;
   UPDATE public.reservas SET estado=estado_nuevo,version=version+1,actualizado_en=GREATEST(actualizado_en,ahora),
      motivo_cierre=motivo,confirmada_compra_en=compra,confirmada_venta_en=venta WHERE id=p_id
   RETURNING id,articulo_id,comprador_id,vendedor_id,estado,version,creado_en,actualizado_en,motivo_cierre,
      confirmada_compra_en,confirmada_venta_en INTO STRICT r;
 END IF;
 RETURN pg_catalog.jsonb_build_object('id',r.id,'articuloId',r.articulo_id,'compradorId',r.comprador_id,
   'vendedorId',r.vendedor_id,'estado',r.estado,'version',r.version,'creadoEn',r.creado_en,
   'actualizadoEn',r.actualizado_en,'motivoCierre',r.motivo_cierre,
   'confirmadaCompraEn',r.confirmada_compra_en,'confirmadaVentaEn',r.confirmada_venta_en);
END;
$f$;

CREATE FUNCTION tb4_reservas_privado.expirar_pendientes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 fila record;
 ahora timestamptz := pg_catalog.clock_timestamp();
 total integer := 0;
BEGIN
 FOR fila IN SELECT id,articulo_id FROM public.reservas WHERE estado='pendiente'
   AND creado_en<=ahora-interval '48 hours' ORDER BY creado_en,id LIMIT 100
 LOOP
   PERFORM FROM public.articulos WHERE id=fila.articulo_id AND estado='reservado' AND eliminado_en IS NULL
    FOR UPDATE SKIP LOCKED;
   IF NOT FOUND THEN CONTINUE; END IF;
   UPDATE public.reservas SET estado='cancelada',motivo_cierre='expirada',
     version=version+1,actualizado_en=GREATEST(actualizado_en,ahora)
    WHERE id=fila.id AND estado='pendiente' AND creado_en<=ahora-interval '48 hours';
   IF NOT FOUND THEN CONTINUE; END IF;
   UPDATE public.articulos SET estado='disponible',version=version+1,
      actualizado_en=GREATEST(actualizado_en,ahora) WHERE id=fila.articulo_id AND estado='reservado';
   IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo liberar el articulo'; END IF;
   total:=total+1;
 END LOOP;
 RETURN total;
END;
$f$;

REVOKE ALL ON FUNCTION public.gestionar_mi_reserva(uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION tb4_reservas_privado.expirar_pendientes() FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF pg_catalog.to_regrole('service_role') IS NOT NULL THEN
   REVOKE ALL ON FUNCTION public.gestionar_mi_reserva(uuid,integer,text,uuid) FROM service_role;
   REVOKE ALL ON FUNCTION tb4_reservas_privado.expirar_pendientes() FROM service_role;
 END IF;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.gestionar_mi_reserva(uuid,integer,text,uuid) TO authenticated;
GRANT tb4_gestor_reservas TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public,tb4_reservas_privado TO tb4_gestor_reservas;
ALTER FUNCTION public.gestionar_mi_reserva(uuid,integer,text,uuid) OWNER TO tb4_gestor_reservas;
ALTER FUNCTION tb4_reservas_privado.expirar_pendientes() OWNER TO tb4_gestor_reservas;
GRANT EXECUTE ON FUNCTION tb4_reservas_privado.expirar_pendientes() TO CURRENT_USER;
REVOKE CREATE ON SCHEMA public,tb4_reservas_privado FROM tb4_gestor_reservas;
REVOKE tb4_gestor_reservas FROM CURRENT_USER;
COMMIT;
