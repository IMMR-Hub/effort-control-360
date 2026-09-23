/**
 * Planilla de horas (tarea 144).
 *
 * Lo que importa acá: que cada quien cargue solo lo suyo, que el resumen del
 * equipo aparezca únicamente para dirección y diga en voz alta que son horas
 * autoreportadas, y que el tiempo interno viaje como `null` — no como una
 * cadena inventada.
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
  canalPreferido: null,
  carpetaOneDriveId: null,
  activo: true,
  observaciones: null,
};
const COPESA = { ...GARSO, id: 'cli-copesa', nombre: 'COPESA CONSTRUCCIONES SA', ruc: '80003112-1' };

const ANA = {
  id: 'usr-ana', nombre: 'Ana', apellido: 'Martínez', email: 'ana@effort.com.py', telefono: null,
  cargo: null, rol: 'responsable', activo: true, veTodosLosClientes: false, ultimoAccesoEn: null,
};
const SANDRA = { ...ANA, id: 'usr-sandra', nombre: 'Sandra', apellido: 'Ferreira', email: 'sandra@effort.com.py' };

const MI_REGISTRO = {
  id: 'reg-1', usuarioId: 'usr-ana', clienteId: 'cli-garso',
  fecha: '2026-09-20T00:00:00.000Z', minutos: 150, tarea: 'Carga de documentos',
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

const TOTALES_POR_DEFECTO = [
  { usuarioId: 'usr-ana', clienteId: 'cli-garso', minutos: 150, costoGs: '500000' },
  { usuarioId: 'usr-ana', clienteId: null, minutos: 30, costoGs: '100000' },
  { usuarioId: 'usr-sandra', clienteId: 'cli-garso', minutos: 90, costoGs: '300000' },
  { usuarioId: 'usr-sandra', clienteId: 'cli-copesa', minutos: 240, costoGs: '800000' },
];

async function montar(rol: string = 'responsable', totales: readonly unknown[] = TOTALES_POR_DEFECTO) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'usr-ana', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, COPESA] }));
  mock.mockDeRuta('GET /api/v1/horas', () => respuestaJson({ registros: [MI_REGISTRO] }));
  mock.mockDeRuta('GET /api/v1/horas/resumen', () => respuestaJson({ totales }));
  mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [ANA, SANDRA] }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Horas = (await import('../src/pantallas/Horas.js')).default;

  render(
    <ProveedorDeSesion>
      <Horas />
    </ProveedorDeSesion>,
  );

  await screen.findByRole('heading', { name: 'Planilla de horas' });
  // El rol llega de forma asíncrona (GET /api/v1/yo): se espera a que la UI ya
  // lo haya aplicado antes de seguir, para no leer un estado a mitad de resolver.
  await waitFor(() => {
    if (rol === 'direccion') {
      expect(screen.getByRole('heading', { name: 'Resumen del equipo' })).toBeVisible();
    } else {
      expect(mock.llamadasA('GET /api/v1/yo').length).toBeGreaterThan(0);
    }
  });
}

describe('formatearMinutos', () => {
  it('muestra horas y minutos como se piensan, no como se guardan', async () => {
    const { formatearMinutos } = await import('../src/pantallas/Horas.js');

    expect(formatearMinutos(150)).toBe('2 h 30 min');
    expect(formatearMinutos(60)).toBe('1 h');
    expect(formatearMinutos(45)).toBe('45 min');
    expect(formatearMinutos(65)).toBe('1 h 05 min');
    expect(formatearMinutos(0)).toBe('0 h');
  });
});

describe('planilla de horas', () => {
  it('un responsable ve su formulario y sus horas, pero no el resumen del equipo', async () => {
    await montar('responsable');

    expect(screen.getByLabelText('Cliente')).toBeVisible();
    expect(screen.getByRole('table', { name: 'Mis horas del período' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Resumen del equipo' })).not.toBeInTheDocument();
    // Y ni siquiera se le pide al servidor: no hay nada que ocultar del lado del cliente.
    expect(mock.llamadasA('GET /api/v1/horas/resumen')).toHaveLength(0);
  });

  it('muestra las horas propias con el cliente por nombre y el tiempo formateado', async () => {
    await montar('responsable');

    const tabla = screen.getByRole('table', { name: 'Mis horas del período' });
    expect(within(tabla).getByText('GARSO S.A.')).toBeVisible();
    expect(within(tabla).getByText('2 h 30 min')).toBeVisible();
    expect(within(tabla).getByText('Carga de documentos')).toBeVisible();
  });

  it('dirección ve el resumen con personas y clientes por nombre, y el aviso de que son horas autoreportadas', async () => {
    await montar('direccion');

    const porCliente = screen.getByRole('table', { name: 'Horas por cliente' });
    // GARSO: 150 + 90 = 240 min = 4 h; COPESA: 240 min = 4 h; interno: 30 min.
    expect(within(porCliente).getByText('Tiempo interno (sin cliente)')).toBeVisible();

    const porPersona = screen.getByRole('table', { name: 'Horas por colaborador' });
    // Ana: 150 + 30 = 180 min = 3 h; Sandra: 90 + 240 = 330 min = 5 h 30 min.
    expect(within(porPersona).getByText('Ana Martínez')).toBeVisible();
    expect(within(porPersona).getByText('5 h 30 min')).toBeVisible();

    expect(screen.getByText(/autoreportadas/)).toBeVisible();
  });

  it('el resumen muestra el costo en guaraníes, sumado sin perder precisión', async () => {
    await montar('direccion');

    // Costo del equipo: 500.000 + 100.000 + 300.000 + 800.000 = 1.700.000.
    expect(screen.getByText('Gs. 1.700.000')).toBeVisible();

    const porPersona = screen.getByRole('table', { name: 'Horas por colaborador' });
    // Sandra: 300.000 (GARSO) + 800.000 (COPESA) = 1.100.000.
    expect(within(porPersona).getByText('Gs. 1.100.000')).toBeVisible();
  });

  it('sin costo por hora configurado, muestra "—" en vez de inventar Gs. 0', async () => {
    await montar('direccion', [
      { usuarioId: 'usr-ana', clienteId: 'cli-garso', minutos: 150, costoGs: null },
    ]);

    const porCliente = screen.getByRole('table', { name: 'Horas por cliente' });
    expect(within(porCliente).getByText('—')).toBeVisible();
  });

  it('cargar horas manda los minutos enteros, el cliente y null en lo que quedó vacío', async () => {
    await montar('responsable');

    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-copesa');
    await usuario.type(screen.getByLabelText('Horas'), '2,5');

    mock.mockDeRuta('POST /api/v1/horas', () =>
      respuestaJson({ registro: { ...MI_REGISTRO, id: 'reg-2', clienteId: 'cli-copesa', minutos: 150 } }, { status: 201 }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Guardar horas' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/horas')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/horas')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    // 2,5 h con coma de teclado en español → 150 minutos enteros, no NaN.
    expect(cuerpo.minutos).toBe(150);
    expect(cuerpo.clienteId).toBe('cli-copesa');
    expect(cuerpo.tarea).toBeNull();
    expect(cuerpo.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(await screen.findByRole('status')).toHaveTextContent(/2 h 30 min/);
  });

  it('el tiempo interno viaja como clienteId null, no como el valor del selector', async () => {
    await montar('responsable');

    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'Tiempo interno (sin cliente)');
    await usuario.type(screen.getByLabelText('Horas'), '1');
    await usuario.type(screen.getByLabelText('Qué hiciste (opcional)'), 'Reunión de equipo');

    mock.mockDeRuta('POST /api/v1/horas', () =>
      respuestaJson({ registro: { ...MI_REGISTRO, clienteId: null, minutos: 60 } }, { status: 201 }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Guardar horas' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/horas')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/horas')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.clienteId).toBeNull();
    expect(cuerpo.minutos).toBe(60);
    expect(cuerpo.tarea).toBe('Reunión de equipo');
  });

  it('sin elegir cliente avisa y no llama al servidor', async () => {
    await montar('responsable');

    await usuario.type(screen.getByLabelText('Horas'), '2');
    await usuario.click(screen.getByRole('button', { name: 'Guardar horas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Elegí el cliente/);
    expect(mock.llamadasA('POST /api/v1/horas')).toHaveLength(0);
  });

  it('con horas en cero avisa y no llama al servidor', async () => {
    await montar('responsable');

    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-garso');
    await usuario.type(screen.getByLabelText('Horas'), '0');
    await usuario.click(screen.getByRole('button', { name: 'Guardar horas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mayor a cero/);
    expect(mock.llamadasA('POST /api/v1/horas')).toHaveLength(0);
  });

  it('un error del servidor se muestra tal cual y no borra lo que la persona ya escribió', async () => {
    await montar('responsable');

    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-garso');
    await usuario.type(screen.getByLabelText('Horas'), '3');

    mock.mockDeRuta('POST /api/v1/horas', () =>
      respuestaJson(
        { error: 'sin_permiso', mensaje: 'No tenés permiso para realizar esta acción.' },
        { status: 403 },
      ),
    );

    await usuario.click(screen.getByRole('button', { name: 'Guardar horas' }));

    expect(await screen.findByText('No tenés permiso para realizar esta acción.')).toBeVisible();
    expect(screen.getByLabelText('Horas')).toHaveValue('3');
  });

  it('corregir precarga el formulario con el registro elegido', async () => {
    await montar('responsable');

    await usuario.click(
      screen.getByRole('button', { name: /Corregir horas del 2026-09-20 — GARSO S\.A\./ }),
    );

    expect(screen.getByLabelText('Cliente')).toHaveValue('cli-garso');
    // Con coma: es como se escribe en español, y el campo acepta las dos.
    expect(screen.getByLabelText('Horas')).toHaveValue('2,5');
    expect(screen.getByLabelText('Día')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('Qué hiciste (opcional)')).toHaveValue('Carga de documentos');
  });
});
