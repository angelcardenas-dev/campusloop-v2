# Explorar TB4 — preparación offline y propuesta de Inicio

Rama `feature/angel/catalogo-explorar`, base
`e6433813b8ec3da03fa040bc1fecd57775797ff9`. Contrato superior: SPEC_TB4.md §§5, 6 y 8.
Esta preparación no conecta Supabase ni acredita REST-01/06 o catálogo compartido real.

## Alcance implementado

- `js/catalogo.js`: estado, filtros de presentación, cancelación, plazos, renderizado
  seguro y conexión a los elementos de Explorar. Sin imports, fetch, SDK, SQL,
  tokens, almacenamiento propio ni servicio alternativo.
- `explorar.html`: controles nativos, aviso visible, filtros Mobile desplegables,
  búsqueda sincronizada entre cabecera/Mobile, estado accesible y dos regiones
  independientes para ejemplos Figma y resultados de pruebas.
- `css/styles.css`: únicamente reglas explore- dentro de EXPLORAR / ANGEL.
- `tests/catalogo/fixtures.mjs`: opciones/IDs y registros exclusivamente sintéticos.
- `tests/catalogo/catalogo.test.mjs`: pruebas Node/VM sin DOM ni red.
- `tests/catalogo/navegador.test.mjs`: Chrome instalado y servidor estático local,
  sin paquetes adicionales; recursos externos bloqueados. No usa Live Server ni
  realiza llamadas REST. Valida que la página sea compatible con un servidor estático.

Abrir manualmente con Live Server desde la raíz:
`http://127.0.0.1:5501/explorar.html`.

## Estado honesto sin el servicio de Bernabé

La página arranca en pendiente y conserva las ocho tarjetas de Figma completas.
Aplicar/buscar/ordenar no filtra esas tarjetas ni anuncia resultados recibidos.
Se pueden preparar búsqueda, precios y orden; las opciones sin IDs/valores
confirmados permanecen deshabilitadas. No se inventa una relación universidad/campus.
No hay import obligatorio ni detección por red de articulos.js: ese archivo no existe.

El controlador solo llama la dependencia inyectada cuando `modo: 'prueba'` y están
las tres funciones de adaptación/consulta. Ese modo identifica los resultados
como prueba offline. No se incluye un modo remoto habilitado ni fixtures en el
archivo de producción. Activar servicio real exige una tarea posterior autorizada.

No filtra, ordena o recorta registros en memoria: delega la selección completa a
consultarCatalogo y respeta el orden recibido. No utiliza los ejemplos como fallback
de una consulta fallida o vacía. Muestra el número de esta respuesta; nunca un total
global ni Página 1 de 1 inventados. La paginación real requiere acuerdo independiente.

## Frontera con el servicio compartido

Se conserva la firma aprobada `consultarCatalogo(filtros, { signal })` y el retorno
`{ ok, datos, error }`, con datos array según §8. No se presupone su DTO final.
Para pruebas se pasan tres funciones a crearControladorCatalogo/montarCatalogo:

| Dependencia | Responsabilidad |
| --- | --- |
| consultarCatalogo | Servicio de Bernabé en integración futura; doble local solo en tests actuales |
| adaptarFiltros(seleccionUI) | Convertir selección de UI a los filtros definitivos acordados; no construir SQL, URL, cabeceras o fetch |
| adaptarArticulo(dto) | Proyectar el DTO validado por el servicio a la tarjeta de presentación; no adivinar relaciones o valores ausentes |

Estos adaptadores son interfaces de integración propuestas, no campos nuevos de
PostgreSQL ni cambios al SPEC. El DTO y parámetros REST siguen pendientes de Bernabé.
Los nombres claveSoloPrueba/rotuloSoloPrueba de fixtures NO son un DTO aprobado.

Selección de UI entregada a adaptarFiltros:

```js
{ busqueda, categorias, universidad, campus, estados, condiciones,
  precioMinimoCentimos, precioMaximoCentimos, orden }
```

Arrays contienen únicamente valores de las opciones suministradas. Universidad y
campus son UUID o cadena vacía; campus debe pertenecer a la universidad seleccionada.
Precio vacío significa null, no un límite oculto. Se convierten cadenas decimales
en céntimos enteros sin redondear importes inválidos. Se rechaza mínimo > máximo.
Órdenes de UI: recientes, precio-menor, precio-mayor; NO son expresiones order de REST.
El borrador usa precioMinimo/precioMaximo como cadenas y filtrosIniciales() proporciona
sus valores vacíos. Aplicar y limpiar son explícitos; Enter busca; elegir orden aplica.

Opciones de presentación (no tablas de BD), todas vacías por defecto:

```js
{ categorias: [{ id, etiqueta }], universidades: [{ id, etiqueta }],
  campus: [{ id, etiqueta, universidadId }],
  estados: [{ valor, etiqueta }], condiciones: [{ valor, etiqueta }] }
```

