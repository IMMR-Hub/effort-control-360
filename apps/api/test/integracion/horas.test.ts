/**
 * Planilla de horas (tarea 144) contra PostgreSQL real.
 *
 * Lo que el doble en memoria no puede probar: que el índice único
 * `(usuario_id, cliente_id, fecha)` de verdad haga upsert en vez de
 * duplicar, y que Postgres trate dos filas de tiempo interno (`cliente_id`
 * NULL) el mismo día como NO colisionantes — es el comportamiento real de
 * NULL en un índice único, documentado en el comentario de la migración, y
 * solo la base real lo puede confirmar.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';
import { HorasPrisma } from '../../src/repositorios/horas.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('planilla de horas contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let horas: HorasPrisma;
  let idResponsable = '';
  let idOtroResponsable = '';
  let idCliente = '';
  let idOtroCliente = '';

  beforeAll(async () => {
    entorno = await crearEntorno();
    horas = new HorasPrisma(entorno.prisma);

    const responsable = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Ana', apellido: 'Martínez', email: 'ana@effort.com.py',
        rol: 'responsable', hashContrasena: '$argon2id$prueba', veTodosLosClientes: false,
      },
    });
    idResponsable = responsable.id;

    const otroResponsable = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Sandra', apellido: 'Ferreira', email: 'sandra@effort.com.py',
        rol: 'responsable', hashContrasena: '$argon2id$prueba', veTodosLosClientes: false,
      },
    });
    idOtroResponsable = otroResponsable.id;

    const cliente = await entorno.prisma.cliente.create({
      data: { nombre: 'GARSO S.A.', ruc: '80017726-6', tipoPersona: 'JURIDICA' },
    });
    idCliente = cliente.id;

    const otroCliente = await entorno.prisma.cliente.create({
      data: { nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', tipoPersona: 'JURIDICA' },
    });
    idOtroCliente = otroCliente.id;
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  }, 60_000);

  it('cargar el mismo (usuario, cliente, día) otra vez corrige, no duplica', async () => {
    const fecha = new Date('2026-09-20T00:00:00.000Z');

    await horas.registrar({ usuarioId: idResponsable, clienteId: idCliente, fecha, minutos: 60, tarea: null });
    const corregido = await horas.registrar({
      usuarioId: idResponsable, clienteId: idCliente, fecha, minutos: 90, tarea: 'corregido',
    });

    const propios = await horas.listarPropios(idResponsable, fecha, fecha);
    expect(propios).toHaveLength(1);
    expect(propios[0]!.minutos).toBe(90);
    expect(corregido.minutos).toBe(90);
  });

  it('el tiempo interno también corrige, no duplica: mismo criterio que un cliente real', async () => {
    // La base sola dejaría pasar dos filas con `cliente_id` NULL el mismo día
    // (Postgres nunca compara NULL como igual a NULL en un índice único), pero
    // `registrar` busca por `clienteId: null` con `findFirst` antes de decidir
    // si crea o actualiza — un WHERE normal sí trata NULL como NULL — así que
    // en la práctica el tiempo interno se comporta exactamente como un
    // cliente: un registro por día, que la segunda carga corrige.
    const fecha = new Date('2026-09-21T00:00:00.000Z');

    await horas.registrar({ usuarioId: idOtroResponsable, clienteId: null, fecha, minutos: 30, tarea: 'reunión' });
    await horas.registrar({ usuarioId: idOtroResponsable, clienteId: null, fecha, minutos: 20, tarea: 'capacitación' });

    const propios = await horas.listarPropios(idOtroResponsable, fecha, fecha);
    expect(propios).toHaveLength(1);
    expect(propios[0]!.minutos).toBe(20);
  });

  it('el resumen agrega por usuario y cliente, y respeta el filtro de cartera salvo para el tiempo interno', async () => {
    const fecha = new Date('2026-09-22T00:00:00.000Z');

    await horas.registrar({ usuarioId: idResponsable, clienteId: idCliente, fecha, minutos: 45, tarea: null });
    await horas.registrar({ usuarioId: idResponsable, clienteId: idOtroCliente, fecha, minutos: 15, tarea: null });
    await horas.registrar({ usuarioId: idResponsable, clienteId: null, fecha, minutos: 10, tarea: null });

    const totales = await horas.resumen(fecha, fecha, [idCliente]);

    expect(totales).toContainEqual({ usuarioId: idResponsable, clienteId: idCliente, minutos: 45 });
    // El cliente fuera de la cartera filtrada no aparece...
    expect(totales.find((t) => t.clienteId === idOtroCliente)).toBeUndefined();
    // ...pero el tiempo interno sí, porque no es un cliente sobre el que haya cartera que filtrar.
    expect(totales).toContainEqual({ usuarioId: idResponsable, clienteId: null, minutos: 10 });
  });
});
