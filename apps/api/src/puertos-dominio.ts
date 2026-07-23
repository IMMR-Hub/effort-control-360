/**
 * Puertos de los módulos de negocio.
 *
 * Separados de `puertos.ts` (que tiene los de autenticación y acceso) porque
 * cambian por motivos distintos: los de seguridad son estables, estos crecen
 * con cada módulo del handoff.
 *
 * Todo método que lee datos de clientes recibe el filtro de cartera, y no es
 * opcional. Un parámetro opcional se termina omitiendo, y omitirlo acá expone
 * la cartera completa.
 */

export type FiltroDeCartera = readonly string[] | null;

/* ========================================================================== */
/* Documentos                                                                 */
/* ========================================================================== */

export interface DocumentoAlmacenado {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: string;
  readonly canalRecepcion: string;
  readonly recibidoEn: Date;
  readonly rucEmisor: string | null;
  readonly timbrado: string | null;
  readonly numeroComprobante: string | null;
  readonly total: bigint | null;
  readonly tasa: string | null;
  readonly anulado: boolean;
  readonly estado: string;
  readonly motivoRechazo: string | null;
  readonly evidenciaId: string | null;
  readonly observaciones: string | null;
}

export interface AltaDeDocumento {
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: string;
  readonly canalRecepcion: string;
  readonly recibidoEn: Date;
  readonly rucEmisor: string | null;
  readonly timbrado: string | null;
  readonly numeroComprobante: string | null;
  readonly total: bigint | null;
  readonly tasa: string | null;
  readonly anulado: boolean;
  readonly evidenciaId: string | null;
  readonly observaciones: string | null;
  readonly creadoPorUsuarioId: string;
}

