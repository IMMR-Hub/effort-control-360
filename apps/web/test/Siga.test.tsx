/**
 * Pantalla SIGA / Conciliación (tarea 104, pantalla 6 de 12).
 *
 * El flujo real es en dos pasos: `modo: 'simulacion'` primero (no persiste
 * nada), y recién "Confirmar importación" manda `modo: 'real'`. Los tests
 * verifican que el segundo paso no se pueda saltar y que ambos pasos manden
 * el mismo archivo.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hoyEnParaguay } from '@effort/core';

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

const EXPORTACION = {
  id: 'exp-1',
  clienteId: 'cli-garso',
  periodo: PERIODO,
  tipoReporte: 'LIBRO_COMPRAS',
  formato: 'EXCEL',
  evidenciaId: null,
  importadaEn: `${PERIODO}-10T12:00:00.000Z`,
  filasLeidas: 5,
  estadoRevision: 'IMPORTADA',
  proximaAccion: null,
  observaciones: null,
};

const CONCILIACION_LIMPIA = {
  periodo: PERIODO,
  conciliado: true,
  totalRecibidos: 5,
  totalEnSiga: 5,
  coincidentes: 5,
  sinIdentificacion: 0,
  faltaCargarEnSiga: [],
  sinRespaldoDocumental: [],
  diferenciasDeMonto: [],
  magnitudDeLasDiferencias: '0',
};

let mock: ReturnType<typeof crearFetchMock>;
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  descargarReporte.mockClear();
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
  usuario = userEvent.setup();

  // FileReader no existe en jsdom con soporte completo de readAsDataURL en
  // todas las versiones — se mockea para devolver un base64 fijo y previsible.
  vi.stubGlobal(
    'FileReader',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result = '';
      readAsDataURL() {
        this.result = 'data:application/octet-stream;base64,ZmFrZS1jb250ZW5pZG8=';
        queueMicrotask(() => this.onload?.());
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(rol: string = 'direccion', conciliacion: unknown = CONCILIACION_LIMPIA) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/clientes/cli-garso/siga', () =>
    respuestaJson({ exportaciones: [EXPORTACION] }),
  );
  mock.mockDeRuta(`GET /api/v1/clientes/cli-garso/siga/${PERIODO}/conciliacion`, () =>
    respuestaJson(conciliacion),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Siga = (await import('../src/pantallas/Siga.js')).default;

  render(
    <ProveedorDeSesion>
      <Siga />
    </ProveedorDeSesion>,
  );

  await screen.findByText('Libro de compras');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });

  // La pantalla carga en DOS tiempos: primero las exportaciones, y recién
  // cuando se elige cliente solo, la conciliación. Esperar únicamente a lo
  // primero dejaba a los tests corriendo contra una pantalla a medio armar —
  // pasaban solos y fallaban en la corrida completa, que es la peor forma de
  // fallar: bloqueó dos `npm run verify` seguidos el 2026-09-12 haciendo creer
  // que había una regresión donde no la había. Esta espera es la condición real
  // de "la pantalla terminó de cargar".
  await waitFor(() => {
    expect(screen.queryByText('Elegí un cliente para conciliar.')).toBeNull();
  });
}

function archivoDePrueba() {
  return new File(['contenido'], 'libro-compras.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('pantalla SIGA / conciliación', () => {
  it('muestra las exportaciones ya cargadas y el resumen de conciliación', async () => {
    await montar();

    expect(screen.getByText('IMPORTADA')).toBeVisible();
    expect(screen.getAllByText('Nada pendiente.')).toHaveLength(3);
  });

  it('un rol sin permiso de importar no ve el formulario de carga', async () => {
    await montar('revisor_balance');

    expect(screen.queryByLabelText('Archivo (Excel o CSV)')).not.toBeInTheDocument();
  });

  it('elegir un archivo y simular no persiste nada, solo muestra el reporte', async () => {
    await montar();

    const input = screen.getByLabelText('Archivo (Excel o CSV)');
    await usuario.upload(input, archivoDePrueba());

    mock.mockDeRuta('POST /api/v1/clientes/cli-garso/siga/importar', () =>
      respuestaJson({
        modo: 'simulacion',
        totalFilas: 3,
        aceptados: [
          { rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: '001-001-1', total: '100000', tasa: 'DIEZ', anulado: false, fecha: `${PERIODO}-05` },
        ],
        rechazados: [{ numeroFila: 2, motivo: 'Falta el timbrado.', datosOriginales: {} }],
      }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Simular (no guarda nada)' }));

    expect(await screen.findByText(/1 aceptadas/)).toBeVisible();
    expect(screen.getByText(/1 rechazadas/)).toBeVisible();
    expect(screen.getByText(/Falta el timbrado\./)).toBeVisible();

    const [, opciones] = mock.llamadasA('POST /api/v1/clientes/cli-garso/siga/importar')[0]!;
    expect(JSON.parse(String(opciones?.body)).modo).toBe('simulacion');
  });

  it('confirmar importación manda modo real y recarga la lista', async () => {
    await montar();

    await usuario.upload(screen.getByLabelText('Archivo (Excel o CSV)'), archivoDePrueba());

    mock.mockDeRuta('POST /api/v1/clientes/cli-garso/siga/importar', () =>
      respuestaJson({
        modo: 'simulacion',
        totalFilas: 1,
        aceptados: [
          { rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: '001-001-1', total: '100000', tasa: 'DIEZ', anulado: false, fecha: `${PERIODO}-05` },
        ],
        rechazados: [],
      }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Simular (no guarda nada)' }));
    await screen.findByText(/1 aceptadas/);

    mock.mockDeRuta('POST /api/v1/clientes/cli-garso/siga/importar', () =>
      respuestaJson({
        modo: 'real',
        totalFilas: 1,
        aceptados: [],
        rechazados: [],
        exportacion: { ...EXPORTACION, id: 'exp-2', filasLeidas: 1 },
      }),
    );
    mock.mockDeRuta('GET /api/v1/clientes/cli-garso/siga', () =>
      respuestaJson({ exportaciones: [EXPORTACION, { ...EXPORTACION, id: 'exp-2', filasLeidas: 1 }] }),
    );

    await usuario.click(screen.getByRole('button', { name: /Confirmar importación/ }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/clientes/cli-garso/siga/importar')).toHaveLength(2);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/clientes/cli-garso/siga/importar')[1]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.modo).toBe('real');
    expect(cuerpo.nombreArchivo).toBe('libro-compras.xlsx');
  });

  it('la conciliación con diferencias las muestra formateadas, no el número crudo', async () => {
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({ usuarioId: 'u1', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
    );
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
    mock.mockDeRuta('GET /api/v1/clientes/cli-garso/siga', () => respuestaJson({ exportaciones: [] }));
    mock.mockDeRuta(`GET /api/v1/clientes/cli-garso/siga/${PERIODO}/conciliacion`, () =>
      respuestaJson({
        ...CONCILIACION_LIMPIA,
        conciliado: false,
        faltaCargarEnSiga: [
          { rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: '001-001-9', total: '250000', tasa: 'DIEZ', anulado: false },
        ],
      }),
    );

    vi.resetModules();
    const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
    const Siga = (await import('../src/pantallas/Siga.js')).default;

    render(
      <ProveedorDeSesion>
        <Siga />
      </ProveedorDeSesion>,
    );

    expect(await screen.findByText(/Gs\. 250\.000/)).toBeVisible();
  });

  describe('Excel (2026-10-02)', () => {
    const CON_DIFERENCIAS = {
      ...CONCILIACION_LIMPIA,
      conciliado: false,
      totalRecibidos: 7,
      totalEnSiga: 6,
      coincidentes: 4,
      sinIdentificacion: 1,
      faltaCargarEnSiga: [
        { rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: '001-001-9', total: '250000', tasa: 'DIEZ', anulado: false },
      ],
      sinRespaldoDocumental: [
        { rucEmisor: '80003112-1', timbrado: '87654321', numeroComprobante: '002-003-0000077', total: '1500000', tasa: 'CINCO', anulado: false },
      ],
      diferenciasDeMonto: [
        { clave: '80017726-6|12345678|001-001-5', recibido: '100000', enSiga: '90000', diferencia: '10000' },
      ],
      magnitudDeLasDiferencias: '10000',
    };

    it('descarga las exportaciones y cada lista de la conciliación del cliente y el período que se ven', async () => {
      await montar('direccion', CON_DIFERENCIAS);

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('GARSO S.A.');
      expect(reporte.titulo).toBe('SIGA / Conciliación');
      expect(reporte.filtros).toContain('Cliente: GARSO S.A.');
      expect(reporte.filtros).toContain(`Período fiscal que se muestra: ${PERIODO}`);
      expect(reporte.filtros.some((f) => f.startsWith('Período/Fechas: '))).toBe(true);
      expect(reporte.hojas.map((h) => h.nombre)).toEqual([
        'Exportaciones',
        'Resumen de la conciliación',
        'Falta cargar en SIGA',
        'Sin respaldo documental',
        'Diferencias de monto',
      ]);
      const [exportaciones, resumen, falta, sinRespaldo, diferencias] = reporte.hojas as [
        HojaDeReporte, HojaDeReporte, HojaDeReporte, HojaDeReporte, HojaDeReporte,
      ];
      // La hora depende de la base horaria del sistema donde corre la prueba: no se compara.
      expect(celdas(exportaciones).map((fila) => fila.slice(0, 5))).toEqual([
        ['Libro de compras', 'EXCEL', 5, 'IMPORTADA', `${PERIODO}-10`],
      ]);
      expect(celdas(resumen)).toEqual([[7, 6, 4, 1, 'No', '10000']]);
      expect(celdas(falta)).toEqual([['80017726-6', '12345678', '001-001-9', '250000']]);
      expect(celdas(sinRespaldo)).toEqual([['80003112-1', '87654321', '002-003-0000077', '1500000']]);
      expect(celdas(diferencias)).toEqual([['80017726-6|12345678|001-001-5', '100000', '90000', '10000']]);
    });

    it('lo puede bajar también quien no puede importar', async () => {
      await montar('revisor_balance');

      expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeVisible();
    });
  });
});
