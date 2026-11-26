import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Datos: lista permitida; no copiar directorios ni descubrir archivos nuevos. */
const PAGINAS = [
  'index.html',
  'login.html',
  'registro.html',
  'inicio.html',
  'explorar.html',
  'detalle.html',
  'perfil-vendedor.html',
  'activar-vendedor.html',
  'activar-vendedor-activo.html',
  'publicar.html',
  'publicar-exito.html',
  'reservas.html',
  'reservas-consulta.html',
  'cuenta.html',
];
const RECURSOS = [
  'css/styles.css',
  'css/agente.css',
  'js/agente-ui.js',
  'js/agente-cliente.js',
  'js/agente-montaje.js',
  'js/agente-contexto-catalogo.js',
  'js/agente-memoria.js',
  'js/agente-memoria-coordinador.js',
  'js/agente-memoria-conexion.js',
  'js/agente-memoria-lock.js',
  'js/agente-storage-adaptador.js',
  'js/localstorage.js',
  'js/acceso-ui.js',
  'js/auth.js',
  'js/supabase-cliente.js',
  'js/config-publica.js',
  'js/catalogo.js',
  'js/articulos.js',
  'js/directorios.js',
  'js/perfiles.js',
  'js/reservas.js',
  'js/mensajeria.js',
  'js/operaciones-tb4.js',
  'js/landing.js',
  'js/imagenes.js',
  'js/publicaciones.js',
  'js/vendedor.js',
  'assets/fonts/inter-variable.woff2',
  'assets/fonts/license.txt',
  'assets/icons/campana.svg',
  'assets/icons/campus-32.svg',
  'assets/icons/campus.svg',
  'assets/icons/estrella-dorada-24.svg',
  'assets/icons/estrella.svg',
  'assets/icons/explorar-20.svg',
  'assets/icons/explorar.svg',
  'assets/icons/juegos-32.svg',
  'assets/icons/laptop-32.svg',
  'assets/icons/libro-32.svg',
  'assets/icons/publicar.svg',
  'assets/icons/reservas.svg',
  'assets/icons/usuarios.svg',
  'assets/icons/verificado-20.svg',
  'assets/icons/verificado.svg',
  'assets/images/avatares/ana-torres.jpg',
  'assets/images/avatares/carlos-perez.jpg',
  'assets/images/avatares/maria-lopez.jpg',
  'assets/images/estudiantes-biblioteca.jpg',
  'assets/images/estudiantes-campus.jpg',
  'assets/images/fondos/autenticacion-ondas.png',
  'assets/images/productos/apuntes-calculo.jpg',
  'assets/images/productos/audifonos-sony-wh1000xm4.jpg',
  'assets/images/productos/calculadora-casio-fx991ex.jpg',
  'assets/images/productos/ipad-air.jpg',
  'assets/images/productos/libro-algebra-lineal.jpg',
  'assets/images/productos/libro-calculo-stewart.jpg',
  'assets/images/productos/libro-fisica-universitaria.jpg',
  'assets/images/productos/macbook-air-m1.jpg',
  'assets/images/productos/macbook-cerrada.png',
  'assets/images/productos/macbook-vista-frontal.png',
  'assets/images/productos/nintendo-switch.jpg',
];
const ARCHIVOS = [...PAGINAS, ...RECURSOS].sort();
const PERMITIDOS = new Set(ARCHIVOS);
const RAIZ = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const DESTINO = resolve(RAIZ, 'dist');
const ORIGEN_VALIDACION = 'https://campusloop.invalid'; // Solo resolución local; sin red.

/* Funciones */
function comprobarFuente(archivo) {
  let ruta = RAIZ;
  for (const parte of archivo.split('/')) {
    ruta = join(ruta, parte);
    const info = lstatSync(ruta);
    if (info.isSymbolicLink()) throw new Error(`No se permiten enlaces simbólicos: ${archivo}`);
  }
  if (!lstatSync(ruta).isFile()) throw new Error(`No es un archivo regular: ${archivo}`);
  return readFileSync(ruta);
}

