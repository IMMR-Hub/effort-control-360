/**
 * Comprobantes: identidad, duplicados y anulados.
 *
 * La identidad de un comprobante es lo que permite decir "este documento que
 * recibimos por WhatsApp es el mismo que SIGA ya tiene cargado". Sin una clave
 * estable, la conciliación con SIGA no significa nada.
 */

import { sumar, type Gs } from './dinero.js';
import type { TipoTasaIva } from './iva.js';
import type { FechaCivil } from './fechas.js';

export type TipoComprobante =
  | 'FACTURA'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'RECIBO'
  | 'RETENCION'
  | 'EXTRACTO_BANCARIO'
  | 'COMPROBANTE_PAGO'
  | 'OTRO';

export type OrigenComprobante = 'COMPRA' | 'VENTA';

export interface Comprobante {
  readonly rucEmisor: string;
  /** Número de timbrado otorgado por la DNIT. */
  readonly timbrado: string;
  /** Número del comprobante, formato 001-001-0000001. */
  readonly numero: string;
  readonly tipo: TipoComprobante;
  readonly origen: OrigenComprobante;
  readonly fecha: FechaCivil;
  readonly total: Gs;
  readonly tasa: TipoTasaIva;
  /**
   * Un comprobante anulado sigue existiendo y debe figurar en el libro
   * — su ausencia rompería la correlatividad numérica que exige la DNIT —
   * pero no suma en ningún total.
   */
  readonly anulado: boolean;
}

/**
 * Clave natural de un comprobante: RUC del emisor + timbrado + número.
 *
 * La normalización es deliberadamente conservadora: se recortan espacios y se
 * pasa a mayúsculas, nada más. No se quitan guiones ni ceros a la izquierda
 * porque "001-001-0000001" y "1-1-1" podrían ser comprobantes distintos, y
 * fusionar dos documentos reales sería un error peor que reportar un duplicado
 * de más para que una persona lo revise.
 */
export function claveNatural(comprobante: Comprobante): string {
  const normalizar = (valor: string): string => valor.trim().toUpperCase();
  return [
    normalizar(comprobante.rucEmisor),
    normalizar(comprobante.timbrado),
    normalizar(comprobante.numero),
  ].join('|');
}

export interface Duplicado {
  readonly clave: string;
  /** El comprobante que se conserva: el primero en aparecer. */
  readonly conservado: Comprobante;
  /** Los que quedan rechazados por repetir la clave natural. */
  readonly rechazados: readonly Comprobante[];
}

export interface DeteccionDuplicados {
  readonly unicos: readonly Comprobante[];
  readonly duplicados: readonly Duplicado[];
}

/**
 * Separa comprobantes únicos de repetidos.
 *
 * Conserva el primero de cada clave y rechaza los siguientes. Nunca fusiona ni
 * suma importes: dos comprobantes con la misma clave y distinto monto son un
 * problema de datos que una persona tiene que mirar, no algo que el sistema
 * pueda resolver solo.
 */
export function detectarDuplicados(comprobantes: readonly Comprobante[]): DeteccionDuplicados {
  const porClave = new Map<string, Comprobante[]>();

  for (const comprobante of comprobantes) {
    const clave = claveNatural(comprobante);
    const existentes = porClave.get(clave);
    if (existentes) {
      existentes.push(comprobante);
    } else {
      porClave.set(clave, [comprobante]);
    }
  }

  const unicos: Comprobante[] = [];
  const duplicados: Duplicado[] = [];

  for (const [clave, grupo] of porClave) {
    const [primero, ...resto] = grupo;
    if (!primero) continue;
    unicos.push(primero);
    if (resto.length > 0) {
      duplicados.push({ clave, conservado: primero, rechazados: resto });
    }
  }

  return { unicos, duplicados };
}

/** Comprobantes que suman en los totales: todos menos los anulados. */
export function comprobantesComputables(
  comprobantes: readonly Comprobante[],
): readonly Comprobante[] {
  return comprobantes.filter((comprobante) => !comprobante.anulado);
}

export interface ResumenLibro {
  /** Todas las filas del libro, anuladas incluidas. */
  readonly cantidadFilas: number;
  readonly cantidadAnuladas: number;
  readonly cantidadComputables: number;
  readonly total: Gs;
}

/**
 * Resume un libro de compras o de ventas.
 * El total excluye anulados; la cantidad de filas no, porque el libro
 * los sigue conteniendo.
 */
export function resumirLibro(comprobantes: readonly Comprobante[]): ResumenLibro {
  const computables = comprobantesComputables(comprobantes);
  const anuladas = comprobantes.length - computables.length;

  return {
    cantidadFilas: comprobantes.length,
    cantidadAnuladas: anuladas,
    cantidadComputables: computables.length,
    total: sumar(computables.map((comprobante) => comprobante.total)),
  };
}
