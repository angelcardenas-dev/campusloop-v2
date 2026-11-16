# CampusLoop V2 — Contrato de integración del catálogo TB4

**Archivo:** `docs/CONTRATO_ARTICULOS_CATALOGO_TB4.md`

**Versión:** 0.1 — Borrador para validación técnica.

**Estado:** Bernabé y Ángel han confirmado su conformidad con el contrato; pendiente ratificación de coordinación.

**Alcance:** Contrato entre `js/articulos.js` y `js/catalogo.js`. No autoriza migraciones, cambios de esquema, RLS, GRANTS ni despliegues.


## 1. Responsabilidades

| Componente | Responsable | Responsabilidad |
|---|---|---|
| `js/articulos.js` | Bernabé | Consulta REST, validación de respuesta y normalización del DTO |
| `js/catalogo.js` | Angel | Controlador de interfaz, filtros, estados y presentación |
| `adaptarFiltros` | Angel | Adaptar los filtros normalizados al contrato del servicio |
| `adaptarArticulo` | Angel | Transformar el DTO en objeto de presentación |
| Supabase Auth y cliente compartido | Angel | Sesión, configuración y acceso compartido |

El servicio no manipula el DOM. El controlador no implementa consultas REST.

## 2. Firma del servicio

La función pública acordada en SPEC_TB4 §8.1 es:

```javascript
export async function consultarCatalogo(filtros, opciones = {}) {
    // Consulta GET al catálogo mediante Supabase Data REST API.
}
```

`opciones` admite:

```javascript
{
    signal: AbortSignal
}
```

El servicio debe utilizar `signal` para cancelar la petición cuando el usuario cambie los filtros, abandone la consulta o se alcance el tiempo máximo.

No debe crear otra instancia de Supabase ni implementar autenticación independiente.

## 3. Contrato de filtros

`js/catalogo.js` valida los filtros de presentación y entrega a `adaptarFiltros` un objeto normalizado.

La estructura acordada para el servicio es:

```javascript
{
    busqueda: "",

    categorias: [],

    universidad: "",
    campus: "",

    estados: [],
    condiciones: [],

    precioMinimoCentimos: null,
    precioMaximoCentimos: null,

    orden: "recientes"
}
```

### Tipos y validaciones

| Campo | Tipo | Regla |
|---|---|---|
| `busqueda` | string | Máximo 120 caracteres |
| `categorias` | UUID[] | Identificadores de categorías |
| `universidad` | UUID o string vacío | Universidad seleccionada |
| `campus` | UUID o string vacío | Campus relacionado con la universidad |
| `estados` | string[] | Estados permitidos |
| `condiciones` | string[] | Condiciones permitidas |
| `precioMinimoCentimos` | number o null | Entero seguro no negativo |
| `precioMaximoCentimos` | number o null | Entero seguro no negativo |
| `orden` | string | Orden permitido |

Valores permitidos para `orden`:

- `recientes`
- `precio-menor`
- `precio-mayor`

Los estados permitidos son:

- `disponible`
- `reservado`
- `vendido`

Las condiciones permitidas son:

- `nuevo`
- `como_nuevo`
- `buen_estado`
- `usado`

Los filtros se validan antes de construir la URL REST.

No se permite que el usuario proporcione directamente expresiones PostgREST, nombres de columnas u órdenes SQL.

`adaptarFiltros` debe conservar el significado de todos los campos. No debe descartar silenciosamente filtros que todavía no estén implementados.

## 4. Contrato de respuesta

Todos los resultados siguen el contrato común:

### Consulta exitosa

```javascript
{
    ok: true,
    datos: [
        {
            id: "uuid",
            titulo: "Calculadora Casio",
            descripcion: "En buen estado",
            vendedorId: "uuid",
            categoriaId: "uuid",
            condicion: "usado",
            precioCentimos: 12000,
            moneda: "PEN",
            campusId: "uuid",
            estado: "disponible",

            imagen: {
                proveedor: "supabase",
                bucket: "articulos",
                ruta: "uuid/archivo.webp",
                url: "https://proyecto.supabase.co/storage/v1/object/public/articulos/uuid/archivo.webp",
                formato: "image/webp",
                bytes: 125000,
                ancho: 1200,
                alto: 900
            },

            creadoEn: "2026-11-15T12:00:00Z",
            actualizadoEn: "2026-11-15T12:00:00Z",
            version: 1,

            categoriaNombre: "Tecnología",
            campusNombre: "San Miguel",
            vendedorNombre: "Vendedor"
        }
    ],
    error: null
}
```

Los valores del ejemplo son ilustrativos, no datos reales de Supabase.

### Consulta fallida

