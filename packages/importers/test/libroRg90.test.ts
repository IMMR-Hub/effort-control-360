/**
 * Importador del libro de compras y ventas (planilla RG 90).
 *
 * **Todos los casos raros de acá son reales.** Salieron de correr el importador
 * contra las 39 planillas que EFFORT ya presentó ante la DNIT (4206 filas), no
 * de imaginar qué podría salir mal. Cada `it` documenta una forma concreta en
 * que las planillas de verdad se apartan de la planilla ideal — y cada uno
 * estuvo roto en la primera versión.
 *
 * El más caro fue el de los descuadres: la primera versión rechazaba esas filas
 * y descartaba el 8% de los comprobantes, que es IVA que el cliente pierde.
 */

import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

import { gs } from '@effort/core';

import { importarLibroRg90, resumirIva } from '../src/libroRg90.js';

/** Los 28 encabezados, textuales de las planillas de COMPRAS. */
const ENCABEZADOS_COMPRAS = [
  'RUC del Informante', 'Nombre o Razon Social del Informante',
  'RUC / Nº de Identificacion del Informado', 'Tipo de Identificación del Informado',
  'Nombre o Razón Social del Informado', 'Tipo de Registro', 'Tipo de Comprobante',
  'Fecha de Emisión', 'Periodo de Emisión', 'Condicion de la Operacion',
  'Operación en Moneda Extranjera', 'Timbrado del Comprobante', 'Numero de Comprobante',
  'CDC', 'Monto Gravado 10%', 'IVA 10%', 'Monto Gravado 5%', 'IVA 5%',
  'Monto No Gravado / Exento ', 'Total Comprobante', 'Imputa IVA', 'Imputa IRE',
  'Imputa IRP', 'No Imputar', 'Numero de Comprobante Asociado',
  'Timbrado del Comprobante Asociado', 'Fecha de Registro', 'Origen de la Información',
];

/**
 * Las planillas de VENTAS nombran distinto dos columnas: "Periodo" a secas y
 * "Fecha de Emision" sin tilde. Es el mismo archivo con otro generador.
 */
const ENCABEZADOS_VENTAS = ENCABEZADOS_COMPRAS.map((titulo) =>
  titulo === 'Periodo de Emisión'
    ? 'Periodo'
    : titulo === 'Fecha de Emisión'
      ? 'Fecha de Emision'
      : titulo,
);

interface Comprobante {
  readonly tipoRegistro: string;
  readonly numero: string;
  readonly gravado10?: number | string;
  readonly iva10?: number | string;
  readonly gravado5?: number | string;
  readonly iva5?: number | string;
  readonly exento?: number;
  readonly total?: number;
  readonly imputaIva?: string;
  readonly periodo?: string;
}

function fila(c: Comprobante): unknown[] {
  return [
    '80119631', 'FUMIPRO S.A.', '80108594', 'RUC', 'PASANA SA',
    c.tipoRegistro, 'FACTURA', '19/02/2026', c.periodo ?? '02/2026', 'CONTADO', 'NO',
    '18535669', c.numero, '',
    c.gravado10 ?? 0, c.iva10 ?? 0, c.gravado5 ?? 0, c.iva5 ?? 0,
    c.exento ?? 0, c.total ?? 0, c.imputaIva ?? 'SI', 'NO', 'NO', 'NO',
    '', '', '16/03/2026', 'IMPORTACION',
  ];
}

