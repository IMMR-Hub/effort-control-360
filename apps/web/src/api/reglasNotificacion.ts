/**
 * Reglas de notificación (`apps/api/src/rutas/reglas-notificacion.ts`).
 *
 * El motor que interpreta estas reglas (`planificarProximoRecordatorio`) ya
 * existe en `@effort/core/seguimiento.ts` desde la Parte 1.3 — esta pantalla
 * solo persiste la configuración. El job que de verdad envía los avisos es
 * la Parte 6, todavía no construida.
 */

import type { Destinatario, EventoDisparador, TipoDestinatario } from '@effort/core';

import { peticion } from './cliente.js';

export type { Destinatario, EventoDisparador, TipoDestinatario };

export interface ReglaDeNotificacion {
  readonly id: string;
  readonly nombre: string;
  readonly activa: boolean;
  readonly evento: EventoDisparador;
  readonly diasHabilesDePlazo: number;
  /** "HH:MM". */
  readonly horaDeEnvio: string;
  readonly reintentarCadaDiasHabiles: number;
  readonly maximoRecordatorios: number;
  readonly escalarAPartirDelRecordatorio: number;
  readonly destinatariosIniciales: readonly Destinatario[];
  readonly destinatariosDeEscalamiento: readonly Destinatario[];
  /** Vacío alcanza a toda la cartera; con ids, solo a esos clientes. */
  readonly clientesAlcanzados: readonly string[];
  readonly plantillaId: string | null;
}

export function listarReglasDeNotificacion(): Promise<{ reglas: readonly ReglaDeNotificacion[] }> {
  return peticion('GET', '/api/v1/reglas-notificacion');
}

export interface AltaDeReglaDeNotificacion {
  readonly nombre: string;
  readonly activa: boolean;
  readonly evento: EventoDisparador;
  readonly diasHabilesDePlazo: number;
  readonly horaDeEnvio: string;
  readonly reintentarCadaDiasHabiles: number;
  readonly maximoRecordatorios: number;
  readonly escalarAPartirDelRecordatorio: number;
  readonly destinatariosIniciales: readonly Destinatario[];
  readonly destinatariosDeEscalamiento: readonly Destinatario[];
  readonly clientesAlcanzados: readonly string[];
}

export function crearReglaDeNotificacion(
  datos: AltaDeReglaDeNotificacion,
): Promise<{ regla: ReglaDeNotificacion }> {
  return peticion('POST', '/api/v1/reglas-notificacion', datos);
}

export type EdicionDeReglaDeNotificacion = Partial<AltaDeReglaDeNotificacion>;

export function actualizarReglaDeNotificacion(
  id: string,
  cambios: EdicionDeReglaDeNotificacion,
): Promise<{ regla: ReglaDeNotificacion }> {
  return peticion('PATCH', `/api/v1/reglas-notificacion/${id}`, cambios);
}
