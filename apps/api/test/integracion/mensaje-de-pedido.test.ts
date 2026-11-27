/**
 * Protección de `mensaje_de_pedido` contra PostgreSQL real.
 *
 * Los mensajes de un pedido son evidencia: no se borran ni se editan. Lo único
 * que admite la base es marcar `corregido_por_id` de NULL a un valor. Esto lo
 * garantizan disparadores, así que se prueba contra la base y no contra un doble.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const USUARIO = '00000000-0000-4000-8000-000000000001';
const PEDIDO = '00000000-0000-4000-8000-000000000002';
const MENSAJE = '00000000-0000-4000-8000-000000000003';
const MENSAJE_NUEVO = '00000000-0000-4000-8000-000000000004';

describeSiHayBase('mensaje de pedido contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;

  beforeAll(async () => {
    entorno = await crearEntorno();
    const { prisma } = entorno;
    await prisma.$executeRawUnsafe(
      `INSERT INTO usuario (id, nombre, apellido, email, rol, hash_contrasena, actualizado_en)
       VALUES ('${USUARIO}', 'Ana', 'Prueba', 'ana@prueba.test', 'responsable', 'x', now())`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO pedido_del_equipo (id, solicitante_usuario_id, destinatario_usuario_ids, asunto, creado_por_usuario_id, actualizado_en)
       VALUES ('${PEDIDO}', '${USUARIO}', ARRAY['${USUARIO}']::uuid[], 'Pedido', '${USUARIO}', now())`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO mensaje_de_pedido (id, pedido_id, autor_usuario_id, canal, ocurrido_en, texto, registrado_por_usuario_id)
       VALUES ('${MENSAJE}', '${PEDIDO}', '${USUARIO}', 'MENSAJE', now(), 'Hola', '${USUARIO}')`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO mensaje_de_pedido (id, pedido_id, autor_usuario_id, canal, ocurrido_en, texto, registrado_por_usuario_id)
       VALUES ('${MENSAJE_NUEVO}', '${PEDIDO}', '${USUARIO}', 'MENSAJE', now(), 'Hola corregido', '${USUARIO}')`,
    );
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  });

  it('rechaza editar el texto', async () => {
    await expect(
      entorno.prisma.$executeRawUnsafe(
        `UPDATE mensaje_de_pedido SET texto = 'otro' WHERE id = '${MENSAJE}'`,
      ),
    ).rejects.toThrow(/solo agregar/);
  });

  it('rechaza borrar', async () => {
    await expect(
      entorno.prisma.$executeRawUnsafe(`DELETE FROM mensaje_de_pedido WHERE id = '${MENSAJE}'`),
    ).rejects.toThrow(/no se borra/);
  });

  it('rechaza cambiar corregido_por_id y otra columna a la vez', async () => {
    await expect(
      entorno.prisma.$executeRawUnsafe(
        `UPDATE mensaje_de_pedido SET corregido_por_id = '${MENSAJE_NUEVO}', nota_interna = true WHERE id = '${MENSAJE}'`,
      ),
    ).rejects.toThrow(/solo agregar/);
  });

  it('admite marcar corregido_por_id de NULL a un valor, una sola vez', async () => {
    await entorno.prisma.$executeRawUnsafe(
      `UPDATE mensaje_de_pedido SET corregido_por_id = '${MENSAJE_NUEVO}' WHERE id = '${MENSAJE}'`,
    );
    await expect(
      entorno.prisma.$executeRawUnsafe(
        `UPDATE mensaje_de_pedido SET corregido_por_id = '${MENSAJE}' WHERE id = '${MENSAJE}'`,
      ),
    ).rejects.toThrow(/solo agregar/);
  });
});
