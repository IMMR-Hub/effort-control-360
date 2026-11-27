/**
 * Bandeja de «Pendientes»: orden y «vencido».
 *
 * La bandeja mezcla pedidos del equipo y pedidos de clientes, y Laura y Lili la
 * abren para saber qué atender primero. Por eso el orden vive acá, en una
 * función pura con test, y no repartido entre la consulta y la pantalla: si
 * cada lado ordenara a su manera, la lista y los contadores se contradirían.
 *
 * `recordarEl` es solo una marca visual (REGLA 0-bis): nada de lo que se calcula
 * acá dispara un envío.
 */

import { fechaCivilAIso, hoyEnParaguay } from './fechas.js';

export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface ItemPendiente {
  readonly tipo: 'EQUIPO' | 'CLIENTE';
  readonly id: string;
  readonly prioridad: Prioridad;
  /** Fecha civil 'AAAA-MM-DD' en Paraguay, o null si no hay recordatorio. */
  readonly recordarEl: string | null;
  /** Instante de creación, ISO con hora. */
  readonly creadoEn: string;
}

/** Menor número = se atiende antes. */
const RANGO_DE_PRIORIDAD: Readonly<Record<Prioridad, number>> = Object.freeze({
  CRITICA: 0,
  ALTA: 1,
  MEDIA: 2,
  BAJA: 3,
});

/**
 * Un recordatorio está vencido si su fecha es hoy o anterior, con «hoy» medido
 * en Paraguay. Se compara como texto 'AAAA-MM-DD', que ordena igual que las
 * fechas: a las 22:00 de Asunción ya es el día siguiente en UTC, y comparar
 * contra la fecha UTC marcaría como vencido un recordatorio de mañana.
 */
export function recordatorioVencido(recordarEl: string | null, ahora: Date): boolean {
  if (recordarEl === null) return false;
  return recordarEl <= fechaCivilAIso(hoyEnParaguay(ahora));
}

/**
 * Orden de la bandeja: prioridad (crítica primero); a igual prioridad, el
 * recordatorio vencido primero; a igual todo, el más antiguo primero.
 * Devuelve una copia: no muta la lista recibida.
 */
export function ordenarPendientes<T extends ItemPendiente>(
  items: readonly T[],
  ahora: Date,
): T[] {
  const hoy = fechaCivilAIso(hoyEnParaguay(ahora));
  const vencido = (i: ItemPendiente): number =>
    i.recordarEl !== null && i.recordarEl <= hoy ? 0 : 1;

  return [...items].sort((a, b) => {
    const porPrioridad = RANGO_DE_PRIORIDAD[a.prioridad] - RANGO_DE_PRIORIDAD[b.prioridad];
    if (porPrioridad !== 0) return porPrioridad;
    const porVencimiento = vencido(a) - vencido(b);
    if (porVencimiento !== 0) return porVencimiento;
    return Date.parse(a.creadoEn) - Date.parse(b.creadoEn);
  });
}

/** Contadores de la cabecera de la bandeja. */
export function resumirPendientes(
  items: readonly ItemPendiente[],
  ahora: Date,
): { readonly total: number; readonly criticos: number; readonly vencidos: number } {
  return {
    total: items.length,
    criticos: items.filter((i) => i.prioridad === 'CRITICA').length,
    vencidos: items.filter((i) => recordatorioVencido(i.recordarEl, ahora)).length,
  };
}
