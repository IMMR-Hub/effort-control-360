/**
 * Filtro de fechas único.
 *
 * Lo que importa probar son los bordes: que "últimos 15 días" cuente hoy, que un
 * mes termine en su último día real (febrero bisiesto incluido), que un rango
 * que cruza de año dé los períodos en orden, y que un rango al revés no deje la
 * pantalla vacía.
 */

import { describe, expect, it } from 'vitest';

import {
  dentroDelRango,
  describirFiltro,
  periodosDelRango,
  rangoDelFiltro,
} from '../src/filtroDeFechas.js';

const HOY = { anio: 2026, mes: 9, dia: 15 };

describe('filtro de fechas', () => {
  it('"todo" no filtra', () => {
    expect(rangoDelFiltro({ tipo: 'todo' }, HOY)).toBeNull();
    expect(dentroDelRango('2019-01-01', null)).toBe(true);
  });

  it('un mes va del primero al último día real, febrero bisiesto incluido', () => {
    expect(rangoDelFiltro({ tipo: 'mes', periodo: '2026-09' }, HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(rangoDelFiltro({ tipo: 'mes', periodo: '2028-02' }, HOY)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });

  it('una fecha exacta es un rango de un día', () => {
    expect(rangoDelFiltro({ tipo: 'dia', fecha: '2026-04-09' }, HOY)).toEqual({ desde: '2026-04-09', hasta: '2026-04-09' });
  });

  it('"últimos 15 días" cuenta hoy y los 14 anteriores', () => {
    expect(rangoDelFiltro({ tipo: 'ultimos', dias: 15 }, HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-15' });
    expect(rangoDelFiltro({ tipo: 'ultimos', dias: 90 }, HOY)).toEqual({ desde: '2026-06-18', hasta: '2026-09-15' });
  });

  it('un rango elegido al revés se da vuelta en vez de quedar vacío', () => {
    expect(rangoDelFiltro({ tipo: 'rango', desde: '2026-09-10', hasta: '2026-09-01' }, HOY)).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-10',
    });
  });

  it('una fecha con hora se compara por su día', () => {
    const rango = { desde: '2026-09-01', hasta: '2026-09-15' };
    expect(dentroDelRango('2026-09-15T23:59:00.000Z', rango)).toBe(true);
    expect(dentroDelRango('2026-08-31', rango)).toBe(false);
    expect(dentroDelRango(null, rango)).toBe(false);
  });

  it('los períodos de un rango que cruza de año salen en orden', () => {
    expect(periodosDelRango({ desde: '2025-11-20', hasta: '2026-02-03' })).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02',
    ]);
  });

  it('se lee en castellano', () => {
    expect(describirFiltro({ tipo: 'mes', periodo: '2026-09' })).toBe('septiembre de 2026');
    expect(describirFiltro({ tipo: 'ultimos', dias: 30 })).toBe('últimos 30 días');
    expect(describirFiltro({ tipo: 'rango', desde: '2026-09-01', hasta: '2026-09-15' })).toBe('del 1/9/2026 al 15/9/2026');
  });
});
