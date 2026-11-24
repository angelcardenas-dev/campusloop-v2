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

## D1.2 — Preparación offline de contexto permitido (22/11/2026)

Rama `feature/angel/agente-memoria`, base
`c03528a1899f56255d7ccc824a95650a9a413e4a`. Archivos de esta entrega:
`js/agente-memoria.js`, `tests/agente/memoria.test.mjs` y esta ampliación del README.
No cambia D1.1 ni se importa el módulo desde las páginas o el montaje. No se añade
al constructor Netlify: no hay consumidor público todavía. `js/localstorage.js`
no existe en esta base; no se crea ni se imita su API.

**Implementado y probado:** selección estructurada, validación, serialización,
expiración, aislamiento y persistencia con un doble explícito. **Pendientes:**
Storage compartido de Maricielo, Auth real, restauración visible tras navegación,
política de retención/borrado y productor real de contexto. **AG-03 no completado.**

### Fronteras y esquema propuesto

Se conserva solamente el último contexto de búsqueda, no una lista de mensajes.
`obtenerHistorial()` de D1.1 no es una fuente para persistir: contiene texto libre.
El método `actualizar()` no recibe un cuerpo del modelo/usuario; consulta un
productor confiable inyectado por el compositor de la aplicación. Ese productor
deberá proyectar decisiones públicas validadas independientemente, no reenviar JSON
del modelo ni basarse en `esPublico: true`. La forma válida no demuestra por sí sola
el origen de un dato; no hay productor productivo conectado en esta entrega.

Propuesta de sobre interno (valores ilustrativos, no cuentas/catálogos reales):

```js
{
  version: 1,
  usuarioId: '<UUID del proveedor de identidad>',
  actualizadoEn: '<ISO UTC canónica generada por reloj inyectado>',
  contexto: {
    tipo: 'busqueda_catalogo',
    categorias: [],
    estados: [],
    condiciones: [],
    precioMinimoCentimos: null,
    precioMaximoCentimos: 10000,
    orden: 'recientes'
  }
}
```

| Campo de contexto | Lista permitida y utilidad |
|---|---|
| `tipo` | Obligatorio, exactamente `busqueda_catalogo`; continuidad de intención. |
| `orden` | Obligatorio: `recientes`, `precio-menor`, `precio-mayor`. |
| `categorias` | UUID únicos presentes en el manifiesto inyectado `categoriasPermitidas`; recordar selección pública. Sin manifiesto no se acepta ninguna categoría. |
| `estados` | Selección pública: `disponible`, `reservado`, `vendido`; no afirma una reserva propia. |
| `condiciones` | `nuevo`, `como_nuevo`, `buen_estado`, `usado`. |
| `precioMinimoCentimos`, `precioMaximoCentimos` | Enteros seguros no negativos o null, mínimo ≤ máximo, PEN; recordar presupuesto. |

Las listas omitidas se normalizan a `[]`, precios omitidos a null. No se coaccionan
tipos; null no vale para listas. Se rechazan duplicados y se ordenan las listas para
una salida determinista. Hay una guardia estructural de 600 entradas antes de
recorrer listas, relacionada con el presupuesto provisional de bytes, no un nuevo
catálogo ni un límite de turnos aprobado. `usuarioId` es un vínculo técnico mínimo
para rechazar sobres copiados a otra clave; no es un perfil, credencial o autorización.

Los códigos y reglas proceden del contrato del catálogo, sin modificarlo. Este
esquema es una proyección de memoria, **no** `adaptarFiltros` ni el DTO de artículos.
No pasarle el objeto completo de filtros: `busqueda`, universidad/campus, nombres,
artículos, imágenes y demás campos no incluidos se rechazan, no se omiten a escondidas.
El cero es válido como filtro según el contrato; no decide si se publican artículos
gratuitos ni cambia SQL.

Se deniegan por defecto correo, teléfono, contraseña, tokens, texto de usuario/modelo,
mensajes de negocio, reservas privadas, instrucciones, roles/permisos, prompts,
resultados de herramientas y confirmaciones de publicación. También getters,
símbolos y propiedades extra/heredadas en los registros. No se usa una regex de PII
como autorización. Los ejemplos negativos prueban el rechazo de esas formas, **no**
una detección universal de PII. Un productor mal conectado podría codificar datos
indebidos incluso en un número: su revisión independiente sigue siendo necesaria.

### API del dominio, todavía interna/propuesta

| Export | Resultado |
|---|---|
| `validarContextoPermitido(contexto, {categoriasPermitidas})` | `{ok, datos: contextoNormalizado, error}`; no autentica ni certifica procedencia. |
| `crearClaveMemoria(usuarioId)` | `{ok, datos: clave, error}`; UUID canónico y prefijo propio fijo. |
| `resumirContexto(contexto, opciones)` | `{ok, datos: textoDeterminista, error}`; solo vocabulario cerrado, sin HTML ni resultados inventados. |
| `crearMemoriaAgente(configuracion)` | Instancia con los métodos siguientes; no abre Storage ni Auth por sí misma. |
| `POLITICA_PROVISIONAL_MEMORIA` | Configuración ilustrativa explícita: 24 KiB y 7 días; no se aplica por defecto. |

Configuración inyectada:

```js
crearMemoriaAgente({
  almacenamiento: null,         // Puerto de prueba; futuro adaptador compartido.
  obtenerIdentidad,             // ({signal}) => Promise<{id: UUID} | null>
  producirContexto,             // ({signal}) => Promise<contextoPermitido>
  categoriasPermitidas: [],     // UUID de catálogo confiable; no del prompt.
  politica: null,               // Sin política explícita no se lee/escribe el puerto.
  ahora: Date.now               // Reloj reemplazable en pruebas.
});
```

