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
 * Hasta el 2026-09-16 esta lista vivía acá, copiada a mano y desalineada del
 * esquema real: le faltaban `asignacionCliente`, `solicitudDocumentacion` y
 * `lecturaDeDeclaracion`, y tenía dos nombres que ya no existen (`contacto`,
 * `solicitud`) que se salteaban en silencio. Ahora es una sola lista
 * compartida con el respaldo automático (`apps/api/src/servicios/respaldoAutomatico.ts`),
 * con un test que la compara contra `schema.prisma`
 * (`packages/core/test/modelosDelRespaldo.test.ts`).
 *
 * Requiere `npm run build --workspace @effort/core` si se editó la lista.
 */
const { MODELOS_DEL_RESPALDO: MODELOS } = await import('@effort/core');

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

/*
 * Se lee con SQL crudo, no con el cliente tipado (tarea 150). El 2026-09-21
 * este script falló dos veces con P2021/P2022 justo antes de una migración,
 * porque el cliente ya conocía columnas que producción todavía no tenía —
 * es decir, se caía en el único momento en que el respaldo hace falta.
 */
const { crearLectorCrudo } = await import('@effort/api/dist/servicios/lecturaCruda.js');
const { Prisma } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(
  () => import('@prisma/client'),
);
const lector = crearLectorCrudo(prisma, Prisma.dmmf.datamodel.models);

const respaldo = { generadoEn: new Date().toISOString(), modelos: {} };
let totalFilas = 0;

for (const modelo of MODELOS) {
  if (typeof lector[modelo]?.findMany !== 'function') {
    console.warn(`  (se saltea ${modelo}: no existe en este esquema)`);
    continue;
  }
  let filas;
  try {
    filas = await lector[modelo].findMany();
  } catch (motivo) {
    // Una tabla que todavía no existe no puede tumbar el respaldo entero: es
    // el caso de "el código va adelante del esquema", que es justo cuando se
    // respalda. Cualquier otro error sí corta, para no escribir un volcado
    // incompleto que se diga completo.
    const codigo = motivo?.code;
    const mensaje = motivo instanceof Error ? motivo.message : String(motivo);
    const noExiste =
      ['42P01', '42703', 'P2021', 'P2022'].includes(codigo) ||
      (/does not exist|no existe/i.test(mensaje) && /relation|column|table/i.test(mensaje));
    if (!noExiste) throw motivo;
    console.warn(`  (se saltea ${modelo}: la tabla no existe todavía en esta base)`);
    continue;
  }
  respaldo.modelos[modelo] = filas;
  totalFilas += filas.length;
  console.log(`  ${modelo.padEnd(24)} ${String(filas.length).padStart(6)} filas`);
}

await prisma.$disconnect();

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(respaldo, serializar, 0), 'utf8');

const pesoMb = (Buffer.byteLength(JSON.stringify(respaldo, serializar, 0)) / 1024 / 1024).toFixed(2);
console.log(`\nRespaldo de ${totalFilas} filas escrito en ${salida} (${pesoMb} MB).`);
