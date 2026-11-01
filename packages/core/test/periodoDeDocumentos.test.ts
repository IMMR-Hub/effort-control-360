/**
 * Período de un documento por carpeta, por nombre y, al final, por fecha.
 *
 * Las rutas son las del manual v1.3 tal como quedaron en el OneDrive real
 * después del ordenamiento de octubre de 2026 (tarea 164): `021 COPESA`,
 * `09 SETIEMBRE` con S, `CIERRE 2024`, `ZZ A CLASIFICAR`.
 */

import { describe, expect, it } from 'vitest';

import {
  deducirPeriodo,
  periodoPorCarpeta,
  periodoPorNombre,
} from '../src/periodoDeDocumentos.js';

const FECHA_DEL_ORDENAMIENTO = new Date('2026-10-30T15:00:00Z');

describe('período por carpeta', () => {
  it('NNN PERIODO AAAA / DOCUMENTOS CONTABLES / MM MES da AAAA-MM', () => {
    expect(periodoPorCarpeta('021 COPESA/021 PERIODO 2025/DOCUMENTOS CONTABLES/03 MARZO')).toBe('2025-03');
  });

  it('acepta la ruta relativa a la carpeta del cliente, como la da Graph', () => {
    expect(periodoPorCarpeta('021 PERIODO 2025/DOCUMENTOS CONTABLES/03 MARZO')).toBe('2025-03');
  });

  it('09 SETIEMBRE se escribe con S en el manual', () => {
    expect(periodoPorCarpeta('021 COPESA/021 PERIODO 2024/DOCUMENTOS CONTABLES/09 SETIEMBRE')).toBe('2024-09');
  });

  it('una subcarpeta dentro del mes no cambia el período', () => {
    expect(
      periodoPorCarpeta('021 PERIODO 2025/DOCUMENTOS CONTABLES/04 ABRIL/NC EMITIDAS 042025'),
    ).toBe('2025-04');
  });

  // Lo anual del ejercicio AAAA vive en AAAA-12, igual que las obligaciones
  // anuales en `generadorDeVencimientos.ts`.
  it('CIERRE AAAA da el período del cierre: AAAA-12', () => {
    expect(periodoPorCarpeta('021 COPESA/021 PERIODO 2024/DOCUMENTOS CONTABLES/CIERRE 2024')).toBe('2024-12');
  });

  it('un CIERRE de otro año que su PERIODO no se adivina', () => {
    expect(periodoPorCarpeta('021 PERIODO 2025/DOCUMENTOS CONTABLES/CIERRE 2024')).toBeNull();
  });

  it('un mes cuyo número no coincide con el nombre no se adivina', () => {
    expect(periodoPorCarpeta('021 PERIODO 2025/DOCUMENTOS CONTABLES/03 ABRIL')).toBeNull();
  });

  it('ZZ A CLASIFICAR no dice período', () => {
    expect(periodoPorCarpeta('021 COPESA/021 ZZ A CLASIFICAR')).toBeNull();
  });

  it('las carpetas fuera de DOCUMENTOS CONTABLES no dicen el mes', () => {
    expect(periodoPorCarpeta('021 PERIODO 2025/DOCUMENTOS LABORALES/IPS')).toBeNull();
    expect(periodoPorCarpeta('021 LEGAL Y SOCIETARIO/ASAMBLEA 2025')).toBeNull();
    expect(periodoPorCarpeta('021 TRIBUTARIO')).toBeNull();
  });
});

describe('período por nombre (guía de nomenclatura, MMAAAA)', () => {
  it('lee el MMAAAA de los nombres de la guía', () => {
    expect(periodoPorNombre('RG COMPRAS 032025 COPESA.xlsx')).toBe('2025-03');
    expect(periodoPorNombre('DDJJ IVA 042024 COPESA.pdf')).toBe('2024-04');
  });

  it('no confunde un número de comprobante ni una fecha DDMMAAAA con un período', () => {
    expect(periodoPorNombre('NOTA DE CREDITO 001-001-0000245 FUMIPRO SA.pdf')).toBeNull();
    expect(periodoPorNombre('CCT 02092026.pdf')).toBeNull();
  });

  it('un año suelto no alcanza', () => {
    expect(periodoPorNombre('DDJJ IRE 2025 FUMIPRO SA.pdf')).toBeNull();
  });

  it('dos períodos distintos en el mismo nombre no se eligen', () => {
    expect(periodoPorNombre('CALCULO IVA 032025 042025 COPESA.xlsx')).toBeNull();
  });
});

describe('deducir el período: carpeta, nombre, fecha', () => {
  it('la carpeta manda sobre el nombre y sobre la fecha', () => {
    expect(
      deducirPeriodo(
        'RG COMPRAS 032025 COPESA.xlsx',
        '021 COPESA/021 PERIODO 2025/DOCUMENTOS CONTABLES/03 MARZO',
        FECHA_DEL_ORDENAMIENTO,
      ),
    ).toEqual({ periodo: '2025-03', origen: 'CARPETA' });
  });

  it('en ZZ A CLASIFICAR, el nombre según la guía va antes que la fecha', () => {
    expect(
      deducirPeriodo('DDJJ IVA 042024 COPESA.pdf', '021 COPESA/021 ZZ A CLASIFICAR', FECHA_DEL_ORDENAMIENTO),
    ).toEqual({ periodo: '2024-04', origen: 'NOMBRE' });
  });

  it('sin carpeta ni nombre, la fecha queda como último recurso y se dice', () => {
    expect(
      deducirPeriodo('ENERO.pdf', '021 COPESA/021 ZZ A CLASIFICAR', FECHA_DEL_ORDENAMIENTO),
    ).toEqual({ periodo: '2026-10', origen: 'FECHA' });
  });
});
