# Inicio TB4 — preparación offline

Rama `feature/angel/inicio-landing`, base
`89c9780ba7f725080da76d396a62faeeb587fac2` (merge real del PR #28).
Se verificó merged=true antes de cambiar ramas. develop e integracion/angel se
actualizaron mediante fast-forward; solo integracion/angel se publicó como parte
del paso Git autorizado. La implementación se incorpora mediante un único commit
y un PR de la rama feature hacia integracion/angel; fusionarlo requiere una
autorización independiente.

## Alcance y archivos

- `js/landing.js`: UI de **inicio.html**, no la Landing pública index.html.
- `inicio.html`: arranque ES module, aviso visible para identidad/actividad de
  Figma, regiones independientes para tarjetas demostrativas y de pruebas,
  estado accesible y acciones de consulta/reintento.
- `css/styles.css`: únicamente reglas home- e IDs home- en INICIO / ANGEL;
  ocultación efectiva con [hidden], avisos y fotografía ausente.
- `tests/landing/landing.test.mjs`: pruebas aisladas Node/VM del controlador.
- `tests/landing/navegador.test.mjs`: Chrome instalado, servidor local temporal,
  respuestas inyectadas únicamente por la prueba y destinos externos bloqueados.
- `tests/catalogo/navegador.test.mjs`: ajuste autorizado de la regresión histórica
  de Inicio; conserva todas las comprobaciones de Explorar y de las otras páginas.
- Este README: frontera de integración, resultados y limitaciones.

SPEC_TB4.md, Auth, IA, js/catalogo.js, explorar.html, SQL, formularios y servicios de los
demás integrantes permanecen intactos. No se instala ninguna dependencia.

## Reutilización con Explorar

landing.js importa únicamente crearControladorCatalogo desde ./catalogo.js.
Reutiliza sus filtros de presentación, validación de vistas públicas, listas de
orígenes de imágenes, generación de rutas por UUID, errores seguros, AbortController,
secuencia de solicitudes y plazos. No contiene fetch, SDK, SQL, tokens ni un
segundo cliente/servicio Supabase. La importación de catálogo no monta Explorar
en Inicio: cada página usa su propio atributo data-inicio o data-catalogo.

El render es propio de Inicio con clases home-, createElement/textContent y
atributos explícitos; no reutiliza clases explore- ni ejecuta HTML recibido.
Los textos opcionales ausentes se omiten, sin inventar vendedores, campus,
calificaciones o verificación. Fotos inseguras/ausentes/rotas tienen un placeholder.

## Contrato de integración propuesto — sin DTO ni enums nuevos

Se conserva la firma aprobada:

```js
consultarCatalogo(filtros, { signal }) // Promise<{ ok, datos, error }>
```

No se importa articulos.js mientras no exista. No hay detección del servicio por
red, fixtures en producción ni modo remoto habilitado. Por defecto la página queda
pendiente; no realiza ninguna consulta. Los cuatro artículos originales de Figma
permanecen completos, identificados como ejemplos, sin filtrarlos localmente.

La prueba utiliza las mismas tres dependencias propuestas para Explorar:

```js
montarInicio({
  raiz: document.body,
  modo: 'prueba',
  consultarCatalogo, adaptarFiltros, adaptarArticulo,
  opciones, origenesImagen, detalle, timeoutMs
});
```

Solo modo prueba con las tres funciones habilita la consulta simulada. Los
resultados y acciones se identifican como pruebas; no se anuncian datos reales.
Montar prepara la UI, pero no consulta automáticamente. crearControladorInicio
también se puede usar sin DOM y ofrece obtenerEstado(), preparar(), consultar()
y desconectar(). montarInicio devuelve consultar(), obtenerEstado() y desconectar();
desmontarInicio(raiz) permite limpiar el montaje activo.

consultar() solicita la selección UI existente `{ orden: 'recientes' }` al
controlador compartido. adaptarFiltros recibe sus campos normalizados, incluidos
los filtros vacíos y precios null, y deberá traducirlos al contrato final de
Bernabé. **recientes no es una columna SQL ni un orden REST aprobado.** No se
afirma que el resultado esté ordenado, recomendado o personalizado realmente.

adaptarArticulo proyecta el DTO final a la misma vista de presentación documentada
en tests/catalogo/README.md: UUID, título, precioCentimos, PEN, etiquetas opcionales
y foto validada. Los fixtures compartidos bajo tests/catalogo son exclusivamente
sintéticos y sus nombres no se declaran DTO del producto. Tampoco se inventan IDs
de universidad/campus, categorías, disponibilidad o condición.

Se conserva toda la respuesta y su orden; no se recorta un subconjunto de artículos
como si representara un resultado global. El límite defensivo heredado de 100
registros rechaza respuestas mayores, no las trunca. Hay que acordar con Bernabé
el tamaño de respuesta, orden, paginación y un posible criterio de destacados.

Detalle dinámico permanece deshabilitado. Solo tras acordar la ruta se habilitará
`detalle: { habilitado: true, parametro: nombreAcordado }`; el controlador conserva
el UUID recibido. El ejemplo estático MacBook mantiene su enlace histórico;
otros productos no se envían a la ficha fija de MacBook.

## Estados, seguridad y ciclo

Estados: pendiente, preparado, cargando, listo, vacio y error. El mensaje está fuera
de aria-busy y usa role=status/aria-live=polite. La región de resultados marca
ocupación únicamente durante la solicitud activa. Figma se muestra solo en
pendiente; la región sintética solo en listo/vacio. No se usa Figma como fallback
de error/vacío ni se generan artículos nuevos para llenar espacios.

Reintentar aparece solo ante errores recuperables. Consultar de nuevo está
deshabilitado durante la carga. Los botones no envían formularios; Enter puede
activarlos y el foco global existente permanece visible. Se verifican estilos
computados y cajas de renderizado, no solo la propiedad hidden.

Una consulta nueva cancela la anterior; respuestas tardías no sustituyen el estado
actual. Se hereda timeout de 15 s, máximo 20 s, sin reintentos automáticos.
Desconectar es idempotente, cancela y retira listeners. pagehide limpia y pageshow
persisted vuelve a montar en pendiente al regresar desde bfcache.

La UI no decide permisos ni simula sesión. No modifica métricas 1/3/5, nombres,
mensajes o reservas. Permanecen como Figma con advertencia visible y descripción
accesible; no se convierten en datos de usuario al renderizar artículos sintéticos.
No se usa localStorage ni se introduce persistencia alternativa.

## Dependencias pendientes

- Bernabé: articulos.js y DTO público, IDs/relaciones/estados definitivos, parámetros
  de orden/paginación, criterio de selección y resolución de Detalle por ID.
- Auth/perfiles/RLS: sesión y permisos reales antes de conectar datos privados;
  una cabecera autenticada no demuestra autenticación funcional.
- Servicios de reservas/mensajes/perfiles y sus interfaces: reemplazar los ejemplos
  personales en tareas separadas de Bernabé/Maricielo; no derivarlos del catálogo.
- Persistencia de preferencias: localstorage.js de Maricielo, sin duplicarlo aquí.
- SPEC §5 menciona Landing en la fila landing.js; este módulo implementa Inicio
  según la instrucción actual. index.html permanece público y sin SDK. Aclarar esa
  etiqueta en la documentación de integración, sin modificar el contrato aquí.

## Pruebas ejecutadas y reproducibilidad

Node v24.15.0 y Chrome local en Windows; no se descargan paquetes ni SDK:

```sh
node --experimental-vm-modules --test tests/landing/landing.test.mjs
node --test tests/landing/navegador.test.mjs
node --test tests/catalogo/navegador.test.mjs
node --experimental-vm-modules --test tests/landing/landing.test.mjs tests/catalogo/catalogo.test.mjs tests/auth/auth.test.mjs tests/ia/cliente.test.mjs tests/ia/servidor.test.mjs
```

- Inicio: 19 pruebas unitarias correctas. Suite conjunta: 202 correctas, cero fallos y cero omitidas
  (19 Inicio, 40 catálogo, 44 Auth, 99 IA; todas offline).
- Chrome de Inicio: 17 escenarios más el contenedor, 18 resultados correctos,
  cero fallidos y cero omitidos.
  Incluye siete anchos, estados/visibilidad efectiva, teclado para reintento,
  navegación Inicio → Explorar con Enter y retorno con mouse, barra inferior,
  bfcache y ocho regresiones de index/login/registro/Explorar a 390/1440.
- Destinos externos bloqueados, sin solicitudes a articulos.js ni APIs reales.
  El primer lanzamiento detectó una ruta errónea al fixture del arnés; se corrigió
  para reutilizar ../catalogo/fixtures.mjs antes de los resultados finales.
- La comparación de Inicio idéntico al commit e643381 dejó de corresponder tras
  implementar sus avisos y estados. Por autorización de coordinación, se retiró
  únicamente inicio.html del bloque de regresiones históricas de
  tests/catalogo/navegador.test.mjs y se añadió un comentario explicativo.
  Se conservan las regresiones de index.html, login.html y registro.html, además
  de todas las pruebas de Explorar: estados, visibilidad CSS efectiva, recursos y
  ausencia de llamadas externas. No se reemplazó la comparación por una aserción
  contra el mismo archivo actual.
- Inicio está cubierto por su propia suite Chrome, incluidas las comprobaciones
  geométricas y las regresiones cruzadas descritas arriba.
- Resultado final de Chrome Explorar: 22 escenarios más el contenedor,
  **23 correctos, 0 fallidos y 0 omitidos**. Ambas suites Chrome quedan verdes.

El test usa servidor HTTP efímero, Chrome headless y perfil aislado; no es Live
Server ni una prueba manual de Supabase. Los fixtures se inyectan desde el test,
sin hooks globales en producción. Omite el navegador si Chrome no está instalado.
Guarda capturas, comparacion.json y visibilidad.json en la carpeta temporal que
imprime; elimina solo el perfil con comprobación de la ruta absoluta.

Abrir manualmente con Live Server: http://127.0.0.1:5501/inicio.html.
Las pruebas reales de catálogo/REST, Auth/RLS, imágenes Storage, recomendaciones
y actividad personal siguen pendientes; estos resultados no acreditan su operación.

## Diferencias visuales documentadas

La referencia es el contenido aprobado del commit base 89c9780, no una nueva
consulta Figma MCP. Se conservan fotografías/SVG/Inter, navegación y dimensiones
de las cuatro tarjetas. Los avisos visibles agregan altura deliberadamente:

| Ancho | Primera tarjeta antes / después | Posición vertical antes → después |
| --- | --- | --- |
| 390 | 171 × 410 px / igual | 1245 → 1493 px (+248) |
| 1440 | 304,25 × 442 px / igual | 885 → 1013 px (+128) |

Las capturas Mobile muestran el viewport y su scroll interno, no una captura de
toda la región desplazable. Las fotografías de las tarjetas se comprueban cargadas
y la barra inferior no cubre el final del contenido al desplazarse. No se sustituyó
ninguna sección editable por una captura.
