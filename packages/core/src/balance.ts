/**
 * Balances y estados financieros.
 *
 * Regla que gobierna todo este módulo: el sistema NO aprueba balances.
 * Verifica consistencia, arma el checklist y deja el balance listo para que
 * una persona lo revise. La aprobación es un acto humano registrado, con
 * nombre y fecha. Ver `docs/adr/0004-el-sistema-no-aprueba-balances.md`.
 */

import { restar, sumar, valorAbsoluto, type Gs } from './dinero.js';

export type EstadoBalance =
  | 'NO_APLICA'
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'OBSERVADO'
  | 'LISTO_PARA_REVISION'
  | 'EN_REVISION'
  | 'APROBADO';

export interface CifrasBalance {
  readonly activo: Gs;
  readonly pasivo: Gs;
  readonly patrimonioNeto: Gs;
  readonly resultadoEjercicio: Gs;
}

export interface CifrasEstadoResultados {
  readonly ingresos: Gs;
  readonly costos: Gs;
  readonly gastos: Gs;
  readonly resultado: Gs;
}

export type CodigoInconsistencia =
  | 'ECUACION_PATRIMONIAL_NO_CIERRA'
  | 'RESULTADO_NO_COINCIDE_CON_ESTADO_RESULTADOS'
  | 'RESULTADO_ESTADO_RESULTADOS_MAL_SUMADO'
  | 'DOCUMENTOS_FALTANTES'
  | 'DIFERENCIAS_CON_SIGA'
  | 'LIQUIDACION_PENDIENTE_DE_ENVIO'
  | 'EXTRACTO_BANCARIO_FALTANTE'
  | 'CONCILIACION_BANCARIA_PENDIENTE';

export type GravedadInconsistencia = 'BLOQUEANTE' | 'ADVERTENCIA';

export interface Inconsistencia {
  readonly codigo: CodigoInconsistencia;
  readonly gravedad: GravedadInconsistencia;
  readonly detalle: string;
  /** Diferencia en guaraníes cuando la inconsistencia es numérica. */
  readonly diferencia?: Gs;
}

/**
 * Ecuación patrimonial: Activo = Pasivo + Patrimonio Neto.
 * Una diferencia distinta de cero es bloqueante: un balance que no cierra
 * no puede pasar a revisión.
 */
export function verificarEcuacionPatrimonial(cifras: CifrasBalance): Inconsistencia | null {
  const diferencia = restar(cifras.activo, sumar([cifras.pasivo, cifras.patrimonioNeto]));

  if (diferencia === 0n) {
    return null;
  }

  return {
    codigo: 'ECUACION_PATRIMONIAL_NO_CIERRA',
    gravedad: 'BLOQUEANTE',
    detalle:
      `Activo (${cifras.activo}) no es igual a Pasivo + Patrimonio Neto ` +
      `(${sumar([cifras.pasivo, cifras.patrimonioNeto])}).`,
    diferencia: valorAbsoluto(diferencia),
  };
}

/**
 * El resultado del ejercicio que figura en el balance tiene que ser el mismo
 * que arroja el estado de resultados del mismo período y cliente.
 */
export function verificarResultadoCruzado(
  balance: CifrasBalance,
  estadoResultados: CifrasEstadoResultados,
): Inconsistencia | null {
  const diferencia = restar(balance.resultadoEjercicio, estadoResultados.resultado);

  if (diferencia === 0n) {
    return null;
  }

  return {
    codigo: 'RESULTADO_NO_COINCIDE_CON_ESTADO_RESULTADOS',
    gravedad: 'BLOQUEANTE',
    detalle:
      `El resultado del ejercicio del balance (${balance.resultadoEjercicio}) difiere ` +
      `del estado de resultados (${estadoResultados.resultado}).`,
    diferencia: valorAbsoluto(diferencia),
  };
}

/** El resultado declarado debe ser ingresos - costos - gastos. */
export function verificarSumatoriaEstadoResultados(
  estadoResultados: CifrasEstadoResultados,
): Inconsistencia | null {
  const calculado = restar(
    estadoResultados.ingresos,
    sumar([estadoResultados.costos, estadoResultados.gastos]),
  );
  const diferencia = restar(estadoResultados.resultado, calculado);

  if (diferencia === 0n) {
    return null;
  }

  return {
    codigo: 'RESULTADO_ESTADO_RESULTADOS_MAL_SUMADO',
    gravedad: 'BLOQUEANTE',
    detalle:
      `El resultado declarado (${estadoResultados.resultado}) no coincide con ` +
      `ingresos - costos - gastos (${calculado}).`,
    diferencia: valorAbsoluto(diferencia),
  };
}

export interface ContextoOperativoBalance {
  readonly documentosFaltantes: number;
  readonly diferenciasConSiga: number;
  readonly liquidacionEnviada: boolean;
  readonly extractosBancariosRecibidos: boolean;
  readonly conciliacionBancariaRealizada: boolean;
}

