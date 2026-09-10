/**
 * Llamadas de acceso: contraseña → segundo factor, en dos peticiones
 * separadas — igual que el servidor las modela (`apps/api/src/rutas/autenticacion.ts`).
 */

import type { Rol } from '@effort/schema';

import { ErrorDeApi, peticion } from './cliente.js';

export interface RespuestaAcceso {
  readonly segundoFactorRequerido: boolean;
  /** El rol exige segundo factor y esta persona todavía no lo dio de alta. */
  readonly segundoFactorPorConfigurar: boolean;
  readonly debeCambiarContrasena: boolean;
}

export function iniciarAcceso(email: string, contrasena: string): Promise<RespuestaAcceso> {
  return peticion<RespuestaAcceso>('POST', '/api/v1/acceso', { email, contrasena });
}

export function confirmarSegundoFactor(codigo: string): Promise<{ acceso: 'concedido' }> {
  return peticion('POST', '/api/v1/acceso/segundo-factor', { codigo });
}

/* --- Credenciales propias -------------------------------------------------- */

export interface AltaDeSegundoFactor {
  /** Para cargar a mano en la aplicación de autenticación. */
  readonly secreto: string;
  /** `otpauth://…`, para las aplicaciones que aceptan pegar el enlace. */
  readonly url: string;
}

/** El servidor entrega el secreto una sola vez: no hay forma de volver a pedirlo. */
export function iniciarAltaDeSegundoFactor(): Promise<AltaDeSegundoFactor> {
  return peticion<AltaDeSegundoFactor>('POST', '/api/v1/mi/segundo-factor');
}

export function confirmarAltaDeSegundoFactor(
  codigo: string,
): Promise<{ segundoFactorActivo: true }> {
  return peticion('POST', '/api/v1/mi/segundo-factor/confirmar', { codigo });
}

/** Cambiarla cierra todas las sesiones, incluida la actual: hay que volver a entrar. */
export function cambiarContrasena(
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<{ contrasenaCambiada: true; sesionCerrada: true }> {
  return peticion('POST', '/api/v1/mi/contrasena', { contrasenaActual, contrasenaNueva });
}

export function cerrarSesion(): Promise<{ salida: 'ok' }> {
  return peticion('POST', '/api/v1/salida');
}

export interface SesionActual {
  readonly usuarioId: string;
  readonly rol: Rol;
  readonly veTodosLosClientes: boolean;
  readonly cantidadDeClientesAsignados: number;
  /**
   * Con esto en `true` la sesión existe pero el servidor rechaza todo lo demás
   * hasta que la persona cambie su contraseña. Hay que mandarla a esa pantalla,
   * no al panel.
   */
  readonly debeCambiarContrasena: boolean;
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
