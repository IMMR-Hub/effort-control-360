/**
 * Pantalla de Balances (tarea 104, pantalla 5 de 12).
 *
 * El foco de estos tests no es la UI en sí, es el ADR 0004
 * (`docs/adr/0004-el-sistema-no-aprueba-balances.md`): que el botón de
 * aprobar solo aparezca para los roles habilitados, que quede deshabilitado
 * si hay bloqueantes o si el balance no está listo para revisión, y que
 * aprobar pida una confirmación explícita antes de llamar al servidor.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hoyEnParaguay } from '@effort/core';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

const HOY = hoyEnParaguay(new Date());
const PERIODO = `${HOY.anio}-${String(HOY.mes).padStart(2, '0')}`;

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

const BALANCE_LISTO = {
  id: 'bal-1',
  clienteId: 'cli-garso',
  periodo: PERIODO,
  activo: '10000000',
  pasivo: '4000000',
  patrimonioNeto: '6000000',
  resultadoEjercicio: '1000000',
  estado: 'LISTO_PARA_REVISION',
  preparadoPorUsuarioId: 'u1',
  aprobadoPorUsuarioId: null,
  aprobadoEn: null,
  inconsistencias: [],
  proximaAccion: null,
};

const BALANCE_CON_BLOQUEANTE = {
  ...BALANCE_LISTO,
  estado: 'OBSERVADO',
  inconsistencias: [
    {
      codigo: 'ECUACION_PATRIMONIAL_NO_CIERRA',
      gravedad: 'BLOQUEANTE',
      detalle: 'Activo distinto de Pasivo + Patrimonio',
      diferencia: '500000',
    },
  ],
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

async function montar(rol: string, balance: typeof BALANCE_LISTO | null = BALANCE_LISTO) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/balances', () =>
    respuestaJson({ balances: balance ? [balance] : [] }),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Balances = (await import('../src/pantallas/Balances.js')).default;

  render(
    <ProveedorDeSesion>
      <Balances />
    </ProveedorDeSesion>,
  );

  await screen.findByText('GARSO S.A.');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de balances', () => {
  it('muestra el estado y las cifras del balance del período', async () => {
    await montar('direccion');

    expect(screen.getByText('Listo para revisión')).toBeVisible();
    expect(screen.getByText('Gs. 10.000.000')).toBeVisible();
  });

  it('un cliente sin balance todavía se muestra "Sin iniciar", no vacío ni un error', async () => {
    await montar('direccion', null);

    expect(screen.getByText('Sin iniciar')).toBeVisible();
  });

  it('auxiliar no ve el formulario de cifras: solo mira', async () => {
    await montar('auxiliar');

    await usuario.click(screen.getByText('GARSO S.A.'));

    expect(screen.queryByLabelText('Activo (Gs.)')).not.toBeInTheDocument();
  });

  it('coordinador puede editar las cifras pero no ve el botón de aprobar', async () => {
    await montar('coordinador');

    await usuario.click(screen.getByText('GARSO S.A.'));

    expect(screen.getByLabelText('Activo (Gs.)')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Aprobar balance' })).not.toBeInTheDocument();
  });

  it('revisor_balance ve el botón de aprobar, habilitado cuando está listo y sin bloqueantes', async () => {
    await montar('revisor_balance');

    await usuario.click(screen.getByText('GARSO S.A.'));

    const boton = await screen.findByRole('button', { name: 'Aprobar balance' });
    expect(boton).toBeEnabled();
  });

  it('el botón de aprobar queda deshabilitado si hay bloqueantes, aunque el rol pueda aprobar', async () => {
    await montar('revisor_balance', BALANCE_CON_BLOQUEANTE);

    await usuario.click(screen.getByText('GARSO S.A.'));

    const boton = await screen.findByRole('button', { name: 'Aprobar balance' });
    expect(boton).toBeDisabled();
    expect(screen.getByText('Bloqueante')).toBeVisible();
    expect(screen.getByText(/diferencia: Gs\. 500\.000/)).toBeVisible();
  });

  it('aprobar pide confirmación y, si se cancela, no llama al servidor', async () => {
    await montar('direccion');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await usuario.click(screen.getByText('GARSO S.A.'));
    await usuario.click(await screen.findByRole('button', { name: 'Aprobar balance' }));

    expect(mock.llamadasA(`POST /api/v1/clientes/cli-garso/balances/${PERIODO}/aprobar`)).toHaveLength(0);
  });

  it('aprobar, confirmado, llama a la ruta de aprobación', async () => {
    await montar('direccion');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    mock.mockDeRuta(`POST /api/v1/clientes/cli-garso/balances/${PERIODO}/aprobar`, () =>
      respuestaJson({ balance: { ...BALANCE_LISTO, estado: 'APROBADO', aprobadoEn: `${PERIODO}-15T10:00:00.000Z` } }),
    );
    mock.mockDeRuta('GET /api/v1/balances', () =>
      respuestaJson({ balances: [{ ...BALANCE_LISTO, estado: 'APROBADO', aprobadoEn: `${PERIODO}-15T10:00:00.000Z` }] }),
    );

    await usuario.click(screen.getByText('GARSO S.A.'));
    await usuario.click(await screen.findByRole('button', { name: 'Aprobar balance' }));

    await waitFor(() => {
      expect(mock.llamadasA(`POST /api/v1/clientes/cli-garso/balances/${PERIODO}/aprobar`)).toHaveLength(1);
    });
  });

  it('guardar cifras manda los importes como texto y muestra el checklist devuelto', async () => {
    await montar('direccion', null);

    await usuario.click(screen.getByText('GARSO S.A.'));
    await usuario.type(screen.getByLabelText('Activo (Gs.)'), '10000000');
    await usuario.type(screen.getByLabelText('Pasivo (Gs.)'), '4000000');
    await usuario.type(screen.getByLabelText('Patrimonio neto (Gs.)'), '6000000');
    await usuario.type(screen.getByLabelText('Resultado del ejercicio (Gs.)'), '1000000');
    await usuario.type(screen.getByLabelText('Ingresos (Gs.)'), '5000000');
    await usuario.type(screen.getByLabelText('Costos (Gs.)'), '2000000');
    await usuario.type(screen.getByLabelText('Gastos (Gs.)'), '2000000');
    await usuario.type(screen.getByLabelText('Resultado (Gs.)'), '1000000');

    mock.mockDeRuta(`PUT /api/v1/clientes/cli-garso/balances/${PERIODO}`, () =>
      respuestaJson({
        balance: BALANCE_LISTO,
        revision: { estadoSugerido: 'LISTO_PARA_REVISION', bloqueantes: 0, advertencias: 0, inconsistencias: [] },
      }),
    );
    mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [BALANCE_LISTO] }));

    await usuario.click(screen.getByRole('button', { name: 'Guardar y revisar' }));

    await waitFor(() => {
      expect(mock.llamadasA(`PUT /api/v1/clientes/cli-garso/balances/${PERIODO}`)).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA(`PUT /api/v1/clientes/cli-garso/balances/${PERIODO}`)[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.activo).toBe('10000000');
    expect(typeof cuerpo.activo).toBe('string');
    expect(cuerpo.estadoResultados).toEqual({
      ingresos: '5000000',
      costos: '2000000',
      gastos: '2000000',
      resultado: '1000000',
    });

    expect(await screen.findByText('Sin inconsistencias detectadas.')).toBeVisible();
  });
});
