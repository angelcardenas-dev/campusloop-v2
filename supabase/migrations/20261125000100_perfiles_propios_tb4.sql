-- TB4: lectura propia y actualizacion por version.
BEGIN;

CREATE ROLE tb4_editor_perfil NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA tb4_perfiles_privado;
REVOKE ALL ON SCHEMA tb4_perfiles_privado FROM PUBLIC;
GRANT USAGE ON SCHEMA tb4_perfiles_privado, public TO tb4_editor_perfil;

CREATE FUNCTION tb4_perfiles_privado.actor_confirmado()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $funcion$
    SELECT u.id
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND (auth.jwt() -> 'is_anonymous' = 'false'::jsonb) IS TRUE
      AND u.email_confirmed_at IS NOT NULL;
$funcion$;
REVOKE ALL ON FUNCTION tb4_perfiles_privado.actor_confirmado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tb4_perfiles_privado.actor_confirmado() TO tb4_editor_perfil;

CREATE POLICY perfiles_lectura_cuenta_registrada ON public.perfiles
    AS RESTRICTIVE FOR SELECT TO authenticated USING (
        (SELECT auth.uid()) IS NOT NULL
        AND ((SELECT auth.jwt() -> 'is_anonymous') = 'false'::jsonb) IS TRUE
    );

GRANT SELECT (id, nombre_visible, campus_id, vendedor_activado, creado_en, actualizado_en, version),
      UPDATE (nombre_visible, campus_id, actualizado_en, version)
    ON public.perfiles TO tb4_editor_perfil;
CREATE POLICY perfiles_editor_lectura ON public.perfiles
    FOR SELECT TO tb4_editor_perfil USING (id = (SELECT tb4_perfiles_privado.actor_confirmado()));
CREATE POLICY perfiles_editor_actualizacion ON public.perfiles
    FOR UPDATE TO tb4_editor_perfil
    USING (id = (SELECT tb4_perfiles_privado.actor_confirmado()))
    WITH CHECK (id = (SELECT tb4_perfiles_privado.actor_confirmado()));

-- FOR SHARE requiere UPDATE en alguna columna. WITH CHECK (false) impide
-- escribir en los directorios.
GRANT SELECT (id, activa), UPDATE (id) ON public.universidades TO tb4_editor_perfil;
GRANT SELECT (id, universidad_id, activo), UPDATE (id) ON public.campus TO tb4_editor_perfil;
CREATE POLICY universidades_editor_lectura ON public.universidades
    FOR SELECT TO tb4_editor_perfil USING (activa);
CREATE POLICY campus_editor_lectura ON public.campus
    FOR SELECT TO tb4_editor_perfil USING (activo);
CREATE POLICY universidades_editor_bloqueo ON public.universidades FOR UPDATE
    TO tb4_editor_perfil USING (activa) WITH CHECK (false);
CREATE POLICY campus_editor_bloqueo ON public.campus FOR UPDATE
    TO tb4_editor_perfil USING (activo) WITH CHECK (false);

CREATE FUNCTION public.actualizar_mi_perfil(
    p_nombre_visible text, p_universidad_id uuid, p_campus_id uuid, p_version_esperada integer, p_actor_esperado uuid
)
RETURNS TABLE (id uuid, nombre_visible text, campus_id uuid, vendedor_activado boolean,
               creado_en timestamptz, actualizado_en timestamptz, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $funcion$
DECLARE
    actor uuid := tb4_perfiles_privado.actor_confirmado();
    nombre text := pg_catalog.btrim(p_nombre_visible);
BEGIN
    IF actor IS NULL OR actor IS DISTINCT FROM p_actor_esperado THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NO_AUTORIZADO';
    END IF;
    IF nombre IS NULL OR char_length(nombre) NOT BETWEEN 2 AND 100
       OR p_nombre_visible ~ '[[:cntrl:]<>]'
       OR p_universidad_id IS NULL OR p_campus_id IS NULL
       OR p_version_esperada IS NULL OR p_version_esperada < 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDACION';
    END IF;

    PERFORM 1 FROM public.universidades u WHERE u.id = p_universidad_id AND u.activa FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDACION';
    END IF;
    PERFORM 1 FROM public.campus c
        WHERE c.id = p_campus_id AND c.universidad_id = p_universidad_id AND c.activo FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDACION';
    END IF;

    RETURN QUERY
        UPDATE public.perfiles p
        SET nombre_visible = nombre, campus_id = p_campus_id,
            actualizado_en = GREATEST(p.actualizado_en, pg_catalog.clock_timestamp()), version = p.version + 1
        WHERE p.id = actor AND p.version = p_version_esperada
        RETURNING p.id, p.nombre_visible, p.campus_id, p.vendedor_activado, p.creado_en, p.actualizado_en, p.version;
    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = actor) THEN
            RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'CONFLICTO';
        END IF;
        RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'NO_ENCONTRADO';
    END IF;
