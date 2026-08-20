/**
 * Balances (`apps/api/src/rutas/balances.ts`).
 *
 * Regla que gobierna todo este módulo: **el sistema no aprueba balances**
 * (`docs/adr/0004-el-sistema-no-aprueba-balances.md`). Esta pantalla puede
 * mostrar el checklist y ocultar el botón de aprobar según el rol y el
 * estado, pero la decisión real vive en el servidor, en cuatro capas
 * independientes — acá no se replica ni se adelanta ninguna de ellas.
 */

import { peticion } from './cliente.js';

export type EstadoBalance =
  | 'NO_APLICA'
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'OBSERVADO'
  | 'LISTO_PARA_REVISION'
  | 'EN_REVISION'
  | 'APROBADO';

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
  /** Texto, no número: es un importe convertido en el borde de la API. */
  readonly diferencia: string | null;
}

export interface Balance {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly activo: string | null;
  readonly pasivo: string | null;
  readonly patrimonioNeto: string | null;
  readonly resultadoEjercicio: string | null;
  readonly estado: EstadoBalance;
  readonly preparadoPorUsuarioId: string | null;
  readonly aprobadoPorUsuarioId: string | null;
  readonly aprobadoEn: string | null;
  readonly inconsistencias: readonly Inconsistencia[] | null;
  readonly proximaAccion: string | null;
}

export function listarBalances(periodo?: string): Promise<{ balances: readonly Balance[] }> {
  const query = periodo ? { periodo } : {};
  return peticion('GET', '/api/v1/balances', undefined, query);
}

export function obtenerBalance(
  clienteId: string,
  periodo: string,
): Promise<{ balance: Balance }> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/balances/${periodo}`);
}

export interface CifrasDeBalance {
  readonly activo: string;
  readonly pasivo: string;
  readonly patrimonioNeto: string;
  readonly resultadoEjercicio: string;
  readonly estadoResultados: {
    readonly ingresos: string;
    readonly costos: string;
    readonly gastos: string;
    readonly resultado: string;
  };
}

export interface RevisionPrevia {
  readonly estadoSugerido: EstadoBalance;
  readonly bloqueantes: number;
  readonly advertencias: number;
  readonly inconsistencias: readonly Inconsistencia[];
}

export function guardarBalance(
  clienteId: string,
  periodo: string,
  cifras: CifrasDeBalance,
): Promise<{ balance: Balance; revision: RevisionPrevia }> {
  return peticion('PUT', `/api/v1/clientes/${clienteId}/balances/${periodo}`, cifras);
}

export function aprobarBalance(clienteId: string, periodo: string): Promise<{ balance: Balance }> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/balances/${periodo}/aprobar`);
}
