/**
 * Dobles de prueba de los puertos de persistencia.
 *
 * Permiten ejercitar el servidor completo — barreras, sesiones, RBAC, rutas —
 * sin levantar PostgreSQL. Los tests de integración contra la base real siguen
 * haciendo falta para verificar el SQL y los disparadores, pero el
 * comportamiento de seguridad se puede probar acá, y por eso corre en cada
 * `npm run verify` en vez de solo cuando hay base disponible.
 */

import { randomUUID } from 'node:crypto';

import type { Rol } from '@effort/schema';

import type { FilaDeBitacora, RepositorioDeBitacora } from '../src/bitacora.js';
import type { Sesion } from '../src/seguridad/sesiones.js';
import type {
  AltaDeUsuario,
  CamposEditablesDeUsuario,
  ClienteListado,
  ContactoAlmacenado,
  RepositorioDeClientes,
  RepositorioDeContactos,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
  UsuarioConCredenciales,
  UsuarioListado,
} from '../src/puertos.js';

/**
 * Fixture de usuario para los tests de acceso.
 *
 * Los campos de ficha (`nombre`, `apellido`, `telefono`, `cargo`,
 * `ultimoAccesoEn`) son opcionales porque los tests de acceso, sesiones y
 * módulos no los necesitan y no los cargan — solo los de equipo lo hacen.
 */
export interface UsuarioFalso extends UsuarioConCredenciales {
  nombre?: string;
  apellido?: string;
  telefono?: string | null;
  cargo?: string | null;
  ultimoAccesoEn?: Date | null;
}

function aListado(usuario: UsuarioFalso): UsuarioListado {
  return {
    id: usuario.id,
    nombre: usuario.nombre ?? '',
    apellido: usuario.apellido ?? '',
    email: usuario.email,
    telefono: usuario.telefono ?? null,
    cargo: usuario.cargo ?? null,
    rol: usuario.rol,
    activo: usuario.activo,
    veTodosLosClientes: usuario.veTodosLosClientes,
    ultimoAccesoEn: usuario.ultimoAccesoEn ?? null,
  };
}

export class UsuariosFalsos implements RepositorioDeUsuarios {
  readonly usuarios: UsuarioFalso[] = [];
  readonly asignaciones = new Map<string, string[]>();
  readonly accesos: { usuarioId: string; momento: Date }[] = [];

  async buscarPorEmail(email: string): Promise<UsuarioConCredenciales | null> {
    return this.usuarios.find((usuario) => usuario.email === email) ?? null;
  }

  async buscarPorId(id: string): Promise<UsuarioConCredenciales | null> {
    return this.usuarios.find((usuario) => usuario.id === id) ?? null;
  }

  async clientesAsignados(usuarioId: string): Promise<string[]> {
    return this.asignaciones.get(usuarioId) ?? [];
  }

  async registrarAcceso(usuarioId: string, momento: Date): Promise<void> {
    this.accesos.push({ usuarioId, momento });
  }

  async listar(): Promise<UsuarioListado[]> {
    return this.usuarios.map(aListado);
  }

  async buscarListadoPorId(id: string): Promise<UsuarioListado | null> {
    const usuario = this.usuarios.find((candidato) => candidato.id === id);
    return usuario ? aListado(usuario) : null;
  }

  async crear(datos: AltaDeUsuario): Promise<UsuarioListado> {
    const usuario: UsuarioFalso = {
      id: randomUUID(),
      email: datos.email,
      rol: datos.rol,
      activo: true,
      veTodosLosClientes: datos.veTodosLosClientes,
      hashContrasena: datos.hashContrasena,
      secretoTotp: null,
      segundoFactorActivo: false,
      debeCambiarContrasena: true,
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      cargo: datos.cargo,
      ultimoAccesoEn: null,
    };
    this.usuarios.push(usuario);
    return aListado(usuario);
  }

  async actualizar(id: string, cambios: CamposEditablesDeUsuario): Promise<UsuarioListado> {
    const indice = this.usuarios.findIndex((usuario) => usuario.id === id);
    const actualizado: UsuarioFalso = { ...this.usuarios[indice]!, ...cambios };
    this.usuarios[indice] = actualizado;
    return aListado(actualizado);
  }

