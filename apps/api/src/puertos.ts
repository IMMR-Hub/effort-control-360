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

/** Lo que ve dirección en la vista de equipo. Nunca incluye credenciales. */
export interface UsuarioListado {
  readonly id: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string | null;
  readonly cargo: string | null;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly veTodosLosClientes: boolean;
  readonly ultimoAccesoEn: Date | null;
}

export interface AltaDeUsuario {
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string | null;
  readonly cargo: string | null;
  readonly rol: Rol;
  readonly veTodosLosClientes: boolean;
  /** Ya hasheada: la ruta la genera con `hashearContrasena`, el repositorio no hashea nada. */
  readonly hashContrasena: string;
  readonly creadoPorUsuarioId: string;
}

/**
 * Campos editables de un usuario.
 *
 * `email` no está: cambiarlo es un cambio de identidad de acceso, no una
 * edición de ficha, y no lo pide la tarea. `hashContrasena` tampoco: cambiar
 * la propia contraseña es un flujo aparte que todavía no existe (ver
 * `docs/ROADMAP-MAESTRO.md`, bitácora 2026-07-23).
 *
 * Con `exactOptionalPropertyTypes` activo, cada campo declara `| undefined`
 * de forma explícita en vez de depender de `Partial<T>`: la ruta arma el
 * cuerpo de cambios desestructurando el resultado de un Zod `.optional()`,
 * que sí puede traer `undefined` explícito.
 */
export type CamposEditablesDeUsuario = {
  nombre?: string | undefined;
  apellido?: string | undefined;
  telefono?: string | null | undefined;
  cargo?: string | null | undefined;
  rol?: Rol | undefined;
  activo?: boolean | undefined;
  veTodosLosClientes?: boolean | undefined;
};

/** Rol válido para una asignación de cartera. `direccion` y `solo_lectura` no llevan una: la primera ve todo, la segunda es una auditoría general. */
export type RolEnCliente = 'responsable' | 'coordinador' | 'auxiliar' | 'revisor_balance';

export interface RepositorioDeUsuarios {
  buscarPorEmail(email: string): Promise<UsuarioConCredenciales | null>;
  buscarPorId(id: string): Promise<UsuarioConCredenciales | null>;
  clientesAsignados(usuarioId: string): Promise<string[]>;
  registrarAcceso(usuarioId: string, momento: Date): Promise<void>;

  /** El equipo completo, para la pantalla de dirección. */
  listar(): Promise<UsuarioListado[]>;
  buscarListadoPorId(id: string): Promise<UsuarioListado | null>;
  crear(datos: AltaDeUsuario): Promise<UsuarioListado>;
  actualizar(
    id: string,
    cambios: CamposEditablesDeUsuario,
    actorId: string,
  ): Promise<UsuarioListado>;
  /**
   * Reemplaza la cartera asignada a un usuario.
   *
   * No borra filas: cierra (`hasta`) las asignaciones vigentes que ya no
   * corresponden y abre filas nuevas para las que faltan. El historial de
   * quién llevó qué cliente y cuándo queda intacto.
   *
   * `rolEnCliente` en `null` solo es válido con `clienteIds` vacío — es el
   * caso de un usuario sin cartera acotada (`direccion`, `solo_lectura`, o
   * cualquiera con `veTodosLosClientes` en `true`).
   */
  reemplazarCartera(
    usuarioId: string,
    clienteIds: readonly string[],
    rolEnCliente: RolEnCliente | null,
    momento: Date,
  ): Promise<void>;
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
