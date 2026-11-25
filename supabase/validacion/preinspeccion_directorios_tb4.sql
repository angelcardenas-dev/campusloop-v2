-- En SQL Editor ejecutar dentro de BEGIN READ ONLY y ROLLBACK.
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT c.relname AS tabla, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
ORDER BY c.relname;

SELECT id, nombre, sigla, activa FROM public.universidades ORDER BY nombre, id;
SELECT id, universidad_id, nombre, distrito, ciudad, activo FROM public.campus ORDER BY nombre, id;
SELECT id, nombre, descripcion, orden, activa FROM public.categorias ORDER BY orden, nombre, id;

SELECT t.tgname, t.tgenabled, t.tgfoid::regprocedure AS funcion
FROM pg_trigger t
WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal;

SELECT p.oid::regprocedure AS rutina,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_ejecuta
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
ORDER BY 1;
