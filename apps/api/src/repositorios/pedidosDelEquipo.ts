/**
 * Repositorio de los pedidos del equipo (Seguimiento) contra Prisma.
 *
 * No tiene método de borrado, y no es un olvido (REGLA 0): un pedido se resuelve
 * o se cancela con motivo, y un mensaje se corrige con otro mensaje. La base
 * además rechaza DELETE y cualquier UPDATE de un mensaje salvo marcar
 * `corregido_por_id`.
 *
 * El alcance se aplica ACÁ y no en la ruta: con `soloDe`, el filtro por
 * solicitante y la exclusión de notas internas no dependen de que cada ruta
 * se acuerde de hacerlos.
 */

import { Prisma } from '@prisma/client';

import type {
  AltaDePedido,
  AlcanceDePedidos,
  CambioDePedido,
  DatosDeMensaje,
  MensajeAlmacenado,
  PedidoAlmacenado,
  RepositorioDePedidosDelEquipo,
} from '../puertos-dominio.js';
import { ErrorDeAplicacion } from '../servidor.js';
import type { PrismaClient } from './prisma.js';

const CAMPOS_DE_MENSAJE = {
  id: true,
  pedidoId: true,
  autorUsuarioId: true,
  canal: true,
  ocurridoEn: true,
  texto: true,
  notaInterna: true,
  registradoPorUsuarioId: true,
  corregidoPorId: true,
  creadoEn: true,
} as const;

type FilaDePedido = Prisma.PedidoDelEquipoGetPayload<Record<string, never>>;

/** `@db.Date` llega como un `Date` a medianoche UTC: el texto del día es esa fecha, sin husos. */
function diaATexto(fecha: Date | null): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

function textoADia(texto: string | null): Date | null {
  return texto ? new Date(`${texto}T00:00:00.000Z`) : null;
}

function aPedido(fila: FilaDePedido): PedidoAlmacenado {
  return {
    id: fila.id,
    solicitanteUsuarioId: fila.solicitanteUsuarioId,
    destinatarioUsuarioIds: fila.destinatarioUsuarioIds,
    clienteId: fila.clienteId,
    asunto: fila.asunto,
    prioridad: fila.prioridad,
    estado: fila.estado,
    recordarEl: diaATexto(fila.recordarEl),
    motivoDeCancelacion: fila.motivoDeCancelacion,
    derivadoASoporte: fila.derivadoASoporte,
    derivadoASoporteEn: fila.derivadoASoporteEn,
    creadoEn: fila.creadoEn,
    actualizadoEn: fila.actualizadoEn,
  };
}

function datosDeMensaje(pedidoId: string, datos: DatosDeMensaje) {
  return {
    pedidoId,
    autorUsuarioId: datos.autorUsuarioId,
    canal: datos.canal as never,
    ocurridoEn: datos.ocurridoEn,
    texto: datos.texto,
    notaInterna: datos.notaInterna,
    registradoPorUsuarioId: datos.registradoPorUsuarioId,
  };
}

export class PedidosDelEquipoPrisma implements RepositorioDePedidosDelEquipo {
  constructor(private readonly prisma: PrismaClient) {}

  async crear(alta: AltaDePedido): Promise<PedidoAlmacenado> {
    const fila = await this.prisma.$transaction(async (tx) =>
      tx.pedidoDelEquipo.create({
        data: {
          solicitanteUsuarioId: alta.solicitanteUsuarioId,
          destinatarioUsuarioIds: [...alta.destinatarioUsuarioIds],
          clienteId: alta.clienteId,
          asunto: alta.asunto,
          prioridad: alta.prioridad,
          recordarEl: textoADia(alta.recordarEl),
          creadoPorUsuarioId: alta.registradoPorUsuarioId,
          mensajes: {
            create: {
              autorUsuarioId: alta.solicitanteUsuarioId,
              canal: alta.primerMensaje.canal as never,
              ocurridoEn: alta.primerMensaje.ocurridoEn,
              texto: alta.primerMensaje.texto,
              registradoPorUsuarioId: alta.registradoPorUsuarioId,
            },
          },
        },
      }),
    );
    return aPedido(fila);
  }

  async listar(
    alcance: AlcanceDePedidos,
    filtro: { estados?: readonly string[] },
  ): Promise<PedidoAlmacenado[]> {
    const filas = await this.prisma.pedidoDelEquipo.findMany({
      where: {
        ...('soloDe' in alcance ? { solicitanteUsuarioId: alcance.soloDe } : {}),
        ...(filtro.estados && filtro.estados.length > 0
          ? { estado: { in: [...filtro.estados] as never[] } }
          : {}),
      },
      orderBy: { creadoEn: 'desc' },
    });
    return filas.map(aPedido);
  }

