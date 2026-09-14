/**
 * Persistencia del libro RG 90: liquidación de IVA y hallazgos.
 *
 * Va en su propio archivo y no en `dominio.ts` porque es una pieza nueva y
 * completa —dos tablas que se escriben juntas y se leen juntas— y meterla en el
 * archivo que ya tiene once repositorios no ayudaría a nadie a encontrarla.
 */

import type { PrismaClient } from '@prisma/client';

import { gs } from '@effort/core';
import {
  esRiesgoDeMulta,
  TOLERANCIA_DE_REDONDEO_DEL_PROVEEDOR,
  type RiesgoDeHallazgo,
} from '@effort/importers';

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
      select: {
        id: true,
        clienteId: true,
        nombreArchivo: true,
        itemIdOneDrive: true,
        tipoMime: true,
        modificadoEnOrigen: true,
      },
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
        modificadoEnOrigen: e.modificadoEnOrigen,
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
   * Correr esto cada hora no puede llenar la pantalla con el mismo hallazgo
   * repetido. Devolver cuántos son NUEVOS —y no cuántos se intentaron— es lo
   * que permite que el motor de alertas avise solo cuando aparece algo nuevo.
   *
   * **Por qué no alcanza con el índice único**, y es la historia de un bug que
   * duplicó hallazgos cada hora durante días: el índice es `(cliente, período,
   * comprobante, tipo, tasa)`, y `tasa` es NULL en los hallazgos de "las partes
   * no suman el total". En PostgreSQL dos NULL NO son iguales para un índice
   * único, así que `skipDuplicates` no saltaba nada. El 2026-09-14 había 2.069
   * filas de ese tipo para 152 comprobantes reales, y un informe de avance llegó
   * a hablar de "1.905 inconsistencias" y "679 filas en cero" cuando eran 152 y 60.
   *
   * Por eso se compara acá contra lo que ya está, con la clave completa
   * —incluida la contraparte, que el índice no tiene y hace falta: dos
   * proveedores pueden usar el mismo número de comprobante—. El arreglo de fondo
   * es el índice con `NULLS NOT DISTINCT`, que necesita antes limpiar los
   * repetidos, y eso es un borrado: DISCREPANCIAS punto 21, pendiente de Daniel.
   */
  async guardarHallazgos(datos: readonly AltaDeHallazgo[]): Promise<number> {
    if (datos.length === 0) return 0;

    const existentes = await this.prisma.hallazgoDeLibroRg90.findMany({
      where: {
        clienteId: { in: [...new Set(datos.map((h) => h.clienteId))] },
        periodo: { in: [...new Set(datos.map((h) => h.periodo))] },
      },
      select: {
        clienteId: true,
        periodo: true,
        tipoRegistro: true,
        numeroComprobante: true,
        contraparte: true,
        tipo: true,
        tasa: true,
      },
    });

    const vistos = new Set(existentes.map(claveDeHallazgo));
    const nuevos = datos.filter((h) => {
      const clave = claveDeHallazgo({ ...h, contraparte: h.contraparte.slice(0, 300) });
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
    if (nuevos.length === 0) return 0;

    const resultado = await this.prisma.hallazgoDeLibroRg90.createMany({
      data: nuevos.map((h) => ({
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

  /**
   * Comprobantes con riesgo de multa, agrupados por cliente y período.
   *
   * Lo agrupa la base y no el código: son cientos de filas y lo único que el
   * motor de alertas necesita son cuántas y cuánto hay en juego. Traerlas todas
   * para contarlas acá sería mover datos para tirarlos.
   *
   * `ABS` sobre la diferencia porque un crédito de más y un débito de menos son
   * dos problemas distintos y no se compensan entre sí: sumarlos con signo daría
   * cero cuando hay dos errores, que es la respuesta opuesta a la verdadera.
   */
  async riesgoPorPeriodo(): Promise<
    readonly {
      clienteId: string;
      periodo: string;
      liquidacionId: string;
      comprobantes: number;
      ivaEnRiesgo: bigint;
    }[]
  > {
    // Se une con la liquidación para traer su id: es la entidad con la que se
    // relaciona la alerta, y `entidad_relacionada_id` es una columna UUID.
    // Un período con hallazgos pero sin liquidación no puede existir —se
    // escriben juntos—, y el JOIN interno lo deja explícito.
    const filas = await this.prisma.$queryRaw<
      {
        cliente_id: string;
        periodo: string;
        liquidacion_id: string;
        comprobantes: bigint;
        iva_en_riesgo: bigint;
      }[]
    >`
      SELECT h."cliente_id", h."periodo", l."id" AS liquidacion_id,
             COUNT(*) AS comprobantes,
             COALESCE(SUM(ABS(h."diferencia")), 0) AS iva_en_riesgo
      FROM (
        -- DISTINCT ON por la clave completa: mientras queden filas repetidas de
        -- antes del arreglo, cada comprobante cuenta una sola vez.
        SELECT DISTINCT ON ("cliente_id", "periodo", "tipo_registro", "numero_comprobante",
                            "contraparte", "tipo", "tasa")
               "cliente_id", "periodo", "diferencia"
        FROM "hallazgo_libro_rg90"
        WHERE "riesgo" IN ('CREDITO_DE_MAS', 'DEBITO_DE_MENOS')
          AND ABS("diferencia") > ${TOLERANCIA_DE_REDONDEO_DEL_PROVEEDOR}
          -- Aceptado por una persona, con motivo: deja de alertar. EN_REVISION
          -- sigue alertando — mirarlo no es resolverlo.
          AND "estado" <> 'ACEPTADO'
      ) h
      JOIN "liquidacion_iva_rg90" l
        ON l."cliente_id" = h."cliente_id" AND l."periodo" = h."periodo"
      GROUP BY h."cliente_id", h."periodo", l."id"
    `;

    return filas.map((f) => ({
      clienteId: f.cliente_id,
      periodo: f.periodo,
      liquidacionId: f.liquidacion_id,
      comprobantes: Number(f.comprobantes),
      ivaEnRiesgo: BigInt(f.iva_en_riesgo),
    }));
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
   * Hallazgos, los de riesgo primero, cada comprobante una sola vez.
   *
   * El orden no es cosmético: son los que pueden derivar en multa, y si quedan
   * mezclados entre ciento y pico de inconsistencias menores, nadie los ve.
   *
   * `soloRiesgo` deja lo que todavía pide atención: riesgo de multa que nadie
   * aceptó. Lo aceptado se ve al pedir todos, con el motivo.
   */
  async hallazgos(filtro: { clienteId?: string; soloRiesgo?: boolean } = {}) {
    const filas = await this.prisma.hallazgoDeLibroRg90.findMany({
      where: {
        ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
        ...(filtro.soloRiesgo
          ? { riesgo: { in: ['CREDITO_DE_MAS', 'DEBITO_DE_MENOS'] }, estado: { not: 'ACEPTADO' } }
          : {}),
      },
      // El más viejo primero, para que al quitar repetidos quede el original.
      orderBy: { detectadoEn: 'asc' },
    });

    const vistos = new Set<string>();
    const unicos = filas.filter((h) => {
      const clave = claveDeHallazgo(h);
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });

    // La tolerancia se aplica acá y no en el `where`: Prisma no filtra por el
    // valor absoluto de una columna, y la definición de riesgo tiene que ser una
    // sola (`esRiesgoDeMulta`), no una copia en cada consulta.
    const resultado = filtro.soloRiesgo
      ? unicos.filter((h) =>
          esRiesgoDeMulta({ riesgo: h.riesgo as RiesgoDeHallazgo, diferencia: h.diferencia }),
        )
      : unicos;

    return resultado.sort(
      (a, b) => a.riesgo.localeCompare(b.riesgo) || b.periodo.localeCompare(a.periodo),
    );
  }

  /** Un hallazgo por id. La ruta lo usa para comprobar de qué cliente es antes de decidir. */
  async hallazgoPorId(id: string) {
    return this.prisma.hallazgoDeLibroRg90.findUnique({ where: { id } });
  }

  /**
   * Registra la decisión de una persona sobre un hallazgo.
   *
   * Se aplica a todas las filas con la misma clave y no solo al id: mientras
   * existan repetidos de antes del arreglo, aceptar uno y dejar su copia
   * pendiente haría que la alerta no se cierre nunca.
   */
  async decidirHallazgo(datos: {
    readonly id: string;
    readonly estado: 'ACEPTADO' | 'EN_REVISION';
    readonly nota: string | null;
    readonly usuarioId: string;
    readonly ahora: Date;
  }): Promise<number> {
    const hallazgo = await this.prisma.hallazgoDeLibroRg90.findUnique({ where: { id: datos.id } });
    if (!hallazgo) return 0;

    const { count } = await this.prisma.hallazgoDeLibroRg90.updateMany({
      where: {
        clienteId: hallazgo.clienteId,
        periodo: hallazgo.periodo,
        tipoRegistro: hallazgo.tipoRegistro,
        numeroComprobante: hallazgo.numeroComprobante,
        contraparte: hallazgo.contraparte,
        tipo: hallazgo.tipo,
        tasa: hallazgo.tasa,
      },
      data: {
        estado: datos.estado,
        notaDecision: datos.nota,
        decididoPorUsuarioId: datos.usuarioId,
        decididoEn: datos.ahora,
      },
    });

    return count;
  }
}

/** Qué hace que dos hallazgos sean el mismo: el comprobante, de quién, y qué se encontró. */
function claveDeHallazgo(h: {
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipoRegistro: string;
  readonly numeroComprobante: string;
  readonly contraparte: string;
  readonly tipo: string;
  readonly tasa: string | null;
}): string {
  return [h.clienteId, h.periodo, h.tipoRegistro, h.numeroComprobante, h.contraparte, h.tipo, h.tasa ?? ''].join('|');
}
