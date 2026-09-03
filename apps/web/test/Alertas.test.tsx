/**
 * Radar de alertas (tarea 104, pantalla 8 de 12).
 *
 * No hay ruta de alta — la tabla la alimenta el sistema, no un usuario a
 * mano — así que los tests cubren lectura, resumen por criticidad y cierre
 * con motivo, incluida una alerta sin `clienteId` (un cambio de tasa, un
 * acceso), que la pantalla tiene que poder mostrar sin reventar.
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

const ALERTA_VENCIMIENTO = {
  id: 'alerta-1',
  clienteId: 'cli-garso',
  periodo: null,
  origen: 'VENCIMIENTO',
  criticidad: 'CRITICA',
  titulo: 'Vencimiento sin presentar',
  detalle: 'Presentación anual ante Abogacía vencida hace 3 días.',
  entidadRelacionada: 'vencimiento',
  entidadRelacionadaId: 'venc-1',
  responsableId: null,
  fechaLimite: '2026-04-28',
  estado: 'ABIERTA',
  cerradaPorUsuarioId: null,
  cerradaEn: null,
  motivoCierre: null,
};

const ALERTA_SIN_CLIENTE = {
  id: 'alerta-2',
  clienteId: null,
  periodo: null,
  origen: 'REGLA_IMPOSITIVA',
  criticidad: 'INFORMATIVA',
  titulo: 'Tasa de IVA actualizada',
  detalle: 'Se dio de alta una nueva regla de IVA 10%.',
  entidadRelacionada: 'regla_impositiva',
  entidadRelacionadaId: 'regla-1',
  responsableId: null,
  fechaLimite: null,
  estado: 'ABIERTA',
  cerradaPorUsuarioId: null,
  cerradaEn: null,
  motivoCierre: null,
};

const RESUMEN = { CRITICA: 1, ALTA: 0, MEDIA: 0, INFORMATIVA: 1 };

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
  mock.mockDeRuta('GET /api/v1/alertas', () =>
    respuestaJson({ resumen: RESUMEN, alertas: [ALERTA_VENCIMIENTO, ALERTA_SIN_CLIENTE] }),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Alertas = (await import('../src/pantallas/Alertas.js')).default;

  render(
    <ProveedorDeSesion>
      <Alertas />
    </ProveedorDeSesion>,
  );

  await screen.findByText('Vencimiento sin presentar');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('radar de alertas', () => {
  it('muestra el radar con los datos que manda el servidor', async () => {
    await montar();

    expect(screen.getByText('GARSO S.A.')).toBeVisible();
    expect(screen.getByText('Crítica')).toBeVisible();
    expect(screen.getByText('Presentación anual ante Abogacía vencida hace 3 días.')).toBeVisible();
  });

  it('el resumen por criticidad viene del servidor, no de un conteo hecho en la pantalla', async () => {
    await montar();

    const indicadorCriticas = screen.getByText('Críticas').closest('div')!;
    expect(indicadorCriticas.textContent).toContain('1');
  });

  it('una alerta sin clienteId se muestra sin reventar', async () => {
    await montar();

    expect(screen.getByText('Tasa de IVA actualizada')).toBeVisible();
    expect(screen.getByText('Informativa')).toBeVisible();
  });

  it('un rol de solo lectura no ve el botón de cerrar', async () => {
    await montar('solo_lectura');

    expect(screen.queryByRole('button', { name: /Cerrar alerta/ })).not.toBeInTheDocument();
  });

  it('auxiliar tampoco ve el botón de cerrar (solo ver, sin cerrar, en la matriz de RBAC)', async () => {
    await montar('auxiliar');

    expect(screen.queryByRole('button', { name: /Cerrar alerta/ })).not.toBeInTheDocument();
  });

  it('coordinador puede cerrar una alerta con motivo', async () => {
    await montar('coordinador');
    vi.spyOn(window, 'prompt').mockReturnValue('Ya se presentó ante Abogacía, se confirmó con el cliente.');

    mock.mockDeRuta('POST /api/v1/alertas/alerta-1/cerrar', () =>
      respuestaJson({ alerta: { ...ALERTA_VENCIMIENTO, estado: 'CERRADA' } }),
    );
    mock.mockDeRuta('GET /api/v1/alertas', () =>
      respuestaJson({ resumen: { CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 1 }, alertas: [ALERTA_SIN_CLIENTE] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Cerrar alerta: Vencimiento sin presentar' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/alertas/alerta-1/cerrar')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/alertas/alerta-1/cerrar')[0]!;
    expect(JSON.parse(String(opciones?.body))).toEqual({
      motivoCierre: 'Ya se presentó ante Abogacía, se confirmó con el cliente.',
    });
  });

  it('cancelar el prompt de cierre (sin motivo) no llama al servidor', async () => {
    await montar();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    await usuario.click(screen.getByRole('button', { name: 'Cerrar alerta: Vencimiento sin presentar' }));

    expect(mock.llamadasA('POST /api/v1/alertas/alerta-1/cerrar')).toHaveLength(0);
  });
});
