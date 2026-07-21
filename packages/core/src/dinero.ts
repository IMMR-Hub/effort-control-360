/**
 * Dinero en guaraníes.
 *
 * El guaraní no tiene subunidad en circulación: todo importe operativo es un entero.
 * Por eso el dominio representa el dinero como `bigint` y nunca como `number`:
 * un `number` de JavaScript pierde precisión por encima de 2^53 y, sobre todo,
 * introduce error de coma flotante en sumas y divisiones (0.1 + 0.2 !== 0.3).
 * Con importes de cientos de millones de guaraníes eso deja de ser teórico.
 *
 * Regla de redondeo del sistema (confirmada por EFFORT):
 * a partir de 0,5 se redondea hacia arriba en magnitud ("half away from zero").
 * Se aplica en magnitud y no hacia +infinito para que -X y +X redondeen al mismo
 * valor absoluto; de lo contrario un saldo a favor y un saldo a pagar del mismo
 * importe se redondearían distinto. Ver docs/adr/0002-representacion-del-dinero.md.
 */

declare const marcaGs: unique symbol;

/** Importe en guaraníes enteros. Se construye solo con `gs()`. */
export type Gs = bigint & { readonly [marcaGs]: 'Gs' };

export class ErrorDeDinero extends Error {
  override readonly name = 'ErrorDeDinero';
}

/**
 * Construye un importe en guaraníes.
 *
 * Acepta `bigint`, `number` entero seguro, o `string` de dígitos.
 * Rechaza decimales de forma explícita: si un importe llega con decimales,
 * es un error de origen que hay que corregir en la fuente, no redondear en silencio.
 */
export function gs(valor: bigint | number | string): Gs {
  if (typeof valor === 'bigint') {
    return valor as Gs;
  }

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      throw new ErrorDeDinero(`Importe no finito: ${valor}`);
    }
    if (!Number.isInteger(valor)) {
      throw new ErrorDeDinero(
        `Importe con decimales: ${valor}. Los guaraníes son enteros; ` +
          `redondeá explícitamente con dividirRedondeado() antes de construir el importe.`,
      );
    }
    if (!Number.isSafeInteger(valor)) {
      throw new ErrorDeDinero(
        `Importe fuera del rango seguro de number: ${valor}. Pasalo como bigint o string.`,
      );
    }
    return BigInt(valor) as Gs;
  }

  const limpio = valor.trim();
  if (!/^-?\d+$/.test(limpio)) {
    throw new ErrorDeDinero(`Importe con formato inválido: "${valor}"`);
  }
  return BigInt(limpio) as Gs;
}

export const CERO: Gs = gs(0);

/**
 * División con redondeo a entero, mitad hacia arriba en magnitud.
 *
 * Es la única puerta por la que el sistema convierte una razón en un importe.
 * Toda regla impositiva (IVA incluido, prorrateos, porcentajes) pasa por acá,
 * para que exista un solo lugar donde se define el redondeo.
 */
export function dividirRedondeado(numerador: bigint, denominador: bigint): bigint {
  if (denominador === 0n) {
    throw new ErrorDeDinero('División por cero');
  }

  const esNegativo = numerador < 0n !== denominador < 0n;
  const n = numerador < 0n ? -numerador : numerador;
  const d = denominador < 0n ? -denominador : denominador;

  const cociente = n / d;
  const resto = n % d;
  // resto/d >= 1/2  <=>  resto*2 >= d
  const magnitud = resto * 2n >= d ? cociente + 1n : cociente;

  return esNegativo ? -magnitud : magnitud;
}

/** Suma una lista de importes. Lista vacía suma cero. */
export function sumar(importes: readonly Gs[]): Gs {
  let total = 0n;
  for (const importe of importes) {
    total += importe;
  }
  return total as Gs;
}

export function restar(a: Gs, b: Gs): Gs {
  return (a - b) as Gs;
}

export function sumarDos(a: Gs, b: Gs): Gs {
  return (a + b) as Gs;
}

export function negar(a: Gs): Gs {
  return -a as Gs;
}

export function esNegativo(a: Gs): boolean {
  return a < 0n;
}

export function esCero(a: Gs): boolean {
  return a === 0n;
}

export function valorAbsoluto(a: Gs): Gs {
  return (a < 0n ? -a : a) as Gs;
}

/**
 * Aplica un porcentaje expresado en puntos básicos (1% = 100 pb).
 * Se usan puntos básicos en vez de decimales para no introducir coma flotante.
 */
export function porcentaje(importe: Gs, puntosBasicos: bigint): Gs {
  return dividirRedondeado(importe * puntosBasicos, 10_000n) as Gs;
}

/**
 * Serializa un importe para transporte (JSON, API, base de datos).
 * Siempre `string`: `JSON.stringify` no sabe serializar `bigint` y un `number`
 * volvería a introducir el problema de precisión que este módulo existe para evitar.
 */
export function aTexto(importe: Gs): string {
  return importe.toString();
}

/** Formatea para mostrar al usuario: "Gs. 6.000.000". */
export function formatearGs(importe: Gs): string {
  const negativo = importe < 0n;
  const digitos = (negativo ? -importe : importe).toString();
  const conPuntos = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}Gs. ${conPuntos}`;
}
