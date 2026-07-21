/**
 * Fechas y vencimientos.
 *
 * Todo el control de vencimientos se calcula en la zona horaria de Paraguay.
 * Un vencimiento que cae "mañana" para el servidor puede ser "hoy" para EFFORT
 * si el servidor corre en otra zona; con multas de por medio, esa diferencia
 * de un día es exactamente el problema que el sistema existe para evitar.
 *
 * La zona se resuelve con la base de datos IANA vía `Intl`, no con un offset
 * fijo de -3 horas. Aunque Paraguay hoy no aplica horario de verano, codificar
 * el offset dejaría al sistema en silencio equivocado si esa regla cambia.
 */

export const ZONA_PARAGUAY = 'America/Asuncion';

/** Fecha civil sin hora: lo único que importa para un vencimiento. */
export interface FechaCivil {
  readonly anio: number;
  /** 1-12. */
  readonly mes: number;
  /** 1-31. */
  readonly dia: number;
}

export class ErrorDeFecha extends Error {
  override readonly name = 'ErrorDeFecha';
}

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parsea "AAAA-MM-DD" y valida que la fecha exista realmente. */
export function fechaCivilDesdeIso(iso: string): FechaCivil {
  const partes = FORMATO_ISO.exec(iso.trim());
  if (!partes) {
    throw new ErrorDeFecha(`Fecha con formato inválido: "${iso}". Se espera AAAA-MM-DD.`);
  }

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  // Rechaza fechas que no existen (31 de febrero, 29/02 en año no bisiesto):
  // Date.UTC normaliza en silencio, así que se compara el resultado.
  const normalizada = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    normalizada.getUTCFullYear() !== anio ||
    normalizada.getUTCMonth() !== mes - 1 ||
    normalizada.getUTCDate() !== dia
  ) {
    throw new ErrorDeFecha(`Fecha inexistente: "${iso}"`);
  }

  return { anio, mes, dia };
}

export function fechaCivilAIso(fecha: FechaCivil): string {
  const mes = String(fecha.mes).padStart(2, '0');
  const dia = String(fecha.dia).padStart(2, '0');
  return `${fecha.anio}-${mes}-${dia}`;
}

/** Fecha civil en Paraguay correspondiente a un instante dado. */
export function hoyEnParaguay(instante: Date, zona: string = ZONA_PARAGUAY): FechaCivil {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);

  const buscar = (tipo: Intl.DateTimeFormatPartTypes): number => {
    const parte = partes.find((p) => p.type === tipo);
    if (!parte) {
      throw new ErrorDeFecha(`No se pudo resolver "${tipo}" en la zona ${zona}`);
    }
    return Number(parte.value);
  };

  return { anio: buscar('year'), mes: buscar('month'), dia: buscar('day') };
}

const MILISEGUNDOS_POR_DIA = 86_400_000;

/** Convierte una fecha civil al instante UTC de su medianoche, para poder restar. */
function aMedianocheUtc(fecha: FechaCivil): number {
  return Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia);
}

/**
 * Días calendario entre dos fechas civiles (destino - origen).
 *
 * Se comparan medianoches UTC de fechas civiles, no instantes reales, así que
 * el resultado es siempre un entero exacto y no lo afectan husos ni horarios de verano.
 */
export function diasEntre(origen: FechaCivil, destino: FechaCivil): number {
  return (aMedianocheUtc(destino) - aMedianocheUtc(origen)) / MILISEGUNDOS_POR_DIA;
}

/**
 * Días que faltan para un vencimiento.
 * Negativo si ya venció, 0 si vence hoy.
 */
export function diasRestantes(
  fechaVencimiento: FechaCivil,
  instanteActual: Date,
  zona: string = ZONA_PARAGUAY,
): number {
  return diasEntre(hoyEnParaguay(instanteActual, zona), fechaVencimiento);
}

export type NivelAlerta = 'VENCIDO' | 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFORMATIVA' | 'SIN_ALERTA';

/**
 * Umbrales por defecto, en días restantes. Cada obligación puede sobreescribir
 * `dias_alerta` en la matriz de obligaciones; estos valores son el piso.
 */
export const UMBRALES_ALERTA = Object.freeze({
  critica: 2,
  alta: 7,
  media: 15,
  informativa: 30,
});

export function nivelAlertaPorDias(
  dias: number,
  umbrales: typeof UMBRALES_ALERTA = UMBRALES_ALERTA,
): NivelAlerta {
  if (dias < 0) return 'VENCIDO';
  if (dias <= umbrales.critica) return 'CRITICA';
  if (dias <= umbrales.alta) return 'ALTA';
  if (dias <= umbrales.media) return 'MEDIA';
  if (dias <= umbrales.informativa) return 'INFORMATIVA';
  return 'SIN_ALERTA';
}

/** Período contable mensual, identificado como "AAAA-MM". */
export interface Periodo {
  readonly anio: number;
  /** 1-12. */
  readonly mes: number;
}

const FORMATO_PERIODO = /^(\d{4})-(\d{2})$/;

export function periodoDesdeTexto(texto: string): Periodo {
  const partes = FORMATO_PERIODO.exec(texto.trim());
  if (!partes) {
    throw new ErrorDeFecha(`Período con formato inválido: "${texto}". Se espera AAAA-MM.`);
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  if (mes < 1 || mes > 12) {
    throw new ErrorDeFecha(`Mes fuera de rango en el período "${texto}"`);
  }
  return { anio, mes };
}

export function periodoATexto(periodo: Periodo): string {
  return `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`;
}

export function periodoAnterior(periodo: Periodo): Periodo {
  return periodo.mes === 1
    ? { anio: periodo.anio - 1, mes: 12 }
    : { anio: periodo.anio, mes: periodo.mes - 1 };
}

export function periodoSiguiente(periodo: Periodo): Periodo {
  return periodo.mes === 12
    ? { anio: periodo.anio + 1, mes: 1 }
    : { anio: periodo.anio, mes: periodo.mes + 1 };
}

/** True si la fecha cae dentro del período. Se usa para validar que un comprobante corresponde al mes que se está cerrando. */
export function fechaPerteneceAlPeriodo(fecha: FechaCivil, periodo: Periodo): boolean {
  return fecha.anio === periodo.anio && fecha.mes === periodo.mes;
}
