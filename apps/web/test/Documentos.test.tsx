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
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, SIN_PROCESO] }));
  mock.mockDeRuta(`GET /api/v1/proceso-mensual/${PERIODO}`, () =>
    respuestaJson({ periodo: PERIODO, procesos: [PROCESO_GARSO] }),
  );
  mock.mockDeRuta('GET /api/v1/clientes/cli-garso/documentos', () =>
    respuestaJson({ documentos: [DOCUMENTO_GARSO] }),
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

  await screen.findByText('GARSO S.A.');
  // Esperar a que el rol ya se haya aplicado antes de que el test siga.
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de documentos / IVA', () => {
  it('el tablero muestra el proceso de cada cliente, y "Sin iniciar" para el que no tiene fila', async () => {
    await montar();

    const filaGarso = screen.getByText('GARSO S.A.').closest('tr')!;
    expect(within(filaGarso).getByText('PARCIAL')).toBeVisible();

    const filaSinProceso = screen.getByText('CLIENTE SIN PROCESO S.A.').closest('tr')!;
    expect(within(filaSinProceso).getByText('Sin iniciar')).toBeVisible();
  });

  it('el saldo de IVA se muestra formateado, no como el número crudo del servidor', async () => {
    await montar();

    expect(screen.getByText('Gs. 1.500.000 a pagar')).toBeVisible();
  });

  it('seleccionar una fila carga los documentos de ese cliente', async () => {
    await montar();

    await usuario.click(screen.getByText('GARSO S.A.'));

    expect(await screen.findByText('Documentos — GARSO S.A.')).toBeVisible();
    expect(screen.getByText('80019012-2 · 12345678 · 001-001-0000001')).toBeVisible();
  });

  it('abrir el panel de un cliente sin proceso precarga el formulario vacío, no undefined', async () => {
    await montar();

    await usuario.click(screen.getByText('CLIENTE SIN PROCESO S.A.'));

    expect(await screen.findByLabelText('Documentos recibidos')).toHaveValue(0);
    expect(screen.getByLabelText('Estado general')).toHaveValue('PENDIENTE');
  });

  it('un rol sin permiso de edición no ve el panel de proceso mensual', async () => {
    await montar('revisor_balance');

    await usuario.click(screen.getByText('GARSO S.A.'));

    expect(await screen.findByText('Documentos — GARSO S.A.')).toBeVisible();
    expect(screen.queryByLabelText('Estado general')).not.toBeInTheDocument();
  });

  it('un rol sin permiso de edición tampoco ve los botones de cambiar estado del documento', async () => {
    await montar('auxiliar');

    await usuario.click(screen.getByText('GARSO S.A.'));

    expect(await screen.findByText('Documentos — GARSO S.A.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /cargado en SIGA/ })).not.toBeInTheDocument();
    // Pero sí puede dar de alta un documento nuevo.
    expect(screen.getByRole('button', { name: 'Nuevo documento' })).toBeVisible();
  });

  it('guardar el proceso mensual manda el saldo de IVA como texto, no como número', async () => {
    await montar();

    await usuario.click(screen.getByText('GARSO S.A.'));
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

    await usuario.click(screen.getByText('GARSO S.A.'));
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

    await usuario.click(screen.getByText('GARSO S.A.'));
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

    expect(screen.getByLabelText('Período')).toHaveAttribute('type', 'month');
  });

  it('elegir otro mes recarga el tablero con ese período', async () => {
    await montar();

    mock.mockDeRuta('GET /api/v1/proceso-mensual/2026-04', () =>
      respuestaJson({ periodo: '2026-04', procesos: [] }),
    );

    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2026-04' } });

    await waitFor(() => {
      expect(mock.llamadasA('GET /api/v1/proceso-mensual/2026-04')).toHaveLength(1);
    });
  });

  // El bug real: el campo era texto libre y cada tecla disparaba la petición,
  // así que borrarlo mandaba un período incompleto y el servidor respondía
  // "Los datos enviados no son válidos" sin forma de corregirlo desde la
  // pantalla. Ahora un período inválido no llega a salir del navegador.
  it('borrar el período no dispara ninguna petición al servidor', async () => {
    await montar();
    const llamadasPrevias = mock.fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText('GARSO S.A.')).not.toBeInTheDocument();
    });
    expect(mock.fetchMock.mock.calls.length).toBe(llamadasPrevias);
  });

  it('cancelar el rechazo (sin escribir motivo) no llama al servidor', async () => {
    await montar();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    await usuario.click(screen.getByText('GARSO S.A.'));
    await screen.findByText('80019012-2 · 12345678 · 001-001-0000001');

    await usuario.click(screen.getByRole('button', { name: /^Rechazar/ }));

    expect(mock.llamadasA('PATCH /api/v1/documentos/doc-1/estado')).toHaveLength(0);
  });
});
