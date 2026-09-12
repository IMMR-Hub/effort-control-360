/**
 * Importador del libro de compras y ventas (planilla RG 90).
 *
 * Es el archivo que EFFORT presenta todos los meses ante la DNIT, y el único
 * lugar del sistema donde hay importes de verdad: hasta acá, los 1574
 * documentos importados desde OneDrive tenían el archivo pero ningún número.
 * Sin esto no se puede decir cuánto IVA crédito y débito tiene un cliente, que
 * es lo que Daniel pidió el 2026-09-12.
 *
 * **El layout NO está supuesto.** A diferencia del importador de comprobantes
 * —cuyo formato se asumió y sigue sin confirmar, ver `docs/DISCREPANCIAS.md`
 * punto 10— las 28 columnas de acá salieron de abrir planillas reales de
 * FUMIPRO ya presentadas. Los nombres de encabezado están transcriptos textual,
 * con la acentuación irregular que traen los archivos ("Fecha de Emisión" con
 * tilde, "Condicion de la Operacion" sin ninguna): `normalizarEncabezado` saca
 * los acentos, así que la irregularidad no importa, pero conviene saber que no
 * es un descuido nuestro.
 *
 * ---
 *
 * **La decisión que define este módulo: el IVA se LEE, no se calcula.**
 *
 * Contrastando 1188 filas reales contra nuestro propio cálculo (total / 11 y
 * total / 21), 1165 coincidían al guaraní y 41 diferían — todas por ±1 Gs. Y el
 * patrón de esas 41 no responde a ninguna regla de redondeo:
 *
 *   - `101700 / 11 = 9245,45` y la planilla dice **9246** (redondea para arriba
 *     desde 0,45).
 *   - `960000 / 11 = 87272,72` y la planilla dice **87272** (trunca).
 *   - `229625 / 11 = 20875` exacto, y la planilla dice **20876**.
 *
 * El último caso es el que cierra la discusión: ningún redondeo se aleja de un
 * resultado exacto. Esas cifras no se calculan a partir del total — se copian
 * de lo que imprimió el proveedor en la factura, y cada proveedor redondea como
 * quiere. La DNIT acepta la cifra del comprobante.
 *
 * Por eso este importador toma el IVA de la planilla. Recalcularlo daría un
 * número distinto del que EFFORT ya presentó, y el sistema estaría
 * contradiciendo una declaración jurada por un guaraní. El divisor propio sigue
 * existiendo y sigue siendo correcto (`packages/core/src/iva.ts`), pero es para
 * cuando hay que DEDUCIR un IVA que nadie declaró, no para pisar uno declarado.
 */

import { gs, sumar, type Gs } from '@effort/core';

import { ErrorDeImportacion, leerFilas, textoDeCelda, type FilaCruda } from './archivo.js';

export type TipoDeRegistro = 'COMPRAS' | 'VENTAS';

type Campo =
  | 'rucInformante'
  | 'rucInformado'
  | 'razonSocialInformado'
  | 'tipoRegistro'
  | 'tipoComprobante'
  | 'fechaEmision'
  | 'periodoEmision'
  | 'timbrado'
  | 'numeroComprobante'
  | 'gravado10'
  | 'iva10'
  | 'gravado5'
  | 'iva5'
  | 'exento'
  | 'total'
  | 'imputaIva';

/**
 * Encabezados reales, ya normalizados (sin acentos, en mayúsculas).
 *
 * Solo se mapean las columnas que se usan. Las otras doce de la planilla (CDC,
 * comprobante asociado, origen de la información, etc.) se ignoran a propósito:
 * mapear una columna que no se usa es prometer que se la interpreta.
 */
