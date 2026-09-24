/**
 * Sincronización de OneDrive por cambios, con la pasada completa como red de
 * seguridad (tarea 158).
 *
 * **El problema, medido el 2026-09-24.** `sincronizarDesdeOneDrive` recorre TODAS
 * las carpetas de TODOS los clientes en cada vuelta, aunque después no baje casi
 * nada: 215 s solo de listado para 5 clientes (4.519 archivos, ~530 carpetas, ~0,4
 * s por carpeta, en secuencia), en cada corrida de 15 minutos y en cada apretada
 * del botón «Actualizar ahora». El costo crece con la cantidad de carpetas, no
 * con lo que cambió: con 150 clientes, del orden de una hora por pasada.
 *
 * **Qué se hace.** Microsoft Graph informa qué cambió en el drive desde la última
 * vez (`/delta`), en una llamada. Se le pasa al sincronizador de siempre —el que
 * ya sabe de huellas, del tope de 25 MB y de registrar cada archivo— un origen
 * cuyo «listado» es únicamente lo que cambió en esa carpeta de cliente. No hay
 * una segunda lógica de copia que mantener.
 *
 * **Perder un cambio en silencio es la peor forma de fallar una importación**
 * (`CLAUDE.md`, lección 2), así que el atajo tiene salidas a la pasada completa:
 *
 *  - al arrancar el servidor (el token vive en memoria);
 *  - a la medianoche de lunes a sábado (hora de Paraguay), por si alguien se olvidó
 *    de actualizar algo o un cambio se escapó (Daniel, 2026-09-24): a esa hora
 *    nadie está mirando, así que no importa que tarde, y hace de respaldo;
 *  - si Graph responde 410 o falla la consulta de cambios;
 *  - si aparece un cliente que todavía no se conocía;
 *  - si hay demasiados cambios juntos (una pasada completa sale más barata y más
 *    segura que resolver cientos de rutas una por una).
 *
 * **El token solo avanza si todo salió bien.** Si un archivo falló al copiarse por
 * algo pasajero, el mismo cambio se vuelve a pedir en la vuelta siguiente: los
 * archivos ya copiados se saltean por su huella, así que repetir es inofensivo.
 *
 * Todo es de solo lectura sobre el drive de origen. El origen que se le pasa al
 * sincronizador ni siquiera tiene forma de escribir (`CLAUDE.md`, regla 5).
 */

import {
  TokenDeCambiosVencido,
  type ArchivoDrive,
  type DriveDeArchivos,
  type FuenteDeCambios,
} from '@effort/drive';

import {
  sincronizarDesdeOneDrive,
  type DependenciasDelSincronizador,
  type ResumenDeSincronizacion,
} from './sincronizadorDeOneDrive.js';

const ZONA = 'America/Asuncion';

/** Hora de pared de `instante` en Paraguay, expresada como si fuera UTC (para poder restar). */
function horaDeParedComoUtc(instante: number): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instante));
  const n = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
}

/** El instante en que en Paraguay son las 00:00 de ese día. Base IANA, nunca un desfase fijo (regla 3). */
function medianocheEnParaguay(anio: number, mes: number, dia: number): number {
  const objetivo = Date.UTC(anio, mes - 1, dia);
  let candidato = objetivo;
  for (let i = 0; i < 3; i += 1) candidato += objetivo - horaDeParedComoUtc(candidato);
  return candidato;
}

/**
 * La última medianoche programada para la pasada completa: las 00:00 de Paraguay
 * de un día de lunes a sábado. El domingo no hay (Daniel, 2026-09-24), así que un
 * domingo devuelve la del sábado.
 */
export function ultimaMedianocheProgramada(ahora: Date): Date {
  const hoy = new Date(horaDeParedComoUtc(ahora.getTime()));
  for (let atras = 0; atras < 7; atras += 1) {
    const dia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - atras));
    if (dia.getUTCDay() === 0) continue; // domingo
    const instante = medianocheEnParaguay(dia.getUTCFullYear(), dia.getUTCMonth() + 1, dia.getUTCDate());
    if (instante <= ahora.getTime()) return new Date(instante);
  }
  throw new Error('No se pudo calcular la última medianoche programada.');
}

/** Con más cambios que esto juntos, se hace la pasada completa. */
export const MAXIMO_DE_CAMBIOS_INCREMENTALES = 300;

export type ModoDeSincronizacion = 'completa' | 'incremental';

export interface ResultadoDeSincronizacion extends ResumenDeSincronizacion {
  readonly modo: ModoDeSincronizacion;
  /** Por qué no fue incremental (solo en las pasadas completas). */
  readonly motivoDePasadaCompleta: string | null;
  /** Archivos que Graph informó como cambiados (solo en las incrementales). */
  readonly cambiosRecibidos: number;
  readonly duracionMs: number;
}

/** Lo que se recuerda entre una vuelta y la siguiente. Vive en memoria del proceso. */
export interface EstadoDeSincronizacion {
  token: string | null;
  /** Ruta, desde la raíz del drive, de la carpeta de cada cliente (por id de carpeta). */
  rutasDeClientes: Map<string, string>;
  ultimaPasadaCompletaEn: Date | null;
}

