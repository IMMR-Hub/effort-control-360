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
  descargarReporte.mockClear();
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

// El selector del formulario y el filtro de arriba se llaman los dos «Cliente».
const clienteDelFormulario = () => screen.getByLabelText('Cliente', { selector: '#clienteHoras' });
const filtroDeCliente = () => screen.getByLabelText('Cliente', { selector: '#filtroDeClienteHoras' });

async function montar(
  rol: string = 'responsable',
  totales: readonly unknown[] = TOTALES_POR_DEFECTO,
  registros: readonly unknown[] = [MI_REGISTRO],
) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'usr-ana', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, COPESA] }));
  mock.mockDeRuta('GET /api/v1/horas', () => respuestaJson({ registros }));
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

    expect(clienteDelFormulario()).toBeVisible();
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
    // Se espera el texto: el resumen llega de forma asíncrona, y con la máquina cargada
    // (`npm run verify`) buscarlo de golpe fallaba a veces.
    expect(await screen.findByText('Gs. 1.700.000')).toBeVisible();

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

    await usuario.selectOptions(clienteDelFormulario(), 'cli-copesa');
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

    await usuario.selectOptions(clienteDelFormulario(), 'Tiempo interno (sin cliente)');
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

    await usuario.selectOptions(clienteDelFormulario(), 'cli-garso');
    await usuario.type(screen.getByLabelText('Horas'), '0');
    await usuario.click(screen.getByRole('button', { name: 'Guardar horas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mayor a cero/);
    expect(mock.llamadasA('POST /api/v1/horas')).toHaveLength(0);
  });

  it('un error del servidor se muestra tal cual y no borra lo que la persona ya escribió', async () => {
    await montar('responsable');

    await usuario.selectOptions(clienteDelFormulario(), 'cli-garso');
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

    expect(clienteDelFormulario()).toHaveValue('cli-garso');
    // Con coma: es como se escribe en español, y el campo acepta las dos.
    expect(screen.getByLabelText('Horas')).toHaveValue('2,5');
    expect(screen.getByLabelText('Día')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('Qué hiciste (opcional)')).toHaveValue('Carga de documentos');
  });

  /*
   * Pedido de EFFORT vía Daniel (2026-10-01): el filtro por cliente en todas las
   * pantallas. En Horas recorta «Mis horas» y, para dirección, el resumen del
   * equipo; «Horas por colaborador» se vuelve a sumar desde el detalle ya filtrado.
   */
  describe('filtro por cliente (2026-10-02)', () => {
    const REGISTROS = [
      MI_REGISTRO,
      { id: 'reg-2', usuarioId: 'usr-ana', clienteId: 'cli-copesa', fecha: '2026-09-21T00:00:00.000Z', minutos: 60, tarea: 'Conciliación bancaria' },
      { id: 'reg-3', usuarioId: 'usr-ana', clienteId: null, fecha: '2026-09-22T00:00:00.000Z', minutos: 30, tarea: 'Reunión de equipo' },
    ];
    const indicador = (etiqueta: string) => screen.getByText(etiqueta).closest('div')!.textContent;

    it('recorta «Mis horas», sus indicadores y el resumen del equipo, y «Todos los clientes» lo devuelve todo', async () => {
      await montar('direccion', TOTALES_POR_DEFECTO, REGISTROS);
      const misHoras = screen.getByRole('table', { name: 'Mis horas del período' });
      expect(within(misHoras).getByText('Conciliación bancaria')).toBeVisible();
      expect(within(misHoras).getByText('Reunión de equipo')).toBeVisible();
      // 150 + 60 + 30 = 240 min.
      expect(indicador('Mis horas del período')).toContain('4 h');
      expect(indicador('Días con horas cargadas')).toContain('3');

      await usuario.selectOptions(filtroDeCliente(), 'cli-garso');

      // Mis horas: solo GARSO (el tiempo interno no es de ningún cliente).
      expect(within(misHoras).getByText('Carga de documentos')).toBeVisible();
      expect(within(misHoras).queryByText('Conciliación bancaria')).not.toBeInTheDocument();
      expect(within(misHoras).queryByText('Reunión de equipo')).not.toBeInTheDocument();
      expect(indicador('Mis horas del período')).toContain('2 h 30 min');
      expect(indicador('Días con horas cargadas')).toContain('1');
      expect(screen.getByText(/1 registros en el período · cliente: GARSO S\.A\./)).toBeVisible();

      // Equipo: Ana 150 min + Sandra 90 min = 240 min (4 h), costo 500.000 + 300.000.
      const porCliente = screen.getByRole('table', { name: 'Horas por cliente' });
      expect(within(porCliente).getByText('GARSO S.A.')).toBeVisible();
      expect(within(porCliente).queryByText('COPESA CONSTRUCCIONES SA')).not.toBeInTheDocument();
      expect(within(porCliente).queryByText('Tiempo interno (sin cliente)')).not.toBeInTheDocument();
      // «Horas por colaborador» se suma desde el detalle ya filtrado: Ana 2 h 30 min, Sandra 1 h 30 min.
      const porPersona = screen.getByRole('table', { name: 'Horas por colaborador' });
      expect(within(porPersona).getByText('2 h 30 min')).toBeVisible();
      expect(within(porPersona).getByText('1 h 30 min')).toBeVisible();
      expect(within(porPersona).getByText('Gs. 500.000')).toBeVisible();
      expect(within(porPersona).getByText('Gs. 300.000')).toBeVisible();
      const detalle = screen.getByRole('table', { name: 'Detalle de horas por colaborador y cliente' });
      expect(within(detalle).getAllByRole('row')).toHaveLength(3); // encabezado + Ana-GARSO + Sandra-GARSO
      expect(indicador('Horas del equipo')).toContain('4 h');
      expect(indicador('Costo del equipo')).toContain('Gs. 800.000');
      expect(indicador('Colaboradores con horas')).toContain('2');
      expect(indicador('Clientes con horas')).toContain('1');

      await usuario.selectOptions(filtroDeCliente(), '');

      expect(within(misHoras).getByText('Conciliación bancaria')).toBeVisible();
      expect(within(misHoras).getByText('Reunión de equipo')).toBeVisible();
      expect(within(porCliente).getByText('Tiempo interno (sin cliente)')).toBeVisible();
      // 150 + 30 + 90 + 240 = 510 min.
      expect(indicador('Horas del equipo')).toContain('8 h 30 min');
    });

    it('si yo no cargué horas para ese cliente lo dice, y en el equipo desaparece quien no trabajó para él', async () => {
      // Mis registros son solo de GARSO; COPESA solo tiene horas de Sandra.
      await montar('direccion', TOTALES_POR_DEFECTO, [MI_REGISTRO]);

      await usuario.selectOptions(filtroDeCliente(), 'cli-copesa');

      const misHoras = screen.getByRole('table', { name: 'Mis horas del período' });
      expect(within(misHoras).getByText('No cargaste horas para este cliente en este período.')).toBeVisible();
      const porPersona = screen.getByRole('table', { name: 'Horas por colaborador' });
      expect(within(porPersona).queryByText('Ana Martínez')).not.toBeInTheDocument();
      expect(within(porPersona).getByText('Sandra Ferreira')).toBeVisible();
      expect(within(porPersona).getByText('4 h')).toBeVisible(); // 240 min
      expect(within(porPersona).getByText('Gs. 800.000')).toBeVisible();
    });
  });

  describe('Excel (2026-10-02)', () => {
    const REGISTROS = [
      MI_REGISTRO,
      { id: 'reg-2', usuarioId: 'usr-ana', clienteId: 'cli-copesa', fecha: '2026-09-21T00:00:00.000Z', minutos: 50, tarea: null },
    ];

    it('quien no es dirección baja solo «Mis horas», recortadas por el cliente elegido, con las horas en decimal y en minutos', async () => {
      await montar('responsable', TOTALES_POR_DEFECTO, REGISTROS);
      await usuario.selectOptions(filtroDeCliente(), 'cli-garso');

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('GARSO S.A.');
      expect(reporte.titulo).toBe('Horas');
      expect(reporte.filtros).toContain('Cliente: GARSO S.A.');
      expect(reporte.filtros.some((f) => f.startsWith('Período/Fechas: '))).toBe(true);
      expect(reporte.hojas.map((h) => h.nombre)).toEqual(['Mis horas']);
      expect(celdas(reporte.hojas[0]!)).toEqual([
        ['2026-09-20', 'GARSO S.A.', '2 h 30 min', 2.5, 150, 'Carga de documentos'],
      ]);
      // Sin ser dirección ni siquiera se le pide el resumen del equipo al servidor.
      expect(mock.llamadasA('GET /api/v1/horas/resumen')).toHaveLength(0);
    });

    it('un tiempo que no es hora exacta va con 2 decimales, y el dato exacto queda en minutos', async () => {
      await montar('responsable', TOTALES_POR_DEFECTO, REGISTROS);

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBeNull();
      expect(reporte.filtros).toContain('Cliente: todos');
      // 50 min = 0,8333… h → 0,83 en decimal; los 50 minutos exactos quedan al lado.
      expect(celdas(reporte.hojas[0]!)[1]).toEqual(['2026-09-21', 'COPESA CONSTRUCCIONES SA', '50 min', 0.83, 50, null]);
    });

    it('dirección baja además las tres tablas del equipo, con los mismos totales y el mismo recorte, y sin el día a día de nadie', async () => {
      await montar('direccion', TOTALES_POR_DEFECTO, REGISTROS);
      await usuario.selectOptions(filtroDeCliente(), 'cli-garso');

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('GARSO S.A.');
      expect(reporte.hojas.map((h) => h.nombre)).toEqual([
        'Mis horas',
        'Horas por cliente',
        'Horas por colaborador',
        'Detalle colaborador y cliente',
      ]);
      const [, porCliente, porColaborador, detalleDelEquipo] = reporte.hojas as [
        HojaDeReporte, HojaDeReporte, HojaDeReporte, HojaDeReporte,
      ];
      // GARSO: Ana 150 + Sandra 90 = 240 min; costo 500.000 + 300.000.
      expect(celdas(porCliente)).toEqual([['GARSO S.A.', '4 h', 4, 240, 800000n]]);
      // Por colaborador se suma desde el detalle filtrado: Ana 150, Sandra 90.
      expect(celdas(porColaborador)).toEqual([
        ['Ana Martínez', '2 h 30 min', 2.5, 150, 500000n],
        ['Sandra Ferreira', '1 h 30 min', 1.5, 90, 300000n],
      ]);
      expect(celdas(detalleDelEquipo)).toEqual([
        ['Ana Martínez', 'GARSO S.A.', '2 h 30 min', 2.5, 150, '500000'],
        ['Sandra Ferreira', 'GARSO S.A.', '1 h 30 min', 1.5, 90, '300000'],
      ]);
      expect(reporte.filtros.some((f) => /autoreportadas/.test(f))).toBe(true);
      // Regla 10: el equipo va como totales; el día y la tarea de cada registro solo existen en «Mis horas».
      for (const hojaDelEquipo of [porCliente, porColaborador, detalleDelEquipo]) {
        const titulos = hojaDelEquipo.columnas.map((c) => c.titulo);
        expect(titulos).not.toContain('Día');
        expect(titulos).not.toContain('Qué hiciste');
      }
    });
  });
});
