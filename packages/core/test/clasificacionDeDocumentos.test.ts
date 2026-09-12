/**
 * Clasificación de documentos por el nombre del archivo.
 *
 * Todos los nombres de este archivo son REALES: salieron de los 1023
 * documentos que EFFORT tiene cargados en el sistema, tomados de las carpetas
 * de los 5 clientes del piloto. No hay ninguno inventado — probar contra
 * nombres imaginarios diría más sobre mi imaginación que sobre cómo EFFORT
 * nombra sus archivos.
 */

import { describe, expect, it } from 'vitest';

import { clasificarPorNombre } from '../src/clasificacionDeDocumentos.js';

describe('clasificación por nombre de archivo', () => {
  it('reconoce los balances, que estaban todos como "Otro"', () => {
    expect(clasificarPorNombre('BALANCE 2025.pdf')).toBe('BALANCE');
    expect(clasificarPorNombre('Balance General .pdf')).toBe('BALANCE');
    expect(clasificarPorNombre('ECOAGRO S.A. BALANCE 2025 provisorio.pdf')).toBe('BALANCE');
  });

  it('distingue el estado de resultados del balance', () => {
    expect(clasificarPorNombre('ESTADO DE RESULTADOS AL 31012026 FUMIPRO SA.pdf')).toBe(
      'ESTADO_RESULTADOS',
    );
    expect(clasificarPorNombre('ESTADO DE RESULTADOS MARZO 2026.pdf')).toBe('ESTADO_RESULTADOS');
  });

  it('reconoce las planillas de determinación como declaración jurada', () => {
    expect(clasificarPorNombre('PLANILLA DETERMINACION IMPUESTOS.pdf')).toBe('DECLARACION_JURADA');
    expect(clasificarPorNombre('PLANILLA DETERMINACION 2.xls')).toBe('DECLARACION_JURADA');
  });

  /**
   * El caso que justifica el orden de las reglas: el nombre menciona el
   * impuesto (IRE) y el pago. Es el comprobante de haber pagado, no la
   * declaración — confundirlos haría creer que la declaración está presentada.
   */
  it('una boleta de pago de IRE es un comprobante de pago, no una declaración', () => {
    expect(clasificarPorNombre('BOLETA DE PAGO ANTICIPO IRE - FUMIPRO SA.pdf')).toBe(
      'COMPROBANTE_PAGO',
    );
    expect(clasificarPorNombre('PAGO IVA ABRIL 2026 - FUMIPRO SA.pdf')).toBe('COMPROBANTE_PAGO');
  });

  it('reconoce los libros de compras y ventas de SIGA', () => {
    expect(clasificarPorNombre('80012742_202603_COMPRAS_304254_1.txt')).toBe('LIBRO_COMPRAS');
    expect(clasificarPorNombre('80012742_202606_VENTAS_438202_1.zip')).toBe('LIBRO_VENTAS');
  });

  it('mantiene lo societario que ya se reconocía', () => {
    expect(clasificarPorNombre('ACTA DE ASAMBLEA N° 34.pdf')).toBe('ACTA');
    expect(clasificarPorNombre('Convocatoria de asamblea 2026.doc')).toBe('ACTA');
    expect(clasificarPorNombre('ESTATUTO MODIFICADO NRO 26.pdf')).toBe('ESTATUTO');
    expect(clasificarPorNombre('Constancia _ MARANGATU.pdf')).toBe('CONSTANCIA');
    expect(clasificarPorNombre('Cédula Tributaria _ MARANGATU.pdf')).toBe('CONSTANCIA');
  });

  it('reconoce extractos y retenciones', () => {
    expect(clasificarPorNombre('DOLARES 012026.pdf')).toBe('OTRO');
    expect(clasificarPorNombre('EXTRACTOS BANCARIOS ENERO.pdf')).toBe('EXTRACTO_BANCARIO');
    expect(clasificarPorNombre('RETENCIONES MARZO 2026.pdf')).toBe('RETENCION');
  });

  it('los separadores no cambian el resultado', () => {
    expect(clasificarPorNombre('BOLETA_DE_PAGO_IVA_2026.pdf')).toBe('COMPROBANTE_PAGO');
    expect(clasificarPorNombre('acta-de-directorio-2026.docx')).toBe('ACTA');
  });

  // Preferible sin clasificar a mal clasificado: a lo primero alguien lo
  // corrige, de lo segundo nadie sospecha.
  it('lo que no se puede decidir queda como OTRO, no se adivina', () => {
    expect(clasificarPorNombre('Captura.PNG')).toBe('OTRO');
    expect(clasificarPorNombre('flujo de caja.pdf')).toBe('OTRO');
    expect(clasificarPorNombre('Basa.pdf')).toBe('OTRO');
    expect(clasificarPorNombre('')).toBe('OTRO');
  });

  /*
   * Nombres sacados textualmente de los 1024 documentos reales de EFFORT, al
   * reclasificarlos el 2026-09-12. No son casos inventados: cada uno dejaba
   * archivos como "Otro" que sí se sabía qué eran.
   *
   * El más instructivo es "BOLEETA": está mal escrito en el archivo real, y
   * varias veces. Un clasificador que solo entiende nombres bien escritos no
   * sirve para archivos que nombra una persona apurada.
   */
  describe('nombres reales del OneDrive de EFFORT', () => {
    it('reconoce las variantes de boleta de pago que usa EFFORT', () => {
      expect(clasificarPorNombre('BOLEETA DE PAGO CUOTA 1 FRACC IVA 06 2026 - FUMIPRO SA.pdf')).toBe(
        'COMPROBANTE_PAGO',
      );
      expect(clasificarPorNombre('BOLETA FAC DE PAGO - FUMIPRO S.A')).toBe('COMPROBANTE_PAGO');
      expect(clasificarPorNombre('BOLETA DE PG CUOTA INICIAL - FUMIPRO SA.pdf')).toBe(
        'COMPROBANTE_PAGO',
      );
      expect(clasificarPorNombre('FACILIDAD DE PAGO - FUMIPRO SA.pdf')).toBe('COMPROBANTE_PAGO');
      expect(clasificarPorNombre('06 2026 - PAGO FRACCIONAMIENTO IVA.pdf')).toBe(
        'COMPROBANTE_PAGO',
      );
    });

    // CCT = Certificado de Cumplimiento Tributario. 49 archivos reales.
    it('entiende CCT como certificado', () => {
      expect(clasificarPorNombre('CCT VIGENTE 05 2026 - FUMIPRO SA.pdf')).toBe('CERTIFICADO');
      expect(clasificarPorNombre('CCT 02092026.pdf')).toBe('CERTIFICADO');
    });

    // Va antes que la regla de formularios: sin eso, "FOR 122" se los llevaba
    // como declaración jurada.
    it('entiende RET abreviado en los formularios de la DNIT', () => {
      expect(clasificarPorNombre('FOR 122 RET IVA MAYO 2026.pdf')).toBe('RETENCION');
      expect(clasificarPorNombre('FORM 525 RET RENTA MAYO 2026.pdf')).toBe('RETENCION');
    });

    it('una comunicación asamblearia es un acta', () => {
      expect(clasificarPorNombre('drfs-006---comunicacion-asamblearia--8132355.pdf')).toBe('ACTA');
    });
  });
});
