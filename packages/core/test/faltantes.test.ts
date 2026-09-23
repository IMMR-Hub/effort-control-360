import { describe, expect, it } from 'vitest';

import {
  armarListaDeFaltantes,
  type LiquidacionRg90Resumen,
  type VencimientoVencidoFaltante,
} from '../src/index.js';

function vencimiento(parcial: Partial<VencimientoVencidoFaltante>): VencimientoVencidoFaltante {
  return {
    id: 'venc-1',
    clienteId: 'copesa',
    clienteNombre: 'COPESA CONSTRUCCIONES SA',
    periodo: '2026-07',
    tipoDocumento: 'IVA_GENERAL',
    descripcion: 'IVA General — período 2026-07',
    fechaVencimiento: '2026-08-12',
    diasDeAtraso: 42,
    ...parcial,
  };
}

function liquidacion(parcial: Partial<LiquidacionRg90Resumen>): LiquidacionRg90Resumen {
  return {
    clienteId: 'copesa',
    periodo: '2026-07',
    comprobantesCompras: 10,
    comprobantesVentas: 8,
    ...parcial,
  };
}

describe('armarListaDeFaltantes', () => {
  it('agrupa por cliente y período, no por vencimiento', () => {
    const lista = armarListaDeFaltantes(
      [
        vencimiento({ id: 'v1', tipoDocumento: 'IVA_GENERAL' }),
        vencimiento({ id: 'v2', tipoDocumento: 'PLANILLA_RG90' }),
      ],
      [liquidacion({})],
    );

    expect(lista).toHaveLength(1);
    expect(lista[0]!.obligaciones).toHaveLength(2);
    expect(lista[0]!.obligaciones.map((o) => o.id)).toEqual(['v1', 'v2']);
  });

  it('descarta un vencimiento sin período: no hay con qué agruparlo', () => {
    const lista = armarListaDeFaltantes(
      [vencimiento({ periodo: null })],
      [],
    );

    expect(lista).toEqual([]);
  });

  it('EEFF e IRE no exigen planilla RG 90 — NO_APLICA aunque no haya liquidación', () => {
    const lista = armarListaDeFaltantes(
      [
        vencimiento({
          tipoDocumento: 'EEFF',
          descripcion: 'Estados Financieros — período 2025-12',
          periodo: '2025-12',
        }),
      ],
      [],
    );

    expect(lista[0]!.estadoPlanillaRg90).toBe('NO_APLICA');
  });

  it('IVA_GENERAL sin ninguna liquidación cargada: SIN_LIQUIDACION', () => {
    const lista = armarListaDeFaltantes([vencimiento({})], []);

    expect(lista[0]!.estadoPlanillaRg90).toBe('SIN_LIQUIDACION');
  });

  it('con liquidación pero comprobantes de compras en cero: FALTA_COMPRAS', () => {
    const lista = armarListaDeFaltantes(
      [vencimiento({})],
      [liquidacion({ comprobantesCompras: 0, comprobantesVentas: 5 })],
    );

    expect(lista[0]!.estadoPlanillaRg90).toBe('FALTA_COMPRAS');
  });

  it('ventas en cero es un estado propio, no igual a compras en cero: FALTA_VENTAS', () => {
    const lista = armarListaDeFaltantes(
      [vencimiento({})],
      [liquidacion({ comprobantesCompras: 5, comprobantesVentas: 0 })],
    );

    expect(lista[0]!.estadoPlanillaRg90).toBe('FALTA_VENTAS');
  });

  it('las dos en cero: FALTAN_AMBAS', () => {
    const lista = armarListaDeFaltantes(
      [vencimiento({})],
      [liquidacion({ comprobantesCompras: 0, comprobantesVentas: 0 })],
    );

    expect(lista[0]!.estadoPlanillaRg90).toBe('FALTAN_AMBAS');
  });

  it('con las dos planillas cargadas: COMPLETA', () => {
    const lista = armarListaDeFaltantes([vencimiento({})], [liquidacion({})]);

    expect(lista[0]!.estadoPlanillaRg90).toBe('COMPLETA');
  });

  it('no mezcla la liquidación de un cliente con la de otro con el mismo período', () => {
    const lista = armarListaDeFaltantes(
      [vencimiento({ clienteId: 'copesa' })],
      [liquidacion({ clienteId: 'dibec', comprobantesCompras: 9, comprobantesVentas: 9 })],
    );

    expect(lista[0]!.estadoPlanillaRg90).toBe('SIN_LIQUIDACION');
  });

  it('ordena por cliente y, dentro del mismo cliente, el período más reciente primero', () => {
    const lista = armarListaDeFaltantes(
      [
        vencimiento({ id: 'v1', clienteId: 'dibec', clienteNombre: 'DIBEC SOCIEDAD ANONIMA', periodo: '2026-05' }),
        vencimiento({ id: 'v2', clienteId: 'copesa', clienteNombre: 'COPESA CONSTRUCCIONES SA', periodo: '2026-06' }),
        vencimiento({ id: 'v3', clienteId: 'copesa', clienteNombre: 'COPESA CONSTRUCCIONES SA', periodo: '2026-07' }),
      ],
      [],
    );

    expect(lista.map((f) => `${f.clienteNombre}|${f.periodo}`)).toEqual([
      'COPESA CONSTRUCCIONES SA|2026-07',
      'COPESA CONSTRUCCIONES SA|2026-06',
      'DIBEC SOCIEDAD ANONIMA|2026-05',
    ]);
  });
});
