/**
 * Cliente de Prisma.
 *
 * Se crea uno solo por proceso. Cada instancia abre su propio pool de
 * conexiones, y Supabase en plan Nano admite 15 conexiones por combinación
 * usuario+base: unas pocas instancias sueltas agotarían el pool y la aplicación
 * empezaría a rechazar peticiones sin motivo aparente.
 */

import { PrismaClient } from '@prisma/client';

export type { PrismaClient };

export interface OpcionesDeCliente {
  readonly urlDeConexion?: string;
  /** Registra cada consulta. Solo para depurar: las consultas traen datos de clientes. */
  readonly registrarConsultas?: boolean;
}

export function crearClientePrisma(opciones: OpcionesDeCliente = {}): PrismaClient {
  return new PrismaClient({
    ...(opciones.urlDeConexion ? { datasourceUrl: opciones.urlDeConexion } : {}),
    log: opciones.registrarConsultas ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

/**
 * Comprueba que la base responde.
 *
 * Se llama al arrancar: es preferible que el proceso muera de entrada con un
 * mensaje claro a que levante y falle en la primera petición de un usuario.
 */
export async function comprobarConexion(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
