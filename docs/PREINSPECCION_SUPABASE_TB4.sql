-- Ejecutar en SQL Editor solo tras confirmar el proyecto de desarrollo.
-- Comprobar la existencia y el permiso antes de consultar las secciones opcionales.
BEGIN READ ONLY;
WITH objetos(nombre) AS (VALUES
    ('supabase_migrations.schema_migrations'), ('storage.buckets')
)
SELECT nombre, to_regclass(nombre) IS NOT NULL AS existe,
       has_table_privilege(to_regclass(nombre), 'SELECT') AS puede_leer
FROM objetos;

-- Definición de vistas y detalle del disparador son parte de la conciliación.
-- Revisar la salida en privado antes de compartirla.
SELECT c.oid::regclass AS vista, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm');

SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = to_regclass('auth.users')
  AND tgname = 'crear_perfil_minimo_tras_registro';
ROLLBACK;

-- Si existe el historial y hay permiso, ejecutar por separado:
-- BEGIN READ ONLY;
-- SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- ROLLBACK;
--
-- Luego ejecutar INSPECCION_SEGURIDAD_TB4.sql. Si storage.buckets no existe
-- o no es legible, omitir solo su consulta final y conservar ROLLBACK.
