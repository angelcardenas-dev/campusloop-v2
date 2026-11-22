# D1.1 — Interfaz global del agente (Ángel)

Base: `b9bb0a2b484461ff99bd37db2e5cbc8f767d016b`. Rama de trabajo:
`feature/angel/agente-global-widget`. Esta entrega implementa UI local; no implementa
el modelo, herramientas, autorización, cuotas ni memoria persistente del agente.
El asistente histórico de Publicar, sus eventos y `/api/asistente` permanecen intactos
y no se consumen desde este componente.

## Montaje y ciclo de vida

Las páginas `inicio.html` y `explorar.html` cargan `css/agente.css`
después de `css/styles.css` y el módulo ES `js/agente-montaje.js`. No hay botones
duplicados en los HTML. La extensión a otras páginas requiere coordinación posterior.
Coordinación retiró el widget de la Landing `index.html`: no carga sus recursos
ni lo monta. Esta decisión debe reflejarse después en SPEC y contrato mediante una
tarea documental autorizada; el rediseño no modifica los contratos aprobados.

## Rediseño visual

Launcher circular de 56 px con robot SVG propio; panel de hasta 368 × 520 px,
cabecera azul con avatar, estado neutral «En preparación» y un solo control Cerrar.
El launcher se oculta realmente al abrir y reaparece con foco al cerrar: no hay un
segundo botón flotante ni controles duplicados de minimizar/cerrar.

Las burbujas informativas se alinean a la izquierda; las del usuario, a la derecha.
El historial tiene scroll independiente. Añadir mensajes cerca del final mantiene
la vista actualizada; no salta al final si se están leyendo mensajes anteriores.
El composer permanece visible y contiene textarea redondeado, micrófono y envío
iconográficos. La etiqueta y ayuda de longitud siguen disponibles para accesibilidad.
La altura del textarea crece de forma acotada con contenido multilínea.

Borrar conversación es un control discreto junto al desplegable de privacidad.
La bienvenida tiene un único control de altavoz que alterna entre leer y detener;
su nombre accesible, icono y estado ARIA cambian según la reproducción. Los mensajes
del usuario nunca se leen. El desplegable explica privacidad y capacidades de voz
sin desplazar el composer.

Respecto a la referencia: el avatar es un SVG de trazo propio, no la ilustración
de robot de la captura; se utiliza la paleta CampusLoop y no se inventa identidad
para personalizar el saludo. Se conserva solo Cerrar, con borrador e historial
intactos al reabrir. El estado visible siempre identifica que no existe IA conectada.

`montarAgente({ documento, Reconocimiento, sintesis, Locucion })` de
`js/agente-ui.js` devuelve una instancia por documento con:

- `raiz`: contenedor DOM propio.
- `abrir()` / `cerrar()`: panel no modal; foco inicial y devolución al botón.
- `borrarHistorial()`: borra mensajes visibles y conserva el borrador editable.
- `obtenerHistorial()`: copia defensiva de los mensajes locales `{ rol, texto }`.
- `obtenerDiagnosticoVoz()`: copia técnica acotada del último intento; API, botón,
  idioma, contador y tipos/códigos de eventos. No contiene audio ni transcripciones.
- `desmontar()`: cancela voz/lectura, retira listeners y observer, borra datos y DOM.

`desmontarAgente(documento)` permite limpiar desde fuera. `iniciarAgente(documento)`
en el módulo de montaje es idempotente y devuelve una función de desconexión del
ciclo de página. `pagehide` desmonta y `pageshow` vuelve a montar una instancia limpia;
no se conserva la conversación al navegar, recargar ni restaurar desde bfcache.

La interfaz de consulta/borrado del historial prepara una separación para D1.2,
sin imponer un contrato nuevo a `js/localstorage.js`. Maricielo y Ángel deben acordar
el adaptador, consentimiento, clasificación del contexto permitido y eliminación.
El texto libre de esta UI no debe persistirse indiscriminadamente. No se implementa
una segunda capa de almacenamiento ni se considera cumplido AG-03.

## Texto, voz y accesibilidad

Los mensajes se construyen con DOM y `textContent`. Enter envía localmente;
Shift+Enter conserva saltos de línea y la composición IME no dispara envíos.
El campo admite 1000 caracteres y se conservan los últimos 20 mensajes de usuario
en memoria. Son límites de UI, no una cuota de proveedor o servidor.
Los estados identifican que el agente no está conectado: nunca hay respuesta del
modelo, consulta, publicación, autenticación ni persistencia simulada como real.

