# Despliegue y validación de perfiles TB4

La sexta migración crea dos funciones y un rol de edición en una transacción. Coordinación autorizó el uso de `xxatvftmozlpqehhvgpv` para desarrollo de TB4 aunque Supabase CLI 3.4.0 lo etiquete como `production`.

## Aplicación y verificación real del 25 de noviembre de 2026

- La preinspección confirmó cinco versiones sincronizadas, lectura propia, escritura directa cerrada para los roles cliente y ausencia de colisiones. La CLI de solo lectura usa `supabase_read_only_user`. El mecanismo de migraciones usa `cli_login_postgres`, que puede asumir `postgres` sin heredar sus permisos. `postgres` puede usar `auth`, ejecutar `auth.uid()` y `auth.jwt()` y consultar la confirmación del correo, pero carece de opción de delegación sobre el esquema y las funciones. `PUBLIC` puede ejecutar ambas funciones de Auth si tiene acceso al esquema. `PUBLIC` carece de USAGE en `auth`.
- Se aplicó la alternativa B. El auxiliar privado `actor_confirmado()`, propiedad de `postgres`, deriva el UUID de Auth y solo lo devuelve para una cuenta registrada y con correo confirmado. La RPC es propiedad de `tb4_editor_perfil`, con RLS activo para ese rol, y ejecuta el auxiliar sin acceder a `auth` ni a `auth.users`. No se cambiaron las ACL ni los propietarios de Auth.
- El dry-run mostró solo la sexta migración, sin seeds ni roles externos. `db push` la aplicó y `migration list` confirmó las seis versiones sincronizadas. La verificación posterior confirmó nueve tablas con RLS, la guarda restrictiva de perfiles, cuatro políticas de directorios intactas y el trigger mínimo habilitado.
- Ambas funciones conservan `SECURITY DEFINER` y `search_path` vacío. La ACL de la RPC concede ejecución a `authenticated` y a su propietario. El auxiliar concede ejecución solo a su propietario y al editor. `anon` y `service_role` carecen de ejecución sobre las dos funciones. El editor carece de login, superusuario y bypass de RLS, acceso a `auth` y escritura sobre `vendedor_activado`. `anon` y `authenticated` conservan lectura de directorios y carecen de DML directo en perfiles. La solicitud HTTP sin clave ni sesión recibió 401. Se observó DML efectivo del rol administrativo `service_role` en perfiles. La sexta migración no le concede DML.
- En PostgreSQL 18 local con Auth administrado simulado y sin opciones de delegación, pasaron el aislamiento, rechazo de Anonymous Sign-In y correo sin confirmar, escritura directa denegada y las comprobaciones de ACL. Dos transacciones con la misma versión produjeron un éxito y un conflicto `PT409`. La versión final fue 2 y vendedor siguió desactivado. JavaScript de perfiles pasó 4 de 4.
- La configuración exportable confirmó la confirmación de correo. El estado de Anonymous Sign-In y las redirecciones quedan por verificar antes del ensayo con cuentas sintéticas. No se crearon cuentas en esta fase.

## Antes de aplicar

1. Ejecutar los comandos de lectura y dry-run contra el destino confirmado. La inspección debe mostrar RLS en perfiles y directorios, lectura propia, DML directo cerrado, ausencia de colisiones y capacidad del rol efectivo para crear el rol y esquema, administrar los objetos y leer las dos columnas requeridas en `auth.users`. Comprobar que el propietario de la función privada pueda ver la fila bajo RLS (titularidad sin FORCE, bypass existente o política aplicable). No conceder acceso adicional a `auth.users` para superar una discrepancia.
2. En la configuración Auth del mismo proyecto, verificar registro por correo, confirmación obligatoria, estado de Anonymous Sign-In, redirección PKCE autorizada y entrega de correo a las dos bandejas sintéticas. Usar la configuración existente. Cambios de Auth requieren autorización independiente.
3. El historial debe listar las cinco versiones sincronizadas y el dry-run debe enumerar solo `20261125000100_perfiles_propios_tb4.sql`, sin seeds ni roles externos.

```powershell
npx.cmd --offline supabase@3.4.0 migration list --remote=xxatvftmozlpqehhvgpv
npx.cmd --offline supabase@3.4.0 db query --remote=xxatvftmozlpqehhvgpv --read-only --file supabase/validacion/preinspeccion_perfiles_tb4.sql
npx.cmd --offline supabase@3.4.0 db push --remote=xxatvftmozlpqehhvgpv --dry-run --skip-vault
```

