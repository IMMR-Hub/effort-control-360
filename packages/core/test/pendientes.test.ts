import { describe, expect, it } from 'vitest';

import {
  ordenarPendientes,
  recordatorioVencido,
  resumirPendientes,
  type ItemPendiente,
  type Prioridad,
} from '../src/index.js';

// 27/11/2026 12:00 en Asunción (UTC-3).
const AHORA = new Date('2026-11-27T15:00:00Z');

function item(id: string, extra: Partial<ItemPendiente> = {}): ItemPendiente {
  return {
    tipo: 'EQUIPO',
    id,
    prioridad: 'MEDIA',
    recordarEl: null,
    creadoEn: '2026-11-01T10:00:00.000Z',
    ...extra,
  };
}

describe('ordenarPendientes', () => {
  it('crítica antes que alta, alta antes que media, media antes que baja', () => {
    const prioridades: Prioridad[] = ['BAJA', 'MEDIA', 'CRITICA', 'ALTA'];
    const items = prioridades.map((p) => item(p, { prioridad: p }));
    expect(ordenarPendientes(items, AHORA).map((i) => i.id)).toEqual([
      'CRITICA',
      'ALTA',
      'MEDIA',
      'BAJA',
    ]);
  });

  it('a igual prioridad, el recordatorio vencido va primero', () => {
    const items = [
      item('sin-fecha'),
      item('futuro', { recordarEl: '2026-12-01' }),
      item('vencido', { recordarEl: '2026-11-20', creadoEn: '2026-11-10T10:00:00.000Z' }),
    ];
    expect(ordenarPendientes(items, AHORA)[0]?.id).toBe('vencido');
  });

  it('a igual prioridad y vencimiento, el más antiguo va primero', () => {
    const items = [
      item('nuevo', { creadoEn: '2026-11-20T10:00:00.000Z' }),
      item('viejo', { creadoEn: '2026-11-02T10:00:00.000Z' }),
      item('medio', { creadoEn: '2026-11-10T10:00:00.000Z' }),
    ];
    expect(ordenarPendientes(items, AHORA).map((i) => i.id)).toEqual(['viejo', 'medio', 'nuevo']);
  });

  it('no modifica la lista que recibe', () => {
    const items = [item('b', { prioridad: 'BAJA' }), item('a', { prioridad: 'ALTA' })];
    const copia = [...items];
    const resultado = ordenarPendientes(items, AHORA);
    expect(items).toEqual(copia);
    expect(resultado).not.toBe(items);
  });
});

describe('recordatorioVencido', () => {
  it('un recordatorio de hoy está vencido; uno de mañana no', () => {
    expect(recordatorioVencido('2026-11-27', AHORA)).toBe(true);
    expect(recordatorioVencido('2026-11-28', AHORA)).toBe(false);
  });

  // Review Focus 3: 22:00 en Paraguay = 01:00 UTC del día siguiente.
  it('a las 22:00 de Paraguay, el recordatorio de mañana todavía no está vencido', () => {
    const ahora = new Date('2026-11-28T01:00:00Z'); // 27/11 22:00 en Asunción (UTC-3)
    expect(recordatorioVencido('2026-11-28', ahora)).toBe(false);
    expect(recordatorioVencido('2026-11-27', ahora)).toBe(true);
  });

  it('sin recordatorio nunca está vencido', () => {
    expect(recordatorioVencido(null, AHORA)).toBe(false);
  });
});

describe('resumirPendientes', () => {
  it('el resumen cuenta críticos y vencidos sobre el total', () => {
    const items = [
      item('a', { prioridad: 'CRITICA' }),
      item('b', { prioridad: 'MEDIA', recordarEl: '2026-11-25' }),
      item('c', { prioridad: 'BAJA', recordarEl: '2026-12-15' }),
    ];
    expect(resumirPendientes(items, AHORA)).toEqual({ total: 3, criticos: 1, vencidos: 1 });
  });
});