El micrófono se inicia solo por acción explícita, usa `SpeechRecognition` o
`webkitSpeechRecognition` con `es-PE` y deja la transcripción editable, sin enviarla.
La disponibilidad real de idioma, permisos y reconocimiento depende del navegador;
este puede usar un servicio remoto propio. El componente no graba ni guarda audio.
Cerrar, editar durante la escucha, ocultar o desmontar cancela la escucha y descarta
eventos tardíos. Se distinguen activación y escucha iniciada.

La lectura es adicional y explícita: únicamente la bienvenida pública constante,
con una voz española disponible o el mecanismo predeterminado del navegador.
El mismo control permite detenerla; cerrar, iniciar micrófono o desmontar cancela la lectura.
No se leen mensajes del usuario ni se bloquea el texto si faltan APIs de voz.

El panel utiliza `role="dialog"` sin modalidad ni trampa de foco. Incluye Escape,
botones etiquetados, asociación del campo, errores ARIA y log no atómico que anuncia
adiciones sin repetir toda la conversación. CSS propio con prefijo `cl-agente-`,
tokens existentes y foco visible. Launcher de 56 px, controles del composer de 44 px
y secundarios de 32–36 px con nombres accesibles. La geometría contempla navegación
inferior, áreas seguras y `visualViewport`; el panel no se desplaza al crecer los
mensajes y el campo sigue visible en altura reducida.

## Prueba focalizada reproducible

Requiere Node con `WebSocket` nativo (ejecutado con v24.15.0) y Chrome ya instalado
en `C:\Program Files\Google\Chrome\Application\chrome.exe`. No instala paquetes.

```powershell
node --test tests/agente/navegador.test.mjs
node --check js/agente-ui.js
node --check js/agente-montaje.js
node --check tests/agente/navegador.test.mjs
git diff --check
```

La suite inicia servidor de loopback y perfil Chrome temporal aislado. Bloquea
peticiones externas y reemplaza explícitamente reconocimiento, síntesis, `fetch`
de aplicación y acceso a localStorage/sessionStorage. Utiliza DOM, CSS y teclado
reales de Chrome; voz, permisos y errores de voz son simulados. Si Chrome falta,
la suite se marca omitida: no descarga un navegador ni atribuye un resultado verde.
Los perfiles y evidencias se conservan fuera del repositorio, en la ruta temporal
impresa al terminar. El favicon se responde con 204 exclusivamente en el servidor
de pruebas; no se modifica el sitio para ello.

Cobertura focalizada:

- Montaje único, apertura/cierre, foco, Escape, Tab y salida del panel no modal.
- Vacío, longitud, Enter/Shift+Enter/IME, envío local y HTML inerte.
- Reconocimiento explícito, transcripción editable, cancelación rápida, permisos
  denegados, ausencia de voz, errores, edición concurrente y resultados tardíos.
- TTS público, parada/cancelación, APIs ausentes o con errores.
- Borrado, copia defensiva, historial acotado y ausencia de red/almacenamiento.
- Launcher circular, controles SVG etiquetados, privacidad por teclado, burbujas,
  scroll independiente, estado de lectura y composer fijo.
- Landing sin widget; ciclo de página en Inicio y Explorar; geometría, IDs y
  referencias ARIA a 320 × 700, 390 × 844, 768 × 1024, 1024 × 768, 1440 × 900
  y 390 × 420, incluida composición multilínea y errores con altura reducida.
- 24 capturas abiertas/cerradas en las dos páginas y seis tamaños, cuatro capturas
  de mensajes locales y ocho de hover (launcher/enviar, dos páginas y dos anchos).
  Registros `geometria.json` y `estilos.json` fuera del repositorio.
- Estilos computados normal, hover, active, focus-visible y disabled en los dos
  botones principales a 390 y 1440 px; iconos legibles con contraste de al menos 4.5:1.
- Siete errores de voz diferenciados, fin sin resultado y diagnóstico sanitizado.

