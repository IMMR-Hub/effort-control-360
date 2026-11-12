/**
 * Qué le falta a cada cliente activo para que el sistema lo controle entero.
 *
 * Daniel, 2026-11-12: «Si hay clientes dentro de la lista que no están
 * completos, deben aparecer como incompletos y mencionar lo que le falta». Sale
 * solo de datos del sistema, sin suponer nada:
 *
 * - **RUC**: sin él no se calcula ninguna fecha (depende de la terminación).
 * - **Responsable**: ningún colaborador con cuenta lo tiene en su cartera; lo
 *   ve solo dirección.
 * - **Regla de vencimiento**: tiene asignada una obligación que la planilla de
 *   EFFORT marca (IRP, IRE SIMPLE, IDU…) pero cuyo calendario todavía no está
 *   confirmado en el catálogo (`confirmadaPorEffort = false`): el generador la
 *   ignora, así que esas fechas no aparecen en ningún lado.
 *
 * Un cliente sin ninguna obligación no se marca: puede estar en suspensión, sin
 * movimiento o ser solo de IPS, y eso no es un dato que falte.
 */

import type { ObligacionAlmacenada, ObligacionDeClienteAlmacenada } from '../puertos-dominio.js';

export interface EntradaDeFaltantes {
  readonly clientes: readonly { readonly id: string; readonly ruc: string | null; readonly activo: boolean }[];
  readonly obligaciones: readonly ObligacionAlmacenada[];
  readonly asignaciones: readonly ObligacionDeClienteAlmacenada[];
  /** Clientes que algún colaborador (no dirección) tiene en su cartera. */
  readonly conResponsable: ReadonlySet<string>;
  readonly ahora: Date;
}

export function faltantesDeClientes(entrada: EntradaDeFaltantes): Record<string, string[]> {
  const porId = new Map(entrada.obligaciones.map((o) => [o.id, o]));
  const sinReglaPorCliente = new Map<string, Set<string>>();
  for (const a of entrada.asignaciones) {
    if (a.hasta !== null && a.hasta.getTime() <= entrada.ahora.getTime()) continue;
    const obligacion = porId.get(a.obligacionId);
    if (!obligacion || !obligacion.activa || obligacion.confirmadaPorEffort) continue;
    const conjunto = sinReglaPorCliente.get(a.clienteId) ?? new Set<string>();
    conjunto.add(obligacion.nombre);
    sinReglaPorCliente.set(a.clienteId, conjunto);
  }

  const resultado: Record<string, string[]> = {};
  for (const cliente of entrada.clientes) {
    if (!cliente.activo) continue;
    const falta: string[] = [];
    if (!cliente.ruc) falta.push('RUC');
    if (!entrada.conResponsable.has(cliente.id)) falta.push('responsable con cuenta en el sistema');
    const sinRegla = [...(sinReglaPorCliente.get(cliente.id) ?? [])].sort((a, b) => a.localeCompare(b, 'es'));
    if (sinRegla.length > 0) falta.push(`regla de vencimiento de ${sinRegla.join(', ')}`);
    if (falta.length > 0) resultado[cliente.id] = falta;
  }
  return resultado;
}
