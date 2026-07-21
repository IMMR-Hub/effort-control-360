import { describe, expect, it } from 'vitest';

import {
  ErrorDeFecha,
  fechaCivilAIso,
  fechaCivilDesdeIso,
  fechaPerteneceAlPeriodo,
  hoyEnParaguay,
  periodoATexto,
  periodoAnterior,
  periodoDesdeTexto,
  periodoSiguiente,
} from '../src/fechas.js';

describe('parseo de fechas', () => {
  it('acepta AAAA-MM-DD', () => {
    expect(fechaCivilDesdeIso('2026-07-21')).toEqual({ anio: 2026, mes: 7, dia: 21 });
  });

  it('rechaza fechas que no existen en vez de normalizarlas en silencio', () => {
    expect(() => fechaCivilDesdeIso('2027-02-29')).toThrow(ErrorDeFecha);
    expect(() => fechaCivilDesdeIso('2026-04-31')).toThrow(ErrorDeFecha);
    expect(() => fechaCivilDesdeIso('2026-13-01')).toThrow(ErrorDeFecha);
  });

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(fechaCivilDesdeIso('2028-02-29')).toEqual({ anio: 2028, mes: 2, dia: 29 });
  });

  it('rechaza otros formatos que se prestan a confusión entre día y mes', () => {
    expect(() => fechaCivilDesdeIso('21/07/2026')).toThrow(ErrorDeFecha);
    expect(() => fechaCivilDesdeIso('2026-7-21')).toThrow(ErrorDeFecha);
  });

  it('ida y vuelta a texto', () => {
    expect(fechaCivilAIso(fechaCivilDesdeIso('2026-01-05'))).toBe('2026-01-05');
  });
});

describe('fecha civil en Paraguay', () => {
  it('a las 23:00 de Paraguay todavía es el día anterior en UTC', () => {
    // 2026-07-22T02:00Z = 2026-07-21T23:00 en Asunción (UTC-3).
    expect(hoyEnParaguay(new Date('2026-07-22T02:00:00Z'))).toEqual({
      anio: 2026,
      mes: 7,
      dia: 21,
    });
  });

  it('a las 01:00 de Paraguay ya cambió el día', () => {
    expect(hoyEnParaguay(new Date('2026-07-22T04:00:00Z'))).toEqual({
      anio: 2026,
      mes: 7,
      dia: 22,
    });
  });

  it('el corte de día no depende de la zona horaria del servidor', () => {
    const instante = new Date('2026-07-22T02:00:00Z');
    // El mismo instante leído en Tokio ya es día 22; en Paraguay sigue siendo 21.
    expect(hoyEnParaguay(instante, 'Asia/Tokyo').dia).toBe(22);
    expect(hoyEnParaguay(instante).dia).toBe(21);
  });
});

describe('períodos contables', () => {
  it('parsea y formatea AAAA-MM', () => {
    expect(periodoDesdeTexto('2026-01')).toEqual({ anio: 2026, mes: 1 });
    expect(periodoATexto({ anio: 2026, mes: 1 })).toBe('2026-01');
  });

  it('rechaza meses fuera de rango', () => {
    expect(() => periodoDesdeTexto('2026-00')).toThrow(ErrorDeFecha);
    expect(() => periodoDesdeTexto('2026-13')).toThrow(ErrorDeFecha);
  });

  it('el período anterior a enero es diciembre del año previo', () => {
    expect(periodoAnterior({ anio: 2026, mes: 1 })).toEqual({ anio: 2025, mes: 12 });
  });

  it('el período siguiente a diciembre es enero del año próximo', () => {
    expect(periodoSiguiente({ anio: 2026, mes: 12 })).toEqual({ anio: 2027, mes: 1 });
  });

  it('recorre el piloto de enero a junio de 2026 sin saltarse un mes', () => {
    const meses: string[] = [];
    let periodo = periodoDesdeTexto('2026-01');
    for (let i = 0; i < 6; i += 1) {
      meses.push(periodoATexto(periodo));
      periodo = periodoSiguiente(periodo);
    }
    expect(meses).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('detecta un comprobante que no corresponde al período que se está cerrando', () => {
    const periodo = periodoDesdeTexto('2026-03');
    expect(fechaPerteneceAlPeriodo(fechaCivilDesdeIso('2026-03-31'), periodo)).toBe(true);
    expect(fechaPerteneceAlPeriodo(fechaCivilDesdeIso('2026-04-01'), periodo)).toBe(false);
    expect(fechaPerteneceAlPeriodo(fechaCivilDesdeIso('2025-03-15'), periodo)).toBe(false);
  });
});
