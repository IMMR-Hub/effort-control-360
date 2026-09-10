/**
 * Pantalla de Eventos / event log (tarea 104, pantalla 11 de 12).
 *
 * Solo lectura — no hay RBAC de botones que probar acá, la pantalla entera
 * es inaccesible para quien no tenga `evento:ver` (el servidor da 403 antes
 * de que la pantalla llegue a dibujar nada).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
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

const EVENTO_BALANCE = {
  id: 'evt-1',
  usuarioId: 'usr-direccion',
  accion: 'balance.aprobado',
  entidad: 'balance',
  entidadId: 'bal-1',
  clienteId: 'cli-garso',
  datosAntes: { estado: 'LISTO_PARA_REVISION' },
  datosDespues: { estado: 'APROBADO' },
  ipTruncada: '190.10.20.0',
  agenteUsuario: 'Mozilla/5.0',
  peticionId: 'req-1',
  ocurridoEn: '2026-08-15T13:30:00.000Z',
};

/** La bitácora muestra el nombre de la persona, no su id. */
const USUARIO_LAURA = {
  id: 'usr-1',
  nombre: 'Laura',
  apellido: 'Sosa',
  email: 'lsosa@effort.com.py',
  telefono: null,
  cargo: null,
  rol: 'direccion',
  activo: true,
  veTodosLosClientes: true,
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
  mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [USUARIO_LAURA] }));
  mock.mockDeRuta('GET /api/v1/eventos', () => respuestaJson({ eventos: [EVENTO_BALANCE] }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Eventos = (await import('../src/pantallas/Eventos.js')).default;

  render(
    <ProveedorDeSesion>
      <Eventos />
    </ProveedorDeSesion>,
  );

  await screen.findByText('balance.aprobado');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de eventos', () => {
  it('muestra el historial con los datos que manda el servidor', async () => {
    await montar();

    const tabla = within(screen.getByRole('table', { name: 'Historial de eventos' }));
    expect(tabla.getByText('balance.aprobado')).toBeVisible();
    expect(tabla.getByText('GARSO S.A.')).toBeVisible();
    expect(tabla.getByText('usr-direccion')).toBeVisible();
  });

  it('un rol sin acceso al recurso "evento" ve el mensaje del servidor', async () => {
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({ usuarioId: 'u1', rol: 'auxiliar', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
    );
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [USUARIO_LAURA] }));
    mock.mockDeRuta('GET /api/v1/eventos', () =>
      respuestaJson({ error: 'no_autorizado', mensaje: 'No tenés permiso para realizar esta acción.' }, { status: 403 }),
    );

    vi.resetModules();
    const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
    const Eventos = (await import('../src/pantallas/Eventos.js')).default;

    render(
      <ProveedorDeSesion>
        <Eventos />
      </ProveedorDeSesion>,
    );

    expect(await screen.findByText('No tenés permiso para realizar esta acción.')).toBeVisible();
  });

  it('buscar con filtros manda solo los campos completados, no cadenas vacías', async () => {
    await montar();

    await usuario.type(screen.getByLabelText('Entidad'), 'balance');
    mock.mockDeRuta('GET /api/v1/eventos', () => respuestaJson({ eventos: [EVENTO_BALANCE] }));

    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(mock.llamadasA('GET /api/v1/eventos')).toHaveLength(2);
    });
    const [ultimaUrl] = mock.llamadasA('GET /api/v1/eventos').at(-1)!;
    const url = new URL(String(ultimaUrl));
    expect(url.searchParams.get('entidad')).toBe('balance');
    expect(url.searchParams.has('entidadId')).toBe(false);
    expect(url.searchParams.has('clienteId')).toBe(false);
  });

  it('limpiar filtros vuelve a buscar sin ningún filtro', async () => {
    await montar();

    await usuario.type(screen.getByLabelText('Entidad'), 'balance');
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getByLabelText('Entidad')).toHaveValue('');
    await waitFor(() => {
      expect(mock.llamadasA('GET /api/v1/eventos')).toHaveLength(2);
    });
  });

  it('"Cargar más" aparece solo cuando la página vino llena, y pagina con el desplazamiento correcto', async () => {
    const eventosLlenos = Array.from({ length: 50 }, (_, i) => ({ ...EVENTO_BALANCE, id: `evt-${i}` }));
    mock.mockDeRuta('GET /api/v1/eventos', () => respuestaJson({ eventos: eventosLlenos }));

    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({ usuarioId: 'u1', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
    );
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [USUARIO_LAURA] }));

    vi.resetModules();
    const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
    const Eventos = (await import('../src/pantallas/Eventos.js')).default;

    render(
      <ProveedorDeSesion>
        <Eventos />
      </ProveedorDeSesion>,
    );

    const boton = await screen.findByRole('button', { name: 'Cargar más' });

    mock.mockDeRuta('GET /api/v1/eventos', () => respuestaJson({ eventos: [{ ...EVENTO_BALANCE, id: 'evt-ultimo' }] }));
    await usuario.click(boton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
    });
    const llamadas = mock.llamadasA('GET /api/v1/eventos');
    const [urlUltima] = llamadas.at(-1)!;
    const url = new URL(String(urlUltima));
    expect(url.searchParams.get('desplazamiento')).toBe('50');
  });
});
