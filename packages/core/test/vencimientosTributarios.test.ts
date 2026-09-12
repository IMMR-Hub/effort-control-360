/**
 * Cálculo del vencimiento de una obligación tributaria.
 *
 * El calendario que se usa acá coincide con el que EFFORT confirmó el 2026-09-10
 * (7, 9, 11… 25), pero se pasa como parámetro igual: el vigente vive en la base

 * de datos, no en el código, porque la DNIT lo cambia por resolución.
 *
 * Lo que estos tests fijan es la REGLA: qué terminación se lee, a qué mes se presenta, y qué pasa cuando el día cae
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
  // El ejemplo textual que dio EFFORT el 2026-09-10 al mandar la tabla
  // oficial. Queda como test porque es la frase exacta que zanjó la duda.
  it('en 80007729-6 la terminación es 9, no 6', () => {
    expect(terminacionDeRuc('80007729-6')).toBe(9);
  });

  it('lee la última cifra del número, no el dígito verificador', () => {
    expect(terminacionDeRuc('80012742-0')).toBe(2); // SIPAR
    expect(terminacionDeRuc('80003112-1')).toBe(2); // COPESA
    expect(terminacionDeRuc('80022319-5')).toBe(9); // ECOAGRO
    expect(terminacionDeRuc('80119631-0')).toBe(1); // FUMIPRO
    expect(terminacionDeRuc('80082006-1')).toBe(6); // DIBEC
  });

  it('tolera espacios alrededor', () => {
    expect(terminacionDeRuc('  80022319-5  ')).toBe(9);
  });

  it('falla en vez de adivinar si el RUC no tiene la forma esperada', () => {
    expect(() => terminacionDeRuc('sin-numero')).toThrow(ErrorDeVencimiento);
    expect(() => terminacionDeRuc('')).toThrow(ErrorDeVencimiento);
  });
});

describe('fecha de vencimiento', () => {
  it('lo mensual se presenta al mes siguiente del período liquidado', () => {
    // Terminación 2 (última cifra del número) → día 11. El IVA de marzo se
    // presenta en abril, y el 11 de abril de 2026 cae sábado: corre al lunes 13.
    const fecha = fechaDeVencimiento({
      ruc: '80012742-0',
      periodo: { anio: 2026, mes: 3 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: DIAS_DE_PRUEBA,
      calendario: calendario2026,
    });

    expect(fechaCivilAIso(fecha)).toBe('2026-04-13');
  });

  it('cruza el año: diciembre se presenta en enero del año siguiente', () => {
    const fecha = fechaDeVencimiento({
      ruc: '80119631-0',
      periodo: { anio: 2026, mes: 12 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: DIAS_DE_PRUEBA,
      calendario: calendario2026,
    });

    // Terminación 1 → día 9, que en enero de 2027 cae sábado: corre al lunes 11.
    expect(fechaCivilAIso(fecha)).toBe('2027-01-11');
  });

  it('si el día asignado cae en fin de semana, corre al lunes — nunca hacia atrás', () => {
    // Terminación 4 → día 15. El 15 de marzo de 2026 es domingo.
    const fecha = fechaDeVencimiento({
      ruc: '80000004-7',
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
      ruc: '80012742-0',
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
        ruc: '80012742-0',
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
        ruc: '80000009-1',
        periodo: { anio: 2026, mes: 1 },
        periodicidad: 'MENSUAL',
        diasPorTerminacion: diasInvalidos,
        calendario: calendario2026,
      }),
    ).toThrow(/entre 1 y 28/);
  });
});

/**
 * La DNIT publica DOS calendarios, no uno, y confundirlos corre todos los
 * vencimientos de las informativas un día.
 *
 *  - **Determinativas** (IVA, IRE, IRP, ISC, anticipos): días 7 a 25.
 *  - **Informativas** (RG 90 / libro de compras y ventas, estados financieros,
 *    dictamen de auditoría externa impositiva): días 8 a 26.
 *
 * El sistema ya soportaba esto sin saberlo: `diasPorTerminacionRuc` se guarda
 * POR OBLIGACIÓN, así que las dos tablas conviven sin ningún cambio de
 * estructura. Lo que faltaba era tener el dato y dejarlo probado.
 *
 * Las dos tablas quedaron confirmadas dos veces, de forma independiente: contra
 * el portal de la DNIT (Resolución General 38/2020, artículo 3°) y contra las
 * fechas que Daniel pasó el 2026-09-11 para los cinco clientes del piloto. Las
 * cinco coinciden exactamente — ECOAGRO (terminación 9) IRE el 25 y RG 90 el
 * 26, DIBEC (6) el 19 y el 20, SIPAR y COPESA (2) el 11 y el 12, FUMIPRO (1) el
 * 9 y el 10.
 */
describe('los dos calendarios de la DNIT', () => {
  const DETERMINATIVAS: DiasPorTerminacion = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
  const INFORMATIVAS: DiasPorTerminacion = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];

  it('las informativas vencen un día después que las determinativas', () => {
    for (let terminacion = 0; terminacion < 10; terminacion += 1) {
      expect(INFORMATIVAS[terminacion]).toBe(DETERMINATIVAS[terminacion]! + 1);
    }
  });

  /*
   * El caso que obligó a cargar los traslados por decreto.
   *
   * ECOAGRO (RUC 80022319-5, terminación 9) presenta el RG 90 el 26. El 26 de
   * setiembre de 2026 cae sábado, así que corre al lunes 28 — que es el día al
   * que el Decreto N° 6601 trasladó la Victoria de Boquerón. El vencimiento
   * real es el martes 29.
   *
   * Sin el traslado cargado, el sistema daba por vencida esa obligación un día
   * antes que la DNIT: habría marcado a ECOAGRO en falta estando todavía en
   * plazo.
   */
  it('el RG 90 de ECOAGRO de agosto 2026 salta el feriado trasladado', () => {
    const fecha = fechaDeVencimiento({
      ruc: '80022319-5',
      periodo: { anio: 2026, mes: 8 },
      periodicidad: 'MENSUAL',
      diasPorTerminacion: INFORMATIVAS,
      calendario: calendario2026,
    });

    expect(fechaCivilAIso(fecha)).toBe('2026-09-29');
  });

  // El IRE anual de ECOAGRO: cierre 31/12, se presenta en abril, día 25.
  // El 25 de abril de 2026 cae sábado → lunes 27.
  it('el IRE anual de ECOAGRO cae en abril, por el calendario de determinativas', () => {
    const fecha = fechaDeVencimiento({
      ruc: '80022319-5',
      periodo: { anio: 2025, mes: 12 },
      periodicidad: 'ANUAL',
      mesDeCierreAnual: 4,
      diasPorTerminacion: DETERMINATIVAS,
      calendario: calendario2026,
    });

    expect(fechaCivilAIso(fecha)).toBe('2026-04-27');
  });
});