Solo con precondiciones verificadas y autorización final:

```powershell
npx.cmd --offline supabase@3.4.0 db push --remote=xxatvftmozlpqehhvgpv --skip-vault
```

Después, listar el historial para verificar seis versiones sincronizadas. Si el resultado es ambiguo, inspeccionar historial y objetos antes de reintentar.

## Ensayo con dos cuentas sintéticas

Usar dos bandejas sintéticas autorizadas y dos perfiles de navegador aislados, A y B. Cargar los servicios del repositorio con la configuración pública aprobada para ese origen. Usar la interfaz Auth existente y el cliente compartido para los controles directos. Capturar únicamente códigos de resultado, recuentos y versiones. Introducir contraseñas en la interfaz, sin guardarlas en el navegador ni en archivos de ensayo. Conservar las sesiones en el contexto del SDK, sin exportar credenciales ni mostrar respuestas de Auth.

| Orden | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Sin sesión, llamar los dos servicios con datos válidos. Probar también lectura de `perfiles` y llamada directa a la RPC con el cliente visitante. | Servicios `NO_AUTORIZADO`. La API deniega la lectura y ejecución directa. |
| 2 | Registrar A y B sin abrir los enlaces. Intentar iniciar sesión y guardar perfil. | Registro pendiente, inicio denegado por correo sin confirmar y guardado rechazado. El caso de una cuenta sin confirmar con JWT válido se cubre en SQL local; con confirmación obligatoria el flujo normal carece de ese JWT. |
| 3 | Abrir el enlace de A en el navegador y origen que inició A, y repetir para B. Iniciar sesión y consultar el perfil propio en ambos contextos. | Dos perfiles con sus UUID de Auth, nombre/campus nulos, versión 1, `completo: false` y vendedor desactivado. |
| 4 | En A, guardar un nombre sintético con una pareja universidad/campus activa. Consultar, editar y consultar de nuevo. Repetir la edición con una versión anterior. | Versiones 2 y 3; `completo: true`; la versión anterior devuelve `CONFLICTO`; vendedor sigue desactivado. |
| 5 | En A, lanzar `Promise.all` con dos llamadas a `actualizarMiPerfil`, nombres distintos y la misma versión recién leída. | Exactamente un éxito y un `CONFLICTO`. La consulta posterior tiene el nombre ganador y un solo incremento. |
| 6 | En A, intentar el campus de otra universidad activa. | `VALIDACION`, sin cambio de versión. |
| 7 | Con el cliente A, hacer SELECT con el UUID de B y llamar la RPC enviando B como actor esperado. Repetir de B a A. | La consulta devuelve cero filas. La RPC deniega. El perfil B conserva el estado inicial. |
| 8 | Con A, intentar un UPDATE directo de su propio nombre y otro de `vendedor_activado`, ambos filtrados por su propio UUID. Invocar la RPC con un parámetro extra de privilegios y probar acceso RPC al auxiliar privado. | DML denegado, firma inválida o acceso denegado para los controles RPC. Ningún cambio de versión, capacidad de vendedor ni privilegio de revisión. |
| 9 | Si Anonymous Sign-In ya está habilitado y autorizado, repetir los controles de lectura y escritura en un contexto anónimo separado. | El servicio rechaza la sesión. PostgREST filtra perfiles y la RPC deniega. Si está deshabilitado, verificar esa configuración y conservar la cobertura SQL local del claim anónimo. |

Las intervenciones humanas son disponer de las dos bandejas autorizadas y abrir los dos enlaces de confirmación en el contexto PKCE correspondiente. La limpieza de cuentas o datos de prueba se coordina por separado.

## Límites de la evidencia de integración

Las dos cuentas sintéticas y su confirmación por correo siguen pendientes. La evidencia remota cubre despliegue, metadatos y rechazo HTTP sin clave ni sesión. El flujo de perfil autenticado y la carrera de dos peticiones quedan cubiertos por las pruebas locales hasta completar el ensayo real.

La suite JavaScript sin navegador pasó 636 de 641 pruebas en la rama de perfiles. Los cinco fallos conocidos de `tests/auth/pkce.test.mjs` corresponden a su módulo simulado de memoria, que no exporta `CLAVE_CONSENTIMIENTO_MEMORIA` como espera `js/auth.js`. El arnés quedó a cargo de coordinación.