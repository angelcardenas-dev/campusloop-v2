-- Ejecutar dentro de la transacción inicial, antes de crear objetos TB4.
SELECT pg_advisory_xact_lock(20261124, 1);

DO $preflight$
BEGIN
    IF to_regclass('auth.users') IS NULL
       OR to_regprocedure('auth.uid()') IS NULL
       OR to_regprocedure('auth.jwt()') IS NULL THEN
        RAISE EXCEPTION 'El destino carece del esquema Auth requerido';
    END IF;

    IF EXISTS (SELECT FROM auth.users)
       OR EXISTS (
           SELECT FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace
             AND c.relkind IN ('r', 'p', 'f', 'v', 'm')
       )
       OR EXISTS (
           SELECT FROM pg_trigger
           WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
       ) THEN
        RAISE EXCEPTION 'El destino difiere de la línea base inicial, conciliar antes de aplicar';
    END IF;

    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        IF EXISTS (SELECT FROM supabase_migrations.schema_migrations) THEN
            RAISE EXCEPTION 'El destino ya tiene historial, conciliar antes de aplicar';
        END IF;
    END IF;
END;
$preflight$;
