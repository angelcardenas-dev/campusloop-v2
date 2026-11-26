-- PostgreSQL desechable con el simulador de Storage.
BEGIN;
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('00000000-0000-4000-8000-000000000101',now());
UPDATE public.perfiles SET vendedor_activado=true,nombre_visible='Prueba',campus_id='82d7186a-920c-49e2-bcc5-9aaa03ad655e'
 WHERE id='00000000-0000-4000-8000-000000000101';
INSERT INTO storage.objects(bucket_id,name,owner_id,version) VALUES
 ('articulos','00000000-0000-4000-8000-000000000101/primera.png','00000000-0000-4000-8000-000000000101','v1'),
 ('articulos','00000000-0000-4000-8000-000000000101/segunda.png','00000000-0000-4000-8000-000000000101','v2');
SET LOCAL ROLE service_role;
DO $verificar$
DECLARE a uuid:='00000000-0000-4000-8000-000000000101'; primera text:=a::text||'/primera.png'; segunda text:=a::text||'/segunda.png';
BEGIN
 IF public.tb4_foto_objeto_verificable(a,primera)<>'v1' THEN RAISE EXCEPTION 'Metadatos incorrectos'; END IF;
 BEGIN
  PERFORM public.tb4_registrar_foto_verificada(a,primera,'vieja',repeat('a',64),'image/png',100,100,100);
  RAISE EXCEPTION 'Version Storage alterada';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 PERFORM public.tb4_registrar_foto_verificada(a,primera,'v1',repeat('a',64),'image/png',100,100,100);
 PERFORM public.tb4_registrar_foto_verificada(a,segunda,'v2',repeat('b',64),'image/png',200,100,100);
END;
$verificar$;
RESET ROLE;
UPDATE storage.objects SET version='obsoleta' WHERE name='00000000-0000-4000-8000-000000000101/primera.png';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","is_anonymous":false}',true);
DO $obsoleta$
BEGIN
 BEGIN
  PERFORM public.crear_mi_articulo('00000000-0000-4000-8000-000000000102','Foto','Ejemplo',
   '7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,'82d7186a-920c-49e2-bcc5-9aaa03ad655e',
   '00000000-0000-4000-8000-000000000101/primera.png','00000000-0000-4000-8000-000000000101');
  RAISE EXCEPTION 'B06: alta acepto evidencia obsoleta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END;
$obsoleta$;
RESET ROLE;
DELETE FROM storage.objects WHERE name='00000000-0000-4000-8000-000000000101/primera.png';
SET LOCAL ROLE authenticated;
DO $alta_ausente$
BEGIN
 BEGIN
  PERFORM public.crear_mi_articulo('00000000-0000-4000-8000-000000000102','Foto','Ejemplo',
   '7065c00d-bfe8-4460-ae0c-6978fd7107d9','nuevo',100,'82d7186a-920c-49e2-bcc5-9aaa03ad655e',
   '00000000-0000-4000-8000-000000000101/primera.png','00000000-0000-4000-8000-000000000101');
  RAISE EXCEPTION 'B06: alta acepto objeto ausente';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END;
$alta_ausente$;
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name,owner_id,version) VALUES
 ('articulos','00000000-0000-4000-8000-000000000101/primera.png','00000000-0000-4000-8000-000000000101','v1');
SET LOCAL ROLE authenticated;
DO $reemplazar$
DECLARE a uuid:='00000000-0000-4000-8000-000000000101';
 primera text:=a::text||'/primera.png'; segunda text:=a::text||'/segunda.png';
 categoria uuid:='7065c00d-bfe8-4460-ae0c-6978fd7107d9'; campus uuid:='82d7186a-920c-49e2-bcc5-9aaa03ad655e';
 clave uuid:='00000000-0000-4000-8000-000000000103'; id_articulo uuid;
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
 BEGIN
   PERFORM public.tb4_registrar_foto_verificada(a,segunda,'v2',repeat('b',64),'image/png',200,100,100);
   RAISE EXCEPTION 'Evidencia falsificable';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 id_articulo:=(public.crear_mi_articulo('00000000-0000-4000-8000-000000000102','Foto','Ejemplo',categoria,'nuevo',100,campus,primera,a)->>'id')::uuid;
 BEGIN
   PERFORM public.reemplazar_mi_foto(id_articulo,2,clave,segunda,a);
   RAISE EXCEPTION 'Reemplazo con version incorrecta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
 IF NOT EXISTS(SELECT FROM public.articulos WHERE id=id_articulo AND imagen_ruta=primera) THEN
   RAISE EXCEPTION 'Se perdio la primera foto';
 END IF;
 PERFORM set_config('tb4.test.articulo',id_articulo::text,true);
END;
$reemplazar$;
RESET ROLE;
UPDATE storage.objects SET version='obsoleta' WHERE name='00000000-0000-4000-8000-000000000101/segunda.png';
SET LOCAL ROLE authenticated;
DO $version$
DECLARE a uuid:='00000000-0000-4000-8000-000000000101'; id_articulo uuid:=current_setting('tb4.test.articulo')::uuid;
BEGIN
 BEGIN
  PERFORM public.reemplazar_mi_foto(id_articulo,1,'00000000-0000-4000-8000-000000000103',a::text||'/segunda.png',a);
  RAISE EXCEPTION 'B06: reemplazo acepto evidencia obsoleta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END;
$version$;
RESET ROLE;
DELETE FROM storage.objects WHERE name='00000000-0000-4000-8000-000000000101/segunda.png';
SET LOCAL ROLE authenticated;
DO $ausente$
DECLARE a uuid:='00000000-0000-4000-8000-000000000101'; id_articulo uuid:=current_setting('tb4.test.articulo')::uuid;
BEGIN
 BEGIN
  PERFORM public.reemplazar_mi_foto(id_articulo,1,'00000000-0000-4000-8000-000000000103',a::text||'/segunda.png',a);
  RAISE EXCEPTION 'B06: reemplazo acepto objeto ausente';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END;
$ausente$;
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name,owner_id,version) VALUES
 ('articulos','00000000-0000-4000-8000-000000000101/segunda.png','00000000-0000-4000-8000-000000000101','v2');
SET LOCAL ROLE authenticated;
DO $final$
DECLARE a uuid:='00000000-0000-4000-8000-000000000101'; id_articulo uuid:=current_setting('tb4.test.articulo')::uuid;
 clave uuid:='00000000-0000-4000-8000-000000000103'; segunda text:=a::text||'/segunda.png';
BEGIN
 IF public.reemplazar_mi_foto(id_articulo,1,clave,segunda,a)->>'ruta'<>segunda THEN RAISE EXCEPTION 'Reemplazo'; END IF;
 IF public.reemplazar_mi_foto(id_articulo,1,clave,segunda,a)->>'version'<>'2' THEN RAISE EXCEPTION 'Reintento'; END IF;
END;
$final$;
RESET ROLE;
DO $historia$
BEGIN
 IF (SELECT count(*) FROM tb4_ventas_privado.fotos_verificadas WHERE articulo_id IS NOT NULL)<>2 THEN
   RAISE EXCEPTION 'Historico de la foto anterior perdido';
 END IF;
END;
$historia$;
ROLLBACK;