export function crearEstadoDeSincronizacion(): EstadoDeSincronizacion {
  return { token: null, rutasDeClientes: new Map(), ultimaPasadaCompletaEn: null };
}

const estados = new WeakMap<object, EstadoDeSincronizacion>();

/**
 * El estado de un drive de origen. Lo comparten el trabajo automático y los
 * botones —en producción hay una sola instancia del drive—: si cada uno llevara
 * el suyo, uno se perdería lo que el otro ya vio. Atado a la instancia y no
 * global, para que las pruebas con drives distintos no se contaminen.
 */
export function estadoDeSincronizacion(origen: object): EstadoDeSincronizacion {
  let estado = estados.get(origen);
  if (!estado) {
    estado = crearEstadoDeSincronizacion();
    estados.set(origen, estado);
  }
  return estado;
}

export type DependenciasIncrementales = Omit<DependenciasDelSincronizador, 'origen'> & {
  readonly origen: DriveDeArchivos & FuenteDeCambios;
};

export function admiteCambios(origen: DriveDeArchivos): origen is DriveDeArchivos & FuenteDeCambios {
  const candidato = origen as Partial<FuenteDeCambios>;
  return (
    typeof candidato.cambiosDesde === 'function' &&
    typeof candidato.tokenDeCambiosActual === 'function' &&
    typeof candidato.rutaDeLaCarpetaDe === 'function' &&
    typeof candidato.rutaDeCarpetaPorId === 'function'
  );
}

/** Un origen que solo «ve» los archivos cambiados, y al que no se puede escribir. */
function origenSoloConCambios(
  origen: DriveDeArchivos,
  porCarpeta: ReadonlyMap<string, readonly ArchivoDrive[]>,
): DriveDeArchivos {
  return {
    listar: (carpeta) => origen.listar(carpeta),
    listarRecursivoPorId: async (itemId) => [...(porCarpeta.get(itemId) ?? [])],
    leer: (itemId) => origen.leer(itemId),
    escribir: () => {
      throw new Error('El drive de origen es de solo lectura: el sistema nunca escribe ahí.');
    },
    enlaceWeb: (itemId) => origen.enlaceWeb(itemId),
  };
}

function motivoDePasadaCompleta(
  estado: EstadoDeSincronizacion,
  carpetasDeClientes: readonly string[],
  ahora: Date,
): string | null {
  if (estado.token === null) return 'primera pasada desde que arrancó el servidor, o la anterior no terminó limpia';
  if (estado.ultimaPasadaCompletaEn === null || estado.ultimaPasadaCompletaEn < ultimaMedianocheProgramada(ahora)) {
    return 'pasada completa de la medianoche (lunes a sábado): revisa todo por si alguien se olvidó de actualizar';
  }
  if (carpetasDeClientes.some((id) => !estado.rutasDeClientes.has(id))) {
    return 'hay un cliente cuya carpeta todavía no se conocía';
  }
  return null;
}

async function pasadaCompleta(
  deps: DependenciasIncrementales,
  usuarioId: string,
  estado: EstadoDeSincronizacion,
  carpetasDeClientes: readonly string[],
  motivo: string,
  inicio: number,
): Promise<ResultadoDeSincronizacion> {
  // El token se pide ANTES de recorrer: así lo que cambie mientras dura la pasada
  // (minutos) queda cubierto por la primera consulta de cambios de después.
  let tokenNuevo: string | null = null;
  try {
    tokenNuevo = await deps.origen.tokenDeCambiosActual();
  } catch {
    // Sin consulta de cambios el sistema sigue funcionando como antes.
    tokenNuevo = null;
  }

  const resumen = await sincronizarDesdeOneDrive(deps, usuarioId);

  // Solo una pasada limpia sirve de base: con archivos pendientes o con errores,
  // lo que falta no aparecería nunca en los cambios.
  estado.token = null;
  if (tokenNuevo !== null && !resumen.quedaronPendientes && resumen.errores === 0) {
    try {
      const rutas = new Map<string, string>();
      for (const id of carpetasDeClientes) rutas.set(id, await deps.origen.rutaDeCarpetaPorId(id));
      estado.rutasDeClientes = rutas;
      estado.token = tokenNuevo;
      estado.ultimaPasadaCompletaEn = deps.ahora();
    } catch {
      estado.token = null;
    }
  }

  return { ...resumen, modo: 'completa', motivoDePasadaCompleta: motivo, cambiosRecibidos: 0, duracionMs: Date.now() - inicio };
}

/** Prefijo que compara sin distinguir mayúsculas: OneDrive tampoco las distingue. */
function estaDentroDe(ruta: string, raiz: string): boolean {
  const r = ruta.toLowerCase();
  const base = raiz.toLowerCase();
  return r === base || r.startsWith(`${base}/`);
}

