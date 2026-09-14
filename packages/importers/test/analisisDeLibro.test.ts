/**
 * Análisis del libro RG 90.
 *
 * Lo que se prueba acá no es que sepa restar, sino que sepa **de qué lado cae
 * cada diferencia**. Un guaraní de más en compras y un guaraní de más en ventas
 * son problemas opuestos: uno puede costar una multa y el otro le cuesta plata
 * al cliente. Confundirlos haría que el sistema alerte de lo que no es y se
 * calle lo que sí.
 *
 * Los importes de los casos salen de comprobantes reales de EFFORT.
 */

import { describe, expect, it } from 'vitest';

import { DIVISORES_CONFIRMADOS_POR_EFFORT, gs } from '@effort/core';

import { analizarLibro, esRiesgoDeMulta, resumirHallazgos } from '../src/analisisDeLibro.js';
import type { FilaDeLibro } from '../src/libroRg90.js';

function fila(parcial: Partial<FilaDeLibro> = {}): FilaDeLibro {
  return {
    rucInformante: '80119631',
    rucInformado: '80108594',
    razonSocialInformado: 'PASANA SA',
    tipoRegistro: 'COMPRAS',
    tipoComprobante: 'FACTURA',
    fechaEmision: '19/02/2026',
    periodo: '2026-02',
    timbrado: '18535669',
    numeroComprobante: '001-001-0056770',
    gravado10: gs(110000),
    iva10: gs(10000),
    gravado5: gs(0),
    iva5: gs(0),
    exento: gs(0),
    total: gs(110000),
    imputaIva: true,
    ...parcial,
  };
}

const DIVISORES = DIVISORES_CONFIRMADOS_POR_EFFORT;

describe('análisis del libro RG 90', () => {
  it('no dice nada cuando el IVA declarado coincide con la regla', () => {
    // 110.000 / 11 = 10.000 exacto.
    expect(analizarLibro([fila()], DIVISORES)).toEqual([]);
  });

  /*
   * Caso real: ECOAGRO, comprobante de AGROSOL por 1.548.000 al 10%. La factura
   * declara 140.739 de IVA y la regla da 140.727 — doce guaraníes de crédito
   * fiscal de más. Es el hallazgo de mayor monto de todo el piloto.
   */
  it('en compras, declarar IVA de más es crédito fiscal de más', () => {
    const hallazgos = analizarLibro(
      [fila({ gravado10: gs(1548000), iva10: gs(140739), total: gs(1548000) })],
      DIVISORES,
    );

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]!.riesgo).toBe('CREDITO_DE_MAS');
    expect(hallazgos[0]!.diferencia).toBe(12n);
    expect(hallazgos[0]!.detalle).toMatch(/crédito fiscal de más/);
  });

  it('en compras, declarar IVA de menos juega en contra del cliente', () => {
    const hallazgos = analizarLibro(
      [fila({ gravado10: gs(110000), iva10: gs(9999), total: gs(110000) })],
      DIVISORES,
    );

    expect(hallazgos[0]!.riesgo).toBe('EN_CONTRA_DEL_CLIENTE');
  });

  // El espejo: en ventas el riesgo está en la dirección opuesta.
  it('en ventas, declarar IVA de menos es ingresar menos de lo debido', () => {
    const hallazgos = analizarLibro(
      [fila({ tipoRegistro: 'VENTAS', gravado10: gs(110000), iva10: gs(9999), total: gs(110000) })],
      DIVISORES,
    );

    expect(hallazgos[0]!.riesgo).toBe('DEBITO_DE_MENOS');
    expect(hallazgos[0]!.detalle).toMatch(/ingresando IVA de menos/);
  });

  it('en ventas, declarar IVA de más también juega en contra del cliente', () => {
    const hallazgos = analizarLibro(
      [fila({ tipoRegistro: 'VENTAS', gravado10: gs(110000), iva10: gs(10001), total: gs(110000) })],
      DIVISORES,
    );

    expect(hallazgos[0]!.riesgo).toBe('EN_CONTRA_DEL_CLIENTE');
  });

  /*
   * El caso que antes se descartaba. Es real: FUMIPRO, comprobante
   * 087-005-0337754 — las partes suman 56.468 y el total dice 56.450.
   *
   * Ya no se pierde ni se calla: aparece como hallazgo sobre el documento, que
   * es lo que es. El importador lo lee sin opinar y el análisis lo juzga.
   */
  it('una fila que no cierra consigo misma es un hallazgo, no un descarte', () => {
    const hallazgos = analizarLibro(
      [fila({ gravado10: gs(50668), iva10: gs(4606), gravado5: gs(5800), iva5: gs(276), total: gs(56450) })],
      DIVISORES,
    );

    const inconsistencia = hallazgos.find((h) => h.tipo === 'PARTES_NO_SUMAN_EL_TOTAL');
    expect(inconsistencia).toBeDefined();
    expect(inconsistencia!.riesgo).toBe('INCONSISTENCIA');
    expect(inconsistencia!.detalle).toMatch(/56\.468/);
    expect(inconsistencia!.detalle).toMatch(/56\.450/);
  });

  it('un comprobante puede tener más de un hallazgo, uno por tasa', () => {
    const hallazgos = analizarLibro(
      [fila({ gravado10: gs(110000), iva10: gs(10001), gravado5: gs(21000), iva5: gs(1001), total: gs(131000) })],
      DIVISORES,
    );

    expect(hallazgos.filter((h) => h.tipo === 'IVA_DECLARADO_NO_COINCIDE')).toHaveLength(2);
    expect(hallazgos.map((h) => h.tasa)).toContain('10%');
    expect(hallazgos.map((h) => h.tasa)).toContain('5%');
  });

  it('una tasa sin base gravada no se analiza', () => {
    // La columna del 5% vacía no es un comprobante al 5% con IVA cero.
    expect(analizarLibro([fila({ gravado5: gs(0), iva5: gs(0) })], DIVISORES)).toEqual([]);
  });
});

