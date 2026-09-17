/**
 * Un solo cálculo de IVA a la vez.
 *
 * El botón "Recalcular" y la corrida automática pueden coincidir. Si los dos
 * corren juntos se duplica la memoria y se pueden repetir hallazgos, así que el
 * segundo tiene que enterarse de que no le toca — y el candado tiene que
 * soltarse aunque el primero falle, o el IVA no se vuelve a calcular nunca.
 */

import { describe, expect, it } from 'vitest';

import { intentarConCandado } from '../src/servicios/candadoDeIva.js';

describe('candado del cálculo de IVA', () => {
  it('un segundo cálculo mientras corre el primero no se ejecuta', async () => {
    let soltar!: () => void;
    const primero = intentarConCandado(
      () => new Promise<string>((resolver) => (soltar = () => resolver('primero'))),
    );

    let segundoCorrio = false;
    const segundo = await intentarConCandado(async () => {
      segundoCorrio = true;
      return 'segundo';
    });

    expect(segundo).toEqual({ ocupado: true });
    expect(segundoCorrio).toBe(false);

    soltar();
    expect(await primero).toEqual({ ocupado: false, valor: 'primero' });
  });

  it('se libera al terminar, y el siguiente cálculo corre', async () => {
    await intentarConCandado(async () => 1);
    expect(await intentarConCandado(async () => 2)).toEqual({ ocupado: false, valor: 2 });
  });

  it('se libera aunque el cálculo falle', async () => {
    await expect(
      intentarConCandado(async () => {
        throw new Error('planilla rota');
      }),
    ).rejects.toThrow('planilla rota');

    expect(await intentarConCandado(async () => 'sigue')).toEqual({ ocupado: false, valor: 'sigue' });
  });
});
