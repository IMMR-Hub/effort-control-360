/**
 * Marca como presentados los vencimientos que tienen su declaración en OneDrive.
 *
 * Daniel, 2026-09-14: *"¿por qué tenés 0 de 150? ¿No encontraste los documentos
 * de que se presentó?"*. La sincronización había traído las declaraciones
 * juradas y los talones de la RG 90, pero nada los cruzaba con los vencimientos:
 * el motor de alertas decía "vencido sin presentar" de lo que EFFORT había
 * presentado a tiempo, y 96 alertas críticas eran ruido.
 *
 * Dos pasos, separados a propósito:
 *
 *  1. **Leer.** Se bajan los PDFs que todavía no se miraron y se reconoce si
 *     son una presentación ante la DNIT (`reconocerDeclaracionDnit`). Lo que se
 *     encuentra se guarda, también cuando no es nada: un PDF se lee una sola vez.
 *  2. **Cruzar.** Cada presentación reconocida se busca entre los vencimientos
 *     pendientes del cliente: mismo formulario, mismo período, mismo RUC.
 *
 * Separarlos permite que el cruce corra sobre TODO lo leído aunque la lectura
 * de esta vuelta haya tenido un tope, y que un vencimiento generado mañana se
 * cierre con una declaración leída hace un mes.
 *
 * **Lo que NUNCA hace:** marcar algo sin número de orden, sin fecha, o con un
 * RUC distinto al del cliente. Un falso "presentado" apaga la alerta que evita
 * una multa. Ante la duda, la alerta queda.
 */

import {
  OBLIGACION_POR_FORMULARIO,
  reconocerDeclaracionDnit,
  type DeclaracionDnit,
} from '@effort/importers';

/** Un PDF del OneDrive que todavía no se leyó. */
export interface PdfPorLeer {
  readonly evidenciaId: string;
  readonly clienteId: string;
  readonly itemIdOneDrive: string;
  readonly nombreArchivo: string;
}

/** Una presentación ya reconocida, lista para cruzar. */
export interface PresentacionLeida extends DeclaracionDnit {
  readonly evidenciaId: string;
  readonly clienteId: string;
}

/** Un vencimiento que todavía no figura como presentado. */
export interface VencimientoPendiente {
  readonly id: string;
  readonly clienteId: string;
  /** RUC del cliente tal como está cargado, con dígito verificador. */
  readonly rucCliente: string;
  readonly codigoObligacion: string;
  readonly periodo: string;
  /** `AAAA-MM-DD`. */
  readonly fechaVencimiento: string;
}

export interface DependenciasDelDetector {
  pdfsPorLeer(limite: number): Promise<readonly PdfPorLeer[]>;
  leerArchivo(itemId: string): Promise<Buffer>;
  extraerTexto(contenido: Buffer): Promise<string>;
  guardarLectura(
    pdf: PdfPorLeer,
    resultado: { declaracion: DeclaracionDnit | null; error: string | null },
  ): Promise<void>;
  presentacionesLeidas(): Promise<readonly PresentacionLeida[]>;
  vencimientosPendientes(): Promise<readonly VencimientoPendiente[]>;
  marcarPresentado(
    vencimientoId: string,
    fechaPresentacion: Date,
    evidenciaId: string,
    usuarioId: string,
  ): Promise<void>;
  registrarEnBitacora(entrada: {
    readonly vencimientoId: string;
    readonly clienteId: string;
    readonly evidenciaId: string;
    readonly numeroDeOrden: string;
    readonly fechaDePresentacion: string;
    readonly fueraDeTermino: boolean;
    readonly diasDeAtraso: number;
    /** Si la fecha es la de impresión del aviso: los días son un máximo. */
    readonly fechaAproximada: boolean;
  }): Promise<void>;
}

export interface ResumenDelDetector {
  readonly pdfsLeidos: number;
  readonly presentacionesNuevas: number;
  readonly erroresDeLectura: number;
  readonly vencimientosMarcados: number;
  /** Presentados después de la fecha de vencimiento: se informan los días de atraso. */
  readonly fueraDeTermino: number;
}

/**
 * Cuántos PDFs se leen por vuelta.
 *
 * Tope por la misma razón que la sincronización (`CLAUDE.md`, lección 4): el
 * contenedor tiene 512 MB y un trabajo de fondo sin tope ya tumbó el sistema
 * una vez. Con miles de PDFs la primera pasada tarda varias horas en completarse,
 * y está bien: las declaraciones más nuevas son las que llegan primero.
 */