describe('resumen de hallazgos', () => {
  it('separa lo que puede costar una multa de lo que solo cuesta plata', () => {
    const hallazgos = analizarLibro(
      [
        fila({ gravado10: gs(1548000), iva10: gs(140739), total: gs(1548000) }),
        fila({ gravado10: gs(110000), iva10: gs(9999), total: gs(110000) }),
        fila({ tipoRegistro: 'VENTAS', gravado10: gs(110000), iva10: gs(9993), total: gs(110000) }),
      ],
      DIVISORES,
    );

    const resumen = resumirHallazgos(hallazgos);

    expect(resumen.conRiesgoDeMulta).toBe(2);
    expect(resumen.enContraDelCliente).toBe(1);
    // 12 del crédito de más + 7 del débito de menos. No se compensan entre sí:
    // son dos problemas, no uno que anula al otro.
    expect(resumen.ivaEnRiesgo).toBe(19n);
  });

  /*
   * Daniel, 2026-09-14: "mejor alertar a partir de 1 guaraní, y que luego
   * puedan aceptar o revisar". Reemplazó la tolerancia de 5 Gs que se había
   * aplicado ese mismo día: el sistema avisa de todo y decide una persona.
   */
  it('un solo guaraní en la dirección del fisco ya es riesgo', () => {
    expect(esRiesgoDeMulta({ riesgo: 'CREDITO_DE_MAS', diferencia: 1n })).toBe(true);
    expect(esRiesgoDeMulta({ riesgo: 'DEBITO_DE_MENOS', diferencia: -1n })).toBe(true);
  });

  it('una diferencia de cero no es riesgo', () => {
    expect(esRiesgoDeMulta({ riesgo: 'CREDITO_DE_MAS', diferencia: 0n })).toBe(false);
  });

  it('lo que juega en contra del cliente nunca es riesgo de multa, sea cual sea el monto', () => {
    expect(esRiesgoDeMulta({ riesgo: 'EN_CONTRA_DEL_CLIENTE', diferencia: -500n })).toBe(false);
  });

  it('un libro sin hallazgos resume en cero', () => {
    expect(resumirHallazgos([])).toEqual({
      total: 0,
      conRiesgoDeMulta: 0,
      enContraDelCliente: 0,
      inconsistencias: 0,
      ivaEnRiesgo: 0n,
    });
  });
});
