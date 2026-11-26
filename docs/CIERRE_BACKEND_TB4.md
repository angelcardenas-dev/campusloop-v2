# Cierre funcional TB4

## Vendedores y artículos

El consumidor captura el UUID de la cuenta al presentar el diálogo de confirmación. Pasa esa misma identidad como segundo argumento a los servicios mutadores: `enviarSolicitudVendedor(datos, { actorEsperado })`, `decidirSolicitudVendedor(datos, { actorEsperado })`, `marcarNotificacionLeida(id, { actorEsperado })`, `crearMiArticulo(datos, { actorEsperado })`, `editarMiArticulo(datos, { actorEsperado })` y `retirarMiArticulo(datos, { actorEsperado })`. No volver a resolver el actor al pulsar Enviar. Una sesión distinta falla dentro de la RPC. Los permisos derivan de Auth y de las políticas del recurso.

`consultarNormasVendedor()` entrega la versión vigente y su texto. Mostrarlo antes de enviar `aceptaNormas: true` y el identificador de versión. El servidor registra hora y versión de aceptación. Alta inicial de revisores: coordinación valida por canal privado los UUID reales de Bernabé y del coordinador, comprueba que cada perfil exista y registra la asignación desde una sesión administrativa en `tb4_ventas_privado.revisores`. Parámetros de la operación: UUID previamente verificado y `habilitado = true`. Registrar quién autorizó el cambio. Revocar mediante `habilitado = false`, preservando las decisiones históricas. El frontend carece de acceso a esa tabla.

## Reservas y calificaciones

`gestionarMiReserva({ id, versionEsperada, accion }, { actorEsperado })` admite `confirmar` y `rechazar` por el vendedor, `cancelar` por un participante y `confirmar_intercambio` independiente por cada parte. Tras un conflicto volver a consultar. Una confirmación individual se registra sin marcar el artículo vendido. Rechazo, cancelación y expiración conservan el motivo en una reserva cancelada.

`calificarMiIntercambio({ reservaId, estrellas, comentario }, { actorEsperado })` acepta una calificación por participante después de ambas confirmaciones. Un reintento idéntico devuelve su registro y uno alterado devuelve conflicto. No hay lectura pública, edición ni agregados de reputación en esta fase.

La [programación administrativa](../supabase/validacion/programar_expiracion_tb4.sql) requiere Supabase Cron habilitado, aprobación para registrar el trabajo y un ensayo de ejecución. La función privada procesa hasta 100 reservas por ciclo con el mismo bloqueo que los participantes. El trabajo previsto se ejecuta cada minuto, fuera de la interfaz. Configurar alertas de fallos y verificar que no haya otro programador del mismo trabajo.

## Demo reproducible

Usar dos cuentas sintéticas autorizadas, cada una con su bandeja y perfil de navegador. Registrarlas por Auth, confirmar el correo y completar perfiles con los directorios. Mantener un registro privado de alias e IDs de cuenta, claves de idempotencia no secretas, UUID de artículos y estados del ensayo. Consultar ese inventario antes de reenviar operaciones. Usar prefijo de título y mensajes de demostración para poder verificar resultados sin ambigüedad. Evitar insertar directamente usuarios Auth o datos que pretendan ser evidencias reales.

La cuenta vendedora envía la solicitud con normas 1.0 y un revisor autorizado distinto la decide. Cargar fotografías privadas autorizadas y asociarlas solo tras pasar el verificador. La cuenta compradora consulta y fotografía el catálogo, abre conversación y prueba intercambio de mensajes desde dos dispositivos. Recargar el tramo reciente y deduplicar por UUID. Reservar con versión vigente, confirmar como vendedor y confirmar el intercambio una vez por participante. Emitir ambas calificaciones. Verificar una reserva, un artículo vendido, dos confirmaciones y dos calificaciones. Si el ensayo se repite, usar los IDs ya registrados o crear una nueva serie identificable. No borrar datos de ensayos anteriores.

Activar y probar cada lote solo con autorización de coordinación. Las migraciones 7 a 12 aportan vendedores, CRUD, Storage, reservas y mensajería. Las siguientes aportan normas, ciclo, calificaciones y los cambios de fotos descritos en la sección de despliegue. Conservar las seis primeras. No se ejecutó el procedimiento en el proyecto real.

## Fotos privadas y reemplazo

El flujo de Matías conserva `actorEsperado` y la clave del intento. Después de subir una foto a la ruta inmutable del titular con `upsert: false`, llama a `verificarMiFoto({ ruta, actorEsperado }, { signal })`. El servidor verifica Auth, compara propietario y versión de Storage, descarga con un límite de 2 MiB, decodifica JPEG/PNG/WebP y registra digest SHA-256, dimensiones y versión. El alta y el reemplazo solo consumen evidencia del titular. La revisión limita la decodificación a 24 millones de píxeles y una sola imagen.

