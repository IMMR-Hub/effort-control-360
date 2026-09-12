/**
 * Días hábiles y feriados.
 *
 * Los plazos que EFFORT le da a sus clientes se cuentan en días hábiles
 * ("hasta el segundo día hábil"), y los recordatorios salen a una hora fija del
 * siguiente día hábil. Un recordatorio que sale un domingo a las 7 de la mañana
 * no lo lee nadie y gasta la única palanca que EFFORT tiene con el cliente.
 *
 * Los feriados se INYECTAN, no se calculan acá. En Paraguay varios feriados se
 * trasladan por decreto cada año, así que la lista tiene que ser un dato que
 * EFFORT confirma y edita, no una constante enterrada en el código.
 */

import { diasEntre, fechaCivilAIso, type FechaCivil } from './fechas.js';

export interface Feriado {
  readonly fecha: string;
  readonly nombre: string;
  /**
   * Los feriados trasladables cambian de fecha por decreto. Se marcan para que
   * la interfaz pueda pedir confirmación al inicio de cada año.
   */
  readonly trasladable: boolean;
}

export interface CalendarioHabil {
  /** Feriados indexados por fecha ISO. */
  readonly feriados: ReadonlyMap<string, Feriado>;
  /**
   * Días de la semana laborables, 0 = domingo … 6 = sábado.
   * Configurable: si EFFORT trabaja sábado a la mañana, se agrega el 6.
   */
  readonly diasLaborables: ReadonlySet<number>;
}

export const DIAS_LABORABLES_LUNES_A_VIERNES: ReadonlySet<number> = new Set([1, 2, 3, 4, 5]);

export function crearCalendario(
  feriados: readonly Feriado[],
  diasLaborables: ReadonlySet<number> = DIAS_LABORABLES_LUNES_A_VIERNES,
): CalendarioHabil {
  return {
    feriados: new Map(feriados.map((feriado) => [feriado.fecha, feriado])),
    diasLaborables,
  };
}

/** Día de la semana de una fecha civil. 0 = domingo. */
export function diaDeLaSemana(fecha: FechaCivil): number {
  return new Date(Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia)).getUTCDay();
}

export function esFeriado(fecha: FechaCivil, calendario: CalendarioHabil): boolean {
  return calendario.feriados.has(fechaCivilAIso(fecha));
}

export function esDiaHabil(fecha: FechaCivil, calendario: CalendarioHabil): boolean {
  return calendario.diasLaborables.has(diaDeLaSemana(fecha)) && !esFeriado(fecha, calendario);
}

function sumarDiasCalendario(fecha: FechaCivil, dias: number): FechaCivil {
  const instante = new Date(Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia + dias));
  return {
    anio: instante.getUTCFullYear(),
    mes: instante.getUTCMonth() + 1,
    dia: instante.getUTCDate(),
  };
}

/** Tope de iteraciones: evita un bucle infinito si el calendario queda sin días laborables. */
const MAXIMO_DIAS_A_RECORRER = 400;

export class ErrorDeCalendario extends Error {
  override readonly name = 'ErrorDeCalendario';
}

/**
 * Primer día hábil a partir de una fecha, inclusive.
 * Si la fecha ya es hábil, la devuelve tal cual.
 */
export function proximoDiaHabil(fecha: FechaCivil, calendario: CalendarioHabil): FechaCivil {
  let candidata = fecha;

  for (let recorridos = 0; recorridos <= MAXIMO_DIAS_A_RECORRER; recorridos += 1) {
    if (esDiaHabil(candidata, calendario)) {
      return candidata;
    }
    candidata = sumarDiasCalendario(candidata, 1);
  }

  throw new ErrorDeCalendario(
    'No se encontró ningún día hábil en 400 días. Revisá los días laborables del calendario.',
  );
}

/**
 * Suma días hábiles a una fecha.
 *
 * `sumarDiasHabiles(fecha, 2)` responde "el segundo día hábil siguiente":
 * no cuenta la fecha de partida y salta fines de semana y feriados.
 */
