/**
 * Prioridad y bandeja de pendientes de las solicitudes, contra PostgreSQL real.
 *
 * Lo que un doble no detecta: que `recordar_el` (DATE) vuelva como el mismo
 * 'AAAA-MM-DD' sin correrse un día, que `null` lo limpie, que una clave omitida
 * no se toque, y que `listarPendientes` combine estados, períodos y cartera en
 * una sola consulta sin que una condición pise a la otra.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SolicitudesPrisma } from '../../src/repositorios/dominio.js';
import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('solicitudes: prioridad y pendientes contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let repo: SolicitudesPrisma;
  let usuario = '';
  let mio = '';
  let ajeno = '';

  async function sembrar(clienteId: string, periodo: string, estado: string) {
    const sol = await repo.registrar({
      clienteId, periodo, cuentaDesde: new Date('2026-11-01T00:00:00Z'), reglaId: null,
    });
    await entorno.prisma.solicitudDocumentacion.update({
      where: { id: sol.id },
      data: { estado: estado as never },
    });
    return sol.id;
  }

  beforeAll(async () => {
    entorno = await crearEntorno();
    repo = new SolicitudesPrisma(entorno.prisma);
    usuario = (await entorno.prisma.usuario.create({
      data: { nombre: 'Laura', apellido: 'Prueba', email: 'laura@prueba.test', rol: 'direccion', hashContrasena: 'x' },
    })).id;
    mio = (await entorno.prisma.cliente.create({
      data: { nombre: 'GARSO S.A.', ruc: '80017726-6', tipoPersona: 'JURIDICA' },
    })).id;
    ajeno = (await entorno.prisma.cliente.create({
      data: { nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', tipoPersona: 'JURIDICA' },
    })).id;
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  }, 60_000);

  it('una solicitud nueva nace con prioridad MEDIA, sin recordatorio y con creadoEn', async () => {
    const sol = await repo.registrar({
      clienteId: mio, periodo: '2026-01', cuentaDesde: new Date('2026-02-01T00:00:00Z'), reglaId: null,
    });
    expect(sol.prioridad).toBe('MEDIA');
    expect(sol.recordarEl).toBeNull();
    expect(sol.creadoEn).toBeInstanceOf(Date);
  });

  it('listarPendientes trae los 4 estados pendientes de varios períodos y deja afuera ENTREGADA y CERRADA_MANUALMENTE', async () => {
    const abierta = await sembrar(mio, '2026-02', 'ABIERTA');
    const respondida = await sembrar(mio, '2026-03', 'RESPONDIDA_SIN_ENTREGA');
    const escalada = await sembrar(mio, '2026-04', 'ESCALADA');
    const agotada = await sembrar(mio, '2026-05', 'AGOTADA');
    const entregada = await sembrar(mio, '2026-06', 'ENTREGADA');
    const cerrada = await sembrar(mio, '2026-07', 'CERRADA_MANUALMENTE');

    const ids = (await repo.listarPendientes(null)).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([abierta, respondida, escalada, agotada]));
    expect(ids).not.toContain(entregada);
    expect(ids).not.toContain(cerrada);
  });

  it('listarPendientes respeta la cartera: con filtro solo ve los clientes asignados', async () => {
    const delAjeno = await sembrar(ajeno, '2026-02', 'ABIERTA');
    const delMio = await sembrar(mio, '2026-08', 'ABIERTA');

    const conFiltro = await repo.listarPendientes([mio]);
    expect(conFiltro.map((s) => s.id)).toContain(delMio);
    expect(conFiltro.map((s) => s.id)).not.toContain(delAjeno);
    expect(conFiltro.every((s) => s.clienteId === mio)).toBe(true);

    expect(await repo.listarPendientes([])).toEqual([]);
    expect((await repo.listarPendientes(null)).map((s) => s.id)).toContain(delAjeno);
  });

  it('cambiarPrioridad guarda recordarEl sin correr el día, null lo limpia y una clave omitida no se toca', async () => {
    const id = await sembrar(mio, '2026-09', 'ABIERTA');

    const uno = await repo.cambiarPrioridad(id, { prioridad: 'CRITICA', recordarEl: '2026-12-24' }, usuario);
    expect(uno).toMatchObject({ prioridad: 'CRITICA', recordarEl: '2026-12-24' });
    expect(await repo.buscarPorId(id, null)).toMatchObject({ prioridad: 'CRITICA', recordarEl: '2026-12-24' });

    const dos = await repo.cambiarPrioridad(id, { prioridad: 'BAJA' }, usuario);
    expect(dos).toMatchObject({ prioridad: 'BAJA', recordarEl: '2026-12-24' });

    const tres = await repo.cambiarPrioridad(id, { recordarEl: null }, usuario);
    expect(tres).toMatchObject({ prioridad: 'BAJA', recordarEl: null });

    const enero = await repo.cambiarPrioridad(id, { recordarEl: '2027-01-01' }, usuario);
    expect(enero.recordarEl).toBe('2027-01-01');

    const fila = await entorno.prisma.solicitudDocumentacion.findUniqueOrThrow({ where: { id } });
    expect(fila.estado).toBe('ABIERTA');
    expect(fila.actualizadoPorUsuarioId).toBe(usuario);
  });
});
