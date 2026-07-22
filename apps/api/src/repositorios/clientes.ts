/**
 * Repositorio de clientes contra Prisma.
 *
 * El filtro de cartera se aplica en la consulta SQL, no filtrando en memoria
 * después de traer todo. La diferencia importa: filtrar después significa que
 * la fila del cliente ajeno ya viajó desde la base hasta el proceso, y basta un
 * error de logueo o un mensaje de excepción para que termine en un lugar donde
 * no debería estar.
 */

import type { ClienteListado, RepositorioDeClientes } from '../puertos.js';
import type { PrismaClient } from './prisma.js';

const CAMPOS = { id: true, nombre: true, ruc: true, activo: true } as const;

/**
 * Traduce el filtro de cartera a una condición de Prisma.
 *
 * `null` (ve toda la cartera) no agrega condición. Un arreglo, aunque esté
 * vacío, restringe: un usuario sin clientes asignados obtiene `id IN ()`, que
 * no devuelve nada. Es deliberado — la alternativa, tratar el arreglo vacío
 * como "sin filtro", le mostraría la cartera entera.
 */
function condicionDeCartera(filtro: readonly string[] | null) {
  return filtro === null ? {} : { id: { in: [...filtro] } };
}

export class ClientesPrisma implements RepositorioDeClientes {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(filtro: readonly string[] | null): Promise<ClienteListado[]> {
    return this.prisma.cliente.findMany({
      where: { ...condicionDeCartera(filtro) },
      select: CAMPOS,
      orderBy: { nombre: 'asc' },
    });
  }

  async buscarPorId(id: string, filtro: readonly string[] | null): Promise<ClienteListado | null> {
    // Las dos condiciones van dentro de un AND explícito y NO combinadas con
    // spread. Ambas se expresan sobre la columna `id`, así que `{ id, ...{ id:
    // { in: [...] } } }` haría que la segunda pise a la primera: la consulta
    // perdería el identificador pedido y devolvería cualquier cliente de la
    // cartera. Lo detectó el test de integración; con dobles de prueba no
    // aparecía, porque el doble implementaba la lógica a mano y correctamente.
    return this.prisma.cliente.findFirst({
      where: {
        AND: [{ id }, ...(filtro === null ? [] : [{ id: { in: [...filtro] } }])],
      },
      select: CAMPOS,
    });
  }
}
