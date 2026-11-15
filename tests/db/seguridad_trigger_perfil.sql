-- SOLO PostgreSQL desechable, administrador local, Auth simulado y A + B/A.
-- Cambios de propietario, RLS, roles y objetos hostiles se revierten al terminar.
\set ON_ERROR_STOP on
BEGIN;

SELECT p.oid::regprocedure AS funcion, r.rolname AS propietario,
       r.rolsuper, r.rolbypassrls, p.prosecdef, p.proconfig, p.proacl,
       t.relowner::regrole AS propietario_tabla, t.relrowsecurity, t.relforcerowsecurity
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
CROSS JOIN pg_catalog.pg_class t
WHERE p.oid = 'public.crear_perfil_minimo_auth()'::regprocedure
  AND t.oid = 'public.perfiles'::regclass;

DO $$
DECLARE f record;
BEGIN
    SELECT * INTO STRICT f FROM pg_catalog.pg_proc
    WHERE oid = 'public.crear_perfil_minimo_auth()'::regprocedure;
    IF NOT f.prosecdef OR NOT ('search_path=""' = ANY(f.proconfig)) THEN
        RAISE EXCEPTION 'Contexto SECURITY DEFINER/search_path incorrecto';
    END IF;
    IF EXISTS (SELECT FROM pg_catalog.aclexplode(f.proacl) a
               WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
        RAISE EXCEPTION 'PUBLIC conserva EXECUTE';
    END IF;
END;
$$;

CREATE ROLE prueba_definidor_b NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE prueba_invocador_b NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE prueba_bypass_b NOLOGIN NOSUPERUSER BYPASSRLS;
GRANT USAGE, CREATE ON SCHEMA public TO prueba_definidor_b;
GRANT USAGE ON SCHEMA auth, public TO prueba_invocador_b;
GRANT INSERT ON auth.users TO prueba_invocador_b;
ALTER FUNCTION public.crear_perfil_minimo_auth() OWNER TO prueba_definidor_b;
ALTER TABLE public.perfiles OWNER TO prueba_definidor_b;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Invocador sin EXECUTE, sin privilegios en perfiles y con objetos que suplantan nombres.
CREATE SCHEMA prueba_hostil_b AUTHORIZATION prueba_invocador_b;
SET LOCAL ROLE prueba_invocador_b;
SET LOCAL search_path = prueba_hostil_b, public;
CREATE TABLE prueba_hostil_b.perfiles(id uuid);
CREATE TEMP TABLE perfiles(id uuid);
CREATE FUNCTION prueba_hostil_b.gen_random_uuid() RETURNS uuid
LANGUAGE sql AS 'SELECT NULL::uuid';
DO $$
BEGIN
    IF has_function_privilege(current_user, 'public.crear_perfil_minimo_auth()', 'EXECUTE')
       OR has_table_privilege(current_user, 'public.perfiles', 'INSERT') THEN
        RAISE EXCEPTION 'Privilegios inesperados del invocador';
    END IF;
END;
$$;
INSERT INTO auth.users(id) VALUES ('bb000000-0000-4000-8000-000000000001');
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_temp.perfiles) OR EXISTS (SELECT FROM prueba_hostil_b.perfiles) THEN
        RAISE EXCEPTION 'La inserción usó una tabla suplantada';
    END IF;
END;
$$;
RESET ROLE;
SET LOCAL search_path = pg_catalog, public;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM public.perfiles WHERE id = 'bb000000-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'Propietario sin BYPASSRLS no insertó con RLS normal';
    END IF;
END;
$$;

-- FORCE somete al propietario sin BYPASSRLS: denegación por ausencia de políticas.
ALTER TABLE public.perfiles FORCE ROW LEVEL SECURITY;
SET LOCAL ROLE prueba_invocador_b;
DO $$
BEGIN
    BEGIN
        INSERT INTO auth.users(id) VALUES ('bb000000-0000-4000-8000-000000000002');
        RAISE EXCEPTION 'FORCE RLS no bloqueó al propietario sin política';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;
DO $$
BEGIN
    IF EXISTS (SELECT FROM auth.users WHERE id = 'bb000000-0000-4000-8000-000000000002')
       OR EXISTS (SELECT FROM public.perfiles WHERE id = 'bb000000-0000-4000-8000-000000000002') THEN
        RAISE EXCEPTION 'Denegación RLS dejó datos parciales';
    END IF;
END;
$$;

-- BYPASSRLS explícito vence FORCE. Es una simulación, no una política propuesta.
GRANT USAGE, CREATE ON SCHEMA public TO prueba_bypass_b;
GRANT INSERT ON public.perfiles TO prueba_bypass_b;
ALTER FUNCTION public.crear_perfil_minimo_auth() OWNER TO prueba_bypass_b;
SET LOCAL ROLE prueba_invocador_b;
INSERT INTO auth.users(id) VALUES ('bb000000-0000-4000-8000-000000000003');
RESET ROLE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM public.perfiles WHERE id = 'bb000000-0000-4000-8000-000000000003') THEN
        RAISE EXCEPTION 'BYPASSRLS no insertó con FORCE';
    END IF;
    RAISE NOTICE 'Propietario, ACL, search_path hostil, RLS normal/FORCE/BYPASS y atomicidad: correctos';
END;
$$;
ROLLBACK;
