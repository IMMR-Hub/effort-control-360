/**
 * Pantalla de Equipo (tarea 104, pantalla 9 de 12).
 *
 * A diferencia de las demás pantallas, `usuario` en la matriz de RBAC solo
 * aparece para `direccion` (ver/crear/editar) y `responsable` (solo ver) —
 * el resto de los roles no tiene ningún acceso, ni siquiera de lectura, así
 * que `GET /api/v1/usuarios` les da 403 en vez de una lista vacía.
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

const ARACELY = {
  id: 'usr-aracely',
  nombre: 'Aracely',
  apellido: 'Gómez',
  email: 'aracely@effort.com.py',
  telefono: null,
  cargo: 'Auxiliar contable',
  rol: 'auxiliar',
  activo: true,
  veTodosLosClientes: false,
  ultimoAccesoEn: null,
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

async function montar(rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/usuarios/usr-aracely/clientes', () => respuestaJson({ clienteIds: [] }));

  if (rol === 'direccion' || rol === 'responsable') {
    mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [ARACELY] }));
  } else {
    mock.mockDeRuta('GET /api/v1/usuarios', () =>
      respuestaJson({ error: 'no_autorizado', mensaje: 'No tenés permiso para realizar esta acción.' }, { status: 403 }),
    );
  }

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Equipo = (await import('../src/pantallas/Equipo.js')).default;

  render(
    <ProveedorDeSesion>
      <Equipo />
    </ProveedorDeSesion>,
  );

  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de equipo', () => {
  it('lista el equipo con rol y estado', async () => {
    await montar();

    expect(await screen.findByText('Aracely Gómez')).toBeVisible();
    expect(screen.getByText('aracely@effort.com.py')).toBeVisible();
    expect(screen.getByText('Auxiliar')).toBeVisible();
    expect(screen.getByText('Activo')).toBeVisible();
  });

  it('responsable ve el equipo pero no puede dar de alta ni editar', async () => {
    await montar('responsable');

    expect(await screen.findByText('Aracely Gómez')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });

  it('un rol sin acceso al recurso "usuario" ve el mensaje del servidor, no una lista vacía', async () => {
    await montar('auxiliar');

    expect(await screen.findByText('No tenés permiso para realizar esta acción.')).toBeVisible();
    expect(screen.queryByText('Aracely Gómez')).not.toBeInTheDocument();
  });

  it('dirección da de alta un usuario con cartera acotada', async () => {
    await montar();
    await screen.findByText('Aracely Gómez');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Nueva');
    await usuario.type(screen.getByLabelText('Apellido'), 'Persona');
    await usuario.type(screen.getByLabelText('Correo'), 'nueva@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña inicial'), 'una contraseña bien larga');
    await usuario.click(screen.getByLabelText('GARSO S.A.'));

    mock.mockDeRuta('POST /api/v1/usuarios', () =>
      respuestaJson(
        { usuario: { ...ARACELY, id: 'usr-nuevo', nombre: 'Nueva', apellido: 'Persona', email: 'nueva@effort.com.py' } },
        { status: 201 },
      ),
    );
    mock.mockDeRuta('GET /api/v1/usuarios', () =>
      respuestaJson({ usuarios: [ARACELY, { ...ARACELY, id: 'usr-nuevo', nombre: 'Nueva', apellido: 'Persona', email: 'nueva@effort.com.py' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/usuarios')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/usuarios')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.nombre).toBe('Nueva');
    expect(cuerpo.email).toBe('nueva@effort.com.py');
    expect(cuerpo.rol).toBe('auxiliar');
    expect(cuerpo.clientesAsignados).toEqual(['cli-garso']);

    expect(await screen.findByText('Nueva Persona')).toBeVisible();
  });

  it('un correo ya usado muestra el mensaje del servidor tal cual', async () => {
    await montar();
    await screen.findByText('Aracely Gómez');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Otra');
    await usuario.type(screen.getByLabelText('Apellido'), 'Persona');
    await usuario.type(screen.getByLabelText('Correo'), 'aracely@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña inicial'), 'una contraseña bien larga');

    mock.mockDeRuta('POST /api/v1/usuarios', () =>
      respuestaJson({ error: 'correo_en_uso', mensaje: 'Ya existe un usuario con ese correo.' }, { status: 409 }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Ya existe un usuario con ese correo.')).toBeVisible();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Otra');
  });

  it('editar precarga los datos básicos y, apenas llega, la cartera vigente', async () => {
    await montar();
    await screen.findByText('Aracely Gómez');

    mock.mockDeRuta('GET /api/v1/usuarios/usr-aracely/clientes', () =>
      respuestaJson({ clienteIds: ['cli-garso'] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Editar Aracely Gómez' }));

    expect(screen.getByLabelText('Nombre')).toHaveValue('Aracely');
    expect(screen.getByLabelText('Apellido')).toHaveValue('Gómez');
    expect(screen.getByLabelText('Correo')).toHaveValue('aracely@effort.com.py');
    expect(screen.getByLabelText('Correo')).toBeDisabled();
    expect(screen.queryByLabelText('Contraseña inicial')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('GARSO S.A.')).toBeChecked();
    });
  });

  it('marcar "Ve toda la cartera" oculta la lista de clientes', async () => {
    await montar();
    await screen.findByText('Aracely Gómez');

    await usuario.click(screen.getByRole('button', { name: 'Editar Aracely Gómez' }));
    expect(screen.getByText('Cartera asignada', { exact: false })).toBeVisible();

    await usuario.click(screen.getByLabelText('Ve toda la cartera'));

    expect(screen.queryByText('Cartera asignada', { exact: false })).not.toBeInTheDocument();
  });

  it('cancelar cierra el formulario sin llamar al servidor', async () => {
    await montar();
    await screen.findByText('Aracely Gómez');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Contraseña inicial')).not.toBeInTheDocument();
    expect(mock.llamadasA('POST /api/v1/usuarios')).toHaveLength(0);
  });
});
