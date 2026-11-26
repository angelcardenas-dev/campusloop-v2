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
