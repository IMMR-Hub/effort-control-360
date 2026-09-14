/**
 * Análisis del libro RG 90: qué hay que mirar antes de presentarlo.
 *
 * Este módulo existe por una corrección de Daniel del 2026-09-12: *"estas
 * discrepancias también tienen que alertar, ya que al final puede representar
 * una multa administrativa"*. Hasta entonces el sistema leía el libro y sumaba;
 * ahora además lo revisa.
 *
 * ---
 *
 * **La separación que ordena todo esto**, y que es la respuesta a un error
 * propio que salió caro:
 *
 * La primera versión del importador RECHAZABA las filas cuyas partes no sumaban
 * el total — y descartaba el 8% de los comprobantes reales, o sea IVA que el
 * cliente perdía sin enterarse. La corrección apurada fue dejar de rechazarlas
 * y contarlas, que evitaba la pérdida pero tiraba la información a un contador
 * que nadie mira.
 *
 * La lógica correcta es otra, y es de responsabilidades: **leer y juzgar son
 * dos trabajos distintos**. Una fila incoherente no es un error de lectura —se
 * entiende perfectamente lo que dice— sino un hallazgo SOBRE el documento. El
 * importador la lee entera y sin opinar; este módulo la juzga. Así nada se
 * pierde, nada se calla, y lo que aparece es accionable en vez de ser un
 * número en un log.
 *
 * ---
 *
 * **Por qué el riesgo depende de la dirección del error.** Un guaraní de más o
 * de menos no es lo mismo según de qué lado esté:
 *
 *  - En COMPRAS, declarar MÁS IVA del que corresponde es tomar más crédito
 *    fiscal del debido. Eso lo paga el fisco, y es lo que puede terminar en
 *    multa.
 *  - En VENTAS, declarar MENOS IVA es ingresar menos de lo debido. Mismo
 *    problema, del otro lado.
 *  - Las dos direcciones opuestas no arriesgan multa: perjudican al cliente,
 *    que paga de más. Igual se informan — nadie quiere pagar de más — pero no
 *    urgen igual.
 *
 * Medido sobre los datos reales de EFFORT (3788 comprobantes de los 5 clientes
 * del piloto): 65 discrepancias, 1,72%. **Todas en COMPRAS, ninguna en
 * VENTAS** — consistente con que las ventas las genera el sistema de EFFORT y
 * las compras vienen de la factura de cada proveedor, que redondea a su manera.
 */

import {
  dividirRedondeado,
  formatearGs,
  gs,
  sumar,
  type DivisoresIva,
  type Gs,
} from '@effort/core';

import type { FilaDeLibro } from './libroRg90.js';

export type TipoDeHallazgo =
  /** El IVA declarado no coincide con aplicar la regla sobre el monto gravado. */
  | 'IVA_DECLARADO_NO_COINCIDE'
  /** Gravado 10% + gravado 5% + exento no da el total del comprobante. */
  | 'PARTES_NO_SUMAN_EL_TOTAL';

export type RiesgoDeHallazgo =
  /** Se tomó más crédito fiscal del que corresponde. Es el que puede costar una multa. */
  | 'CREDITO_DE_MAS'
  /** Se ingresó menos IVA del que corresponde. También puede costar una multa. */
  | 'DEBITO_DE_MENOS'
  /** El cliente pagó de más. No hay multa, pero hay plata de menos. */
  | 'EN_CONTRA_DEL_CLIENTE'
  /** El documento no cierra consigo mismo. No se sabe de qué lado cae hasta mirarlo. */
  | 'INCONSISTENCIA';

export interface HallazgoDeLibro {
  readonly tipo: TipoDeHallazgo;
  readonly riesgo: RiesgoDeHallazgo;
  readonly periodo: string;
  readonly tipoRegistro: FilaDeLibro['tipoRegistro'];
  readonly numeroComprobante: string;
  readonly contraparte: string;
  /** `'10%'` o `'5%'`, o `null` cuando el hallazgo no es de una tasa puntual. */
  readonly tasa: '10%' | '5%' | null;
  readonly declarado: Gs;
  readonly calculado: Gs;
  /** Declarado menos calculado. Positivo = se declaró de más. */
  readonly diferencia: bigint;
  readonly detalle: string;
}

/**
 * Diferencia de IVA que el sistema calla, en guaraníes. Es cero a propósito.
 *
 * Tuvo dos valores el mismo día, y conviene que quede la historia:
 *
 *  1. Lili y Laura, 2026-09-14: *"5 sigue siendo aceptable, diría que 10 ya se
 *     revisará"*. Se aplicó 5, y los comprobantes con riesgo bajaron de 65 a 2.
 *  2. Daniel, horas después: *"mejor alertar a partir de 1 guaraní a partir de
 *     ahora, y que luego puedan aceptar o revisar"*.
 *
 * La segunda es mejor por una razón de fondo: con una tolerancia, **el sistema
 * decide** qué diferencia no importa, y nadie se entera de lo que calló. Con
 * cero, avisa de todo y **decide una persona**, con nombre y motivo, sobre cada
 * comprobante (`estado` del hallazgo: PENDIENTE, EN_REVISION, ACEPTADO). El
 * ruido se resuelve aceptando, no silenciando.
 *
 * Se deja la constante —en vez de borrarla— porque el día que EFFORT quiera
 * volver a tolerar algo, este es el único lugar donde se cambia.
 */
export const TOLERANCIA_DE_REDONDEO_DEL_PROVEEDOR = 0n;

