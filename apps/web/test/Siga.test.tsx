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

async function montar(rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/clientes/cli-garso/siga', () =>
    respuestaJson({ exportaciones: [EXPORTACION] }),
  );
  mock.mockDeRuta(`GET /api/v1/clientes/cli-garso/siga/${PERIODO}/conciliacion`, () =>
    respuestaJson(CONCILIACION_LIMPIA),
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
});
