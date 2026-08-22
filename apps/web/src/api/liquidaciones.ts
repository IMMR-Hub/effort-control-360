/**
 * Liquidaciones (`apps/api/src/rutas/liquidaciones.ts`).
 *
 * Ciclo completo del entregable mensual: generada → enviada → respondida.
 * Los tres estados son distintos a propósito — importa la diferencia cuando
 * un cliente reclama que nunca le llegó nada.
 */

import { peticion } from './cliente.js';
import type { CanalRecepcion } from './tipos-compartidos.js';

export type { CanalRecepcion };

export type EstadoLiquidacion = 'PENDIENTE' | 'GENERADA' | 'ENVIADA' | 'RECLAMADA' | 'RESPONDIDA' | 'CONFIRMADA';

export interface Liquidacion {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: string;
  readonly archivoEvidenciaId: string | null;
  readonly destinatario: string | null;
  readonly canal: CanalRecepcion | null;
  /** ISO 8601 con hora, o `null`. */
  readonly fechaEnvio: string | null;
  readonly evidenciaEnvioId: string | null;
  readonly responsableId: string | null;
  readonly estado: EstadoLiquidacion;
  readonly respuestaCliente: string | null;
  readonly respondidaEn: string | null;
  readonly proximaAccion: string | null;
  readonly observaciones: string | null;
}

export function listarLiquidaciones(periodo?: string): Promise<{ liquidaciones: readonly Liquidacion[] }> {
  const query = periodo ? { periodo } : {};
  return peticion('GET', '/api/v1/liquidaciones', undefined, query);
}

export function listarLiquidacionesDeCliente(
  clienteId: string,
): Promise<{ liquidaciones: readonly Liquidacion[] }> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/liquidaciones`);
}

export interface AltaDeLiquidacion {
  readonly periodo: string;
  readonly tipo: string;
  readonly archivoEvidenciaId?: string | null;
  readonly responsableId?: string | null;
  readonly observaciones?: string | null;
}

export function crearLiquidacion(
  clienteId: string,
  datos: AltaDeLiquidacion,
): Promise<{ liquidacion: Liquidacion }> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/liquidaciones`, datos);
}

export interface DatosDeEnvio {
  readonly canal: CanalRecepcion;
  readonly destinatario: string;
  /** ISO 8601, con o sin hora — el servidor lo interpreta con `Date`. */
  readonly fechaEnvio: string;
  readonly evidenciaEnvioId?: string | null;
}

export function marcarEnviada(
  id: string,
  datos: DatosDeEnvio,
): Promise<{ liquidacion: Liquidacion }> {
  return peticion('POST', `/api/v1/liquidaciones/${id}/enviar`, datos);
}

export function registrarRespuesta(
  id: string,
  respuesta: string,
  respondidaEn: string,
): Promise<{ liquidacion: Liquidacion }> {
  return peticion('POST', `/api/v1/liquidaciones/${id}/respuesta`, { respuesta, respondidaEn });
}
