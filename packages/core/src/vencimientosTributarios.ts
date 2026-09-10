/**
 * Cálculo de la fecha de vencimiento de una obligación tributaria.
 *
 * En Paraguay el vencimiento no es el mismo día para todos: la DNIT lo asigna
 * según la terminación del RUC del contribuyente. Dos clientes con la misma
 * obligación y el mismo período vencen en días distintos, y esa diferencia es
 * justamente lo que hace falta controlar.
 *
 * Igual que los feriados (ver `diasHabiles.ts`), **el calendario se inyecta, no
 * se calcula acá**. Qué día le toca a cada terminación es un dato que EFFORT
 * confirma contra la resolución vigente de la DNIT y que cambia por resolución,
 * no una constante enterrada en el código. Este módulo solo aplica la regla:
 * ubicar el día que corresponde y, si cae en día no hábil, correrlo.
 */

import { proximoDiaHabil, type CalendarioHabil } from './diasHabiles.js';
import { periodoSiguiente, type FechaCivil, type Periodo } from './fechas.js';

export type Periodicidad = 'MENSUAL' | 'ANUAL';

/**
 * Día de vencimiento por terminación de RUC: diez posiciones, de la 0 a la 9.
 *
 * `diasPorTerminacion[3]` es el día del mes que le toca a un RUC terminado en 3.
 */
export type DiasPorTerminacion = readonly [
  number, number, number, number, number,
  number, number, number, number, number,
];

export class ErrorDeVencimiento extends Error {
  override readonly name = 'ErrorDeVencimiento';
}

/**
 * Terminación de un RUC paraguayo.
 *
 * El RUC se escribe `80012742-0`: el número y, después del guion, el dígito
 * verificador. La terminación que usa el calendario de la DNIT es la del
 * NÚMERO, no la del verificador — `80012742-0` termina en 2, no en 0.
 *
 * Esa distinción está registrada en `docs/DISCREPANCIAS.md` a la espera de que
 * EFFORT la confirme por escrito: equivocarla corre TODOS los vencimientos de
 * un cliente al día que no es, y el sistema estaría avisando tarde justo de lo
 * que existe para no dejar pasar.
 */
export function terminacionDeRuc(ruc: string): number {
  const numero = ruc.trim().split('-')[0] ?? '';
  const ultimo = numero.slice(-1);

  if (!/^\d$/.test(ultimo)) {
    throw new ErrorDeVencimiento(
      `No se pudo leer la terminación del RUC "${ruc}": se esperaba un número antes del guion.`,
    );
  }

  return Number(ultimo);
}

/**
 * Mes en el que se presenta una obligación.
 *
 * Lo mensual se presenta al mes siguiente del período liquidado: el IVA de
 * marzo se presenta en abril. Lo anual se presenta en el mes que fije la
 * obligación, del año siguiente al ejercicio cerrado.
 */
function mesDePresentacion(
  periodo: Periodo,
  periodicidad: Periodicidad,
  mesDeCierreAnual: number | null,
): Periodo {
  if (periodicidad === 'MENSUAL') {
    return periodoSiguiente(periodo);
  }

  if (mesDeCierreAnual === null) {
    throw new ErrorDeVencimiento(
      'Una obligación anual necesita saber en qué mes se presenta.',
    );
  }

  return { anio: periodo.anio + 1, mes: mesDeCierreAnual };
}

export interface EntradaDeVencimiento {
  /** RUC del cliente, con guion y dígito verificador: `80012742-0`. */
  readonly ruc: string;
  /** Período que se liquida, no el de presentación. */
  readonly periodo: Periodo;
  readonly periodicidad: Periodicidad;
  readonly diasPorTerminacion: DiasPorTerminacion;
  /** Solo para obligaciones anuales: mes en el que se presenta. */
  readonly mesDeCierreAnual?: number | null;
  readonly calendario: CalendarioHabil;
}

/**
 * Fecha en la que vence una obligación, ya corrida al día hábil siguiente si
 * hiciera falta.
 *
 * Correr el vencimiento hacia adelante y no hacia atrás es lo que hace la
 * DNIT: cuando el día asignado cae domingo o feriado, el plazo se extiende.
 * Adelantarlo sería avisar de un vencimiento que todavía no venció, y peor,
 * dar por vencido algo que aún estaba en plazo.
 */
export function fechaDeVencimiento(entrada: EntradaDeVencimiento): FechaCivil {
  const terminacion = terminacionDeRuc(entrada.ruc);
  const diaAsignado = entrada.diasPorTerminacion[terminacion];

  if (diaAsignado === undefined || !Number.isInteger(diaAsignado) || diaAsignado < 1 || diaAsignado > 28) {
    throw new ErrorDeVencimiento(
      `El calendario no define un día válido para la terminación ${terminacion}. ` +
        'Se esperaba un día entre 1 y 28 (no se usan 29 a 31: no existen en todos los meses).',
    );
  }

  const presentacion = mesDePresentacion(
    entrada.periodo,
    entrada.periodicidad,
    entrada.mesDeCierreAnual ?? null,
  );

  return proximoDiaHabil(
    { anio: presentacion.anio, mes: presentacion.mes, dia: diaAsignado },
    entrada.calendario,
  );
}
