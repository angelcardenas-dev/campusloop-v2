-- Ejecutar solo en PostgreSQL desechable con las seis migraciones.
BEGIN;
DO $acl$
BEGIN
    IF has_schema_privilege('tb4_editor_perfil', 'auth', 'USAGE')
       OR has_any_column_privilege('tb4_editor_perfil', 'auth.users', 'SELECT')
       OR has_function_privilege('anon', 'tb4_perfiles_privado.actor_confirmado()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'tb4_perfiles_privado.actor_confirmado()', 'EXECUTE')
       OR NOT has_function_privilege('tb4_editor_perfil', 'tb4_perfiles_privado.actor_confirmado()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.actualizar_mi_perfil(text,uuid,uuid,integer,uuid)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.actualizar_mi_perfil(text,uuid,uuid,integer,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Permisos inesperados en las funciones de perfil';
    END IF;
END;
$acl$;
INSERT INTO auth.users (id, email_confirmed_at) VALUES
    ('00000000-0000-4000-8000-000000000021', now()),
    ('00000000-0000-4000-8000-000000000022', NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000021","is_anonymous":false}', true);

DO $prueba$
DECLARE
    actor uuid := auth.uid();
    otro uuid := '00000000-0000-4000-8000-000000000022';
    u uuid := '486a935d-f0f9-4437-891e-62bc48bde10a';
    c uuid := '82d7186a-920c-49e2-bcc5-9aaa03ad655e';
    fila record;
BEGIN
    IF (SELECT count(id) FROM public.perfiles) <> 1 OR EXISTS (SELECT id FROM public.perfiles WHERE id = otro) THEN
        RAISE EXCEPTION 'Lectura cruzada';
    END IF;
    BEGIN
        UPDATE public.perfiles SET vendedor_activado = true;
        RAISE EXCEPTION 'Escritura directa permitida';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM public.actualizar_mi_perfil('Nombre', u, c, 1, otro);
        RAISE EXCEPTION 'Actor esperado diferente aceptado';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM public.actualizar_mi_perfil('Nombre', '6ab6b6a8-0f6b-4149-8036-30a56eba20ba', c, 1, actor);
        RAISE EXCEPTION 'Campus incompatible';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    SELECT * INTO STRICT fila FROM public.actualizar_mi_perfil(' Nombre ', u, c, 1, actor);
    IF fila.id <> actor OR fila.version <> 2 OR fila.campus_id <> c
        OR fila.nombre_visible <> 'Nombre' OR fila.vendedor_activado THEN
        RAISE EXCEPTION 'Perfil actualizado incorrectamente';
    END IF;
    BEGIN
        PERFORM public.actualizar_mi_perfil('Nombre nuevo', u, c, 1, actor);
        RAISE EXCEPTION 'Version anterior aceptada';
    EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
    END;
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'is_anonymous', true)::text, true);
    IF EXISTS (SELECT id FROM public.perfiles) THEN
        RAISE EXCEPTION 'Lectura de cuenta anonima';
    END IF;
    BEGIN
        PERFORM public.actualizar_mi_perfil('Nombre', u, c, 2, actor);
        RAISE EXCEPTION 'Escritura de cuenta anonima';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', otro, 'is_anonymous', false)::text, true);
    BEGIN
        PERFORM public.actualizar_mi_perfil('Nombre', u, c, 1, otro);
        RAISE EXCEPTION 'Correo sin confirmar aceptado';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$prueba$;
ROLLBACK;
