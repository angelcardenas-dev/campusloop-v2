# Conversaciones y mensajes TB4

La migración `20261125000700` depende de perfiles (`c9943e6`), del auxiliar privado de cuenta confirmada y de las tablas de las primeras migraciones. Conversar no requiere una reserva, según la especificación. El vínculo opcional existente entre una reserva y una conversación conserva la clave foránea que verifica artículo y participantes. La rama de mensajería no incluye el PR de reservas #82 ni el de vendedores y Storage #81. [Especificación TB4](../SPEC_TB4.md)

| Servicio | Contrato |
| --- | --- |
| `iniciarMiConversacion(articuloId)` | Devuelve la conversación del comprador para el artículo. Deriva comprador de Auth y vendedor del artículo. Devuelve la fila existente al repetir. Un artículo retirado no admite una conversación nueva, pero los participantes conservan sus conversaciones previas. |
| `enviarMiMensaje({ conversacionId, mensajeId, texto })` | Solo un participante puede enviar. La interfaz conserva el mismo UUID al reintentar. Texto plano recortado, entre 1 y 1000 caracteres. Una repetición idéntica devuelve la fila previa. Cambiar el contenido, participante o conversación con el mismo UUID produce conflicto sin devolver datos ajenos. |
| `consultarMisConversaciones({ limite, cursor, signal })` | Lee solo conversaciones propias, ordenadas por fecha e ID descendentes. |
| `consultarMensajes(conversacionId, { limite, cursor, signal })` | Lee mensajes de una conversación autorizada, ordenados por fecha e ID ascendentes. |

Los cursores se forman con `{ creadoEn, id }` de la última fila, conservando la fecha textual del servidor. El límite por página es de 1 a 50. Los servicios reutilizan el cliente Supabase y devuelven `{ ok, datos, error }`. La interfaz debe mostrar el texto como texto y después de confirmar el envío. La paginación y el UUID estable permiten recuperar y deduplicar filas al reconectar.

Las dos RPC usan un rol sin login ni acceso a Auth. Ese rol solo puede insertar las columnas permitidas y consultar las conversaciones en las que participa el actor. El cliente conserva lectura por RLS y carece de escritura directa. Agregar una conversación nueva utiliza un bloqueo compartido del artículo, compatible con la edición, retiro y reserva que bloquean la misma fila.

La UI de Maricielo, Realtime y la conciliación de la lista de recursos de Netlify al combinar ramas quedan para la integración. Edición, borrado, adjuntos, bloqueo de usuarios, notificaciones y retención quedan fuera del alcance de estas operaciones. La migración se probó en PostgreSQL desechable y sigue pendiente de aplicación real.
