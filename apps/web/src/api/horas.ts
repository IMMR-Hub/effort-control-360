/**
 * Planilla de horas (`apps/api/src/rutas/horas.ts`, tarea 144).
 *
 * `clienteId: null` es tiempo interno, no asignado a ningún cliente.
 */

import { peticion } from './cliente.js';

export interface RegistroDeHoras {
  readonly id: string;
  readonly usuarioId: string;
  readonly clienteId: string | null;
  /** `AAAA-MM-DDT00:00:00.000Z`: la columna es una fecha, sin hora. */
  readonly fecha: string;
  readonly minutos: number;
  readonly tarea: string | null;
}

export interface AltaDeHoras {
  readonly clienteId: string | null;
  /** `AAAA-MM-DD`. */
  readonly fecha: string;
  readonly minutos: number;
  readonly tarea: string | null;
}

/** Carga o corrige las horas de un día. Cargar de nuevo el mismo día y cliente reemplaza el valor. */
export function registrarHoras(datos: AltaDeHoras): Promise<{ registro: RegistroDeHoras }> {
  return peticion('POST', '/api/v1/horas', datos);
}

/** Solo los propios registros del usuario que consulta — no hay forma de pedir los de otra persona. */
export function listarMisHoras(desde: string, hasta: string): Promise<{ registros: readonly RegistroDeHoras[] }> {
  return peticion('GET', `/api/v1/horas?desde=${desde}&hasta=${hasta}`);
}

export interface TotalDeHoras {
  readonly usuarioId: string;
  readonly clienteId: string | null;
  readonly minutos: number;
}

/** Solo dirección. Totales agregados por colaborador y cliente, nunca el día a día de nadie. */
export function obtenerResumenDeHoras(
  desde: string,
  hasta: string,
): Promise<{ totales: readonly TotalDeHoras[] }> {
  return peticion('GET', `/api/v1/horas/resumen?desde=${desde}&hasta=${hasta}`);
}
