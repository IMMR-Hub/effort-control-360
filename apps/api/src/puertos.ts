/**
 * Puertos de persistencia.
 *
 * Las rutas dependen de estas interfaces, no de Prisma. Eso permite dos cosas
 * que importan: probar el servidor entero sin levantar una base de datos, y
 * cambiar de motor sin reescribir las rutas.
 *
 * Todo método que consulta datos de clientes recibe el filtro de cartera. No
 * es opcional a propósito: si fuera un parámetro que se puede omitir, tarde o
 * temprano alguien lo omite y expone la cartera completa.
 */

import type { Rol } from '@effort/schema';

import type { Sesion } from './seguridad/sesiones.js';

export interface UsuarioConCredenciales {
  readonly id: string;
  readonly email: string;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly veTodosLosClientes: boolean;
  readonly hashContrasena: string;
  readonly secretoTotp: string | null;
  readonly segundoFactorActivo: boolean;
  readonly debeCambiarContrasena: boolean;
}

export interface RepositorioDeUsuarios {
  buscarPorEmail(email: string): Promise<UsuarioConCredenciales | null>;
  buscarPorId(id: string): Promise<UsuarioConCredenciales | null>;
  clientesAsignados(usuarioId: string): Promise<string[]>;
  registrarAcceso(usuarioId: string, momento: Date): Promise<void>;
}

export interface RepositorioDeSesiones {
  crear(datos: {
    hashDelToken: string;
    usuarioId: string;
    segundoFactorSuperado: boolean;
    ipTruncada: string | null;
    agenteUsuario: string | null;
  }): Promise<Sesion>;
  buscarPorHash(hashDelToken: string): Promise<Sesion | null>;
  marcarSegundoFactorSuperado(sesionId: string): Promise<void>;
  tocar(sesionId: string, momento: Date): Promise<void>;
  revocar(sesionId: string, momento: Date, motivo: string): Promise<void>;
  revocarTodasDelUsuario(usuarioId: string, momento: Date, motivo: string): Promise<void>;
}

export interface ClienteListado {
  readonly id: string;
  readonly nombre: string;
  readonly ruc: string;
  readonly activo: boolean;
}

export interface RepositorioDeClientes {
  /** `filtro` en null significa cartera completa; un arreglo, solo esos clientes. */
  listar(filtro: readonly string[] | null): Promise<ClienteListado[]>;
  buscarPorId(id: string, filtro: readonly string[] | null): Promise<ClienteListado | null>;
}

export interface ContactoAlmacenado {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  readonly canal: string;
  readonly direccion: string;
  readonly origenContacto: string;
  readonly ocurridoEn: Date;
  readonly registradoPorUsuarioId: string;
  readonly huboRespuesta: boolean;
  readonly quienAtendio: string | null;
  readonly resumen: string;
  readonly evidenciaId: string | null;
}

export interface RepositorioDeContactos {
  listarPorCliente(clienteId: string, periodo: string | null): Promise<ContactoAlmacenado[]>;
  registrar(datos: Omit<ContactoAlmacenado, 'id'>): Promise<ContactoAlmacenado>;
}
