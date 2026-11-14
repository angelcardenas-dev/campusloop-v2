# PostgreSQL TB4 — FASE 3, Etapa A

SQL preparado para revisión en `feature/bernabe/esquema-rls`. **No ejecutado en Supabase ni autorizado para despliegue.** No usar db push/reset contra el proyecto compartido.

Orden:

1. `migrations/20261113000100_tablas_tb4.sql`: exactamente nueve tablas, FK, CHECK, claves candidatas y defaults.
2. `migrations/20261113000200_indices_tb4.sql`: unicidad normalizada, índices de consultas/FK y reserva activa única.

Requiere PostgreSQL con `gen_random_uuid()` y `auth.users` existente (Supabase). No crea Auth, extensiones, buckets, usuarios ni otras tablas. Migraciones de una sola aplicación: sin `IF NOT EXISTS` para no ocultar diferencias con objetos previos. Antes de cualquier aplicación futura hay que inventariar el esquema real.

## Decisiones de implementación

- UUID PK, fechas `timestamptz DEFAULT now()`. Perfiles sin UUID automático: PK/FK a Auth, nombre/campus NULL, vendedor FALSE; sin correo ni credenciales. Se conserva versión del diseño para concurrencia.
- Precio `bigint > 0`, PEN. BIGINT excede el rango seguro de Number: el futuro servicio debe rechazar importes no representables con exactitud o acordar serialización decimal antes de consumir REST. No se declara resuelto esto con un parseo Number directo.
- Foto en las siete columnas solicitadas, sin JSON duplicado. El ejemplo `select=...imagen` de SPEC §8 deberá alinearse en el servicio con `imagen_bucket`, `imagen_ruta`, `imagen_url`, `imagen_formato`, `imagen_bytes`, `imagen_ancho`, `imagen_alto`. El SPEC exige alineación con migraciones y no fija expresamente JSON como representación física. No se modifica el contrato aprobado ni se crea una vista/API adicional aquí.
- Una foto obligatoria, MIME JPEG/PNG/WebP, ruta bajo vendedor y extensión coherente, metadatos positivos. El límite de 5 MiB del diseño sigue como propuesta, no se impone sin ratificación; tampoco se fija bucket/origen remoto desconocido. CHECK no demuestra existencia ni contenido real del objeto.
- Artículo disponible/reservado/vendido con `eliminado_en` para borrado lógico, no un cuarto estado. Índices de catálogo excluyen borrados; no son filtros de seguridad ni impiden DELETE. Historial no usa cascadas: FK `ON DELETE RESTRICT`; no se implementa borrado de cuentas.
- Relaciones compuestas evitan conversación/reserva con vendedor distinto al del artículo y reserva enlazada a conversación de otro artículo/comprador/vendedor. Las claves candidatas adicionales no crean nuevas tablas. La FK de conversación es opcional, sus otros componentes no son NULL.
- Estados de reserva pendiente/confirmada activos; completada/cancelada terminales en el diseño. Índice único parcial garantiza una activa. Los CHECK solo validan conjuntos/formas, **no transiciones ni sincronización con artículos**.
- Punto sin propuesta, de catálogo o personalizado mutuamente excluyentes. Nombre personalizado 3–100; referencia pública requerida en personalizado, hasta 150; proponente participante. Estado aceptado no demuestra aún aceptación por la contraparte: esa comprobación pertenece a RPC posterior.
- Campus de lugar público NULL autorizado por Bernabé en esta conversación; discrepancia con campus conocido del SPEC §6.1 pendiente de formalización. No hay geolocalización ni afirmación de verificación física.
- Catálogos con nombres normalizados por trim/minúsculas, no eliminación de tildes. Distrito/ciudad nullable mientras se ratifican los datos; orden de categorías no único. No se cargan los 11 UUID ni se alteran.

## Lo que aún no está implementado

Etapa B requiere aprobación: trigger mínimo de perfil, generación/actualización protegida de fechas y versiones, RLS, grants por columna, autoría `auth.uid()`, vendedores autorizados, RPC de reservas con bloqueo/cancelación, inmutabilidad de participantes y políticas Storage. Los defaults no impiden que un actor con permisos suministre valores propios.

**No aplicar estas migraciones solas a un esquema expuesto por Data REST:** aún no hay RLS/grants. Etapa A es estructura para revisión, no una entrega segura para frontend. No se declaran probadas privacidad, autorización o reserva transaccional.

Pendiente de ratificación antes de Etapa B: quién confirma/completa/cancela, criterios de activación vendedor, permisos de lectura pública, aceptación de puntos y tratamiento de borrado de cuenta. No se implementan esas decisiones silenciosamente. Los valores estructurales de estado/condición provienen del diseño revisado; si se cambian tras revisión, habrá que actualizarlo antes de aplicar.

Etapa C: semillas separadas con los 11 UUID del manifiesto, solo cuando se aprueben sus datos, y pruebas integrales de integridad/RLS/concurrencia. No hay semillas ni pruebas de RPC en esta etapa.

## Verificación local realizada

Se encontró PostgreSQL 18 instalado, aunque no estaba en PATH. Tras un rechazo de initdb por restricciones del sandbox, se autorizó iniciar un clúster temporal nuevo en `%TEMP%`, escuchando solo en `127.0.0.1:55439`, usuario local de pruebas `etapa_a`. Autenticación trust solo para esa instancia efímera; no contiene datos ni credenciales reales. No se usó ninguna conexión de Supabase. La instancia se detuvo correctamente al terminar; los archivos temporales no se eliminaron.

En ese clúster se creó únicamente un sustituto `auth.users(id uuid PRIMARY KEY)` y se aplicaron ambas migraciones con `psql -X -v ON_ERROR_STOP=1`. Las nueve tablas y los 25 índices explícitos se crearon correctamente. El sustituto no equivale a probar triggers/Auth real ni roles Supabase.

Se ejecutó `tests/db/estructura_etapa_a.sql`: comprueba nueve tablas, defaults de perfiles, importe de 3 000 000 000 céntimos (superior a INTEGER), unicidad normalizada, FK Auth y contexto de conversaciones/reservas, rechazo de precio cero/negativo y ruta ajena, puntos incompletos/proponentes ajenos, segunda reserva activa, reutilización del índice tras cancelación y conservación del historial. Datos sintéticos bajo BEGIN/ROLLBACK. Un primer pase detectó que la prueba debía capturar también `restrict_violation` al intentar borrar un artículo con historial; se corrigió la prueba y el pase completo terminó sin errores.

Para repetir en otra base **desechable ya preparada** con el sustituto Auth y las dos migraciones: `psql -X -v ON_ERROR_STOP=1 -f tests/db/estructura_etapa_a.sql`, especificando siempre host, puerto, usuario y base de ese entorno aislado. No ejecutar contra entornos compartidos. Esta prueba verifica integridad, no autorización ni concurrencia entre sesiones. Pruebas integrales/RLS/RPC se mantienen para etapas posteriores.
