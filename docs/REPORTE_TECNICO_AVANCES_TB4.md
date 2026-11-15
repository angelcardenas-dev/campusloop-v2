# CampusLoop V2 — reporte técnico de correcciones y avances TB4

Fecha de corte documental: 15/11/2026, Perú. Rama auditada: `integracion/bernabe`.
HEAD comprobado antes de esta ronda: `5d9f15034a35b927274525f9d2386862ba5d1008`
(`5d9f150`), igual a la referencia local `origin/integracion/bernabe`.
Destino: PR #36 hacia `develop`, abierto, sin fusionar y pendiente de aprobación,
según el contexto remoto confirmado por el responsable para esta ronda.
Este reporte es una auditoría documental y de Git, no una autorización de despliegue.

Alcance del corte: revisión de solo lectura del historial y contenido de ambas
ramas, seguida de correcciones únicamente en los tres documentos indicados.
El árbol estaba limpio al inicio. No se hace commit, push ni integración.
El futuro SHA documental se comunicará después del commit y, si se autoriza,
de su publicación; `5d9f150` no representa ese HEAD futuro.

## 1. Resultado general y alcance de la evidencia

La Etapa A está implementada como dos migraciones versionadas con nueve tablas y
25 índices explícitos. El componente A de Etapa B añade un trigger de perfil mínimo,
con pruebas locales de integridad, atomicidad y contexto de seguridad. No existen
migraciones de RLS, GRANTS de aplicación, RPC de negocio ni políticas Storage.
La activación manual de vendedores sigue siendo una propuesta documental.

| Clasificación | Significado en este reporte |
| --- | --- |
| Implementado | Existe código/migración en el repositorio; no implica aplicado a Supabase |
| Probado localmente | Resultado histórico consignado en el reporte previo y README, con PostgreSQL desechable y Auth simulado; no repetido ahora |
| Propuesto | Diseño documentado sin implementación ejecutable |
| Pendiente | Falta acuerdo, implementación o validación; se especifica cuál |

Comprobaciones ejecutadas ahora: `git status`, `log`, `rev-parse`,
`merge-base`, `rev-list --left-right --count`, `show`, `ls-tree` y `diff`,
lectura de los tres documentos y del contenido relevante de `origin/develop`,
revisión de coherencia y `git diff --check`.
No se repitieron pruebas SQL, Auth, IA, publicaciones ni Netlify. Los pases
locales conservados en las secciones siguientes son históricos, consignados
en el reporte previo y en [supabase/README.md](../supabase/README.md).
No se consultó ni ejecutó SQL en Supabase compartido.

Fuente remota para esta ronda: el responsable confirmó PR #36 abierto y pendiente
de aprobación, 9 commits y 10 archivos en la revisión anterior. Esta sesión
corrobora el historial y el inventario con referencias Git locales, sin fetch ni
nueva consulta de GitHub. No se inventan revisiones individuales, aprobaciones
registradas, resultados de checks ni estado de mergeabilidad.
Los intentos fallidos de consultar GitHub descritos en versiones anteriores son
históricos; no invalidan el contexto confirmado posteriormente por el responsable.

## 2. Bases de comparación y commits

No se interpreta «estado inicial» como un snapshot inventado. Se distinguen:

| Base verificable | Uso |
| --- | --- |
| `1b44bfb` | Base declarada por el diseño FASE 2, anterior al trabajo SQL |
| `4a584d8` | Ancestro común de HEAD con develop y origin/develop; base del diff del aporte actual |
| `7d0e3f2` | Etapa A terminada; estado inicial del trabajo de continuación y seguridad |
| `98fc3e2` | Integración de Etapa A mediante PR #35 |
| `d2c0e73` | Corte histórico: trigger y pruebas locales documentadas |
| `9117238` | Corte anterior: reporte eliminado del árbol versionado |
| `6fe22b3` | Primer commit de correcciones documentales, ya histórico |
| `5d9f150` | HEAD comprobado antes de esta ronda; actualización posterior del reporte |

Nueve commits presentes en `origin/integracion/bernabe` y ausentes de
`origin/develop`, verificados ahora con Git:

