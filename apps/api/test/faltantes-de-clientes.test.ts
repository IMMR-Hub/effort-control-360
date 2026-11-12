/**
 * Qué le falta a cada cliente (Daniel, 2026-11-12: «deben aparecer como
 * incompletos y mencionar lo que le falta»).
 */

import { describe, expect, it } from 'vitest';

import { faltantesDeClientes } from '../src/servicios/faltantesDeClientes.js';
import type { ObligacionAlmacenada } from '../src/puertos-dominio.js';

const AHORA = new Date('2026-11-12T12:00:00Z');

function obligacion(id: string, nombre: string, confirmadaPorEffort: boolean): ObligacionAlmacenada {
  return {
    id, codigo: id, nombre, entidad: 'DNIT', formulario: null, periodicidad: 'ANUAL', mesDeCierreAnual: null,
    diasPorTerminacionRuc: [], confirmadaPorEffort, activa: true, fuente: 'prueba',
  };
}

const IVA = obligacion('iva', 'IVA', true);
const IRP = obligacion('irp', 'IRP', false);
const IDU = obligacion('idu', 'IDU', false);

function asignacion(clienteId: string, obligacionId: string, hasta: Date | null = null) {
  return { id: `${clienteId}-${obligacionId}`, clienteId, obligacionId, desde: new Date('2026-10-01'), hasta };
}

describe('faltantes de cada cliente', () => {
  it('un cliente con RUC, responsable y solo obligaciones confirmadas está completo', () => {
    const r = faltantesDeClientes({
      clientes: [{ id: 'a', ruc: '80000001-1', activo: true }],
      obligaciones: [IVA], asignaciones: [asignacion('a', 'iva')], conResponsable: new Set(['a']), ahora: AHORA,
    });
    expect(r).toEqual({});
  });

  it('dice cada cosa que falta: RUC, responsable y las reglas sin confirmar, en orden', () => {
    const r = faltantesDeClientes({
      clientes: [{ id: 'a', ruc: null, activo: true }],
      obligaciones: [IVA, IRP, IDU],
      asignaciones: [asignacion('a', 'iva'), asignacion('a', 'irp'), asignacion('a', 'idu')],
      conResponsable: new Set(), ahora: AHORA,
    });
    expect(r).toEqual({ a: ['RUC', 'responsable con cuenta en el sistema', 'regla de vencimiento de IDU, IRP'] });
  });

  it('una asignación ya cerrada no cuenta', () => {
    const r = faltantesDeClientes({
      clientes: [{ id: 'a', ruc: '80000001-1', activo: true }],
      obligaciones: [IRP], asignaciones: [asignacion('a', 'irp', new Date('2026-11-01'))],
      conResponsable: new Set(['a']), ahora: AHORA,
    });
    expect(r).toEqual({});
  });

  it('un cliente inactivo no se informa, y uno sin obligaciones no es incompleto por eso', () => {
    const r = faltantesDeClientes({
      clientes: [{ id: 'baja', ruc: null, activo: false }, { id: 'sm', ruc: '80000002-2', activo: true }],
      obligaciones: [], asignaciones: [], conResponsable: new Set(['sm']), ahora: AHORA,
    });
    expect(r).toEqual({});
  });
});
