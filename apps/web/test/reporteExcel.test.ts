/**
 * El Excel que baja cada pantalla (2026-10-02). Se lee de vuelta con la misma
 * librería: lo que importa es lo que Laura y Lili van a ver al abrirlo.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  armarLibroDeExcel,
  hoja,
  nombreDeArchivo,
  nombreDeHojaValido,
  type Reporte,
} from '../src/ui/reporteExcel.js';

interface Fila {
  cliente: string;
  vence: string;
  dias: number;
  importe: string | bigint | null;
}

const FILAS: Fila[] = [
  { cliente: 'GARSO S.A.', vence: '2026-10-12', dias: 10, importe: '1500000' },
  { cliente: 'OTRO S.A.', vence: '2026-09-30', dias: -2, importe: null },
];

const COLUMNAS = [
  { titulo: 'Cliente', valor: (f: Fila) => f.cliente },
  { titulo: 'Vence', valor: (f: Fila) => f.vence, formato: 'fecha' as const },
  { titulo: 'Días', valor: (f: Fila) => f.dias, formato: 'entero' as const },
  { titulo: 'Importe (Gs.)', valor: (f: Fila) => f.importe, formato: 'guaranies' as const },
];

// 2026-10-02 14:30 en Paraguay (UTC−3).
const AHORA = new Date('2026-10-02T17:30:00Z');

async function leer(reporte: Reporte) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await armarLibroDeExcel(reporte, AHORA));
  return libro;
}

describe('reporte en Excel', () => {
  it('encabeza con el título, el momento en hora de Paraguay y los filtros, y deja una fila por registro', async () => {
    const libro = await leer({
      titulo: 'Vencimientos',
      filtros: ['Cliente: todos', 'Vencen: todas las fechas'],
      hojas: [hoja('Vencimientos', COLUMNAS, FILAS)],
    });
    const h = libro.getWorksheet('Vencimientos')!;

    expect(h.getCell('A1').value).toBe('Vencimientos');
    expect(String(h.getCell('A2').value)).toContain('02/10/2026');
    expect(String(h.getCell('A2').value)).toContain('14:30');
    expect(h.getCell('A3').value).toBe('Filtros: Cliente: todos · Vencen: todas las fechas');
    expect(h.getRow(5).values).toEqual([undefined, 'Cliente', 'Vence', 'Días', 'Importe (Gs.)']);
    expect(h.getCell('A6').value).toBe('GARSO S.A.');
    expect(h.getCell('A7').value).toBe('OTRO S.A.');
    expect(h.rowCount).toBe(7);
  });

  it('las fechas son fechas de Excel del mismo día (sin correrse por la zona horaria), y los importes, números con miles', async () => {
    const libro = await leer({ titulo: 'Vencimientos', filtros: [], hojas: [hoja('Vencimientos', COLUMNAS, FILAS)] });
    const h = libro.getWorksheet('Vencimientos')!;

    const fecha = h.getCell('B6').value as Date;
    expect(fecha).toBeInstanceOf(Date);
    expect(fecha.toISOString().slice(0, 10)).toBe('2026-10-12');
    expect(h.getCell('B6').numFmt).toBe('dd/mm/yyyy');
    expect(h.getCell('C7').value).toBe(-2);
    expect(h.getCell('D6').value).toBe(1500000);
    expect(h.getCell('D6').numFmt).toBe('#,##0');
    expect(h.getCell('D7').value).toBeNull();
    expect(h.getCell('A3').value).toBe('Sin filtros: todo lo que muestra la pantalla.');
  });

  it('un importe que no entra exacto en un número de Excel va como texto, no redondeado', async () => {
    const enorme = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2
    const libro = await leer({
      titulo: 'IVA',
      filtros: [],
      hojas: [hoja('IVA', COLUMNAS, [{ cliente: 'X', vence: '2026-01-01', dias: 0, importe: enorme }])],
    });
    expect(libro.getWorksheet('IVA')!.getCell('D6').value).toBe('9007199254740993');
  });

  it('una hoja sin filas lo dice en vez de quedar en blanco', async () => {
    const libro = await leer({ titulo: 'Alertas', filtros: ['Cliente: GARSO S.A.'], hojas: [hoja('Alertas', COLUMNAS, [])] });
    expect(libro.getWorksheet('Alertas')!.getCell('A6').value).toBe('No hay filas con estos filtros.');
  });

  it('varias hojas en un archivo, con nombres que Excel acepta y sin repetirse', async () => {
    const libro = await leer({
      titulo: 'Vencimientos',
      filtros: [],
      hojas: [hoja('Radar', COLUMNAS, FILAS), hoja('Radar', COLUMNAS, FILAS), hoja('Presentados: 2026/10', COLUMNAS, [])],
    });
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Radar', 'Radar (2)', 'Presentados- 2026-10']);
    expect(libro.getWorksheet('Radar')!.getCell('A1').value).toBe('Vencimientos — Radar');
  });

  it('nombres de hoja y de archivo válidos', () => {
    expect(nombreDeHojaValido('a'.repeat(40))).toHaveLength(31);
    expect(nombreDeHojaValido('  ')).toBe('Hoja');
    expect(nombreDeArchivo({ titulo: 'Vencimientos' }, 'FUMIPRO S.A.', AHORA)).toBe('Vencimientos - FUMIPRO S.A. - 2026-10-02.xlsx');
    expect(nombreDeArchivo({ titulo: 'Alertas' }, null, AHORA)).toBe('Alertas - 2026-10-02.xlsx');
    expect(nombreDeArchivo({ titulo: 'IVA' }, 'A/B: "C"', AHORA)).toBe('IVA - A-B- -C- - 2026-10-02.xlsx');
  });
});
