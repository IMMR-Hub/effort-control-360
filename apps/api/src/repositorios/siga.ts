/**
 * Repositorios de exportaciones SIGA y liquidaciones.
 */

import type {
  AltaDeExportacionSiga,
  AltaDeLiquidacion,
  ComprobanteSigaAlmacenado,
  DatosDeEnvio,
  ExportacionSigaAlmacenada,
  FiltroDeCartera,
  LiquidacionAlmacenada,
  RepositorioDeExportacionesSiga,
  RepositorioDeLiquidaciones,
} from '../puertos-dominio.js';
import type { PrismaClient } from './prisma.js';

function porCartera(filtro: FiltroDeCartera) {
  return filtro === null ? {} : { clienteId: { in: [...filtro] } };
}

/* ========================================================================== */
/* Exportaciones SIGA                                                         */
/* ========================================================================== */

const CAMPOS_EXPORTACION = {
  id: true,
  clienteId: true,
  periodo: true,
  tipoReporte: true,
  formato: true,
  evidenciaId: true,
  importadaEn: true,
  filasLeidas: true,
  estadoRevision: true,
  proximaAccion: true,
  observaciones: true,
} as const;

const CAMPOS_COMPROBANTE_SIGA = {
  id: true,
  exportacionId: true,
  clienteId: true,
  periodo: true,
  rucEmisor: true,
  timbrado: true,
  numeroComprobante: true,
  total: true,
  tasa: true,
  anulado: true,
  fecha: true,
} as const;

export class ExportacionesSigaPrisma implements RepositorioDeExportacionesSiga {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(
    clienteId: string,
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<ExportacionSigaAlmacenada[]> {
    const filas = await this.prisma.exportacionSiga.findMany({
      where: {
        AND: [
          { clienteId },
          ...(periodo ? [{ periodo }] : []),
          ...(filtro === null ? [] : [{ clienteId: { in: [...filtro] } }]),
        ],
      },
      select: CAMPOS_EXPORTACION,
      orderBy: { importadaEn: 'desc' },
    });

    return filas as ExportacionSigaAlmacenada[];
  }

  async buscarPorId(
    id: string,
    filtro: FiltroDeCartera,
  ): Promise<ExportacionSigaAlmacenada | null> {
    const fila = await this.prisma.exportacionSiga.findFirst({
      where: { AND: [{ id }, porCartera(filtro)] },
      select: CAMPOS_EXPORTACION,
    });

    return fila as ExportacionSigaAlmacenada | null;
  }

  /**
   * Registra la exportación y sus filas en una transacción.
   *
   * Si las filas se insertaran por fuera y algo fallara a mitad de camino,
   * quedaría una exportación que declara N comprobantes con solo algunos
   * cargados. La conciliación reportaría diferencias inexistentes y alguien
   * perdería la tarde buscando comprobantes que sí estaban en SIGA.
   */
  async registrar(datos: AltaDeExportacionSiga): Promise<ExportacionSigaAlmacenada> {
    return this.prisma.$transaction(async (tx) => {
      const exportacion = await tx.exportacionSiga.create({
        data: {
          clienteId: datos.clienteId,
          periodo: datos.periodo,
          tipoReporte: datos.tipoReporte as never,
          formato: datos.formato,
          evidenciaId: datos.evidenciaId,
          observaciones: datos.observaciones,
          filasLeidas: datos.comprobantes.length,
          creadoPorUsuarioId: datos.creadoPorUsuarioId,
          actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
        },
        select: CAMPOS_EXPORTACION,
      });

      if (datos.comprobantes.length > 0) {
        await tx.comprobanteSiga.createMany({
          data: datos.comprobantes.map((fila) => ({
            exportacionId: exportacion.id,
            clienteId: datos.clienteId,
            periodo: datos.periodo,
            rucEmisor: fila.rucEmisor,
            timbrado: fila.timbrado,
            numeroComprobante: fila.numeroComprobante,
            total: fila.total,
            tasa: fila.tasa as never,
            anulado: fila.anulado,
            fecha: fila.fecha,
          })),
          // Reimportar el mismo archivo no duplica: la clave natural del
          // comprobante ya tiene unicidad en la base.
          skipDuplicates: true,
        });
      }

      return exportacion as ExportacionSigaAlmacenada;
    });
  }

  async comprobantesDelPeriodo(
    clienteId: string,
    periodo: string,
  ): Promise<ComprobanteSigaAlmacenado[]> {
    const filas = await this.prisma.comprobanteSiga.findMany({
      where: { clienteId, periodo },
      select: CAMPOS_COMPROBANTE_SIGA,
      orderBy: { fecha: 'asc' },
    });

    return filas as ComprobanteSigaAlmacenado[];
  }

  async actualizarEstadoRevision(
    id: string,
    estado: string,
    proximaAccion: string | null,
    usuarioId: string,
  ): Promise<ExportacionSigaAlmacenada> {
    const fila = await this.prisma.exportacionSiga.update({
      where: { id },
      data: {
        estadoRevision: estado as never,
        proximaAccion,
        actualizadoPorUsuarioId: usuarioId,
      },
      select: CAMPOS_EXPORTACION,
    });

    return fila as ExportacionSigaAlmacenada;
  }
}

/* ========================================================================== */
/* Liquidaciones                                                              */
/* ========================================================================== */

const CAMPOS_LIQUIDACION = {
  id: true,
  clienteId: true,
  periodo: true,
  tipo: true,
  archivoEvidenciaId: true,
  destinatario: true,
  canal: true,
  fechaEnvio: true,
  evidenciaEnvioId: true,
  responsableId: true,
  estado: true,
  respuestaCliente: true,
  respondidaEn: true,
  proximaAccion: true,
  observaciones: true,
} as const;

export class LiquidacionesPrisma implements RepositorioDeLiquidaciones {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<LiquidacionAlmacenada[]> {
    const filas = await this.prisma.liquidacion.findMany({
      where: { ...(periodo ? { periodo } : {}), ...porCartera(filtro) },
      select: CAMPOS_LIQUIDACION,
      orderBy: [{ periodo: 'desc' }, { clienteId: 'asc' }],
    });

