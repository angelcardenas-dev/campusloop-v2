# SPEC_TB4.md — CampusLoop V2 | Sprint 2 y entrega final TB4

> **Estado:** VERSIÓN 1.0 — CONTRATO TÉCNICO APROBADO PARA SPRINT 2.\
> **Fecha de aprobación:** 12/11/2026 (Perú), comunicada por Angel David Cardenas Cabrera.\
> **Curso:** 1ACC0237 — IHC y Programación Web, ciclo 2026-20, UPC.\
> **Proyecto:** CampusLoop V2 · Startup ReCampus · Grupo 2.\
> **Repositorio:** https://github.com/angelcardenas-dev/campusloop-v2\
> **Fuente visual definitiva:** [CampusLoop en Figma](https://www.figma.com/design/b14UnSTg43slwvD1fV0XCG/CampusLoop) (`b14UnSTg43slwvD1fV0XCG`).\
> **Alcance temporal:** semanas 12, 13, 14 y 15; Sprint 2, entrega TB4, sustentación y preparación de DD1.\
> **Antecedente:** `SPEC.md` documenta la implementación HTML/CSS de TB3, ya entregada como release `v0.1.0`.
>
> **Regla de inicio:** Este documento establece el alcance completo previsto para TB4, **pero no autoriza por sí solo a Codex a mover archivos, editar código, cambiar ramas ni realizar operaciones Git**. Cada fase requiere tarea asignada y autorización expresa del responsable. Los ítems **[PROPUESTA]** necesitan aprobación; no presentarlos como requisitos textuales del profesor.

## 1. Fuentes, clasificación y estado del contrato

**VERSIÓN 1.0 — CONTRATO TÉCNICO APROBADO PARA SPRINT 2. Fecha de aprobación: 12/11/2026 (Perú).** Angel David Cardenas Cabrera aprueba definitivamente la arquitectura C simplificada, el alcance técnico y las reglas de desarrollo de la revisión 0.5. No queda una elección de arquitectura pendiente. La aprobación contractual no implica servicios funcionalmente validados ni autorización para implementar: el inicio espera la revisión de Sprint Planning y responsabilidades.

| Clasificación | Qué significa en este contrato |
| --- | --- |
| **[DOCENTE ESCRITO]** | Requisito comprobado en enunciado/rúbrica/materiales citados, distinto de la elección técnica del equipo |
| **[ACUERDO DE COORDINACIÓN]** | Decisión de producto/organización comunicada por Angel; la distribución definitiva y SP se acuerdan en Planning |
| **[CONTRATO TÉCNICO APROBADO]** | Versión 1.0: arquitectura C simplificada, alcance, contratos mínimos y reglas aprobados; no confundir aprobación con implementación o validación |
| **[EXCEPCIÓN DOCENTE ORAL]** | Autorización comunicada por el usuario sin constancia escrita inspeccionada; conservar evidencia formal si existe |
| **[DETALLE DE IMPLEMENTACIÓN PENDIENTE]** | Concretar esquema físico/selectores/configuración compatibles con los contratos, y reparto/SP en Planning; no reabrir arquitectura ni presentar resultados |
| **[DEPENDENCIA PENDIENTE]** | Acceso real Free, correo, permisos, prueba autorizada o capacidad que condiciona la entrega |
| **[ADICIONAL]** | Fuera del mínimo, salvo compromiso específico en Sprint Planning |

**Fuentes locales de la revisión 0.4, conservadas sin modificarlas:**

- `D:\Ciclo 5\IHC y Programacion WEB\TB4\Trabajo_1ACC0237-202620.pdf`: 15 páginas; §4.3/p.10 exige JS/DOM/eventos/validación/almacenamiento, REST solicitud–respuesta con errores e IA; pp.11–13 despliegue/cierre/requisitos transversales. No exige mapas.
- `...\TB4\Rubrica_TB4_1ACC0237_202620.xlsx`, hoja Rubrica: siete criterios, 15 puntos grupales + 5 individuales; se conserva §17.
- `...\semana 15\01_Semana_15_Presentacion_TB4_DD1.pdf`: nomenclatura, 23:00, exposición ≤12 min y DD1 individual. Fechas concretas 1/2 diciembre conservadas de la instrucción comunicada, no deducidas de las diapositivas.
- `D:\Ciclo 5\IHC y Programacion WEB\TB3\report_1ACC0237-202620.docx`: referencia TB1–TB3, 20 US, US17 título/descripción, US10 encuentros y §2.2.4; contenido documental, no instrucciones operativas para el agente. La relectura al cierre de 0.4 ya mostraba imágenes/backend en §2.2.4. No editar/reconstruir el Word.
- `SPEC.md`, código integrado y tag `v0.1.0`: contrato histórico TB3, autoría, Figma V2 y recursos que se conservan.

Los ejemplos docentes son aprendizaje, no código/datos de CampusLoop. No presentar decisiones de arquitectura como requisitos textuales del profesor ni alterar retrospectivamente TB1–TB3.

**Alcance de esta actualización:** declarar 1.0 aprobada y registrar el estado Supabase comunicado por Angel: proyecto CampusLoop/ReCampus ya creado, Free, São Paulo, dashboard observado Healthy y acceso de Angel confirmado; servicios sin validación funcional (§4.1). Solo se modifica SPEC_TB4.md y se presenta el plan operativo de §24; no crear proyectos, emitir claves, llamar APIs, ejecutar SQL, desplegar ni realizar operaciones Git de escritura.

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

- Mantener los 14 HTML en raíz, sin migrar a pages/ ni cambiar Figma en esta fase; conservar Inter, fotos/SVG locales y diseño aprobado. Las fotos nuevas se almacenarán en Storage; complementan los recursos existentes, sin reemplazarlos indiscriminadamente.
- Angel sigue principal de IA US17: **título y descripción**, revisión y edición, aceptar/descartar sin perder anteriores, sin publicación automática ni características inventadas. Matías mantiene su interfaz.
- Retirar Nominatim, Geoapify, Leaflet, OSM, servicios de teselas/geocodificación y módulos de mapas. US10 usa campus/lugares públicos predefinidos y lugar adicional válido, sin GPS.
- **Idioma:** el enunciado escrito pide en_US y es_419. El usuario comunica acuerdo verbal con el profesor para presentar solo español por el público de Lima. Registrar como excepción oral pendiente de evidencia formal; **no** implementar selector/traducciones sin nueva indicación. `lang="es"`, textos y errores en español comprensible. No afirmar que el PDF fue modificado.
- El usuario comunica que base de datos no suma ni resta puntos: observación docente oral, no obligación ni exención de JS/localStorage/API/IA. Supabase es la infraestructura seleccionada por coordinación para funcionalidad real, aún por configurar y validar.

### 2.3. Mínimo seleccionado para detallar en Sprint Planning

Registro/login propios de Supabase, sesión SDK, catálogo/vendedores compartidos con semillas, CRUD de publicaciones, filtros, Detalle/Perfil correctos, reservas consistentes y mensajes comprador↔vendedor desde dos computadoras. Una foto por artículo con Supabase Storage; GET del catálogo en Explorar mediante Supabase Data REST API; localStorage para borradores/preferencias/filtros. US17 real y despliegue público. Cada punto necesita criterios/pruebas; ninguno está implementado por documentarlo.

US10 conserva nombre/campus/lugar público y validación: no hacen falta coordenadas. Selección/aceptación se guarda en la reserva compartida de PostgreSQL, no por un cambio de identidad local.

### 2.4. Adicionales y fuera de alcance

**Adicionales:** US18 categoría automática, recomendaciones inteligentes US19, nuevas calificaciones/niveles, adjuntos de mensajes, leído/escribiendo, presencia, moderación avanzada, galerías amplias y fotos nuevas de perfil si la capacidad lo permite. Reducir a una foto por artículo primero; avatar nuevo puede posponerse si falta capacidad.

**Excluidos:** IA suplantando compradores/vendedores, chat por cambio de identidad, contraseñas manuales en texto plano, mapas/tracking, pagos/planes Premium US20, autenticación/JWT caseros y sincronización de negocio mediante localStorage. La arquitectura local deja de ser una opción pendiente; no sustituir el objetivo remoto por una simulación. No añadir otra API REST salvo nueva indicación expresa del profesor.

**Terminado:** funcionalidad autorizada implementada, probada local/públicamente y revisada; datos en su fuente correcta; criterios y fallos reales documentados, RLS y secretos verificados; integración Git/deploy solo autorizada. No declarar completa US06 por validar formato de correo ni las 20 US por mostrar pantallas.

## 3. Hoja de ruta completa por semana

| Etapa | Contenido docente | Aplicación prevista en CampusLoop | Evidencia mínima |
| --- | --- | --- | --- |
| **Semana 12** | JavaScript vanilla; DOM, eventos, formularios, JSON y `localStorage` | JS compartido; borradores/preferencias propias; acceso mediante SDK oficial Supabase seleccionado; validaciones; búsqueda/filtros; formularios de artículos/reservas consumiendo servicios compartidos | Capturas de interacción, validación, datos en DevTools y cambios que sobreviven a recargar |
| **Semana 13** | APIs REST, `fetch`, Promesas, `async/await`, `try/catch`, `response.ok`; planificación de IA | GET del catálogo desde Explorar vía Supabase Data REST API con fetch, JSON y errores; POST Storage complementario; contrato del asistente | Caso de éxito/error en DOM, respuesta JSON y código revisado |
| **Semana 14** | Integración real de IA vía API y despliegue Netlify/Vercel; consolidación | Asistente LLM funcional, manejo de errores, credenciales protegidas; Landing y Web App públicas; pruebas responsive, consola y rutas | URLs accesibles, demostración de la IA, registro de despliegue y pruebas |
| **Semana 15** | Sustentación TB4, evaluación heurística, DD1 y cierre | Completar informe, Nielsen, evidencias Scrum/GitHub, presentación, declaración IA, ZIP y demostración | Paquete de entrega, evaluación individual, capturas antes/después, exposición de máximo 12 min |

La base de datos es infraestructura seleccionada por coordinación; el caso REST requiere HTTP, no una conexión directa a PostgreSQL, y no sustituye evidencias de JS/localStorage/IA. Esta tabla es la **hoja de ruta docente**: al llegar a cada semana no es necesario rehacer `SPEC_TB4.md`; se actualiza el avance en Trello y GitHub. Si el docente publica una instrucción nueva que lo contradiga, se registra la decisión antes de actuar.

## 4. Arquitectura C simplificada — aprobada en versión 1.0

**Arquitectura aprobada definitivamente por Angel el 12/11/2026.** Se conserva la selección y todo el alcance de 0.5; no reevaluar A/B/C. La implementación sigue pendiente de revisión del Sprint Planning y responsabilidades, y necesita autorización posterior.

| Componente seleccionado | Responsabilidad | Estado real |
| --- | --- | --- |
| Supabase Auth | Registro, login, sesión y renovación con SDK oficial | Configuración/correo/pruebas pendientes |
| Supabase PostgreSQL | Datos compartidos, relaciones, transacciones y restricciones | Esquema/migraciones/RLS/semillas por revisar y ejecutar con autorización |
| Supabase Realtime | Actualizaciones de mensajes entre cuentas/equipos independientes | Publicación/canales/permisos y reconexión por probar |
| Supabase Storage | Único proveedor de fotos de artículos; perfiles si hay capacidad | Bucket/políticas/validación/Free por comprobar |
| Supabase Data REST API (PostgREST) | **Caso REST principal: GET del catálogo desde Explorar**, con fetch, JSON, errores y DOM | Contrato de §8; endpoint real y pruebas pendientes |
| localStorage | Borradores, filtros y preferencias propios no sensibles | Requisito académico separado de la sesión SDK; pendiente de implementación |
| Netlify Free | Landing y Web App, función serverless IA | Acceso/cupo/configuración/URLs y deploy pendientes |
| NVIDIA NIM API | Candidata para IA US17 a través de serverless | Proveedor/modelo no definitivos: gratuidad, permisos y prueba autorizada pendientes |

**Flujos seleccionados:** navegador → HTTPS Auth/Data REST/Storage de Supabase bajo sus permisos; Realtime para notificaciones y PostgreSQL para historial durable. Navegador → función Netlify → IA, sin clave NVIDIA en frontend. No conexión PostgreSQL directa desde JavaScript del navegador: la evidencia REST será la solicitud HTTP al endpoint de PostgREST, no una consola SQL ni una conexión de base de datos.

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

**Base comprobada:** 14 HTML en raíz, css/styles.css, assets/manifest.json, Inter/fotos/SVG locales y js/login.js reservado sin autenticación activa. No hay implementación funcional que migrar de Auth/SQL/Realtime; la arquitectura seleccionada añadirá esa capa una vez autorizada la implementación. CODEOWNERS actual protege SPEC.md y CODEOWNERS, no asigna automáticamente los futuros servicios; esta matriz es planificación, no cambio de esa configuración.

HTML/CSS existentes en raíz; sin crear archivos en esta revisión. JavaScript vanilla; SDK oficial de Supabase seleccionado como dependencia acotada, no framework ni permiso para reescribir UI. Versión fija, licencia, origen del paquete y carga reproducible por documentar.

**Convenciones:** Elementos → Datos → Funciones → Eventos cuando haya DOM; utilidades solo secciones pertinentes. `const` por defecto, `let` para reasignación, sin `var`; nombres descriptivos, funciones reutilizables, `addEventListener`, sin handlers inline. DOM seguro con `textContent/createElement`; no HTML de usuario/IA/REST. No duplicar inicializaciones.

| Archivo futuro propuesto | Principal | Responsabilidad y frontera |
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
| `js/localstorage.js` | Maricielo | Borradores, filtros y preferencias no sensibles; sin sesión SDK ni copias de negocio |
| `js/asistente.js`, `netlify/functions/asistente.mjs` | Angel | IA US17, fetch/errores/servidor |
| `supabase/migrations/`, receta/scripts privados de seed | Bernabé | SQL, RLS, funciones e idempotencia; no ejecutados ni creados aquí |
| `netlify.toml`, build por lista permitida/documentación de entorno | Angel | Publicación segura; no trasladar HTML ni copiar secretos |

No crear `geolocalizacion.js`, `mapa-encuentro.js` ni descargar Leaflet. La antigua siembra `datos-iniciales.js` del navegador se descarta: las semillas serán compartidas y privadas de administración.

**Contratos comunes propuestos:** servicios asíncronos devuelven `{ ok, datos, error }`; códigos diferencian validación, no autorizado, conflicto, no encontrado, red, cuota y servidor. Una UI no anuncia guardado hasta respuesta confirmada. Servicios no tocan DOM. Formulario no elige remitente/propietario confiando en un campo oculto: servidor deriva actor de Auth.

Elegir un único mecanismo de carga (ES modules o scripts externos diferidos con espacio `CampusLoop`) compatible con la versión SDK; no mezclar copias/globales de SDK. La elección y orden de dependencias se congelan antes del código; la sesión debe resolverse antes de consultar datos privados. Landing no necesita SDK si solo enlaza al acceso.

CSS permanece en `css/styles.css`, con prefijos y propietario histórico por sección; tokens/comunes solo coordinación. Las ediciones del mismo archivo se serializan mediante tareas/PR pequeños, aunque afecten secciones distintas.

## 6. Contratos mínimos aprobados: datos compartidos, RLS y almacenamiento local

Los contratos mínimos siguientes forman parte de **[CONTRATO TÉCNICO APROBADO]**. No acreditan tablas/políticas creadas ni validadas; esta sesión no ejecuta migraciones. Concretar el esquema físico con consumidores antes de programar, manteniendo estas reglas; registrar ajustes compatibles en tareas/PR y revisar el contrato solo si un cambio arquitectónico o académico lo justifica. La arquitectura seleccionada tiene fuente autoritativa en PostgreSQL para negocio, Auth para credenciales y localStorage solo para preferencias/borradores.

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

Definir límites/limpieza y tratamiento de borradores al cerrar sesión en equipo compartido antes de implementar; propuesta: aviso de almacenamiento local, borrador por cuenta, eliminación explícita y limpieza tras publicación confirmada. No eliminar todo localStorage ni manipular claves internas de Supabase.

Estos datos sobreviven recarga en el mismo origen/perfil; no se comparten entre computadoras. No guardar contraseñas, credenciales, mensajes, reservas ni datos personales sensibles. **Excepción delimitada:** el SDK puede persistir su propia sesión según §7; no es una función de localstorage.js ni prueba suficiente del requisito local propio. No copiar tokens a claves nuestras.

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

## 9. IA generativa — US17, contrato y protección

**Acuerdo:** Angel es principal de lógica/fetch/servidor/pruebas; Matías de Publicar y su interfaz. Mínimo: propuestas de **título y descripción**, editables y revisables; US18 categoría es adicional. Nunca publicar automáticamente ni responder como comprador/vendedor humano.

### 9.1. Proveedor provisional y autorización

Publicar → js/asistente.js → POST /api/asistente Netlify → NVIDIA NIM alojada. Sin GPU/servidor NIM propio. Primera opción provisional [mistralai/mistral-nemotron](https://build.nvidia.com/mistralai/mistral-nemotron); alternativa [nvidia/nemotron-3.5-lightning-30b-a3b](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b). No fijar modelo por una ficha pública ni usar como principal los endpoints gratuitos deprecados indicados de Llama 3.1/3.3.

Disponibilidad Free de nuestra cuenta, cuota, español/JSON, latencia y condiciones académicas públicas no comprobadas. Los [API Trial Terms §1.2/1.4](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf) restringen trial a evaluación interna y diferencian producción: ser académico/no comercial no concede automáticamente permiso de endpoint público. Resolver antes de habilitar; alternativa gratuita compatible necesita aprobación si no se permite.

Prueba futura autorizada: lote pequeño de casos sintéticos en español por candidato, presupuesto de solicitudes explícito, título ≤100/descripción ≤1000, sin hechos inventados, JSON válido, revisión de latencia/uso. Negativos se simulan localmente para no agotar cuota. No hubo llamadas ni elección definitiva en esta revisión.

### 9.2. Contrato de UI Matías ↔ Angel [PROPUESTA]

Matías único editor Publicar/CSS publish- y publicaciones.js; Angel asistente.js/función IA. Antes de programar acordar selectores de región, previews, Solicitar/Aceptar/Descartar/Restaurar y región aria-live; no editar simultáneamente los mismos archivos.

| Evento de document propuesto | Productor → consumidor / datos |
| --- | --- |
| campusloop:ia-solicitar | Matías → Angel: schemaVersion 1, solicitudId, revisionFormulario, operacion proponer_publicacion, articulo |
| campusloop:ia-estado | Angel → Matías: solicitudId, cargando/listo/error/descartado, sugerencias cuando listo o error normalizado |
| campusloop:ia-aplicar | Angel tras decisión explícita → Matías: solicitudId, revisionFormulario, camposAceptados con titulo y/o descripcion |

Contexto articulo permitido: tituloActual, descripcionActual, categoriaId, condicion, caracteristicas dadas por el usuario (máximo 10 de 150 caracteres). Categoría es contexto, no US18. Angel gestiona solicitud/preview y Matías aplica únicamente los campos aceptados. No guardar ni sustituir al recibir; conservar copia previa en memoria para restaurar. Si cambió revisión durante espera, exigir revisión de la sugerencia, ignorar respuesta tardía al cambiar formulario/cerrar sesión. Descartar conserva todos los datos anteriores.

Mostrar salida como texto no confiable, con textContent/value, validación de estructura/longitud; sin innerHTML, Markdown activo, ejecución o URLs arbitrarias. Error conserva formulario y permite edición manual. Solo Publicar explícito persiste mediante artículos; IA no escribe en BD ni borradores automáticamente.

### 9.3. Contrato HTTP propuesto

POST JSON ≤8 KiB: schemaVersion, solicitudId, operacion y contexto anterior; sin mensajes privados, información de cuenta, campus ni datos personales. Auth mediante SDK/cabecera, no token en JSON/URL ni selector de usuario. Servidor verifica sesión/permiso vendedor con SDK oficial, valida todos los campos y upstream fijo.

Éxito: { solicitudId, sugerencias: { titulo, descripcion } }; error: { solicitudId, codigo, mensaje } y HTTP coherente para validación/no autorizado/límite/upstream/timeout. Comprobar response.ok, JSON y ambos campos; no retornar respuesta cruda, prompts internos, razonamiento o información sensible. Contexto insuficiente pide aclaración; no rellenar atributos inventados.

Fetch servidor con salida acotada y sin streaming para el mínimo. Compatibilidad de response_format/parámetros depende del modelo y prueba; no copiar máximos enormes del catálogo. Tokens máximos/timeout se fijan con límites reales Netlify/proveedor; propuesta inicial cliente 20 s/upstream menor, una activa y aborto al abandonar, sin reintentos que multipliquen consumo.

### 9.4. Secretos y consumo

NVIDIA_API_KEY solo entorno servidor, nunca HTML/JS público, almacenamiento navegador, repositorio/evidencias o archivos versionados. NVIDIA_MODEL configurable entre aprobados; IA_HABILITADA apagada hasta autorización/cuenta/licencia/prueba.

Validación, límites de cuerpo/respuesta/tiempo, autenticación, cuota por usuario/global y registros técnicos redactados. Propuesta dentro de la arquitectura seleccionada: contador/cupo transaccional protegido en PostgreSQL antes del upstream, sin política pública que permita resetearlo; revisar cómo contabilizar solicitudes fallidas y exposición de funciones. No prometer cuota dura sin implementación/prueba. CORS, botón, contador local o memoria serverless no limitan globalmente. Sin facturación/recargas, interruptor de corte al límite. Un fallo mantiene publicación manual pero no equivale a haber cumplido IA real.

## 10. Despliegue propuesto — Netlify Free y presupuesto S/ 0

El proyecto Supabase ya existe y el acceso de Angel está confirmado (§4.1); no se acredita validación funcional ni despliegue Netlify. [DOCENTE ESCRITO]: ambos productos públicos y tabla 5.1 con repositorio/tecnología/hosting/URL. Netlify Free seleccionado por coordinación junto a Supabase Auth/PostgreSQL/Realtime/Storage/Data REST API. La configuración existente de servicios debe inspeccionarse antes de modificarla; ninguno está comprobado funcionalmente. NVIDIA sigue candidata de IA, pendiente de Free/condiciones/prueba; no modelo definitivo.

### 10.1. Un sitio, dos entradas y un origen de Web App

| Producto/servicio | Ruta pública propuesta, no creada |
| --- | --- |
| Landing | https://<sitio>.netlify.app/ → index.html |
| Web Application | https://<sitio>.netlify.app/login.html → inicio.html y los HTML interiores actuales |
| IA | /api/asistente → función fuera del artefacto estático |
| Catálogo REST | https://<proyecto>.supabase.co/rest/v1/articulos, GET autenticado según permisos |
| Fotografías | Endpoints Supabase Storage del proyecto con permisos; sin segundo proveedor |

Un sitio/repo evita cambios extensos de rutas y dos despliegues por modificación. Confirmar interpretación docente de dos productos bajo entradas distintas; si exige dos sitios, Landing separado y todas las pantallas Web App en un único origen, sin repartirlas entre hosts. No mover 13 HTML a pages/ ni convertir a SPA.

localStorage y sesión SDK dependen de origen/perfil: cada preview/puerto/host tiene los suyos. Supabase comparte negocio entre computadoras, no los borradores locales. Definir redirect URLs de Auth permitidas para producción/desarrollo; no comodines arbitrarios en producción.

### 10.2. Artefacto y dependencias futuras mínimas

Tras autorización, netlify.toml + funciones + build por lista permitida: copiar 14 HTML/css/js/assets a dist sin trasladar fuentes. Publicar dist; funciones empaquetadas aparte. Excluir SPEC/Word, .git, .env, migraciones/semillas privadas, logs, pruebas/evidencias, claves y scripts administrativos. .gitignore no garantiza que un archivo no se sirva; inspeccionar artefacto y respuestas HTTP. [Build/configuración](https://docs.netlify.com/build/configure-builds/file-based-configuration/).

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
| Angel David Cardenas Cabrera | IA/función, cliente Supabase/Auth, Inicio/Explorar, seguridad/integración y coordinación de deploy/QA | No asumir además SQL/mensajería completa ni la UI de todos; revisa seguridad sin editar archivos de otro a la vez |
| Bernabé | Esquema/migraciones/semillas, contratos y servicios de artículos/perfiles/conversaciones/mensajes/reservas, Detalle/Perfil; RLS con revisión Angel | Autor técnico de servicios y BD; UI Reservas/Mensajes queda Maricielo; puede recibir soporte de Matías tras cerrar CRUD |
| Matías | Activación, Publicar/CRUD, interfaz IA, cliente de fotografías con Supabase Storage | Consume auth/artículos; no duplicar cliente Supabase. Angel revisa permisos/seguridad, no toma su HTML |
| Maricielo | Registro/Login UI, Mi Cuenta, Reservas y Mensajes UI, integración y utilidades localstorage | No diseñar/renovar JWT ni implementar SQL/Realtime desde cero en sus páginas; consume los servicios de Bernabé/Angel |

**Carga real:** Angel mantiene tres caminos críticos (Auth, IA, deploy) y revisión; Bernabé suma esquema/RLS y servicios. Maricielo conserva cuatro interfaces y validaciones, por lo que la redistribución no elimina su riesgo. Antes de comprometer, cada uno declara disponibilidad y estima tareas; no inventar horas/SP. Delegar a Bernabé pruebas de autorización y servicios compartidos, a Matías uploads y pruebas CRUD, a Maricielo LS/QA de sus flujos; repartir documentación y Nielsen entre todos. Si falta capacidad, reducir variantes/avatar/galerías antes de trasladar todo a Angel. No añadir otro proveedor o API REST para resolver la carga.

**Orden de dependencias:**

1. Aplicar el contrato 1.0 aprobado y revisar capacidad/responsabilidades; verificar accesos/permisos al proyecto existente, correo y GET REST seleccionado → esquema/IDs/estados/contratos + auth y RLS.
2. Contrato artículos/perfiles + semillas → Inicio/Explorar/Detalle; auth → interfaces de acceso/Cuenta/Activación.
3. Auth + artículos + Supabase Storage → CRUD Publicar; contrato IA independiente permite trabajo paralelo de Angel/Matías.
4. Auth + conversaciones/mensajes/RLS → Mensajería; reservas/RPC/estados/lugares → interfaz Reservas.
5. Flujos integrados y errores → prueba en dos computadoras → deploy autorizado → Nielsen/correcciones/informe.

**Git a conservar:** integracion/angel, integracion/bernabe, integracion/matias, integracion/maricielo; subramas feature/fix pequeñas → PR a rama personal → PR a develop → integración final main controlada. No trabajar directamente en main por ser la rama local actual. No cambiar de rama ni sincronizar por este documento; cualquier operación requiere autorización.

Antes de tarea: rama/status/diff/check, cambios locales y propietarios/dependencias. Contratos primero en PR revisado por consumidores; después PR de un recorrido pequeño. Un cambio de auth, esquema o función compartida incluye compatibilidad/consumidores/migración y pruebas; no reescribir módulos ajenos. Acordar ventanas para css/styles.css, HTML común, package/build/config y migraciones; un solo editor por archivo y secuencia explícita de migraciones, sin aplicar SQL divergente en el mismo proyecto.

Revisión de seguridad antes de exponer tablas/Storage/funciones; integración continua con pruebas de regresión y evidencia por autor. Sin commits vacíos, firmas falsas, squash que borre participación sin acuerdo ni métricas inventadas. PR/deploy/release requieren autorización separada; v0.1.0 histórico no se altera.

## 13. Aceptación y pruebas verificables — plan, no resultados

Las pruebas funcionales siguientes están **pendientes** porque no se autoriza código/API/proyectos. La revisión documental solo ha realizado lecturas, contraste de fuentes y verificaciones locales Git. Separar evidencia real de planificación; una respuesta simulada sirve para un negativo, no para acreditar API/IA/mensajes reales.

### 13.1. Pruebas del alcance seleccionado, por comprometer en Planning

| ID | Criterio y prueba prevista | Principal |
| --- | --- | --- |
| T01 | Los 14 HTML, incluida Landing, y sus rutas/fragmentos/recursos sin roturas; acceso a términos desde footers de ambos productos y lectura comprensible | Cada módulo; Angel consolida |
| T02 | 320/390/768/1024/1280/1440/1920 px; comparar 390/1440 con Figma/baseline; sin overflow ni barra inferior sobre acciones; Inicio/TB3 conservados | Todos |
| T03 | Teclado, labels, foco visible/retorno, ARIA y anuncios de carga/error; validación sin depender solo de color; todo en español según excepción registrada | Todos |
| T04 | Registro válido crea cuenta; inválido no llama/guarda; errores/cuota comprensibles. Confirmación/retorno probados según decisión, sin afirmar verificado si no corresponde | Maricielo + Angel |
| T05 | Login/recarga/refresh administrados por SDK; logout limpia UI/canales; ruta directa sin sesión no revela datos. No contraseñas en storage ni tokens/credenciales en logs/evidencias | Angel + Maricielo |
| T06 | Dos cuentas/dos computadoras ven mismo catálogo sembrado; nueva cuenta sin publicaciones/mensajes/reservas propias. Seed privado ejecutado dos veces sin duplicados ni borrado de datos ajenos | Bernabé |
| T07 | Filtros combinados válidos, orden/limpiar/cero resultados inline; precios en S/ e IDs correctos; recordar filtros después de recargar sin tratar LS como catálogo | Angel |
| T08 | Detalle y vendedor corresponden a ID; inválido/eliminado informa y ofrece regreso, sin ficha MacBook por defecto; solo datos públicos de perfil | Bernabé |
| T09 | Activación según normas y permisos; CRUD propio persiste compartido. Otro usuario no edita/elimina, incluso petición directa alterando ID. No publicaciones automáticas/duplicadas por doble clic | Matías + Bernabé |
| T10 | Dos compradores intentan reservar mismo artículo; solo una operación activa confirma. Cancelación libera consistentemente; estados/autor y recarga coinciden en ambos equipos | Bernabé + Maricielo |
| T11 | US10: seleccionar campus/lugar público o adicional válido; confirmar/recuperar en reserva compartida; rechazar vacío/dirección privada no pertinente, sin mapas | Maricielo + Bernabé |
| T12 | Comprador envía, vendedor recibe/responde en otro equipo y comprador recibe; recarga recupera historial; reconexión no duplica ni pierde confirmados | Bernabé + Maricielo |
| T13 | Tercera cuenta intenta leer/insertar mensaje/conversación/reserva ajena y falsificar remitente/propietario mediante API directa: RLS lo rechaza. Filtros UI no cuentan como defensa | Bernabé; revisión Angel |
| T14 | Borrador/preferencias/filtros propios sobreviven recarga; JSON corrupto/cuota/almacenamiento bloqueado recuperables. Cuentas no heredan borrador ajeno, logout según política aprobada | Maricielo; consumidores |
| T15 | REST-01–06 de §8: GET fetch real a PostgREST desde Explorar, response.ok/status, JSON validado, try/catch, carga/vacío/error/éxito y DOM; Network sin tokens/credenciales. POST Storage complementario | Bernabé servicio + Angel DOM; Matías Storage |
| T16 | Foto: formato/tamaño reales válidos aceptados; disfrazado/no permitido/excesivo rechazado; no overwrite/borrado ajeno, sin escritura anónima/privilegios administrativos en navegador. Error/red/cuota conserva borrador y foto anterior | Matías; revisión Angel |
| T17 | IA real autorizada propone título/descripción en español sin hechos añadidos; ambos editables, aceptar/descartar/restaurar; revisión cambiada/respuesta tardía no sobrescribe. Nunca publica automáticamente | Angel + Matías |
| T18 | IA/red/timeout/429/JSON malformado/configuración ausente: mensaje seguro, sin secreto ni respuesta cruda; edición manual sigue. Entrada HTML/script de IA/REST/usuario se muestra como texto | Angel + consumidores |
| T19 | Cuotas/controles IA/uploads se prueban sin carga masiva ni agotar Free; llamadas no autorizadas rechazadas y cortes efectivos. No suponer protección global por un contador local | Angel + Matías/Bernabé |
| T20 | Artefacto estático sin secretos/SQL/admin/Word/logs; funciones verifican sesión y origen/ruta permitida. Public key con RLS, no secret/service_role en navegador. Consola/evidencias redactadas | Angel; revisión cruzada |
| T21 | Sitio público desde navegador sin login Netlify, recursos y entradas Landing/App correctas; URL/versión real en §5.1. Servicios/confirmación email activos antes de demo | Angel |
| T22 | Checklist 10 Nielsen por producto, antes/después de hallazgos reales y nueva verificación; observaciones TB3 atendidas según evidencia | Equipo |
| T23 | Trello sin autenticación y tareas/SP/estados reales; Git/PR/contributors auténticos, 3–5 commits representativos explicados; archivos/ZIP/links y ensayo ≤12 min verificados | Equipo |

A cada ejecución adjuntar fecha, entorno/origen, versión/commit, cuentas alias, paso esperado/obtenido, resultado y captura/redacted log. Distinguir local/preview/producción, navegador y ancho. No guardar sesiones completas, HAR sin limpiar, contraseñas, email privado ni capturas de paneles con claves. Exponer porción JSON no sensible y status, ocultando cabeceras y formularios de autenticación.

### 13.2. Pruebas adicionales, no compromiso mínimo

Carga masiva/stress, escala multiusuario amplia, E2E exhaustivo de todos los navegadores, cookies/BFF, adjuntos/leído/presencia, galerías grandes, moderación avanzada y US18. No consumir cuota para estas pruebas ni presentarlas como realizadas; aprobar alcance y presupuesto antes. Un tercero no autorizado T13 y concurrencia de dos reservas T10 son pruebas **mínimas de seguridad/consistencia**, no opcionales por ser difíciles.

Pruebas de fallo podrán usar dobles locales para 429/JSON/timeout y registro explícito de esa técnica. Los éxitos REST, IA y comunicación entre equipos necesitan servicios reales autorizados; videos anteriores son respaldo honesto ante caída, no prueba de que el servicio responde en ese instante.

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

En la arquitectura seleccionada observar especialmente: carga/restauración de sesión, confirmación de correo, errores de red/cuota, reserva en conflicto, mensajes pendientes/reconexión, privacidad de fotos/borradores y control de aceptar/descartar IA. No confundir usabilidad con seguridad: aprobar una heurística no prueba RLS. Mantener idioma español por la excepción oral y registrar esa dependencia, sin declarar implementado inglés.

## 15. Impacto documental futuro — sin modificar el Word

Documento de referencia: D:\Ciclo 5\IHC y Programacion WEB\TB3\report_1ACC0237-202620.docx. Conservar TB1–TB3, Sprint 1 y 20 identificadores US. No reconstruir informe ni rellenar con pruebas futuras. Nuevas decisiones se registrarán con fecha/justificación y se contrastarán con los criterios originales; este SPEC no acredita que todas las US estén terminadas.

| Apartado afectado | Cambio futuro justificado, tras autorización específica para el Word |
| --- | --- |
| 2.2.4, evaluación de API | La versión releída al cierre **ya propone REST de imágenes y evaluar datos/Auth en nube**. No reconstruir ni sustituir ese avance. Reflejar la arquitectura seleccionada y Supabase Data REST API: GET catálogo/PostgREST, JSON/errores, Storage para fotos y límites Free. Mantener la coherencia sin reintroducir mapas ni otra API |
| Product Backlog y criterios US | Mantener IDs; US09 comunicación e historial real, US10 lugares públicos sin mapa, US11/12 reserva consistente, US17 título+descripción editable. US06 institucional/confirmación no se considera completa por formato de email; US18 opcional y US20 excluida |
| Arquitectura/datos/privacidad y diseño técnico | Explicar C simplificada seleccionada: Auth/RLS/BD/Realtime, Data REST API, Storage, fuente autoritativa y LS no sensible; retirar afirmaciones de solo almacenamiento local para negocio. Figma conserva estructura, nuevas interacciones se documentan sin inventar frames |
| 4.1/configuración y gestión de desarrollo, donde corresponda | Dependencias/versiones, entorno reproducible, variables sin valores, migraciones/semillas privadas, pruebas y despliegue; registrar acuerdos nuevos sin atribuirlos al Sprint 1 |
| 4.3 Sprint 2 | 4.3.1 Planning real, 4.3.2 Backlog/estimaciones/estados reales, 4.3.3 Development Evidence JS/REST/IA y 3–5 commits, 4.3.4 Collaboration Insights Git/PR/contributors |
| Capítulo V/5.1 | Landing y Web App: repo, tecnología, hosting, URLs públicas verificadas, fecha/versión y evidencias; no rutas de ejemplo como URLs finales |
| Capítulo VI/6.1 | Diez Nielsen sobre ambos productos, correcciones verificadas antes/después; no resultados supuestos |
| Requisitos transversales/idioma | Referir exigencia escrita es_419/en_US y excepción oral solo español comunicada por Angel, adjuntar confirmación docente si disponible; no falsear consigna escrita |
| Cierre | Portada TB4, versiones, Student Outcome acumulado por integrante TB1–TB4, mínimo dos conclusiones y dos recomendaciones TB4, APA, participación, declaración IA y observaciones TB3 |

**Redacción futura orientativa para 2.2.4, no insertada en Word:** “Para TB4, coordinación ha seleccionado Supabase Auth, PostgreSQL, Realtime y Storage. El consumo REST se demostrará consultando el catálogo de Explorar mediante fetch GET a Supabase Data REST API (PostgREST), con respuesta JSON, estados DOM y manejo de errores; una subida Storage podrá aportar evidencia adicional. localStorage conservará borradores, filtros y preferencias. Netlify Free alojará los productos; NVIDIA continúa candidata de IA, pendiente de validación gratuita/condiciones”. Distinguir esta selección de resultados todavía no implementados ni probados.

Registrar autoría nueva de IA Angel/interfaz Matías en Sprint 2 sin reescribir asignaciones históricas de US17/18. Decisiones de BD y capacidad no deben aparentar una reunión ya realizada. Bibliografía futura con documentación oficial efectivamente utilizada; no citar una llamada API no ejecutada.

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

## 18. Secuencia futura y puertas de aprobación

Esta tarea autoriza **solo actualizar SPEC_TB4.md y presentar el plan**. **Versión 1.0 aprobada el 12/11/2026**, incluida C simplificada. La implementación espera revisión de Sprint Planning y responsabilidades; no confundir este contrato con permiso de ejecución. Ninguna puerta documental autoriza por sí sola código, creación de proyectos, keys, llamadas API, deploy u operaciones Git de escritura.

| Fase / puerta | Estado/salida necesaria |
| --- | --- |
| F0: revisión documental | 0.4 estudiada, 0.5 conservada y contrato 1.0 aprobado. No pruebas funcionales de proveedor |
| G1: contrato aprobado; Planning pendiente | Aprobación definitiva cumplida por instrucción de Angel. Revisar Planning, capacidad, reparto y SP reales antes de iniciar desarrollo; no reabrir arquitectura ni proveedor REST. Organización de productos/URLs e idioma oral quedan registrados |
| G2: servicios existentes y configuración autorizada | Supabase CampusLoop/ReCampus ya creado, Free/São Paulo, Healthy observado y acceso Angel confirmado. Verificar demás accesos/permisos y funciones del proyecto existente con autorización; no recrearlo. Correo/redirects, cuotas, NVIDIA y Netlify pendientes |
| F1: contratos y baseline | Congelar IDs/estados/esquema/RLS/GET de catálogo y Storage; interfaz/eventos IA; baseline visual/Nielsen antes de cambios, reparto por archivo |
| G3: núcleo compartido autorizado | Auth/registro, semillas privadas, RLS contra tercero, GET PostgREST real, envío/respuesta desde dos cuentas/equipos y reserva sin doble confirmación |
| F2: recorridos verticales | Publicar/CRUD/una foto Storage → catálogo/filtros/Detalle; reservas/lugares → mensajes; LS propio. PR pequeños tras autorización, servicios antes de consumidores |
| G4: REST/IA/seguridad | REST-01–06 y T15; respuesta/errores/DOM/Network redactado; IA título+descripción editable, cuotas/secretos y T16 Storage. Llamadas reales solo con autorización explícita |
| F3: integración pública | PR/deploy aprobados, ambas entradas públicas, regresión/dos equipos y cuotas comprobadas; no asumir que seleccionar Netlify ya lo publica |
| F4: cierre | Nielsen/correcciones reales, Word/Trello/Git, ensayo/ZIP y revisión final; release solo autorizada |

El SDK/Auth/BD añade infraestructura nueva, no migra contraseñas/sesiones demo. Cuentas oficiales de prueba, datos sintéticos y semillas privadas; nada de siembra pública o cambio de identidad.

Cada tarea entrega contrato/archivos/autor, pruebas/negativos/evidencia y pendientes, con revisión por consumidores. Si aparece un bloqueo, documentar impacto y decisión: nunca bajar RLS, publicar secretos, falsear respuestas o pagar. No recurrir a otra API REST como contingencia sin nueva indicación expresa del profesor.

## 19. Continuidad entre cuentas de Codex

Otra cuenta puede continuar secuencialmente en la misma carpeta/rama, preservando cambios locales. Solo un agente/editor activo por carpeta. El chat no sustituye el estado real de archivos.

Antes de continuar: leer ambos SPEC y la tarea original; comprobar rama, status, diffs y pruebas existentes; distinguir propuesto, escrito, probado y fusionado. No reimplementar, sobrescribir ni hacer commits por cambiar de cuenta.

**Traspaso mínimo:** objetivo/tarea Trello, responsable y rama; archivos cambiados o sin seguimiento; contrato consumido/producido; pruebas ejecutadas y fallidas; ubicación de evidencia; pendientes, bloqueo y siguiente acción autorizada. Sin contraseñas ni API keys. Se incluye en la descripción de tarea o canal de coordinación, sin crear archivos públicos con secretos.

Añadir al traspaso de la arquitectura seleccionada: versión de migraciones aplicada (sin credenciales), bucket/rutas/políticas Storage y contrato GET catálogo, configuración de confirmación email, estado de cuotas verificado y pruebas entre equipos efectivamente ejecutadas. No copiar tokens/configuración privada en el chat de relevo.

## 20. Registro de decisiones — versión 1.0 aprobada y validaciones pendientes

**Aprobación definitiva: 12/11/2026 (Perú), comunicada por Angel David Cardenas Cabrera.** Se aprueban arquitectura, alcance técnico y reglas de 0.5; se conservan requisitos, contratos mínimos, criterios, responsabilidades preliminares, pruebas, cronograma, IA y flujo Git.

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
| ACUERDO APROBADO | Mensajes reales con cuentas/equipos distintos, seeds privadas; US10 lugares públicos sin mapa; US17 título/descripción editables, Angel principal y Matías interfaz |
| EXCEPCIÓN DOCENTE ORAL | Solo español según acuerdo comunicado; conservar constancia si existe. Exigencia bilingüe escrita identificada |
| OBSERVACIÓN DOCENTE ORAL | BD no suma/resta según usuario; no sustituye evidencias académicas |
| IMPLEMENTACIÓN POR CONCRETAR | Nombres físicos/selectores/configuración compatibles con el contrato, RLS/RPC/Storage y cuotas; revisión por dueños/consumidores antes de ejecutar |
| DESPLIEGUE PENDIENTE | Netlify Free seleccionado; acceso/cupo, un sitio/dos entradas, artefacto público, redirects, configuración y despliegue por verificar/autorizar |
| DEPENDENCIA PENDIENTE | Confirmación de correo/SMTP y registro; funcionamiento Supabase/seguridad, permisos restantes, cuotas y condiciones efectivas de uso Free |
| DEPENDENCIA PENDIENTE | NVIDIA candidata: gratuidad/acceso/modelo/español/condiciones públicas/latencia y límites sin probar; no modelo definitivo |
| PLANNING PENDIENTE | Capacidad, reparto final, tareas/SP/velocity reales, Trello público, observaciones TB3, fecha DD1 y confirmación entrega/horario |
| ADICIONAL | US18/US19, nuevos niveles/reseñas, adjuntos/presencia/leído, galerías/avatares nuevos y BFF/cookies; sin compromiso automático |

**No se requiere otra aprobación del contrato para reconocer esta versión 1.0.** Sí se requiere revisar Sprint Planning/responsabilidades y autorizar las siguientes acciones de código, servicios, SQL, Git y despliegue. No confundir planificación aprobada con comprobación funcional de Free/correo/IA o con permiso de ejecutar.

Trello, GitHub, actas y evidencias registrarán avances, verificaciones y acuerdos. No editar semanalmente el SPEC. Solo revisar el contrato ante cambio arquitectónico o requisito académico justificado y aprobado; detalles operativos compatibles van en tareas/PR. Alternativas descartadas quedan como antecedente en §4, sin sustitución automática de servicios o simulaciones.

## 21. Cronograma tentativo y reducción controlada de alcance

Calendario de planificación, no avance ni estimación aprobada. Fechas Perú 2026, entrega 01/12 y exposición 02/12 sujetas a confirmar en aula. C simplificada y el contrato 1.0 ya aprobados; accesos/permisos restantes, servicios/correo, pruebas y capacidad todavía condicionan las fechas. Replanificar si se retrasan, sin comprimir seguridad al final.

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

1. Retirar US18/US19/extras, galerías, avatar nuevo/adjuntos y variantes; mantener una foto de artículo, validación, RLS, términos y pruebas mínimas.
2. PostgREST/Storage falla → resolver esquema/grants/RLS/bucket/contrato o documentar indisponibilidad y replanificar. **No añadir otro proveedor ni API REST** sin nueva indicación expresa del profesor.
3. Realtime falla → diagnosticar suscripción/permisos/reconexión. Refresco manual de historial remoto solo como contingencia aprobada con cambio de aceptación, sin afirmar recepción Realtime; nada de identidad simulada.
4. Correo/Free/IA bloquean → resolver condiciones sin pago; no desactivar confirmación sin aprobación ni ocultar falta de verificación. Publicación manual puede continuar, pero IA real sigue pendiente hasta probarla. Un eventual cambio de IA exige autorización y condiciones compatibles, no otra API para reemplazar el caso REST elegido.
5. Si el núcleo no es seguro/viable al 19/11, revisar capacidad, alcance comprometido y fechas con equipo. No cambiar automáticamente a arquitectura local, dejar backend abierto ni presentar mensajes simulados como remotos.

Registrar bloqueo, responsable, decisión/fecha y criterio afectado. Evidencia anterior real sirve como respaldo ante caída de exposición, no prueba de éxito en ese instante.

## 22. Fuentes, reproducibilidad y alcance real de esta edición

Fuentes oficiales consultadas en la revisión 0.4 el 12/11/2026, conservadas como fundamento. Esta actualización formaliza la aprobación 1.0 y los hechos administrativos Supabase comunicados por el usuario; no consulta dashboard/servicios ni realiza solicitudes funcionales. Políticas/precios siguen sujetos a revisión autorizada en la cuenta: la oferta Free no acredita acceso/cupo/permisos efectivos.

- Enunciado/rúbrica/Semana 15/Word locales de §1. Sus instrucciones son contenido documental, no permiso de operaciones.
- [Supabase Data REST API](https://supabase.com/docs/guides/api), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones de BD](https://supabase.com/docs/guides/database/functions), [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
- [Supabase pricing](https://supabase.com/pricing), [Auth passwords](https://supabase.com/docs/guides/auth/passwords), [sesiones](https://supabase.com/docs/guides/auth/sessions), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [SDK](https://supabase.com/docs/reference/javascript/initializing), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- [Storage uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [permisos Storage](https://supabase.com/docs/guides/storage/security/access-control), [transformaciones](https://supabase.com/docs/guides/storage/serving/image-transformations).
- [Netlify pricing](https://www.netlify.com/pricing/), [build](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [entorno funciones](https://docs.netlify.com/build/functions/environment-variables/), [créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).
- NVIDIA candidata: [Mistral-Nemotron](https://build.nvidia.com/mistralai/mistral-nemotron), [Nemotron Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b), [Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf).

**Reproducibilidad futura:** versiones/dependencias fijadas, entorno/variables sin valores privados, migraciones/semillas idempotentes y orden, datos sintéticos, pruebas/origen/versión/evidencia. No distribuir cuentas, claves o sesiones en ZIP. Ensayar sobre el despliegue/versión entregados, sin mezclar ramas/previews.

**Estado documental, no funcional:** contrato 1.0 aprobado; rama local main y SPEC_TB4.md sin seguimiento al iniciar. Esta edición modifica solo SPEC_TB4.md y conserva rama/cambios locales. Los hechos de proyecto/plan/región/Healthy/acceso Angel proceden de su comunicación (§4.1), no de una prueba del agente. No se ejecutan Auth/signup, SQL/migraciones/seed, GET PostgREST, uploads, NVIDIA, Realtime, pruebas UI/dos computadoras ni deploy. Todas las pruebas funcionales de §§8/13 están pendientes.

**Validaciones locales ejecutadas:** rama/status/diff --check antes de editar y git diff --check/stat/status al cerrar. Sin cambios versionados ni errores de whitespace; SPEC_TB4.md sigue sin seguimiento. Comprobación adicional git diff --no-index --check frente a NUL sin errores (código 1 por contenido nuevo). SHA-256 de los 65 archivos versionados y Word: 66 comparaciones, sin diferencias respecto al inicio de esta actualización. Permanecen avisos LF/CRLF de index.html y del borrador; no se modifican finales de línea de otros archivos.

La revisión 0.4 observó una modificación externa del Word y releyó §2.2.4; no fue editado por el agente. Esta actualización tampoco modifica Word, SPEC.md, Figma ni código TB3; la aprobación contractual no certifica seguridad ni funcionamiento sin pruebas.

## 23. Resumen ejecutivo y pasos para comenzar Sprint Planning 2

**Base seleccionada:** C simplificada: Supabase Auth/PostgreSQL/Realtime/Storage/Data REST API + localStorage propio + Netlify Free. NVIDIA candidata de IA aún por validar. No otra API REST salvo nueva indicación expresa del profesor; no queda proveedor de fotos/API REST por elegir.

**Sprint Goal candidato:** preservar interfaces TB3 y entregar catálogo/publicaciones compartidas, cuentas, reservas y conversación real, persistencia local propia, GET del catálogo verificable e IA US17 título/descripción editable. El compromiso y SP dependen del Planning real/capacidad; ninguna fila se presenta como terminada.

| Historia o tarea candidata | Aceptación resumida | Principal / dependencia | Riesgo |
| --- | --- | --- | --- |
| US01 + US02 | GET fetch del catálogo, filtrar/ordenar/limpiar, carga/error/vacío/éxito y DOM; filtros recordados e IDs correctos | Angel DOM/Explorar + Bernabé servicio Data REST API; LS | HTTP/RLS/JSON/total consultado |
| US03 + Perfil según backlog | Ficha/vendedor de ID correcto, solo campos públicos, error recuperable | Bernabé / artículos/perfiles | Privacidad y datos reales |
| US04 + US13 | CRUD propio y una foto Storage, visible desde otra cuenta; edición/borrado ajeno rechazado | Matías / Auth/artículos/Storage | Propiedad/validación/orfandad de archivos |
| US05, parte por comprometer | Disponibilidad compartida y transiciones correctas sin sobrescribir reserva/venta | Matías UI + Bernabé servicio | Cobertura original/RPC |
| US09 | Mensajes comprador/vendedor desde dos equipos y recuperación de historial; tercero no accede/suplanta | Maricielo UI + Bernabé servicio; Angel seguridad | RLS/Realtime/reconexión |
| US10 | Campus/lugar público o adicional válido, confirmar y recuperar en reserva | Maricielo UI + Bernabé servicio | No mapas/direcciones privadas |
| US11 + US12 | Reserva/cancelación válida, una activa por artículo incluso con dos compradores simultáneos | Maricielo UI + Bernabé RPC | Transacción/consistencia |
| US17 | IA título/descripción reales, editables, aceptar/descartar/restaurar; no publica ni inventa atributos | Angel IA + Matías interfaz | Free/condiciones/modelo/errores |
| Soporte Auth/registro/Cuenta, sin nueva US inventada | SDK sesión/logout/guardas, cuentas reales y correo según decisión; US06 no completa por formato | Angel servicio + Maricielo UI | SMTP/confirmación |
| Soporte datos/semillas | RLS y seeds privadas idempotentes; catálogo inicial y propios vacíos para cuenta nueva | Bernabé; revisión Angel | Esquema nuevo y permisos |
| Soporte REST verificable | REST-01–06: método GET HTTP, response.ok, JSON, try/catch y DOM; Network sin credenciales. Storage POST adicional | Bernabé consulta + Angel UI; Matías fotos | Prueba real pendiente, no conexión SQL |
| Soporte localStorage | Borrador/preferencias/filtros sobreviven recarga; sin secretos ni negocio como fuente local | Maricielo y consumidores | Sesión SDK no es evidencia única |
| Transversal | URLs públicas, responsive/teclado/errores, diez Nielsen/correcciones, Git/Trello/informe/cinco archivos | Todos; Angel coordina | Plazos/cuotas/evidencias |
| US18/US19 y extras | Solo si capacidad y aprobación posterior; sin SP heredados ni autoguardado | Por decidir | Fuera del mínimo |

**Pasos previos al desarrollo:**

1. Partir del contrato 1.0 ya aprobado y del proyecto Supabase existente (§4.1), manteniendo separada la autorización de implementación.
2. Realizar Planning 2 con disponibilidad real; confirmar mínimo/DoD por US, dueños de archivos/consumidores y ventanas CSS/SQL. Estimar tareas/SP por equipo, calcular velocity con evidencia; no copiar 29 SP comprometidos de Sprint 1.
3. Comprobar Trello público/tareas reales y buscar constancia del acuerdo oral del idioma; confirmar entregas/DD1/horario.
4. Solicitar autorización concreta para inspeccionar/configurar servicios del proyecto existente, accesos restantes, cuotas, correo/redirects y Storage/RLS; validar NVIDIA/condiciones con prueba acotada autorizada, sin facturación ni recrear Supabase.
5. Congelar esquema/IDs/DTO y GET catálogo, RLS/RPC/Storage, SDK/Auth y contrato IA; después tareas por archivo y pruebas tempranas en dos equipos.
6. Solo con autorización, iniciar tareas/ramas/PR y deploy conforme al flujo Git, preservando estado local. No comenzar código/servicios por aprobar la arquitectura.

**Guion candidato ≤12 min, por ensayar:** 0:00–1:00 problema/Sprint/roles/Landing; 1:00–2:15 registro/login según confirmación; 2:15–3:15 Inicio/GET/filtros; 3:15–4:45 Detalle/mensajes y respuesta otro equipo; 4:45–5:45 reserva/lugar; 5:45–8:15 vendedor/activación/publicación/foto/US17; 8:15–9:00 artículo compartido/LS; 9:00–10:00 REST/errores sin secretos; 10:00–11:00 deploy/Nielsen; 11:00–12:00 Git/Trello/cierre. Preparar cuentas/datos y no afirmar un registro que no ocurrió.

**Estado contractual:** **VERSIÓN 1.0 APROBADA, 12/11/2026**. Supabase CampusLoop/ReCampus existe en Free/São Paulo, Healthy observado y acceso de Angel confirmado; accesos restantes y funcionalidad pendientes. Confirmación de correo, NVIDIA, Netlify/despliegue y acuerdos finales de Planning continúan pendientes. No hay implementación autorizada. El inicio operativo y el procedimiento Git se detallan en §24.

SPEC.md conserva TB3; este SPEC planifica TB4; actas/Trello/PR/pruebas/URLs reales acreditarán lo realizado.

## 24. Resumen operativo de inicio de Sprint 2 — plan sin ejecución autorizada

Este apartado es el plan inicial de la versión 1.0, no un tablero de avance. Se parte del proyecto Supabase existente, sin recrearlo. Todo lo siguiente queda para revisión de Planning y autorización posterior; no se ha implementado código, ejecutado SQL, llamado APIs, cambiado ramas ni desplegado.

### 24.1. Dependencias entre integrantes

| Principal preliminar | Entrega a los demás | Depende de |
| --- | --- | --- |
| Bernabé | Esquema/IDs/DTO, RLS/RPC, semillas privadas y servicios artículos/perfiles/reservas/conversaciones/mensajes | Acceso/permisos del proyecto, estados/reglas aprobados y contrato Auth de Angel; revisión conjunta de seguridad |
| Angel | Cliente/Auth compartido; Inicio/Explorar/DOM REST; IA/función y coordinación Netlify/integración | Servicios/datos/RLS de Bernabé; Matías en eventos/UI IA; capacidad/Free/correo y NVIDIA validados tras autorización |
| Matías | Activación, Publicar/CRUD, una foto Storage y UI IA | Auth Angel; artículos/propiedad/RLS y relaciones Bernabé; contrato IA; bucket/permisos de Storage |
| Maricielo | Registro/Login/Cuenta/Reservas/Mensajes UI y utilidades LS propias | Auth Angel y servicios/RPC/Realtime Bernabé; APIs de artículos/estados coherentes; no implementar JWT/SQL duplicados |

Un único principal por archivo de §5, consumidores como revisores. Las interfaces pueden prepararse en paralelo tras acordar contratos; no editar simultáneamente auth.js, articulos.js, SQL, CSS común o el formulario de otro. Bernabé/Angel concentran servicios críticos: revisar su capacidad y redistribuir tareas concretas en Planning sin trasladar toda la carga a Maricielo ni inventar estimaciones.

### 24.2. Orden recomendado de configuración y desarrollo

1. **Planning antes de ejecución:** revisar alcance/DoD, disponibilidad, responsables finales, tareas y SP reales; Trello público y evidencia de reunión. Contrato 1.0 ya aprobado.
2. **Inspección administrativa autorizada del proyecto existente:** ReCampus/CampusLoop, Free/São Paulo, salud actual y permisos por integrante; inventariar configuración existente sin publicar keys ni cambiarla automáticamente.
3. **Contratos e infraestructura:** Bernabé concreta esquema/relaciones/estados, RLS/RPC/migraciones revisadas y receta de seed; Angel concreta cliente/Auth y correo/redirects. Ejecutar SQL o modificar configuración solo con autorización específica.
4. **Primer recorrido autenticado:** interfaces Login/Registro con servicio Auth; lectura del catálogo por GET PostgREST, JSON/DOM y estados. Tras esquema/políticas y autorización, semillas privadas e idempotentes: cuenta nueva ve artículos, pero propios vacíos.
5. **Recorridos compartidos:** Matías CRUD/Storage/activación, Bernabé Detalle/Perfil; Reservas UI Maricielo con RPC Bernabé. localStorage propio se integra en borradores/filtros/preferencias.
6. **Mensajería:** servicios/RLS/Realtime antes de UI integrada; dos cuentas en computadoras distintas, historial persistente/reconexión y tercero sin acceso. Nada de cambio de identidad.
7. **IA en paralelo controlado:** Angel valida acceso gratuito/condiciones NVIDIA y prueba acotada solo autorizada; Matías aplica contrato de sugerencias de título/descripción, revisión humana y sin publicación automática.
8. **Integración/despliegue autorizados:** Netlify Free, secretos solo servidor, artefacto y URLs de ambos productos; pruebas públicas, errores/cuotas, siete anchos, regresiones y Nielsen. Evidencias/documentación desde cada tarea.

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
| US17 IA | Angel API/servidor; Matías interfaz | Free/condiciones primero; título/descripcion revisables, aceptar/descartar/restaurar; errores/secretos/cuotas controlados |
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

### 24.5. Incorporar el SPEC con Git desde una rama basada en develop — procedimiento propuesto

**Estado local observado al aprobar:** main; SPEC_TB4.md sin seguimiento; rama develop local existente. La comparación local develop...integracion/angel mostró **34 commits solo en develop y 0 solo en integracion/angel**; son refs locales, no prueba del estado remoto. Ninguna operación siguiente se ha ejecutado.

1. **Preservar el documento:** comprobar rama/status/diff y guardar una copia verificable del SPEC aprobado antes de cambiar ramas. No descartar trabajo local. Si una rama destino ya contiene SPEC_TB4.md, comparar versiones y resolver antes de sobrescribir; un archivo sin seguimiento no está protegido por historial todavía.
2. **Actualizar referencias, solo con autorización:** fetch remoto y revisar divergencias; actualizar develop mediante fast-forward si procede. Si no puede avanzar así, detenerse y acordar integración, sin reset, rebase o force. Verificar de nuevo el estado, no asumir que el conteo 34/0 sigue vigente.
3. **Preparar destino personal:** el flujo sigue rama de tarea → integracion/angel → develop. Alinear integracion/angel con develop mediante sincronización autorizada y revisada antes del PR documental, para no introducir commits ajenos al SPEC. Actualmente el historial local permitiría evaluar fast-forward, pero no se realiza aquí.
4. **Crear rama documental desde develop actualizado:** nombre propuesto docs/angel/spec-tb4-v1; comando futuro de referencia: `git switch -c docs/angel/spec-tb4-v1 develop`. Restaurar/preservar en ella exclusivamente el SPEC aprobado y comprobar base/diff. La instrucción es propuesta, no permiso de cambiar rama ahora.
5. **Preparar revisión del único archivo:** tras autorización, `git add -- SPEC_TB4.md`, inspeccionar diff staged completo/estadística y `git diff --cached --check`; solo SPEC, estado 1.0/fecha correctos, sin claves. Commit propuesto “docs: aprobar contrato técnico TB4 v1.0”, únicamente cuando se autorice. No usar git add . ni incluir HTML/JS/SQL/configuración.
6. **Publicar y revisar solo autorizados:** push de rama y PR docs/angel/spec-tb4-v1 → integracion/angel; revisión de arquitectura/estado Supabase y conservación del alcance. Después PR integracion/angel → develop, comprobando que el diff real incluya solo lo esperado y sin cambios de otros módulos. Merges/control de main posteriores requieren su propia autorización.
7. **Confirmar trazabilidad:** SPEC en develop con estado/fecha aprobados, tareas Trello/PR/commit reales enlazados; nada de evidencias de commits o PR antes de existir. Continuar con tareas de desarrollo solo tras revisión de Planning, responsables y autorización expresa.

Este procedimiento preserva las ramas personales y la integración final controlada. La aprobación de 1.0 no autoriza fetch, switch, staging, commit, push, PR, merge ni deploy.