| Commit | Cambio real |
| --- | --- |
| `5ce3cd8` | Documento de diseño de esquema y catálogos |
| `7d0e3f2` | Dos migraciones A, README y prueba estructural |
| `98fc3e2` | Merge del PR #35; integra el trabajo de esquema |
| `827f2e4` | Propuesta de activación manual de vendedores |
| `d2c0e73` | Trigger mínimo, dos pruebas B/A y ampliación del README |
| `ac13c1b` | Incorporó el reporte técnico de 316 líneas |
| `9117238` | Eliminó el reporte; antes del primer commit de correcciones existía sin seguimiento |
| `6fe22b3` | Actualizó propuesta y README y reincorporó el reporte; tres documentos, sin cambios funcionales |
| `5d9f150` | Actualizó únicamente el reporte: +51/-34 líneas; sin cambios funcionales |

Estos nueve commits coinciden en número con la revisión remota informada por el
responsable. Antes de integrar se deben volver a comprobar cabecera, revisiones
y checks en GitHub; el inventario actual es evidencia de las referencias locales.
El hecho de estar committeados se comprueba ahora con Git: las restricciones «sin
commit/push» de las tareas anteriores describían esas actuaciones del agente, no
el estado futuro del repositorio. No se atribuye quién ejecutó operaciones posteriores.

### Inventario de archivos

El diff de commits frente a `origin/develop` local muestra diez archivos añadidos,
1625 líneas añadidas, ningún archivo modificado preexistente ni eliminado en ese
diff. En el corte anterior `9117238` eran nueve archivos y 1213 líneas añadidas.

| Archivo | Frente a base común | Desde Etapa A `7d0e3f2` | Función |
| --- | --- | --- | --- |
| `docs/DISENO_ESQUEMA_CATALOGOS_TB4.md` | Creado | Sin cambios | Modelo inicial, UUID reservados y contratos propuestos |
| `supabase/migrations/20261113000100_tablas_tb4.sql` | Creado | Sin cambios | Nueve tablas, FK, CHECK y claves candidatas |
| `supabase/migrations/20261113000200_indices_tb4.sql` | Creado | Sin cambios | 25 índices explícitos |
| `tests/db/estructura_etapa_a.sql` | Creado | Sin cambios | Integridad estructural de A |
| `supabase/README.md` | Creado | Modificado: +128/-6 líneas | Reconciliación, ejecución local histórica y límites de seguridad |
| `supabase/migrations/20261114000100_trigger_perfil_minimo.sql` | Creado | Creado | Perfil mínimo al insertar usuario Auth |
| `tests/db/perfil_minimo_etapa_b.sql` | Creado | Creado | Perfil, metadatos, permisos y atomicidad |
| `tests/db/seguridad_trigger_perfil.sql` | Creado | Creado | Propietario, ACL, search_path y RLS simulado |
| `docs/PROPUESTA_ACTIVACION_VENDEDORES_TB4.md` | Creado | Creado | Diseño de revisión manual; no funcionalidad desplegada |
| `docs/REPORTE_TECNICO_AVANCES_TB4.md` | Creado | Creado | Trazabilidad de avances y evidencia; reincorporado en `6fe22b3` |

La comparación directa `7d0e3f2..HEAD` también incluye cambios de `js/auth.js`,
`js/config-publica.js` y dos archivos `tests/auth/`. Proceden de `cb1e13a`, trabajo
de Angel ya integrado por la línea develop/PR #33, no de las correcciones SQL de
Bernabé. No aparecen en el aporte de diez archivos frente a la base común actual.
No se atribuyen esos cambios a Bernabé ni a la continuación del trigger.

El inventario anterior corresponde a commits hasta `5d9f150`, sin incluir la
actualización actual sin commit. En `9117238`, incorporar y eliminar el reporte
se cancelaban en el diff neto; `6fe22b3` lo reincorporó como archivo versionado.
Ese primer commit contiene 411 inserciones y 16 eliminaciones en tres documentos:

| Archivo actualizado en `6fe22b3` | Cambio en ese commit | Corrección documental |
| --- | --- | --- |
| docs/REPORTE_TECNICO_AVANCES_TB4.md | Reincorporado: +343 líneas | Trazabilidad, inventario y evidencia histórica; actualizado después en `5d9f150` |
| docs/PROPUESTA_ACTIVACION_VENDEDORES_TB4.md | Modificado: +22/-10 líneas | Sin experiencia ni enlaces comerciales; 48 horas corridas; nunca autoaprobación; designación por coordinación; campana y recorrido de publicación |
| supabase/README.md | Modificado: +46/-6 líneas | Trigger implementado, revisión técnica frente a aprobación, usuarios preexistentes y límites de seguridad y pruebas |

