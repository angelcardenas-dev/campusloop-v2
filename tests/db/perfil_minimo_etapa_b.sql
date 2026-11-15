-- SOLO base desechable con migraciones A y B/A aplicadas.
-- Auth simulado requiere id uuid PK y raw_user_meta_data jsonb.
-- No prueba GoTrue, correo ni signUp real de Supabase.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
    actor uuid := gen_random_uuid();
    fallido uuid := gen_random_uuid();
    p public.perfiles%ROWTYPE;
BEGIN
    INSERT INTO auth.users(id, raw_user_meta_data) VALUES
        (actor, '{"vendedor_activado":true,"nombre_visible":"Inyectado","campus_id":"ajeno"}');
    SELECT * INTO STRICT p FROM public.perfiles WHERE id = actor;
    IF p.nombre_visible IS NOT NULL OR p.campus_id IS NOT NULL
        OR p.vendedor_activado OR p.version <> 1
        OR p.creado_en IS NULL OR p.actualizado_en IS NULL THEN
        RAISE EXCEPTION 'Perfil mínimo incorrecto o metadatos confiados';
    END IF;

    -- Un UPDATE de Auth no reinserta ni sobrescribe el perfil.
    UPDATE public.perfiles SET nombre_visible = 'Nombre conservado' WHERE id = actor;
    UPDATE auth.users SET raw_user_meta_data = '{}' WHERE id = actor;
    IF (SELECT nombre_visible FROM public.perfiles WHERE id = actor) <> 'Nombre conservado' THEN
        RAISE EXCEPTION 'Actualización Auth alteró el perfil';
    END IF;

    -- Simular fallo de persistencia: la creación Auth tampoco debe quedar guardada.
    EXECUTE format('ALTER TABLE public.perfiles ADD CONSTRAINT perfil_fallo_sintetico CHECK (id <> %L::uuid)', fallido);
    BEGIN
        INSERT INTO auth.users(id) VALUES (fallido);
        RAISE EXCEPTION 'Se ocultó un fallo del trigger';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    IF EXISTS (SELECT FROM auth.users WHERE id = fallido)
        OR EXISTS (SELECT FROM public.perfiles WHERE id = fallido) THEN
        RAISE EXCEPTION 'Creación parcial tras fallo del trigger';
    END IF;
    ALTER TABLE public.perfiles DROP CONSTRAINT perfil_fallo_sintetico;
    RAISE NOTICE 'Perfil mínimo, metadatos ignorados, UPDATE y rollback atómico: correctos';
END;
$$;

-- Rol sintético sin privilegios sobre perfiles. Requiere administrador local.
CREATE ROLE prueba_auth_perfil_b NOLOGIN;
GRANT USAGE ON SCHEMA auth TO prueba_auth_perfil_b;
GRANT INSERT ON auth.users TO prueba_auth_perfil_b;
SET LOCAL ROLE prueba_auth_perfil_b;
INSERT INTO auth.users(id) VALUES ('a16e89a0-cc8a-4202-9382-bd427c36c911');
DO $$
BEGIN
    IF has_function_privilege(current_user, 'public.crear_perfil_minimo_auth()', 'EXECUTE') THEN
        RAISE EXCEPTION 'La función del trigger permite ejecución directa';
    END IF;
    BEGIN
        INSERT INTO public.perfiles(id) VALUES ('a16e89a0-cc8a-4202-9382-bd427c36c911');
        RAISE EXCEPTION 'Rol Auth simulado tiene escritura directa en perfiles';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM public.perfiles WHERE id = 'a16e89a0-cc8a-4202-9382-bd427c36c911') THEN
        RAISE EXCEPTION 'El trigger no funcionó desde el rol Auth sin permisos en perfiles';
    END IF;
END;
$$;
ROLLBACK;