Los proveedores pueden ser síncronos o asíncronos. El de identidad futuro debe
proyectar exclusivamente `{id}` desde el servicio Auth oficial y devolver null para
sesión ausente/anónima. No pasar sesión, correo, JWT, URL o prompt. El módulo valida
el UUID y revalida el proveedor antes de publicar resultados; no demuestra una sesión
real mediante un UUID. No importa Auth ni crea clientes o suscripciones.

Métodos de instancia:

- `actualizar()`: obtiene y valida contexto del productor; guarda solo con actor,
  puerto y política explícitos. Éxito `{ok:true, datos:{contexto, persistido}, error:null}`.
- `recuperar()`: lee únicamente la clave del actor actual, valida versión, propietario,
  forma, fecha, TTL y bytes. No renueva la caducidad ni ejecuta búsquedas.
- `borrar()`: vacía RAM y elimina exclusivamente la clave propia si procede; nunca
  `clear()` ni claves del SDK/otra cuenta. Si falla Storage no anuncia borrado exitoso.
- `obtenerContexto()`: copia defensiva síncrona o null; descarta lo expirado o fechas
  imposibles por retroceso del reloj. No es una prueba actualizada de identidad.
- `invalidarIdentidad()`: síncrono, borra contexto/actor efímeros y cancela esperas.
  No decide borrar automáticamente datos persistidos al cerrar sesión.
- `desmontar()`: invalida y cierra la instancia; resultados tardíos no reaparecen.

Los tres métodos asíncronos siempre devuelven `{ok, datos, error}`. Ante fallo,
`datos:null` y error seguro con código/mensaje: `CONTEXTO_INVALIDO`,
`IDENTIDAD_INVALIDA`, `CONFIGURACION`, `TAMANO`, `FORMATO`, `VERSION`, `EXPIRADO`,
`ALMACENAMIENTO`, `CUOTA` o `CANCELADA`. No se devuelve la excepción original.
Si falla un guardado, el nuevo contexto permitido puede continuar en RAM mediante
`obtenerContexto()`; ningún método recibe o altera el borrador del textarea de D1.1.

### Puerto mínimo propuesto para coordinar con Maricielo

Estas son operaciones internas del puerto, **no exports confirmados** de su módulo:

```js
leer(clave, {signal})                 // {ok:true, datos: string | null, error:null}
guardar(clave, json, {signal})        // {ok:true, datos:null, error:null}
eliminar(clave, {signal})             // {ok:true, datos:null, error:null}
// Fallo: {ok:false, datos:null, error:{codigo:'CUOTA' | otroCodigoSeguro}}
```

El dominio valida el contenido y genera su JSON; no administra claves genéricas,
sesiones, borradores ni preferencias. El futuro adaptador debe mapear la API que
Maricielo realmente entregue a este puerto o acordar ajustes antes de integrarlo.
También se normalizan excepciones del puerto, incluida `QuotaExceededError`.

El adaptador debería respetar `signal` y finalizar sus operaciones. El dominio
rechaza pronto la espera cancelada y descarta respuestas obsoletas. Conserva un
trabajo físico activo y, como máximo, el pendiente más reciente para impedir que
una escritura antigua termine sobre una nueva de la misma instancia. Si el puerto
ignora abort, no se puede deshacer su escritura ya iniciada; escribe solo su clave
original, nunca la del nuevo actor. Si además no finaliza, la siguiente operación
física debe esperar: no se promete cancelación física ni transacciones. No hay
bloqueo entre pestañas/instancias ni defensa contra quien controle el JavaScript.

### Retención, privacidad e integración pendientes

Clave provisional: `campusloop_tb4_v1_agente_historial_<usuarioId>`. TTL y bytes se
configuran explícitamente y pueden reducirse en pruebas, con topes provisionales de
7 días y 24 KiB. Se mide UTF-8, se rechaza JSON excesivo antes de parsear, versiones
distintas de 1, propiedades extra, fechas no canónicas/futuras y edad ≥ TTL. Corrupto
o expirado se invalida sin restaurarlo ni sobrescribirlo; puede eliminarse mediante
`borrar()`. No se implementan migraciones silenciosas de versiones.

Solo un contexto reemplazable: sin crecimiento de historial. La propuesta histórica
de 20 turnos no se declara ratificada ni se implementa como 20 mensajes persistidos.
Un anónimo conserva solo RAM y no crea una clave de invitado ni recupera la cuenta
anterior. La separación por UUID/sobre no cifra ni protege ante XSS, manipulación
del navegador, otro script o un usuario con acceso al mismo perfil. Revalidar contra
servicios/RLS antes de actuar; el resumen es dato conversacional, nunca una orden,
una autorización o prueba de disponibilidad.

Futura conexión: acordar retención/consentimiento y puerto con Maricielo; productor
de contexto permitido y manifiesto real con los responsables del catálogo; puente
de identidad basado en las siete funciones Auth. El evento de cambio de cuenta/
logout deberá llamar inmediatamente a `invalidarIdentidad()` antes de renderizar
otro actor, y programar la recuperación fuera del callback del SDK. No se crean
suscripciones en esta entrega. Sin esa conexión, el módulo no puede detectar un
logout externo entre dos llamadas. Ratificar también cuándo eliminar la clave propia:
la invalidación por sí sola no borra datos persistidos.

Después podrá prepararse una interfaz explícita del widget para el contexto; nunca
conectar `obtenerHistorial()` directamente al almacenamiento. Actualmente no hay
restauración automática ni visible en Inicio/Explorar y no se publica el módulo en
`dist/`. El manifiesto/proveedor de pruebas usa solo UUID sintéticos, sin afirmar
que existan usuarios, categorías o registros en Supabase.

### Verificación D1.2