```javascript
{
    ok: false,
    datos: null,
    error: {
        codigo: "RED",
        mensaje: "No se pudo consultar el catálogo."
    }
}
```

Una consulta válida sin coincidencias debe devolver:

```javascript
{
    ok: true,
    datos: [],
    error: null
}
```

No se deben presentar datos simulados como resultados reales.

## 5. Contrato del DTO

La normalización de Bernabé debe transformar los nombres físicos de PostgreSQL a camelCase.

| PostgreSQL / REST | DTO JavaScript |
|---|---|
| `id` | `id` |
| `vendedor_id` | `vendedorId` |
| `titulo` | `titulo` |
| `descripcion` | `descripcion` |
| `categoria_id` | `categoriaId` |
| `condicion` | `condicion` |
| `precio_centimos` | `precioCentimos` |
| `moneda` | `moneda` |
| `campus_id` | `campusId` |
| `estado` | `estado` |
| `creado_en` | `creadoEn` |
| `actualizado_en` | `actualizadoEn` |
| `version` | `version` |

### Fotografías

La migración actual utiliza columnas físicas independientes:

- `imagen_bucket`
- `imagen_ruta`
- `imagen_url`
- `imagen_formato`
- `imagen_bytes`
- `imagen_ancho`
- `imagen_alto`

El servicio las normalizará en el objeto lógico `imagen` del DTO.

No se debe asumir que existe una columna JSONB llamada `imagen`.

La fotografía es obligatoria según la migración actual. No devolver `imagen: null` como si fuera compatible con esa estructura.

El límite de 2 MiB continúa siendo una propuesta pendiente de configuración y validación real de Storage.

### Dinero

La migración utiliza `BIGINT` para `precio_centimos`.

El DTO debe utilizar un entero JavaScript seguro. Bernabé debe comprobar `Number.isSafeInteger` antes de convertir el valor.

No se permite redondear importes ni convertir silenciosamente valores fuera del rango seguro.

La moneda es exclusivamente `PEN`.

**Punto pendiente:** la migración rechaza precios iguales a cero, mientras que el validador actual de presentación permite cero. Debe confirmarse si se mantiene la regla de precio estrictamente positivo y se alinea la validación de presentación, o si se propone un cambio de esquema para permitir artículos gratuitos.

### Fechas e identificadores

- IDs UUID reales.
- Fechas ISO-8601 UTC.
- `version` entero positivo.
- No se admiten propietarios, estados ni fechas inventados desde el navegador.

No se deben devolver correos electrónicos ni información privada de los vendedores.

## 6. Adaptación del DTO a la presentación

Angel implementará `adaptarArticulo(dto)` como dependencia del controlador.

Su resultado debe cumplir el contrato que actualmente valida `validarVista()` en `js/catalogo.js`.

```javascript
{
    id: "uuid",
    titulo: "Calculadora Casio",

    moneda: "PEN",
    precioCentimos: 12000,

    categoriaTexto: "Tecnología",
    ubicacionTexto: "San Miguel",
    vendedorTexto: "Vendedor",

    estadoTexto: "Disponible",
    tono: "positivo",

    foto: {
        url: "https://...",
        alt: "Calculadora Casio"
    }
}
```

Los textos de categoría, ubicación y vendedor pueden ser `null` cuando no se proporcionen datos públicos autorizados.

La adaptación debe:

1. Mantener el UUID original.
2. Conservar el importe en céntimos.
3. Traducir el estado a una etiqueta en español.
4. Transformar la imagen del DTO en `foto`.
5. No incluir información privada.
6. No utilizar `innerHTML` con datos recibidos.

La fotografía debe cumplir las validaciones existentes de `fotoSegura()`:

- HTTPS.
- Origen permitido en `origenesImagen`.
- Sin usuario ni contraseña en la URL.
- Sin parámetros de consulta ni fragmentos.
- Texto alternativo válido.

El controlador genera la ruta de detalle utilizando el ID del artículo. Esta ruta no debe inventarse en el servicio.

## 7. Consulta REST

El servicio debe utilizar:

```text
GET /rest/v1/articulos
```

Requisitos:

- Selección explícita de columnas.
- Nunca utilizar `select=*` por comodidad.
- Construcción de parámetros mediante `URLSearchParams`.
- Filtros permitidos y validados.
- Excluir artículos eliminados lógicamente.
- No devolver información privada.
- Respetar los permisos reales de Supabase.

La universidad debe filtrarse mediante su relación con campus (`campus.universidad_id`), no mediante una comparación con texto libre.

### Ordenamiento

| Valor recibido | Orden lógico |
|---|---|
| `recientes` | Fecha de creación descendente |
| `precio-menor` | Precio ascendente |
| `precio-mayor` | Precio descendente |

