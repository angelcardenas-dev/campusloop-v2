# CampusLoop V2 · Primeros resultados para coordinación

Proyecto CampusLoop, organización ReCampus, referencia `xxatvftmozlpqehhvgpv`, rama Supabase `main`. URL pública `https://xxatvftmozlpqehhvgpv.supabase.co`.

## Estado verificado en el proyecto real

El responsable confirmó cinco versiones sincronizadas entre repositorio y Supabase:

| Versión | Contenido |
| --- | --- |
| `20261113000100` | Nueve tablas y relaciones |
| `20261113000200` | Índices |
| `20261114000100` | Trigger de perfil mínimo |
| `20261124000100` | RLS y GRANTS por columna |
| `20261124000200` | Directorios iniciales |

La verificación SQL posterior reportó cuatro universidades y cuatro campus activos, con sus ubicaciones y relaciones correctas, y tres categorías activas. Los once UUID coinciden con el [manifiesto ratificado](DIRECTORIOS_INICIALES_TB4.md). Los campus son San Miguel (PUCP), Monterrico (UPC), Campus Central (UNMSM) y Surco (ULIMA). Las categorías son Académico, Tecnológico y Entretenimiento.

Las nueve tablas tienen RLS habilitado con diez políticas y permisos de lectura por columna. La verificación de instalación comprobó denegación de escritura directa para `anon` y `authenticated`. El responsable ejecutó la prueba PostgREST de visitante y obtuvo:

```text
OK directorios sin sesión
OK lectura privada y escritura anónima denegadas
```

Ese ensayo PostgREST leyó los directorios por HTTP, comprobó denegación de lectura anónima en artículos, perfiles, reservas, conversaciones y mensajes, y ejecutó un PATCH de control con un filtro que no puede alcanzar filas.

## Prueba del servicio a través del SDK compartido

El **24 de noviembre de 2026** el responsable ejecutó `node scripts/integracion-directorios.mjs` contra CampusLoop y abrió la prueba en una ventana privada. Confirmó el resultado `OK integración real de directorios sin sesión`. El código ejecutado importó los servicios de producción y reutilizó el cliente Supabase compartido.

| Firma | DTO en `datos` |
| --- | --- |
| `consultarUniversidades()` | `[{ id, nombre, sigla }]` |
| `consultarCampus(universidadId)` | `[{ id, universidadId, nombre, distrito, ciudad }]` |
| `consultarCategorias()` | `[{ id, nombre, descripcion, orden }]` |

Los tres servicios devuelven `{ ok, datos, error }`. El ensayo comparó estructura y valores exactos de los **once DTO** con la tabla del [manifiesto verificado](DIRECTORIOS_INICIALES_TB4.md). Confirmó los cuatro UUID, nombres y siglas de universidades, los cuatro UUID de campus, el `universidadId` usado para filtrarlos y su distrito y ciudad, y los tres UUID, nombres, descripciones y órdenes de categorías. Un UUID aleatorio válido sin universidad devolvió `{ ok: true, datos: [], error: null }`. Un UUID inválido devolvió `VALIDACION` y `datos: null`. La sesión estaba vacía antes y después del ensayo.

El arnés sirve los módulos en un origen temporal de loopback para que el navegador cargue el SDK fijado por la aplicación. La configuración de prueba se entrega en memoria, con caché deshabilitada, y usa únicamente la clave publicable.

Desde la raíz del repositorio, con Node y un navegador con acceso al CDN del SDK y al proyecto:

```powershell
$clavePrueba = Read-Host 'Clave publishable de CampusLoop' -AsSecureString
try {
    $env:TB4_PUBLISHABLE_KEY = [System.Net.NetworkCredential]::new('', $clavePrueba).Password
    node scripts/integracion-directorios.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Falló la integración de directorios' }
} finally {
    Remove-Item Env:TB4_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
    $clavePrueba.Dispose()
}
```

Abrir en una ventana privada el enlace local indicado en la terminal. El servidor termina al recibir el resultado o después de tres minutos. Registrar la línea de resultado, el proyecto y la fecha. Una diferencia en el conjunto visible, incluso altas administrativas posteriores, hará fallar la comparación contra los once valores iniciales.

## Pruebas offline y diagnóstico

La traza del primer pase que falló conserva `actual: ''` y la expectativa `/No pudimos comprobar/`. Esa expresión identifica la aserción de [tests/acceso/acceso-ui.test.mjs](../tests/acceso/acceso-ui.test.mjs) en el grupo «login: sesión indeterminada (…) mantiene el botón deshabilitado y pide recargar». La salida conservada carece del título completo, por lo que queda indeterminado si fue `NO_AUTORIZADO`, `RED`, «respuesta mal formada» o «excepción».

El test espera 5 ms y examina el texto de una región cuyo mensaje se escribe en el siguiente `requestAnimationFrame`. El doble de DOM programa ese cuadro con otro temporizador. La causa probable es que la aserción lea la región entre su apertura y la escritura del texto. Con una copia temporal del test y el doble de cuadro retrasado a 30 ms, las cuatro variantes reprodujeron la misma aserción con texto vacío. En el código original pasaron 16 repeticiones del grupo y ocho pases de la suite completa, con 538/538 por pase. Hay sensibilidad al orden de ejecución en el ensayo. La frecuencia del fallo natural queda sin determinar. El ajuste propuesto para el responsable de Acceso es controlar y ejecutar explícitamente el cuadro pendiente desde el doble de DOM.

### Validación sobre la base de integración eb77379

