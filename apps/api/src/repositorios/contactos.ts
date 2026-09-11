/**
 * Repositorio de la bitácora de contactos contra Prisma.
 *
 * No expone borrado ni modificación, y no es un olvido: la base tiene un
 * disparador que rechaza DELETE sobre `registro_contacto`, y un método de
 * actualización acá invitaría a editar evidencia. Una corrección se registra
 * como un contacto nuevo que referencia al anterior mediante `corregidoPorId`.
 */

import type { ContactoAlmacenado, RepositorioDeContactos } from '../puertos.js';
import type { PrismaClient } from './prisma.js';

const CAMPOS = {
  id: true,
  clienteId: true,
  periodo: true,
  canal: true,
  direccion: true,
  origenContacto: true,
  ocurridoEn: true,
  registradoPorUsuarioId: true,
  huboRespuesta: true,
  quienAtendio: true,
  resumen: true,
  evidenciaId: true,
} as const;

export class ContactosPrisma implements RepositorioDeContactos {
  constructor(private readonly prisma: PrismaClient) {}

  async listarPorCliente(clienteId: string, periodo: string | null): Promise<ContactoAlmacenado[]> {
    return this.prisma.registroContacto.findMany({
      where: { clienteId, ...(periodo ? { periodo } : {}) },
      select: CAMPOS,
      // Del más reciente al más viejo: es el orden en que se lee una gestión
      // cuando alguien pregunta "¿qué pasó con este cliente?".
      orderBy: { ocurridoEn: 'desc' },
    });
  }

  async listarDelPeriodo(
    periodo: string,
    filtro: readonly string[] | null,
  ): Promise<ContactoAlmacenado[]> {
    return this.prisma.registroContacto.findMany({
      where: { periodo, ...(filtro === null ? {} : { clienteId: { in: [...filtro] } }) },
      select: CAMPOS,
      orderBy: { ocurridoEn: 'desc' },
    });
  }

  async registrar(datos: Omit<ContactoAlmacenado, 'id'>): Promise<ContactoAlmacenado> {
    return this.prisma.registroContacto.create({
      data: {
        clienteId: datos.clienteId,
        periodo: datos.periodo,
        canal: datos.canal as never,
        direccion: datos.direccion,
        origenContacto: datos.origenContacto,
        ocurridoEn: datos.ocurridoEn,
        registradoPorUsuarioId: datos.registradoPorUsuarioId,
        huboRespuesta: datos.huboRespuesta,
        quienAtendio: datos.quienAtendio,
        resumen: datos.resumen,
        evidenciaId: datos.evidenciaId,
      },
      select: CAMPOS,
    });
  }
}
