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

import type {
  EventoAlmacenado,
  FilaDeBitacora,
  FiltroDeEventos,
  RepositorioDeBitacora,
} from '../bitacora.js';
import type { PrismaClient } from './prisma.js';

const CAMPOS_EVENTO = {
  id: true,
  ocurridoEn: true,
  usuarioId: true,
  accion: true,
  entidad: true,
  entidadId: true,
  clienteId: true,
  datosAntes: true,
  datosDespues: true,
  ipTruncada: true,
  agenteUsuario: true,
  peticionId: true,
} as const;

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

  /**
   * Cada filtro explícito y el alcance de cartera van en condiciones
   * separadas dentro de un `AND`, nunca combinadas con spread sobre la misma
   * columna: es la lección de `ClientesPrisma.buscarPorId`, y acá `clienteId`
   * puede venir filtrado dos veces (uno explícito, uno de cartera) a la vez.
   */
  async listar(
    filtro: FiltroDeEventos,
    cartera: readonly string[] | null,
    limite: number,
    desplazamiento: number,
  ): Promise<EventoAlmacenado[]> {
    const condiciones: Record<string, unknown>[] = [];

    if (filtro.usuarioId) condiciones.push({ usuarioId: filtro.usuarioId });
    if (filtro.entidad) condiciones.push({ entidad: filtro.entidad });
    if (filtro.entidadId) condiciones.push({ entidadId: filtro.entidadId });
    if (filtro.clienteId) condiciones.push({ clienteId: filtro.clienteId });
    if (filtro.desde || filtro.hasta) {
      condiciones.push({
        ocurridoEn: {
          ...(filtro.desde ? { gte: filtro.desde } : {}),
          ...(filtro.hasta ? { lte: filtro.hasta } : {}),
        },
      });
    }
    if (cartera !== null) condiciones.push({ clienteId: { in: [...cartera] } });

    const filas = await this.prisma.eventLog.findMany({
      where: condiciones.length > 0 ? { AND: condiciones } : {},
      select: CAMPOS_EVENTO,
      orderBy: { ocurridoEn: 'desc' },
      take: limite,
      skip: desplazamiento,
    });

    return filas as EventoAlmacenado[];
  }
}
