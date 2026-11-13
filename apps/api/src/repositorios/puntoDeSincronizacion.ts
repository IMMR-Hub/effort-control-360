/**
 * El punto de sincronización con OneDrive, guardado en la base (2026-11-12).
 *
 * Una sola fila de `estado_del_sistema`, con la clave `onedrive`. Qué se guarda
 * y por qué alcanza para retomar sin perder cambios está explicado en
 * `servicios/sincronizacionIncremental.ts`.
 *
 * Lo que se lee se valida antes de usarlo: un punto con otra forma (una versión
 * vieja, una fila tocada a mano) lanza, y la sincronización lo trata como «no
 * se pudo leer» — recorre todo y lo dice. Nunca se adivina un punto.
 */

import { z } from 'zod';

import type {
  AlmacenDelPuntoDeSincronizacion,
  PuntoDeSincronizacion,
} from '../servicios/sincronizacionIncremental.js';
import type { PrismaClient } from './prisma.js';

const CLAVE = 'onedrive';

const formaGuardada = z
  .object({
    token: z.string().min(1).nullable(),
    rutasDeClientes: z.record(z.string(), z.string()),
    ultimaPasadaCompletaEn: z.string().datetime().nullable(),
  })
  .strict();

export class PuntoDeSincronizacionPrisma implements AlmacenDelPuntoDeSincronizacion {
  constructor(private readonly prisma: PrismaClient) {}

  async leer(): Promise<PuntoDeSincronizacion | null> {
    const fila = await this.prisma.estadoDelSistema.findUnique({
      where: { clave: CLAVE },
      select: { valor: true },
    });
    if (!fila) return null;

    const guardado = formaGuardada.parse(fila.valor);
    return {
      token: guardado.token,
      rutasDeClientes: guardado.rutasDeClientes,
      ultimaPasadaCompletaEn:
        guardado.ultimaPasadaCompletaEn === null ? null : new Date(guardado.ultimaPasadaCompletaEn),
    };
  }

  async guardar(punto: PuntoDeSincronizacion): Promise<void> {
    const valor = {
      token: punto.token,
      rutasDeClientes: { ...punto.rutasDeClientes },
      ultimaPasadaCompletaEn: punto.ultimaPasadaCompletaEn?.toISOString() ?? null,
    };
    await this.prisma.estadoDelSistema.upsert({
      where: { clave: CLAVE },
      create: { clave: CLAVE, valor },
      update: { valor },
    });
  }
}