No convertir las etiquetas Figma a enums autoritativos. Deben acordarse valores,
multi-selección, filtros combinados, consulta por universidad y equivalencias de orden.

## Tarjeta de presentación propia de la UI

Resultado de adaptarArticulo, distinto del DTO del servicio:

```js
{ id, titulo, precioCentimos, moneda: 'PEN',
  categoriaTexto, ubicacionTexto, vendedorTexto, estadoTexto,
  tono, foto: { url, alt } }
```

ID debe ser UUID del registro recibido; precio entero no negativo seguro y título
1–100 caracteres. Textos opcionales se omiten cuando faltan; no se crean vendedores,
reseñas, verificación o nombres de campus. Tono neutral/positivo/aviso es exclusivamente
una elección visual de UI, no el enum de disponibilidad del backend. Se rechazan
IDs repetidos, respuestas incompatibles o más de 100 registros; este límite defensivo
no trunca una página silenciosamente y debe acordarse con el tamaño de página real.

Solo se copia esta proyección; campos extra del DTO no se reflejan en DOM/estado.
Se usa createElement/textContent y atributos explícitos. HTML recibido se muestra
como texto, nunca se ejecuta. Fotos locales assets/images reutilizadas; fotos remotas
requieren orígenes HTTPS exactos autorizados en origenesImagen. No se aceptan data,
javascript, credenciales o parámetros sensibles en URL. Foto ausente/insegura/rota
produce Sin fotografía; no se descarga de otro proveedor ni se inventa una imagen.

Detalle dinámico está **deshabilitado por defecto**. detalle.html actualmente es
la ficha estática MacBook: no abrirla para cualquier producto. Cuando Bernabé resuelva
el ID, deberá confirmarse el nombre del parámetro y autorizar
`detalle: { habilitado: true, parametro: nombreAcordado }`. crearRutaDetalle produce
una ruta local al UUID recibido. articuloPrueba usado en tests no es un parámetro
aprobado del producto. El enlace MacBook de los ejemplos HTML conserva su recorrido
histórico, identificado como demostrativo; las otras tarjetas siguen pendientes.

## Ciclo, accesibilidad y errores

Estados de UI: pendiente, preparado, cargando, listo, vacio y error. Una nueva
consulta o edición cancela la anterior mediante AbortController y secuencia;
resoluciones tardías no sustituyen la selección actual. Timeout ≤20 s, 15 s por
defecto, sin reintentos automáticos. Reintentar usa los filtros conservados;
Limpiar borra selección/precios/búsqueda y consulta solo en modo de prueba disponible.
No se presenta el aborto intencional como caída del servicio.

Estado anunciado fuera de aria-busy; resultados ocupados solo durante la solicitud
activa. Inputs con labels, fieldset/legend, checkboxes/select nativos; Enter aplica,
Escape cierra filtros Mobile y devuelve foco. Error de precio abre el panel y
marca aria-invalid. Al redimensionar no se deja foco dentro de filtros ocultos.
Desconectar elimina listeners, media query y solicitud; el arranque escucha pagehide.
Al regresar desde bfcache, pageshow vuelve a conectar la UI en modo pendiente;
no deja los controles inactivos ni restaura una consulta sintética como real.

El módulo no implementa Auth ni decide permisos con un filtro visual. Antes de la
integración real, el servicio debe resolver sesión y aplicar RLS. No garantiza acceso
a datos porque el HTML muestre una cabecera autenticada. Tampoco utiliza localstorage.js:
persistencia propia de filtros/borradores corresponde a Maricielo y sus consumidores.

## Diferencias deliberadas frente a TB3 y pendientes con el SPEC

- Aviso visible de integración pendiente; incrementa altura y desplaza el catálogo.
- Controles nativos reemplazan simulaciones; aparece un selector independiente de
  campus y un botón Mobile para cerrar filtros. Se conservan tokens, rejillas,
  fotos, tipografía y dimensiones de tarjetas.
- Máximo 3000 deja de ser un valor aplicado implícitamente: se muestra Sin máximo.
- No se afirma que las cuentas estén verificadas por un dominio de correo.
- El contador y pie estáticos identifican ejemplos; ya no afirman un total remoto.
- No se realizó una nueva consulta Figma: la comparación automatizada utiliza los
  archivos aprobados del commit base, a 390/1440 px. No equivale a una nueva revisión
  de los frames en Figma. Fotos y tamaños de tarjetas se comparan con esa base.
- Datos/IDs reales, relaciones, valores de estado/condición, DTO, campos públicos,
  búsqueda, orden, paginación/total y ruta de Detalle requieren acuerdo con Bernabé.
- Términos desde footers y guardas Auth de las páginas siguen siendo tareas
  transversales pendientes; no se sustituyen aquí con controles ficticios.

## Preparación propuesta de Inicio — sin modificarlo

Inicio conserva María, métricas 1/3/5, mensajes, próxima entrega y recomendaciones
como contenido estático identificado. No derivar esos números del catálogo ni de
fixtures. Sus datos de reservas/mensajería corresponden a los servicios de Maricielo/
Bernabé. La identidad tendrá que proceder del servicio Auth/perfiles autorizado.

