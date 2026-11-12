/**
 * Pantalla de clientes (tarea 104, pantalla 2 de 12).
 *
 * Igual que `Acceso.test.tsx`: `fetch` se mockea por `(método, ruta)`, con el
 * helper compartido de `ayuda-fetch-mock.ts`.
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
  codigo: '012',
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

async function montar(
  rol: string = 'direccion',
  clientes: readonly unknown[] = [GARSO, CLIENTE_INACTIVO],
  faltantes: Readonly<Record<string, readonly string[]>> = {},
) {
  mock.mockDeRuta('GET /api/v1/clientes/faltantes', () => respuestaJson({ faltantes }));
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Clientes = (await import('../src/pantallas/Clientes.js')).default;

  render(
    <ProveedorDeSesion>
      <Clientes />
    </ProveedorDeSesion>,
  );

  await screen.findByText('GARSO S.A.');
  // El rol llega de forma asíncrona (GET /api/v1/yo); esperar a que la UI ya
  // lo haya aplicado antes de que el test siga, para no leer un estado a
  // mitad de resolver.
  await waitFor(() => {
    if (rol === 'direccion' || rol === 'responsable') {
      expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeVisible();
    } else {
      expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
    }
  });
}

describe('pantalla de clientes', () => {
  it('lista los clientes activos por defecto, sin mostrar los inactivos', async () => {
    await montar();

    expect(screen.getByText('GARSO S.A.')).toBeVisible();
    expect(screen.queryByText('CLIENTE VIEJO S.A.')).not.toBeInTheDocument();
  });

  it('el filtro "Solo activos" también puede mostrar los inactivos', async () => {
    await montar();

    await usuario.click(screen.getByLabelText('Solo activos'));

    expect(await screen.findByText('CLIENTE VIEJO S.A.')).toBeVisible();
  });

  it('la búsqueda filtra por nombre o RUC', async () => {
    await montar();

    await usuario.type(screen.getByLabelText('Buscar cliente'), '80017726');

    expect(screen.getByText('GARSO S.A.')).toBeVisible();
  });

  it('la búsqueda también encuentra por el código del cliente (el número de su carpeta)', async () => {
    const OTRO = { ...GARSO, id: 'cli-otro', codigo: '021', nombre: 'COPESA', ruc: '80003112-1' };
    await montar('direccion', [GARSO, OTRO]);
    const tabla = screen.getByRole('table', { name: 'Cartera de clientes' });

    await usuario.type(screen.getByLabelText('Buscar cliente'), '021');

    expect(within(tabla).getByText('COPESA')).toBeVisible();
    expect(within(tabla).queryByText('GARSO S.A.')).not.toBeInTheDocument();
  });

  /*
   * Alta de todos los clientes con carpeta (2026-11-01): los que todavía no
   * tienen RUC quedan «RUC pendiente», y dirección tiene que verlo.
   */
  describe('RUC pendiente (2026-11-01)', () => {
    const SIN_RUC = { ...GARSO, id: 'cli-humo', codigo: '004', nombre: 'HUMO EAS', ruc: null };

    it('la fila dice «RUC pendiente» y dirección ve el aviso de que no se calculan sus vencimientos', async () => {
      await montar('direccion', [GARSO, SIN_RUC]);
      const tabla = screen.getByRole('table', { name: 'Cartera de clientes' });
      const fila = within(tabla).getByText('HUMO EAS').closest('tr')!;

      expect(within(fila).getByText('RUC pendiente')).toBeVisible();
      expect(within(fila).getByText('004')).toBeVisible();
      const aviso = screen.getByRole('status');
      expect(aviso).toHaveTextContent('1 cliente activo con RUC pendiente.');
      expect(aviso).toHaveTextContent(/no les calcula los vencimientos/);
    });

    it('sin clientes pendientes no hay aviso', async () => {
      await montar('direccion', [GARSO]);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('un rol de solo lectura ve la marca en la fila, pero el aviso es para dirección', async () => {
      await montar('auxiliar', [GARSO, SIN_RUC]);

      expect(screen.getByText('RUC pendiente')).toBeVisible();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('el alta sin RUC lo manda como null: el servidor lo guarda pendiente, nunca con uno de relleno', async () => {
      await montar('direccion');

      await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
      await usuario.type(screen.getByLabelText('Código'), '004');
      await usuario.type(screen.getByLabelText('Nombre / Razón social'), 'HUMO EAS');

      mock.mockDeRuta('POST /api/v1/clientes', () =>
        respuestaJson({ cliente: SIN_RUC }, { status: 201 }),
      );
      mock.mockDeRuta('GET /api/v1/clientes', () =>
        respuestaJson({ clientes: [GARSO, CLIENTE_INACTIVO, SIN_RUC] }),
      );

      await usuario.click(screen.getByRole('button', { name: 'Crear cliente' }));

      await waitFor(() => expect(mock.llamadasA('POST /api/v1/clientes')).toHaveLength(1));
      const [, opciones] = mock.llamadasA('POST /api/v1/clientes')[0]!;
      const cuerpo = JSON.parse(String(opciones?.body));
      expect(cuerpo.codigo).toBe('004');
      expect(cuerpo.ruc).toBeNull();
    });

    it('editar un cliente sin RUC y dejarlo vacío no manda el RUC', async () => {
      await montar('direccion', [GARSO, SIN_RUC]);

      await usuario.click(screen.getByRole('button', { name: 'Editar HUMO EAS' }));
      expect(screen.getByLabelText('RUC')).toHaveValue('');
      await usuario.type(screen.getByLabelText('Observaciones'), 'Falta el RUC.');

      mock.mockDeRuta('PATCH /api/v1/clientes/cli-humo', () => respuestaJson({ cliente: SIN_RUC }));
      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/clientes/cli-humo')).toHaveLength(1));
      const [, opciones] = mock.llamadasA('PATCH /api/v1/clientes/cli-humo')[0]!;
      const cuerpo = JSON.parse(String(opciones?.body));
      expect('ruc' in cuerpo).toBe(false);
      expect(cuerpo.codigo).toBe('004');
    });
  });

  /*
   * Daniel, 2026-10-02: el filtro por cliente en todas las pantallas. Acá la
   * pantalla ES la lista de clientes, así que el filtro es una búsqueda.
   */
  describe('búsqueda de cliente (2026-10-02)', () => {
    const GARCIA = { ...GARSO, id: 'cli-garcia', nombre: 'GARCÍA ÑANDÚ S.A.', ruc: '80000002-3', tipoPersona: 'FISICA', canalPreferido: null };

    function indicador(etiqueta: string): string {
      return screen.getByText(etiqueta, { selector: 'p' }).closest('div')!.textContent ?? '';
    }

    it('busca por nombre sin distinguir mayúsculas ni tildes, y por RUC', async () => {
      await montar('direccion', [GARSO, GARCIA, CLIENTE_INACTIVO]);
      const tabla = screen.getByRole('table', { name: 'Cartera de clientes' });
      expect(within(tabla).getByText('GARSO S.A.')).toBeVisible();
      expect(within(tabla).getByText('GARCÍA ÑANDÚ S.A.')).toBeVisible();

      await usuario.type(screen.getByLabelText('Buscar cliente'), 'garcia nandu');

      expect(within(tabla).getByText('GARCÍA ÑANDÚ S.A.')).toBeVisible();
      expect(within(tabla).queryByText('GARSO S.A.')).not.toBeInTheDocument();
      expect(screen.getByText(/1 de 3 clientes · búsqueda: «garcia nandu»/)).toBeVisible();

      await usuario.clear(screen.getByLabelText('Buscar cliente'));
      await usuario.type(screen.getByLabelText('Buscar cliente'), 'GARCÍA');
      expect(within(tabla).getByText('GARCÍA ÑANDÚ S.A.')).toBeVisible();

      await usuario.clear(screen.getByLabelText('Buscar cliente'));
      await usuario.type(screen.getByLabelText('Buscar cliente'), '80000002');
      expect(within(tabla).getByText('GARCÍA ÑANDÚ S.A.')).toBeVisible();
      expect(within(tabla).queryByText('GARSO S.A.')).not.toBeInTheDocument();

      await usuario.clear(screen.getByLabelText('Buscar cliente'));
      expect(within(tabla).getByText('GARSO S.A.')).toBeVisible();
      expect(within(tabla).getByText('GARCÍA ÑANDÚ S.A.')).toBeVisible();
    });

    it('los indicadores cuentan lo que coincide con la búsqueda, activos e inactivos, aunque «Solo activos» oculte filas de la tabla', async () => {
      await montar('direccion', [GARSO, GARCIA, CLIENTE_INACTIVO]);
      expect(indicador('Clientes')).toContain('3');
      expect(indicador('Activos')).toBe('Activos2');
      expect(indicador('Inactivos')).toBe('Inactivos1');

      await usuario.type(screen.getByLabelText('Buscar cliente'), 'viejo');

      expect(indicador('Clientes')).toContain('1');
      expect(indicador('Activos')).toBe('Activos0');
      expect(indicador('Inactivos')).toBe('Inactivos1');
      // «Solo activos» sigue puesto: el inactivo no está en la tabla.
      expect(screen.getByText('Ningún cliente coincide con la búsqueda.')).toBeVisible();

      await usuario.click(screen.getByLabelText('Solo activos'));
      expect(within(screen.getByRole('table', { name: 'Cartera de clientes' })).getByText('CLIENTE VIEJO S.A.')).toBeVisible();
    });
  });

  // Daniel, 2026-11-12: «deben aparecer como incompletos y mencionar lo que le falta».
  it('un cliente incompleto dice qué le falta, y el indicador los cuenta', async () => {
    await montar('direccion', [GARSO, { ...GARSO, id: 'cli-sinruc', nombre: 'SIN RUC S.A.', ruc: null }], {
      'cli-sinruc': ['RUC', 'regla de vencimiento de IRP'],
    });

    expect(await screen.findByText('Falta: RUC; regla de vencimiento de IRP')).toBeVisible();
    const fila = screen.getByText('SIN RUC S.A.').closest('tr')!;
    expect(within(fila).getByText('Incompleto')).toBeVisible();
    expect(within(screen.getByText('GARSO S.A.').closest('tr')!).getByText('Completo')).toBeVisible();
    expect(screen.getByText('Incompletos')).toBeVisible();
  });

  describe('Excel (2026-10-02)', () => {
    const GARCIA = { ...GARSO, id: 'cli-garcia', nombre: 'GARCÍA ÑANDÚ S.A.', ruc: '80000002-3', tipoPersona: 'FISICA', canalPreferido: null };

    it('descarga la cartera tal como queda con la búsqueda, con la búsqueda escrita en los filtros', async () => {
      await montar('auxiliar', [GARSO, GARCIA, CLIENTE_INACTIVO, { ...GARSO, id: 'cli-otro', nombre: 'OTRO S.A.', ruc: '80000009-9' }]);
      await usuario.type(screen.getByLabelText('Buscar cliente'), 'gar');

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(reporte.titulo).toBe('Clientes');
      expect(reporte.filtros).toEqual(['Cliente: nombre, código o RUC con «gar»', 'Estado: solo activos']);
      expect(reporte.hojas.map((h) => h.nombre)).toEqual(['Cartera']);
      const [cartera] = reporte.hojas as [HojaDeReporte];
      expect(cartera.columnas.map((c) => c.titulo)).toEqual(['Código', 'Nombre', 'RUC', 'Tipo', 'Canal preferido', 'Estado', 'Datos']);
      // Las mismas filas y el mismo orden que la tabla: sin el inactivo ni «OTRO».
      expect(celdas(cartera)).toEqual([
        ['012', 'GARCÍA ÑANDÚ S.A.', '80000002-3', 'Física', '', 'Activo', 'Completo'],
        ['012', 'GARSO S.A.', '80017726-6', 'Jurídica', 'WhatsApp', 'Activo', 'Completo'],
      ]);
    });

    it('sin búsqueda y con «Solo activos» destildado, trae toda la cartera con los inactivos', async () => {
      await montar('direccion');
      await usuario.click(screen.getByLabelText('Solo activos'));

      await usuario.click(screen.getByRole('button', { name: 'Descargar Excel' }));

      await waitFor(() => expect(descargarReporte).toHaveBeenCalledTimes(1));
      const [reporte] = descargarReporte.mock.calls[0] as unknown as [Reporte, string | null];
      expect(reporte.filtros).toEqual(['Cliente: todos', 'Estado: activos e inactivos']);
      const [cartera] = reporte.hojas as [HojaDeReporte];
      expect(celdas(cartera).map((fila) => [fila[1], fila[5]])).toEqual([
        ['CLIENTE VIEJO S.A.', 'Inactivo'],
        ['GARSO S.A.', 'Activo'],
      ]);
    });
  });

  it('un rol de solo lectura no ve el botón de alta ni el de editar', async () => {
    await montar('auxiliar');

    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });

  it('dirección puede dar de alta un cliente nuevo', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await usuario.type(screen.getByLabelText('Código'), '133');
    await usuario.type(screen.getByLabelText('Nombre / Razón social'), 'CLIENTE NUEVO S.A.');
    await usuario.type(screen.getByLabelText('RUC'), '80019012-2');

    mock.mockDeRuta('POST /api/v1/clientes', () =>
      respuestaJson({ cliente: { ...GARSO, id: 'cli-nuevo', nombre: 'CLIENTE NUEVO S.A.', ruc: '80019012-2' } }, { status: 201 }),
    );
    mock.mockDeRuta('GET /api/v1/clientes', () =>
      respuestaJson({ clientes: [GARSO, CLIENTE_INACTIVO, { ...GARSO, id: 'cli-nuevo', nombre: 'CLIENTE NUEVO S.A.', ruc: '80019012-2' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear cliente' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/clientes')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/clientes')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.codigo).toBe('133');
    expect(cuerpo.nombre).toBe('CLIENTE NUEVO S.A.');
    expect(cuerpo.ruc).toBe('80019012-2');
    // Los campos vacíos del formulario se mandan como null, no como cadena vacía.
    expect(cuerpo.email).toBeNull();

    expect(await screen.findByText('CLIENTE NUEVO S.A.')).toBeVisible();
  });

  it('un RUC ya usado muestra el mensaje del servidor tal cual', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await usuario.type(screen.getByLabelText('Código'), '133');
    await usuario.type(screen.getByLabelText('Nombre / Razón social'), 'GARSO DUPLICADO');
    await usuario.type(screen.getByLabelText('RUC'), '80017726-6');

    mock.mockDeRuta('POST /api/v1/clientes', () =>
      respuestaJson(
        { error: 'ruc_en_uso', mensaje: 'Ya existe un cliente con ese RUC.' },
        { status: 409 },
      ),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear cliente' }));

    expect(await screen.findByText('Ya existe un cliente con ese RUC.')).toBeVisible();
    // El formulario sigue abierto: no se pierde lo que la persona ya cargó.
    expect(screen.getByLabelText('Nombre / Razón social')).toHaveValue('GARSO DUPLICADO');
  });

  it('editar precarga los datos actuales del cliente', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Editar GARSO S.A.' }));

    expect(screen.getByLabelText('Nombre / Razón social')).toHaveValue('GARSO S.A.');
    expect(screen.getByLabelText('RUC')).toHaveValue('80017726-6');
    expect(screen.getByLabelText('Cliente activo')).toBeChecked();
  });

  it('cancelar cierra el formulario sin llamar al servidor', async () => {
    await montar('direccion');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Nombre / Razón social')).not.toBeInTheDocument();
    expect(mock.llamadasA('POST /api/v1/clientes')).toHaveLength(0);
  });
});
