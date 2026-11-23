-- Consultas de metadatos para una sesión de solo lectura autorizada.
-- Revisar la salida antes de compartirla. No consultar auth.users ni storage.objects.
BEGIN READ ONLY;

SELECT current_setting('server_version') AS version_postgresql;

SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS propietario,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN
       ('universidades', 'campus', 'categorias', 'perfiles', 'articulos',
        'conversaciones', 'mensajes', 'lugares_publicos', 'reservas'))
   OR (n.nspname, c.relname) IN (('auth', 'users'), ('storage', 'buckets'), ('storage', 'objects'))
ORDER BY 1, 2;

SELECT table_name, column_name, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN
      ('universidades', 'campus', 'categorias', 'perfiles', 'articulos',
       'conversaciones', 'mensajes', 'lugares_publicos', 'reservas')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS relacion, conname, convalidated, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (to_regclass('public.universidades'), to_regclass('public.campus'),
                   to_regclass('public.categorias'), to_regclass('public.perfiles'),
                   to_regclass('public.articulos'), to_regclass('public.conversaciones'),
                   to_regclass('public.mensajes'), to_regclass('public.lugares_publicos'),
                   to_regclass('public.reservas'))
ORDER BY 1, 2;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN
      ('universidades', 'campus', 'categorias', 'perfiles', 'articulos',
       'conversaciones', 'mensajes', 'lugares_publicos', 'reservas')
ORDER BY 1, 2;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY 1, 2, 3;

-- ACL explícitas de tabla y columna. NULL usa los permisos predeterminados del objeto.
SELECT n.nspname, c.relname, c.relacl, a.attname, a.attacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
                        AND NOT a.attisdropped AND a.attacl IS NOT NULL
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY 1, 2, 4;

-- Los privilegios efectivos incluyen las concesiones heredadas y PUBLIC.
SELECT c.relname, r.rolname, a.attname AS columna,
       has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT') AS puede_leer,
       has_column_privilege(r.oid, c.oid, a.attnum, 'INSERT') AS puede_insertar,
       has_column_privilege(r.oid, c.oid, a.attnum, 'UPDATE') AS puede_editar,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS puede_borrar_tabla
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY 1, 2, 3;

SELECT r.rolname, r.rolinherit, r.rolsuper, r.rolbypassrls,
       ARRAY(SELECT p.rolname FROM pg_roles p
             WHERE p.oid <> r.oid AND pg_has_role(r.oid, p.oid, 'MEMBER')
             ORDER BY p.rolname) AS membresias
FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated', 'authenticator', 'service_role');

SELECT nspname, nspacl FROM pg_namespace WHERE nspname IN ('public', 'auth', 'storage');
SELECT coalesce(n.nspname, '(global)') AS esquema, pg_get_userbyid(d.defaclrole) AS propietario,
       d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON d.defaclnamespace = n.oid
WHERE n.nspname IN ('public', 'storage') OR d.defaclnamespace = 0;

SELECT rel.oid::regclass AS relacion, t.tgname, t.tgenabled,
       p.oid::regprocedure AS funcion, pg_get_userbyid(p.proowner) AS propietario,
       p.prosecdef, p.proconfig, p.proacl
FROM pg_trigger t JOIN pg_class rel ON rel.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND (n.nspname = 'public' OR rel.oid = to_regclass('auth.users'));

-- Inventariar puntos de entrada sin devolver cuerpos de funciones.
SELECT p.oid::regprocedure AS rutina, pg_get_userbyid(p.proowner) AS propietario,
       p.prosecdef, p.proconfig, p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_ejecuta,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_ejecuta
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p');

SELECT pubname, schemaname, tablename FROM pg_publication_tables
WHERE schemaname IN ('public', 'storage') ORDER BY 1, 2, 3;

-- Solo configuración del bucket propuesto. Omitir si Storage no existe o falta permiso.
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'articulos';

ROLLBACK;
