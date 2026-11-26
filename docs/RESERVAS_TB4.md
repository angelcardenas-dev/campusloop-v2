# Alta y lectura de reservas TB4

**Corrección B02.** `crearMiReserva({ articuloId, versionArticulo }, { actorEsperado })` requiere el UUID capturado al iniciar la intención. El servicio verifica que la sesión actual coincide antes de la RPC y transmite ese UUID original a `p_actor_esperado`. La UI debe invalidar la intención y las respuestas tardías al cambiar cuenta o sesión. Después de un resultado incierto, consulta las reservas antes de reintentar; el botón no proporciona idempotencia del servidor.

La rama local de reservas parte del commit de perfiles `c9943e6`. La [migración](../supabase/migrations/20261125000600_alta_reservas_tb4.sql) requiere las seis migraciones aplicadas y reutiliza el auxiliar privado de identidad confirmada. No depende de las migraciones de vendedores, artículos o Storage del PR apilado. Comparte el bloqueo de fila del artículo con su edición y retiro.

`crearMiReserva({ articuloId, versionArticulo }, { actorEsperado })` exige un artículo disponible y la versión leída. El comprador se obtiene de Auth y el vendedor del artículo bloqueado. Una discrepancia de sesión, compra propia, versión obsoleta o artículo oculto impide el alta. En una transacción cambia el artículo a reservado e inserta una reserva pendiente. El índice parcial existente garantiza una activa y un fallo de inserción revierte el cambio del artículo. Tras un resultado incierto, consultar las reservas antes de repetir la operación.

`consultarMisReservas({ signal })` devuelve hasta 50 reservas recientes del comprador o vendedor verificado. Usa el SELECT acotado con RLS y una nueva guarda restrictiva de cuenta registrada. Las escrituras directas siguen cerradas para el navegador. El rol sin login que ejecuta el alta carece de acceso al esquema Auth y no puede actualizar reservas ni editar el precio del artículo.

La migración posterior `20261125000900` prepara confirmación, rechazo, cancelación, expiración de pendientes a las 48 horas y doble confirmación del intercambio. La programación de Supabase Cron sigue pendiente de autorización y prueba real. El punto de encuentro se trata en `20261125001200`; pagos permanecen fuera de TB4. [Especificación TB4](../SPEC_TB4.md)

Pruebas de esta fase: [SQL local](../tests/db/reservas_tb4.sql) y [JavaScript](../tests/reservas/reservas.test.mjs). El entorno SQL requiere Auth simulado con `email_confirmed_at` y las seis migraciones de base antes del alta. Ejecutar SQL solo en PostgreSQL desechable. No se aplicó la migración a Supabase real.
