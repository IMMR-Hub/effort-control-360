import { describe, expect, it } from 'vitest';

import {
  ErrorDeDinero,
  aTexto,
  dividirRedondeado,
  formatearGs,
  gs,
  porcentaje,
  restar,
  sumar,
} from '../src/dinero.js';

describe('construcción de importes', () => {
  it('acepta bigint, number entero y string de dígitos', () => {
    expect(gs(1000n)).toBe(1000n);
    expect(gs(1000)).toBe(1000n);
    expect(gs('1000')).toBe(1000n);
    expect(gs('-1000')).toBe(-1000n);
    expect(gs(' 1000 ')).toBe(1000n);
  });

  it('rechaza decimales en lugar de redondearlos en silencio', () => {
    expect(() => gs(1000.5)).toThrow(ErrorDeDinero);
    expect(() => gs(0.1)).toThrow(ErrorDeDinero);
  });

  it('rechaza NaN e Infinity', () => {
    expect(() => gs(Number.NaN)).toThrow(ErrorDeDinero);
    expect(() => gs(Number.POSITIVE_INFINITY)).toThrow(ErrorDeDinero);
  });

  it('rechaza enteros fuera del rango seguro de number, donde number ya perdió precisión', () => {
    expect(() => gs(Number.MAX_SAFE_INTEGER + 2)).toThrow(ErrorDeDinero);
  });

  it('rechaza strings que no son enteros', () => {
    expect(() => gs('1000,50')).toThrow(ErrorDeDinero);
    expect(() => gs('1.000')).toThrow(ErrorDeDinero);
    expect(() => gs('mil')).toThrow(ErrorDeDinero);
    expect(() => gs('')).toThrow(ErrorDeDinero);
  });
});

describe('precisión más allá del alcance de number', () => {
  it('suma importes que un number no podría representar', () => {
    const enorme = gs('9007199254740993');
    expect(sumar([enorme, gs(1)]).toString()).toBe('9007199254740994');
  });

  it('no acumula error de coma flotante en sumas largas', () => {
    const importes = Array.from({ length: 1000 }, () => gs(1));
    expect(sumar(importes)).toBe(1000n);
  });

  it('la suma de una lista vacía es cero', () => {
    expect(sumar([])).toBe(0n);
  });
});

describe('división redondeada', () => {
  it('rechaza la división por cero en vez de devolver Infinity', () => {
    expect(() => dividirRedondeado(100n, 0n)).toThrow(ErrorDeDinero);
  });

  it('redondea en magnitud, de modo que -X y +X dan el mismo valor absoluto', () => {
    for (const numerador of [1n, 5n, 7n, 1000000n, 6000000n]) {
      const positivo = dividirRedondeado(numerador, 11n);
      const negativo = dividirRedondeado(-numerador, 11n);
      expect(negativo).toBe(-positivo);
    }
  });

  it('el denominador negativo invierte el signo del resultado', () => {
    expect(dividirRedondeado(10n, -4n)).toBe(-3n);
    expect(dividirRedondeado(-10n, -4n)).toBe(3n);
  });
});

describe('porcentaje en puntos básicos', () => {
  it('aplica un 10% sin coma flotante', () => {
    expect(porcentaje(gs(1000000), 1000n)).toBe(100000n);
  });

  it('aplica un 0,5%', () => {
    expect(porcentaje(gs(1000000), 50n)).toBe(5000n);
  });

  it('redondea el resultado a guaraní entero', () => {
    expect(porcentaje(gs(333), 1000n)).toBe(33n);
  });
});

describe('serialización y presentación', () => {
  it('serializa siempre como string, porque JSON.stringify no sabe manejar bigint', () => {
    expect(aTexto(gs(6000000))).toBe('6000000');
    expect(() => JSON.stringify({ importe: gs(1) })).toThrow(TypeError);
    expect(JSON.stringify({ importe: aTexto(gs(1)) })).toBe('{"importe":"1"}');
  });

  it('formatea con separador de miles al estilo paraguayo', () => {
    expect(formatearGs(gs(6000000))).toBe('Gs. 6.000.000');
    expect(formatearGs(gs(0))).toBe('Gs. 0');
    expect(formatearGs(gs(999))).toBe('Gs. 999');
    expect(formatearGs(gs(1000))).toBe('Gs. 1.000');
    expect(formatearGs(gs(-1500000))).toBe('-Gs. 1.500.000');
  });

  it('formatea la multa que EFFORT ya pagó', () => {
    expect(formatearGs(gs(6000000))).toBe('Gs. 6.000.000');
  });
});

describe('operaciones', () => {
  it('resta manteniendo el tipo', () => {
    expect(restar(gs(1000), gs(300))).toBe(700n);
    expect(restar(gs(300), gs(1000))).toBe(-700n);
  });
});