Al inicio de esta ronda el árbol estaba limpio. Esta ronda deja únicamente tres
documentos modificados, sin commit:

| Documento | Corrección de esta ronda |
| --- | --- |
| docs/REPORTE_TECNICO_AVANCES_TB4.md | HEAD previo, nueve commits, diez archivos, PR según fuente confirmada, divergencia y dependencias |
| docs/PROPUESTA_ACTIVACION_VENDEDORES_TB4.md | Enlaces comerciales opcionales y procedimiento propuesto de habilitación/revocación de revisores, sin cambiar tablas ni RPC |
| supabase/README.md | DTO pendiente de coordinación y validación frontend; separación de revisión, propuesta, aprobación y autorización |

No se modifican SQL, contratos ni módulos funcionales de otros integrantes.
Validación actual: contraste de los tres documentos con Git y las migraciones,
revisión de coherencia y git diff. No se ejecutaron pruebas funcionales ni SQL.

## 3. Etapa A: estructura PostgreSQL implementada

Evidencia: [tablas](../supabase/migrations/20261113000100_tablas_tb4.sql),
[índices](../supabase/migrations/20261113000200_indices_tb4.sql) y
[prueba A](../tests/db/estructura_etapa_a.sql).

| Tabla | Claves y relaciones | Reglas principales |
| --- | --- | --- |
| universidades | UUID PK | Nombre/sigla válidos y normalizados únicos; activa por defecto |
| campus | UUID PK; universidad_id → universidades | Nombre único dentro de universidad; distrito/ciudad opcionales |
| categorias | UUID PK | Nombre normalizado único, orden entero no negativo, activa |
| perfiles | id PK y FK → auth.users; campus_id → campus opcional | Nombre opcional, vendedor FALSE, versión positiva y fechas coherentes |
| articulos | UUID PK; vendedor_id → perfiles; categoria_id → categorias; campus_id → campus | Precio BIGINT positivo, PEN, condición/estado enumerados, foto obligatoria y borrado lógico |
| conversaciones | UUID PK; comprador/vendedor → perfiles; (articulo_id,vendedor_id) → articulos | Participantes distintos; terna artículo/comprador/vendedor única |
| mensajes | UUID PK; conversacion_id → conversaciones; remitente_id → perfiles | Texto recortado de 1–1000; UUID cliente opcional para idempotencia futura |
| lugares_publicos | UUID PK; campus_id → campus nullable | Nombre 3–100; referencia pública opcional hasta 150; activo |
| reservas | UUID PK; comprador/vendedor/proponente → perfiles; lugar → lugares_publicos | Estado enumerado, punto coherente, versión y fechas válidas |

Todas las FK usan `ON DELETE RESTRICT`: no se destruye historial por cascada. Las
reservas usan FK compuesta hacia artículo/vendedor y, si hay conversación, hacia
la tupla conversación/artículo/comprador/vendedor. La clave candidata de artículos
y las dos de conversaciones permiten garantizar ese contexto sin añadir tablas.

Las PK UUID son generadas por servidor salvo perfiles: su UUID viene de Auth.
Las fechas tienen defaults `now()`; versiones empiezan en 1. Los defaults no impiden
que un actor con permisos envíe valores propios; faltan protecciones de escritura.

### Restricciones e índices

- Nombre/sigla de universidades y nombres de categorías: unicidad por trim/minúsculas.
  Campus: unicidad por universidad y nombre normalizado. No se eliminan tildes.
- Artículos: título 1–100, descripción 1–1000, condiciones nuevo/como_nuevo/buen_estado/usado;
  estados disponible/reservado/vendido; moneda PEN y precio >0.
- Foto: siete columnas, MIME JPEG/PNG/WebP, extensión coherente, ruta bajo UUID vendedor,
  URL HTTPS estructuralmente válida y dimensiones/bytes positivos. No valida objeto
  real, contenido binario, origen autorizado ni máximo 2 MiB.
- Reservas: pendiente/confirmada/completada/cancelada; punto sin propuesta, de catálogo
  o personalizado. Proponente debe ser participante; no demuestra aceptación de contraparte.
- Índice único parcial `reservas_articulo_activo_uq`: una pendiente/confirmada por artículo.
  No sincroniza automáticamente el estado del artículo ni implementa bloqueo transaccional.
