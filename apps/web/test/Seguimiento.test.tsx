/**
 * Seguimiento al cliente: filtro por cliente y descarga en Excel (2026-10-02).
 *
 * Los cálculos (plazo, próximo aviso, constancia de gestión) son de
 * `@effort/core` y tienen sus propios tests: acá se prueba que la pantalla
 * recorta lo que muestra según el cliente elegido, y que el Excel trae
 * exactamente eso.
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

function unCliente(id: string, nombre: string) {
  return {
    id,
    nombre,
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
}

const GARSO = unCliente('cli-garso', 'GARSO S.A.');
const OTRO = unCliente('cli-otro', 'OTRO S.A.');

const REGLA = {
  id: 'regla-1',
  nombre: 'Entrega de documentación',
  activa: true,
  evento: 'DOCUMENTACION_NO_ENTREGADA',
  diasHabilesDePlazo: 5,
  horaDeEnvio: '09:00',
  reintentarCadaDiasHabiles: 3,
  maximoRecordatorios: 4,
  escalarAPartirDelRecordatorio: 3,
  destinatariosIniciales: [{ tipo: 'CLIENTE', valor: null }],
  destinatariosDeEscalamiento: [{ tipo: 'ROL', valor: 'direccion' }],
  clientesAlcanzados: [],
  plantillaId: null,
};

/** GARSO no entregó (1 aviso enviado); OTRO ya entregó. */
const SOLICITUD_DE_GARSO = {
  id: 'sol-garso',
  clienteId: 'cli-garso',
  periodo: PERIODO,
  estado: 'ABIERTA',
  cuentaDesde: `${PERIODO}-01`,
  recordatoriosEnviados: 1,
  ultimoRecordatorioEn: null,
  reglaId: 'regla-1',
};
const SOLICITUD_DE_OTRO = {
  ...SOLICITUD_DE_GARSO,
  id: 'sol-otro',
  clienteId: 'cli-otro',
  estado: 'ENTREGADA',
  recordatoriosEnviados: 0,
};

function unContacto(datos: Record<string, unknown>) {
  return {
    periodo: PERIODO,
    direccion: 'SALIENTE',
    registradoPorUsuarioId: 'u1',
    evidenciaId: null,
    ...datos,
  };
}

const LLAMADA_A_GARSO = unContacto({
  id: 'c1',
  clienteId: 'cli-garso',
  canal: 'LLAMADA',
  origenContacto: 'MANUAL',
  ocurridoEn: '2026-09-15T15:30:00.000Z',
  huboRespuesta: true,
  quienAtendio: 'Laura',
  resumen: 'Se le pidió el libro de compras',
});
const CORREO_A_GARSO = unContacto({
  id: 'c2',
  clienteId: 'cli-garso',
  canal: 'CORREO',
  origenContacto: 'AUTOMATICO',
  ocurridoEn: '2026-09-20T15:30:00.000Z',
  huboRespuesta: false,
  quienAtendio: null,
  resumen: 'Aviso automático de documentación pendiente',
  evidenciaId: 'ev-1',
});
const LLAMADA_A_OTRO = unContacto({
  id: 'c3',
  clienteId: 'cli-otro',
  canal: 'WHATSAPP',
  origenContacto: 'MANUAL',
  ocurridoEn: '2026-09-18T15:30:00.000Z',
  huboRespuesta: true,
  quienAtendio: 'Contador de OTRO',
  resumen: 'Confirmó que ya entregó todo',
});

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

