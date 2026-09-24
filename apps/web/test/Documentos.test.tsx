/**
 * Pantalla Documentos / IVA (tarea 104, pantalla 3 de 12).
 *
 * El período por defecto se calcula con `hoyEnParaguay(new Date())`, igual
 * que en la pantalla real — se usa la misma función acá para saber qué ruta
 * mockear sin depender de una fecha fija que se desactualice.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const SIN_PROCESO = { ...GARSO, id: 'cli-sinproceso', nombre: 'CLIENTE SIN PROCESO S.A.' };

const PROCESO_GARSO = {
  id: 'proc-1',
  clienteId: 'cli-garso',
  periodo: PERIODO,
  comprobantesRetirados: true,
  fechaRetiro: `${PERIODO}-05`,
  documentosRecibidos: 12,
  documentosFaltantes: 2,
  documentosObservados: 0,
  comprasCargadasSiga: true,
  ventasCargadasSiga: false,
  retencionesCargadas: false,
  extractosRecibidos: false,
  conciliacionBancariaRealizada: false,
  ivaRevisado: false,
  ivaSaldoAPagar: '1500000',
  ivaSaldoAFavor: null,
  liquidacionGenerada: false,
  liquidacionEnviada: false,
  balanceAplica: false,
  estadoGeneral: 'PARCIAL',
  riesgo: 'MEDIO',
  proximaAccion: 'Pedir extractos bancarios',
  fechaLimiteInterna: null,
  observaciones: null,
};

const DOCUMENTO_GARSO = {
  id: 'doc-1',
  clienteId: 'cli-garso',
  periodo: PERIODO,
  tipo: 'FACTURA_COMPRA',
  canalRecepcion: 'ONEDRIVE',
  recibidoEn: `${PERIODO}-10T12:00:00.000Z`,
  rucEmisor: '80019012-2',
  timbrado: '12345678',
  numeroComprobante: '001-001-0000001',
  total: '1100000',
  tasa: 'DIEZ',
  anulado: false,
  estado: 'RECIBIDO',
  motivoRechazo: null,
  evidenciaId: null,
  observaciones: null,
};

/**
 * El nombre del cliente aparece en dos lugares desde que la tarjeta de
 * documentos tiene su propio selector: en el tablero de arriba y en el
 * <select>. Estas consultas apuntan siempre al tablero.
 */
function filaDelTablero(nombre: string): HTMLElement {
  const tablero = screen.getByRole("table", { name: "Proceso mensual por cliente" });
  return within(tablero).getByText(nombre);
}

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

