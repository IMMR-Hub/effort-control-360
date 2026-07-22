/**
 * Repositorio de usuarios contra Prisma.
 */

import type { Rol } from '@effort/schema';

import type { RepositorioDeUsuarios, UsuarioConCredenciales } from '../puertos.js';
import type { PrismaClient } from './prisma.js';

/**
 * Campos que se leen del usuario.
 *
 * Se enumeran explícitamente en vez de traer la fila entera. Con un `select`
 * explícito, agregar una columna sensible al modelo no la filtra automáticamente
 * a todo lo que consuma este repositorio.
 */
const CAMPOS = {
  id: true,
  email: true,
  rol: true,
  activo: true,
  veTodosLosClientes: true,
  hashContrasena: true,
  secretoTotp: true,
  segundoFactorActivo: true,
  debeCambiarContrasena: true,
} as const;

type FilaUsuario = {
  id: string;
  email: string;
  rol: string;
  activo: boolean;
  veTodosLosClientes: boolean;
  hashContrasena: string;
  secretoTotp: string | null;
  segundoFactorActivo: boolean;
  debeCambiarContrasena: boolean;
};

function aDominio(fila: FilaUsuario): UsuarioConCredenciales {
  return {
    id: fila.id,
    email: fila.email,
    rol: fila.rol as Rol,
    activo: fila.activo,
    veTodosLosClientes: fila.veTodosLosClientes,
    hashContrasena: fila.hashContrasena,
    secretoTotp: fila.secretoTotp,
    segundoFactorActivo: fila.segundoFactorActivo,
    debeCambiarContrasena: fila.debeCambiarContrasena,
  };
}

export class UsuariosPrisma implements RepositorioDeUsuarios {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorEmail(email: string): Promise<UsuarioConCredenciales | null> {
    // El correo se normaliza a minúsculas en el esquema Zod antes de llegar acá,
    // y la columna tiene índice único, así que la búsqueda es exacta.
    const fila = await this.prisma.usuario.findUnique({
      where: { email },
      select: CAMPOS,
    });

    return fila ? aDominio(fila) : null;
  }

  async buscarPorId(id: string): Promise<UsuarioConCredenciales | null> {
    const fila = await this.prisma.usuario.findUnique({
      where: { id },
      select: CAMPOS,
    });

    return fila ? aDominio(fila) : null;
  }

  /**
   * Clientes que el usuario tiene asignados hoy.
   *
   * Solo asignaciones vigentes: `hasta` nulo, o con fecha futura. Cuando alguien
   * deja de llevar un cliente se le pone fecha de fin en vez de borrar la fila,
   * para que el historial siga explicando quién tenía qué en cada momento; si
   * la consulta no filtrara por vigencia, seguiría viendo clientes que ya no
   * le corresponden.
   */
  async clientesAsignados(usuarioId: string): Promise<string[]> {
    const filas = await this.prisma.asignacionCliente.findMany({
      where: {
        usuarioId,
        OR: [{ hasta: null }, { hasta: { gt: new Date() } }],
      },
      select: { clienteId: true },
      distinct: ['clienteId'],
    });

    return filas.map((fila) => fila.clienteId);
  }

  async registrarAcceso(usuarioId: string, momento: Date): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { ultimoAccesoEn: momento },
    });
  }
}
