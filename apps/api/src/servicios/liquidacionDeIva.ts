/**
 * Liquidación de IVA a partir de las planillas RG 90.
 *
 * Cierra la cadena que le faltaba al sistema. Hasta acá el importador sabía leer
 * los libros y calcular crédito y débito, pero el resultado **se perdía al
 * terminar el proceso**: no se guardaba, así que no se podía mostrar en pantalla
 * ni alertar sobre él. Esto lo guarda.
 *
 * Daniel, 2026-09-12: *"Claro que debe calcular IVA según el caso de 5 o 10%,
 * retenciones, etc. para poder decirle cuánto IVA crédito y débito tiene el
 * cliente"*. Y el 13, sobre las diferencias: *"estas discrepancias también
 * tienen que alertar ya que al final puede representar una multa
 * administrativa"*.
 *
 * ---
 *
 * **Qué hace, en orden:** por cada cliente abre los Excel clasificados como
 * libro entre las evidencias ya sincronizadas, se queda con los que por su
 * contenido son planillas RG 90, elige UNA planilla por período y tipo de
 * registro, y por cada período guarda el IVA calculado y los hallazgos.
 *
 * **Qué NO hace:** no descarga de OneDrive lo que no esté ya sincronizado, no
 * escribe nada en el drive, y no decide a quién avisar — eso es del motor de
 * alertas. Este servicio calcula y guarda.
 *
 * **Es seguro repetirlo.** Volver a correrlo sobre el mismo período reemplaza la
 * liquidación y no duplica hallazgos (la base lo garantiza con sus claves
 * únicas). Hace falta que sea así: corre solo, y una planilla corregida tiene
 * que poder reimportarse sin ensuciar nada. Dos cálculos a la vez los impide
 * `candadoDeIva.ts`, que envuelve a este servicio desde afuera.
 */

import {
  analizarLibro,
  importarLibroRg90,
  mesDeEmision,
  NoEsPlanillaRg90,
  resumirIva,
  type HallazgoDeLibro,
  type FilaDeLibro,
} from '@effort/importers';
import { determinarIva, gs, hoyEnParaguay, type DivisoresIva, type Gs } from '@effort/core';
import { ErrorTransitorioDeDrive, type DriveDeArchivos } from '@effort/drive';

import type { ClienteListado, RepositorioDeClientes } from '../puertos.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/**
 * El formato binario viejo de Excel (.xls). La librería que lee las planillas
 * no lo entiende: se informa una vez como aviso en vez de fallar en cada
 * corrida (auditoría 2026-09-16).
 */
const XLS = 'application/vnd.ms-excel';

/**
 * Tope de tamaño de una planilla. Las planillas RG 90 reales pesan menos de
 * 1 MB; algo mucho más grande no es un libro, y leerlo entero en memoria en un
 * contenedor de 512 MB es la forma en que el sistema ya se cayó una vez
 * (CLAUDE.md, lección 4).
 */
export const TAMANO_MAXIMO_DE_PLANILLA_BYTES = 15 * 1024 * 1024;

/**
 * Meses de diferencia entre la fecha de emisión y el período declarado a partir
 * de los cuales la fila se considera "corrida".
 *
 * Caso real: el "01 ENERO.xlsx" de COPESA 2026 trae comprobantes emitidos en
 * enero 2026 con períodos 2027-01 … 2032-01: la columna de período se arrastró
 * en el Excel. Sin esto, esas filas se aceptarían en enero de cada año siguiente,
 * cuando dejan de ser "futuras". El valor está pendiente de confirmar con EFFORT
 * (plan maestro, pregunta P4): las filas se dejan afuera y se avisan, no se
 * reasignan a otro período.
 */
export const MESES_DE_ARRASTRE_SOSPECHOSO = 12;

/** Tope de avisos por cálculo. El resto se cuenta, pero no viaja entero en la respuesta. */
export const MAXIMO_DE_AVISOS = 200;

