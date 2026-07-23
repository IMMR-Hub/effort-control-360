/**
 * Repositorio de usuarios contra Prisma.
 */

import type { Rol } from '@effort/schema';

import type {
  AltaDeUsuario,
  CamposEditablesDeUsuario,
  RepositorioDeUsuarios,
  RolEnCliente,
  UsuarioConCredenciales,
  UsuarioListado,
} from '../puertos.js';
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

/** Campos de la vista de equipo: sin credenciales, nunca. */
const CAMPOS_LISTADO = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  telefono: true,
  cargo: true,
  rol: true,
  activo: true,
  veTodosLosClientes: true,
  ultimoAccesoEn: true,
} as const;

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

  async listar(): Promise<UsuarioListado[]> {
    const filas = await this.prisma.usuario.findMany({
      select: CAMPOS_LISTADO,
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
    });

    return filas as UsuarioListado[];
  }

  async buscarListadoPorId(id: string): Promise<UsuarioListado | null> {
    const fila = await this.prisma.usuario.findUnique({
      where: { id },
      select: CAMPOS_LISTADO,
    });

    return fila as UsuarioListado | null;
  }

  async crear(datos: AltaDeUsuario): Promise<UsuarioListado> {
    const fila = await this.prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        telefono: datos.telefono,
        cargo: datos.cargo,
        rol: datos.rol as never,
        veTodosLosClientes: datos.veTodosLosClientes,
        hashContrasena: datos.hashContrasena,
        creadoPorUsuarioId: datos.creadoPorUsuarioId,
        actualizadoPorUsuarioId: datos.creadoPorUsuarioId,
      },
      select: CAMPOS_LISTADO,
    });

    return fila as UsuarioListado;
  }

  async actualizar(
    id: string,
    cambios: CamposEditablesDeUsuario,
    actorId: string,
  ): Promise<UsuarioListado> {
    const fila = await this.prisma.usuario.update({
      where: { id },
      // Los campos llegan ya validados por Zod estricto en la ruta: solo puede
      // haber claves de la lista permitida.
      data: { ...cambios, actualizadoPorUsuarioId: actorId } as never,
      select: CAMPOS_LISTADO,
    });

    return fila as UsuarioListado;
  }

  /**
   * Cierra lo que ya no corresponde y abre lo que falta, en una sola
   * transacción: una asignación a medio reemplazar dejaría a alguien sin
   * acceso a un cliente que sí le toca, o viendo uno que ya no le toca.
   */
  async reemplazarCartera(
    usuarioId: string,
    clienteIds: readonly string[],
    rolEnCliente: RolEnCliente | null,
    momento: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const vigentes = await tx.asignacionCliente.findMany({
        where: { usuarioId, OR: [{ hasta: null }, { hasta: { gt: momento } }] },
        select: { id: true, clienteId: true, rol: true },
      });

      const deseados = new Set(clienteIds);
      // También se cierra una fila cuyo cliente sigue en la lista pero con un
      // rol distinto: un ascenso de auxiliar a coordinador abre una fila
      // nueva en vez de mutar la vieja, para que el historial diga desde
      // cuándo ejerció cada rol en ese cliente.
      const aCerrar = vigentes.filter(
        (v) => !deseados.has(v.clienteId) || v.rol !== rolEnCliente,
      );
      const yaCorrectos = new Set(
        vigentes
          .filter((v) => deseados.has(v.clienteId) && v.rol === rolEnCliente)
          .map((v) => v.clienteId),
      );
      const aCrear = clienteIds.filter((id) => !yaCorrectos.has(id));

      if (aCerrar.length > 0) {
        await tx.asignacionCliente.updateMany({
          where: { id: { in: aCerrar.map((v) => v.id) } },
          data: { hasta: momento },
        });
      }

      if (rolEnCliente && aCrear.length > 0) {
        await tx.asignacionCliente.createMany({
          data: aCrear.map((clienteId) => ({
            clienteId,
            usuarioId,
            rol: rolEnCliente as never,
            desde: momento,
          })),
        });
      }
    });
  }
}
