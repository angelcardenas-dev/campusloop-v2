# Directorios iniciales TB4

Coordinación ratificó el manifiesto de once UUID y las ubicaciones. El responsable confirmó que [20261124000200_directorios_iniciales_tb4.sql](../supabase/migrations/20261124000200_directorios_iniciales_tb4.sql) está aplicada en Supabase, con cinco versiones sincronizadas. La comprobación SQL posterior reportó cuatro universidades activas, cuatro campus activos con sus relaciones y ubicaciones, tres categorías activas y los once UUID esperados. También se confirmó el trigger de perfil mínimo instalado y habilitado.

El responsable ejecutó `scripts/verificar-directorios-postgrest.mjs` contra el proyecto real y obtuvo `OK directorios sin sesión` y `OK lectura privada y escritura anónima denegadas`. El 24 de noviembre de 2026 también ejecutó `node scripts/integracion-directorios.mjs` en una ventana privada y confirmó `OK integración real de directorios sin sesión`. El segundo ensayo pasó por `js/directorios.js` y el cliente Supabase compartido. Verificó los once DTO de la tabla siguiente, incluidas todas las relaciones y ubicaciones, y comprobó sesión vacía antes y después. Un UUID válido sin universidad devolvió una lista vacía. Un UUID inválido devolvió `VALIDACION`. La verificación SQL, la prueba PostgREST, la integración SDK y las pruebas offline quedan registradas por separado en el [informe para coordinación](RESULTADOS_DIRECTORIOS_TB4.md).

| Entidad | UUID | Relación y ubicación aprobadas |
| --- | --- | --- |
| Pontificia Universidad Católica del Perú (PUCP) | `5a5623f3-6f07-4f15-97b8-2061cd5c61b3` | Universidad |
| Universidad Peruana de Ciencias Aplicadas (UPC) | `486a935d-f0f9-4437-891e-62bc48bde10a` | Universidad |
| Universidad Nacional Mayor de San Marcos (UNMSM) | `035d83f5-bf9d-4032-90e2-abd7a2172159` | Universidad |
| Universidad de Lima (ULIMA) | `6ab6b6a8-0f6b-4149-8036-30a56eba20ba` | Universidad |
| San Miguel | `6fc0d006-f5ec-4936-ab83-a15ef417c648` | PUCP · San Miguel · Lima |
| Monterrico | `82d7186a-920c-49e2-bcc5-9aaa03ad655e` | UPC · Santiago de Surco · Lima |
| Campus Central | `105fb795-dc41-4f56-8dce-baa386d3b021` | UNMSM · Lima (Cercado de Lima) · Lima |
| Surco | `8214f236-d4ba-4b94-bcfe-bb029136a5cd` | ULIMA · Santiago de Surco · Lima |
| Académico | `7065c00d-bfe8-4460-ae0c-6978fd7107d9` | Materiales y artículos de estudio · orden 1 |
| Tecnológico | `cfc40a13-ce57-4532-969c-e21bd6737216` | Equipos y accesorios tecnológicos · orden 2 |
| Entretenimiento | `27193cb6-fcc8-49f4-9992-0adcc2ec1b25` | Artículos de ocio y entretenimiento · orden 3 |

La migración inserta universidades, campus y categorías en ese orden. Valida nombres, siglas y vínculos por UUID. Usa los índices únicos existentes para rechazar colisiones de nombre o sigla con UUID distintos. Conserva activación, fechas de alta, descripción y orden ya registrados. Completa distrito y ciudad únicamente cuando faltan. Un valor registrado que contradiga la ubicación aprobada aborta toda la operación. La comparación de la ubicación se hace bajo bloqueo de la fila del campus. El archivo contiene una sola sentencia `DO` atómica y deja el control de transacción exterior y el historial a Supabase CLI, sin `BEGIN` ni `COMMIT` SQL propios.

## Registro del procedimiento de aplicación

La migración ya figura aplicada. Los pasos de aplicación de esta sección quedan como referencia histórica.

Desde la raíz del repositorio, en la sesión de CLI que ya apunta a CampusLoop / ReCampus / main. Si falta el enlace local, ejecutar `npx.cmd supabase@3.4.0 link --project-ref xxatvftmozlpqehhvgpv`. Comprobar que `Target:` resuelva a esa referencia. La sesión de trabajo no tiene acceso autenticado para repetir esta inspección.

```powershell
npx.cmd supabase@3.4.0 migration list --remote
npx.cmd supabase@3.4.0 db query --remote --read-only --file supabase/validacion/preinspeccion_directorios_tb4.sql
npx.cmd supabase@3.4.0 db push --remote --dry-run --skip-vault
```

La preinspección muestra el historial, RLS, el contenido administrativo de los tres directorios y el inventario de rutinas y trigger. Comparar con el manifiesto, incluidas las ubicaciones existentes. Si el transporte de CLI no muestra todos los resultados, ejecutar [la preinspección](../supabase/validacion/preinspeccion_directorios_tb4.sql) en SQL Editor dentro de `BEGIN READ ONLY;` y `ROLLBACK;`. Deben constar exactamente las cuatro versiones anteriores y el dry-run debe anunciar únicamente `20261124000200`. Ante discrepancias de datos, destino o historial, detener la aplicación y conciliar.