export interface ArchivoDeLibro {
  readonly evidenciaId: string;
  readonly clienteId: string;
  readonly nombreArchivo: string;
  readonly itemIdOneDrive: string;
  readonly tipoMime: string;
  /** Fecha de modificación en OneDrive. Decide qué versión manda si hay dos. */
  readonly modificadoEnOrigen?: Date | null;
  /**
   * Ruta completa en OneDrive. En COPESA "01 ENERO.xlsx" se repite entre años y
   * entre compras y ventas: sin la ruta, un aviso no dice de qué archivo habla.
   */
  readonly rutaOneDrive?: string | null;
  readonly tamanoBytes?: number | null;
}

export interface AltaDeLiquidacion {
  readonly clienteId: string;
  readonly periodo: string;
  readonly creditoFiscal: Gs;
  readonly debitoFiscal: Gs;
  readonly saldoAPagar: Gs;
  readonly saldoAFavor: Gs;
  readonly comprobantesCompras: number;
  readonly comprobantesVentas: number;
  readonly gravado10Compras: Gs;
  readonly gravado5Compras: Gs;
  readonly exentoCompras: Gs;
  readonly gravado10Ventas: Gs;
  readonly gravado5Ventas: Gs;
  readonly exentoVentas: Gs;
  /** Planillas que aportaron filas a ESTE período (compras y ventas). */
  readonly archivosLeidos: number;
  /** Filas descartadas de las planillas que aportaron a ESTE período. */
  readonly filasRechazadas: number;
  readonly calculadoPorUsuarioId: string;
}

export interface AltaDeHallazgo extends HallazgoDeLibro {
  readonly clienteId: string;
}

export interface DependenciasDeLiquidacion {
  readonly clientes: RepositorioDeClientes;
  /** Planillas RG 90 ya sincronizadas de un cliente. */
  readonly librosDelCliente: (clienteId: string) => Promise<readonly ArchivoDeLibro[]>;
  /** Drive propio del sistema: las planillas ya están copiadas ahí. */
  readonly drive: DriveDeArchivos;
  readonly guardarLiquidacion: (datos: AltaDeLiquidacion) => Promise<void>;
  readonly guardarHallazgos: (datos: readonly AltaDeHallazgo[]) => Promise<number>;
  readonly divisores: DivisoresIva;
  /** Reloj de la aplicación. Decide qué período es "futuro". */
  readonly ahora?: () => Date;
}

export interface FalloDeLiquidacion {
  readonly cliente: string;
  readonly archivo: string;
  readonly motivo: string;
}

/**
 * Algo que se dejó afuera a propósito y que una persona tiene que poder ver:
 * una planilla reemplazada por otra, filas con un período que no corresponde,
 * un formato que no se puede leer.
 */
export interface AvisoDeLiquidacion {
  readonly cliente: string;
  readonly archivo: string;
  readonly motivo: string;
}

/** Cliente que no se calculó en esta corrida, y por qué. */
export interface ClienteOmitido {
  readonly cliente: string;
  readonly motivo: string;
}

export interface ResumenDeLiquidacion {
  readonly periodosCalculados: number;
  /** Planillas RG 90 leídas (ganaran o no algún período). */
  readonly archivosLeidos: number;
  /** Comprobantes usados en el cálculo (solo de las planillas elegidas). */
  readonly filasInterpretadas: number;
  readonly filasRechazadas: number;
  readonly hallazgosNuevos: number;
  /** Filas repetidas DENTRO de una planilla elegida que se contaron una sola vez. */
  readonly comprobantesRepetidos: number;
  /** Excel clasificados como libro que no son planillas RG 90. No son fallos. */
  readonly archivosIgnorados: number;
  /** Los primeros ignorados, con su ruta, para poder revisarlos. */
  readonly archivosIgnoradosLista: readonly string[];
  readonly avisos: readonly AvisoDeLiquidacion[];
  /** Avisos que existieron pero no entraron en la respuesta por el tope. */
  readonly avisosOmitidos: number;
  /**
   * Clientes que no se calcularon: una planilla no se pudo bajar por una falla
   * pasajera, y calcular sin ella podría hacer ganar a una versión vieja.
   */
  readonly clientesOmitidos: readonly ClienteOmitido[];
  readonly fallos: readonly FalloDeLiquidacion[];
}

