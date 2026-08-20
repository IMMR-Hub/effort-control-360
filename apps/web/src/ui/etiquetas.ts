/**
 * Etiquetas y tonos de badge para los enums compartidos entre pantallas.
 * Ver `../api/tipos-compartidos.ts` para los tipos.
 */

import type { NivelRiesgo, TipoDocumento } from '../api/tipos-compartidos.js';

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  FACTURA_COMPRA: 'Factura de compra',
  FACTURA_VENTA: 'Factura de venta',
  RECIBO: 'Recibo',
  RETENCION: 'Retención',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
  EXTRACTO_BANCARIO: 'Extracto bancario',
  COMPROBANTE_PAGO: 'Comprobante de pago',
  CONTRATO: 'Contrato',
  PODER: 'Poder',
  ACTA: 'Acta',
  ESTATUTO: 'Estatuto',
  CERTIFICADO: 'Certificado',
  CONSTANCIA: 'Constancia',
  LIQUIDACION: 'Liquidación',
  OTRO: 'Otro',
};

export const OPCIONES_TIPO_DOCUMENTO = Object.entries(ETIQUETA_TIPO_DOCUMENTO).map(
  ([valor, etiqueta]) => ({ valor, etiqueta }),
);

export const TONO_RIESGO: Record<NivelRiesgo, 'completo' | 'pendiente' | 'parcial' | 'critico'> = {
  BAJO: 'completo',
  MEDIO: 'pendiente',
  ALTO: 'parcial',
  CRITICO: 'critico',
};

export const OPCIONES_RIESGO = Object.keys(TONO_RIESGO).map((v) => ({ valor: v, etiqueta: v }));