export interface RevisionPreviaBalance {
  readonly inconsistencias: readonly Inconsistencia[];
  readonly bloqueantes: number;
  readonly advertencias: number;
  /**
   * Estado que le corresponde al balance según lo verificado.
   * Nunca devuelve APROBADO: ese estado solo lo produce una persona.
   */
  readonly estadoSugerido: Extract<EstadoBalance, 'OBSERVADO' | 'LISTO_PARA_REVISION'>;
}

/**
 * Arma la revisión previa de un balance.
 *
 * Devuelve todo lo que una persona debería mirar antes de aprobar, ordenado
 * por gravedad. El estado sugerido máximo es LISTO_PARA_REVISION.
 */
export function revisarBalance(
  balance: CifrasBalance,
  estadoResultados: CifrasEstadoResultados,
  contexto: ContextoOperativoBalance,
): RevisionPreviaBalance {
  const inconsistencias: Inconsistencia[] = [];

  const contables = [
    verificarEcuacionPatrimonial(balance),
    verificarSumatoriaEstadoResultados(estadoResultados),
    verificarResultadoCruzado(balance, estadoResultados),
  ];
  for (const inconsistencia of contables) {
    if (inconsistencia) inconsistencias.push(inconsistencia);
  }

  if (contexto.documentosFaltantes > 0) {
    inconsistencias.push({
      codigo: 'DOCUMENTOS_FALTANTES',
      gravedad: 'BLOQUEANTE',
      detalle: `Faltan ${contexto.documentosFaltantes} documento(s) del período.`,
    });
  }

  if (contexto.diferenciasConSiga > 0) {
    inconsistencias.push({
      codigo: 'DIFERENCIAS_CON_SIGA',
      gravedad: 'BLOQUEANTE',
      detalle: `Hay ${contexto.diferenciasConSiga} diferencia(s) sin resolver contra la exportación de SIGA.`,
    });
  }

  if (!contexto.extractosBancariosRecibidos) {
    inconsistencias.push({
      codigo: 'EXTRACTO_BANCARIO_FALTANTE',
      gravedad: 'BLOQUEANTE',
      detalle: 'No se recibieron los extractos bancarios del período.',
    });
  }

  if (!contexto.conciliacionBancariaRealizada) {
    inconsistencias.push({
      codigo: 'CONCILIACION_BANCARIA_PENDIENTE',
      gravedad: 'ADVERTENCIA',
      detalle: 'La conciliación bancaria del período todavía no se realizó.',
    });
  }

  if (!contexto.liquidacionEnviada) {
    inconsistencias.push({
      codigo: 'LIQUIDACION_PENDIENTE_DE_ENVIO',
      gravedad: 'ADVERTENCIA',
      detalle: 'La liquidación del período todavía no fue enviada al cliente.',
    });
  }

  const bloqueantes = inconsistencias.filter((i) => i.gravedad === 'BLOQUEANTE').length;

  return {
    inconsistencias,
    bloqueantes,
    advertencias: inconsistencias.length - bloqueantes,
    estadoSugerido: bloqueantes > 0 ? 'OBSERVADO' : 'LISTO_PARA_REVISION',
  };
}

export interface AprobacionBalance {
  readonly aprobadoPorUsuarioId: string;
  readonly rolDelAprobador: string;
  readonly aprobadoEn: Date;
}

export const ROLES_QUE_APRUEBAN_BALANCE = Object.freeze(['revisor_balance', 'direccion']);

export class ErrorDeAprobacion extends Error {
  override readonly name = 'ErrorDeAprobacion';
}

/**
 * Única transición posible hacia APROBADO en todo el sistema.
 *
 * Exige revisión sin bloqueantes y una persona con rol habilitado. No existe
 * ninguna ruta, job programado ni regla automática que llame a esta función
 * sin una acción humana detrás; el test `balance.test.ts` lo verifica.
 */
export function aprobarBalance(
  revision: RevisionPreviaBalance,
  aprobacion: AprobacionBalance,
): EstadoBalance {
  if (revision.bloqueantes > 0) {
    throw new ErrorDeAprobacion(
      `No se puede aprobar un balance con ${revision.bloqueantes} inconsistencia(s) bloqueante(s).`,
    );
  }

  if (!ROLES_QUE_APRUEBAN_BALANCE.includes(aprobacion.rolDelAprobador)) {
    throw new ErrorDeAprobacion(
      `El rol "${aprobacion.rolDelAprobador}" no puede aprobar balances. ` +
        `Roles habilitados: ${ROLES_QUE_APRUEBAN_BALANCE.join(', ')}.`,
    );
  }

  if (!aprobacion.aprobadoPorUsuarioId.trim()) {
    throw new ErrorDeAprobacion('La aprobación requiere identificar al usuario que aprueba.');
  }

  return 'APROBADO';
}
