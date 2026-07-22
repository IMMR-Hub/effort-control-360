/**
 * Repositorio de sesiones contra Prisma.
 */

import type { Rol } from '@effort/schema';

import type { RepositorioDeSesiones } from '../puertos.js';
import type { Sesion } from '../seguridad/sesiones.js';
import type { PrismaClient } from './prisma.js';

/**
 * El rol viaja dentro de la sesión, así que se trae del usuario en la misma
 * consulta. Guardarlo copiado en la tabla `sesion` evitaría el join, pero
 * dejaría sesiones con el rol viejo si a alguien se le cambia el rol: seguiría
 * operando con permisos que ya no tiene hasta que cierre sesión.
 */
const CON_ROL = {
  usuario: { select: { rol: true } },
} as const;

type FilaSesion = {
  id: string;
  hashDelToken: string;
  usuarioId: string;
  creadaEn: Date;
  ultimoUsoEn: Date;
  segundoFactorSuperado: boolean;
  ipTruncada: string | null;
  agenteUsuario: string | null;
  revocadaEn: Date | null;
  usuario: { rol: string };
};

function aDominio(fila: FilaSesion): Sesion {
  return {
    id: fila.id,
    hashDelToken: fila.hashDelToken,
    usuarioId: fila.usuarioId,
    rol: fila.usuario.rol as Rol,
    creadaEn: fila.creadaEn,
    ultimoUsoEn: fila.ultimoUsoEn,
    segundoFactorSuperado: fila.segundoFactorSuperado,
    ipTruncada: fila.ipTruncada,
    agenteUsuario: fila.agenteUsuario,
    revocadaEn: fila.revocadaEn,
  };
}

export class SesionesPrisma implements RepositorioDeSesiones {
  constructor(private readonly prisma: PrismaClient) {}

  async crear(datos: {
    hashDelToken: string;
    usuarioId: string;
    segundoFactorSuperado: boolean;
    ipTruncada: string | null;
    agenteUsuario: string | null;
  }): Promise<Sesion> {
    const fila = await this.prisma.sesion.create({
      data: {
        hashDelToken: datos.hashDelToken,
        usuarioId: datos.usuarioId,
        segundoFactorSuperado: datos.segundoFactorSuperado,
        ipTruncada: datos.ipTruncada,
        agenteUsuario: datos.agenteUsuario,
      },
      include: CON_ROL,
    });

    return aDominio(fila);
  }

  async buscarPorHash(hashDelToken: string): Promise<Sesion | null> {
    const fila = await this.prisma.sesion.findUnique({
      where: { hashDelToken },
      include: CON_ROL,
    });

    return fila ? aDominio(fila) : null;
  }

  async marcarSegundoFactorSuperado(sesionId: string): Promise<void> {
    await this.prisma.sesion.update({
      where: { id: sesionId },
      data: { segundoFactorSuperado: true },
    });
  }

  /**
   * Renueva la ventana de inactividad.
   *
   * Corre en cada petición autenticada, así que es la escritura más frecuente
   * del sistema. Se limita a una columna y no toca `actualizadoEn` ni dispara
   * lecturas previas.
   */
  async tocar(sesionId: string, momento: Date): Promise<void> {
    await this.prisma.sesion.update({
      where: { id: sesionId },
      data: { ultimoUsoEn: momento },
    });
  }

  async revocar(sesionId: string, momento: Date, motivo: string): Promise<void> {
    await this.prisma.sesion.update({
      where: { id: sesionId },
      data: { revocadaEn: momento, motivoRevocacion: motivo.slice(0, 120) },
    });
  }

  /**
   * Cierra todas las sesiones de un usuario.
   *
   * Es la palanca para cuando alguien deja la empresa o pierde el equipo. Solo
   * toca las que siguen vigentes, para no pisar la fecha de revocación de las
   * que ya se habían cerrado antes por otro motivo.
   */
  async revocarTodasDelUsuario(usuarioId: string, momento: Date, motivo: string): Promise<void> {
    await this.prisma.sesion.updateMany({
      where: { usuarioId, revocadaEn: null },
      data: { revocadaEn: momento, motivoRevocacion: motivo.slice(0, 120) },
    });
  }

  /** Borra sesiones vencidas hace rato. Lo llama una tarea de mantenimiento. */
  async purgarVencidas(anteriores: Date): Promise<number> {
    const resultado = await this.prisma.sesion.deleteMany({
      where: { ultimoUsoEn: { lt: anteriores } },
    });
    return resultado.count;
  }
}
