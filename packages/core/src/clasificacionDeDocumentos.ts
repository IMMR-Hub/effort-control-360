/**
 * Clasificación de un documento por el nombre de su archivo.
 *
 * Los documentos que EFFORT guarda en OneDrive no vienen etiquetados: son
 * archivos con el nombre que les puso la persona que los guardó. Este módulo
 * los reconoce por ese nombre, que es lo único disponible sin leer el
 * contenido.
 *
 * **Qué NO hace esto:** no lee el PDF ni extrae importes. Reconocer que un
 * archivo se llama "BALANCE 2025.pdf" no es lo mismo que saber qué dice
 * adentro; para eso hace falta el extractor, que está fuera de alcance
 * (`CLAUDE.md`). Lo que sí resuelve es que el documento deje de figurar como
 * "Otro": con 831 de 1023 documentos sin tipo, la pantalla no le sirve a nadie.
 *
 * Cuando el nombre no alcanza para decidir con confianza, devuelve `OTRO`. Es
 * preferible un documento sin clasificar a uno mal clasificado: alguien puede
 * corregir el primero, y del segundo nadie sospecha.
 */

export type TipoDeDocumento =
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
  | 'BALANCE'
  | 'ESTADO_RESULTADOS'
  | 'DECLARACION_JURADA'
  | 'LIBRO_COMPRAS'
  | 'LIBRO_VENTAS'
  | 'OTRO';

/**
 * Reglas, en orden. La PRIMERA que coincide gana, así que el orden importa:
 * las más específicas van antes que las más generales.
 *
 * Ejemplo real de por qué: "BOLETA DE PAGO ANTICIPO IRE" contiene tanto
 * "boleta de pago" (comprobante) como "IRE" (declaración). Es un comprobante
 * de pago de un anticipo, no la declaración, así que la regla del pago va
 * primero.
 */
const REGLAS: readonly { readonly tipo: TipoDeDocumento; readonly patron: RegExp }[] = [
  // Pagos primero: casi siempre el nombre menciona también el impuesto pagado.
  { tipo: 'COMPROBANTE_PAGO', patron: /\b(boleta\s*de\s*pago|comprobante\s*de\s*pago|pago\s+(de\s+)?(iva|ire|irp|anticipo)|op\s)/i },

  { tipo: 'EXTRACTO_BANCARIO', patron: /\bextracto/i },
  { tipo: 'RETENCION', patron: /\bretenc/i },
  { tipo: 'NOTA_CREDITO', patron: /\bnota\s*de\s*cr[eé]dito/i },
  { tipo: 'NOTA_DEBITO', patron: /\bnota\s*de\s*d[eé]bito/i },

  { tipo: 'LIBRO_COMPRAS', patron: /\b(libro\s*de\s*)?compras\b/i },
  { tipo: 'LIBRO_VENTAS', patron: /\b(libro\s*de\s*)?ventas\b/i },

  { tipo: 'ESTADO_RESULTADOS', patron: /\bestado\s*de\s*resultado/i },
  { tipo: 'BALANCE', patron: /\bbalance\b|\beeff\b|\bestados?\s*financiero/i },
  { tipo: 'LIQUIDACION', patron: /\bliquidaci[oó]n/i },

  // "Planilla de determinación", declaraciones juradas, formularios de la DNIT.
  { tipo: 'DECLARACION_JURADA', patron: /\bplanilla|\bdeterminaci[oó]n|declaraci[oó]n\s*jurada|\bddjj\b|\bformulario\s*\d/i },

  { tipo: 'FACTURA_VENTA', patron: /\bfactura.*\bventa|\bventa.*\bfactura/i },
  { tipo: 'FACTURA_COMPRA', patron: /\bfactura/i },
  { tipo: 'RECIBO', patron: /\brecibo/i },

  { tipo: 'ESTATUTO', patron: /\bestatuto/i },
  { tipo: 'ACTA', patron: /\bacta\b|\basamblea\b|\bdirectorio\b|\bconvocatoria\b/i },
  { tipo: 'PODER', patron: /\bpoder\b/i },
  { tipo: 'CONTRATO', patron: /\bcontrato\b/i },
  { tipo: 'CERTIFICADO', patron: /\bcertificad/i },
  { tipo: 'CONSTANCIA', patron: /\bconstancia|\bc[eé]dula\s*tributaria/i },
];

/**
 * Deduce el tipo de un documento a partir del nombre de su archivo.
 *
 * Se le saca la extensión antes de comparar: un archivo llamado
 * "ACTA.pdf" no debe confundirse por el ".pdf", y algunos clientes guardan el
 * mismo documento como .pdf y .xls con el mismo nombre.
 */
export function clasificarPorNombre(nombreArchivo: string): TipoDeDocumento {
  const sinExtension = nombreArchivo.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  // Los guiones bajos y los puntos separan palabras tanto como los espacios:
  // "BOLETA_DE_PAGO_IVA" tiene que reconocerse igual que con espacios.
  const normalizado = sinExtension.replace(/[_.-]+/g, ' ');

  for (const regla of REGLAS) {
    if (regla.patron.test(normalizado)) return regla.tipo;
  }

  return 'OTRO';
}