/**
 * Qué hace que dos filas sean el MISMO comprobante.
 *
 * Timbrado y número identifican una factura en Paraguay; el proveedor y el tipo
 * se agregan porque un número se repite entre proveedores distintos.
 */
function claveDeComprobante(fila: FilaDeLibro): string {
  return [
    fila.periodo,
    fila.tipoRegistro,
    fila.tipoComprobante,
    fila.timbrado,
    fila.numeroComprobante,
    fila.rucInformado || fila.razonSocialInformado,
  ].join('|');
}

/**
 * El nombre EMPIEZA con "CORRECCION" (con o sin tilde, con una o dos C).
 *
 * Anclado al principio a propósito: la versión del 2026-09-16 buscaba la
 * palabra en cualquier parte, y "SIN CORRECCION" o "CORRECCIONES PENDIENTES"
 * pasaban por correcciones. EFFORT las nombra "CORRECCION RG COMPRAS …"
 * (plan maestro, pregunta P3, para confirmar otras formas).
 */
export function esCorreccion(nombreArchivo: string): boolean {
  const sinTildes = nombreArchivo.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /^\s*correcc?ion[\s_-]/i.test(sinTildes);
}

function marcaDeTiempo(archivo: ArchivoDeLibro): number {
  return archivo.modificadoEnOrigen?.getTime() ?? 0;
}

/**
 * Orden TOTAL de prioridad: positivo si manda `a`.
 *
 * Una corrección manda sobre el original; entre dos que no lo son (o dos que lo
 * son), la modificada más recientemente en OneDrive. Si todo empata, decide el
 * nombre y después el id: la versión anterior dejaba el empate al orden en que
 * la base devolvía las filas, y el IVA de un período podía cambiar entre dos
 * corridas sin que cambiara ningún archivo.
 */
function prioridad(a: ArchivoDeLibro, b: ArchivoDeLibro): number {
  return (
    Number(esCorreccion(a.nombreArchivo)) - Number(esCorreccion(b.nombreArchivo)) ||
    marcaDeTiempo(a) - marcaDeTiempo(b) ||
    b.nombreArchivo.localeCompare(a.nombreArchivo) ||
    b.evidenciaId.localeCompare(a.evidenciaId)
  );
}

/** Por qué `ganadora` le ganó a `perdedora`, en palabras. */
function motivoDeDescarte(ganadora: ArchivoDeLibro, perdedora: ArchivoDeLibro, grupo: string): string {
  const nombre = identificar(ganadora);
  if (esCorreccion(ganadora.nombreArchivo) && !esCorreccion(perdedora.nombreArchivo)) {
    return `Planilla descartada: para ${grupo} manda la corrección "${nombre}".`;
  }
  if (marcaDeTiempo(ganadora) !== marcaDeTiempo(perdedora)) {
    return `Planilla descartada: para ${grupo} se usó "${nombre}", modificada más recientemente.`;
  }
  return (
    `Planilla descartada por empate: para ${grupo} hay otra planilla con la misma fecha de ` +
    `modificación y se usó "${nombre}" por orden alfabético. Revisar cuál es la buena.`
  );
}

function identificar(archivo: ArchivoDeLibro): string {
  return archivo.rutaOneDrive || archivo.nombreArchivo;
}

function describirGrupo(clave: string): string {
  const [periodo, registro] = clave.split('|');
  return `${registro} ${periodo}`;
}

/** `AAAA-MM` del mes en curso en Paraguay. */
function mesEnCurso(instante: Date): string {
  const hoy = hoyEnParaguay(instante);
  return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
}

/** Meses entre dos `AAAA-MM` (positivo si `hasta` es posterior). */
function mesesEntre(desde: string, hasta: string): number {
  const [anioDesde, mesDesde] = desde.split('-').map(Number);
  const [anioHasta, mesHasta] = hasta.split('-').map(Number);
  return (anioHasta! - anioDesde!) * 12 + (mesHasta! - mesDesde!);
}

/** Avisos con tope: el resto se cuenta pero no se guarda. */
class Avisos {
  readonly lista: AvisoDeLiquidacion[] = [];
  omitidos = 0;

  agregar(aviso: AvisoDeLiquidacion): void {
    if (this.lista.length < MAXIMO_DE_AVISOS) this.lista.push(aviso);
    else this.omitidos += 1;
  }
}

