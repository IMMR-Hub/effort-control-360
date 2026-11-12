/**
 * Repositorio de sesiones contra Prisma.
 */

import type { Rol } from '@effort/schema';

import type { ContextoDeSesion, RepositorioDeSesiones } from '../puertos.js';
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

/** La fila de `contextoPorHash`, con los nombres de columna de la base. */
type FilaDeContexto = {
  id: string;
  hash_del_token: string;
  usuario_id: string;
  creada_en: Date;
  ultimo_uso_en: Date;
  segundo_factor_superado: boolean;
  ip_truncada: string | null;
  agente_usuario: string | null;
  revocada_en: Date | null;
  rol: string;
  activo: boolean;
  ve_todos_los_clientes: boolean;
  debe_cambiar_contrasena: boolean;
  clientes: string[];
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

  /**
   * Una sola sentencia y no un `include` de Prisma: con `include`, Prisma manda
   * una consulta por tabla, una detrás de otra, y acá cada una es un viaje al
   * otro continente. La cartera usa la misma regla de vigencia que
   * `UsuariosPrisma.clientesAsignados` (sin fecha de fin, o con fecha futura).
   */
  async contextoPorHash(hashDelToken: string): Promise<ContextoDeSesion | null> {
    const filas = await this.prisma.$queryRaw<FilaDeContexto[]>`
      SELECT s.id::text AS id, s.hash_del_token, s.usuario_id::text AS usuario_id, s.creada_en, s.ultimo_uso_en,
             s.segundo_factor_superado, s.ip_truncada, s.agente_usuario, s.revocada_en,
             u.rol::text AS rol, u.activo, u.ve_todos_los_clientes, u.debe_cambiar_contrasena,
             COALESCE(
               (SELECT array_agg(DISTINCT a.cliente_id::text)
                  FROM asignacion_cliente a
                 WHERE a.usuario_id = u.id AND (a.hasta IS NULL OR a.hasta > now())),
               ARRAY[]::text[]
             ) AS clientes
        FROM sesion s
        JOIN usuario u ON u.id = s.usuario_id
       WHERE s.hash_del_token = ${hashDelToken}
       LIMIT 1`;

    const fila = filas[0];
    if (!fila) return null;

    return {
      sesion: {
        id: fila.id,
        hashDelToken: fila.hash_del_token,
        usuarioId: fila.usuario_id,
        rol: fila.rol as Rol,
        creadaEn: fila.creada_en,
        ultimoUsoEn: fila.ultimo_uso_en,
        segundoFactorSuperado: fila.segundo_factor_superado,
        ipTruncada: fila.ip_truncada,
        agenteUsuario: fila.agente_usuario,
        revocadaEn: fila.revocada_en,
      },
      usuario: {
        id: fila.usuario_id,
        rol: fila.rol as Rol,
        activo: fila.activo,
        veTodosLosClientes: fila.ve_todos_los_clientes,
        debeCambiarContrasena: fila.debe_cambiar_contrasena,
      },
      clientesAsignados: fila.clientes,
    };
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
