/**
 * Pantalla de clientes (tarea 104, pantalla 2 de 12).
 *
 * Igual que `Acceso.test.tsx`: `fetch` se mockea por `(método, ruta)`, con el
 * helper compartido de `ayuda-fetch-mock.ts`.
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

const CLIENTE_INACTIVO = { ...GARSO, id: 'cli-viejo', nombre: 'CLIENTE VIEJO S.A.', activo: false };

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

async function montar(rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, CLIENTE_INACTIVO] }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Clientes = (await import('../src/pantallas/Clientes.js')).default;

  render(
    <ProveedorDeSesion>
      <Clientes />
    </ProveedorDeSesion>,
  );

  await screen.findByText('GARSO S.A.');
  // El rol llega de forma asíncrona (GET /api/v1/yo); esperar a que la UI ya
  // lo haya aplicado antes de que el test siga, para no leer un estado a
  // mitad de resolver.
  await waitFor(() => {
    if (rol === 'direccion' || rol === 'responsable') {
      expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeVisible();
    } else {
      expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
    }
  });
}

describe('pantalla de clientes', () => {
  it('lista los clientes activos por defecto, sin mostrar los inactivos', async () => {
    await montar();

    expect(screen.getByText('GARSO S.A.')).toBeVisible();
    expect(screen.queryByText('CLIENTE VIEJO S.A.')).not.toBeInTheDocument();
  });

  it('el filtro "Solo activos" también puede mostrar los inactivos', async () => {
    await montar();

    await usuario.click(screen.getByLabelText('Solo activos'));

    expect(await screen.findByText('CLIENTE VIEJO S.A.')).toBeVisible();
  });

  it('la búsqueda filtra por nombre o RUC', async () => {
    await montar();

    await usuario.type(screen.getByLabelText('Buscar cliente por nombre o RUC'), '80017726');

    expect(screen.getByText('GARSO S.A.')).toBeVisible();
  });

  it('un rol de solo lectura no ve el botón de alta ni el de editar', async () => {
    await montar('auxiliar');

    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });

  it('dirección puede dar de alta un cliente nuevo', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await usuario.type(screen.getByLabelText('Nombre / Razón social'), 'CLIENTE NUEVO S.A.');
    await usuario.type(screen.getByLabelText('RUC'), '80019012-2');

    mock.mockDeRuta('POST /api/v1/clientes', () =>
      respuestaJson({ cliente: { ...GARSO, id: 'cli-nuevo', nombre: 'CLIENTE NUEVO S.A.', ruc: '80019012-2' } }, { status: 201 }),
    );
    mock.mockDeRuta('GET /api/v1/clientes', () =>
      respuestaJson({ clientes: [GARSO, CLIENTE_INACTIVO, { ...GARSO, id: 'cli-nuevo', nombre: 'CLIENTE NUEVO S.A.', ruc: '80019012-2' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear cliente' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/clientes')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/clientes')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.nombre).toBe('CLIENTE NUEVO S.A.');
    expect(cuerpo.ruc).toBe('80019012-2');
    // Los campos vacíos del formulario se mandan como null, no como cadena vacía.
    expect(cuerpo.email).toBeNull();

    expect(await screen.findByText('CLIENTE NUEVO S.A.')).toBeVisible();
  });

  it('un RUC ya usado muestra el mensaje del servidor tal cual', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await usuario.type(screen.getByLabelText('Nombre / Razón social'), 'GARSO DUPLICADO');
    await usuario.type(screen.getByLabelText('RUC'), '80017726-6');

    mock.mockDeRuta('POST /api/v1/clientes', () =>
      respuestaJson(
        { error: 'ruc_en_uso', mensaje: 'Ya existe un cliente con ese RUC.' },
        { status: 409 },
      ),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear cliente' }));

    expect(await screen.findByText('Ya existe un cliente con ese RUC.')).toBeVisible();
    // El formulario sigue abierto: no se pierde lo que la persona ya cargó.
    expect(screen.getByLabelText('Nombre / Razón social')).toHaveValue('GARSO DUPLICADO');
  });

  it('editar precarga los datos actuales del cliente', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Editar GARSO S.A.' }));

    expect(screen.getByLabelText('Nombre / Razón social')).toHaveValue('GARSO S.A.');
    expect(screen.getByLabelText('RUC')).toHaveValue('80017726-6');
    expect(screen.getByLabelText('Cliente activo')).toBeChecked();
  });

  it('cancelar cierra el formulario sin llamar al servidor', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Nombre / Razón social')).not.toBeInTheDocument();
    expect(mock.llamadasA('POST /api/v1/clientes')).toHaveLength(0);
  });
});