const ENCABEZADOS: Readonly<Record<string, Campo>> = {
  'RUC DEL INFORMANTE': 'rucInformante',
  'RUC / N DE IDENTIFICACION DEL INFORMADO': 'rucInformado',
  'NOMBRE O RAZON SOCIAL DEL INFORMADO': 'razonSocialInformado',
  'TIPO DE REGISTRO': 'tipoRegistro',
  'TIPO DE COMPROBANTE': 'tipoComprobante',
  'FECHA DE EMISION': 'fechaEmision',
  // Las planillas de COMPRAS dicen "Periodo de Emisión" y las de VENTAS
  // simplemente "Periodo". Es el mismo dato con dos nombres, y sin este alias
  // las 157 filas de cada planilla de ventas se rechazaban enteras.
  'PERIODO DE EMISION': 'periodoEmision',
  PERIODO: 'periodoEmision',
  'TIMBRADO DEL COMPROBANTE': 'timbrado',
  'NUMERO DE COMPROBANTE': 'numeroComprobante',
  'MONTO GRAVADO 10%': 'gravado10',
  'IVA 10%': 'iva10',
  'MONTO GRAVADO 5%': 'gravado5',
  'IVA 5%': 'iva5',
  'MONTO NO GRAVADO / EXENTO': 'exento',
  'TOTAL COMPROBANTE': 'total',
  'IMPUTA IVA': 'imputaIva',
};

/**
 * Una fila del libro, ya interpretada.
 *
 * `gravado10` y `gravado5` son montos CON el IVA adentro — es como los expresa
 * la planilla: en una factura de 98.000 al 10%, "Monto Gravado 10%" dice 98.000
 * e "IVA 10%" dice 8.909. No es la base imponible.
 */
export interface FilaDeLibro {
  readonly rucInformante: string;
  readonly rucInformado: string;
  readonly razonSocialInformado: string;
  readonly tipoRegistro: TipoDeRegistro;
  readonly tipoComprobante: string;
  readonly fechaEmision: string;
  /** Período fiscal declarado en la planilla, en formato `AAAA-MM`. */
  readonly periodo: string;
  readonly timbrado: string;
  readonly numeroComprobante: string;
  readonly gravado10: Gs;
  readonly iva10: Gs;
  readonly gravado5: Gs;
  readonly iva5: Gs;
  readonly exento: Gs;
  readonly total: Gs;
  /** Si la planilla marca que el comprobante imputa IVA. */
  readonly imputaIva: boolean;
}

export interface FilaDeLibroRechazada {
  readonly numeroFila: number;
  readonly motivo: string;
}

export interface ReporteDeLibro {
  readonly filas: readonly FilaDeLibro[];
  readonly rechazadas: readonly FilaDeLibroRechazada[];
  readonly filasLeidas: number;
  /**
   * Filas donde las partes no suman el total del comprobante.
   *
   * No son errores: "Monto Gravado" es una columna derivada con decimales y el
   * total es el de la factura. Se cuentan para que un salto en este número
   * —que sí querría decir que algo cambió en el formato— no pase inadvertido.
   */
  readonly descuadres: number;
}

/**
 * Importe de una celda de la planilla.
 *
 * Tolerante a propósito, y solo acá: las celdas de importe de estas planillas
 * vienen a veces como número, a veces como texto con separadores de miles, y a
 * veces vacías cuando el valor es cero. Un vacío es cero y no un error — una
 * factura al 10% tiene la columna del 5% vacía, no en cero.
 */
function importeDeCelda(valor: unknown): Gs {
  if (valor === null || valor === undefined) return gs(0);

  // Celdas con fórmula: exceljs las entrega como `{ formula, result }`. El
  // resultado ya calculado es el importe; si la fórmula quedó en error (`#REF!`
  // y parientes) el resultado es un objeto y no un número, y entonces no hay
  // importe que leer — se deja que caiga al rechazo con su motivo.
  if (typeof valor === 'object' && 'result' in (valor as Record<string, unknown>)) {
    return importeDeCelda((valor as { result: unknown }).result);
  }

  // Los archivos reales traen decimales aunque el guaraní no tenga centavos:
  // "IVA 10%" aparece como 5364.25000001 y "Monto Gravado 10%" como 59006.75.
  // Son restos del sistema que generó la planilla. Se redondea acá, una sola
  // vez, en el borde del sistema — adentro el dinero ya es entero y nunca
  // vuelve a ser flotante (ADR 0002).
  if (typeof valor === 'number') return gs(Math.round(valor));

  const texto = textoDeCelda(valor).replace(/\s/g, '').replace(/,/g, '.');
  if (texto === '' || texto === '-') return gs(0);

  const numero = texto.match(/^-?\d+(\.\d+)?$/);
  if (!numero) {
    throw new ErrorDeImportacion(`No se pudo leer el importe "${textoDeCelda(valor)}".`);
  }
  return gs(Math.round(Number(numero[0])));
}