Pasaron 9 de 9 pruebas de Directorios y la instalación de las cinco migraciones en PostgreSQL 18 desechable con Auth simulado. Pasaron las comprobaciones de RLS, permisos y directorios bajo ambos roles. Netlify incluyó el servicio, el cliente compartido y la configuración pública.

La suite JavaScript sin navegador pasó 632 de 637 pruebas. Los cinco fallos fueron del arnés PKCE, que no proporciona la exportación de memoria que importa Auth. La suite completa dentro del sandbox pasó 631 de 640. Además de los cinco casos PKCE, reportó tres tiempos de espera CDP y una aserción de revocación del agente que pasó al repetirla en forma aislada. Las tres suites Chrome pudieron conectarse a CDP en la repetición fuera del sandbox y reportaron aserciones de sus respectivos componentes.

## Alcance propuesto del primer PR a integracion/bernabe

- Entrega de datos y servicio. `.gitignore`, `js/directorios.js`, las migraciones nuevas `20261124000100_rls_grants_tb4.sql` y `20261124000200_directorios_iniciales_tb4.sql`, y `scripts/preparar-postgres-fase1.mjs`. Las tres migraciones anteriores ya existen en la rama destino. El PR sincroniza las fuentes del repositorio con el historial aplicado.
- Evidencia y reproducibilidad. `docs/DIRECTORIOS_INICIALES_TB4.md`, este informe, `scripts/verificar-directorios-postgrest.mjs`, `scripts/integracion-directorios.mjs`, `scripts/integracion-directorios-navegador.mjs`, los cuatro archivos de `supabase/validacion/`, `tests/catalogo/directorios.test.mjs`, `tests/db/preparar_fase1_tb4.sql` y `tests/db/catalogo_rls_fase1_tb4.sql`.
- El procedimiento de aplicación, su preinspección y el README de Supabase acompañan la entrega. La propuesta histórica de semilla y los tres archivos de diseño de seguridad y Storage quedan para revisión posterior.

Para consumir `js/directorios.js`, los módulos de interfaz cargarán los UUID que devuelven los servicios. Ya existen `js/supabase-cliente.js` y `js/config-publica.js` en la base común. La configuración de aplicación tiene sus valores vacíos. El despliegue debe proporcionar la URL HTTPS y la clave publicable mediante la configuración aprobada y permitir cargar el SDK fijado desde `esm.sh`. El empaquetado de Netlify incluye el módulo mediante la lista de recursos de `scripts/preparar-netlify.mjs`. El arnés de integración usa su propio origen local. El despliegue y el montaje en Registro o Catálogo quedan pendientes.

## Fase posterior aprobada por coordinación

El trigger `crear_perfil_minimo_tras_registro` está instalado y habilitado según la comprobación real reportada. La función crea un perfil con el UUID de Auth y vendedor desactivado. La lectura del propio perfil existe. Quedan pendientes registrar una cuenta sintética autorizada, validar confirmación de correo y retorno de sesión, verificar la creación efectiva del perfil y probar el guardado posterior. El [contrato Auth ↔ perfiles](contratos/CONTRATO_AUTH_PERFILES_TB4.md) separa el registro del guardado de nombre y campus.

**Servicio aprobado.** `actualizarMiPerfil({ nombreVisible, universidadId, campusId, versionEsperada })`, invocado tras obtener una sesión registrada. En éxito devuelve `{ ok: true, datos: { id, nombreVisible, campusId, vendedorActivado, creadoEn, actualizadoEn, version }, error: null }`. En fallo, `datos: null` y error normalizado. Un servicio autorizado consultará el perfil propio, indicará si está completo y devolverá su versión vigente. La actualización se reutilizará para ediciones posteriores. El primer guardado se hará tras confirmar el correo y obtener una sesión autenticada y verificada.

**Validaciones y actualización.** Derivar el titular de `auth.uid()` y exigir JWT con claim raíz booleano `is_anonymous = false`. Validar dos UUID, nombre recortado de 2–100 caracteres, sin controles ni `< >`, y versión entera positiva. Verificar que el campus pertenezca a la universidad indicada y ambos estén activos. La universidad sirve para validar la selección. Persistir campus, nombre, fecha de actualización y versión incrementada en una sola transacción. Proteger la selección activa frente a cambios concurrentes y condicionar el UPDATE al UUID propio y la versión esperada. Devolver `CONFLICTO` si otra operación avanzó la versión y `NO_ENCONTRADO` si falta el perfil del titular. Usar `VALIDACION` para datos o selección incompatibles y `NO_AUTORIZADO` para sesión ausente o anónima.

**Permisos propuestos.** Mantener revocado el DML directo. La RPC tendría `SECURITY DEFINER`, `search_path` vacío y relaciones calificadas. Su propietario dedicado tendría privilegios y políticas RLS acotados a leer el directorio y actualizar los cuatro campos necesarios del perfil propio, sin `BYPASSRLS`. Revocar `EXECUTE` de `PUBLIC` y `anon`, concederlo a `authenticated` y verificar el contexto del actor dentro de la función. La operación preserva vendedor, roles, UUID y fecha de creación. Reservar la aprobación del vendedor a su proceso humano independiente.

**Verificación y coordinación técnica.** Se aprobaron ensayos reales con cuentas sintéticas controladas para validar el alta y el perfil mínimo, el aislamiento entre cuentas, el rechazo de Anonymous Sign-In y la prohibición de autoasignarse privilegios. Quedan por acordar con Auth y Registro el punto de entrada tras la confirmación, el rol propietario, los grants concretos de la RPC y el mapeo de errores. Storage privado quedó aprobado como diseño para una fase posterior. La RPC, los servicios de perfil y la configuración de Storage quedan pendientes de implementación.
