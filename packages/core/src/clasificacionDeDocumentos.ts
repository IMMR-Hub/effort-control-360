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
  /*
   * Pagos primero: casi siempre el nombre menciona también el impuesto pagado.
   *
   * Las variantes de abajo NO son hipótesis: son los nombres que EFFORT usa de
   * verdad, sacados de los 1024 documentos reales al reclasificarlos el
   * 2026-09-12. Incluye `bole+ta` con la "e" repetida a propósito — hay varios
   * archivos llamados "BOLEETA DE PAGO", y un clasificador que solo entiende
   * nombres bien escritos no sirve para archivos que escribe una persona
   * apurada. Lo mismo con "PG" por "pago" y "FAC" por "facilidad".
   */
  {
    tipo: 'COMPROBANTE_PAGO',
    patron:
      /\b(bole+ta\s*(fac\s*)?(de\s*)?(pago|pg)|comprobante\s*de\s*pago|facilidad(es)?\s*de\s*pago|pago\s+(de\s+)?(iva|ire|irp|anticip|fraccionamiento)|anticip\w*\s+(de\s+)?(iva|ire|irp)|op\s)/i,
  },

  { tipo: 'EXTRACTO_BANCARIO', patron: /\bextracto/i },
  // "RET" abreviado aparece en los formularios de la DNIT: "FOR 122 RET IVA",
  // "FORM 525 RET RENTA". Va antes que la regla de formularios, que si no se
  // los queda como declaración jurada.
  { tipo: 'RETENCION', patron: /\bretenc|\bret\s+(iva|renta|irp|ire)\b/i },
  { tipo: 'NOTA_CREDITO', patron: /\bnota\s*de\s*cr[eé]dito/i },
  { tipo: 'NOTA_DEBITO', patron: /\bnota\s*de\s*d[eé]bito/i },

  /*
   * `(?![a-záéíóúñ])` al cerrar, en vez de `\b`, y la diferencia no es
   * cosmética: `\b` exige un borde de palabra, y entre la "s" de "compras" y un
   * dígito pegado NO hay borde. Por eso "Compras02.pdf" y "Ventas02.pdf"
   * —nombres reales de COPESA— quedaban en "Otro" mientras
   * "COMPRAS 02 2026.xlsx" sí clasificaba: el mismo documento, nombrado
   * distinto. Con esto se acepta un número pegado y se sigue rechazando otra
   * palabra ("comprasiones" no es un libro de compras).
   */
  { tipo: 'LIBRO_COMPRAS', patron: /\b(libro\s*de\s*)?compras(?![a-záéíóúñ])/i },
  { tipo: 'LIBRO_VENTAS', patron: /\b(libro\s*de\s*)?ventas(?![a-záéíóúñ])/i },
  /*
   * Abreviaturas reales de COPESA (2026-09-14): "L.V JULIO.pdf", "LC 2025.OK.pdf",
   * "LC RECT..pdf", y el export de SIGA "LIBIVACOMP_V4.csv". Anclado al inicio
   * del nombre: "LC" suelto en medio de otro texto no alcanza para decidir.
   */
  { tipo: 'LIBRO_COMPRAS', patron: /^\s*l\s?c\b|\blibiva\s*comp/i },
  { tipo: 'LIBRO_VENTAS', patron: /^\s*l\s?v\b|\blibiva\s*vent/i },

  { tipo: 'ESTADO_RESULTADOS', patron: /\bestado\s*de\s*resultado/i },
  { tipo: 'BALANCE', patron: /\bbalance\b|\beeff\b|\bestados?\s*financiero/i },
  /*
   * Una liquidación es el cálculo del impuesto del período. EFFORT la nombra
   * "CALCULO IRE GENERAL CIERRE 2025" y "PROFORMA IVA 062026 DIBEC SA" en sus
   * archivos reales, y eso es literalmente lo que son.
   *
   * **"Determinación" NO entra acá**, y el intento de agregarla enseñó algo: ya
   * estaba mapeada a declaración jurada desde antes, con su propio test, y la
   * planilla de determinación ES la declaración. Meterla en esta regla —que va
   * primero— se la robaba a una regla que estaba bien. El test viejo lo agarró
   * en el acto.
   *
   * Lo que también se dejó afuera a propósito son las siglas ambiguas que
   * aparecen cientos de veces en los mismos archivos: "REC" (¿recibo?,
   * ¿reconciliación?), "IPS" (seguridad social, que no es un tipo del sistema)
   * y "Ver Documento - MARANGATU" (dice de dónde salió, no qué es). Ahí sí
   * habría que adivinar, y sin clasificar es mejor que mal clasificado.
   */
  {
    tipo: 'LIQUIDACION',
    patron: /\bliquidaci[oó]n|\bc[aá]lculo\s*(de\s*)?(iva|ire|irp)|\bproforma\s*(de\s*)?(iva|ire|irp)/i,
  },

  // "Planilla de determinación", declaraciones juradas, formularios de la DNIT.
  // `DET DE IMPUESTO` es cómo EFFORT abrevia "determinación de impuesto" en sus
  // archivos: es el mismo documento, así que va con la declaración y no aparte.
  {
    tipo: 'DECLARACION_JURADA',
    patron:
      /\bplanilla|\bdeterminaci[oó]n|\bdet\s+de\s+impuesto|declaraci[oó]n\s*jurada|\bddjj\b|\bformulario\s*\d|\bnormalizada\b/i,
  },

  { tipo: 'FACTURA_VENTA', patron: /\bfactura.*\bventa|\bventa.*\bfactura/i },
  { tipo: 'FACTURA_COMPRA', patron: /\bfactura/i },
  { tipo: 'RECIBO', patron: /\brecibo/i },

  { tipo: 'ESTATUTO', patron: /\bestatuto/i },
  { tipo: 'ACTA', patron: /\bacta\b|\basamblea\w*\b|\bdirectorio\b|\bconvocatoria\b/i },
  { tipo: 'PODER', patron: /\bpoder\b/i },
  { tipo: 'CONTRATO', patron: /\bcontrato\b/i },
  // `CCT` es el Certificado de Cumplimiento Tributario, y es la sigla con la que
  // EFFORT nombra 49 de sus archivos reales ("CCT VIGENTE 05 2026", "CCT
  // 02092026"). Sin esto quedaban todos como "Otro".
  // `cert` abreviado además de la palabra completa: "Cert Cumplimiento.pdf" es
  // un nombre real de COPESA.
  { tipo: 'CERTIFICADO', patron: /\bcertificad|\bcert\b|\bcct\b/i },
  { tipo: 'CONSTANCIA', patron: /\bconstancia|\bc[eé]dula\s*tributaria/i },
];