async function planilla(
  comprobantes: readonly Comprobante[],
  opciones: { encabezados?: string[]; filasAntesDelEncabezado?: unknown[][] } = {},
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Datos');
  for (const previa of opciones.filasAntesDelEncabezado ?? []) hoja.addRow(previa);
  hoja.addRow(opciones.encabezados ?? ENCABEZADOS_COMPRAS);
  for (const c of comprobantes) hoja.addRow(fila(c));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe('importador del libro RG 90', () => {
  it('lee una compra y toma el IVA declarado, no uno recalculado', async () => {
    // Fila textual de FUMIPRO: 98.000 al 10% con IVA declarado 8.909.
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0056770', gravado10: 98000, iva10: 8909, total: 98000 },
    ]);

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS FEBRERO 2026.xlsx');

    expect(reporte.rechazadas).toEqual([]);
    expect(reporte.filas).toHaveLength(1);
    expect(reporte.filas[0]!.iva10).toBe(gs(8909));
    expect(reporte.filas[0]!.tipoRegistro).toBe('COMPRAS');
    expect(reporte.filas[0]!.periodo).toBe('2026-02');
  });

  /*
   * El caso que definió el diseño del módulo.
   *
   * En las planillas reales el IVA declarado NO siempre coincide con dividir el
   * total: 229.625 / 11 da 20.875 exacto y la planilla dice 20.876. Ningún
   * redondeo se aleja de un resultado exacto — la cifra viene de la factura del
   * proveedor. El importador tiene que respetarla: recalcularla haría que el
   * sistema contradiga una declaración jurada que la DNIT ya recibió.
   */
  it('respeta un IVA que no coincide con dividir el total', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000001', gravado10: 229625, iva10: 20876, total: 229625 },
    ]);

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS.xlsx');

    // 229625 / 11 = 20875 exacto. Se guarda 20876, que es lo declarado.
    expect(reporte.filas[0]!.iva10).toBe(gs(20876));
  });

  it('entiende las planillas de ventas, que nombran distinto dos columnas', async () => {
    const contenido = await planilla(
      [{ tipoRegistro: 'VENTAS', numero: '001-001-0003584', gravado10: 1280000, iva10: 116364, total: 1280000 }],
      { encabezados: ENCABEZADOS_VENTAS },
    );

    const reporte = await importarLibroRg90(contenido, 'RG VENTAS ABRIL 2026.xlsx');

    expect(reporte.rechazadas).toEqual([]);
    expect(reporte.filas[0]!.tipoRegistro).toBe('VENTAS');
    expect(reporte.filas[0]!.periodo).toBe('2026-02');
  });

  /*
   * "RG COMPRAS MARZO 2026 - FUMIPRO SA.xlsx" tiene una fila de datos ARRIBA
   * del encabezado. Suponiendo que el encabezado está en la fila 1, ese archivo
   * devolvía 196 filas y cero columnas reconocidas: no fallaba, mentía.
   */
  it('encuentra el encabezado aunque no esté en la primera fila', async () => {
    const contenido = await planilla(
      [{ tipoRegistro: 'COMPRAS', numero: '001-003-4409831', gravado10: 6500, iva10: 591, total: 6500 }],
      { filasAntesDelEncabezado: [fila({ tipoRegistro: 'COMPRAS', numero: '001-001-0000009' })] },
    );

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS MARZO 2026.xlsx');

    expect(reporte.filas.length).toBeGreaterThanOrEqual(1);
    expect(reporte.filas.some((f) => f.numeroComprobante === '001-003-4409831')).toBe(true);
  });

  /*
   * Los importes reales traen decimales aunque el guaraní no tenga centavos:
   * el IVA aparece como 5364.25000001 y el gravado como 59006.75.
   */
  it('redondea los decimales que traen los archivos', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000002', gravado10: 59006.75, iva10: 5364.25000001, total: 59000 },
    ]);

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS.xlsx');

    expect(reporte.filas[0]!.iva10).toBe(gs(5364));
    expect(reporte.filas[0]!.gravado10).toBe(gs(59007));
  });

  /*
   * El error más caro de la primera versión: exigir que las partes sumaran el
   * total rechazaba el 8% de los comprobantes reales. "Monto Gravado" es una
   * columna derivada (IVA x 11, con decimales) y el total es el de la factura:
   * no se contradicen, miden cosas distintas. Se cuenta el descuadre y se
   * conserva la fila, porque cada fila descartada es IVA que el cliente pierde.
   */
  it('conserva la fila cuando las partes no suman el total, y lo cuenta', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000003', gravado10: 59007, iva10: 5364, total: 59000 },
    ]);

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS.xlsx');

    expect(reporte.filas).toHaveLength(1);
    expect(reporte.rechazadas).toEqual([]);
    expect(reporte.descuadres).toBe(1);
  });

  it('saltea las filas de cierre sin reportarlas como errores', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000004', gravado10: 11000, iva10: 1000, total: 11000 },
      { tipoRegistro: '', numero: '' },
    ]);

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS.xlsx');

    expect(reporte.filas).toHaveLength(1);
    expect(reporte.rechazadas).toEqual([]);
  });

  it('una fila rota no arrastra a las demás', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000005', gravado10: 11000, iva10: 1000, total: 11000 },
      { tipoRegistro: 'ALGO RARO', numero: '001-001-0000006' },
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000007', gravado10: 22000, iva10: 2000, total: 22000 },
    ]);

    const reporte = await importarLibroRg90(contenido, 'RG COMPRAS.xlsx');

    expect(reporte.filas).toHaveLength(2);
    expect(reporte.rechazadas).toHaveLength(1);
    expect(reporte.rechazadas[0]!.motivo).toMatch(/COMPRAS o VENTAS/);
  });

  it('falla claro si el archivo no es una planilla RG 90', async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet('Datos').addRow(['cualquier', 'cosa']);
    const contenido = Buffer.from(await libro.xlsx.writeBuffer());

    await expect(importarLibroRg90(contenido, 'otra cosa.xlsx')).rejects.toThrow(/RG 90/);
  });
});

describe('resumen de IVA del libro', () => {
  it('separa crédito de compras y débito de ventas', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, total: 110000 },
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000002', gravado5: 21000, iva5: 1000, total: 21000 },
      { tipoRegistro: 'VENTAS', numero: '001-001-0000003', gravado10: 220000, iva10: 20000, total: 220000 },
    ]);
    const reporte = await importarLibroRg90(contenido, 'RG.xlsx');

    const resumen = resumirIva(reporte.filas, '2026-02');

    expect(resumen.creditoFiscal).toBe(gs(11000));
    expect(resumen.debitoFiscal).toBe(gs(20000));
    expect(resumen.comprobantesCompras).toBe(2);
    expect(resumen.comprobantesVentas).toBe(1);
  });

  /*
   * Un comprobante marcado "No" en "Imputa IVA" no suma al crédito ni al
   * débito, pero SIGUE contando como comprobante: se declaró, existe, y si el
   * sistema no lo contara su total no coincidiría con el de la planilla que
   * EFFORT presentó — y esa diferencia haría dudar de todo lo demás.
   */
  it('un comprobante que no imputa IVA no suma al saldo pero sí se cuenta', async () => {
    const contenido = await planilla([
      { tipoRegistro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, total: 110000, imputaIva: 'NO' },
    ]);
    const reporte = await importarLibroRg90(contenido, 'RG.xlsx');

    const resumen = resumirIva(reporte.filas, '2026-02');

    expect(resumen.creditoFiscal).toBe(gs(0));
    expect(resumen.comprobantesCompras).toBe(1);
    expect(resumen.gravado10Compras).toBe(gs(110000));
  });
});