```powershell
node --test tests/agente/memoria.test.mjs
node --check js/agente-memoria.js
node --check tests/agente/memoria.test.mjs
git diff --check
```

La primera entrega de memoria cubrió los 41 escenarios solicitados (40/41 agrupados
en una prueba de importación con trampas de red/Storage global), más endurecimiento
y carreras de identidad/almacenamiento: resultado histórico **49 correctas,
0 fallidas, 0 omitidas**.
Son 49 pruebas distintas de las 49 históricas de Chrome D1.1, que no se repiten aquí.
La prueba 29 guarda un presupuesto de 10000 céntimos en el Map simulado, crea otra
instancia y recupera el resumen «Estábamos buscando artículos con presupuesto máximo
de S/ 100.00 ordenados por los más recientes. Debemos volver a consultar el catálogo.»
Esto demuestra continuidad entre instancias del doble; no persistencia real en un
navegador, navegación, Auth, catálogos o cumplimiento de AG-03. No se ejecutan suites
ajenas, Chrome, builds ni llamadas a proveedores en D1.2.

### Corrección final de continuidad D1.2 — 22/11/2026

El inicio de cada operación cancelaba la anterior mediante `invalidarIdentidad()`;
eso también borraba el último contexto válido aunque no hubiera cambiado la cuenta.
Se separan `cancelarOperacion()` y `limpiarContexto()`. La invalidación explícita
combina ambas; `iniciar()` solo cancela operaciones anteriores.

Una actualización puede conservar el contexto previo, con su fecha original,
únicamente si el proveedor vuelve a verificar la misma cuenta y el contexto no ha
caducado. Mientras se resuelve la identidad inicial, el contexto previo no se expone.
La marca interna de identidad confirmada permite conservar ese candidato sin
exponerlo, incluso ante dos actualizaciones consecutivas; se descarta si la cuenta
no coincide o no puede verificarse.
Ante contexto nuevo inválido o error de productor se revalida otra vez identidad y
caducidad antes de conservarlo. El error sigue devolviendo `datos:null`: el contexto
anterior permitido se consulta mediante `obtenerContexto()`. No se guarda la entrada
rechazada, no se modifica `actualizadoEn` ni se renueva el TTL. Si no existía contexto
válido, no se crea uno para ocultar el fallo.

Identidad desconocida, inválida, no verificable o distinta descarta el contexto previo.
Logout con invalidación explícita, desmontaje y borrado limpian RAM inmediatamente.
Secuencias y señales impiden que una espera obsoleta restaure o invalide datos de una
operación nueva; se comprueba la vigencia después de las esperas de revalidación.
No se añaden colas: se conserva el único trabajo físico activo y el pendiente más
reciente. Un fallo de persistencia puede seguir dejando el contexto nuevo permitido
en RAM, tras revalidar la misma identidad y su caducidad.

Se conservan sin cambios las 49 pruebas anteriores y se añaden diez:

| Caso adicional | Comprobación offline |
|---|---|
| Continuidad 01 | Contexto válido seguido de actualización inválida: conserva RAM para la misma cuenta. |
| Continuidad 02 | Rechazo sin escribir ni persistir contenido inválido. |
| Continuidad 03 | Fecha original y vencimiento exacto del TTL sin renovación por el fallo. |
| Continuidad 04 | Caducidad antes o durante la operación: no restaura contexto expirado. |
| Continuidad 05 | Cambio A → B, logout sin evento, ID inválido o proveedor fallido: no conserva A, al inicio o durante el productor. |
| Continuidad 06 | Logout con invalidación durante una operación: limpieza inmediata y respuesta tardía descartada. |
| Continuidad 07 | Desmontaje durante una operación: no reaparece contexto anterior ni nuevo. |
| Continuidad 08 | Borrado después del fallo: elimina RAM y únicamente la clave propia. |
| Continuidad 09 | Excepción síncrona/asíncrona del productor sanitizada, con o sin contexto previo. |
| Continuidad 10 | Actualizaciones consecutivas y respuestas tardías de identidad, productor o revalidación: no pierden, sustituyen ni invalidan indebidamente el contexto vigente. |

Resultado de esta corrección: **59 correctas (49 anteriores + 10 nuevas), 0 fallidas,
0 omitidas**. Identidades, reloj y puerto son dobles sintéticos. No se ejecutan
Chrome, Netlify ni suites de otros módulos. No hay persistencia productiva ni puente
Auth conectado: la integración con Maricielo y los eventos reales de identidad,
la restauración visible y la ratificación de retención/borrado siguen pendientes.
**AG-03 no se declara completado.**

## D1.3A — Coordinador offline y presentación opcional — 22/11/2026

Base de esta entrega: `04a77e254aa76ffede53ebe714f24de7fdb0f6df`, tras PR #50.
Rama: `feature/angel/agente-memoria-integracion`. No confundir las evidencias
históricas D1.1/D1.2 con las comprobaciones de esta integración.

### Implementado, sin activar en páginas

`js/agente-memoria-coordinador.js` compone el widget y la memoria D1.2 mediante
puertos inyectados. Importa únicamente el dominio D1.2; no importa Auth, Storage,
catálogo, SDK ni un proveedor IA. La memoria sigue sin DOM. No hay montaje ni
restauración automática y crear el coordinador no consulta identidad o almacenamiento.
Un WeakMap mantiene un coordinador por instancia de widget, sin suscripciones repetidas.

```js
crearCoordinadorMemoria({
  widget,                      // Instancia de montarAgente() con el puerto opcional.
  obtenerIdentidad,             // ({signal}) => {id: UUID} | null; también asíncrono.
  almacenamiento: null,         // Puerto propuesto de D1.2; doble en esta entrega.
  producirContexto,             // Productor independiente y confiable; no historial.
  categoriasPermitidas: [],     // Manifiesto confiable; no categorías del modelo.
  politica: null,               // Sin política explícita no se accede al puerto.
  ahora: Date.now               // Reloj inyectado; valores sintéticos en pruebas.
});
```