    return filas as LiquidacionAlmacenada[];
  }

  async listarPorCliente(
    clienteId: string,
    filtro: FiltroDeCartera,
  ): Promise<LiquidacionAlmacenada[]> {
    const filas = await this.prisma.liquidacion.findMany({
      where: {
        AND: [{ clienteId }, ...(filtro === null ? [] : [{ clienteId: { in: [...filtro] } }])],
      },
      select: CAMPOS_LIQUIDACION,
      orderBy: { periodo: 'desc' },
    });

    return filas as LiquidacionAlmacenada[];
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<LiquidacionAlmacenada | null> {
    const fila = await this.prisma.liquidacion.findFirst({
      where: { AND: [{ id }, porCartera(filtro)] },
      select: CAMPOS_LIQUIDACION,
    });

    return fila as LiquidacionAlmacenada | null;
  }

  async registrar(datos: AltaDeLiquidacion): Promise<LiquidacionAlmacenada> {
    const fila = await this.prisma.liquidacion.create({
      data: {
        clienteId: datos.clienteId,
        periodo: datos.periodo,
        tipo: datos.tipo,
        archivoEvidenciaId: datos.archivoEvidenciaId,
        responsableId: datos.responsableId,
        observaciones: datos.observaciones,
        estado: datos.archivoEvidenciaId ? 'GENERADA' : 'PENDIENTE',
        creadoPorUsuarioId: datos.creadoPorUsuarioId,
        actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
      },
      select: CAMPOS_LIQUIDACION,
    });

    return fila as LiquidacionAlmacenada;
  }

  /**
   * Marca la liquidación como enviada.
   *
   * Guarda destinatario, canal, fecha y evidencia del envío. "Se la mandamos"
   * sin esos datos no sirve ante un reclamo del cliente.
   */
  async marcarEnviada(
    id: string,
    envio: DatosDeEnvio,
    usuarioId: string,
  ): Promise<LiquidacionAlmacenada> {
    const fila = await this.prisma.liquidacion.update({
      where: { id },
      data: {
        estado: 'ENVIADA',
        destinatario: envio.destinatario,
        canal: envio.canal,
        fechaEnvio: envio.fechaEnvio,
        evidenciaEnvioId: envio.evidenciaEnvioId,
        actualizadoPorUsuarioId: usuarioId,
      },
      select: CAMPOS_LIQUIDACION,
    });

    return fila as LiquidacionAlmacenada;
  }

  async registrarRespuesta(
    id: string,
    respuesta: string,
    respondidaEn: Date,
    usuarioId: string,
  ): Promise<LiquidacionAlmacenada> {
    const fila = await this.prisma.liquidacion.update({
      where: { id },
      data: {
        estado: 'RESPONDIDA',
        respuestaCliente: respuesta,
        respondidaEn,
        actualizadoPorUsuarioId: usuarioId,
      },
      select: CAMPOS_LIQUIDACION,
    });

    return fila as LiquidacionAlmacenada;
  }
}
