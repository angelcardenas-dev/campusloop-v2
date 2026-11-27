-- Directorios ratificados. Una sentencia atómica; Supabase CLI gestiona el historial.
DO $directorios$
DECLARE
    fila record;
BEGIN
    FOR fila IN SELECT * FROM (VALUES
        ('5a5623f3-6f07-4f15-97b8-2061cd5c61b3'::uuid, 'Pontificia Universidad Católica del Perú', 'PUCP'),
        ('486a935d-f0f9-4437-891e-62bc48bde10a'::uuid, 'Universidad Peruana de Ciencias Aplicadas', 'UPC'),
        ('035d83f5-bf9d-4032-90e2-abd7a2172159'::uuid, 'Universidad Nacional Mayor de San Marcos', 'UNMSM'),
        ('6ab6b6a8-0f6b-4149-8036-30a56eba20ba'::uuid, 'Universidad de Lima', 'ULIMA')
    ) AS datos(id, nombre, sigla) LOOP
        INSERT INTO public.universidades (id, nombre, sigla)
        VALUES (fila.id, fila.nombre, fila.sigla)
        ON CONFLICT (id) DO NOTHING;
        IF NOT EXISTS (
            SELECT FROM public.universidades u
            WHERE u.id = fila.id AND u.nombre = fila.nombre AND u.sigla = fila.sigla
        ) THEN
            RAISE EXCEPTION 'UUID de universidad ya asociado a otra identidad: %', fila.id;
        END IF;
    END LOOP;

    FOR fila IN SELECT * FROM (VALUES
        ('6fc0d006-f5ec-4936-ab83-a15ef417c648'::uuid, '5a5623f3-6f07-4f15-97b8-2061cd5c61b3'::uuid, 'San Miguel', 'San Miguel', 'Lima'),
        ('82d7186a-920c-49e2-bcc5-9aaa03ad655e'::uuid, '486a935d-f0f9-4437-891e-62bc48bde10a'::uuid, 'Monterrico', 'Santiago de Surco', 'Lima'),
        ('105fb795-dc41-4f56-8dce-baa386d3b021'::uuid, '035d83f5-bf9d-4032-90e2-abd7a2172159'::uuid, 'Campus Central', 'Lima (Cercado de Lima)', 'Lima'),
        ('8214f236-d4ba-4b94-bcfe-bb029136a5cd'::uuid, '6ab6b6a8-0f6b-4149-8036-30a56eba20ba'::uuid, 'Surco', 'Santiago de Surco', 'Lima')
    ) AS datos(id, universidad_id, nombre, distrito, ciudad) LOOP
        INSERT INTO public.campus (id, universidad_id, nombre, distrito, ciudad)
        VALUES (fila.id, fila.universidad_id, fila.nombre, fila.distrito, fila.ciudad)
        ON CONFLICT (id) DO NOTHING;
        PERFORM 1 FROM public.campus WHERE id = fila.id FOR UPDATE;
        IF NOT EXISTS (
            SELECT FROM public.campus c
            WHERE c.id = fila.id AND c.universidad_id = fila.universidad_id AND c.nombre = fila.nombre
        ) THEN
            RAISE EXCEPTION 'UUID de campus ya asociado a otra identidad: %', fila.id;
        END IF;

        IF EXISTS (
            SELECT FROM public.campus c
            WHERE c.id = fila.id
              AND ((c.distrito IS NOT NULL AND c.distrito <> fila.distrito)
                   OR (c.ciudad IS NOT NULL AND c.ciudad <> fila.ciudad))
        ) THEN
            RAISE EXCEPTION 'Ubicación existente incompatible para campus %', fila.id;
        END IF;

        UPDATE public.campus c
        SET distrito = coalesce(c.distrito, fila.distrito),
            ciudad = coalesce(c.ciudad, fila.ciudad)
        WHERE c.id = fila.id AND (c.distrito IS NULL OR c.ciudad IS NULL);
    END LOOP;

    FOR fila IN SELECT * FROM (VALUES
        ('7065c00d-bfe8-4460-ae0c-6978fd7107d9'::uuid, 'Académico', 'Materiales y artículos de estudio', 1),
        ('cfc40a13-ce57-4532-969c-e21bd6737216'::uuid, 'Tecnológico', 'Equipos y accesorios tecnológicos', 2),
        ('27193cb6-fcc8-49f4-9992-0adcc2ec1b25'::uuid, 'Entretenimiento', 'Artículos de ocio y entretenimiento', 3)
    ) AS datos(id, nombre, descripcion, orden) LOOP
        INSERT INTO public.categorias (id, nombre, descripcion, orden)
        VALUES (fila.id, fila.nombre, fila.descripcion, fila.orden)
        ON CONFLICT (id) DO NOTHING;
        IF NOT EXISTS (
            SELECT FROM public.categorias c
            WHERE c.id = fila.id AND c.nombre = fila.nombre
        ) THEN
            RAISE EXCEPTION 'UUID de categoría ya asociado a otra identidad: %', fila.id;
        END IF;
    END LOOP;
END;
$directorios$;
