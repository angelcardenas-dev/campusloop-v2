BEGIN;
CREATE ROLE tb4_calificador NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,tb4_perfiles_privado,tb4_reservas_privado TO tb4_calificador;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_calificador;
GRANT SELECT (id,comprador_id,vendedor_id,estado,confirmada_compra_en,confirmada_venta_en) ON public.reservas TO tb4_calificador;
CREATE POLICY reservas_calificador_lectura ON public.reservas FOR SELECT TO tb4_calificador
 USING ((SELECT tb4_perfiles_privado.actor_confirmado()) IN (comprador_id,vendedor_id));

CREATE TABLE tb4_reservas_privado.calificaciones (
 reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE RESTRICT,
 autor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
 destinatario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
 estrellas smallint NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
 comentario text CHECK (char_length(comentario) <= 1000),
 creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (reserva_id,autor_id),
 CHECK (autor_id<>destinatario_id)
);
ALTER TABLE tb4_reservas_privado.calificaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tb4_reservas_privado.calificaciones FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT(reserva_id,autor_id,destinatario_id,estrellas,comentario)
 ON tb4_reservas_privado.calificaciones TO tb4_calificador;
CREATE POLICY calificaciones_autor_archivo ON tb4_reservas_privado.calificaciones FOR SELECT TO tb4_calificador
 USING (autor_id=(SELECT tb4_perfiles_privado.actor_confirmado()));
CREATE POLICY calificaciones_autor_alta ON tb4_reservas_privado.calificaciones FOR INSERT TO tb4_calificador
 WITH CHECK (autor_id=(SELECT tb4_perfiles_privado.actor_confirmado()) AND EXISTS(
  SELECT FROM public.reservas r WHERE r.id=reserva_id AND r.estado='completada'
  AND r.confirmada_compra_en IS NOT NULL AND r.confirmada_venta_en IS NOT NULL
  AND ((r.comprador_id=autor_id AND r.vendedor_id=destinatario_id)
    OR (r.vendedor_id=autor_id AND r.comprador_id=destinatario_id))
 ));

CREATE FUNCTION public.calificar_mi_intercambio(p_reserva_id uuid,p_estrellas integer,p_comentario text,p_actor_esperado uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 actor uuid := tb4_perfiles_privado.actor_confirmado();
 otro uuid;
 comentario_normalizado text := nullif(pg_catalog.btrim(p_comentario),'');
 fila record;
BEGIN
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN RAISE insufficient_privilege; END IF;
 IF p_reserva_id IS NULL OR p_estrellas IS NULL OR p_estrellas NOT BETWEEN 1 AND 5
   OR char_length(comentario_normalizado)>1000 THEN RAISE invalid_parameter_value; END IF;
 SELECT CASE WHEN comprador_id=actor THEN vendedor_id ELSE comprador_id END INTO otro
 FROM public.reservas WHERE id=p_reserva_id AND estado='completada'
  AND confirmada_compra_en IS NOT NULL AND confirmada_venta_en IS NOT NULL
  AND actor IN(comprador_id,vendedor_id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='NO_ENCONTRADO'; END IF;
 INSERT INTO tb4_reservas_privado.calificaciones(reserva_id,autor_id,destinatario_id,estrellas,comentario)
 VALUES(p_reserva_id,actor,otro,p_estrellas,comentario_normalizado)
 ON CONFLICT(reserva_id,autor_id) DO NOTHING RETURNING estrellas,comentario,creada_en INTO fila;
 IF NOT FOUND THEN
  SELECT estrellas,comentario,creada_en INTO fila FROM tb4_reservas_privado.calificaciones
    WHERE reserva_id=p_reserva_id AND autor_id=actor;
  IF NOT FOUND OR fila.estrellas<>p_estrellas OR fila.comentario IS DISTINCT FROM comentario_normalizado THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CONFLICTO';
  END IF;
 END IF;
 RETURN pg_catalog.jsonb_build_object('reservaId',p_reserva_id,'autorId',actor,'destinatarioId',otro,
   'estrellas',fila.estrellas,'comentario',fila.comentario,'creadaEn',fila.creada_en);
END;
$f$;
REVOKE ALL ON FUNCTION public.calificar_mi_intercambio(uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF pg_catalog.to_regrole('service_role') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.calificar_mi_intercambio(uuid,integer,text,uuid) FROM service_role;
 END IF;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.calificar_mi_intercambio(uuid,integer,text,uuid) TO authenticated;
GRANT tb4_calificador TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_calificador;
ALTER FUNCTION public.calificar_mi_intercambio(uuid,integer,text,uuid) OWNER TO tb4_calificador;
REVOKE CREATE ON SCHEMA public FROM tb4_calificador;
REVOKE tb4_calificador FROM CURRENT_USER;
COMMIT;
