/**
 * Reglas de notificación (`apps/api/src/rutas/reglas-notificacion.ts`).
 */

import type { Destinatario, EventoDisparador } from '@effort/core';

import { peticion } from './cliente.js';

export interface ReglaDeNotificacion {
  readonly id: string;
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
  readonly plantillaId: string | null;
}

export function listarReglasDeNotificacion(): Promise<{
  reglas: readonly ReglaDeNotificacion[];
}> {
  return peticion('GET', '/api/v1/reglas-notificacion');
}
