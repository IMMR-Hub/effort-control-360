/**
 * Generación de vencimientos desde el calendario tributario.
 *
 * Lo que se prueba acá no es la aritmética de la fecha — eso vive en
 * `@effort/core` y tiene sus propios tests — sino las decisiones del generador:
 * a quién le corresponde, qué pasa al repetir la operación, y qué hace cuando
 * un dato está mal cargado.
 */

import { describe, expect, it } from 'vitest';

import { generarVencimientosDelPeriodo } from '../src/servicios/generadorDeVencimientos.js';
import type { ObligacionAlmacenada } from '../src/puertos-dominio.js';
import { ClientesFalsos, clienteMinimo } from './dobles.js';
import { ObligacionesFalsas, VencimientosFalsos } from './dobles-dominio.js';

const FUMIPRO = '11111111-1111-4111-8111-111111111111';
const SIPAR = '22222222-2222-4222-8222-222222222222';
const USUARIO = 'usr-direccion';

const IVA: ObligacionAlmacenada = {
  id: 'obl-iva',
  codigo: 'IVA_GENERAL',
  nombre: 'IVA General',
  entidad: 'DNIT',
  formulario: '120',
  periodicidad: 'MENSUAL',
  mesDeCierreAnual: null,
  diasPorTerminacionRuc: [7, 9, 11, 13, 15, 17, 19, 21, 23, 25],
  confirmadaPorEffort: true,
  activa: true,
  fuente: 'Calendario de prueba',
};

function armar() {
  const clientes = new ClientesFalsos();
  const obligaciones = new ObligacionesFalsas();
  const vencimientos = new VencimientosFalsos();

  clientes.clientes.push(
    // Termina en 1 → día 9; termina en 2 → día 11.
    clienteMinimo({ id: FUMIPRO, nombre: 'FUMIPRO S.A.', ruc: '80119631-0', activo: true }),
    clienteMinimo({ id: SIPAR, nombre: 'SIPAR S.A.', ruc: '80012742-0', activo: true }),
  );

  obligaciones.obligaciones.push(IVA);
  obligaciones.asignaciones.push(
    { id: 'a1', clienteId: FUMIPRO, obligacionId: 'obl-iva', desde: new Date('2026-01-01'), hasta: null },
    { id: 'a2', clienteId: SIPAR, obligacionId: 'obl-iva', desde: new Date('2026-01-01'), hasta: null },
  );

  return { clientes, obligaciones, vencimientos };
}

describe('generador de vencimientos', () => {
  it('genera uno por cliente obligado, con la fecha que le toca a su RUC', async () => {
    const deps = armar();

    const resumen = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(resumen.creados).toBe(2);
    expect(resumen.omitidos).toEqual([]);

    const porCliente = new Map(deps.vencimientos.vencimientos.map((v) => [v.clienteId, v]));
    // Terminación 1 → día 9 de abril de 2026 (jueves, hábil).
    expect(porCliente.get(FUMIPRO)!.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-04-09');
    // Terminación 2 → día 11, que cae sábado: corre al lunes 13.
    expect(porCliente.get(SIPAR)!.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-04-13');
  });

  it('volver a generar el mismo período no duplica nada', async () => {
    const deps = armar();

    await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);
    const segunda = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(segunda.creados).toBe(0);
    expect(segunda.yaExistian).toBe(2);
    expect(deps.vencimientos.vencimientos).toHaveLength(2);
  });

  it('una obligación que EFFORT todavía no confirmó no genera ni un aviso', async () => {
    const deps = armar();
    deps.obligaciones.obligaciones[0] = { ...IVA, confirmadaPorEffort: false };

    const resumen = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(resumen.creados).toBe(0);
    expect(deps.vencimientos.vencimientos).toHaveLength(0);
  });

  it('no genera para un cliente dado de baja, y lo dice', async () => {
    const deps = armar();
    deps.clientes.clientes[1] = clienteMinimo({
      id: SIPAR, nombre: 'SIPAR S.A.', ruc: '80012742-0', activo: false,
    });

    const resumen = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(resumen.creados).toBe(1);
    expect(resumen.omitidos).toHaveLength(1);
    expect(resumen.omitidos[0]!.motivo).toMatch(/baja/i);
  });

  it('no genera un período anterior al alta de la obligación', async () => {
    const deps = armar();
    deps.obligaciones.asignaciones[0] = {
      id: 'a1', clienteId: FUMIPRO, obligacionId: 'obl-iva',
      desde: new Date('2026-05-01'), hasta: null,
    };

    const resumen = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(resumen.creados).toBe(1);
    expect(deps.vencimientos.vencimientos[0]!.clienteId).toBe(SIPAR);
  });

  it('lo anual se genera al cerrar el ejercicio, no todos los meses', async () => {
    const deps = armar();
    deps.obligaciones.obligaciones[0] = {
      ...IVA, codigo: 'IRE_ANUAL', periodicidad: 'ANUAL', mesDeCierreAnual: 4,
    };

    const enMarzo = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);
    expect(enMarzo.creados).toBe(0);

    const enDiciembre = await generarVencimientosDelPeriodo(deps, '2026-12', USUARIO);
    expect(enDiciembre.creados).toBe(2);
  });

  // Un RUC ilegible es un dato mal cargado de UN cliente. Si frenara toda la
  // generación, un error de tipeo dejaría a los otros cuatro clientes sin sus
  // vencimientos y nadie se enteraría hasta que venciera algo.
  it('un RUC ilegible frena solo a ese cliente y queda reportado', async () => {
    const deps = armar();
    deps.clientes.clientes[0] = clienteMinimo({
      id: FUMIPRO, nombre: 'FUMIPRO S.A.', ruc: 'sin-numero', activo: true,
    });

    const resumen = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(resumen.creados).toBe(1);
    expect(resumen.omitidos).toHaveLength(1);
    expect(resumen.omitidos[0]!.cliente).toBe('FUMIPRO S.A.');
    expect(deps.vencimientos.vencimientos[0]!.clienteId).toBe(SIPAR);
  });

  it('un calendario incompleto no genera fechas inventadas', async () => {
    const deps = armar();
    deps.obligaciones.obligaciones[0] = { ...IVA, diasPorTerminacionRuc: [7, 9, 11] };

    const resumen = await generarVencimientosDelPeriodo(deps, '2026-03', USUARIO);

    expect(resumen.creados).toBe(0);
    expect(resumen.omitidos).toHaveLength(2);
    expect(resumen.omitidos[0]!.motivo).toMatch(/10 días/);
  });
});
