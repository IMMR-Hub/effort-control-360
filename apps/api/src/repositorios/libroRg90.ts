/**
 * Persistencia del libro RG 90: liquidación de IVA y hallazgos.
 *
 * Va en su propio archivo y no en `dominio.ts` porque es una pieza nueva y
 * completa —dos tablas que se escriben juntas y se leen juntas— y meterla en el
 * archivo que ya tiene once repositorios no ayudaría a nadie a encontrarla.
 */

import type { PrismaClient } from '@prisma/client';

import { gs } from '@effort/core';

import type {
  AltaDeHallazgo,
  AltaDeLiquidacion,
  ArchivoDeLibro,
} from '../servicios/liquidacionDeIva.js';

/** Formatos de Excel que puede traer una planilla RG 90. */
const EXCEL = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export class LibroRg90Prisma {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Planillas RG 90 del cliente, entre lo ya sincronizado.
   *
   * Se filtra por tipo de documento Y por formato: el mismo libro suele existir
   * como PDF y como Excel, los dos se clasifican igual, y solo el Excel se
   * puede leer. El filtro final por nombre lo hace el servicio, que es donde
   * está escrita la regla de qué se llama planilla RG 90.
   */
  async librosDelCliente(clienteId: string): Promise<ArchivoDeLibro[]> {
    const documentos = await this.prisma.documento.findMany({
      where: { clienteId, tipo: { in: ['LIBRO_COMPRAS', 'LIBRO_VENTAS'] }, evidenciaId: { not: null } },
      select: { evidenciaId: true },
    });

    const ids = documentos.map((d) => d.evidenciaId!).filter(Boolean);
    if (ids.length === 0) return [];

    const evidencias = await this.prisma.evidencia.findMany({
      where: { id: { in: ids }, tipoMime: { in: EXCEL } },
      select: { id: true, clienteId: true, nombreArchivo: true, itemIdOneDrive: true, tipoMime: true },
    });

    // Sin `itemIdOneDrive` no hay forma de bajar el archivo: se descarta en vez
    // de intentarlo y fallar. Puede faltar en evidencias cargadas a mano.
    return evidencias
      .filter((e): e is typeof e & { itemIdOneDrive: string } => e.itemIdOneDrive !== null)
      .map((e) => ({
        evidenciaId: e.id,
        clienteId: e.clienteId ?? clienteId,
        nombreArchivo: e.nombreArchivo,
        itemIdOneDrive: e.itemIdOneDrive,
        tipoMime: e.tipoMime,
      }));
  }

  /**
   * Guarda la liquidación de un período, reemplazando la anterior si existía.
   *
   * `upsert` y no `create`: una planilla corregida tiene que poder reimportarse
   * y dar el número nuevo, no un error ni una segunda fila. Pasa seguido — en
   * el OneDrive real hay archivos llamados "RG COMPRAS ... ACTUALIZADO" y
   * "CORRECCION RG COMPRAS ...".
   */
  async guardarLiquidacion(datos: AltaDeLiquidacion): Promise<void> {
    const valores = {
      creditoFiscal: datos.creditoFiscal,
      debitoFiscal: datos.debitoFiscal,
      saldoAPagar: datos.saldoAPagar,
      saldoAFavor: datos.saldoAFavor,
      comprobantesCompras: datos.comprobantesCompras,
      comprobantesVentas: datos.comprobantesVentas,
      gravado10Compras: datos.gravado10Compras,
      gravado5Compras: datos.gravado5Compras,
      exentoCompras: datos.exentoCompras,
      gravado10Ventas: datos.gravado10Ventas,
      gravado5Ventas: datos.gravado5Ventas,
      exentoVentas: datos.exentoVentas,
      archivosLeidos: datos.archivosLeidos,
      filasRechazadas: datos.filasRechazadas,
      calculadoEn: new Date(),
      calculadoPorUsuarioId: datos.calculadoPorUsuarioId,
    };

    await this.prisma.liquidacionIvaRg90.upsert({
      where: { clienteId_periodo: { clienteId: datos.clienteId, periodo: datos.periodo } },
      create: { clienteId: datos.clienteId, periodo: datos.periodo, ...valores },
      update: valores,
    });
  }

  /**
   * Guarda los hallazgos nuevos y devuelve cuántos lo eran.
   *
   * `skipDuplicates` con la única de la base: correr esto cada hora no puede
   * llenar la pantalla con el mismo hallazgo repetido. Devolver cuántos son
   * NUEVOS —y no cuántos se intentaron— es lo que permite que el motor de
   * alertas avise solo cuando aparece algo que antes no estaba.
   */
  async guardarHallazgos(datos: readonly AltaDeHallazgo[]): Promise<number> {
    if (datos.length === 0) return 0;

    const resultado = await this.prisma.hallazgoDeLibroRg90.createMany({
      data: datos.map((h) => ({
        clienteId: h.clienteId,
        periodo: h.periodo,
        tipo: h.tipo,
        riesgo: h.riesgo,
        tipoRegistro: h.tipoRegistro,
        numeroComprobante: h.numeroComprobante,
        contraparte: h.contraparte.slice(0, 300),
        tasa: h.tasa,
        declarado: h.declarado,
        calculado: h.calculado,
        diferencia: h.diferencia,
        detalle: h.detalle.slice(0, 1000),
      })),
      skipDuplicates: true,
    });

    return resultado.count;
  }

  /** Liquidaciones de un cliente, de la más reciente a la más vieja. */
  async liquidacionesDeCliente(clienteId: string) {
    const filas = await this.prisma.liquidacionIvaRg90.findMany({
      where: { clienteId },
      orderBy: { periodo: 'desc' },
    });

    return filas.map((f) => ({
      ...f,
      creditoFiscal: gs(f.creditoFiscal),
      debitoFiscal: gs(f.debitoFiscal),
      saldoAPagar: gs(f.saldoAPagar),
      saldoAFavor: gs(f.saldoAFavor),
    }));
  }

  /**
   * Hallazgos abiertos, los de riesgo primero.
   *
   * El orden no es cosmético: son los que pueden derivar en multa, y si quedan
   * mezclados entre ciento y pico de inconsistencias menores, nadie los ve.
   */
  async hallazgos(filtro: { clienteId?: string; soloRiesgo?: boolean } = {}) {
    return this.prisma.hallazgoDeLibroRg90.findMany({
      where: {
        ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
        ...(filtro.soloRiesgo ? { riesgo: { in: ['CREDITO_DE_MAS', 'DEBITO_DE_MENOS'] } } : {}),
      },
      orderBy: [{ riesgo: 'asc' }, { periodo: 'desc' }],
    });
  }
}
