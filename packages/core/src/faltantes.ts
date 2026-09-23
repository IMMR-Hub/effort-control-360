/**
 * Lista de lo que falta subir al OneDrive, por cliente y período.
 *
 * Pedido de Daniel (2026-09-21/22): *"¿cómo se supone que uno puede
 * controlar qué está y qué no está cargado?"* y *"todo está presentado,
 * solo que no subieron al OneDrive; tendremos que hacer un update una vez
 * que iniciemos con todos los documentos faltantes para que lo suban, y que
 * después no se olviden"*.
 *
 * No es una alerta nueva — las alertas ya avisan vencimiento por
 * vencimiento (tarea 151) — sino una vista consolidada, por cliente y
 * período, para pasarle al equipo como lista de lo que tiene que subir.
 *
 * Dos cosas distintas se controlan acá, con datos que ya existen:
 * 1. El comprobante de presentación de cada vencimiento vencido (quien llama
 *    a esta función ya filtró a los que no tienen `estado = 'PRESENTADO'`:
 *    para eso está el radar de `RepositorioDeVencimientos.listar`).
 * 2. Las planillas RG 90 de compras y de ventas en Excel, sin las cuales no
 *    hay IVA — solo para los períodos donde eso aplica (obligaciones
 *    `IVA_GENERAL` o `PLANILLA_RG90`; un EEFF o un IRE anual no las necesita).
 */

/** Un vencimiento vencido sin comprobante de presentación. */
export interface VencimientoVencidoFaltante {
  readonly id: string;
  readonly clienteId: string;
  readonly clienteNombre: string;
  /** "AAAA-MM". `null` en un vencimiento cargado a mano, sin período — se descarta: no hay con qué agruparlo. */
  readonly periodo: string | null;
  /** Código de la obligación (`EEFF`, `IRE`, `IVA_GENERAL`, `PLANILLA_RG90`, …). */
  readonly tipoDocumento: string;
  readonly descripcion: string;
  /** "AAAA-MM-DD". */
  readonly fechaVencimiento: string;
  /** Siempre positivo: quien arma la lista ya filtró a los vencidos. */
  readonly diasDeAtraso: number;
}

/** Lo que hace falta de `LiquidacionIvaRg90` para esta vista: nada de dinero. */
export interface LiquidacionRg90Resumen {
  readonly clienteId: string;
  readonly periodo: string;
  readonly comprobantesCompras: number;
  readonly comprobantesVentas: number;
}

/**
 * Tipos de vencimiento a los que aplica el control de planillas RG 90.
 *
 * Un EEFF o un IRE anual no se calculan desde el libro de compras/ventas
 * mensual: exigirles la planilla sería un falso faltante.
 */
const TIPOS_CON_PLANILLA_RG90 = new Set(['IVA_GENERAL', 'PLANILLA_RG90']);

export type EstadoPlanillaRg90 =
  | 'NO_APLICA'
  | 'SIN_LIQUIDACION'
  | 'FALTA_COMPRAS'
  | 'FALTA_VENTAS'
  | 'FALTAN_AMBAS'
  | 'COMPLETA';

export interface FaltanteDeClientePeriodo {
  readonly clienteId: string;
  readonly clienteNombre: string;
  readonly periodo: string;
  /** Los vencimientos vencidos de este cliente y período, sin comprobante. */
  readonly obligaciones: readonly VencimientoVencidoFaltante[];
  readonly estadoPlanillaRg90: EstadoPlanillaRg90;
}

/**
 * Agrupa los vencimientos vencidos por cliente y período, y les suma el
 * estado de la planilla RG 90 de ese mismo período.
 *
 * Recibe los datos ya leídos (nada de entrada/salida acá, como el resto de
 * `@effort/core`): la lista de vencidos sin presentar y las liquidaciones RG
 * 90 existentes. Quien llama decide de dónde salen — hoy, dos consultas a la
 * base filtradas por la misma cartera.
 */
export function armarListaDeFaltantes(
  vencimientosVencidos: readonly VencimientoVencidoFaltante[],
  liquidaciones: readonly LiquidacionRg90Resumen[],
): readonly FaltanteDeClientePeriodo[] {
  const liquidacionPorClave = new Map(
    liquidaciones.map((liquidacion) => [
      claveClientePeriodo(liquidacion.clienteId, liquidacion.periodo),
      liquidacion,
    ]),
  );

  const grupos = new Map<
    string,
    {
      clienteId: string;
      clienteNombre: string;
      periodo: string;
      obligaciones: VencimientoVencidoFaltante[];
    }
  >();

  for (const vencimiento of vencimientosVencidos) {
    if (vencimiento.periodo === null) continue;

    const clave = claveClientePeriodo(vencimiento.clienteId, vencimiento.periodo);
    const grupo = grupos.get(clave) ?? {
      clienteId: vencimiento.clienteId,
      clienteNombre: vencimiento.clienteNombre,
      periodo: vencimiento.periodo,
      obligaciones: [],
    };
    grupo.obligaciones.push(vencimiento);
    grupos.set(clave, grupo);
  }

  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      estadoPlanillaRg90: estadoDePlanillaRg90(grupo, liquidacionPorClave),
    }))
    .sort(
      (a, b) =>
        a.clienteNombre.localeCompare(b.clienteNombre) || b.periodo.localeCompare(a.periodo),
    );
}

function claveClientePeriodo(clienteId: string, periodo: string): string {
  return `${clienteId}|${periodo}`;
}

function estadoDePlanillaRg90(
  grupo: {
    readonly clienteId: string;
    readonly periodo: string;
    readonly obligaciones: readonly VencimientoVencidoFaltante[];
  },
  liquidacionPorClave: ReadonlyMap<string, LiquidacionRg90Resumen>,
): EstadoPlanillaRg90 {
  const aplica = grupo.obligaciones.some((o) => TIPOS_CON_PLANILLA_RG90.has(o.tipoDocumento));
  if (!aplica) return 'NO_APLICA';

  const liquidacion = liquidacionPorClave.get(
    claveClientePeriodo(grupo.clienteId, grupo.periodo),
  );
  if (!liquidacion) return 'SIN_LIQUIDACION';

  const faltaCompras = liquidacion.comprobantesCompras === 0;
  // Ventas en cero puede ser legítimo (el cliente no facturó ese mes): esto
  // NO es lo mismo que "falta compras", que siempre hace falta cargar. El
  // texto de la interfaz es el que tiene que decir esa diferencia, no este
  // estado — acá solo se distingue cuál de las dos falta.
  const faltaVentas = liquidacion.comprobantesVentas === 0;

  if (faltaCompras && faltaVentas) return 'FALTAN_AMBAS';
  if (faltaCompras) return 'FALTA_COMPRAS';
  if (faltaVentas) return 'FALTA_VENTAS';
  return 'COMPLETA';
}
