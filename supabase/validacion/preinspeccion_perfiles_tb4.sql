-- Solo metadatos. Una fila para conservar todos los controles en la CLI.
SELECT
(SELECT jsonb_agg(to_jsonb(x)) FROM (
SELECT current_user AS rol_efectivo, session_user AS rol_sesion,
       current_setting('server_version_num') AS version_postgres,
       r.rolcreaterole, r.rolsuper, r.rolbypassrls,
       has_schema_privilege(current_user, 'public', 'CREATE') AS crear_en_public,
       has_database_privilege(current_user, current_database(), 'CREATE') AS crear_esquema
FROM pg_roles r WHERE r.rolname = current_user
) x) AS rol_lectura,
(SELECT jsonb_agg(to_jsonb(x)) FROM (
SELECT n.nspname AS esquema, c.relname, pg_get_userbyid(c.relowner) AS propietario,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
       pg_has_role(current_user, c.relowner, 'USAGE') AS permisos_de_propietario,
       CASE WHEN n.nspname = 'auth' THEN row_security_active(c.oid) END AS rls_activo_para_rol,
       CASE WHEN n.nspname = 'auth' THEN
           has_schema_privilege(current_user, n.oid, 'USAGE')
           AND has_column_privilege(current_user, c.oid, 'id', 'SELECT')
           AND has_column_privilege(current_user, c.oid, 'email_confirmed_at', 'SELECT')
       END AS lectura_confirmacion
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname, c.relname) IN (('auth','users'), ('public','perfiles'),
                                ('public','universidades'), ('public','campus'))
) x) AS tablas,
(SELECT jsonb_agg(to_jsonb(x)) FROM (
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('perfiles','universidades','campus'))
   OR (schemaname = 'auth' AND tablename = 'users')
ORDER BY schemaname, tablename, policyname
) x) AS politicas,
(SELECT jsonb_agg(to_jsonb(x)) FROM (
SELECT rol, has_any_column_privilege(rol,'public.perfiles','SELECT') AS lectura_perfiles,
       has_any_column_privilege(rol,'public.perfiles','INSERT,UPDATE') AS dml_columna,
       has_table_privilege(rol,'public.perfiles','INSERT,UPDATE,DELETE,TRUNCATE') AS dml_tabla,
       has_function_privilege(rol,'public.crear_perfil_minimo_auth()','EXECUTE') AS execute_trigger
FROM (VALUES ('anon'), ('authenticated')) AS roles(rol)
) x) AS permisos_cliente,
(SELECT jsonb_agg(to_jsonb(x)) FROM (
SELECT n.nspname AS esquema, p.proname, pg_get_function_identity_arguments(p.oid) AS firma,
       pg_get_userbyid(p.proowner) AS propietario, p.prosecdef, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN ('crear_perfil_minimo_auth','actualizar_mi_perfil'))
   OR n.nspname = 'tb4_perfiles_privado'
   OR (n.nspname = 'auth' AND p.proname IN ('uid','jwt'))
) x) AS funciones,
(SELECT jsonb_agg(to_jsonb(x)) FROM (
SELECT to_regnamespace('tb4_perfiles_privado') IS NOT NULL AS colision_esquema,
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tb4_editor_perfil') AS colision_rol,
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname IN
          ('perfiles_lectura_cuenta_registrada','perfiles_editor_lectura','perfiles_editor_actualizacion',
           'universidades_editor_lectura','campus_editor_lectura','universidades_editor_bloqueo',
           'campus_editor_bloqueo')) AS colision_politica
) x) AS colisiones,
(SELECT jsonb_build_object(
    'rol', r.rolname, 'createrole', r.rolcreaterole, 'bypassrls', r.rolbypassrls,
    'crear_public', has_schema_privilege(r.rolname, 'public', 'CREATE'),
    'crear_esquema', has_database_privilege(r.rolname, current_database(), 'CREATE'),
    'usar_auth', has_schema_privilege(r.rolname, 'auth', 'USAGE'),
    'ejecutar_uid', has_function_privilege(r.rolname, 'auth.uid()', 'EXECUTE'),
    'ejecutar_jwt', has_function_privilege(r.rolname, 'auth.jwt()', 'EXECUTE'),
    'leer_confirmacion', has_column_privilege(r.rolname, 'auth.users', 'id', 'SELECT')
        AND has_column_privilege(r.rolname, 'auth.users', 'email_confirmed_at', 'SELECT'),
    'cli_puede_asumir_postgres', pg_has_role(to_regrole('cli_login_postgres'), r.oid, 'SET'))
 FROM pg_roles r WHERE r.rolname = 'postgres') AS rol_migracion;
