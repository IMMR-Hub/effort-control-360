/**
 * Sincronización de OneDrive por cambios (tarea 158).
 *
 * Lo que importa probar no es que sea rápida —eso lo dice el drive real— sino
 * las salidas de seguridad: perder un cambio en silencio es la peor forma de
 * fallar una importación. Cada prueba de acá es un camino por el que un cambio
 * podría escaparse, o por el que el atajo tiene que rendirse y recorrer todo.
 */

import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { DriveFalso } from '@effort/drive';

import {
  crearEstadoDeSincronizacion,
  estadoDeSincronizacion,
  ultimaMedianocheProgramada,
  intentarSincronizar,
  sincronizarConCambios,
  sincronizarOneDrive,
  MAXIMO_DE_CAMBIOS_INCREMENTALES,
  type DependenciasIncrementales,
} from '../src/servicios/sincronizacionIncremental.js';
import type { AltaDeEvidencia } from '../src/servicios/sincronizadorDeOneDrive.js';
import { ClientesFalsos, clienteMinimo } from './dobles.js';
import { DocumentosFalsos } from './dobles-dominio.js';

const FUMIPRO = '11111111-1111-4111-8111-111111111111';
const NUEVO = '22222222-2222-4222-8222-222222222222';
const RAIZ = 'CLIENTES/002 FUMIPRO';
const USUARIO = 'usr-sistema';

function armar(inicio: Date = new Date('2026-09-24T12:00:00Z')) {
  const clientes = new ClientesFalsos();
  const documentos = new DocumentosFalsos();
  const origen = new DriveFalso();
  const destino = new DriveFalso();
  const estado = crearEstadoDeSincronizacion();
  let ahora = inicio;

  const porSha = new Map<string, { id: string }>();
  const altas: AltaDeEvidencia[] = [];
  const vistos = new Map<string, { itemIdOrigen: string; modificadoEnOrigen: Date | null }>();
  let fallarLaProximaCopia = false;

  clientes.clientes.push({
    ...clienteMinimo({ id: FUMIPRO, nombre: 'FUMIPRO S.A.', ruc: '80119631-0', activo: true }),
    carpetaOneDriveId: 'carpeta-fumipro',
  });
  origen.registrarCarpeta('carpeta-fumipro', RAIZ);

  const destinoConFallo = {
    listar: (c: string) => destino.listar(c),
    listarRecursivoPorId: (i: string) => destino.listarRecursivoPorId(i),
    leer: (i: string) => destino.leer(i),
    enlaceWeb: (i: string) => destino.enlaceWeb(i),
    escribir: (c: string, n: string, b: Buffer) => {
      if (fallarLaProximaCopia) {
        fallarLaProximaCopia = false;
        throw new Error('se cortó la conexión');
      }
      return destino.escribir(c, n, b);
    },
  };

  const deps: DependenciasIncrementales = {
    clientes,
    documentos,
    origen,
    destino: destinoConFallo,
    registrarEvidencia: async (datos: AltaDeEvidencia) => {
      altas.push(datos);
      const previa = porSha.get(datos.sha256);
      if (previa) return { evidencia: previa, esNueva: false };
      const evidencia = { id: randomUUID() };
      porSha.set(datos.sha256, evidencia);
      return { evidencia, esNueva: true };
    },
    huellasDeOrigen: async (clienteId) =>
      [...vistos.entries()].filter(([k]) => k.startsWith(`${clienteId}|`)).map(([, v]) => v),
    marcarArchivoDeOrigen: async (d) => {
      vistos.set(`${d.clienteId}|${d.itemIdOrigen}`, {
        itemIdOrigen: d.itemIdOrigen,
        modificadoEnOrigen: d.modificadoEnOrigen,
      });
    },
    ahora: () => ahora,
  };

  return {
    clientes, documentos, origen, destino, estado, deps, altas,
    correr: () => sincronizarConCambios(deps, USUARIO, estado),
    avanzarHoras: (horas: number) => {
      ahora = new Date(ahora.getTime() + horas * 3_600_000);
    },
    fallarLaProximaCopia: () => {
      fallarLaProximaCopia = true;
    },
  };
}

