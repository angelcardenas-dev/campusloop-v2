# US17 — servicio IA preparado para pruebas offline

Angel, preparación del 13/11/2026. Rama `feature/angel/ia-us17`, desde
`388b9f8f2dd8a2096b8e6a66cb394fbf3b1164ec`. Referencia: SPEC_TB4.md §9.
Los detalles de integración siguientes son una propuesta para acordar con Matías;
no modifican el contrato aprobado ni acreditan proveedor o servicios funcionando.

## Archivos y arquitectura

- `js/asistente.js`: servicio vanilla, validación, fetch a `/api/asistente`, aborto,
  timeout y puente optativo de eventos. Reutiliza el cliente Supabase existente.
  No consulta ni cambia inputs, artículos, SQL, borradores o almacenamiento propio.
- `netlify/functions/asistente.mjs`: entrada Netlify con Request/Response nativos,
  validación independiente del navegador, controles previos y transporte NVIDIA.
- `tests/ia/fixtures.mjs`: datos y credenciales exclusivamente sintéticos.
- `tests/ia/cliente.test.mjs`: módulos VM, eventos y transporte simulado.
- `tests/ia/servidor.test.mjs`: Request/Response locales, controles y proveedor dobles.
- Este README: contrato de consumo, fronteras de seguridad y pendientes.

Recorrido futuro: Publicar (Matías) → asistente.js → POST /api/asistente → función
Netlify → NVIDIA NIM alojada. La metadata `config.path` está dentro de la función;
no se ha creado netlify.toml, desplegado ni configurado ningún servicio. Live Server
no ejecuta esta función: un 404/HTML local no debe tratarse como una respuesta IA.

## Estado de seguridad: denegar por defecto

El cliente tiene `IA_HABILITADA = false`: ni una solicitud válida inicia SDK/fetch.
En servidor, ausencia de `IA_HABILITADA` equivale a `false`. Solo la cadena exacta
`true` permite continuar las comprobaciones; no constituye autorización suficiente.

El export predeterminado **no tiene adaptadores reales**. Aunque se activara la
variable, responde 503 mientras falten verificarUsuario/verificarVendedor/reservarCuota.
No hay un usuario ficticio, acceso alternativo anónimo ni contador de cuota en memoria.
Las factorías reciben dobles exclusivamente desde código de pruebas; el cuerpo HTTP
no puede escoger modelo, proveedor, identidad, vendedor, cuota ni dependencias.

NVIDIA_API_KEY se lee solo en la función servidor. No hay valores reales ni archivos
de entorno. El navegador obtiene el bearer desde el SDK oficial, lo conserva solo
en memoria y lo envía en Authorization; no escribe ni copia JWT en almacenamiento.
Ese estado local NO autoriza el recurso: el servidor debe verificar identidad y
vendedor de forma independiente. No se implementó otro cliente ni JWT manual.

## Contrato HTTP implementado

POST `/api/asistente`, Content-Type `application/json`, cuerpo UTF-8 de máximo 8192
bytes reales. Los objetos rechazan claves adicionales. Request propuesto:

```json
{
  "schemaVersion": 1,
  "solicitudId": "f5aec7a4-4346-4130-9e06-945f37aa4d84",
  "operacion": "proponer_publicacion",
  "articulo": {
    "tituloActual": "Calculadora Casio FX-991EX",
    "descripcionActual": "",
    "categoriaId": null,
    "condicion": "Usada",
    "caracteristicas": ["Operativa", "Incluye tapa"]
  }
}
```

El UUID del ejemplo es sintético, no una publicación o cuenta existente.
`categoriaId` admite null o UUID: contexto, sin consultar catálogos ni implementar US18.
Título actual ≤100, descripción actual ≤1000, condición textual 1–80; hasta diez
características no vacías de ≤150 caracteres cada una. Límites en puntos de código
Unicode; el límite de bytes se aplica además. Solo descripción admite saltos LF.
Se requieren al menos dos bloques no vacíos entre título, descripción y características;
si faltan, CONTEXTO_INSUFICIENTE pide más información sin consumir proveedor.

