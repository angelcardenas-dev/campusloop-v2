# PostgreSQL TB4

## Estado confirmado en CampusLoop

El responsable del proyecto Supabase CampusLoop (`xxatvftmozlpqehhvgpv`) reportó estas cinco versiones aplicadas y sincronizadas con el historial local.

| Migración | Contenido |
| --- | --- |
| [20261113000100](migrations/20261113000100_tablas_tb4.sql) | Nueve tablas, relaciones y restricciones |
| [20261113000200](migrations/20261113000200_indices_tb4.sql) | Índices de consulta e integridad, incluido el de reserva activa |
| [20261114000100](migrations/20261114000100_trigger_perfil_minimo.sql) | Trigger de perfil mínimo al crear un usuario de Auth |
| [20261124000100](migrations/20261124000100_rls_grants_tb4.sql) | RLS y GRANTS de lectura por columna |
| [20261124000200](migrations/20261124000200_directorios_iniciales_tb4.sql) | Cuatro universidades, cuatro campus y tres categorías activos con sus once UUID ratificados |

La verificación posterior reportó RLS habilitado en las nueve tablas, diez políticas, denegación de escritura directa para `anon` y `authenticated` y el trigger de perfil mínimo habilitado. Pasaron la consulta sin sesión por PostgREST y por el SDK compartido, y la prueba PostgREST de denegación de lectura privada y escritura anónima. El alta real con confirmación de correo, los servicios y la RPC de perfiles, y la configuración de Storage privado quedan para fases posteriores. [Informe de resultados](../docs/RESULTADOS_DIRECTORIOS_TB4.md)

Las cinco migraciones quedan como registro de lo aplicado. Cualquier cambio de base de datos requiere una migración nueva. El procedimiento de instalación y registro de historial se conserva como evidencia histórica. [Procedimiento de aplicación](../docs/APLICACION_POSTGRES_FASE1_TB4.md)

## Decisiones de esquema y contratos

