/**
 * Alertas operativas (`apps/api/src/rutas/alertas.ts`).
 *
 * La tabla la alimenta el sistema (vencimientos vencidos, conciliaciones con
 * diferencias, balances con inconsistencias) — no hay ruta de alta, ningún
 * rol tiene `crear` sobre `alerta` en la matriz de RBAC. `listar()` solo trae
 * `ABIERTA`/`EN_CURSO`: lo ya cerrado no compite por atención en el radar.
 */

import { peticion } from './cliente.js';

export type Criticidad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFORMATIVA';
export type EstadoAlerta = 'ABIERTA' | 'EN_CURSO' | 'CERRADA' | 'DESCARTADA';

export interface Alerta {
  readonly id: string;
  readonly clienteId: string | null;
  readonly periodo: string | null;
  readonly origen: string;
  readonly criticidad: Criticidad;
  readonly titulo: string;
  readonly detalle: string;
  readonly entidadRelacionada: string | null;
  readonly entidadRelacionadaId: string | null;
  readonly responsableId: string | null;
  readonly fechaLimite: string | null;
  readonly estado: EstadoAlerta;
  readonly cerradaPorUsuarioId: string | null;
  readonly cerradaEn: string | null;
  readonly motivoCierre: string | null;
}

export type ResumenPorCriticidad = Record<Criticidad, number>;

export function obtenerAlertas(): Promise<{
  resumen: ResumenPorCriticidad;
  alertas: readonly Alerta[];
}> {
  return peticion('GET', '/api/v1/alertas');
}

export interface ResumenDeEvaluacion {
  readonly creadas: number;
  readonly yaEstabanAbiertas: number;
  readonly evaluadas: number;
}

/**
 * Le pide al sistema que vuelva a mirar el estado real y levante las alertas
 * que correspondan. Se puede repetir: no reabre lo que ya está abierto.
 */
export function evaluarAlertas(periodo: string): Promise<ResumenDeEvaluacion> {
  return peticion('POST', '/api/v1/alertas/evaluar', { periodo });
}

export function cerrarAlerta(id: string, motivoCierre: string): Promise<{ alerta: Alerta }> {
  return peticion('POST', `/api/v1/alertas/${id}/cerrar`, { motivoCierre });
}
