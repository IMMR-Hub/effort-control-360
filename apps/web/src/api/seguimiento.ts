/**
 * Seguimiento: pedidos del equipo y bandeja de pendientes
 * (`apps/api/src/rutas/seguimiento.ts`).
 *
 * Solo dirección escribe (regla 12); el resto ve sus propios pedidos, sin las
 * notas internas, porque así se lo devuelve el servidor. `recordarEl` es una
 * marca visual: nada de esto envía un correo ni un mensaje (REGLA 0-bis).
 */

import type { Prioridad } from '@effort/core';

import { peticion } from './cliente.js';
import type { SolicitudDocumentacion } from './solicitudes.js';

export type { Prioridad };
export type EstadoDePedido = 'ABIERTO' | 'EN_CURSO' | 'RESUELTO' | 'CANCELADO';
export type CanalDePedido = 'LLAMADA' | 'MENSAJE' | 'WHATSAPP' | 'CORREO' | 'PRESENCIAL';

export interface PedidoDelEquipo {
  readonly id: string;
  readonly solicitanteUsuarioId: string;
  readonly destinatarioUsuarioIds: readonly string[];
  readonly clienteId: string | null;
  readonly asunto: string;
  readonly prioridad: Prioridad;
  readonly estado: EstadoDePedido;
  /** 'AAAA-MM-DD' (fecha civil en Paraguay) o null. */
  readonly recordarEl: string | null;
  readonly motivoDeCancelacion: string | null;
  readonly derivadoASoporte: boolean;
  readonly derivadoASoporteEn: string | null;
  /** ISO con hora. */
  readonly creadoEn: string;
  readonly actualizadoEn: string;
  /** Con «(inactivo)» si la persona ya no está activa. */
  readonly solicitanteNombre: string;
  readonly destinatarioNombres: readonly string[];
}

export interface MensajeDePedido {
  readonly id: string;
  readonly pedidoId: string;
  readonly autorUsuarioId: string;
  readonly canal: CanalDePedido;
  /** ISO con hora. */
  readonly ocurridoEn: string;
  readonly texto: string;
  /** Solo dirección las recibe: el servidor se las saca a todos los demás. */
  readonly notaInterna: boolean;
  readonly registradoPorUsuarioId: string;
  /** Id del mensaje que lo corrige, si fue corregido. */
  readonly corregidoPorId: string | null;
  readonly creadoEn: string;
  readonly autorNombre: string;
}

/** Una fila de «Pendientes»: un pedido del equipo o una solicitud a un cliente. */
export interface ItemDeBandeja {
  readonly tipo: 'EQUIPO' | 'CLIENTE';
  readonly id: string;
  readonly prioridad: Prioridad;
  readonly recordarEl: string | null;
  readonly creadoEn: string;
  /** El estado propio de cada tipo: `EstadoDePedido` o el de la solicitud. */
  readonly estado: string;
  readonly titulo: string;
  readonly deQuien: string;
  readonly clienteId: string | null;
  readonly periodo: string | null;
  /** El solicitante en un pedido del equipo; null en una solicitud a un cliente. */
  readonly solicitanteUsuarioId: string | null;
}

export interface ResumenDePendientes {
  readonly total: number;
  readonly criticos: number;
  readonly vencidos: number;
}

/** Ya viene ordenada por el servidor (`ordenarPendientes` de `@effort/core`). */
export function listarPendientes(): Promise<{ items: readonly ItemDeBandeja[]; resumen: ResumenDePendientes }> {
  return peticion('GET', '/api/v1/seguimiento/pendientes');
}

export interface FiltroDePedidos {
  readonly estados?: readonly EstadoDePedido[];
  readonly prioridad?: Prioridad;
  /** Solo lo respeta el servidor si quien pide es dirección. */
  readonly colaborador?: string;
}

export function listarPedidosDelEquipo(
  filtro: FiltroDePedidos = {},
): Promise<{ pedidos: readonly PedidoDelEquipo[] }> {
  return peticion('GET', '/api/v1/seguimiento/pedidos-equipo', undefined, {
    estado: filtro.estados?.join(','),
    prioridad: filtro.prioridad,
    colaborador: filtro.colaborador,
  });
}

/** Mensajes del más viejo al más nuevo. */
export function obtenerPedido(
  id: string,
): Promise<{ pedido: PedidoDelEquipo; mensajes: readonly MensajeDePedido[] }> {
  return peticion('GET', `/api/v1/seguimiento/pedidos-equipo/${id}`);
}

export interface AltaDePedido {
  readonly solicitanteUsuarioId: string;
  readonly destinatarioUsuarioIds: readonly string[];
  readonly clienteId: string | null;
  readonly asunto: string;
  readonly prioridad: Prioridad;
  readonly recordarEl: string | null;
  readonly canal: CanalDePedido;
  /** ISO con hora y zona. */
  readonly ocurridoEn: string;
  readonly texto: string;
}

export function crearPedido(datos: AltaDePedido): Promise<{ pedido: PedidoDelEquipo }> {
  return peticion('POST', '/api/v1/seguimiento/pedidos-equipo', datos);
}

export interface DatosDeMensaje {
  readonly autorUsuarioId: string;
  readonly canal: CanalDePedido;
  readonly ocurridoEn: string;
  readonly texto: string;
}

export function agregarMensaje(
  pedidoId: string,
  datos: DatosDeMensaje & { readonly notaInterna: boolean },
): Promise<{ mensaje: MensajeDePedido }> {
  return peticion('POST', `/api/v1/seguimiento/pedidos-equipo/${pedidoId}/mensajes`, datos);
}

/** La corrección es un mensaje nuevo; hereda si era nota interna (lo decide el servidor). */
export function corregirMensaje(
  mensajeId: string,
  pedidoId: string,
  datos: DatosDeMensaje,
): Promise<{ mensaje: MensajeDePedido }> {
  return peticion('POST', `/api/v1/seguimiento/mensajes/${mensajeId}/correccion`, { pedidoId, ...datos });
}

export type AccionDePedido =
  | { readonly accion: 'tildar' }
  | { readonly accion: 'destildar' }
  | { readonly accion: 'en_curso' }
  | { readonly accion: 'reagendar'; readonly recordarEl: string | null }
  | { readonly accion: 'cancelar'; readonly motivo: string }
  | { readonly accion: 'reabrir' }
  | { readonly accion: 'prioridad'; readonly prioridad: Prioridad }
  | { readonly accion: 'derivar'; readonly destinatarioUsuarioIds: readonly string[] }
  | { readonly accion: 'derivar_a_soporte' }
  | { readonly accion: 'corregir'; readonly asunto?: string; readonly clienteId?: string | null };

export function cambiarPedido(id: string, accion: AccionDePedido): Promise<{ pedido: PedidoDelEquipo }> {
  return peticion('PATCH', `/api/v1/seguimiento/pedidos-equipo/${id}`, accion);
}

export function cambiarPrioridadDeSolicitud(
  id: string,
  cambio: { readonly prioridad?: Prioridad; readonly recordarEl?: string | null },
): Promise<{ solicitud: SolicitudDocumentacion }> {
  return peticion('PATCH', `/api/v1/seguimiento/solicitudes/${id}/prioridad`, cambio);
}

/** Solo dirección. */
export function listarSoporte(): Promise<{ pedidos: readonly PedidoDelEquipo[] }> {
  return peticion('GET', '/api/v1/seguimiento/soporte');
}
