/**
 * Llamadas de acceso: contraseña → segundo factor, en dos peticiones
 * separadas — igual que el servidor las modela (`apps/api/src/rutas/autenticacion.ts`).
 */

import type { Rol } from '@effort/schema';

import { ErrorDeApi, peticion } from './cliente.js';

export interface RespuestaAcceso {
  readonly segundoFactorRequerido: boolean;
  readonly debeCambiarContrasena: boolean;
}

export function iniciarAcceso(email: string, contrasena: string): Promise<RespuestaAcceso> {
  return peticion<RespuestaAcceso>('POST', '/api/v1/acceso', { email, contrasena });
}

export function confirmarSegundoFactor(codigo: string): Promise<{ acceso: 'concedido' }> {
  return peticion('POST', '/api/v1/acceso/segundo-factor', { codigo });
}

export function cerrarSesion(): Promise<{ salida: 'ok' }> {
  return peticion('POST', '/api/v1/salida');
}

export interface SesionActual {
  readonly usuarioId: string;
  readonly rol: Rol;
  readonly veTodosLosClientes: boolean;
  readonly cantidadDeClientesAsignados: number;
}

/** `null` si no hay sesión vigente — nunca lanza por eso, es el caso esperado. */
export async function obtenerSesionActual(): Promise<SesionActual | null> {
  try {
    return await peticion<SesionActual>('GET', '/api/v1/yo');
  } catch (error) {
    if (error instanceof ErrorDeApi && error.statusCode === 401) {
      return null;
    }
    throw error;
  }
}
