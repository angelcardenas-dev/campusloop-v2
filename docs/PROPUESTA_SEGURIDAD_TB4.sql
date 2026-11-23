-- BORRADOR DE REVISIÓN. Fuera de migraciones. Requiere autorización separada.
-- Revisar primero ACL, propietarios, membresías, vistas/RPC y esquema expuesto.
-- El cierre es ROLLBACK. Una eventual migración aprobada debe prepararse aparte.
BEGIN;

ALTER TABLE public.universidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugares_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DO $revision$
DECLARE
    tabla record;
    rol text;
BEGIN
    -- Conservar la inserción del trigger Auth bajo el propietario controlado.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_class c ON c.oid = 'public.perfiles'::regclass
        WHERE t.tgrelid = 'auth.users'::regclass
          AND t.tgname = 'crear_perfil_minimo_tras_registro'
          AND t.tgenabled IN ('O', 'A')
          AND p.oid = 'public.crear_perfil_minimo_auth()'::regprocedure
          AND p.prosecdef AND p.proowner = c.relowner AND NOT c.relforcerowsecurity
    ) THEN
        RAISE EXCEPTION 'Revisar propietario y contexto del trigger de perfiles antes de continuar';
    END IF;

    FOR tabla IN
        SELECT c.oid, c.relname, c.relowner, string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) AS columnas
        FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relname IN ('universidades', 'campus', 'categorias', 'perfiles', 'articulos',
                            'conversaciones', 'mensajes', 'lugares_publicos', 'reservas')
          AND a.attnum > 0 AND NOT a.attisdropped
        GROUP BY c.oid, c.relname, c.relowner
    LOOP
        IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = tabla.oid) THEN
            RAISE EXCEPTION 'Conciliar políticas existentes en %', tabla.relname;
        END IF;
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', tabla.relname);
        EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
                       tabla.columnas, tabla.relname);
        FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol AND (rolsuper OR rolbypassrls))
                OR pg_has_role(rol, tabla.relowner, 'MEMBER')
                OR has_table_privilege(rol, tabla.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                OR has_any_column_privilege(rol, tabla.oid, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
                RAISE EXCEPTION 'Conciliar acceso efectivo de % a %', rol, tabla.relname;
            END IF;
        END LOOP;
    END LOOP;
END;
$revision$;

REVOKE ALL ON FUNCTION public.crear_perfil_minimo_auth() FROM PUBLIC, anon, authenticated;
DO $revision$
BEGIN
    IF has_function_privilege('anon', 'public.crear_perfil_minimo_auth()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.crear_perfil_minimo_auth()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Conciliar EXECUTE heredado del trigger Auth';
    END IF;
END;
$revision$;

GRANT SELECT (id, nombre, sigla) ON public.universidades TO anon, authenticated;
GRANT SELECT (id, universidad_id, nombre, distrito, ciudad) ON public.campus TO anon, authenticated;
GRANT SELECT (id, nombre, descripcion, orden) ON public.categorias TO anon, authenticated;
GRANT SELECT (id, campus_id, nombre, referencia_publica) ON public.lugares_publicos TO anon, authenticated;
GRANT SELECT (id, vendedor_id, titulo, descripcion, categoria_id, condicion, precio_centimos, moneda,
              campus_id, imagen_bucket, imagen_ruta, imagen_url, imagen_formato, imagen_bytes,
              imagen_ancho, imagen_alto, estado, eliminado_en, creado_en, actualizado_en, version)
ON public.articulos TO authenticated;

-- El REVOKE previo incluye PUBLIC y ACL de columna. Comprobar también herencia
-- después del GRANT: anon no debe recuperar SELECT por membresías inesperadas.
DO $revision$
BEGIN
    IF has_table_privilege('anon', 'public.articulos', 'SELECT')
       OR has_any_column_privilege('anon', 'public.articulos', 'SELECT') THEN
        RAISE EXCEPTION 'Conciliar SELECT efectivo de anon sobre articulos antes de continuar';
    END IF;
END;
$revision$;

CREATE POLICY universidades_lectura_activa ON public.universidades
    FOR SELECT TO anon, authenticated USING (activa);
CREATE POLICY campus_lectura_activa ON public.campus
    FOR SELECT TO anon, authenticated USING (
        activo AND EXISTS (SELECT 1 FROM public.universidades u WHERE u.id = campus.universidad_id)
    );
CREATE POLICY categorias_lectura_activa ON public.categorias
    FOR SELECT TO anon, authenticated USING (activa);
CREATE POLICY lugares_lectura_activa ON public.lugares_publicos
    FOR SELECT TO anon, authenticated USING (
        activo AND (campus_id IS NULL OR EXISTS (SELECT 1 FROM public.campus c WHERE c.id = lugares_publicos.campus_id))
    );
CREATE POLICY articulos_lectura_catalogo ON public.articulos
    FOR SELECT TO authenticated USING (
        (SELECT auth.uid()) IS NOT NULL
        AND ((SELECT auth.jwt() -> 'is_anonymous') = 'false'::jsonb) IS TRUE
        AND eliminado_en IS NULL AND estado IN ('disponible', 'reservado', 'vendido')
    );
-- Nueva guarda propuesta: las políticas permisivas se combinan por OR.
-- Esta condición restrictiva sigue siendo obligatoria para authenticated.
-- Exigir el booleano JSON false rechaza true, null, ausencia, cadenas y otros
-- tipos; nunca se toma user_metadata como autoridad ni se exige ser vendedor.
CREATE POLICY articulos_lectura_sesion_registrada ON public.articulos
    AS RESTRICTIVE FOR SELECT TO authenticated USING (
        (SELECT auth.uid()) IS NOT NULL
        AND ((SELECT auth.jwt() -> 'is_anonymous') = 'false'::jsonb) IS TRUE
    );

GRANT SELECT (id, nombre_visible, campus_id, vendedor_activado, creado_en, actualizado_en, version)
ON public.perfiles TO authenticated;
-- El primer alcance habilita lectura propia. Edición de nombre/campus requiere
-- acordar validación de campus y gestión de actualizado_en y version.
CREATE POLICY perfiles_lectura_propia ON public.perfiles
    FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

GRANT SELECT (id, articulo_id, comprador_id, vendedor_id, creado_en)
ON public.conversaciones TO authenticated;
GRANT SELECT (id, conversacion_id, remitente_id, texto, creado_en)
ON public.mensajes TO authenticated;
GRANT SELECT (id, articulo_id, comprador_id, vendedor_id, conversacion_id, estado, lugar_publico_id,
              lugar_personalizado_nombre, lugar_referencia_publica, punto_propuesto_por, estado_punto,
              creado_en, actualizado_en, version)
ON public.reservas TO authenticated;
CREATE POLICY conversaciones_lectura_participantes ON public.conversaciones
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (comprador_id, vendedor_id));
CREATE POLICY mensajes_lectura_participantes ON public.mensajes
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.conversaciones c WHERE c.id = mensajes.conversacion_id)
    );
CREATE POLICY reservas_lectura_participantes ON public.reservas
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (comprador_id, vendedor_id));

-- DML navegador cerrado. El trigger existente es la única alta ordinaria de perfiles.
-- Escrituras de artículos, conversaciones, mensajes, reservas y revisión requieren
-- contratos separados con identidad Auth, columnas acotadas y WITH CHECK/RPC.
-- No conceder a revisores DML de tabla ni conceder privilegios nuevos a service_role.
-- Storage: conciliar políticas reales antes de proponer DDL en storage.objects.
-- Fotografía pública solo tras aprobar bucket, privacidad y validación del objeto.
-- Activación: expedientes/revisores/notificaciones no existen en el esquema base.
ROLLBACK;
