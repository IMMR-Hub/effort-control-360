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

import type {
  EventoAlmacenado,
  FilaDeBitacora,
  FiltroDeEventos,
  RepositorioDeBitacora,
} from '../src/bitacora.js';
import type { Sesion } from '../src/seguridad/sesiones.js';
import type {
  AltaDeCliente,
  AltaDeUsuario,
  CamposEditablesDeCliente,
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

/**
 * Completa un fixture de cliente con los campos que la mayoría de los tests
 * no necesita variar, para no repetirlos en cada `push`.
 */
export function clienteMinimo(
  datos: Pick<ClienteListado, 'id' | 'nombre' | 'ruc' | 'activo'>,
): ClienteListado {
  return {
    ...datos,
    tipoPersona: 'JURIDICA',
    regimenTributario: null,
    email: null,
    telefono: null,
    canalPreferido: null,
    carpetaOneDriveId: null,
    observaciones: null,
  };
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

  async buscarPorRuc(ruc: string): Promise<ClienteListado | null> {
    return this.clientes.find((candidato) => candidato.ruc === ruc) ?? null;
  }

  async crear(datos: AltaDeCliente): Promise<ClienteListado> {
    const cliente: ClienteListado = {
      id: randomUUID(),
      nombre: datos.nombre,
      ruc: datos.ruc,
      tipoPersona: datos.tipoPersona,
      regimenTributario: datos.regimenTributario,
      email: datos.email,
      telefono: datos.telefono,
      canalPreferido: datos.canalPreferido,
      carpetaOneDriveId: null,
      activo: true,
      observaciones: datos.observaciones,
    };
    this.clientes.push(cliente);
    return cliente;
  }

  async actualizar(id: string, cambios: CamposEditablesDeCliente): Promise<ClienteListado> {
    const indice = this.clientes.findIndex((candidato) => candidato.id === id);
    const actualizado: ClienteListado = { ...this.clientes[indice]!, ...cambios };
    this.clientes[indice] = actualizado;
    return actualizado;
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

/** Aplica el filtro de cartera igual que lo haría el SQL de `BitacoraPrisma`. */
function alcanzaEvento(cartera: readonly string[] | null, clienteId: string | null): boolean {
  if (cartera === null) return true;
  if (clienteId === null) return false;
  return cartera.includes(clienteId);
}

export class BitacoraFalsa implements RepositorioDeBitacora {
  readonly filas: EventoAlmacenado[] = [];

  async registrar(fila: FilaDeBitacora): Promise<void> {
    this.filas.push({ ...fila, id: randomUUID(), ocurridoEn: new Date() });
  }

  accionesRegistradas(): string[] {
    return this.filas.map((fila) => fila.accion);
  }

  async listar(
    filtro: FiltroDeEventos,
    cartera: readonly string[] | null,
    limite: number,
    desplazamiento: number,
  ): Promise<EventoAlmacenado[]> {
    const filtradas = this.filas
      .filter((fila) => !filtro.usuarioId || fila.usuarioId === filtro.usuarioId)
      .filter((fila) => !filtro.entidad || fila.entidad === filtro.entidad)
      .filter((fila) => !filtro.entidadId || fila.entidadId === filtro.entidadId)
      .filter((fila) => !filtro.clienteId || fila.clienteId === filtro.clienteId)
      .filter((fila) => !filtro.desde || fila.ocurridoEn.getTime() >= filtro.desde.getTime())
      .filter((fila) => !filtro.hasta || fila.ocurridoEn.getTime() <= filtro.hasta.getTime())
      .filter((fila) => alcanzaEvento(cartera, fila.clienteId))
      .slice()
      .sort((a, b) => b.ocurridoEn.getTime() - a.ocurridoEn.getTime());

    return filtradas.slice(desplazamiento, desplazamiento + limite);
  }
}

/** Bitácora que siempre falla, para comprobar que su fallo no tumba la operación. */
export class BitacoraRota implements RepositorioDeBitacora {
  async registrar(): Promise<void> {
    throw new Error('base de datos caída');
  }
}
