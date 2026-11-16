# PostgreSQL TB4 — Etapa A y componente B/A

## Estado documental al 15/11/2026

Rama actual: `integracion/bernabe`. Tres migraciones versionadas: tablas,
índices y trigger mínimo de perfiles, en ese orden. Implementado en repositorio
no significa aplicado o probado en Supabase real. Esta corrección es documental.

La revisión técnica y las pruebas locales históricas no sustituyen la aprobación
de coordinación sobre esquema, contratos o despliegue. La
[propuesta vendedor](../docs/PROPUESTA_ACTIVACION_VENDEDORES_TB4.md) recoge las reglas
definitivas: solicitudes sin experiencia ni enlaces comerciales, 48 horas corridas
desde el envío, nunca aprobación por vencimiento, revisores y administradores
designados por coordinación, campana junto al avatar y recorrido perfil vendedor
activo → Publicar artículo → formulario. Tablas y RPC siguen siendo propuestas.
Los enlaces a páginas de venta son opcionales y complementarios para revisión
humana; no se exige experiencia ni enlaces y no producen aprobación automática.
No constan personas designadas ni permisos de revisión concedidos en esta ronda;
la designación y ratificación del procedimiento propuesto quedan pendientes.

Se distinguen cuatro decisiones independientes:

1. **Revisión técnica:** evalúa archivos, riesgos y evidencia; no concede aprobación.
2. **Propuesta del responsable técnico:** describe una solución candidata y sus límites.
3. **Aprobación de coordinación:** ratifica las decisiones de esquema, contratos y
   responsables; no se presume por la conformidad del autor técnico.
4. **Autorización de implementación y despliegue:** define expresamente qué se puede
   ejecutar y en qué entorno. Aprobar una propuesta documental no autoriza por sí
   solo a implementarla ni a desplegarla en Supabase compartido.

No están implementados RLS de aplicación, GRANTS de aplicación, RPC de negocio,
notificaciones persistentes ni configuración/políticas Storage. El REVOKE de
la función del trigger sí existe y no equivale a esos controles. No exponer el
conjunto por Data REST sin completar autorización; los permisos remotos no se
inspeccionaron.

Usuarios preexistentes: el trigger solo cubre INSERT futuros de Auth. Pendiente
inventariar cuentas sin perfil y vendedores activos sin evidencia, definir su
regularización y autorizarla por separado. No se ejecuta backfill ni se modifican
datos reales.

Validación actual: lectura de SQL, documentos, historial y diff; sin repetir SQL.
Los resultados de PostgreSQL 18 descritos abajo son históricos, con Auth simulado.
No acreditan GoTrue/signUp, correo, REST, roles reales, aislamiento entre usuarios,
Storage ni Realtime. Esas validaciones requieren Supabase real y autorización
separada; no se ejecutan en el proyecto compartido en esta tarea. Concurrencia de
reservas y flujo vendedor tampoco están probados.

## Registro histórico y reconciliación

Las notas siguientes conservan la evidencia previa; se actualizan las pendientes
de Etapa A para no presentar el trigger implementado como trabajo futuro.

## Continuación 14/11/2026: reconciliación y componente B/A

### Revisión adicional de seguridad del trigger (local)

Se repitieron `perfil_minimo_etapa_b.sql` y `seguridad_trigger_perfil.sql` con
psql ON_ERROR_STOP en PostgreSQL 18 desechable y Auth simulado: ambas pasaron.
La segunda prueba inspecciona pg_proc, pg_roles, ACL y estado RLS; después revierte
todos los cambios con ROLLBACK. Propietario observado: etapa_b, superusuario y
BYPASSRLS local; propietario de perfiles también etapa_b; ACL {etapa_b=X/etapa_b},
SECURITY DEFINER verdadero y proconfig con search_path vacío. Ningún grant a PUBLIC.
Los roles sintéticos sin membresías no tienen EXECUTE ni INSERT en perfiles,
pero la inserción Auth dispara el trigger correctamente. El propietario conserva
su capacidad administrativa; revocar PUBLIC no limita a propietarios/superusuarios.

