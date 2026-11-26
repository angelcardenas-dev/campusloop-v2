-- Solo PostgreSQL desechable. El ensayo se revierte.
BEGIN;
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000000071',now()),
 ('00000000-0000-4000-8000-000000000072',now()),
 ('00000000-0000-4000-8000-000000000073',now());
INSERT INTO public.articulos(id,vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
 imagen_bucket,imagen_ruta,imagen_url,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
VALUES ('00000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000071','Titulo','Descripcion',
'7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,'82d7186a-920c-49e2-bcc5-9aaa03ad655e',
'articulos','00000000-0000-4000-8000-000000000071/foto.jpg','https://example.invalid/foto.jpg','image/jpeg',100,100,100);

SET LOCAL ROLE authenticated;
DO $prueba$
DECLARE
 vendedor uuid := '00000000-0000-4000-8000-000000000071';
 comprador uuid := '00000000-0000-4000-8000-000000000072';
 otro uuid := '00000000-0000-4000-8000-000000000073';
 articulo uuid := '00000000-0000-4000-8000-000000000074';
 mensaje uuid := '00000000-0000-4000-8000-000000000075';
 mensaje_vendedor uuid := '00000000-0000-4000-8000-000000000076';
 conversacion uuid;
 creada jsonb;
 enviado jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',vendedor,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.iniciar_mi_conversacion(articulo,vendedor);
   RAISE EXCEPTION 'Conversacion propia';
 EXCEPTION WHEN SQLSTATE 'PT404' THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'is_anonymous',false)::text,true);
 creada := public.iniciar_mi_conversacion(articulo,comprador);
 conversacion := (creada->>'id')::uuid;
 IF creada IS DISTINCT FROM public.iniciar_mi_conversacion(articulo,comprador)
    OR creada->>'vendedorId'<>vendedor::text OR creada->>'compradorId'<>comprador::text THEN
   RAISE EXCEPTION 'Participantes o reintento invalidos';
 END IF;
 BEGIN
   PERFORM public.enviar_mi_mensaje(conversacion,mensaje,E'\t\n',comprador);
   RAISE EXCEPTION 'Mensaje vacio';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
   PERFORM public.enviar_mi_mensaje(conversacion,mensaje,repeat('x',1001),comprador);
   RAISE EXCEPTION 'Mensaje demasiado largo';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 enviado := public.enviar_mi_mensaje(conversacion,mensaje,'  Hola  ',comprador);
 IF enviado IS DISTINCT FROM public.enviar_mi_mensaje(conversacion,mensaje,'Hola',comprador)
    OR enviado->>'remitenteId'<>comprador::text OR enviado->>'texto'<>'Hola' THEN
   RAISE EXCEPTION 'Envio no idempotente';
 END IF;
 BEGIN
   PERFORM public.enviar_mi_mensaje(conversacion,mensaje,'Alterado',comprador);
   RAISE EXCEPTION 'Reintento alterado';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 BEGIN
   UPDATE public.conversaciones SET comprador_id=otro WHERE id=conversacion;
   RAISE EXCEPTION 'Participantes mutables';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO public.mensajes(conversacion_id,remitente_id,texto) VALUES(conversacion,comprador,'directo');
   RAISE EXCEPTION 'Escritura directa';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',otro,'is_anonymous',false)::text,true);
 IF EXISTS(SELECT FROM public.conversaciones WHERE id=conversacion)
   OR EXISTS(SELECT FROM public.mensajes WHERE id=mensaje) THEN RAISE EXCEPTION 'Lectura cruzada'; END IF;
 BEGIN
   PERFORM public.enviar_mi_mensaje(conversacion,mensaje_vendedor,'Ajeno',otro);
   RAISE EXCEPTION 'Envio ajeno';
 EXCEPTION WHEN SQLSTATE 'PT404' THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',vendedor,'is_anonymous',false)::text,true);
 IF NOT EXISTS(SELECT FROM public.mensajes WHERE id=mensaje) THEN RAISE EXCEPTION 'Vendedor no puede leer'; END IF;
 BEGIN
   PERFORM public.enviar_mi_mensaje(conversacion,mensaje_vendedor,'Suplantado',comprador);
   RAISE EXCEPTION 'Identidad suplantada';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM public.enviar_mi_mensaje(conversacion,mensaje_vendedor,'Respuesta',vendedor);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'is_anonymous',true)::text,true);
 IF EXISTS(SELECT FROM public.conversaciones WHERE id=conversacion)
   OR EXISTS(SELECT FROM public.mensajes WHERE id=mensaje) THEN RAISE EXCEPTION 'Lectura anonima'; END IF;
END;
$prueba$;
RESET ROLE;
DO $fk$
BEGIN
 BEGIN
  INSERT INTO public.conversaciones(articulo_id,comprador_id,vendedor_id)
   VALUES('00000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072','00000000-0000-4000-8000-000000000073');
  RAISE EXCEPTION 'Vendedor inconsistente';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF has_function_privilege('anon','public.iniciar_mi_conversacion(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.enviar_mi_mensaje(uuid,uuid,text,uuid)','EXECUTE')
    OR has_schema_privilege('tb4_escritor_mensajes','auth','USAGE')
    OR has_any_column_privilege('tb4_escritor_mensajes','auth.users','SELECT') THEN
    RAISE EXCEPTION 'ACL de mensajeria inesperada';
 END IF;
END;
$fk$;
ROLLBACK;