- Los 25 índices explícitos cubren nombres normalizados, catálogos activos, FK y accesos
  por vendedor/comprador, historial de mensajes/reservas, fecha/estado/precio del catálogo
  y búsqueda GIN española. Son adicionales a índices implícitos por PK/UNIQUE.
- Índices de catálogo excluyen eliminados lógicamente. No son una política de acceso
  ni impiden SELECT/DELETE directos.

### Diferencias y correcciones respecto al diseño inicial

| Tema | Diseño/estado inicial | Estado real actual |
| --- | --- | --- |
| Precio | Diseño INTEGER, 0–2147483647; A eligió BIGINT >0 | BIGINT >0 sigue en SQL. Objetivo ratificado posteriormente: INTEGER 1–2147483647; migración correctiva pendiente |
| Foto | Diseño `imagen` JSONB | Siete columnas implementadas. DTO `imagen` como propuesta técnica pendiente de ratificación por coordinación y validación frontend; servicio/adaptador inexistente |
| Tamaño | Diseño 5 MiB; SPEC propone ≤2 MiB | Se documentó objetivo 1–2097152 bytes. No se añadió límite SQL/Storage |
| Lugares externos | Referencia SPEC a campus conocido | campus_id nullable implementado y probado; excepción ratificada, sin editar SPEC |
| Contexto de conversaciones/reservas | Reglas de participantes en diseño | FK compuestas evitan vendedor y conversación de otro contexto; no sustituyen autorización |
| Puntos incompletos | Riesgo de CHECK con NULL | CHECK exige presencia explícita de campos para evitar aceptación por resultado UNKNOWN |
| Borrado | Necesidad de conservar historial | RESTRICT y eliminado_en; política de borrado de cuenta aún pendiente |
| Prueba de borrado restringido | Primer pase histórico detectó excepción adicional | Test captura foreign_key_violation o restrict_violation; pase histórico final documentado correcto; no repetido ahora |

La comparación entre `7d0e3f2` y HEAD confirmó que ambas migraciones A, su prueba y
el diseño original están intactos. Las decisiones documentales posteriores no
equivalen a alteraciones ya aplicadas al esquema.

## 4. Etapa B/A: Auth y creación automática de perfiles

Evidencia: [migración del trigger](../supabase/migrations/20261114000100_trigger_perfil_minimo.sql).

`crear_perfil_minimo_tras_registro` es un trigger AFTER INSERT por cada fila de
`auth.users`. Invoca `public.crear_perfil_minimo_auth()`, que inserta exclusivamente
`NEW.id` en `public.perfiles` y retorna NEW. No genera un UUID independiente.
La PK/FK de perfiles exige identidad Auth existente e impide dos perfiles para
el mismo UUID. No garantiza una sola cuenta por persona física o estudiante.

Nombre y campus quedan NULL; vendedor_activado FALSE, versión 1 y fechas servidor
por defaults. No se lee `raw_user_meta_data`: un cliente que envíe vendedor TRUE,
nombre o campus en esos metadatos no cambia el perfil creado. Completar perfil
sigue siendo responsabilidad de un servicio separado, todavía pendiente.

Función SECURITY DEFINER, search_path vacío y referencia calificada public.perfiles.
No usa SQL dinámico ni captura silenciosamente errores. Si falla insertar el perfil,
la sentencia de alta Auth se revierte: no queda una cuenta parcialmente creada.
No hace backfill de usuarios anteriores ni responde a UPDATE de Auth.

La migración revoca ALL sobre la función a PUBLIC en la misma transacción de creación.
No fija OWNER: lo hereda del rol ejecutor. Localmente se observó propietario etapa_b,
superusuario/BYPASSRLS, ACL `{etapa_b=X/etapa_b}` y ausencia de grants PUBLIC. No son
datos del propietario real de Supabase, que sigue sin inventariarse.

El path vacío no elimina búsquedas implícitas de pg_catalog/pg_temp. Para este cuerpo,
la referencia calificada evita suplantar la tabla; se probaron esquemas/tablas hostiles.
La protección depende también de que roles no confiables no controlen objetos del
esquema, defaults, triggers o propiedad. No se extrapola a cualquier función futura.

**Límite importante de vendedor_activado:** está protegido frente a metadatos de
registro y nace FALSE. Todavía no hay GRANTS por columna/RLS que impidan de forma
general una actualización directa desde una API expuesta. Tampoco existe aprobación
manual implementada. El default FALSE no es por sí solo autorización completa.

