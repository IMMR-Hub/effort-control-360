/**
 * Reconoce una presentación ante la DNIT a partir del texto de su PDF.
 *
 * Existe por una pregunta de Daniel del 2026-09-14: *"¿por qué tenés 0 de 150?
 * ¿No encontraste los documentos de que se presentó?"*. Los documentos estaban
 * —la sincronización los había traído— pero nada los cruzaba con los
 * vencimientos, y el motor de alertas avisaba "vencido sin presentar" de
 * declaraciones que EFFORT había presentado a tiempo.
 *
 * ---
 *
 * **Por qué se lee el CONTENIDO y no el nombre del archivo.** Se intentó por
 * nombre primero y no alcanza, con casos reales:
 *
 *  - `DET DE IMPUESTO IVA AGOSTO 2026 - FUMIPRO SA.pdf` suena a declaración y
 *    es una planilla de trabajo: su texto dice "CALCULO AUXILIAR PARA
 *    DETERMINACION DE IVA".
 *  - `PROFORMA DDJJ 500 REC 2025.pdf` dice DDJJ y es un borrador.
 *  - `DDJJ MARZO 2026 - FUMIPRO SA.pdf` no dice de qué impuesto es.
 *
 * Marcar algo como presentado apaga la alerta de su vencimiento. Un falso
 * positivo acá es el peor error posible del sistema: calla justo el aviso que
 * evita una multa. Por eso solo se reconoce lo que trae la marca inequívoca de
 * la DNIT — número de orden y fecha de presentación — y todo lo demás se ignora.
 *
 * ---
 *
 * Los dos formatos reconocidos salieron de PDFs reales de los cinco clientes:
 *
 *  1. **Declaración jurada normalizada** (IVA 120, IRE 500, Estados
 *     Financieros 158): `DECLARACIÓN JURADA NORMALIZADA Formulario:120 V4
 *     Contribuyente: 80119631 Control: 984308fd Fecha: 09/04/2026 15:00 …
 *     Número de Orden 12087502762 … Periodo / Ejercicio Fiscal Mes Año 0 3 2 0 2 6`.
 *  2. **Talón de presentación de la RG 90** (formulario 241):
 *     `FORM.241-1 … NÚMERO 24114835850 FECHA 08/05/2024 TALÓN DE PRESENTACIÓN
 *     REGISTRO DE COMPROBANTES … RUC: 80003112 … PERIODO/EJERCICIO FISCAL: 02/2024`.
 *
 * El impreso "ESTADOS FINANCIEROS" que se baja de Marangatú NO se reconoce: no
 * trae número de orden ni fecha de presentación, y sin fecha no se puede saber
 * si se presentó a tiempo.
 */

export interface DeclaracionDnit {
  /** Número de formulario de la DNIT: `120`, `500`, `158`, `241`. */
  readonly formulario: string;
  /** RUC del contribuyente, SIN dígito verificador. */
  readonly ruc: string;
  /** `AAAA-MM` para mensuales; `AAAA-12` para anuales (el ejercicio que cierra). */
  readonly periodo: string;
  readonly numeroDeOrden: string;
  /** Fecha de presentación, `AAAA-MM-DD`. */
  readonly fechaDePresentacion: string;
}

/** Qué obligación del sistema prueba cada formulario. */
export const OBLIGACION_POR_FORMULARIO: Readonly<Record<string, string>> = {
  '120': 'IVA_GENERAL',
  '500': 'IRE',
  '158': 'EEFF',
  '241': 'PLANILLA_RG90',
};

/** Formularios anuales: su período es un ejercicio, no un mes. */
const ANUALES = new Set(['500', '158']);

function fechaIso(ddmmaaaa: string): string {
  const [dia, mes, anio] = ddmmaaaa.split('/');
  return `${anio}-${mes!.padStart(2, '0')}-${dia!.padStart(2, '0')}`;
}

function reconocerNormalizada(texto: string): DeclaracionDnit | null {
  if (!/DECLARACI[ÓO]N JURADA NORMALIZADA/i.test(texto)) return null;

  const formulario = texto.match(/Formulario:\s*(\d{3})/i)?.[1];
  const ruc = texto.match(/Contribuyente:\s*(\d{5,9})/i)?.[1];
  const fecha = texto.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];
  const orden = texto.match(/N[úu]mero de Orden\s+(\d{8,15})/i)?.[1];
  if (!formulario || !ruc || !fecha || !orden) return null;

  // El período viene con los dígitos separados por espacios, uno por casilla
  // del formulario: "Mes Año 0 3 2 0 2 6" o, en los anuales, "2 0 2 3".
  const casillas = texto.match(/Periodo\s*\/\s*Ejercicio Fiscal\s*(?:Mes\s+A[ñn]o\s*)?((?:\d\s*){4,6})/i)?.[1];
  const digitos = casillas?.replace(/\s+/g, '') ?? '';

  let periodo: string | null = null;
  if (ANUALES.has(formulario)) {
    // En los anuales solo interesan los cuatro dígitos del año, aunque el
    // formulario deje casillas de mes vacías o en cero adelante.
    const anio = digitos.slice(-4);
    if (/^\d{4}$/.test(anio)) periodo = `${anio}-12`;
  } else if (digitos.length >= 6) {
    const mes = digitos.slice(0, 2);
    const anio = digitos.slice(2, 6);
    if (Number(mes) >= 1 && Number(mes) <= 12) periodo = `${anio}-${mes}`;
  }
  if (!periodo) return null;

  return { formulario, ruc, periodo, numeroDeOrden: orden, fechaDePresentacion: fechaIso(fecha) };
}

function reconocerTalonRg90(texto: string): DeclaracionDnit | null {
  if (!/TAL[ÓO]N DE PRESENTACI[ÓO]N/i.test(texto) || !/FORM\.?\s*241/i.test(texto)) return null;

  const numero = texto.match(/N[ÚU]MERO\s+(\d{8,15})/i)?.[1];
  const fecha = texto.match(/FECHA\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];
  const ruc = texto.match(/RUC:\s*(\d{5,9})/i)?.[1];
  const periodo = texto.match(/PERIODO\s*\/\s*EJERCICIO FISCAL:\s*(\d{1,2})\/(\d{4})/i);
  if (!numero || !fecha || !ruc || !periodo) return null;

  return {
    formulario: '241',
    ruc,
    periodo: `${periodo[2]}-${periodo[1]!.padStart(2, '0')}`,
    numeroDeOrden: numero,
    fechaDePresentacion: fechaIso(fecha),
  };
}

/**
 * Lee el texto de un PDF y dice si es una presentación ante la DNIT.
 *
 * Devuelve `null` ante cualquier duda —falta el número de orden, la fecha, el
 * período o el RUC—. Callar una presentación verdadera deja una alerta de más,
 * que una persona resuelve mirándola; inventar una apaga una alerta que no se
 * vuelve a ver.
 */
export function reconocerDeclaracionDnit(texto: string): DeclaracionDnit | null {
  const plano = texto.replace(/\s+/g, ' ');
  // Un borrador nunca prueba nada, aunque copie la estructura del formulario.
  if (/\bPROFORMA\b|\bBORRADOR\b|SIN VALIDEZ/i.test(plano)) return null;
  return reconocerNormalizada(plano) ?? reconocerTalonRg90(plano);
}