async function montar(rol: string = 'direccion', documentos: readonly unknown[] = [DOCUMENTO_GARSO]) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, SIN_PROCESO] }));
  mock.mockDeRuta(`GET /api/v1/proceso-mensual/${PERIODO}`, () =>
    respuestaJson({
      periodo: PERIODO,
      procesos: [PROCESO_GARSO],
      documentosReales: { 'cli-garso': 12, 'cli-sinproceso': 3 },
    }),
  );
  mock.mockDeRuta('GET /api/v1/clientes/cli-garso/documentos', () =>
    respuestaJson({ documentos }),
  );
  mock.mockDeRuta('GET /api/v1/clientes/cli-sinproceso/documentos', () =>
    respuestaJson({ documentos: [] }),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Documentos = (await import('../src/pantallas/Documentos.js')).default;

  render(
    <ProveedorDeSesion>
      <Documentos />
    </ProveedorDeSesion>,
  );

  await screen.findAllByText('GARSO S.A.');
  // Esperar a que el rol ya se haya aplicado antes de que el test siga.
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de documentos / IVA', () => {
  it('el tablero muestra el proceso de cada cliente, y "Sin iniciar" para el que no tiene fila', async () => {
    await montar();

    const filaGarso = filaDelTablero('GARSO S.A.').closest('tr')!;
    expect(within(filaGarso).getByText('PARCIAL')).toBeVisible();

    const filaSinProceso = filaDelTablero('CLIENTE SIN PROCESO S.A.').closest('tr')!;
    expect(within(filaSinProceso).getByText('Sin iniciar')).toBeVisible();
  });

  it('un cliente "Sin iniciar" igual muestra sus documentos recibidos reales, contados desde el servidor', async () => {
    await montar();

    const filaSinProceso = filaDelTablero('CLIENTE SIN PROCESO S.A.').closest('tr')!;
    expect(within(filaSinProceso).getByText('3')).toBeVisible();
  });

  it('el saldo de IVA se muestra formateado, no como el número crudo del servidor', async () => {
    await montar();

    expect(screen.getByText('Gs. 1.500.000 a pagar')).toBeVisible();
  });

  it('seleccionar una fila carga los documentos de ese cliente', async () => {
    await montar();

    await usuario.click(filaDelTablero('GARSO S.A.'));

    expect(await screen.findByText('Documentos — GARSO S.A.')).toBeVisible();
    expect(screen.getByText('80019012-2 · 12345678 · 001-001-0000001')).toBeVisible();
  });

  /*
   * Daniel, 2026-09-21: «los documentos por cliente solo dicen si son IVA,
   * Libro de venta, Extracto… ¿cómo controlo qué está y qué no está cargado?
   * Deben aparecer los nombres tal y como se cargan en el sistema».
   */
  it('cada documento muestra el nombre con que está guardado el archivo', async () => {
    await montar('direccion', [
      { ...DOCUMENTO_GARSO, id: 'd1', evidenciaId: 'ev1', nombreArchivo: 'DDJJ IVA 032026 GARSO SA.pdf' },
      { ...DOCUMENTO_GARSO, id: 'd2', numeroComprobante: null, rucEmisor: null, timbrado: null, total: null, tasa: null, evidenciaId: null, nombreArchivo: null },
    ]);

    await usuario.click(filaDelTablero('GARSO S.A.'));

    const enlace = await screen.findByRole('link', { name: /DDJJ IVA 032026 GARSO SA\.pdf/ });
    expect(enlace).toHaveAttribute('href', expect.stringContaining('/api/v1/documentos/d1/archivo'));
    expect(enlace).toHaveAttribute('title', 'DDJJ IVA 032026 GARSO SA.pdf');
  });

  it('abrir el panel de un cliente sin proceso precarga el formulario vacío, no undefined', async () => {
    await montar();

    await usuario.click(filaDelTablero('CLIENTE SIN PROCESO S.A.'));

    expect(await screen.findByLabelText('Documentos recibidos')).toHaveValue(0);
    expect(screen.getByLabelText('Estado general')).toHaveValue('PENDIENTE');
  });

  it('un rol sin permiso de edición no ve el panel de proceso mensual', async () => {
    await montar('revisor_balance');

    await usuario.click(filaDelTablero('GARSO S.A.'));

    expect(await screen.findByText('Documentos — GARSO S.A.')).toBeVisible();
    expect(screen.queryByLabelText('Estado general')).not.toBeInTheDocument();
  });

  it('un rol que no es dirección no ve ningún botón de escritura (2026-09-24)', async () => {
    await montar('auxiliar');

    await usuario.click(filaDelTablero('GARSO S.A.'));

    expect(await screen.findByText('Documentos — GARSO S.A.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /cargado en SIGA/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo documento' })).not.toBeInTheDocument();
  });

  it('guardar el proceso mensual manda el saldo de IVA como texto, no como número', async () => {
    await montar();

    await usuario.click(filaDelTablero('GARSO S.A.'));
    await screen.findByLabelText('Estado general');

    mock.mockDeRuta(`PUT /api/v1/clientes/cli-garso/proceso-mensual/${PERIODO}`, () =>
      respuestaJson({ proceso: { ...PROCESO_GARSO, estadoGeneral: 'COMPLETO' } }),
    );
    mock.mockDeRuta(`GET /api/v1/proceso-mensual/${PERIODO}`, () =>
      respuestaJson({ periodo: PERIODO, procesos: [{ ...PROCESO_GARSO, estadoGeneral: 'COMPLETO' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Guardar proceso mensual' }));

    await waitFor(() => {
      expect(mock.llamadasA(`PUT /api/v1/clientes/cli-garso/proceso-mensual/${PERIODO}`)).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA(`PUT /api/v1/clientes/cli-garso/proceso-mensual/${PERIODO}`)[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.ivaSaldoAPagar).toBe('1500000');
    expect(typeof cuerpo.ivaSaldoAPagar).toBe('string');
    expect(cuerpo.ivaSaldoAFavor).toBeNull();
  });

  it('marcar un documento como cargado en SIGA llama a la ruta de cambio de estado', async () => {
    await montar();

    await usuario.click(filaDelTablero('GARSO S.A.'));
    await screen.findByText('80019012-2 · 12345678 · 001-001-0000001');

    mock.mockDeRuta('PATCH /api/v1/documentos/doc-1/estado', () =>
      respuestaJson({ documento: { ...DOCUMENTO_GARSO, estado: 'CARGADO_EN_SIGA' } }),
    );

    await usuario.click(screen.getByRole('button', { name: /cargado en SIGA/ }));

    await waitFor(() => {
      expect(mock.llamadasA('PATCH /api/v1/documentos/doc-1/estado')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('PATCH /api/v1/documentos/doc-1/estado')[0]!;
    expect(JSON.parse(String(opciones?.body))).toEqual({ estado: 'CARGADO_EN_SIGA', motivoRechazo: null });
  });

  it('rechazar un documento pide el motivo y lo manda en el cuerpo', async () => {
    await montar();
    vi.spyOn(window, 'prompt').mockReturnValue('Falta la firma del RUC.');

    await usuario.click(filaDelTablero('GARSO S.A.'));
    await screen.findByText('80019012-2 · 12345678 · 001-001-0000001');

    mock.mockDeRuta('PATCH /api/v1/documentos/doc-1/estado', () =>
      respuestaJson({ documento: { ...DOCUMENTO_GARSO, estado: 'RECHAZADO' } }),
    );

    await usuario.click(screen.getByRole('button', { name: /^Rechazar/ }));

    await waitFor(() => {
      expect(mock.llamadasA('PATCH /api/v1/documentos/doc-1/estado')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('PATCH /api/v1/documentos/doc-1/estado')[0]!;
    expect(JSON.parse(String(opciones?.body))).toEqual({
      estado: 'RECHAZADO',
      motivoRechazo: 'Falta la firma del RUC.',
    });
  });

  it('el período se elige con un selector de mes, no escribiendo texto', async () => {
    await montar();

    expect(screen.getByLabelText('Mes')).toHaveAttribute('type', 'month');
  });

  it('elegir otro mes recarga el tablero con ese período', async () => {
    await montar();

    mock.mockDeRuta('GET /api/v1/proceso-mensual/2026-04', () =>
      respuestaJson({ periodo: '2026-04', procesos: [] }),
    );

    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-04' } });

    await waitFor(() => {
      expect(mock.llamadasA('GET /api/v1/proceso-mensual/2026-04')).toHaveLength(1);
    });
  });

  // El bug real: el campo era texto libre y cada tecla disparaba la petición,
  // así que borrarlo mandaba un período incompleto y el servidor respondía
  // "Los datos enviados no son válidos" sin forma de corregirlo desde la
  // pantalla. Ahora un período inválido no llega a salir del navegador.
  // Con el filtro de fechas (2026-09-15) un mes borrado se ignora: se sigue
  // mostrando el último mes válido en vez de vaciar la pantalla.
  it('borrar el período no dispara ninguna petición al servidor', async () => {
    await montar();
    const llamadasPrevias = mock.fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '' } });

    expect(mock.fetchMock.mock.calls.length).toBe(llamadasPrevias);
    expect(screen.getAllByText('GARSO S.A.').length).toBeGreaterThan(0);
  });

  /*
   * Daniel, 2026-09-15: buscar también por "últimos 15, 30, 60 o 90 días". Fuera
   * de "Por mes", los documentos se filtran por la fecha en que se recibieron,
   * así que se piden sin período.
   */
  it('con "últimos 30 días" los documentos se piden sin período y se filtran por fecha de recepción', async () => {
    await montar();
    await usuario.click(filaDelTablero('GARSO S.A.'));

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'ultimos-30' } });

    await waitFor(() => {
      const llamadas = mock.fetchMock.mock.calls
        .map(([url]) => new URL(String(url)))
        .filter((u) => u.pathname.endsWith('/documentos'));
      expect(llamadas.at(-1)!.searchParams.get('periodo')).toBeNull();
    });
    expect(screen.getByText(/Recibidos últimos 30 días/)).toBeVisible();
  });

  it('cancelar el rechazo (sin escribir motivo) no llama al servidor', async () => {
    await montar();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    await usuario.click(filaDelTablero('GARSO S.A.'));
    await screen.findByText('80019012-2 · 12345678 · 001-001-0000001');

    await usuario.click(screen.getByRole('button', { name: /^Rechazar/ }));

    expect(mock.llamadasA('PATCH /api/v1/documentos/doc-1/estado')).toHaveLength(0);
  });
});
