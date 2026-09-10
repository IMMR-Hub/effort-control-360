/**
 * Conciliación entre lo que EFFORT recibió y lo que SIGA tiene cargado.
 *
 * Este es el módulo que responde la pregunta comercial del piloto:
 * "¿qué documentos recibimos que todavía no están en SIGA, y qué hay en SIGA
 * que nosotros no tenemos respaldado?".
 *
 * El sistema no toca SIGA. Compara la exportación Excel/CSV que SIGA produce
 * contra los documentos registrados, y expone las diferencias. Nunca ajusta,
 * completa ni corrige nada por su cuenta: solo señala.
 */

import { restar, valorAbsoluto, type Gs } from './dinero.js';
import { claveNatural, type Comprobante } from './comprobantes.js';

export interface DiferenciaDeMonto {
  readonly clave: string;
  readonly recibido: Comprobante;
  readonly enSiga: Comprobante;
  /** recibido.total - enSiga.total */
  readonly diferencia: Gs;
}

export interface ResultadoConciliacion {
  /** Recibidos por EFFORT pero ausentes en la exportación de SIGA: falta cargarlos. */
  readonly faltaCargarEnSiga: readonly Comprobante[];
  /** Presentes en SIGA sin documento de respaldo registrado: falta el comprobante físico o digital. */
  readonly sinRespaldoDocumental: readonly Comprobante[];
  /** Coinciden en clave natural pero no en importe. */
  readonly diferenciasDeMonto: readonly DiferenciaDeMonto[];
  /** Coinciden en clave e importe. */
  readonly coincidentes: number;
  readonly totalRecibidos: number;
  readonly totalEnSiga: number;
  /**
   * No hay nada que comparar: ni documentos recibidos ni filas de SIGA.
   *
   * Se informa aparte de `conciliado` porque son cosas distintas y confundirlas
   * es peligroso: "no encontré diferencias" y "no miré nada" se ven igual en un
   * indicador verde, y el segundo caso no autoriza a cerrar un período.
   */
  readonly sinDatos: boolean;
  /**
   * True solo si había algo que comparar y no hay ninguna diferencia.
   *
   * Un período vacío NO concilia. Antes sí lo hacía —las tres listas de
   * diferencias estaban vacías, así que la condición se cumplía sola— y la
   * pantalla mostraba "Conciliado: Sí" sobre un período en el que no se había
   * importado nada. Daniel lo detectó el 2026-09-10 al ver "CONCILIADO" junto
   * a "Todavía no se importó ninguna exportación para este período".
   */
  readonly conciliado: boolean;
}

/**
 * Concilia documentos recibidos contra una exportación de SIGA.
 *
 * Los anulados participan de la comparación: si SIGA tiene un comprobante
 * anulado y EFFORT no registró la anulación (o al revés), esa discrepancia
 * también debe salir a la luz.
 */
export function conciliarConSiga(
  recibidos: readonly Comprobante[],
  enSiga: readonly Comprobante[],
): ResultadoConciliacion {
  const indiceSiga = new Map<string, Comprobante>();
  for (const comprobante of enSiga) {
    indiceSiga.set(claveNatural(comprobante), comprobante);
  }

  const indiceRecibidos = new Map<string, Comprobante>();
  for (const comprobante of recibidos) {
    indiceRecibidos.set(claveNatural(comprobante), comprobante);
  }

  const faltaCargarEnSiga: Comprobante[] = [];
  const diferenciasDeMonto: DiferenciaDeMonto[] = [];
  let coincidentes = 0;

  for (const [clave, recibido] of indiceRecibidos) {
    const contraparte = indiceSiga.get(clave);
    if (!contraparte) {
      faltaCargarEnSiga.push(recibido);
      continue;
    }
    if (recibido.total === contraparte.total) {
      coincidentes += 1;
    } else {
      diferenciasDeMonto.push({
        clave,
        recibido,
        enSiga: contraparte,
        diferencia: restar(recibido.total, contraparte.total),
      });
    }
  }

  const sinRespaldoDocumental: Comprobante[] = [];
  for (const [clave, comprobante] of indiceSiga) {
    if (!indiceRecibidos.has(clave)) {
      sinRespaldoDocumental.push(comprobante);
    }
  }

  return {
    faltaCargarEnSiga,
    sinRespaldoDocumental,
    diferenciasDeMonto,
    coincidentes,
    totalRecibidos: indiceRecibidos.size,
    totalEnSiga: indiceSiga.size,
    sinDatos: indiceRecibidos.size === 0 && indiceSiga.size === 0,
    conciliado:
      (indiceRecibidos.size > 0 || indiceSiga.size > 0) &&
      faltaCargarEnSiga.length === 0 &&
      sinRespaldoDocumental.length === 0 &&
      diferenciasDeMonto.length === 0,
  };
}

/** Suma de las diferencias de monto, en valor absoluto: cuánto está en discusión. */
export function magnitudDeLasDiferencias(resultado: ResultadoConciliacion): Gs {
  let total = 0n;
  for (const diferencia of resultado.diferenciasDeMonto) {
    total += valorAbsoluto(diferencia.diferencia);
  }
  return total as Gs;
}
