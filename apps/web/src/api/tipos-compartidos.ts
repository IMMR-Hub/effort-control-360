/**
 * Tipos de dominio que reaparecen en más de un módulo de la API.
 *
 * `TipoDocumento` lo usan tanto Documentos como Vencimientos (una obligación
 * societaria es, para el servidor, el mismo enum que un comprobante). `NivelRiesgo`
 * lo usan Proceso Mensual y Vencimientos. Viven acá una sola vez para no repetir
 * la lista de dieciséis valores en cada pantalla nueva que los necesite.
 */

export type TipoDocumento =
  | 'FACTURA_COMPRA'
  | 'FACTURA_VENTA'
  | 'RECIBO'
  | 'RETENCION'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'EXTRACTO_BANCARIO'
  | 'COMPROBANTE_PAGO'
  | 'CONTRATO'
  | 'PODER'
  | 'ACTA'
  | 'ESTATUTO'
  | 'CERTIFICADO'
  | 'CONSTANCIA'
  | 'LIQUIDACION'
  | 'OTRO';

export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
