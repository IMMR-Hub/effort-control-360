/**
 * Hallazgos del libro RG 90 contra PostgreSQL real.
 *
 * Existe por un bug que los dobles no podían ver: en PostgreSQL dos NULL no son
 * iguales para un índice único, así que los hallazgos sin tasa se duplicaban en
 * cada corrida del programador. El 2026-09-14 había 2.069 filas para 152
 * comprobantes. Un doble en memoria compara `null === null` y da verdadero —
 * justo lo contrario de la base.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gs } from '@effort/core';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';
import { LibroRg90Prisma } from '../../src/repositorios/libroRg90.js';
import type { AltaDeHallazgo } from '../../src/servicios/liquidacionDeIva.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('libro RG 90 contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let libro: LibroRg90Prisma;
  let clienteId = '';
  let usuarioId = '';

  function hallazgo(parcial: Partial<AltaDeHallazgo> = {}): AltaDeHallazgo {
    return {
      clienteId,
      periodo: '2026-03',
      tipo: 'IVA_DECLARADO_NO_COINCIDE',
      riesgo: 'CREDITO_DE_MAS',
      tipoRegistro: 'COMPRAS',
      numeroComprobante: '001-001-0000028',
      contraparte: 'AGROSOL PARAGUAY SOCIEDAD ANONIMA',
      tasa: '10%',
      declarado: gs(140739),
      calculado: gs(140727),
      diferencia: 12n,
      detalle: 'Se estaría tomando crédito fiscal de más.',
      ...parcial,
    } as AltaDeHallazgo;
  }

  beforeAll(async () => {
    entorno = await crearEntorno();
    libro = new LibroRg90Prisma(entorno.prisma);

    const cliente = await entorno.prisma.cliente.create({
      data: { nombre: 'ECOAGRO SA', ruc: '80022319-5', tipoPersona: 'JURIDICA' },
    });
    clienteId = cliente.id;

    const usuario = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Lili', apellido: 'Laconich', email: 'lili@effort.com.py',
        rol: 'direccion', hashContrasena: '$argon2id$prueba', veTodosLosClientes: true,
      },
    });
    usuarioId = usuario.id;

    await libro.guardarLiquidacion({
      clienteId,
      periodo: '2026-03',
      creditoFiscal: gs(0), debitoFiscal: gs(0), saldoAPagar: gs(0), saldoAFavor: gs(0),
      comprobantesCompras: 1, comprobantesVentas: 0,
      gravado10Compras: gs(0), gravado5Compras: gs(0), exentoCompras: gs(0),
      gravado10Ventas: gs(0), gravado5Ventas: gs(0), exentoVentas: gs(0),
      archivosLeidos: 1, filasRechazadas: 0, calculadoPorUsuarioId: null,
    } as Parameters<LibroRg90Prisma['guardarLiquidacion']>[0]);
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  }, 60_000);

  it('un hallazgo sin tasa no se duplica al guardarlo dos veces', async () => {
    const sinTasa = hallazgo({
      tipo: 'PARTES_NO_SUMAN_EL_TOTAL',
      riesgo: 'INCONSISTENCIA',
      tasa: null,
      numeroComprobante: '087-005-0337754',
      contraparte: 'LA BOLSA SRL',
    });

    expect(await libro.guardarHallazgos([sinTasa])).toBe(1);
    // La segunda corrida del programador: antes insertaba otra fila igual.
    expect(await libro.guardarHallazgos([sinTasa])).toBe(0);

    const filas = await entorno.prisma.hallazgoDeLibroRg90.count({
      where: { clienteId, numeroComprobante: '087-005-0337754' },
    });
    expect(filas).toBe(1);
  });

  it('un guaraní de crédito de más alerta, y deja de alertar cuando alguien lo acepta con motivo', async () => {
    await libro.guardarHallazgos([hallazgo({ diferencia: 1n, declarado: gs(140728) })]);

    const antes = await libro.riesgoPorPeriodo();
    expect(antes.find((r) => r.clienteId === clienteId)?.comprobantes).toBe(1);

    const [pendiente] = await libro.hallazgos({ clienteId, soloRiesgo: true });
    expect(pendiente).toBeDefined();

    // En revisión sigue alertando: mirarlo no es resolverlo.
    await libro.decidirHallazgo({
      id: pendiente!.id, estado: 'EN_REVISION', nota: null, usuarioId, ahora: new Date(),
    });
    expect((await libro.riesgoPorPeriodo()).find((r) => r.clienteId === clienteId)?.comprobantes).toBe(1);

    await libro.decidirHallazgo({
      id: pendiente!.id, estado: 'ACEPTADO', nota: 'Redondeo del proveedor', usuarioId, ahora: new Date(),
    });
    expect((await libro.riesgoPorPeriodo()).find((r) => r.clienteId === clienteId)).toBeUndefined();

    // Aceptado no desaparece: se ve al pedir todos, con el motivo.
    const todos = await libro.hallazgos({ clienteId });
    const aceptado = todos.find((h) => h.id === pendiente!.id);
    expect(aceptado?.estado).toBe('ACEPTADO');
    expect(aceptado?.notaDecision).toBe('Redondeo del proveedor');
  });

  it('la base rechaza un hallazgo aceptado sin motivo, aunque alguien saltee la API', async () => {
    const [cualquiera] = await libro.hallazgos({ clienteId });

    await expect(
      entorno.prisma.hallazgoDeLibroRg90.update({
        where: { id: cualquiera!.id },
        data: { estado: 'ACEPTADO', notaDecision: null, decididoPorUsuarioId: usuarioId },
      }),
    ).rejects.toThrow();
  });
});
