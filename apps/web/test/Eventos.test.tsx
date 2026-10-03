/**
 * Pantalla de Eventos / event log (tarea 104, pantalla 11 de 12).
 *
 * Solo lectura — no hay RBAC de botones que probar acá, la pantalla entera
 * es inaccesible para quien no tenga `evento:ver` (el servidor da 403 antes
 * de que la pantalla llegue a dibujar nada).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { describirFiltro } from '@effort/core';

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
  descargarReporte.mockClear();
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
  usuario = userEvent.setup();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(
  rol: string = 'direccion',
  opciones: { clientes?: readonly unknown[]; eventos?: readonly unknown[] } = {},
) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: opciones.clientes ?? [GARSO] }));
  mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [USUARIO_LAURA] }));
  mock.mockDeRuta('GET /api/v1/eventos', () => respuestaJson({ eventos: opciones.eventos ?? [EVENTO_BALANCE] }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Eventos = (await import('../src/pantallas/Eventos.js')).default;

  render(
    <ProveedorDeSesion>
      <Eventos />
    </ProveedorDeSesion>,
  );

  await screen.findByRole('table', { name: 'Historial de eventos' });
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de eventos', () => {
  describe('filtro por cliente (2026-10-02)', () => {
    const OTRO = { ...GARSO, id: 'cli-otro', nombre: 'OTRO S.A.', ruc: '80000001-1' };
    const DADO_DE_BAJA = { ...GARSO, id: 'cli-baja', nombre: 'EX CLIENTE S.A.', ruc: '80000002-2', activo: false };

    it('es el selector de las otras pantallas: manda el id al servidor y «Todos los clientes» lo vuelve a quitar', async () => {
      await montar('direccion', { clientes: [GARSO, OTRO] });
      expect(screen.getByRole('option', { name: 'Todos los clientes' })).toBeInTheDocument();

      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-otro');
      await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
      await waitFor(() => expect(mock.llamadasA('GET /api/v1/eventos')).toHaveLength(2));
      const [urlConCliente] = mock.llamadasA('GET /api/v1/eventos').at(-1)!;
      expect(new URL(String(urlConCliente)).searchParams.get('clienteId')).toBe('cli-otro');

      // Antes el «Todos» era un texto deshabilitado: una vez elegido un cliente no había cómo volver.
      await usuario.selectOptions(await screen.findByLabelText('Cliente'), '');
      await usuario.click(await screen.findByRole('button', { name: 'Buscar' }));
      await waitFor(() => expect(mock.llamadasA('GET /api/v1/eventos')).toHaveLength(3));
      const [urlSinCliente] = mock.llamadasA('GET /api/v1/eventos').at(-1)!;
      expect(new URL(String(urlSinCliente)).searchParams.has('clienteId')).toBe(false);
    });

    it('sigue ofreciendo los clientes dados de baja: la bitácora guarda lo que pasó con todos', async () => {
      await montar('direccion', { clientes: [GARSO, DADO_DE_BAJA] });

      expect(screen.getByRole('option', { name: 'EX CLIENTE S.A.' })).toBeInTheDocument();
    });
  });

  describe('Excel (2026-10-02)', () => {
    const OTRO = { ...GARSO, id: 'cli-otro', nombre: 'OTRO S.A.', ruc: '80000001-1' };
    const APROBACION = { ...EVENTO_BALANCE, usuarioId: 'usr-1' };
    const DEL_SISTEMA = {
      id: 'evt-2',
      usuarioId: null,
      accion: 'vencimiento.generados_del_periodo',
      entidad: 'vencimiento',
      entidadId: null,
      clienteId: null,
      datosAntes: null,
      datosDespues: { creados: 3, periodo: '2026-09' },
      ipTruncada: null,
      agenteUsuario: null,
      peticionId: null,
      ocurridoEn: '2026-08-16T12:00:00.000Z',
    };

    function reporteDescargado(n: number) {
      const [reporte, detalle] = descargarReporte.mock.calls[n] as unknown as [Reporte, string | null];
      return { reporte, detalle };
    }

    it('descarga el historial tal como se ve, con los filtros de la última búsqueda y no los que se están escribiendo', async () => {
      await montar('direccion', { clientes: [GARSO, OTRO], eventos: [APROBACION, DEL_SISTEMA] });

      // Todavía sin buscar: el Excel trae lo que está a la vista, los dos eventos, sin filtro de cliente.
      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-garso');
      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));
      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const sinBuscar = reporteDescargado(0);
      expect(sinBuscar.detalle).toBeNull();
      expect(sinBuscar.reporte.filtros).toContain('Cliente: todos');
      expect(celdas(sinBuscar.reporte.hojas[0] as HojaDeReporte)).toHaveLength(2);

      // Con filtros aplicados.
      await usuario.type(screen.getByLabelText('Entidad'), 'balance');
      await usuario.selectOptions(screen.getByLabelText('Mostrar'), 'dia');
      fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-08-15' } });
      mock.mockDeRuta('GET /api/v1/eventos', () => respuestaJson({ eventos: [APROBACION] }));
      await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
      await screen.findByRole('table', { name: 'Historial de eventos' });
      await waitFor(() => expect(screen.getByText(/^1 eventos/)).toBeVisible());

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(2));
      const { reporte, detalle } = reporteDescargado(1);
      expect(detalle).toBe('GARSO S.A.');
      expect(reporte.titulo).toBe('Eventos');
      expect(reporte.filtros).toEqual([
        'Cliente: GARSO S.A.',
        `Fechas: ${describirFiltro({ tipo: 'dia', fecha: '2026-08-15' })}`,
        'Entidad: balance',
      ]);
      expect(reporte.hojas.map((h) => h.nombre)).toEqual(['Eventos']);
      const [eventos] = reporte.hojas as [HojaDeReporte];
      expect(eventos.columnas.map((c) => c.titulo)).toEqual([
        'Fecha y hora', 'Usuario', 'Acción', 'Código de la acción', 'Entidad', 'Cliente', 'Detalle',
      ]);
      expect(celdas(eventos)).toEqual([
        [
          new Date('2026-08-15T13:30:00.000Z').toLocaleString('es-PY'),
          'Laura Sosa',
          'Aprobó un balance',
          'balance.aprobado',
          'balance',
          'GARSO S.A.',
          'Antes: estado: LISTO_PARA_REVISION | Después: estado: APROBADO',
        ],
      ]);
    });

    it('un evento del sistema, sin cliente, sale con «El sistema», su frase y el detalle en palabras', async () => {
      await montar('direccion', { eventos: [DEL_SISTEMA] });

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const { reporte } = reporteDescargado(0);
      const [eventos] = reporte.hojas as [HojaDeReporte];
      expect(celdas(eventos)).toEqual([
        [
          new Date('2026-08-16T12:00:00.000Z').toLocaleString('es-PY'),
          'El sistema',
          'Generó los vencimientos del período',
          'vencimiento.generados_del_periodo',
          'vencimiento',
          null,
          'creados: 3 · período: 2026-09',
        ],
      ]);
    });

    it('si la pantalla dice «hay más», el reporte lo dice: solo trae lo cargado', async () => {
      const llenos = Array.from({ length: 50 }, (_, i) => ({ ...EVENTO_BALANCE, id: `evt-${i}` }));
      await montar('direccion', { eventos: llenos });

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const { reporte } = reporteDescargado(0);
      expect(reporte.filtros).toContain('Solo los 50 eventos cargados en pantalla; hay más');
      expect(celdas(reporte.hojas[0] as HojaDeReporte)).toHaveLength(50);
    });
  });

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
