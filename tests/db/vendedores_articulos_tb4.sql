-- Solo PostgreSQL desechable. Requiere las migraciones de vendedores y edici?n.
BEGIN;
INSERT INTO auth.users(id,email_confirmed_at) VALUES
  ('00000000-0000-4000-8000-000000000031',now()),
  ('00000000-0000-4000-8000-000000000032',now());
UPDATE public.perfiles SET nombre_visible='Cuenta sintetica',campus_id='82d7186a-920c-49e2-bcc5-9aaa03ad655e'
 WHERE id IN ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032');
INSERT INTO tb4_ventas_privado.normas(version,vigente) VALUES ('sintetica',true);
INSERT INTO tb4_ventas_privado.revisores(perfil_id,habilitado) VALUES ('00000000-0000-4000-8000-000000000032',true);

SET LOCAL ROLE authenticated;
DO $prueba$
DECLARE
 a uuid := '00000000-0000-4000-8000-000000000031';
 b uuid := '00000000-0000-4000-8000-000000000032';
 k uuid := '00000000-0000-4000-8000-000000000033';
 s jsonb;
 n jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
 s := public.enviar_solicitud_vendedor(k,false,true,'sintetica');
 IF s->>'estado'<>'pendiente' OR (s->>'responderAntesDe')::timestamptz-(s->>'enviadaEn')::timestamptz<>interval '48 hours'
   OR public.enviar_solicitud_vendedor(k,false,true,'sintetica') IS DISTINCT FROM s THEN
    RAISE EXCEPTION 'Solicitud, plazo o reintento incorrectos';
 END IF;
 BEGIN
   PERFORM public.decidir_solicitud_vendedor((s->>'id')::uuid,1,'aprobado','Prueba');
   RAISE EXCEPTION 'Autoactivacion';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE public.perfiles SET vendedor_activado=true WHERE id=a;
   RAISE EXCEPTION 'Escritura directa';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'is_anonymous',false)::text,true);
 IF EXISTS (SELECT FROM public.consultar_mis_solicitudes())
    OR (SELECT count(*) FROM public.consultar_solicitudes_revision())<>1 THEN
   RAISE EXCEPTION 'Aislamiento de solicitudes o cola';
 END IF;
 PERFORM public.decidir_solicitud_vendedor((s->>'id')::uuid,1,'aprobado','Revision humana');
 BEGIN
   PERFORM public.decidir_solicitud_vendedor((s->>'id')::uuid,1,'rechazado','Revision humana');
   RAISE EXCEPTION 'Sobrescritura';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 IF EXISTS (SELECT FROM public.consultar_mis_notificaciones()) THEN RAISE EXCEPTION 'Notificacion ajena'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
 SELECT * INTO STRICT n FROM public.consultar_mis_notificaciones();
 IF n->>'tipo'<>'aprobado' OR NOT (SELECT vendedor_activado FROM public.perfiles WHERE id=a) THEN
   RAISE EXCEPTION 'Aprobacion no atomica';
 END IF;
 PERFORM public.marcar_notificacion_leida((n->>'id')::uuid);
 IF EXISTS (SELECT FROM public.consultar_mis_notificaciones(20,true)) THEN RAISE EXCEPTION 'Lectura no guardada'; END IF;
END;
$prueba$;
RESET ROLE;

INSERT INTO tb4_ventas_privado.fotos_verificadas(ruta,vendedor_id,formato,bytes,ancho,alto)
VALUES ('00000000-0000-4000-8000-000000000031/verificada.jpg','00000000-0000-4000-8000-000000000031',
        'image/jpeg',256,100,100);
SET LOCAL ROLE authenticated;
DO $alta$
DECLARE
 actor uuid := '00000000-0000-4000-8000-000000000031';
 clave uuid := '00000000-0000-4000-8000-000000000035';
 categoria uuid := '7065c00d-bfe8-4460-ae0c-6978fd7107d9';
 campus uuid := '82d7186a-920c-49e2-bcc5-9aaa03ad655e';
 ruta text := actor::text || '/verificada.jpg';
 resultado jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.crear_mi_articulo(clave,'Alta','Descripcion',categoria,'nuevo',100,campus,actor::text||'/no-verificada.jpg');
   RAISE EXCEPTION 'Alta sin evidencia';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 resultado := public.crear_mi_articulo(clave,'Alta','Descripcion',categoria,'nuevo',100,campus,ruta);
 IF resultado IS DISTINCT FROM public.crear_mi_articulo(clave,'Alta','Descripcion',categoria,'nuevo',100,campus,ruta)
     OR resultado->'imagen'->>'ruta'<>ruta OR resultado->'imagen' ? 'url' THEN
   RAISE EXCEPTION 'Alta o reintento incorrectos';
 END IF;
 IF NOT EXISTS(SELECT FROM public.articulos WHERE id=(resultado->>'id')::uuid
    AND vendedor_id=actor AND imagen_url IS NULL AND imagen_ruta=ruta) THEN RAISE EXCEPTION 'Referencia incorrecta'; END IF;
 BEGIN
   PERFORM public.crear_mi_articulo(clave,'Alterado','Descripcion',categoria,'nuevo',100,campus,ruta);
   RAISE EXCEPTION 'Reintento alterado';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END;
