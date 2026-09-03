/**
 * Equipo (`apps/api/src/rutas/usuarios.ts`).
 *
 * Alta y edición son exclusivas de `direccion` — el propio RBAC del servidor
 * ya lo impone (`usuario: ['ver', 'crear', 'editar']` solo en ese rol).
 * `clientesAsignados` reemplaza la cartera entera al editar, nunca agrega o
 * quita un cliente suelto.
 */

import type { Rol } from '@effort/schema';

import { peticion } from './cliente.js';

export interface Usuario {
  readonly id: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string | null;
  readonly cargo: string | null;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly veTodosLosClientes: boolean;
  /** ISO 8601 con hora, o `null` si nunca inició sesión. */
  readonly ultimoAccesoEn: string | null;
}

export function listarUsuarios(): Promise<{ usuarios: readonly Usuario[] }> {
  return peticion('GET', '/api/v1/usuarios');
}

export function obtenerCarteraDeUsuario(id: string): Promise<{ clienteIds: readonly string[] }> {
  return peticion('GET', `/api/v1/usuarios/${id}/clientes`);
}

export interface AltaDeUsuario {
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono?: string | null;
  readonly cargo?: string | null;
  readonly rol: Rol;
  readonly veTodosLosClientes?: boolean;
  readonly contrasenaInicial: string;
  readonly clientesAsignados?: readonly string[];
}

export function crearUsuario(datos: AltaDeUsuario): Promise<{ usuario: Usuario }> {
  return peticion('POST', '/api/v1/usuarios', datos);
}

export interface EdicionDeUsuario {
  readonly nombre?: string;
  readonly apellido?: string;
  readonly telefono?: string | null;
  readonly cargo?: string | null;
  readonly rol?: Rol;
  readonly activo?: boolean;
  readonly veTodosLosClientes?: boolean;
  /** Si se manda, reemplaza la cartera entera. Si se omite, no se toca. */
  readonly clientesAsignados?: readonly string[];
}

export function actualizarUsuario(
  id: string,
  cambios: EdicionDeUsuario,
): Promise<{ usuario: Usuario }> {
  return peticion('PATCH', `/api/v1/usuarios/${id}`, cambios);
}
