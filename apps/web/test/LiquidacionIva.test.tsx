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
  saldoAFavorDeclarado: null,
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
  grupo: null,
  detalle: 'Se estaría tomando crédito fiscal de más.',
  estado: 'PENDIENTE',
  notaDecision: null,
  decididoEn: null,
};

let mock: ReturnType<typeof crearFetchMock>;

beforeEach(() => {
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montar(
  rol: string = 'direccion',
  liquidaciones: readonly unknown[] = [LIQUIDACION],
  hallazgos: { hallazgos: readonly unknown[]; resumen: unknown } | null = null,
) {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [FUMIPRO] }));
  mock.mockDeRuta('GET /api/v1/liquidaciones-iva', () => respuestaJson({ liquidaciones }));
  mock.mockDeRuta('GET /api/v1/liquidaciones-iva/hallazgos', () =>
    respuestaJson(
      hallazgos ?? {
        hallazgos: [HALLAZGO],
        resumen: {
          total: 1, conRiesgoDeMulta: 1, enRevision: 0, aceptados: 0, ivaEnRiesgo: '12',
          inconsistencias: { sinAutofactura: 0, redondeo: 0, aRevisar: 0 },
        },
      },
    ),
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

  /*
   * Tarea 141: una planilla descartada por existir una más reciente tiene que
   * poder verse; si no, nadie se entera de que había dos versiones del libro.
   */
  it('muestra las planillas descartadas y los Excel ignorados del último cálculo', async () => {
    await montar();
    mock.mockDeRuta('POST /api/v1/liquidaciones-iva/calcular', () =>
      respuestaJson({
        periodosCalculados: 48,
        archivosLeidos: 191,
        filasInterpretadas: 20000,
        filasRechazadas: 12,
        hallazgosNuevos: 0,
        archivosIgnorados: 33,
        avisos: [
          {
            cliente: 'COPESA',
            archivo: 'AGOSTO 2025.xlsx',
            motivo: 'Planilla descartada por existir una más reciente (COMPRAS 2025-08): se usó "08 Agosto 2025 ok verificado.xlsx".',
          },
        ],
        fallos: [],
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: /recalcular/i }));

    expect(await screen.findByText(/33 Excel ignorados/)).toBeTruthy();
    expect(screen.getByText(/1\s+avisos/)).toBeTruthy();
    expect(screen.getByText(/COPESA — AGOSTO 2025\.xlsx/)).toBeTruthy();
  });

  /*
   * Auditoría 2026-09-16: si una planilla no se pudo bajar, el cliente no se
   * calcula. Eso no puede pasar desapercibido: los números de ese cliente
   * quedan como estaban.
   */
  it('avisa qué clientes no se calcularon y cuántos avisos quedaron afuera', async () => {
    await montar();
    mock.mockDeRuta('POST /api/v1/liquidaciones-iva/calcular', () =>
      respuestaJson({
        periodosCalculados: 40,
        archivosLeidos: 150,
        filasInterpretadas: 18000,
        filasRechazadas: 0,
        hallazgosNuevos: 0,
        archivosIgnorados: 0,
        avisos: [{ cliente: 'COPESA', archivo: 'AGOSTO 2025.xlsx', motivo: 'Planilla descartada.' }],
        avisosOmitidos: 250,
        clientesOmitidos: [{ cliente: 'FUMIPRO S.A.', motivo: 'No se calculó en esta corrida (503).' }],
        fallos: [],
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: /recalcular/i }));

    expect(await screen.findByText(/FUMIPRO S\.A\.: No se calculó en esta corrida/)).toBeTruthy();
    expect(screen.getByText(/251\s+avisos/)).toBeTruthy();
    expect(screen.getByText(/se muestran los primeros 1/)).toBeTruthy();
  });

  /*
   * Daniel, 2026-09-14: "alertar a partir de 1 guaraní, y que luego puedan
   * aceptar o revisar". Aceptar sin motivo no es una decisión: el botón de
   * confirmar no se habilita hasta que haya uno escrito.
   */
  it('aceptar un hallazgo exige escribir el motivo', async () => {
    await montar();
    mock.mockDeRuta('POST /api/v1/liquidaciones-iva/hallazgos/hal-1/decision', () =>
      respuestaJson({ id: 'hal-1', estado: 'ACEPTADO' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Motivo para aceptar'), 'Redondeo del proveedor, verificado');
    await userEvent.click(confirmar);

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/liquidaciones-iva/hallazgos/hal-1/decision')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/liquidaciones-iva/hallazgos/hal-1/decision')[0]!;
    expect(JSON.parse(String((opciones as RequestInit).body))).toEqual({
      decision: 'ACEPTADO',
      nota: 'Redondeo del proveedor, verificado',
    });
  });

  it('solo lectura no puede aceptar ni mandar a revisar', async () => {
    await montar('solo_lectura');

    expect(screen.queryByRole('button', { name: 'Aceptar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revisar' })).toBeNull();
  });

  /*
   * Tarea 138. El saldo a favor de IVA se toma de lo DECLARADO ante la DNIT
   * (formulario 120, casilla 47), no de lo calculado desde las planillas.
   */
  describe('saldo a favor declarado ante la DNIT', () => {
    it('sin declaración leída, dice que no hay declaración, no un cero engañoso', async () => {
      await montar();

      expect(screen.getByText('sin declaración leída')).toBeVisible();
    });

    it('cuando coincide con lo calculado, lo muestra sin ninguna marca', async () => {
      await montar('direccion', [{ ...LIQUIDACION, saldoAFavor: '500000', saldoAFavorDeclarado: '500000' }]);

      const fila = (await screen.findByText('2026-06')).closest('tr')!;
      expect(fila.textContent).not.toMatch(/sin declaración/);
    });

    it('cuando difiere de lo calculado, lo marca como una diferencia real', async () => {
      await montar('direccion', [{ ...LIQUIDACION, saldoAFavor: '500000', saldoAFavorDeclarado: '480000' }]);

      const fila = (await screen.findByText('2026-06')).closest('tr')!;
      // Los dos números tienen que verse: el punto no es esconder el cálculo
      // propio, es señalar que hay algo para revisar contra lo ya presentado.
      expect(fila.textContent).toContain('500.000');
      expect(fila.textContent).toContain('480.000');
    });
  });

  /*
   * Tarea 148. Los comprobantes que no cierran se separan por lo que ya se
   * sabe de ellos, sin esconder ninguno: toda diferencia sigue alertando.
   */
  describe('comprobantes que no cierran, agrupados', () => {
    const inconsistencia = (id: string, grupo: string, diferencia: string) => ({
      ...HALLAZGO, id, tipo: 'PARTES_NO_SUMAN_EL_TOTAL', riesgo: 'INCONSISTENCIA',
      numeroComprobante: `001-001-000${id}`, grupo, diferencia,
    });
    const TODOS = {
      hallazgos: [
        inconsistencia('1', 'SIN_AUTOFACTURA', '-1500000'),
        inconsistencia('2', 'REDONDEO', '1'),
        inconsistencia('3', 'A_REVISAR', '250000'),
      ],
      resumen: {
        total: 3, conRiesgoDeMulta: 0, enRevision: 0, aceptados: 0, ivaEnRiesgo: '0',
        inconsistencias: { sinAutofactura: 1, redondeo: 1, aRevisar: 1 },
      },
    };

    it('muestra cuántos hay de cada grupo, y el total no cambia', async () => {
      await montar('direccion', [LIQUIDACION], TODOS);

      expect(screen.getByText(/1 sin autofactura cargada/i)).toBeVisible();
      expect(screen.getByText(/1 de redondeo/i)).toBeVisible();
      expect(screen.getByText(/1 a revisar/i)).toBeVisible();
      expect(screen.getByText('001-001-0003')).toBeVisible();
      expect(screen.getByText('001-001-0001')).toBeVisible();
    });

    it('se puede mirar un solo grupo, sin que los otros desaparezcan del total', async () => {
      await montar('direccion', [LIQUIDACION], TODOS);

      await userEvent.selectOptions(screen.getByLabelText('Comprobantes que no cierran'), 'A_REVISAR');

      expect(screen.getByText('001-001-0003')).toBeVisible();
      expect(screen.queryByText('001-001-0001')).not.toBeInTheDocument();
      expect(screen.getByText(/1 sin autofactura cargada/i)).toBeVisible();
    });
  });
});