Se probó además un propietario NOLOGIN, NOSUPERUSER, NOBYPASSRLS: con RLS habilitado
y sin políticas el trigger inserta porque ese rol posee perfiles. FORCE RLS bloquea
esa inserción y revierte también auth.users. Otro definidor NOSUPERUSER con BYPASSRLS
y privilegio INSERT sí inserta incluso con FORCE. SECURITY DEFINER por sí solo no
evade RLS: depende del propietario efectivo. Las futuras políticas deberán preservar
el alta mínima sin conceder inserción de perfiles al frontend.

Con search_path hostil del invocador, una tabla homónima en un esquema escribible,
otra temporal y una función homónima a gen_random_uuid, solo public.perfiles recibió
la fila. El cuerpo no usa SQL dinámico ni nombres de relación sin calificar;
NEW.id es el registro del trigger. search_path vacío no elimina la búsqueda implícita
de pg_catalog/pg_temp: la referencia public.perfiles es la protección decisiva para
esta inserción. Los defaults actuales usan funciones incorporadas vinculadas al
crear las tablas. El esquema, la tabla y sus triggers/defaults deben seguir bajo
control administrativo; esto no garantiza seguridad de futuras funciones no
calificadas ni de objetos modificables por roles no confiables.

La migración no fija OWNER: lo recibe del rol que la ejecute. Estos resultados NO
identifican al propietario ni los grants/membresías/default privileges del proyecto
Supabase. Su inventario real y signUp/GoTrue siguen sin validar; no se consultó ni
modificó el servicio compartido. No hubo commit/push. El clúster local se detuvo.