| Método del coordinador | Comportamiento |
|---|---|
| `restaurar()` | Verifica identidad, recupera solo su clave mediante D1.2 y presenta resumen determinista. |
| `actualizar()` | Invoca el productor estructurado, valida mediante D1.2 y presenta el contexto permitido; no recibe texto del chat. |
| `borrar()` | Limpia historial visible y contexto, cancela la operación previa y elimina solo la clave propia cuando hay puerto/política configurados. |
| `invalidarIdentidad()` | Síncrono: cancela operaciones, limpia contexto, texto efímero y voz/TTS del widget, y cierra el panel. No decide borrar automáticamente datos persistidos. |
| `desmontar()` | Cancela memoria, retira escucha/registro y limpia datos efímeros y voz. No elimina el DOM del widget; su propietario conserva el desmontaje D1.1. |

Los métodos asíncronos devuelven `{ok, datos, error}`. Se conservan los códigos seguros
del dominio. Identidad inválida/fallida nunca se transforma en una cuenta ficticia;
el anónimo conserva el chat efímero, sin clave persistente. Las respuestas canceladas
no pueden restaurar contexto ni limpiar datos de un montaje nuevo. La cola física
acotada pertenece a D1.2: el coordinador no añade otra. Un puerto que ignore abort no
permite deshacer una escritura ya iniciada y puede retrasar una eliminación; no se
prometen transacciones o bloqueo entre pestañas.

### Puerto opcional del widget, compatible con D1.1

- `presentarMemoria({estado, resumen})`: un aviso acotado dentro del log existente,
  construido con `createElement` y `textContent`, sin mover foco ni editar textarea.
  Estados de comprobación, contexto recordado/preparado/conservado, ausencia,
  error y borrado son distintos. Nunca se anuncia resultado de catálogo o IA real.
- `limpiarMemoria()`: elimina solamente ese aviso.
- `limpiarPorIdentidad()`: limpia historial, borrador y avisos, detiene voz/TTS y cierra
  el panel; al estar abierto devuelve el foco al launcher.
- `escucharAccionesMemoria(callback)`: devuelve limpieza; notifica `borrar` solo por
  el botón (después de limpiar la vista) y `desmontar` al desmontar el widget. El
  coordinador no repite ese borrado/anuncio. El registro no emite evento inicial.
  Las llamadas programáticas a `borrarHistorial()` siguen siendo solo visuales;
  para coordinar borrado de memoria usar `coordinador.borrar()`.

El aviso usa la región `role=log`, `aria-live=polite`, `aria-atomic=false`; se etiqueta
como memoria de contexto y no como respuesta IA. No se incorpora a `obtenerHistorial()`
ni al TTS, que sigue leyendo exclusivamente la bienvenida pública. El resumen de
la UI debe proceder del coordinador: renderizar una cadena como texto evita XSS,
pero no convierte texto libre en contenido público autorizado para persistir.
No hay nuevos controles, estilos o cambios en el diseño aprobado. Sin coordinador,
el montaje actual conserva el comportamiento D1.1 y no restaura nada.

### Auth y almacenamiento: interfaces reales y dependencia pendiente

Se inspeccionaron las siete exportaciones oficiales: `registrar`, `iniciarSesion`,
`obtenerUsuarioActual`, `obtenerEstadoAuth`, `cerrarSesion`, `requerirAutenticacion`
y `escucharCambiosAuth`. No se añaden funciones ni clientes de Auth.
El futuro proveedor debe invocar `obtenerUsuarioActual()` fuera de callbacks del SDK:
éxito con usuario `{id, correo}` se proyecta explícitamente a `{id}`; éxito con
`datos:null` devuelve null; `ok:false` debe tratarse como fallo de verificación,
no como sesión anónima válida. El coordinador rechaza DTO con correo/sesión/campos
extra. No se pasa el objeto Auth completo a la memoria ni se leen JWT manualmente.

La conexión futura de eventos usará `escucharCambiosAuth(callback)`, cuya cancelación
ya devuelve una función; no se abre ninguna suscripción en D1.3A. Logout, cambio
de cuenta o error de sesión deberán invalidar inmediatamente antes de renderizar
otra cuenta y recuperar fuera del callback. Sin ese puente, no se detectan cambios
externos entre llamadas: ni un UUID local ni la memoria son autorización del servidor.

`js/localstorage.js` **no existe en esta base**. El anuncio de Maricielo no equivale
a código/API revisados. El puerto mínimo interno propuesto sigue siendo:

```js
leer(clave, {signal})          // {ok:true, datos:string|null, error:null}
guardar(clave, json, {signal}) // {ok:true, datos:null, error:null}
eliminar(clave, {signal})      // {ok:true, datos:null, error:null}
// Fallo: {ok:false, datos:null, error:{codigo:'CUOTA' | codigoSeguro}}
```

Estos nombres no son exports ratificados de Maricielo. D1.3B deberá comparar su API
real y adaptar el puerto, preservar errores/cuota y resolver cancelación y orden.
Clave por UUID, versión, 24 KiB, 7 días y política de logout/borrado siguen siendo
propuestas, sin escritura productiva. `localStorage.clear()` está excluido.

El productor productivo tampoco existe en esta entrega. No copiar el objeto completo
de filtros ni `obtenerHistorial()`; D1.2 rechaza `busqueda` libre, datos privados,
resultados de herramientas y campos desconocidos. Bernabé conserva su servicio y PR #52.

### Qué demuestra la continuidad y qué sigue pendiente

