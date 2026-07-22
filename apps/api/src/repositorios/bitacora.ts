/**
 * Escritura del registro de eventos contra Prisma.
 *
 * Solo inserta. La tabla tiene disparadores que rechazan UPDATE, DELETE y
 * TRUNCATE, así que cualquier otro método de este repositorio fallaría en la
 * base de todos modos; no existir es más honesto que existir y explotar.
 *
 * Las filas llegan acá ya saneadas por `prepararEntrada()`. Este archivo no
 * vuelve a sanear a propósito: si saneara de nuevo, habría dos lugares donde
 * mantener la lista de campos sensibles y terminarían divergiendo.
 */

import type { FilaDeBitacora, RepositorioDeBitacora } from '../bitacora.js';
import type { PrismaClient } from './prisma.js';

export class BitacoraPrisma implements RepositorioDeBitacora {
  constructor(private readonly prisma: PrismaClient) {}

  async registrar(fila: FilaDeBitacora): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        usuarioId: fila.usuarioId,
        accion: fila.accion,
        entidad: fila.entidad,
        entidadId: fila.entidadId,
        clienteId: fila.clienteId,
        // `undefined` haría que Prisma omita la columna; `null` la escribe como
        // nula, que es lo que corresponde cuando no hubo datos previos.
        datosAntes: (fila.datosAntes ?? null) as never,
        datosDespues: (fila.datosDespues ?? null) as never,
        ipTruncada: fila.ipTruncada,
        agenteUsuario: fila.agenteUsuario,
        peticionId: fila.peticionId,
      },
    });
  }
}
