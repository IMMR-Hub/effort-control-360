/**
 * Consulta de SOLO LECTURA, en una transacción READ ONLY.
 *
 * La usa `scripts/consultar-produccion.mjs` (la CLI para las "fotos" de antes
 * y después de un push) y su test de integración
 * (`apps/api/test/integracion/consultar-produccion.test.ts`). Vive en
 * `apps/api/src` y no en el script mismo porque el script tiene un `await` a
 * nivel de módulo para su modo CLI, y un archivo con eso resultó frágil de
 * importar desde un test: Vite lo transforma al analizarlo y tropieza con esa
 * construcción. Separar la lógica de la CLI en un módulo sin efectos de
 * arranque es el mismo patrón que ya usa el resto del repositorio.
 *
 * La garantía no es una convención de este archivo: `SET TRANSACTION READ
 * ONLY` la hace cumplir PostgreSQL mismo. Un INSERT, UPDATE o DELETE dentro de
 * esta transacción falla con "cannot execute ... in a read-only transaction",
 * los reciba quien los mande.
 */

/** Lo mínimo que hace falta de un cliente de Prisma para esto. */
export interface ClientePrisma {
  $transaction<T>(
    fn: (tx: ClientePrisma) => Promise<T>,
    opciones?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
}

/**
 * Tope por defecto de una consulta: 60 segundos.
 *
 * El 2026-09-22 una consulta de esta CLI (un simple `count`) tardó 14 horas en
 * volver (16:55 → 07:09, hora de Paraguay), y con ella quedó parada la sesión
 * de trabajo. Lo más probable es que la computadora se haya suspendido en el
 * medio —el hueco coincide con el fin del día—, pero no quedó registro que lo
 * pruebe. Sea cual fuere la causa, ninguna de las "fotos" que se sacan con
 * esto tarda más de unos segundos: si pasa del minuto, conviene enterarse.
 */
export const TOPE_POR_DEFECTO_MS = 60_000;

/**
 * Corre `sql` dentro de una transacción READ ONLY, con tope de tiempo.
 *
 * `SET TRANSACTION READ ONLY` tiene que ser la PRIMERA sentencia de la
 * transacción: PostgreSQL la rechaza si ya se ejecutó algo antes. El tope va
 * después, con `SET LOCAL` para que muera con la transacción y no quede
 * pegado a la conexión del pool.
 */
export async function consultaDeSoloLectura<T = unknown>(
  prisma: ClientePrisma,
  sql: string,
  opciones: { readonly topeMs?: number } = {},
): Promise<T> {
  const tope = Math.max(1, Math.trunc(opciones.topeMs ?? TOPE_POR_DEFECTO_MS));
  // Prisma corta por su cuenta una transacción interactiva a los 5 segundos:
  // se le da un margen por encima del tope para que el que corte sea
  // PostgreSQL, con un mensaje que dice qué pasó ("statement timeout").
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${tope}`);
      return tx.$queryRawUnsafe<T>(sql);
    },
    { maxWait: 15_000, timeout: tope + 5_000 },
  );
}
