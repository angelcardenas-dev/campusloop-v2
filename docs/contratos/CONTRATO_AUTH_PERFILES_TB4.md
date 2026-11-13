# CampusLoop V2 — Contrato de integración Auth ↔ perfiles (TB4)

> **Estado:** Aprobado por coordinación para iniciar implementación; revisión técnica de Bernabé pendiente.\
> **Fecha de propuesta:** 12/11/2026 (Perú).\
> **Referencia superior:** `SPEC_TB4.md` versión 1.0. Este documento complementa ese contrato; no lo modifica.\
> **Responsables:** Angel (cliente/Auth); Bernabé (esquema, perfiles y RLS); Maricielo (formularios/UI); Matías (consumidor de sesión).

## 1. Alcance, límites y dependencias

- Se utiliza **Supabase Auth oficial (`supabase-js` v2)** para credenciales, identidad, sesión y renovación; PostgreSQL para perfiles y datos de negocio; **RLS** para autorización.
- JavaScript vanilla multipágina con **ES modules**, sujeto a comprobar la carga compatible con los HTML actuales. Una sola instancia del cliente Supabase por página.
- No se implementan JWT manuales, contraseñas en PostgreSQL ni sesiones propias de CampusLoop. El SDK puede persistir su sesión, pero `js/localstorage.js` no debe copiar tokens.
- `SUPABASE_URL` y **publishable key** son parámetros públicos; nunca se incluyen claves secretas, `service_role`, contraseñas de BD ni tokens en archivos versionados, capturas o logs.
- El servicio Auth **no manipula DOM ni redirige**; la UI decide mensajes y navegación. Los servicios de negocio no duplican Auth ni crean otro cliente.
- Se verifica la configuración existente de Auth, email/SMTP, URLs de retorno y plan Free **antes de efectuar registros reales**. No desactivar confirmación ni ejecutar SQL sin autorización.

## 2. Responsabilidad por archivos

| Propietario | Módulos | Función |
| --- | --- | --- |
| Angel | `js/config-publica.js`, `js/supabase-cliente.js`, `js/auth.js` | Configuración pública, cliente único, Auth y pruebas aisladas |
| Bernabé | `supabase/migrations/`, servicio de perfiles | Tablas, FK, RLS/grants, trigger de perfil mínimo y pruebas de seguridad |
| Maricielo | `js/acceso-ui.js`, `registro.html`, `login.html` | DOM, validación visual, errores, navegación y conexión a Auth |
| Matías | Módulos de vendedor/publicación/imagen | Consumir cliente y contexto de usuario; sin reimplementar Auth |

## 3. Modelo mínimo de identidad y perfil

**Fuente de identidad:** `auth.users.id` (UUID asignado por Supabase). No insertar ni actualizar manualmente `auth.users` para cuentas de demostración.

**Tabla prevista:** `public.perfiles`; campos mínimos:

| Campo | Tipo / regla |
| --- | --- |
| `id` | `uuid PRIMARY KEY REFERENCES auth.users(id)` (política de borrado a concretar) |
| `nombre_visible` | `text`, validado; puede estar pendiente de completar |
| `campus_id` | `uuid`, FK a catálogo `campus`, inicialmente nullable |
| `vendedor_activado` | `boolean NOT NULL DEFAULT false`, no editable libremente por titular |
| `creado_en` | `timestamptz` generado por servidor |
| `actualizado_en` | `timestamptz` generado por servidor |

**Relaciones:** `campus` pertenece a `universidades`; no duplicar cadenas de universidad/campus por pantalla. La forma física final la propone Bernabé y la revisan sus consumidores.

**Creación:** Bernabé diseña un trigger seguro de `auth.users` que cree **solo perfil mínimo** con el UUID real y sin privilegios. No confiar en `raw_user_meta_data` para establecer `vendedor_activado`, identidad verificada o permisos. Validar errores del trigger: un fallo puede bloquear `signUp()`.

**Completar perfil:** un servicio de perfiles protegido por RLS (de Bernabé) recibe nombre/campus ya validados **después de que exista sesión auténtica**. No insertarlo desde `auth.js` anticipando tablas no creadas. Si el formulario recoge esos datos antes de la confirmación del correo, no afirmar que ya se guardaron: la UI debe pedir completarlos al acceder o usar un flujo acordado que no exponga datos privados.

**Privacidad:** perfiles públicos no exponen correo, contraseñas ni datos de cuenta privados. RLS + permisos por columna limitan lectura/escritura. La activación de vendedor necesita operación autorizada, no una actualización general de un booleano desde el navegador.

## 4. Interfaz pública obligatoria `js/auth.js`

Exportar exactamente estas siete funciones de uso compartido:

| Firma | Entrada | Resultado esperado |
| --- | --- | --- |
| `registrar(datosRegistro)` | `{ nombreVisible, universidadId, campusId, correo, contrasena, confirmarContrasena, aceptaTerminos }` | Devuelve estado real de registro: `PENDIENTE_CONFIRMACION` o `AUTENTICADO` si existe sesión válida. Validar campos coherentemente con la UI. **No persistir perfil desde Auth**. |
| `iniciarSesion(correo, contrasena)` | Credenciales | Login mediante `signInWithPassword`; usuario reducido/estado, no sesión cruda |
| `obtenerUsuarioActual()` | Ninguna | `getUser()` para verificar usuario cuando hace falta; usuario reducido o `null` |
| `obtenerEstadoAuth()` | Ninguna | Estado de sesión para UI, sin entregar JWT; resolver restauración SDK antes de declarar estado. No usar estado local como autorización de servidor |
| `cerrarSesion()` | Ninguna | `signOut()` oficial; resultado o error normalizado |
| `escucharCambiosAuth(callback)` | Función receptora | Registrar `onAuthStateChange`; devolver función `unsubscribe` que limpie suscripción |
| `requerirAutenticacion()` | Ninguna | Resultado autorizado/no autorizado, **sin redirección automática ni DOM** |

**Registro:** el servicio usa `auth.signUp()` con email/password; si `usuario` existe pero `session` es `null`, el resultado es **PENDIENTE_CONFIRMACION**, no AUTENTICADO. Los datos adicionales recogidos en `datosRegistro` se validan, pero no se presentan como persistidos en perfiles hasta que el servicio de Bernabé lo confirme. `confirmarContrasena` y aceptación de términos son comprobaciones del formulario, **no** datos para `auth.users` ni prueba de consentimiento registrada en servidor.

**Respuesta estándar asíncrona:**

```js
{ ok: true, datos: { estado: 'AUTENTICADO', usuario: { id: 'uuid', correo: '...' } }, error: null }
// o
{ ok: false, datos: null, error: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'No pudimos iniciar sesión.' } }
```

La respuesta puede incluir **correo del propio usuario** para la interfaz de cuenta, pero nunca objetos de sesión, JWT, refresh token o credenciales. No registrar ni mostrar el correo en capturas públicas. `datos` puede ser `null` cuando corresponda (p.ej., usuario no autenticado). El servicio no debe exponer detalles de existencia de otras cuentas.

**Códigos normalizados iniciales:** `VALIDACION`, `CREDENCIALES_INVALIDAS`, `NO_AUTORIZADO`, `CORREO_PENDIENTE`, `RED`, `LIMITE`, `CONFIGURACION`, `SERVIDOR`. Mapear fallos reales del SDK de forma conservadora; no adivinar si la cuenta existe ni prometer verificación universitaria.

**Eventos:** callback recibe únicamente `{ evento, estado, usuario }` con datos reducidos. La devolución de `escucharCambiosAuth()` es una función de limpieza, no `{ ok, datos, error }`. Evitar llamadas asíncronas de Supabase dentro del callback de `onAuthStateChange` que puedan bloquear el cliente.

## 5. Reglas y pruebas de integración

- Registro inválido no llama a Supabase ni borra el formulario. Si correo requiere confirmación, mostrar estado pendiente y no abrir páginas privadas.
- Login válido/erróneo, recarga, sesión ausente, cierre, expiración y error de red controlados. El SDK maneja auto-refresh; **no** emitir o renovar JWT manualmente.
- `obtenerEstadoAuth()` sirve a la UI; los recursos privados siguen bajo RLS. Una guarda de navegación no reemplaza RLS.
- Login y registro no guardan contraseñas en `localStorage`, base de datos de aplicación ni consola.
- El servicio de perfiles crea/recupera el registro de usuario con `id = auth.users.id`; no permite editar `vendedor_activado`, estado institucional ni datos ajenos.
- Dos usuarios independientes solo ven sus datos personales; una tercera cuenta no accede a conversaciones o reservas ajenas (pruebas futuras de Bernabé).
- Pruebas unitarias de `auth.js` con doble del SDK pueden avanzar sin red. Pruebas reales con Supabase y correo son **pendientes de autorización/configuración** y deben registrarse sin secretos.
- Fijar versión/origen de `supabase-js` v2 y compatibilidad de módulos antes de conectar los HTML. `registro.html` y `login.html` son propiedad UI de Maricielo.

## 6. Orden de implementación y revisión

1. Angel crea rama `feature/angel/auth-servicio` desde `integracion/angel`, añade el contrato como **primer commit documental**, con diff independiente.
2. Angel implementa cliente único y siete funciones **sin modificar HTML, SQL ni otros módulos**. Puede usar dobles locales mientras se valida correo y Supabase.
3. Bernabé revisa este acuerdo y concreta migraciones/RLS/perfiles en su rama, sin ejecutarlas hasta aprobación. Si se descubre incompatibilidad, registrar propuesta de cambio en PR y coordinarla antes de integrar.
4. Maricielo conecta formularios en su rama cuando la interfaz esté estable; Matías consume sesión, cliente y servicios sin duplicarlos.
5. PR pequeños: `feature/angel/auth-servicio` → `integracion/angel` → `develop`, con revisión de consumidores. No modificar `main`, `v0.1.0`, `SPEC.md` ni `SPEC_TB4.md`.

**Control de cambios:** este acuerdo es compartido y debe estar visible a los cuatro integrantes. Los cambios requieren revisión de Angel y Bernabé; no cambiar unilateralmente firmas/campos consumidos. No es necesario añadirlo a `CODEOWNERS` salvo decisión explícita de coordinación. Avances y pruebas viven en Trello/PR, no en revisiones semanales del SPEC.