La primera instancia guarda en un Map de prueba un presupuesto de 10000 céntimos.
Tras desmontar, una instancia nueva resuelve la misma identidad y presenta:
«Contexto recordado: Estábamos buscando artículos con presupuesto máximo de
S/ 100.00 ordenados por los más recientes. Debemos volver a consultar el catálogo.»
El usuario puede seguir escribiendo y ese texto no se guarda automáticamente.
Esto acredita **continuidad temática estructurada**, no memoria de una conversación
completa, persistencia real en Chrome ni navegación/recarga con localStorage.

**[PROPUESTA PARA REVISIÓN, no implementada]:** si hace falta mayor continuidad,
acordar un resumen conversacional estructurado con intención de vocabulario cerrado,
hechos públicos confirmados y procedencia verificable por la aplicación. Cada campo
adicional requiere utilidad, validación, revisión de privacidad y retención propias.
No autorizar texto libre/resúmenes del modelo por una regex o `esPublico:true`.
Esta propuesta no amplía el esquema D1.2 ni modifica el contrato aprobado.

D1.3B requiere API de Maricielo revisada, retención/consentimiento/borrado aprobados,
proveedor real de identidad y eventos, productor confiable y conexión explícita al
widget. Después, previa autorización, probar navegación Inicio ↔ Explorar y recarga
en Chrome. **AG-03 continúa pendiente.** No hay proveedor IA o herramientas reales.

### Verificación focalizada D1.3A

```powershell
node --test tests/agente/coordinador.test.mjs tests/agente/memoria.test.mjs
node --test tests/agente/navegador.test.mjs
node --check js/agente-memoria-coordinador.js
node --check js/agente-ui.js
node --check tests/agente/coordinador.test.mjs
node --check tests/agente/navegador.test.mjs
git diff --check
```

Resultados: **19 pruebas de coordinador**, **59 de dominio D1.2** y **52 en Chrome**
(51 subpruebas y contenedor), sin fallos ni omisiones en las ejecuciones finales.
Las 49 comprobaciones históricas de D1.1 se conservan; se añaden tres subpruebas
de DOM/ARIA/foco, continuidad con widget real + Map y borrado/logout/voz-TTS.
Se usa el arnés existente porque cambia el widget; no se ejecutan suites ajenas.
Las identidades, almacenamiento, tiempo, reconocimiento y TTS son dobles explícitos.
El DOM, teclado y CSS de Chrome son reales; no se usó micrófono físico. Las peticiones
externas se bloquean; no hubo red de aplicación ni accesos a Web Storage global.

La ejecución inicial de Chrome dentro del sandbox no habilitó CDP; se ejecutó con
el permiso de proceso correspondiente, sin relajar los bloqueos del navegador.
Se corrigió el `await` del nuevo montaje auxiliar CDP mediante una función async;
no se cambiaron expectativas para ocultar un fallo de producción.

Solo el servidor del arnés admite los dos módulos de memoria para probarlos.
**No** se modifica la lista de Netlify ni el montaje de Inicio/Explorar o la Landing.
`agente-ui.js` no importa esos módulos; `agente-montaje.js` permanece intacto.
No se requiere un build: no cambian dependencias publicadas. En D1.3B habrá que
autorizar las entradas `js/agente-memoria.js` y `js/agente-memoria-coordinador.js`
en `RECURSOS` antes de importar el coordinador desde una página publicada.

## D1.3B — contexto con Web Storage nativo; activación productiva pendiente

Esta sección actualiza el estado descrito en los cortes históricos D1.1–D1.3A.
Se conserva el esquema permitido D1.2: intención de búsqueda, categorías de un
manifiesto confiable, estados/condiciones de catálogo, precios en céntimos y orden.
No se persisten mensajes, transcripciones, resultados completos ni texto libre.

### Extensión compartida para revisión de Maricielo

`crearAlmacenamientoLocal({ memoriaAgente: { politica, categoriasPermitidas }, ... })`
añade tres métodos específicos, conservando borradores, nueve filtros y preferencias:

- `leerContextoAgente(usuarioId)` devuelve `{ ok, datos: jsonONull, error }`.
- `guardarContextoAgente(usuarioId, documentoJSON)` devuelve éxito con `datos:null`
  solo si el documento D1.2 es válido y `setItem` terminó sin error.
- `eliminarContextoAgente(usuarioId)` elimina únicamente la clave propia.

La clave sigue siendo `campusloop_tb4_v1_agente_historial_<UUID>`. No se añade una
categoría genérica ni se reutiliza filtros; no hay `clear()` ni recorrido de claves.
La escritura exige política explícita; la lectura entrega JSON crudo al dominio,
que rechaza propietario ajeno, corrupción, versión, campos y fechas inválidos.
`validarDocumentoMemoria()` extrae el mismo validador puro usado por D1.2: el módulo
compartido importa ese dominio, sin interpretar otro esquema ni envolver el JSON.
No cambia la fecha ni renueva el TTL al leer. Se reutilizan resolución de Storage
y errores normalizados del módulo de Maricielo. Esta ampliación requiere su revisión.

### Adaptador, identidad y ciclo de página

`crearAdaptadorStorageAgente({ almacenamiento, obtenerActor })` expone el puerto
`leer(clave,{signal})`, `guardar(clave,json,{signal})`, `eliminar(clave,{signal})`.
Solo acepta la clave canónica del actor previamente verificado; comprueba señal
y actor antes/después del acceso síncrono. Traduce cuota a `CUOTA` y los demás
fallos a `ALMACENAMIENTO`, sin mensajes privados ni éxito falso.