END;
$funcion$;

REVOKE ALL ON FUNCTION public.actualizar_mi_perfil(text, uuid, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_mi_perfil(text, uuid, uuid, integer, uuid) TO authenticated;
-- Las ACL por defecto del proyecto pueden conceder EXECUTE a otros roles.
DO $permisos$
DECLARE
    permiso record;
BEGIN
    FOR permiso IN
        SELECT p.oid::regprocedure AS funcion, r.rolname
        FROM pg_catalog.pg_proc p
        CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) acl
        JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
        WHERE p.oid IN (
            'public.actualizar_mi_perfil(text,uuid,uuid,integer,uuid)'::regprocedure,
            'tb4_perfiles_privado.actor_confirmado()'::regprocedure
        )
          AND acl.grantee <> p.proowner
          AND NOT (p.pronamespace = 'public'::regnamespace AND r.rolname = 'authenticated')
          AND NOT (p.pronamespace = 'tb4_perfiles_privado'::regnamespace AND r.rolname = 'tb4_editor_perfil')
    LOOP
        EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %s FROM %I CASCADE', permiso.funcion, permiso.rolname);
    END LOOP;

    IF pg_catalog.has_function_privilege('anon',
           'public.actualizar_mi_perfil(text,uuid,uuid,integer,uuid)', 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon',
           'tb4_perfiles_privado.actor_confirmado()', 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated',
           'tb4_perfiles_privado.actor_confirmado()', 'EXECUTE')
       OR pg_catalog.has_schema_privilege('anon', 'tb4_perfiles_privado', 'USAGE')
       OR pg_catalog.has_schema_privilege('authenticated', 'tb4_perfiles_privado', 'USAGE')
       OR pg_catalog.has_schema_privilege('tb4_editor_perfil', 'auth', 'USAGE')
       OR pg_catalog.has_schema_privilege('tb4_editor_perfil', 'public', 'CREATE')
       OR pg_catalog.has_any_column_privilege('tb4_editor_perfil', 'auth.users', 'SELECT,INSERT,UPDATE,REFERENCES')
       OR pg_catalog.has_table_privilege('tb4_editor_perfil', 'auth.users', 'DELETE,TRUNCATE,TRIGGER') THEN
        RAISE EXCEPTION 'Conciliar permisos efectivos antes de desplegar perfiles';
    END IF;
END;
$permisos$;

-- PostgreSQL requiere CREATE en el esquema para transferir la propiedad.
GRANT tb4_editor_perfil TO CURRENT_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO tb4_editor_perfil;
ALTER FUNCTION public.actualizar_mi_perfil(text, uuid, uuid, integer, uuid) OWNER TO tb4_editor_perfil;
REVOKE CREATE ON SCHEMA public FROM tb4_editor_perfil;
REVOKE tb4_editor_perfil FROM CURRENT_USER;

DO $membresia$
BEGIN
    IF pg_catalog.pg_has_role(current_user, 'tb4_editor_perfil', 'SET')
       OR pg_catalog.pg_has_role(current_user, 'tb4_editor_perfil', 'USAGE') THEN
        RAISE EXCEPTION 'La sesion migradora conserva acceso efectivo al rol editor';
    END IF;
END;
$membresia$;

COMMIT;
