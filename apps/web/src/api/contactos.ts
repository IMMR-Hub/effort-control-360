/**
 * Bitácora de contactos y constancia de gestión (`apps/api/src/rutas/contactos.ts`).
 */

import type { ConstanciaDeGestion } from '@effort/core';

import { peticion } from './cliente.js';

export interface Contacto {
  readonly id: string;
  readonly clienteId: string;
  /** Texto "AAAA-MM". */
  readonly periodo: string;
  readonly canal: 'LLAMADA' | 'MENSAJE' | 'WHATSAPP' | 'CORREO' | 'PRESENCIAL';
  readonly direccion: 'SALIENTE' | 'ENTRANTE';
  readonly origenContacto: 'AUTOMATICO' | 'MANUAL';
  /** ISO 8601 con hora. */
  readonly ocurridoEn: string;
  readonly registradoPorUsuarioId: string;
  readonly huboRespuesta: boolean;
  readonly quienAtendio: string | null;
  readonly resumen: string;
  readonly evidenciaId: string | null;
}

export function listarContactos(
  clienteId: string,
  periodo?: string,
): Promise<{ contactos: readonly Contacto[] }> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/contactos`, undefined, { periodo });
}

/**
 * Todos los contactos del periodo, en una sola llamada.
 *
 * Seguimiento los pedia cliente por cliente: con 5 clientes eran 5 viajes a la
 * base, con los 144 reales serian 144, y cada uno cuesta ~310 ms.
 */
export function listarContactosDelPeriodo(
  periodo: string,
): Promise<{ contactos: readonly Contacto[] }> {
  return peticion('GET', '/api/v1/contactos', undefined, { periodo });
}

export interface RegistrarContacto {
  readonly periodo: string;
  readonly canal: Contacto['canal'];
  readonly direccion: Contacto['direccion'];
  readonly ocurridoEn: string;
  readonly huboRespuesta: boolean;
  readonly quienAtendio: string | null;
  readonly resumen: string;
  readonly evidenciaId?: string | null;
}

export function registrarContacto(
  clienteId: string,
  datos: RegistrarContacto,
): Promise<{ contacto: Contacto }> {
  return peticion('POST', `/api/v1/clientes/${clienteId}/contactos`, { clienteId, ...datos });
}

export function obtenerConstancia(
  clienteId: string,
  periodo: string,
): Promise<{ constancia: ConstanciaDeGestion }> {
  return peticion('GET', `/api/v1/clientes/${clienteId}/constancia`, undefined, { periodo });
}
