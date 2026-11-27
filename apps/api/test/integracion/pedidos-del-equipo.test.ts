/**
 * Repositorio de pedidos del equipo contra PostgreSQL real.
 *
 * Lo que se prueba acá no se puede probar con un doble: el filtro por alcance
 * (un colaborador no ve pedidos ajenos ni notas internas), la transacción de
 * pedido + primer mensaje, los disparadores que impiden borrar o editar un
 * mensaje, y la corrección con `corregido_por_id`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PedidosDelEquipoPrisma } from '../../src/repositorios/pedidosDelEquipo.js';
import { ErrorDeAplicacion } from '../../src/servidor.js';
import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const ANA = '00000000-0000-4000-8000-0000000000a1';
const BETO = '00000000-0000-4000-8000-0000000000b2';
const LAURA = '00000000-0000-4000-8000-0000000000d3';

const ALCANCE_DIRECCION = { todo: true } as const;

describeSiHayBase('pedidos del equipo contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let repo: PedidosDelEquipoPrisma;

  async function crearPedido(solicitante: string, asunto: string, recordarEl: string | null = null) {
    return repo.crear({
      solicitanteUsuarioId: solicitante,
      destinatarioUsuarioIds: [LAURA],
      clienteId: null,
      asunto,
      prioridad: 'ALTA',
      recordarEl,
      primerMensaje: { canal: 'PRESENCIAL', ocurridoEn: new Date('2026-11-27T12:00:00Z'), texto: `Texto de ${asunto}` },
      registradoPorUsuarioId: solicitante,
    });
  }

  beforeAll(async () => {
    entorno = await crearEntorno();
    repo = new PedidosDelEquipoPrisma(entorno.prisma);
    for (const [id, nombre, email, rol] of [
      [ANA, 'Ana', 'ana@prueba.test', 'responsable'],
      [BETO, 'Beto', 'beto@prueba.test', 'responsable'],
      [LAURA, 'Laura', 'laura@prueba.test', 'direccion'],
    ] as const) {
      await entorno.prisma.$executeRawUnsafe(
        `INSERT INTO usuario (id, nombre, apellido, email, rol, hash_contrasena, actualizado_en)
         VALUES ('${id}', '${nombre}', 'Prueba', '${email}', '${rol}', 'x', now())`,
      );
    }
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  });

  it('crea el pedido y su primer mensaje juntos', async () => {
    const pedido = await crearPedido(ANA, 'Pedido de alta', '2026-12-05');

    expect(pedido.estado).toBe('ABIERTO');
    expect(pedido.recordarEl).toBe('2026-12-05');
    expect(pedido.destinatarioUsuarioIds).toEqual([LAURA]);

    const encontrado = await repo.buscar(pedido.id, ALCANCE_DIRECCION);
    expect(encontrado?.mensajes).toHaveLength(1);
    expect(encontrado?.mensajes[0]?.texto).toBe('Texto de Pedido de alta');
    expect(encontrado?.mensajes[0]?.canal).toBe('PRESENCIAL');
  });

  it('un colaborador solo ve sus pedidos', async () => {
    const deAna = await crearPedido(ANA, 'Pedido visible de Ana');
    const deBeto = await crearPedido(BETO, 'Pedido reservado de Beto');

    const vistosPorAna = await repo.listar({ soloDe: ANA }, {});
    const ids = vistosPorAna.map((p) => p.id);
    expect(ids).toContain(deAna.id);
    expect(ids).not.toContain(deBeto.id);

    const vistosPorDireccion = (await repo.listar(ALCANCE_DIRECCION, {})).map((p) => p.id);
    expect(vistosPorDireccion).toEqual(expect.arrayContaining([deAna.id, deBeto.id]));
  });

  it('listar filtra por estados y ordena del más nuevo al más viejo', async () => {
    const primero = await crearPedido(ANA, 'Orden 1');
    await new Promise((r) => setTimeout(r, 15));
    const segundo = await crearPedido(ANA, 'Orden 2');
    await repo.cambiar(primero.id, { estado: 'RESUELTO' }, LAURA);

    const todos = (await repo.listar({ soloDe: ANA }, {})).map((p) => p.id);
    expect(todos.indexOf(segundo.id)).toBeLessThan(todos.indexOf(primero.id));

    const abiertos = (await repo.listar({ soloDe: ANA }, { estados: ['ABIERTO', 'EN_CURSO'] })).map(
      (p) => p.id,
    );
    expect(abiertos).toContain(segundo.id);
    expect(abiertos).not.toContain(primero.id);
  });

  it('un colaborador no ve las notas internas de su pedido', async () => {
    const pedido = await crearPedido(ANA, 'Con nota interna');
    await repo.agregarMensaje(pedido.id, {
      autorUsuarioId: LAURA,
      canal: 'MENSAJE',
      ocurridoEn: new Date('2026-11-27T13:00:00Z'),
      texto: 'Nota solo para dirección',
      notaInterna: true,
      registradoPorUsuarioId: LAURA,
    });
    await repo.agregarMensaje(pedido.id, {
      autorUsuarioId: LAURA,
      canal: 'MENSAJE',
      ocurridoEn: new Date('2026-11-27T14:00:00Z'),
      texto: 'Respuesta pública',
      notaInterna: false,
      registradoPorUsuarioId: LAURA,
    });

    const paraAna = await repo.buscar(pedido.id, { soloDe: ANA });
    expect(paraAna?.mensajes.map((m) => m.texto)).toEqual([
      'Texto de Con nota interna',
      'Respuesta pública',
    ]);

    const paraDireccion = await repo.buscar(pedido.id, ALCANCE_DIRECCION);
    // Del más viejo al más nuevo.
    expect(paraDireccion?.mensajes.map((m) => m.texto)).toEqual([
      'Texto de Con nota interna',
      'Nota solo para dirección',
      'Respuesta pública',
    ]);
  });

  it('buscar un pedido ajeno con soloDe devuelve null', async () => {
    const deBeto = await crearPedido(BETO, 'Ajeno para Ana');
    expect(await repo.buscar(deBeto.id, { soloDe: ANA })).toBeNull();
    expect(await repo.buscar(deBeto.id, { soloDe: BETO })).not.toBeNull();
    expect(
      await repo.buscar('00000000-0000-4000-8000-0000000000ff', ALCANCE_DIRECCION),
    ).toBeNull();
  });

  it('cambiar registra quién lo hizo, la fecha de derivación y convierte recordarEl', async () => {
    const pedido = await crearPedido(ANA, 'Para cambiar');
    const antes = Date.now();
    const cambiado = await repo.cambiar(
      pedido.id,
      { prioridad: 'CRITICA', derivadoASoporte: true, recordarEl: '2026-12-24', estado: 'EN_CURSO' },
      LAURA,
    );
    expect(cambiado.prioridad).toBe('CRITICA');
    expect(cambiado.estado).toBe('EN_CURSO');
    expect(cambiado.recordarEl).toBe('2026-12-24');
    expect(cambiado.derivadoASoporte).toBe(true);
    expect(cambiado.derivadoASoporteEn).not.toBeNull();
    expect(cambiado.derivadoASoporteEn!.getTime()).toBeGreaterThanOrEqual(antes - 1000);

    const fila = await entorno.prisma.pedidoDelEquipo.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(fila.actualizadoPorUsuarioId).toBe(LAURA);

    const sinFecha = await repo.cambiar(pedido.id, { recordarEl: null, motivoDeCancelacion: null }, LAURA);
    expect(sinFecha.recordarEl).toBeNull();

    const derivados = (await repo.listarDerivadosASoporte()).map((p) => p.id);
    expect(derivados).toContain(pedido.id);
  });

  it('la base rechaza borrar un mensaje', async () => {
    const pedido = await crearPedido(ANA, 'Mensaje indeleble');
    const { mensajes } = (await repo.buscar(pedido.id, ALCANCE_DIRECCION))!;
    const id = mensajes[0]!.id;
    await expect(
      entorno.prisma.$executeRaw`DELETE FROM mensaje_de_pedido WHERE id = ${id}::uuid`,
    ).rejects.toThrow();
  });

  it('corregir un mensaje crea uno nuevo y marca el viejo', async () => {
    const pedido = await crearPedido(ANA, 'Con corrección');
    const original = (await repo.buscar(pedido.id, ALCANCE_DIRECCION))!.mensajes[0]!;

    const nuevo = await repo.corregirMensaje(original.id, {
      autorUsuarioId: ANA,
      canal: 'PRESENCIAL',
      ocurridoEn: original.ocurridoEn,
      texto: 'Texto corregido',
      notaInterna: false,
      registradoPorUsuarioId: LAURA,
    });
    expect(nuevo.pedidoId).toBe(pedido.id);
    expect(nuevo.corregidoPorId).toBeNull();

    const mensajes = (await repo.buscar(pedido.id, ALCANCE_DIRECCION))!.mensajes;
    expect(mensajes).toHaveLength(2);
    expect(mensajes.find((m) => m.id === original.id)?.corregidoPorId).toBe(nuevo.id);
    expect(mensajes.find((m) => m.id === original.id)?.texto).toBe('Texto de Con corrección');
  });

  it('corregir dos veces el mismo mensaje falla', async () => {
    const pedido = await crearPedido(ANA, 'Doble corrección');
    const original = (await repo.buscar(pedido.id, ALCANCE_DIRECCION))!.mensajes[0]!;
    const datos = {
      autorUsuarioId: ANA,
      canal: 'PRESENCIAL',
      ocurridoEn: original.ocurridoEn,
      texto: 'Corrección',
      notaInterna: false,
      registradoPorUsuarioId: LAURA,
    };
    await repo.corregirMensaje(original.id, datos);

    const segundo = repo.corregirMensaje(original.id, { ...datos, texto: 'Otra corrección' });
    await expect(segundo).rejects.toBeInstanceOf(ErrorDeAplicacion);
    await expect(segundo).rejects.toMatchObject({
      codigoHttp: 409,
      codigo: 'ya_corregido',
      message: 'Ese mensaje ya fue corregido.',
    });

    // El intento fallido no dejó un mensaje huérfano: la transacción se deshizo.
    expect((await repo.buscar(pedido.id, ALCANCE_DIRECCION))!.mensajes).toHaveLength(2);
  });

  it('como rol de la aplicación: inserta, marca corregido_por_id y no puede borrar', async (contexto) => {
    const { prisma } = entorno;
    const rol = await prisma.$queryRawUnsafe<{ rolname: string }[]>(
      `SELECT rolname FROM pg_roles WHERE rolname = 'effort_app'`,
    );
    if (rol.length === 0) {
      contexto.skip('el rol effort_app no existe en esta base de pruebas');
      return;
    }

    const pedido = await crearPedido(ANA, 'Como rol de la aplicación');
    const original = (await repo.buscar(pedido.id, ALCANCE_DIRECCION))!.mensajes[0]!;
    const nuevoId = '00000000-0000-4000-8000-0000000000c4';

    const comoApp = async (sentencias: readonly string[]): Promise<void> => {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA "${entorno.esquema}" TO effort_app`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE effort_app`);
        for (const sentencia of sentencias) await tx.$executeRawUnsafe(sentencia);
      });
    };

    try {
      await comoApp([`SELECT 1 FROM mensaje_de_pedido LIMIT 1`]);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      if (/permission denied to set role|must be member/i.test(mensaje)) {
        contexto.skip('el usuario de la prueba no puede hacer SET ROLE effort_app');
        return;
      }
      throw error;
    }

    await comoApp([
      `INSERT INTO mensaje_de_pedido (id, pedido_id, autor_usuario_id, canal, ocurrido_en, texto, registrado_por_usuario_id)
       VALUES ('${nuevoId}', '${pedido.id}', '${ANA}', 'MENSAJE', now(), 'Insertado por la app', '${ANA}')`,
      `UPDATE mensaje_de_pedido SET corregido_por_id = '${nuevoId}' WHERE id = '${original.id}'`,
    ]);

    const mensajes = (await repo.buscar(pedido.id, ALCANCE_DIRECCION))!.mensajes;
    expect(mensajes.find((m) => m.id === original.id)?.corregidoPorId).toBe(nuevoId);

    await expect(
      comoApp([`DELETE FROM mensaje_de_pedido WHERE id = '${nuevoId}'`]),
    ).rejects.toThrow();
    await expect(
      comoApp([`UPDATE mensaje_de_pedido SET texto = 'editado' WHERE id = '${nuevoId}'`]),
    ).rejects.toThrow();
  }, 60_000);
});
