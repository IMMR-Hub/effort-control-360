/**
 * Reconocimiento de presentaciones ante la DNIT.
 *
 * Los textos son los extraídos de PDFs reales del OneDrive de EFFORT el
 * 2026-09-14, recortados. Lo que más importa probar no es que reconozca las
 * declaraciones, sino que NO reconozca lo que se les parece: una planilla de
 * cálculo o un borrador marcados como "presentado" apagarían una alerta real.
 */

import { describe, expect, it } from 'vitest';

import { reconocerDeclaracionDnit } from '../src/declaracionDnit.js';

const IVA_FUMIPRO =
  'DECLARACIÓN JURADA NORMALIZADA Formulario:120 V4 Contribuyente: 80119631 Control: 984308fd ' +
  'Fecha: 09/04/2026 15:00 Presentado por: INTER IMPUESTO AL VALOR AGREGADO VERSION 4 V.4 Enero/2020 ' +
  '120 PARA LLENAR LEA EL INSTRUCTIVO DISPONIBLE EN LA WEB LOS IMPORTES SE CONSIGNARÁN SIN CÉNTIMOS ' +
  'Número de Orden 12087502762 RUC 80119631 DV 0 Razón Social/Primer Apellido FUMIPRO S.A. Segundo ' +
  'Apellido Nombres 01 Declaración Jurada Original Número de Orden de Declaración se rectifica 02 ' +
  'Declaración Jurada Rectificativa 03 0 05 Declaración Jurada en Carácter de Cese de Actividades, ' +
  'Clausura o Cierre Definitivo 04 Periodo / Ejercicio Fiscal Mes Año 0 3 2 0 2 6 PARA CONTRIBUYENTES';

const EEFF_DIBEC =
  'DECLARACIÓN JURADA NORMALIZADA Formulario:158 V2 Contribuyente: 80082006 Control: 90390929 ' +
  'Fecha: 20/08/2024 15:47 Presentado por: INTAUT ESTADOS FINANCIEROS VERSIÓN 2 158 PARA LLENAR LEA ' +
  'EL INSTRUCTIVO DISPONIBLE EN LA WEB LOS IMPORTES SE CONSIGNARÁN SIN CENTIMOS Numero de Orden ' +
  '15801339932 RUC 80082006 DV 1 Razón Social/Primer Apellido DIBEC SOCIEDAD ANONIMA Segundo Apellido ' +
  'Nombres 04 Periodo / Ejercicio Fiscal 2 0 2 3 DATOS DEL CONTADOR';

const TALON_RG90_COPESA =
  'FORM.241-1 DIRECCIÓN NACIONAL DE INGRESOS TRIBUTARIOS GERENCIA GENERAL DE IMPUESTOS INTERNOS ' +
  'NÚMERO 24114835850 FECHA 08/05/2024 TALÓN DE PRESENTACIÓN REGISTRO DE COMPROBANTES 1- DATOS ' +
  'GENERALES RUC: 80003112 DV: 1 NOMBRE O RAZÓN SOCIAL: COPESA CONSTRUCCIONES SA 2- DATOS DE LA ' +
  'DECLARACIÓN JURADA INFORMATIVA PERIODO/EJERCICIO FISCAL: 02/2024 Declaro bajo fe de juramento';

