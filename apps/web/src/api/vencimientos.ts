/**
 * Radar de vencimientos societarios, legales y tributarios
 * (`apps/api/src/rutas/vencimientos.ts`).
 *
 * `diasRestantes` y `nivelAlerta` los calcula el servidor en zona
 * `America/Asuncion` — nunca el navegador, que puede estar en cualquier huso.
 */

import { peticion } from './cliente.js';
import type { NivelRiesgo, TipoDocumento } from './tipos-compartidos.js';

export type { NivelRiesgo, TipoDocumento };

export type NivelAlerta = 'VENCIDO' | 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFORMATIVA' | 'SIN_ALERTA';
export type EstadoVencimiento = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'PRESENTADO' | 'NO_APLICA';

export interface Vencimiento {
  readonly id: string;
  readonly clienteId: string;
  readonly tipoDocumento: TipoDocumento;
  readonly descripcion: string;
  readonly entidad: string;
  /** Fecha civil "AAAA-MM-DD", o `null`. */
  readonly fechaEmision: string | null;
  readonly fechaVencimiento: string;
  readonly fechaPresentacion: string | null;
  readonly responsableId: string | null;
  readonly estado: EstadoVencimiento;
  readonly riesgo: NivelRiesgo;
  readonly evidenciaId: string | null;
  readonly proximaAccion: string | null;
  readonly diasRestantes: number;
  readonly nivelAlerta: NivelAlerta;
}

export type ResumenPorNivel = Record<NivelAlerta, number>;

export function obtenerRadar(): Promise<{
  hoy: { anio: number; mes: number; dia: number };
  resumen: ResumenPorNivel;
  vencimientos: readonly Vencimiento[];
}> {
  return peticion('GET', '/api/v1/vencimientos');
}

export function listarVencimientosDeCliente(
  clienteId: string,
): Promise<{ vencimientos: readonly Vencimiento[] }> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/vencimientos`);
}

export interface AltaDeVencimiento {
  readonly tipoDocumento: TipoDocumento;
  readonly descripcion: string;
  readonly entidad: string;
  readonly fechaEmision?: string | null;
  readonly fechaVencimiento: string;
  readonly responsableId?: string | null;
  readonly riesgo?: NivelRiesgo;
  readonly evidenciaId?: string | null;
  readonly proximaAccion?: string | null;
}

export function crearVencimiento(
  clienteId: string,
  datos: AltaDeVencimiento,
): Promise<{ vencimiento: Vencimiento }> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/vencimientos`, datos);
}

export function marcarPresentado(
  id: string,
  fechaPresentacion: string,
  evidenciaId: string | null = null,
): Promise<{ vencimiento: Vencimiento }> {
  return peticion('POST', `/api/v1/vencimientos/${id}/presentar`, { fechaPresentacion, evidenciaId });
}
