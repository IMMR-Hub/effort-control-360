/**
 * Tipos de dominio que reaparecen en más de un módulo de la API.
 *
 * `TipoDocumento` lo usan tanto Documentos como Vencimientos (una obligación
 * societaria es, para el servidor, el mismo enum que un comprobante). `NivelRiesgo`
 * lo usan Proceso Mensual y Vencimientos. Viven acá una sola vez para no repetir
 * la lista de veintiún valores en cada pantalla nueva que los necesite.
 *
 * **Esta lista tiene que coincidir con `TipoDeDocumento` de `@effort/core`**
 * (`packages/core/src/clasificacionDeDocumentos.ts`), que es donde el
 * clasificador decide qué tipo lleva cada archivo. No están unificadas porque
 * la interfaz no importa código del servidor, así que la única red es el
 * chequeo de tipos: `ETIQUETA_TIPO_DOCUMENTO` es un `Record` completo y
 * cualquier valor que falte acá lo hace fallar. Fue justamente lo que pasó el
 * 2026-09-12 con los cinco tipos de abajo.
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
  // Los que EFFORT nombró como los que más importan: balance, IRE, EEFF.
  | 'BALANCE'
  | 'ESTADO_RESULTADOS'
  | 'DECLARACION_JURADA'
  | 'LIBRO_COMPRAS'
  | 'LIBRO_VENTAS'
  | 'OTRO';

export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export type TasaIva = 'DIEZ' | 'CINCO' | 'EXENTA';

/** Canal por el que EFFORT recibe o envía algo — mismos cinco valores en todo el dominio. */
export type CanalRecepcion = 'WHATSAPP' | 'EMAIL' | 'ONEDRIVE' | 'FISICO_ESCANEADO' | 'SISTEMA';
