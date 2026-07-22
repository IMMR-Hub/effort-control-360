/**
 * Entorno para los tests de integración contra PostgreSQL real.
 *
 * Cada corrida crea un esquema propio, aplica las migraciones ahí y lo destruye
 * al terminar. No se usa `public`, y el motivo es concreto: `event_log` y
 * `registro_contacto` tienen disparadores que impiden borrar filas, así que
 * cualquier test que escriba en ellas dejaría basura permanente en la base del
 * piloto. Con un esquema descartable, el `DROP SCHEMA CASCADE` final se lleva
 * todo, disparadores incluidos.
 *
 * Si no hay base configurada, los tests se saltean en vez de fallar: quien
 * clone el repo sin `.env` tiene que poder correr el resto de la suite.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const raizApi = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Carga el `.env` de la raíz del monorepo.
 *
 * Se hace a mano y no con una dependencia: es una línea `CLAVE=valor` por fila
 * y agregar un paquete para eso sería superficie de ataque de más en un
 * proyecto que maneja datos contables de terceros.
 */
function cargarEnv(): void {
  try {
    const contenido = readFileSync(join(raizApi, '..', '..', '.env'), 'utf8');
    for (const linea of contenido.split('\n')) {
      const coincidencia = /^([A-Z_]+)=(.*)$/.exec(linea.trim());
      if (coincidencia?.[1] && !process.env[coincidencia[1]]) {
        process.env[coincidencia[1]] = coincidencia[2];
      }
    }
  } catch {
    // Sin .env: los tests se saltean solos más abajo.
  }
}

cargarEnv();

/**
 * URL base para los tests.
 *
 * Se usa `DIRECT_URL` (Session pooler) y no `DATABASE_URL` (Transaction
 * pooler): crear esquemas y tipos necesita sentencias preparadas, que el modo
 * transacción de PgBouncer no admite.
 */
const URL_BASE = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];

export const HAY_BASE_DE_DATOS = Boolean(URL_BASE);

function urlConEsquema(esquema: string): string {
  const url = new URL(URL_BASE!);
  url.searchParams.set('schema', esquema);
  // El pooler de transacción no soporta lo que hace falta acá; si la URL viene
  // con ese parámetro, se quita.
  url.searchParams.delete('pgbouncer');
  return url.toString();
}

/** Divide un archivo SQL en sentencias, respetando los bloques `$$ ... $$`. */
function separarSentencias(sql: string): string[] {
  const sentencias: string[] = [];
  let actual = '';
  let dentroDeBloque = false;

  for (const linea of sql.split('\n')) {
    const sinComentario = linea.trimStart().startsWith('--') ? '' : linea;

    // Los cuerpos de función van entre $$ y adentro hay puntos y coma que no
    // separan sentencias. Sin esta cuenta, el disparador se partiría al medio.
    const marcadores = (sinComentario.match(/\$\$/g) ?? []).length;
    if (marcadores % 2 === 1) dentroDeBloque = !dentroDeBloque;

    actual += `${sinComentario}\n`;

    if (!dentroDeBloque && sinComentario.trimEnd().endsWith(';')) {
      const limpia = actual.trim();
      if (limpia) sentencias.push(limpia);
      actual = '';
    }
  }

  const resto = actual.trim();
  if (resto) sentencias.push(resto);

  return sentencias;
}

export interface EntornoDePrueba {
  readonly prisma: PrismaClient;
  readonly esquema: string;
  destruir: () => Promise<void>;
}

/**
 * Crea un esquema aislado con todas las migraciones aplicadas.
 *
 * Aplica los mismos archivos de `prisma/migrations` que se aplican en
 * producción, en el mismo orden. Si un test pasa contra un esquema construido
 * de otra forma, no prueba nada sobre lo que realmente se despliega.
 */
export async function crearEntorno(): Promise<EntornoDePrueba> {
  if (!URL_BASE) {
    throw new Error('No hay base de datos configurada.');
  }

  const esquema = `pruebas_${randomBytes(6).toString('hex')}`;

  // Cliente sobre `public` solo para crear y destruir el esquema de prueba.
  const administrador = new PrismaClient({ datasourceUrl: URL_BASE });
  await administrador.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${esquema}"`);
  await administrador.$disconnect();

  const prisma = new PrismaClient({ datasourceUrl: urlConEsquema(esquema) });

  const carpetaMigraciones = join(raizApi, 'prisma', 'migrations');
  const migraciones = readdirSync(carpetaMigraciones, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();

  for (const migracion of migraciones) {
    const sql = readFileSync(join(carpetaMigraciones, migracion, 'migration.sql'), 'utf8');

    for (const sentencia of separarSentencias(sql)) {
      try {
        await prisma.$executeRawUnsafe(sentencia);
      } catch (error) {
        throw new Error(
          `Falló la migración ${migracion} en el esquema de prueba.\n` +
            `Sentencia: ${sentencia.slice(0, 200)}\n` +
            `Causa: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return {
    prisma,
    esquema,
    destruir: async () => {
      await prisma.$disconnect();
      const limpiador = new PrismaClient({ datasourceUrl: URL_BASE });
      await limpiador.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${esquema}" CASCADE`);
      await limpiador.$disconnect();
    },
  };
}