No se admiten campos de cuenta, campus, mensajes ni tokens en JSON. También se
rechazan patrones evidentes de correo, URL y credenciales en el contexto. Esto es
minimización y una comprobación básica, no un detector completo de información
personal: Matías debe advertir que no se introduzcan datos privados en el artículo.

Éxito HTTP 200:

```json
{"solicitudId":"f5aec7a4-4346-4130-9e06-945f37aa4d84","sugerencias":{"titulo":"Calculadora Casio FX-991EX","descripcion":"Usada\nOperativa\nIncluye tapa"}}
```

Error: `{ solicitudId: UUID|null, codigo, mensaje }`, sin respuesta cruda ni secretos.
El ID es null si no se llegó a validar el cuerpo. Códigos/status principales:

| HTTP | Códigos |
| --- | --- |
| 400 | VALIDACION, CONTEXTO_INSUFICIENTE |
| 401 / 403 | NO_AUTORIZADO / NO_VENDEDOR, ORIGEN_NO_PERMITIDO |
| 405 / 408 / 409 | METODO_NO_PERMITIDO / CANCELADO / CONFLICTO |
| 413 / 415 / 429 | CUERPO_GRANDE / TIPO_NO_PERMITIDO / LIMITE |
| 502 | SERVIDOR, RESPUESTA_INVALIDA |
| 503 | IA_DESHABILITADA, CONFIGURACION, CONTROLES_NO_DISPONIBLES |
| 504 | TIEMPO_AGOTADO |

Servidor: no-store, nosniff, sin CORS comodín. Exige Origin exactamente igual a la
configuración permitida y bearer; Origin no sustituye autenticación ni cuota.
No sigue redirects. Valida status, JSON, schema, correlación y longitudes.
La respuesta al navegador se limita a 16 KiB y la del upstream a 32 KiB leídos
progresivamente. No devuelve prompts, razonamiento, usage, sesiones o errores crudos.

## Fuentes de la sugerencia y límites del modelo

Primera implementación conservadora: la salida solo puede combinar **bloques
completos proporcionados por el vendedor**, recortando espacios exteriores.
Título une bloques con ` · `; descripción con LF o ` · `. No se aceptan palabras,
atributos, números o garantías añadidos, ni cambios dentro de un bloque/negación.
La comprobación no certifica que los datos del vendedor sean verdaderos ni que
la selección sea idónea: hace falta revisión humana, y puede rechazarse una
paráfrasis correcta. Acordar con Matías esta restricción antes de integrar la UI;
ampliar redacción libre requiere otro diseño de validación y pruebas aprobadas.

El prompt separa instrucciones de contexto no confiable; no usa herramientas.
El proveedor recibe campos de producto, sin categoría UUID, cuenta o token Auth.
Se solicita JSON plano, sin streaming, max_tokens 512 y temperature 0.2. No se fija
response_format hasta validar compatibilidad del modelo. Se rechazan truncamientos,
Markdown envolvente y claves inesperadas. La revisión de español/calidad sigue pendiente.

## API JavaScript y propuesta para Matías

`solicitarSugerencia(datos, { signal } = {})` recibe el cuerpo anterior **más**
`revisionFormulario` (entero seguro ≥0). Esta revisión se conserva solo en cliente;
no se envía a NVIDIA ni en el HTTP de la función. Devuelve:

```js
{ ok: true, datos: { solicitudId, revisionFormulario, sugerencias: { titulo, descripcion } }, error: null }
// o { ok: false, datos: null, error: { codigo, mensaje } }
```

La respuesta no contiene bearer. Los errores de fetch se distinguen de errores
internos; mensajes locales fijos evitan reflejar el mensaje del servidor/proveedor.
Una solicitud activa por servicio; aborto explícito permite reemplazarla. Timeout
cliente ≤20 s y servidor ≤15 s para toda la operación; sin reintentos automáticos.
Timeout/aborto también impiden iniciar llamadas después de una resolución tardía.

Puente optativo, sin editar Publicar:

