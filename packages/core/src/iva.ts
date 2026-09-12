/**
 * IVA — Paraguay.
 *
 * Los comprobantes paraguayos expresan el IVA INCLUIDO en el precio.
 * Para despejar el impuesto de un total que ya lo contiene:
 *
 *   tasa 10%  ->  IVA = total / 11
 *   tasa 5%   ->  IVA = total / 21
 *   exenta    ->  IVA = 0
 *
 * (Con tasa t sobre base b: total = b*(1+t)  =>  IVA = total*t/(1+t);
 *  para t=0,10 eso es total/11 y para t=0,05 es total/21.)
 *
 * Las tasas NO están en la lógica de negocio: viven en la tabla
 * `regla_impositiva` y **se le pasan a estas funciones**. Este módulo solo sabe
 * cómo aplicar una regla, no cuáles son. Así, un cambio de tasa es un cambio de
 * dato y no un despliegue de código.
 *
 * Eso fue mentira hasta el 2026-09-12. El comentario decía exactamente esto
 * mientras `desglosarIvaIncluido` leía una constante del propio archivo: el
 * párrafo describía la intención, no el código. Ahora los divisores son un
 * parámetro obligatorio, así que no hay forma de calcular IVA sin decir con qué
 * regla se calculó — que era el punto 9 de `docs/DISCREPANCIAS.md`.
 */

import { dividirRedondeado, gs, restar, sumar, type Gs } from './dinero.js';

export type TipoTasaIva = 'DIEZ' | 'CINCO' | 'EXENTA';

/**
 * Divisores que despejan el IVA de un total que ya lo incluye, uno por tasa.
 *
 * `null` significa "esta tasa no lleva IVA", no "falta el dato".
 */
export type DivisoresIva = Readonly<Record<TipoTasaIva, bigint | null>>;

/**
 * Los divisores que EFFORT confirmó verbalmente.
 *
 * **No los uses en producción.** Están acá para los tests y como semilla de la
 * tabla `regla_impositiva`, que es de donde tiene que salir el dato cuando se
 * calcula plata de verdad: un cambio de tasa por resolución de la DNIT tiene que
 * ser un cambio de dato, no un despliegue de código.
 *
 * Hasta el 2026-09-12 esta constante ERA el cálculo: `desglosarIvaIncluido` la
 * leía directamente, mientras el comentario de arriba del archivo aseguraba que
 * las tasas "viven en la tabla `regla_impositiva` y se pasan a estas funciones".
 * No era cierto. Ahora sí: las funciones exigen que se las pasen, así que no hay
 * forma de calcular IVA sin decir con qué regla se calculó.
 *
 * Siguen pendientes de contraste documental — ver `docs/DISCREPANCIAS.md`,
 * punto 1: confirmadas de palabra, nunca comparadas contra una liquidación que
 * la DNIT ya haya recibido.
 */
export const DIVISORES_CONFIRMADOS_POR_EFFORT: DivisoresIva = Object.freeze({
  DIEZ: 11n,
  CINCO: 21n,
  EXENTA: null,
});

export interface DesgloseIva {
  /** Importe total del comprobante, IVA incluido. */
  readonly total: Gs;
  /** Impuesto contenido en el total. */
  readonly iva: Gs;
  /** Base imponible: total - iva. */
  readonly gravado: Gs;
  readonly tasa: TipoTasaIva;
}

/**
 * Despeja el IVA contenido en un total.
 *
 * `gravado` se calcula por resta y no con una segunda división. Eso garantiza
 * la identidad `gravado + iva === total` exacta para cualquier importe, y evita
 * el doble redondeo que aparecería si base e impuesto se redondearan por separado
 * (dos redondeos independientes pueden diferir del total en 1 Gs).
 */