/** `02/2026` → `2026-02`. Es el formato que usa la columna de período. */
function periodoDesdeCelda(valor: unknown): string {
  const texto = textoDeCelda(valor).trim();
  const conBarra = texto.match(/^(\d{1,2})\/(\d{4})$/);
  if (conBarra) return `${conBarra[2]}-${conBarra[1]!.padStart(2, '0')}`;

  const yaIso = texto.match(/^(\d{4})-(\d{2})$/);
  if (yaIso) return texto;

  throw new ErrorDeImportacion(`No se pudo leer el período "${texto}": se esperaba MM/AAAA.`);
}

/**
 * Una fila que no es un comprobante: cierre, subtotal o resto de la planilla.
 *
 * Se reconoce por lo que le FALTA — sin tipo de registro y sin número de
 * comprobante no hay nada que importar. Vale para las dos variantes de planilla
 * que aparecieron en los archivos reales.
 */
function esFilaDeCierre(cruda: FilaCruda<Campo>): boolean {
  const tipo = textoDeCelda(cruda.canonica.tipoRegistro).trim();
  const numero = textoDeCelda(cruda.canonica.numeroComprobante).trim();
  return tipo === '' && numero === '';
}

function tipoDeRegistro(valor: unknown): TipoDeRegistro {
  const texto = textoDeCelda(valor).trim().toUpperCase();
  if (texto === 'COMPRAS' || texto === 'VENTAS') return texto;
  throw new ErrorDeImportacion(
    `Tipo de registro "${texto}" desconocido: se esperaba COMPRAS o VENTAS.`,
  );
}

function interpretar(cruda: FilaCruda<Campo>): { fila: FilaDeLibro; descuadre: boolean } {
  const c = cruda.canonica;

  const gravado10 = importeDeCelda(c.gravado10);
  const gravado5 = importeDeCelda(c.gravado5);
  const exento = importeDeCelda(c.exento);
  const total = importeDeCelda(c.total);

  /*
   * Descuadre entre las partes y el total: se ANOTA, no se rechaza.
   *
   * La primera versión rechazaba la fila, y descartaba el 8% de los
   * comprobantes reales. Mirando los casos se entendió por qué: en las
   * planillas, "Monto Gravado 10%" es una columna DERIVADA —es el IVA
   * multiplicado por 11, con decimales incluidos— mientras que "Total
   * Comprobante" es el importe de la factura. En una fila real de FUMIPRO el
   * gravado dice 59.006,75 y el total dice 59.000: no se contradicen, miden
   * cosas distintas.
   *
   * Así que la validación estaba comparando un número calculado contra un
   * número declarado, y rechazando comprobantes buenos — que es la peor forma
   * de fallar acá, porque cada fila descartada es IVA que el cliente pierde.
   *
   * Lo que sí importa y sí es confiable son el IVA (lo declaró el proveedor en
   * el comprobante) y el total (es la factura). El descuadre queda contado para
   * que se vea si alguna vez deja de ser un resto de redondeo.
   */
  const suma = sumar([gravado10, gravado5, exento]);
  const descuadre = total !== gs(0) && suma !== total;

  const fila: FilaDeLibro = {
    rucInformante: textoDeCelda(c.rucInformante).trim(),
    rucInformado: textoDeCelda(c.rucInformado).trim(),
    razonSocialInformado: textoDeCelda(c.razonSocialInformado).trim(),
    tipoRegistro: tipoDeRegistro(c.tipoRegistro),
    tipoComprobante: textoDeCelda(c.tipoComprobante).trim().toUpperCase(),
    fechaEmision: textoDeCelda(c.fechaEmision).trim(),
    periodo: periodoDesdeCelda(c.periodoEmision),
    timbrado: textoDeCelda(c.timbrado).trim(),
    numeroComprobante: textoDeCelda(c.numeroComprobante).trim(),
    gravado10,
    iva10: importeDeCelda(c.iva10),
    gravado5,
    iva5: importeDeCelda(c.iva5),
    exento,
    total: total === gs(0) ? suma : total,
    imputaIva: textoDeCelda(c.imputaIva).trim().toUpperCase() !== 'NO',
  };

  return { fila, descuadre };
}