```js
import { conectarAsistente } from './asistente.js';
const controlIA = conectarAsistente({ destino: document });
// Matías emite tras pulsar Solicitar, sin datos privados:
document.dispatchEvent(new CustomEvent('campusloop:ia-solicitar', {
  detail: { schemaVersion: 1, solicitudId, revisionFormulario,
    operacion: 'proponer_publicacion', articulo }
}));
// En cada cambio del formulario:
controlIA.actualizarRevision(revisionFormulario);
// Solo tras clic explícito Aceptar; permite usar textos editados de la preview:
const anterior = controlIA.obtenerPropuesta(); // copia de originales + sugerencias
const copiaParaRestaurar = anterior?.originales;
controlIA.aceptar({ solicitudId, revisionFormulario,
  camposAceptados: { titulo: tituloRevisado, descripcion: descripcionRevisada } });
// Descartar conserva el formulario, cancela la espera y elimina propuesta interna:
controlIA.descartar();
// Al abandonar el módulo:
controlIA.desconectar();
```

No es un script listo para pegar: los nombres de variables/selectores pertenecen
a la UI de Matías. La conexión no se realiza automáticamente desde este módulo.
Una conexión por destino; al desconectar elimina listeners y suscripción Auth.
Con IA habilitada, cierre/cambio de cuenta descarta la solicitud; no consulta el
SDK desde el consumidor de eventos Auth.

| Evento | Dirección / detail |
| --- | --- |
| campusloop:ia-solicitar | Matías → Angel: schemaVersion, solicitudId, revisionFormulario, operacion, articulo |
| campusloop:ia-estado | Angel → Matías: solicitudId, revisionFormulario cuando se conoce, estado cargando/listo/error/descartado; sugerencias o error normalizado según estado |
| campusloop:ia-aplicar | Angel → Matías, solo al invocar aceptar: solicitudId, revisionFormulario, camposAceptados |

Matías mostrará previews con textContent/value, sin ejecutar HTML ni Markdown.
Éxito no cambia campos ni guarda. Solo el listener de ia-aplicar puede aplicar los
campos aceptados tras la decisión humana. Copiar originales **antes** de aplicar:
Matías conserva copiaParaRestaurar en memoria y restaura mediante su propia acción
explícita. Editar/aplicar/restaurar incrementa revisión; actualizarRevision descarta
propuestas obsoletas. No se aplican resultados tardíos y no se publica automáticamente.
Nuevo ID por intención, revisión monótona por instancia; no reutilizar IDs para
reintentos: la RPC debe evitar consumo upstream duplicado de un mismo ID.

**Acuerdos pendientes con Matías:** selectores, previews/aria-live/foco, aviso de
privacidad/IA, condiciones/categorías, campos requeridos, manejo de edición de
preview frente a revisión real, aceptación parcial, copia/restauración, cancelación
al abandonar/Publicar y confirmación del formato extractivo. Las tres direcciones
de eventos siguen §9; no se crearon eventos alternativos ni se tocó su módulo.

## Adaptadores pendientes de Bernabé y Angel

Interfaces exclusivamente servidor de `crearHandlerAsistente()`:

| Adaptador | Obligación antes de conectarlo a producción |
| --- | --- |
| verificarUsuario({ token, signal }) | SDK oficial getUser o validación oficial de claims; devuelve { id: UUID, esAnonimo: false } o null para token inválido. Red/servicio caído debe fallar, nunca autorizar ni decodificar JWT sin verificar |
| verificarVendedor({ usuarioId, token, signal }) | Lectura protegida de la fuente autorizada de vendedor; true/false. No usar roles de JSON ni user_metadata editable |
| reservarCuota({ usuarioId, solicitudId, token, signal }) | Operación PostgreSQL atómica que verifica actor, límite por usuario Y global, deduplicación y reserva previa al upstream |

Reserva autorizada: `{ permitida: true, nueva: true, reservaId: UUID }`; denegada:
`{ permitida: false }`; ID repetido: `{ permitida: true, nueva: false }` → 409.
Una respuesta incompleta o excepción deniega el servicio. La RPC debe derivar el
actor de Auth y proteger contadores/fechas/ventanas contra modificación o reset
desde el navegador. No basta devolver estos booleanos sin controles efectivos.

