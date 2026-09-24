/**
 * Lista de lo que falta subir al OneDrive, por cliente y período (tarea 152).
 *
 * El servidor ya arma y agrupa los datos (ver `packages/core/test/faltantes.test.ts`
 * para la lógica de agrupamiento) — acá solo se prueba que la pantalla
 * muestra lo que llega y que el CSV no se ofrece con la lista vacía.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
  usuario = userEvent.setup();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(faltantes: readonly unknown[] = [UN_FALTANTE], rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
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
  await screen.findByRole('heading', { name: 'Faltantes' });
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

  describe('"Actualizar ahora" (tarea 152-bis)', () => {
    it('todo el equipo ve el botón, salvo solo lectura (2026-09-24: actualizar no cambia datos de negocio)', async () => {
      await montar([UN_FALTANTE], 'coordinador');
      expect(screen.getByRole('button', { name: /actualizar ahora/i })).toBeVisible();
    });

    it('un rol de solo lectura no ve el botón: el servidor no lo dejaría de todos modos', async () => {
      await montar([UN_FALTANTE], 'solo_lectura');
      expect(screen.queryByRole('button', { name: /actualizar ahora/i })).not.toBeInTheDocument();
    });

    it('mientras corre, avisa cuánto suele tardar — no parece congelado', async () => {
      await montar([UN_FALTANTE]);

      let resolver!: (respuesta: Response) => void;
      mock.mockDeRuta(
        'POST /api/v1/actualizar-ahora',
        () => new Promise<Response>((resolve) => { resolver = resolve; }) as unknown as Response,
      );

      await usuario.click(screen.getByRole('button', { name: /actualizar ahora/i }));

      expect(await screen.findByText(/suele tardar menos de un minuto/i)).toBeInTheDocument();

      resolver(
        respuestaJson({
          archivosNuevos: 0, archivosConFallo: 0, ivaPeriodosCalculados: 0, ivaHallazgosNuevos: 0,
          ivaOcupado: false, presentacionesMarcadas: 0, presentadasFueraDeTermino: 0,
          alertasCreadas: 0, alertasActualizadas: 0, alertasResueltas: 0,
        }),
      );
    });

    it('dirección lo ve, y al apretarlo sincroniza y vuelve a pedir la lista', async () => {
      await montar([UN_FALTANTE]);

      mock.mockDeRuta('POST /api/v1/actualizar-ahora', () =>
        respuestaJson({
          archivosNuevos: 3,
          archivosConFallo: 0,
          ivaPeriodosCalculados: 1,
          ivaHallazgosNuevos: 0,
          ivaOcupado: false,
          presentacionesMarcadas: 1,
          presentadasFueraDeTermino: 0,
          alertasCreadas: 0,
          alertasActualizadas: 0,
          alertasResueltas: 1,
        }),
      );
      // Después de actualizar, la fila de COPESA ya no falta.
      mock.mockDeRuta('GET /api/v1/vencimientos/faltantes', () => respuestaJson({ faltantes: [] }));

      await usuario.click(screen.getByRole('button', { name: /actualizar ahora/i }));

      await waitFor(() => {
        expect(mock.llamadasA('POST /api/v1/actualizar-ahora')).toHaveLength(1);
      });
      expect(await screen.findByText(/no hay nada pendiente/i)).toBeInTheDocument();
      expect(screen.getByText(/1 presentación\(es\) detectada\(s\)/)).toBeInTheDocument();
    });

    it('dice cuánto tardó cada parte y si OneDrive se recorrió entero o solo lo que cambió (tarea 158)', async () => {
      await montar([UN_FALTANTE]);

      mock.mockDeRuta('POST /api/v1/actualizar-ahora', () =>
        respuestaJson({
          archivosNuevos: 0, archivosConFallo: 0, ivaPeriodosCalculados: 0, ivaHallazgosNuevos: 0,
          ivaOcupado: false, presentacionesMarcadas: 0, presentadasFueraDeTermino: 0,
          alertasCreadas: 0, alertasActualizadas: 0, alertasResueltas: 0,
          modoDeSincronizacion: 'incremental', sincronizacionMs: 1500, cicloMs: 2500,
        }),
      );

      await usuario.click(screen.getByRole('button', { name: /actualizar ahora/i }));

      const linea = await screen.findByText(/Tardó 4\.0 s/);
      expect(linea).toHaveTextContent('OneDrive 1.5 s');
      expect(linea).toHaveTextContent('solo lo que cambió');
      expect(linea).toHaveTextContent('cálculo 2.5 s');
    });

    it('un error de la actualización se muestra tal cual, sin perder la lista actual', async () => {
      await montar([UN_FALTANTE]);

      mock.mockDeRuta('POST /api/v1/actualizar-ahora', () =>
        respuestaJson({ error: 'drive_no_configurado', mensaje: 'La conexión con OneDrive no está configurada.' }, { status: 503 }),
      );

      await usuario.click(screen.getByRole('button', { name: /actualizar ahora/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('COPESA CONSTRUCCIONES SA')).toBeInTheDocument();
    });
  });
});
