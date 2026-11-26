BEGIN;
CREATE ROLE tb4_lector_reputacion NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,tb4_perfiles_privado,tb4_reservas_privado TO tb4_lector_reputacion;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_lector_reputacion;
GRANT SELECT (reserva_id,autor_id,destinatario_id,estrellas,comentario,creada_en)
 ON tb4_reservas_privado.calificaciones TO tb4_lector_reputacion;
GRANT SELECT (id,comprador_id,vendedor_id,estado,confirmada_compra_en,confirmada_venta_en)
 ON public.reservas TO tb4_lector_reputacion;
CREATE POLICY calificaciones_lector_reputacion ON tb4_reservas_privado.calificaciones
 FOR SELECT TO tb4_lector_reputacion USING (true);
CREATE POLICY reservas_lector_reputacion ON public.reservas
 FOR SELECT TO tb4_lector_reputacion USING (true);

CREATE FUNCTION public.consultar_reputacion_tb4(p_usuario uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado();
BEGIN
 IF actor IS NULL THEN RAISE insufficient_privilege; END IF;
 IF p_usuario IS NULL THEN RAISE invalid_parameter_value; END IF;
 RETURN (
  WITH validas AS (
   SELECT c.estrellas, r.comprador_id, r.vendedor_id
   FROM tb4_reservas_privado.calificaciones c
   JOIN public.reservas r ON r.id=c.reserva_id
   WHERE c.destinatario_id=p_usuario AND r.estado='completada'
    AND r.confirmada_compra_en IS NOT NULL AND r.confirmada_venta_en IS NOT NULL
    AND ((c.autor_id=r.comprador_id AND c.destinatario_id=r.vendedor_id)
      OR (c.autor_id=r.vendedor_id AND c.destinatario_id=r.comprador_id))
  )
  SELECT pg_catalog.jsonb_build_object('usuarioId',p_usuario,
   'comprador',pg_catalog.jsonb_build_object('cantidad',count(*) FILTER (WHERE comprador_id=p_usuario),
     'promedio',round(avg(estrellas) FILTER (WHERE comprador_id=p_usuario),2)),
   'vendedor',pg_catalog.jsonb_build_object('cantidad',count(*) FILTER (WHERE vendedor_id=p_usuario),
     'promedio',round(avg(estrellas) FILTER (WHERE vendedor_id=p_usuario),2)))
  FROM validas
 );
END;
$f$;

CREATE FUNCTION public.consultar_mis_evaluaciones_tb4(p_limite integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $f$
DECLARE actor uuid := tb4_perfiles_privado.actor_confirmado();
BEGIN
 IF actor IS NULL THEN RAISE insufficient_privilege; END IF;
 IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 50 THEN RAISE invalid_parameter_value; END IF;
 RETURN coalesce((
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'reservaId',e.reserva_id,'autorId',e.autor_id,'destinatarioId',e.destinatario_id,
   'estrellas',e.estrellas,'comentario',e.comentario,'creadaEn',e.creada_en)
   ORDER BY e.creada_en DESC,e.reserva_id DESC,e.autor_id DESC)
  FROM (SELECT c.reserva_id,c.autor_id,c.destinatario_id,c.estrellas,c.comentario,c.creada_en
    FROM tb4_reservas_privado.calificaciones c
    JOIN public.reservas r ON r.id=c.reserva_id
    WHERE actor IN (c.autor_id,c.destinatario_id) AND r.estado='completada'
      AND r.confirmada_compra_en IS NOT NULL AND r.confirmada_venta_en IS NOT NULL
      AND ((c.autor_id=r.comprador_id AND c.destinatario_id=r.vendedor_id)
        OR (c.autor_id=r.vendedor_id AND c.destinatario_id=r.comprador_id))
    ORDER BY c.creada_en DESC,c.reserva_id DESC,c.autor_id DESC LIMIT p_limite) e
 ),'[]'::jsonb);
END;
$f$;

REVOKE ALL ON FUNCTION public.consultar_reputacion_tb4(uuid),
 public.consultar_mis_evaluaciones_tb4(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_reputacion_tb4(uuid),
 public.consultar_mis_evaluaciones_tb4(integer) TO authenticated;
GRANT tb4_lector_reputacion TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_lector_reputacion;
ALTER FUNCTION public.consultar_reputacion_tb4(uuid) OWNER TO tb4_lector_reputacion;
ALTER FUNCTION public.consultar_mis_evaluaciones_tb4(integer) OWNER TO tb4_lector_reputacion;
REVOKE CREATE ON SCHEMA public FROM tb4_lector_reputacion;
REVOKE tb4_lector_reputacion FROM CURRENT_USER;
COMMIT;
