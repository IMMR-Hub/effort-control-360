/**
 * Cartera de clientes (`apps/api/src/rutas/clientes.ts`).
 */

import { peticion } from './cliente.js';

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
