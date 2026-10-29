# SPEC.md — CampusLoop V2

> **Contrato de implementación para integrantes y agentes de programación.**
>
> **Proyecto:** CampusLoop (ReCampus) — IHC y Programación Web, grupo 2.
> **Alcance:** maqueta web responsive del recorrido principal y pantallas de éxito de Figma V2, con HTML5 semántico y CSS puro.
> **Fuente visual definitiva:** [CampusLoop en Figma](https://www.figma.com/design/b14UnSTg43slwvD1fV0XCG/CampusLoop) (`b14UnSTg43slwvD1fV0XCG`).
> **Ramas principales:** `main` (base estable) y `develop` (integración).
>
> Este documento se debe leer **completo antes de escribir código**. Sustituye los prompts individuales del repositorio anterior. No supone que las pantallas antiguas ya existan en el nuevo repositorio.

## 1. Instrucción maestra para el agente

Actúas como agente de desarrollo de **CampusLoop V2**. Tu cometido es implementar **solo** los módulos y archivos asignados al integrante que te invoca, sobre la rama correcta, utilizando los **frames finales editables** de Figma V2 como fuente de verdad. Primero inspecciona el repositorio y el diseño; después comunica el plan y recién entonces implementa. Reutiliza las variables y componentes CSS compartidos, la fuente Inter y los recursos de `assets/`.

La entrega es una **demostración visual navegable**, no una aplicación conectada a servicios: no inventes autenticación, sesiones, pagos, reservas reales, envío de mensajes, persistencia, backend ni generación de IA. Construye las páginas HTML y sus enlaces para que el profesor pueda recorrer el flujo completo. Indica de forma clara, cuando corresponda, que las acciones operativas son demostrativas.

**Antes de modificar archivos:** ejecuta `git branch --show-current`, `git status --short` y `git diff --check`. Si hay cambios de otra persona, detente y consulta al responsable; no los borres. Confirma el **integrante**, la **subrama** y el **módulo asignado** según la sección 6. **No cambies de rama ni ejecutes commits, pushes, merges o Pull Requests sin autorización expresa del integrante.** Nunca alteres Figma.

## 2. Fuentes de verdad y alcance de la entrega

Orden de prioridad:

1. Frames editables definitivos de las páginas **`V2 / Desktop`** y **`V2 / Mobile`** en Figma, más `V2 / Componentes`, `V2 / Recursos` y la guía visual V2.
2. Este `SPEC.md`: tecnologías, recorrido, archivos, reparto de responsabilidades y límites.
3. Código, variables CSS y recursos **ya integrados en el nuevo repositorio**.
4. Decisiones técnicas justificadas cuando Figma no detalle el comportamiento responsive entre 390 y 1440 px.

**No usar** los frames de `mock-up`, `wireframes`, `Respaldo / Originales` ni capturas como sustitutos del HTML. Consulta con Figma MCP los IDs indicados en la sección 7, sus dimensiones, jerarquías, tipografía, colores, espaciado, recursos y componentes; contrasta la información con capturas de los frames. Si un ID dejó de corresponder al diseño vigente, localiza el nuevo en Figma y documenta el cambio; nunca inventes IDs.

**Exigencia del profesor:** implementar el **camino feliz** (pantallas principales y estados de éxito relevantes), **no** todas las variantes de error, vacío, borrador, validación o espera que aparecen en Figma. No crear páginas extras únicamente por existir un frame. Las pantallas complementarias expresamente listadas en la sección 7 corresponden a continuidad normal de la navegación o confirmaciones visuales de éxito; no son operaciones reales.

## 3. Tecnologías de la semana 10 y restricciones

**Permitido y recomendado:**

- HTML5 semántico: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `form`, `label`, `button`, `a`, `figure`, `time`, etc., cuando corresponda.
- CSS puro: Box Model, flujo normal, `display: flex`, `display: grid`, `gap`, `fr`, `minmax()`, `flex-wrap`, márgenes, padding, bordes, `max-width`, unidades relativas y `@media`.
- **Mobile-First:** construir desde ancho pequeño e incorporar media queries de `min-width` para tablet/desktop, respetando la composición final de ambos frames.
- CSS variables/tokens centralizados en `:root` y fuente Inter **local**.
- Enlaces HTML a otras páginas existentes y controles HTML nativos que no transmitan datos.

**No permitido para este entregable:** React, Next.js, Vue, Angular, Bootstrap, Tailwind, bibliotecas UI, dependencias npm, librerías externas ni backend. No implementar lógica de negocio con JavaScript. `js/login.js` se conserva solo como archivo **reservado** para una fase futura: debe permanecer prácticamente vacío, sin crear autenticación ficticia. Que exista un archivo JS mínimo **no garantiza** que GitHub muestre JavaScript en su indicador de lenguajes.

> **Cambio respecto a los prompts antiguos:** la prohibición de Flexbox y Grid ya **no** rige. Se enseñaron en la semana 10. No copiar la regla antigua al nuevo repositorio.

## 4. Estado inicial del NUEVO repositorio: `main` y `develop`

Las dos ramas deben comenzar con **el mismo commit base**, no con la copia de todas las páginas del repositorio antiguo.

**Estado confirmado por coordinación (28 de octubre de 2026):** el repositorio remoto `angelcardenas-dev/campusloop-v2` ya tiene publicadas `main` y `develop`, ambas creadas desde el commit inicial `5a102c1` (`chore: establecer base inicial CampusLoop V2`). La base contiene `SPEC.md`, Landing, Login, Registro, el CSS global con tokens, `js/login.js` reservado y recursos locales. **No volver a inicializar el repositorio ni copiar las páginas del proyecto anterior.** Cada integrante debe clonar este repositorio y partir de `develop` actualizado.

```text
CampusLoop/
├── SPEC.md                 # Este contrato, leído por cada agente
├── index.html              # Landing, copiada del proyecto anterior
├── login.html              # Inicio de sesión, copiado del anterior
├── registro.html           # Registro, copiado del anterior
├── css/
│   └── styles.css          # CSS global y tokens; creado/ajustado en la preparación inicial
├── js/
│   └── login.js            # Archivo reservado; comentario breve, sin lógica activa
└── assets/
    ├── manifest.json       # Conservar si existe en assets originales
    ├── fonts/              # Inter local y licencia
    ├── icons/              # Íconos SVG locales
    └── images/             # Fotos, avatares, fondos y productos locales
```

`css/styles.css` está en **`css/`**, no en la raíz, para mantener las rutas ya escritas en los HTML copiados (`href="css/styles.css"`) y la ruta de Inter (`../assets/fonts/...`). Conservar, dentro de lo posible, los nombres de archivo y las rutas de `assets/` de la versión existente. No copiar al nuevo repositorio las páginas de módulos antiguos que no figuren en esta estructura inicial, auditorías, capturas, respaldos ni archivos temporales. El archivo `.gitignore` puede añadirse como soporte mínimo de Git; se recomienda excluir `.vscode/` si contiene únicamente ajustes locales del editor. La carpeta `.vscode/` que aparece sin seguimiento no forma parte del commit base.

**Preparación inicial (responsabilidad de Angel/coordinación):** copiar las tres páginas HTML y `assets/`; crear este `SPEC.md` y el placeholder `js/login.js`; encargar al agente la construcción/reorganización de `css/styles.css` **antes de repartir las páginas nuevas**. La base de `main` y `develop` debe quedar visualmente correcta y estable.

### 4.1. Contrato para crear `css/styles.css` y sus tokens

El agente encargado de la base debe:

1. Leer completamente `SPEC.md`, `index.html`, `login.html`, `registro.html`, `assets/manifest.json` si existe y las referencias de `assets/`.
2. Revisar con Figma MCP los tres pares de frames iniciales y **`V2 / Componentes`**, la guía visual y los componentes de las otras pantallas principales: barra autenticada, navegación inferior, tarjetas de producto, botones, campos, etiquetas de estado, paneles y avisos.
3. **Extraer** de Figma, sin inventar medidas, los tokens globales: colores, tipografía, pesos, escala de tamaños, alturas de controles, radios, bordes, espaciados, sombras y breakpoints apropiados. Contrastar con las clases y tokens reutilizables del CSS antiguo como referencia técnica, **sin trasladar estilos obsoletos ni reglas que contradigan Figma V2**.
4. Definir una única sección `:root` de tokens y estilos base de `body`, encabezados, enlaces, accesibilidad, `box-sizing`, imágenes responsivas y contenedor general. Mantener la fuente `Inter` desde `assets/fonts/inter-variable.woff2`, con su licencia intacta.
5. Crear/utilizar clases compartidas estables (por ejemplo `button`, `panel`, `brand`, `auth-*`, `home-header`, `home-bottom`, `home-viewport`, tarjetas y campos), **solo en la medida necesaria y justificada por Figma**. Evitar un reinicio de CSS que rompa las tres páginas importadas.
6. Reservar dentro del mismo CSS **zonas por módulo e integrante**: `/* INICIO / ANGEL */`, `/* EXPLORAR / ANGEL */`, `/* DETALLE / BERNABE */`, `/* PERFIL / BERNABE */`, `/* ACTIVACION / MATIAS */`, `/* PUBLICAR / MATIAS */`, `/* RESERVAS / MARICIELO */`, `/* CUENTA / MARICIELO */`. Los compañeros agregarán clases con prefijos propios **en su zona**, minimizando conflictos de merge.
7. Reproducir correctamente **Landing, Login y Registro** tanto a 390 como a 1440 px; probar también 320, 768, 1024, 1280 y 1920 px. No basta con escribir tokens: las tres páginas existentes deben verse como Figma tras el cambio.
8. Documentar los tokens con comentarios breves y los Node IDs usados. Los valores conocidos de identidad son azul `#2640A9`, acento `#5B6FD8`, fondo claro `#EEF2FF` e Inter; **verificar** sus variantes y demás valores mediante Figma, no asumir una escala arbitraria.
9. Mantener la base sin dependencias ni JavaScript funcional. Ejecutar `git diff --check`. Presentar capturas y auditoría al responsable **antes** de autorizar commits o fusionar.

**Regla de propiedad:** después de aprobar la base, solo coordinación modifica `:root` o las clases comunes. Si otro módulo necesita un token/componente nuevo, debe solicitarlo; mientras tanto, agrega clases prefijadas sin sobrescribir selectores globales.

## 5. Estructura final ESPERADA (camino feliz)

La estructura crece con los Pull Requests de cada integrante; **no** se crea completa en el commit inicial.

```text
CampusLoop/
├── SPEC.md
├── index.html                   # Base: Landing
├── login.html                   # Base: ingreso visual
├── registro.html                # Base: registro visual
├── inicio.html                  # Angel: Inicio autenticado
├── explorar.html                # Angel: catálogo de artículos
├── detalle.html                 # Bernabé: detalle de un artículo
├── perfil-vendedor.html         # Bernabé: perfil público de vendedor
├── activar-vendedor.html        # Matias: activar perfil vendedor
├── activar-vendedor-activo.html # Matias: confirmación visual de activación
├── publicar.html                # Matias: formulario de publicación
├── publicar-exito.html          # Matias: confirmación visual de publicación
├── reservas.html                # Maricielo: lista/interacciones Desktop
├── reservas-consulta.html       # Maricielo: conversación Mobile del flujo normal
├── cuenta.html                  # Maricielo: Mi cuenta
├── css/
│   └── styles.css              # ÚNICO CSS global, secciones aisladas por módulo
├── js/
│   └── login.js                # Placeholder, sin lógica de autenticación
└── assets/
    ├── manifest.json
    ├── fonts/
    ├── icons/
    └── images/
```

**Son 14 HTML en total:** 3 páginas base + 11 páginas añadidas. Los nombres de archivos y enlaces deben ser coherentes en todo el recorrido. Las confirmaciones `activar-vendedor-activo.html` y `publicar-exito.html` son **estados positivos de Figma**; no simulan operaciones efectuadas. `reservas-consulta.html` sirve para poder abrir la conversación en Mobile, donde Figma separa listado y detalle. No crear archivos de estado `-error`, `-vacio`, `-borrador`, `-pendiente`, `-vendido`, etc. salvo que el docente cambie el alcance y el equipo lo apruebe expresamente.

## 6. Distribución por integrante, integración y subramas

| Integrante | Módulos bajo su responsabilidad | Rama personal de integración | Subramas de trabajo | Archivos propios |
| --- | --- | --- | --- | --- |
| **Angel David Cardenas Cabrera** | Preparar base, Inicio y Explorar; coordinación de integración | `integracion/angel` | `feature/angel/inicio`, `feature/angel/explorar` | `inicio.html`, `explorar.html`, secciones `home-` y `explore-` del CSS |
| **Bernabé Gonzales Galán** | Detalle y Perfil público del vendedor | `integracion/bernabe` | `feature/bernabe/detalle`, `feature/bernabe/perfil-vendedor` | `detalle.html`, `perfil-vendedor.html`, secciones `detail-` y `seller-` |
| **Matias Alessandro Palacios Paulino** | Activación y Publicación (incluidas confirmaciones positivas) | `integracion/matias` | `feature/matias/activar-vendedor`, `feature/matias/publicar` | `activar-vendedor*.html` indicados en sección 5, `publicar*.html` indicados allí; secciones `activate-`, `publish-` |
| **Maricielo Fiorela Almonacid Juscamaita** | Reservas/Mensajes del flujo normal y Mi cuenta | `integracion/maricielo` | `feature/maricielo/reservas`, `feature/maricielo/mi-cuenta` | `reservas.html`, `reservas-consulta.html`, `cuenta.html`; secciones `reservation-`, `account-` |

Esta es la **asignación acordada como plan inicial del SPEC**: la coordinación puede redistribuirla **antes** de que los compañeros empiecen; documentar la decisión en un PR de `SPEC.md`. Nunca atribuir a un compañero el código antiguo escrito por otro: cada integrante debe construir/revisar, corregir y registrar **contribuciones nuevas reales** en el repositorio nuevo.

**Ramas de varios niveles:** Git no permite mantener simultáneamente una rama `feature/angel` y otra `feature/angel/inicio`, porque colisionan los nombres de las referencias. Por eso las ramas personales usan el prefijo **`integracion/`** y sus subramas el prefijo **`feature/`**. Una subrama se **crea desde** la rama personal de integración y se fusiona mediante PR a esa rama; luego la rama personal se presenta por PR contra `develop`. Las ramas son referencias Git, no carpetas dentro de `main`.

### Flujo de trabajo Git obligatorio

1. Angel publica la **base inicial aprobada** en `main` y crea `develop` desde el mismo commit, con el mismo contenido.
2. Cada compañero acepta la invitación al repositorio y configura **su propia cuenta GitHub y su correo de commits**. Hace `git clone`, revisa `SPEC.md` y parte de `develop` actualizado.
3. Crea `integracion/<integrante>` desde `develop`. Crea su primera subrama `feature/<integrante>/<modulo>` desde su rama personal.
4. Implementa **solo** su módulo. Revisa con el responsable antes de ejecutar `git add`, `git commit` o `git push`.
5. Tras aprobación, sube la subrama y abre un **Pull Request hacia `integracion/<integrante>`**, no hacia `main`. Revisa y fusiona.
6. Crea la segunda subrama **desde `integracion/<integrante>` actualizado** y repite el proceso. No volver a empezar desde un `develop` desactualizado cuando se requiere reutilizar el CSS del primer módulo.
7. Presenta su rama personal `integracion/<integrante>` mediante PR a `develop`. Antes de mezclar, actualiza la base y resuelve conflictos de `css/styles.css` sin sobrescribir secciones ajenas; verifica que todas las páginas existentes sigan funcionando.
8. Angel revisa los PRs de todos, integra de manera controlada en `develop`, comprueba el flujo completo y luego propone un PR de versión estable **`develop` → `main`**, solo cuando el equipo esté listo.

Ejemplo de comandos **solo cuando la coordinación indique empezar y la rama base esté publicada**:

```powershell
git clone <URL-DEL-NUEVO-REPOSITORIO>
cd <CARPETA-DEL-NUEVO-REPOSITORIO>
git switch develop
git pull --ff-only origin develop
git switch -c integracion/bernabe
git push -u origin integracion/bernabe
git switch -c feature/bernabe/detalle
# El agente implementa, prueba y espera aprobación.
```

**Evidencia académica verificable:** conservar autoría real de commits por cuenta, PRs creados desde la cuenta correspondiente, archivos/diffs propios, descripción de pruebas, revisión y merge. No compartir credenciales, no cambiar `git config user.name` a otra persona, no fabricar commits ni atribuciones y no fusionar trabajos incompletos. El historial de GitHub es evidencia; un nombre en `SPEC.md` por sí solo no demuestra participación.

## 7. Pantallas asignadas y Node IDs de Figma V2

IDs de referencia principal comprobados en el archivo V2. Antes de implementar, confirmar **visualmente** que siguen siendo los diseños definitivos mediante Figma MCP.

| Pantalla / archivo | Responsable | Desktop | Mobile | Estado |
| --- | --- | --- | --- | --- |
| Landing — `index.html` | Base, Angel | `278:2735` | `278:2816` | Copiada; conservar y verificar |
| Iniciar sesión — `login.html` | Base, Angel | `278:2880` | `278:2921` | Copiada; conservar y verificar |
| Registro — `registro.html` | Base, Angel | `278:2946` | `278:3001` | Copiada; conservar y verificar |
| Inicio — `inicio.html` | Angel | `278:3030` | `278:3115` | Principal; comprador de ejemplo |
| Explorar — `explorar.html` | Angel | `278:3154` | `278:3437` | Principal; artículos y filtros visibles |
| Detalle — `detalle.html` | Bernabé | `278:3486` | `278:3554` | Principal; MacBook del ejemplo |
| Perfil de vendedor — `perfil-vendedor.html` | Bernabé | `278:3597` | `278:3669` | Principal; Carlos Pérez |
| Activar vendedor — `activar-vendedor.html` | Matias | `278:3813` | `278:3884` | Formulario principal |
| Perfil activo — `activar-vendedor-activo.html` | Matias | `298:2161` | `299:1285` | **Éxito visual** de activación |
| Publicar — `publicar.html` | Matias | `278:3711` | `278:3774` | Formulario principal |
| Publicación exitosa — `publicar-exito.html` | Matias | `298:2331` | `299:1494` | **Éxito visual** de publicación |
| Reservas — `reservas.html` | Maricielo | `278:3929` | `278:4006` | Principal; listado Mobile |
| Conversación — `reservas-consulta.html` | Maricielo | Reutilizar conversación de `278:3929` | `303:1433` | Detalle de consulta Mobile |
| Mi cuenta — `cuenta.html` | Maricielo | `278:4040` | `278:4139` | Principal; perfil de comprador |

**Nota de pantalla éxito:** la tabla contiene **14 filas HTML**, contando 3 iniciales y 11 añadidas: `inicio`, `explorar`, `detalle`, `perfil-vendedor`, `activar-vendedor`, `activar-vendedor-activo`, `publicar`, `publicar-exito`, `reservas`, `reservas-consulta`, `cuenta`. Esos son los únicos entregables HTML previstos. No generar variantes extra sin autorización. Si el profesor entiende «solo éxito» como **solo las 11 pantallas principales**, omitir las dos confirmaciones y la conversación separada **únicamente tras decisión del equipo**, y actualizar este archivo y el mapa de navegación antes de implementar.

### Requisitos por módulo

**Angel — Inicio:** bienvenida, actividad, métricas, acciones para explorar/activar vendedor, recomendaciones, navegación autenticada. **Explorar:** catálogo, filtros y tarjetas según Figma; solo enlazar a `detalle.html` desde la tarjeta de la **MacBook** representada en ese detalle, no desde productos distintos.

**Bernabé — Detalle:** galería, características, precio `S/`, disponibilidad, acciones, información y enlace al perfil de Carlos; no crear reserva real. **Perfil público:** universidad, verificación, anuncios y reputación como **datos de ejemplo de Figma**. No mezclar calificaciones de comprador/vendedor ni exponer evidencias privadas de experiencia.

**Matias — Activación:** una cuenta compradora puede activar perfil vendedor; no exigir experiencia previa a principiantes y no asignarles reputación automática. Mostrar las normas y el flujo positivo como **pantalla estática de referencia**, sin almacenar solicitud. **Publicación:** formulario y confirmación positiva según Figma, precio en `S/`; IA solo visual si es parte del frame principal, sin generación real. Solo el ejemplo de vendedor activo conduce a publicar; no crear control real de roles.

**Maricielo — Reservas:** conversación y estados principales como datos estáticos; **Consulta ≠ Reserva ≠ Confirmado ≠ Completada**. El listado Mobile y la conversación deben ser páginas separadas como en Figma. No afirmar que se reservaron productos, se enviaron mensajes o se completaron transacciones. **Mi cuenta:** perfil de estudiante, métricas, accesos a sus compras/ventas según el frame principal, configuración visual si aparece; no inventar persistencia ni pestañas que requieran nuevas páginas fuera del alcance.

## 8. Mapa de navegación del recorrido principal

**Objetivo:** demostrar al profesor que **todas las páginas construidas pueden recorrerse** mediante enlaces reales de HTML. No dejar enlaces rotos ni enviar datos de formularios.

```text
Landing (index.html)
  ├── Iniciar sesión (login.html)
  │     └── Continuar al prototipo / Ingresar en modo demostración → Inicio (inicio.html)
  └── Registrarse (registro.html)
        └── Volver a iniciar sesión (login.html)

Inicio (inicio.html)
  ├── Explorar (explorar.html)
  │     └── Ver detalle de la MacBook (detalle.html)
  │           └── Ver vendedor (perfil-vendedor.html)
  │                 └── Volver a Detalle / Explorar
  ├── Activar perfil vendedor (activar-vendedor.html)
  │     └── Ver ejemplo de perfil activo (activar-vendedor-activo.html)
  │           └── Nueva publicación (publicar.html)
  │                 └── Ver ejemplo de publicación exitosa (publicar-exito.html)
  │                       └── Volver a Inicio / Explorar
  ├── Reservas (reservas.html)
  │     └── Consulta sobre MacBook (reservas-consulta.html)
  │           └── Volver a Reservas
  └── Avatar / Mi cuenta (cuenta.html)
        └── Accesos existentes a Inicio, Activación, Publicar o Reservas, según diseño
```

Cabecera autenticada Desktop: **Inicio, Explorar, Publicar, Reservas**, más buscador, notificaciones y avatar. **Mi cuenta se abre desde el avatar**, no es una quinta pestaña. En Mobile respetar cabecera y **barra inferior** V2, con el contenido desplazable accesible sin tapar el último botón. Landing utiliza navegación pública distinta.

Mientras faltan páginas por integrar, no crear `href` hacia rutas inexistentes. Al integrar un módulo, habilitar enlaces pertinentes y comprobarlos; coordinar cambios en HTML de otros responsables mediante revisión de PR. Si aún no existe destino, dejar el control visual identificado como pendiente. **No apuntar las ocho tarjetas a la misma ficha de MacBook.**

**Recorrido de demostración sin backend:** el usuario debe poder pasar de Login a Inicio, pero el clic no puede fingir una autenticación real ni transmitir contraseñas. Con aprobación de coordinación, añadir un enlace explícito como **«Continuar al prototipo (demo)»** que navegue a `inicio.html`; no usar un `form` de envío ni una función JS simulada. En Registro, «Crear cuenta» tampoco debe transmitir información ni afirmar que se creó una cuenta; facilitar el regreso a Login. Los botones «Enviar mensaje», «Reservar», «Activar», «Guardar» y «Publicar» que demandarían datos reales deben ser inertemente estáticos **o** abrir una pantalla positiva identificada como *ejemplo visual*, sin mostrar éxito de una operación real.

## 9. Estándares de implementación compartidos

1. Reusar `css/styles.css` y tokens; no crear hojas CSS por módulo ni pegar estilos `style=` masivamente. Introducir clases prefijadas `home-`, `explore-`, `detail-`, `seller-`, `activate-`, `publish-`, `reservation-`, `account-`. No modificar `:root` ni selectores generales sin aprobación de coordinación.
2. Conservar `Inter`, fotografías y SVG del `assets/` local; consultar `manifest.json`. No redescargar ni duplicar recursos ni usar capturas de Figma como fondos de pantalla completos.
3. Respetar textos, universidad, campus, nombres, imágenes, precios `S/`, estados, jerarquía visual y medidas de los frames V2. No inventar tarjetas o textos que cambien el negocio.
4. HTML con un `h1` principal, `lang="es"`, `meta viewport`, `label` asociados, `alt` útil, `aria-current="page"`, foco visible y navegación por teclado. Usar nombres accesibles en controles. No presentar botones deshabilitados como operativos.
5. Las imágenes deben tener tamaños responsivos y conservar proporción; el layout debe envolver o apilar columnas según el ancho. Usar Flexbox para una dirección y Grid para distribución en dos dimensiones cuando corresponda; no forzar tablas o `inline-block` si Grid representa mejor Figma.
6. No formularios que envíen datos: usar `button type="button"` para acciones visuales, impedir submit implícito con Enter si existe `form`, y no exponer peticiones de autenticación/mensajes/publicaciones. No desarrollar backend, cookies, almacenamiento ni roles/sesiones falsos.
7. Aplicar el responsive **Mobile-First**, con la referencia de 390 px y la de 1440 px, adaptándose también a 320, 768, 1024, 1280 y 1920 px. El fondo de cabecera Desktop debe cubrir todo el ancho de la ventana y el contenido mantenerse centrado cuando corresponda.
8. Cuando se agregue un enlace al flujo, verificar que el archivo de destino exista en la rama que se vaya a fusionar. Evitar enlaces a archivos que solo están en la máquina de otro compañero.
9. Respetar que CampusLoop **no procesa pagos**, que los estudiantes pueden ser compradores y vendedores en la misma cuenta y que la reputación requiere operaciones completadas y calificaciones reales (en este proyecto, solo muestras estáticas).
10. No eliminar ni renombrar archivos de otros integrantes o activos usados por otras páginas. No introducir pruebas ficticias ni declarar validaciones no ejecutadas.

## 10. Validaciones exigidas antes de cada revisión

**En Chrome + Live Server**, inspeccionar cada nueva página al menos a **320, 390, 768, 1024, 1280, 1440 y 1920 px**, con prioridad visual en **390 y 1440 px**. Verificar:

- Comparación visual con los Node IDs Desktop y Mobile: composición, tipografía, textos, medidas, márgenes, estados e imágenes; documentar diferencias.
- Carga local de CSS, fuente Inter, SVG, avatares, fotos y enlaces.
- Sin desplazamiento horizontal, textos cortados, imágenes deformadas ni controles superpuestos.
- Navegación con teclado, foco visible, semántica, etiquetas y `alt`.
- Scroll Mobile correcto y barra inferior accesible, sin cubrir contenido.
- Navegación real entre **páginas existentes**; ninguna operación que parezca enviar datos o guardar información.
- **Regresión** de las tres páginas base y de las pantallas ya fusionadas a `develop` (si existen).
- `git diff --check` sin errores, además de `git status --short` y `git diff --stat`.

### 10.1. Carpeta oficial de evidencias (coordinación)

Guardar las capturas, diferencias, comparaciones y auditorías **fuera del repositorio Git**, en la siguiente raíz de evidencias de coordinación:

```text
D:\Ciclo 5\IHC y Programacion WEB\CampusLoop-v2\
└── Evidencias_Figma_V2\
    └── Documentacion\
        ├── Base_Inicial\                 # Landing, Login, Registro y tokens
        ├── angel\
        │   ├── inicio\
        │   └── explorar\
        ├── bernabe\
        │   ├── detalle\
        │   └── perfil-vendedor\
        ├── matias\
        │   ├── activar-vendedor\
        │   └── publicar\
        └── maricielo\
            ├── reservas\
            └── mi-cuenta\
```

**Ruta de ejemplo para un agente:** `D:\Ciclo 5\IHC y Programacion WEB\CampusLoop-v2\Evidencias_Figma_V2\Documentacion\angel\inicio`. Crear la subcarpeta del módulo antes de guardar. Cada carpeta puede contener `REVISION.md` o `AUDITORIA.md`, capturas Figma y Chrome en Desktop/Mobile, comparaciones, resultados de validación y una lista de diferencias pendientes. Nombrar los archivos de forma reconocible, por ejemplo `inicio-desktop-1440.png`, `inicio-mobile-390.png` y `comparacion-inicio-390.png`.

**Esta ruta D: corresponde al equipo local de coordinación.** Si un integrante trabaja desde otra computadora sin esa unidad, deberá guardar la evidencia en su propia carpeta **fuera del clon del repositorio** y facilitarla al coordinador, quien la organizará aquí. Una ruta privada en un PR no es un enlace accesible para el profesor: registrar en GitHub el trabajo mediante commits y Pull Requests auténticos y, cuando se necesite consultar las capturas, adjuntarlas al PR o compartirlas por un medio accesible. No subir carpetas completas de capturas al código fuente ni atribuir pruebas no realizadas.

**Migración de evidencias anteriores:** la auditoría inicial ya existe en `C:\Users\camin\AppData\Local\Temp\Evidencias_Figma_V2\CampusLoop-V2-base-20261028`; copiar su contenido a `...\Documentacion\Base_Inicial\` y conservarla fuera de `C:\Proyectos\campusloop-v2`. Evitar depender de `Temp` porque su contenido puede borrarse.


## 11. Formato de respuesta obligatorio del agente al finalizar un módulo

Informa, de forma clara y verificable:

1. Integrante, rama actual y **módulo exacto** implementado.
2. Node IDs de Figma realmente consultados (Desktop y Mobile).
3. Archivos creados, archivos modificados y razón de cada cambio fuera de la propiedad del módulo.
4. Recursos reutilizados y CSS/tokens usados, incluida la decisión Flexbox/Grid/Mobile-First.
5. Enlaces del recorrido habilitados y rutas pendientes.
6. Resultado **real** de pruebas responsive, comparación con Figma, accesibilidad, `git diff --check` y regresiones.
7. Diferencias visuales, limitaciones estáticas y pendientes.
8. Ruta de evidencias fuera del repositorio, respetando la sección 10.1 o documentando la ubicación alternativa del integrante.
9. Salida final de `git branch --show-current` y `git status --short`.

**Punto de control:** detente cuando el módulo esté listo para revisión visual del integrante en Live Server. **No** ejecutar `git commit`, `git push`, `git merge`, `git reset`, `git clean`, cambios de rama o creación de PR sin aprobación explícita.

## 12. Prompt corto que cada integrante enviará a su agente

Copiar y adaptar los campos entre corchetes:

> Estoy trabajando en CampusLoop V2. Soy **[NOMBRE DEL INTEGRANTE]**, en la rama **[SUBRAMA ACTUAL]** y me corresponde el módulo **[NOMBRE DEL MÓDULO]**.
>
> Lee **todo `SPEC.md`**, comprueba la rama y el estado de Git y revisa los archivos existentes. Consulta por Figma MCP únicamente los frames finales V2 Desktop/Mobile y componentes de **mi módulo**, según la sección 7. Antes de programar, resume los Node IDs, páginas y archivos que implementarás.
>
> Implementa solo mi módulo con HTML5 semántico, CSS puro, **Flexbox/Grid y Mobile-First**, reutilizando `css/styles.css`, tokens, Inter y `assets/`, y conservando el recorrido estático navegable de la sección 8. **Solo camino feliz y pantallas positivas autorizadas**, sin errores ni variantes extra. No inventes backend, autenticación o envío de datos. Valida siete anchos, Figma, navegación, accesibilidad y regresiones; guarda evidencias según la sección 10.1, fuera del repo.
>
> No modifiques Figma ni cambies de rama. **No hagas commits, pushes, merges o PR** antes de mi revisión y autorización. Devuélveme archivos, pruebas reales, diferencias y estado de Git.

---

**Mantenimiento del SPEC:** si el profesor redefine alcance, pantallas de éxito, convenciones o reparto, realizar el cambio mediante PR revisado **antes** de ejecutar los nuevos prompts. El contenido del `SPEC.md` en el repositorio nuevo prevalece sobre las instrucciones de los prompts históricos del proyecto anterior. :D
