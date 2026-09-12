/**
 * Utilidades compartidas por los importadores de archivo (Excel/CSV).
 *
 * Cada importador (comprobantes, exportaciones SIGA) define su propio mapa de
 * encabezados y su propia validación de fila; lo que comparten es leer el
 * archivo y convertirlo en filas crudas con número de fila real, aceptar
 * celdas de fecha/importe sin adivinar formatos ambiguos, y decidir si una
 * fila está vacía.
 */

import ExcelJS from 'exceljs';
import { parse as parseCsvSync } from 'csv-parse/sync';

import { ErrorDeDinero, ErrorDeFecha, fechaCivilDesdeIso, gs, type FechaCivil, type Gs } from '@effort/core';

export class ErrorDeImportacion extends Error {
  override readonly name = 'ErrorDeImportacion';
}

export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function filaVacia(valores: Readonly<Record<string, unknown>>): boolean {
  return Object.values(valores).every(
    (valor) => valor === null || valor === undefined || String(valor).trim() === '',
  );
}

export function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object' && 'text' in (valor as Record<string, unknown>)) {
    return String((valor as { text: unknown }).text ?? '');
  }
  if (typeof valor === 'object' && 'result' in (valor as Record<string, unknown>)) {
    return String((valor as { result: unknown }).result ?? '');
  }
  return String(valor).trim();
}

export function fechaCivilDeCelda(valor: unknown): FechaCivil {
  if (valor instanceof Date) {
    return { anio: valor.getUTCFullYear(), mes: valor.getUTCMonth() + 1, dia: valor.getUTCDate() };
  }
  const texto = textoDeCelda(valor);
  if (!texto) {
    throw new ErrorDeFecha('Fecha vacía.');
  }
  return fechaCivilDesdeIso(texto);
}

/** Instante UTC de la medianoche de la fecha civil de la celda — para campos que exigen `Date`, no `FechaCivil`. */
export function fechaDeCelda(valor: unknown): Date {
  const civil = fechaCivilDeCelda(valor);
  return new Date(Date.UTC(civil.anio, civil.mes - 1, civil.dia));
}

/** `gs()` ya exige dígitos enteros sin separadores: una celda numérica de Excel no tiene ambigüedad, una celda de texto con puntos/comas se rechaza en vez de adivinar el separador. */
export function totalDeCelda(valor: unknown): Gs {
  if (typeof valor === 'number') return gs(valor);
  const texto = textoDeCelda(valor);
  if (!texto) {
    throw new ErrorDeDinero('Total vacío.');
  }
  return gs(texto);
}

export interface FilaCruda<TCampo extends string> {
  readonly numeroFila: number;
  readonly canonica: Partial<Record<TCampo, unknown>>;
  readonly original: Readonly<Record<string, unknown>>;
}

/** Hasta dónde se busca la fila de encabezado antes de darse por vencido. */
const FILAS_A_REVISAR_BUSCANDO_ENCABEZADO = 10;

/**
 * Encuentra en qué fila están los encabezados.
 *
 * Suponer que están en la primera fila parece razonable y es falso: entre las
 * planillas RG 90 reales de EFFORT hay archivos con una fila de datos ARRIBA
 * del encabezado (por ejemplo "RG COMPRAS MARZO 2026 - FUMIPRO SA.xlsx", donde
 * el encabezado está en la fila 2). Con la suposición vieja ese archivo se leía
 * entero sin reconocer una sola columna, y devolvía 196 filas y cero datos —
 * peor que un error, porque no se queja.
 *
 * Se elige la fila de las primeras diez que reconoce más encabezados. Si ninguna
 * reconoce ninguno, se devuelve la primera y quien llama decide qué hacer: acá
 * no se sabe si el archivo está mal o si es de otro tipo.
 */
function ubicarEncabezado<TCampo extends string>(
  hoja: ExcelJS.Worksheet,
  encabezados: Readonly<Record<string, TCampo>>,
): number {
  let mejorFila = 1;
  let mejorPuntaje = 0;

  const hasta = Math.min(FILAS_A_REVISAR_BUSCANDO_ENCABEZADO, hoja.rowCount);
  for (let numeroFila = 1; numeroFila <= hasta; numeroFila += 1) {
    let puntaje = 0;
    hoja.getRow(numeroFila).eachCell({ includeEmpty: false }, (celda) => {
      if (encabezados[normalizarEncabezado(textoDeCelda(celda.value))]) puntaje += 1;
    });

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorFila = numeroFila;
    }
  }

  return mejorFila;
}

