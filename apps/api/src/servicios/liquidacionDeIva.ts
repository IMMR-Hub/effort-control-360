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
 * **Qué hace, en orden:** por cada cliente busca sus planillas RG 90 en Excel
 * entre las evidencias ya sincronizadas, las lee, junta las filas por período,
 * y por cada período guarda el IVA calculado y los hallazgos encontrados.
 *
 * **Qué NO hace:** no descarga de OneDrive lo que no esté ya sincronizado, no
 * escribe nada en el drive, y no decide a quién avisar — eso es del motor de
 * alertas. Este servicio calcula y guarda.
 *
 * **Es seguro repetirlo.** Volver a correrlo sobre el mismo período reemplaza la
 * liquidación y no duplica hallazgos (la base lo garantiza con sus claves
 * únicas). Hace falta que sea así: corre solo, y una planilla corregida tiene
 * que poder reimportarse sin ensuciar nada.
 */

import {
  analizarLibro,
  importarLibroRg90,
  resumirIva,
  type HallazgoDeLibro,
  type FilaDeLibro,
} from '@effort/importers';
import { determinarIva, gs, type DivisoresIva, type Gs } from '@effort/core';
import type { DriveDeArchivos } from '@effort/drive';

import type { ClienteListado, RepositorioDeClientes } from '../puertos.js';

/** Formatos de Excel que puede traer una planilla. */
const FORMATOS_EXCEL = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

/**
 * Cómo se reconoce una planilla RG 90 entre todos los archivos del cliente.
 *
 * Por el nombre, que es lo que EFFORT controla: sus archivos se llaman
 * `RG COMPRAS MARZO 2026 - FUMIPRO SA.xlsx` y `RG VENTAS …`. No alcanza con el
 * tipo de documento porque un PDF del mismo libro también se clasifica como
 * libro de compras y no se puede leer.
 */
const NOMBRE_DE_PLANILLA = /^\s*(correccion\s+)?rg\s*(compras|ventas)/i;

export interface ArchivoDeLibro {
  readonly evidenciaId: string;
  readonly clienteId: string;
  readonly nombreArchivo: string;
  readonly itemIdOneDrive: string;
  readonly tipoMime: string;
  /** Fecha de modificación en OneDrive. Decide qué versión manda si hay dos. */
  readonly modificadoEnOrigen?: Date | null;
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
  readonly archivosLeidos: number;
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
}

export interface FalloDeLiquidacion {
  readonly cliente: string;
  readonly archivo: string;
  readonly motivo: string;
}

