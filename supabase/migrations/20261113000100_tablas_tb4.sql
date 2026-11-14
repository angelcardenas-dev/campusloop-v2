-- FASE 3 / Etapa A: estructura para revisión; NO aplicar al proyecto compartido.
-- Requiere PostgreSQL con gen_random_uuid() y Supabase Auth ya existente.
-- Seguridad, triggers y RPC se implementarán después de aprobación (Etapa B).
-- Sin IF NOT EXISTS: una colisión de objetos debe detener la migración.
BEGIN;

CREATE TABLE public.universidades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    sigla text NOT NULL,
    activa boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT universidades_nombre_valido CHECK (
        nombre = btrim(nombre) AND char_length(nombre) BETWEEN 3 AND 150
        AND nombre !~ '[[:cntrl:]]'),
    CONSTRAINT universidades_sigla_valida CHECK (
        sigla = btrim(sigla) AND char_length(sigla) BETWEEN 2 AND 20
        AND sigla !~ '[[:cntrl:]]')
);

CREATE TABLE public.campus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    universidad_id uuid NOT NULL REFERENCES public.universidades(id) ON DELETE RESTRICT,
    nombre text NOT NULL,
    distrito text,
    ciudad text,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT campus_nombre_valido CHECK (
        nombre = btrim(nombre) AND char_length(nombre) BETWEEN 2 AND 100
        AND nombre !~ '[[:cntrl:]]'),
    CONSTRAINT campus_distrito_valido CHECK (distrito IS NULL OR (
        distrito = btrim(distrito) AND char_length(distrito) BETWEEN 2 AND 100
        AND distrito !~ '[[:cntrl:]]')),
    CONSTRAINT campus_ciudad_valida CHECK (ciudad IS NULL OR (
        ciudad = btrim(ciudad) AND char_length(ciudad) BETWEEN 2 AND 100
        AND ciudad !~ '[[:cntrl:]]'))
);

CREATE TABLE public.categorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    activa boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 0,
    CONSTRAINT categorias_nombre_valido CHECK (
        nombre = btrim(nombre) AND char_length(nombre) BETWEEN 2 AND 100
        AND nombre !~ '[[:cntrl:]]'),
    CONSTRAINT categorias_descripcion_valida CHECK (descripcion IS NULL OR (
        descripcion = btrim(descripcion) AND char_length(descripcion) BETWEEN 1 AND 300
        AND descripcion !~ '[[:cntrl:]]')),
    CONSTRAINT categorias_orden_valido CHECK (orden >= 0)
);

CREATE TABLE public.perfiles (
    -- Sin DEFAULT: identidad exclusivamente de Supabase Auth.
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    nombre_visible text,
    campus_id uuid REFERENCES public.campus(id) ON DELETE RESTRICT,
    vendedor_activado boolean NOT NULL DEFAULT false,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT perfiles_nombre_valido CHECK (nombre_visible IS NULL OR (
        nombre_visible = btrim(nombre_visible)
        AND char_length(nombre_visible) BETWEEN 2 AND 100
        AND nombre_visible !~ '[[:cntrl:]<>]')),
    CONSTRAINT perfiles_version_valida CHECK (version > 0),
    CONSTRAINT perfiles_fechas_validas CHECK (actualizado_en >= creado_en)
);