/**
 * Lee una planilla RG 90 y devuelve qué filas se entendieron y cuáles no.
 *
 * Una fila que no se entiende NO frena a las demás: con planillas de ciento
 * cincuenta líneas, cortar todo por una fila rota significa no importar nada, y
 * entonces nadie importa nunca.
 */
export async function importarLibroRg90(
  contenido: Buffer,
  nombreArchivo: string,
): Promise<ReporteDeLibro> {
  const crudas = await leerFilas<Campo>(contenido, nombreArchivo, ENCABEZADOS);

  if (crudas.length === 0) {
    throw new ErrorDeImportacion(
      `"${nombreArchivo}" no tiene filas de datos, o sus encabezados no son los de una planilla RG 90.`,
    );
  }

  const filas: FilaDeLibro[] = [];
  const rechazadas: FilaDeLibroRechazada[] = [];
  let descuadres = 0;

  for (const cruda of crudas) {
    // Fila sin ninguna columna reconocida: el archivo no es lo que creíamos.
    if (Object.keys(cruda.canonica).length === 0) continue;

    // Filas de cierre y subtotales al pie de la planilla. No son comprobantes,
    // así que se saltean en silencio: rechazarlas las mostraría como errores en
    // el reporte y haría que alguien salga a buscar un problema que no existe.
    if (esFilaDeCierre(cruda)) continue;

    try {
      const { fila, descuadre } = interpretar(cruda);
      filas.push(fila);
      if (descuadre) descuadres += 1;
    } catch (error) {
      rechazadas.push({
        numeroFila: cruda.numeroFila,
        motivo: error instanceof Error ? error.message : 'No se pudo interpretar la fila.',
      });
    }
  }

  return { filas, rechazadas, filasLeidas: crudas.length, descuadres };
}

export interface ResumenDeIva {
  readonly periodo: string;
  /** IVA de las compras: lo que el cliente puede descontar. */
  readonly creditoFiscal: Gs;
  /** IVA de las ventas: lo que el cliente le debe al fisco. */
  readonly debitoFiscal: Gs;
  readonly gravado10Compras: Gs;
  readonly gravado5Compras: Gs;
  readonly exentoCompras: Gs;
  readonly gravado10Ventas: Gs;
  readonly gravado5Ventas: Gs;
  readonly exentoVentas: Gs;
  readonly comprobantesCompras: number;
  readonly comprobantesVentas: number;
}

/**
 * Suma un libro y separa crédito de débito.
 *
 * Las filas marcadas como que NO imputan IVA quedan afuera del crédito y del
 * débito pero siguen contando como comprobantes: existen, se declararon, y no
 * mostrarlas haría que el total de comprobantes del sistema no coincida con el
 * de la planilla que EFFORT presentó.
 */
export function resumirIva(filas: readonly FilaDeLibro[], periodo: string): ResumenDeIva {
  // Se acumula en listas y se suma al final con `sumar`, no con `+`. El tipo
  // `Gs` está marcado justamente para que sumar plata sea una operación
  // explícita del dominio y no aritmética suelta — ver ADR 0002.
  const compras = filas.filter((f) => f.tipoRegistro === 'COMPRAS');
  const ventas = filas.filter((f) => f.tipoRegistro === 'VENTAS');
  const ivaDe = (f: FilaDeLibro) => sumar([f.iva10, f.iva5]);

  return {
    periodo,
    creditoFiscal: sumar(compras.filter((f) => f.imputaIva).map(ivaDe)),
    debitoFiscal: sumar(ventas.filter((f) => f.imputaIva).map(ivaDe)),
    gravado10Compras: sumar(compras.map((f) => f.gravado10)),
    gravado5Compras: sumar(compras.map((f) => f.gravado5)),
    exentoCompras: sumar(compras.map((f) => f.exento)),
    gravado10Ventas: sumar(ventas.map((f) => f.gravado10)),
    gravado5Ventas: sumar(ventas.map((f) => f.gravado5)),
    exentoVentas: sumar(ventas.map((f) => f.exento)),
    comprobantesCompras: compras.length,
    comprobantesVentas: ventas.length,
  };
}
