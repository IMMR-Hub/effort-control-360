/**
 * Radar de vencimientos (tarea 104, pantalla 4 de 12).
 *
 * `diasRestantes` y `nivelAlerta` los manda el servidor ya calculados — la
 * pantalla no hace ninguna cuenta de fechas, así que los tests no necesitan
 * mockear una fecha "de hoy".
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

const GARSO = {
  id: 'cli-garso',
  nombre: 'GARSO S.A.',
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

const VENCIMIENTO_ABOGACIA = {
  id: 'venc-1',
  clienteId: 'cli-garso',
  tipoDocumento: 'CONSTANCIA',
  descripcion: 'Presentación anual ante Abogacía',
  entidad: 'Abogacía del Tesoro',
  fechaEmision: null,
  fechaVencimiento: '2026-04-28',
  fechaPresentacion: null,
  responsableId: null,
  estado: 'VIGENTE',
  riesgo: 'CRITICO',
  evidenciaId: null,
  proximaAccion: null,
  diasRestantes: 2,
  nivelAlerta: 'CRITICA',
};

const RESUMEN = { VENCIDO: 0, CRITICA: 1, ALTA: 0, MEDIA: 0, INFORMATIVA: 0, SIN_ALERTA: 0 };

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

async function montar(
  rol: string = 'direccion',
  opciones: {
    nivelInicial?: 'TODOS' | 'PROXIMOS' | 'VENCIDO';
    vencimientos?: readonly unknown[];
  } = {},
) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/vencimientos', () =>
    respuestaJson({
      hoy: { anio: 2026, mes: 4, dia: 26 },
      resumen: RESUMEN,
      vencimientos: opciones.vencimientos ?? [VENCIMIENTO_ABOGACIA],
    }),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Vencimientos = (await import('../src/pantallas/Vencimientos.js')).default;

  render(
    <ProveedorDeSesion>
      <Vencimientos {...(opciones.nivelInicial ? { nivelInicial: opciones.nivelInicial } : {})} />
    </ProveedorDeSesion>,
  );

  if (opciones.vencimientos) await screen.findByLabelText('Nivel de alerta');
  else await screen.findByText('Presentación anual ante Abogacía');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('radar de vencimientos', () => {
  it('muestra el radar con los días restantes y el nivel de alerta que manda el servidor', async () => {
    await montar();

    expect(screen.getByText('GARSO S.A.')).toBeVisible();
    expect(screen.getByText('Abogacía del Tesoro')).toBeVisible();
    expect(screen.getByText('2026-04-28')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Crítica')).toBeVisible();
  });

  it('el resumen por nivel viene del servidor, no de un conteo hecho en la pantalla', async () => {
    await montar();

    const indicadorCriticos = screen.getByText('Críticos').closest('div')!;
    expect(indicadorCriticos.textContent).toContain('1');
  });

  it('un rol de solo lectura no ve el botón de alta ni el de presentar', async () => {
    await montar('auxiliar');

    expect(screen.queryByRole('button', { name: 'Nuevo vencimiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar presentado/ })).not.toBeInTheDocument();
  });

  it('coordinador puede dar de alta un vencimiento nuevo', async () => {
    await montar('coordinador');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo vencimiento' }));
    await usuario.type(screen.getByLabelText('Descripción'), 'Renovación de patente');
    await usuario.type(screen.getByLabelText('Entidad'), 'Municipalidad');
    await usuario.type(screen.getByLabelText('Fecha de vencimiento'), '2026-06-15');

    mock.mockDeRuta('POST /api/v1/clientes/cli-garso/vencimientos', () =>
      respuestaJson(
        { vencimiento: { ...VENCIMIENTO_ABOGACIA, id: 'venc-2', descripcion: 'Renovación de patente' } },
        { status: 201 },
      ),
    );
    mock.mockDeRuta('GET /api/v1/vencimientos', () =>
      respuestaJson({
        hoy: { anio: 2026, mes: 4, dia: 26 },
        resumen: RESUMEN,
        vencimientos: [VENCIMIENTO_ABOGACIA, { ...VENCIMIENTO_ABOGACIA, id: 'venc-2', descripcion: 'Renovación de patente' }],
      }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear vencimiento' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/clientes/cli-garso/vencimientos')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/clientes/cli-garso/vencimientos')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.descripcion).toBe('Renovación de patente');
    expect(cuerpo.entidad).toBe('Municipalidad');
    expect(cuerpo.fechaVencimiento).toBe('2026-06-15');
    expect(cuerpo.fechaEmision).toBeNull();

    expect(await screen.findByText('Renovación de patente')).toBeVisible();
  });

  it('marcar presentado pide la fecha y la manda al servidor', async () => {
    await montar();
    vi.spyOn(window, 'prompt').mockReturnValue('2026-04-20');

    mock.mockDeRuta('POST /api/v1/vencimientos/venc-1/presentar', () =>
      respuestaJson({ vencimiento: { ...VENCIMIENTO_ABOGACIA, estado: 'PRESENTADO' } }),
    );
    mock.mockDeRuta('GET /api/v1/vencimientos', () =>
      respuestaJson({ hoy: { anio: 2026, mes: 4, dia: 26 }, resumen: RESUMEN, vencimientos: [] }),
    );

    await usuario.click(screen.getByRole('button', { name: /Marcar presentado/ }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/vencimientos/venc-1/presentar')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/vencimientos/venc-1/presentar')[0]!;
    expect(JSON.parse(String(opciones?.body))).toEqual({
      fechaPresentacion: '2026-04-20',
      evidenciaId: null,
    });
  });

  it('cancelar el prompt de presentar (sin fecha) no llama al servidor', async () => {
    await montar();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    await usuario.click(screen.getByRole('button', { name: /Marcar presentado/ }));

    expect(mock.llamadasA('POST /api/v1/vencimientos/venc-1/presentar')).toHaveLength(0);
  });

  /*
   * Tarea 146. DIBEC, ECOAGRO y FUMIPRO ya estaban presentadas cuando salió la
   * RG 50/2026: el botón tiene que estar también en la lista de presentados.
   */
  describe('prórroga de lo ya presentado', () => {
    const PRESENTADO = {
      id: 'venc-p1',
      clienteId: 'cli-garso',
      descripcion: 'Estados financieros 2025',
      entidad: 'DNIT',
      fechaVencimiento: '2026-04-28',
      fechaPresentacion: '2026-06-30',
      fechaVencimientoOriginal: null,
      motivoProrroga: null,
      evidenciaId: null,
      diasDeAtraso: 63,
      fechaAproximada: false,
    };

    it('el botón «Prórroga» de un presentado manda la fecha y el motivo y recarga la lista', async () => {
      mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () =>
        respuestaJson({ presentados: [PRESENTADO] }),
      );
      await montar();
      await screen.findByText('Estados financieros 2025');
      expect(screen.getByText('63 días')).toBeVisible();

      const prompt = vi.spyOn(window, 'prompt')
        .mockReturnValueOnce('2026-06-30')
        .mockReturnValueOnce('RG 50/2026');
      mock.mockDeRuta('POST /api/v1/vencimientos/venc-p1/prorrogar', () =>
        respuestaJson({ vencimiento: { ...VENCIMIENTO_ABOGACIA, id: 'venc-p1' } }),
      );
      mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () =>
        respuestaJson({
          presentados: [
            {
              ...PRESENTADO,
              fechaVencimiento: '2026-06-30',
              fechaVencimientoOriginal: '2026-04-28',
              motivoProrroga: 'RG 50/2026',
              diasDeAtraso: 0,
            },
          ],
        }),
      );

      await usuario.click(screen.getByRole('button', { name: 'Prorrogar: Estados financieros 2025' }));

      await waitFor(() => {
        expect(mock.llamadasA('POST /api/v1/vencimientos/venc-p1/prorrogar')).toHaveLength(1);
      });
      const [, opciones] = mock.llamadasA('POST /api/v1/vencimientos/venc-p1/prorrogar')[0]!;
      expect(JSON.parse(String(opciones?.body))).toEqual({
        nuevaFecha: '2026-06-30',
        motivo: 'RG 50/2026',
      });
      expect(prompt).toHaveBeenCalledTimes(2);

      expect(await screen.findByText('A tiempo')).toBeVisible();
      expect(screen.getByText(/prorrogado del 2026-04-28 — RG 50\/2026/)).toBeVisible();
    });

    it('cancelar la fecha no llama al servidor', async () => {
      mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () =>
        respuestaJson({ presentados: [PRESENTADO] }),
      );
      await montar();
      await screen.findByText('Estados financieros 2025');
      vi.spyOn(window, 'prompt').mockReturnValue(null);

      await usuario.click(screen.getByRole('button', { name: 'Prorrogar: Estados financieros 2025' }));

      expect(mock.llamadasA('POST /api/v1/vencimientos/venc-p1/prorrogar')).toHaveLength(0);
    });

    it('un rol de solo lectura no ve «Prórroga» en los presentados', async () => {
      mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () =>
        respuestaJson({ presentados: [PRESENTADO] }),
      );
      await montar('auxiliar');
      await screen.findByText('Estados financieros 2025');

      expect(screen.queryByRole('button', { name: /Prorrogar/ })).not.toBeInTheDocument();
    });
  });

  /*
   * Daniel, 2026-09-21: «Vencimientos próximos dice 2 pero no aparece. Va a la
   * misma página y en la lista no aparece "próximo"». «Próximos» son los
   * críticos y los altos (vencen en 7 días o menos); la lista no tenía cómo
   * filtrarlos ni siquiera nombraba la palabra.
   */
  describe('filtro por nivel de alerta', () => {
    const conNivel = (id: string, descripcion: string, nivelAlerta: string, diasRestantes: number) => ({
      ...VENCIMIENTO_ABOGACIA, id, descripcion, nivelAlerta, diasRestantes,
    });
    const FILAS = [
      conNivel('v1', 'Vencido uno', 'VENCIDO', -5),
      conNivel('v2', 'Critico uno', 'CRITICA', 1),
      conNivel('v3', 'Alto uno', 'ALTA', 5),
      conNivel('v4', 'Medio uno', 'MEDIA', 12),
      conNivel('v5', 'Lejano uno', 'SIN_ALERTA', 90),
    ];

    it('sin filtro muestra todo', async () => {
      await montar('direccion', { vencimientos: FILAS });

      for (const d of ['Vencido uno', 'Critico uno', 'Alto uno', 'Medio uno', 'Lejano uno']) {
        expect(screen.getByText(d)).toBeVisible();
      }
    });

    it('«Próximos» muestra solo críticos y altos', async () => {
      await montar('direccion', { vencimientos: FILAS });

      await usuario.selectOptions(screen.getByLabelText('Nivel de alerta'), 'PROXIMOS');

      expect(screen.getByText('Critico uno')).toBeVisible();
      expect(screen.getByText('Alto uno')).toBeVisible();
      expect(screen.queryByText('Vencido uno')).not.toBeInTheDocument();
      expect(screen.queryByText('Medio uno')).not.toBeInTheDocument();
      expect(screen.queryByText('Lejano uno')).not.toBeInTheDocument();
    });

    it('llegar desde el Panel con «próximos» abre la lista ya filtrada', async () => {
      await montar('direccion', { vencimientos: FILAS, nivelInicial: 'PROXIMOS' });

      expect(screen.getByLabelText('Nivel de alerta')).toHaveValue('PROXIMOS');
      expect(screen.getByText('Critico uno')).toBeVisible();
      expect(screen.queryByText('Lejano uno')).not.toBeInTheDocument();
    });

    it('filtrar por vencidos deja solo los vencidos', async () => {
      await montar('direccion', { vencimientos: FILAS, nivelInicial: 'VENCIDO' });

      expect(screen.getByText('Vencido uno')).toBeVisible();
      expect(screen.queryByText('Critico uno')).not.toBeInTheDocument();
    });
  });
});
