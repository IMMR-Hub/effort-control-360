/**
 * Documentos y Proceso Mensual (`apps/api/src/rutas/documentos.ts`).
 *
 * Los importes viajan como texto (`total`, `ivaSaldoAPagar`, `ivaSaldoAFavor`)
 * — el servidor ya los convierte de `bigint`, nunca `number`, mismo criterio
 * que el resto de la API. Se muestran con `gs()`/`formatearGs()` de
 * `@effort/core`, no con formateo hecho a mano acá.
 */

import { peticion, type QueryParams } from './cliente.js';
import type { NivelRiesgo, TipoDocumento } from './tipos-compartidos.js';

export type { NivelRiesgo, TipoDocumento };

export type CanalRecepcionDocumento = 'WHATSAPP' | 'EMAIL' | 'ONEDRIVE' | 'FISICO_ESCANEADO' | 'SISTEMA';
export type TasaIva = 'DIEZ' | 'CINCO' | 'EXENTA';
export type EstadoDocumento = 'RECIBIDO' | 'OBSERVADO' | 'RECHAZADO' | 'DUPLICADO' | 'CARGADO_EN_SIGA';

export interface Documento {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly tipo: TipoDocumento;
  readonly canalRecepcion: CanalRecepcionDocumento;
  /** ISO 8601 con hora. */
  readonly recibidoEn: string;
  readonly rucEmisor: string | null;
  readonly timbrado: string | null;
  readonly numeroComprobante: string | null;
  /** Texto, no `number`: es un `bigint` de guaraníes convertido en el borde de la API. */
  readonly total: string | null;
  readonly tasa: TasaIva | null;
  readonly anulado: boolean;
  readonly estado: EstadoDocumento;
  readonly motivoRechazo: string | null;
  readonly evidenciaId: string | null;
  readonly observaciones: string | null;
}

export function listarDocumentos(
  clienteId: string,
  periodo?: string,
): Promise<{ documentos: readonly Documento[] }> {
  const query: QueryParams = periodo ? { periodo } : {};
  return peticion('GET', `/api/v1/clientes/${clienteId}/documentos`, undefined, query);
}

export interface AltaDeDocumento {
  readonly periodo: string;
  readonly tipo: TipoDocumento;
  readonly canalRecepcion: CanalRecepcionDocumento;
  readonly recibidoEn: string;
  readonly rucEmisor?: string | null;
  readonly timbrado?: string | null;
  readonly numeroComprobante?: string | null;
  readonly total?: string | null;
  readonly tasa?: TasaIva | null;
  readonly anulado?: boolean;
  readonly observaciones?: string | null;
}

export function crearDocumento(
  clienteId: string,
  datos: AltaDeDocumento,
): Promise<{ documento: Documento }> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/documentos`, datos);
}

export function cambiarEstadoDocumento(
  id: string,
  estado: EstadoDocumento,
  motivoRechazo: string | null = null,
): Promise<{ documento: Documento }> {
  return peticion('PATCH', `/api/v1/documentos/${id}/estado`, { estado, motivoRechazo });
}

/* ========================================================================== */
/* Proceso mensual                                                            */
/* ========================================================================== */

export type EstadoGeneral = 'COMPLETO' | 'PARCIAL' | 'PENDIENTE' | 'OBSERVADO' | 'CRITICO';

export interface ProcesoMensual {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly comprobantesRetirados: boolean;
  readonly fechaRetiro: string | null;
  readonly documentosRecibidos: number;
  readonly documentosFaltantes: number;
  readonly documentosObservados: number;
  readonly comprasCargadasSiga: boolean;
  readonly ventasCargadasSiga: boolean;
  readonly retencionesCargadas: boolean;
  readonly extractosRecibidos: boolean;
  readonly conciliacionBancariaRealizada: boolean;
  readonly ivaRevisado: boolean;
  readonly ivaSaldoAPagar: string | null;
  readonly ivaSaldoAFavor: string | null;
  readonly liquidacionGenerada: boolean;
  readonly liquidacionEnviada: boolean;
  readonly balanceAplica: boolean;
  readonly estadoGeneral: EstadoGeneral;
  readonly riesgo: NivelRiesgo;
  readonly proximaAccion: string | null;
  readonly fechaLimiteInterna: string | null;
  readonly observaciones: string | null;
}

export function listarProcesoMensualPorPeriodo(
  periodo: string,
): Promise<{ periodo: string; procesos: readonly ProcesoMensual[] }> {
  return peticion('GET', `/api/v1/proceso-mensual/${periodo}`);
}

export function obtenerProcesoMensual(
  clienteId: string,
  periodo: string,
): Promise<{ proceso: ProcesoMensual }> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/proceso-mensual/${periodo}`);
}

export type CamposEditablesDeProceso = Partial<
  Omit<ProcesoMensual, 'id' | 'clienteId' | 'periodo'>
>;

export function actualizarProcesoMensual(
  clienteId: string,
  periodo: string,
  cambios: CamposEditablesDeProceso,
): Promise<{ proceso: ProcesoMensual }> {
  return peticion('PUT', `/api/v1/clientes/${clienteId}/proceso-mensual/${periodo}`, cambios);
}