interface Ignorados {
  cantidad: number;
  readonly lista: string[];
}

/** Lo que se recuerda de cada planilla leída, sin sus filas. */
interface DatosDePlanilla {
  readonly archivo: ArchivoDeLibro;
  /** Mes con más filas de la planilla: el libro que la planilla dice ser. */
  readonly periodoPrincipal: string;
  /** Filas que no entran al cálculo: rechazadas al leer, futuras o corridas. */
  readonly filasDescartadas: number;
}

interface Ganadora {
  readonly planilla: DatosDePlanilla;
  readonly filas: FilaDeLibro[];
  /** Si el período del grupo es el principal de la planilla. */
  readonly esPrincipal: boolean;
}

class ClienteOmitidoError extends Error {}

async function liquidarCliente(
  deps: DependenciasDeLiquidacion,
  cliente: ClienteListado,
  usuarioId: string,
  fallos: FalloDeLiquidacion[],
  avisos: Avisos,
  ignorados: Ignorados,
): Promise<{
  periodos: number;
  archivos: number;
  filas: number;
  rechazadas: number;
  hallazgos: number;
  repetidos: number;
}> {
  const avisar = (archivo: ArchivoDeLibro, motivo: string) =>
    avisos.agregar({ cliente: cliente.nombre, archivo: identificar(archivo), motivo });
  const ignorar = (archivo: ArchivoDeLibro) => {
    ignorados.cantidad += 1;
    if (ignorados.lista.length < MAXIMO_DE_AVISOS) ignorados.lista.push(`${cliente.nombre}: ${identificar(archivo)}`);
  };

  /*
   * Se abren TODOS los Excel clasificados como libro, y el contenido decide.
   *
   * Hasta el 2026-09-15 solo se leían los que se llamaban "RG COMPRAS …" o
   * "RG VENTAS …", y COPESA —que guarda sus libros como
   * "RG 90 COMPRAS/01 ENERO.xlsx"— tenía IVA de 2 períodos. Es el mismo error
   * que ya se había corregido para las declaraciones (DISCREPANCIAS 23 y 25):
   * el nombre lo escribe una persona, los encabezados no.
   *
   * Se leen de la que MÁS manda a la que menos: así la primera que reclama un
   * período es la ganadora, y las filas de las que pierden se sueltan apenas
   * se leen, en vez de guardar todas las planillas del cliente en memoria.
   */
  const todos = await deps.librosDelCliente(cliente.id);
  for (const viejo of todos.filter((a) => a.tipoMime === XLS)) {
    avisar(viejo, 'Formato .xls (Excel viejo): no se puede leer. Si es una planilla RG 90, guardarla como .xlsx.');
  }
  const archivos = todos.filter((a) => a.tipoMime === XLSX).sort((a, b) => prioridad(b, a));
  const tope = mesEnCurso((deps.ahora ?? (() => new Date()))());

  const ganadoras = new Map<string, Ganadora>();
  const planillas: DatosDePlanilla[] = [];

  for (const archivo of archivos) {
    if ((archivo.tamanoBytes ?? 0) > TAMANO_MAXIMO_DE_PLANILLA_BYTES) {
      fallos.push({
        cliente: cliente.nombre,
        archivo: identificar(archivo),
        motivo: `Pesa ${((archivo.tamanoBytes ?? 0) / 1024 / 1024).toFixed(1)} MB: demasiado para ser una planilla RG 90. No se leyó.`,
      });
      continue;
    }

    let reporte;
    try {
      const contenido = await deps.drive.leer(archivo.itemIdOneDrive);
      reporte = await importarLibroRg90(contenido, archivo.nombreArchivo);
    } catch (error) {
      // Un Excel que no es planilla RG 90 no es una falla: se abre porque el
      // contenido es lo que decide, y a veces decide que no.
      if (error instanceof NoEsPlanillaRg90) {
        ignorar(archivo);
        continue;
      }
      // Una falla pasajera deja al cliente entero sin calcular en esta vuelta:
      // si justo era la planilla que manda, calcular sin ella haría ganar a
      // una versión vieja, y sus hallazgos quedarían guardados.
      if (error instanceof ErrorTransitorioDeDrive) {
        throw new ClienteOmitidoError(`${identificar(archivo)}: ${error.message}`);
      }
      // Una planilla ilegible no puede dejar sin IVA a los otros períodos del
      // mismo cliente: se anota y se sigue.
      fallos.push({
        cliente: cliente.nombre,
        archivo: identificar(archivo),
        motivo: error instanceof Error ? error.message : 'No se pudo leer la planilla.',
      });
      continue;
    }

    /*
     * Los libros que descarga la DNIT ("80003112_202501_COMPRAS_150121_1.xlsx")
     * se leen sin ninguna fila. No hay nada que calcular y tampoco nada roto.
     */
    if (reporte.filas.length === 0 && reporte.rechazadas.length === 0) {
      ignorar(archivo);
      continue;
    }

    // Una planilla RG 90 de la que no se pudo usar NINGUNA fila no es un
    // detalle: es IVA que falta. Va a fallos, no a avisos.
    if (reporte.filas.length === 0) {
      fallos.push({
        cliente: cliente.nombre,
        archivo: identificar(archivo),
        motivo: `Ninguna de sus ${reporte.rechazadas.length} filas se pudo leer. Primera: fila ${reporte.rechazadas[0]!.numeroFila}, ${reporte.rechazadas[0]!.motivo}`,
      });
      continue;
    }
    if (reporte.rechazadas.length > 0) {
      avisar(
        archivo,
        `${reporte.rechazadas.length} filas rechazadas al leer. Primera: fila ${reporte.rechazadas[0]!.numeroFila}, ${reporte.rechazadas[0]!.motivo}`,
      );
    }

    const grupos = new Map<string, FilaDeLibro[]>();
    const filasPorPeriodo = new Map<string, number>();
    let futuras = 0;
    let corridas = 0;
    for (const fila of reporte.filas) {
      /*
       * Un período que todavía no llegó no puede tener comprobantes. Caso
       * real: "PERIODO 2026/…/RG 90 COMPRAS/01 ENERO.xlsx" de COPESA trae
       * filas con 2027-01 … 2032-01 porque la columna de período se arrastró
       * en el Excel. Tomarlas crearía liquidaciones de años que no pasaron.
       */
      if (fila.periodo > tope) {
        futuras += 1;
        continue;
      }
      // Y cuando esos años lleguen, la fecha de emisión las sigue delatando.
      const emision = mesDeEmision(fila);
      if (emision !== null && mesesEntre(emision, fila.periodo) >= MESES_DE_ARRASTRE_SOSPECHOSO) {
        corridas += 1;
        continue;
      }
      const clave = `${fila.periodo}|${fila.tipoRegistro}`;
      const grupo = grupos.get(clave);
      if (grupo) grupo.push(fila);
      else grupos.set(clave, [fila]);
      filasPorPeriodo.set(fila.periodo, (filasPorPeriodo.get(fila.periodo) ?? 0) + 1);
    }

    if (futuras > 0) {
      avisar(archivo, `${futuras} filas rechazadas: su período es posterior al mes en curso (${tope}).`);
    }
    if (corridas > 0) {
      avisar(
        archivo,
        `${corridas} filas dejadas afuera: su período está ${MESES_DE_ARRASTRE_SOSPECHOSO} meses o más ` +
          'después de la fecha de emisión (probable columna de período arrastrada en el Excel).',
      );
    }
    if (filasPorPeriodo.size === 0) {
      // Todas sus filas eran futuras o corridas: se leyó, pero no aporta nada.
      planillas.push({ archivo, periodoPrincipal: '', filasDescartadas: reporte.rechazadas.length + futuras + corridas });
      continue;
    }

    // Mes principal: el de más filas; si empatan, el más antiguo.
    const periodoPrincipal = [...filasPorPeriodo.entries()].sort(
      ([pa, na], [pb, nb]) => nb - na || pa.localeCompare(pb),
    )[0]![0];
    const planilla: DatosDePlanilla = {
      archivo,
      periodoPrincipal,
      filasDescartadas: reporte.rechazadas.length + futuras + corridas,
    };
    planillas.push(planilla);

    /*
     * UNA sola planilla por período y tipo de registro.
     *
     * Hasta el 2026-09-15 se juntaban las filas de todas las planillas de un
     * período (DISCREPANCIAS 24). Con los libros de COPESA eso no alcanza:
     * agosto 2025 está en "08 Agosto 2025 ok verificado.xlsx" (568 filas) y en
     * "AGOSTO 2025.xlsx" (464), con contenido distinto. Unirlas mezcla dos
     * versiones del libro.
     *
     * Y el período lo gana la planilla que lo tiene como PRINCIPAL: unas pocas
     * filas sueltas de otro mes en una planilla más nueva no pueden desplazar
     * al libro de ese mes. Esas filas sueltas solo se usan si ninguna planilla
     * tiene ese mes como principal, y se avisa.
     */
    for (const [clave, filas] of grupos) {
      const esPrincipal = clave.startsWith(`${periodoPrincipal}|`);
      const actual = ganadoras.get(clave);

      if (!actual) {
        ganadoras.set(clave, { planilla, filas, esPrincipal });
        continue;
      }
      if (esPrincipal && !actual.esPrincipal) {
        // Llega el libro de verdad de ese mes: las filas sueltas se sueltan.
        avisar(
          actual.planilla.archivo,
          `Filas sueltas de ${describirGrupo(clave)} descartadas: "${identificar(archivo)}" es el libro de ese mes.`,
        );
        ganadoras.set(clave, { planilla, filas, esPrincipal });
        continue;
      }
      // La actual se leyó antes, así que manda (o también es principal y
      // esta es suelta): esta pierde, y sus filas no se guardan.
      avisar(
        archivo,
        esPrincipal || !actual.esPrincipal
          ? motivoDeDescarte(actual.planilla.archivo, archivo, describirGrupo(clave))
          : `Filas sueltas de ${describirGrupo(clave)} ignoradas: "${identificar(actual.planilla.archivo)}" es el libro de ese mes.`,
      );
    }
  }

  // Por período: las filas elegidas de compras y de ventas, y qué planillas las aportaron.
  const porPeriodo = new Map<string, { filas: FilaDeLibro[]; planillas: Set<DatosDePlanilla> }>();
  let repetidos = 0;
  let totalFilas = 0;
  for (const [clave, { planilla, filas, esPrincipal }] of ganadoras) {
    const periodo = clave.split('|')[0]!;
    const destino = porPeriodo.get(periodo) ?? { filas: [], planillas: new Set<DatosDePlanilla>() };
    porPeriodo.set(periodo, destino);
    destino.planillas.add(planilla);

    if (!esPrincipal) {
      avisar(
        planilla.archivo,
        `${describirGrupo(clave)} se calculó con ${filas.length} filas de esta planilla, cuyo mes principal es ` +
          `${planilla.periodoPrincipal}: no hay otra planilla de ese mes. Revisar.`,
      );
    }

    // Dentro de una misma planilla, una fila repetida cuenta una vez (vale la última).
    const unicas = new Map<string, FilaDeLibro>();
    for (const fila of filas) unicas.set(claveDeComprobante(fila), fila);
    const repetidasAca = filas.length - unicas.size;
    if (repetidasAca > 0) {
      repetidos += repetidasAca;
      avisar(
        planilla.archivo,
        `${repetidasAca} filas repetidas de ${describirGrupo(clave)} dentro de la planilla se contaron una sola vez (vale la última).`,
      );
    }
    destino.filas.push(...unicas.values());
    totalFilas += unicas.size;
  }

  let periodos = 0;
  let hallazgos = 0;

  for (const [periodo, { filas: delPeriodo, planillas: usadas }] of porPeriodo) {
    const resumen = resumirIva(delPeriodo, periodo);

    /*
     * `saldoAFavorAnterior` en cero, y es una simplificación declarada.
     *
     * El saldo a favor de un período se arrastra al siguiente, así que el
     * cálculo correcto encadena los períodos en orden. Acá cada uno se calcula
     * aislado: el crédito y el débito del período son exactos, pero el saldo
     * final no contempla lo que venía arrastrado.
     *
     * Se deja así a propósito hasta tener los períodos completos y en orden —
     * arrastrar un saldo desde un período que falta daría un número peor que no
     * arrastrarlo, porque parecería correcto. La tarea 138 del roadmap lo
     * resuelve tomando el saldo declarado.
     */
    const determinacion = determinarIva({
      debitoFiscal: resumen.debitoFiscal,
      creditoFiscal: resumen.creditoFiscal,
      saldoAFavorAnterior: gs(0),
    });

    // Las filas descartadas de una planilla se atribuyen a su mes principal.
    const rechazadasDelPeriodo = [...usadas]
      .filter((p) => p.periodoPrincipal === periodo)
      .reduce((suma, p) => suma + p.filasDescartadas, 0);

    await deps.guardarLiquidacion({
      clienteId: cliente.id,
      periodo,
      creditoFiscal: resumen.creditoFiscal,
      debitoFiscal: resumen.debitoFiscal,
      saldoAPagar: determinacion.saldoAPagar,
      saldoAFavor: determinacion.saldoAFavor,
      comprobantesCompras: resumen.comprobantesCompras,
      comprobantesVentas: resumen.comprobantesVentas,
      gravado10Compras: resumen.gravado10Compras,
      gravado5Compras: resumen.gravado5Compras,
      exentoCompras: resumen.exentoCompras,
      gravado10Ventas: resumen.gravado10Ventas,
      gravado5Ventas: resumen.gravado5Ventas,
      exentoVentas: resumen.exentoVentas,
      archivosLeidos: usadas.size,
      filasRechazadas: rechazadasDelPeriodo,
      calculadoPorUsuarioId: usuarioId,
    });

    const encontrados = analizarLibro(delPeriodo, deps.divisores).map((h) => ({
      ...h,
      clienteId: cliente.id,
    }));
    hallazgos += await deps.guardarHallazgos(encontrados);
    periodos += 1;
  }

  return {
    periodos,
    archivos: planillas.length,
    filas: totalFilas,
    rechazadas: planillas.reduce((suma, p) => suma + p.filasDescartadas, 0),
    hallazgos,
    repetidos,
  };
}