`conectarMemoriaAgente({ widget, autorizada, politica, producirContexto,
categoriasPermitidas, ahora, almacenamiento, auth })` compone los módulos.
`almacenamiento` y `auth` son inyecciones controladas para pruebas; si se omiten,
se preparan el Storage compartido y las dos funciones oficiales de `auth.js`.
Solo se proyecta `{id}` de `obtenerUsuarioActual()`; nunca sesión, correo ni JWT.
`restaurar()`, `actualizar()`, `borrar()`, `invalidarIdentidad()` y `desmontar()`
son su interfaz. No recibe contexto desde mensajes ni desde `obtenerHistorial()`.

El consentimiento en «Privacidad y voz» es accesible, inicialmente desmarcado y
efímero: debe renovarse en cada página/recarga. No se inventa una tercera preferencia
persistente junto a `reducirMovimiento`/`filtrosMovilAbiertos`. Revocar cancela y
retira contexto de RAM sin perder el borrador ni decidir borrado persistente.
El borrado explícito elimina solo la clave de la cuenta, y comunica si falla.

Logout/cambio/error de identidad limpian inmediatamente contexto, borrador privado,
voz y TTS. Cada IO vuelve a verificar la identidad; un aviso del SDK no autentica.
`INITIAL_SESSION`/`SIGNED_IN`/`TOKEN_REFRESHED` de la misma cuenta ya verificada
conservan contexto, consentimiento y borrador, sin renovar TTL. El primer
`INITIAL_SESSION` válido, sin consentimiento ni identidad anterior, no limpia el
chat efímero. Esta excepción no se aplica tras haber usado una identidad anterior.
Logout, cuenta diferente, estados incompatibles y avisos no verificables invalidan
y exigen nueva elección; no se eliminan automáticamente claves persistentes.
Los datos del aviso nunca asignan actor; cada IO vuelve a consultar Auth.
Se cancelan respuestas
obsoletas y suscripciones al desmontar. Hay una conexión por widget y un montaje
por documento, incluyendo `pagehide`/`pageshow` y remontaje manual.

`agente-montaje.js` prepara el puente en Inicio/Explorar, pero **autorizada=false**
por defecto. Sin habilitación, configuración pública, política y productor no
se inicia Auth ni se accede a Storage. El puente habilitado prepara una suscripción
Auth; sin consentimiento no consulta identidad ni lee/escribe contexto. La configuración real sigue vacía y no hay
productor confiable conectado: el catálogo permanece en modo pendiente.
El checkbox publicado queda deshabilitado y el chat, dictado y TTS siguen funcionando.
La Landing no se modifica ni carga el agente. No hay consultas de catálogo al restaurar.

### Verificación D1.3B

```powershell
node --experimental-vm-modules --test tests/localstorage/localstorage.test.mjs tests/agente/memoria.test.mjs tests/agente/coordinador.test.mjs tests/agente/persistencia.test.mjs
node --test tests/agente/navegador.test.mjs
node --check js/agente-memoria-conexion.js
node --check js/agente-storage-adaptador.js
node scripts/preparar-netlify.mjs
git diff --check
```

El arnés Chrome conserva las regresiones DOM/CSS/teclado y dobles de voz D1.1/D1.3A.
Sus nuevas pruebas habilitan explícitamente Storage nativo en un perfil temporal,
con identidad **sintética inyectada**, política provisional y productor sintético.
Se comprueba `localStorage instanceof Storage` y su prototipo nativo: no es un Map.
El recorrido guarda S/100 en Inicio, navega a Explorar, recupera tras elección,
recarga y vuelve a recuperar; después borra y recarga sin reaparición.
No se persiste el consentimiento ni el borrador. Se verifican cuentas A/B, logout,
foco, cancelación de voz, ciclo de página, suscripción única y borrado selectivo.
El servidor y CDP bloquean red externa; no se usan cuentas ni credenciales reales.
Los fallos de Storage, JSON/TTL/versión, Auth y concurrencia se provocan mediante
dobles en Node. Eso no acredita autenticación real, cuota física ni micrófono físico.

Ejecución histórica anterior a la corrección Auth: **152 pruebas Node correctas** (59 dominio, 19 coordinador,
31 conexión/adaptador y 43 almacenamiento compartido, incluidas las 38 regresiones),
sin fallos ni omisiones. **59 comprobaciones Chrome correctas** (58 subpruebas y
contenedor), sin fallos ni omisiones; Chrome 157.0.8103.79 y Node 24.15.0.
Se conserva evidencia temporal fuera del repositorio. Sintaxis: 12 archivos válidos.
Build local: **64 archivos, 14 HTML y 379 referencias locales correctas**.

Se añaden explícitamente a Netlify cinco recursos requeridos por las importaciones:
`agente-memoria.js`, `agente-memoria-coordinador.js`, `agente-memoria-conexion.js`,
`agente-storage-adaptador.js` y `localstorage.js`. El build sigue sin desplegarse.

**AG-03 sigue pendiente.** Lo acreditado es persistencia selectiva nativa con
identidad sintética y continuidad temática, no memoria íntegra de conversación.
Faltan configuración/identidad real autorizada, productor confiable del catálogo,
revisión de Maricielo, ratificación de consentimiento, retención y borrado en logout,
y autorización para activar recuperación productiva. Versión 1, máximo 24 KiB y
7 días son límites técnicos provisionales. La preferencia persistente de consentimiento
requiere un contrato posterior; no se ha modificado el SPEC ni los contratos.
La separación de claves no es una frontera de autorización: quien controla el
navegador puede inspeccionar o modificar Web Storage. Ningún dato recordado acredita
identidad, permisos, disponibilidad de artículos ni autoriza acciones del servidor.

### Corrección focalizada de eventos Auth