export function sumarDiasHabiles(
  fecha: FechaCivil,
  diasHabiles: number,
  calendario: CalendarioHabil,
): FechaCivil {
  if (diasHabiles < 0) {
    throw new ErrorDeCalendario('sumarDiasHabiles no acepta valores negativos.');
  }

  let candidata = fecha;
  let restantes = diasHabiles;
  let recorridos = 0;

  while (restantes > 0) {
    candidata = sumarDiasCalendario(candidata, 1);
    recorridos += 1;

    if (recorridos > MAXIMO_DIAS_A_RECORRER) {
      throw new ErrorDeCalendario(
        `No se pudieron sumar ${diasHabiles} días hábiles en 400 días de calendario.`,
      );
    }

    if (esDiaHabil(candidata, calendario)) {
      restantes -= 1;
    }
  }

  return candidata;
}

/** Cantidad de días hábiles entre dos fechas, sin contar la de origen. */
export function diasHabilesEntre(
  origen: FechaCivil,
  destino: FechaCivil,
  calendario: CalendarioHabil,
): number {
  const total = diasEntre(origen, destino);
  const sentido = total >= 0 ? 1 : -1;
  let habiles = 0;
  let candidata = origen;

  for (let paso = 0; paso < Math.abs(total); paso += 1) {
    candidata = sumarDiasCalendario(candidata, sentido);
    if (esDiaHabil(candidata, calendario)) {
      habiles += sentido;
    }
  }

  return habiles;
}

/**
 * Feriados nacionales paraguayos de un año.
 *
 * Los de fecha fija son estables. Jueves y Viernes Santo se derivan de la
 * Pascua, que sí se calcula porque su regla es determinística.
 *
 * IMPORTANTE: esta lista es un punto de partida, no la verdad. Paraguay traslada
 * feriados por decreto y agrega asuetos; los marcados como trasladables deben
 * confirmarse con EFFORT al inicio de cada año. Los traslados ya confirmados
 * viven en `TRASLADOS_DECRETADOS`, más abajo, y se aplican solos.
 *
 * Lo que esta función NO incluye, a propósito: los feriados extraordinarios que
 * el Ejecutivo decreta durante el año (hasta tres, según la Ley 7544/2025). El
 * del 2026-06-30 por la clasificación de la selección es el caso testigo: su
 * decreto exceptúa expresamente a la recaudación tributaria, así que no está
 * claro que corra un vencimiento. Meterlo acá sería decidir esa duda de un lado
 * sin base. Queda planteada en `docs/DISCREPANCIAS.md`, punto 19.
 */
export function feriadosParaguay(anio: number): Feriado[] {
  const iso = (mes: number, dia: number): string =>
    fechaCivilAIso({ anio, mes, dia });

  const pascua = domingoDePascua(anio);
  const viernesSanto = sumarDiasCalendario(pascua, -2);
  const juevesSanto = sumarDiasCalendario(pascua, -3);

  const base: Feriado[] = [
    { fecha: iso(1, 1), nombre: 'Año Nuevo', trasladable: false },
    { fecha: iso(3, 1), nombre: 'Día de los Héroes', trasladable: true },
    { fecha: fechaCivilAIso(juevesSanto), nombre: 'Jueves Santo', trasladable: false },
    { fecha: fechaCivilAIso(viernesSanto), nombre: 'Viernes Santo', trasladable: false },
    { fecha: iso(5, 1), nombre: 'Día del Trabajador', trasladable: false },
    { fecha: iso(5, 14), nombre: 'Independencia Nacional', trasladable: false },
    { fecha: iso(5, 15), nombre: 'Independencia Nacional', trasladable: false },
    { fecha: iso(6, 12), nombre: 'Paz del Chaco', trasladable: true },
    { fecha: iso(8, 15), nombre: 'Fundación de Asunción', trasladable: false },
    { fecha: iso(9, 29), nombre: 'Victoria de Boquerón', trasladable: true },
    { fecha: iso(12, 8), nombre: 'Virgen de Caacupé', trasladable: false },
    { fecha: iso(12, 25), nombre: 'Navidad', trasladable: false },
  ];

  // Feriado nuevo, no un olvido de antes: lo creó la Ley 7544/2025 (sancionada
  // el 2025-08-26), así que rige recién desde 2026. Ponerlo en los años previos
  // haría que un vencimiento viejo se recalcule distinto de como venció.
  if (anio >= 2026) {
    base.push({ fecha: iso(6, 20), nombre: 'Jura de la Constitución', trasladable: true });
  }

  return aplicarDecretos(anio, base);
}

