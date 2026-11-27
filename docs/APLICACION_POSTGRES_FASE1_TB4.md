# Aplicación inicial de PostgreSQL TB4

## Destino y evidencia

### Fase 1 aplicada en Supabase

El responsable confirmó la instalación en CampusLoop (`xxatvftmozlpqehhvgpv`): nueve tablas creadas con RLS habilitado, diez políticas y GRANTS de lectura por columna comprobados. La escritura directa quedó denegada para `anon` y `authenticated`. Pasaron la verificación independiente de estructura, permisos, índice de reservas y trigger de perfiles. El historial local y remoto coincide en `20261113000100`, `20261113000200`, `20261114000100`, `20261124000100` y `20261124000200`. Los bloques 0 a 2 registran el procedimiento histórico de las primeras cuatro migraciones. En CampusLoop, usar únicamente migraciones nuevas.

### Línea base antes de instalar

CampusLoop, organización ReCampus, referencia `xxatvftmozlpqehhvgpv`, rama Supabase `main`, South America (São Paulo), plan Free. La persona a cargo reportó `Healthy` tras reactivar el proyecto y ejecutó la inspección real de solo lectura en SQL Editor. Reportó cero tablas y vistas de `public`, usuarios Auth, triggers visibles sobre `auth.users`, políticas de `public` y `storage`, buckets y migraciones registradas. Los resultados remotos provienen de esa sesión. Las revisiones del repositorio y los ensayos con PostgreSQL desechable se realizaron por separado.

Herramientas reportadas en el equipo: Node 24.16.0, npm 11.13.0 y Supabase CLI 3.4.0 mediante npx. El procedimiento usa Node para generar un archivo y la CLI o SQL Editor para enviarlo. Docker queda fuera de este flujo.

Validación local previa con PostgreSQL 18.4 desechable y Auth simulado. Pasaron la instalación atómica, la comprobación en otra sesión y la prueba de catálogo con usuario registrado, visitante y sesión anónima simulada. Se inyectó un error antes de confirmar y se verificó la ausencia de los objetos de control tras revertir. Una segunda ejecución sobre el esquema instalado se detuvo en la precondición. La evidencia remota de arriba cubre instalación y metadatos. El alta real a través de Auth queda pendiente. La consulta de directorios por PostgREST y mediante el SDK compartido se confirmó sin sesión en el proyecto real.

## Bloque 0 · Verificación de solo lectura

Los bloques 0 a 2 describen la instalación original. El historial de CampusLoop ya contiene las cinco versiones. Las operaciones de instalación y reparación que siguen se conservan como referencia histórica.

