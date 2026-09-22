/**
 * Persistencia del detector de presentaciones: qué PDFs se leyeron, qué eran,
 * y qué vencimientos siguen pendientes.
 *
 * Ver `servicios/detectorDePresentaciones.ts` para el porqué.
 */

import type { PrismaClient } from '@prisma/client';

import type { DeclaracionDnit } from '@effort/importers';

import type {
  PdfPorLeer,
  PresentacionLeida,
  VencimientoPendiente,
} from '../servicios/detectorDePresentaciones.js';

/**
 * PDFs de más de esto no se leen.
 *
 * Una declaración jurada o un talón pesan decenas o cientos de KB. Lo que pasa
 * de 8 MB es un escaneo de facturas o un balance con anexos, y bajarlo entero a
 * un contenedor de 512 MB para descubrir que no es una declaración es el tipo
 * de trabajo de fondo que ya tumbó el sistema una vez (CLAUDE.md, lección 4).
 */
const TAMANO_MAXIMO_BYTES = 8_000_000;

/**
 * Nombres de archivo que se abren PRIMERO.
 *
 * No es un filtro: es un orden. Hasta el 2026-09-15 era un filtro, y Daniel
 * señaló el hueco: *"una posibilidad es que no encuentres el documento porque
 * tiene un nombre equivocado"*. Tenía razón en el caso real — `DDJJ IVA 072026
 * DIBEC SA.pdf` contiene la declaración de agosto — y un PDF de la DNIT
 * guardado como `document(3).pdf` nunca se habría abierto. Ahora se leen todos
 * los PDFs; los de nombre sugestivo van adelante para que lo probable llegue
 * primero.
 */
const NOMBRE_CANDIDATO =
  '(ddjj|declara|form|iva|ire|eeff|estados|financ|rg ?90|tal[oó]n|constancia|presenta|rectific|[0-9]{6})';

export class DeclaracionesPrisma {
  constructor(private readonly prisma: PrismaClient) {}

  /** Los PDFs candidatos que todavía no se leyeron, los más recientes primero. */
  async pdfsPorLeer(limite: number): Promise<PdfPorLeer[]> {
    const filas = await this.prisma.$queryRaw<
      { evidencia_id: string; cliente_id: string; item_id_onedrive: string; nombre_archivo: string }[]
    >`
      SELECT e."id" AS evidencia_id, e."cliente_id", e."item_id_onedrive", e."nombre_archivo"
      FROM "evidencia" e
      LEFT JOIN "lectura_de_declaracion" l ON l."evidencia_id" = e."id"
      WHERE l."evidencia_id" IS NULL
        AND e."cliente_id" IS NOT NULL
        AND e."item_id_onedrive" IS NOT NULL
        AND e."nombre_archivo" ~* '\\.pdf$'
        AND e."tamano_bytes" < ${TAMANO_MAXIMO_BYTES}
      ORDER BY (e."nombre_archivo" ~* ${NOMBRE_CANDIDATO}) DESC, e."creado_en" DESC
      LIMIT ${limite}
    `;

    return filas.map((f) => ({
      evidenciaId: f.evidencia_id,
      clienteId: f.cliente_id,
      itemIdOneDrive: f.item_id_onedrive,
      nombreArchivo: f.nombre_archivo,
    }));
  }

  async guardarLectura(
    pdf: PdfPorLeer,
    resultado: { declaracion: DeclaracionDnit | null; error: string | null },
  ): Promise<void> {
    const d = resultado.declaracion;
    const datos = {
      clienteId: pdf.clienteId,
      formulario: d?.formulario ?? null,
      ruc: d?.ruc ?? null,
      periodo: d?.periodo ?? null,
      numeroDeOrden: d?.numeroDeOrden ?? null,
      fechaDePresentacion: d ? new Date(`${d.fechaDePresentacion}T00:00:00Z`) : null,
      fechaAproximada: d?.fechaAproximada ?? false,
      error: resultado.error,
      leidaEn: new Date(),
      // Tarea 138: solo el formulario 120 lo trae, y solo si el texto tenía la
      // casilla 47. `null` en cualquier otro caso — nunca se inventa un saldo.
      saldoAFavorATrasladar: d?.saldoDeIva?.saldoATrasladar ?? null,
      saldoAFavorPeriodoAnterior: d?.saldoDeIva?.saldoDePeriodoAnterior ?? null,
    };

    await this.prisma.lecturaDeDeclaracion.upsert({
      where: { evidenciaId: pdf.evidenciaId },
      create: { evidenciaId: pdf.evidenciaId, ...datos },
      update: datos,
    });
  }

