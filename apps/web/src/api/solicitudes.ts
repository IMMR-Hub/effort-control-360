/**
 * Solicitudes de documentación (`apps/api/src/rutas/solicitudes.ts`).
 */

import { peticion } from './cliente.js';

export interface SolicitudDocumentacion {
  readonly id: string;
  readonly clienteId: string;
  /** Texto "AAAA-MM". */
  readonly periodo: string;
  readonly estado:
    | 'ABIERTA'
    | 'RESPONDIDA_SIN_ENTREGA'
    | 'ENTREGADA'
    | 'ESCALADA'
    | 'AGOTADA'
    | 'CERRADA_MANUALMENTE';
  /** Fecha civil "AAAA-MM-DD". */
  readonly cuentaDesde: string;
  readonly recordatoriosEnviados: number;
  readonly ultimoRecordatorioEn: string | null;
  readonly reglaId: string | null;
}

export function listarSolicitudesPorPeriodo(
  periodo: string,
): Promise<{ solicitudes: readonly SolicitudDocumentacion[] }> {
  return peticion('GET', '/api/v1/solicitudes-documentacion', undefined, { periodo });
}

export function abrirSolicitud(
  clienteId: string,
  datos: { periodo: string; cuentaDesde: string; reglaId?: string | null },
): Promise<{ solicitud: SolicitudDocumentacion }> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/solicitudes-documentacion`, datos);
}

export function cerrarSolicitud(
  id: string,
  estado: 'ENTREGADA' | 'CERRADA_MANUALMENTE',
): Promise<{ solicitud: SolicitudDocumentacion }> {
  return peticion('POST', `/api/v1/solicitudes-documentacion/${id}/cerrar`, { estado });
}