function verificarReferencias(contenidos) {
  let comprobadas = 0;
  const externas = new Set();
  const ids = new Map();
  for (const [archivo, bytes] of contenidos) {
    if (!/\.(html|svg)$/.test(archivo)) continue;
    ids.set(archivo, new Set([...bytes.toString('utf8').matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1])));
  }
  function verificar(valor, desde) {
    if (!valor || /^(data:|mailto:|tel:)/i.test(valor)) return;
    const url = new URL(valor.replaceAll('&amp;', '&'), `${ORIGEN_VALIDACION}/${desde}`);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Protocolo no permitido en ${desde}`);
    if (url.origin !== ORIGEN_VALIDACION) {
      externas.add(url.origin); // No consultar recursos remotos durante el build.
      return;
    }
    let archivo = decodeURIComponent(url.pathname.slice(1));
    if (!archivo || archivo.endsWith('/')) archivo += 'index.html';
    if (!PERMITIDOS.has(archivo)) throw new Error(`Referencia fuera de la lista permitida: ${desde} -> ${archivo}`);
    if (url.hash && ids.has(archivo) && !ids.get(archivo).has(decodeURIComponent(url.hash.slice(1)))) {
      throw new Error(`Ancla inexistente: ${desde} -> ${archivo}${url.hash}`);
    }
    comprobadas++;
  }
  function urlsCss(texto, archivo) {
    for (const m of texto.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
      verificar(m[1] ?? m[2] ?? m[3], archivo);
    }
    for (const m of texto.matchAll(/@import\s+["']([^"']+)["']/gi)) verificar(m[1], archivo);
  }
  for (const [archivo, bytes] of contenidos) {
    const texto = bytes.toString('utf8');
    if (/\.(html|svg)$/.test(archivo)) {
      const sinComentarios = texto.replace(/<!--[\s\S]*?-->/g, '');
      for (const m of sinComentarios.matchAll(/\b(?:src|href|xlink:href|poster|action)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
        verificar(m[1] ?? m[2], archivo);
      }
      for (const m of sinComentarios.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
        for (const candidato of m[1].split(',')) verificar(candidato.trim().split(/\s+/)[0], archivo);
      }
      urlsCss(sinComentarios, archivo);
    } else if (archivo.endsWith('.css')) {
      urlsCss(texto.replace(/\/\*[\s\S]*?\*\//g, ''), archivo);
    } else if (archivo.endsWith('.js')) {
      // Importaciones literales de los módulos actuales, sin ejecutarlos.
      for (const m of texto.matchAll(/^\s*(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/gm)) verificar(m[1], archivo);
      for (const m of texto.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) verificar(m[1], archivo);
      // Destinos literales de navegación/imágenes; los 14 documentos están en raíz.
      for (const m of texto.matchAll(/["'`]((?:[\w.-]+\/)*[\w.-]+\.(?:html|svg|png|jpe?g|webp|woff2?))(?=["'`?#])/g)) verificar(m[1], 'index.html');
    }
  }
  return { comprobadas, externas: [...externas].sort() };
}

function listarArchivos(carpeta, prefijo = '') {
  const archivos = [];
  for (const nombre of readdirSync(carpeta).sort()) {
    const ruta = join(carpeta, nombre);
    const info = lstatSync(ruta);
    if (info.isSymbolicLink()) throw new Error('dist/ contiene un enlace simbólico; no se modificó su destino.');
    const archivo = `${prefijo}${nombre}`;
    if (info.isDirectory()) archivos.push(...listarArchivos(ruta, `${archivo}/`));
    else if (info.isFile()) archivos.push(archivo);
    else throw new Error('dist/ contiene un tipo de archivo no permitido.');
  }
  return archivos.sort();
}

function prepararDestino() {
  // dist/ es generado y reemplazable. Verificar el destino absoluto antes de borrar.
  if (dirname(DESTINO) !== RAIZ || basename(DESTINO) !== 'dist' || relative(RAIZ, DESTINO) !== 'dist') {
    throw new Error('Destino fuera de la carpeta de publicación autorizada.');
  }
  const existente = lstatSync(DESTINO, { throwIfNoEntry: false });
  if (existente) {
    if (existente.isSymbolicLink() || !existente.isDirectory() || realpathSync(DESTINO) !== DESTINO) {
      throw new Error('dist/ no es un directorio local seguro; no se modificó.');
    }
    listarArchivos(DESTINO); // Rechazar también enlaces dentro de dist/ antes de borrar.
    rmSync(DESTINO, { recursive: true });
  }
  mkdirSync(DESTINO);
}

function prepararPublicacion() {
  if (PERMITIDOS.size !== ARCHIVOS.length || PAGINAS.length !== 14) throw new Error('Lista de publicación inconsistente.');
  // Validar todas las fuentes y referencias antes de reemplazar un artefacto anterior.
  const contenidos = new Map(ARCHIVOS.map(archivo => [archivo, comprobarFuente(archivo)]));
  const referencias = verificarReferencias(contenidos);
  prepararDestino();
  for (const [archivo, bytes] of contenidos) {
    const ruta = join(DESTINO, archivo);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, bytes);
  }
  const publicados = listarArchivos(DESTINO);
  if (JSON.stringify(publicados) !== JSON.stringify(ARCHIVOS)) throw new Error('Inventario de dist/ inesperado.');
  for (const [archivo, bytes] of contenidos) {
    if (!readFileSync(join(DESTINO, archivo)).equals(bytes)) throw new Error(`Copia distinta del original: ${archivo}`);
  }
  // El inventario es salida de consola, no otro archivo público ni un timestamp variable.
  console.log(publicados.join('\n'));
  console.log(`dist/: ${publicados.length} archivos, ${PAGINAS.length} HTML; ${referencias.comprobadas} referencias locales correctas.`);
  console.log(`Orígenes externos referenciados (no consultados): ${referencias.externas.join(', ') || 'ninguno'}.`);
}

/* Ejecución local/build: sin SDK, dependencias, variables de proveedor ni red. */
try {
  prepararPublicacion();
} catch (error) {
  console.error(`No se generó un artefacto válido: ${error.message}`);
  process.exitCode = 1;
}