Resultado actual del ajuste hover/voz: **49 pruebas correctas, 0 fallidas, 0 omitidas**
(48 subpruebas y su contenedor). El rediseño anterior obtuvo 43 correctas; se añadieron
dos escenarios de cascada CSS, tres códigos de error y un escenario de diagnóstico.
Se mantienen los escenarios funcionales de D1.1;
la geometría pasa a las dos páginas autorizadas con seis tamaños y la Landing se
comprueba sin widget. Resultado histórico anterior al rediseño: 47 correctas y
build con 371 referencias, con widget entonces en tres páginas.

Build histórico del rediseño: **59 archivos, 14 HTML y 369 referencias locales correctas**.
Las dos referencias retiradas corresponden exclusivamente a Landing.
Los nuevos recursos públicos siguen siendo únicamente `css/agente.css`,
`js/agente-ui.js` y `js/agente-montaje.js`. Pruebas y README no se copian a `dist/`.
La construcción no demuestra conectividad ni funcionamiento de un agente real.
No se repitió el build en este ajuste: no hay dependencias ni recursos nuevos y
no se modificó Netlify. El contenido generado anteriormente no valida estos últimos
cambios CSS/JS. Cuando corresponda reconstruir: `node scripts/preparar-netlify.mjs`.

**Verificación nueva para publicación de D1.1 — 21/11/2026:** se ejecutaron otra vez
la suite focalizada (49 correctas, 0 fallidas, 0 omitidas), sintaxis JavaScript,
`git diff --check` y el build local (59 archivos, 14 HTML, 369 referencias locales
correctas). Se comprobó que los tres recursos nuevos coinciden con sus copias
generadas y que pruebas, documentación, SQL y código servidor quedan fuera de
`dist/`. Este corte es posterior a los resultados históricos anteriores; no implica
despliegue ni validación del modelo IA.

## Hover y diagnóstico de reconocimiento — 21/11/2026

La regla anterior `button:hover:not(:disabled)` tenía especificidad `(0,3,1)`
incluyendo el prefijo raíz; superaba a las variantes de botones `(0,3,0)` y dejaba
un fondo claro con icono blanco. `button:where(:hover):not(:disabled)` reduce la
regla común a `(0,2,1)`. Las variantes conservan sus colores y se añaden estados
presionado/deshabilitado explícitos; no se cambian tokens globales ni se añade
`!important` para resolver la cascada.

| Estado principal | Fondo computado | Icono |
|---|---|---|
| Normal | `#2640a9` | Blanco |
| Hover | `#1f3490` | Blanco; contraste 10.76:1 |
| Active | `#182a78` | Blanco |
| Focus-visible | Azul y contorno sólido de 3 px | Blanco |
| Disabled | `#eef2ff` | Azul `#182a78` |

Las pruebas mueven/presionan el puntero real de CDP. Para inspeccionar la cascada de
focus-visible fuerzan exclusivamente esa pseudoclase en Chrome; la navegación real
con Tab/Enter/Escape permanece cubierta por sus pruebas independientes. Todas las
aserciones leen `getComputedStyle()`, incluido el trazo del SVG, no solo reglas CSS.

| Código de reconocimiento | Mensaje y alcance |
|---|---|
| `not-allowed` | Bloqueo por permisos, privacidad o seguridad; no demuestra por sí solo un fallo físico. |
| `service-not-allowed` | El navegador no permite el servicio solicitado. |
| `audio-capture` | Falló la captura del micrófono; comprobar conexión/disponibilidad. |
| `network` | Fallo de conexión/disponibilidad del servicio de voz, sin atribuirlo automáticamente a permisos. |
| `language-not-supported` | `es-PE` no admitido; no se cambia silenciosamente de idioma. |
| `no-speech` | No se detectó voz. |
| `aborted` | Reconocimiento cancelado. |