/**
 * Traslado de un feriado ya dispuesto por decreto, para un año concreto.
 *
 * Un feriado que ese año NO se trasladó simplemente no aparece en la lista: no
 * hay forma de expresar "sin traslado", porque no hace falta.
 */
interface TrasladoDecretado {
  readonly original: string;
  readonly efectiva: string;
  /** De dónde salió, para poder auditarlo sin volver a buscarlo. */
  readonly fuente: string;
}

/**
 * Traslados confirmados, año por año.
 *
 * **Por qué esto tiene que existir.** Los cuatro feriados móviles paraguayos
 * (1 de marzo, 12 de junio, 20 de junio y 29 de setiembre) NO se trasladan
 * solos: la Ley 7544/2025 faculta al Poder Ejecutivo a moverlos "al lunes
 * anterior o posterior", y lo hace **por decreto, año a año**. No hay regla
 * derivable — un año se mueve y otro no, y el sentido del movimiento cambia.
 * Cualquier fórmula que se invente acá va a estar mal alguna vez.
 *
 * **Por qué importa para los vencimientos, con un caso real.** El RG 90 de
 * ECOAGRO vence el 26 de cada mes. El 26 de setiembre de 2026 cae sábado, así
 * que el vencimiento corre al lunes 28 — que es justamente el día al que se
 * trasladó la Victoria de Boquerón. Sin este traslado cargado, el sistema daba
 * por vencida esa obligación un día antes de lo que la DNIT la da por vencida.
 *
 * **Esta tabla hay que actualizarla cada año.** Mientras un año no esté acá,
 * se usan las fechas originales, que es el comportamiento conservador: si algo
 * se movió y no lo sabemos, el sistema avisa antes, nunca después.
 */
const TRASLADOS_DECRETADOS: Readonly<Record<number, readonly TrasladoDecretado[]>> = {
  2026: [
    {
      original: '2026-03-01',
      efectiva: '2026-03-02',
      fuente: 'Decreto de traslado anunciado el 2026-02-16. Ver DISCREPANCIAS #19.',
    },
    {
      original: '2026-06-20',
      efectiva: '2026-06-22',
      fuente:
        'Agencia IP (agencia estatal), 2026-06-09: ' +
        'ip.gov.py/ip/2026/06/09/gobierno-traslada-feriado-por-la-jura-de-la-constitucion-de-1992-al-lunes-22/',
    },
    {
      original: '2026-09-29',
      efectiva: '2026-09-28',
      fuente: 'Decreto N° 6601 del 2026-08-20. Ver DISCREPANCIAS #19.',
    },
  ],
};

function aplicarDecretos(anio: number, feriados: readonly Feriado[]): Feriado[] {
  const traslados = TRASLADOS_DECRETADOS[anio];
  if (!traslados) return [...feriados];

  const porOriginal = new Map(traslados.map((t) => [t.original, t]));

  return feriados.map((feriado) => {
    const traslado = porOriginal.get(feriado.fecha);
    if (!traslado) return feriado;
    return { ...feriado, fecha: traslado.efectiva };
  });
}

/**
 * Domingo de Pascua por el algoritmo gregoriano anónimo (Meeus/Jones/Butcher).
 * Es aritmética pura y da el mismo resultado que las tablas litúrgicas.
 */
export function domingoDePascua(anio: number): FechaCivil {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return { anio, mes, dia };
}
