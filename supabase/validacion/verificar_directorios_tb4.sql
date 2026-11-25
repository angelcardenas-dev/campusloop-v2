-- Consultas de solo lectura después de aplicar la quinta migración.
BEGIN READ ONLY;

DO $verificar$
BEGIN
    IF EXISTS (
        SELECT FROM (VALUES
            ('5a5623f3-6f07-4f15-97b8-2061cd5c61b3'::uuid, 'Pontificia Universidad Católica del Perú', 'PUCP'),
            ('486a935d-f0f9-4437-891e-62bc48bde10a'::uuid, 'Universidad Peruana de Ciencias Aplicadas', 'UPC'),
            ('035d83f5-bf9d-4032-90e2-abd7a2172159'::uuid, 'Universidad Nacional Mayor de San Marcos', 'UNMSM'),
            ('6ab6b6a8-0f6b-4149-8036-30a56eba20ba'::uuid, 'Universidad de Lima', 'ULIMA')
        ) AS esperado(id, nombre, sigla)
        LEFT JOIN public.universidades u USING (id, nombre, sigla)
        WHERE u.id IS NULL
    ) OR EXISTS (
        SELECT FROM (VALUES
            ('6fc0d006-f5ec-4936-ab83-a15ef417c648'::uuid, '5a5623f3-6f07-4f15-97b8-2061cd5c61b3'::uuid, 'San Miguel', 'San Miguel', 'Lima'),
            ('82d7186a-920c-49e2-bcc5-9aaa03ad655e'::uuid, '486a935d-f0f9-4437-891e-62bc48bde10a'::uuid, 'Monterrico', 'Santiago de Surco', 'Lima'),
            ('105fb795-dc41-4f56-8dce-baa386d3b021'::uuid, '035d83f5-bf9d-4032-90e2-abd7a2172159'::uuid, 'Campus Central', 'Lima (Cercado de Lima)', 'Lima'),
            ('8214f236-d4ba-4b94-bcfe-bb029136a5cd'::uuid, '6ab6b6a8-0f6b-4149-8036-30a56eba20ba'::uuid, 'Surco', 'Santiago de Surco', 'Lima')
        ) AS esperado(id, universidad_id, nombre, distrito, ciudad)
        LEFT JOIN public.campus c USING (id, universidad_id, nombre, distrito, ciudad)
        WHERE c.id IS NULL
    ) OR EXISTS (
        SELECT FROM (VALUES
            ('7065c00d-bfe8-4460-ae0c-6978fd7107d9'::uuid, 'Académico'),
            ('cfc40a13-ce57-4532-969c-e21bd6737216'::uuid, 'Tecnológico'),
            ('27193cb6-fcc8-49f4-9992-0adcc2ec1b25'::uuid, 'Entretenimiento')
        ) AS esperado(id, nombre)
        LEFT JOIN public.categorias c USING (id, nombre)
        WHERE c.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Faltan identidades, relaciones o ubicaciones del directorio aprobado';
    END IF;
END;
$verificar$;

-- Las filas desactivadas por administración se preservan y RLS las oculta.
SET LOCAL ROLE anon;
SELECT id, nombre, sigla FROM public.universidades ORDER BY nombre, id;
SELECT id, universidad_id, nombre, distrito, ciudad
FROM public.campus ORDER BY nombre, id;
SELECT id, nombre, descripcion, orden FROM public.categorias ORDER BY orden, nombre, id;

SET LOCAL ROLE authenticated;
SELECT id, nombre, sigla FROM public.universidades ORDER BY nombre, id;
SELECT id, universidad_id, nombre, distrito, ciudad
FROM public.campus ORDER BY nombre, id;
SELECT id, nombre, descripcion, orden FROM public.categorias ORDER BY orden, nombre, id;

RESET ROLE;
ROLLBACK;
