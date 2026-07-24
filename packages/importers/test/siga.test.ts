/**
 * Importador de exportaciones SIGA (tarea 92).
 *
 * La fila que produce este importador tiene que calzar exacto con
 * `FilaSigaEntrante` de `apps/api/src/puertos-dominio.ts` (rucEmisor,
 * timbrado, numeroComprobante, total: bigint, tasa, anulado, fecha: Date),
 * lista para pasarla a `RepositorioDeExportacionesSiga.registrar()`. No se
 * puede importar ese tipo acá (packages/* no depende de apps/*), así que se
 * verifica por forma, no por import.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { importarExportacionSiga } from '../src/siga.js';

const ENCABEZADOS = ['RUC Emisor', 'Timbrado', 'Numero Comprobante', 'Total', 'Tasa', 'Anulado', 'Fecha'];

async function bufferXlsx(filas: readonly (readonly unknown[])[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('SIGA');
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
const RUC_INVALIDO = '80012345-9';

describe('importarExportacionSiga — Excel', () => {
  it('acepta filas válidas con la forma de FilaSigaEntrante', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 150000, 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 15))],
    ]);

    const reporte = await importarExportacionSiga(contenido, 'libro-compras-marzo.xlsx');

    expect(reporte.totalFilas).toBe(1);
    expect(reporte.rechazados).toEqual([]);
    expect(reporte.aceptados).toHaveLength(1);
    const fila = reporte.aceptados[0]!;
    expect(fila.rucEmisor).toBe(RUC_VALIDO_1);
    expect(fila.timbrado).toBe('12345678');
    expect(fila.numeroComprobante).toBe('001-001-0000001');
    expect(fila.total).toBe(150000n);
    expect(fila.tasa).toBe('DIEZ');
    expect(fila.anulado).toBe(false);
    expect(fila.fecha).toEqual(new Date(Date.UTC(2026, 2, 15)));
  });

  it('rechaza un RUC con dígito verificador incorrecto', async () => {
    const contenido = await bufferXlsx([
      [RUC_INVALIDO, '12345678', '001-001-0000001', 150000, 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 15))],
    ]);

    const reporte = await importarExportacionSiga(contenido, 'libro-compras-marzo.xlsx');

    expect(reporte.aceptados).toEqual([]);
    expect(reporte.rechazados[0]!.motivo).toMatch(/RUC inválido/);
  });

  it('un total con separadores se rechaza en vez de adivinar', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', '150.000', 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 15))],
    ]);

    const reporte = await importarExportacionSiga(contenido, 'libro-compras-marzo.xlsx');

    expect(reporte.aceptados).toEqual([]);
    expect(reporte.rechazados[0]!.motivo).toMatch(/Importe con formato inválido/);
  });

  it('detecta duplicados dentro del archivo por clave natural, para no pisar filas en la conciliación', async () => {
    // conciliarConSiga() indexa por clave natural en un Map: dos filas SIGA
    // con la misma clave se pisarían en silencio si el importador no las
    // separa antes.
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 150000, 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 15))],
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 999999, 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 16))],
    ]);

    const reporte = await importarExportacionSiga(contenido, 'libro-compras-marzo.xlsx');

    expect(reporte.aceptados).toHaveLength(1);
    expect(reporte.aceptados[0]!.total).toBe(150000n);
    expect(reporte.rechazados).toHaveLength(1);
    expect(reporte.rechazados[0]!.numeroFila).toBe(3);
    expect(reporte.rechazados[0]!.motivo).toMatch(/duplicad.*fila 2/);
  });

  it('una fila vacía se reporta y no se cuenta como aceptada', async () => {
    const contenido = await bufferXlsx([
      [RUC_VALIDO_1, '12345678', '001-001-0000001', 150000, 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 15))],
      ['', '', '', '', '', '', ''],
    ]);

    const reporte = await importarExportacionSiga(contenido, 'libro-compras-marzo.xlsx');

    expect(reporte.totalFilas).toBe(2);
    expect(reporte.aceptados).toHaveLength(1);
    expect(reporte.rechazados[0]!.motivo).toBe('Fila vacía, se omite.');
  });

  it('acumula todos los problemas de una fila en un solo motivo', () =>
    bufferXlsx([['', '', '', 'no-es-numero', 'NO_EXISTE', 'tal-vez', 'fecha-mala']]).then(
      async (contenido) => {
        const reporte = await importarExportacionSiga(contenido, 'libro-compras-marzo.xlsx');
        const motivo = reporte.rechazados[0]!.motivo;
        expect(motivo).toMatch(/RUC inválido/);
        expect(motivo).toMatch(/Timbrado vacío/);
        expect(motivo).toMatch(/Número de comprobante vacío/);
        expect(motivo).toMatch(/Tasa inválida/);
        expect(motivo).toMatch(/Anulado no reconocido/);
        expect(motivo).toMatch(/[Ff]echa/);
      },
    ));
});

describe('importarExportacionSiga — CSV', () => {
  it('acepta el mismo archivo en formato CSV, con fecha en texto ISO', async () => {
    const contenido = bufferCsv([
      [RUC_VALIDO_2, '87654321', '002-002-0000005', '75000', 'CINCO', 'SI', '2026-03-20'],
    ]);

    const reporte = await importarExportacionSiga(contenido, 'libro-ventas-marzo.csv');

    expect(reporte.rechazados).toEqual([]);
    const fila = reporte.aceptados[0]!;
    expect(fila.fecha).toEqual(new Date(Date.UTC(2026, 2, 20)));
    expect(fila.total).toBe(75000n);
    expect(fila.anulado).toBe(true);
  });
});
