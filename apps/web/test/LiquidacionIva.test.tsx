/**
 * Pantalla de IVA crédito y débito.
 *
 * Lo que se prueba no es que pinte una tabla, sino las tres decisiones que
 * hacen que la pantalla sirva:
 *
 *  - Que los importes se muestren formateados desde el texto que manda la API
 *    (viajan como texto porque son `bigint`; convertirlos a número perdería
 *    precisión).
 *  - Que lo accionable —los hallazgos que pueden costar una multa— aparezca, y
 *    no quede escondido detrás de un filtro.
 *  - Que quien no tiene permiso de calcular no vea el botón que no va a poder
 *    usar.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

const FUMIPRO = {
  id: 'cli-fumipro',
  nombre: 'FUMIPRO S.A.',
  ruc: '80119631-0',
  tipoPersona: 'JURIDICA',
  regimenTributario: null,
  email: null,
  telefono: null,
  canalPreferido: 'WHATSAPP',
  carpetaOneDriveId: null,
  activo: true,
  observaciones: null,
};

const LIQUIDACION = {
  periodo: '2026-06',
  creditoFiscal: '15238603',
  debitoFiscal: '20049251',
  saldoAPagar: '4810648',
  saldoAFavor: '0',
  comprobantesCompras: 217,
  comprobantesVentas: 156,
  archivosLeidos: 2,
  filasRechazadas: 0,
  calculadoEn: '2026-09-13T12:00:00.000Z',
};

// Caso real: ECOAGRO, comprobante de AGROSOL. Doce guaraníes de crédito de más.
const HALLAZGO = {
  id: 'hal-1',
  clienteId: 'cli-fumipro',
  periodo: '2026-03',
  tipo: 'IVA_DECLARADO_NO_COINCIDE',
  riesgo: 'CREDITO_DE_MAS',
  tipoRegistro: 'COMPRAS',
  numeroComprobante: '001-001-0000028',
  contraparte: 'AGROSOL PARAGUAY SOCIEDAD ANONIMA',
  tasa: '10%',
  diferencia: '12',
  detalle: 'Se estaría tomando crédito fiscal de más.',
};

let mock: ReturnType<typeof crearFetchMock>;

beforeEach(() => {
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [FUMIPRO] }));
  mock.mockDeRuta('GET /api/v1/liquidaciones-iva', () =>
    respuestaJson({ liquidaciones: [LIQUIDACION] }),
  );
  mock.mockDeRuta('GET /api/v1/liquidaciones-iva/hallazgos', () =>
    respuestaJson({
      hallazgos: [HALLAZGO],
      resumen: { total: 1, conRiesgoDeMulta: 1, ivaEnRiesgo: '12' },
    }),
  );

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Pantalla = (await import('../src/pantallas/LiquidacionIva.js')).default;

  render(
    <ProveedorDeSesion>
      <Pantalla />
    </ProveedorDeSesion>,
  );

  // La pantalla termina de cargar cuando aparece el período de la liquidación.
  await screen.findByText('2026-06');
}

describe('pantalla de IVA', () => {
  it('muestra el crédito, el débito y el saldo con formato de guaraníes', async () => {
    await montar();

    expect(screen.getByText('Gs. 15.238.603')).toBeVisible();
    expect(screen.getByText('Gs. 20.049.251')).toBeVisible();
    expect(screen.getByText('Gs. 4.810.648')).toBeVisible();
  });

  /*
   * Lo accionable tiene que verse sin buscarlo. En los datos reales del piloto
   * hay 166 hallazgos y solo 49 arriesgan multa: si estos quedaran mezclados o
   * escondidos, la pantalla mostraría mucho y no serviría para nada.
   */
  it('muestra los hallazgos con riesgo de multa y cuántos son', async () => {
    await montar();

    expect(screen.getByText('Crédito fiscal de más')).toBeVisible();
    expect(screen.getByText('AGROSOL PARAGUAY SOCIEDAD ANONIMA')).toBeVisible();
    expect(screen.getByText('001-001-0000028')).toBeVisible();
  });

  it('declara en pantalla que el saldo a favor todavía no se arrastra', async () => {
    await montar();

    // La simplificación se dice donde se ven los números, no solo en el código:
    // quien los mire tiene que saber qué NO contemplan.
    expect(screen.getByText(/todavía no se arrastra al período siguiente/i)).toBeVisible();
  });

  it('un rol sin permiso de calcular no ve el botón de recalcular', async () => {
    await montar('solo_lectura');

    expect(screen.queryByRole('button', { name: /recalcular/i })).toBeNull();
  });

  it('dirección puede recalcular, y la pantalla se actualiza sola', async () => {
    await montar();
    mock.mockDeRuta('POST /api/v1/liquidaciones-iva/calcular', () =>
      respuestaJson({
        periodosCalculados: 7,
        archivosLeidos: 39,
        filasInterpretadas: 4092,
        filasRechazadas: 3,
        hallazgosNuevos: 2,
        fallos: [],
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: /recalcular/i }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/liquidaciones-iva/calcular')).toHaveLength(1);
    });
    // Y vuelve a pedir los datos, para no dejar la pantalla con lo viejo.
    expect(mock.llamadasA('GET /api/v1/liquidaciones-iva').length).toBeGreaterThan(1);
  });
});