export interface ResumenDeLiquidacion {
  readonly periodosCalculados: number;
  readonly archivosLeidos: number;
  readonly filasInterpretadas: number;
  readonly filasRechazadas: number;
  readonly hallazgosNuevos: number;
  /** Comprobantes que aparecían en más de una planilla y se contaron una sola vez. */
  readonly comprobantesRepetidos: number;
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
 * Orden en que se leen las planillas: la que manda va ÚLTIMA y pisa a las demás.
 *
 * Una corrección manda sobre el original (EFFORT las nombra "CORRECCION RG
 * COMPRAS …"); entre dos que no lo son, la modificada más recientemente.
 */
function ordenDePrioridad(a: ArchivoDeLibro, b: ArchivoDeLibro): number {
  const correccion = (x: ArchivoDeLibro) => (/^\s*correccion/i.test(x.nombreArchivo) ? 1 : 0);
  const fecha = (x: ArchivoDeLibro) => x.modificadoEnOrigen?.getTime() ?? 0;
  return correccion(a) - correccion(b) || fecha(a) - fecha(b);
}

/** Agrupa las filas de todos los libros de un cliente por período fiscal. */
function porPeriodo(filas: readonly FilaDeLibro[]): Map<string, FilaDeLibro[]> {
  const mapa = new Map<string, FilaDeLibro[]>();
  for (const fila of filas) {
    const yaEstaban = mapa.get(fila.periodo);
    if (yaEstaban) yaEstaban.push(fila);
    else mapa.set(fila.periodo, [fila]);
  }
  return mapa;
}

async function liquidarCliente(
  deps: DependenciasDeLiquidacion,
  cliente: ClienteListado,
  usuarioId: string,
  fallos: FalloDeLiquidacion[],
): Promise<{
  periodos: number;
  archivos: number;
  filas: number;
  rechazadas: number;
  hallazgos: number;
  repetidos: number;
}> {
  const archivos = (await deps.librosDelCliente(cliente.id))
    .filter((a) => FORMATOS_EXCEL.has(a.tipoMime) && NOMBRE_DE_PLANILLA.test(a.nombreArchivo))
    .sort(ordenDePrioridad);

  /*
   * Un comprobante cuenta UNA vez, aunque esté en varias planillas.
   *
   * Hasta el 2026-09-14 las filas de todas las planillas del cliente se
   * juntaban sin mirar repeticiones, y en el OneDrive real hay períodos con dos:
   * FUMIPRO julio 2026 tiene "RG COMPRAS 07 2026" y "CORRECCION RG COMPRAS 07
   * 2026"; ECOAGRO febrero 2025 tiene dos versiones en carpetas distintas. El
   * crédito fiscal de esos períodos salía sumado dos veces.
   *
   * Las planillas se leen en orden de prioridad y la última pisa: si la
   * corrección cambió un importe, vale el de la corrección.
   */
  const porComprobante = new Map<string, FilaDeLibro>();
  let rechazadas = 0;
  let leidos = 0;
  let repetidos = 0;

  for (const archivo of archivos) {
    try {
      const contenido = await deps.drive.leer(archivo.itemIdOneDrive);
      const reporte = await importarLibroRg90(contenido, archivo.nombreArchivo);
      for (const fila of reporte.filas) {
        const clave = claveDeComprobante(fila);
        if (porComprobante.has(clave)) repetidos += 1;
        porComprobante.set(clave, fila);
      }
      rechazadas += reporte.rechazadas.length;
      leidos += 1;
    } catch (error) {
      // Una planilla ilegible no puede dejar sin IVA a los otros períodos del
      // mismo cliente: se anota y se sigue.
      fallos.push({
        cliente: cliente.nombre,
        archivo: archivo.nombreArchivo,
        motivo: error instanceof Error ? error.message : 'No se pudo leer la planilla.',
      });
    }
  }

  const filas = [...porComprobante.values()];
  let periodos = 0;
  let hallazgos = 0;

  for (const [periodo, delPeriodo] of porPeriodo(filas)) {
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
     * arrastrarlo, porque parecería correcto. Queda anotado en el roadmap.
     */
    const determinacion = determinarIva({
      debitoFiscal: resumen.debitoFiscal,
      creditoFiscal: resumen.creditoFiscal,
      saldoAFavorAnterior: gs(0),
    });

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
      archivosLeidos: leidos,
      filasRechazadas: rechazadas,
      calculadoPorUsuarioId: usuarioId,
    });

    const encontrados = analizarLibro(delPeriodo, deps.divisores).map((h) => ({
      ...h,
      clienteId: cliente.id,
    }));
    hallazgos += await deps.guardarHallazgos(encontrados);
    periodos += 1;
  }

  return { periodos, archivos: leidos, filas: filas.length, rechazadas, hallazgos, repetidos };
}

export async function liquidarIvaDesdeLibros(
  deps: DependenciasDeLiquidacion,
  usuarioId: string,
): Promise<ResumenDeLiquidacion> {
  const clientes = await deps.clientes.listar(null);
  const fallos: FalloDeLiquidacion[] = [];

  let periodosCalculados = 0;
  let archivosLeidos = 0;
  let filasInterpretadas = 0;
  let filasRechazadas = 0;
  let hallazgosNuevos = 0;
  let comprobantesRepetidos = 0;

  for (const cliente of clientes) {
    if (!cliente.activo) continue;

    const parcial = await liquidarCliente(deps, cliente, usuarioId, fallos);
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
    fallos,
  };
}
