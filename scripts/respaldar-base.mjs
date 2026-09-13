/**
 * Respaldo completo de la base, a un archivo JSON.
 *
 * Existe porque el 2026-09-13 se borró la base de producción y **no había
 * ningún respaldo**: Supabase en plan Free no los incluye, y nunca los incluyó.
 * La exposición existía desde el primer día del proyecto; el accidente solo la
 * puso en evidencia.
 *
 * ---
 *
 * **Por qué JSON y no `pg_dump`.** No hay PostgreSQL instalado en la máquina de
 * trabajo, y un respaldo que depende de instalar algo es un respaldo que no se
 * hace. Esto corre con lo que el proyecto ya tiene.
 *
 * La contra es honesta: un JSON restaura **datos**, no el esquema ni los
 * índices ni las políticas de RLS. Para eso están las migraciones, que sí están
 * versionadas en git. Entre las dos cosas se reconstruye todo.
 *
 * **Por qué cabe.** La base guarda metadatos, no archivos: nombres, fechas,
 * importes y referencias a OneDrive. Con los 1574 documentos indexados pesaba
 * bastante menos de 100 MB, y las tablas de datos reales sumaban menos de 1 MB.
 * Los "muchos gigas" de EFFORT son los archivos de OneDrive, que no viven acá.
 *
 * **Solo lee.** No escribe una sola fila. Es deliberado: la herramienta que
 * existe para proteger los datos no puede ser capaz de dañarlos.
 *
 * Uso:
 *   node scripts/respaldar-base.mjs                  → ./respaldos/<fecha>.json
 *   node scripts/respaldar-base.mjs --salida <ruta>
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carga `.env` sin depender de dotenv, que no es dependencia de la raíz. */
function cargarEntorno(ruta) {
  try {
    for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
      const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // Sin .env se usa lo que ya esté en el entorno.
  }
}

// `fileURLToPath` y no `.pathname`: la ruta real tiene un espacio ("NexusFlow AI")
// y `.pathname` lo devuelve como %20, que `readFileSync` no encuentra.
cargarEntorno(fileURLToPath(new URL('../.env', import.meta.url)));

const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(
  () => import('@prisma/client'),
);

/**
 * Modelos a respaldar, en orden de dependencia.
 *
 * El orden importa para restaurar: un `documento` referencia un `cliente`, así
 * que el cliente tiene que entrar primero. Restaurar en el orden inverso al de
 * esta lista falla por claves foráneas.
 */
const MODELOS = [
  'usuario',
  'cliente',
  'contacto',
  'obligacionTributaria',
  'obligacionDeCliente',
  'reglaImpositiva',
  'reglaNotificacion',
  'evidencia',
  'documento',
  'procesoMensual',
  'vencimiento',
  'balance',
  'solicitud',
  'exportacionSiga',
  'comprobanteSiga',
  'liquidacion',
  'alerta',
  'registroContacto',
  'envioNotificacion',
  'eventLog',
];

/** `BigInt` no es serializable a JSON: se guarda como texto y se relee igual. */
function serializar(clave, valor) {
  if (typeof valor === 'bigint') return { __bigint: valor.toString() };
  return valor;
}

const argumentos = process.argv.slice(2);
const indiceSalida = argumentos.indexOf('--salida');
const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const salida =
  indiceSalida >= 0 && argumentos[indiceSalida + 1]
    ? argumentos[indiceSalida + 1]
    : join(process.cwd(), 'respaldos', `respaldo-${marca}.json`);

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

const respaldo = { generadoEn: new Date().toISOString(), modelos: {} };
let totalFilas = 0;

for (const modelo of MODELOS) {
  if (typeof prisma[modelo]?.findMany !== 'function') {
    console.warn(`  (se saltea ${modelo}: no existe en este esquema)`);
    continue;
  }
  const filas = await prisma[modelo].findMany();
  respaldo.modelos[modelo] = filas;
  totalFilas += filas.length;
  console.log(`  ${modelo.padEnd(24)} ${String(filas.length).padStart(6)} filas`);
}

await prisma.$disconnect();

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(respaldo, serializar, 0), 'utf8');

const pesoMb = (Buffer.byteLength(JSON.stringify(respaldo, serializar, 0)) / 1024 / 1024).toFixed(2);
console.log(`\nRespaldo de ${totalFilas} filas escrito en ${salida} (${pesoMb} MB).`);
