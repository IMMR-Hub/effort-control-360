/**
 * Importador de comprobantes desde Excel o CSV (tarea 91).
 *
 * Esta pieza solo transforma un archivo en un reporte: qué filas se aceptan
 * como comprobantes válidos y cuáles se rechazan, con el motivo exacto de
 * cada rechazo. A propósito NO escribe nada en la base — cablear el resultado
 * contra `RepositorioDeDocumentos` (Parte 4A) es un paso posterior, que además
 * espera el modo simulación obligatorio de la tarea 93. Mezclar ambas cosas
 * acá haría imposible probar el parseo sin tocar Postgres.
 *
 * El formato de columnas esperado todavía no lo confirmó EFFORT con un archivo
 * real (ver `docs/DISCREPANCIAS.md`, punto 10): se asumió un layout razonable,
 * con encabezados en español y tolerante a acentos/mayúsculas, listo para
 * ajustar el día que aparezca una planilla real.
 */

import {
  detectarDuplicados,
  type Comprobante,
  type FechaCivil,
  type OrigenComprobante,
  type TipoComprobante,
} from '@effort/core';
import { rucSchema } from '@effort/schema';

import {
  fechaCivilDeCelda,
  filaVacia,
  leerFilas,
  normalizarEncabezado,
  textoDeCelda,
  totalDeCelda,
} from './archivo.js';

const TIPOS_COMPROBANTE: readonly TipoComprobante[] = [
  'FACTURA',
  'NOTA_CREDITO',
  'NOTA_DEBITO',
  'RECIBO',
  'RETENCION',
  'EXTRACTO_BANCARIO',
  'COMPROBANTE_PAGO',
  'OTRO',
];

const ORIGENES: readonly OrigenComprobante[] = ['COMPRA', 'VENTA'];

const TASAS: readonly Comprobante['tasa'][] = ['DIEZ', 'CINCO', 'EXENTA'];

const VALORES_ANULADO_SI = new Set(['SI', 'SÍ', 'TRUE', '1', 'X']);
const VALORES_ANULADO_NO = new Set(['NO', 'FALSE', '0', '']);

type CampoCanonico =
  | 'rucEmisor'
  | 'timbrado'
  | 'numero'
  | 'tipo'
  | 'origen'
  | 'fecha'
  | 'total'
  | 'tasa'
  | 'anulado';

/** Encabezado normalizado (mayúsculas, sin acentos, sin espacios extra) → campo canónico. */
const ENCABEZADOS: Readonly<Record<string, CampoCanonico>> = {
  'RUC EMISOR': 'rucEmisor',
  'RUC DEL EMISOR': 'rucEmisor',
  TIMBRADO: 'timbrado',
  NUMERO: 'numero',
  'NUMERO DE COMPROBANTE': 'numero',
  TIPO: 'tipo',
  ORIGEN: 'origen',
  FECHA: 'fecha',
  TOTAL: 'total',
  TASA: 'tasa',
  ANULADO: 'anulado',
};

type FilaCanonica = Partial<Record<CampoCanonico, unknown>>;

export interface FilaRechazada {
  readonly numeroFila: number;
  readonly motivo: string;
  readonly datosOriginales: Readonly<Record<string, unknown>>;
}

export interface ReporteImportacionComprobantes {
  /** Cantidad de filas de datos procesadas (sin contar el encabezado). */
  readonly totalFilas: number;
  readonly aceptados: readonly Comprobante[];
  readonly rechazados: readonly FilaRechazada[];
}

function anuladoDeCelda(valor: unknown, problemas: string[]): boolean {
  const texto = normalizarEncabezado(textoDeCelda(valor));
  if (VALORES_ANULADO_SI.has(texto)) return true;
  if (VALORES_ANULADO_NO.has(texto)) return false;
  problemas.push(`Anulado no reconocido: "${textoDeCelda(valor)}" (se espera SI/NO).`);
  return false;
}

