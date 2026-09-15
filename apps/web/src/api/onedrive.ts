/**
 * Sincronización con OneDrive (`apps/api/src/rutas/onedrive.ts`).
 *
 * El mismo proceso corre solo cada 15 minutos del lado del servidor; esta
 * llamada solo lo adelanta.
 */

import { peticion } from './cliente.js';

export interface FalloDeSincronizacion {
  readonly cliente: string;
  readonly archivo: string;
  readonly motivo: string;
}

export interface ResumenPorCliente {
  readonly cliente: string;
  readonly revisados: number;
  readonly nuevos: number;
  readonly yaEstaban: number;
}

export interface ResumenDeSincronizacion {
  readonly clientes: readonly ResumenPorCliente[];
  readonly nuevosEnTotal: number;
  readonly fallos: readonly FalloDeSincronizacion[];
  readonly quedaronPendientes: boolean;
}

export function sincronizarOneDrive(): Promise<ResumenDeSincronizacion> {
  return peticion('POST', '/api/v1/onedrive/sincronizar');
}

/**
 * Dirección web del archivo ORIGINAL de una evidencia en el OneDrive de EFFORT.
 *
 * Solo lectura: abre el archivo donde el equipo ya lo tiene, no lo descarga ni
 * lo comparte.
 */
export function obtenerEnlaceDeEvidencia(evidenciaId: string): Promise<{ url: string }> {
  return peticion('GET', `/api/v1/evidencias/${encodeURIComponent(evidenciaId)}/enlace`);
}
