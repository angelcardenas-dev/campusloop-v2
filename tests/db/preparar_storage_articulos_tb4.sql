-- Simulador de Storage exclusivo de PostgreSQL desechable.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (bucket_id text NOT NULL REFERENCES storage.buckets, name text NOT NULL, owner_id text, PRIMARY KEY(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO storage.buckets VALUES ('articulos',false,2097152,ARRAY['image/jpeg','image/png','image/webp']);
CREATE FUNCTION storage.allow_any_operation(text[]) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT current_setting('storage.operation',true)=ANY($1) $$;
CREATE FUNCTION storage.allow_only_operation(text) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT current_setting('storage.operation',true)=$1 $$;
GRANT USAGE ON SCHEMA storage TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
