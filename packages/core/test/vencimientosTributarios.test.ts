/**
 * Cálculo del vencimiento de una obligación tributaria.
 *
 * El calendario que se usa acá es de PRUEBA: días 7, 9, 11… 25 por terminación.
 * No se afirma que sea el vigente de la DNIT — eso lo confirma EFFORT y vive en
 * la base de datos, no en el código. Lo que estos tests fijan es la REGLA:
 * qué terminación se lee, a qué mes se presenta, y qué pasa cuando el día cae
 * en fin de semana o feriado.
 */

import { describe, expect, it } from 'vitest';

import { crearCalendario, feriadosParaguay } from '../src/diasHabiles.js';
import { fechaCivilAIso } from '../src/fechas.js';
import {
  ErrorDeVencimiento,
  fechaDeVencimiento,
  terminacionDeRuc,
  type DiasPorTerminacion,
} from '../src/vencimientosTributarios.js';

const DIAS_DE_PRUEBA: DiasPorTerminacion = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25];

const calendario2026 = crearCalendario([
  ...feriadosParaguay(2026),
  ...feriadosParaguay(2027),
]);

describe('terminación del RUC', () => {
  // Confirmado por EFFORT el 2026-09-10: es el dígito verificador, el de
  // después del guion. Con RUCs reales de los clientes del piloto.
  it('lee el dígito verificador, no la última cifra del número', () => {
    expect(terminacionDeRuc('80012742-0')).toBe(0); // SIPAR
    expect(terminacionDeRuc('80003112-1')).toBe(1); // COPESA
    expect(terminacionDeRuc('80022319-5')).toBe(5); // ECOAGRO
  });

  it('tolera espacios alrededor', () => {
    expect(terminacionDeRuc('  80022319-5  ')).toBe(5);
  });

  it('falla en vez de adivinar si el RUC no tiene la forma esperada', () => {
    expect(() => terminacionDeRuc('sin-numero')).toThrow(ErrorDeVencimiento);
    expect(() => terminacionDeRuc('')).toThrow(ErrorDeVencimiento);
    // Sin guion no hay verificador que leer: antes esto devolvía la última
    // cifra del número en silencio, que es el error que se está corrigiendo.
    expect(() => terminacionDeRuc('80012742')).toThrow(ErrorDeVencimiento);
  });
});

describe('fecha de vencimiento', () => {
  it('lo mensual se presenta al mes siguiente del período liquidado', () => {
    // Verificador 2 → día 11. El IVA de marzo se presenta en abril, y el 11 de
    // abril de 2026 cae sábado: corre al lunes 13.
    const fecha = fechaDeVencimiento({
      ruc: '80012742-2',
      periodo: { anio: 2026, mes: 3 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: DIAS_DE_PRUEBA,
      calendario: calendario2026,
    });

    expect(fechaCivilAIso(fecha)).toBe('2026-04-13');
  });

  it('cruza el año: diciembre se presenta en enero del año siguiente', () => {
    const fecha = fechaDeVencimiento({
      ruc: '80119631-1',
      periodo: { anio: 2026, mes: 12 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: DIAS_DE_PRUEBA,
      calendario: calendario2026,
    });

    // Verificador 1 → día 9, que en enero de 2027 cae sábado: corre al lunes 11.
    expect(fechaCivilAIso(fecha)).toBe('2027-01-11');
  });

  it('si el día asignado cae en fin de semana, corre al lunes — nunca hacia atrás', () => {
    // Verificador 4 → día 15. El 15 de marzo de 2026 es domingo.
    const fecha = fechaDeVencimiento({
      ruc: '80000004-4',
      periodo: { anio: 2026, mes: 2 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: DIAS_DE_PRUEBA,
      calendario: calendario2026,
    });

    const iso = fechaCivilAIso(fecha);
    expect(iso >= '2026-03-15').toBe(true);
    expect(iso).toBe('2026-03-16');
  });

  it('un feriado también corre el vencimiento', () => {
    // 1 de mayo (Día del Trabajador) es feriado fijo.
    const calendarioConDiaUno = crearCalendario(feriadosParaguay(2026));
    const fecha = fechaDeVencimiento({
      ruc: '80000000-0',
      periodo: { anio: 2026, mes: 4 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: [1, 9, 11, 13, 15, 17, 19, 21, 23, 25],
      calendario: calendarioConDiaUno,
    });

    expect(fechaCivilAIso(fecha)).not.toBe('2026-05-01');
    expect(fechaCivilAIso(fecha)).toBe('2026-05-04');
  });

  it('lo anual se presenta en el mes de cierre del año siguiente', () => {
    const fecha = fechaDeVencimiento({
      ruc: '80012742-2',
      periodo: { anio: 2026, mes: 12 },
      periodicidad: 'ANUAL',
      mesDeCierreAnual: 4,
      diasPorTerminacion: DIAS_DE_PRUEBA,
      calendario: calendario2026,
    });

    expect(fechaCivilAIso(fecha)).toBe('2027-04-12');
  });

  it('una obligación anual sin mes de presentación falla en vez de suponer uno', () => {
    expect(() =>
      fechaDeVencimiento({
        ruc: '80012742-2',
        periodo: { anio: 2026, mes: 12 },
        periodicidad: 'ANUAL',
        diasPorTerminacion: DIAS_DE_PRUEBA,
        calendario: calendario2026,
      }),
    ).toThrow(ErrorDeVencimiento);
  });

  it('rechaza un calendario con días que no existen en todos los meses', () => {
    const diasInvalidos = [7, 9, 11, 13, 15, 17, 19, 21, 23, 31] as unknown as DiasPorTerminacion;

    expect(() =>
      fechaDeVencimiento({
        ruc: '80000009-9',
        periodo: { anio: 2026, mes: 1 },
        periodicidad: 'MENSUAL',
        diasPorTerminacion: diasInvalidos,
        calendario: calendario2026,
      }),
    ).toThrow(/entre 1 y 28/);
  });
});
