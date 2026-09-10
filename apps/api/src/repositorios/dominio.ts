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
  AlertaAlmacenada,
  AltaDeDocumento,
  AltaDeReglaDeNotificacion,
  AltaDeReglaImpositiva,
  AltaDeVencimiento,
  AltaDeVencimientoGenerado,
  ObligacionAlmacenada,
  ObligacionDeClienteAlmacenada,
  RepositorioDeObligaciones,
  BalanceAlmacenado,
  CamposEditablesDelProceso,
  CamposEditablesDeReglaDeNotificacion,
  CamposEditablesDeReglaImpositiva,
  CifrasDeBalance,
  DocumentoAlmacenado,
  FiltroDeCartera,
  ProcesoMensualAlmacenado,
  ReglaDeNotificacionAlmacenada,
  ReglaImpositivaAlmacenada,
  RepositorioDeAlertas,
  RepositorioDeBalances,
  RepositorioDeDocumentos,
  RepositorioDeProcesoMensual,
  RepositorioDeReglasDeNotificacion,
  RepositorioDeReglasImpositivas,
  RepositorioDeSolicitudes,
  RepositorioDeVencimientos,
  SolicitudAlmacenada,
  AltaDeSolicitud,
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

  async registrarLote(datos: readonly AltaDeDocumento[]): Promise<DocumentoAlmacenado[]> {
    if (datos.length === 0) return [];

    const filas = await this.prisma.documento.createManyAndReturn({
      data: datos.map((dato) => ({
        clienteId: dato.clienteId,
        periodo: dato.periodo,
        tipo: dato.tipo,
        canalRecepcion: dato.canalRecepcion,
        recibidoEn: dato.recibidoEn,
        rucEmisor: dato.rucEmisor,
        timbrado: dato.timbrado,
        numeroComprobante: dato.numeroComprobante,
        total: dato.total,
        tasa: dato.tasa as never,
        anulado: dato.anulado,
        evidenciaId: dato.evidenciaId,
        observaciones: dato.observaciones,
        creadoPorUsuarioId: dato.creadoPorUsuarioId,
        actualizadoPorUsuarioId: dato.creadoPorUsuarioId,
      })),
      select: CAMPOS_DOCUMENTO,
      // La restricción única de (clienteId, rucEmisor, timbrado,
      // numeroComprobante) hace que reimportar el mismo archivo salte las
      // filas que ya existen en vez de romper el lote entero.
      skipDuplicates: true,
    });

    return filas as DocumentoAlmacenado[];
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
   * Documentos vigentes del período, para conciliar contra SIGA.
   *
   * Excluye rechazados y duplicados, pero incluye deliberadamente dos grupos:
   *
   *  - los **anulados**, porque el libro los sigue conteniendo aunque no sumen,
   *    y es el dominio el que decide qué entra en cada total;
   *  - los que **no tienen número de comprobante** (un contrato, un acta), que
   *    no se pueden comparar contra SIGA pero sí hay que contar. Filtrarlos acá
   *    haría que la conciliación informara "todo cuadra" sobre un conjunto
   *    incompleto, sin avisar que dejó documentos afuera.
   */
  async documentosDelPeriodo(
    clienteId: string,
    periodo: string,
  ): Promise<DocumentoAlmacenado[]> {
    const filas = await this.prisma.documento.findMany({
      where: {
        clienteId,
        periodo,
        estado: { notIn: ['RECHAZADO', 'DUPLICADO'] },
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
   * Alta en lote de lo que generó el calendario.
   *
   * `skipDuplicates` se apoya en la única `(cliente, obligación, período)`: si
   * alguien vuelve a generar marzo, los que ya estaban no se tocan y no se
   * duplican. Sin eso, regenerar sería una operación peligrosa en vez de una
   * que se puede repetir sin pensarlo — y con vencimientos duplicados el radar
   * miente, que es peor que no tenerlo.
   */
  async registrarGenerados(altas: readonly AltaDeVencimientoGenerado[]): Promise<number> {
    if (altas.length === 0) return 0;

    const resultado = await this.prisma.vencimiento.createMany({
      data: altas.map((alta) => ({
        clienteId: alta.clienteId,
        obligacionId: alta.obligacionId,
        periodo: alta.periodo,
        tipoDocumento: alta.tipoDocumento,
        descripcion: alta.descripcion,
        entidad: alta.entidad,
        fechaEmision: alta.fechaEmision,
        fechaVencimiento: alta.fechaVencimiento,
        responsableId: alta.responsableId,
        riesgo: alta.riesgo as never,
        evidenciaId: alta.evidenciaId,
        proximaAccion: alta.proximaAccion,
        creadoPorUsuarioId: alta.creadoPorUsuarioId,
        actualizadoPorUsuarioId: alta.creadoPorUsuarioId,
      })),
      skipDuplicates: true,
    });

    return resultado.count;
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
/* Obligaciones tributarias                                                   */
/* ========================================================================== */

const CAMPOS_OBLIGACION = {
  id: true,
  codigo: true,
  nombre: true,
  entidad: true,
  formulario: true,
  periodicidad: true,
  mesDeCierreAnual: true,
  diasPorTerminacionRuc: true,
  confirmadaPorEffort: true,
  activa: true,
  fuente: true,
} as const;

export class ObligacionesPrisma implements RepositorioDeObligaciones {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(): Promise<ObligacionAlmacenada[]> {
    const filas = await this.prisma.obligacionTributaria.findMany({
      select: CAMPOS_OBLIGACION,
      orderBy: { codigo: 'asc' },
    });

    return filas as ObligacionAlmacenada[];
  }

  /**
   * Las que el generador puede usar.
   *
   * El filtro por `confirmadaPorEffort` no es una formalidad: el calendario de
   * la DNIT cambia por resolución, y un día equivocado hace que el sistema
   * avise tarde justo de lo que existe para no dejar pasar. Hasta que alguien
   * de EFFORT lo confirme contra la resolución vigente, la obligación se puede
   * cargar y revisar, pero no produce un solo aviso.
   */
  async listarGenerables(): Promise<ObligacionAlmacenada[]> {
    const filas = await this.prisma.obligacionTributaria.findMany({
      where: { activa: true, confirmadaPorEffort: true },
      select: CAMPOS_OBLIGACION,
      orderBy: { codigo: 'asc' },
    });

    return filas as ObligacionAlmacenada[];
  }

  async asignacionesDeClientes(): Promise<ObligacionDeClienteAlmacenada[]> {
    const filas = await this.prisma.obligacionDeCliente.findMany({
      select: { id: true, clienteId: true, obligacionId: true, desde: true, hasta: true },
    });

    return filas as ObligacionDeClienteAlmacenada[];
  }
}

/* ========================================================================== */
/* Solicitudes de documentación                                              */
/* ========================================================================== */

const CAMPOS_SOLICITUD = {
  id: true,
  clienteId: true,
  periodo: true,
  estado: true,
  cuentaDesde: true,
  recordatoriosEnviados: true,
  ultimoRecordatorioEn: true,
  reglaId: true,
} as const;

export class SolicitudesPrisma implements RepositorioDeSolicitudes {
  constructor(private readonly prisma: PrismaClient) {}

  async listarPorPeriodo(
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<SolicitudAlmacenada[]> {
    const filas = await this.prisma.solicitudDocumentacion.findMany({
      where: { AND: [{ periodo }, porCartera(filtro)] },
      select: CAMPOS_SOLICITUD,
      orderBy: { cuentaDesde: 'asc' },
    });

    return filas as SolicitudAlmacenada[];
  }

  async listarPorCliente(
    clienteId: string,
    filtro: FiltroDeCartera,
  ): Promise<SolicitudAlmacenada[]> {
    const filas = await this.prisma.solicitudDocumentacion.findMany({
      where: { AND: [{ clienteId }, porCartera(filtro)] },
      select: CAMPOS_SOLICITUD,
      orderBy: { periodo: 'desc' },
    });

    return filas as SolicitudAlmacenada[];
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<SolicitudAlmacenada | null> {
    const fila = await this.prisma.solicitudDocumentacion.findFirst({
      where: { AND: [{ id }, porCartera(filtro)] },
      select: CAMPOS_SOLICITUD,
    });

    return fila as SolicitudAlmacenada | null;
  }

  /**
   * Idempotente por `(clienteId, periodo)` vía `upsert`: abrir el seguimiento
   * de un período que ya estaba abierto no crea una fila duplicada ni pisa el
   * progreso ya hecho (recordatorios enviados, estado) — solo lo devuelve.
   */
  async registrar(datos: AltaDeSolicitud): Promise<SolicitudAlmacenada> {
    const fila = await this.prisma.solicitudDocumentacion.upsert({
      where: { clienteId_periodo: { clienteId: datos.clienteId, periodo: datos.periodo } },
      update: {},
      create: {
        clienteId: datos.clienteId,
        periodo: datos.periodo,
        cuentaDesde: datos.cuentaDesde,
        reglaId: datos.reglaId,
      },
      select: CAMPOS_SOLICITUD,
    });

    return fila as SolicitudAlmacenada;
  }

  async cerrar(
    id: string,
    estado: 'ENTREGADA' | 'CERRADA_MANUALMENTE',
    usuarioId: string,
  ): Promise<SolicitudAlmacenada> {
    const fila = await this.prisma.solicitudDocumentacion.update({
      where: { id },
      data: { estado, actualizadoPorUsuarioId: usuarioId },
      select: CAMPOS_SOLICITUD,
    });

    return fila as SolicitudAlmacenada;
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

/* ========================================================================== */
/* Alertas                                                                    */
/* ========================================================================== */

const CAMPOS_ALERTA = {
  id: true,
  clienteId: true,
  periodo: true,
  origen: true,
  criticidad: true,
  titulo: true,
  detalle: true,
  entidadRelacionada: true,
  entidadRelacionadaId: true,
  responsableId: true,
  fechaLimite: true,
  estado: true,
  cerradaPorUsuarioId: true,
  cerradaEn: true,
  motivoCierre: true,
} as const;

export class AlertasPrisma implements RepositorioDeAlertas {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * El radar consolidado: solo lo que sigue abierto, más crítico primero.
   *
   * `criticidad: 'asc'` alcanza para ese orden porque en PostgreSQL un enum
   * nativo ordena según la posición en que se declaró en `CREATE TYPE`, no
   * alfabéticamente — y `Criticidad` en `schema.prisma` está declarado
   * `CRITICA, ALTA, MEDIA, INFORMATIVA` a propósito. Si el enum alguna vez se
   * reordena, este `orderBy` deja de tener sentido sin que ningún tipo lo avise.
   *
   * Una alerta sin `clienteId` (de alcance general, no de un cliente puntual)
   * no entra en el filtro de cartera: el filtro es `clienteId IN (...)` y
   * `NULL` nunca matchea un `IN`. Es la aplicación del mismo "negar por
   * defecto" que el resto del sistema — un auxiliar con cartera acotada no ve
   * alertas generales aunque no tengan dueño.
   */
  async listar(filtro: FiltroDeCartera): Promise<AlertaAlmacenada[]> {
    const filas = await this.prisma.alerta.findMany({
      where: { estado: { in: ['ABIERTA', 'EN_CURSO'] }, ...porCartera(filtro) },
      select: CAMPOS_ALERTA,
      orderBy: [{ criticidad: 'asc' }, { creadoEn: 'asc' }],
    });

    return filas as AlertaAlmacenada[];
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<AlertaAlmacenada | null> {
    const fila = await this.prisma.alerta.findFirst({
      where: { AND: [{ id }, porCartera(filtro)] },
      select: CAMPOS_ALERTA,
    });

    return fila as AlertaAlmacenada | null;
  }

  async cerrar(
    id: string,
    motivoCierre: string,
    usuarioId: string,
    cerradaEn: Date,
  ): Promise<AlertaAlmacenada> {
    const fila = await this.prisma.alerta.update({
      where: { id },
      data: {
        estado: 'CERRADA',
        motivoCierre,
        cerradaPorUsuarioId: usuarioId,
        cerradaEn,
        actualizadoPorUsuarioId: usuarioId,
      },
      select: CAMPOS_ALERTA,
    });

    return fila as AlertaAlmacenada;
  }
}

/* ========================================================================== */
/* Reglas impositivas                                                        */
/* ========================================================================== */

const CAMPOS_REGLA_IMPOSITIVA = {
  id: true,
  nombre: true,
  tasa: true,
  divisorIvaIncluido: true,
  vigenteDesde: true,
  vigenteHasta: true,
  requiereConfirmacionCliente: true,
  fuente: true,
} as const;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

export class ReglasImpositivasPrisma implements RepositorioDeReglasImpositivas {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(): Promise<ReglaImpositivaAlmacenada[]> {
    const filas = await this.prisma.reglaImpositiva.findMany({
      select: CAMPOS_REGLA_IMPOSITIVA,
      orderBy: [{ tasa: 'asc' }, { vigenteDesde: 'desc' }],
    });

    return filas as ReglaImpositivaAlmacenada[];
  }

  async buscarPorId(id: string): Promise<ReglaImpositivaAlmacenada | null> {
    const fila = await this.prisma.reglaImpositiva.findUnique({
      where: { id },
      select: CAMPOS_REGLA_IMPOSITIVA,
    });

    return fila as ReglaImpositivaAlmacenada | null;
  }

  /**
   * Cierra la vigente de la misma tasa (si hay una) y crea la nueva, en una
   * sola transacción: sin eso, una petición que fallara justo entre medio
   * podría dejar dos reglas vigentes para la misma tasa, o ninguna.
   */
  async crear(datos: AltaDeReglaImpositiva): Promise<ReglaImpositivaAlmacenada> {
    return this.prisma.$transaction(async (tx) => {
      const vigente = await tx.reglaImpositiva.findFirst({
        where: { tasa: datos.tasa as never, vigenteHasta: null },
      });

      if (vigente) {
        await tx.reglaImpositiva.update({
          where: { id: vigente.id },
          data: {
            vigenteHasta: new Date(datos.vigenteDesde.getTime() - UN_DIA_MS),
            actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
          },
        });
      }

      const fila = await tx.reglaImpositiva.create({
        data: {
          nombre: datos.nombre,
          tasa: datos.tasa as never,
          divisorIvaIncluido: datos.divisorIvaIncluido,
          vigenteDesde: datos.vigenteDesde,
          fuente: datos.fuente,
          creadoPorUsuarioId: datos.creadoPorUsuarioId,
          actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
        },
        select: CAMPOS_REGLA_IMPOSITIVA,
      });

      return fila as ReglaImpositivaAlmacenada;
    });
  }

  async actualizar(
    id: string,
    cambios: CamposEditablesDeReglaImpositiva,
    usuarioId: string,
  ): Promise<ReglaImpositivaAlmacenada> {
    const fila = await this.prisma.reglaImpositiva.update({
      where: { id },
      // Los campos llegan ya validados por Zod estricto en la ruta: solo puede
      // haber claves de la lista permitida.
      data: { ...cambios, actualizadoPorUsuarioId: usuarioId } as never,
      select: CAMPOS_REGLA_IMPOSITIVA,
    });

    return fila as ReglaImpositivaAlmacenada;
  }
}

/* ========================================================================== */
/* Reglas de notificación                                                    */
/* ========================================================================== */

const CAMPOS_REGLA_NOTIFICACION = {
  id: true,
  nombre: true,
  activa: true,
  evento: true,
  diasHabilesDePlazo: true,
  horaDeEnvio: true,
  reintentarCadaDiasHabiles: true,
  maximoRecordatorios: true,
  escalarAPartirDelRecordatorio: true,
  destinatariosIniciales: true,
  destinatariosDeEscalamiento: true,
  clientesAlcanzados: true,
  plantillaId: true,
} as const;

/**
 * Las tres columnas `Json` vuelven de Prisma tipadas como `JsonValue`. Se
 * confía en que lo que hay adentro tiene la forma que puso la ruta al validar
 * con Zod antes de escribir: este repositorio no revalida, solo transporta.
 */
function aReglaDeNotificacion(fila: {
  id: string;
  nombre: string;
  activa: boolean;
  evento: string;
  diasHabilesDePlazo: number;
  horaDeEnvio: string;
  reintentarCadaDiasHabiles: number;
  maximoRecordatorios: number;
  escalarAPartirDelRecordatorio: number;
  destinatariosIniciales: unknown;
  destinatariosDeEscalamiento: unknown;
  clientesAlcanzados: unknown;
  plantillaId: string | null;
}): ReglaDeNotificacionAlmacenada {
  return {
    ...fila,
    destinatariosIniciales: fila.destinatariosIniciales as ReglaDeNotificacionAlmacenada['destinatariosIniciales'],
    destinatariosDeEscalamiento: fila.destinatariosDeEscalamiento as ReglaDeNotificacionAlmacenada['destinatariosDeEscalamiento'],
    clientesAlcanzados: fila.clientesAlcanzados as ReglaDeNotificacionAlmacenada['clientesAlcanzados'],
  };
}

export class ReglasDeNotificacionPrisma implements RepositorioDeReglasDeNotificacion {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(): Promise<ReglaDeNotificacionAlmacenada[]> {
    const filas = await this.prisma.reglaNotificacion.findMany({
      select: CAMPOS_REGLA_NOTIFICACION,
      orderBy: { nombre: 'asc' },
    });

    return filas.map(aReglaDeNotificacion);
  }

  async buscarPorId(id: string): Promise<ReglaDeNotificacionAlmacenada | null> {
    const fila = await this.prisma.reglaNotificacion.findUnique({
      where: { id },
      select: CAMPOS_REGLA_NOTIFICACION,
    });

    return fila ? aReglaDeNotificacion(fila) : null;
  }

  async crear(datos: AltaDeReglaDeNotificacion): Promise<ReglaDeNotificacionAlmacenada> {
    const fila = await this.prisma.reglaNotificacion.create({
      data: {
        nombre: datos.nombre,
        activa: datos.activa,
        evento: datos.evento,
        diasHabilesDePlazo: datos.diasHabilesDePlazo,
        horaDeEnvio: datos.horaDeEnvio,
        reintentarCadaDiasHabiles: datos.reintentarCadaDiasHabiles,
        maximoRecordatorios: datos.maximoRecordatorios,
        escalarAPartirDelRecordatorio: datos.escalarAPartirDelRecordatorio,
        destinatariosIniciales: datos.destinatariosIniciales as never,
        destinatariosDeEscalamiento: datos.destinatariosDeEscalamiento as never,
        clientesAlcanzados: datos.clientesAlcanzados as never,
        plantillaId: datos.plantillaId,
        creadoPorUsuarioId: datos.creadoPorUsuarioId,
        actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
      },
      select: CAMPOS_REGLA_NOTIFICACION,
    });

    return aReglaDeNotificacion(fila);
  }

  async actualizar(
    id: string,
    cambios: CamposEditablesDeReglaDeNotificacion,
    usuarioId: string,
  ): Promise<ReglaDeNotificacionAlmacenada> {
    const fila = await this.prisma.reglaNotificacion.update({
      where: { id },
      // Los campos llegan ya validados por Zod estricto en la ruta: solo puede
      // haber claves de la lista permitida.
      data: { ...cambios, actualizadoPorUsuarioId: usuarioId } as never,
      select: CAMPOS_REGLA_NOTIFICACION,
    });

    return aReglaDeNotificacion(fila);
  }
}
