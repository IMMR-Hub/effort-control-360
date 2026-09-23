/**
 * "Actualizar ahora" (`apps/api/src/rutas/actualizar-ahora.ts`, tarea 152-bis).
 *
 * Sincroniza OneDrive, recalcula IVA, detecta presentaciones y evalúa
 * alertas, todo junto — lo mismo que corre solo cada hora, adelantado con un
 * botón. Pensado para la pantalla Faltantes: subir un comprobante y verlo
 * desaparecer de la lista sin esperar.
 */

import { peticion } from './cliente.js';

export interface ResumenDeActualizacion {
  readonly archivosNuevos: number;
  readonly archivosConFallo: number;
  readonly ivaPeriodosCalculados: number;
  readonly ivaHallazgosNuevos: number;
  readonly ivaOcupado: boolean;
  readonly presentacionesMarcadas: number;
  readonly presentadasFueraDeTermino: number;
  readonly alertasCreadas: number;
  readonly alertasActualizadas: number;
  readonly alertasResueltas: number;
}

export function actualizarAhora(): Promise<ResumenDeActualizacion> {
  return peticion('POST', '/api/v1/actualizar-ahora');
}
