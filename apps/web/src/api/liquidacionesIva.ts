/**
 * IVA crédito y débito desde las planillas RG 90
 * (`apps/api/src/rutas/liquidaciones-iva.ts`).
 *
 * Los importes viajan como texto y no como número, igual que en el resto del
 * sistema: son guaraníes enteros en `bigint`, y `JSON.parse` los convertiría a
 * `number`, que pierde precisión arriba de nueve mil billones. No es un riesgo
 * teórico para una constructora que factura en guaraníes.
 *
 * No hay función para guardar un saldo a mano, y no falta: el único camino es
 * calcularlo desde los libros. Un número escrito a mano no se puede explicar.
 */

import { peticion } from './cliente.js';

export interface LiquidacionIva {
  readonly periodo: string;
  /** IVA de las compras: lo que el cliente puede descontar. */
  readonly creditoFiscal: string;
  /** IVA de las ventas: lo que le debe al fisco. */
  readonly debitoFiscal: string;
  readonly saldoAPagar: string;
  readonly saldoAFavor: string;
  readonly comprobantesCompras: number;
  readonly comprobantesVentas: number;
  readonly archivosLeidos: number;
  readonly filasRechazadas: number;
  readonly calculadoEn: string;
}

export type RiesgoDeHallazgo =
  | 'CREDITO_DE_MAS'
  | 'DEBITO_DE_MENOS'
  | 'EN_CONTRA_DEL_CLIENTE'
  | 'INCONSISTENCIA';

export interface HallazgoDeLibro {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: string;
  readonly riesgo: RiesgoDeHallazgo;
  readonly tipoRegistro: string;
  readonly numeroComprobante: string;
  readonly contraparte: string;
  readonly tasa: string | null;
  readonly diferencia: string;
  readonly detalle: string;
}

export interface ResumenDeHallazgos {
  readonly total: number;
  readonly conRiesgoDeMulta: number;
  readonly ivaEnRiesgo: string;
}

export interface ResumenDeCalculo {
  readonly periodosCalculados: number;
  readonly archivosLeidos: number;
  readonly filasInterpretadas: number;
  readonly filasRechazadas: number;
  readonly hallazgosNuevos: number;
  readonly fallos: readonly { readonly cliente: string; readonly archivo: string; readonly motivo: string }[];
}

export function listarLiquidacionesIva(
  clienteId: string,
): Promise<{ liquidaciones: readonly LiquidacionIva[] }> {
  return peticion('GET', `/api/v1/liquidaciones-iva?clienteId=${encodeURIComponent(clienteId)}`);
}

export function listarHallazgos(
  clienteId: string | null,
  soloRiesgo: boolean,
): Promise<{ hallazgos: readonly HallazgoDeLibro[]; resumen: ResumenDeHallazgos }> {
  const partes: string[] = [];
  if (clienteId) partes.push(`clienteId=${encodeURIComponent(clienteId)}`);
  if (soloRiesgo) partes.push('soloRiesgo=true');
  const consulta = partes.length > 0 ? `?${partes.join('&')}` : '';
  return peticion('GET', `/api/v1/liquidaciones-iva/hallazgos${consulta}`);
}

export function calcularIva(): Promise<ResumenDeCalculo> {
  return peticion('POST', '/api/v1/liquidaciones-iva/calcular');
}
