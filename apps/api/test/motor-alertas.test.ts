/**
 * Motor de alertas.
 *
 * Lo que importa acá: que levante lo que hay que levantar, que NO levante lo
 * que todavía no urge, y sobre todo que correrlo muchas veces no llene la
 * pantalla con la misma alerta repetida — porque el plan es que corra solo
 * cada 15 minutos, y una pantalla con la misma alerta cien veces es una
 * pantalla que nadie mira.
 */

import { describe, expect, it } from 'vitest';

import { evaluarAlertas, ORIGEN_DOCUMENTACION, ORIGEN_VENCIMIENTO } from '../src/servicios/motorDeAlertas.js';
import { AlertasFalsas, ProcesoMensualFalso, VencimientosFalsos } from './dobles-dominio.js';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
/** Reloj congelado: los días restantes tienen que ser deterministas. */
const HOY = new Date('2026-04-21T13:00:00Z');

function armar() {
  return {
    alertas: new AlertasFalsas(),
    vencimientos: new VencimientosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
  };
}

async function agregarVencimiento(deps: ReturnType<typeof armar>, fechaIso: string) {
  return deps.vencimientos.registrar({
    clienteId: CLIENTE,
    tipoDocumento: 'IVA_GENERAL',
    descripcion: 'IVA General — período 2026-03',
    entidad: 'DNIT',
    fechaEmision: null,
    fechaVencimiento: new Date(`${fechaIso}T00:00:00Z`),
    responsableId: null,
    riesgo: 'MEDIO',
    evidenciaId: null,
    proximaAccion: null,
    creadoPorUsuarioId: 'usr-1',
  });
}

describe('motor de alertas', () => {
  it('levanta una alerta crítica por un vencimiento ya vencido sin presentar', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(1);
    const alerta = deps.alertas.alertas[0]!;
    expect(alerta.criticidad).toBe('CRITICA');
    expect(alerta.origen).toBe(ORIGEN_VENCIMIENTO);
    expect(alerta.titulo).toMatch(/Vencido sin presentar/);
  });

  it('no avisa de algo que vence dentro de mucho: sería ruido que tapa lo urgente', async () => {
    const deps = armar();
    // Faltan más de 30 días.
    await agregarVencimiento(deps, '2026-07-15');

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(0);
    expect(deps.alertas.alertas).toHaveLength(0);
  });

  it('la criticidad sigue los mismos umbrales que el radar de vencimientos', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-22'); // falta 1 día → CRITICA
    await agregarVencimiento(deps, '2026-04-27'); // faltan 6 → ALTA
    await agregarVencimiento(deps, '2026-05-05'); // faltan 14 → MEDIA

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    const criticidades = deps.alertas.alertas.map((a) => a.criticidad).sort();
    expect(criticidades).toEqual(['ALTA', 'CRITICA', 'MEDIA']);
  });

  // El caso que justifica el índice único de la base: el motor está pensado
  // para correr solo cada 15 minutos.
  it('correrlo muchas veces no repite la alerta', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const tercera = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.creadas).toBe(0);
    expect(tercera.creadas).toBe(0);
    expect(segunda.yaEstabanAbiertas).toBe(1);
    expect(deps.alertas.alertas).toHaveLength(1);
  });

  it('avisa de la documentación faltante del período', async () => {
    const deps = armar();
    const proceso = await deps.procesoMensual.asegurar(CLIENTE, '2026-03', 'usr-1');
    await deps.procesoMensual.actualizar(
      CLIENTE,
      '2026-03',
      { ...proceso, documentosFaltantes: 3 } as never,
      'usr-1',
    );

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(1);
    expect(deps.alertas.alertas[0]!.origen).toBe(ORIGEN_DOCUMENTACION);
    expect(deps.alertas.alertas[0]!.titulo).toMatch(/Faltan 3 documentos/);
  });

  /**
   * La regla que pidió Daniel el 2026-09-11, textual: "en NINGÚN punto el
   * sistema puede ignorarlas". No hay forma de descartar una alerta; la única
   * manera de que salga de la pantalla es que el problema deje de existir.
   * Acá se comprueba el otro lado de eso: cuando el vencimiento queda
   * presentado, la alerta se cierra sola.
   */
  it('al presentar el vencimiento, la alerta se cierra sola', async () => {
    const deps = armar();
    const vencimiento = await agregarVencimiento(deps, '2026-04-13');
    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    expect(deps.alertas.alertas[0]!.estado).toBe('ABIERTA');

    await deps.vencimientos.marcarPresentado(vencimiento.id, new Date('2026-04-12'), null, 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(1);
    expect(deps.alertas.alertas[0]!.estado).toBe('CERRADA');
    expect(deps.alertas.alertas[0]!.motivoCierre).toMatch(/ya no existe/);
  });

  it('mientras el problema siga, la alerta NO se cierra sola', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(0);
    expect(deps.alertas.alertas[0]!.estado).toBe('ABIERTA');
  });

  it('al cargarse los documentos faltantes, esa alerta también se cierra sola', async () => {
    const deps = armar();
    const proceso = await deps.procesoMensual.asegurar(CLIENTE, '2026-03', 'usr-1');
    await deps.procesoMensual.actualizar(
      CLIENTE, '2026-03', { ...proceso, documentosFaltantes: 3 } as never, 'usr-1',
    );
    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    // Los cargaron: ya no falta ninguno.
    await deps.procesoMensual.actualizar(
      CLIENTE, '2026-03', { ...proceso, documentosFaltantes: 0 } as never, 'usr-1',
    );
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(1);
    expect(deps.alertas.alertas[0]!.estado).toBe('CERRADA');
  });

  it('un período sin faltantes no genera nada', async () => {
    const deps = armar();
    await deps.procesoMensual.asegurar(CLIENTE, '2026-03', 'usr-1');

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(0);
  });
});