CREATE TABLE public.articulos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
    condicion text NOT NULL,
    precio_centimos bigint NOT NULL,
    moneda text NOT NULL DEFAULT 'PEN',
    campus_id uuid NOT NULL REFERENCES public.campus(id) ON DELETE RESTRICT,
    -- Una fotografía; no crea ni modifica buckets/objetos de Storage.
    imagen_bucket text NOT NULL,
    imagen_ruta text NOT NULL,
    imagen_url text NOT NULL,
    imagen_formato text NOT NULL,
    imagen_bytes bigint NOT NULL,
    imagen_ancho integer NOT NULL,
    imagen_alto integer NOT NULL,
    estado text NOT NULL DEFAULT 'disponible',
    eliminado_en timestamptz,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT articulos_titulo_valido CHECK (
        titulo = btrim(titulo) AND char_length(titulo) BETWEEN 1 AND 100
        AND titulo !~ '[[:cntrl:]]'),
    CONSTRAINT articulos_descripcion_valida CHECK (
        descripcion = btrim(descripcion) AND char_length(descripcion) BETWEEN 1 AND 1000),
    CONSTRAINT articulos_condicion_valida CHECK (
        condicion IN ('nuevo', 'como_nuevo', 'buen_estado', 'usado')),
    CONSTRAINT articulos_precio_positivo CHECK (precio_centimos > 0),
    CONSTRAINT articulos_moneda_pen CHECK (moneda = 'PEN'),
    CONSTRAINT articulos_estado_valido CHECK (estado IN ('disponible', 'reservado', 'vendido')),
    CONSTRAINT articulos_version_valida CHECK (version > 0),
    CONSTRAINT articulos_fechas_validas CHECK (
        actualizado_en >= creado_en AND (eliminado_en IS NULL OR eliminado_en >= creado_en)),
    CONSTRAINT articulos_bucket_valido CHECK (
        char_length(imagen_bucket) BETWEEN 1 AND 100
        AND imagen_bucket ~ '^[a-z0-9][a-z0-9_-]*$'),
    CONSTRAINT articulos_ruta_propia CHECK (
        char_length(imagen_ruta) BETWEEN 1 AND 500
        AND split_part(imagen_ruta, '/', 1) = vendedor_id::text
        AND imagen_ruta ~ '^[0-9a-f-]+/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'),
    -- Solo validación estructural; origen real y objeto se validarán en Etapa B/servicios.
    CONSTRAINT articulos_url_https CHECK (
        char_length(imagen_url) BETWEEN 10 AND 2048
        AND imagen_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/[^[:space:]?#]+$'
        AND imagen_url !~ '[[:cntrl:]]'),
    CONSTRAINT articulos_formato_valido CHECK (imagen_formato IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT articulos_extension_coherente CHECK (
        (imagen_formato = 'image/jpeg' AND imagen_ruta ~ '\.(jpg|jpeg)$') OR
        (imagen_formato = 'image/png' AND imagen_ruta ~ '\.png$') OR
        (imagen_formato = 'image/webp' AND imagen_ruta ~ '\.webp$')),
    CONSTRAINT articulos_imagen_dimensiones CHECK (
        imagen_bytes > 0 AND imagen_ancho > 0 AND imagen_alto > 0),
    -- Clave candidata para comprobar vendedor de conversaciones/reservas por FK.
    CONSTRAINT articulos_id_vendedor_unico UNIQUE (id, vendedor_id)
);

CREATE TABLE public.conversaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    articulo_id uuid NOT NULL,
    comprador_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    vendedor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    creado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversaciones_participantes_distintos CHECK (comprador_id <> vendedor_id),
    CONSTRAINT conversaciones_articulo_vendedor_fk FOREIGN KEY (articulo_id, vendedor_id)
        REFERENCES public.articulos(id, vendedor_id) ON DELETE RESTRICT,
    CONSTRAINT conversaciones_participantes_unicos UNIQUE (articulo_id, comprador_id, vendedor_id),
    -- Permite comprobar que una reserva apunta al mismo artículo y participantes.
    CONSTRAINT conversaciones_contexto_unico UNIQUE (id, articulo_id, comprador_id, vendedor_id)
);

CREATE TABLE public.mensajes (
    -- El cliente puede aportar UUID idempotente; el remitente se autorizará en Etapa B.
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id uuid NOT NULL REFERENCES public.conversaciones(id) ON DELETE RESTRICT,
    remitente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    texto text NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mensajes_texto_valido CHECK (
        texto = btrim(texto) AND char_length(texto) BETWEEN 1 AND 1000)
);

