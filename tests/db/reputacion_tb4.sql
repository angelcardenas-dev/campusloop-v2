-- Solo PostgreSQL desechable con las 18 migraciones instaladas. La transacción no persiste datos.
BEGIN;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.consultar_reputacion_tb4(uuid)','EXECUTE')
  OR has_function_privilege('anon','public.consultar_mis_evaluaciones_tb4(integer)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.consultar_reputacion_tb4(uuid)','EXECUTE')
  OR has_table_privilege('authenticated','tb4_reservas_privado.calificaciones','SELECT')
  OR (SELECT rolcanlogin OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname='tb4_lector_reputacion')
 THEN RAISE EXCEPTION 'ACL de reputación incorrecta'; END IF;
END;
$acl$;
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-0000000000a1',now()),
 ('00000000-0000-4000-8000-0000000000a2',now()),
 ('00000000-0000-4000-8000-0000000000a3',now());
INSERT INTO public.articulos(id,vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
 imagen_bucket,imagen_ruta,imagen_url,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
VALUES ('00000000-0000-4000-8000-0000000000a4','00000000-0000-4000-8000-0000000000a2',
 'Demostración','Intercambio de prueba','7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,
 '82d7186a-920c-49e2-bcc5-9aaa03ad655e','articulos',
 '00000000-0000-4000-8000-0000000000a2/foto.jpg','https://example.invalid/foto.jpg','image/jpeg',100,100,100);
INSERT INTO public.reservas(id,articulo_id,comprador_id,vendedor_id,estado,confirmada_compra_en,confirmada_venta_en)
VALUES ('00000000-0000-4000-8000-0000000000a5','00000000-0000-4000-8000-0000000000a4',
 '00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000a2',
 'completada',now(),now());
INSERT INTO tb4_reservas_privado.calificaciones(reserva_id,autor_id,destinatario_id,estrellas,comentario)
VALUES ('00000000-0000-4000-8000-0000000000a5','00000000-0000-4000-8000-0000000000a2',
 '00000000-0000-4000-8000-0000000000a1',4,'comentario privado');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-0000000000a1","is_anonymous":false}',true);
DO $prueba$
DECLARE r jsonb;
BEGIN
 r:=public.consultar_reputacion_tb4('00000000-0000-4000-8000-0000000000a1');
 IF r->'comprador'->>'cantidad'<>'1' OR r->'comprador'->>'promedio'<>'4.00'
  OR r->'vendedor'->>'cantidad'<>'0' OR r->'vendedor'->'promedio'<>'null'::jsonb
  OR pg_catalog.jsonb_array_length(public.consultar_mis_evaluaciones_tb4(50))<>1 THEN
  RAISE EXCEPTION 'Agregado o evaluación propia incorrectos';
 END IF;
 PERFORM set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","is_anonymous":false}',true);
 r:=public.consultar_reputacion_tb4('00000000-0000-4000-8000-0000000000a1');
 IF r::text LIKE '%comentario privado%' OR public.consultar_mis_evaluaciones_tb4(50)<>'[]'::jsonb
  OR public.consultar_reputacion_tb4('00000000-0000-4000-8000-0000000000a3')->'comprador'->>'cantidad'<>'0' THEN
  RAISE EXCEPTION 'Tercero obtuvo comentario o evaluación ajena';
 END IF;
 PERFORM set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","is_anonymous":true}',true);
 BEGIN
  PERFORM public.consultar_reputacion_tb4('00000000-0000-4000-8000-0000000000a1');
  RAISE EXCEPTION 'Anonymous Sign-In obtuvo reputación';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$prueba$;
ROLLBACK;
