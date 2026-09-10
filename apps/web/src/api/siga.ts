/**
 * Exportaciones de SIGA y conciliación (`apps/api/src/rutas/siga.ts`).
 *
 * El sistema no toca SIGA: trabaja sobre las exportaciones Excel/CSV/PDF que
 * SIGA produce. La conciliación es de solo lectura — compara y señala, no
 * ajusta nada.
 */

import { peticion } from './cliente.js';

export type TipoReporteSiga =
  | 'LIBRO_COMPRAS'
  | 'LIBRO_VENTAS'
  | 'DETERMINACION_IVA'
  | 'COMPROBANTES_CARGADOS'
  | 'RETENCIONES'
  | 'MAYOR_CONTABLE'
  | 'SUMAS_Y_SALDOS'
  | 'BALANCE_GENERAL'
  | 'ESTADO_RESULTADOS'
  | 'OTRO';

export type FormatoSiga = 'EXCEL' | 'CSV' | 'PDF';

export interface ExportacionSiga {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipoReporte: TipoReporteSiga;
  readonly formato: FormatoSiga;
  readonly evidenciaId: string | null;
  /** ISO 8601 con hora. */
  readonly importadaEn: string;
  readonly filasLeidas: number;
  readonly estadoRevision: string;
  readonly proximaAccion: string | null;
  readonly observaciones: string | null;
}

export function listarExportaciones(
  clienteId: string,
  periodo?: string,
): Promise<{ exportaciones: readonly ExportacionSiga[] }> {
  const query = periodo ? { periodo } : {};
  return peticion('GET', `/api/v1/clientes/${clienteId}/siga`, undefined, query);
}

export interface FilaRechazadaSiga {
  readonly numeroFila: number;
  readonly motivo: string;
  readonly datosOriginales: unknown;
}

export interface FilaAceptadaSiga {
  readonly rucEmisor: string;
  readonly timbrado: string;
  readonly numeroComprobante: string;
  /** Texto, no número: importe convertido en el borde de la API. */
  readonly total: string;
  readonly tasa: 'DIEZ' | 'CINCO' | 'EXENTA';
  readonly anulado: boolean;
  readonly fecha: string;
}

export interface ReporteDeImportacion {
  readonly modo: 'simulacion' | 'real';
  readonly totalFilas: number;
  readonly aceptados: readonly FilaAceptadaSiga[];
  readonly rechazados: readonly FilaRechazadaSiga[];
  readonly exportacion?: ExportacionSiga;
}

/** Lee un `File` del navegador y devuelve su contenido en base64 (sin el prefijo `data:...`). */
export function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = String(lector.result);
      const indice = resultado.indexOf(',');
      resolve(indice === -1 ? resultado : resultado.slice(indice + 1));
    };
    lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

export interface ImportarArchivoSiga {
  readonly periodo: string;
  readonly tipoReporte: TipoReporteSiga;
  readonly formato: FormatoSiga;
  readonly nombreArchivo: string;
  readonly contenidoBase64: string;
  readonly modo: 'simulacion' | 'real';
}

export function importarArchivoSiga(
  clienteId: string,
  datos: ImportarArchivoSiga,
): Promise<ReporteDeImportacion> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/siga/importar`, datos);
}

/* ========================================================================== */
/* Conciliación                                                               */
/* ========================================================================== */

export interface ComprobanteSiga {
  readonly rucEmisor: string;
  readonly timbrado: string;
  readonly numeroComprobante: string;
  readonly total: string;
  readonly tasa: 'DIEZ' | 'CINCO' | 'EXENTA';
  readonly anulado: boolean;
}

export interface DiferenciaDeMonto {
  readonly clave: string;
  readonly recibido: string;
  readonly enSiga: string;
  readonly diferencia: string;
}

export interface Conciliacion {
  readonly periodo: string;
  readonly sinDatos: boolean;
  readonly conciliado: boolean;
  readonly totalRecibidos: number;
  readonly totalEnSiga: number;
  readonly coincidentes: number;
  readonly sinIdentificacion: number;
  readonly faltaCargarEnSiga: readonly ComprobanteSiga[];
  readonly sinRespaldoDocumental: readonly ComprobanteSiga[];
  readonly diferenciasDeMonto: readonly DiferenciaDeMonto[];
  /** Texto, no número. */
  readonly magnitudDeLasDiferencias: string;
}

export function obtenerConciliacion(clienteId: string, periodo: string): Promise<Conciliacion> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/siga/${periodo}/conciliacion`);
}
