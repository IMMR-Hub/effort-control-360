/**
 * Navegación de la aplicación: lo que un indicador del Panel le pide a la pantalla a la que lleva.
 * Acá se prueba que `pestana` llega a Seguimiento y que cambia de pestaña aunque la pantalla ya estuviera abierta.
 */

import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

// Seguimiento de verdad, más dos botones que repiten la llamada `irA` con otra pestaña mientras está montada.
vi.mock('../src/pantallas/Seguimiento.js', async () => {
  // Importada al renderizar (no al definir el mock): así comparte los módulos —y el contexto de sesión— de esta
  // aplicación y no los de antes de `vi.resetModules()`.
  const { lazy, Suspense, useState } = await import('react');
  function ConBotonesDeNavegacion(props: Record<string, unknown> & { irA: (p: 'seguimiento', o: { pestana: 'pendientes' | 'clientes' }) => void }) {
    const { irA, ...resto } = props;
    // Uno por montaje: tras `vi.resetModules()` el módulo real de otro test traería otro contexto de sesión.
    const [Real] = useState(() =>
      lazy(() => vi.importActual<typeof import('../src/pantallas/Seguimiento.js')>('../src/pantallas/Seguimiento.js')),
    );
    return (
      <>
        <button type="button" onClick={() => irA('seguimiento', { pestana: 'pendientes' })}>
          Prueba: ir a pendientes
        </button>
        <button type="button" onClick={() => irA('seguimiento', { pestana: 'clientes' })}>
          Prueba: ir a clientes
        </button>
        <Suspense fallback={null}>
          <Real {...resto} />
        </Suspense>
      </>
    );
  }
  return { default: ConBotonesDeNavegacion };
});

let mock: ReturnType<typeof crearFetchMock>;

// Cada caso importa la aplicación entera de nuevo (`vi.resetModules()`): con la máquina cargada eso pasa del
// segundo de espera de `findBy`/`waitFor` y de los 5 s por test. Más margen, mismas aserciones.
configure({ asyncUtilTimeout: 15_000 });

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

describe('navegación del Panel a Seguimiento', { timeout: 40_000 }, () => {
  it('«Documentación pendiente» abre Seguimiento en la pestaña Clientes', async () => {
    await montarAplicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver el seguimiento de documentación' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Clientes' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('con Seguimiento ya abierto, una nueva navegación con pestaña la cambia', async () => {
    await montarAplicacion();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el seguimiento de documentación' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Clientes' })).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prueba: ir a pendientes' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Pendientes' })).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prueba: ir a clientes' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Clientes' })).toHaveAttribute('aria-selected', 'true');
    });
  });
});
