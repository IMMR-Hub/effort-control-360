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
 * que poder reimportarse sin ensuciar nada.
 */

import {
  analizarLibro,
  importarLibroRg90,
  NoEsPlanillaRg90,
  resumirIva,
  type HallazgoDeLibro,
  type FilaDeLibro,
} from '@effort/importers';
import { determinarIva, gs, hoyEnParaguay, type DivisoresIva, type Gs } from '@effort/core';
import type { DriveDeArchivos } from '@effort/drive';

import type { ClienteListado, RepositorioDeClientes } from '../puertos.js';

/** Formatos de Excel que puede traer una planilla. */
const FORMATOS_EXCEL = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

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
  /** Reloj inyectable para los tests. Decide qué período es "futuro". */
  readonly ahora?: () => Date;
}

export interface FalloDeLiquidacion {
  readonly cliente: string;
  readonly archivo: string;
  readonly motivo: string;
}

/**
 * Algo que se dejó afuera a propósito y que una persona tiene que poder ver:
 * una planilla reemplazada por otra más nueva, o filas con un período que
 * todavía no ocurrió.
 */
export interface AvisoDeLiquidacion {
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
  /** Excel clasificados como libro que no son planillas RG 90. No son fallos. */
  readonly archivosIgnorados: number;
  readonly avisos: readonly AvisoDeLiquidacion[];
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

/** "CORRECCION" en cualquier parte del nombre, con o sin tilde. */
function esCorreccion(archivo: ArchivoDeLibro): boolean {
  const sinTildes = archivo.nombreArchivo.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /correccion/i.test(sinTildes);
}

/**
 * Cuál de dos planillas del mismo período manda: positivo si manda `a`.
 *
 * Una corrección manda sobre el original; entre dos que no lo son (o dos que
 * lo son), la modificada más recientemente en OneDrive.
 */
function prioridad(a: ArchivoDeLibro, b: ArchivoDeLibro): number {
  const fecha = (x: ArchivoDeLibro) => x.modificadoEnOrigen?.getTime() ?? 0;
  return Number(esCorreccion(a)) - Number(esCorreccion(b)) || fecha(a) - fecha(b);
}

/** `AAAA-MM` del mes en curso en Paraguay. */
function mesEnCurso(instante: Date): string {
  const hoy = hoyEnParaguay(instante);
  return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
}

interface PlanillaLeida {
  readonly archivo: ArchivoDeLibro;
  /** Filas agrupadas por `periodo|tipoRegistro`. */
  readonly grupos: Map<string, FilaDeLibro[]>;
}

async function liquidarCliente(
  deps: DependenciasDeLiquidacion,
  cliente: ClienteListado,
  usuarioId: string,
  fallos: FalloDeLiquidacion[],
  avisos: AvisoDeLiquidacion[],
): Promise<{
  periodos: number;
  archivos: number;
  ignorados: number;
  filas: number;
  rechazadas: number;
  hallazgos: number;
  repetidos: number;
}> {
  /*
   * Se abren TODOS los Excel clasificados como libro, y el contenido decide.
   *
   * Hasta el 2026-09-15 solo se leían los que se llamaban "RG COMPRAS …" o
   * "RG VENTAS …", y COPESA —que guarda sus libros como
   * "RG 90 COMPRAS/01 ENERO.xlsx"— tenía IVA de 2 períodos. Es el mismo error
   * que ya se había corregido para las declaraciones (DISCREPANCIAS 23 y 25):
   * el nombre lo escribe una persona, los encabezados no.
   */
  const archivos = (await deps.librosDelCliente(cliente.id)).filter((a) =>
    FORMATOS_EXCEL.has(a.tipoMime),
  );
  const tope = mesEnCurso((deps.ahora ?? (() => new Date()))());

  const leidas: PlanillaLeida[] = [];
  let rechazadas = 0;
  let ignorados = 0;

  for (const archivo of archivos) {
    try {
      const contenido = await deps.drive.leer(archivo.itemIdOneDrive);
      const reporte = await importarLibroRg90(contenido, archivo.nombreArchivo);

      /*
       * Los libros que descarga la DNIT ("80003112_202501_COMPRAS_150121_1.xlsx")
       * se leen sin ninguna fila. No hay nada que calcular y tampoco nada roto.
       */
      if (reporte.filas.length === 0 && reporte.rechazadas.length === 0) {
        ignorados += 1;
        continue;
      }
      rechazadas += reporte.rechazadas.length;

      const grupos = new Map<string, FilaDeLibro[]>();
      let futuras = 0;
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
        const clave = `${fila.periodo}|${fila.tipoRegistro}`;
        const grupo = grupos.get(clave);
        if (grupo) grupo.push(fila);
        else grupos.set(clave, [fila]);
      }

      if (futuras > 0) {
        rechazadas += futuras;
        avisos.push({
          cliente: cliente.nombre,
          archivo: archivo.nombreArchivo,
          motivo: `${futuras} filas rechazadas: su período es posterior al mes en curso (${tope}).`,
        });
      }
      leidas.push({ archivo, grupos });
    } catch (error) {
      // Un Excel que no es planilla RG 90 no es una falla: se abre porque el
      // contenido es lo que decide, y a veces decide que no.
      if (error instanceof NoEsPlanillaRg90) {
        ignorados += 1;
        continue;
      }
      // Una planilla ilegible no puede dejar sin IVA a los otros períodos del
      // mismo cliente: se anota y se sigue.
      fallos.push({
        cliente: cliente.nombre,
        archivo: archivo.nombreArchivo,
        motivo: error instanceof Error ? error.message : 'No se pudo leer la planilla.',
      });
    }
  }