CREATE TABLE public.lugares_publicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Decisión del usuario: lugares externos admitidos. Formalización SPEC pendiente.
    campus_id uuid REFERENCES public.campus(id) ON DELETE RESTRICT,
    nombre text NOT NULL,
    referencia_publica text,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT lugares_nombre_valido CHECK (
        nombre = btrim(nombre) AND char_length(nombre) BETWEEN 3 AND 100
        AND nombre !~ '[[:cntrl:]<>]'),
    CONSTRAINT lugares_referencia_valida CHECK (referencia_publica IS NULL OR (
        referencia_publica = btrim(referencia_publica)
        AND char_length(referencia_publica) BETWEEN 1 AND 150
        AND referencia_publica !~ '[[:cntrl:]<>]'))
);

CREATE TABLE public.reservas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    articulo_id uuid NOT NULL,
    comprador_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    vendedor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    conversacion_id uuid,
    estado text NOT NULL DEFAULT 'pendiente',
    lugar_publico_id uuid REFERENCES public.lugares_publicos(id) ON DELETE RESTRICT,
    lugar_personalizado_nombre text,
    lugar_referencia_publica text,
    punto_propuesto_por uuid REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    estado_punto text NOT NULL DEFAULT 'sin_proponer',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT reservas_articulo_vendedor_fk FOREIGN KEY (articulo_id, vendedor_id)
        REFERENCES public.articulos(id, vendedor_id) ON DELETE RESTRICT,
    -- MATCH SIMPLE: solo conversacion_id puede ser NULL; al estar presente se exige toda la tupla.
    CONSTRAINT reservas_conversacion_contexto_fk
        FOREIGN KEY (conversacion_id, articulo_id, comprador_id, vendedor_id)
        REFERENCES public.conversaciones(id, articulo_id, comprador_id, vendedor_id) ON DELETE RESTRICT,
    CONSTRAINT reservas_participantes_distintos CHECK (comprador_id <> vendedor_id),
    CONSTRAINT reservas_estado_valido CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    CONSTRAINT reservas_version_valida CHECK (version > 0),
    CONSTRAINT reservas_fechas_validas CHECK (actualizado_en >= creado_en),
    CONSTRAINT reservas_nombre_punto_valido CHECK (lugar_personalizado_nombre IS NULL OR (
        lugar_personalizado_nombre = btrim(lugar_personalizado_nombre)
        AND char_length(lugar_personalizado_nombre) BETWEEN 3 AND 100
        AND lugar_personalizado_nombre !~ '[[:cntrl:]<>]')),
    CONSTRAINT reservas_referencia_valida CHECK (lugar_referencia_publica IS NULL OR (
        lugar_referencia_publica = btrim(lugar_referencia_publica)
        AND char_length(lugar_referencia_publica) BETWEEN 1 AND 150
        AND lugar_referencia_publica !~ '[[:cntrl:]<>]')),
    CONSTRAINT reservas_proponente_participante CHECK (
        punto_propuesto_por IS NULL OR punto_propuesto_por IN (comprador_id, vendedor_id)),
    -- Explicitar IS NOT NULL evita aceptar datos incompletos por CHECK = UNKNOWN.
    CONSTRAINT reservas_punto_coherente CHECK (
        (estado_punto = 'sin_proponer' AND lugar_publico_id IS NULL
            AND lugar_personalizado_nombre IS NULL AND lugar_referencia_publica IS NULL
            AND punto_propuesto_por IS NULL)
        OR
        (estado_punto IN ('propuesto', 'aceptado') AND punto_propuesto_por IS NOT NULL
            AND (
                (lugar_publico_id IS NOT NULL AND lugar_personalizado_nombre IS NULL)
                OR
                (lugar_publico_id IS NULL AND lugar_personalizado_nombre IS NOT NULL
                    AND lugar_referencia_publica IS NOT NULL)
            ))
    )
);

COMMIT;