async function montar(rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO, OTRO] }));
  mock.mockDeRuta('GET /api/v1/solicitudes-documentacion', () =>
    respuestaJson({ solicitudes: [SOLICITUD_DE_GARSO, SOLICITUD_DE_OTRO] }),
  );
  mock.mockDeRuta('GET /api/v1/reglas-notificacion', () => respuestaJson({ reglas: [REGLA] }));
  mock.mockDeRuta('GET /api/v1/contactos', () =>
    respuestaJson({ contactos: [LLAMADA_A_GARSO, CORREO_A_GARSO, LLAMADA_A_OTRO] }),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Seguimiento = (await import('../src/pantallas/Seguimiento.js')).default;

  render(
    <ProveedorDeSesion>
      <Seguimiento />
    </ProveedorDeSesion>,
  );

  await screen.findByText('GARSO S.A.', { selector: 'td' });
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

const indicador = (etiqueta: string) => screen.getByText(etiqueta, { selector: 'p' }).closest('div')!.textContent;

describe('seguimiento al cliente', () => {
  it('muestra una fila por cliente con su estado de entrega', async () => {
    await montar();

    expect(screen.getByText('OTRO S.A.', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('Entregada')).toBeVisible();
    expect(screen.getByText('Nada pendiente')).toBeVisible();
    expect(indicador('Sin entregar')).toContain('de 2 clientes del piloto');
  });

  describe('filtro por cliente (2026-10-02)', () => {
    it('elegir un cliente deja solo su fila y sus indicadores, y «Todos los clientes» las vuelve a mostrar', async () => {
      await montar();
      expect(indicador('Sin entregar')).toContain('1');

      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-otro');

      expect(screen.queryByText('GARSO S.A.', { selector: 'td' })).not.toBeInTheDocument();
      expect(screen.getByText('OTRO S.A.', { selector: 'td' })).toBeVisible();
      expect(screen.getByText(/Plazo: .*cliente: OTRO S\.A\./)).toBeVisible();
      // Los indicadores cuentan solo a OTRO, que ya entregó: GARSO (el que no) ya no entra.
      expect(indicador('Sin entregar')).toContain('de 1 cliente del piloto');
      expect(indicador('Sin entregar')).toMatch(/^Sin entregar0/);
      expect(indicador('Nunca respondieron')).toMatch(/^Nunca respondieron0/);

      await usuario.selectOptions(screen.getByLabelText('Cliente'), '');

      expect(screen.getByText('GARSO S.A.', { selector: 'td' })).toBeVisible();
      expect(screen.getByText('OTRO S.A.', { selector: 'td' })).toBeVisible();
      expect(indicador('Sin entregar')).toContain('de 2 clientes del piloto');
      expect(indicador('Sin entregar')).toMatch(/^Sin entregar1/);
    });

    it('la bitácora y la constancia pasan a ser las del cliente elegido', async () => {
      await montar();
      // Al abrir, la primera fila queda seleccionada.
      expect(screen.getByText('Se le pidió el libro de compras')).toBeVisible();

      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-otro');

      expect(screen.getByText(/Bitácora de contactos — OTRO S\.A\./)).toBeVisible();
      expect(screen.getByText('Confirmó que ya entregó todo')).toBeVisible();
      expect(screen.queryByText('Se le pidió el libro de compras')).not.toBeInTheDocument();
    });
  });

  describe('Excel (2026-10-02)', () => {
    it('descarga el estado de entrega del cliente elegido, y su bitácora y constancia, con las etiquetas de la pantalla', async () => {
      await montar('auxiliar');
      await usuario.selectOptions(screen.getByLabelText('Cliente'), 'cli-garso');

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBe('GARSO S.A.');
      expect(reporte.titulo).toBe('Seguimiento');
      expect(reporte.filtros).toEqual([
        'Cliente: GARSO S.A.',
        `Período: ${PERIODO}`,
        'Bitácora y constancia de: GARSO S.A.',
      ]);
      expect(reporte.hojas.map((h) => h.nombre)).toEqual([
        'Estado de entrega',
        'Bitácora de contactos',
        'Constancia de gestión',
      ]);
      const [estado, bitacora, constancia] = reporte.hojas as [HojaDeReporte, HojaDeReporte, HojaDeReporte];

      expect(estado.columnas.map((c) => [c.titulo, c.formato])).toEqual([
        ['Cliente', undefined],
        ['Estado', undefined],
        ['Venció', 'fecha'],
        ['Avisos', 'entero'],
        ['Último contacto', undefined],
        ['Días sin respuesta', 'entero'],
        ['Próxima acción', undefined],
      ]);
      // Una sola fila (la de GARSO), con «Sin entregar» y no `ABIERTA`.
      expect(celdas(estado)).toEqual([
        [
          'GARSO S.A.',
          'Sin entregar',
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          1,
          expect.stringMatching(/ · correo$/),
          expect.any(Number),
          expect.stringMatching(/^Aviso 2 el \d{4}-\d{2}-\d{2}$/),
        ],
      ]);

      // La bitácora, del más reciente al más viejo, como en pantalla.
      expect(bitacora.columnas.map((c) => c.titulo)).toEqual([
        'Cliente', 'Fecha', 'Hora', 'Vía', 'Origen', 'Respuesta', 'Qué se habló', 'Atendió', 'Evidencia',
      ]);
      expect(celdas(bitacora)).toEqual([
        [
          'GARSO S.A.', '2026-09-20', expect.stringMatching(/^\d{2}:\d{2}$/), 'Correo', 'Automático',
          'Sin respuesta', 'Aviso automático de documentación pendiente', 'Nadie atendió', 'Con evidencia adjunta',
        ],
        [
          'GARSO S.A.', '2026-09-15', expect.stringMatching(/^\d{2}:\d{2}$/), 'Llamada', 'Manual',
          'Respondió', 'Se le pidió el libro de compras', 'Laura', null,
        ],
      ]);

      // La constancia: lo que muestra la tarjeta de la derecha, un dato por fila.
      expect(celdas(constancia).map((fila) => fila.slice(1))).toEqual([
        ['Síntesis', expect.any(String)],
        ['Intentos totales', 2],
        ['Respuestas', 1],
        ['Avisos del sistema', 1],
        ['Gestiones a mano', 1],
        ['Por vía: llamada', 1],
        ['Por vía: correo', 1],
        ['Atendieron', 'Laura'],
      ]);
    });

    it('sin filtro trae una fila por cliente; con «Todos» el detalle es el del cliente que está a la vista', async () => {
      await montar();

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte, detalle] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(detalle).toBeNull();
      expect(reporte.filtros[0]).toBe('Cliente: todos');
      const [estado, bitacora] = reporte.hojas as [HojaDeReporte, HojaDeReporte];
      expect(celdas(estado).map((fila) => [fila[0], fila[1], fila[6]])).toEqual([
        ['GARSO S.A.', 'Sin entregar', expect.stringMatching(/^Aviso 2 el /)],
        ['OTRO S.A.', 'Entregada', 'Nada pendiente'],
      ]);
      // El cliente a la vista es el primero; el Excel lo dice en la línea de filtros.
      expect(reporte.filtros).toContain('Bitácora y constancia de: GARSO S.A.');
      expect(celdas(bitacora)).toHaveLength(2);
    });
  });
});