export function desglosarIvaIncluido(
  total: Gs,
  tasa: TipoTasaIva,
  divisores: DivisoresIva,
): DesgloseIva {
  const divisor = divisores[tasa];

  if (divisor === null) {
    return { total, iva: gs(0), gravado: total, tasa };
  }

  // Un divisor que no está no es lo mismo que una tasa exenta. Calcular con un
  // divisor ausente sería inventar un impuesto, así que se corta acá.
  if (divisor === undefined) {
    throw new Error(
      `No hay regla impositiva vigente para la tasa ${tasa}. ` +
        'Cargala en `regla_impositiva` antes de calcular IVA con esta tasa.',
    );
  }

  const iva = gs(dividirRedondeado(total, divisor));
  return { total, iva, gravado: restar(total, iva), tasa };
}

export interface LineaImponible {
  readonly total: Gs;
  readonly tasa: TipoTasaIva;
}

export interface TotalesIva {
  readonly totalGeneral: Gs;
  readonly ivaDiez: Gs;
  readonly ivaCinco: Gs;
  readonly gravadoDiez: Gs;
  readonly gravadoCinco: Gs;
  readonly exentas: Gs;
  readonly ivaTotal: Gs;
}

/**
 * Totaliza un conjunto de líneas.
 *
 * El IVA se despeja línea por línea y recién después se suma. Sumar primero los
 * totales y despejar el IVA sobre la suma daría un resultado distinto (hasta
 * 1 Gs por línea de diferencia), y no coincidiría con el libro de SIGA, que
 * también calcula por comprobante.
 */
export function totalizar(
  lineas: readonly LineaImponible[],
  divisores: DivisoresIva,
): TotalesIva {
  const desgloses = lineas.map((linea) =>
    desglosarIvaIncluido(linea.total, linea.tasa, divisores),
  );
  const porTasa = (tasa: TipoTasaIva) => desgloses.filter((d) => d.tasa === tasa);

  const diez = porTasa('DIEZ');
  const cinco = porTasa('CINCO');
  const exentas = porTasa('EXENTA');

  const ivaDiez = sumar(diez.map((d) => d.iva));
  const ivaCinco = sumar(cinco.map((d) => d.iva));

  return {
    totalGeneral: sumar(desgloses.map((d) => d.total)),
    ivaDiez,
    ivaCinco,
    gravadoDiez: sumar(diez.map((d) => d.gravado)),
    gravadoCinco: sumar(cinco.map((d) => d.gravado)),
    exentas: sumar(exentas.map((d) => d.total)),
    ivaTotal: sumar([ivaDiez, ivaCinco]),
  };
}

export interface EntradaDeterminacionIva {
  /** IVA contenido en las ventas del período (débito fiscal). */
  readonly debitoFiscal: Gs;
  /** IVA contenido en las compras del período (crédito fiscal). */
  readonly creditoFiscal: Gs;
  /** Saldo a favor arrastrado del período anterior. Cero si no hay. */
  readonly saldoAFavorAnterior: Gs;
}

export interface DeterminacionIva {
  readonly debitoFiscal: Gs;
  readonly creditoFiscal: Gs;
  readonly saldoAFavorAnterior: Gs;
  /** Importe a ingresar al fisco. Cero si el período cierra a favor. */
  readonly saldoAPagar: Gs;
  /** Crédito que se arrastra al período siguiente. Cero si hay que pagar. */
  readonly saldoAFavor: Gs;
}

/**
 * Determinación del IVA del período.
 *
 * El saldo a favor del período anterior se suma al crédito: es crédito
 * arrastrado, y perderlo sería un perjuicio patrimonial para el cliente.
 * El resultado nunca es negativo en ninguno de los dos campos: se expresa
 * como "a pagar" o "a favor", nunca como un saldo con signo, para que ningún
 * consumidor de este dato pueda equivocar el sentido.
 */
export function determinarIva(entrada: EntradaDeterminacionIva): DeterminacionIva {
  const neto = entrada.debitoFiscal - entrada.creditoFiscal - entrada.saldoAFavorAnterior;

  return {
    debitoFiscal: entrada.debitoFiscal,
    creditoFiscal: entrada.creditoFiscal,
    saldoAFavorAnterior: entrada.saldoAFavorAnterior,
    saldoAPagar: gs(neto > 0n ? neto : 0n),
    saldoAFavor: gs(neto < 0n ? -neto : 0n),
  };
}