$alta$;
RESET ROLE;

INSERT INTO public.articulos(id,vendedor_id,titulo,descripcion,categoria_id,condicion,precio_centimos,campus_id,
 imagen_bucket,imagen_ruta,imagen_url,imagen_formato,imagen_bytes,imagen_ancho,imagen_alto)
VALUES ('00000000-0000-4000-8000-000000000034','00000000-0000-4000-8000-000000000031',
 'Articulo','Descripcion','7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,'82d7186a-920c-49e2-bcc5-9aaa03ad655e',
 'articulos','00000000-0000-4000-8000-000000000031/foto.jpg','https://example.invalid/foto.jpg','image/jpeg',100,100,100);
-- Simula el permiso de operación que inyecta la API de Storage.
SET LOCAL ROLE authenticated;
DO $storage$
DECLARE
 a uuid := '00000000-0000-4000-8000-000000000031';
 b uuid := '00000000-0000-4000-8000-000000000032';
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
 PERFORM set_config('storage.operation','object.upload',true);
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('articulos',a::text||'/foto.jpg',a::text);
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('articulos',a::text||'/sin-vinculo.jpg',a::text);
 PERFORM set_config('storage.operation','object.sign',true);
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Firma de objeto sin vinculo'; END IF;
 PERFORM set_config('storage.operation','object.list',true);
 IF EXISTS (SELECT FROM storage.objects) THEN RAISE EXCEPTION 'Listado abierto'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',true)::text,true);
 PERFORM set_config('storage.operation','object.sign',true);
 IF EXISTS (SELECT FROM storage.objects) THEN RAISE EXCEPTION 'Firma desde sesion anonima'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'is_anonymous',false)::text,true);
 PERFORM set_config('storage.operation','object.upload',true);
 BEGIN
   INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('articulos',b::text||'/foto.jpg',b::text);
   RAISE EXCEPTION 'Comprador pudo subir';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$storage$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $prueba$
DECLARE
 a uuid := '00000000-0000-4000-8000-000000000031';
 b uuid := '00000000-0000-4000-8000-000000000032';
 articulo_id_prueba uuid := '00000000-0000-4000-8000-000000000034';
 c uuid := '7065c00d-bfe8-4460-ae0c-6978fd7107d9';
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.editar_o_retirar_mi_articulo(articulo_id_prueba,1,true);
   RAISE EXCEPTION 'Usuario sin permiso pudo retirar';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
 IF (public.editar_o_retirar_mi_articulo(articulo_id_prueba,1,false,'Editado','Descripcion',c,'nuevo',200)->>'version')::int<>2 THEN
   RAISE EXCEPTION 'No se incremento la version';
 END IF;
 BEGIN
   PERFORM public.editar_o_retirar_mi_articulo(articulo_id_prueba,1,true);
   RAISE EXCEPTION 'Version obsoleta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 RESET ROLE;
 INSERT INTO public.reservas(articulo_id,comprador_id,vendedor_id) VALUES (articulo_id_prueba,b,a);
 SET LOCAL ROLE authenticated;
 BEGIN
   PERFORM public.editar_o_retirar_mi_articulo(articulo_id_prueba,2,true);
   RAISE EXCEPTION 'Retiro de articulo con reserva activa';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 RESET ROLE;
 UPDATE public.reservas SET estado='cancelada' WHERE articulo_id=articulo_id_prueba;
 SET LOCAL ROLE authenticated;
 IF (public.editar_o_retirar_mi_articulo(articulo_id_prueba,2,true)->>'retirado')::boolean IS NOT TRUE THEN
   RAISE EXCEPTION 'No se retiro el articulo';
 END IF;
 IF EXISTS (SELECT FROM public.articulos a WHERE a.id=articulo_id_prueba) THEN RAISE EXCEPTION 'Articulo retirado visible'; END IF;
END;
$prueba$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.reservas WHERE articulo_id='00000000-0000-4000-8000-000000000034') <> 1 THEN RAISE EXCEPTION 'Historial perdido'; END IF; END; $$;
ROLLBACK;
