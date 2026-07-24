/**
 * Importador de exportaciones SIGA (tarea 92).
 *
 * Convierte el Excel/CSV que SIGA exporta (libro de compras, libro de ventas,
 * etc.) en filas listas para `RepositorioDeExportacionesSiga.registrar()` —
 * misma forma que `FilaSigaEntrante` en `apps/api/src/puertos-dominio.ts`,
 * sin importarla directamente porque un paquete no depende de una app.
 *
 * A diferencia del importador de comprobantes (tarea 91), una fila SIGA no
 * trae tipo ni origen: el reporte exportado ya es "libro de compras" o "libro
 * de ventas" completo, esa distinción vive en `tipoReporte` al registrar la
 * exportación, no en cada fila. Por eso acá no se valida esa columna.
 *
 * Tampoco escribe en la base: mismo principio que el importador de
 * comprobantes, separar parseo de persistencia es lo que permite probarlo
 * entero sin Postgres y dejar el modo simulación (tarea 93) como una capa
 * posterior.
 */

import { detectarDuplicados, type Comprobante } from '@effort/core';
import { rucSchema } from '@effort/schema';

import {
  fechaDeCelda,
  filaVacia,
  leerFilas,
  normalizarEncabezado,
  textoDeCelda,
  totalDeCelda,
} from './archivo.js';

const TASAS: readonly Comprobante['tasa'][] = ['DIEZ', 'CINCO', 'EXENTA'];

const VALORES_ANULADO_SI = new Set(['SI', 'SÍ', 'TRUE', '1', 'X']);
const VALORES_ANULADO_NO = new Set(['NO', 'FALSE', '0', '']);

type CampoCanonico = 'rucEmisor' | 'timbrado' | 'numeroComprobante' | 'total' | 'tasa' | 'anulado' | 'fecha';

const ENCABEZADOS: Readonly<Record<string, CampoCanonico>> = {
  'RUC EMISOR': 'rucEmisor',
  'RUC DEL EMISOR': 'rucEmisor',
  TIMBRADO: 'timbrado',
  'NUMERO COMPROBANTE': 'numeroComprobante',
  'NUMERO DE COMPROBANTE': 'numeroComprobante',
  NUMERO: 'numeroComprobante',
  TOTAL: 'total',
  TASA: 'tasa',
  ANULADO: 'anulado',
  FECHA: 'fecha',
};

type FilaCanonica = Partial<Record<CampoCanonico, unknown>>;

/** Misma forma que `FilaSigaEntrante` de `apps/api/src/puertos-dominio.ts`. */
export interface FilaSigaImportada {
  readonly rucEmisor: string;
  readonly timbrado: string;
  readonly numeroComprobante: string;
  readonly total: bigint;
  readonly tasa: string;
  readonly anulado: boolean;
  readonly fecha: Date;
}

export interface FilaRechazadaSiga {
  readonly numeroFila: number;
  readonly motivo: string;
  readonly datosOriginales: Readonly<Record<string, unknown>>;
}

export interface ReporteImportacionSiga {
  readonly totalFilas: number;
  readonly aceptados: readonly FilaSigaImportada[];
  readonly rechazados: readonly FilaRechazadaSiga[];
}

function anuladoDeCelda(valor: unknown, problemas: string[]): boolean {
  const texto = normalizarEncabezado(textoDeCelda(valor));
  if (VALORES_ANULADO_SI.has(texto)) return true;
  if (VALORES_ANULADO_NO.has(texto)) return false;
  problemas.push(`Anulado no reconocido: "${textoDeCelda(valor)}" (se espera SI/NO).`);
  return false;
}

function validarFila(valores: FilaCanonica): { fila: FilaSigaImportada } | { motivo: string } {
  const problemas: string[] = [];

  const rucEmisor = textoDeCelda(valores.rucEmisor);
  const rucValidado = rucSchema.safeParse(rucEmisor);
  if (!rucValidado.success) {
    problemas.push(`RUC inválido: ${rucValidado.error.issues[0]?.message ?? rucEmisor}`);
  }

  const timbrado = textoDeCelda(valores.timbrado);
  if (!timbrado) problemas.push('Timbrado vacío.');

  const numeroComprobante = textoDeCelda(valores.numeroComprobante);
  if (!numeroComprobante) problemas.push('Número de comprobante vacío.');

  let total: bigint | null = null;
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

  let fecha: Date | null = null;
  try {
    fecha = fechaDeCelda(valores.fecha);
  } catch (error) {
    problemas.push(error instanceof Error ? error.message : 'Fecha inválida.');
  }

  if (problemas.length > 0) {
    return { motivo: problemas.join(' ') };
  }

  return {
    fila: {
      rucEmisor,
      timbrado,
      numeroComprobante,
      total: total as bigint,
      tasa: tasa as string,
      anulado,
      fecha: fecha as Date,
    },
  };
}

/**
 * Clave natural de una fila SIGA vía `claveNatural()` de `@effort/core`.
 *
 * `claveNatural` solo mira `rucEmisor`+`timbrado`+`numero`: tipo/origen no
 * participan de la clave, así que rellenarlos con un valor fijo para poder
 * reusar `detectarDuplicados` no distorsiona el resultado — es exactamente lo
 * mismo que ya hace `filaSigaAComprobante` en `apps/api/src/rutas/siga.ts`
 * para poder pasar filas SIGA por `conciliarConSiga`.
 */
function comoComprobanteParaClave(fila: FilaSigaImportada): Comprobante {
  return {
    rucEmisor: fila.rucEmisor,
    timbrado: fila.timbrado,
    numero: fila.numeroComprobante,
    tipo: 'FACTURA',
    origen: 'COMPRA',
    fecha: { anio: fila.fecha.getUTCFullYear(), mes: fila.fecha.getUTCMonth() + 1, dia: fila.fecha.getUTCDate() },
    total: fila.total as Comprobante['total'],
    tasa: fila.tasa as Comprobante['tasa'],
    anulado: fila.anulado,
  };
}

export async function importarExportacionSiga(
  contenido: Buffer,
  nombreArchivo: string,
): Promise<ReporteImportacionSiga> {
  const filas = await leerFilas(contenido, nombreArchivo, ENCABEZADOS);

  const rechazados: FilaRechazadaSiga[] = [];
  const candidatos: {
    numeroFila: number;
    fila: FilaSigaImportada;
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

    candidatos.push({ numeroFila: fila.numeroFila, fila: resultado.fila, original: fila.original });
  }

  // Se dedupe por clave natural aunque `claveNatural` está pensada para
  // `Comprobante`: detectarDuplicados solo la usa para agrupar, así que
  // funciona igual sobre la vista sintética de comoComprobanteParaClave().
  const porClave = new Map(candidatos.map((candidato) => [comoComprobanteParaClave(candidato.fila), candidato]));
  const deteccion = detectarDuplicados([...porClave.keys()]);

  for (const duplicado of deteccion.duplicados) {
    const filaConservada = porClave.get(duplicado.conservado)?.numeroFila;
    for (const rechazado of duplicado.rechazados) {
      const info = porClave.get(rechazado);
      if (!info) continue;
      rechazados.push({
        numeroFila: info.numeroFila,
        motivo: `Fila duplicada dentro del archivo: misma clave (RUC+timbrado+número) que la fila ${filaConservada}.`,
        datosOriginales: info.original,
      });
    }
  }

  rechazados.sort((a, b) => a.numeroFila - b.numeroFila);

  const aceptados = deteccion.unicos.map((comprobante) => porClave.get(comprobante)!.fila);

  return { totalFilas: filas.length, aceptados, rechazados };
}