1. Confirmar en el Dashboard que se está en el proyecto y en la rama indicados. Reservar una ventana exclusiva para el bloque inicial y su registro de historial, sin altas de Auth, otros despliegues ni cambios del esquema en paralelo.
2. Usar [la preinspección](PREINSPECCION_SUPABASE_TB4.sql) y [la inspección](INSPECCION_SEGURIDAD_TB4.sql) si transcurrió tiempo desde el informe. Comprobar también propietarios y roles efectivos, grants por defecto y puntos de entrada RPC expuestos. El perfil depende de que el rol de instalación pueda crear el trigger en `auth.users`. Las tablas y la función de perfil deben crearse bajo el mismo propietario.
3. Confirmar por CLI el historial vacío. Si falta el vínculo local, el comando de enlace se ejecuta solo después de autorizar el acceso. Si ya existe un vínculo, verificar que el destino resuelto coincida con la referencia.

   ```powershell
   npx supabase@3.4.0 link --project-ref xxatvftmozlpqehhvgpv
   npx supabase@3.4.0 migration list --remote
   ```

   Introducir credenciales solo por los mecanismos de la CLI o del Dashboard. La salida debe mostrar las cuatro versiones locales y ninguna remota. Si existe un historial previo, una instalación parcial o un objeto inesperado, conciliarlo antes de ejecutar el bloque inicial. [Referencia de Supabase CLI](https://supabase.com/docs/reference/cli/introduction)

## Bloque 1 · Instalación atómica revisable

Orden de secciones dentro de la **misma transacción**:

| Orden | Fuente |
| --- | --- |
| 0 | `supabase/validacion/precondiciones_fase1_tb4.sql` |
| 1 | `20261113000100_tablas_tb4.sql` |
| 2 | `20261113000200_indices_tb4.sql` |
| 3 | `20261114000100_trigger_perfil_minimo.sql` |
| 4 | `20261124000100_rls_grants_tb4.sql` |
| 5 | Comprobación de que Auth sigue vacío y `supabase/validacion/verificar_fase1_tb4.sql` |

Las cuatro migraciones bajo `supabase/migrations` son las fuentes versionadas. Generar el archivo de aplicación fuera de esa carpeta, con un nombre nuevo:

```powershell
$tb4Sql = Join-Path $env:TEMP ('campusloop-fase1-' + [guid]::NewGuid().ToString('N') + '.sql')
node scripts/preparar-postgres-fase1.mjs "$tb4Sql"
Get-FileHash -LiteralPath "$tb4Sql" -Algorithm SHA256
```

El generador conserva el orden y el cuerpo de las migraciones y sustituye sus límites independientes por un solo `BEGIN` y un solo `COMMIT`. Revisar el archivo completo y conservar su hash junto con la evidencia. La transacción incluye un bloqueo para serializar este instalador, precondiciones y límites de espera. Las tablas, índices, trigger, grants y políticas se hacen visibles juntos al confirmar. La seguridad inicial revoca permisos amplios de tabla y columna, otorga lectura acotada, exige cuenta registrada para artículos y mantiene cerrada la escritura desde navegador. Los permisos administrativos del proyecto quedan sujetos a su configuración.

- **CLI:** confirmar que `npx supabase@3.4.0 db query --help` incluye `--file`. Ejecutar `npx supabase@3.4.0 db query --remote --file "$tb4Sql"` en una terminal interactiva y verificar `Target:` antes de confirmar. Si la versión o el transporte rechaza archivos con varias sentencias, usar SQL Editor tras verificar que el intento no se confirmó. [Referencia de db query](https://supabase.com/docs/reference/cli/introduction#supabase-db-query)
- **SQL Editor:** abrir el archivo generado en el editor local, copiarlo entero a una nueva consulta del proyecto confirmado y ejecutar todo en una sola llamada. El bloque incluye verificaciones antes de confirmar. Ejecutar las comprobaciones del bloque 2 desde otra consulta aunque la interfaz indique éxito.

Para esta primera aplicación, `db push` ejecutaría las migraciones por separado y sus límites actuales permitirían confirmar tablas antes de configurar su protección. Usar el artefacto atómico por cualquiera de las dos vías.

## Bloque 2 · Verificación y registro de historial

1. Ejecutar `supabase/validacion/verificar_fase1_tb4.sql` desde otra sesión con `BEGIN READ ONLY;` y `ROLLBACK;` en SQL Editor, o con `npx supabase@3.4.0 db query --remote --read-only --file supabase/validacion/verificar_fase1_tb4.sql`. Este control revisa RLS en las nueve tablas, permisos efectivos esenciales, guarda restrictiva del catálogo, índice de reserva activa y trigger. Volver a inventariar los objetos, las diez políticas y las ACL de columnas con `INSPECCION_SEGURIDAD_TB4.sql`. Comparar con las cuatro fuentes antes de registrar versiones.
2. Registrar las cuatro versiones comprobadas. Tanto el envío por CLI `db query` como por SQL Editor requieren este paso. Correrlo desde la misma raíz del repositorio con la CLI apuntando al proyecto confirmado:

   ```powershell
   npx supabase@3.4.0 migration repair 20261113000100 20261113000200 20261114000100 20261124000100 --status applied --remote
   npx supabase@3.4.0 migration list --remote
   ```

   Confirmar que Local y Remote tengan las mismas cuatro versiones. `migration repair` registra en el historial un SQL que ya se aplicó. La verificación del esquema es la condición para confirmar este comando. [Historial y reparación de migraciones](https://supabase.com/docs/reference/cli/introduction#supabase-migration-repair)

### Manejo de errores

| Resultado | Acción |
| --- | --- |
| Error de precondición, ACL, permisos del trigger, espera o DDL antes de confirmar | La transacción queda abortada. Ejecutar `ROLLBACK` si la sesión sigue abierta. Desde otra sesión confirmar ausencia de objetos TB4 y de versiones nuevas. Corregir la causa, regenerar si cambió una fuente y volver a revisar el archivo. |
| Timeout de cliente, pérdida de conexión o respuesta ambigua | Inspeccionar desde una segunda sesión. Si no hay objetos y el historial sigue vacío, se puede reintentar después de que termine la sesión anterior. Si está el esquema completo, comprobarlo y completar solo el historial. Si aparece un estado parcial o inesperado, detener y conciliar. |
| Esquema confirmado, reparación de historial fallida o parcial | Mantener la ventana exclusiva. Volver a listar versiones y verificar el esquema. Reparar solo las versiones comprobadas que falten. No ejecutar de nuevo el DDL ni usar `db push` hasta conciliar. |

## Bloques siguientes

1. La quinta migración de directorios está aplicada y sincronizada. El 24 de noviembre de 2026 se confirmó la lectura de los once DTO sin sesión en Supabase real mediante los servicios JavaScript y el SDK compartido. Véase el [informe de resultados](RESULTADOS_DIRECTORIOS_TB4.md). Coordinar la operación acotada para completar perfil y el alta de una cuenta sintética por Auth. Verificar que el trigger se ejecuta en la instancia real y que el lector sin rol vendedor obtiene solo artículos visibles cuando existan semillas aprobadas.
2. Storage privado queda como bloque posterior. `imagen_url` sigue siendo obligatoria, su CHECK excluye query y fragmento, el GET del PR #52 exige URL pública exacta, el adaptador rechaza tokens y el controlador de publicaciones espera URL pública. El diseño posterior plantea persistir bucket y ruta, revisar nulabilidad y GRANTS al coordinar el corte, y resolver fotos bajo autorización con la sesión del lector. [Fase posterior aprobada](RESULTADOS_DIRECTORIOS_TB4.md#fase-posterior-aprobada-por-coordinación) El bloque inicial conserva ese esquema y sus consumidores. Mantener Storage sin configurar y la siembra de artículos para después de coordinar esas dependencias.