describe('sincronización de OneDrive por cambios', () => {
  it('la primera pasada recorre todo y las siguientes solo miran lo que cambió', async () => {
    const ctx = armar();
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));

    const primera = await ctx.correr();
    expect(primera.modo).toBe('completa');
    expect(primera.nuevosEnTotal).toBe(1);
    expect(ctx.origen.recorridosCompletos).toBe(1);

    const segunda = await ctx.correr();
    expect(segunda.modo).toBe('incremental');
    expect(segunda.nuevosEnTotal).toBe(0);
    expect(segunda.cambiosRecibidos).toBe(0);
    // Lo que se quería lograr: no volver a recorrer las carpetas.
    expect(ctx.origen.recorridosCompletos).toBe(1);
  });

  it('un archivo nuevo en una subcarpeta se copia sin recorrer nada, en la carpeta que le corresponde', async () => {
    const ctx = armar();
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    await ctx.correr();

    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026/RG 90`, 'RG COMPRAS 2026-09.xlsx', Buffer.from('nuevo'));
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.cambiosRecibidos).toBe(1);
    expect(resumen.nuevosEnTotal).toBe(1);
    expect(ctx.origen.recorridosCompletos).toBe(1);
    expect(ctx.documentos.documentos).toHaveLength(2);
    // Sin el «CLIENTES/002 FUMIPRO» del origen adelante: la ruta es relativa a la
    // carpeta del cliente, igual que en la pasada completa.
    const alta = ctx.altas.at(-1)!;
    expect(alta.rutaOneDrive).toBe('EFFORT Control 360/Entrada/FUMIPRO S.A./PERIODO 2026/RG 90/RG COMPRAS 2026-09.xlsx');
    expect(alta.itemIdOrigen).not.toBeNull();
  });

  it('un archivo modificado (mismo id, fecha nueva) se vuelve a copiar', async () => {
    const ctx = armar();
    const original = ctx.origen.sembrar(RAIZ, 'planilla.xlsx', Buffer.from('v1'), {
      modificadoEn: new Date('2026-09-01T00:00:00Z'),
    });
    await ctx.correr();

    ctx.origen.sembrar(RAIZ, 'planilla.xlsx', Buffer.from('v2'), {
      itemId: original.itemId,
      modificadoEn: new Date('2026-09-24T11:00:00Z'),
    });
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.cambiosRecibidos).toBe(1);
    expect(ctx.altas).toHaveLength(2);
  });

  it('un cambio en una carpeta que no es de ningún cliente se ignora, sin fallo', async () => {
    const ctx = armar();
    await ctx.correr();

    ctx.origen.sembrar('CLIENTES/OTRA GENTE', 'ajeno.pdf', Buffer.from('x'));
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.cambiosRecibidos).toBe(1);
    expect(resumen.nuevosEnTotal).toBe(0);
    expect(resumen.fallos).toEqual([]);
    expect(ctx.altas).toHaveLength(0);
  });

  it('un archivo borrado se ignora: la evidencia que ya se copió no se toca', async () => {
    const ctx = armar();
    const archivo = ctx.origen.sembrar(RAIZ, 'a.pdf', Buffer.from('a'));
    await ctx.correr();

    ctx.origen.eliminarParaPruebas(archivo.itemId);
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.cambiosRecibidos).toBe(0);
    expect(resumen.fallos).toEqual([]);
  });

  it('si Graph dice que el token venció, recorre todo y no pierde el archivo nuevo', async () => {
    const ctx = armar();
    await ctx.correr();
    ctx.origen.sembrar(RAIZ, 'llegó mientras tanto.pdf', Buffer.from('n'));
    ctx.origen.vencerTokens();

    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('completa');
    expect(resumen.motivoDePasadaCompleta).toMatch(/venció/);
    expect(resumen.nuevosEnTotal).toBe(1);
  });

  it('si una copia falla por algo pasajero, el mismo cambio se pide de nuevo en la vuelta siguiente', async () => {
    const ctx = armar();
    await ctx.correr();

    ctx.origen.sembrar(RAIZ, 'importante.pdf', Buffer.from('i'));
    ctx.fallarLaProximaCopia();
    const fallida = await ctx.correr();
    expect(fallida.modo).toBe('incremental');
    expect(fallida.errores).toBe(1);
    expect(fallida.nuevosEnTotal).toBe(0);

    // Nada nuevo en el origen: el cambio viene otra vez porque el token no avanzó.
    const reintento = await ctx.correr();
    expect(reintento.modo).toBe('incremental');
    expect(reintento.cambiosRecibidos).toBe(1);
    expect(reintento.nuevosEnTotal).toBe(1);

    // Y ahora sí terminó: la siguiente ya no lo trae.
    const despues = await ctx.correr();
    expect(despues.cambiosRecibidos).toBe(0);
  });

  it('un archivo demasiado grande se informa pero no cuenta como error que haya que reintentar', async () => {
    const ctx = armar();
    await ctx.correr();
    const grande = ctx.origen.sembrar(RAIZ, 'gigante.zip', Buffer.from('g'));
    // El doble no deja fijar el tamaño: se simula desde el listado de cambios.
    const original = ctx.origen.cambiosDesde.bind(ctx.origen);
    ctx.origen.cambiosDesde = async (token) => {
      const r = await original(token);
      return {
        ...r,
        cambios: r.cambios.map((c) => (c.itemId === grande.itemId ? { ...c, tamanoBytes: 30 * 1024 * 1024 } : c)),
      };
    };

    const resumen = await ctx.correr();

    expect(resumen.fallos).toHaveLength(1);
    expect(resumen.errores).toBe(0);
    // Como no es un error, el token avanzó: no se vuelve a pedir en cada vuelta.
    expect((await ctx.correr()).cambiosRecibidos).toBe(0);
  });

  // Daniel, 2026-09-24: a la medianoche de lunes a sábado se revisa todo, por si
  // alguien se olvidó de actualizar algo. A esa hora nadie mira, así que no importa
  // que tarde, y hace de respaldo. Paraguay es UTC-3: 04:00Z son las 01:00 locales.
  it('a la medianoche de Paraguay hace la pasada completa, por si un cambio se escapó', async () => {
    const ctx = armar(new Date('2026-09-24T12:00:00Z')); // jueves 09:00 en Paraguay
    await ctx.correr();

    ctx.avanzarHoras(14); // jueves 23:00 local: todavía no fue medianoche
    expect((await ctx.correr()).modo).toBe('incremental');

    ctx.avanzarHoras(2); // viernes 01:00 local: ya pasó la medianoche
    const noche = await ctx.correr();
    expect(noche.modo).toBe('completa');
    expect(noche.motivoDePasadaCompleta).toMatch(/medianoche/);

    // Y una vez hecha, no se repite hasta la medianoche siguiente.
    expect((await ctx.correr()).modo).toBe('incremental');
  });

  it('el domingo no hay pasada completa: la que sigue es la del lunes', async () => {
    const ctx = armar(new Date('2026-09-26T12:00:00Z')); // sábado 09:00 local
    await ctx.correr();

    ctx.avanzarHoras(16); // domingo 01:00 local: la medianoche del domingo no se programa
    expect((await ctx.correr()).modo).toBe('incremental');

    ctx.avanzarHoras(24); // lunes 01:00 local
    expect((await ctx.correr()).modo).toBe('completa');
  });

  it('la última medianoche programada es siempre las 00:00 de Paraguay de un día de lunes a sábado', () => {
    // jueves 24/09 09:00 local → jueves 00:00 local = 03:00Z
    expect(ultimaMedianocheProgramada(new Date('2026-09-24T12:00:00Z')).toISOString()).toBe('2026-09-24T03:00:00.000Z');
    // sábado 26/09 23:30 local → sábado 00:00 local
    expect(ultimaMedianocheProgramada(new Date('2026-09-27T02:30:00Z')).toISOString()).toBe('2026-09-26T03:00:00.000Z');
    // domingo 27/09 15:00 local → la del sábado
    expect(ultimaMedianocheProgramada(new Date('2026-09-27T18:00:00Z')).toISOString()).toBe('2026-09-26T03:00:00.000Z');
    // lunes 28/09 00:10 local → lunes 00:00 local
    expect(ultimaMedianocheProgramada(new Date('2026-09-28T03:10:00Z')).toISOString()).toBe('2026-09-28T03:00:00.000Z');
  });

  it('un cliente que todavía no se conocía obliga a la pasada completa', async () => {
    const ctx = armar();
    await ctx.correr();

    ctx.origen.registrarCarpeta('carpeta-nuevo', 'CLIENTES/003 NUEVO');
    ctx.origen.sembrar('CLIENTES/003 NUEVO', 'viejo.pdf', Buffer.from('v'));
    ctx.clientes.clientes.push({
      ...clienteMinimo({ id: NUEVO, nombre: 'NUEVO S.A.', ruc: '80000001-1', activo: true }),
      carpetaOneDriveId: 'carpeta-nuevo',
    });

    const resumen = await ctx.correr();

    // Sus archivos anteriores no están en ningún cambio: solo una pasada completa los ve.
    expect(resumen.modo).toBe('completa');
    expect(resumen.nuevosEnTotal).toBe(1);
  });

  it('con demasiados cambios juntos, recorre todo en vez de resolver rutas una por una', async () => {
    const ctx = armar();
    await ctx.correr();

    for (let i = 0; i < MAXIMO_DE_CAMBIOS_INCREMENTALES + 1; i += 1) {
      ctx.origen.sembrar(RAIZ, `f${i}.pdf`, Buffer.from(`c${i}`));
    }
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('completa');
    expect(resumen.motivoDePasadaCompleta).toMatch(/cambios juntos/);
  });

  it('nunca se le pide al drive de origen que escriba', async () => {
    const ctx = armar();
    ctx.origen.sembrar(RAIZ, 'a.pdf', Buffer.from('a'));
    await ctx.correr();
    ctx.origen.sembrar(RAIZ, 'b.pdf', Buffer.from('b'));
    await ctx.correr();

    // Lo único que hay en el origen es lo que se sembró.
    expect(await ctx.origen.listarRecursivoPorId('carpeta-fumipro')).toHaveLength(2);
  });

  it('un origen que no admite consulta de cambios sigue funcionando como antes', async () => {
    const ctx = armar();
    ctx.origen.sembrar(RAIZ, 'a.pdf', Buffer.from('a'));
    const soloListado = {
      listar: (c: string) => ctx.origen.listar(c),
      listarRecursivoPorId: (i: string) => ctx.origen.listarRecursivoPorId(i),
      leer: (i: string) => ctx.origen.leer(i),
      escribir: (c: string, n: string, b: Buffer) => ctx.origen.escribir(c, n, b),
      enlaceWeb: (i: string) => ctx.origen.enlaceWeb(i),
    };

    const resumen = await sincronizarOneDrive({ ...ctx.deps, origen: soloListado }, USUARIO);

    expect(resumen.modo).toBe('completa');
    expect(resumen.nuevosEnTotal).toBe(1);
  });

  it('el estado es por drive: dos drives distintos no comparten token', () => {
    const a = estadoDeSincronizacion(new DriveFalso());
    const b = estadoDeSincronizacion(new DriveFalso());
    a.token = 'x';
    expect(b.token).toBeNull();
  });
});

describe('una sola sincronización a la vez', () => {
  it('mientras una corre, otra no arranca y lo dice', async () => {
    let liberar!: () => void;
    const larga = intentarSincronizar(() => new Promise<string>((r) => { liberar = () => r('ok'); }));

    const segunda = await intentarSincronizar(async () => 'no debería correr');
    expect(segunda).toEqual({ ocupado: true });

    liberar();
    expect(await larga).toEqual({ ocupado: false, valor: 'ok' });
    // Y al terminar, se puede volver a correr.
    expect(await intentarSincronizar(async () => 'de nuevo')).toEqual({ ocupado: false, valor: 'de nuevo' });
  });

  it('si la tarea falla, el candado se libera', async () => {
    await expect(intentarSincronizar(async () => { throw new Error('falló'); })).rejects.toThrow('falló');
    expect(await intentarSincronizar(async () => 'ok')).toEqual({ ocupado: false, valor: 'ok' });
  });
});
