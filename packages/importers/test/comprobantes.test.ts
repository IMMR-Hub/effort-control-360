/**
 * Importador de comprobantes desde Excel/CSV (tarea 91).
 *
 * Los tests de Excel arman el workbook en memoria con ExcelJS (sin depender
 * de un archivo fijo en disco) y lo escriben a un Buffer, exactamente lo que
 * `@effort/drive` entregaría después de leer el archivo real.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { importarComprobantes } from '../src/comprobantes.js';

const ENCABEZADOS = [
  'RUC Emisor',
  'Timbrado',
  'Numero',
  'Tipo',
  'Origen',
  'Fecha',
  'Total',
  'Tasa',
  'Anulado',
];

async function bufferXlsx(filas: readonly (readonly unknown[])[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Comprobantes');
  hoja.addRow(ENCABEZADOS);
  for (const fila of filas) hoja.addRow([...fila]);
  const arrayBuffer = await libro.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function bufferCsv(filas: readonly (readonly unknown[])[]): Buffer {
  const lineas = [ENCABEZADOS, ...filas].map((fila) => fila.map((v) => String(v ?? '')).join(','));
  return Buffer.from(lineas.join('\n'), 'utf8');
}

const RUC_VALIDO_1 = '80012345-0';
const RUC_VALIDO_2 = '80017726-6';
const RUC_INVALIDO = '80012345-9'; // dígito verificador incorrecto (el correcto es -0)

describe('importarComprobantes — Excel', () => {
  it('acepta filas válidas y las convierte en Comprobante del dominio', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.totalFilas).toBe(1);
    expect(reporte.rechazados).toEqual([]);
    expect(reporte.aceptados).toHaveLength(1);
    const comprobante = reporte.aceptados[0]!;
    expect(comprobante.rucEmisor).toBe(RUC_VALIDO_1);
    expect(comprobante.timbrado).toBe('12345678');
    expect(comprobante.numero).toBe('001-001-0000001');
    expect(comprobante.tipo).toBe('FACTURA');
    expect(comprobante.origen).toBe('COMPRA');
    expect(comprobante.fecha).toEqual({ anio: 2026, mes: 3, dia: 15 });
    expect(comprobante.total).toBe(150000n);
    expect(comprobante.tasa).toBe('DIEZ');
    expect(comprobante.anulado).toBe(false);
  });

  it('rechaza un RUC con dígito verificador incorrecto', async () => {
    const contenido = await bufferXlsx([
      [RUC_INVALIDO, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.aceptados).toEqual([]);
    expect(reporte.rechazados).toHaveLength(1);
    expect(reporte.rechazados[0]!.motivo).toMatch(/RUC inválido/);
    expect(reporte.rechazados[0]!.numeroFila).toBe(2);
  });

  it('acumula todos los problemas de una fila en un solo motivo', async () => {
    const contenido = await bufferXlsx([
      ['', '', '', 'NO_EXISTE', 'NO_EXISTE', 'fecha-mala', 'no-es-numero', 'NO_EXISTE', 'tal-vez'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.aceptados).toEqual([]);
    const motivo = reporte.rechazados[0]!.motivo;
    expect(motivo).toMatch(/RUC inválido/);
    expect(motivo).toMatch(/Timbrado vacío/);
    expect(motivo).toMatch(/Número de comprobante vacío/);
    expect(motivo).toMatch(/Tipo inválido/);
    expect(motivo).toMatch(/Origen inválido/);
    expect(motivo).toMatch(/Tasa inválida/);
    expect(motivo).toMatch(/Anulado no reconocido/);
  });

  it('una fila completamente vacía se reporta y no se cuenta como aceptada', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'NO'],
      ['', '', '', '', '', '', '', '', ''],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.totalFilas).toBe(2);
    expect(reporte.aceptados).toHaveLength(1);
    expect(reporte.rechazados).toHaveLength(1);
    expect(reporte.rechazados[0]!.motivo).toBe('Fila vacía, se omite.');
    expect(reporte.rechazados[0]!.numeroFila).toBe(3);
  });

  it('un total no numérico (con separadores) se rechaza en vez de adivinar', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), '150.000', 'DIEZ', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.aceptados).toEqual([]);
    expect(reporte.rechazados[0]!.motivo).toMatch(/Total con formato inválido|Importe con formato inválido/);
  });

  it('una celda de total numérica limpia se acepta sin ambigüedad', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'NOTA_CREDITO', 'VENTA', new Date(Date.UTC(2026, 2, 15)), -50000, 'CINCO', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.rechazados).toEqual([]);
    expect(reporte.aceptados[0]!.total).toBe(-50000n);
  });

  it('detecta duplicados dentro del mismo archivo por clave natural (RUC+timbrado+número)', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'NO'],
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 16)), 999999, 'DIEZ', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.aceptados).toHaveLength(1);
    expect(reporte.aceptados[0]!.total).toBe(150000n);
    expect(reporte.rechazados).toHaveLength(1);
    expect(reporte.rechazados[0]!.numeroFila).toBe(3);
    expect(reporte.rechazados[0]!.motivo).toMatch(/duplicado.*fila 2/);
  });

  it('anulado reconoce SI/NO sin distinguir mayúsculas ni acentos', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'sí'],
      [RUC_VALIDO_2, '12345678', '001-001-0000002', 'FACTURA', 'COMPRA', new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'no'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.xlsx');

    expect(reporte.rechazados).toEqual([]);
    expect(reporte.aceptados.find((c) => c.numero === '001-001-0000001')?.anulado).toBe(true);
    expect(reporte.aceptados.find((c) => c.numero === '001-001-0000002')?.anulado).toBe(false);
  });
});

describe('importarComprobantes — CSV', () => {
  it('acepta el mismo archivo en formato CSV', async () => {
    const contenido = bufferCsv([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', '2026-03-15', '150000', 'DIEZ', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.csv');

    expect(reporte.rechazados).toEqual([]);
    expect(reporte.aceptados).toHaveLength(1);
    expect(reporte.aceptados[0]!.fecha).toEqual({ anio: 2026, mes: 3, dia: 15 });
    expect(reporte.aceptados[0]!.total).toBe(150000n);
  });

  it('rechaza una fecha con formato inválido en CSV', async () => {
    const contenido = bufferCsv([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', '15/03/2026', '150000', 'DIEZ', 'NO'],
    ]);

    const reporte = await importarComprobantes(contenido, 'marzo.csv');

    expect(reporte.aceptados).toEqual([]);
    expect(reporte.rechazados[0]!.motivo).toMatch(/[Ff]echa/);
  });

  it('reconoce encabezados con distinta capitalización y acentos', async () => {
    const encabezadosAlternativos = [
      'ruc emisor',
      'TIMBRADO',
      'Número',
      'tipo',
      'ORIGEN',
      'fecha',
      'TOTAL',
      'Tasa',
      'anulado',
    ];
    const lineas = [
      encabezadosAlternativos.join(','),
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA', '2026-03-15', '150000', 'DIEZ', 'NO'].join(','),
    ];
    const contenido = Buffer.from(lineas.join('\n'), 'utf8');

    const reporte = await importarComprobantes(contenido, 'marzo.csv');

    expect(reporte.rechazados).toEqual([]);
    expect(reporte.aceptados).toHaveLength(1);
  });
});
