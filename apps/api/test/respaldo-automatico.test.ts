/**
 * Respaldo automático de la base.
 *
 * Lo que importa probar acá no es que escriba un archivo, sino las tres cosas
 * que hacen que un respaldo sirva el día que hace falta:
 *
 *  - Que NO escriba en la base. La herramienta que protege los datos no puede
 *    ser capaz de dañarlos.
 *  - Que los importes en `bigint` sobrevivan al viaje. Son guaraníes (ADR 0002)
 *    y `JSON.stringify` no los sabe serializar: un respaldo que los pierde
 *    restaura cifras equivocadas, que es peor que no restaurar nada.
 *  - Que un modelo que ya no existe no rompa el respaldo entero.
 */

import { describe, expect, it, vi } from 'vitest';

import { DriveFalso } from '@effort/drive';

import { generarRespaldo } from '../src/servicios/respaldoAutomatico.js';

const AHORA = new Date('2026-09-14T12:00:00Z');

function lectorCon(datos: Record<string, unknown[]>) {
  const lector: Record<string, { findMany: () => Promise<unknown[]> }> = {};
  for (const [modelo, filas] of Object.entries(datos)) {
    lector[modelo] = { findMany: async () => filas };
  }
  return lector;
}

describe('respaldo automático', () => {
  it('guarda el volcado en la carpeta del sistema, con la fecha en el nombre', async () => {
    const drive = new DriveFalso();
    const lector = lectorCon({ cliente: [{ id: 'c1', nombre: 'FUMIPRO S.A.' }] });

    const resumen = await generarRespaldo(lector, drive, AHORA);

    expect(resumen.archivo).toBe('EFFORT Control 360/Respaldo/respaldo-2026-09-14.json');
    expect(resumen.filas).toBe(1);
  });

  /*
   * El que más importa. Un respaldo que convierte 1.548.000 guaraníes en otra
   * cosa restaura cifras equivocadas — y nadie lo nota hasta que hay que usarlo.
   */
  it('los importes en bigint sobreviven al volcado', async () => {
    const drive = new DriveFalso();
    const lector = lectorCon({
      liquidacionIvaRg90: [{ periodo: '2026-06', creditoFiscal: 15238603n, debitoFiscal: 20049251n }],
    });

    await generarRespaldo(lector, drive, AHORA);

    const archivos = await drive.listar('EFFORT Control 360/Respaldo');
    const contenido = JSON.parse((await drive.leer(archivos[0]!.itemId)).toString('utf8'));
    const fila = contenido.modelos.liquidacionIvaRg90[0];

    expect(fila.creditoFiscal).toEqual({ __bigint: '15238603' });
    // Y se puede volver a bigint sin ambigüedad, que es el punto de envolverlo.
    expect(BigInt(fila.creditoFiscal.__bigint)).toBe(15238603n);
  });

  // El esquema evoluciona; el respaldo tiene que seguir funcionando mientras
  // tanto. Que falte un modelo se informa, no se convierte en un fallo.
  it('un modelo que no existe se saltea y se informa', async () => {
    const drive = new DriveFalso();
    const lector = lectorCon({ cliente: [] });

    const resumen = await generarRespaldo(lector, drive, AHORA);

    expect(resumen.modelosSalteados).toContain('usuario');
    expect(resumen.modelosSalteados).toContain('documento');
  });

  /*
   * La regla que hace que se pueda confiar en esta herramienta: no toca la base.
   * Se comprueba de la forma más directa posible — si el lector expusiera algo
   * capaz de escribir, el respaldo no lo usa.
   */
  it('no escribe en la base: solo llama a findMany', async () => {
    const drive = new DriveFalso();
    const findMany = vi.fn(async () => [{ id: 'c1' }]);
    const create = vi.fn();
    const deleteMany = vi.fn();
    const update = vi.fn();

    await generarRespaldo({ cliente: { findMany, create, deleteMany, update } }, drive, AHORA);

    expect(findMany).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('informa cuánto pesa, para que un crecimiento raro se vea', async () => {
    const drive = new DriveFalso();
    const lector = lectorCon({ cliente: [{ id: 'c1', nombre: 'FUMIPRO S.A.' }] });

    const resumen = await generarRespaldo(lector, drive, AHORA);

    expect(resumen.tamanoMb).toBeGreaterThanOrEqual(0);
    expect(resumen.tamanoMb).toBeLessThan(1);
  });
});