Referencias: [SECURITY DEFINER](https://www.postgresql.org/docs/18/sql-createfunction.html)
y [RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).

El registro histórico consigna revisión técnica y conformidad de Bernabé.
Esto no acredita aprobación de coordinación ni autorización de despliegue. Se continúa en
`integracion/bernabe`, conservando las dos migraciones A y los contratos aprobados.
Las decisiones históricas descritas más abajo corresponden a Etapa A.

- Objetivo aprobado para precio: INTEGER, 1–2147483647 céntimos, PEN.
  Aún no aplicado: Etapa A sigue usando BIGINT y su prueba de 3000000000 sigue vigente.
  Requiere una migración adicional independiente, nunca reescribir la anterior.
- Fotografía: conservar las siete columnas físicas. DTO como propuesta técnica
  del responsable, pendiente de ratificación por coordinación y validación con
  los responsables frontend: `imagen: { proveedor: 'supabase', bucket: 'articulos', ruta,
  url, ancho, alto, formato, bytes }`. El servicio mapeará las columnas imagen_*;
  presentación de catálogo usa `foto: { url, alt }`. No hay adaptador implementado.
  Validación con Angel/Matías y ratificación de coordinación pendientes antes de
  integrar consumidores; no constituye contrato aprobado ni autoriza implementación.
- Tamaño objetivo: 1–2097152 bytes (2 MiB), JPEG/PNG/WebP; reemplaza la propuesta
  de 5 MiB del diseño. Restricción SQL y configuración Storage aún pendientes.
- Lugares externos con campus_id NULL ratificados; ya implementados en Etapa A.

Componente A: `migrations/20261114000100_trigger_perfil_minimo.sql`, después de
las dos migraciones A. Trigger AFTER INSERT en auth.users, SECURITY DEFINER y
search_path vacío, referencias calificadas y sin EXECUTE para PUBLIC. Solo
inserta el UUID; no copia metadatos ni concede permisos de vendedor. Los errores
se propagan y revierten la creación Auth. No rellena usuarios preexistentes;
inventariarlos antes de una futura aplicación autorizada. Revisar propietario
y privilegios reales de la función en ese entorno antes de aplicar.

Verificación local realizada en PostgreSQL 18 desechable, 127.0.0.1:55440,
sin Supabase ni credenciales reales. Se aplicaron las migraciones A, se ejecutó
su prueba original y después se aplicó B/A y `tests/db/perfil_minimo_etapa_b.sql`.
Todo pasó: perfil mínimo, metadatos hostiles ignorados, UPDATE Auth sin sobrescribir
perfil, rollback atómico al fallar el trigger y ejecución desde un rol Auth
sintético sin acceso directo a perfiles ni EXECUTE de la función. Datos y rol
de prueba se revierten con ROLLBACK. La prueba requiere administrador local y
auth.users simulado con id uuid PK y raw_user_meta_data jsonb.

Para repetir, usar psql con host/puerto/usuario/base explícitos del clúster
desechable, `-X -v ON_ERROR_STOP=1 -f tests/db/perfil_minimo_etapa_b.sql`, una vez
aplicadas las tres migraciones. La prueba A original se ejecuta antes del trigger,
pues inserta perfiles manualmente: no representa una prueba posterior a B/A.

Pendiente real: signUp/GoTrue, correo y permisos efectivos de Supabase. No se
declaran probados RLS, aislamiento entre usuarios, RPC, Storage ni concurrencia.
Se detiene tras componente A; B/C/D se revisarán por separado. No aplicar este
conjunto a una API expuesta: todavía falta RLS y grants. Sin push, merge ni deploy.

Etapa A se preparó históricamente en `feature/bernabe/esquema-rls`; la rama
actual es `integracion/bernabe`. **No ejecutado en Supabase ni autorizado para despliegue.** No usar db push/reset contra el proyecto compartido.

Orden:

1. `migrations/20261113000100_tablas_tb4.sql`: exactamente nueve tablas, FK, CHECK, claves candidatas y defaults.
2. `migrations/20261113000200_indices_tb4.sql`: unicidad normalizada, índices de consultas/FK y reserva activa única.
3. `migrations/20261114000100_trigger_perfil_minimo.sql`: trigger mínimo Auth implementado en B/A.

Requiere PostgreSQL con `gen_random_uuid()` y `auth.users` existente (Supabase). No crea Auth, extensiones, buckets, usuarios ni otras tablas. Migraciones de una sola aplicación: sin `IF NOT EXISTS` para no ocultar diferencias con objetos previos. Antes de cualquier aplicación futura hay que inventariar el esquema real.

## Decisiones de implementación

- UUID PK, fechas `timestamptz DEFAULT now()`. Perfiles sin UUID automático: PK/FK a Auth, nombre/campus NULL, vendedor FALSE; sin correo ni credenciales. Se conserva versión del diseño para concurrencia.
- Precio `bigint > 0`, PEN. BIGINT excede el rango seguro de Number: el futuro servicio debe rechazar importes no representables con exactitud o acordar serialización decimal antes de consumir REST. No se declara resuelto esto con un parseo Number directo.
- Foto en las siete columnas solicitadas, sin JSON duplicado. El ejemplo `select=...imagen` de SPEC §8 deberá alinearse en el servicio con `imagen_bucket`, `imagen_ruta`, `imagen_url`, `imagen_formato`, `imagen_bytes`, `imagen_ancho`, `imagen_alto`. El SPEC exige alineación con migraciones y no fija expresamente JSON como representación física. No se modifica el contrato aprobado ni se crea una vista/API adicional aquí.
- Una foto obligatoria, MIME JPEG/PNG/WebP, ruta bajo vendedor y extensión coherente, metadatos positivos. La propuesta histórica de 5 MiB se sustituyó por el objetivo de 2 MiB descrito arriba, todavía sin restricción SQL ni Storage; tampoco se fija bucket/origen remoto desconocido. CHECK no demuestra existencia ni contenido real del objeto.
- Artículo disponible/reservado/vendido con `eliminado_en` para borrado lógico, no un cuarto estado. Índices de catálogo excluyen borrados; no son filtros de seguridad ni impiden DELETE. Historial no usa cascadas: FK `ON DELETE RESTRICT`; no se implementa borrado de cuentas.
- Relaciones compuestas evitan conversación/reserva con vendedor distinto al del artículo y reserva enlazada a conversación de otro artículo/comprador/vendedor. Las claves candidatas adicionales no crean nuevas tablas. La FK de conversación es opcional, sus otros componentes no son NULL.
- Estados de reserva pendiente/confirmada activos; completada/cancelada terminales en el diseño. Índice único parcial garantiza una activa. Los CHECK solo validan conjuntos/formas, **no transiciones ni sincronización con artículos**.
- Punto sin propuesta, de catálogo o personalizado mutuamente excluyentes. Nombre personalizado 3–100; referencia pública requerida en personalizado, hasta 150; proponente participante. Estado aceptado no demuestra aún aceptación por la contraparte: esa comprobación pertenece a RPC posterior.
- Campus de lugar público NULL autorizado por Bernabé en esta conversación; discrepancia con campus conocido del SPEC §6.1 pendiente de formalización. No hay geolocalización ni afirmación de verificación física.
- Catálogos con nombres normalizados por trim/minúsculas, no eliminación de tildes. Distrito/ciudad nullable mientras se ratifican los datos; orden de categorías no único. No se cargan los 11 UUID ni se alteran.

## Lo que aún no está implementado

El trigger mínimo ya está implementado en B/A. Siguen pendientes de implementación y de las aprobaciones correspondientes: generación/actualización protegida de fechas y versiones, RLS, grants por columna, autoría `auth.uid()`, vendedores autorizados, RPC de reservas con bloqueo/cancelación, inmutabilidad de participantes y políticas Storage. Los defaults no impiden que un actor con permisos suministre valores propios.

**No aplicar estas migraciones solas a un esquema expuesto por Data REST:** aún no hay RLS/grants. Etapa A es estructura para revisión, no una entrega segura para frontend. No se declaran probadas privacidad, autorización o reserva transaccional.

Pendiente de ratificación antes de Etapa B: quién confirma/completa/cancela, criterios institucionales de revisión vendedor (las reglas definitivas del flujo ya están documentadas), permisos de lectura pública, aceptación de puntos y tratamiento de borrado de cuenta. No se implementan esas decisiones silenciosamente. Los valores estructurales de estado/condición provienen del diseño revisado; si se cambian tras revisión, habrá que actualizarlo antes de aplicar.

Etapa C: semillas separadas con los 11 UUID del manifiesto, solo cuando se aprueben sus datos, y pruebas integrales de integridad/RLS/concurrencia. No hay semillas ni pruebas de RPC en esta etapa.

## Verificación local realizada

Se encontró PostgreSQL 18 instalado, aunque no estaba en PATH. Tras un rechazo de initdb por restricciones del sandbox, se autorizó iniciar un clúster temporal nuevo en `%TEMP%`, escuchando solo en `127.0.0.1:55439`, usuario local de pruebas `etapa_a`. Autenticación trust solo para esa instancia efímera; no contiene datos ni credenciales reales. No se usó ninguna conexión de Supabase. La instancia se detuvo correctamente al terminar; los archivos temporales no se eliminaron.

En ese clúster se creó únicamente un sustituto `auth.users(id uuid PRIMARY KEY)` y se aplicaron ambas migraciones con `psql -X -v ON_ERROR_STOP=1`. Las nueve tablas y los 25 índices explícitos se crearon correctamente. El sustituto no equivale a probar triggers/Auth real ni roles Supabase.

Se ejecutó `tests/db/estructura_etapa_a.sql`: comprueba nueve tablas, defaults de perfiles, importe de 3 000 000 000 céntimos (superior a INTEGER), unicidad normalizada, FK Auth y contexto de conversaciones/reservas, rechazo de precio cero/negativo y ruta ajena, puntos incompletos/proponentes ajenos, segunda reserva activa, reutilización del índice tras cancelación y conservación del historial. Datos sintéticos bajo BEGIN/ROLLBACK. Un primer pase detectó que la prueba debía capturar también `restrict_violation` al intentar borrar un artículo con historial; se corrigió la prueba y el pase completo terminó sin errores.

Para repetir en otra base **desechable ya preparada** con el sustituto Auth y las dos migraciones: `psql -X -v ON_ERROR_STOP=1 -f tests/db/estructura_etapa_a.sql`, especificando siempre host, puerto, usuario y base de ese entorno aislado. No ejecutar contra entornos compartidos. Esta prueba verifica integridad, no autorización ni concurrencia entre sesiones. Pruebas integrales/RLS/RPC se mantienen para etapas posteriores.
