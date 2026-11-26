-- Solo PostgreSQL desechable.
BEGIN;
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000000091',now()),('00000000-0000-4000-8000-000000000092',now());
INSERT INTO public.articulos(id,vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
 imagen_bucket,imagen_ruta,imagen_url,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
SELECT id::uuid,'00000000-0000-4000-8000-000000000091','Titulo','Descripcion',
'7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,'82d7186a-920c-49e2-bcc5-9aaa03ad655e',
'articulos','00000000-0000-4000-8000-000000000091/'||id||'.jpg','https://example.invalid/foto.jpg','image/jpeg',100,100,100
FROM unnest(ARRAY['00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000094',
 '00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000096']) id;
SET LOCAL ROLE authenticated;
DO $prueba$
DECLARE
 vendedor uuid := '00000000-0000-4000-8000-000000000091';
 comprador uuid := '00000000-0000-4000-8000-000000000092';
 a uuid := '00000000-0000-4000-8000-000000000093';
 b uuid := '00000000-0000-4000-8000-000000000094';
 c uuid := '00000000-0000-4000-8000-000000000095';
 d uuid := '00000000-0000-4000-8000-000000000096';
 r uuid; rechazar uuid; cancelar uuid; cal jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'is_anonymous',false)::text,true);
 r:=(public.crear_mi_reserva(a,1,comprador)->>'id')::uuid;
 rechazar:=(public.crear_mi_reserva(b,1,comprador)->>'id')::uuid;
 cancelar:=(public.crear_mi_reserva(c,1,comprador)->>'id')::uuid;
 PERFORM public.crear_mi_reserva(d,1,comprador);
 BEGIN
   PERFORM public.gestionar_mi_reserva(r,1,'confirmar',comprador);
   RAISE EXCEPTION 'Comprador confirmo';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.calificar_mi_intercambio(r,5,NULL,comprador);
   RAISE EXCEPTION 'Calificacion anticipada';
 EXCEPTION WHEN SQLSTATE 'PT404' THEN NULL;
 END;
 IF public.gestionar_mi_reserva(cancelar,1,'cancelar',comprador)->>'motivoCierre'<>'cancelada' THEN RAISE EXCEPTION 'Cancelacion'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',vendedor,'is_anonymous',false)::text,true);
 IF public.gestionar_mi_reserva(rechazar,1,'rechazar',vendedor)->>'motivoCierre'<>'rechazada' THEN RAISE EXCEPTION 'Rechazo'; END IF;
 IF public.gestionar_mi_reserva(r,1,'confirmar',vendedor)->>'estado'<>'confirmada' THEN RAISE EXCEPTION 'Confirmacion'; END IF;
 IF public.gestionar_mi_reserva(r,2,'confirmar_intercambio',vendedor)->>'estado'<>'confirmada' THEN RAISE EXCEPTION 'Cierre unilateral'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.gestionar_mi_reserva(r,2,'confirmar_intercambio',comprador);
   RAISE EXCEPTION 'Version obsoleta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 IF public.gestionar_mi_reserva(r,3,'confirmar_intercambio',comprador)->>'estado'<>'completada' THEN RAISE EXCEPTION 'Cierre bilateral'; END IF;
 IF public.gestionar_mi_reserva(r,3,'confirmar_intercambio',comprador)->>'estado'<>'completada' THEN RAISE EXCEPTION 'Reintento de cierre'; END IF;
 cal:=public.calificar_mi_intercambio(r,5,NULL,comprador);
 IF cal IS DISTINCT FROM public.calificar_mi_intercambio(r,5,NULL,comprador) OR cal->>'destinatarioId'<>vendedor::text THEN
  RAISE EXCEPTION 'Calificacion idempotente';
 END IF;
 BEGIN
   PERFORM public.calificar_mi_intercambio(r,4,NULL,comprador);
   RAISE EXCEPTION 'Calificacion modificable';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',vendedor,'is_anonymous',false)::text,true);
 PERFORM public.calificar_mi_intercambio(r,4,'Prueba',vendedor);
END;
$prueba$;
RESET ROLE;
UPDATE public.reservas SET creado_en=clock_timestamp()-interval '49 hours'
 WHERE articulo_id='00000000-0000-4000-8000-000000000096';
DO $exp$
BEGIN
 IF tb4_reservas_privado.expirar_pendientes()<>1 OR tb4_reservas_privado.expirar_pendientes()<>0 THEN RAISE EXCEPTION 'Expiracion'; END IF;
 IF (SELECT count(*) FROM public.articulos WHERE id IN ('00000000-0000-4000-8000-000000000094',
 '00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000096') AND estado='disponible')<>3
  OR NOT EXISTS (SELECT FROM public.articulos WHERE id='00000000-0000-4000-8000-000000000093' AND estado='vendido')
 THEN RAISE EXCEPTION 'Estado de articulo'; END IF;
 IF (SELECT count(*) FROM tb4_reservas_privado.calificaciones)<>2 THEN RAISE EXCEPTION 'Calificaciones'; END IF;
END;
$exp$;
ROLLBACK;