Propuesta posterior: conectar solo home-recommendations/home-products al mismo
consultarCatalogo y adaptadores acordados, con estados propios y cancelación al
abandonar; conservar cabecera y bienvenida. Acordar criterio de recomendaciones,
límite/paginación y estados del servicio. Si hay un límite, anunciar solo esa
respuesta, sin simular personalización ni un catálogo completo. Las tarjetas podrán
reutilizar la proyección de presentación con un render propio home-; no duplicar REST.
Revisar conjuntamente enlaces a Detalle y disponibilidad de publicaciones reales.
No se ha editado inicio.html ni las interfaces/lógica de otros integrantes.

## Ejecutar las pruebas sin descargar dependencias

Node v24.15.0 y Chrome instalado en Windows para las pruebas de navegador:

```sh
node --experimental-vm-modules --test tests/catalogo/catalogo.test.mjs
node --test tests/catalogo/navegador.test.mjs
```

La segunda prueba inicia Chrome headless y un servidor HTTP efímero limitado a
archivos del proyecto. Requiere permiso del entorno para procesos/conexiones locales;
si Chrome no está instalado se omite y no se descarga. Usa perfil temporal aislado,
bloquea destinos externos, guarda capturas y comparacion.json en Temp y elimina
solo ese perfil comprobando sus rutas absolutas. No ejecuta SQL, SDK ni API remota.
La simulación se inyecta desde el código de pruebas, sin exponer hooks globales en
catalogo.js ni añadir fixtures a la pantalla pública. El test no abre un WebSocket
a Supabase; el WebSocket local solo controla Chrome.

Pruebas reales de Supabase/REST/RLS, total/paginación y catálogos finales siguen
pendientes. Las pruebas offline no acreditan esos requisitos ni filtros persistentes.

Resultados de preparación: 40 pruebas unitarias de catálogo y 143 de regresión
Auth/IA correctas (183 en la ejecución conjunta). La revisión de visibilidad volvió
a ejecutar las 40 unitarias de catálogo. Chrome valida ahora 24 escenarios
concretos más su contenedor (25 resultados Node): siete anchos, teclado y foco,
consulta sintética, siete matrices de visibilidad efectiva y ocho regresiones de
páginas existentes. El primer intento
restringido agotó su plazo; la ejecución local autorizada pudo completarse. Estos
resultados corresponden a Chrome headless y servidor local de pruebas, no a una
sesión manual de Live Server ni a pruebas de servicios externos.

## Revisión de visibilidad efectiva — 13/11/2026

No se modificó CSS durante esta revisión: la regla existente
`.explore-main [hidden] { display: none !important; }`, dentro de EXPLORAR / ANGEL,
prevalece sobre `.explore-products { display: grid; }` y `.button { display: inline-flex; }`.
Se comprueba `getComputedStyle(elemento).display` de los cuatro elementos, junto
con la ausencia de cajas de renderizado cuando están ocultos; no basta con hidden.

| Estado | demo-products | live-products | retry | pagination |
| --- | --- | --- | --- | --- |
| pendiente | grid | none | none | block |
| cargando | none | none | none | none |
| listo | none | grid | none | none |
| vacío | none | grid, sin tarjetas | none | none |
| error de consulta | none | none | flex | none |
| reintento en curso | none | none | none | none |
| reintento correcto | none | grid | none | none |
| error de validación | none | none | none | none |

El botón visible computa flex porque es un hijo flex de .alert; cuando está hidden
computa none. Las promesas de consulta se controlan desde la prueba para inspeccionar
cargando y reintento sin depender de una demora arbitraria. La matriz se verifica a
320, 390, 768, 1024, 1280, 1440 y 1920 px: 77 observaciones, sin desbordamiento,
sin tarjetas Figma/resultados simultáneos y sin consultas para filtros inválidos.
Sin servicio, aplicar filtros conserva los ocho ejemplos completos. El aviso sigue
visible, con role=status y aria-live=polite, fuera del contenedor aria-busy.
El archivo visibilidad.json de evidencias contiene las mediciones por estado/ancho.

Comparación geométrica contra el commit base con filtros Mobile cerrados:

| Ancho | Primera tarjeta antes / después | Posición vertical antes → después |
| --- | --- | --- |
| 390 | 171 × 410 px / igual | 412 → 584 px (+172) |
| 1440 | 238,25 × 442 px / igual | 268 → 382 px (+114) |

El desplazamiento se debe al aviso visible y al texto de preparación; el ancho/alto
de las tarjetas y las ocho fotografías se conservan. El selector adicional de
campus alarga la columna de filtros. Las capturas baseline-390/1440.png,
explorar-<ancho>.png y comparacion.json quedan en la carpeta temporal que imprime
la prueba. No se incorporan capturas, perfiles Chrome o fixtures al despliegue público.
