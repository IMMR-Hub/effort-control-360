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
  $transaction<T>(fn: (tx: ClientePrisma) => Promise<T>): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
}

/**
 * Corre `sql` dentro de una transacción READ ONLY.
 *
 * `SET TRANSACTION READ ONLY` tiene que ser la PRIMERA sentencia de la
 * transacción: PostgreSQL la rechaza si ya se ejecutó algo antes.
 */
export async function consultaDeSoloLectura<T = unknown>(
  prisma: ClientePrisma,
  sql: string,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.$queryRawUnsafe<T>(sql);
  });
}
