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
  descargarReporte.mockClear();
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
  usuario = userEvent.setup();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(rol: string = 'direccion', alertas: readonly unknown[] = [ALERTA_VENCIMIENTO, ALERTA_SIN_CLIENTE], clientes: readonly unknown[] = [GARSO]) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes }));
  mock.mockDeRuta('GET /api/v1/alertas', () =>
    respuestaJson({ resumen: RESUMEN, alertas }),
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
  it('el filtro por cliente deja solo sus alertas, y cuenta solo esas (2026-10-01)', async () => {
    const OTRO = { ...GARSO, id: 'cli-otro', nombre: 'OTRO S.A.', ruc: '80000001-1' };
    const DEL_OTRO = { ...ALERTA_VENCIMIENTO, id: 'alerta-3', clienteId: 'cli-otro', criticidad: 'ALTA', titulo: 'Patente por vencer' };
    await montar('direccion', [ALERTA_VENCIMIENTO, ALERTA_SIN_CLIENTE, DEL_OTRO], [GARSO, OTRO]);
    expect(screen.getByText('Patente por vencer')).toBeVisible();

    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-garso');

    expect(screen.getByText('Vencimiento sin presentar')).toBeVisible();
    expect(screen.queryByText('Patente por vencer')).not.toBeInTheDocument();
    // Una alerta sin cliente no es de GARSO: tampoco aparece.
    expect(screen.queryByText('Tasa de IVA actualizada')).not.toBeInTheDocument();
    expect(screen.getByText('Altas').closest('div')!.textContent).toContain('0');
    expect(screen.getByText(/1 alertas activas .*cliente: GARSO S\.A\./)).toBeVisible();

    await usuario.selectOptions(screen.getByLabelText('Cliente'), '');
    expect(screen.getByText('Patente por vencer')).toBeVisible();
  });

  it('muestra el radar con los datos que manda el servidor', async () => {
    await montar();

    expect(screen.getByText('GARSO S.A.', { selector: 'td' })).toBeVisible();
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

  it('dirección puede cerrar una alerta con motivo', async () => {
    await montar('direccion');
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

  describe('Excel (2026-10-02)', () => {
    const OTRO = { ...GARSO, id: 'cli-otro', nombre: 'OTRO S.A.', ruc: '80000001-1' };
    const DEL_OTRO = {
      ...ALERTA_VENCIMIENTO,
      id: 'alerta-3',
      clienteId: 'cli-otro',
      criticidad: 'ALTA',
      titulo: 'Patente por vencer',
      detalle: 'La patente vence en 12 días.',
      origen: 'vencimiento_por_vencer',
      fechaLimite: '2026-10-20T00:00:00.000Z',
    };

    it('con un cliente elegido descarga solo sus alertas, con las etiquetas de pantalla y los filtros escritos', async () => {
      // Lo puede bajar cualquier rol que vea la pantalla: descargar es leer.
      await montar('solo_lectura', [ALERTA_VENCIMIENTO, ALERTA_SIN_CLIENTE, DEL_OTRO], [GARSO, OTRO]);
      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-otro');

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('OTRO S.A.');
      expect(reporte.titulo).toBe('Alertas');
      expect(reporte.filtros).toContain('Cliente: OTRO S.A.');
      expect(reporte.filtros).toContain('Fechas (cuando se levantó la alerta): todas las fechas');
      expect(reporte.hojas.map((h) => h.nombre)).toEqual(['Alertas']);
      const [alertas] = reporte.hojas as [HojaDeReporte];
      expect(alertas.columnas.map((c) => c.titulo)).toEqual([
        'Cliente', 'Criticidad', 'Título', 'Detalle', 'Origen', 'Vence',
      ]);
      expect(celdas(alertas)).toEqual([
        ['OTRO S.A.', 'Alta', 'Patente por vencer', 'La patente vence en 12 días.', 'Vencimiento', '2026-10-20'],
      ]);
      expect(alertas.columnas[5]!.formato).toBe('fecha');
    });

    it('sin filtro trae todas las alertas del radar; una sin cliente ni fecha queda con esas celdas vacías', async () => {
      const DEL_GARSO = { ...ALERTA_VENCIMIENTO, origen: 'vencimiento_por_vencer' };
      const SIN_CLIENTE = { ...ALERTA_SIN_CLIENTE, origen: 'libro_con_riesgo_de_multa' };
      await montar('direccion', [DEL_GARSO, SIN_CLIENTE]);

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBeNull();
      expect(reporte.filtros).toContain('Cliente: todos');
      const [alertas] = reporte.hojas as [HojaDeReporte];
      expect(celdas(alertas)).toEqual([
        ['GARSO S.A.', 'Crítica', 'Vencimiento sin presentar', 'Presentación anual ante Abogacía vencida hace 3 días.', 'Vencimiento', '2026-04-28'],
        [null, 'Informativa', 'Tasa de IVA actualizada', 'Se dio de alta una nueva regla de IVA 10%.', 'Libro RG 90', null],
      ]);
    });
  });
});
