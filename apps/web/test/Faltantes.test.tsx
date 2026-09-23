/**
 * Lista de lo que falta subir al OneDrive, por cliente y período (tarea 152).
 *
 * El servidor ya arma y agrupa los datos (ver `packages/core/test/faltantes.test.ts`
 * para la lógica de agrupamiento) — acá solo se prueba que la pantalla
 * muestra lo que llega y que el CSV no se ofrece con la lista vacía.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

const UN_FALTANTE = {
  clienteId: 'cli-copesa',
  clienteNombre: 'COPESA CONSTRUCCIONES SA',
  periodo: '2026-07',
  obligaciones: [
    {
      id: 'venc-iva',
      clienteId: 'cli-copesa',
      clienteNombre: 'COPESA CONSTRUCCIONES SA',
      periodo: '2026-07',
      tipoDocumento: 'IVA_GENERAL',
      descripcion: 'IVA General — período 2026-07',
      fechaVencimiento: '2026-08-12',
      diasDeAtraso: 42,
    },
  ],
  estadoPlanillaRg90: 'FALTA_VENTAS',
};

let mock: ReturnType<typeof crearFetchMock>;

beforeEach(() => {
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(faltantes: readonly unknown[] = [UN_FALTANTE]) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/vencimientos/faltantes', () => respuestaJson({ faltantes }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Faltantes = (await import('../src/pantallas/Faltantes.js')).default;

  render(
    <ProveedorDeSesion>
      <Faltantes />
    </ProveedorDeSesion>,
  );
}

describe('Faltantes', () => {
  it('muestra el cliente, el período y el comprobante que falta', async () => {
    await montar();

    expect(await screen.findByText('COPESA CONSTRUCCIONES SA')).toBeInTheDocument();
    expect(screen.getByText('2026-07')).toBeInTheDocument();
    expect(screen.getByText('IVA General — período 2026-07')).toBeInTheDocument();
    expect(screen.getByText('Falta ventas')).toBeInTheDocument();
    // El texto que aclara que ventas en cero puede ser legítimo, solo en ese caso.
    expect(screen.getByText(/puede ser legítimo/i)).toBeInTheDocument();
  });

  it('sin nada pendiente, lo dice explícitamente y no ofrece exportar', async () => {
    await montar([]);

    expect(await screen.findByText(/no hay nada pendiente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar csv/i })).toBeDisabled();
  });

  it('el resumen cuenta filas y comprobantes, no confunde uno con otro', async () => {
    await montar([
      UN_FALTANTE,
      {
        ...UN_FALTANTE,
        clienteId: 'cli-dibec',
        clienteNombre: 'DIBEC SOCIEDAD ANONIMA',
        periodo: '2026-06',
        estadoPlanillaRg90: 'COMPLETA',
        obligaciones: [
          { ...UN_FALTANTE.obligaciones[0], id: 'venc-eeff', tipoDocumento: 'EEFF', descripcion: 'Estados Financieros — período 2025-12' },
          { ...UN_FALTANTE.obligaciones[0], id: 'venc-ire', tipoDocumento: 'IRE', descripcion: 'IRE — período 2025-12' },
        ],
      },
    ]);

    await screen.findByText('DIBEC SOCIEDAD ANONIMA');
    // 2 filas (cliente+período), 3 comprobantes en total (1 + 2).
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
