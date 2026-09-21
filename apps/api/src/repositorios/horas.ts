/**
 * Repositorio de la planilla de horas (tarea 144) contra Prisma.
 *
 * `groupBy` hace el agregado en la base, no en memoria: con 144 clientes
 * reales y un año de historial, traer cada fila a Node para sumarla en
 * JavaScript es exactamente el tipo de cosa que después hay que deshacer
 * bajo presión (ver `DISCREPANCIAS.md`, punto 18, sobre el costo de cada
 * viaje a la base).
 */

import type {
  AltaDeRegistroDeHoras,
  RegistroDeHorasAlmacenado,
  RepositorioDeHoras,
  TotalDeHoras,
} from '../puertos.js';
import type { PrismaClient } from './prisma.js';

const CAMPOS = {
  id: true,
  usuarioId: true,
  clienteId: true,
  fecha: true,
  minutos: true,
  tarea: true,
} as const;

export class HorasPrisma implements RepositorioDeHoras {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * No usa `upsert`: Prisma rechaza `null` dentro de la clave compuesta de un
   * `where` de upsert ("Argument clienteId must not be null"), aunque la
   * columna sea nullable en el `@@unique` — lo confirmó el test de
   * integración contra la base real antes de que esto llegara a producción.
   * `findFirst` sí acepta `null` en un `where` normal, así que el upsert se
   * arma a mano con dos pasos.
   *
   * Ventana de carrera aceptada: dos pedidos simultáneos de la MISMA persona
   * cargando el MISMO día podrían intentar crear los dos. El índice único de
   * la base sigue siendo quien decide — el segundo `create` fallaría con una
   * violación de restricción en vez de duplicar en silencio — y una persona
   * mandando su propia planilla dos veces en el mismo milisegundo no es un
   * caso real que valga la complejidad de una transacción para evitarlo.
   */
  async registrar(datos: AltaDeRegistroDeHoras): Promise<RegistroDeHorasAlmacenado> {
    const existente = await this.prisma.registroDeHoras.findFirst({
      where: { usuarioId: datos.usuarioId, clienteId: datos.clienteId, fecha: datos.fecha },
      select: { id: true },
    });

    if (existente) {
      return this.prisma.registroDeHoras.update({
        where: { id: existente.id },
        data: { minutos: datos.minutos, tarea: datos.tarea },
        select: CAMPOS,
      });
    }

    return this.prisma.registroDeHoras.create({
      data: {
        usuarioId: datos.usuarioId,
        clienteId: datos.clienteId,
        fecha: datos.fecha,
        minutos: datos.minutos,
        tarea: datos.tarea,
      },
      select: CAMPOS,
    });
  }

  async listarPropios(usuarioId: string, desde: Date, hasta: Date): Promise<RegistroDeHorasAlmacenado[]> {
    return this.prisma.registroDeHoras.findMany({
      where: { usuarioId, fecha: { gte: desde, lte: hasta } },
      select: CAMPOS,
      orderBy: { fecha: 'desc' },
    });
  }

  async resumen(
    desde: Date,
    hasta: Date,
    filtroClientes: readonly string[] | null,
  ): Promise<TotalDeHoras[]> {
    const agrupado = await this.prisma.registroDeHoras.groupBy({
      by: ['usuarioId', 'clienteId'],
      where: {
        fecha: { gte: desde, lte: hasta },
        // El tiempo interno (`clienteId: null`) queda SIEMPRE, sin importar la
        // cartera: no es un cliente sobre el que exista un permiso que
        // filtrar. Filtrarlo por cartera lo haría desaparecer del resumen sin
        // que nadie lo pidiera.
        ...(filtroClientes === null
          ? {}
          : { OR: [{ clienteId: null }, { clienteId: { in: [...filtroClientes] } }] }),
      },
      _sum: { minutos: true },
    });

    return agrupado.map((fila) => ({
      usuarioId: fila.usuarioId,
      clienteId: fila.clienteId,
      minutos: fila._sum.minutos ?? 0,
    }));
  }
}
