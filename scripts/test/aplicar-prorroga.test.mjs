/**
 * Planificación de una prórroga por resolución.
 *
 * Lo que se prueba acá es el único punto con criterio del script: a quién se
 * corre, a quién no, y qué fecha se conserva como origen. La escritura misma
 * es un UPDATE y un INSERT; lo que puede salir mal es decidir mal.
 */

import { describe, expect, it } from 'vitest';

import { argumento, planificarProrroga } from '../aplicar-prorroga.mjs';

const fila = (cliente, fechaVencimiento, original = null) => ({
  id: `id-${cliente}`,
  cliente,
  cliente_id: `cli-${cliente}`,
  estado: 'VIGENTE',
  fecha_vencimiento: new Date(`${fechaVencimiento}T00:00:00.000Z`),
  fecha_vencimiento_original: original ? new Date(`${original}T00:00:00.000Z`) : null,
});

describe('planificar una prórroga por resolución', () => {
  it('corre a los que tienen otra fecha y conserva la que les fijaba el calendario', () => {
    const { aCorrer } = planificarProrroga(
      [fila('DIBEC', '2026-04-20'), fila('ECOAGRO', '2026-04-27')],
      '2026-06-30',
    );

    expect(aCorrer.map((f) => [f.cliente, f.fechaAnterior, f.fechaOriginal])).toEqual([
      ['DIBEC', '2026-04-20', '2026-04-20'],
      ['ECOAGRO', '2026-04-27', '2026-04-27'],
    ]);
  });

  /*
   * Lo que hace seguro reintentar: con la red de esta máquina cortándose a la
   * mitad, una corrida que no se puede repetir es una corrida que no se puede
   * terminar.
   */
  it('saltea a los que ya están en la fecha nueva', () => {
    const { aCorrer, yaEstaban } = planificarProrroga(
      [fila('DIBEC', '2026-06-30', '2026-04-20'), fila('SIPAR', '2026-04-13')],
      '2026-06-30',
    );

    expect(aCorrer.map((f) => f.cliente)).toEqual(['SIPAR']);
    expect(yaEstaban.map((f) => f.cliente)).toEqual(['DIBEC']);
  });

  it('una segunda prórroga NO pisa la fecha original del calendario', () => {
    const { aCorrer } = planificarProrroga(
      [fila('FUMIPRO', '2026-06-30', '2026-04-09')],
      '2026-07-31',
    );

    expect(aCorrer[0].fechaAnterior).toBe('2026-06-30');
    expect(aCorrer[0].fechaOriginal).toBe('2026-04-09');
  });

  it('sin filas no hay nada que correr', () => {
    expect(planificarProrroga([], '2026-06-30')).toEqual({ aCorrer: [], yaEstaban: [] });
  });
});

describe('lectura de argumentos', () => {
  it('toma el valor que sigue a la clave', () => {
    expect(argumento(['--motivo', 'RG 50/2026', '--aplicar'], 'motivo')).toBe('RG 50/2026');
  });

  it('devuelve null si la clave no está o viene sin valor', () => {
    expect(argumento(['--aplicar'], 'motivo')).toBeNull();
    expect(argumento(['--motivo'], 'motivo')).toBeNull();
  });
});