  async buscar(
    id: string,
    alcance: AlcanceDePedidos,
  ): Promise<{ pedido: PedidoAlmacenado; mensajes: MensajeAlmacenado[] } | null> {
    const soloDe = 'soloDe' in alcance;
    const fila = await this.prisma.pedidoDelEquipo.findFirst({
      where: { id, ...(soloDe ? { solicitanteUsuarioId: alcance.soloDe } : {}) },
      include: {
        mensajes: {
          where: soloDe ? { notaInterna: false } : {},
          select: CAMPOS_DE_MENSAJE,
          orderBy: [{ ocurridoEn: 'asc' }, { creadoEn: 'asc' }],
        },
      },
    });
    if (!fila) return null;
    const { mensajes, ...pedido } = fila;
    return { pedido: aPedido(pedido), mensajes };
  }

  async agregarMensaje(pedidoId: string, datos: DatosDeMensaje): Promise<MensajeAlmacenado> {
    return this.prisma.mensajeDePedido.create({
      data: datosDeMensaje(pedidoId, datos),
      select: CAMPOS_DE_MENSAJE,
    });
  }

  async corregirMensaje(mensajeId: string, datos: DatosDeMensaje): Promise<MensajeAlmacenado> {
    return this.prisma.$transaction(async (tx) => {
      // Se bloquea la fila del mensaje antes de leerla: dos correcciones
      // simultáneas se turnan, y la segunda ve `corregido_por_id` ya marcado y
      // responde 409. Sin el bloqueo, las dos pasarían la lectura y la segunda
      // recién chocaría con el disparador de la base (que rechaza el segundo
      // UPDATE con un error genérico de permisos, no con un 409).
      await tx.$queryRaw`SELECT id FROM mensaje_de_pedido WHERE id = ${mensajeId}::uuid FOR UPDATE`;
      const viejo = await tx.mensajeDePedido.findUnique({
        where: { id: mensajeId },
        select: { id: true, pedidoId: true, corregidoPorId: true },
      });
      if (!viejo) throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
      if (viejo.corregidoPorId) throw yaCorregido();

      const nuevo = await tx.mensajeDePedido.create({
        data: datosDeMensaje(viejo.pedidoId, datos),
        select: CAMPOS_DE_MENSAJE,
      });
      // La única columna que la base deja tocar, y solo de NULL a un valor.
      await tx.mensajeDePedido.update({
        where: { id: viejo.id },
        data: { corregidoPorId: nuevo.id },
        select: { id: true },
      });
      return nuevo;
    });
  }

  async cambiar(id: string, cambio: CambioDePedido, usuarioId: string): Promise<PedidoAlmacenado> {
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.pedidoDelEquipo.findUnique({
        where: { id },
        select: { derivadoASoporte: true },
      });
      if (!actual) throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');

      const data: Prisma.PedidoDelEquipoUncheckedUpdateInput = { actualizadoPorUsuarioId: usuarioId };
      if (cambio.prioridad !== undefined) data.prioridad = cambio.prioridad;
      if (cambio.estado !== undefined) data.estado = cambio.estado;
      if (cambio.recordarEl !== undefined) data.recordarEl = textoADia(cambio.recordarEl);
      if (cambio.motivoDeCancelacion !== undefined) {
        data.motivoDeCancelacion = cambio.motivoDeCancelacion;
      }
      if (cambio.destinatarioUsuarioIds !== undefined) {
        data.destinatarioUsuarioIds = [...cambio.destinatarioUsuarioIds];
      }
      if (cambio.asunto !== undefined) data.asunto = cambio.asunto;
      if (cambio.clienteId !== undefined) data.clienteId = cambio.clienteId;
      if (cambio.derivadoASoporte !== undefined) {
        data.derivadoASoporte = cambio.derivadoASoporte;
        // La fecha es la de la derivación: si ya estaba derivado no se pisa.
        if (cambio.derivadoASoporte && !actual.derivadoASoporte) {
          data.derivadoASoporteEn = new Date();
        }
      }

      return aPedido(await tx.pedidoDelEquipo.update({ where: { id }, data }));
    });
  }

  async listarDerivadosASoporte(): Promise<PedidoAlmacenado[]> {
    const filas = await this.prisma.pedidoDelEquipo.findMany({
      where: { derivadoASoporte: true },
      orderBy: { derivadoASoporteEn: 'desc' },
    });
    return filas.map(aPedido);
  }
}

function yaCorregido(): ErrorDeAplicacion {
  return new ErrorDeAplicacion(409, 'Ese mensaje ya fue corregido.', 'ya_corregido');
}