  /*
   * UNA sola planilla por período y tipo de registro.
   *
   * Hasta el 2026-09-15 se juntaban las filas de todas las planillas de un
   * período, contando cada comprobante una vez (DISCREPANCIAS 24). Con los
   * libros de COPESA eso no alcanza: agosto 2025 está en
   * "08 Agosto 2025 ok verificado.xlsx" (568 filas) y en "AGOSTO 2025.xlsx"
   * (464), con contenido distinto. Unirlas mezcla dos versiones del libro y da
   * un IVA que no corresponde a ninguna. Se toma la que manda y las demás se
   * informan.
   */
  const elegidas = new Map<string, PlanillaLeida>();
  for (const leida of leidas) {
    for (const clave of leida.grupos.keys()) {
      const actual = elegidas.get(clave);
      if (!actual || prioridad(leida.archivo, actual.archivo) > 0) elegidas.set(clave, leida);
    }
  }

  for (const leida of leidas) {
    for (const clave of leida.grupos.keys()) {
      const elegida = elegidas.get(clave)!;
      if (elegida === leida) continue;
      const [periodo, registro] = clave.split('|');
      avisos.push({
        cliente: cliente.nombre,
        archivo: leida.archivo.nombreArchivo,
        motivo: `Planilla descartada por existir una más reciente (${registro} ${periodo}): se usó "${elegida.archivo.nombreArchivo}".`,
      });
    }
  }

  // Por período: las filas elegidas de compras y de ventas, y qué archivos las aportaron.
  const porPeriodo = new Map<string, { filas: FilaDeLibro[]; archivos: Set<string> }>();
  let repetidos = 0;
  let totalFilas = 0;
  for (const [clave, leida] of elegidas) {
    const periodo = clave.split('|')[0]!;
    const destino = porPeriodo.get(periodo) ?? { filas: [], archivos: new Set<string>() };
    porPeriodo.set(periodo, destino);
    destino.archivos.add(leida.archivo.evidenciaId);

    // Dentro de una misma planilla, una fila repetida sigue contando una vez.
    const unicas = new Map<string, FilaDeLibro>();
    for (const fila of leida.grupos.get(clave)!) {
      const id = claveDeComprobante(fila);
      if (unicas.has(id)) repetidos += 1;
      unicas.set(id, fila);
    }
    destino.filas.push(...unicas.values());
    totalFilas += unicas.size;
  }

  let periodos = 0;
  let hallazgos = 0;

  for (const [periodo, { filas: delPeriodo, archivos: usados }] of porPeriodo) {
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
      archivosLeidos: usados.size,
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

  return {
    periodos,
    archivos: leidas.length,
    ignorados,
    filas: totalFilas,
    rechazadas,
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
  const avisos: AvisoDeLiquidacion[] = [];

  let periodosCalculados = 0;
  let archivosLeidos = 0;
  let filasInterpretadas = 0;
  let filasRechazadas = 0;
  let hallazgosNuevos = 0;
  let comprobantesRepetidos = 0;
  let archivosIgnorados = 0;

  for (const cliente of clientes) {
    if (!cliente.activo) continue;

    const parcial = await liquidarCliente(deps, cliente, usuarioId, fallos, avisos);
    periodosCalculados += parcial.periodos;
    archivosLeidos += parcial.archivos;
    filasInterpretadas += parcial.filas;
    filasRechazadas += parcial.rechazadas;
    hallazgosNuevos += parcial.hallazgos;
    comprobantesRepetidos += parcial.repetidos;
    archivosIgnorados += parcial.ignorados;
  }

  return {
    periodosCalculados,
    archivosLeidos,
    filasInterpretadas,
    filasRechazadas,
    hallazgosNuevos,
    comprobantesRepetidos,
    archivosIgnorados,
    avisos,
    fallos,
  };
}
