/**
 * Filtro de fechas único para todas las pantallas.
 *
 * Daniel, 2026-09-15: *"cada buscador de período no sea solo por mes, sino que
 * también se pueda buscar por fecha exacta o por períodos de 'últimos 15, 30, 60
 * o 90 días'"*. Hasta entonces cada pantalla tenía su propio selector de mes, y
 * ninguna otra forma de buscar.
 *
 * La decisión que ordena el módulo: **cualquier elección se convierte en un
 * rango `desde`–`hasta` de fechas civiles**, y de ahí salen los períodos
 * fiscales que toca. Así una pantalla por fecha (documentos recibidos,
 * vencimientos, alertas) y una por período fiscal (balances, liquidaciones, IVA)
 * entienden el mismo filtro sin que cada una lo reinterprete a su manera.
 *
 * Todo en fechas civiles `AAAA-MM-DD`, sin horas: un filtro por "hoy" no puede
 * depender del huso horario del navegador. El "hoy" lo da `hoyEnParaguay`.
 */

import type { FechaCivil } from './fechas.js';

export type DiasRecientes = 15 | 30 | 60 | 90;

export type FiltroDeFechas =
  /** Sin filtro: todo. Es el valor por defecto de las vistas de "qué falta". */
  | { readonly tipo: 'todo' }
  /** Un período fiscal, `AAAA-MM`. */
  | { readonly tipo: 'mes'; readonly periodo: string }
  /** Un día exacto, `AAAA-MM-DD`. */
  | { readonly tipo: 'dia'; readonly fecha: string }
  /** Desde–hasta, ambos inclusive. */
  | { readonly tipo: 'rango'; readonly desde: string; readonly hasta: string }
  /** Los últimos N días, contando hoy. */
  | { readonly tipo: 'ultimos'; readonly dias: DiasRecientes };

export interface RangoDeFechas {
  readonly desde: string;
  readonly hasta: string;
}

export const DIAS_RECIENTES: readonly DiasRecientes[] = [15, 30, 60, 90];

/** Tope de períodos que se piden de una vez: un rango de diez años no es un filtro. */
export const MAXIMO_DE_PERIODOS = 24;

const dos = (n: number) => String(n).padStart(2, '0');

function aIso(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`;
}

function desdeIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function ultimoDiaDelMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  return aIso(new Date(Date.UTC(anio, mes, 0)));
}

/**
 * El rango que cubre un filtro, o `null` si no filtra nada.
 *
 * Un rango al revés (hasta antes que desde) se da vuelta en vez de devolver
 * vacío: alguien que eligió las fechas en el orden inverso quiere ver ese
 * intervalo, no una pantalla sin datos que no explica por qué.
 */
export function rangoDelFiltro(filtro: FiltroDeFechas, hoy: FechaCivil): RangoDeFechas | null {
  switch (filtro.tipo) {
    case 'todo':
      return null;
    case 'mes':
      return { desde: `${filtro.periodo}-01`, hasta: ultimoDiaDelMes(filtro.periodo) };
    case 'dia':
      return { desde: filtro.fecha, hasta: filtro.fecha };
    case 'rango':
      return filtro.desde <= filtro.hasta
        ? { desde: filtro.desde, hasta: filtro.hasta }
        : { desde: filtro.hasta, hasta: filtro.desde };
    case 'ultimos': {
      const hasta = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia));
      const desde = new Date(hasta);
      // "Últimos 15 días" contando hoy: hoy y los 14 anteriores.
      desde.setUTCDate(desde.getUTCDate() - (filtro.dias - 1));
      return { desde: aIso(desde), hasta: aIso(hasta) };
    }
  }
}

/** Si una fecha civil (`AAAA-MM-DD`, o un ISO con hora) cae en el rango. Sin rango, siempre. */
export function dentroDelRango(fecha: string | null, rango: RangoDeFechas | null): boolean {
  if (rango === null) return true;
  if (fecha === null) return false;
  const dia = fecha.slice(0, 10);
  return dia >= rango.desde && dia <= rango.hasta;
}

/**
 * Los períodos fiscales (`AAAA-MM`) que toca un rango, del más viejo al más nuevo.
 *
 * Para las pantallas que la API sirve por período: se piden estos y se juntan.
 * Con más de `MAXIMO_DE_PERIODOS` se queda con los más recientes.
 */
export function periodosDelRango(rango: RangoDeFechas): string[] {
  const periodos: string[] = [];
  const cursor = desdeIso(`${rango.desde.slice(0, 7)}-01`);
  const fin = rango.hasta.slice(0, 7);
  while (true) {
    const periodo = `${cursor.getUTCFullYear()}-${dos(cursor.getUTCMonth() + 1)}`;
    periodos.push(periodo);
    if (periodo >= fin) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return periodos.slice(-MAXIMO_DE_PERIODOS);
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${Number(dia)}/${Number(mes)}/${anio}`;
}

/** Cómo se lee el filtro en pantalla: "septiembre de 2026", "últimos 30 días". */
export function describirFiltro(filtro: FiltroDeFechas): string {
  switch (filtro.tipo) {
    case 'todo':
      return 'todas las fechas';
    case 'mes': {
      const [anio, mes] = filtro.periodo.split('-').map(Number) as [number, number];
      return `${MESES[mes - 1]} de ${anio}`;
    }
    case 'dia':
      return `el ${fechaLegible(filtro.fecha)}`;
    case 'rango':
      return `del ${fechaLegible(filtro.desde)} al ${fechaLegible(filtro.hasta)}`;
    case 'ultimos':
      return `últimos ${filtro.dias} días`;
  }
}
