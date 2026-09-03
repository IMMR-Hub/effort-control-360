/**
 * Registro de eventos / event log (`apps/api/src/rutas/eventos.ts`).
 *
 * Solo lectura: la escritura pasa siempre por `registrarEvento` del lado del
 * servidor, nunca por acá. Acceso acotado a `direccion`/`responsable`/
 * `revisor_balance` en la matriz de RBAC — el resto de los roles no lo ve.
 */

import { peticion } from './cliente.js';

export interface Evento {
  readonly id: string;
  readonly usuarioId: string | null;
  readonly accion: string;
  readonly entidad: string;
  readonly entidadId: string | null;
  readonly clienteId: string | null;
  readonly datosAntes: unknown;
  readonly datosDespues: unknown;
  readonly ipTruncada: string | null;
  readonly agenteUsuario: string | null;
  readonly peticionId: string | null;
  /** ISO 8601 con hora. */
  readonly ocurridoEn: string;
}

export interface FiltroDeEventos {
  readonly usuarioId?: string | undefined;
  readonly entidad?: string | undefined;
  readonly entidadId?: string | undefined;
  readonly clienteId?: string | undefined;
  /** Fecha "AAAA-MM-DD"; el servidor la interpreta como inicio/fin del día. */
  readonly desde?: string | undefined;
  readonly hasta?: string | undefined;
  readonly limite?: number | undefined;
  readonly desplazamiento?: number | undefined;
}

export function listarEventos(filtro: FiltroDeEventos = {}): Promise<{ eventos: readonly Evento[] }> {
  const query: Record<string, string | number> = {
    ...(filtro.usuarioId ? { usuarioId: filtro.usuarioId } : {}),
    ...(filtro.entidad ? { entidad: filtro.entidad } : {}),
    ...(filtro.entidadId ? { entidadId: filtro.entidadId } : {}),
    ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
    ...(filtro.desde ? { desde: filtro.desde } : {}),
    ...(filtro.hasta ? { hasta: filtro.hasta } : {}),
    ...(filtro.limite !== undefined ? { limite: filtro.limite } : {}),
    ...(filtro.desplazamiento !== undefined ? { desplazamiento: filtro.desplazamiento } : {}),
  };

  return peticion('GET', '/api/v1/eventos', undefined, query);
}