  async presentacionesLeidas(): Promise<PresentacionLeida[]> {
    const filas = await this.prisma.lecturaDeDeclaracion.findMany({
      where: { formulario: { not: null }, numeroDeOrden: { not: null } },
    });

    return filas.map((f) => ({
      evidenciaId: f.evidenciaId,
      clienteId: f.clienteId,
      formulario: f.formulario!,
      ruc: f.ruc ?? '',
      periodo: f.periodo ?? '',
      numeroDeOrden: f.numeroDeOrden!,
      fechaDePresentacion: f.fechaDePresentacion!.toISOString().slice(0, 10),
      fechaAproximada: f.fechaAproximada,
    }));
  }

  /**
   * Saldo a favor de IVA que la DNIT ya tiene registrado, para un cliente y
   * período (tarea 138). Se toma de lo DECLARADO, no de lo calculado desde las
   * planillas: recalcularlo puede contradecir una determinación ya presentada.
   *
   * Si hay una original y una rectificativa del mismo período, vale la más
   * reciente (`leidaEn` más nueva) — es lo último que EFFORT presentó ante la
   * DNIT. `null` si nunca se leyó una declaración de IVA de ese período, o si
   * la que se leyó no traía la casilla 47.
   */
  async saldoDeIvaDeclarado(
    clienteId: string,
    periodo: string,
  ): Promise<{ saldoATrasladar: bigint; saldoDePeriodoAnterior: bigint | null } | null> {
    const fila = await this.prisma.lecturaDeDeclaracion.findFirst({
      where: { clienteId, periodo, formulario: '120', saldoAFavorATrasladar: { not: null } },
      orderBy: { leidaEn: 'desc' },
      select: { saldoAFavorATrasladar: true, saldoAFavorPeriodoAnterior: true },
    });
    if (!fila) return null;

    return {
      saldoATrasladar: fila.saldoAFavorATrasladar!,
      saldoDePeriodoAnterior: fila.saldoAFavorPeriodoAnterior,
    };
  }

  /** De estas evidencias, cuáles prueban una presentación con fecha aproximada. */
  async conFechaAproximada(evidenciaIds: readonly string[]): Promise<Set<string>> {
    if (evidenciaIds.length === 0) return new Set();
    const filas = await this.prisma.lecturaDeDeclaracion.findMany({
      where: { evidenciaId: { in: [...evidenciaIds] }, fechaAproximada: true },
      select: { evidenciaId: true },
    });
    return new Set(filas.map((f) => f.evidenciaId));
  }

  /** Vencimientos generados por el calendario que todavía no figuran como presentados. */
  async vencimientosPendientes(): Promise<VencimientoPendiente[]> {
    const filas = await this.prisma.vencimiento.findMany({
      where: {
        estado: { notIn: ['PRESENTADO', 'NO_APLICA'] },
        obligacionId: { not: null },
        periodo: { not: null },
      },
      select: {
        id: true,
        clienteId: true,
        periodo: true,
        fechaVencimiento: true,
        cliente: { select: { ruc: true } },
        obligacion: { select: { codigo: true } },
      },
    });

    return filas.map((f) => ({
      id: f.id,
      clienteId: f.clienteId,
      rucCliente: f.cliente.ruc,
      codigoObligacion: f.obligacion!.codigo,
      periodo: f.periodo!,
      fechaVencimiento: f.fechaVencimiento.toISOString().slice(0, 10),
    }));
  }
}