function validarFila(
  valores: FilaCanonica,
):
  | {
      comprobante: Omit<Comprobante, 'total' | 'tasa' | 'fecha'>;
      total: Comprobante['total'];
      tasa: Comprobante['tasa'];
      fecha: FechaCivil;
    }
  | { motivo: string } {
  const problemas: string[] = [];

  const rucEmisor = textoDeCelda(valores.rucEmisor);
  const rucValidado = rucSchema.safeParse(rucEmisor);
  if (!rucValidado.success) {
    problemas.push(`RUC inválido: ${rucValidado.error.issues[0]?.message ?? rucEmisor}`);
  }

  const timbrado = textoDeCelda(valores.timbrado);
  if (!timbrado) problemas.push('Timbrado vacío.');

  const numero = textoDeCelda(valores.numero);
  if (!numero) problemas.push('Número de comprobante vacío.');

  const tipoTexto = normalizarEncabezado(textoDeCelda(valores.tipo));
  const tipo = TIPOS_COMPROBANTE.find((candidato) => candidato === tipoTexto);
  if (!tipo) {
    problemas.push(
      `Tipo inválido: "${textoDeCelda(valores.tipo)}" (se espera uno de: ${TIPOS_COMPROBANTE.join(', ')}).`,
    );
  }

  const origenTexto = normalizarEncabezado(textoDeCelda(valores.origen));
  const origen = ORIGENES.find((candidato) => candidato === origenTexto);
  if (!origen) {
    problemas.push(`Origen inválido: "${textoDeCelda(valores.origen)}" (se espera COMPRA o VENTA).`);
  }

  let fecha: FechaCivil | null = null;
  try {
    fecha = fechaCivilDeCelda(valores.fecha);
  } catch (error) {
    problemas.push(error instanceof Error ? error.message : 'Fecha inválida.');
  }

  let total: Comprobante['total'] | null = null;
  try {
    total = totalDeCelda(valores.total);
  } catch (error) {
    problemas.push(error instanceof Error ? error.message : 'Total inválido.');
  }

  const tasaTexto = normalizarEncabezado(textoDeCelda(valores.tasa));
  const tasa = TASAS.find((candidato) => candidato === tasaTexto);
  if (!tasa) {
    problemas.push(`Tasa inválida: "${textoDeCelda(valores.tasa)}" (se espera DIEZ, CINCO o EXENTA).`);
  }

  const anulado = anuladoDeCelda(valores.anulado, problemas);

  if (problemas.length > 0) {
    return { motivo: problemas.join(' ') };
  }

  // Todos los campos obligatorios pasaron: los `!`/non-null se justifican acá,
  // no antes, porque recién acá se sabe que no quedó ningún problema.
  return {
    comprobante: {
      rucEmisor,
      timbrado,
      numero,
      tipo: tipo as TipoComprobante,
      origen: origen as OrigenComprobante,
      anulado,
    },
    total: total as Comprobante['total'],
    tasa: tasa as Comprobante['tasa'],
    fecha: fecha as FechaCivil,
  };
}

export async function importarComprobantes(
  contenido: Buffer,
  nombreArchivo: string,
): Promise<ReporteImportacionComprobantes> {
  const filas = await leerFilas(contenido, nombreArchivo, ENCABEZADOS);

  const rechazados: FilaRechazada[] = [];
  const candidatos: {
    numeroFila: number;
    comprobante: Comprobante;
    original: Readonly<Record<string, unknown>>;
  }[] = [];

  for (const fila of filas) {
    if (filaVacia(fila.original)) {
      rechazados.push({
        numeroFila: fila.numeroFila,
        motivo: 'Fila vacía, se omite.',
        datosOriginales: fila.original,
      });
      continue;
    }

    const resultado = validarFila(fila.canonica);
    if ('motivo' in resultado) {
      rechazados.push({
        numeroFila: fila.numeroFila,
        motivo: resultado.motivo,
        datosOriginales: fila.original,
      });
      continue;
    }

    const comprobante: Comprobante = {
      ...resultado.comprobante,
      fecha: resultado.fecha,
      total: resultado.total,
      tasa: resultado.tasa,
    };
    candidatos.push({ numeroFila: fila.numeroFila, comprobante, original: fila.original });
  }

  const porNumeroFila = new Map(candidatos.map((candidato) => [candidato.comprobante, candidato]));

  const deteccion = detectarDuplicados(candidatos.map((candidato) => candidato.comprobante));

  for (const duplicado of deteccion.duplicados) {
    const filaConservada = porNumeroFila.get(duplicado.conservado)?.numeroFila;
    for (const rechazado of duplicado.rechazados) {
      const info = porNumeroFila.get(rechazado);
      if (!info) continue;
      rechazados.push({
        numeroFila: info.numeroFila,
        motivo: `Comprobante duplicado dentro del archivo: misma clave (RUC+timbrado+número) que la fila ${filaConservada}.`,
        datosOriginales: info.original,
      });
    }
  }

  rechazados.sort((a, b) => a.numeroFila - b.numeroFila);

  return {
    totalFilas: filas.length,
    aceptados: deteccion.unicos,
    rechazados,
  };
}