- **Activación de vendedores.** La misma cuenta de estudiante conserva su capacidad de compra. Puede solicitar la activación sin experiencia y con enlaces comerciales opcionales. Solo personal designado por coordinación puede aprobar o rechazar. El plazo es de 48 horas corridas desde el envío, incluidos fines de semana y feriados. Al vencer, la solicitud sigue pendiente y se escala. La aprobación nunca es automática y el resultado se comunica por notificación interna. Las tablas y RPC de revisión siguen en diseño. [Reglas y propuesta de activación](../docs/PROPUESTA_ACTIVACION_VENDEDORES_TB4.md)
- **Precio.** El README histórico consignó como aprobado migrar a `INTEGER` (1 a 2 147 483 647 céntimos). La columna aplicada sigue siendo `BIGINT` estrictamente positivo, en PEN, y la prueba de Etapa A admite 3 000 000 000 céntimos. El contrato vigente exige un entero seguro de JavaScript sin redondeo y deja pendiente la admisión de precio cero. El diseño reconciliado deja por decidir la migración a `INTEGER`. Cualquier cambio de tipo requiere una nueva migración. [Contrato de catálogo](../docs/CONTRATO_ARTICULOS_CATALOGO_TB4.md#dinero) · [Diseño reconciliado](../docs/DISENO_ESQUEMA_CATALOGOS_TB4.md)
- **Fotografías.** El SQL exige una foto en siete columnas, URL HTTPS, ruta bajo el UUID del vendedor, extensión coherente con JPEG/PNG/WebP y bytes y dimensiones positivos. El objetivo de 2 MiB sustituyó al de 5 MiB y se comprueba en la validación local del archivo de publicaciones. El máximo sigue pendiente en PostgreSQL y en el bucket real, al igual que la comprobación del objeto y su contenido en el flujo remoto. Coordinación decidió usar Storage privado. La transición del contrato de URL pública del catálogo a referencias privadas, junto con el bucket y sus políticas, queda pendiente. [Contrato de catálogo](../docs/CONTRATO_ARTICULOS_CATALOGO_TB4.md#fotografías) · [Diseño de fotografías privadas](../docs/PROPUESTA_FOTOGRAFIAS_STORAGE_PRIVADO_TB4.md)
- **Artículos e historial.** Los estados son `disponible`, `reservado` y `vendido`. El borrado lógico usa `eliminado_en`. Las claves foráneas restrictivas preservan las relaciones históricas y las claves compuestas mantienen coherentes el artículo, el vendedor y los participantes entre conversaciones y reservas. El índice parcial permite una sola reserva activa (`pendiente` o `confirmada`) por artículo. Las transiciones y la aceptación por la contraparte quedan para las operaciones de negocio.
- **Lugares públicos.** Una reserva admite un lugar de catálogo, una propuesta personalizada o ninguna propuesta. La propuesta personalizada exige nombre de 3 a 100 caracteres, referencia pública de hasta 150 y un proponente que participe en la reserva. El esquema admite lugares de catálogo sin campus, conforme a la decisión histórica sobre lugares externos. La especificación pide campus conocido para el lugar adicional propuesto; queda por conciliar el alcance de ambos criterios. La estructura SQL acredita la consistencia de los datos. La revisión de que el lugar sea público pertenece al flujo de confirmación. [Especificación TB4](../SPEC_TB4.md) · [Esquema aplicado](migrations/20261113000100_tablas_tb4.sql)

## Trigger mínimo y evidencia histórica

El trigger `AFTER INSERT` de `auth.users` inserta solo el UUID en `public.perfiles` y deja desactivada la capacidad de vendedor. La función usa `SECURITY DEFINER`, `search_path` vacío y una referencia calificada a la tabla. Su propietario es el rol que ejecuta la migración. El SQL revoca la ejecución a `PUBLIC`, y la migración de seguridad también a `anon` y `authenticated`. Un error del trigger revierte el alta de Auth en la misma transacción.

Las pruebas históricas pasaron en PostgreSQL 18 desechable con Auth simulado. En la instalación local se observó que la función y la tabla compartían un propietario administrador. En otro escenario, el propietario de ambas sin `BYPASSRLS` pudo insertar con RLS normal. `FORCE RLS` bloqueó la inserción en ausencia de una política aplicable y revirtió el alta. Un definidor con `BYPASSRLS` y permiso de inserción pudo escribir incluso con `FORCE RLS`. Estos escenarios ensayaron el efecto del propietario local y de sus permisos. La evidencia de CampusLoop registra que el trigger está habilitado. El alta real y la comprobación específica del propietario y sus privilegios efectivos quedan pendientes.

- [estructura_etapa_a.sql](../tests/db/estructura_etapa_a.sql) comprueba tablas, defaults, precios, unicidad, relaciones, reserva activa e historial. Se ejecuta con las dos primeras migraciones y antes del trigger, porque inserta perfiles manualmente.
- [perfil_minimo_etapa_b.sql](../tests/db/perfil_minimo_etapa_b.sql) comprueba el perfil mínimo, que se ignoren metadatos hostiles, que actualizar Auth preserve el perfil y que un fallo revierta el alta. También prueba el disparo desde un rol sintético sin acceso directo a perfiles.
- [seguridad_trigger_perfil.sql](../tests/db/seguridad_trigger_perfil.sql) comprueba propietario, ACL, nombres homónimos en esquemas hostiles y temporales, y los escenarios de RLS normal, FORCE y BYPASS. Para repetir las dos pruebas del trigger, usar un clúster desechable con Auth simulado y las tres primeras migraciones.

## Usuarios preexistentes y autorizaciones

El trigger cubre altas nuevas. Cualquier regularización requiere inventariar las cuentas existentes sin perfil y los vendedores activos sin evidencia, acordar su tratamiento y obtener una autorización independiente antes de modificar datos.

La revisión técnica evalúa evidencia y riesgos. El responsable técnico propone la solución. Coordinación ratifica esquema, reglas y contratos. Una autorización explícita de implementación o despliegue define qué operaciones pueden ejecutarse y en qué entorno.

## Validación

Para una revisión de solo lectura del esquema instalado, usar [verificar_fase1_tb4.sql](validacion/verificar_fase1_tb4.sql) dentro de `BEGIN READ ONLY;` y `ROLLBACK;` para revisar estructura, permisos, índice y trigger. Ejecutar [verificar_directorios_tb4.sql](validacion/verificar_directorios_tb4.sql) como archivo completo. Incluye su propia transacción de solo lectura y comprueba los directorios contra los once UUID del manifiesto. [Contrato de directorios](../docs/DIRECTORIOS_INICIALES_TB4.md)

Para reproducir la instalación y las pruebas, usar PostgreSQL 18 desechable con conexión local explícita y `psql -X -v ON_ERROR_STOP=1`. Desde la raíz del repositorio:

1. Ejecutar [preparar_fase1_tb4.sql](../tests/db/preparar_fase1_tb4.sql) en la base vacía. Crea los roles de prueba y el sustituto de Auth.
2. Generar un archivo SQL nuevo con `node scripts/preparar-postgres-fase1.mjs <ruta-sql-nueva>` y ejecutarlo en esa base. Agrupa las primeras cuatro migraciones, precondiciones y verificación de fase 1 en una transacción.
3. Ejecutar [catalogo_rls_fase1_tb4.sql](../tests/db/catalogo_rls_fase1_tb4.sql) con `psql -c BEGIN -f tests/db/catalogo_rls_fase1_tb4.sql -c ROLLBACK` en una sola invocación y con los mismos parámetros de conexión. La transacción mantiene activos los roles de prueba y revierte los datos sintéticos.
4. Aplicar la quinta migración en la base desechable y ejecutar [verificar_directorios_tb4.sql](validacion/verificar_directorios_tb4.sql).

La [preinspección de directorios](validacion/preinspeccion_directorios_tb4.sql) está destinada a un proyecto Supabase con el historial de la CLI disponible. La base desechable usa Auth simulado para validar SQL y permisos. Las pruebas de PostgREST y SDK del proyecto real se documentan por separado.
