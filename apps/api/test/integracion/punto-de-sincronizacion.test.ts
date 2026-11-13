/**
 * El punto de sincronización con OneDrive, contra PostgreSQL real (2026-11-12).
 *
 * Lo que se guarda decide si después de un reinicio se recorren o no las
 * carpetas de todos los clientes. Tiene que volver exactamente como se guardó
 * —la fecha incluida, que decide la pasada de medianoche—, y un valor con otra
 * forma tiene que fallar en voz alta, no devolver un punto a medias.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PuntoDeSincronizacionPrisma } from '../../src/repositorios/puntoDeSincronizacion.js';
import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';

describe.skipIf(!HAY_BASE_DE_DATOS)('punto de sincronización en la base', () => {
  let entorno: EntornoDePrueba;
  let punto: PuntoDeSincronizacionPrisma;

  beforeAll(async () => {
    entorno = await crearEntorno();
    punto = new PuntoDeSincronizacionPrisma(entorno.prisma);
  });

  afterAll(async () => {
    await entorno.destruir();
  });

  it('sin nada guardado devuelve null', async () => {
    expect(await punto.leer()).toBeNull();
  });

  it('lo guardado vuelve igual: token, carpetas y fecha de la última pasada completa', async () => {
    const guardado = {
      token: 'https://graph.microsoft.com/v1.0/drives/x/root/delta?token=abc123',
      rutasDeClientes: { 'carpeta-002': 'CLIENTES/002 FUMIPRO', 'carpeta-021': 'CLIENTES/021 COPESA' },
      ultimaPasadaCompletaEn: new Date('2026-11-12T03:00:00.123Z'),
    };

    await punto.guardar(guardado);

    expect(await punto.leer()).toEqual(guardado);
  });

  it('guardar de nuevo pisa la misma fila, no agrega otra', async () => {
    await punto.guardar({ token: 'uno', rutasDeClientes: {}, ultimaPasadaCompletaEn: null });
    await punto.guardar({ token: 'dos', rutasDeClientes: { c: 'CLIENTES/C' }, ultimaPasadaCompletaEn: null });

    expect(await punto.leer()).toEqual({ token: 'dos', rutasDeClientes: { c: 'CLIENTES/C' }, ultimaPasadaCompletaEn: null });
    expect(await entorno.prisma.estadoDelSistema.count()).toBe(1);
  });

  it('un punto sin token (la última pasada no terminó limpia) se guarda y se lee como tal', async () => {
    await punto.guardar({ token: null, rutasDeClientes: {}, ultimaPasadaCompletaEn: null });

    expect(await punto.leer()).toEqual({ token: null, rutasDeClientes: {}, ultimaPasadaCompletaEn: null });
  });

  it('un valor con otra forma no se interpreta: leer falla', async () => {
    await entorno.prisma.estadoDelSistema.update({
      where: { clave: 'onedrive' },
      data: { valor: { token: 'x', carpetas: [] } },
    });

    await expect(punto.leer()).rejects.toThrow();
  });
});
