import { describe, expect, it } from 'vitest';

import { agruparVersiones } from '../src/pantallas/versionesDeDocumentos.js';

const RUTA = 'EFFORT Control 360/Entrada/COPESA/PERIODO 2026/08 AGOSTO/80003112_202608_COMPRAS_548075_1.xlsx';

describe('una fila por archivo en Documentos (2026-09-30)', () => {
  it('las versiones de un mismo archivo quedan en una fila, la más reciente', () => {
    const docs = [
      { id: 'v3', recibidoEn: '2026-09-30T12:00:00Z', rutaOneDrive: RUTA },
      { id: 'v2', recibidoEn: '2026-09-29T20:00:00Z', rutaOneDrive: RUTA },
      { id: 'v1', recibidoEn: '2026-09-29T15:00:00Z', rutaOneDrive: RUTA },
    ];

    const { ultimas, versiones, anteriores } = agruparVersiones(docs);

    expect(ultimas.map((d) => d.id)).toEqual(['v3']);
    expect(versiones.get('v3')).toBe(3);
    expect(anteriores).toBe(2);
  });

  it('dos archivos con el mismo nombre en carpetas distintas NO se juntan', () => {
    const docs = [
      { id: 'compras', recibidoEn: '2026-08-01T00:00:00Z', rutaOneDrive: 'COPESA/RG 90 COMPRAS/07 JULIO.xlsx' },
      { id: 'ventas', recibidoEn: '2026-08-01T00:00:00Z', rutaOneDrive: 'COPESA/RG 90 VENTAS/07 JULIO.xlsx' },
    ];

    expect(agruparVersiones(docs).ultimas.map((d) => d.id)).toEqual(['compras', 'ventas']);
  });

  it('un documento sin archivo es siempre su propia fila', () => {
    const docs = [
      { id: 'a', recibidoEn: '2026-09-01T00:00:00Z', rutaOneDrive: null },
      { id: 'b', recibidoEn: '2026-09-01T00:00:00Z' },
    ];

    const { ultimas, anteriores } = agruparVersiones(docs);
    expect(ultimas).toHaveLength(2);
    expect(anteriores).toBe(0);
  });

  it('gana la más reciente aunque la lista venga en otro orden, y se respeta el orden de llegada', () => {
    const docs = [
      { id: 'otro', recibidoEn: '2026-09-10T00:00:00Z', rutaOneDrive: 'X/otro.pdf' },
      { id: 'vieja', recibidoEn: '2026-09-01T00:00:00Z', rutaOneDrive: RUTA },
      { id: 'nueva', recibidoEn: '2026-09-20T00:00:00Z', rutaOneDrive: RUTA },
    ];

    expect(agruparVersiones(docs).ultimas.map((d) => d.id)).toEqual(['otro', 'nueva']);
  });
});
