-- Ejecutar antes del ROLLBACK de PROPUESTA_SEGURIDAD_TB4.sql, en el clúster aislado.
INSERT INTO auth.users (id) VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO public.universidades (id, nombre, sigla)
VALUES ('00000000-0000-4000-8000-000000000002', 'Universidad sintética', 'SINT');
INSERT INTO public.campus (id, universidad_id, nombre)
VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Campus sintético');
INSERT INTO public.categorias (id, nombre)
VALUES ('00000000-0000-4000-8000-000000000004', 'Categoría sintética');
INSERT INTO public.articulos (vendedor_id, titulo, descripcion, categoria_id, condicion,
    precio_centimos, campus_id, imagen_bucket, imagen_ruta, imagen_url,
    imagen_formato, imagen_bytes, imagen_ancho, imagen_alto)
VALUES ('00000000-0000-4000-8000-000000000001', 'Artículo sintético', 'Prueba RLS',
    '00000000-0000-4000-8000-000000000004', 'nuevo', 100,
    '00000000-0000-4000-8000-000000000003', 'articulos',
    '00000000-0000-4000-8000-000000000001/prueba.png',
    'https://example.invalid/prueba.png', 'image/png', 1, 1, 1);

SET LOCAL ROLE anon;
DO $prueba$
BEGIN
    IF (SELECT count(id) FROM public.campus) <> 1 THEN
        RAISE EXCEPTION 'Registro debe poder leer el directorio activo';
    END IF;
    BEGIN
        PERFORM id FROM public.articulos;
        RAISE EXCEPTION 'El visitante pudo leer artículos';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$prueba$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $prueba$
DECLARE
    caso record;
BEGIN
    FOR caso IN SELECT * FROM (VALUES
        ('{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}', 1),
        ('{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":true,"user_metadata":{"is_anonymous":false}}', 0),
        ('{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":"false"}', 0),
        ('{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":null}', 0),
        ('{"sub":"00000000-0000-4000-8000-000000000001"}', 0),
        ('{"is_anonymous":false}', 0)
    ) AS casos(claims, esperado)
    LOOP
        PERFORM set_config('request.jwt.claims', caso.claims, true);
        IF (SELECT count(id) FROM public.articulos) <> caso.esperado THEN
            RAISE EXCEPTION 'Visibilidad incorrecta para %', caso.claims;
        END IF;
    END LOOP;
    PERFORM set_config('request.jwt.claims',
        '{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}', true);
    BEGIN
        UPDATE public.perfiles SET vendedor_activado = true;
        RAISE EXCEPTION 'El titular pudo activar su perfil vendedor';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$prueba$;
RESET ROLE;
