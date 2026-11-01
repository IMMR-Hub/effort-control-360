/**
 * Cartera de clientes (`apps/api/src/rutas/clientes.ts`).
 */

import { peticion } from './cliente.js';
import type { CanalRecepcion } from './tipos-compartidos.js';

export type { CanalRecepcion };

export interface Cliente {
  readonly id: string;
  /** Código de EFFORT (3 cifras), el número de su carpeta. */
  readonly codigo: string | null;
  readonly nombre: string;
  /** Null = «RUC pendiente»: sin él no se calculan sus vencimientos. */
  readonly ruc: string | null;
  readonly tipoPersona: string;
  readonly regimenTributario: string | null;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly canalPreferido: string | null;
  readonly carpetaOneDriveId: string | null;
  readonly activo: boolean;
  readonly observaciones: string | null;
}

export function listarClientes(): Promise<{ clientes: readonly Cliente[] }> {
  return peticion('GET', '/api/v1/clientes');
}

export type TipoPersona = 'FISICA' | 'JURIDICA';

export interface AltaDeCliente {
  readonly codigo: string;
  readonly nombre: string;
  /** Null = se da de alta con el RUC pendiente. */
  readonly ruc: string | null;
  readonly tipoPersona: TipoPersona;
  readonly regimenTributario?: string | null;
  readonly email?: string | null;
  readonly telefono?: string | null;
  readonly canalPreferido?: CanalRecepcion | null;
  readonly observaciones?: string | null;
}

export function crearCliente(datos: AltaDeCliente): Promise<{ cliente: Cliente }> {
  return peticion('POST', '/api/v1/clientes', datos);
}

export type EdicionDeCliente = Partial<Omit<AltaDeCliente, 'ruc'>> & {
  /** Se carga o corrige; no se borra (el servidor rechaza `null`). */
  readonly ruc?: string;
  readonly carpetaOneDriveId?: string | null;
  readonly activo?: boolean;
};

export function actualizarCliente(
  id: string,
  cambios: EdicionDeCliente,
): Promise<{ cliente: Cliente }> {
  return peticion('PATCH', `/api/v1/clientes/${id}`, cambios);
}
