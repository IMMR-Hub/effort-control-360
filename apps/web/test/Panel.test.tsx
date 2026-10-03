/**
 * Panel general (tarea 104, pantalla 12 de 12 — la última).
 *
 * Solo lectura, agrega vencimientos/alertas/solicitudes/balances/liquidaciones
 * ya construidos en las pantallas anteriores. Todos los roles tienen `ver`
 * sobre los seis recursos que combina (a diferencia de Reglas/Eventos), así
 * que no hay un caso de RBAC parcial que cubrir acá.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';
import type { HojaDeReporte, Reporte } from '../src/ui/reporteExcel.js';

// La descarga real necesita un navegador; acá se mira QUÉ se iba a descargar.
const { descargarReporte } = vi.hoisted(() => ({ descargarReporte: vi.fn(async () => {}) }));
vi.mock('../src/ui/reporteExcel.js', async (original) => ({
  ...(await original<typeof import('../src/ui/reporteExcel.js')>()),
  descargarReporte,
}));

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

beforeEach(() => {
  descargarReporte.mockClear();
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(
  rol: string = 'direccion',
  datos: { vencimientos?: readonly unknown[]; alertas?: readonly unknown[]; clientes?: readonly unknown[] } = {},
) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: datos.clientes ?? [GARSO, CLIENTE_INACTIVO] }));
  mock.mockDeRuta('GET /api/v1/vencimientos', () =>
    respuestaJson({
      hoy: { anio: 2026, mes: 4, dia: 22 },
      resumen: { VENCIDO: 1, CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0, SIN_ALERTA: 0 },
      vencimientos: datos.vencimientos ?? [VENCIMIENTO_VENCIDO],
    }),
  );
  mock.mockDeRuta('GET /api/v1/alertas', () =>
    respuestaJson({ resumen: { CRITICA: 1, ALTA: 0, MEDIA: 0, INFORMATIVA: 0 }, alertas: datos.alertas ?? [ALERTA_CRITICA] }),
  );
  mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () => respuestaJson({ solicitudes: [SOLICITUD_ABIERTA] }));
  mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [BALANCE_PENDIENTE] }));
  mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones: [LIQUIDACION_PENDIENTE] }));
  mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () =>
    respuestaJson({
      presentados: [
        {
          id: 'p1', clienteId: GARSO.id, descripcion: 'IVA General — período 2026-03', entidad: 'DNIT',
          fechaVencimiento: '2026-04-09', fechaPresentacion: '2026-04-16', evidenciaId: null,
          diasDeAtraso: 7, fechaAproximada: false,
        },
      ],
    }),
  );

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
  describe('filtro por cliente y Excel (2026-10-02)', () => {
    const OTRO = { ...GARSO, id: 'cli-otro', nombre: 'OTRO S.A.', ruc: '80000001-1' };
    const DATOS = {
      clientes: [GARSO, OTRO, CLIENTE_INACTIVO],
      vencimientos: [
        VENCIMIENTO_VENCIDO,
        { ...VENCIMIENTO_VENCIDO, id: 'venc-2', clienteId: 'cli-otro', descripcion: 'Patente de OTRO' },
        { ...VENCIMIENTO_VENCIDO, id: 'venc-3', clienteId: 'cli-otro', descripcion: 'IVA de OTRO', nivelAlerta: 'ALTA', diasRestantes: 5 },
      ],
      alertas: [ALERTA_CRITICA, { ...ALERTA_CRITICA, id: 'alerta-sin-cliente', clienteId: null, titulo: 'Tasa nueva' }],
    };

    it('con un cliente elegido, los indicadores y las listas son solo de ese cliente', async () => {
      await montar('direccion', DATOS);
      await waitFor(() => {
        expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('2');
      });
      expect(screen.getByText('Clientes activos').closest('div')!.textContent).toContain('2');

      fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'cli-otro' } });

      // Los números se animan hasta el valor nuevo: se espera a que lleguen.
      await waitFor(() => {
        expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('1');
        expect(screen.getByText('Vencimientos próximos').closest('div')!.textContent).toContain('1');
        expect(screen.getByText('Clientes activos').closest('div')!.textContent).toContain('1');
        // Las alertas, la documentación, el balance y la liquidación son de GARSO.
        expect(screen.getByText('Alertas críticas').closest('div')!.textContent).toContain('0');
        expect(screen.getByText('Balances sin aprobar').closest('div')!.textContent).toContain('0');
      });
      expect(screen.getByText(/Mostrando: .*cliente: OTRO S\.A\./)).toBeVisible();
      const tablaVencimientos = within(screen.getByRole('table', { name: 'Vencimientos más urgentes' }));
      expect(tablaVencimientos.queryByText('Presentación anual ante Abogacía')).not.toBeInTheDocument();
      expect(tablaVencimientos.getByText('Patente de OTRO')).toBeVisible();
    });

    it('el Excel es el reporte general: los indicadores y los mismos cliente por cliente, con las alertas sin cliente aparte', async () => {
      await montar('direccion', DATOS);
      await waitFor(() => {
        expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('2');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBeNull();
      expect(reporte.titulo).toBe('Panel general');
      expect(reporte.filtros).toContain('Cliente: todos');
      const [resumen, porCliente] = reporte.hojas as [HojaDeReporte, HojaDeReporte];
      expect(celdas(resumen)).toContainEqual(['Vencimientos vencidos', 2, null]);
      expect(celdas(resumen)).toContainEqual(['Alertas críticas (7 días o menos, y lo vencido)', 2, null]);
      // El inactivo no aparece; la alerta sin cliente, en su propia fila: la columna suma el total.
      expect(celdas(porCliente).map((f) => f[0])).toEqual(['GARSO S.A.', 'OTRO S.A.', '(alertas sin cliente)']);
      expect(celdas(porCliente)[0]).toEqual(['GARSO S.A.', 1, 0, 1, 1, 1, 1, 1, 1, 7]);
      expect(celdas(porCliente)[1]).toEqual(['OTRO S.A.', 1, 1, 0, 0, 0, 0, 0, 0, 0]);
      expect(celdas(porCliente)[2]![3]).toBe(1);
    });

    it('con un cliente elegido, el Excel lleva su nombre y solo su fila', async () => {
      await montar('direccion', DATOS);
      await waitFor(() => {
        expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('2');
      });
      fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'cli-otro' } });

      fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('OTRO S.A.');
      expect(reporte.filtros).toContain('Cliente: OTRO S.A.');
      expect(celdas(reporte.hojas[1]!).map((f) => f[0])).toEqual(['OTRO S.A.']);
    });
  });

  // Daniel, 2026-09-24: «Vencimientos próximos» = los que vencen en 15 días o menos
  // (antes 7), y «Alertas críticas» = las que vencen en 7 días o menos, más lo vencido.
  it('«Vencimientos próximos» cuenta críticos, altos y medios (15 días o menos), no lejanos ni vencidos', async () => {
    const venc = (id: string, nivelAlerta: string, diasRestantes: number) => ({
      ...VENCIMIENTO_VENCIDO, id, descripcion: `venc ${id}`, nivelAlerta, diasRestantes,
      fechaVencimiento: '2026-04-28', estado: 'PENDIENTE',
    });
    await montar('direccion', {
      vencimientos: [
        venc('a', 'CRITICA', 1), venc('b', 'ALTA', 6), venc('c', 'MEDIA', 12),
        venc('d', 'INFORMATIVA', 25), venc('e', 'VENCIDO', -3),
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Vencimientos próximos').closest('div')!.textContent).toContain('3');
    });
  });

  it('«Alertas críticas» cuenta las críticas y las altas (7 días o menos, y lo vencido), no las medias', async () => {
    const alerta = (id: string, criticidad: string) => ({ ...ALERTA_CRITICA, id, criticidad });
    await montar('direccion', {
      alertas: [alerta('1', 'CRITICA'), alerta('2', 'ALTA'), alerta('3', 'ALTA'), alerta('4', 'MEDIA')],
    });

    await waitFor(() => {
      expect(screen.getByText('Alertas críticas').closest('div')!.textContent).toContain('3');
    });
  });

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

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'mes' } });
    fireEvent.change(await screen.findByLabelText('Mes'), { target: { value: '2026-05' } });

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
    mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () => respuestaJson({ presentados: [] }));

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

  /*
   * Daniel, 2026-09-15: buscar también por "últimos 15, 30, 60 o 90 días". Un
   * vencimiento de abril no entra en los últimos 30 días de hoy; el panel lo
   * saca de la cuenta en vez de seguir mostrando el total de la cartera.
   */
  it('con "últimos 30 días" solo cuenta lo que cae en ese rango', async () => {
    await montar();
    await waitFor(() => {
      expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('1');
    });

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'ultimos-30' } });

    await waitFor(() => {
      expect(screen.getByText('Vencimientos vencidos').closest('div')!.textContent).toContain('0');
    });
    expect(screen.getByText(/Mostrando: últimos 30 días/)).toBeVisible();
  });

  it('muestra cuántas presentaciones fueron con atraso, en días y sin hablar de multa', async () => {
    await montar();

    await waitFor(() => {
      expect(screen.getByText('Presentadas con atraso').closest('div')!.textContent).toContain('7 días en total');
    });
    expect(screen.queryByText(/multa/i)).toBeNull();
  });
  /*
   * Daniel, 2026-09-21: *"se quiere ver los vencidos, apretá sobre el botón de
   * los vencidos y te lleva a la pantalla donde aparecen los que están
   * vencidos, lo mismo con los que están por vencer, las alertas, etc."*
   */
  describe('los indicadores llevan a su módulo', () => {
    async function montarConNavegacion(irA: (pantalla: string) => void) {
      mock.mockDeRuta('GET /api/v1/yo', () =>
        respuestaJson({ usuarioId: 'u1', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
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
      mock.mockDeRuta('GET /api/v1/vencimientos/presentados', () => respuestaJson({ presentados: [] }));
      mock.mockDeRuta('GET /api/v1/alertas', () =>
        respuestaJson({ alertas: [ALERTA_CRITICA], resumen: { CRITICA: 1, ALTA: 0, MEDIA: 0, BAJA: 0 } }),
      );
      mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () => respuestaJson({ solicitudes: [] }));
      mock.mockDeRuta('GET /api/v1/balances', () => respuestaJson({ balances: [] }));
      mock.mockDeRuta('GET /api/v1/liquidaciones', () => respuestaJson({ liquidaciones: [] }));

      vi.resetModules();
      const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
      const Panel = (await import('../src/pantallas/Panel.js')).default;

      render(
        <ProveedorDeSesion>
          <Panel irA={irA as never} />
        </ProveedorDeSesion>,
      );
      await screen.findByText('Panel general');
    }

    it('cada indicador es un botón de verdad, con un nombre que se entiende sin verlo', async () => {
      await montarConNavegacion(() => undefined);

      // "55" no le dice nada a quien usa un lector de pantalla: el nombre
      // accesible tiene que decir a dónde lleva.
      const boton = await screen.findByRole('button', { name: 'Ver los vencimientos vencidos' });
      expect(boton).toBeVisible();
    });

    it('apretar "Vencimientos vencidos" lleva a la pantalla de vencimientos', async () => {
      const irA = vi.fn();
      await montarConNavegacion(irA);

      fireEvent.click(await screen.findByRole('button', { name: 'Ver los vencimientos vencidos' }));

      expect(irA).toHaveBeenCalledWith('vencimientos', { nivel: 'VENCIDO' });
    });

    it('apretar «Vencimientos próximos» lleva a la lista ya filtrada por próximos', async () => {
      const irA = vi.fn();
      await montarConNavegacion(irA);

      fireEvent.click(await screen.findByRole('button', { name: 'Ver los vencimientos próximos' }));

      expect(irA).toHaveBeenCalledWith('vencimientos', { nivel: 'PROXIMOS' });
    });

    it('apretar "Alertas críticas" lleva a la pantalla de alertas', async () => {
      const irA = vi.fn();
      await montarConNavegacion(irA);

      fireEvent.click(await screen.findByRole('button', { name: 'Ver las alertas críticas' }));

      expect(irA).toHaveBeenCalledWith('alertas');
    });

    it('sin navegación disponible no finge ser un botón', async () => {
      // El Panel se puede montar suelto (los tests de arriba lo hacen). Ahí no
      // hay a dónde ir, y una tarjeta que parece apretable pero no hace nada
      // es peor que una que no lo parece.
      await montar();

      expect(
        screen.queryByRole('button', { name: 'Ver los vencimientos vencidos' }),
      ).not.toBeInTheDocument();
    });
  });
});
