# SPEC_TB4.md — CampusLoop V2 | Sprint 2 y entrega final TB4

> **Estado de esta edición:** VERSIÓN 1.1 PROPUESTA — cierre documental de agente global, reputación y organización de páginas, pendiente de revisión técnica.\
> **Fecha de propuesta:** 21/11/2026 (Perú). **Antecedente aprobado:** versión 1.0, 12/11/2026, por Angel David Cardenas Cabrera.\
> **Curso:** 1ACC0237 — IHC y Programación Web, ciclo 2026-20, UPC.\
> **Proyecto:** CampusLoop V2 · Startup ReCampus · Grupo 2.\
> **Repositorio:** https://github.com/angelcardenas-dev/campusloop-v2\
> **Fuente visual definitiva:** [CampusLoop en Figma](https://www.figma.com/design/b14UnSTg43slwvD1fV0XCG/CampusLoop) (`b14UnSTg43slwvD1fV0XCG`).\
> **Alcance temporal:** semanas 12, 13, 14 y 15; Sprint 2, entrega TB4, sustentación y preparación de DD1.\
> **Antecedente:** `SPEC.md` documenta la implementación HTML/CSS de TB3, ya entregada como release `v0.1.0`.
>
> **Regla de inicio:** Este documento establece el alcance completo previsto para TB4, **pero no autoriza por sí solo a Codex a mover archivos, editar código, cambiar ramas ni realizar operaciones Git**. Cada fase requiere tarea asignada y autorización expresa del responsable. Los ítems **[PROPUESTA]** necesitan aprobación; no presentarlos como requisitos textuales del profesor.

## 1. Fuentes, clasificación y estado del contrato

**Antecedente: VERSIÓN 1.0 — CONTRATO TÉCNICO APROBADO PARA SPRINT 2, 12/11/2026 (Perú).** Angel David Cardenas Cabrera aprobó definitivamente la arquitectura C simplificada, el alcance técnico y las reglas de la revisión 0.5. Esa aprobación se conserva; no se reabre la elección A/B/C ni se certifican servicios por documentarlos.

**21/11/2026 — [DOCENTE ORAL / ACUERDO ORAL], comunicado por coordinación:** sustituir la IA exclusiva de Publicar por un agente flotante global en todas las páginas y vistas finales incluidas en el inventario de rutas aprobado, con texto, voz→texto del navegador, contexto conversacional no sensible en localStorage y herramientas autorizadas de catálogo, cuenta/reservas/intercambios propios y preparación de publicaciones. La escritura requiere confirmación humana y controles del servidor. Se solicita explicar el HTML/DOM y demostrar el flujo de voz; TTS es adicional, sin puntaje numérico ratificado aquí. Conservar constancia formal del acuerdo cuando esté disponible; no atribuirlo a los PDFs.

**Precisión final de coordinación para 1.1:** se confirma el agente global y el modelo de reputación con comentarios/estrellas sin pagos dentro del sitio. Una nueva indicación **[DOCENTE ORAL / ACUERDO ORAL]** establece `pages/` por funcionalidad y consolidación progresiva de estados: **sustituye el acuerdo de conservar permanentemente 14 HTML en raíz**. La dirección arquitectónica está confirmada; el mapa archivo por archivo, las fusiones, los contratos operativos de reputación/intercambios y la ejecución siguen pendientes. `index.html` puede conservarse en raíz como entrada Landing/hosting, previa revisión Netlify. Esta tarea sigue siendo solo documental.

**Esta revisión 1.1 es propuesta para aprobación técnica.** Desarrolla ese cambio en [CONTRATO_AGENTE_GLOBAL_TB4](docs/CONTRATO_AGENTE_GLOBAL_TB4.md), sin declarar el agente implementado, habilitado ni desplegado. Las interfaces y tareas actuales de Bernabé, Matías y Maricielo continúan; los puentes futuros requieren coordinación, revisión de consumidores y autorización específica.

| Clasificación | Qué significa en este contrato |
| --- | --- |
| **[DOCENTE ESCRITO]** | Requisito comprobado en enunciado/rúbrica/materiales citados, distinto de la elección técnica del equipo |
| **[ACUERDO DE COORDINACIÓN]** | Decisión de producto/organización comunicada por Angel; la distribución definitiva y SP se acuerdan en Planning |
| **[CONTRATO TÉCNICO APROBADO]** | Versión 1.0: arquitectura C simplificada, alcance, contratos mínimos y reglas aprobados; no confundir aprobación con implementación o validación |
| **[EXCEPCIÓN DOCENTE ORAL]** | Autorización comunicada por el usuario sin constancia escrita inspeccionada; conservar evidencia formal si existe |
| **[DOCENTE ORAL / ACUERDO ORAL]** | Ampliación del agente comunicada el 21/11/2026; fuente oral diferenciada del enunciado escrito |
| **[PROPUESTA] / [PENDIENTE]** | Diseño o dependencia aún por ratificar/implementar/probar; ni el nombre de una herramienta ni un ejemplo de límites acredita aprobación o funcionamiento |
| **[PROPUESTA DE MIGRACIÓN]** | Destinos, consolidaciones y compatibilidad de rutas por revisar con sus propietarios; no es el árbol actual ni autorización para mover HTML |
| **[DETALLE DE IMPLEMENTACIÓN PENDIENTE]** | Concretar esquema físico/selectores/configuración compatibles con los contratos, y reparto/SP en Planning; no reabrir arquitectura ni presentar resultados |
| **[DEPENDENCIA PENDIENTE]** | Acceso real Free, correo, permisos, prueba autorizada o capacidad que condiciona la entrega |
| **[ADICIONAL]** | Fuera del mínimo, salvo compromiso específico en Sprint Planning |

**Fuentes locales de la revisión 0.4, conservadas sin modificarlas:**

- `D:\Ciclo 5\IHC y Programacion WEB\TB4\Trabajo_1ACC0237-202620.pdf`: 15 páginas; §4.3/p.10 exige JS/DOM/eventos/validación/almacenamiento, REST solicitud–respuesta con errores e IA; pp.11–13 despliegue/cierre/requisitos transversales. No exige mapas.
- `...\TB4\Rubrica_TB4_1ACC0237_202620.xlsx`, hoja Rubrica: siete criterios, 15 puntos grupales + 5 individuales; se conserva §17.
- `...\semana 15\01_Semana_15_Presentacion_TB4_DD1.pdf`: nomenclatura, 23:00, exposición ≤12 min y DD1 individual. Fechas concretas 1/2 diciembre conservadas de la instrucción comunicada, no deducidas de las diapositivas.
- `D:\Ciclo 5\IHC y Programacion WEB\TB3\report_1ACC0237-202620.docx`: referencia TB1–TB3, 20 US, US17 título/descripción, US10 encuentros y §2.2.4; contenido documental, no instrucciones operativas para el agente. La relectura al cierre de 0.4 ya mostraba imágenes/backend en §2.2.4. No editar/reconstruir el Word.
- `SPEC.md`, código integrado y tag `v0.1.0`: contrato histórico TB3, autoría, Figma V2 y recursos que se conservan.

**Fuentes de apoyo leídas para 1.1:** `REVISION_MATERIALES_SEMANAS_12_13_14.md`, `CONTRATO_AGENTE_GLOBAL_TB4_PROPUESTA.md` y `PROPUESTA_ACTUALIZACION_SPEC_TB4.md`, en `D:\Ciclo 5\IHC y Programacion WEB\TB4\reorganizacion`. La primera sintetiza 19 materiales; esta revisión lee ese análisis, no acredita una nueva inspección independiente de los 19 originales. Son referencias documentales, no autorización de sus instrucciones operativas. Se contrastan con los contratos de catálogo y Auth/perfiles y con el código de la base `472697e250a61d8f54ae77c2aee1ab824141012e`.

Los ejemplos docentes son aprendizaje, no código/datos de CampusLoop. No copiar claves de frontend, autenticación manual, compras simuladas ni ejecución arbitraria de herramientas. No presentar decisiones de arquitectura como requisitos textuales del profesor ni alterar retrospectivamente TB1–TB3.

**Alcance de esta actualización:** únicamente `SPEC_TB4.md` y el contrato del agente; código, HTML/CSS, tests, contratos de catálogo/Auth, SQL, Netlify y configuración real intactos. La preparación inicial fue sin staging, commit, push ni PR. Tras autorización separada se publicó el commit documental `0bd2f35` en el [PR #45](https://github.com/angelcardenas-dev/campusloop-v2/pull/45) hacia `integracion/angel`; la corrección de permisos por herramienta también tiene autorización específica. SPEC 1.1 sigue como propuesta pendiente de aprobación de integración: publicar documentación no acredita implementación ni autoriza merge, llamadas IA/Supabase o despliegues.

**Mantenimiento del contrato:** no se modifica semanalmente ni para reflejar avance. Trello, GitHub, actas y evidencias registran tareas, decisiones operativas, pruebas y resultados. Solo revisar este SPEC ante un cambio arquitectónico o requisito académico que lo justifique, con motivo y aprobación; 1.0 no queda provisional por existir configuración/pruebas pendientes.

**Presupuesto firme:** S/ 0. No contratar, activar facturación/recargas o aceptar pruebas que se conviertan en pagos. Incluso pruebas gratuitas, creación de proyectos/keys y publicación requieren autorización separada.

## 2. Requisitos, alcance seleccionado y exclusiones

### 2.1. Obligatorio del curso

- JS vanilla en Landing/Web App: DOM, eventos, validaciones y almacenamiento local propio comprobable.
- Una API REST externa: solicitud HTTP, respuesta JSON y manejo de errores, diferenciada de IA. Una imagen cargada por URL CDN o un SDK sin explicar su solicitud no acredita por sí solo esta evidencia.
- IA generativa real aplicada al producto; Landing y Web App públicas en Netlify/Vercel.
- Sprint 2 con Planning/Backlog/Trello público real, 3–5 commits representativos explicados, colaboración auténtica de los cuatro integrantes.
- Diez heurísticas Nielsen sobre ambos productos, correcciones antes/después; informe, exposición y entrega exacta de §§14–17.
- HTML semántico, responsive, ARIA, teclado y Términos de Servicio accesibles desde footers (enunciado p.12). Propuesta mínima futura: sección pública de términos/privacidad enlazada desde ambos productos, con destino real y contenido comprensible; no un # vacío ni afirmar que un enlace equivale a cumplimiento legal íntegro.

### 2.2. Acuerdos y excepción oral

- **[DOCENTE ORAL / ACUERDO ORAL] Organización HTML:** la aplicación adoptará una estructura organizada en `pages/`, con subdirectorios por funcionalidad. Las pantallas que representen estados de un mismo recorrido se consolidarán progresivamente mediante JavaScript, preservando accesibilidad, comportamiento y diseño aprobado. La migración de archivos y rutas requiere una tarea de implementación independiente y autorización específica. `index.html` puede permanecer en raíz si lo requiere la entrada Landing/hosting; mantener Landing y Web App diferenciadas. El árbol y las 14 filas actuales se revisan en §5.1–5.4. Conservar Inter, fotos/SVG y diseño aprobado; las fotos nuevas van a Storage. No mover HTML ni cambiar Figma en esta revisión documental.
- **[DOCENTE ORAL / ACUERDO ORAL, 21/11/2026]** Agente global inferior derecho **en todas las páginas y vistas finales incluidas en el inventario de rutas aprobado**; incluye la Landing mientras se mantenga el alcance global acordado. La cifra de 14 corresponde al inventario actual, no al número físico final obligatorio. Texto/voz→texto, memoria local no sensible y herramientas autorizadas (§9). US17 conserva **título y descripción** editables, aceptar/descartar/restaurar sin inventar características; deja de exigir una UI exclusiva en Publicar. Angel mantiene el agente; Matías conserva Publicar/CRUD/foto y un futuro puente acordado. Retirar el bloque antiguo requiere otra tarea; no se borra aquí. Publicación únicamente con confirmación humana y permisos efectivos. TTS es adicional.
- **[ACUERDO DE COORDINACIÓN] Modelo sin pasarela y con reputación:** CampusLoop no cobra ni procesa pagos/transferencias. Los estudiantes acuerdan pago y entrega física fuera del sitio; dentro coordinan publicaciones, reservas, conversaciones, encuentros y confirmaciones autorizadas de intercambios. Comentarios y estrellas entre compradores y vendedores son parte del dominio; su elegibilidad y persistencia siguen pendientes de contrato operativo (§2.5/§6.6), no son genéricamente un extra.
- Retirar Nominatim, Geoapify, Leaflet, OSM, servicios de teselas/geocodificación y módulos de mapas. US10 usa campus/lugares públicos predefinidos y lugar adicional válido, sin GPS.
- **Idioma:** el enunciado escrito pide en_US y es_419. El usuario comunica acuerdo verbal con el profesor para presentar solo español por el público de Lima. Registrar como excepción oral pendiente de evidencia formal; **no** implementar selector/traducciones sin nueva indicación. `lang="es"`, textos y errores en español comprensible. No afirmar que el PDF fue modificado.
- El usuario comunica que base de datos no suma ni resta puntos: observación docente oral, no obligación ni exención de JS/localStorage/API/IA. Supabase es la infraestructura seleccionada por coordinación para funcionalidad real, aún por configurar y validar.

### 2.3. Mínimo seleccionado para detallar en Sprint Planning

Registro/login propios de Supabase, sesión SDK, catálogo/vendedores compartidos con semillas, CRUD de publicaciones, filtros, Detalle/Perfil correctos, reservas consistentes y mensajes comprador↔vendedor desde dos computadoras. Una foto por artículo con Supabase Storage; GET del catálogo en Explorar mediante Supabase Data REST API; localStorage para borradores/preferencias/filtros y contexto permitido del agente. Mínimo oral del agente confirmado por coordinación: widget global, texto/voz→texto, búsqueda/recomendaciones sustentadas en artículos reales, consultas propias autorizadas y publicación asistida confirmada, incluida US17; despliegue público. `pages/` y consolidación de estados requieren la tarea transversal y decisiones de §5. Reputación/intercambios forman el alcance deseado de negocio que debe concretarse para TB4 según §2.5: no se confunde una dependencia pendiente con una funcionalidad adicional. Cada compromiso necesita criterios y pruebas; ninguno está implementado por documentarlo. Un servicio ausente se informa como pendiente, no se sustituye por datos ficticios ni se da el criterio por cumplido.

US10 conserva nombre/campus/lugar público y validación: no hacen falta coordenadas. Selección/aceptación se guarda en la reserva compartida de PostgreSQL, no por un cambio de identidad local.

### 2.4. Adicionales y fuera de alcance

**Adicionales:** US18 categoría automática, personalización avanzada de US19 (más allá de sugerir artículos realmente consultados por el agente), TTS/respuesta hablada, niveles avanzados/insignias/gamificación, adjuntos de mensajes, leído/escribiendo, presencia, moderación avanzada, galerías amplias y fotos nuevas de perfil si la capacidad lo permite. **Comentarios y calificaciones de estrellas no se clasifican aquí como adicionales**; su contrato operativo está pendiente. No renumerar las 20 US ni declarar US19 completa por una recomendación básica. Reducir a una foto por artículo primero; avatar nuevo puede posponerse si falta capacidad.

**Excluidos:** IA suplantando compradores/vendedores, chat por cambio de identidad, contraseñas manuales en texto plano, mapas/tracking, pasarela/cobros/pagos o transferencias procesados dentro de CampusLoop (reales o simulados), planes Premium US20, autenticación/JWT caseros y sincronización de negocio mediante localStorage. El acuerdo externo de pago/entrega no genera comprobantes financieros ni una compra verificada dentro del sistema. La arquitectura local deja de ser una opción pendiente; no sustituir el objetivo remoto por una simulación. No añadir otra API REST salvo nueva indicación expresa del profesor.

**Terminado:** funcionalidad autorizada implementada, probada local/públicamente y revisada; datos en su fuente correcta; criterios y fallos reales documentados, RLS y secretos verificados; integración Git/deploy solo autorizada. No declarar completa US06 por validar formato de correo ni las 20 US por mostrar pantallas.

### 2.5. Modelo de negocio, alcance deseado y compromiso verificable TB4

- **Modelo confirmado por coordinación:** intermediación y coordinación entre estudiantes, sin pasarela, cobros ni confirmación de transferencias. Pago/entrega física se acuerdan y realizan fuera del sitio. La reputación mutua mediante comentarios y estrellas corresponde a experiencias válidas de compradores y vendedores, no solo al vendedor.
- **Alcance deseado:** registrar estados y confirmaciones autorizadas de intercambios y habilitar reputación asociada a ellos. Una conversación, reserva creada/confirmada, entrega agendada, URL de éxito o artículo marcado vendido **no prueba por sí solo un intercambio completado ni un pago**. La regla de cierre y quién confirma deben acordarse con Bernabé y los consumidores antes de habilitar calificaciones. No inventar experiencias, ventas, comentarios, medias ni contadores.
- **Compromiso ejecutable para TB4:** conservar los recorridos/criterios existentes e incorporar el agente y la migración por tareas aprobadas. Concretar con coordinación/Bernabé el contrato operativo de intercambios/reputación, criterios y responsables UI antes de comprometer su implementación. La dependencia se registra como pendiente, no como reputación opcional ni función terminada. No asignar nuevos IDs US, Story Points o fechas cumplidas; la preparación documental no autoriza habilitar reseñas.

Reglas mínimas y límites en §6.6. Los niveles avanzados, insignias y gamificación siguen adicionales; su aplazamiento no elimina comentarios/estrellas del modelo.

## 3. Hoja de ruta completa por semana

| Etapa | Contenido docente | Aplicación prevista en CampusLoop | Evidencia mínima |
| --- | --- | --- | --- |
| **Semana 12** | JavaScript vanilla; DOM, eventos, formularios, JSON y `localStorage` | JS compartido; borradores/preferencias propias; acceso mediante SDK oficial Supabase seleccionado; validaciones; búsqueda/filtros; formularios de artículos/reservas consumiendo servicios compartidos | Capturas de interacción, validación, datos en DevTools y cambios que sobreviven a recargar |
| **Semana 13** | APIs REST, `fetch`, Promesas, `async/await`, `try/catch`, `response.ok`; planificación de IA | GET del catálogo desde Explorar vía Supabase Data REST API con fetch, JSON y errores; POST Storage complementario; contrato del asistente | Caso de éxito/error en DOM, respuesta JSON y código revisado |
| **Semana 14** | Integración real de IA vía API y despliegue Netlify/Vercel; consolidación | Asistente LLM funcional, manejo de errores, credenciales protegidas; Landing y Web App públicas; pruebas responsive, consola y rutas | URLs accesibles, demostración de la IA, registro de despliegue y pruebas |
| **Semana 15** | Sustentación TB4, evaluación heurística, DD1 y cierre | Completar informe, Nielsen, evidencias Scrum/GitHub, presentación, declaración IA, ZIP y demostración | Paquete de entrega, evaluación individual, capturas antes/después, exposición de máximo 12 min |

La base de datos es infraestructura seleccionada por coordinación; el caso REST requiere HTTP, no una conexión directa a PostgreSQL, y no sustituye evidencias de JS/localStorage/IA. Esta tabla es la **hoja de ruta docente**: al llegar a cada semana no es necesario rehacer `SPEC_TB4.md`; se actualiza el avance en Trello y GitHub. Si el docente publica una instrucción nueva que lo contradiga, se registra la decisión antes de actuar.

**Aplicación adicional de fuente oral, no contenido nuevo atribuido a los PDFs:** S12 incorpora DOM/eventos del widget e historial local permitido; S13 conserva GET REST separado y prepara herramientas con JSON validado; S14 integra texto/voz→texto→función→herramienta→resultado y despliegue, TTS opcional; S15 muestra HTML/DOM, memoria en DevTools, flujo de voz, correcciones y autoría reales. El análisis de materiales es planificación, no evidencia de ejecución.

## 4. Arquitectura C simplificada — aprobada en versión 1.0

**Arquitectura C aprobada definitivamente por Angel el 12/11/2026.** No reevaluar A/B/C. Esta propuesta modifica la orquestación y superficie de IA, sin reemplazar Supabase/Netlify ni sus reglas. La tabla siguiente conserva el corte de planificación de 1.0; no representa verificaciones remotas nuevas del 21/11.

| Componente seleccionado | Responsabilidad | Estado real |
| --- | --- | --- |
| Supabase Auth | Registro, login, sesión y renovación con SDK oficial | Configuración/correo/pruebas pendientes |
| Supabase PostgreSQL | Datos compartidos, relaciones, transacciones y restricciones | Esquema/migraciones/RLS/semillas por revisar y ejecutar con autorización |
| Supabase Realtime | Actualizaciones de mensajes entre cuentas/equipos independientes | Publicación/canales/permisos y reconexión por probar |
| Supabase Storage | Único proveedor de fotos de artículos; perfiles si hay capacidad | Bucket/políticas/validación/Free por comprobar |
| Supabase Data REST API (PostgREST) | **Caso REST principal: GET del catálogo desde Explorar**, con fetch, JSON, errores y DOM | Contrato de §8; endpoint real y pruebas pendientes |
| localStorage | Borradores, filtros y preferencias; memoria conversacional no sensible propuesta en 1.1 | Requisito académico separado de la sesión SDK; extensión por acordar con Maricielo |
| Netlify Free | Landing y Web App, función serverless IA | Acceso/cupo/configuración/URLs y deploy pendientes |
| NVIDIA NIM API | Candidata para agente global y capacidad US17 a través de serverless | Proveedor/modelo/tool-calling no definitivos: gratuidad, permisos y prueba autorizada pendientes |

**Flujos seleccionados:** navegador → HTTPS Auth/Data REST/Storage de Supabase bajo sus permisos; Realtime para notificaciones y PostgreSQL para historial durable. Navegador → función Netlify → IA, sin clave NVIDIA en frontend. No conexión PostgreSQL directa desde JavaScript del navegador: la evidencia REST será la solicitud HTTP al endpoint de PostgREST, no una consola SQL ni una conexión de base de datos.

**Flujo propuesto del agente:** texto/transcripción → widget DOM seguro → cliente centralizado → función Netlify autenticada y limitada → modelo con herramientas de lista permitida → adaptadores de servicios autorizados/RLS/GRANTS → respuesta mínima → `textContent` y TTS opcional. Para escritura: vista previa + confirmación humana separada + revalidación backend + idempotencia. No importar automáticamente módulos de navegador en el servidor ni ejecutar JS/SQL/URLs generados por el modelo.

**Justificación y alternativas descartadas:** la arquitectura local solo por navegador no cubre cuentas/datos/mensajes entre computadoras. Cloudinary duplicaría el servicio de fotos y Open Library añadiría otro caso REST; ambos se descartan. Nominatim, Geoapify, Leaflet/OSM y mapas no corresponden al diseño ni son necesarios para US10. Se conserva esta explicación como antecedente, **no** como opciones por elegir o mecanismos de contingencia. No incorporar otra API REST salvo nueva indicación expresa del profesor.

**Dependencias aún por comprobar:** funcionamiento de Auth/PostgreSQL/Data REST API/RLS/Realtime/Storage, registro/confirmación de correo, accesos/permisos del resto del equipo, cuotas/condiciones de uso efectivas, Netlify Free/despliegue, capacidad/reparto definitivo y NVIDIA gratuita/condiciones IA. El plan Free del proyecto Supabase y el acceso de Angel están confirmados según su comunicación; no se reclasifican como pendientes, pero tampoco prueban servicio funcional ni cuotas suficientes.

**Riesgo de entrega:** núcleo compartido exige más trabajo que TB3 y coordinar Auth/esquema/RLS antes de consumidores. Reducir a una foto por artículo, posponer avatar nuevo y extras; no reducir permisos ni sustituir mensajería real por identidades simuladas. Cronograma y controles en §21, sin inventar estimaciones o SP.

### 4.1. Estado real de Supabase comunicado para la aprobación

Fuente: información confirmada por Angel en esta conversación y registrada el 12/11/2026. El agente no abrió el dashboard ni llamó APIs para comprobarla; no se inventan fecha de creación, ID de proyecto o nivel de rol.

| Nivel | Hecho confirmado / pendiente |
| --- | --- |
| Proyecto creado | Bernabé creó **CampusLoop** en la organización **ReCampus** |
| Plan y región | **Free**; **South America — São Paulo** |
| Salud observada | El dashboard mostró **Healthy**; es el estado observado comunicado, no una prueba funcional de la aplicación ni garantía de salud continua |
| Acceso confirmado | Angel fue agregado como miembro y pudo acceder al proyecto |
| Accesos/permisos restantes | Verificar los demás integrantes y capacidades necesarias por rol; no inferir permisos administrativos a partir de una invitación o del acceso al dashboard |
| Auth | Registro/login/confirmación/renovación/cierre aún no comprobados funcionalmente |
| PostgreSQL y Data REST API | Esquema de aplicación, relaciones/transacciones y GET HTTP/JSON del catálogo aún no comprobados funcionalmente |
| RLS | Políticas y pruebas de acceso permitido/denegado aún no comprobadas funcionalmente |
| Realtime | Envío/recepción/reconexión entre cuentas y computadoras aún no comprobados funcionalmente |
| Storage | Bucket/políticas, subida/lectura/borrado y validaciones aún no comprobados funcionalmente |

Proyecto creado, acceso confirmado y servicios funcionalmente validados son tres estados distintos. No recrear el proyecto ni declarar validada ninguna funcionalidad por mostrar Healthy. Comprobar configuración existente antes de proponer cambios; los resultados irán a Trello/GitHub/actas/evidencias, sin actualizar semanalmente este contrato.

## 5. Organización propuesta: persistencia, servicios y DOM

**Base inspeccionada para 1.1:** `472697e`, 14 HTML en raíz, recursos locales, Auth compartido/retorno configurable, Acceso UI, controladores Inicio/Explorar y adaptadores de catálogo, Publicar demostrativo, preparación Netlify por lista y servicio IA singular deshabilitado. Existen migraciones versionadas, pero su presencia no prueba ejecución remota ni RLS efectiva. No hay widget global ni endpoint del agente implementados. Se conserva CODEOWNERS sin cambios; la matriz expresa fronteras de propiedad, no crea archivos ni permisos.

Los 14 HTML actuales siguen en raíz y `css/styles.css` permanece en su ubicación; no se han movido ni editado en esta revisión. **Organización futura:** `pages/` por funcionalidad, estados consolidados cuando se aprueben y `index.html` en raíz si lo requiere la entrada Landing/hosting (§5.1–5.4). Cambiar la ubicación física no cambia responsabilidades, arquitectura vanilla ni servicios. JavaScript vanilla y módulos ES compartidos; SDK oficial Supabase v2 fijado en el cliente del navegador (2.119.0, distribución esm.sh, licencia MIT), sin framework ni cliente duplicado. La carga y las pruebas existentes no validan el futuro agente ni autorizan descargas en esta tarea.

**Convenciones:** Elementos → Datos → Funciones → Eventos cuando haya DOM; utilidades solo secciones pertinentes. `const` por defecto, `let` para reasignación, sin `var`; nombres descriptivos, funciones reutilizables, `addEventListener`, sin handlers inline. DOM seguro con `textContent/createElement`; no HTML de usuario/IA/REST. No duplicar inicializaciones.

| Archivo existente o futuro propuesto | Principal | Responsabilidad y frontera |
| --- | --- | --- |
| `js/config-publica.js`, `js/supabase-cliente.js` | Angel | URL y publishable key públicas permitidas; una instancia SDK configurada; ningún secreto |
| `js/auth.js` | Angel | Servicio de acceso/sesión oficial SDK y guardas; sin formularios ni JWT manual |
| `js/acceso-ui.js` | Maricielo | Formularios Registro/Login, validación y mensajes de acceso; consume auth, no replica sus llamadas/estado |
| `js/articulos.js`, `js/perfiles.js` | Bernabé | Servicios compartidos por Data REST API/RPC, incluido GET fetch del catálogo; contratos/normalización y lectura segura |
| `js/conversaciones.js`, `js/mensajes.js`, `js/reservas.js` | Bernabé | Servicios de negocio/Realtime/RPC, coordinados con Angel en seguridad |
| `js/mensajeria-ui.js`, `js/reservas-ui.js`, `js/cuenta.js` | Maricielo | DOM y flujo de sus pantallas; no SQL/RLS ni conexión Auth propia |
| `js/publicaciones.js`, `js/vendedor.js`, `js/imagenes.js` | Matías | Formularios/CRUD, activación y cliente Supabase Storage para fotos |
| `js/catalogo.js`, `js/landing.js` | Angel | Inicio/Explorar/filtros/estados DOM; consume articulos.js sin duplicar fetch; Landing |
| `js/ficha.js` | Bernabé | Detalle/Perfil según ID; sin ficha fija para todos |
| `js/localstorage.js` | Maricielo | Encargo vigente: borradores/filtros/preferencias; extensión futura de memoria del agente por contrato y PR coordinado, sin JWT ni copias de negocio |
| `js/asistente.js`, `netlify/functions/asistente.mjs`, `tests/ia/` | Angel | Implementación histórica singular: preservada y apagada; supersedida para la arquitectura futura, no eliminada ni modificada aquí |
| `js/agente-ui.js`, `js/agente-cliente.js` **[PROPUESTA]** | Angel | Widget global DOM/voz, estados y transporte; nombres/interfaces pendientes; sin duplicar servicios |
| `netlify/functions/agente.mjs` y adaptadores servidor **[PROPUESTA]** | Angel; contratos revisados con Bernabé | Orquestación, identidad verificada, registro de herramientas, cuotas y salida segura; sin permisos ficticios |
| `supabase/migrations/`, receta/scripts privados de seed | Bernabé | SQL, RLS, funciones e idempotencia; no ejecutados ni creados aquí |
| `netlify.toml`, build por lista permitida/documentación de entorno | Angel | Publicación segura; no trasladar HTML ni copiar secretos |

No crear `geolocalizacion.js`, `mapa-encuentro.js` ni descargar Leaflet. La antigua siembra `datos-iniciales.js` del navegador se descarta: las semillas serán compartidas y privadas de administración.

**Contratos comunes propuestos:** servicios asíncronos devuelven `{ ok, datos, error }`; códigos diferencian validación, no autorizado, conflicto, no encontrado, red, cuota y servidor. Una UI no anuncia guardado hasta respuesta confirmada. Servicios no tocan DOM. Formulario no elige remitente/propietario confiando en un campo oculto: servidor deriva actor de Auth.

Reutilizar módulos ES y el cliente único ya existente; no mezclar copias/globales de SDK. La sesión se resuelve antes de consultar datos privados. El widget en Landing puede ofrecer guía estática sin cargar SDK/modelo hasta que una acción autenticada autorizada lo necesite. El servidor requiere un cliente oficial sin persistencia propio de su entorno y adaptadores revisados; no comparte la sesión singleton del navegador entre solicitudes.

CSS permanece en `css/styles.css`, con prefijos y propietario histórico por sección; tokens/comunes solo coordinación. Las ediciones del mismo archivo se serializan mediante tareas/PR pequeños, aunque afecten secciones distintas.

### 5.1. Organización de rutas [PROPUESTA DE MIGRACIÓN]

**Fuente de la dirección arquitectónica: [DOCENTE ORAL / ACUERDO ORAL], confirmado por coordinación.** Adoptar `pages/` con subcarpetas funcionales y evaluar estados de un mismo recorrido. **El árbol siguiente es propuesta inicial, no el árbol actual ni autorización para crear carpetas.** No obliga a mover `index.html`; revisar Netlify y mantener Landing y Web App diferenciadas en sus entradas.

```text
/
├── index.html
└── pages/
    ├── auth/
    │   ├── login.html
    │   └── registro.html
    ├── catalogo/
    │   ├── inicio.html
    │   ├── explorar.html
    │   └── detalle.html
    ├── vendedores/
    │   ├── perfil-vendedor.html
    │   └── activar-vendedor.html
    ├── publicaciones/
    │   └── publicar.html
    ├── reservas/
    │   └── reservas.html
    └── cuenta/
        └── cuenta.html
```

Se muestran 11 destinos candidatos si se aprueban las tres consolidaciones; **no es una cantidad final obligatoria**. En particular, Reservas puede necesitar una ruta independiente de consulta si así lo concluyen sus responsables. El callback Auth de producción está pendiente y no se inventa en este árbol. Toda ruta final, alias, parámetro/hash y recurso debe ratificarse antes de retirar su origen; conservar las 14 filas actuales en el inventario aunque varias apunten a un destino candidato común.

### 5.2. Inventario completo de los 14 HTML actuales

Inspección estática de archivos, navegación, controles y referencias en la base `472697e`; no prueba de navegador ni servicio real. Las rutas destino y los estados futuros siguientes son **[PROPUESTA DE MIGRACIÓN]**: estados de interfaz, no nuevos enums SQL aprobados. Cada fila conserva principal por pantalla; Ángel coordina arquitectura/rutas/Netlify, no asume automáticamente todos los HTML.

| Ruta actual | Funcionalidad observada | Responsable | Ruta destino propuesta | Independiente / consolidación | Estados previstos de UI | Dependencias y riesgos | Decisión pendiente de aprobación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/index.html` y `/` | Landing, categorías, explicación y acceso | Ángel | `/index.html` y `/` | Mantener Landing independiente | Portada pública; agente según alcance global aprobado | Hosting raíz, hashes, enlaces a Acceso, términos y afirmaciones/métricas demo | Confirmar entrada Netlify y conservar widget en Landing; no mover por defecto |
| `/login.html` | Inicio de sesión mediante Acceso UI | Maricielo; Auth Ángel | `/pages/auth/login.html` | Mantener independiente de Registro | Inicial/restaurando, validación, enviando, error, autenticado | `acceso-ui.js`, Auth/SDK, destino Inicio y retorno permitido | Aprobar ruta y navegación posterior; no fusionar con Registro |
| `/registro.html` | Registro y selección universidad/campus | Maricielo; Auth Ángel y catálogos Bernabé | `/pages/auth/registro.html` | Mantener independiente de Login | Catálogos pendientes/cargando, validación, enviando, confirmación pendiente/error | UUID reales, perfil mínimo, correo/PKCE, enlaces de términos; no afirmar perfil guardado desde Auth | Aprobar ruta y retorno de correo por separado |
| `/inicio.html` | Inicio de Web App y recomendaciones preparadas offline | Ángel | `/pages/catalogo/inicio.html` | Mantener independiente de Explorar | Pendiente/demo, carga, listo, vacío, error/reintento | `landing.js` comparte controlador de catálogo; identidad/métricas propias requieren servicios, enlaces a detalle | Aprobar entrada de aplicación y enlaces; no confundir con Landing |
| `/explorar.html` | Búsqueda, filtros y tarjetas de catálogo | Ángel; servicio Bernabé | `/pages/catalogo/explorar.html` | Mantener independiente de Inicio | Pendiente/demo, preparado, carga, listo, vacío, error/reintento | `catalogo.js`, catálogos/DTO/GET; generador actual `detalle.html?...`, UUID y orígenes de imagen | Aprobar ruta y resolución de Detalle sin alterar filtros/DTO |
| `/detalle.html` | Ficha de artículo y acceso a vendedor/reserva | Bernabé | `/pages/catalogo/detalle.html` | Mantener independiente del Perfil | Carga, artículo válido/no encontrado/eliminado, error; acciones según permisos | ID real en enlace profundo, artículos/perfiles, reservas/conversación y Storage | Ratificar ruta/parámetro; nunca MacBook por defecto para cualquier ID |
| `/perfil-vendedor.html` | Perfil público, artículos y reputación demostrativa | Bernabé | `/pages/vendedores/perfil-vendedor.html` | Mantener independiente de Detalle | Carga, perfil público válido/vacío/no encontrado/error; reputación solo si hay servicio | ID de vendedor, proyección pública, catálogo propio visible y contrato de reputación pendiente | Ratificar ruta y campos públicos; no convertir estrellas Figma en datos reales |
| `/activar-vendedor.html` | Solicitud y experiencia informativa; hoy enlaza a vista activa | Matías; servicios Bernabé | `/pages/vendedores/activar-vendedor.html` | Candidata a consolidar con `activar-vendedor-activo.html` | No solicitado, solicitud pendiente, aprobado, rechazado; carga/error aparte | Auth, autorización protegida, revisión humana/48 h/notificación interna; enlace actual no prueba aprobación | Aprobar consolidación y contrato de estados/compatibilidad con la URL anterior |
| `/activar-vendedor-activo.html` | Confirmación visual de vendedor activo y CTA Publicar | Matías; servicios Bernabé | `/pages/vendedores/activar-vendedor.html` (estado aprobado) | Candidata; conservar confirmación visual como estado | Aprobado solo tras servicio; sin permiso mostrar estado real o error | Una URL o query no concede `vendedor_activado`; preservar CTA a Publicar | Aprobar alias/transición y retirada futura del HTML solo tras prueba |
| `/publicar.html` | Formulario y panel IA demostrativo histórico | Matías; agente/puente Ángel, servicios Bernabé | `/pages/publicaciones/publicar.html` | Candidata a consolidar con `publicar-exito.html` | Formulario, validación, guardando, error, publicación confirmada | `publicaciones.js`, CRUD/Storage/permiso vendedor, borrador y confirmación humana del agente | Aprobar ruta/puente y reemplazo del panel antiguo; no conectar ni retirarlo aquí |
| `/publicar-exito.html` | Confirmación visual independiente de artículo publicado | Matías | `/pages/publicaciones/publicar.html` (estado confirmado) | Candidata; preservar confirmación visual | Publicación confirmada con ID real; acceso sin respuesta no acredita éxito | Persistencia compartida confirmada, idempotencia y enlaces posteriores | Aprobar consolidación/compatibilidad; prohibido activar éxito por URL sola |
| `/reservas.html` | Listado de interacciones; en desktop también conversación y detalle | Maricielo; servicios Bernabé | `/pages/reservas/reservas.html` | Página principal; consolidación con consulta por evaluar, no decidida | Listado/selección, carga/vacío/error, consulta sin reserva y estados reales de reserva | Conversación puede existir sin reserva; permisos de participantes, Realtime, navegación móvil/desktop y enlaces con ID | Decidir si consulta es estado profundo o recorrido independiente; conservar listado y detalle |
| `/reservas-consulta.html` | Conversación enfocada, retorno al listado y detalle pendiente | Maricielo; servicios Bernabé | `/pages/reservas/reservas.html` (vista de consulta, si se aprueba); ruta independiente por ratificar si se mantiene | Evaluación pendiente; no fusión automática | Consulta/conversación seleccionada, detalle asociado, carga/error; sin inventar reserva | Hoy reproduce la conversación visible en desktop; conservar atrás/historial, identificador de conversación y reserva opcional | Ratificar navegación/IDs y alternativa independiente antes de eliminar esta ruta |
| `/cuenta.html` | Cuenta, capacidades comprador/vendedor, actividad y reputación demo | Maricielo; servicios Bernabé y Auth Ángel | `/pages/cuenta/cuenta.html` | Mantener independiente | Sesión/carga/error, datos propios/vacíos, vendedor según servicio; reputación pendiente | Guarda SDK más RLS, datos privados, enlaces a reservas/intercambios y reputación válida | Ratificar ruta y contrato de datos propios/reputación; no fusionar con Perfil público |

### 5.3. Consolidación por estados — propuesta sin implementación

- **Activación (Matías):** `activar-vendedor.html` y `activar-vendedor-activo.html` son candidatas a una interfaz con no solicitado, pendiente, aprobado y rechazado. Carga/error no equivalen a decisión. Estados de servicio autorizado; mismo perfil comprador/vendedor, sin autoasignación ni aprobación por query, historial local o vencimiento. Preservar el resumen activo y «Publicar artículo» después de lectura protegida, revisión humana y reglas de activación vigentes.
- **Publicar (Matías):** `publicar.html` y `publicar-exito.html` pueden convertirse en formulario → validación → guardando → error o publicación confirmada. Conservar la confirmación visual aprobada como estado con ID real devuelto por el servicio; abrir/recargar una URL no acredita guardado. Aceptar texto del agente no publica. No rehacer CRUD ni paneles en esta tarea; puente, retirada posterior de IA antigua y respuesta tardía/duplicados se coordinan con Ángel/Bernabé.
- **Reservas (Maricielo + Bernabé):** el HTML actual muestra conversación/detalle junto al listado en desktop; una tarjeta abre `reservas-consulta.html` en móvil. Son representaciones relacionadas, pero la consulta es un recorrido navegable que debe conservarse. Evaluar una ruta con vistas/listado/consulta/detalle seleccionadas por identificadores validados e historial; si se necesita página independiente, incorporarla al mapa definitivo. Preservar conversación sin reserva, listado, detalle, estados reales, ambos tamaños y permisos de comprador/vendedor. Ni el CSS responsive ni el hecho de compartir conversación justifican fusionarlas automáticamente. Reserva confirmada no equivale a intercambio completado (§6.6).
- **Independientes:** Login/Registro, Inicio/Explorar, Detalle/Perfil de vendedor y Mi Cuenta conservan recorridos separados. Compartir componentes no autoriza fusionarlos. No convertir la aplicación multipágina en SPA ni perder enlaces profundos, parámetros, hashes, acceso directo, historial y retorno al listado.

### 5.4. Plan técnico futuro de migración HTML — no ejecutar ahora

**Puerta previa:** ratificar el mapa completo y las consolidaciones con cada propietario, inventariar ramas/PR activos y autorizar una tarea concreta. Conservar fuentes y baseline; no borrar páginas antiguas antes de acordar compatibilidad. Ningún paso siguiente habilita código, build, configuración remota ni Git de escritura por sí mismo.

#### 5.4.1. Inventario de dependencias y enlaces

Revisar HTML/navegación principal/secundaria y móvil, formularios, enlaces de autenticación, scripts, CSS, fotos/SVG/fuentes, documentación operativa, pruebas, funciones y configuración Netlify. Inventariar `href`, `src`, `srcset`, `action`, imports, `window.location`, `location.assign/replace`, rutas generadas dinámicamente, parámetros/hash y enlaces profundos. El mapa debe asociar cada una de las 14 rutas actuales a un destino/vista o alternativa ratificada; ningún recorrido se elimina por desaparecer su archivo.

**Dependencias comprobadas por lectura, sin modificarlas:**

| Componente | Dependencia actual y revisión futura necesaria | Principal futuro |
| --- | --- | --- |
| HTML y navegación | Hojas `css/styles.css`, scripts `js/...`, imágenes `assets/...` y enlaces entre `.html` relativos al documento; cabecera/barra móvil, anclas y formularios | Propietario de cada fila; Ángel coordina el mapa |
| `js/acceso-ui.js` | `DESTINO = 'inicio.html'` y `location.replace`: desde `/pages/auth/` apuntarían a la carpeta equivocada si no se adaptan | Maricielo, revisión Auth/rutas Ángel |
| `js/catalogo.js` y `js/landing.js` | `crearRutaDetalle` genera `detalle.html?...`; Inicio consume el controlador compartido. Revisar resolución desde cada consumidor y enlaces a otras funcionalidades; no cambiar DTO, REST ni IDs | Ángel; Detalle Bernabé revisa el destino |
| `js/config-publica.js`, cliente/Auth y callback futuro | `appOrigin`/`authEmailRedirectTo` validados por mismo origen; SDK PKCE detecta retorno. La carpeta nueva no define por sí sola callback ni autoriza cambiar allowlist remota | Ángel; Maricielo consume |
| `js/publicaciones.js` y pantallas de vendedor | Selectores/errores, foto/CRUD y estados consolidados; ruta de activación/Publicar y puente del agente; no perder validaciones ni CTA de confirmación | Matías; Bernabé servicios; Ángel puente |
| CSS y recursos | `url('../assets/...')` se resuelve desde la hoja CSS, no desde el HTML. Las clases `reservation-desktop-only` y enlaces móviles representan vistas actuales de Reservas | Dueño de sección; ventana única para `css/styles.css` |
| Pruebas y documentación operativa | Rutas, servidores permitidos y aserciones de navegación en Acceso/Catálogo/Inicio; baselines de commits `e643381`/`89c9780` y URL local del arnés Auth | Cada suite/dueño; Ángel consolida impacto, sin debilitar aserciones |
| `scripts/preparar-netlify.mjs` | `PAGINAS` explícita, guardia `PAGINAS.length !== 14`, validación de referencias/imports y destinos JS resueltos contra `index.html` por suposición de raíz | Ángel, revisión de consumidores antes de cambiar el constructor |
| `netlify.toml` y funciones | Publicación `dist`, `pretty_urls=false`, funciones separadas; `/api/asistente` histórico y `/api/agente` propuesto no deben absorberse en redirecciones de páginas | Ángel; no activar IA ni cambiar handlers por migrar HTML |

#### 5.4.2. Resolución coherente de recursos

**[PROPUESTA DE MIGRACIÓN]** para Netlify servido desde `/`: resolver navegación/recursos públicos desde la raíz del origen controlado (`/pages/...`, `/js/...`, `/css/...`, `/assets/...`) y rutas autorizadas compartidas, sin nombres definitivos de módulo/selector todavía. Verificar Live Server y hosting; si se decide una subruta base, configurar una única base controlada y probarla, no obtenerla de prompts, query o localStorage.

No aplicar `../` masivamente: cada profundidad cambia la resolución del HTML, los imports ES relativos se resuelven desde el módulo y `url()` desde el CSS. Revisar `script src`, hojas, fotos/SVG/fuentes, enlaces y `window.location`/`location.assign/replace`; no añadir un `<base>` global que cambie anclas/formularios sin evaluación. Conservar rutas de API desde el origen permitido y distinguir URL pública de navegación de URL de servicio. La migración no necesita un segundo cliente Supabase ni reorganizar el REST.

#### 5.4.3. Construcción y Netlify

En tarea posterior autorizada, actualizar `PAGINAS`/`RECURSOS` de `scripts/preparar-netlify.mjs` según el inventario aprobado; sustituir la suposición fija de 14 por una comprobación contra ese inventario, **sin quitar la validación**. Revisar el detector de destinos JS y de importaciones para rutas anidadas/desde origen y enlaces dinámicos, además de recursos y anclas. No reemplazar la lista permitida por copia recursiva ni excluir comprobaciones para conseguir un build verde.

Revisar `netlify.toml`, acceso directo con `.html`, entrada `/` y estrategias explícitas de redirección/alias. Mantener Landing y aplicación diferenciadas, funciones fuera de `dist/` y código público separado de SQL, tests, documentos, entorno/secretos y código interno. No rewrite global a `index.html`, ni capturar `/api/*` como navegación. Generar/inspeccionar `dist/` solo con autorización de implementación; hoy no se ejecuta el constructor ni deploy.

#### 5.4.4. Compatibilidad, autenticación y transición

Aprobar por cada origen antiguo si se mantiene temporalmente, redirige o presenta una vista equivalente; justificar alcance/caducidad y probar query/hash, enlaces directos/favoritos e historial. Una URL antigua de éxito/activo no fuerza el estado autorizado del nuevo destino. UUID de artículo, reserva y conversación deben seguir identificando el recurso correcto; no usar un único registro de Figma como fallback.

Para confirmación de correo/PKCE, revisar Site URL, Redirect URLs y el destino configurado de `registrar()` en una tarea aparte autorizada. Conservar el origen local aprobado `http://127.0.0.1:5501` y elegir el origen público real después; mismo origen de la Web App preserva el ámbito localStorage/SDK, mover rutas no migra datos entre hosts. El callback debe inicializar el SDK y no eliminar `code` antes de su procesamiento ni duplicar canjes; enlaces enviados antes de la migración requieren compatibilidad revisada. Sin comodines/retornos arbitrarios, códigos en logs ni claves en rutas. No modificar firmas Auth ni su contrato para mover HTML.

El agente navega mediante el inventario aprobado y datos/IDs validados, sin URLs viejas rígidas ni enlaces elegidos por el modelo; apertura/cierre, reconstrucción de contexto permitido y cleanup por navegación/estado/bfcache. El historial local no prueba autenticación ni ejecución de herramientas.

#### 5.4.5. Implementación por propietarios y verificación posterior

Ángel coordina mapa/base de rutas, Netlify, agente, integración y seguridad; cada propietario adapta sus HTML/JS/CSS y estados en una tarea/PR acordada (§12). Bernabé conserva servicios/Detalle/Perfil y revisa intercambios/reputación; Matías vendedor/Publicar/fotografía; Maricielo Acceso/Cuenta/Reservas/Mensajes y LS. Serializar archivos compartidos; no editar simultáneamente ni trasladar todos los HTML a Ángel. Congelar ventanas y baselines antes de cambios.

Después de autorizar la implementación, probar inventario final completo: apertura directa/recarga, navegación/atrás/adelante, query/hash/UUID, referencias/imports/recursos, estados consolidados, permisos, Auth/PKCE, teclado/ARIA/foco, móvil y desktop, agente en todas las vistas aprobadas y continuidad local permitida. Verificar build/artefacto Netlify, ausencia de 404 requeridos, secretos/archivos internos y rutas API separadas; deploy solo autorizado. Conservar propósito de regresiones y justificar cambios de baseline por migración intencional; no borrar tests ni compararlos trivialmente contra sí mismos. Criterios propuestos MIG-01–MIG-06 en §13.3: todos pendientes, sin ejecutar estas suites/build hoy.

## 6. Contratos mínimos aprobados: datos compartidos, RLS y almacenamiento local

Los contratos mínimos siguientes forman parte de **[CONTRATO TÉCNICO APROBADO]**. No acreditan tablas/políticas creadas ni validadas; esta sesión no ejecuta migraciones. Concretar el esquema físico con consumidores antes de programar, manteniendo estas reglas; registrar ajustes compatibles en tareas/PR y revisar el contrato solo si un cambio arquitectónico o académico lo justifica. La arquitectura seleccionada tiene fuente autoritativa en PostgreSQL para negocio, Auth para credenciales y localStorage para preferencias/borradores y, en la propuesta 1.1, contexto conversacional no sensible. Esta memoria nunca autoriza operaciones ni sustituye registros remotos.

### 6.1. Identificadores, valores y entidades

UUID para entidades y claves foráneas reales. El identificador de perfil corresponde al UUID asignado por Auth; no inventarlo ni aceptar propietario/remitente enviados por la UI como prueba de identidad. Fechas UTC ISO-8601 generadas por servidor, presentación local es-PE. Precio entero en céntimos, moneda PEN y formato S/; no comparar dinero con decimales binarios. Propuesta de convención a congelar: columnas SQL/REST snake_case (vendedor_id, precio_centimos, categoria_id, campus_id, creado_en), DTO JavaScript camelCase (vendedorId, precioCentimos, categoriaId, campusId, creadoEn); articulos.js normaliza sin cambiar IDs ni significado. El GET de §8 debe alinearse con las migraciones finales. Categorías/campus/lugares públicos con IDs estables de un catálogo común, no cadenas diferentes por pantalla.

| Entidad propuesta | Datos mínimos y reglas |
| --- | --- |
| Perfil público | id vinculado a Auth; nombre visible de demostración, avatar opcional, universidad/campus y condición vendedor. No incluir correo, contraseña ni otros datos privados en consultas públicas |
| Datos de cuenta privados | Solo los necesarios para Mi Cuenta, accesibles al titular. Separar de perfil público o exponer una vista segura con columnas permitidas; RLS por fila no oculta columnas sensibles |
| Artículo | id, vendedorId, título 1–100, descripción 1–1000, categoriaId, condición, precioCentimos, PEN, campusId, imagen con proveedor/id/ruta/URL, estado, creado/actualizado y versión |
| Conversación | id, articuloId, compradorId, vendedorId derivado del artículo, creadoEn; participantes inmutables y distintos. Unicidad por artículo/comprador/vendedor para evitar duplicados |
| Mensaje | id idempotente, conversacionId, remitenteId derivado de auth.uid(), texto 1–1000 y creadoEn servidor; texto plano, sin adjuntos en el mínimo |
| Reserva | id, articuloId, compradorId, vendedorId, conversación opcional, estado, puntoEncuentro, creado/actualizado y versión. No copia mutable del artículo como fuente de verdad |
| Punto de encuentro | campusId, lugarId predefinido o nombre adicional validado, referencia pública breve y estado de acuerdo si la US lo requiere; sin coordenadas/GPS ni dirección privada |
| Imagen | proveedor Supabase Storage, bucket/ruta, URL HTTPS validada, ancho/alto/formato/bytes, propietario y relación con artículo/perfil; no archivos base64 en la BD |

Lugar adicional propuesto: campus conocido, nombre 3–100 y referencia ≤150 caracteres, sin dirección privada ni datos personales; revisión/confirmación explícita de que es un lugar público. Validar estructura no demuestra seguridad física ni verificación geográfica: no presentarlo como lugar certificado por CampusLoop.

Estados propuestos: artículo disponible → reservado → vendido; eliminado lógico deja de aparecer sin destruir reservas/historial. Reserva pendiente → confirmada → completada, o cancelada; pendiente/confirmada cuentan activas. El Planning congela quién puede confirmar/cancelar/completar y sus criterios: comprador no cambia precio ni marca venta ajena, vendedor no crea reserva a nombre de otro. La UI no acepta transiciones arbitrarias.

**Concurrencia:** crear reserva, comprobar disponibilidad y cambiar estado del artículo en una transacción PostgreSQL/RPC con bloqueo y restricción de una reserva activa por artículo. Cancelar/liberar también de forma consistente. Dos llamadas independientes desde frontend no garantizan US12. Controlar actualizaciones de artículos con versión esperada para no sobrescribir silenciosamente otra edición. Publicación/activación comprueba permisos en servidor además de validar UI.

### 6.2. Matriz mínima de acceso RLS — contrato aprobado

| Recurso | Lectura | Escritura |
| --- | --- | --- |
| Catálogo/perfiles públicos | Solo campos y artículos visibles aprobados; decidir si público anónimo o solo autenticado | Titular crea/edita sus datos permitidos; no puede asignarse verificación/privilegios ni alterar estados reservados mediante un update libre |
| Cuenta privada | Solo titular | Solo titular y columnas permitidas; credenciales mediante Auth |
| Conversaciones | Solo comprador/vendedor participantes | Creación autorizada deriva vendedor del artículo y comprador de Auth; no editar participantes libremente |
| Mensajes | Solo participantes de la conversación | Insertar solo como auth.uid() y participante; impedir suplantación, mover mensajes o modificar autor. Edición/borrado fuera del mínimo |
| Reservas | Solo comprador/vendedor correspondiente | Operaciones de negocio autorizadas/transaccionales; terceros no leen ni modifican |
| Archivos Supabase Storage | Fotos del catálogo pueden ser públicas; nunca documentos personales | Solo titular autenticado, ruta propia y restricciones del bucket; lectura pública no implica escritura pública |

Habilitar RLS en todas las tablas expuestas y limitar grants. Verificar tanto USING como WITH CHECK y los permisos por operación/columna; un filtro JS o de Realtime no reemplaza política. Evitar políticas recursivas o basadas en metadatos editables del usuario. La activación vendedor académica no equivale a verificación institucional.

Las funciones elevadas, si son imprescindibles, requieren revisión: auth.uid(), comprobación de actor/transición, search_path fijo, sin SQL arbitrario, permisos EXECUTE mínimos y sin exposición administrativa. No usar service_role en frontend ni desactivar RLS para resolver errores. Referencias: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones de BD](https://supabase.com/docs/guides/database/functions). Son diseño futuro, no políticas auditadas.

### 6.3. Historial real y Realtime

Primero persistir mensaje y confirmar insert; después reflejarlo como enviado. Identificador estable permite reintentar sin duplicarlo. Realtime notifica cambios, PostgreSQL conserva el historial. Suscribir y recuperar historial coordinadamente, deduplicar por ID y resincronizar tras reconexión; no depender de que todos los eventos lleguen ni marcar entregado/leído sin mecanismo real.

Un canal por conversación abierta y limpieza al salir/cerrar sesión; tablas/publicación Realtime necesarias y RLS verificadas. Dos computadoras, dos cuentas controladas, mismo proyecto y artículo. Pestañas con la misma sesión SDK no son dos identidades independientes; usar perfiles separados si se ensaya en un solo equipo. Sin cambios de identidad ni respuestas IA. Referencia: [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

### 6.4. Semillas compartidas seguras y reproducibles

Bernabé prepara migraciones, manifiesto de IDs y receta privada administrativa; el equipo controla cuentas ficticias y fotos autorizadas. Crear cuentas con mecanismos oficiales Auth, no insertar contraseñas en tablas ni escribir manualmente auth.users. Vincular los UUID realmente devueltos a vendedores de demostración; productos/categorías/lugares con IDs estables y relaciones válidas.

Proceso idempotente de upsert limitado a sus datos demo; ejecutarlo dos veces no duplica artículos/cuentas ni borra publicaciones, conversaciones o reservas de usuarios. Registrar versión/fecha y procedimiento sin credenciales. No endpoint público, botón en Landing ni siembra automática al cargar página. Cualquier privilegio administrativo existe solo en ejecución privada autorizada, nunca en código servido.

Una cuenta nueva ve el catálogo compartido, pero sus publicaciones/mensajes/reservas personales comienzan vacíos. Etiquetar datos ficticios y conservar licencia/origen de imágenes. No inventar que hay compradores reales, ventas, verificación o reseñas.

### 6.5. localStorage propio de CampusLoop — obligatorio académico

`js/localstorage.js` ofrece leer, guardar, eliminar y validar versión/forma, manejando JSON corrupto, cuota y almacenamiento bloqueado sin perder el formulario. Claves propuestas:

- `campusloop_tb4_v1_borrador_<usuarioId>`: título, descripción, categoría y precio no sensibles, fecha/versionado; sin archivo binario/base64 ni URL blob que deje de funcionar al recargar.
- `campusloop_tb4_v1_filtros_<usuarioId>`: búsqueda/filtros recientes no sensibles, con límites.
- `campusloop_tb4_v1_preferencias_<usuarioId>`: preferencias visuales y de interfaz no sensibles.

**[PROPUESTA, pendiente de Maricielo]** Añadir contexto conversacional del agente sin duplicar `localstorage.js`: clave ilustrativa `campusloop_tb4_v1_agente_historial_<usuarioId>`, versión, rol `user`/`assistant`, texto público permitido y fecha. Límites iniciales propuestos de 20 turnos, 24 KiB y TTL 7 días **no ratificados**. Solo contexto explícitamente clasificado como no sensible; el texto libre de usuario/modelo puede contener información privada y no se persiste automáticamente. Los resultados privados de cuenta/reservas y sus resúmenes permanecen efímeros; una regex no garantiza anonimización. Acordar retención/borrado, aislamiento por sesión SDK y tratamiento del logout antes de implementar. Visitante sin sesión: memoria efímera, no identidad inventada. Ver contrato del agente §6.

Definir límites/limpieza y tratamiento de borradores al cerrar sesión en equipo compartido antes de implementar; propuesta: aviso de almacenamiento local, borrador por cuenta, eliminación explícita y limpieza tras publicación confirmada. No eliminar todo localStorage ni manipular claves internas de Supabase.

Estos datos sobreviven recarga en el mismo origen/perfil; no se comparten entre computadoras. No guardar contraseñas, credenciales, mensajes privados de negocio, reservas ni datos personales sensibles. El contexto permitido del agente se limita a la regla anterior, no habilita guardar el chat libre completo. **Excepción delimitada:** el SDK puede persistir su propia sesión según §7; no es una función de localstorage.js ni prueba suficiente del requisito local propio. No copiar tokens a claves nuestras.

### 6.6. Intercambios y reputación — modelo confirmado, contrato operativo pendiente

**[ACUERDO DE COORDINACIÓN]** Comentarios y estrellas entre compradores y vendedores pertenecen al dominio de CampusLoop. Pago y entrega se acuerdan fuera de la plataforma; no hay pasarela, cobro, confirmación bancaria ni compras simuladas. Una confirmación de intercambio es un hecho de negocio autorizado por definir, no prueba de transferencia monetaria ni equivalencia automática con reserva confirmada/completada o artículo vendido.

**Reglas mínimas a preservar al concretar el contrato con Bernabé:**

- Solo participantes elegibles de una experiencia válida pueden calificar a la contraparte; identidad/relación derivadas de servicios y Auth, no de un ID/rol elegido en el formulario o por IA.
- Prohibidas autoevaluaciones, reseñas arbitrarias y calificaciones duplicadas para el mismo intercambio y evaluador; reintentos o concurrencia no pueden crear duplicados. La forma técnica de garantizarlo sigue pendiente.
- Acordar evidencia y proceso de cierre, quién confirma, discrepancias/cancelaciones, elegibilidad y escala de estrellas/comentarios antes de habilitar el envío. No suponer que reservar, conversar, abrir una URL o aceptar un texto acredita una experiencia completada.
- La persistencia autoritativa será negocio compartido protegido por servicios y RLS/GRANTS, no localStorage. Lectura pública solo de reputación autorizada, sin comentarios privados, correos u otros datos sensibles; cálculos/contadores sobre registros válidos, nunca inventados por frontend/modelo.
- Escrituras deben comprobar usuario/participación/estado/elegibilidad y permisos en servidor; guardas UI no sustituyen seguridad. El agente no crea reseñas ni confirma intercambios por iniciativa propia: todo efecto requiere contrato específico, autorización efectiva y confirmación humana expresa.

**[PENDIENTE, coordinación + Bernabé/consumidores]:** contrato operativo de intercambios y reputación; representación/persistencia, restricciones, concurrencia/idempotencia, permisos, exposición pública/privada y eventual moderación. **No elegir aquí tablas, columnas, índices, RPC, políticas definitivas ni asignar nuevos IDs US.** No se crea un contrato de reputación independiente en esta tarea. Fijar alcance comprometido y dueño de cada interfaz antes de implementar; Bernabé conserva servicios y base de datos, Maricielo Cuenta/Reservas y Bernabé Perfil público, sin imponer una UI nueva no acordada.

**Estado real de la base inspeccionada:** Landing, Inicio, Explorar, Detalle, Perfil y Cuenta incluyen textos/estrellas/contadores de Figma; varias pantallas los identifican expresamente como demo. No acreditan reputación, compras, ventas o experiencias reales; revisar también afirmaciones públicas de Landing antes de despliegue. La operación CL-1024 de Reservas es un ejemplo de consulta, no intercambio completado que habilite calificaciones. Ninguna inspección estática valida elegibilidad/RLS ni autoriza mostrar esos ejemplos como resultados del backend. Niveles avanzados, insignias y gamificación pueden seguir adicionales; reputación básica queda como dependencia operativa pendiente, no extra genérico.

## 7. Supabase Auth: ciclo, seguridad y alternativas

**[CONTRATO TÉCNICO APROBADO]** Supabase Auth y su SDK oficial; Angel mantiene servicio y Maricielo formularios. Detalles de configuración/sesión aún por validar. No se implementa autenticación manual, hashing casero, emisión/renovación de JWT ni tabla de contraseñas. Supabase Auth manejará las cuentas con contraseña real; usar cuentas de prueba y no documentar sus credenciales. La contraseña se transmite únicamente al servicio Auth mediante HTTPS en el flujo oficial, sin copias en nuestras tablas, logs ni almacenamiento del navegador.

| Paso | Comportamiento previsto y prueba verificable |
| --- | --- |
| Registro | Validar campos y política de contraseña alineada con configuración, formato de correo y aceptación de términos; llamar signUp oficial. Manejar duplicado, límite y fallo sin exponer información de otras cuentas |
| Confirmación de correo | Con confirmación activa, explicar que puede no haber sesión hasta abrir correo/retorno permitido; probar enlaces en origen público/local autorizado. Sin evidencia de correo confirmado no mostrar verificado |
| Inicio de sesión | signInWithPassword; mensajes en español y errores razonablemente genéricos; no registrar contraseña/respuesta Auth completa |
| Recarga | Cliente único, persistSession propuesto true y restauración SDK antes de renderizar datos privados; estado cargando, acceso o sesión expirada |
| Cierre | signOut oficial y limpieza UI/canales/datos privados en memoria; fijar alcance de salida actual/global. No borrar tokens manualmente ni prometer invalidación instantánea de un access token ya emitido |
| Expiración | autoRefreshToken administrado por SDK; escuchar cambios de Auth, reintentar solo según flujo seguro; sesión no recuperable vuelve a Login sin enviar formularios pendientes |
| Rutas | Guarda cliente al entrar a páginas privadas y retorno local permitido tras login; no consultar/mostrar datos privados antes de resolver sesión. No aceptar URL de retorno arbitraria |
| Autorización | RLS en cada recurso y operación; rutas HTML son públicas estáticas y la guarda no es control de acceso a datos |
| Función servidor IA y cualquier función protegida | Validar usuario mediante SDK oficial contra Auth o validación oficial de claims; getSession local/decodificar JWT no es prueba de identidad del servidor |
| Recuperación/errores | Red, credencial inválida, expiración y cuota son estados distintos comprensibles; recuperación de contraseña completa es tarea adicional si no se compromete, no enlace que prometa lo inexistente |

Referencias: [password Auth](https://supabase.com/docs/guides/auth/passwords), [sesiones](https://supabase.com/docs/guides/auth/sessions), [inicialización SDK](https://supabase.com/docs/reference/javascript/initializing), [getSession](https://supabase.com/docs/reference/javascript/auth-getsession), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [signOut](https://supabase.com/docs/reference/javascript/auth-signout).

### 7.1. Bloqueo de correo que debe resolverse temprano

El [SMTP predeterminado](https://supabase.com/docs/guides/auth/auth-smtp) restringe destinatarios al equipo del proyecto y actualmente limita a dos mensajes por hora; no es un correo de producción ni garantiza registrar libremente usuarios durante la exposición. **No dar por viable el alta pública hasta probarla con autorización.**

Opciones por aprobar: correo SMTP gratuito compatible y verificado, cuentas/e-mails controlados admitidos con planificación de cuotas, o desactivar confirmación expresamente para el prototipo (en ese caso correo no verificado, no afirmar US06 completa). Cuentas precreadas son respaldo de exposición, no evidencia de registro nuevo exitoso. Sin resolverlo, el flujo propuesto Landing→crear cuenta→iniciar no está aceptado. Nunca pagar, confirmar manualmente en secreto ni falsear verificación institucional.

### 7.2. Persistencia SDK frente a cookies

En navegador, el SDK puede guardar la sesión en localStorage y renovarla. Es la opción más viable para vanilla multipágina y acceso directo a datos/Realtime, **si el equipo acepta el riesgo de XSS**. Tokens accesibles desde JS pueden ser robados por inyección o scripts comprometidos: HTTPS, DOM seguro, dependencias fijadas, política de contenido evaluada y ausencia de scripts innecesarios reducen el riesgo, no lo eliminan. No recomendar dispositivos compartidos sin cierre de sesión; decidir duración y política de sesión en el proyecto.

No almacenar JWT/refresh token por cuenta propia en localStorage/sessionStorage, copiar sesión a otras claves o tratarla como información publicable. **Nunca** registrar tokens, credenciales, cabeceras Authorization, objetos de sesión o URLs sensibles en consola, logs, capturas, Trello, informe ni evidencias Network; redactar antes de capturar. La publicación de la URL y publishable key no sustituye RLS. [Claves públicas y secretas](https://supabase.com/docs/guides/getting-started/api-keys).

Alternativa: backend/BFF con cookies Secure, HttpOnly y SameSite, controles CSRF y gestión de sesión/refresh en servidor. Reduce exposición del secreto a JS, pero exige intermediar datos protegidos y diseñar autorización Realtime, rutas y ciclo de sesión; un helper SSR con cookies legibles por navegador no crea por sí solo una sesión HttpOnly. **No recomendada para el plazo actual** salvo cambio de arquitectura aprobado. No mezclar cookies y persistencia SDK sin contrato ni implementar JWT manual en ninguno de los casos.

## 8. Consumo REST seleccionado: catálogo en Explorar y fotos en Storage

### 8.1. Caso principal y frontera con PostgreSQL

**[CONTRATO TÉCNICO APROBADO]** Consultar artículos compartidos desde Explorar mediante **Supabase Data REST API**, generada por PostgREST sobre PostgreSQL. Flujo: `explorar.html → js/catalogo.js → js/articulos.js → fetch GET HTTPS /rest/v1/articulos → JSON → DOM de Explorar`.

Bernabé mantiene la consulta/normalización en el servicio compartido; Angel consume el contrato y maneja UI de Inicio/Explorar. Un único servicio evita consultas duplicadas y credenciales manejadas de forma distinta. Auth continúa con SDK oficial y RLS decide acceso a filas/operaciones. El navegador no contiene cadena de conexión PostgreSQL ni ejecuta SQL directo. Referencia técnica de la revisión previa: [API de datos de Supabase](https://supabase.com/docs/guides/api).

**Contrato aprobado, endpoint de catálogo aún no validado:** `consultarCatalogo(filtros, opciones)` asíncrona, con `opciones.signal` para cancelación; devuelve `{ ok, datos, error }` según §5. Datos son DTO de artículos según §6. El esquema debe fijar campos/relaciones y nombres reales antes de ejecutar esta consulta; no se declara existente ninguna tabla.

Ejemplo documental de ruta futura, sin credenciales ni ejecución:

`GET https://<proyecto>.supabase.co/rest/v1/articulos?select=id,titulo,descripcion,precio_centimos,moneda,categoria_id,campus_id,estado,vendedor_id,imagen&estado=eq.disponible&order=creado_en.desc&limit=24`

**Nota de compatibilidad:** el ejemplo anterior se conserva como ilustración histórica de 1.0, no URL ejecutable ni selección física aprobada. `imagen` es el objeto lógico del DTO; las siete columnas físicas y la normalización se rigen por [CONTRATO_ARTICULOS_CATALOGO_TB4](docs/CONTRATO_ARTICULOS_CATALOGO_TB4.md). No asumir columna JSONB ni copiar ese `select` a un servicio. Esta edición no cambia DTO, filtros, SQL ni criterios REST.

Es un ejemplo de filtro Disponible, no una regla para ocultar todos los demás estados del diseño. Solo campos autorizados, sin correo/datos privados; nada de select=* por comodidad. Tamaño/paginación/filtros deben quedar acordados con el esquema. No mostrar una página limitada como si fuera todo el catálogo ni filtrar solo un subconjunto local anunciando resultados globales. Componer parámetros con URLSearchParams y lista permitida de filtros/orden/estados; no SQL ni expresión arbitraria de PostgREST enviada por usuario.

### 8.2. Secuencia JavaScript y estados verificables

**Se elige fetch explícito para este caso académico.** El SDK sigue en Auth/Realtime y donde corresponda. Si posteriormente se justifica sustituir solo esta consulta por SDK, documentar que genera la misma solicitud HTTP REST e inspeccionarla en Network; no bastaría mostrar una llamada JavaScript sin endpoint/response.

1. Al entrar o aplicar filtros, mostrar **cargando**, región de resultados con aria-busy y anuncio accesible; conservar filtros y evitar múltiples solicitudes innecesarias.
2. Resolver sesión con el SDK. El servicio obtiene desde el cliente oficial el contexto de acceso necesario; token solo en memoria/cabecera de la petición. No guardarlo manualmente, enviarlo en URL/JSON ni registrar objetos de sesión.
3. Dentro de **try/catch**, construir URL del proyecto configurado y ejecutar **fetch con method GET**, sin cuerpo. Enviar las cabeceras de API pública/autorización que exija la configuración elegida: publishable key permitida, nunca secret/service_role, y sesión SDK cuando corresponda. RLS/grants deben estar configurados antes de exponer datos.
4. Comprobar **response.ok/status** antes de tratar la respuesta como éxito: fetch no rechaza automáticamente por 4xx/5xx. Diferenciar sesión no válida, permiso/configuración, cuota y fallo servidor sin exponer detalles internos. Una eventual renovación corresponde al SDK, no a JWT manual ni reintentos ilimitados.
5. En éxito, **await response.json()** y validar que sea un array de registros con IDs, campos y tipos esperados; comprobar precios/moneda/imagen. JSON inválido, respuesta inesperada o registros incompatibles producen error controlado, no tarjetas inventadas.
6. Array válido sin elementos → **resultado vacío**, explicación/limpiar filtros; no sustituir por fixtures y afirmar que llegaron de la API. RLS puede ocultar filas sin error HTTP: una cuenta autorizada debe obtener las semillas esperadas en prueba; 200 vacío no demuestra por sí solo que las políticas sean correctas.
7. Array válido con datos → **éxito**: normalizar DTO, crear tarjetas con DOM/textContent y atributos/URLs validados, precio S/, estado y fotografía Storage; enlaces conservan el ID real de Detalle/vendedor. No innerHTML con contenido recibido.
8. En **catch**, distinguir fallo de red, timeout/aborto y parseo/contrato; mostrar **error** comprensible con Reintentar explícito, sin perder filtros ni revelar tokens/respuesta cruda. Cancelar solicitud anterior/ignorar respuesta tardía para no sobrescribir filtros recientes; un aborto intencional no anuncia fallo de servicio.
9. Al terminar, retirar loading/aria-busy coherentemente con la solicitud activa. No mostrar éxito, total o disponibilidad que no se hayan confirmado.

No se implementa esta secuencia en la presente tarea: son criterios del contrato aprobado, pendientes de pruebas funcionales autorizadas.

### 8.3. Aceptación REST y evidencia académica

| Prueba planificada | Resultado verificable |
| --- | --- |
| REST-01 éxito | Cuenta autorizada en Explorar genera GET real a /rest/v1/articulos, status satisfactorio, JSON válido y tarjetas DOM que corresponden a esos IDs |
| REST-02 vacío | Consulta válida sin coincidencias retorna array vacío y muestra estado vacío con recuperación; no confundir con error de red |
| REST-03 HTTP | 4xx/5xx controlado se detecta con response.ok/status y muestra error seguro; sin anunciar datos guardados/recibidos |
| REST-04 red/JSON | Desconexión y respuesta malformada/incompatible se capturan con try/catch; reintento explícito y filtros conservados |
| REST-05 carga/orden | Se ve cargando y no llegan respuestas anteriores sobre filtros nuevos; teclado/foco/ARIA utilizables |
| REST-06 permisos | RLS y permisos/vistas restringen filas, campos y operaciones según contrato; usuario no accede a datos privados por cambiar parámetros o usar API directa |

Los éxitos requieren petición real autorizada. Negativos de HTTP/JSON pueden usar dobles locales sin consumir cuota, **etiquetados como simulados para la prueba**, sin fingir respuesta del proveedor. RLS se comprueba contra el backend real tras autorización; filtro UI no prueba seguridad.

**Network sin secretos:** capturar método GET, host/ruta sin credenciales, status, JSON de productos de demostración y resultado DOM. Preparar la vista antes de capturar, ocultar Authorization/apikey/cookies, tokens, payloads de autenticación, correos y cualquier sesión. Aunque la publishable key sea pública, omitir valores innecesarios en evidencia. No exportar HAR/logs crudos ni conservar capturas sin limpiar para recortarlas después. Anotar fecha, origen/versión y caso; no pegar JWT/refresh tokens en Word, Trello o chat.

### 8.4. Supabase Storage: fotos seleccionadas y REST complementaria

**Proveedor único: Supabase Storage. Mínimo: una fotografía por artículo.** Perfil/avatar nuevo adicional según capacidad, no condición para cerrar el mínimo. Se conservan fotos/Inter/SVG locales aprobados como recursos y datos demo autorizados; no duplicarlos indiscriminadamente.

Propuesta de límite de aplicación por confirmar en configuración: **≤2 MiB, JPEG/PNG/WebP**, un archivo, dimensiones razonables documentadas. Validar tamaño/formato/contenido en UI y configuración del servicio; rechazar SVG/HTML/PDF/vídeo y URLs arbitrarias. Comprobar si el proveedor valida bytes o solo MIME declarado: no asumir que el filtro del navegador bloquea una petición maliciosa directa. Si se requiere validación adicional, diseñarla de manera autenticada y autorizada **dentro de esta arquitectura**, sin sumar otro proveedor.

Bucket propuesto `articulos` y ruta `<usuarioId>/<idAleatorio>.<extension>`, con identificadores asignados/controlados y permisos storage.objects del titular. Lectura pública de fotos del catálogo puede aprobarse, pero escritura/borrado solo autorizado; nunca documentos personales. Un bucket público no oculta imágenes mediante RLS de la tabla de artículos. No usar claves administrativas en frontend ni permitir sobrescritura/borrado de activos ajenos.

Flujo: seleccionar → validar → subir con sesión oficial/permisos → validar metadatos/URL HTTPS del proyecto → guardar referencia en artículo mediante servicio autorizado → visualizar y recuperar tras recargar/desde otro equipo. Publicación no anuncia éxito antes de completar operaciones; fallo conserva texto/foto anterior, permite reintento y evita duplicados. Subida y escritura de artículo no son atómicas: acordar limpieza de archivos huérfanos por propietario sin romper fotos referenciadas.

**Evidencia complementaria, sin sustituir GET del catálogo:** documentar un POST HTTPS al endpoint Storage `/storage/v1/object/<bucket>/<ruta>`, con archivo como cuerpo según contrato del servicio, respuesta JSON/status y manejo de errores. Puede provenir de fetch o del SDK, explicando e inspeccionando su HTTP real; no confundir img/src o getPublicUrl con prueba de subida. Normalizar según versión SDK/API, no inventar nombres de campos. Red/cuota/formato/tamaño/permiso/JSON inesperado muestran errores comprensibles sin secretos.

Según documentación consultada en 0.4, Free incluye 1 GB Storage, egress/cached egress diferenciados y CDN básico; [transformaciones de imágenes](https://supabase.com/docs/guides/storage/serving/image-transformations) no están incluidas en Free. Verificar oferta/cuenta vigente sin pagar; optimizar recursos antes de subir y no prometer resize remoto gratuito. Referencias: [plan](https://supabase.com/pricing), [subidas](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [permisos](https://supabase.com/docs/guides/storage/security/access-control).

No añadir una API REST alternativa si este caso enfrenta bloqueos: resolver endpoint/permisos/configuración o escalar el problema. Otra API solo por nueva indicación expresa del profesor.

## 9. Agente global — alcance oral, US17 y protección

**[DOCENTE ORAL / ACUERDO ORAL, 21/11/2026]** Widget reutilizable inferior derecho **en todas las páginas y vistas finales incluidas en el inventario de rutas aprobado**, incluida Landing mientras se mantenga ese alcance. Texto, voz→texto, historial local permitido, herramientas reales y acciones confirmadas. No depende de 14 HTML separados ni de las rutas antiguas de raíz. Desarrollo contractual propuesto en [CONTRATO_AGENTE_GLOBAL_TB4](docs/CONTRATO_AGENTE_GLOBAL_TB4.md). No cambia IDs US ni acredita implementación. Angel mantiene agente/servidor; Matías Publicar y su puente futuro, Bernabé servicios/permisos y Maricielo persistencia reusable.

### 9.1. Interfaz global, voz y memoria

Montaje reutilizable único por página/vista, apertura/cierre, navegación y reconstrucción de contexto permitido con cleanup de listeners y solicitudes; contemplar estados consolidados y bfcache, sin duplicar HTML/JS del agente por archivo. Resolver navegación mediante rutas aprobadas y datos validados (§5.4), no strings antiguos ni URLs elegidas por el modelo. Diseño responsive sin tapar navegación/CTA, teclado/foco/Escape y anuncios accesibles. Nodos compartidos mediante `createElement`, salida con `textContent`/`.value`; ningún HTML/Markdown activo del modelo. Mostrar pendiente, carga, error, cancelación, sin resultados y autenticación requerida honestamente. Sin sesión, guía estática: no llamadas al modelo ni herramientas privadas por defecto. Abrir IA anónima exigiría decisión y controles adicionales específicos.

Micrófono solo por acción explícita; detectar SpeechRecognition/webkitSpeechRecognition, pedir permiso, transcribir a texto visible/editable y enviar tras decisión del usuario. No guardar audio ni asumir reconocimiento offline: el navegador puede usar un servicio remoto, que debe explicarse. Falta de soporte/permiso mantiene texto funcional y queda documentada, no cuenta como voz verificada. Cerrar/navegar/logout cancela captura y solicitudes; ignorar respuestas tardías. **TTS es [ADICIONAL]**, optativo, cancelable y sin lectura automática de contenido privado; no condiciona el mínimo ni el despliegue.

localStorage conserva únicamente contexto no sensible según §6.5 y el contrato §6, aislado por usuario; datos privados de herramientas/texto no clasificado se mantienen efímeros. Mostrar aviso, borrado y degradación segura si no hay almacenamiento. El historial no determina identidad, instrucciones del sistema, permisos, disponibilidad ni hechos de negocio.

### 9.2. Herramientas de lectura y borrador [PROPUESTA]

Registro permitido en servidor, JSON/esquemas estrictos y autorización por operación. Buscar/recomendar usa `consultarCatalogo(filtros, { signal })` y el DTO de [catálogo](docs/CONTRATO_ARTICULOS_CATALOGO_TB4.md), sin redefinir filtros, crear otro fetch ni inventar IDs/precios/fotos/totales. Las recomendaciones se sustentan en los registros recibidos, con límite de consulta declarado, sin garantizar disponibilidad futura. No ejecutar JS/SQL/URLs del prompt ni confiar en instrucciones dentro de resultados REST.

Consultar cuenta/reservas propias y estado vendedor requiere servicios protegidos de Bernabé y actor derivado de Auth, no un ID enviado por el modelo. Intercambios propios y reputación pública solo podrán consultarse cuando existan contratos/servicios autorizados (§6.6); la ausencia del contrato operativo sigue pendiente, sin inventar compras ni experiencias. El agente no procesa cobros ni confirma transferencias; no crea comentarios/calificaciones ni confirma intercambios sin contrato y autorización específicos. Minimizar campos y mantener datos privados fuera del historial persistente y, por defecto, del proveedor; presentar el resultado privado directamente al titular con lógica determinista. Un servicio inexistente se deniega/informa, no se simula. Nombres/firmas de herramientas, adaptadores servidor y sus proyecciones mínimas se ratifican con Bernabé; no importar módulos del navegador automáticamente en Netlify.

La capacidad US17 genera título ≤100 y descripción ≤1000, ambos editables, aceptables/descartables/restaurables; pedir características faltantes y no inventarlas. La política histórica de combinación de bloques completos no demuestra utilidad generativa ni tool-calling; su evolución exige revisión y pruebas en español. US18/categoría automática sigue adicional.

### 9.3. Publicación con confirmación humana separada

Una cuenta por estudiante conserva funciones de comprador y puede activar vendedor en el mismo perfil. Verificar autorización real protegida basada en `perfiles.vendedor_activado`, nunca `user_metadata`, sesión local o rol sugerido. El agente no concede activaciones; no altera revisión humana, estado pendiente, plazo de 48 horas ni notificación interna previstos por coordinación. La propuesta de activación sigue su ratificación/implementación independiente.

Desde cualquier página/vista aprobada: intención por texto/voz → comprobar sesión/permiso real de vendedor → pedir datos faltantes → borrador revisable → navegar a la **vista final de Publicar del inventario aprobado**, sin asumir que conservará `/publicar.html` → puente/formulario precompletado de Matías → validar datos y foto seleccionada manualmente → vista previa editable → **acción humana visible de confirmar** → backend revalida identidad/permiso/datos/Storage/RLS/GRANTS → persistencia idempotente → estado visual confirmado con ID real. Descartar o editar conserva originales; aceptar textos no publica. Sin contrato CRUD/foto/permisos efectivos, detenerse con integración pendiente.

Confirmar no es una herramienta invocable por el modelo ni un `confirmar=true` aceptado libremente. **[PROPUESTA de mecanismo, pendiente de Bernabé/Matías]** referencia efímera emitida y validada por servidor, ligada al actor, contenido exacto/revisión, foto y caducidad; cambios invalidan consentimiento. Consumo único/idempotencia y revalidación al ejecutar. Doble clic/reenvío no duplica; un timeout/aborto no prueba rollback: consultar estado confirmado antes de reintentar una escritura.

### 9.4. Transporte, identidad, proveedor y consumo

**[PROPUESTA]** `POST /api/agente`, cliente centralizado y función Netlify separada de `dist/`; envoltura/versiones/códigos/límites pendientes de acordar antes de programar. El SDK oficial existente gestiona sesión; token solo en memoria y cabecera HTTPS, sin añadir métodos Auth ni guardarlo manualmente. Servidor verifica `auth.getUser(token)` con cliente oficial sin persistencia; no decodifica JWT ni confía en sus claims locales. El adaptador de identidad existente es reutilizable tras ensamblaje y revisión; no acredita controles conectados.

NVIDIA NIM continúa **candidata**, no elección ratificada de proveedor/modelo. Referencias provisionales históricas: [mistralai/mistral-nemotron](https://build.nvidia.com/mistralai/mistral-nemotron) y [nvidia/nemotron-3.5-lightning-30b-a3b](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b). Verificar disponibilidad gratuita efectiva, español, tool-calling, parámetros, límites, latencia y condiciones para demostración pública con autorización. Las condiciones de trial citadas en 1.0 no conceden permiso público por ser académico; confirmar vigencia/aplicabilidad antes de usar. No copiar proveedor/clave del laboratorio ni elegir un modelo por su ficha pública.

`NVIDIA_API_KEY` solo en entorno servidor; modelo permitido configurable, `IA_HABILITADA=false` hasta revisión y autorización. Límites de cuerpo/contexto/salida/tokens/pasos/tiempo, cuota global y por actor y deduplicación **efectivos antes del upstream**. Contador de memoria serverless, CORS y botón no son cuota global. La solución transaccional requiere diseño/permisos/prueba con Bernabé; no se inventa RPC ni política. Sin habilitación global de IA, identidad requerida verificada, proveedor/configuración o cuotas efectivos, denegar por defecto con **503**, sin IA anónima. La aprobación como vendedor no es un control global: compradores autenticados pueden buscar/recomendar sobre datos reales y consultar cuenta/reservas propias con sus servicios/permisos; vendedor aprobado se exige solo para operaciones de esa capacidad, especialmente preparar y publicar artículos. Servicio/adaptador/permiso ausente deshabilita solo su herramienta cuando el aislamiento sea seguro y los controles globales sigan efectivos; de lo contrario, denegar. Nunca resultados ficticios como sustitución. Se conserva confirmación humana y autorización servidor para toda escritura. Sin pagos/recargas: presupuesto S/ 0.

### 9.5. Seguridad, privacidad, cancelación y errores

Validar esquema HTTP y argumentos/resultados de cada herramienta en servidor; no aceptar identidad, registro de herramientas, endpoints ni instrucciones privilegiadas enviados por cliente/modelo. Contexto, artículos y memoria son no confiables; separar instrucciones del sistema de esos datos. Antes de enviar contexto al proveedor, usar lista mínima de campos públicos/no sensibles; si no se puede asegurar esa frontera, omitirlos y pedir reformulación. No afirmar que regex o prompt eliminan toda PII/inyección.

Errores seguros en español, sin credenciales, sesiones, prompts internos ni respuestas privadas crudas. Una solicitud activa por interacción, cancelación y secuencia/revisión contra respuestas tardías; límites numéricos nuevos son propuesta por cerrar, no heredan automáticamente el esquema singular. Toda escritura mediante el agente exige confirmación humana expresa y autorización efectiva, además del contrato particular; la publicación es el recorrido definido aquí, no autorización genérica para calificar, cerrar intercambios o mutar reservas. No reintentar automáticamente escrituras ni consumos de IA ambiguos; no prometer que AbortSignal cancela un mecanismo que no lo admite. Capturas/Network sin tokens ni HAR crudo; permisos del micrófono y aviso de memoria antes del despliegue.

### 9.6. Transición y compatibilidad

**Supersedidos para la arquitectura futura:** UI exclusiva de Publicar, operación `proponer_publicacion`, endpoint singular `/api/asistente`, eventos `campusloop:ia-solicitar`, `campusloop:ia-estado`, `campusloop:ia-aplicar` y puente de `js/asistente.js`. No son interfaces del nuevo agente. **Se conservan intactos** `js/asistente.js`, `netlify/functions/asistente.mjs`, tests y README históricos, código demostrativo de Publicar e historial Git. La ruta singular sigue cerrada; no se redirige silenciosamente al agente ni se reutiliza su contrato HTTP como si fuera conversacional.

Entregas futuras: contrato aprobado → widget/voz/memoria offline coordinados → identidad/cuotas/herramientas de lectura reales → puente Publicar y confirmación segura → pruebas y despliegue autorizado. TTS se añade por capacidad, independientemente del despliegue mínimo. Retirar UI/eventos antiguos solo tras validación del reemplazo y autorización de sus propietarios. Los encargos actuales de Bernabé, Matías y Maricielo continúan; ningún archivo compartido se edita simultáneamente por aprobar esta propuesta.

## 10. Despliegue propuesto — Netlify Free y presupuesto S/ 0

El proyecto Supabase y acceso de Angel corresponden al corte histórico de §4.1; esta revisión no vuelve a acreditar servicios ni despliegue Netlify. [DOCENTE ESCRITO]: ambos productos públicos y tabla 5.1 con repositorio/tecnología/hosting/URL. Netlify Free seleccionado por coordinación junto a Supabase Auth/PostgreSQL/Realtime/Storage/Data REST API. Inspeccionar la configuración y evidencias vigentes antes de modificarla; no confundir los resultados previos de SDK/conectividad Auth con registro, RLS, herramientas o agente completos. NVIDIA sigue candidata, pendiente de Free/condiciones/tool-calling/prueba; sin modelo definitivo.

### 10.1. Un sitio, dos entradas y un origen de Web App

| Producto/servicio | Ruta pública propuesta, no creada |
| --- | --- |
| Landing | https://<sitio>.netlify.app/ → index.html |
| Web Application **[PROPUESTA DE MIGRACIÓN]** | https://<sitio>.netlify.app/pages/auth/login.html → /pages/catalogo/inicio.html y vistas del inventario final de §5; destinos por ratificar, no URLs ya publicadas |
| Agente global **[PROPUESTA]** | POST /api/agente → futura función fuera del artefacto estático, no creada ni habilitada |
| IA singular histórica, supersedida para el futuro | /api/asistente → función existente preservada y deshabilitada; no alias automático del agente |
| Catálogo REST | https://<proyecto>.supabase.co/rest/v1/articulos, GET autenticado según permisos |
| Fotografías | Endpoints Supabase Storage del proyecto con permisos; sin segundo proveedor |

Un sitio/repo mantiene Landing y Web App bajo entradas diferenciadas y un origen coherente. Confirmar interpretación docente de dos productos; si exige dos sitios, Landing separado y todas las pantallas Web App en un único origen, sin repartirlas entre hosts. La indicación oral de `pages/` sustituye la prohibición anterior de migrar los HTML: ejecutar solo el mapa/fusiones ratificados de §5 y tras autorización específica; no convertir a SPA por ese motivo. `index.html` puede seguir en raíz según hosting, no se obliga a moverlo.

localStorage y sesión SDK dependen de origen/perfil: cada preview/puerto/host tiene los suyos. Supabase comparte negocio entre computadoras, no los borradores locales. Definir redirect URLs de Auth permitidas para producción/desarrollo; no comodines arbitrarios en producción.

### 10.2. Artefacto y dependencias futuras mínimas

Tras autorización, `netlify.toml` + funciones + build por lista permitida: copiar a `dist/` únicamente las páginas/vistas físicas y recursos del inventario aprobado, conservando la estructura final autorizada; el número puede disminuir respecto a los 14 HTML históricos. Publicar `dist/`; funciones empaquetadas aparte. Excluir SPEC/Word, .git, .env, migraciones/semillas privadas, logs, pruebas/evidencias, claves y scripts administrativos. .gitignore no garantiza que un archivo no se sirva; inspeccionar artefacto y respuestas HTTP. [Build/configuración](https://docs.netlify.com/build/configure-builds/file-based-configuration/).

La base inspeccionada ya tiene `netlify.toml` y `scripts/preparar-netlify.mjs`; no se modifican ni se reconstruye `dist/` en esta edición documental. El constructor actual exige 14 HTML y resuelve ciertos destinos JS contra la raíz: deberá adaptarse y conservar sus validaciones para el inventario final, rutas anidadas/desde origen y widget en todas las vistas aprobadas (§5.4). Nuevos recursos solo por lista explícita y revisión coordinada; no copiar carpetas completas ni publicar pruebas/documentos. Mantener funciones separadas y compatibilidad de rutas antiguas explícita, sin rewrite global. Callback Auth de producción, origen y Redirect URLs pendientes de implementación/configuración autorizadas; no convertir el chat en callback ni limpiar PKCE antes del SDK.

Conservar .html/enlaces y verificar Pretty URLs/redirecciones/acceso directo. Ningún rewrite global de rutas a index que rompa archivos/API. SDK Supabase con versión/lockfile o distribución fijada, carga documentada y sin duplicados; si la biblioteca CDN falla, mensaje comprensible, sin fallback inseguro. Live Server comprueba estáticos; no ejecuta funciones. Netlify Dev/pruebas integrales son futuras, requieren autorización para instalar/usar red.

### 10.3. Configuración y secretos

| Configuración propuesta | Exposición permitida |
| --- | --- |
| SUPABASE_URL y publishable key (o anon heredada validada) | Públicas, RLS/grants correctos; no credencial administrativa |
| NVIDIA_API_KEY | Solo función servidor; jamás build público |
| NVIDIA_MODEL, IA_HABILITADA | Servidor; integración inicialmente apagada |
| Bucket/rutas de Supabase Storage | Configuración pública permitida; proveedor fijo, sin URL arbitraria ni secreto |
| Clave administrativa Supabase, solo si receta privada la necesita | Fuera del navegador y del artefacto; no necesaria para operaciones ordinarias que respetan RLS |

Valores privados en [entorno de funciones Netlify](https://docs.netlify.com/build/functions/environment-variables/) configurado solo tras autorización, no netlify.toml/versionados. .env.example futuro solo nombres sin valores; revisar exclusiones antes de crear secretos locales. Servidor usa Auth oficial; no registrar headers, sesiones ni contenidos privados.

### 10.4. Free: límites y continuidad

[Netlify Free](https://www.netlify.com/pricing/) ofrece actualmente 300 créditos mensuales con límite; confirmar cuenta/plan/ciclo reales y coste aplicable de deploy/cómputo/tráfico. No activar recargas/AI Gateway/pagos; reducir despliegues de producción redundantes y reservar margen. Agotar cuota puede impedir acceso a ambos productos; segundo sitio no crea saldo independiente garantizado.

[Supabase Free](https://supabase.com/pricing): dos proyectos activos, 500 MB BD, 50 000 MAU; pausa después de una semana inactivo. Realtime: 200 conexiones pico/2 millones de mensajes mensuales. Storage/egress en §8. Sin SLA de producción garantizado. Verificar estado/uso antes de ensayo, entrega y sustentación; no asumir restauración instantánea ni mantener actividad artificial contra condiciones.

NVIDIA añade cuota/condiciones a validar; Supabase y Netlify seleccionados tampoco son capacidad ilimitada. La simplificación conserva RLS/seguridad. Cualquier agotamiento se maneja como indisponibilidad honesta, sin habilitar facturación. Registrar URLs/versión real/despliegue/fecha y limitaciones después de pruebas autorizadas; no llenar capítulo V con estas rutas propuestas.

## 11. Sprint Planning 2, Sprint Backlog y Trello

**Rúbrica, criterio 1 (1.5 ptos):**

- **Sprint Planning 2:** fecha real, asistentes reales, Sprint Goal, **Velocity**, Story Points **comprometidos** y evidencia de reunión.
- **Sprint Backlog 2:** User Stories seleccionadas, Work-Items/Tasks derivados, responsables, estimación y **estado real de avance**, capturas y **URL pública de Trello**.
- **Team Collaboration Insights:** capturas del historial de commits, **Contributors** y **Pull Requests** demostrando participación auténtica de los cuatro integrantes.

**Nunca inventar estimaciones ni resultados:** la *velocity* se calcula con Story Points de historias realmente **completadas bajo la definición de terminado acordada** en un Sprint anterior; no equivale automáticamente a puntos comprometidos (en Sprint 1 se comprometieron 29 SP). Si todavía no existe una velocidad histórica verificable, indicar ese hecho y documentar la forma de estimarla, sin inventarla. La suma de Sprint 2 debe salir del Trello y de la reunión real, no del SPEC.

**Advertencia para el equipo:** el tablero original TB3 no se ha tratado como público. La rúbrica TB4 exige **URL pública accesible** del Sprint Backlog. Antes de cerrar Sprint Planning, decidir cómo exponer un tablero verificable **sin publicar datos privados**: convertir a público el tablero pertinente tras una revisión, o utilizar una copia pública fiel y actualizada respaldada por evidencias (si la docente/consigna lo admite). Una URL inaccesible para el evaluador no cumple la exigencia de la rúbrica. No registrar estados «Hecho» sin evidencia.

**Antes de comprometer:** matriz requisito → fuente → historia/tareas → propietario/consumidores → criterio de aceptación/prueba → evidencia/PR. Las cifras heredadas de Sprint 1 se cotejan con su informe/acta real. El Word revisado declara 29 SP comprometidos para ocho historias del Sprint 1, expresamente como estimación, no velocity; no acredita por ello todos sus criterios funcionales ni una velocidad histórica de 29. No reutilizar puntos/responsables antiguos como compromiso de Sprint 2.

**Trello:** el informe contiene `https://trello.com/b/CK4kfDD9`. El usuario solicitó a Bernabé hacerlo público; no se da por completado. En la revisión anterior la consulta de lectura no fue accesible con la herramienta; eso no permite concluir si es privado ni comprobar tarjetas. No se ha verificado de nuevo en esta revisión. Pendiente verificar sin sesión/incógnito: URL abre, listas y tareas reales Sprint 2 legibles, sin datos privados, SP/estados según Planning real. No usar ni difundir el enlace de invitación del Word como URL de evidencia; no crear tarjetas ni cambiar visibilidad desde esta revisión.

## 12. Autoría, capacidad, dependencias y estrategia Git

**Distribución preliminar pendiente de los cuatro integrantes.** Los principales por archivo de §5 evitan dos editores; revisor/consumidor no implica coautor automático. Preservar autoría TB3 y su historial; cambios futuros no reasignan aportes pasados.

| Integrante | Entregables propuestos | Frontera y apoyo |
| --- | --- | --- |
| Angel David Cardenas Cabrera | Arquitectura de rutas y coordinación de migración HTML; agente global/voz/función (TTS adicional), cliente Supabase/Auth, Inicio/Explorar, Netlify e integración/QA/seguridad | Coordina mapa/build/compatibilidad por PR; **no implementa automáticamente todos los HTML** ni toma las interfaces ajenas |
| Bernabé | Esquema/migraciones/semillas, contratos y servicios de artículos/perfiles/reservas/mensajería/permisos, Detalle/Perfil; revisión posterior del contrato operativo de intercambios/reputación | Conserva servicios/BD/RLS; coordina sus rutas/consumidores en tarea futura. No edita HTML ni SQL en esta revisión documental |
| Matías | Activación, Publicar/CRUD, fotografías y adaptación futura a estados consolidados; puente de borrador/confirmación y retirada coordinada del panel IA exclusivo | Conserva pantallas/autoría. No desarrollar el bloque IA antiguo como funcionalidad final; agente global de Angel, sin edición simultánea |
| Maricielo | Registro/Login, Cuenta, Reservas/Mensajería UI, LS e integración; futura adaptación de sus pantallas/estados a `pages/` | Consume servicios/Auth sin JWT/SQL/cliente duplicados; decide con Bernabé recorrido de consulta de Reservas y sus permisos |

**Carga real:** Angel mantiene tres caminos críticos (Auth, IA, deploy) y revisión; Bernabé suma esquema/RLS y servicios. Maricielo conserva cuatro interfaces y validaciones, por lo que la redistribución no elimina su riesgo. Antes de comprometer, cada uno declara disponibilidad y estima tareas; no inventar horas/SP. Delegar a Bernabé pruebas de autorización y servicios compartidos, a Matías uploads y pruebas CRUD, a Maricielo LS/QA de sus flujos; repartir documentación y Nielsen entre todos. Si falta capacidad, reducir variantes/avatar/galerías antes de trasladar todo a Angel. No añadir otro proveedor o API REST para resolver la carga.

**Orden de dependencias:**

1. Aplicar el contrato 1.0 aprobado y revisar capacidad/responsabilidades; verificar accesos/permisos al proyecto existente, correo y GET REST seleccionado → esquema/IDs/estados/contratos + auth y RLS.
2. Contrato artículos/perfiles + semillas → Inicio/Explorar/Detalle; auth → interfaces de acceso/Cuenta/Activación.
3. Auth + artículos + Supabase Storage → CRUD Publicar; contrato del agente y puente futuro acordado permiten trabajo paralelo sin interferir en las entregas actuales de Matías/Bernabé/Maricielo.
4. Auth + conversaciones/mensajes/RLS → Mensajería; reservas/RPC/estados/lugares → interfaz Reservas.
5. Flujos integrados y errores → prueba en dos computadoras → deploy autorizado → Nielsen/correcciones/informe.

**Dependencias transversales de cierre 1.1:** mapa de rutas/compatibilidad revisado por todos → tarea autorizada de resolución de enlaces/recursos y build → adaptaciones por dueño y consolidaciones aprobadas → verificación MIG-01–MIG-06 antes de retirar rutas antiguas/deploy. Reputación requiere contrato operativo de elegibilidad/intercambios de Bernabé y revisión de consumidores, sin asumir que una reserva autoriza calificar. Las tareas vigentes continúan; acordar ventanas de HTML/CSS/build y PR por archivo, no movimientos masivos en ramas ajenas.

**Git a conservar:** integracion/angel, integracion/bernabe, integracion/matias, integracion/maricielo; subramas feature/fix pequeñas → PR a rama personal → PR a develop → integración final main controlada. No trabajar directamente en main por ser la rama local actual. No cambiar de rama ni sincronizar por este documento; cualquier operación requiere autorización.

Antes de tarea: rama/status/diff/check, cambios locales y propietarios/dependencias. Contratos primero en PR revisado por consumidores; después PR de un recorrido pequeño. Un cambio de auth, esquema o función compartida incluye compatibilidad/consumidores/migración y pruebas; no reescribir módulos ajenos. Acordar ventanas para css/styles.css, HTML común, package/build/config y migraciones; un solo editor por archivo y secuencia explícita de migraciones, sin aplicar SQL divergente en el mismo proyecto.

Revisión de seguridad antes de exponer tablas/Storage/funciones; integración continua con pruebas de regresión y evidencia por autor. Sin commits vacíos, firmas falsas, squash que borre participación sin acuerdo ni métricas inventadas. PR/deploy/release requieren autorización separada; v0.1.0 histórico no se altera.

## 13. Aceptación y pruebas verificables — plan, no resultados

Esta matriz es **plan de aceptación, no reporte de ejecución**. Los resultados de suites existentes viven en sus evidencias/PR; no se repiten ni se sustituyen aquí. Las pruebas nuevas del agente están **pendientes**: esta revisión solo realiza contraste documental/código y verificaciones Git. Un doble sirve para comportamiento offline y negativos, no acredita API/IA/mensajes reales.

### 13.1. Pruebas del alcance seleccionado, por comprometer en Planning

| ID | Criterio y prueba prevista | Principal |
| --- | --- | --- |
| T01 | Todas las rutas/vistas finales aprobadas, incluida Landing, con acceso directo, fragmentos y recursos sin roturas; trazabilidad de los 14 HTML de origen, estados consolidados y compatibilidad. Términos accesibles desde footers de ambos productos | Cada módulo; Angel consolida |
| T02 | 320/390/768/1024/1280/1440/1920 px; comparar 390/1440 con Figma/baseline; sin overflow ni barra inferior sobre acciones; Inicio/TB3 conservados | Todos |
| T03 | Teclado, labels, foco visible/retorno, ARIA y anuncios de carga/error; validación sin depender solo de color; todo en español según excepción registrada | Todos |
| T04 | Registro válido crea cuenta; inválido no llama/guarda; errores/cuota comprensibles. Confirmación/retorno probados según decisión, sin afirmar verificado si no corresponde | Maricielo + Angel |
| T05 | Login/recarga/refresh administrados por SDK; logout limpia UI/canales; ruta directa sin sesión no revela datos. No contraseñas en storage ni tokens/credenciales en logs/evidencias | Angel + Maricielo |
| T06 | Dos cuentas/dos computadoras ven mismo catálogo sembrado; nueva cuenta sin publicaciones/mensajes/reservas propias. Seed privado ejecutado dos veces sin duplicados ni borrado de datos ajenos | Bernabé |
| T07 | Filtros combinados válidos, orden/limpiar/cero resultados inline; precios en S/ e IDs correctos; recordar filtros después de recargar sin tratar LS como catálogo | Angel |
| T08 | Detalle y vendedor corresponden a ID; inválido/eliminado informa y ofrece regreso, sin ficha MacBook por defecto; solo datos públicos de perfil | Bernabé |
| T09 | Activación muestra no solicitado/pendiente/aprobado/rechazado según servicio, sin privilegios por URL; CRUD propio persiste compartido y éxito solo tras respuesta válida. Otro usuario no edita/elimina ni hay publicaciones automáticas/duplicadas. Consolidación visual según mapa aprobado | Matías + Bernabé |
| T10 | Dos compradores intentan reservar mismo artículo; solo una operación activa confirma. Cancelación libera consistentemente; estados/autor y recarga coinciden en ambos equipos | Bernabé + Maricielo |
| T11 | US10: seleccionar campus/lugar público o adicional válido; confirmar/recuperar en reserva compartida; rechazar vacío/dirección privada no pertinente, sin mapas | Maricielo + Bernabé |
| T12 | Comprador envía, vendedor recibe/responde en otro equipo y comprador recibe; recarga recupera historial; reconexión no duplica ni pierde confirmados | Bernabé + Maricielo |
| T13 | Tercera cuenta intenta leer/insertar mensaje/conversación/reserva ajena y falsificar remitente/propietario mediante API directa: RLS lo rechaza. Filtros UI no cuentan como defensa | Bernabé; revisión Angel |
| T14 | Borrador/preferencias/filtros propios sobreviven recarga; JSON corrupto/cuota/almacenamiento bloqueado recuperables. Cuentas no heredan borrador ajeno, logout según política aprobada | Maricielo; consumidores |
| T15 | REST-01–06 de §8: GET fetch real a PostgREST desde Explorar, response.ok/status, JSON validado, try/catch, carga/vacío/error/éxito y DOM; Network sin tokens/credenciales. POST Storage complementario | Bernabé servicio + Angel DOM; Matías Storage |
| T16 | Foto: formato/tamaño reales válidos aceptados; disfrazado/no permitido/excesivo rechazado; no overwrite/borrado ajeno, sin escritura anónima/privilegios administrativos en navegador. Error/red/cuota conserva borrador y foto anterior | Matías; revisión Angel |
| T17 | US17 desde agente global: título/descripción en español sustentados en datos aportados; editables, aceptar/descartar/restaurar; sin aplicación tardía ni publicación automática. Puente acordado con Publicar | Angel + Matías |
| T18 | IA/red/timeout/429/JSON malformado/configuración ausente: mensaje seguro, sin secreto ni respuesta cruda; edición manual sigue. Entrada HTML/script de IA/REST/usuario se muestra como texto | Angel + consumidores |
| T19 | Cuotas/controles IA/uploads se prueban sin carga masiva ni agotar Free; llamadas no autorizadas rechazadas y cortes efectivos. No suponer protección global por un contador local | Angel + Matías/Bernabé |
| T20 | Artefacto estático sin secretos/SQL/admin/Word/logs; funciones verifican sesión y origen/ruta permitida. Public key con RLS, no secret/service_role en navegador. Consola/evidencias redactadas | Angel; revisión cruzada |
| T21 | Sitio público desde navegador sin login Netlify, recursos y entradas Landing/App correctas; URL/versión real en §5.1. Servicios/confirmación email activos antes de demo | Angel |
| T22 | Checklist 10 Nielsen por producto, antes/después de hallazgos reales y nueva verificación; observaciones TB3 atendidas según evidencia | Equipo |
| T23 | Trello sin autenticación y tareas/SP/estados reales; Git/PR/contributors auténticos, 3–5 commits representativos explicados; archivos/ZIP/links y ensayo ≤12 min verificados | Equipo |
| T24 **[PROPUESTA]** | Widget global en todas las páginas/vistas finales del inventario aprobado, incluida Landing según alcance; DOM reusable, estados consolidados, responsive/teclado/ARIA/foco/cleanup sin tapar CTA ni navegación; AG-01/02 | Angel; cambios compartidos coordinados |
| T25 **[PROPUESTA]** | Voz→texto visible/editable en navegador compatible, permisos/errores/cancelación/fallback; ningún audio almacenado ni envío automático; AG-04. TTS AG-05 adicional | Angel |
| T26 **[PROPUESTA]** | Historial no sensible en LS tras navegar/recargar, aislamiento/borrado/versión/cuota/TTL acordados; no persistir texto privado ni resultados de cuenta/reservas; AG-03 | Angel + Maricielo, extensión posterior |
| T27 **[PROPUESTA]** | Modelo real solicita herramientas permitidas: catálogo y recomendaciones con IDs/filtros/DTO originales, ámbito de resultados honesto; rechazo de herramienta/argumentos desconocidos; AG-06/12 | Angel + Bernabé |
| T28 **[PROPUESTA]** | Cuenta/reservas propias mediante servicios protegidos; A no accede a B, logout corta exposición, sin PII a memoria/proveedor; AG-07. Intercambios propios/reputación solo cuando exista contrato autorizado, sin inventar experiencias ni calificaciones | Angel + Bernabé; UI Maricielo intacta |
| T29 **[PROPUESTA]** | Desde cualquier página, borrador/foto manual/preview/confirmación humana; sin vendedor deniega; doble envío/revisión alterada/replay no publican ni duplican; éxito solo con ID backend; AG-08–11 | Angel + Matías + Bernabé |
| T30 **[PROPUESTA]** | Evidencia HTML/DOM/eventos, voz→texto→herramienta→resultado y LS; rutas finales/estados migrados según §5/MIG, Netlify público autorizado, funciones/artefacto seguro y Nielsen antes/después; AG-13/14 | Equipo; Angel coordina |

A cada ejecución adjuntar fecha, entorno/origen, versión/commit, cuentas alias, paso esperado/obtenido, resultado y captura/redacted log. Distinguir local/preview/producción, navegador y ancho. No guardar sesiones completas, HAR sin limpiar, contraseñas, email privado ni capturas de paneles con claves. Exponer porción JSON no sensible y status, ocultando cabeceras y formularios de autenticación.

### 13.2. Pruebas adicionales, no compromiso mínimo

Carga masiva/stress, escala multiusuario amplia, E2E exhaustivo de todos los navegadores, cookies/BFF, adjuntos/leído/presencia, galerías grandes, moderación avanzada, US18 y TTS (AG-05). No consumir cuota para estas pruebas ni presentarlas como realizadas; aprobar alcance y presupuesto antes. Un tercero no autorizado T13 y concurrencia de dos reservas T10 son pruebas **mínimas de seguridad/consistencia**, no opcionales por ser difíciles.

Pruebas de fallo podrán usar dobles locales para 429/JSON/timeout y registro explícito de esa técnica. Los éxitos REST, IA y comunicación entre equipos necesitan servicios reales autorizados; videos anteriores son respaldo honesto ante caída, no prueba de que el servicio responde en ese instante.

### 13.3. Criterios de migración [PROPUESTA DE MIGRACIÓN / PENDIENTE]

No son pruebas ejecutadas ni cambios de las 20 US; complementan T01/T24–T30 sin renumerarlos. Requieren autorización de implementación y mapa ratificado antes de comprobar funcionamiento.

| ID propuesto | Comprobación futura | Principal / revisión |
| --- | --- | --- |
| MIG-01 | Inventario con las 14 rutas de origen y todos los destinos/vistas finales aprobados; ninguna fila perdida; decisión de independencia/fusión y compatibilidad por propietario | Ángel coordina; todos los dueños |
| MIG-02 | Apertura directa/recarga/atrás/adelante, enlaces antiguos/favoritos, navegación desktop/móvil, query/hash/UUID y destino correcto sin 404 ni fallback ficticio | Cada pantalla; Ángel integra |
| MIG-03 | Scripts/CSS/imports/fotos/SVG/fuentes y rutas generadas resuelven desde cada profundidad; nada de prefijos `../` masivos ni referencias antiguas rígidas | Cada dueño; constructor Ángel |
| MIG-04 | Activación/Publicar consolidados solo si se aprueban; estados reales, foco/ARIA/errores/confirmación visual preservados. Reservas conserva listado, consulta/conversación, detalle, retorno e IDs/permisos, tanto si fusiona como si sigue independiente | Matías y Maricielo; Bernabé servicios |
| MIG-05 | Guarda y retorno Auth en rutas aprobadas, mismo origen permitido, callback carga SDK; preserva PKCE y parámetros hasta su procesamiento único; ninguna URL de activo/éxito o memoria concede permisos | Ángel Auth; Maricielo UI; prueba real aparte autorizada |
| MIG-06 | Lista explícita/build/`dist/` coherentes con mapa final, API y funciones separadas, sin secretos/archivos internos; agente usable con contexto/cleanup en todas las vistas aprobadas; responsive/teclado y deploy posterior autorizados | Ángel coordina; dueños QA por pantalla |

**Reputación, aceptación operativa por concretar:** antes de habilitar, revisar y probar experiencia válida, participante propio/contraparte, rechazo de autoevaluación/duplicados/terceros, reintentos/concurrencia y exposición pública segura según §6.6. La ausencia de contrato deja estos casos pendientes; no son extras ni resultados aprobados. No se eligen tablas/RPC/escala definitiva ni se ejecutan pruebas SQL o remotas en esta revisión.

## 14. Evaluación heurística de Nielsen — Capítulo VI

**Rúbrica, criterio 4 (2 ptos):** evaluar **Landing Page y Web Application** con el checklist de las **10 heurísticas**, indicando cumple/no cumple (y evidencia). Para **cada heurística no cumplida**, presentar **tabla de corrección aplicada**, explicación del cambio y capturas **antes y después**. No inventar «No cumple» si no se observó ni marcar «Cumple» sin revisión.

Checklist obligatorio:

1. Visibilidad del estado del sistema.
2. Relación entre el sistema y el mundo real.
3. Control y libertad del usuario.
4. Consistencia y estándares.
5. Prevención de errores.
6. Reconocimiento antes que recuerdo.
7. Flexibilidad y eficiencia de uso.
8. Diseño estético y minimalista.
9. Ayuda para reconocer, diagnosticar y recuperarse de errores.
10. Ayuda y documentación.

Registrar para cada una: pantalla/producto, resultado, hallazgo, evidencia y responsable. Si **No cumple**, registrar corrección aplicada, archivo/PR, captura antes, captura después y nueva verificación. Los hallazgos se convierten en tareas reales de corrección.

**Plan propuesto de evaluación:** capturar hallazgos y baseline antes de los cambios funcionales; repetir en la versión pública integrada. Matriz base de 20 entradas (10 heurísticas × Landing/Web App), con revisión de pantallas y flujos relevantes; una fila global sin evidencia de ambos productos no basta. Revisión cruzada entre integrantes, responsable por corrección y seguimiento en Trello. No esperar al cierre para obtener el antes. Severidad/prioridad puede añadirse como propuesta técnica, sin alterar el checklist docente.

En la arquitectura seleccionada observar especialmente: carga/restauración de sesión, confirmación de correo, errores de red/cuota, reserva en conflicto, mensajes pendientes/reconexión, privacidad de fotos/borradores y control de aceptar/descartar IA. Añadir el agente en ambos productos: botón/panel sin solapamiento, foco/teclado, permiso de micrófono, transcripción editable, memoria/borrado, límites de herramientas y confirmación antes de escribir. Guardar antes/después reales cuando se implemente, sin declarar cumplimiento por el diseño. No confundir usabilidad con seguridad: aprobar una heurística no prueba RLS. Mantener idioma español por la excepción oral y registrar esa dependencia, sin declarar implementado inglés.

## 15. Impacto documental futuro — sin modificar el Word

Documento de referencia: D:\Ciclo 5\IHC y Programacion WEB\TB3\report_1ACC0237-202620.docx. Conservar TB1–TB3, Sprint 1 y 20 identificadores US. No reconstruir informe ni rellenar con pruebas futuras. Nuevas decisiones se registrarán con fecha/justificación y se contrastarán con los criterios originales; este SPEC no acredita que todas las US estén terminadas.

| Apartado afectado | Cambio futuro justificado, tras autorización específica para el Word |
| --- | --- |
| 2.2.4, evaluación de API | La versión releída al cierre **ya propone REST de imágenes y evaluar datos/Auth en nube**. No reconstruir ni sustituir ese avance. Reflejar la arquitectura seleccionada y Supabase Data REST API: GET catálogo/PostgREST, JSON/errores, Storage para fotos y límites Free. Mantener la coherencia sin reintroducir mapas ni otra API |
| Product Backlog y criterios US | Mantener las 20 US y sus IDs; US17 título+descripción editable como capacidad del agente global, con trazabilidad del cambio oral. Búsqueda/recomendación sustentada no acredita toda US19; personalización avanzada y US18 adicionales. US09–12 conservan sus reglas; US06 no completa por formato de email; US20 excluida |
| Arquitectura/datos/privacidad y diseño técnico | Explicar C simplificada seleccionada: Auth/RLS/BD/Realtime, Data REST API, Storage, fuente autoritativa y LS no sensible; retirar afirmaciones de solo almacenamiento local para negocio. Figma conserva estructura, nuevas interacciones se documentan sin inventar frames |
| Organización HTML, navegación y negocio | Registrar indicación oral `pages/`/estados y el mapa de las 14 rutas de origen; distinguir propuesta de migración ejecutada, compatibilidad y pruebas. Documentar reputación/intercambios sin pasarela, contrato operativo pendiente, elegibilidad y prohibición de inventar experiencias; no reescribir TB1–TB3 |
| 4.1/configuración y gestión de desarrollo, donde corresponda | Dependencias/versiones, entorno reproducible, variables sin valores, migraciones/semillas privadas, pruebas y despliegue; registrar acuerdos nuevos sin atribuirlos al Sprint 1 |
| 4.3 Sprint 2 | 4.3.1 Planning real, 4.3.2 Backlog/estimaciones/estados reales, 4.3.3 Development Evidence JS/REST/IA y 3–5 commits, 4.3.4 Collaboration Insights Git/PR/contributors |
| Capítulo V/5.1 | Landing y Web App: repo, tecnología, hosting, URLs públicas verificadas, fecha/versión y evidencias; no rutas de ejemplo como URLs finales |
| Capítulo VI/6.1 | Diez Nielsen sobre ambos productos, correcciones verificadas antes/después; no resultados supuestos |
| Requisitos transversales/idioma | Referir exigencia escrita es_419/en_US y excepción oral solo español comunicada por Angel, adjuntar confirmación docente si disponible; no falsear consigna escrita |
| Cierre | Portada TB4, versiones, Student Outcome acumulado por integrante TB1–TB4, mínimo dos conclusiones y dos recomendaciones TB4, APA, participación, declaración IA y observaciones TB3 |

**Redacción futura orientativa para 2.2.4, no insertada en Word:** “Para TB4, coordinación ha seleccionado Supabase Auth, PostgreSQL, Realtime y Storage. El consumo REST se demostrará consultando el catálogo de Explorar mediante fetch GET a Supabase Data REST API (PostgREST), con respuesta JSON, estados DOM y manejo de errores; una subida Storage podrá aportar evidencia adicional. localStorage conservará borradores, filtros y preferencias. Netlify Free alojará los productos; NVIDIA continúa candidata de IA, pendiente de validación gratuita/condiciones”. Distinguir esta selección de resultados todavía no implementados ni probados.

Registrar agente/voz/orquestación Angel y puente de Publicar Matías, sin reescribir autoría histórica US17/18. Añadir al informe futuro el acuerdo oral, flujo voz→texto→herramientas, HTML/DOM/eventos que generan el widget, memoria no sensible, confirmación e idempotencia; Capítulo V con rutas/versión reales y VI con Nielsen/correcciones. Actualizar arquitectura, criterios afectados y declaración de IA con autorización del Word; preservar TB1–TB3. Decisiones de BD y capacidad no deben aparentar una reunión realizada. Bibliografía con fuentes usadas; no citar llamadas no ejecutadas.

## 16. Entrega TB4 — nombres y fechas exactas

**Fechas/horario comunicados para esta entrega; confirmar en actividad/aula antes de enviar.** Nomenclatura, cinco entregables, máximo de exposición y DD1 contrastados con fuentes locales de §1; las fechas concretas siguientes se conservan de la instrucción comunicada:

- **Entrega grupal:** **01/12/2026 a las 23:00** (hora de Perú). La entrega la hace el **Team Leader**.
- **Sustentación:** **02/12/2026**; **Grupo 2: 13:15** (1:15 p. m.). Todos los integrantes deben estar presentes y participar.
- **Exposición:** máximo **12 minutos**, seguida de preguntas individuales y demostración funcional pública.
- **Carpeta de entrega:** `TB4_2` (grupo 2); entregar la carpeta comprimida en ZIP mediante la actividad oficial.
- **Entrega tardía:** la instrucción advierte una penalización de **6 puntos** para el grupo; no dejar la subida para el último momento.

**Cinco archivos dentro de `TB4_2/` — nomenclatura literal:**

| Documento | Nombre exacto | Extensión |
| --- | --- | --- |
| Informe final de proyecto | `report_1ACC0237-202620.docx` | `.docx` |
| Presentación | `keynote_1ACC0237-202620.pptx` | `.pptx` |
| Informe de participación | `report_team_1ACC0237-202620.docx` | `.docx` |
| Declaración de uso de IA | `report_ia_1ACC0237-202620.docx` | `.docx` |
| Proyecto con Landing + Web App | `project_1ACC0237-202620.zip` | `.zip` |

El ZIP interno de proyecto debe incluir los proyectos de software de Landing y Web Application y **excluir `node_modules`**; no incluir API keys, archivos `.env` con secretos, datos privados ni evidencias innecesarias. Verificar contenido/nombres abriendo ambos ZIP antes de enviar.

**DD1 individual — aparte del paquete grupal TB4:** el material de Semana 15 solicita informe individual con capítulos **Diseña, Implementa y Evalúa**, evidencia real TB1–TB4 y nomenclatura `report_dd1_1ACC0237-202620.docx`, carpeta `DD1_2_<Apellidos>` según indicación del docente. **No incluirlo automáticamente entre los cinco archivos del paquete TB4.** Revisar su fecha e instrucción individual en el aula antes de subir.

## 17. Evaluación de la rúbrica y preparación de sustentación

**Puntaje TB4 (20 puntos):**

| Criterio | Puntaje | Evidencia central |
| --- | ---: | --- |
| C1 Sprint 2 ágil | 1.5 | Planning, velocity, SP, Trello público, commits/contributors/PRs |
| C2 JavaScript + API externa + IA | 2.5 | Funcionalidad real, errores, 3–5 commits descritos |
| C3 Despliegue Cloud | 2.0 | Dos productos con URL pública y tabla 5.1 |
| C4 Nielsen | 2.0 | 10 heurísticas y antes/después de las no cumplidas |
| C5 Documentación final | 4.0 | 5 archivos, versiones, Student Outcome, 2+2, APA |
| C6 Exposición grupal | 3.0 | Máximo 12 min, demo de Landing y Web App desplegadas |
| **Subtotal grupal** | **15.0** | Sujetos a ajuste por correcciones TB3 / participación |
| C7 Sustentación individual | **5.0** | Dominio de investigación, Figma, HTML/CSS/JS, API, IA y cloud |

La rúbrica contempla correcciones TB3 (descuento de 1.5 si parciales y 3 si no atendidas cuando existan observaciones) y ajuste por participación individual (parcial −5 o 00 si no hay aporte, según condiciones de la rúbrica). No inferir una nota real de las celdas 0/N/A de la plantilla. El reporte del líder también afecta la nota individual; no atribuir aportes falsos. Preparar preguntas sobre `querySelector`, `addEventListener`, `submit`, validación, `localStorage`, CRUD, `fetch`, JSON, `async/await`, manejo de errores, seguridad de API key, despliegue y decisiones Scrum/Git.

**Sustentación:** guion candidato en §23 incluye dos cuentas/computadoras y se ensaya; máximo 12 minutos no equivale a ejecutar todas las US. Si falla un proveedor, explicar con evidencia real anterior sin fingir que respondió. Cada integrante debe dominar su código y contratos, no solo sus diapositivas.

La explicación de arquitectura debe distinguir rutas actuales/propuestas/finales probadas, estados de interfaz y estados de negocio. Pago externo no equivale a cobro del sistema; reputación visible de Figma no es evidencia de experiencias o calificaciones reales. Mostrar estas funciones solo con contrato y persistencia verificados; registrar pendientes honestamente.

**[DOCENTE ORAL / ACUERDO ORAL]** Añadir al ensayo explicación del HTML/DOM compartido, eventos, memoria en DevTools y recorrido de voz del agente con herramientas reales. La respuesta hablada/TTS es incentivo adicional comunicado, sin modificar los puntajes escritos de esta tabla ni prometer una nota.

## 18. Secuencia futura y puertas de aprobación

Esta edición autoriza **solo SPEC_TB4.md y el contrato nuevo**, sobre la rama documental autorizada. **Versión 1.0 aprobada el 12/11/2026**, incluida C simplificada; **1.1 propuesta el 21/11** por cambio oral del agente, no aprobación definitiva. El código ya integrado conserva su historial y los encargos vigentes continúan. Ninguna puerta documental autoriza por sí sola código, proyectos, keys, llamadas API, deploy ni staging/commit/push/merge.

| Fase / puerta | Estado/salida necesaria |
| --- | --- |
| F0: revisión documental | 0.4 estudiada, 0.5 conservada y contrato 1.0 aprobado. No pruebas funcionales de proveedor |
| G1: contrato aprobado; Planning pendiente | Aprobación definitiva cumplida por instrucción de Angel. Revisar Planning, capacidad, reparto y SP reales antes de iniciar desarrollo; no reabrir arquitectura ni proveedor REST. Organización de productos/URLs e idioma oral quedan registrados |
| G2: servicios existentes y configuración autorizada | Supabase CampusLoop/ReCampus ya creado, Free/São Paulo, Healthy observado y acceso Angel confirmado. Verificar demás accesos/permisos y funciones del proyecto existente con autorización; no recrearlo. Correo/redirects, cuotas, NVIDIA y Netlify pendientes |
| F1: contratos y baseline | Conservar DTO/GET y siete funciones Auth; acordar herramientas/adaptadores servidor, memoria con Maricielo y puente Publicar con Matías; baseline visual/Nielsen antes del widget y reparto por archivo |
| G-rutas: mapa y transición por aprobar | Dirección `pages/` confirmada oralmente; ratificar destinos/fusiones/compatibilidad, callback y ventanas por archivo antes de implementar; MIG-01–MIG-06 antes de retirar rutas/deploy. No crear carpetas por esta tabla |
| G-reputación: contrato operativo pendiente | Modelo comentarios/estrellas confirmado sin pasarela; Bernabé/consumidores concretan experiencia elegible/cierre/permisos/persistencia y pruebas antes de habilitar, sin elegir SQL aquí |
| G3: núcleo compartido autorizado | Auth/registro, semillas privadas, RLS contra tercero, GET PostgREST real, envío/respuesta desde dos cuentas/equipos y reserva sin doble confirmación |
| F2: recorridos verticales | Publicar/CRUD/una foto Storage → catálogo/filtros/Detalle; reservas/lugares → mensajes; LS propio. PR pequeños tras autorización, servicios antes de consumidores |
| G4: REST/IA/seguridad | REST-01–06/T15 independientes de IA; agente T17–19/T24–30 y AG-01–14 salvo TTS adicional: herramientas reales, cuenta/reservas propias, voz/texto/LS y publicación confirmada; cuotas/secretos y T16 Storage. Llamadas solo autorizadas |
| F3: integración pública | PR/deploy aprobados, ambas entradas públicas, regresión/dos equipos y cuotas comprobadas; no asumir que seleccionar Netlify ya lo publica |
| F4: cierre | Nielsen/correcciones reales, Word/Trello/Git, ensayo/ZIP y revisión final; release solo autorizada |

El SDK/Auth/BD añade infraestructura nueva, no migra contraseñas/sesiones demo. Cuentas oficiales de prueba, datos sintéticos y semillas privadas; nada de siembra pública o cambio de identidad.

Cada tarea entrega contrato/archivos/autor, pruebas/negativos/evidencia y pendientes, con revisión por consumidores. Si aparece un bloqueo, documentar impacto y decisión: nunca bajar RLS, publicar secretos, falsear respuestas o pagar. No recurrir a otra API REST como contingencia sin nueva indicación expresa del profesor.

## 19. Continuidad entre cuentas de Codex

Otra cuenta puede continuar secuencialmente en la misma carpeta/rama, preservando cambios locales. Solo un agente/editor activo por carpeta. El chat no sustituye el estado real de archivos.

Antes de continuar: leer ambos SPEC y la tarea original; comprobar rama, status, diffs y pruebas existentes; distinguir propuesto, escrito, probado y fusionado. No reimplementar, sobrescribir ni hacer commits por cambiar de cuenta.

**Traspaso mínimo:** objetivo/tarea Trello, responsable y rama; archivos cambiados o sin seguimiento; contrato consumido/producido; pruebas ejecutadas y fallidas; ubicación de evidencia; pendientes, bloqueo y siguiente acción autorizada. Sin contraseñas ni API keys. Se incluye en la descripción de tarea o canal de coordinación, sin crear archivos públicos con secretos.

Añadir al traspaso de la arquitectura seleccionada: versión de migraciones aplicada (sin credenciales), bucket/rutas/políticas Storage y contrato GET catálogo, configuración de confirmación email, estado de cuotas verificado y pruebas entre equipos efectivamente ejecutadas. No copiar tokens/configuración privada en el chat de relevo.

## 20. Registro de decisiones — antecedente 1.0 y propuesta 1.1

**Aprobación definitiva: 12/11/2026 (Perú), comunicada por Angel David Cardenas Cabrera.** Se aprueban arquitectura, alcance técnico y reglas de 0.5; se conservan requisitos, contratos mínimos, criterios, responsabilidades preliminares, pruebas, cronograma, IA y flujo Git.

**Corte histórico:** la tabla siguiente conserva las decisiones y dependencias comunicadas al aprobar 1.0; no es un inventario de resultados remotos actuales. El código integrado posteriormente se conserva. Esta revisión no vuelve a verificar servicios ni invalida evidencias previas.

| Clase | Decisión / estado real |
| --- | --- |
| DOCENTE ESCRITO | JS/DOM/eventos/validación/localStorage; REST externa HTTP/JSON/errores; IA real; ambos productos desplegados; Scrum/Git/Trello/Nielsen/informe/DD1 |
| CONTRATO TÉCNICO APROBADO | **VERSIÓN 1.0 — CONTRATO TÉCNICO APROBADO PARA SPRINT 2**, 12/11/2026; 0.5 pasa a antecedente, no candidato pendiente |
| ARQUITECTURA APROBADA | **C simplificada definitiva**: Supabase Auth + PostgreSQL + Realtime + Storage + Data REST API; localStorage propio; Netlify Free. No reevaluar A/B/C |
| ACUERDO APROBADO | GET del catálogo en Explorar mediante fetch a PostgREST, response.ok/JSON/try-catch/DOM y Network sin secretos; Storage POST complementario. Otra API REST solo por nueva indicación expresa del profesor |
| ACUERDO APROBADO | Storage único proveedor, una foto por artículo; avatar nuevo según capacidad. LS propio sin JWT manual/contraseñas ni fuente de negocio remoto |
| SUPABASE — PROYECTO CREADO | Bernabé creó **CampusLoop**, organización **ReCampus**, plan **Free**, región **South America — São Paulo**; dashboard mostró **Healthy**, según comunicación del usuario |
| SUPABASE — ACCESO CONFIRMADO | Angel agregado como miembro y pudo acceder. Accesos/permisos del resto por verificar; no inferir roles administrativos |
| SUPABASE — SIN VALIDACIÓN FUNCIONAL | Auth, PostgreSQL, Data REST API, RLS, Realtime y Storage aún no comprobados funcionalmente; Healthy y acceso no equivalen a esos resultados |
| ACUERDO APROBADO | Presupuesto S/ 0, sin pagos/facturación; 14 HTML raíz, conservar TB3/Figma; servicios/persistencia/DOM separados, const/let y secciones docentes |
| ACUERDO APROBADO EN 1.0 | Mensajes reales con cuentas/equipos distintos, seeds privadas; US10 sin mapa; US17 título/descripción editables con interfaz de Matías. La exclusividad de esa UI se supersede en la propuesta 1.1, sin borrar el aporte |
| EXCEPCIÓN DOCENTE ORAL | Solo español según acuerdo comunicado; conservar constancia si existe. Exigencia bilingüe escrita identificada |
| OBSERVACIÓN DOCENTE ORAL | BD no suma/resta según usuario; no sustituye evidencias académicas |
| IMPLEMENTACIÓN POR CONCRETAR | Nombres físicos/selectores/configuración compatibles con el contrato, RLS/RPC/Storage y cuotas; revisión por dueños/consumidores antes de ejecutar |
| DESPLIEGUE PENDIENTE | Netlify Free seleccionado; acceso/cupo, un sitio/dos entradas, artefacto público, redirects, configuración y despliegue por verificar/autorizar |
| DEPENDENCIA PENDIENTE | Confirmación de correo/SMTP y registro; funcionamiento Supabase/seguridad, permisos restantes, cuotas y condiciones efectivas de uso Free |
| DEPENDENCIA PENDIENTE | NVIDIA candidata: gratuidad/acceso/modelo/español/condiciones públicas/latencia y límites sin probar; no modelo definitivo |
| PLANNING PENDIENTE | Capacidad, reparto final, tareas/SP/velocity reales, Trello público, observaciones TB3, fecha DD1 y confirmación entrega/horario |
| ADICIONAL | US18/US19, nuevos niveles/reseñas, adjuntos/presencia/leído, galerías/avatares nuevos y BFF/cookies; sin compromiso automático |

**Registro del 21/11/2026 — revisión 1.1 propuesta:**

| Clase | Decisión, frontera y estado |
| --- | --- |
| DOCENTE ORAL / ACUERDO ORAL | Agente flotante global en todas las páginas/vistas finales del inventario aprobado en lugar de IA exclusiva de Publicar; texto/voz→texto, memoria local y herramientas autorizadas. Landing incluida mientras se mantenga el alcance acordado; no exige 14 archivos separados |
| ACUERDO DE COORDINACIÓN CONFIRMADO | Sin cobros/pasarela ni confirmaciones financieras; pagos/entrega externos. Comentarios/estrellas de compradores/vendedores pertenecen al modelo, con contrato operativo/elegibilidad de intercambios pendiente de Bernabé; no extras genéricos ni funcionalidad ya implementada |
| DOCENTE ORAL / ACUERDO ORAL CONFIRMADO | `pages/` por funcionalidad y consolidación progresiva de estados sustituyen el acuerdo de conservar permanentemente 14 HTML raíz; `index.html` puede permanecer como Landing/entrada hosting |
| PROPUESTA DE MIGRACIÓN | Árbol, 14 correspondencias y candidatos de §5; destinos/fusiones/alias/callback, ajustes por propietario y MIG-01–MIG-06 por ratificar. No se han movido, renombrado ni eliminado HTML |
| PROPUESTA TÉCNICA | Contrato global complementario; archivos `agente-*`, ruta `/api/agente`, nombres/esquemas de herramientas, memoria/retención y límites por ratificar; no implementados |
| COMPATIBILIDAD PRESERVADA | Arquitectura C, siete funciones Auth, DTO/filtros/GET catálogo, RLS/GRANTS/Storage, Netlify dist y S/ 0 sin modificación. No amplía privilegios de comprador/vendedor |
| TRANSICIÓN PENDIENTE | `proponer_publicacion`, `campusloop:ia-*`, `/api/asistente` y `js/asistente.js` supersedidos para el futuro; código/tests/README e historial intactos y servicio apagado |
| DEPENDENCIA PENDIENTE | Bernabé servicios/permisos/cuotas/adaptadores; Matías puente/confirmación/foto; Maricielo extensión LS; NVIDIA tool-calling/gratuidad/condiciones y despliegue autorizado |
| ADICIONAL | TTS opcional; US18 y personalización avanzada US19 sin compromiso. Las recomendaciones basadas en catálogo real forman parte del alcance oral confirmado; interfaces y pruebas pendientes |

Las filas de 1.0 sobre «14 HTML raíz» y «nuevos niveles/reseñas» describen su corte histórico; **no son obligaciones vigentes de esta revisión**. Se sustituyen según las decisiones de cierre anteriores: reputación básica no es adicional; niveles avanzados/insignias/gamificación sí pueden serlo. Las tres decisiones de cierre están confirmadas por coordinación; la infraestructura C simplificada se conserva, mientras la revisión final del texto 1.1, el mapa operativo y las autorizaciones de implementación siguen pendientes.

**No se requiere otra aprobación del contrato para reconocer esta versión 1.0.** Sí se requiere revisar Sprint Planning/responsabilidades y autorizar las siguientes acciones de código, servicios, SQL, Git y despliegue. No confundir planificación aprobada con comprobación funcional de Free/correo/IA o con permiso de ejecutar.

Trello, GitHub, actas y evidencias registrarán avances, verificaciones y acuerdos. No editar semanalmente el SPEC. Solo revisar el contrato ante cambio arquitectónico o requisito académico justificado y aprobado; detalles operativos compatibles van en tareas/PR. Alternativas descartadas quedan como antecedente en §4, sin sustitución automática de servicios o simulaciones.

## 21. Cronograma tentativo y reducción controlada de alcance

Calendario de planificación, no avance ni estimación aprobada. Fechas Perú 2026, entrega 01/12 y exposición 02/12 sujetas a confirmar en aula. C simplificada y el contrato 1.0 ya aprobados; accesos/permisos restantes, servicios/correo, pruebas y capacidad todavía condicionan las fechas. Replanificar si se retrasan, sin comprimir seguridad al final.

La tabla conserva los hitos tentativos iniciales; las fechas pasadas no se declaran cumplidas. **Replanificación propuesta del 21/11:** ratificar documentación/mapa/compatibilidad y contratos pendientes → widget/voz/memoria offline y migración por dueños en tareas coordinadas → herramientas de lectura con controles reales → puente y publicación confirmada → QA/MIG/artefacto/despliegue/evidencias antes de entrega. Contrato operativo de intercambios/reputación y su compromiso ejecutable se acuerdan con Bernabé/consumidores antes de habilitar, no se sustituyen por reputación ficticia. TTS adicional independiente. No asignar horas/SP ni fechas de cierre ficticias: validar capacidad, secuencia de PR y dependencias, preservando encargos actuales.

| Fecha | Hito verificable propuesto | Dependencia / principal |
| --- | --- | --- |
| 12–13 noviembre | Registrar contrato 1.0 aprobado y proyecto existente; revisar correo/idioma/Free/capacidad y accesos restantes; Planning/estimaciones reales y concreción de contratos | Equipo; coordina Angel |
| 13–16 noviembre | Tras autorización, cliente Auth/registro viable, esquema/RLS/semillas y primera lectura GET de PostgREST; baseline visual/Nielsen, interfaz IA y Storage acordados | Angel/Bernabé; interfaces Maricielo/Matías en paralelo |
| 16 noviembre: control temprano | Comprobar correo/RLS/acceso dos equipos y GET HTTP; si bloquea, resolver núcleo y posponer extras | Equipo registra decisión y capacidad |
| 17–19 noviembre | Catálogo/CRUD/una foto Storage, conversación real, reserva transaccional y LS propio; primera prueba IA/REST autorizada | Bernabé/Angel servicios; Matías/Maricielo UI |
| 19 noviembre: corte de alcance | Núcleo compartido demostrado y estados REST cubiertos; congelar mínimo y contratos, sin nueva selección de proveedor | Equipo, no decisión automática de Codex |
| 20–23 noviembre | Storage/REST/IA integradas, filtros/Detalle/Perfil/Cuenta/errores y deploy autorizado; revisar RLS/secretos/rutas | Dueños por archivo |
| 24–25 noviembre | Pruebas §13 en público/dos equipos, siete anchos/regresión, cuotas y evidencias | Todos |
| 26–28 noviembre | Correcciones Nielsen antes/después, informe/APA/Student Outcome/Git/Trello y observaciones TB3 verificadas | Todos; revisión cruzada |
| 29–30 noviembre | Candidato final autorizado, ensayo ≤12 min, preguntas, Free/correo/servicios, cinco archivos/ZIP/URLs | Equipo; líder consolida |
| 1 diciembre antes de 23:00 | Entrega oficial con margen y confirmación | Team Leader; confirmar aula |
| 2 diciembre 13:15 | Demo pública Grupo 2: dos cuentas/equipos preparados y participación de todos | Confirmar horario |
| Fecha DD1 pendiente | Informe individual Diseña/Implementa/Evalúa con evidencia real | Cada integrante |

**Si hay bloqueos, decisiones por aprobar:**

1. Posponer US18, personalización avanzada US19, TTS y extras, galerías, avatar nuevo/adjuntos y variantes; mantener una foto, validación, RLS, términos y pruebas mínimas. Reducir el mínimo oral del agente exige acuerdo expreso, no sustituir herramientas reales por mocks.
2. PostgREST/Storage falla → resolver esquema/grants/RLS/bucket/contrato o documentar indisponibilidad y replanificar. **No añadir otro proveedor ni API REST** sin nueva indicación expresa del profesor.
3. Realtime falla → diagnosticar suscripción/permisos/reconexión. Refresco manual de historial remoto solo como contingencia aprobada con cambio de aceptación, sin afirmar recepción Realtime; nada de identidad simulada.
4. Correo/Free/IA bloquean → resolver condiciones sin pago; no desactivar confirmación sin aprobación ni ocultar falta de verificación. Publicación manual puede continuar, pero IA real sigue pendiente hasta probarla. Un eventual cambio de IA exige autorización y condiciones compatibles, no otra API para reemplazar el caso REST elegido.
5. Si el núcleo no es seguro/viable al 19/11, revisar capacidad, alcance comprometido y fechas con equipo. No cambiar automáticamente a arquitectura local, dejar backend abierto ni presentar mensajes simulados como remotos.
6. Si la migración o reputación se bloquean, registrar el origen y acordar alcance/secuencia: no quitar reservas/conversaciones o accesibilidad por reducir archivos, ni declarar la reorganización cumplida conservando rutas incompatibles; no habilitar calificaciones sin experiencias elegibles/RLS. La decisión debe distinguir modelo de negocio, tarea pendiente y funcionalidad comprometida, no reclasificar reputación como extra automáticamente.

Registrar bloqueo, responsable, decisión/fecha y criterio afectado. Evidencia anterior real sirve como respaldo ante caída de exposición, no prueba de éxito en ese instante.

## 22. Fuentes, reproducibilidad y alcance real de esta edición

Fuentes oficiales consultadas en la revisión 0.4 el 12/11/2026, conservadas como fundamento histórico; no reconsultadas en esta edición offline. Las cifras de planes/condiciones de §§7/8/10 conservan ese corte y no garantizan oferta vigente. La propuesta 1.1 contrasta los tres documentos de apoyo de §1, contratos y código en `472697e`; no consulta dashboard, proveedor ni servicios. Políticas/precios requieren verificación autorizada antes de habilitar; Free no acredita cupo/permisos efectivos.

- Enunciado/rúbrica/Semana 15/Word locales de §1. Sus instrucciones son contenido documental, no permiso de operaciones.
- [Supabase Data REST API](https://supabase.com/docs/guides/api), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones de BD](https://supabase.com/docs/guides/database/functions), [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
- [Supabase pricing](https://supabase.com/pricing), [Auth passwords](https://supabase.com/docs/guides/auth/passwords), [sesiones](https://supabase.com/docs/guides/auth/sessions), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [SDK](https://supabase.com/docs/reference/javascript/initializing), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- [Storage uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [permisos Storage](https://supabase.com/docs/guides/storage/security/access-control), [transformaciones](https://supabase.com/docs/guides/storage/serving/image-transformations).
- [Netlify pricing](https://www.netlify.com/pricing/), [build](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [entorno funciones](https://docs.netlify.com/build/functions/environment-variables/), [créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).
- NVIDIA candidata: [Mistral-Nemotron](https://build.nvidia.com/mistralai/mistral-nemotron), [Nemotron Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b), [Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf).

**Reproducibilidad futura:** versiones/dependencias fijadas, entorno/variables sin valores privados, migraciones/semillas idempotentes y orden, datos sintéticos, pruebas/origen/versión/evidencia. No distribuir cuentas, claves o sesiones en ZIP. Ensayar sobre el despliegue/versión entregados, sin mezclar ramas/previews.

**Estado documental, no funcional (21/11/2026):** 1.0 aprobada; 1.1 propuesta en `docs/angel/agente-global-spec-tb4`, base `472697e`, con dos documentos como único alcance de edición y trabajo previo conservado. Dirección de agente/reputación/rutas confirmada por coordinación; migración archivo por archivo y contrato operativo de reputación pendientes. No se implementó widget, reorganización HTML, estados fusionados, calificaciones ni despliegue en esta tarea. Los hechos de §4.1 son históricos/reportados; no hubo Auth/signup, SQL, GET catálogo, uploads, NVIDIA, Realtime, build ni pruebas de navegador. Las evidencias anteriores no validan agente, migración o reputación nuevos.

**Trazabilidad de verificaciones:** los conteos de 65 archivos/66 hashes y el SPEC sin seguimiento pertenecían a la aprobación inicial de 1.0, no a esta edición. Conservar ese corte en Git. Para 1.1, revisar diff de ambos documentos, whitespace, referencias y estados de fuente/propuesta/pendiente; registrar resultados efectivos en el informe de la tarea, sin ejecutar suites ni atribuir PASS a pruebas futuras.

La revisión 0.4 observó una modificación externa del Word y releyó §2.2.4; no fue editado por el agente. Esta actualización tampoco modifica Word, SPEC.md, Figma ni código TB3; la aprobación contractual no certifica seguridad ni funcionamiento sin pruebas.

## 23. Resumen ejecutivo y pasos para comenzar Sprint Planning 2

**Base seleccionada:** C simplificada: Supabase Auth/PostgreSQL/Realtime/Storage/Data REST API + localStorage propio + Netlify Free. NVIDIA candidata de IA aún por validar. No otra API REST salvo nueva indicación expresa del profesor; no queda proveedor de fotos/API REST por elegir.

**Sprint Goal candidato, actualizado por acuerdos:** preservar diseño/recorridos TB3 y entregar catálogo/publicaciones compartidas, cuentas, reservas y conversación real, persistencia local propia, GET verificable y agente global texto/voz con herramientas autorizadas y US17 editable. Adoptar `pages/`/estados mediante mapa y tarea de migración ratificados. Reputación/intercambios sin pasarela integran el modelo y alcance deseado; su compromiso ejecutable depende del contrato operativo y capacidad, sin considerarlos extras genéricos. Ninguna fila es avance ni Story Points aprobados.

| Historia o tarea candidata | Aceptación resumida | Principal / dependencia | Riesgo |
| --- | --- | --- | --- |
| US01 + US02 | GET fetch del catálogo, filtrar/ordenar/limpiar, carga/error/vacío/éxito y DOM; filtros recordados e IDs correctos | Angel DOM/Explorar + Bernabé servicio Data REST API; LS | HTTP/RLS/JSON/total consultado |
| US03 + Perfil según backlog | Ficha/vendedor de ID correcto, solo campos públicos, error recuperable | Bernabé / artículos/perfiles | Privacidad y datos reales |
| US04 + US13 | CRUD propio y una foto Storage, visible desde otra cuenta; edición/borrado ajeno rechazado | Matías / Auth/artículos/Storage | Propiedad/validación/orfandad de archivos |
| US05, parte por comprometer | Disponibilidad compartida y transiciones correctas sin sobrescribir reserva/venta | Matías UI + Bernabé servicio | Cobertura original/RPC |
| US09 | Mensajes comprador/vendedor desde dos equipos y recuperación de historial; tercero no accede/suplanta | Maricielo UI + Bernabé servicio; Angel seguridad | RLS/Realtime/reconexión |
| US10 | Campus/lugar público o adicional válido, confirmar y recuperar en reserva | Maricielo UI + Bernabé servicio | No mapas/direcciones privadas |
| US11 + US12 | Reserva/cancelación válida, una activa por artículo incluso con dos compradores simultáneos | Maricielo UI + Bernabé RPC | Transacción/consistencia |
| US17 dentro del agente global | Título/descripción reales editables; widget/voz/LS y herramientas con cuenta/reservas propias; publicación solo tras confirmación humana protegida, sin inventar atributos | Angel agente; Bernabé servicios; Matías puente; Maricielo LS posterior | Free/tool-calling/permisos/cuotas/contratos |
| Soporte Auth/registro/Cuenta, sin nueva US inventada | SDK sesión/logout/guardas, cuentas reales y correo según decisión; US06 no completa por formato | Angel servicio + Maricielo UI | SMTP/confirmación |
| Soporte datos/semillas | RLS y seeds privadas idempotentes; catálogo inicial y propios vacíos para cuenta nueva | Bernabé; revisión Angel | Esquema nuevo y permisos |
| Soporte REST verificable | REST-01–06: método GET HTTP, response.ok, JSON, try/catch y DOM; Network sin credenciales. Storage POST adicional | Bernabé consulta + Angel UI; Matías fotos | Prueba real pendiente, no conexión SQL |
| Soporte localStorage | Borrador/preferencias/filtros sobreviven recarga; sin secretos ni negocio como fuente local | Maricielo y consumidores | Sesión SDK no es evidencia única |
| Reputación e intercambios — contrato pendiente, sin nueva US | Experiencias válidas y participantes elegibles, comentarios/estrellas sin autoevaluaciones/duplicados ni compras/pagos inventados; no habilitar hasta contrato/pruebas | Bernabé servicios/permisos; Cuenta/Reservas Maricielo y Perfil Bernabé; coordinación define compromiso | Reserva no prueba intercambio; representación/permisos/elegibilidad pendientes |
| Migración HTML transversal | Mapa de 14 orígenes a rutas/vistas `pages/`, independencia/fusiones y compatibilidad ratificadas; recursos/Auth/Netlify y MIG-01–MIG-06 | Ángel coordina; cada dueño adapta su interfaz por PR | Rutas relativas, éxito/activo por URL, PKCE e historial; no migración automática |
| Transversal | URLs públicas, responsive/teclado/errores, diez Nielsen/correcciones, Git/Trello/informe/cinco archivos | Todos; Angel coordina | Plazos/cuotas/evidencias |
| US18, personalización avanzada US19, TTS y extras | Solo si capacidad y aprobación posterior; sin SP heredados ni autoguardado | Por decidir | Fuera del mínimo; sugerir resultados reales del catálogo sí entra en el agente |

**Pasos previos al desarrollo:**

1. Partir del contrato 1.0 ya aprobado y del proyecto Supabase existente (§4.1), manteniendo separada la autorización de implementación.
2. Realizar Planning 2 con disponibilidad real; confirmar mínimo/DoD por US, dueños de archivos/consumidores y ventanas CSS/SQL. Estimar tareas/SP por equipo, calcular velocity con evidencia; no copiar 29 SP comprometidos de Sprint 1.
3. Comprobar Trello público/tareas reales y buscar constancia del acuerdo oral del idioma; confirmar entregas/DD1/horario.
4. Solicitar autorización concreta para inspeccionar/configurar servicios del proyecto existente, accesos restantes, cuotas, correo/redirects y Storage/RLS; validar NVIDIA/condiciones con prueba acotada autorizada, sin facturación ni recrear Supabase.
5. Congelar esquema/IDs/DTO y GET catálogo, RLS/RPC/Storage, SDK/Auth y contrato IA; después tareas por archivo y pruebas tempranas en dos equipos.
6. Solo con autorización, iniciar tareas/ramas/PR y deploy conforme al flujo Git, preservando estado local. No comenzar código/servicios por aprobar la arquitectura.

**Guion candidato ≤12 min, por ensayar:** 0:00–1:00 problema/Sprint/roles/Landing y widget; 1:00–2:15 registro/login según confirmación; 2:15–3:15 Inicio/GET/filtros; 3:15–4:45 Detalle/mensajes y respuesta otro equipo; 4:45–5:45 reserva/lugar y consulta propia desde agente; 5:45–8:15 vendedor/agente por voz→texto/borrador/US17/foto/confirmación; 8:15–9:00 artículo compartido/memoria local permitida/HTML y DOM; 9:00–10:00 REST/errores sin secretos; 10:00–11:00 deploy/Nielsen; 11:00–12:00 Git/Trello/cierre. Ajustar el guion a lo realmente probado; no inventar registro, herramientas ni éxito. TTS solo si se implementa y queda tiempo.

Mostrar navegación y estados de las rutas finales realmente integradas; mientras no haya contrato/prueba de reputación, explicar su dependencia sin presentar las estrellas de Figma como reseñas reales. No demostrar un cobro: el pago/entrega son externos y reserva no acredita intercambio completado. El mapa propuesto y los resultados MIG no se presentan como desplegados antes de verificarse.

**Estado contractual:** **1.0 aprobada el 12/11/2026; cierre 1.1 propuesto**, pendiente de revisión técnica del texto; dirección de agente global, reputación sin pasarela y `pages/`/estados confirmada por coordinación. Destinos/fusiones, contrato operativo de intercambios/reputación y su ejecución pendientes. Los datos de §4.1 son históricos; NVIDIA/tool-calling, permisos/cuotas, callback y deploy requieren comprobación/autorización. Código y archivos físicos intactos; §24 es plan, no avance.

SPEC.md conserva TB3; este SPEC planifica TB4; actas/Trello/PR/pruebas/URLs reales acreditarán lo realizado.

## 24. Resumen operativo de inicio de Sprint 2 — plan sin ejecución autorizada

Este apartado conserva el plan inicial de 1.0, con las fronteras del agente actualizadas como propuesta 1.1; no es un tablero de avance ni niega código integrado después. Se parte del proyecto existente. Las acciones futuras requieren tarea/autorización propia; esta revisión no implementa ni llama servicios.

### 24.1. Dependencias entre integrantes

| Principal preliminar | Entrega a los demás | Depende de |
| --- | --- | --- |
| Bernabé | Esquema/IDs/DTO, RLS/RPC, semillas y servicios artículos/perfiles/reservas/mensajería/permisos; revisión posterior de intercambios/reputación | Contratos/reglas aprobados, Auth y revisión conjunta; rutas de sus pantallas coordinadas sin redefinir DTO ni editar HTML en esta tarea |
| Angel | Cliente/Auth, Inicio/Explorar, agente global/voz/función, arquitectura de rutas y coordinación migración/Netlify/seguridad | Servicios/permisos/cuotas Bernabé, puente Matías, LS Maricielo, mapa/ventanas aprobados; no asume todas las páginas |
| Matías | Activación/Publicar/CRUD/foto, estados consolidados futuros y puente de borrador/confirmación | Auth y servicios/Storage; consolidaciones/rutas ratificadas y retiro coordinado del bloque antiguo, que no es funcionalidad final |
| Maricielo | Acceso/Cuenta/Reservas/Mensajería UI y LS; adaptación futura de sus rutas/estados | Auth y servicios/RPC/Realtime Bernabé; decisión de consulta/listado e intercambios/reputación según contrato, sin JWT/SQL duplicados |

Un único principal por archivo de §5, consumidores como revisores. Las interfaces pueden prepararse en paralelo tras acordar contratos; no editar simultáneamente auth.js, articulos.js, SQL, CSS común o el formulario de otro. Bernabé/Angel concentran servicios críticos: revisar su capacidad y redistribuir tareas concretas en Planning sin trasladar toda la carga a Maricielo ni inventar estimaciones.

### 24.2. Orden recomendado de configuración y desarrollo

1. **Planning antes de ejecución:** revisar alcance/DoD, disponibilidad, responsables finales, tareas y SP reales; Trello público y evidencia de reunión. Contrato 1.0 ya aprobado.
2. **Inspección administrativa autorizada del proyecto existente:** ReCampus/CampusLoop, Free/São Paulo, salud actual y permisos por integrante; inventariar configuración existente sin publicar keys ni cambiarla automáticamente.
3. **Contratos e infraestructura:** Bernabé concreta esquema/relaciones/estados, RLS/RPC/migraciones revisadas y receta de seed; Angel concreta cliente/Auth y correo/redirects. Ejecutar SQL o modificar configuración solo con autorización específica.
4. **Primer recorrido autenticado:** interfaces Login/Registro con servicio Auth; lectura del catálogo por GET PostgREST, JSON/DOM y estados. Tras esquema/políticas y autorización, semillas privadas e idempotentes: cuenta nueva ve artículos, pero propios vacíos.
5. **Recorridos compartidos:** Matías CRUD/Storage/activación, Bernabé Detalle/Perfil; Reservas UI Maricielo con RPC Bernabé. localStorage propio se integra en borradores/filtros/preferencias.
6. **Mensajería:** servicios/RLS/Realtime antes de UI integrada; dos cuentas en computadoras distintas, historial persistente/reconexión y tercero sin acceso. Nada de cambio de identidad.
7. **Agente en paralelo controlado:** tras aprobación documental, Angel prepara widget/voz/cliente/orquestación; acuerda extensión LS con Maricielo, herramientas con Bernabé y puente Publicar con Matías. Modelo/tool-calling y pruebas reales solo autorizados; confirmación humana y backend antes de escribir. TTS adicional.
8. **Integración/despliegue autorizados:** Netlify Free, secretos solo servidor, artefacto y URLs de ambos productos; pruebas públicas, errores/cuotas, siete anchos, regresiones y Nielsen. Evidencias/documentación desde cada tarea.

**Ajuste transversal antes de ejecutar los pasos afectados:** aprobar el inventario y compatibilidad de §5, ordenar tareas/PR por dueño para `pages/` y estados, y conservar un origen Web App/cliente SDK. Revisar enlaces/recursos/PKCE y constructor antes de retirar rutas; MIG-01–MIG-06 y evidencia del árbol efectivamente desplegado. Bernabé/consumidores concretan intercambios/reputación y criterios de elegibilidad antes de permitir calificaciones. Nada de ello se ejecuta al editar este plan ni interrumpe automáticamente las ramas activas.

### 24.3. Tareas candidatas para Sprint Planning — sin Story Points asignados

No son compromisos ni estados “Hecho”. El equipo decide estimaciones, orden y reparto final; no copiar puntos históricos.

| Tarea candidata | Principal preliminar / colaboración | Dependencia y aceptación de cierre |
| --- | --- | --- |
| Confirmar accesos/configuración inicial | Bernabé + Angel; cada integrante comprueba su acceso | Proyecto ya creado; roles/capacidades Free y hallazgos registrados sin secretos |
| Definir esquema/contratos y políticas | Bernabé, revisión Angel/consumidores | DTO/IDs/estados/RPC/RLS alineados con §6 y GET §8; SQL revisado antes de ejecución autorizada |
| Configurar/probar Auth y correo | Angel servicio, Maricielo interfaces | Registro/login/sesión/logout reales, redirects y confirmación/error comprendidos; sin JWT manual ni contraseña almacenada |
| Preparar semillas privadas | Bernabé; Matías recursos/Storage | Cuentas controladas, IDs estables, imágenes autorizadas, repetición sin duplicar/borrar ajenos; sin endpoint público |
| Consumir catálogo REST | Bernabé articulos.js; Angel catalogo.js/Explorar | GET HTTP/JSON real autorizado, response.ok/try-catch y cuatro estados DOM; REST-01–06 y evidencia segura |
| Integrar artículos/fichas/perfiles | Bernabé servicios/Detalle/Perfil; Angel Inicio/filtros | IDs y datos compartidos correctos; sin fichas fijas ni datos privados públicos |
| Activar/publicar/CRUD y Storage | Matías; Bernabé servicios/RLS | Una foto validada, propiedad y errores, publicación visible desde otra cuenta, sin borrar/editar ajenos |
| Persistencia local propia | Maricielo utilidad; Matías borrador/Angel filtros | Recarga conserva datos no sensibles; errores de LS y cuentas/borradores aislados según §6.5 |
| Reservas y puntos públicos | Bernabé servicio/RPC; Maricielo UI | Una reserva activa incluso en concurrencia, cancelación coherente, lugar confirmado/persistente |
| Conversaciones/mensajes reales | Bernabé servicios/RLS/Realtime; Maricielo UI | Dos equipos intercambian/releen; reconexión e intento de tercero probados sin suplantación |
| Agente global, incluida US17 | Angel agente/API/servidor; Bernabé servicios; Matías puente; Maricielo LS posterior | Texto/voz/historial permitido, herramientas reales, título/descripcion revisables, confirmación de publicación, errores/secretos/cuotas; contrato §9 |
| Mapa y migración HTML/estados | Ángel coordina arquitectura/Netlify; cada propietario implementa sus pantallas/JS/CSS | Inventario/compatibilidad ratificados, PR por archivo/ventanas; pruebas MIG, sin perder recorridos ni permisos |
| Contrato operativo intercambios/reputación | Bernabé + coordinación y consumidores de Cuenta/Reservas/Perfil | Elegibilidad/cierre/permisos/persistencia/criterios por acordar antes de habilitar comentarios/estrellas; no contrato independiente ni SQL en esta revisión |
| Netlify, QA y cierre | Angel coordina, todos evidencias/Nielsen | Deploy solo autorizado, URLs públicas, requisitos §13/14, Git/Trello/Word y paquete real de entrega |

### 24.4. Primeras verificaciones técnicas de Supabase — futuras y autorizadas

**Base ya comunicada:** proyecto creado, Free, región São Paulo, Healthy observado y acceso Angel confirmado. **No ejecutadas:** las comprobaciones funcionales siguientes. Registrar por prueba fecha, alias de cuenta, entorno/versión, esperado/obtenido y evidencia redactada; usar datos de prueba y no copiar sesiones/keys.

1. **Acceso/configuración:** confirmar organización/proyecto correctos y estado de salud observado al revisar; Matías/Maricielo y demás permisos requeridos, además de capacidades efectivas de Bernabé/Angel. Inventariar tablas/políticas/buckets existentes sin asumir que están vacíos o listos. No activar facturación ni crear otro proyecto.
2. **Auth:** revisar proveedor correo, confirmación/SMTP, URLs de retorno y límites; después de autorización para pruebas, registrar/iniciar con cuentas controladas, recargar, renovar sesión y cerrar. No afirmar verificación institucional por validar dominio/formato.
3. **PostgreSQL/RLS:** tras revisión y permiso de SQL si hace falta, relaciones/estados/restricciones y transacción de reserva; probar lectura/escritura propia, denegación a tercero y ausencia de datos privados públicos. No desactivar RLS para probar.
4. **Data REST API:** verificar GET a /rest/v1/articulos desde servicio JavaScript, status/JSON/DOM y errores de §8; evidencia Network limpia. Una consulta SQL en dashboard no acredita consumo HTTP.
5. **Storage:** bucket y permisos del titular, una imagen válida y excesiva/no permitida, subida/lectura/rechazo de cambios ajenos, referencia y visualización en otra cuenta. Ninguna clave administrativa en navegador.
6. **Realtime:** publicación/canal/políticas y membresía de conversación; intercambio entre dos cuentas/equipos, respuesta, recarga/historial, reconexión y tercero sin acceso. Healthy no demuestra entrega de eventos.
7. **Cuotas/errores:** revisar uso Free y condiciones de pausa/continuidad, sin stress ni agotar límites; probar fallos de forma acotada. Capturas/logs sin JWT, refresh tokens, contraseñas, cabeceras de acceso ni datos personales.

No marcar estas pruebas como aprobadas antes de ejecutarlas. Los resultados van a tareas, actas y evidencias; no requieren ediciones semanales del SPEC.

### 24.5. Procedimiento Git inicial de 1.0 — antecedente histórico

**Corte histórico al aprobar 1.0:** main; SPEC_TB4.md sin seguimiento; develop local existente; comparación local 34 commits solo en develop y 0 solo en integracion/angel. Los pasos siguientes eran propuesta de entonces, no describen el Git actual ni autorizan repetirlos. La incorporación posterior está en el historial. La primera preparación documental de 1.1 se limitó a rama y documentos sin staging/commit/push/PR; su publicación posterior autorizada está registrada en §1 mediante PR #45, aún sin aprobación de integración.

1. **Preservar el documento:** comprobar rama/status/diff y guardar una copia verificable del SPEC aprobado antes de cambiar ramas. No descartar trabajo local. Si una rama destino ya contiene SPEC_TB4.md, comparar versiones y resolver antes de sobrescribir; un archivo sin seguimiento no está protegido por historial todavía.
2. **Actualizar referencias, solo con autorización:** fetch remoto y revisar divergencias; actualizar develop mediante fast-forward si procede. Si no puede avanzar así, detenerse y acordar integración, sin reset, rebase o force. Verificar de nuevo el estado, no asumir que el conteo 34/0 sigue vigente.
3. **Preparar destino personal:** el flujo sigue rama de tarea → integracion/angel → develop. Alinear integracion/angel con develop mediante sincronización autorizada y revisada antes del PR documental, para no introducir commits ajenos al SPEC. Actualmente el historial local permitiría evaluar fast-forward, pero no se realiza aquí.
4. **Crear rama documental desde develop actualizado:** nombre propuesto docs/angel/spec-tb4-v1; comando futuro de referencia: `git switch -c docs/angel/spec-tb4-v1 develop`. Restaurar/preservar en ella exclusivamente el SPEC aprobado y comprobar base/diff. La instrucción es propuesta, no permiso de cambiar rama ahora.
5. **Preparar revisión del único archivo:** tras autorización, `git add -- SPEC_TB4.md`, inspeccionar diff staged completo/estadística y `git diff --cached --check`; solo SPEC, estado 1.0/fecha correctos, sin claves. Commit propuesto “docs: aprobar contrato técnico TB4 v1.0”, únicamente cuando se autorice. No usar git add . ni incluir HTML/JS/SQL/configuración.
6. **Publicar y revisar solo autorizados:** push de rama y PR docs/angel/spec-tb4-v1 → integracion/angel; revisión de arquitectura/estado Supabase y conservación del alcance. Después PR integracion/angel → develop, comprobando que el diff real incluya solo lo esperado y sin cambios de otros módulos. Merges/control de main posteriores requieren su propia autorización.
7. **Confirmar trazabilidad:** SPEC en develop con estado/fecha aprobados, tareas Trello/PR/commit reales enlazados; nada de evidencias de commits o PR antes de existir. Continuar con tareas de desarrollo solo tras revisión de Planning, responsables y autorización expresa.

Este procedimiento preserva las ramas personales y la integración final controlada. La aprobación de 1.0 no autoriza fetch, switch, staging, commit, push, PR, merge ni deploy.
