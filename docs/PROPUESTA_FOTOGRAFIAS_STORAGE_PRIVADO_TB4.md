# Propuesta técnica: fotografías privadas para publicaciones TB4

Estado: preparación offline para revisión. No es un contrato ratificado de API ni una configuración de producción.

## Formas de los datos

La referencia persistente propuesta contiene exclusivamente:

```js
{
  proveedor: 'supabase',
  bucket: '<bucket resuelto por configuración confiable>',
  ruta: '<uuid-del-propietario>/<nombre-de-objeto>.<jpg|png|webp>',
  formato: 'image/jpeg' | 'image/png' | 'image/webp',
  bytes: 1,
  ancho: 100,
  alto: 100
}
```

El bucket y el propietario se resuelven mediante una dependencia confiable vinculada a la sesión verificada. El formulario, el agente y los argumentos de una herramienta no pueden elegirlos. Este trabajo no fija el nombre de bucket, no autentica usuarios y no consulta Storage.

La presentación, cuando se necesite mostrar un objeto privado ya existente, es independiente y temporal:

```js
{ url: '<URL firmada temporal>', expiraEn: '<fecha ISO>' }
```

La URL firmada no forma parte de la referencia persistente ni del DTO de escritura. No debe guardarse en PostgreSQL, memoria, preferencias ni logs. La vista actual de publicación mantiene el preview `blob:` local; la futura capa de lectura deberá renovar una URL temporal autorizada al necesitarla.

La validación offline exige bucket y propietario coincidentes con el contexto inyectado, UUID completo como primer segmento de ruta, un único nombre de objeto, correspondencia entre formato y extensión, y metadatos compatibles con el archivo seleccionado. El objetivo de 2 MiB y las dimensiones de 100 a 12 000 píxeles siguen siendo límites provisionales pendientes de ratificación de Storage.

## Incompatibilidades que requieren coordinación

La migración existente `supabase/migrations/20261113000100_tablas_tb4.sql` define `imagen_bucket`, `imagen_ruta`, `imagen_url`, `imagen_formato`, `imagen_bytes`, `imagen_ancho` e `imagen_alto`. `imagen_url` es `NOT NULL`; su restricción solo comprueba una URL HTTPS sin consulta ni fragmento. No se modifica ni se vuelve a aplicar esa migración.

El consumidor actual `js/articulos.js` lee `imagen_url` y exige una ruta pública de Storage. `js/catalogo.js` prepara la presentación a partir de `dto.imagen.url`. Esas interfaces no son compatibles con una referencia privada persistida sin URL. No se mantiene una alternativa pública como compatibilidad productiva.

Antes de activar la integración real, Bernabé y coordinación deben acordar una migración incremental revisada para dejar de requerir una URL permanente, la proyección del DTO, las políticas privadas de `storage.objects`, la autorización del propietario para subir/leer y la forma de emitir URLs de presentación de corta duración. Los controladores de catálogo y artículos deben migrar juntos a una referencia persistente y una presentación efímera separadas.

## Límites de esta entrega

- El uploader y el contexto Storage se inyectan; no se crea cliente Supabase ni se hace una llamada de red.
- Las pruebas usan propietario, bucket y origen sintéticos.
- Validar una referencia no prueba que el objeto exista, que el contenido coincida con sus metadatos ni que Storage autorice su acceso.
- La cancelación invalida resultados tardíos y señales, pero no revierte una subida remota que el servidor ya haya comenzado.
- Si una subida pudo completarse y falla la creación del artículo, el objeto podría quedar huérfano. Su conciliación y borrado requieren un servicio autorizado que compruebe propiedad y estado; el navegador no borra objetos como compensación.
- Después de iniciar `crearPublicacion`, incluso una respuesta estructurada `RED`, `SERVIDOR`, `NO_AUTORIZADO` u otro error puede ser ambigua hasta que el servicio autoritativo garantice que no creó el artículo. Esos casos bloquean nuevos envíos en esa instancia. Una validación local anterior a la llamada sí permite corregir y reintentar. Esto no es idempotencia duradera ni sobrevive a una recarga. El contrato futuro necesita identificador de operación, semántica definitiva de errores y reconciliación autoritativa en servidor antes de habilitar reintentos.
- La vigilancia de cambio de identidad es un puerto obligatorio para el flujo de publicación, pero esta rama no lo conecta a Auth. La página permanece en integración pendiente hasta recibir el adaptador oficial y los servicios autorizados.

No se han aplicado SQL, RLS, GRANTS, configuración de Storage ni cambios a los consumidores de Bernabé.
