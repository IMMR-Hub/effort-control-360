/**
 * Reglas impositivas (`apps/api/src/rutas/reglas-impositivas.ts`).
 *
 * Solo `direccion` da de alta o edita. Una tasa no se sobrescribe: dar de
 * alta una regla nueva para la misma `tasa` cierra automáticamente la
 * vigente un día antes — no hay ruta para tocar `tasa`, `divisorIvaIncluido`
 * ni `vigenteDesde` de una regla ya creada. **Importante** (ver
 * `docs/DISCREPANCIAS.md`, punto 9): esta tabla todavía no está conectada a
 * ningún cálculo de IVA real — editar una regla acá no cambia ningún número
 * del sistema hoy.
 */

import type { TasaIva } from './tipos-compartidos.js';
import { peticion } from './cliente.js';

export type { TasaIva };

export interface ReglaImpositiva {
  readonly id: string;
  readonly nombre: string;
  readonly tasa: TasaIva;
  readonly divisorIvaIncluido: number | null;
  /** Fecha civil "AAAA-MM-DD". */
  readonly vigenteDesde: string;
  readonly vigenteHasta: string | null;
  readonly requiereConfirmacionCliente: boolean;
  readonly fuente: string;
}

export function listarReglasImpositivas(): Promise<{ reglas: readonly ReglaImpositiva[] }> {
  return peticion('GET', '/api/v1/reglas-impositivas');
}

export interface AltaDeReglaImpositiva {
  readonly nombre: string;
  readonly tasa: TasaIva;
  readonly divisorIvaIncluido: number | null;
  readonly vigenteDesde: string;
  readonly fuente: string;
}

export function crearReglaImpositiva(
  datos: AltaDeReglaImpositiva,
): Promise<{ regla: ReglaImpositiva }> {
  return peticion('POST', '/api/v1/reglas-impositivas', datos);
}

export interface EdicionDeReglaImpositiva {
  readonly nombre?: string;
  readonly vigenteHasta?: string | null;
  readonly requiereConfirmacionCliente?: boolean;
  readonly fuente?: string;
}

export function actualizarReglaImpositiva(
  id: string,
  cambios: EdicionDeReglaImpositiva,
): Promise<{ regla: ReglaImpositiva }> {
  return peticion('PATCH', `/api/v1/reglas-impositivas/${id}`, cambios);
}