Los códigos siguen la [especificación Web Speech](https://webaudio.github.io/web-speech-api/#speechreco-error).
Un fin sin resultado informa que no hubo transcripción. Errores desconocidos reciben
un mensaje seguro y código `desconocido`. Una excepción síncrona `NotAllowedError`
se clasifica como bloqueo; otros fallos de inicio no se presentan como permisos.

El diagnóstico conserva solo los últimos 12 eventos procesados del intento actual,
con copia defensiva y borrado al desmontar. No registra `event.message`, audio,
contenido reconocido ni texto del formulario, ni imprime datos en consola.
Después de resultado/error se cancela y limpian listeners: eventos nativos tardíos,
incluido un eventual `end` posterior, se descartan. No es una traza completa del motor.

Inspección nativa ejecutada en perfiles limpios **headless**, sin dobles de Web Speech,
desde `http://127.0.0.1:5501/inicio.html`:

| Comprobación | Chrome 157.0.8103.79 | Brave, motor Chromium 158.0.8127.42 |
|---|---|---|
| API estándar/prefijada | Presente | Presente |
| Botón habilitado | Sí | Sí |
| Contexto seguro | Sí | Sí |
| Permiso de micrófono del perfil aislado | `prompt` | `prompt` |
| `available({langs:['es-PE'], processLocally:false})` | `available` | `available` |
| Consulta equivalente de `es-ES` | `available` | `available` |
| `start`, eventos y transcripción físicos | NO EJECUTADOS | NO EJECUTADOS |

No se concedieron permisos, cambiaron protecciones ni instalaron paquetes/modelos.
Estas consultas son declaraciones del navegador: no demuestran captura ni
transcripción funcional y no describen los permisos del perfil personal de Ángel.
El fallo concreto reportado en Brave sigue sin causa confirmada.

Brave documenta el problema histórico de una [API expuesta sin resultados](https://github.com/brave/brave-browser/issues/2802)
y un [soporte local inicial solo en inglés](https://github.com/brave/brave-browser/issues/56487).
Son antecedentes relevantes, no evidencia de qué error emitió el perfil de Ángel.
La consulta con `processLocally:false` admite disponibilidad local o remota; no se
activó un motor local ni un fallback. Cambiar a `es-ES` sin un error real de idioma
y una prueba funcional no demostraría que se resolvió el problema.

### Evidencias manuales aportadas por coordinación

**REPORTADO por coordinación para la publicación de D1.1; no ejecutado por la
suite automatizada ni sustituido por sus dobles:**

- Google Chrome: reconocimiento con micrófono real satisfactorio; la frase
  pronunciada apareció como texto editable.
- Google Chrome y Brave: lectura hablada funcional, comprobada manualmente.
- Brave: el reconocimiento termina aproximadamente un segundo después de
  activarse, sin obtener transcripción. La causa técnica sigue sin confirmar.

Estos resultados complementan la inspección headless histórica de la tabla
anterior. Las pruebas con dobles no acreditan el funcionamiento del hardware.
No existe conexión al modelo IA, herramientas reales ni memoria persistente.
No se incorporan audio ni transcripciones privadas al repositorio.

### Procedimiento para reproducir y ampliar la evidencia física

1. Servir el proyecto con Live Server en `http://127.0.0.1:5501` y abrir Inicio.
2. En Chrome, abrir el agente, pulsar micrófono y responder al permiso del navegador.
3. Decir «Quiero buscar una calculadora»; comprobar campo editable, corrección manual
   y ausencia de envío automático. Repetir en Brave sin cambiar sus protecciones.
4. Antes de reintentar o desmontar, consultar únicamente la copia técnica:

```js
const { montarAgente } = await import('/js/agente-ui.js');
montarAgente().obtenerDiagnosticoVoz();
```

5. Registrar los tipos/códigos de eventos y permiso del sitio, sin compartir texto
   privado. Si no aparecen resultados, distinguir falta de `start`, fin sin resultado
   y error. No inferir permisos o idioma a partir de un mensaje genérico.

Las comprobaciones físicas anteriores fueron reportadas por coordinación. No se
repitieron aquí con audio físico; síntesis y reconocimiento son capacidades distintas.

## Pendiente de comprobación real

- Ampliar la comprobación física a otros navegadores/dispositivos y diagnosticar
  el fin sin transcripción en Brave. El éxito manual de Chrome y la lectura en ambos
  están reportados por coordinación; ninguno se acredita mediante los dobles.
- Teclado virtual y áreas seguras de dispositivos físicos; la prueba de altura
  reducida comprueba geometría de Chrome, no emula un teclado móvil real.
- Lectores de pantalla reales, navegación bfcache real y otros navegadores.
- D1.2 con el adaptador aprobado de Maricielo; no hay persistencia entre páginas.
- Cliente/backend del nuevo agente, identidad y permisos por herramienta, cuotas,
  servicios reales, confirmación humana y extensión al inventario final de rutas.
- Despliegue y pruebas con proveedor: no ejecutados ni habilitados por D1.1.