Se reprodujeron antes de corregir tres fallos en las nuevas pruebas: pérdida del
borrador por `INITIAL_SESSION` sin consentimiento, revocación innecesaria por
`SIGNED_IN` coincidente y conservación indebida ante un estado Auth incompatible.
No se relajaron las expectativas anteriores. Se añadieron diez pruebas Node para
los ocho casos solicitados, revalidación antes de IO y rechazo de la excepción
inicial cuando ya hubo una identidad anterior. Los callbacks antiguos se ignoran al desmontar.
Un aviso ilegible/incompleto o de error deniega recuperación, sin exponer excepciones.

Resultado de esta corrección: **162 pruebas Node correctas** (59 memoria, 19
coordinador, 41 persistencia/adaptador y 43 Storage compartido), ninguna fallida u
omitida. **60 comprobaciones Chrome correctas** (59 subpruebas y contenedor),
ninguna fallida u omitida. Se añade un caso con DOM real para borrador, foco y
checkbox ante los avisos Auth, con identidad inyectada; no acredita Supabase real.
Las pruebas de dictado/TTS siguen usando dobles explícitos.

No se repite el build en este ajuste: no cambia el grafo de importaciones ni su
inventario. El resultado de 64 archivos/14 HTML/379 referencias anterior es
histórico; `dist/` no se ha regenerado con esta corrección. La memoria productiva
sigue deshabilitada y AG-03 pendiente de las dependencias ya documentadas.

## D1.3C — Productor propuesto y ciclo de vida

`crearProductorContextoCatalogo({ obtenerSeleccion, categoriasPermitidas })` entrega
una función asíncrona compatible con el puerto `producirContexto({ signal })` de
D1.2. La fuente inyectada debe proporcionar exclusivamente la proyección estructurada
ya validada por el catálogo. Se reutiliza `validarContextoPermitido`, con copia de
la lista autorizada de categorías, y se rechazan campos adicionales, datos privados,
valores fuera de contrato y resultados posteriores a una cancelación. El error no
incluye los datos de entrada. El módulo no lee chat, red ni Storage y no se monta
en producción. Los UUID sintéticos de pruebas no son categorías de producción.

`validarFiltros` del controlador es privado y las opciones reales no están integradas;
no hay todavía un puerto que acredite selección y categorías de una fuente confiable.
Un puente futuro, coordinado con los responsables, deberá proyectar únicamente
`tipo`, categorías verificadas, estados, condiciones, precios en céntimos y orden;
excluirá búsqueda libre, universidad y campus hasta que exista política aprobada.
La lista de categorías tendrá que provenir de un catálogo autorizado, no del modelo,
del chat ni de un manifiesto inventado. Un UUID válido no demuestra procedencia.
El nuevo módulo aún no es recurso Netlify ni se importa en las páginas.

El control de conexión desmontado ignora `invalidarIdentidad()`; las conexiones
vigentes siguen invalidando RAM y operaciones en logout y cambios de cuenta.
Las pruebas usan dobles de Auth y Storage; no prueban identidad Supabase real.

**Registro histórico de D1.2/D1.3A (superado por la ratificación de D1.3D):** en
esa etapa, versión 1, 24 KiB y siete días eran provisionales; el consentimiento era
efímero y quedaba pendiente decidir el borrado persistente en logout. La coordinación
ratificó posteriormente la política descrita en D1.3D, sin que eso equivalga a la
aceptación funcional de AG-03.

AG-03 continúa pendiente: falta productor conectado y verificado, identidad real,
consentimiento y retención aprobados, activación autorizada y pruebas reales entre
páginas. La continuidad temática con dobles no es memoria del hilo completo.

## D1.3D — Continuidad de la selección de Explorar

Con activación explícita en el montaje, aplicar filtros válidos en Explorar entrega
al productor solo categorías, estados, condiciones, importes en céntimos y orden.
La selección se puede recordar aunque el catálogo esté en modo pendiente. La
restauración muestra el resumen y no lanza consultas. Inicio y Explorar usan el
mismo montaje. El historial escrito o dictado sigue siendo efímero.

**Política ratificada por coordinación y Maricielo.** Un documento v1 por cuenta
reemplaza al anterior, con un máximo de 24 KiB y siete días. Frente a la propuesta
de hasta 20 turnos, aquí solo se guarda una selección. El módulo compartido mantiene
el documento en localStorage. La elección explícita se guarda en sessionStorage
de la pestaña como huella del usuario y la sesión verificados, sin copiar el JWT.
Navegar o recargar conserva la elección. La revocación elimina elección y contexto.
Borrar conversación elimina el contexto y permite seguir recordando nuevas selecciones.
SIGNED_OUT en el montaje activo limpia RAM, elección y el documento del actor conocido.
El cambio de cuenta invalida inmediatamente la vista y requiere consentimiento válido.
El consentimiento se vincula a pestaña y sesión autenticada. No se persisten mensajes,
transcripciones, texto libre privado, tokens ni resultados completos de herramientas.
Un fallo de eliminación se informa. El TTL de siete días invalida la recuperación
de un documento vencido; no acredita una purga física automática en segundo plano.

**Antes de activar.** Proporcionar
un entorno autorizado con configuración pública y cuentas registradas. Verificar
getUser y los claims de cuenta registrada y sesión del SDK. Suministrar las
categorías de un directorio autorizado y verificar sus permisos efectivos. La
lista por defecto está vacía. Mantener la activación deshabilitada hasta aprobar
el recorrido real. La política ratificada no equivale a aceptación funcional:
AG-03 continúa pendiente.

La prueba de navegador usa las páginas y el productor de la aplicación, Chrome
local con DevTools, localStorage y sessionStorage nativos, un proveedor Auth
sintético y red externa bloqueada. Comprueba la recuperación de un presupuesto
aplicado en Explorar al regresar a Inicio, volver a Explorar y recargar. Verifica
aislamiento entre cuentas y sesiones, logout, revocación, borrado, caducidad,
JSON corrupto, cuota simulada y conservación del borrador. El perfil temporal
de prueba contiene exclusivamente datos sintéticos.

