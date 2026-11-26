-- Requiere bucket creado por la API administrativa de Storage.
-- Validar en Supabase aislado el contrato de operaciones antes del corte.
BEGIN;
DO $bucket$
BEGIN
    IF NOT EXISTS (
        SELECT FROM storage.buckets
        WHERE id='articulos' AND NOT public AND file_size_limit=2097152
          AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
          AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]
    ) THEN RAISE EXCEPTION 'Configurar y verificar el bucket privado articulos'; END IF;
END;
$bucket$;

CREATE POLICY fotos_tb4_sesion ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
USING (bucket_id <> 'articulos' OR (current_user='authenticated' AND (SELECT auth.uid()) IS NOT NULL
  AND ((SELECT auth.jwt() -> 'is_anonymous')='false'::jsonb) IS TRUE))
WITH CHECK (bucket_id <> 'articulos' OR (current_user='authenticated' AND (SELECT auth.uid()) IS NOT NULL
  AND ((SELECT auth.jwt() -> 'is_anonymous')='false'::jsonb) IS TRUE));

CREATE POLICY fotos_tb4_limite_lectura ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id <> 'articulos' OR (
    storage.allow_any_operation(ARRAY['object.get_authenticated','object.sign','object.sign_many'])
    AND EXISTS (SELECT FROM public.articulos a WHERE a.imagen_bucket=storage.objects.bucket_id
          AND a.imagen_ruta=storage.objects.name AND a.vendedor_id::text=storage.objects.owner_id
          AND a.eliminado_en IS NULL)));
CREATE POLICY fotos_tb4_lectura ON storage.objects FOR SELECT TO authenticated USING (bucket_id='articulos');

CREATE POLICY fotos_tb4_limite_alta ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'articulos' OR (
    storage.allow_only_operation('object.upload')
    AND owner_id=(SELECT auth.uid()::text)
    AND split_part(name,'/',1)=(SELECT auth.uid()::text)
    AND name ~ '^[0-9a-f-]+/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'
    AND char_length(name)<=500
    AND EXISTS (SELECT FROM public.perfiles p WHERE p.id=(SELECT auth.uid()) AND p.vendedor_activado)));
CREATE POLICY fotos_tb4_alta ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='articulos');

CREATE POLICY fotos_tb4_inmutables ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id <> 'articulos') WITH CHECK (bucket_id <> 'articulos');
CREATE POLICY fotos_tb4_baja_administrada ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id <> 'articulos');
COMMIT;
