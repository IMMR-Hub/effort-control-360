/**
 * Repositorios de los módulos de negocio.
 *
 * El filtro de cartera se aplica siempre dentro del `where`, nunca filtrando en
 * memoria después de consultar. Y cuando hay que combinar el filtro con otra
 * condición sobre la misma columna, va dentro de un `AND` explícito: combinarlas
 * con spread hace que una pise a la otra, que fue exactamente el bug que los
 * tests de integración encontraron en `ClientesPrisma.buscarPorId`.
 */

import type {
  AltaDeDocumento,
  AltaDeVencimiento,
  BalanceAlmacenado,
  CamposEditablesDelProceso,
  CifrasDeBalance,
  DocumentoAlmacenado,
  FiltroDeCartera,
  ProcesoMensualAlmacenado,
  RepositorioDeBalances,
  RepositorioDeDocumentos,
  RepositorioDeProcesoMensual,
  RepositorioDeVencimientos,
  VencimientoAlmacenado,
} from '../puertos-dominio.js';
import type { PrismaClient } from './prisma.js';

/**
 * Condición de cartera sobre la columna `clienteId`.
 *
 * `null` no restringe. Un arreglo, aunque esté vacío, sí: un usuario sin
 * clientes asignados obtiene `clienteId IN ()`, que no devuelve nada. Tratar el
 * arreglo vacío como "sin filtro" le mostraría la cartera entera.
 */
function porCartera(filtro: FiltroDeCartera) {
  return filtro === null ? {} : { clienteId: { in: [...filtro] } };
}

/* ========================================================================== */
/* Documentos                                                                 */
/* ========================================================================== */

const CAMPOS_DOCUMENTO = {
  id: true,
  clienteId: true,
  periodo: true,
  tipo: true,
  canalRecepcion: true,
  recibidoEn: true,
  rucEmisor: true,
  timbrado: true,
  numeroComprobante: true,
  total: true,
  tasa: true,
  anulado: true,
  estado: true,
  motivoRechazo: true,
  evidenciaId: true,
  observaciones: true,
} as const;