### Cierre técnico D1.3D

El aviso de privacidad separa mensajes escritos o dictados (solo RAM) del contexto
estructurado que puede guardarse con consentimiento. El estado de memoria indica
si la integración no está autorizada o configurada. El desplegable ocupa espacio
propio y se desplaza internamente; el consentimiento aparece primero. El borrado
visible se anuncia por separado del resultado del borrado persistente.

`cerrarSesion()` conserva su resultado habitual en el camino correcto y ahora
consulta `getUser()` antes de `signOut({ scope: 'local' })`. Después del cierre
notifica sincrónicamente a `escucharCierreSesionLocal(callback)` para cancelar
operaciones de widgets activos y usa `eliminarContextoAgente(usuarioId)` del módulo
compartido para borrar únicamente la clave del usuario verificado. También elimina
la huella de consentimiento de sessionStorage en esa pestaña. Si el cierre falla,
no borra la memoria. Si el cierre ocurre pero no puede verificarse o completarse
el borrado, devuelve `MEMORIA_NO_BORRADA` con un mensaje controlado que distingue
el cierre efectivo del borrado no confirmado. No cambia claves del SDK ni datos
de otras funciones.

`obtenerUsuarioActual()` sin opciones conserva su DTO anterior. La opción
`verificarSesionMemoria: true` exige claims `sub`, `is_anonymous: false` y
`session_id` coherentes con `getUser()`, y entrega solamente `{ id, sesionId }`;
no expone JWT ni sesión cruda. Esta ampliación y el resultado de borrado parcial
están documentados como extensiones aprobadas del contrato Auth. Los eventos Auth
son avisos de cambio,
nunca prueba suficiente de autorización; cada acceso a memoria revalida la cuenta.

La coordinación entre pestañas cooperantes usa una marca compacta de generación
por cuenta y Web Locks para serializar escrituras, borrado manual y revocación. La
marca existe aunque todavía no haya documento; perderla o encontrarla corrupta
desactiva la recuperación y exige una elección explícita nueva. Al crear una marca
por consentimiento nuevo, elimina primero cualquier documento huérfano. Borrar manualmente
incrementa solo la generación operativa, elimina el documento y conserva el
consentimiento. Revocar o cerrar sesión incrementa ambas generaciones y borra el
documento de esa cuenta. La marca acotada incluye un indicador de limpieza
pendiente: si la eliminación falla, una elección posterior debe confirmar el
borrado del documento anterior antes de reactivar el consentimiento. La escritura
verifica bajo el mismo bloqueo que su consentimiento y generación operativa siguen
vigentes; una operación comenzada
antes del borrado o revocación no puede recrear el documento al terminar.

La coordinación cubre pestañas cooperantes del mismo origen y perfil que compartan
Web Storage y Web Locks. No es una transacción de Web Storage ni protege frente a
otros dispositivos, scripts hostiles, fallo del navegador o autorización del
servidor. Si Web Locks no está disponible, la memoria persistente se deshabilita y
el chat sigue temporal. `storage`, `pageshow` y `visibilitychange` solo disparan
revalidación: no son una fuente de identidad ni una garantía de que una pestaña
suspendida reciba eventos en tiempo real. El cierre local del SDK tampoco cierra
sesiones en otros dispositivos.

La política de memoria ya está ratificada, pero la activación productiva permanece
deshabilitada. AG-03 sigue pendiente de aceptación con Auth real, configuración
autorizada, categorías del directorio confiable y recorrido funcional aprobado.

## D2 — Registro y orquestador offline

`js/agente-herramientas.js` conserva los siete nombres **propuestos** en el
contrato del agente §7. `confirmar_publicacion` queda fuera del registro. La
fábrica `crearOrquestadorHerramientas({ obtenerIdentidad, servicios,
categoriasPermitidas, universidadesPermitidas, campusPermitidos })` recibe un proveedor que ya verificó Auth y proyecta
exclusivamente `{ id }`. No se conecta automáticamente al widget, al SDK ni al
modelo. Categorías, universidades y campus requieren listas obtenidas de un
directorio confiable; por defecto están vacías. La búsqueda usa la firma vigente
`consultarCatalogo(filtros, { signal })` cuando se inyecta el servicio de Bernabé.

Los puertos `consultarMisReservas(id, { signal })` y
`consultarEstadoVendedor(id, { signal })` son **propuestas internas de inyección**,
no exports aprobados de Bernabé. Sin ellos, la herramienta correspondiente
responde `INTEGRACION_PENDIENTE`. Reservas se proyecta únicamente a ID/estado
para presentación directa al titular; `destino: titular` solo clasifica la
salida y no es una frontera de seguridad. D3 debe impedir que datos privados de
reservas lleguen al contexto del proveedor NVIDIA. El borrador devuelve solo
título/descripción editables para revisión humana y no
llama al controlador de Matías. Cuenta, estado vendedor como consulta separada,
publicaciones propias y recomendaciones quedan registradas pero deshabilitadas
hasta contar con servicios, privacidad y contratos efectivos. Intercambios y
reputación carecen de nombres/firma ratificados y no entran al registro.

La ejecución offline con dobles no acredita RLS, Auth real, artículos reales,
reservas reales ni publicación. Los límites HTTP/turnos y el proveedor de IA
siguen pendientes. Los topes locales de 8192 unidades UTF-16 de JSON normalizado y
24 resultados por operación son defensivos y no constituyen una cuota aprobada.
D1.3D conserva su estado y AG-03 continúa pendiente.
