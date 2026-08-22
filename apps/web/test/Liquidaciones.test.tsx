/**
 * Pantalla de Liquidaciones (tarea 104, pantalla 7 de 12).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const LIQUIDACION_GENERADA = {
  id: 'liq-1',
  clienteId: 'cli-garso',
  periodo: PERIODO,
  tipo: 'IVA',
  archivoEvidenciaId: null,
  destinatario: null,
  canal: null,
  fechaEnvio: null,
  evidenciaEnvioId: null,
  responsableId: null,
  estado: 'GENERADA',
  respuestaCliente: null,
  respondidaEn: null,
  proximaAccion: null,
  observaciones: null,
};

const LIQUIDACION_ENVIADA = {
  ...LIQUIDACION_GENERADA,
  id: 'liq-2',
  estado: 'ENVIADA',
  canal: 'EMAIL',
  destinatario: 'contacto@garso.com.py',
  fechaEnvio: `${PERIODO}-10T09:00:00.000Z`,
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

async function montar(rol: string = 'direccion', liquidaciones: unknown[] = [LIQUIDACION_GENERADA]) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Liquidaciones = (await import('../src/pantallas/Liquidaciones.js')).default;

  render(
    <ProveedorDeSesion>
      <Liquidaciones />
    </ProveedorDeSesion>,
  );

  await screen.findByText('GARSO S.A.');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de liquidaciones', () => {
  it('muestra el estado de cada liquidación del período', async () => {
    await montar();

    expect(screen.getByText('Generada')).toBeVisible();
    expect(screen.getByText('IVA')).toBeVisible();
  });

  it('una liquidación enviada muestra fecha, canal y destinatario', async () => {
    await montar('direccion', [LIQUIDACION_ENVIADA]);

    expect(screen.getByText(/Correo · contacto@garso\.com\.py/)).toBeVisible();
  });

  it('un rol de solo lectura no ve ninguna acción', async () => {
    await montar('auxiliar');

    expect(screen.queryByRole('button', { name: 'Nueva liquidación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar enviada/ })).not.toBeInTheDocument();
  });

  it('una liquidación generada solo ofrece "Enviar", no "Respuesta"', async () => {
    await montar('direccion');

    expect(screen.getByRole('button', { name: /Marcar enviada/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Registrar respuesta/ })).not.toBeInTheDocument();
  });

  it('coordinador puede dar de alta una liquidación nueva', async () => {
    await montar('coordinador');

    await usuario.click(screen.getByRole('button', { name: 'Nueva liquidación' }));
    await usuario.type(screen.getByLabelText('Tipo'), 'Ganancias');

    mock.mockDeRuta('POST /api/v1/clientes/cli-garso/liquidaciones', () =>
      respuestaJson({ liquidacion: { ...LIQUIDACION_GENERADA, id: 'liq-3', tipo: 'Ganancias' } }, { status: 201 }),
    );
    mock.mockDeRuta('GET /api/v1/liquidaciones', () =>
      respuestaJson({ liquidaciones: [LIQUIDACION_GENERADA, { ...LIQUIDACION_GENERADA, id: 'liq-3', tipo: 'Ganancias' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear liquidación' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/clientes/cli-garso/liquidaciones')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/clientes/cli-garso/liquidaciones')[0]!;
    expect(JSON.parse(String(opciones?.body)).tipo).toBe('Ganancias');
  });

  it('registrar el envío manda canal, destinatario y fecha', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: /Marcar enviada/ }));
    await usuario.type(screen.getByLabelText('Destinatario'), 'contacto@garso.com.py');
    // Los inputs type="date" no aceptan userEvent.type() en jsdom (no hay
    // segmentos de fecha reales) — se setea el valor directo con fireEvent.
    fireEvent.change(screen.getByLabelText('Fecha de envío'), { target: { value: `${PERIODO}-15` } });

    mock.mockDeRuta('POST /api/v1/liquidaciones/liq-1/enviar', () =>
      respuestaJson({ liquidacion: { ...LIQUIDACION_GENERADA, estado: 'ENVIADA' } }),
    );
    mock.mockDeRuta('GET /api/v1/liquidaciones', () =>
      respuestaJson({ liquidaciones: [{ ...LIQUIDACION_GENERADA, estado: 'ENVIADA' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Registrar envío' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/liquidaciones/liq-1/enviar')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/liquidaciones/liq-1/enviar')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.canal).toBe('EMAIL');
    expect(cuerpo.destinatario).toBe('contacto@garso.com.py');
    expect(cuerpo.fechaEnvio).toBe(`${PERIODO}-15`);
  });

  it('registrar la respuesta solo aparece para una liquidación ya enviada', async () => {
    await montar('direccion', [LIQUIDACION_ENVIADA]);

    await usuario.click(screen.getByRole('button', { name: /Registrar respuesta/ }));
    await usuario.type(screen.getByLabelText('Qué respondió el cliente'), 'Confirman conformidad.');
    fireEvent.change(screen.getByLabelText('Fecha de la respuesta'), { target: { value: `${PERIODO}-16` } });

    mock.mockDeRuta('POST /api/v1/liquidaciones/liq-2/respuesta', () =>
      respuestaJson({ liquidacion: { ...LIQUIDACION_ENVIADA, estado: 'RESPONDIDA' } }),
    );
    mock.mockDeRuta('GET /api/v1/liquidaciones', () =>
      respuestaJson({ liquidaciones: [{ ...LIQUIDACION_ENVIADA, estado: 'RESPONDIDA' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Registrar respuesta' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/liquidaciones/liq-2/respuesta')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/liquidaciones/liq-2/respuesta')[0]!;
    expect(JSON.parse(String(opciones?.body))).toEqual({
      respuesta: 'Confirman conformidad.',
      respondidaEn: `${PERIODO}-16`,
    });
  });
});