/**
 * Reglas por CARPETA, para cuando el nombre del archivo no dice nada.
 *
 * El 2026-09-14 quedaban 2.415 de 3.963 documentos como "Otro", y mirándolos
 * el problema no era el clasificador sino los nombres: "ENERO.pdf",
 * "05 MAYO.xlsx", "526-06-2025.pdf". Lo que dice qué son es dónde están —
 * "NOTAS DE CREDITO" (193 archivos), "EXTRACTOS BANCARIOS", "RG 90 COMPRAS",
 * "FORM 120"—.
 *
 * Solo carpetas cuyo nombre es inequívoco. Se dejaron afuera a propósito
 * "FACTURAS ESCANEADAS" y "FC DECLARADO" (¿compra o venta?), "LIQUIDACION DE
 * IMPORTACION" (es un despacho aduanero, no una liquidación de impuesto) y
 * "FORM 526" (no se confirmó qué formulario es). Sin clasificar es mejor que
 * mal clasificado.
 */
const REGLAS_POR_CARPETA: readonly { readonly tipo: TipoDeDocumento; readonly patron: RegExp }[] = [
  { tipo: 'NOTA_CREDITO', patron: /\bnotas?\s*de\s*cr[eé]dito|\bnc\s+(emitidas|recibidas)\b/i },
  { tipo: 'EXTRACTO_BANCARIO', patron: /\bextractos?\s*bancario/i },
  { tipo: 'LIBRO_COMPRAS', patron: /\brg\s*\d*\s*compras\b|\blibro\s*(de\s*)?compras?\b/i },
  { tipo: 'LIBRO_VENTAS', patron: /\brg\s*\d*\s*ventas\b|\blibro\s*(de\s*)?ventas?\b/i },
  // 122 y 525 son formularios de retención: ya estaban así en las reglas por
  // nombre ("FOR 122 RET IVA", "FORM 525 RET RENTA").
  { tipo: 'RETENCION', patron: /\bform(ulario)?\s*(122|525)\b/i },
  { tipo: 'DECLARACION_JURADA', patron: /\bform(ulario)?\s*120\b|\bddjj\s+iva\b/i },
  { tipo: 'ACTA', patron: /\basamblea/i },
  { tipo: 'CERTIFICADO', patron: /\bcct\b/i },
];

/** Cuántas carpetas hacia arriba se mira. Más arriba ya es "DOCUMENTOS CONTABLES". */
const NIVELES_DE_CARPETA = 3;

/**
 * Tipo de un documento por su nombre y, si el nombre no alcanza, por la carpeta.
 *
 * El nombre manda siempre: un "BOLETA DE PAGO IVA.pdf" guardado dentro de
 * "DDJJ IVA 2025" es un comprobante de pago, no una declaración. La carpeta solo
 * decide lo que el nombre dejó en "Otro", mirando de la más cercana hacia arriba.
 */
export function clasificarDocumento(nombreArchivo: string, rutaCarpeta: string): TipoDeDocumento {
  const porNombre = clasificarPorNombre(nombreArchivo);
  if (porNombre !== 'OTRO') return porNombre;

  const carpetas = rutaCarpeta.split('/').filter(Boolean).reverse().slice(0, NIVELES_DE_CARPETA);
  for (const carpeta of carpetas) {
    // "FORM. 122" y "FORM_120" tienen que leerse como "FORM 122".
    const normalizada = carpeta.replace(/[_.-]+/g, ' ');
    for (const regla of REGLAS_POR_CARPETA) {
      if (regla.patron.test(normalizada)) return regla.tipo;
    }
  }

  return 'OTRO';
}

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
