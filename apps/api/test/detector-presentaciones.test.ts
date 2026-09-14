/**
 * Detector de presentaciones.
 *
 * Lo que se prueba son las decisiones que, si fallan, apagan una alerta real:
 * que no cruce un RUC ajeno, ni otro período, ni otro impuesto, y que si hay
 * original y rectificativa la fecha que cuente sea la de la original.
 */

import { describe, expect, it } from 'vitest';

import {
  detectarPresentaciones,
  type DependenciasDelDetector,
  type PresentacionLeida,
  type VencimientoPendiente,
} from '../src/servicios/detectorDePresentaciones.js';

const FUMIPRO = 'cli-fumipro';

const IVA_MARZO: PresentacionLeida = {
  evidenciaId: 'ev-ddjj-marzo',
  clienteId: FUMIPRO,
  formulario: '120',
  ruc: '80119631',
  periodo: '2026-03',
  numeroDeOrden: '12087502762',
  fechaDePresentacion: '2026-04-09',
};

const VENCE_IVA_MARZO: VencimientoPendiente = {
  id: 'v-iva-marzo',
  clienteId: FUMIPRO,
  rucCliente: '80119631-0',
  codigoObligacion: 'IVA_GENERAL',
  periodo: '2026-03',
  fechaVencimiento: '2026-04-13',
};

function armar(opciones: {
  presentaciones?: PresentacionLeida[];
  pendientes?: VencimientoPendiente[];
  textos?: Map<string, string | Error>;
}) {
  const marcados: { id: string; fecha: Date; evidenciaId: string }[] = [];
  const bitacora: Parameters<DependenciasDelDetector['registrarEnBitacora']>[0][] = [];
  const lecturas: { evidenciaId: string; formulario: string | null; error: string | null }[] = [];
  const textos = opciones.textos ?? new Map();

  const deps: DependenciasDelDetector = {
    pdfsPorLeer: async (limite) =>
      [...textos.keys()].slice(0, limite).map((id) => ({
        evidenciaId: id,
        clienteId: FUMIPRO,
        itemIdOneDrive: id,
        nombreArchivo: `${id}.pdf`,
      })),
    leerArchivo: async (itemId) => Buffer.from(itemId),
    extraerTexto: async (contenido) => {
      const texto = textos.get(contenido.toString());
      if (texto instanceof Error) throw texto;
      return texto ?? '';
    },
    guardarLectura: async (pdf, resultado) => {
      lecturas.push({
        evidenciaId: pdf.evidenciaId,
        formulario: resultado.declaracion?.formulario ?? null,
        error: resultado.error,
      });
    },
    presentacionesLeidas: async () => opciones.presentaciones ?? [],
    vencimientosPendientes: async () => opciones.pendientes ?? [],
    marcarPresentado: async (id, fecha, evidenciaId) => {
      marcados.push({ id, fecha, evidenciaId });
    },
    registrarEnBitacora: async (entrada) => {
      bitacora.push(entrada);
    },
  };

  return { deps, marcados, bitacora, lecturas };
}

describe('detector de presentaciones', () => {
  it('marca el vencimiento con la fecha y el PDF de la declaración', async () => {
    const { deps, marcados, bitacora } = armar({ presentaciones: [IVA_MARZO], pendientes: [VENCE_IVA_MARZO] });

    const resumen = await detectarPresentaciones(deps, 'usr-sistema');

    expect(resumen.vencimientosMarcados).toBe(1);
    expect(resumen.fueraDeTermino).toBe(0);
    expect(marcados[0]).toMatchObject({ id: 'v-iva-marzo', evidenciaId: 'ev-ddjj-marzo' });
    expect(marcados[0]!.fecha.toISOString().slice(0, 10)).toBe('2026-04-09');
    expect(bitacora[0]!.numeroDeOrden).toBe('12087502762');
  });

  it('no cruza una declaración de otro contribuyente guardada en la carpeta del cliente', async () => {
    const { deps, marcados } = armar({
      presentaciones: [{ ...IVA_MARZO, ruc: '4761106' }],
      pendientes: [VENCE_IVA_MARZO],
    });

    expect((await detectarPresentaciones(deps, 'usr')).vencimientosMarcados).toBe(0);
    expect(marcados).toEqual([]);
  });

  it('no cruza otro período ni otro impuesto', async () => {
    const { deps } = armar({
      presentaciones: [
        { ...IVA_MARZO, periodo: '2026-02' },
        { ...IVA_MARZO, formulario: '241' }, // talón de la RG 90, mismo período
      ],
      pendientes: [VENCE_IVA_MARZO],
    });

    expect((await detectarPresentaciones(deps, 'usr')).vencimientosMarcados).toBe(0);
  });

  /*
   * Caso real: DIBEC presentó el IVA de abril de 2026 el 29/05, y su
   * vencimiento era el 19/05. Se marca presentado —lo está— pero queda dicho
   * que fue fuera de término, que es lo que puede haber generado multa.
   */
  it('una presentación tardía se marca, y queda registrada como fuera de término', async () => {
    const { deps, bitacora } = armar({
      presentaciones: [{ ...IVA_MARZO, fechaDePresentacion: '2026-04-23' }],
      pendientes: [VENCE_IVA_MARZO],
    });

    const resumen = await detectarPresentaciones(deps, 'usr');

    expect(resumen.fueraDeTermino).toBe(1);
    expect(bitacora[0]).toMatchObject({ fueraDeTermino: true, diasDeAtraso: 10 });
  });

  it('con original y rectificativa, cuenta la fecha de la original', async () => {
    const { deps, marcados } = armar({
      presentaciones: [
        { ...IVA_MARZO, evidenciaId: 'ev-rectificativa', fechaDePresentacion: '2026-06-02', numeroDeOrden: '2' },
        IVA_MARZO,
      ],
      pendientes: [VENCE_IVA_MARZO],
    });

    await detectarPresentaciones(deps, 'usr');

    expect(marcados[0]!.evidenciaId).toBe('ev-ddjj-marzo');
  });

  it('un PDF que no se puede leer no frena a los demás, y queda guardado con su error', async () => {
    const { deps, lecturas } = armar({
      textos: new Map<string, string | Error>([
        ['roto', new Error('Invalid PDF structure')],
        ['planilla', 'CALCULO AUXILIAR PARA DETERMINACION DE IVA'],
      ]),
    });

    const resumen = await detectarPresentaciones(deps, 'usr');

    expect(resumen).toMatchObject({ pdfsLeidos: 2, erroresDeLectura: 1, presentacionesNuevas: 0 });
    expect(lecturas).toEqual([
      { evidenciaId: 'roto', formulario: null, error: 'Invalid PDF structure' },
      // No es una presentación, pero queda leída: no se vuelve a bajar.
      { evidenciaId: 'planilla', formulario: null, error: null },
    ]);
  });
});