Propuesta de contabilización, por acordar: reservar una unidad antes del upstream;
los intentos que llegan a él, fallan o se cancelan conservan el cargo. No hay
devolución automática desde el cliente. Una transacción ya iniciada puede terminar
tras aborto: controlar estado/deduplicación en BD y no prometer rollback por AbortSignal.
Definir límite monetario cero, ventanas, cupo total, roles de ejecución y evidencia
de concurrencia antes de habilitar. No se escribió SQL ni se conectó esa RPC.

La aceptación del contrato Auth por Bernabé fue comunicada por coordinación;
no implica que implementó/probó perfiles, permisos vendedor, RLS o cuotas.

## Entorno y condiciones externas pendientes

Solo servidor, sin valores versionados:

- IA_HABILITADA: false por defecto; solo true tras autorización completa.
- IA_ORIGEN_PERMITIDO: origen HTTPS real exacto del sitio; local 127.0.0.1:5501
  solo si se aprueba una prueba local con funciones. Sin URL de retorno arbitraria.
- NVIDIA_API_KEY: secreto del servidor.
- NVIDIA_MODEL: sin valor predeterminado ni modelo definitivo.
- NVIDIA_MODELOS_APROBADOS: lista de modelos autorizados; debe incluir el elegido.

Pendientes: acceso Free real, créditos/cuotas, condiciones de trial frente a demo
pública, tratamiento de datos, español, JSON, parámetros soportados, latencia y
límite efectivo de Netlify. Presupuesto S/ 0; sin planes, facturación, registros,
pruebas de proveedor, descargas SDK, instalaciones ni configuración de servicios.
No habilitar solo por tener una clave o por pasar estas pruebas offline.

Fuentes públicas inspeccionadas para el transporte, sin llamar endpoints del servicio:
[Netlify Request/Response](https://docs.netlify.com/build/functions/get-started/),
[rutas](https://docs.netlify.com/build/functions/configuration/?fn-language=js),
[entorno de funciones](https://docs.netlify.com/build/functions/environment-variables/),
[NVIDIA LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis).
Consultar un esquema HTTP no valida ningún modelo/cuenta/licencia gratuita.

## Pruebas reproducibles sin red

Node v24.15.0, módulos estándar, sin npm install ni Netlify Dev:

```sh
node --experimental-vm-modules --test tests/ia/cliente.test.mjs tests/ia/servidor.test.mjs
node --experimental-vm-modules --test tests/auth/auth.test.mjs
node --check js/asistente.js
node --check netlify/functions/asistente.mjs
```

VM Modules emite su advertencia experimental. Cliente usa módulos de dependencia
simulados y bloquea import/fetch reales. Servidor usa Request/Response locales,
adaptadores y respuestas NVIDIA sintéticos, con fetch global prohibido. La prueba
cliente-servidor llama directamente al handler, sin HTTP de red. IDs, tokens,
clave y `fixture/modelo-inexistente` no corresponden a servicios reales.

Cobertura: apagado/controles ausentes, identidad/vendedor/cuota, orden de permisos,
JSON/bytes/esquemas/longitudes, origen/headers, idempotencia de la interfaz, errores
upstream, salida ajena a fuentes, red/timeout/aborto/resolución tardía, estado/eventos,
aceptación explícita, revisión/cancelación/logout, limpieza e integración sintética.

Las pruebas no acreditan SDK servidor funcionando, RLS ni límites globales reales,
calidad del modelo, gratuidad, accesibilidad visual o despliegue. Toda prueba real
continúa pendiente de autorización y de controles efectivos. Conservar edición
manual si IA está caída; eso no equivale a completar US17 real en producción.

Resultado offline de esta preparación: **99 pruebas de IA + 44 de Auth = 143
correctas, 0 fallidas**. Sintaxis de los cinco módulos JS/MJS nuevos comprobada;
revisión estática sin credenciales detectadas, flags apagados y sin cambios en los
72 archivos previamente versionados. No se descargó ni ejecutó el SDK real.
