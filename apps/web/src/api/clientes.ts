/**
 * Cartera de clientes (`apps/api/src/rutas/clientes.ts`).
 */

import { peticion } from './cliente.js';
import type { CanalRecepcion } from './tipos-compartidos.js';

export type { CanalRecepcion };

export interface Cliente {
  readonly id: string;
  readonly nombre: string;
  readonly ruc: string;
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
  readonly nombre: string;
  readonly ruc: string;
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

export type EdicionDeCliente = Partial<AltaDeCliente> & {
  readonly carpetaOneDriveId?: string | null;
  readonly activo?: boolean;
};

export function actualizarCliente(
  id: string,
  cambios: EdicionDeCliente,
): Promise<{ cliente: Cliente }> {
  return peticion('PATCH', `/api/v1/clientes/${id}`, cambios);
}
