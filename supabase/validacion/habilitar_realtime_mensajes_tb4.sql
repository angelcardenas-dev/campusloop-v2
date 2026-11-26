-- Procedimiento administrativo pendiente de autorización. No ejecutarlo en la revisión offline.
BEGIN;
DO $tb4$
BEGIN
 IF NOT EXISTS (SELECT FROM pg_catalog.pg_publication WHERE pubname='supabase_realtime') THEN
   RAISE EXCEPTION 'La publicación supabase_realtime no existe';
 END IF;
 IF NOT EXISTS (SELECT FROM pg_catalog.pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mensajes') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
 END IF;
END;
$tb4$;
COMMIT;