  /** El doble no modela vigencia por rol: solo reemplaza la lista de ids. */
  async reemplazarCartera(usuarioId: string, clienteIds: readonly string[]): Promise<void> {
    this.asignaciones.set(usuarioId, [...clienteIds]);
  }
}

export class SesionesFalsas implements RepositorioDeSesiones {
  readonly sesiones: Sesion[] = [];

  async crear(datos: {
    hashDelToken: string;
    usuarioId: string;
    segundoFactorSuperado: boolean;
    ipTruncada: string | null;
    agenteUsuario: string | null;
  }): Promise<Sesion> {
    const ahora = new Date();
    const sesion: Sesion = {
      id: randomUUID(),
      hashDelToken: datos.hashDelToken,
      usuarioId: datos.usuarioId,
      rol: 'auxiliar' as Rol,
      creadaEn: ahora,
      ultimoUsoEn: ahora,
      segundoFactorSuperado: datos.segundoFactorSuperado,
      ipTruncada: datos.ipTruncada,
      agenteUsuario: datos.agenteUsuario,
      revocadaEn: null,
    };
    this.sesiones.push(sesion);
    return sesion;
  }

  async buscarPorHash(hashDelToken: string): Promise<Sesion | null> {
    return this.sesiones.find((sesion) => sesion.hashDelToken === hashDelToken) ?? null;
  }

  #reemplazar(id: string, cambios: Partial<Sesion>): void {
    const indice = this.sesiones.findIndex((sesion) => sesion.id === id);
    if (indice >= 0) {
      this.sesiones[indice] = { ...this.sesiones[indice]!, ...cambios };
    }
  }

  async marcarSegundoFactorSuperado(sesionId: string): Promise<void> {
    this.#reemplazar(sesionId, { segundoFactorSuperado: true });
  }

  async tocar(sesionId: string, momento: Date): Promise<void> {
    this.#reemplazar(sesionId, { ultimoUsoEn: momento });
  }

  async revocar(sesionId: string, momento: Date): Promise<void> {
    this.#reemplazar(sesionId, { revocadaEn: momento });
  }

  async revocarTodasDelUsuario(usuarioId: string, momento: Date): Promise<void> {
    for (const sesion of this.sesiones) {
      if (sesion.usuarioId === usuarioId) {
        this.#reemplazar(sesion.id, { revocadaEn: momento });
      }
    }
  }
}

export class ClientesFalsos implements RepositorioDeClientes {
  readonly clientes: ClienteListado[] = [];

  async listar(filtro: readonly string[] | null): Promise<ClienteListado[]> {
    if (filtro === null) return [...this.clientes];
    return this.clientes.filter((cliente) => filtro.includes(cliente.id));
  }

  async buscarPorId(id: string, filtro: readonly string[] | null): Promise<ClienteListado | null> {
    const cliente = this.clientes.find((candidato) => candidato.id === id);
    if (!cliente) return null;
    if (filtro !== null && !filtro.includes(id)) return null;
    return cliente;
  }
}

export class ContactosFalsos implements RepositorioDeContactos {
  readonly contactos: ContactoAlmacenado[] = [];

  async listarPorCliente(clienteId: string, periodo: string | null): Promise<ContactoAlmacenado[]> {
    return this.contactos.filter(
      (contacto) => contacto.clienteId === clienteId && (!periodo || contacto.periodo === periodo),
    );
  }

  async registrar(datos: Omit<ContactoAlmacenado, 'id'>): Promise<ContactoAlmacenado> {
    const contacto: ContactoAlmacenado = { id: randomUUID(), ...datos };
    this.contactos.push(contacto);
    return contacto;
  }
}

export class BitacoraFalsa implements RepositorioDeBitacora {
  readonly filas: FilaDeBitacora[] = [];

  async registrar(fila: FilaDeBitacora): Promise<void> {
    this.filas.push(fila);
  }

  accionesRegistradas(): string[] {
    return this.filas.map((fila) => fila.accion);
  }
}

/** Bitácora que siempre falla, para comprobar que su fallo no tumba la operación. */
export class BitacoraRota implements RepositorioDeBitacora {
  async registrar(): Promise<void> {
    throw new Error('base de datos caída');
  }
}