/**
 * Si un hallazgo puede terminar en multa: la dirección es la del fisco y la
 * diferencia supera lo que EFFORT acepta como redondeo.
 *
 * Es la única definición de "riesgo de multa" del sistema. La consulta que
 * agrupa por período la repite en SQL con esta misma constante.
 */
export function esRiesgoDeMulta(
  hallazgo: Pick<HallazgoDeLibro, 'riesgo' | 'diferencia'>,
): boolean {
  if (hallazgo.riesgo !== 'CREDITO_DE_MAS' && hallazgo.riesgo !== 'DEBITO_DE_MENOS') return false;
  const magnitud = hallazgo.diferencia < 0n ? -hallazgo.diferencia : hallazgo.diferencia;
  return magnitud > TOLERANCIA_DE_REDONDEO_DEL_PROVEEDOR;
}

function riesgoDeIva(
  tipoRegistro: FilaDeLibro['tipoRegistro'],
  diferencia: bigint,
): RiesgoDeHallazgo {
  const declaradoDeMas = diferencia > 0n;

  if (tipoRegistro === 'COMPRAS') {
    return declaradoDeMas ? 'CREDITO_DE_MAS' : 'EN_CONTRA_DEL_CLIENTE';
  }
  return declaradoDeMas ? 'EN_CONTRA_DEL_CLIENTE' : 'DEBITO_DE_MENOS';
}

/**
 * Revisa un libro y devuelve lo que hay que mirar antes de presentarlo.
 *
 * No modifica nada ni decide nada: describe. Quién tiene que enterarse y con
 * qué urgencia lo resuelve el motor de alertas, no este módulo.
 */
export function analizarLibro(
  filas: readonly FilaDeLibro[],
  divisores: DivisoresIva,
): HallazgoDeLibro[] {
  const hallazgos: HallazgoDeLibro[] = [];

  for (const fila of filas) {
    const comunes = {
      periodo: fila.periodo,
      tipoRegistro: fila.tipoRegistro,
      numeroComprobante: fila.numeroComprobante,
      contraparte: fila.razonSocialInformado,
    };

    for (const [tasa, base, declarado] of [
      ['10%', fila.gravado10, fila.iva10],
      ['5%', fila.gravado5, fila.iva5],
    ] as const) {
      if (base === 0n) continue;

      const divisor = divisores[tasa === '10%' ? 'DIEZ' : 'CINCO'];
      if (divisor === null || divisor === undefined) continue;

      // `Gs` es un bigint marcado, así que restar y comparar funciona directo;
      // lo único que necesita `gs()` es volver a entrar al tipo.
      const calculado = gs(dividirRedondeado(base, divisor));
      const diferencia = declarado - calculado;
      if (diferencia === 0n) continue;

      const riesgo = riesgoDeIva(fila.tipoRegistro, diferencia);
      hallazgos.push({
        ...comunes,
        tipo: 'IVA_DECLARADO_NO_COINCIDE',
        riesgo,
        tasa,
        declarado,
        calculado,
        diferencia,
        detalle:
          `Sobre ${formatearGs(base)} al ${tasa}, el comprobante declara ` +
          `${formatearGs(declarado)} de IVA y la regla da ${formatearGs(calculado)}. ` +
          (riesgo === 'CREDITO_DE_MAS'
            ? 'Se estaría tomando crédito fiscal de más.'
            : riesgo === 'DEBITO_DE_MENOS'
              ? 'Se estaría ingresando IVA de menos.'
              : 'La diferencia juega en contra del cliente.'),
      });
    }

    // Incoherencia interna del comprobante. Va aparte de la comparación de IVA
    // porque no habla del impuesto sino del documento: acá ni siquiera se sabe
    // cuál de los cuatro números es el equivocado.
    const suma = sumar([fila.gravado10, fila.gravado5, fila.exento]);

    if (fila.total !== 0n && suma !== fila.total) {
      hallazgos.push({
        ...comunes,
        tipo: 'PARTES_NO_SUMAN_EL_TOTAL',
        riesgo: 'INCONSISTENCIA',
        tasa: null,
        declarado: fila.total,
        calculado: suma,
        diferencia: suma - fila.total,
        detalle:
          `Gravado 10% (${formatearGs(fila.gravado10)}) + gravado 5% ` +
          `(${formatearGs(fila.gravado5)}) + exento (${formatearGs(fila.exento)}) da ` +
          `${formatearGs(suma)}, pero el total del comprobante dice ` +
          `${formatearGs(fila.total)}.`,
      });
    }
  }

  return hallazgos;
}

export interface ResumenDeHallazgos {
  readonly total: number;
  /** Los que pueden terminar en multa. Es el número que mira dirección. */
  readonly conRiesgoDeMulta: number;
  readonly enContraDelCliente: number;
  readonly inconsistencias: number;
  /** Cuánto IVA de más se tomó en total, sumando solo los de riesgo. */
  readonly ivaEnRiesgo: bigint;
}

export function resumirHallazgos(hallazgos: readonly HallazgoDeLibro[]): ResumenDeHallazgos {
  const riesgosos = hallazgos.filter(esRiesgoDeMulta);

  return {
    total: hallazgos.length,
    conRiesgoDeMulta: riesgosos.length,
    enContraDelCliente: hallazgos.filter((h) => h.riesgo === 'EN_CONTRA_DEL_CLIENTE').length,
    inconsistencias: hallazgos.filter((h) => h.riesgo === 'INCONSISTENCIA').length,
    // En valor absoluto: un débito de menos y un crédito de más suman riesgo,
    // no se compensan entre sí.
    ivaEnRiesgo: riesgosos.reduce(
      (acumulado, h) => acumulado + (h.diferencia < 0n ? -h.diferencia : h.diferencia),
      0n,
    ),
  };
}
