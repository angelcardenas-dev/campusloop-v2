-- Comprobaciones reutilizables antes del COMMIT y en una sesión posterior.
DO $verificar$
DECLARE
    tabla text;
    rol text;
    relacion regclass;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'universidades', 'campus', 'categorias', 'perfiles', 'articulos',
        'lugares_publicos', 'reservas', 'conversaciones', 'mensajes'
    ] LOOP
        relacion := to_regclass(format('public.%I', tabla));
        IF NOT EXISTS (
            SELECT FROM pg_class WHERE oid = relacion AND relkind = 'r'
              AND relrowsecurity AND NOT relforcerowsecurity
        ) THEN
            RAISE EXCEPTION 'Tabla ausente o RLS inesperado en %', tabla;
        END IF;

        FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF has_table_privilege(rol, relacion, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
               OR has_any_column_privilege(rol, relacion, 'INSERT,UPDATE,REFERENCES') THEN
                RAISE EXCEPTION 'DML o privilegio adicional de % en %', rol, tabla;
            END IF;
            IF has_table_privilege(rol, relacion, 'SELECT') THEN
                RAISE EXCEPTION 'SELECT de tabla en % para %; se requieren permisos por columna', tabla, rol;
            END IF;
        END LOOP;

        IF NOT has_column_privilege('authenticated', relacion, 'id', 'SELECT') THEN
            RAISE EXCEPTION 'Falta SELECT de id en % para authenticated', tabla;
        END IF;
        IF tabla IN ('universidades', 'campus', 'categorias', 'lugares_publicos') THEN
            IF NOT has_column_privilege('anon', relacion, 'id', 'SELECT') THEN
                RAISE EXCEPTION 'Falta SELECT de id del directorio % para anon', tabla;
            END IF;
        ELSIF has_any_column_privilege('anon', relacion, 'SELECT') THEN
            RAISE EXCEPTION 'SELECT inesperado en % para anon', tabla;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'articulos'
          AND policyname = 'articulos_lectura_sesion_registrada'
          AND permissive = 'RESTRICTIVE' AND cmd = 'SELECT' AND roles = ARRAY['authenticated'::name]
    ) OR NOT EXISTS (
        SELECT FROM pg_index WHERE indexrelid = to_regclass('public.reservas_articulo_activo_uq')
          AND indisvalid AND indisunique AND indpred IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Falta la guarda de sesión del catálogo o el índice de reserva activa';
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_class c ON c.oid = 'public.perfiles'::regclass
        WHERE t.tgrelid = 'auth.users'::regclass
          AND t.tgname = 'crear_perfil_minimo_tras_registro'
          AND t.tgenabled IN ('O', 'A')
          AND p.oid = to_regprocedure('public.crear_perfil_minimo_auth()')
          AND p.prosecdef AND p.proowner = c.relowner
    ) OR has_function_privilege('anon', 'public.crear_perfil_minimo_auth()', 'EXECUTE')
      OR has_function_privilege('authenticated', 'public.crear_perfil_minimo_auth()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Trigger de perfil ausente o privilegios inesperados';
    END IF;
END;
$verificar$;

SELECT 'TB4: comprobaciones de estructura, RLS y permisos superadas' AS resultado;
