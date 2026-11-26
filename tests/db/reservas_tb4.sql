-- Solo PostgreSQL desechable, con perfiles y 20261125000600 instaladas.
BEGIN;
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000000051',now()),
 ('00000000-0000-4000-8000-000000000052',now()),
 ('00000000-0000-4000-8000-000000000053',now());
INSERT INTO public.articulos(id,vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
 imagen_bucket,imagen_ruta,imagen_url,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
SELECT id::uuid,'00000000-0000-4000-8000-000000000051','Titulo','Descripcion',
'7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,'82d7186a-920c-49e2-bcc5-9aaa03ad655e',
'articulos','00000000-0000-4000-8000-000000000051/'||id||'.jpg','https://example.invalid/foto.jpg','image/jpeg',100,100,100
FROM unnest(ARRAY['00000000-0000-4000-8000-000000000054','00000000-0000-4000-8000-000000000055']) id;
INSERT INTO public.reservas(articulo_id,comprador_id,vendedor_id) VALUES
 ('00000000-0000-4000-8000-000000000055','00000000-0000-4000-8000-000000000053','00000000-0000-4000-8000-000000000051');

SET LOCAL ROLE authenticated;
DO $prueba$
DECLARE
 vendedor uuid := '00000000-0000-4000-8000-000000000051';
 comprador uuid := '00000000-0000-4000-8000-000000000052';
 otro uuid := '00000000-0000-4000-8000-000000000053';
 articulo uuid := '00000000-0000-4000-8000-000000000054';
 legado uuid := '00000000-0000-4000-8000-000000000055';
 creada jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',vendedor,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.crear_mi_reserva(articulo,1,vendedor);
   RAISE EXCEPTION 'Reserva propia aceptada';
 EXCEPTION WHEN SQLSTATE 'PT404' THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.crear_mi_reserva(articulo,1,otro);
   RAISE EXCEPTION 'Identidad sustituida';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.crear_mi_reserva(legado,1,comprador);
   RAISE EXCEPTION 'Reserva activa duplicada';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 IF NOT EXISTS(SELECT FROM public.articulos WHERE id=legado AND estado='disponible' AND version=1) THEN
   RAISE EXCEPTION 'El indice no revirtio el cambio de estado';
 END IF;
 creada := public.crear_mi_reserva(articulo,1,comprador);
 IF creada->>'estado'<>'pendiente' OR creada->>'compradorId'<>comprador::text
    OR creada->>'vendedorId'<>vendedor::text OR NOT EXISTS(
      SELECT FROM public.articulos WHERE id=articulo AND estado='reservado' AND version=2) THEN
   RAISE EXCEPTION 'Reserva incoherente';
 END IF;
 BEGIN
   UPDATE public.reservas SET estado='confirmada' WHERE id=(creada->>'id')::uuid;
   RAISE EXCEPTION 'Actualizacion directa';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',otro,'is_anonymous',false)::text,true);
 IF EXISTS(SELECT FROM public.reservas WHERE id=(creada->>'id')::uuid) THEN
   RAISE EXCEPTION 'Reserva ajena visible';
 END IF;
 BEGIN
   PERFORM public.crear_mi_reserva(articulo,1,otro);
   RAISE EXCEPTION 'Articulo reservado dos veces';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',vendedor,'is_anonymous',false)::text,true);
 IF NOT EXISTS(SELECT FROM public.reservas WHERE id=(creada->>'id')::uuid) THEN
   RAISE EXCEPTION 'Vendedor no puede leer su reserva';
 END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',comprador,'is_anonymous',true)::text,true);
 IF EXISTS(SELECT FROM public.reservas WHERE id=(creada->>'id')::uuid) THEN
   RAISE EXCEPTION 'Anonymous Sign-In pudo leer';
 END IF;
 BEGIN
   PERFORM public.crear_mi_reserva(articulo,2,comprador);
   RAISE EXCEPTION 'Anonymous Sign-In pudo reservar';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$prueba$;
RESET ROLE;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.crear_mi_reserva(uuid,integer,uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.crear_mi_reserva(uuid,integer,uuid)','EXECUTE')
    OR has_schema_privilege('tb4_creador_reservas','auth','USAGE')
    OR has_any_column_privilege('tb4_creador_reservas','auth.users','SELECT') THEN
    RAISE EXCEPTION 'ACL de reserva inesperada';
 END IF;
END;
$acl$;
ROLLBACK;
