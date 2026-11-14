-- FASE 3 / Etapa A. Aplicar solo después de 20261113000100_tablas_tb4.sql.
BEGIN;

CREATE UNIQUE INDEX universidades_nombre_normalizado_uq ON public.universidades (lower(btrim(nombre)));
CREATE UNIQUE INDEX universidades_sigla_normalizada_uq ON public.universidades (lower(btrim(sigla)));
-- El prefijo universidad_id también sirve como índice de la FK.
CREATE UNIQUE INDEX campus_universidad_nombre_uq ON public.campus (universidad_id, lower(btrim(nombre)));
CREATE UNIQUE INDEX categorias_nombre_normalizado_uq ON public.categorias (lower(btrim(nombre)));
CREATE INDEX categorias_orden_idx ON public.categorias (orden, nombre, id) WHERE activa;

CREATE INDEX perfiles_campus_idx ON public.perfiles (campus_id);
CREATE INDEX articulos_vendedor_idx ON public.articulos (vendedor_id, creado_en DESC, id);
CREATE INDEX articulos_categoria_idx ON public.articulos (categoria_id);
CREATE INDEX articulos_campus_idx ON public.articulos (campus_id);
CREATE INDEX articulos_catalogo_fecha_idx ON public.articulos (creado_en DESC, id) WHERE eliminado_en IS NULL;
CREATE INDEX articulos_catalogo_estado_idx ON public.articulos (estado, creado_en DESC, id) WHERE eliminado_en IS NULL;
CREATE INDEX articulos_catalogo_precio_idx ON public.articulos (precio_centimos, id) WHERE eliminado_en IS NULL;
-- Búsqueda de texto española sin extensión adicional. La sintaxis REST se revisará con el servicio.
CREATE INDEX articulos_busqueda_idx ON public.articulos USING gin (
    to_tsvector('spanish'::regconfig, titulo || ' ' || descripcion)
) WHERE eliminado_en IS NULL;

-- UNIQUE (articulo_id, comprador_id, vendedor_id) ya cubre consultas/FK por articulo_id.
CREATE INDEX conversaciones_comprador_idx ON public.conversaciones (comprador_id, creado_en DESC, id);
CREATE INDEX conversaciones_vendedor_idx ON public.conversaciones (vendedor_id, creado_en DESC, id);
CREATE INDEX mensajes_historial_idx ON public.mensajes (conversacion_id, creado_en, id);
CREATE INDEX mensajes_remitente_idx ON public.mensajes (remitente_id);
CREATE INDEX lugares_publicos_campus_idx ON public.lugares_publicos (campus_id);

-- Garantiza como máximo una reserva activa por artículo incluso con INSERT concurrente.
-- No sustituye el bloqueo/RPC de Etapa B que sincroniza el estado del artículo.
CREATE UNIQUE INDEX reservas_articulo_activo_uq ON public.reservas (articulo_id)
    WHERE estado IN ('pendiente', 'confirmada');
CREATE INDEX reservas_articulo_historial_idx ON public.reservas (articulo_id, creado_en DESC, id);
CREATE INDEX reservas_comprador_idx ON public.reservas (comprador_id, creado_en DESC, id);
CREATE INDEX reservas_vendedor_idx ON public.reservas (vendedor_id, creado_en DESC, id);
CREATE INDEX reservas_conversacion_idx ON public.reservas (conversacion_id) WHERE conversacion_id IS NOT NULL;
CREATE INDEX reservas_lugar_idx ON public.reservas (lugar_publico_id) WHERE lugar_publico_id IS NOT NULL;
CREATE INDEX reservas_proponente_idx ON public.reservas (punto_propuesto_por) WHERE punto_propuesto_por IS NOT NULL;

COMMIT;