export const PDFS_POR_VUELTA = 60;

/**
 * RUC sin dígito verificador: `80119631-0` → `80119631`.
 *
 * Exportada porque el motor de alertas levanta un aviso justamente cuando esta
 * comparación da distinto (`ORIGEN_DECLARACION_AJENA`). Si cada uno tuviera su
 * propia versión, podría alertarse por un archivo que el detector sí aceptó, o
 * peor, no alertarse por uno que descartó. Una sola definición, un solo criterio.
 */
export function rucBase(ruc: string): string {
  return ruc.split('-')[0]!.replace(/\D/g, '');
}

function diasEntre(desdeIso: string, hastaIso: string): number {
  return Math.round((Date.parse(hastaIso) - Date.parse(desdeIso)) / 86_400_000);
}

export async function detectarPresentaciones(
  deps: DependenciasDelDetector,
  usuarioId: string,
  limite: number = PDFS_POR_VUELTA,
): Promise<ResumenDelDetector> {
  let pdfsLeidos = 0;
  let presentacionesNuevas = 0;
  let erroresDeLectura = 0;

  for (const pdf of await deps.pdfsPorLeer(limite)) {
    let declaracion: DeclaracionDnit | null = null;
    let error: string | null = null;
    try {
      declaracion = reconocerDeclaracionDnit(await deps.extraerTexto(await deps.leerArchivo(pdf.itemIdOneDrive)));
    } catch (fallo) {
      // Un PDF roto no frena a los demás. Se guarda el error para no
      // reintentarlo en cada vuelta, y para que se vea.
      error = (fallo instanceof Error ? fallo.message : 'No se pudo leer el PDF.').slice(0, 200);
      erroresDeLectura += 1;
    }
    await deps.guardarLectura(pdf, { declaracion, error });
    pdfsLeidos += 1;
    if (declaracion) presentacionesNuevas += 1;
  }

  const [presentaciones, pendientes] = await Promise.all([
    deps.presentacionesLeidas(),
    deps.vencimientosPendientes(),
  ]);

  let vencimientosMarcados = 0;
  let fueraDeTermino = 0;

  for (const vencimiento of pendientes) {
    const candidatas = presentaciones.filter(
      (p) =>
        p.clienteId === vencimiento.clienteId &&
        OBLIGACION_POR_FORMULARIO[p.formulario] === vencimiento.codigoObligacion &&
        p.periodo === vencimiento.periodo &&
        // En la carpeta de un cliente puede haber declaraciones de otro
        // contribuyente (un socio, la unipersonal del dueño). El RUC del
        // formulario manda.
        p.ruc === rucBase(vencimiento.rucCliente),
    );
    if (candidatas.length === 0) continue;

    // Si hay original y rectificativas, cuenta la PRIMERA: es la que dice si
    // se presentó a tiempo. Las rectificativas llegan después por definición.
    // A igual fecha gana la exacta: un aviso impreso no desplaza al formulario.
    const primera = [...candidatas].sort(
      (a, b) =>
        a.fechaDePresentacion.localeCompare(b.fechaDePresentacion) ||
        Number(a.fechaAproximada) - Number(b.fechaAproximada),
    )[0]!;

    const atraso = diasEntre(vencimiento.fechaVencimiento, primera.fechaDePresentacion);
    const tarde = atraso > 0;

    await deps.marcarPresentado(
      vencimiento.id,
      new Date(`${primera.fechaDePresentacion}T12:00:00Z`),
      primera.evidenciaId,
      usuarioId,
    );
    await deps.registrarEnBitacora({
      vencimientoId: vencimiento.id,
      clienteId: vencimiento.clienteId,
      evidenciaId: primera.evidenciaId,
      numeroDeOrden: primera.numeroDeOrden,
      fechaDePresentacion: primera.fechaDePresentacion,
      fueraDeTermino: tarde,
      diasDeAtraso: tarde ? atraso : 0,
      fechaAproximada: primera.fechaAproximada,
    });

    vencimientosMarcados += 1;
    if (tarde) fueraDeTermino += 1;
  }

  return { pdfsLeidos, presentacionesNuevas, erroresDeLectura, vencimientosMarcados, fueraDeTermino };
}