export interface RepositorioDeDocumentos {
  listar(
    clienteId: string,
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<DocumentoAlmacenado[]>;
  buscarPorId(id: string, filtro: FiltroDeCartera): Promise<DocumentoAlmacenado | null>;
  registrar(datos: AltaDeDocumento): Promise<DocumentoAlmacenado>;
  cambiarEstado(
    id: string,
    estado: string,
    motivoRechazo: string | null,
    usuarioId: string,
  ): Promise<DocumentoAlmacenado>;
  /**
   * Documentos del período que entran en la conciliación contra SIGA.
   *
   * Devuelve TODOS los vigentes, tengan o no la terna de identificación:
   * los que no la tienen no se pueden comparar, pero hay que saber cuántos
   * son. Si se filtraran acá, la conciliación informaría "todo cuadra" sobre
   * un conjunto incompleto sin decir que dejó documentos afuera.
   */
  documentosDelPeriodo(clienteId: string, periodo: string): Promise<DocumentoAlmacenado[]>;
}

/* ========================================================================== */
/* Proceso mensual                                                            */
/* ========================================================================== */

export interface ProcesoMensualAlmacenado {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly comprobantesRetirados: boolean;
  readonly fechaRetiro: Date | null;
  readonly documentosRecibidos: number;
  readonly documentosFaltantes: number;
  readonly documentosObservados: number;
  readonly comprasCargadasSiga: boolean;
  readonly ventasCargadasSiga: boolean;
  readonly retencionesCargadas: boolean;
  readonly extractosRecibidos: boolean;
  readonly conciliacionBancariaRealizada: boolean;
  readonly ivaRevisado: boolean;
  readonly ivaSaldoAPagar: bigint | null;
  readonly ivaSaldoAFavor: bigint | null;
  readonly liquidacionGenerada: boolean;
  readonly liquidacionEnviada: boolean;
  readonly balanceAplica: boolean;
  readonly estadoGeneral: string;
  readonly riesgo: string;
  readonly proximaAccion: string | null;
  readonly fechaLimiteInterna: Date | null;
  readonly observaciones: string | null;
}

type ProcesoEditable = Omit<ProcesoMensualAlmacenado, 'id' | 'clienteId' | 'periodo'>;

/**
 * Campos que se pueden modificar de un proceso mensual.
 *
 * Con `exactOptionalPropertyTypes` activo, `Partial<T>` no admite pasar
 * `undefined` explícito, y las rutas construyen el objeto de cambios con
 * propiedades condicionales que pueden serlo. Por eso se declara el `undefined`
 * de forma explícita en vez de usar `Partial`.
 *
 * `clienteId` y `periodo` quedan fuera: identifican la fila, no son datos que
 * se editen. Moverlos convertiría un mes de un cliente en el mes de otro.
 */
export type CamposEditablesDelProceso = {
  [K in keyof ProcesoEditable]?: ProcesoEditable[K] | undefined;
};

export interface RepositorioDeProcesoMensual {
  listar(periodo: string, filtro: FiltroDeCartera): Promise<ProcesoMensualAlmacenado[]>;
  buscar(
    clienteId: string,
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<ProcesoMensualAlmacenado | null>;
  /**
   * Crea la fila del período si no existe, o devuelve la que ya está.
   * El proceso mensual es una fila por cliente y período: la base tiene la
   * unicidad, así que dos peticiones simultáneas no pueden duplicarla.
   */
  asegurar(
    clienteId: string,
    periodo: string,
    usuarioId: string,
  ): Promise<ProcesoMensualAlmacenado>;
  actualizar(
    clienteId: string,
    periodo: string,
    cambios: CamposEditablesDelProceso,
    usuarioId: string,
  ): Promise<ProcesoMensualAlmacenado>;
}

/* ========================================================================== */
/* Vencimientos                                                               */
/* ========================================================================== */

export interface VencimientoAlmacenado {
  readonly id: string;
  readonly clienteId: string;
  readonly tipoDocumento: string;
  readonly descripcion: string;
  readonly entidad: string;
  readonly fechaEmision: Date | null;
  readonly fechaVencimiento: Date;
  readonly fechaPresentacion: Date | null;
  readonly responsableId: string | null;
  readonly estado: string;
  readonly riesgo: string;
  readonly evidenciaId: string | null;
  readonly proximaAccion: string | null;
}

export interface AltaDeVencimiento {
  readonly clienteId: string;
  readonly tipoDocumento: string;
  readonly descripcion: string;
  readonly entidad: string;
  readonly fechaEmision: Date | null;
  readonly fechaVencimiento: Date;
  readonly responsableId: string | null;
  readonly riesgo: string;
  readonly evidenciaId: string | null;
  readonly proximaAccion: string | null;
  readonly creadoPorUsuarioId: string;
}

export interface RepositorioDeVencimientos {
  /** Todos los de la cartera, ordenados por fecha: es el radar. */
  listar(filtro: FiltroDeCartera): Promise<VencimientoAlmacenado[]>;
  listarPorCliente(clienteId: string, filtro: FiltroDeCartera): Promise<VencimientoAlmacenado[]>;
  buscarPorId(id: string, filtro: FiltroDeCartera): Promise<VencimientoAlmacenado | null>;
  registrar(datos: AltaDeVencimiento): Promise<VencimientoAlmacenado>;
  marcarPresentado(
    id: string,
    fechaPresentacion: Date,
    evidenciaId: string | null,
    usuarioId: string,
  ): Promise<VencimientoAlmacenado>;
}

/* ========================================================================== */
/* Balances                                                                   */
/* ========================================================================== */

export interface BalanceAlmacenado {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly activo: bigint | null;
  readonly pasivo: bigint | null;
  readonly patrimonioNeto: bigint | null;
  readonly resultadoEjercicio: bigint | null;
  readonly estado: string;
  readonly preparadoPorUsuarioId: string | null;
  readonly aprobadoPorUsuarioId: string | null;
  readonly aprobadoEn: Date | null;
  readonly inconsistencias: unknown;
  readonly proximaAccion: string | null;
}

export interface CifrasDeBalance {
  readonly activo: bigint;
  readonly pasivo: bigint;
  readonly patrimonioNeto: bigint;
  readonly resultadoEjercicio: bigint;
}

export interface RepositorioDeBalances {
  listar(periodo: string | null, filtro: FiltroDeCartera): Promise<BalanceAlmacenado[]>;
  buscar(
    clienteId: string,
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<BalanceAlmacenado | null>;
  guardarCifras(
    clienteId: string,
    periodo: string,
    cifras: CifrasDeBalance,
    estado: string,
    inconsistencias: unknown,
    usuarioId: string,
  ): Promise<BalanceAlmacenado>;
  /**
   * Única forma de llegar a APROBADO en todo el sistema.
   *
   * Recibe el usuario y el momento porque quedan grabados en la fila: la
   * aprobación de un balance es un acto con responsabilidad profesional y
   * tiene que tener nombre y fecha. Ver ADR 0004.
   */
  aprobar(
    clienteId: string,
    periodo: string,
    aprobadoPorUsuarioId: string,
    aprobadoEn: Date,
  ): Promise<BalanceAlmacenado>;
}

/* ========================================================================== */
/* Exportaciones de SIGA                                                      */
/* ========================================================================== */

export interface ComprobanteSigaAlmacenado {
  readonly id: string;
  readonly exportacionId: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly rucEmisor: string;
  readonly timbrado: string;
  readonly numeroComprobante: string;
  readonly total: bigint;
  readonly tasa: string;
  readonly anulado: boolean;
  readonly fecha: Date;
}

export interface ExportacionSigaAlmacenada {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipoReporte: string;
  readonly formato: string;
  readonly evidenciaId: string | null;
  readonly importadaEn: Date;
  readonly filasLeidas: number;
  readonly estadoRevision: string;
  readonly proximaAccion: string | null;
  readonly observaciones: string | null;
}

/** Fila de comprobante tal como llega desde el archivo exportado por SIGA. */
export interface FilaSigaEntrante {
  readonly rucEmisor: string;
  readonly timbrado: string;
  readonly numeroComprobante: string;
  readonly total: bigint;
  readonly tasa: string;
  readonly anulado: boolean;
  readonly fecha: Date;
}

export interface AltaDeExportacionSiga {
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipoReporte: string;
  readonly formato: string;
  readonly evidenciaId: string | null;
  readonly observaciones: string | null;
  readonly comprobantes: readonly FilaSigaEntrante[];
  readonly creadoPorUsuarioId: string;
}

export interface RepositorioDeExportacionesSiga {
  listar(
    clienteId: string,
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<ExportacionSigaAlmacenada[]>;
  buscarPorId(id: string, filtro: FiltroDeCartera): Promise<ExportacionSigaAlmacenada | null>;
  /**
   * Registra la exportación junto con sus filas, en una sola transacción.
   *
   * Si las filas fallaran a mitad de camino, quedaría una exportación que dice
   * tener N comprobantes con solo algunos cargados, y la conciliación
   * reportaría diferencias que no existen.
   */
  registrar(datos: AltaDeExportacionSiga): Promise<ExportacionSigaAlmacenada>;
  comprobantesDelPeriodo(clienteId: string, periodo: string): Promise<ComprobanteSigaAlmacenado[]>;
  actualizarEstadoRevision(
    id: string,
    estado: string,
    proximaAccion: string | null,
    usuarioId: string,
  ): Promise<ExportacionSigaAlmacenada>;
}

/* ========================================================================== */
/* Liquidaciones                                                              */
/* ========================================================================== */

export interface LiquidacionAlmacenada {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: string;
  readonly archivoEvidenciaId: string | null;
  readonly destinatario: string | null;
  readonly canal: string | null;
  readonly fechaEnvio: Date | null;
  readonly evidenciaEnvioId: string | null;
  readonly responsableId: string | null;
  readonly estado: string;
  readonly respuestaCliente: string | null;
  readonly respondidaEn: Date | null;
  readonly proximaAccion: string | null;
  readonly observaciones: string | null;
}

export interface AltaDeLiquidacion {
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: string;
  readonly archivoEvidenciaId: string | null;
  readonly responsableId: string | null;
  readonly observaciones: string | null;
  readonly creadoPorUsuarioId: string;
}

export interface DatosDeEnvio {
  readonly destinatario: string;
  readonly canal: string;
  readonly fechaEnvio: Date;
  readonly evidenciaEnvioId: string | null;
}

export interface RepositorioDeLiquidaciones {
  listar(periodo: string | null, filtro: FiltroDeCartera): Promise<LiquidacionAlmacenada[]>;
  listarPorCliente(
    clienteId: string,
    filtro: FiltroDeCartera,
  ): Promise<LiquidacionAlmacenada[]>;
  buscarPorId(id: string, filtro: FiltroDeCartera): Promise<LiquidacionAlmacenada | null>;
  registrar(datos: AltaDeLiquidacion): Promise<LiquidacionAlmacenada>;
  marcarEnviada(id: string, envio: DatosDeEnvio, usuarioId: string): Promise<LiquidacionAlmacenada>;
  registrarRespuesta(
    id: string,
    respuesta: string,
    respondidaEn: Date,
    usuarioId: string,
  ): Promise<LiquidacionAlmacenada>;
}

/* ========================================================================== */
/* Alertas                                                                   */
/* ========================================================================== */

export interface AlertaAlmacenada {
  readonly id: string;
  readonly clienteId: string | null;
  readonly periodo: string | null;
  readonly origen: string;
  readonly criticidad: string;
  readonly titulo: string;
  readonly detalle: string;
  readonly entidadRelacionada: string | null;
  readonly entidadRelacionadaId: string | null;
  readonly responsableId: string | null;
  readonly fechaLimite: Date | null;
  readonly estado: string;
  readonly cerradaPorUsuarioId: string | null;
  readonly cerradaEn: Date | null;
  readonly motivoCierre: string | null;
}

export interface RepositorioDeAlertas {
  /**
   * Vista consolidada de la cartera, ordenada por criticidad y luego por
   * antigüedad. Solo trae `ABIERTA` y `EN_CURSO`: lo que ya se cerró o se
   * descartó no compite por atención en el radar del día a día.
   */
  listar(filtro: FiltroDeCartera): Promise<AlertaAlmacenada[]>;
  buscarPorId(id: string, filtro: FiltroDeCartera): Promise<AlertaAlmacenada | null>;
  /**
   * Única forma de llegar a `CERRADA`. Exige motivo, usuario y momento: una
   * alerta cerrada sin explicación no se distingue de una que se ignoró.
   */
  cerrar(
    id: string,
    motivoCierre: string,
    usuarioId: string,
    cerradaEn: Date,
  ): Promise<AlertaAlmacenada>;
}
