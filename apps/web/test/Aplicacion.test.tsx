/**
 * Navegación de la aplicación: lo que un indicador del Panel le pide a la pantalla a la que lleva.
 * Acá se prueba que `pestana` llega a Seguimiento y que cambia de pestaña aunque la pantalla ya estuviera abierta.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

let mock: ReturnType<typeof crearFetchMock>;

beforeEach(() => {
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [] }));
  mock.mockDeRuta('GET /api/v1/vencimientos', () =>
    respuestaJson({
      hoy: { anio: 2026, mes: 4, dia: 22 },
      resumen: { VENCIDO: 0, CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0, SIN_ALERTA: 0 },
      vencimientos: [],
    }),
  );
  mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () => respuestaJson({ presentados: [] }));
  mock.mockDeRuta('GET /api/v1/alertas', () =>
    respuestaJson({ alertas: [], resumen: { CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0 } }),
  );
  mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () => respuestaJson({ solicitudes: [] }));
  mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [] }));
  mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones: [] }));
  mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
    respuestaJson({ items: [], resumen: { total: 1, criticos: 1, vencidos: 0 } }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montarAplicacion() {
  vi.resetModules();
  const { Aplicacion } = await import('../src/Aplicacion.js');
  render(<Aplicacion />);
  await screen.findByText('Panel general');
}

describe('navegación del Panel a Seguimiento', () => {
  it('«Pendientes de seguimiento» abre Seguimiento en la pestaña Pendientes', async () => {
    await montarAplicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver los pendientes de seguimiento' }));

    expect(await screen.findByRole('tab', { name: 'Pendientes' })).toHaveAttribute('aria-selected', 'true');
  });

  it('«Documentación pendiente» abre Seguimiento en la pestaña Clientes', async () => {
    await montarAplicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver el seguimiento de documentación' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Clientes' })).toHaveAttribute('aria-selected', 'true');
    });
  });
});