## 5. Activación de vendedores: propuesta, no implementación

Evidencia: [propuesta de activación](PROPUESTA_ACTIVACION_VENDEDORES_TB4.md),
origen en `827f2e4`, reglas actualizadas en `6fe22b3` y precisiones
documentales de esta ronda todavía sin commit.

El estudiante conserva comprador y solicita capacidad vendedor con la misma cuenta,
independientemente de experiencia. Los enlaces a páginas de venta son opcionales
y complementarios para revisión humana; la falta de experiencia o enlaces no
impide solicitar y ninguno produce aprobación automática. Su representación técnica
requiere acuerdo posterior, sin cambiar ahora el esquema ni los contratos. Revisión humana
obligatoria en 48 horas corridas desde el envío, nunca aprobación automática por
vencimiento y sin correo de aprobación. Coordinación designa revisores y
administradores; no constan personas ni autorizaciones concedidas en la evidencia
de esta ronda. Su designación y procedimiento quedan pendientes de coordinación.
Se propone habilitar/revocar el permiso específico con auditoría administrativa,
sin autoasignación ni cambios de permisos por solicitantes; no se implementa.
Notificaciones consultables desde la campana junto al avatar;
recorrido definitivo: perfil vendedor activo → Publicar artículo → formulario.
Son decisiones documentadas, sin implementación del flujo en esta corrección.

| Entidad propuesta | Contenido y control |
| --- | --- |
| solicitudes_vendedor | Solicitante Auth, experiencia informativa, normas aceptadas/campus al enviar, estado, fecha límite, revisor, motivo, fecha de decisión, versión y clave idempotente |
| revisores_vendedores | Lista administrativa habilitada, identidad Auth/perfil, fechas, autorizador y motivo. Reutilizar mecanismo existente si se demuestra; no duplicar roles |
| notificaciones | Destinatario, solicitud, tipo de resultado, fecha y leida_en. Una por decisión; sin creación libre por cliente |

Transiciones: envío → pendiente; pendiente → aprobado o rechazado por revisor
habilitado diferente del solicitante. Terminales inmutables. Nueva solicitud tras
rechazo sería otro expediente, sujeto a acuerdo. Una pendiente por estudiante y
una aprobada histórica por identidad bajo el alcance sin revocaciones de vendedor propuesto.

RPC conceptuales: enviar_solicitud_vendedor, consultar_mis_solicitudes,
consultar_solicitudes_revision, aprobar_solicitud_vendedor,
rechazar_solicitud_vendedor, consultar_mis_notificaciones y marcar_notificacion_leida.
No existen como funciones en migraciones. Decisión, cambio de perfil y notificación
se proponen en un commit transaccional con bloqueo, versión e idempotencia. Vencer
el plazo deja pendiente y escala atención; no aprueba ni rechaza automáticamente.

Seguridad propuesta: no autoaprobación, estado/revisor/propietario derivados del
servidor, sin DML directo de solicitudes o booleano desde cliente, lectura propia
y cola de revisores autorizados, notificaciones solo internas, publicación con
booleano TRUE y evidencia de aprobación. Nada de esto está implementado aún.

Pendiente coordinación: aceptar nuevas tablas (doce de aplicación, u once si se
reutiliza autorización); concretar personas designadas por coordinación,
procedimientos administrativos y cobertura de las 48 horas corridas definitivas; verificar identidad estudiantil única; campos/evidencias,
privacidad y normas; reintentos/rechazos; proyecciones públicas; responsables UI;
regularización de vendedores previos y borrado con historial. El UUID Auth no
resuelve por sí solo «una cuenta por estudiante». El enlace HTML actual a vendedor
activo requerirá integración posterior por su responsable, sin modificarlo aquí.

## 6. Seguridad: implementado frente a pendiente

| Componente | Estado comprobado en archivos |
| --- | --- |
| RLS de tablas de aplicación | No habilitado en migraciones; ninguna CREATE POLICY |
| RLS en test de seguridad | Habilitado/FORCE temporalmente, sin políticas; revertido con ROLLBACK |
| GRANTS de aplicación a anon/authenticated | Ninguno explícito en migraciones; privilegios por defecto del entorno real desconocidos |
| Función de trigger | REVOKE ALL FROM PUBLIC implementado; no es una RPC de negocio |
| GRANTS en tests | Solo roles sintéticos, USAGE/CREATE/INSERT para escenarios; todos revertidos |
| RPC reservas/activación/perfiles | Ninguna implementada |
| Storage | Sin bucket creado/configurado ni políticas sobre storage.objects |
| Transiciones/autoría/versionado protegido | Pendientes; CHECK/defaults no cubren esos permisos |
| Realtime | Sin configuración/publicación nueva de este trabajo |
| Servicios negocio frontend | Sin servicios nuevos de artículos/perfiles/solicitudes/reservas/notificaciones |

