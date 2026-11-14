# Servicio Auth TB4: revisión técnica y pruebas aisladas

Implementación inicial de Angel, 13/11/2026 (Perú), sobre
`feature/angel/auth-servicio`, base `fb8f1c8d71a1064d0dc25ecc96d4883dc137da16`.
En aquella implementación inicial, el acuerdo estaba pendiente de ratificación de
Bernabé; coordinación comunicó posteriormente su aceptación. Esto no acredita
implementación ni pruebas de PostgreSQL, catálogos, perfiles o RLS.
No se modifican los dos contratos aprobados ni se ejecutan operaciones Supabase.
Preparación offline del retorno PKCE (Fase 3C): `feature/angel/auth-retorno-pkce`,
base `1b44bfb6bf4daf69038764628329b3cb726cb935`.

## Alcance de las fases 3A, 3B y 3C

- **3A — REPORTADO y aprobado por coordinación:** carga real del SDK 2.119.0,
  cliente compartido y comprobaciones sin sesión previa. Los resultados locales
  de sesión no demostraron por sí solos contacto con Supabase Auth. El arnés se
  conserva por separado en `bb882f4`, sin incorporarlo en este cambio.
- **3B — REPORTADO y aprobado por coordinación:** una solicitud GET de solo
  lectura a `/auth/v1/settings` respondió HTTP 200 JSON, con registro y Email
  habilitados y confirmación obligatoria. Demuestra conectividad y aceptación de
  la clave pública; no autenticación de usuario. No se repite esa solicitud aquí.
- **3C — VERIFICADO offline:** validación del destino y del payload de `signUp`
  mediante dobles del SDK. Registro real, correo, retorno PKCE y login siguen
  **PENDIENTES** de pruebas autorizadas; las 94 pruebas no acreditan esos flujos.

## Arquitectura y archivos

- `js/config-publica.js`: configuración pública vacía y validación sintáctica.
- `js/supabase-cliente.js`: singleton diferido por módulo ES/página y carga SDK.
- `js/auth.js`: exactamente siete funciones, errores y DTO reducidos; sin DOM,
  navegación del navegador, SQL, perfiles, logs, almacenamiento propio o JWT
  manuales. Registro puede enviar un destino de correo validado al SDK.
- `tests/auth/auth.test.mjs`: dobles del SDK, temporizadores y módulos aislados
  con `node:test`, `node:assert` y `node:vm`; ningún paquete externo.
- Este README: ejecución reproducible, contrato para consumidores y pendientes.

Los módulos se importan con rutas relativas desde un futuro controlador ES de UI.
No se han conectado a ningún HTML. Los consumidores deben importar siempre
`obtenerClienteSupabase` del mismo archivo; no crear proveedores/clientes propios.
La factoría `crearProveedorCliente` permite inyectar configuración/carga en pruebas;
no es un segundo cliente de la aplicación ni un hook global de autenticación.
Las llamadas concurrentes a la instancia predeterminada comparten su creación.

## SDK, origen, licencia y configuración