Se debe utilizar un criterio secundario estable para evitar cambios arbitrarios de orden entre consultas.

### Paginación

Propuesta inicial documentada por Bernabé:

- Primera consulta: 24 artículos.
- Máximo por respuesta: 100.
- No informar un total global sin haberlo calculado y confirmado.
- La paginación completa requiere un contrato adicional con la interfaz.

La interfaz actual no debe presentar los primeros 24 registros como si fueran la totalidad del catálogo.

## 8. Errores

El servicio debe comprobar `response.ok` antes de procesar una respuesta como exitosa.

Códigos compatibles con los mensajes del controlador:

| Código | Significado |
|---|---|
| `VALIDACION` | Filtros inválidos |
| `NO_AUTORIZADO` | Sesión o permisos insuficientes |
| `LIMITE` | Cuota o límite alcanzado |
| `RED` | Error de conexión |
| `RESPUESTA_INVALIDA` | JSON o DTO incompatible |
| `SERVIDOR` | Error interno o respuesta 5xx |

Los errores deben contener mensajes seguros y nunca exponer tokens, cabeceras, SQL o información privada.

Una cancelación intencional debe propagarse correctamente y no presentarse como error de red.

## 9. Integración con el controlador

El controlador actual invoca:

```javascript
const consulta = adaptarFiltros(seleccion);

const respuesta = await consultarCatalogo(
    consulta,
    { signal: aborto.signal }
);

const vistas = respuesta.datos.map(
    item => adaptarArticulo(item)
);
```

Debe mantenerse el contrato de respuesta y validarse cada objeto antes de renderizarlo.

Actualmente `crearControladorCatalogo()` solo habilita la consulta en `modo === 'prueba'`.

Angel debe preparar posteriormente el modo real, diferenciando claramente:

- Resultados simulados.
- Resultados reales de Supabase.
- Estado pendiente de integración.

También debe revisarse `landing.js`, que reutiliza el controlador y presenta mensajes de prueba offline.

## 10. Seguridad y condiciones de habilitación

El servicio utilizará la configuración y autenticación compartidas del proyecto.

Queda prohibido:

- Crear otro cliente de Supabase.
- Implementar autenticación paralela.
- Almacenar JWT manualmente.
- Utilizar `service_role` en frontend.
- Exponer correos o información privada.
- Confiar en los filtros de la interfaz como mecanismo de seguridad.

**La conexión real no se habilitará hasta que coordinación autorice y se implementen y validen los permisos RLS y GRANTS correspondientes.**

El README actual confirma que esos controles de aplicación todavía están pendientes.

## 11. Pruebas de aceptación

| ID | Prueba | Resultado esperado |
|---|---|---|
| CAT-01 | GET exitoso | Artículos reales normalizados |
| CAT-02 | Sin coincidencias | `ok: true`, `datos: []` |
| CAT-03 | Filtros de categoría | Solo coincidencias válidas |
| CAT-04 | Filtros de universidad/campus | Relación correcta |
| CAT-05 | Orden por precio | Orden ascendente y descendente |
| CAT-06 | Orden por fecha | Más recientes primero |
| CAT-07 | Error HTTP | Mensaje controlado |
| CAT-08 | Error de red | Conservación de filtros |
| CAT-09 | JSON inválido | No renderizar resultados |
| CAT-10 | Cancelación | Ignorar respuesta anterior |
| CAT-11 | Fotografía | URL validada y origen autorizado |
| CAT-12 | Seguridad | No devolver información privada |

Los dobles locales deben identificarse como pruebas simuladas. Las pruebas de éxito real necesitan Supabase autorizado y configurado.

## 12. Aprobaciones y cierre del contrato

Se han recibido las siguientes conformidades:

1. Bernabé confirmó su conformidad con la firma, los filtros y el DTO.
2. Bernabé confirmó la correspondencia del contrato con las migraciones existentes.
3. Ángel confirmó su conformidad con el contrato de integración y asumirá la implementación de los adaptadores `adaptarFiltros` y `adaptarArticulo` en `js/catalogo.js`.

Queda pendiente:

4. La ratificación de coordinación de las decisiones que este documento identifica como pendientes, incluyendo las reglas de precio, límites de fotografías y paginación.
5. La autorización correspondiente para habilitar posteriormente la conexión real.

Este documento no modifica el SPEC aprobado ni autoriza ejecución SQL, cambios de RLS, GRANTS, Storage o despliegues.

**Objetivo:** permitir que `js/articulos.js` y `js/catalogo.js` se integren sin duplicación de servicios, sin improvisar nombres de funciones y sin alterar las responsabilidades de sus autores.