No se afirma que el servicio remoto carezca de políticas: no se inspeccionó. Se afirma
que este trabajo no las aporta. Las migraciones actuales no están preparadas para
exposición segura por Data REST sin completar autorización.

## 7. Pruebas: ejecución y límites

Los pases y observaciones de ejecución siguientes son antecedentes del reporte
previo y del README, no resultados obtenidos durante esta corrección documental.

| Prueba | Preparada | Ejecutada realmente antes de este reporte | Resultado y alcance |
| --- | --- | --- | --- |
| estructura_etapa_a.sql | Sí, versionada | Sí; PostgreSQL 18 desechable, instancia A y repetición previa a B/A | Pasó: nueve tablas, defaults, BIGINT 3000000000, unicidad, FK, precios inválidos, ruta ajena, contexto de reserva, puntos incompletos y reserva activa única |
| perfil_minimo_etapa_b.sql | Sí, versionada | Sí; PostgreSQL 18 en 127.0.0.1:55440, Auth simulado | Pasó: perfil mínimo, metadatos ignorados, UPDATE no sobrescribe, atomicidad por CHECK fallido y rol Auth sin INSERT directo/EXECUTE |
| seguridad_trigger_perfil.sql | Sí, versionada | Sí, mismo entorno desechable | Pase final correcto: catálogo/ACL, path hostil, propietario sin BYPASSRLS con RLS normal, denegación FORCE con rollback, definidor BYPASSRLS con FORCE |
| RLS entre usuarios reales anon/authenticated | No suite integral implementada | No | Solo escenarios sintéticos del trigger; no aislamiento real completo |
| Reservas concurrentes en sesiones distintas | No | No | Índice parcial probado secuencialmente; no RPC ni prueba de carrera |
| Storage real y formatos/2 MiB | No | No | CHECK de ruta no acredita Storage ni bytes reales |
| Activación/revisores/notificaciones | Solo plan conceptual | No | Sin tablas/RPC ejecutables |
| Supabase GoTrue/signUp/correo/REST/Realtime | No validación de este trabajo | No | Auth simulado no reproduce servicios y configuración reales |

Las pruebas usan psql `-X -v ON_ERROR_STOP=1`, datos sintéticos y BEGIN/ROLLBACK.
En A se simuló auth.users con id; B añade raw_user_meta_data para probar inyección.
Los clústeres locales se detuvieron. No contienen datos reales de Supabase.

En la preparación del test de seguridad un primer intento de cambiar BYPASSRLS
al mismo rol dentro de la ejecución falló; se corrigió el escenario usando otro
definidor creado con BYPASSRLS y el pase final terminó sin errores. No se modificó
el trigger para eludir RLS. Este ajuste del test no demuestra un problema remoto.

La prueba A original debe correr antes del trigger: inserta perfiles manualmente
después de auth.users y después del trigger duplicaría esas PK. Tampoco sirve sin
adaptación cuando cambie el rango del precio o el número de tablas. Conservarla como
prueba histórica de Etapa A y preparar una suite integral posterior es un pendiente.

La auditoría actual no ejecutó las suites Auth/IA/catálogo de otros integrantes ni
les atribuye resultados. No existen pruebas de backend real acreditadas por estos SQL.

## 8. Estado Git, PR y divergencia

| Elemento | Evidencia al corte documental del 15/11/2026 |
| --- | --- |
| Rama | integracion/bernabe |
| HEAD previo a esta ronda | 5d9f15034a35b927274525f9d2386862ba5d1008 |
| origin/integracion/bernabe local | Mismo SHA; rama sincronizada con esa referencia, sin fetch ahora |
| Árbol inicial | Limpio |
| develop local | 4a584d8; no confundir con origin/develop |
| origin/develop local | 6b87e2d083dc49faa63d913e6b336863de220c3c |
| origin/develop...origin/integracion/bernabe | 13 exclusivos de develop; 9 exclusivos de integración |
| Ancestro común | 4a584d8231c5798d7706c3bd2f9d65bc89a6c968 |
| Cambios actuales sin commit | Únicamente los tres documentos de esta ronda |
| PR #36 | Abierto, sin fusionar, pendiente de aprobación, según confirmación del responsable |
| Revisión remota anterior informada | 9 commits y 10 archivos; inventario corroborado con Git local |
| Revisiones individuales y checks GitHub | No consultados ahora; no se acreditan resultados ni aprobaciones nuevas |
| Aprobación de esquema/contratos e implementación/despliegue | No acreditada por esta revisión técnica; pendiente de coordinación |

