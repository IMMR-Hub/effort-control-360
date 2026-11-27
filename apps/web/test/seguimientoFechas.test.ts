/**
 * Fechas de Seguimiento: las opciones rápidas de «Reagendar» y la hora de los
 * formularios, siempre en Paraguay (regla 3 de `CLAUDE.md`), sin importar la
 * zona de la máquina ni la hora UTC.
 */

import { describe, expect, it } from 'vitest';

import {
  antiguedad,
  fechaDeReagenda,
  horaDeParaguayParaCampo,
  instanteDesdeHoraDeParaguay,
} from '../src/pantallas/seguimiento/comun.js';

describe('fechaDeReagenda', () => {
  // Miércoles 2026-11-25, 12:00 en Paraguay (15:00 UTC).
  const miercoles = new Date('2026-11-25T15:00:00Z');

  it('«Mañana» y «En 3 días» cuentan desde hoy en Paraguay', () => {
    expect(fechaDeReagenda('manana', miercoles)).toBe('2026-11-26');
    expect(fechaDeReagenda('tres_dias', miercoles)).toBe('2026-11-28');
  });

  it('«Próxima semana» es el lunes que viene; si hoy es lunes, el de la semana siguiente', () => {
    expect(fechaDeReagenda('proxima_semana', miercoles)).toBe('2026-11-30');
    expect(fechaDeReagenda('proxima_semana', new Date('2026-11-29T15:00:00Z'))).toBe('2026-11-30'); // domingo
    expect(fechaDeReagenda('proxima_semana', new Date('2026-11-30T15:00:00Z'))).toBe('2026-12-07'); // lunes
  });

  it('a las 22:00 de Paraguay ya es el día siguiente en UTC, pero «mañana» sigue siendo mañana', () => {
    // 2026-11-25 22:00 en Asunción = 2026-11-26 01:00 UTC.
    expect(fechaDeReagenda('manana', new Date('2026-11-26T01:00:00Z'))).toBe('2026-11-26');
  });

  it('cruza fin de mes y de año', () => {
    expect(fechaDeReagenda('tres_dias', new Date('2026-12-30T15:00:00Z'))).toBe('2027-01-02');
  });
});

describe('hora de Paraguay en los formularios', () => {
  it('una hora de pared de Paraguay se convierte al instante correcto, ida y vuelta', () => {
    const instante = instanteDesdeHoraDeParaguay('2026-11-25T22:30');
    expect(instante).toBe('2026-11-26T01:30:00.000Z');
    expect(horaDeParaguayParaCampo(new Date(instante))).toBe('2026-11-25T22:30');
  });

  it('la antigüedad se cuenta en días de Paraguay', () => {
    const ahora = new Date('2026-11-27T02:00:00Z'); // 26/11 23:00 en Asunción
    expect(antiguedad('2026-11-26T12:00:00.000Z', ahora)).toBe('hoy');
    expect(antiguedad('2026-11-25T12:00:00.000Z', ahora)).toBe('1 día');
    expect(antiguedad('2026-11-20T12:00:00.000Z', ahora)).toBe('6 días');
  });
});
