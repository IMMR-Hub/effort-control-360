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
  ClienteListado,
  ContactoAlmacenado,
  RepositorioDeClientes,
  RepositorioDeContactos,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
  UsuarioConCredenciales,
} from '../src/puertos.js';

export class UsuariosFalsos implements RepositorioDeUsuarios {
  readonly usuarios: UsuarioConCredenciales[] = [];
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