Los estados de versiones previas (HEAD `9117238` o `6fe22b3`, referencias
alineadas o un commit adelantadas, divergencia 4/7 o 4/8 y consultas web fallidas)
son cortes históricos, no el estado actual. El PR se identifica en
[GitHub](https://github.com/angelcardenas-dev/campusloop-v2/pull/36), pero esta ronda
no realiza una nueva verificación remota de su interfaz o API.

### Commits exclusivos de develop

- `b69c43a`: feat: implementar validaciones y ajustes de UI en publicar (Sprint 2)
- `53a5ae6`: test(auth): add offline PKCE return coverage
- `4e8695e`: Merge pull request #37 from angelcardenas-dev/feature/angel/pruebas-pkce-offline
- `e5c1c83`: feat(ia): preparar verificacion de identidad servidor
- `b578621`: Merge pull request #38 from angelcardenas-dev/feature/angel/ia-auth-servidor
- `b94b26e`: chore(netlify): preparar publicación estática controlada TB4
- `76a4d38`: Merge pull request #39 from angelcardenas-dev/chore/angel/netlify-preparacion
- `c2d3807`: fix: corregir estados y propuesta IA de Publicar
- `e009d57`: Merge pull request #34 from angelcardenas-dev/feature/matias/publicaciones
- `695a2af`: Merge remote-tracking branch 'origin/develop' into integracion/matias
- `b6d1c3b`: chore(netlify): incluir modulo de publicaciones en build
- `47d2e54`: fix(publicar): corregir validacion y accesibilidad de sugerencias
- `6b87e2d`: Merge pull request #40 from angelcardenas-dev/integracion/matias

Los nueve exclusivos de integración están enumerados en la sección 2.
El resultado `13 9` se reprodujo ahora con
`git rev-list --left-right --count origin/develop...origin/integracion/bernabe`.

### Archivos cambiados desde el ancestro común

En integración: los diez archivos añadidos de la sección 2, obtenidos con
`git diff --name-status 4a584d8 HEAD`. En develop, doce rutas:

- `.gitignore` (M).
- `css/styles.css` (M).
- `js/publicaciones.js` (A).
- `netlify.toml` (A).
- `netlify/lib/auth-usuario.mjs` (A).
- `publicar.html` (M).
- `scripts/preparar-netlify.mjs` (A).
- `tests/auth/README.md` (M).
- `tests/auth/pkce.test.mjs` (A).
- `tests/auth/retorno-pkce.mjs` (A).
- `tests/ia/README.md` (M).
- `tests/ia/auth-servidor.test.mjs` (A).

No hay intersección entre los conjuntos de rutas cambiadas por cada rama desde
el ancestro común. El diff directo entre puntas mezcla aportes de ambos lados y
no equivale al aporte del PR. No se ejecutó merge ni simulación de integración:
la ausencia de rutas compartidas no demuestra mergeabilidad ni compatibilidad funcional.

### Riesgos y dependencias para revisión conjunta

- Documentación: develop modifica README de Auth/IA; integración añade documentación
  de BD y vendedores. No hay edición concurrente de la misma ruta, pero deben
  reconciliarse las afirmaciones sobre preparación y alcance antes de aprobar.
- Publicaciones: `origin/develop:js/publicaciones.js` simula envío con temporizador
  y termina en `integracion_pendiente`; no persiste artículos. Debe conectarse
  posteriormente al servicio autorizado, con perfil vendedor efectivo, contratos
  de precio/imagen, catálogos y controles servidor. El trigger no habilita ventas.
- Auth/IA: `netlify/lib/auth-usuario.mjs` valida identidad mediante
  `auth.getUser(token)`, no consulta perfiles ni verifica vendedor. Identidad
  válida y perfil mínimo no sustituyen autorización para publicar o usar IA
  restringida a vendedores. El trigger puede hacer fallar el alta si no inserta
  el perfil; su propietario y permisos reales y los usuarios anteriores siguen pendientes.
- Netlify: `scripts/preparar-netlify.mjs` usa una lista estática de páginas/recursos
  que incluye publicaciones; `netlify.toml` configura build y directorio de
  funciones. Esto no despliega migraciones, crea Storage ni conecta por sí solo
  Auth/IA o artículos. No se ejecutó build ni despliegue en esta ronda.
- Seguridad y DTO: RLS, GRANTS de aplicación, RPC de negocio, notificaciones y
  Storage siguen pendientes. El DTO de imagen es propuesta técnica a ratificar
  por coordinación y validar con frontend; no se cambia el contrato para resolver
  estas dependencias silenciosamente.

### Propuesta de resolución preservando historial

Después de la revisión y autorización de coordinación, volver a comprobar
referencias, cabecera del PR, revisiones, checks y posibles conflictos sobre las
puntas vigentes. Proponer un merge normal del PR #36 hacia develop, conservando
sus commits; no squash, rebase ni reescritura. Si aparecen conflictos, revisar su
resolución con los responsables de cada módulo y validar la combinación en un
entorno aislado autorizado antes de fusionar. No traer cambios de otros
integrantes a esta rama dentro de la corrección documental. Un merge Git no
autoriza ejecutar migraciones o desplegar.

Esta ronda solo analiza y documenta: no integra, no fusiona el PR, no crea commits
ni hace push. El nuevo SHA documental se informará después de autorización.

## 9. Pendientes priorizados y criterio de preparación para Supabase

| Prioridad | Trabajo pendiente | Evidencia necesaria para cerrarlo |
| --- | --- | --- |
| P0: acuerdos | Aprobar esquema/contratos del flujo vendedor; concretar designados y cobertura del plazo definitivo; resolver identidad única, visibilidad y actores de reservas/puntos | Decisiones explícitas y revisión con consumidores |
| P0: coherencia | Migración aditiva del rango INTEGER y 2 MiB; ratificar DTO por coordinación y validarlo con Angel/Matías | Acuerdo explícito; después SQL autorizado y pruebas de límites, sin reescribir A |
| P0: autorización | RLS/GRANTS mínimos para las nueve tablas y las nuevas que se aprueben; bloqueo de campos privados/identidad/booleano | Negativos con anon, titular, tercero y revisores; trigger sigue funcionando |
| P1: flujo vendedor | Implementar únicamente el modelo aprobado y decisión/notificación atómica | Concurrencia, idempotencia, baja de revisor, no autoaprobación y publicación denegada antes de aprobar |
| P1: transacciones | RPC crear/cancelar reserva, bloqueos en orden uniforme y estados sincronizados | Dos sesiones compiten: una activa; cancelación consistente y terceros denegados |
| P1: integridad servidor | Fechas/versiones protegidas, autoría Auth, participantes inmutables y catálogos activos | Pruebas directas fuera de UI y control de versión |
| P1: Storage | Bucket articulos, propietario/ruta/MIME/límite real 2 MiB, permisos de lectura acordados | Subidas propias válidas; rechazo ajeno, excesivo y formato inválido, sin service_role frontend |
| P1: suite integral | Pruebas posteriores a todas las migraciones; separar históricas de A | Ejecución reproducible en base desechable sin inserciones duplicadas de perfil |
| P2: datos/servicios | Semillas aprobadas, servicios/DTO, UI por responsables y notificaciones persistentes | Integración con cliente único y datos compartidos auténticos |
| P2: preparación remota | Inventariar esquema, usuarios previos, OWNER/ACL/membresías/default privileges y Storage tras autorización | Plan revisado que respete objetos existentes y evite despliegue parcial inseguro |
| P2: validación real | Prueba autorizada GoTrue/REST/Storage/Realtime, dos usuarios y tercero | Evidencia separada de los tests simulados, sin secretos |
| P2: integración Git | Actualizar reporte después del último commit autorizado; revisar PR/referencias; integración fuera del alcance actual | Diff final revisado, checks y aprobación remota comprobados |

La base queda preparada para validación real cuando modelo/contratos estén ratificados,
las migraciones aditivas completas pasen la suite local, no haya tablas expuestas
sin autorización y exista inventario/plan de aplicación autorizado. Ese punto aún
no se alcanzó. Este reporte conserva todos los archivos anteriores y no crea SQL,
migraciones, políticas, commits ni push.