Después de revisar el SQL y solo si el plan contiene esa versión:

```powershell
npx.cmd supabase@3.4.0 db push --remote --skip-vault
npx.cmd supabase@3.4.0 migration list --remote
npx.cmd supabase@3.4.0 db query --remote --file supabase/validacion/verificar_directorios_tb4.sql
```

El último archivo contiene su propio bloque de solo lectura, verifica las once identidades, relaciones y ubicaciones y consulta cada directorio bajo ambos roles. Puede ejecutarse completo en SQL Editor. Si la CLI pide confirmación para la consulta, verificar el destino y el contenido del archivo. El historial debe mostrar cinco versiones sincronizadas. Si el resultado de la aplicación es ambiguo, volver a consultar historial y esquema antes de reintentar. Si el archivo detecta un conflicto, revisar el registro preexistente antes de considerar otra migración. Las filas desactivadas por administración pueden estar ocultas por RLS y seguir siendo correctas en la verificación administrativa.

## Servicio y prueba PostgREST

| Firma | Datos en éxito |
| --- | --- |
| `consultarUniversidades()` | `[{ id, nombre, sigla }]` |
| `consultarCampus(universidadId)` | `[{ id, universidadId, nombre, distrito, ciudad }]` |
| `consultarCategorias()` | `[{ id, nombre, descripcion, orden }]` |

El servicio conserva `{ ok, datos, error }`, las proyecciones por columna, el orden y el uso de RLS a través del cliente compartido. El DTO acepta ubicaciones nulas para filas administrativas que todavía no tengan estos datos. Los cuatro campus del manifiesto deben devolver ubicación completa tras la migración.

Tras verificar el SQL, obtener la clave publicable desde el Dashboard y ejecutar desde PowerShell:

```powershell
$env:TB4_PUBLISHABLE_KEY = Read-Host 'Clave publishable de CampusLoop'
try {
    node scripts/verificar-directorios-postgrest.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Falló la verificación de PostgREST' }
} finally {
    Remove-Item Env:TB4_PUBLISHABLE_KEY
}
```

La prueba se ejecuta sin JWT de usuario. Comprueba universidades, Monterrico mediante el filtro UUID de UPC y categorías. Exige la denegación de lectura de artículos, perfiles, reservas, conversaciones y mensajes. El PATCH de control apunta a `id IS NULL`, imposible para la PK, y exige una denegación de permisos. El detalle de grants para otras operaciones se comprueba con `supabase/validacion/verificar_fase1_tb4.sql` en SQL Editor dentro de una transacción de solo lectura. Para distinguir un fallo de instalación de una fila inactiva, comparar RLS con las salidas administrativas.

Cuando exista una cuenta de prueba autorizada, usar un frontend de desarrollo con la URL y clave publicable configuradas, iniciar sesión por el flujo vigente y ejecutar en la consola del mismo origen:

```js
const { obtenerClienteSupabase } = await import('/js/supabase-cliente.js');
const cliente = await obtenerClienteSupabase();
if (!cliente.ok) throw new Error(cliente.error.codigo);
const { data: { user }, error } = await cliente.datos.auth.getUser();
if (error || user?.is_anonymous !== false) throw new Error('Se requiere sesión registrada');
const { consultarUniversidades, consultarCampus, consultarCategorias } = await import('/js/directorios.js');
const universidades = await consultarUniversidades();
const upc = universidades.datos?.find(u => u.sigla === 'UPC');
if (!upc) throw new Error(universidades.error?.codigo ?? 'UPC no visible');
const campus = await consultarCampus(upc.id);
const categorias = await consultarCategorias();
if (!campus.datos?.some(c => c.nombre === 'Monterrico' && c.distrito === 'Santiago de Surco' && c.ciudad === 'Lima')
    || !categorias.datos?.some(c => c.nombre === 'Académico')) {
  throw new Error('Los directorios de la sesión registrada no coinciden');
}
'OK directorios con sesión registrada';
```

## Auth y perfiles

El trigger versionado `crear_perfil_minimo_tras_registro` ejecuta `crear_perfil_minimo_auth()` tras insertar en `auth.users`. Inserta el UUID del actor y deja el vendedor desactivado. La instalación y la comprobación de metadatos del trigger están confirmadas por el responsable en Supabase. El alta real y posterior consulta del perfil mediante una cuenta de prueba siguen pendientes. La preinspección remota permite comprobar el trigger y detectar rutinas adicionales. En el repositorio existe lectura propia y se deniega la escritura general. El contrato separa Auth del guardado del perfil y todavía no hay una RPC versionada para completarlo.

Para la fase posterior se aprobó una operación desde sesión registrada y verificada que derive el titular de `auth.uid()`, acepte nombre visible, selección de campus y versión esperada, contraste el campus con la universidad seleccionada y compruebe que ambos estén activos. Actualizar nombre, campus, fecha y versión en una operación atómica con detección de conflicto. El UUID de universidad sirve para validar la selección. Restringir permisos de ejecución y preservar el estado de vendedor y los privilegios. Coordinar entradas y resultado con Auth y Registro antes de implementarlo.
