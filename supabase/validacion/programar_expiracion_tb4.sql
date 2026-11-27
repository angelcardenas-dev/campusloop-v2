-- Ejecutar unicamente en el proyecto autorizado, como propietario del esquema privado.
-- Requiere Supabase Cron/pg_cron ya habilitado. No instalar la extension aqui.
SELECT cron.schedule('tb4-expirar-reservas-pendientes','* * * * *',
  'SELECT tb4_reservas_privado.expirar_pendientes();');
-- Examinar en el Dashboard el resultado de los primeros ciclos y alertar errores.