export async function sincronizarConCambios(
  deps: DependenciasIncrementales,
  usuarioId: string,
  estado: EstadoDeSincronizacion = estadoDeSincronizacion(deps.origen),
): Promise<ResultadoDeSincronizacion> {
  const inicio = Date.now();
  const clientes = (await deps.clientes.listar(null)).filter((c) => c.activo && c.carpetaOneDriveId);
  const carpetasDeClientes = clientes.map((c) => c.carpetaOneDriveId!);

  const motivo = motivoDePasadaCompleta(estado, carpetasDeClientes, deps.ahora());
  if (motivo !== null) {
    return pasadaCompleta(deps, usuarioId, estado, carpetasDeClientes, motivo, inicio);
  }

  // Preparar los cambios: si algo de esto falla, no se pierde nada, se hace la
  // pasada completa.
  const porCarpeta = new Map<string, ArchivoDrive[]>();
  let tokenSiguiente: string;
  let cambiosRecibidos = 0;
  try {
    const consulta = await deps.origen.cambiosDesde(estado.token!);
    tokenSiguiente = consulta.tokenSiguiente;

    const archivos = consulta.cambios.filter((c) => !c.esCarpeta && !c.eliminado);
    cambiosRecibidos = archivos.length;
    if (archivos.length > MAXIMO_DE_CAMBIOS_INCREMENTALES) {
      return pasadaCompleta(
        deps, usuarioId, estado, carpetasDeClientes,
        `${archivos.length} cambios juntos: es más seguro recorrer todo`, inicio,
      );
    }

    const raices = [...estado.rutasDeClientes];
    for (const cambio of archivos) {
      const ruta = await deps.origen.rutaDeLaCarpetaDe(cambio.itemId);
      if (ruta === null) continue; // ya no existe: se borró o se movió afuera
      const raiz = raices.find(([, rutaDeRaiz]) => estaDentroDe(ruta, rutaDeRaiz));
      if (!raiz) continue; // cambió algo del drive que no es de ningún cliente

      const lista = porCarpeta.get(raiz[0]) ?? [];
      lista.push({
        itemId: cambio.itemId,
        nombre: cambio.nombre,
        rutaCarpeta: ruta.length === raiz[1].length ? '' : ruta.slice(raiz[1].length + 1),
        tamanoBytes: cambio.tamanoBytes,
        modificadoEn: cambio.modificadoEn,
        tipoMime: cambio.tipoMime,
      });
      porCarpeta.set(raiz[0], lista);
    }
  } catch (error) {
    const razon =
      error instanceof TokenDeCambiosVencido
        ? 'Graph dijo que el token de cambios venció'
        : `falló la consulta de cambios (${error instanceof Error ? error.message : 'error desconocido'})`;
    estado.token = null;
    return pasadaCompleta(deps, usuarioId, estado, carpetasDeClientes, razon, inicio);
  }

  const resumen = await sincronizarDesdeOneDrive(
    { ...deps, origen: origenSoloConCambios(deps.origen, porCarpeta) },
    usuarioId,
  );

  // El token avanza solo si nada quedó a medias: si no, la vuelta siguiente
  // vuelve a pedir estos mismos cambios (los ya copiados se saltean por huella).
  if (resumen.errores === 0 && !resumen.quedaronPendientes) estado.token = tokenSiguiente;

  return {
    ...resumen,
    modo: 'incremental',
    motivoDePasadaCompleta: null,
    cambiosRecibidos,
    duracionMs: Date.now() - inicio,
  };
}

/**
 * Sincroniza por cambios si el origen lo admite, y si no, recorriendo todo como
 * antes. Es el único punto de entrada que usan el trabajo automático y el botón.
 */
export async function sincronizarOneDrive(
  deps: DependenciasDelSincronizador,
  usuarioId: string,
  estado: EstadoDeSincronizacion = estadoDeSincronizacion(deps.origen),
): Promise<ResultadoDeSincronizacion> {
  if (admiteCambios(deps.origen)) {
    return sincronizarConCambios({ ...deps, origen: deps.origen }, usuarioId, estado);
  }
  const inicio = Date.now();
  const resumen = await sincronizarDesdeOneDrive(deps, usuarioId);
  return {
    ...resumen,
    modo: 'completa',
    motivoDePasadaCompleta: 'el origen no admite consulta de cambios',
    cambiosRecibidos: 0,
    duracionMs: Date.now() - inicio,
  };
}

let sincronizando = false;

/**
 * Una sola sincronización a la vez, entre el trabajo automático y el botón.
 *
 * Antes cada uno tenía su propia guarda (el automático) o ninguna (el botón), y
 * dos corridas simultáneas bajaban los mismos archivos dos veces y se pisaban el
 * token de cambios. Vive en memoria porque la API corre en una sola instancia
 * (igual que `candadoDeIva.ts`).
 */
export async function intentarSincronizar<T>(
  tarea: () => Promise<T>,
): Promise<{ readonly ocupado: true } | { readonly ocupado: false; readonly valor: T }> {
  if (sincronizando) return { ocupado: true };
  sincronizando = true;
  try {
    return { ocupado: false, valor: await tarea() };
  } finally {
    sincronizando = false;
  }
}
