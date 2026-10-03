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
import type { HojaDeReporte, Reporte } from '../src/ui/reporteExcel.js';

// La descarga real necesita un navegador; acá se mira QUÉ se iba a descargar.
const { descargarReporte } = vi.hoisted(() => ({ descargarReporte: vi.fn(async () => {}) }));
vi.mock('../src/ui/reporteExcel.js', async (original) => ({
  ...(await original<typeof import('../src/ui/reporteExcel.js')>()),
  descargarReporte,
}));

/** Cada fila de la hoja como la vería Excel: los valores de sus columnas. */
function celdas(hoja: HojaDeReporte): unknown[][] {
  return hoja.filas.map((fila) => hoja.columnas.map((c) => c.valor(fila as never)));
}

function unCliente(id: string, nombre: string) {
  return {
    id,
    nombre,
    ruc: '80017726-6',
    tipoPersona: 'JURIDICA',
    regimenTributario: null,
    email: null,
    telefono: null,
    canalPreferido: 'WHATSAPP',
    carpetaOneDriveId: null,
    activo: true,
    observaciones: null,
  };
}

const COPESA = unCliente('cli-copesa', 'COPESA CONSTRUCCIONES SA');
const DIBEC = unCliente('cli-dibec', 'DIBEC SOCIEDAD ANONIMA');

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
  descargarReporte.mockClear();
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
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [COPESA, DIBEC] }));
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

    expect(await screen.findByText('COPESA CONSTRUCCIONES SA', { selector: 'td' })).toBeInTheDocument();
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

    await screen.findByText('DIBEC SOCIEDAD ANONIMA', { selector: 'td' });
    // 2 filas (cliente+período), 3 comprobantes en total (1 + 2).
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  describe('filtro por cliente (2026-10-02)', () => {
    const DE_DIBEC = {
      ...UN_FALTANTE,
      clienteId: 'cli-dibec',
      clienteNombre: 'DIBEC SOCIEDAD ANONIMA',
      periodo: '2026-06',
      estadoPlanillaRg90: 'COMPLETA',
      obligaciones: [
        { ...UN_FALTANTE.obligaciones[0], id: 'venc-eeff', tipoDocumento: 'EEFF', descripcion: 'Estados Financieros — período 2025-12' },
        { ...UN_FALTANTE.obligaciones[0], id: 'venc-ire', tipoDocumento: 'IRE', descripcion: 'IRE — período 2025-12' },
      ],
    };

    it('elegir un cliente deja solo sus filas y sus indicadores, y «Todos los clientes» las vuelve a mostrar', async () => {
      await montar([UN_FALTANTE, DE_DIBEC]);
      expect(screen.getByText('COPESA CONSTRUCCIONES SA', { selector: 'td' })).toBeVisible();
      expect(screen.getByText('DIBEC SOCIEDAD ANONIMA', { selector: 'td' })).toBeVisible();
      expect(screen.getByText('Cliente y período con algo pendiente').closest('div')!.textContent).toContain('2');

      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-dibec');

      expect(screen.queryByText('COPESA CONSTRUCCIONES SA', { selector: 'td' })).not.toBeInTheDocument();
      expect(screen.getByText('DIBEC SOCIEDAD ANONIMA', { selector: 'td' })).toBeVisible();
      expect(screen.getByText(/1 fila\(s\) .*cliente: DIBEC SOCIEDAD ANONIMA/)).toBeVisible();
      // Los indicadores cuentan solo lo filtrado: 1 fila, 2 comprobantes y ninguna planilla incompleta.
      expect(screen.getByText('Cliente y período con algo pendiente').closest('div')!.textContent).toContain('1');
      expect(screen.getByText('Comprobantes sin presentar', { selector: 'p' }).closest('div')!.textContent).toContain('2');
      expect(screen.getByText('Con planilla RG 90 incompleta').closest('div')!.textContent).toContain('0');

      await usuario.selectOptions(screen.getByLabelText('Cliente'), '');

      expect(screen.getByText('COPESA CONSTRUCCIONES SA', { selector: 'td' })).toBeVisible();
      expect(screen.getByText('DIBEC SOCIEDAD ANONIMA', { selector: 'td' })).toBeVisible();
      expect(screen.getByText('Con planilla RG 90 incompleta').closest('div')!.textContent).toContain('1');
    });

    it('un cliente sin nada pendiente lo dice, y no es lo mismo que «no falta nada de nadie»', async () => {
      await montar([UN_FALTANTE]);

      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-dibec');

      expect(await screen.findByText(/no hay nada pendiente para este cliente/i)).toBeVisible();
    });
  });

  describe('Excel (2026-10-02)', () => {
    it('descarga solo lo que queda a la vista con el cliente elegido, con el filtro escrito', async () => {
      await montar([
        UN_FALTANTE,
        {
          ...UN_FALTANTE,
          clienteId: 'cli-dibec',
          clienteNombre: 'DIBEC SOCIEDAD ANONIMA',
          periodo: '2026-06',
          estadoPlanillaRg90: 'COMPLETA',
          obligaciones: [
            { ...UN_FALTANTE.obligaciones[0], id: 'venc-eeff', descripcion: 'Estados Financieros — período 2025-12', diasDeAtraso: 10 },
            { ...UN_FALTANTE.obligaciones[0], id: 'venc-ire', descripcion: 'IRE — período 2025-12', diasDeAtraso: 7 },
          ],
        },
      ], 'auxiliar');
      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-dibec');

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('DIBEC SOCIEDAD ANONIMA');
      expect(reporte.titulo).toBe('Faltantes');
      expect(reporte.filtros).toEqual(['Cliente: DIBEC SOCIEDAD ANONIMA']);
      expect(reporte.hojas.map((h) => h.nombre)).toEqual(['Lo que falta subir']);
      const [hoja] = reporte.hojas as [HojaDeReporte];
      expect(hoja.columnas.map((c) => c.titulo)).toEqual([
        'Cliente', 'Período', 'Comprobantes sin presentar', 'Planilla RG 90', 'Aclaración',
      ]);
      // Las etiquetas que ve el usuario, nunca el código interno (COMPLETA, FALTA_VENTAS…).
      expect(celdas(hoja)).toEqual([
        [
          'DIBEC SOCIEDAD ANONIMA',
          '2026-06',
          'Estados Financieros — período 2025-12 (10 día(s) de atraso) | IRE — período 2025-12 (7 día(s) de atraso)',
          'Completa',
          null,
        ],
      ]);
    });

    it('sin filtro trae todas las filas, y la aclaración de «Falta ventas» viaja con su fila', async () => {
      await montar([UN_FALTANTE]);

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBeNull();
      expect(reporte.filtros).toEqual(['Cliente: todos']);
      const [hoja] = reporte.hojas as [HojaDeReporte];
      expect(celdas(hoja)).toEqual([
        [
          'COPESA CONSTRUCCIONES SA',
          '2026-07',
          'IVA General — período 2026-07 (42 día(s) de atraso)',
          'Falta ventas',
          'Puede ser legítimo si el cliente no facturó ese mes.',
        ],
      ]);
    });
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
      expect(screen.getByText('COPESA CONSTRUCCIONES SA', { selector: 'td' })).toBeInTheDocument();
    });
  });
});