describe('reconocimiento de presentaciones ante la DNIT', () => {
  it('reconoce una declaración de IVA con su período, número de orden y fecha', () => {
    expect(reconocerDeclaracionDnit(IVA_FUMIPRO)).toEqual({
      formulario: '120',
      ruc: '80119631',
      periodo: '2026-03',
      numeroDeOrden: '12087502762',
      fechaDePresentacion: '2026-04-09',
      fechaAproximada: false,
    });
  });

  it('reconoce los estados financieros como anuales, en el período 12 del ejercicio', () => {
    expect(reconocerDeclaracionDnit(EEFF_DIBEC)).toMatchObject({
      formulario: '158',
      periodo: '2023-12',
      numeroDeOrden: '15801339932',
      fechaDePresentacion: '2024-08-20',
    });
  });

  it('reconoce el talón de presentación de la RG 90', () => {
    expect(reconocerDeclaracionDnit(TALON_RG90_COPESA)).toEqual({
      formulario: '241',
      ruc: '80003112',
      periodo: '2024-02',
      numeroDeOrden: '24114835850',
      fechaDePresentacion: '2024-05-08',
      fechaAproximada: false,
    });
  });

  /*
   * Caso real: COPESA 2026, "TALON DE PRESENTACION/01-2026.pdf". No es el
   * talón: es el aviso del buzón de Marangatú impreso desde el navegador. El
   * número de orden prueba la presentación; la fecha es la de impresión, así
   * que sale marcada como aproximada.
   */
  it('reconoce el aviso del buzón de Marangatú, con la fecha como aproximada', () => {
    const aviso =
      'ESTIMADO CONTRIBUYENTE: COPESA CONSTRUCCIONES SA RUC 80003112 DV 1 LA SUBSECRETARÍA DE ESTADO ' +
      'DE TRIBUTACIÓN LE INFORMA QUE SE GENERÓ EL FORMULARIO 241- TALÓN DE PRESENTACIÓN REGISTRO DE ' +
      'COMPROBANTES, CORRESPONDIENTE AL PERIODO/EJERCICIO 01/2026 , CON ORDEN N° 24132314007 . ' +
      'Subsecretaría De Estado De Tributación 17/3/26, 9:28 Ver Mensaje | MARANGATU ' +
      'https://marangatu.set.gov.py/eset/buzonVerMensaje.do 1/1';

    expect(reconocerDeclaracionDnit(aviso)).toEqual({
      formulario: '241',
      ruc: '80003112',
      periodo: '2026-01',
      numeroDeOrden: '24132314007',
      fechaDePresentacion: '2026-03-17',
      fechaAproximada: true,
    });
  });

  /*
   * Caso real: "DET DE IMPUESTO IVA AGOSTO 2026 - FUMIPRO SA.pdf". El nombre
   * parece una declaración; el contenido es la planilla de cálculo previa.
   */
  it('no confunde una planilla de cálculo del IVA con una declaración', () => {
    const planilla =
      'CONTRIBUYENTE RUC PERIODO CALCULO: GRAVADA IVA TOTAL VENTAS EXENTAS 990.000 (+) IVA DEBITO ' +
      'FISCAL 10% 223.569.097 SALDO A PAGAR AL FISCO 6.743.046 CALCULO AUXILIAR PARA DETERMINACION ' +
      'DE IVA FUMIPRO S.A 80119631-0 MAYO_2025';
    expect(reconocerDeclaracionDnit(planilla)).toBeNull();
  });

  it('no toma un borrador como presentación, aunque copie el formulario', () => {
    expect(reconocerDeclaracionDnit(`PROFORMA ${IVA_FUMIPRO}`)).toBeNull();
  });

  // Ante la duda, nada: sin número de orden no hay prueba de presentación.
  it('sin número de orden no reconoce nada', () => {
    expect(reconocerDeclaracionDnit(IVA_FUMIPRO.replace('Número de Orden 12087502762', ''))).toBeNull();
  });

  /*
   * El impreso de Marangatú "ESTADOS FINANCIEROS" es el balance cargado, pero
   * no dice cuándo se presentó: no alcanza para saber si fue a tiempo.
   */
  it('no reconoce el impreso de estados financieros sin número de orden', () => {
    const impreso =
      'SUBSECRETARIA DE ESTADO DE TRIBUTACION ESTADOS FINANCIEROS 1. DATOS GENERALES DEL CONTRIBUYENTE ' +
      'NOMBRE O RAZÓN SOCIAL RUC DV ESTADO COPESA CONSTRUCCIONES SA 80003112 1 ACTIVO 2. PERIODO PERIODO ' +
      'VERSION 2023 3.2.2';
    expect(reconocerDeclaracionDnit(impreso)).toBeNull();
  });
});
