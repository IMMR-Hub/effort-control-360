/**
 * Panel general (tarea 104, pantalla 12 de 12 — la última).
 *
 * Solo lectura, agrega vencimientos/alertas/solicitudes/balances/liquidaciones
 * ya construidos en las pantallas anteriores. Todos los roles tienen `ver`
 * sobre los seis recursos que combina (a diferencia de Reglas/Eventos), así
 * que no hay un caso de RBAC parcial que cubrir acá.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const VENCIMIENTO_VENCIDO = {
  id: 'venc-1',
  clienteId: 'cli-garso',
  tipoDocumento: 'CONSTANCIA',
  descripcion: 'Presentación anual ante Abogacía',
  entidad: 'Abogacía del Tesoro',
  fechaEmision: null,
  fechaVencimiento: '2026-04-20',
  fechaPresentacion: null,
  responsableId: null,
  estado: 'VENCIDO',
  riesgo: 'CRITICO',
  evidenciaId: null,
  proximaAccion: null,
  diasRestantes: -2,
  nivelAlerta: 'VENCIDO',
};

const ALERTA_CRITICA = {
  id: 'alerta-1',
  clienteId: 'cli-garso',
  periodo: null,
  origen: 'VENCIMIENTO',
  criticidad: 'CRITICA',
  titulo: 'Vencimiento sin presentar',
  detalle: 'Presentación anual ante Abogacía vencida.',
  entidadRelacionada: 'vencimiento',
  entidadRelacionadaId: 'venc-1',
  responsableId: null,
  fechaLimite: '2026-04-20',
  estado: 'ABIERTA',
  cerradaPorUsuarioId: null,
  cerradaEn: null,
  motivoCierre: null,
};

const SOLICITUD_ABIERTA = {
  id: 'sol-1',
  clienteId: 'cli-garso',
  periodo: '2026-04',
  estado: 'ABIERTA',
  cuentaDesde: '2026-04-01',
  recordatoriosEnviados: 1,
  ultimoRecordatorioEn: '2026-04-05T09:00:00.000Z',
  reglaId: null,
};

const BALANCE_PENDIENTE = {
  id: 'bal-1',
  clienteId: 'cli-garso',
  periodo: '2026-04',
  activo: '100000000',
  pasivo: '40000000',
  patrimonioNeto: '60000000',
  resultadoEjercicio: '5000000',
  estado: 'LISTO_PARA_REVISION',
  preparadoPorUsuarioId: 'u1',
  aprobadoPorUsuarioId: null,
  aprobadoEn: null,
  inconsistencias: [],
  proximaAccion: null,
};

const LIQUIDACION_PENDIENTE = {
  id: 'liq-1',
  clienteId: 'cli-garso',
  periodo: '2026-04',
  tipo: 'IVA',
  estado: 'GENERADA',
  canal: null,
  destinatario: null,
  fechaEnvio: null,
  respondidaEn: null,
  respuesta: null,
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
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, CLIENTE_INACTIVO] }));
  mock.mockDeRuta('GET /api/v1/vencimientos', () =>
    respuestaJson({
      hoy: { anio: 2026, mes: 4, dia: 22 },
      resumen: { VENCIDO: 1, CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0, SIN_ALERTA: 0 },
      vencimientos: [VENCIMIENTO_VENCIDO],
    }),
  );
  mock.mockDeRuta('GET /api/v1/alertas', () =>
    respuestaJson({ resumen: { CRITICA: 1, ALTA: 0, MEDIA: 0, INFORMATIVA: 0 }, alertas: [ALERTA_CRITICA] }),
  );
  mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () => respuestaJson({ solicitudes: [SOLICITUD_ABIERTA] }));
  mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [BALANCE_PENDIENTE] }));
  mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones: [LIQUIDACION_PENDIENTE] }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Panel = (await import('../src/pantallas/Panel.js')).default;

  render(
    <ProveedorDeSesion>
      <Panel />
    </ProveedorDeSesion>,
  );

  await screen.findByText('Panel general');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('panel general', () => {
  it('los indicadores se calculan sobre los datos ya traídos, no sobre un número escrito a mano', async () => {
    await montar();

    await waitFor(() => {
      expect(screen.getByText('Clientes activos').closest('div')!.textContent).toContain('1');
    });
    expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('1');
    expect(screen.getByText('Alertas críticas').closest('div')!.textContent).toContain('1');
    expect(screen.getByText('Documentación pendiente').closest('div')!.textContent).toContain('1');
    expect(screen.getByText('Balances sin aprobar').closest('div')!.textContent).toContain('1');
    expect(screen.getByText('Liquidaciones sin enviar').closest('div')!.textContent).toContain('1');
  });

  it('muestra las alertas y vencimientos más urgentes con el nombre del cliente', async () => {
    await montar();

    const tablaAlertas = within(screen.getByRole('table', { name: 'Alertas más urgentes' }));
    expect(tablaAlertas.getByText('GARSO S.A.')).toBeVisible();
    expect(tablaAlertas.getByText('Vencimiento sin presentar')).toBeVisible();

    const tablaVencimientos = within(screen.getByRole('table', { name: 'Vencimientos más urgentes' }));
    expect(tablaVencimientos.getByText('Presentación anual ante Abogacía')).toBeVisible();
    expect(tablaVencimientos.getByText('-2')).toBeVisible();
  });

  it('cambiar el período vuelve a pedir solicitudes, balances y liquidaciones de ese período', async () => {
    await montar();

    mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () => respuestaJson({ solicitudes: [] }));
    mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [] }));
    mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones: [] }));

    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2026-05' } });

    await waitFor(() => {
      const llamadas = mock.llamadasA('GET /api/v1/solicitudes-documentacion');
      const [url] = llamadas.at(-1)!;
      expect(new URL(String(url)).searchParams.get('periodo')).toBe('2026-05');
    });
  });

  it('sin alertas ni vencimientos urgentes, muestra el mensaje en vez de una tabla vacía muda', async () => {
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({ usuarioId: 'u1', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
    );
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
    mock.mockDeRuta('GET /api/v1/vencimientos', () =>
      respuestaJson({
        hoy: { anio: 2026, mes: 4, dia: 22 },
        resumen: { VENCIDO: 0, CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0, SIN_ALERTA: 0 },
        vencimientos: [],
      }),
    );
    mock.mockDeRuta('GET /api/v1/alertas', () => respuestaJson({ resumen: { CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0 }, alertas: [] }));
    mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () => respuestaJson({ solicitudes: [] }));
    mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [] }));
    mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones: [] }));

    vi.resetModules();
    const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
    const Panel = (await import('../src/pantallas/Panel.js')).default;

    render(
      <ProveedorDeSesion>
        <Panel />
      </ProveedorDeSesion>,
    );

    expect(await screen.findAllByText('Nada urgente por ahora.')).toHaveLength(2);
  });
});
