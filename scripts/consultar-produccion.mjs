#!/usr/bin/env node
/**
 * Consulta de SOLO LECTURA contra la base, en una transacción READ ONLY.
 *
 * Existe para las "fotos" de antes y después de un push (plan maestro, N9):
 * cuántas alertas hay, cuántos hallazgos, cuántas liquidaciones — sin arriesgar
 * una escritura por accidente. La garantía no es una convención de este
 * script: `SET TRANSACTION READ ONLY` la hace cumplir PostgreSQL mismo. Un
 * INSERT, UPDATE o DELETE dentro de esta transacción falla con
 * "cannot execute ... in a read-only transaction", los reciba quien los
 * mande.
 *
 * La consulta misma vive en `apps/api/src/servicios/consultaSoloLectura.ts`
 * (compilada a `dist`) y no acá: un archivo con un `await` a nivel de módulo
 * (el de más abajo, para el modo CLI) resultó frágil de importar desde un
 * test — Vite tropieza al transformarlo. Requiere `npm run build --workspace
 * @effort/api` si se editó esa lógica. Probado en
 * `apps/api/test/integracion/consultar-produccion.test.ts`.
 *
 * **Nunca imprime la cadena de conexión.** Si algo falla, el mensaje de Postgres
 * puede mencionar la base o el usuario, nunca la URL completa con la
 * contraseña.
 *
 * Uso:
 *   node scripts/consultar-produccion.mjs "SELECT count(*) FROM alerta WHERE estado = 'ABIERTA'"
 *   node scripts/consultar-produccion.mjs --archivo consulta.sql
 */

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { consultaDeSoloLectura } from '@effort/api/dist/servicios/consultaSoloLectura.js';

/** Carga `.env` sin depender de dotenv, igual que el resto de los scripts. */
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

/** `BigInt` no es serializable a JSON: se muestra como texto, marcado. */
function serializar(_clave, valor) {
  if (typeof valor === 'bigint') return `${valor}n`;
  return valor;
}

async function principal() {
  // Vigilante del lado del script: si la red se cuelga del todo, el tope de
  // PostgreSQL nunca llega a disparar. `unref` para no demorar una salida
  // normal. El 2026-09-22 una consulta tardó 14 horas en volver.
  const vigilante = setTimeout(() => {
    console.error('La consulta no terminó en 2 minutos: se corta. Reintentá; si se repite, revisá la conexión con Supabase.');
    process.exit(3);
  }, 120_000);
  vigilante.unref();

  cargarEntorno(fileURLToPath(new URL('../.env', import.meta.url)));

  const argumentos = process.argv.slice(2);
  const indiceArchivo = argumentos.indexOf('--archivo');
  const sql =
    indiceArchivo >= 0
      ? readFileSync(argumentos[indiceArchivo + 1], 'utf8')
      : argumentos.find((a) => !a.startsWith('--'));

  if (!sql?.trim()) {
    console.error('Falta la consulta. Uso: node scripts/consultar-produccion.mjs "SELECT …"');
    process.exit(2);
  }

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
    process.exit(1);
  }

  const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(
    () => import('@prisma/client'),
  );
  const prisma = new PrismaClient({ datasourceUrl: url });

  try {
    const filas = await consultaDeSoloLectura(prisma, sql);
    console.log(JSON.stringify(filas, serializar, 2));
  } catch (error) {
    // El mensaje de Postgres puede traer texto de la consulta, nunca la URL.
    console.error(`La consulta falló: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Permite importar `consultaDeSoloLectura` desde un test sin ejecutar la CLI.
 *
 * Compara rutas resueltas (no cadenas `file://` armadas a mano) para que
 * funcione igual en Windows, con espacios en la ruta ("NexusFlow AI") y con
 * symlinks.
 */
function esElArchivoEjecutado() {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (esElArchivoEjecutado()) {
  await principal();
}