export class DocumentosPrisma implements RepositorioDeDocumentos {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(
    clienteId: string,
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<DocumentoAlmacenado[]> {
    const filas = await this.prisma.documento.findMany({
      where: {
        AND: [
          { clienteId },
          ...(periodo ? [{ periodo }] : []),
          ...(filtro === null ? [] : [{ clienteId: { in: [...filtro] } }]),
        ],
      },
      select: CAMPOS_DOCUMENTO,
      orderBy: { recibidoEn: 'desc' },
    });

    return filas as DocumentoAlmacenado[];
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<DocumentoAlmacenado | null> {
    const fila = await this.prisma.documento.findFirst({
      where: { AND: [{ id }, porCartera(filtro)] },
      select: CAMPOS_DOCUMENTO,
    });

    return fila as DocumentoAlmacenado | null;
  }

  async registrar(datos: AltaDeDocumento): Promise<DocumentoAlmacenado> {
    const fila = await this.prisma.documento.create({
      data: {
        clienteId: datos.clienteId,
        periodo: datos.periodo,
        tipo: datos.tipo,
        canalRecepcion: datos.canalRecepcion,
        recibidoEn: datos.recibidoEn,
        rucEmisor: datos.rucEmisor,
        timbrado: datos.timbrado,
        numeroComprobante: datos.numeroComprobante,
        total: datos.total,
        tasa: datos.tasa as never,
        anulado: datos.anulado,
        evidenciaId: datos.evidenciaId,
        observaciones: datos.observaciones,
        creadoPorUsuarioId: datos.creadoPorUsuarioId,
        actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
      },
      select: CAMPOS_DOCUMENTO,
    });

    return fila as DocumentoAlmacenado;
  }

  async cambiarEstado(
    id: string,
    estado: string,
    motivoRechazo: string | null,
    usuarioId: string,
  ): Promise<DocumentoAlmacenado> {
    const fila = await this.prisma.documento.update({
      where: { id },
      data: { estado: estado as never, motivoRechazo, actualizadoPorUsuarioId: usuarioId },
      select: CAMPOS_DOCUMENTO,
    });

    return fila as DocumentoAlmacenado;
  }

  /**
   * Comprobantes que suman en los totales del período.
   *
   * Excluye los rechazados y los marcados como duplicados, pero **incluye los
   * anulados**: el libro los sigue conteniendo aunque no sumen, y el dominio
   * (`comprobantesComputables`) es el que decide qué entra en cada total.
   */
  async comprobantesDelPeriodo(
    clienteId: string,
    periodo: string,
  ): Promise<DocumentoAlmacenado[]> {
    const filas = await this.prisma.documento.findMany({
      where: {
        clienteId,
        periodo,
        estado: { notIn: ['RECHAZADO', 'DUPLICADO'] },
        numeroComprobante: { not: null },
      },
      select: CAMPOS_DOCUMENTO,
      orderBy: { recibidoEn: 'asc' },
    });

    return filas as DocumentoAlmacenado[];
  }
}

/* ========================================================================== */
/* Proceso mensual                                                            */
/* ========================================================================== */

const CAMPOS_PROCESO = {
  id: true,
  clienteId: true,
  periodo: true,
  comprobantesRetirados: true,
  fechaRetiro: true,
  documentosRecibidos: true,
  documentosFaltantes: true,
  documentosObservados: true,
  comprasCargadasSiga: true,
  ventasCargadasSiga: true,
  retencionesCargadas: true,
  extractosRecibidos: true,
  conciliacionBancariaRealizada: true,
  ivaRevisado: true,
  ivaSaldoAPagar: true,
  ivaSaldoAFavor: true,
  liquidacionGenerada: true,
  liquidacionEnviada: true,
  balanceAplica: true,
  estadoGeneral: true,
  riesgo: true,
  proximaAccion: true,
  fechaLimiteInterna: true,
  observaciones: true,
} as const;

export class ProcesoMensualPrisma implements RepositorioDeProcesoMensual {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(periodo: string, filtro: FiltroDeCartera): Promise<ProcesoMensualAlmacenado[]> {
    const filas = await this.prisma.procesoMensual.findMany({
      where: { periodo, ...porCartera(filtro) },
      select: CAMPOS_PROCESO,
      orderBy: { clienteId: 'asc' },
    });

    return filas as ProcesoMensualAlmacenado[];
  }

  async buscar(
    clienteId: string,
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<ProcesoMensualAlmacenado | null> {
    const fila = await this.prisma.procesoMensual.findFirst({
      where: {
        AND: [
          { clienteId, periodo },
          ...(filtro === null ? [] : [{ clienteId: { in: [...filtro] } }]),
        ],
      },
      select: CAMPOS_PROCESO,
    });

    return fila as ProcesoMensualAlmacenado | null;
  }

  /**
   * Devuelve la fila del período, creándola si todavía no existe.
   *
   * Se usa `upsert` y no "buscar, y si no está crear": entre la lectura y la
   * escritura, otra petición podría crear la misma fila y la segunda fallaría
   * contra la restricción de unicidad. El `upsert` lo resuelve en la base.
   */
  async asegurar(
    clienteId: string,
    periodo: string,
    usuarioId: string,
  ): Promise<ProcesoMensualAlmacenado> {
    const fila = await this.prisma.procesoMensual.upsert({
      where: { clienteId_periodo: { clienteId, periodo } },
      create: {
        clienteId,
        periodo,
        creadoPorUsuarioId: usuarioId,
        actualizadoPorUsuarioId: usuarioId,
      },
      update: {},
      select: CAMPOS_PROCESO,
    });

    return fila as ProcesoMensualAlmacenado;
  }

  async actualizar(
    clienteId: string,
    periodo: string,
    cambios: CamposEditablesDelProceso,
    usuarioId: string,
  ): Promise<ProcesoMensualAlmacenado> {
    const fila = await this.prisma.procesoMensual.update({
      where: { clienteId_periodo: { clienteId, periodo } },
      // Los campos llegan ya validados por Zod estricto en la ruta: solo puede
      // haber claves de la lista permitida, así que el objeto es seguro de pasar.
      data: { ...cambios, actualizadoPorUsuarioId: usuarioId } as never,
      select: CAMPOS_PROCESO,
    });

    return fila as ProcesoMensualAlmacenado;
  }
}

/* ========================================================================== */
/* Vencimientos                                                               */
/* ========================================================================== */

const CAMPOS_VENCIMIENTO = {
  id: true,
  clienteId: true,
  tipoDocumento: true,
  descripcion: true,
  entidad: true,
  fechaEmision: true,
  fechaVencimiento: true,
  fechaPresentacion: true,
  responsableId: true,
  estado: true,
  riesgo: true,
  evidenciaId: true,
  proximaAccion: true,
} as const;

export class VencimientosPrisma implements RepositorioDeVencimientos {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * El radar completo de la cartera.
   *
   * Ordenado por fecha de vencimiento ascendente y excluyendo lo ya presentado:
   * lo que importa es qué falta, y lo más urgente primero. Es la vista que
   * existe para que no vuelva a pasar lo de la multa de Abogacía.
   */
  async listar(filtro: FiltroDeCartera): Promise<VencimientoAlmacenado[]> {
    const filas = await this.prisma.vencimiento.findMany({
      where: { estado: { notIn: ['PRESENTADO', 'NO_APLICA'] }, ...porCartera(filtro) },
      select: CAMPOS_VENCIMIENTO,
      orderBy: { fechaVencimiento: 'asc' },
    });

    return filas as VencimientoAlmacenado[];
  }

  async listarPorCliente(
    clienteId: string,
    filtro: FiltroDeCartera,
  ): Promise<VencimientoAlmacenado[]> {
    const filas = await this.prisma.vencimiento.findMany({
      where: {
        AND: [{ clienteId }, ...(filtro === null ? [] : [{ clienteId: { in: [...filtro] } }])],
      },
      select: CAMPOS_VENCIMIENTO,
      orderBy: { fechaVencimiento: 'asc' },
    });

    return filas as VencimientoAlmacenado[];
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<VencimientoAlmacenado | null> {
    const fila = await this.prisma.vencimiento.findFirst({
      where: { AND: [{ id }, porCartera(filtro)] },
      select: CAMPOS_VENCIMIENTO,
    });

    return fila as VencimientoAlmacenado | null;
  }

  async registrar(datos: AltaDeVencimiento): Promise<VencimientoAlmacenado> {
    const fila = await this.prisma.vencimiento.create({
      data: {
        clienteId: datos.clienteId,
        tipoDocumento: datos.tipoDocumento,
        descripcion: datos.descripcion,
        entidad: datos.entidad,
        fechaEmision: datos.fechaEmision,
        fechaVencimiento: datos.fechaVencimiento,
        responsableId: datos.responsableId,
        riesgo: datos.riesgo as never,
        evidenciaId: datos.evidenciaId,
        proximaAccion: datos.proximaAccion,
        creadoPorUsuarioId: datos.creadoPorUsuarioId,
        actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
      },
      select: CAMPOS_VENCIMIENTO,
    });

    return fila as VencimientoAlmacenado;
  }

  /**
   * Marca una obligación como presentada.
   *
   * Guarda la fecha real de presentación, que puede no ser hoy: alguien puede
   * estar registrando el lunes una presentación hecha el viernes.
   */
  async marcarPresentado(
    id: string,
    fechaPresentacion: Date,
    evidenciaId: string | null,
    usuarioId: string,
  ): Promise<VencimientoAlmacenado> {
    const fila = await this.prisma.vencimiento.update({
      where: { id },
      data: {
        estado: 'PRESENTADO',
        fechaPresentacion,
        ...(evidenciaId ? { evidenciaId } : {}),
        actualizadoPorUsuarioId: usuarioId,
      },
      select: CAMPOS_VENCIMIENTO,
    });

    return fila as VencimientoAlmacenado;
  }
}

/* ========================================================================== */
/* Balances                                                                   */
/* ========================================================================== */

const CAMPOS_BALANCE = {
  id: true,
  clienteId: true,
  periodo: true,
  activo: true,
  pasivo: true,
  patrimonioNeto: true,
  resultadoEjercicio: true,
  estado: true,
  preparadoPorUsuarioId: true,
  aprobadoPorUsuarioId: true,
  aprobadoEn: true,
  inconsistencias: true,
  proximaAccion: true,
} as const;

export class BalancesPrisma implements RepositorioDeBalances {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(periodo: string | null, filtro: FiltroDeCartera): Promise<BalanceAlmacenado[]> {
    const filas = await this.prisma.balance.findMany({
      where: { ...(periodo ? { periodo } : {}), ...porCartera(filtro) },
      select: CAMPOS_BALANCE,
      orderBy: [{ periodo: 'desc' }, { clienteId: 'asc' }],
    });

    return filas as BalanceAlmacenado[];
  }

  async buscar(
    clienteId: string,
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<BalanceAlmacenado | null> {
    const fila = await this.prisma.balance.findFirst({
      where: {
        AND: [
          { clienteId, periodo },
          ...(filtro === null ? [] : [{ clienteId: { in: [...filtro] } }]),
        ],
      },
      select: CAMPOS_BALANCE,
    });

    return fila as BalanceAlmacenado | null;
  }

  /**
   * Guarda las cifras y el resultado de la revisión previa.
   *
   * El estado lo decide el dominio (`revisarBalance`), que nunca devuelve
   * APROBADO. Este método no puede escribir ese estado aunque se lo pidan: si
   * llegara, se rechaza. Es la segunda barrera además del tipo de retorno del
   * dominio. Ver ADR 0004.
   */
  async guardarCifras(
    clienteId: string,
    periodo: string,
    cifras: CifrasDeBalance,
    estado: string,
    inconsistencias: unknown,
    usuarioId: string,
  ): Promise<BalanceAlmacenado> {
    if (estado === 'APROBADO') {
      throw new Error(
        'guardarCifras no puede aprobar un balance. La aprobación pasa por aprobar(), ' +
          'que exige usuario y momento. Ver docs/adr/0004-el-sistema-no-aprueba-balances.md.',
      );
    }

    const datos = {
      activo: cifras.activo,
      pasivo: cifras.pasivo,
      patrimonioNeto: cifras.patrimonioNeto,
      resultadoEjercicio: cifras.resultadoEjercicio,
      estado: estado as never,
      inconsistencias: (inconsistencias ?? null) as never,
      preparadoPorUsuarioId: usuarioId,
      actualizadoPorUsuarioId: usuarioId,
    };

    const fila = await this.prisma.balance.upsert({
      where: { clienteId_periodo: { clienteId, periodo } },
      create: { clienteId, periodo, ...datos, creadoPorUsuarioId: usuarioId },
      update: datos,
      select: CAMPOS_BALANCE,
    });

    return fila as BalanceAlmacenado;
  }

  async aprobar(
    clienteId: string,
    periodo: string,
    aprobadoPorUsuarioId: string,
    aprobadoEn: Date,
  ): Promise<BalanceAlmacenado> {
    const fila = await this.prisma.balance.update({
      where: { clienteId_periodo: { clienteId, periodo } },
      data: {
        estado: 'APROBADO',
        aprobadoPorUsuarioId,
        aprobadoEn,
        actualizadoPorUsuarioId: aprobadoPorUsuarioId,
      },
      select: CAMPOS_BALANCE,
    });

    return fila as BalanceAlmacenado;
  }
}