Se fija **@supabase/supabase-js 2.119.0**, versión estable consultada en las
[releases oficiales](https://github.com/supabase/supabase-js/releases/tag/v2.119.0).
El SDK tiene [licencia MIT](https://github.com/supabase/supabase-js/blob/master/LICENSE).
La distribución ES elegida es:

`https://esm.sh/@supabase/supabase-js@2.119.0?bundle&target=es2022`

[esm.sh](https://esm.sh/) proporciona módulos de paquetes npm para navegador.
No requiere framework, npm install, import map, package.json ni build local.
La versión del paquete está fijada; el CDN transforma/resuelve dependencias y no
equivale a vendorización con hashes de todos los archivos transitivos. La carga
real, las cabeceras/CSP y compatibilidad del navegador se comprobarán después,
con autorización. No se ha descargado ni ejecutado el SDK real en estas pruebas.

`CONFIGURACION_PUBLICA` contiene exactamente:

```js
{
  supabaseUrl: '',
  supabasePublishableKey: '',
  appOrigin: '',
  authEmailRedirectTo: '',
}
```

Vacío por diseño: esta fase no incorpora valores reales del proyecto al código.
Una tarea futura autorizada podrá completar los valores públicos. Se requiere
URL HTTPS de origen (sin credenciales, ruta, query o fragmento) y clave con forma
`sb_publishable_…`. Se rechazan secret keys/JWT heredados. La validación no prueba
existencia, pertenencia del proyecto ni validez remota de la clave.
Con configuración incompleta no se importa el CDN ni se crea el cliente.
Un fallo de descarga/importación devuelve RED. Si el SDK cargó pero createClient
falla o no está disponible, devuelve CONFIGURACION sin detalles internos. Ambos
permiten reintento explícito, sin bucle; el cliente creado correctamente se conserva.

Opciones existentes del SDK: persistSession y autoRefreshToken activos,
detectSessionInUrl activo, flowType pkce, debug desactivado. La sesión persistida
la administra únicamente el SDK; localstorage.js no participa. La exposición de
tokens al JavaScript del navegador sigue siendo un riesgo XSS del diseño aprobado.
Los retornos de correo deben configurarse en Supabase antes de probar registros.

### Destino opcional de confirmación (Fase 3C, offline)

`appOrigin` es el origen confiable del **frontend**, distinto de `supabaseUrl`,
que identifica el backend. `authEmailRedirectTo` es la URL absoluta de retorno.
Ambos los define el despliegue; no se obtienen de inputs, argumentos de registrar,
query strings o localStorage. No son parámetros adicionales del contrato de Auth.

- Sin `authEmailRedirectTo` (ausente o cadena vacía), `signUp` conserva exactamente
  `{ email, password }`. Supabase utiliza el Site URL del proyecto como fallback.
  Un `appOrigin` sin destino no cambia las otras operaciones ni dicho fallback.
- Con destino explícito válido, la única opción añadida es
  `options: { emailRedirectTo }`. Debe coincidir con `appOrigin` en protocolo,
  hostname y puerto. El origen no puede incluir una ruta distinta de `/`.
- Se exige HTTPS, excepto para el origen local aprobado
  `http://127.0.0.1:5501`. No se equipara `localhost` con `127.0.0.1`.
- Se rechazan credenciales en URL, query y fragmento (incluso vacíos), escapes `%`,
  backslashes, espacios, controles, rutas relativas, segmentos `.`/`..`, dobles
  slash y URLs mayores de 2048 caracteres. La política de rutas admite segmentos
  ASCII alfanuméricos, guiones y guiones bajos, rutas limpias o archivo `.html`;
  no admite rutas Unicode o codificadas. La URL aceptada se normaliza con `URL`.
- Un destino explícito inválido devuelve `CONFIGURACION` **antes de obtener el
  cliente**; no hay fallback silencioso. Login, estado, usuario, guarda, eventos
  y logout no dependen de este ajuste.

La validación es sintáctica y de origen; no demuestra que exista la página, que
inicialice el SDK ni que Supabase permita el destino. El callback no se toma de
un parámetro `next`, y este cambio no implementa un redireccionador abierto.
La prohibición de query/fragmento se aplica al destino configurado, no al `code`
que Supabase incorporará posteriormente al retorno PKCE.

Configuración local **documental**, todavía sin aplicar a los campos vacíos:

```js
appOrigin: 'http://127.0.0.1:5501',
authEmailRedirectTo: 'http://127.0.0.1:5501/tests/auth/prueba-navegador.html',
```

En una fase posterior autorizada, añadir a **Auth > URL Configuration > Redirect
URLs** de Supabase exactamente:

`http://127.0.0.1:5501/tests/auth/prueba-navegador.html`

No se necesita reemplazar globalmente el Site URL para este caso explícito. El
Site URL `http://localhost:3000` fue REPORTADO por coordinación en las fases
anteriores; no se consulta ni modifica aquí. Mantener la plantilla estándar con
`ConfirmationURL`, que transporta el destino del flujo. Una plantilla basada en
`TokenHash` requeriría otro diseño aprobado; no se añade un segundo canje manual.

El navegador que inicia el registro debe conservar el verificador PKCE y abrir
el correo en el mismo perfil y origen. La página de retorno debe inicializar el
cliente compartido (`detectSessionInUrl: true`, `flowType: 'pkce'`) antes de limpiar
un `code` utilizable; no canjearlo simultáneamente desde otro controlador.
Esta fase solo prepara el destino y no cambia el procesamiento del arnés.

La página local vive en la rama independiente `feature/angel/auth-validacion-real`
(commit `bb882f4`), no en esta base compartida. Debe recuperarse en un trabajo
posterior autorizado sin sobrescribir esa rama. Elegir la URL no crea el archivo,
no habilita conexiones ni resuelve el bloqueo de registro por catálogos reales.

Para Netlify, tras conocer el dominio público definitivo:

1. Crear/revisar una página de retorno de producción que inicialice el mismo SDK;
   no desplegar el arnés de pruebas como callback público sin revisión específica.
2. Configurar `appOrigin` con `https://<sitio>.netlify.app` (o dominio propio) y
   `authEmailRedirectTo` con ese origen más la ruta real del callback. Son
   marcadores documentales, no URLs aprobadas o existentes.
3. Añadir esa URL completa y exacta a Redirect URLs y definir el Site URL público
   como fallback de producción. No introducir comodines para previews; otro
   origen requerirá configuración y autorización propias.
4. Completar por separado la URL pública de Supabase y su publishable key. En
   HTML/JS estático las variables del panel Netlify no se inyectan automáticamente
   en estos módulos: habrá que aprobar configuración por despliegue o generación
   de archivo público en build. No se añade ese mecanismo en esta fase.

Ningún cambio de Dashboard, plantilla, Netlify ni registro real se ha ejecutado.

## Contrato exacto de consumo para Maricielo

Todas las funciones asíncronas resuelven, también ante errores SDK:

```js
// éxito
{ ok: true, datos: /* valor de la tabla */, error: null }
// fallo; nunca se devuelve el error crudo del proveedor
{ ok: false, datos: null, error: { codigo: 'RED', mensaje: 'Mensaje seguro en español' } }
```

`usuario` significa **solo** `{ id: string, correo: string | null }`.
Correo es el del propio usuario, no un perfil público; no debe aparecer en
evidencias públicas. Nunca se devuelve `session`, tokens o metadatos de usuario.

| Función | Entrada exacta | `datos` en éxito |
| --- | --- | --- |
| registrar | Objeto detallado debajo | `{ estado: 'AUTENTICADO' o 'PENDIENTE_CONFIRMACION', usuario }` |
| iniciarSesion | `(correo: string, contrasena: string)` | `{ estado: 'AUTENTICADO', usuario }` |
| obtenerUsuarioActual | Sin argumentos | `usuario` o `null` si no hay sesión |
| obtenerEstadoAuth | Sin argumentos | `{ estado: 'AUTENTICADO', usuario }` o `{ estado: 'NO_AUTENTICADO', usuario: null }` |
| cerrarSesion | Sin argumentos | `{ estado: 'NO_AUTENTICADO', usuario: null }` |
| requerirAutenticacion | Sin argumentos | `{ estado: 'AUTENTICADO', usuario }`; sin sesión falla con NO_AUTORIZADO |
| escucharCambiosAuth | `(callback: function)` | Retorna **sincrónicamente una función cancelar**, no una promesa ni sobre `{ ok, datos, error }` |

Entrada de `registrar` (campos adicionales no se envían a Supabase):

```js
{
  nombreVisible,       // string, 2–100 caracteres después de trim, sin controles/<>.
  universidadId,      // string UUID, sin nombre libre de universidad.
  campusId,           // string UUID, sin nombre libre de campus.
  correo,             // string, formato email básico, hasta 254 caracteres.
  contrasena,         // string, 8–128 caracteres, no solo espacios.
  confirmarContrasena,// string, idéntica a contrasena.
  aceptaTerminos      // boolean, debe ser true.
}
```

Correo se recorta y pasa a minúsculas; la contraseña nunca se recorta ni altera.
Login acepta 1–128 caracteres para no invalidar cuentas previas por otra política
mínima. El mínimo de registro 8 coincide con el HTML actual; los límites locales
deben alinearse con la política real del proyecto antes de conectar formularios.
No se valida pertenencia campus/universidad sin catálogo: esa relación depende de
Bernabé. Validar dominio/formato no verifica identidad universitaria.

Registro llama `signUp({email,password})`, añadiendo únicamente `emailRedirectTo`
en `options` si existe destino explícito validado. No guarda nombre/campus/términos en
metadatos ni los presenta como persistidos. Usuario sin sesión significa pendiente
de confirmación. La UI deberá pedir/completar perfil cuando haya sesión y exista
el servicio de Bernabé. No conservar contraseña para reintentar tras confirmación.

Usuario/guarda utilizan getUser; estado UI utiliza getSession y espera restauración
SDK. Estado local no autoriza recursos: sigue siendo necesaria RLS.
Logout usa `signOut({ scope: 'local' })`: cierra la sesión actual sin cerrar las
sesiones de otros dispositivos. Errores no anuncian un cierre exitoso.

### Errores y eventos

Códigos: VALIDACION, CREDENCIALES_INVALIDAS, NO_AUTORIZADO, CORREO_PENDIENTE, RED,
LIMITE, CONFIGURACION y SERVIDOR. Todos incluyen mensaje español fijo; no se
devuelve `error.message`, respuesta cruda ni información sobre existencia de cuentas.
La UI decide mensajes, navegación, foco y conservación de campos sin registrar
contraseñas. Errores de proveedor desconocidos se tratan conservadoramente.
Solo AuthRetryableFetchError se reconoce como error de transporte del SDK (RED).
TypeError genérico, status 0 aislado y errores desconocidos se clasifican como
SERVIDOR; no se deduce un fallo de conexión a partir del mensaje técnico.
En obtenerUsuarioActual, AuthSessionMissingError devuelto o lanzado representa
ausencia de sesión: éxito con datos null. La guarda devuelve NO_AUTORIZADO;
un error de transporte real continúa devolviendo RED.

Callback de eventos recibe solo `{ evento, estado, usuario }`. Para eventos SDK
normales (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.) estado es
AUTENTICADO o NO_AUTENTICADO. En fallo de inicialización se entrega
`{ evento: 'ERROR', estado: codigoError, usuario: null }`; para obtener un mensaje
normalizado la UI puede invocar obtenerEstadoAuth fuera del callback interno.
Callback inválido retorna una cancelación vacía y no obtiene cliente.

La entrega al consumidor usa una macrotarea fuera del callback/lock SDK. No se
consulta Supabase dentro de onAuthStateChange. Cancelar es idempotente y elimina
suscripción y notificaciones pendientes; también funciona antes de resolver el
cliente. Los errores de un consumidor no se registran ni rompen a otros oyentes;
la UI debe manejar sus propios fallos.

Referencias consultadas el 13/11/2026:
[signUp](https://supabase.com/docs/reference/javascript/auth-signup),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[getSession](https://supabase.com/docs/reference/javascript/auth-getsession),
[signOut](https://supabase.com/docs/reference/javascript/auth-signout),
[eventos](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[bloqueo de callback](https://supabase.com/kb/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0),
[errores](https://supabase.com/docs/guides/auth/debugging/error-codes).

## Ejecución sin red

Desde la raíz del repositorio, con Node (probado en **v24.15.0**):

```sh
node --experimental-vm-modules --test tests/auth/auth.test.mjs
```

No instalar dependencias ni abrir Live Server para esta suite. El flag habilita
SourceTextModule/SyntheticModule y Node muestra su advertencia experimental.
Los módulos de producción se leen completos desde disco. Para Auth se sustituye
su dependencia cliente por un módulo sintético y se inyectan valores públicos
sintéticos de configuración, ejecutando el validador de producción sin alterarlo.
No se editan las fuentes ni se habilita un hook global en la aplicación. La factoría del
cliente se prueba aparte con createClient simulado. Fetch/importación remota están
bloqueados en los contextos de prueba y no hay DOM ni almacenamiento disponible.
Dominios `.invalid`, IDs y claves/contraseñas de fixtures son datos sintéticos;
jamás representan cuentas o credenciales reales.

La suite cubre: configuración/formatos/carga única/reintento; registro válido e
inválido/confirmación; login y errores; getUser/guarda; restauración inicial/logout;
eventos/refresh/cancelación/carreras; respuestas reducidas y SDK incompleto.
Resultado inicial del 13/11/2026: **44 pruebas, 44 correctas, 0 fallidas** con
Node v24.15.0; sin solicitudes de proveedor ni descarga del SDK. Se comprobó también
la integración del proveedor real con Auth usando createClient simulado.
Una aserción inicial ordenaba mal las claves esperadas de un evento y se corrigió
en la prueba. Esta suite no acredita operación del proveedor ni autorización RLS
en producción.

Resultado Fase 3C: **94 pruebas correctas, 0 fallidas, 0 omitidas**. Se conservan
las 44 originales y se añaden 50 sobre destino ausente/válido/inválido, origen
confiable, rutas seguras, bloqueo antes del cliente, opciones ignoradas del
formulario, confirmación pendiente y conservación del resto de Auth/singleton.
El helper VM admite la nueva importación de configuración. Se renombra la prueba
del payload anterior para precisar el caso sin destino, manteniendo intactas sus
aserciones; no se relajan pruebas para aceptar un cambio incompatible.
Todos los registros y respuestas de esta suite son simulados, nunca evidencia de
creación de cuentas ni de retorno PKCE real.

## Pendientes de integración y pruebas reales

- Entrega de Bernabé: esquema final/perfiles/catálogos/trigger mínimo,
  permisos por columna, RLS y activación autorizada. Ninguna tabla se toca aquí.
- URL y publishable key reales, Free/SMTP/confirmación/redirects, política de
  contraseña, PKCE y retorno en el mismo navegador, refresh/logout entre pestañas.
- Prueba autorizada del CDN/SDK y almacenamiento bloqueado en navegador;
  disponibilidad de red, CSP y carga servida por HTTP local/HTTPS público.
- Maricielo adapta nombres visibles de los inputs actuales a los IDs del catálogo
  y conecta submit/validaciones/estados. Actualmente Registro sigue estático y
  conserva `method=post`; este servicio no lo vuelve funcional ni intercepta envíos.
- Integración real entre dos cuentas, comprobaciones de privacidad/RLS y logout
  con fallos reales. Ninguna prueba de esta carpeta crea usuarios, perfiles o SQL.

No hay bloqueos para revisar este código offline. Se requiere autorización para
conectar valores reales, ejecutar pruebas de servicios, modificar formularios o
integrar la configuración y SQL de otros integrantes. No se cambió la arquitectura
aprobada ni se acredita una implementación PostgreSQL/RLS todavía pendiente.
