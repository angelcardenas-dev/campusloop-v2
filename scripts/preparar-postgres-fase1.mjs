import { readFileSync, writeFileSync } from 'node:fs';

const destino = process.argv[2];
if (!destino || process.argv.length !== 3) {
  throw new Error('Uso: node scripts/preparar-postgres-fase1.mjs <archivo-sql-nuevo>');
}

const raiz = new URL('../supabase/', import.meta.url);
const migraciones = [
  '20261113000100_tablas_tb4.sql',
  '20261113000200_indices_tb4.sql',
  '20261114000100_trigger_perfil_minimo.sql',
  '20261124000100_rls_grants_tb4.sql',
];
const leer = ruta => readFileSync(new URL(ruta, raiz), 'utf8').replace(/\r\n/g, '\n').trimEnd();
const secciones = migraciones.map(nombre => {
  const lineas = leer(`migrations/${nombre}`).split('\n');
  const inicio = lineas.findIndex(linea => linea.trim() === 'BEGIN;');
  const marcadores = lineas.filter(linea => /^\s*(BEGIN|COMMIT|ROLLBACK|END|ABORT)(?:\s+TRANSACTION)?;\s*$/i.test(linea)
    && linea === linea.trim() && !/^END;$/i.test(linea));
  if (inicio === -1 || lineas.at(-1).trim() !== 'COMMIT;'
    || marcadores.length !== 2 || lineas.slice(0, inicio).some(linea => linea.trim() && !linea.startsWith('--'))) {
    throw new Error(`Revisar los límites de transacción de ${nombre}`);
  }
  return `-- ${nombre}\n${lineas.slice(inicio + 1, -1).join('\n').trim()}`;
});

const verificarUsuarios = `DO $usuarios$
BEGIN
    IF EXISTS (SELECT FROM auth.users) THEN
        RAISE EXCEPTION 'Auth recibió usuarios durante la instalación; conciliar antes de aplicar';
    END IF;
END;
$usuarios$;`;

const sql = [
  '-- Instalación inicial TB4. Ejecutar íntegra en una sola sesión.',
  'BEGIN;\nSET LOCAL lock_timeout = \'5s\';\nSET LOCAL statement_timeout = \'120s\';',
  leer('validacion/precondiciones_fase1_tb4.sql'),
  ...secciones,
  verificarUsuarios,
  leer('validacion/verificar_fase1_tb4.sql'),
  'COMMIT;',
].join('\n\n');

writeFileSync(destino, sql + '\n', { encoding: 'utf8', flag: 'wx' });