`reemplazarMiFoto({ id, versionEsperada, claveIdempotencia, ruta }, { actorEsperado })` sustituye la referencia en una transacción y conserva la evidencia histórica. Un conflicto preserva la foto previa. El SDK del navegador dejó de pedir firmas directamente. `resolverFotoPrivada(id, { signal })` usa la función Netlify. El servidor vuelve a comprobar visibilidad con el JWT del lector y correlaciona el objeto con su versión y propietario antes de devolver una firma. Usa 60 segundos por defecto y rechaza más de 300. Mantener firmas solo en memoria y nunca en registros ni contexto del agente.

La función arranca cerrada. Para habilitar, verificar permisos de lectura de `storage.objects` para el propietario de las funciones de evidencia, el contrato de `owner_id` y `version`, las rutas reales de Storage API y las políticas contra firmas directas. Configurar `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TB4_FOTOS_ORIGEN` y `TB4_STORAGE_SERVICE_KEY` exclusivamente en el entorno de funciones. La última credencial es privilegiada en Storage y PostgREST. Requiere autorización, rotación y acceso restringido a la función. No se activa `TB4_FOTOS_HABILITADAS` hasta completar el lote y la validación. El navegador no recibe esa clave.

### Limpieza administrativa

Proponer siete días como ventana mínima para huérfanos de demo, pendiente de ratificación. Excluir rutas históricas que no puedan reconciliarse. Un operador autorizado debe:

1. Inventariar candidato y versión mediante la API autorizada. Verificar que el objeto exceda la retención y carezca de referencia actual o histórica bajo `public.articulos` y `tb4_ventas_privado.fotos_verificadas`, incluidos artículos retirados.
2. En una transacción, tomar `pg_advisory_xact_lock(hashtextextended(ruta,41))`, repetir controles y registrar la ruta en `tb4_ventas_privado.fotos_en_limpieza` para excluir validación y vinculación. Confirmar la transacción antes de tocar Storage. Las operaciones de evidencia, alta y reemplazo comparten ese bloqueo.
3. Confirmar que la versión de Storage sigue siendo la inventariada. Borrar mediante API administrativa exclusivamente la ruta excluida. Si falla, conservar la exclusión y reintentar sobre el mismo objeto tras revisar. Conservar el registro de la exclusión para impedir reutilización de la ruta anterior y registrar resultado administrativo.

## Lugar de encuentro

`acordarLugarMiReserva({ id, versionEsperada, lugarId, aceptar }, { actorEsperado })` propone un lugar oficial activo del campus del artículo, o un lugar externo autorizado del catálogo sin campus. La contraparte acepta la propuesta vigente. La operación conserva identidad y versión. No hay geolocalización ni dirección privada. Coordinar en UI cómo mostrar y reintentar una propuesta antes de eventual cambio de un lugar ya acordado.

## Lotes de liberación

| Lote | Versiones | Antes | Después |
| --- | --- | --- | --- |
| Base ya aplicada | 1 a 6 | Contrastar blobs e historial con la preinspección. | Confirmar trigger, directorios, perfiles y ACL base. |
| Backend pendiente | `00200`, `00300`, `00400`, `00500`, `00600`, `00700`, `00800`, `00900`, `01000`, `01100`, `01200`, todas con prefijo `20261125` | Revisar PR #81 y reunir el lote ordenado. Inventariar bucket y URLs históricas, permisos de Storage y parámetros Auth. Conciliar las nuevas firmas de RPC y los adaptadores. Mantener cerrada la función de fotos durante la aplicación. Confirmar rol que ejecutará Storage y que existe `service_role` para la credencial servidor. | Verificar 17 versiones, RLS por rol, ACL de RPC y fixture de dos cuentas. Registrar asignaciones de revisores mediante el procedimiento anterior. Autorizar Cron, comprobar un ciclo exitoso y ensayar rechazo, expiración y finalización. Habilitar la función de fotos solo tras validar autorización, bytes, firma y reemplazo en el proyecto. |

En un entorno compartido, aplicar las versiones pendientes en su orden y sin tráfico de publicación durante el corte de Storage. Las seis migraciones de base conservan su contenido. El [plan integral](VALIDACION_BACKEND_TB4.md) conserva el inventario y los pasos de preinspección de la fase previa. El orden de esta sección y las decisiones de este documento sustituyen las pendientes de normas, TTL y ciclo de reservas descritas allí. Los controladores de Matías, Maricielo y Catálogo requieren conexión coordinada antes de la demo.