async function filasDesdeExcel<TCampo extends string>(
  contenido: Buffer,
  encabezados: Readonly<Record<string, TCampo>>,
): Promise<FilaCruda<TCampo>[]> {
  const libro = new ExcelJS.Workbook();
  // El .d.ts de exceljs declara su propio `Buffer` local como alias casi
  // vacío de `ArrayBuffer`, incompatible en tipos con el Buffer real de Node
  // (defecto del paquete, no del código propio: en tiempo de ejecución acepta
  // un Buffer normal sin problema). Se referencia su tipo de parámetro real
  // vía `Parameters<>` en vez de `any`, para no perder el chequeo del resto
  // de los argumentos si la firma cambia en una futura versión.
  await libro.xlsx.load(contenido as unknown as Parameters<typeof libro.xlsx.load>[0]);
  const hoja = libro.worksheets[0];
  if (!hoja) {
    throw new ErrorDeImportacion('El archivo Excel no tiene ninguna hoja.');
  }

  const numeroEncabezado = ubicarEncabezado(hoja, encabezados);

  const columnaACampo = new Map<number, TCampo | null>();
  const columnaAOriginal = new Map<number, string>();
  const filaEncabezado = hoja.getRow(numeroEncabezado);
  filaEncabezado.eachCell({ includeEmpty: false }, (celda, columna) => {
    const texto = normalizarEncabezado(textoDeCelda(celda.value));
    columnaAOriginal.set(columna, texto);
    columnaACampo.set(columna, encabezados[texto] ?? null);
  });

  const filas: FilaCruda<TCampo>[] = [];
  hoja.eachRow({ includeEmpty: false }, (fila, numeroFila) => {
    if (numeroFila <= numeroEncabezado) return;

    const canonica: Partial<Record<TCampo, unknown>> = {};
    const original: Record<string, unknown> = {};
    fila.eachCell({ includeEmpty: true }, (celda, columna) => {
      const campo = columnaACampo.get(columna);
      const nombreOriginal = columnaAOriginal.get(columna) ?? `COLUMNA_${columna}`;
      original[nombreOriginal] = celda.value;
      if (campo) canonica[campo] = celda.value;
    });

    filas.push({ numeroFila, canonica, original });
  });

  return filas;
}

function filasDesdeCsv<TCampo extends string>(
  contenido: Buffer,
  encabezados: Readonly<Record<string, TCampo>>,
): FilaCruda<TCampo>[] {
  const registros = parseCsvSync(contenido, {
    columns: false,
    skip_empty_lines: false,
    trim: true,
  }) as string[][];

  const [encabezadoCrudo, ...datos] = registros;
  if (!encabezadoCrudo) {
    throw new ErrorDeImportacion('El archivo CSV no tiene encabezado.');
  }

  const columnas = encabezadoCrudo.map((texto) => normalizarEncabezado(texto));

  return datos.map((valores, indice) => {
    const canonica: Partial<Record<TCampo, unknown>> = {};
    const original: Record<string, unknown> = {};
    columnas.forEach((nombre, posicion) => {
      const valor = valores[posicion] ?? '';
      original[nombre] = valor;
      const campo = encabezados[nombre];
      if (campo) canonica[campo] = valor;
    });

    return { numeroFila: indice + 2, canonica, original };
  });
}

function esCsv(nombreArchivo: string): boolean {
  return nombreArchivo.trim().toLowerCase().endsWith('.csv');
}

/** Lee un archivo Excel o CSV y lo convierte en filas crudas, según la extensión de `nombreArchivo`. */
export async function leerFilas<TCampo extends string>(
  contenido: Buffer,
  nombreArchivo: string,
  encabezados: Readonly<Record<string, TCampo>>,
): Promise<FilaCruda<TCampo>[]> {
  return esCsv(nombreArchivo)
    ? filasDesdeCsv(contenido, encabezados)
    : filasDesdeExcel(contenido, encabezados);
}