export async function liquidarIvaDesdeLibros(
  deps: DependenciasDeLiquidacion,
  usuarioId: string,
): Promise<ResumenDeLiquidacion> {
  const clientes = await deps.clientes.listar(null);
  const fallos: FalloDeLiquidacion[] = [];
  const avisos = new Avisos();
  const ignorados: Ignorados = { cantidad: 0, lista: [] };
  const clientesOmitidos: ClienteOmitido[] = [];

  let periodosCalculados = 0;
  let archivosLeidos = 0;
  let filasInterpretadas = 0;
  let filasRechazadas = 0;
  let hallazgosNuevos = 0;
  let comprobantesRepetidos = 0;

  for (const cliente of clientes) {
    if (!cliente.activo) continue;

    let parcial;
    try {
      parcial = await liquidarCliente(deps, cliente, usuarioId, fallos, avisos, ignorados);
    } catch (error) {
      if (!(error instanceof ClienteOmitidoError)) throw error;
      // No se escribió nada de este cliente: la liquidación anterior queda como
      // estaba hasta la próxima corrida.
      clientesOmitidos.push({
        cliente: cliente.nombre,
        motivo: `No se calculó en esta corrida porque una planilla no se pudo bajar (${error.message}).`,
      });
      continue;
    }
    periodosCalculados += parcial.periodos;
    archivosLeidos += parcial.archivos;
    filasInterpretadas += parcial.filas;
    filasRechazadas += parcial.rechazadas;
    hallazgosNuevos += parcial.hallazgos;
    comprobantesRepetidos += parcial.repetidos;
  }

  return {
    periodosCalculados,
    archivosLeidos,
    filasInterpretadas,
    filasRechazadas,
    hallazgosNuevos,
    comprobantesRepetidos,
    archivosIgnorados: ignorados.cantidad,
    archivosIgnoradosLista: ignorados.lista,
    avisos: avisos.lista,
    avisosOmitidos: avisos.omitidos,
    clientesOmitidos,
    fallos,
  };
}
