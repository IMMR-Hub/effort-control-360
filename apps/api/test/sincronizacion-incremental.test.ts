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
  sincronizarUnCliente,
  MAXIMO_DE_CAMBIOS_INCREMENTALES,
  MAXIMO_DE_CLIENTES_NUEVOS_INCREMENTALES,
  type AlmacenDelPuntoDeSincronizacion,
  type DependenciasIncrementales,
  type PuntoDeSincronizacion,
} from '../src/servicios/sincronizacionIncremental.js';
import type { AltaDeEvidencia } from '../src/servicios/sincronizadorDeOneDrive.js';
import { ClientesFalsos, clienteMinimo } from './dobles.js';
import { DocumentosFalsos } from './dobles-dominio.js';

const FUMIPRO = '11111111-1111-4111-8111-111111111111';
const NUEVO = '22222222-2222-4222-8222-222222222222';
const RAIZ = 'CLIENTES/002 FUMIPRO';
const USUARIO = 'usr-sistema';

/** El punto guardado «en la base», en memoria, con forma de fallar a pedido. */
function almacenEnMemoria() {
  const almacen = {
    guardado: null as PuntoDeSincronizacion | null,
    guardados: 0,
    fallarAlLeer: false,
    fallarAlGuardar: false,
    async leer() {
      if (almacen.fallarAlLeer) throw new Error('la tabla no existe');
      return almacen.guardado;
    },
    async guardar(punto: PuntoDeSincronizacion) {
      if (almacen.fallarAlGuardar) throw new Error('sin conexión a la base');
      almacen.guardado = punto;
      almacen.guardados += 1;
    },
  };
  return almacen satisfies AlmacenDelPuntoDeSincronizacion;
}

function armar(inicio: Date = new Date('2026-09-24T12:00:00Z'), opciones: { conAlmacen?: boolean } = {}) {
  const clientes = new ClientesFalsos();
  const documentos = new DocumentosFalsos();
  const origen = new DriveFalso();
  const destino = new DriveFalso();
  let estado = crearEstadoDeSincronizacion();
  const almacen = almacenEnMemoria();
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
    registrarEnBitacora: async () => {},
    ahora: () => ahora,
    ...(opciones.conAlmacen ? { almacenDelPunto: almacen } : {}),
  };

  return {
    clientes, documentos, origen, destino, estado, deps, altas, almacen,
    correr: () => sincronizarConCambios(deps, USUARIO, estado),
    /** El servidor se reinicia: lo que había en memoria se pierde, la base queda. */
    reiniciarServidor: () => {
      estado = crearEstadoDeSincronizacion();
    },
    avanzarHoras: (horas: number) => {
      ahora = new Date(ahora.getTime() + horas * 3_600_000);
    },
    fallarLaProximaCopia: () => {
      fallarLaProximaCopia = true;
    },
  };
}

function agregarCliente(ctx: ReturnType<typeof armar>, id: string, nombre: string, carpeta: string) {
  ctx.clientes.clientes.push({
    ...clienteMinimo({ id, nombre, ruc: '80000001-1', activo: true }),
    carpetaOneDriveId: carpeta,
  });
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

  /*
   * 2026-11-13: antes un cliente nuevo obligaba a recorrer las carpetas de
   * TODOS (22 minutos con 87). Sus archivos viejos no están en ningún cambio, así
   * que hay que listar su carpeta entera — pero solo la suya.
   */
  it('un cliente que todavía no se conocía: se lista entera SU carpeta y las demás siguen por cambios', async () => {
    const ctx = armar();
    await ctx.correr();
    const recorridosAntes = ctx.origen.recorridosCompletos;

    ctx.origen.registrarCarpeta('carpeta-nuevo', 'CLIENTES/003 NUEVO');
    ctx.origen.sembrar('CLIENTES/003 NUEVO', 'viejo.pdf', Buffer.from('v'));
    agregarCliente(ctx, NUEVO, 'NUEVO S.A.', 'carpeta-nuevo');

    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.clientesNuevosRecorridos).toBe(1);
    expect(resumen.nuevosEnTotal).toBe(1);
    // Una sola carpeta recorrida: la del cliente nuevo, no la de FUMIPRO.
    expect(ctx.origen.recorridosCompletos).toBe(recorridosAntes + 1);

    // Ya es conocido: la vuelta siguiente no lo vuelve a listar, y un archivo
    // suyo subido después llega por cambios.
    ctx.origen.sembrar('CLIENTES/003 NUEVO/PERIODO 2026', 'despues.pdf', Buffer.from('d'));
    const siguiente = await ctx.correr();
    expect(siguiente.modo).toBe('incremental');
    expect(siguiente.clientesNuevosRecorridos).toBe(0);
    expect(siguiente.nuevosEnTotal).toBe(1);
    expect(ctx.origen.recorridosCompletos).toBe(recorridosAntes + 1);
  });

  it('cliente nuevo: si la vuelta no terminó limpia, sigue siendo nuevo y se lo vuelve a listar entero', async () => {
    const ctx = armar();
    await ctx.correr();

    ctx.origen.registrarCarpeta('carpeta-nuevo', 'CLIENTES/003 NUEVO');
    ctx.origen.sembrar('CLIENTES/003 NUEVO', 'a.pdf', Buffer.from('a'));
    ctx.origen.sembrar('CLIENTES/003 NUEVO', 'b.pdf', Buffer.from('b'));
    agregarCliente(ctx, NUEVO, 'NUEVO S.A.', 'carpeta-nuevo');
    ctx.fallarLaProximaCopia();

    const conFallo = await ctx.correr();
    expect(conFallo.errores).toBe(1);
    expect(conFallo.nuevosEnTotal).toBe(1);

    const reintento = await ctx.correr();
    expect(reintento.clientesNuevosRecorridos).toBe(1);
    expect(reintento.nuevosEnTotal).toBe(1);
    expect(ctx.documentos.documentos.filter((d) => d.clienteId === NUEVO)).toHaveLength(2);

    expect((await ctx.correr()).clientesNuevosRecorridos).toBe(0);
  });

  /*
   * Revisión del 2026-11-13 (hallazgo confirmado): a FUMIPRO le reemplazan la
   * carpeta por otra con la MISMA ruta. Con «la primera raíz que coincide», un
   * archivo subido después caía en la carpeta vieja, nadie lo listaba, y el
   * token avanzaba igual: se perdía hasta la medianoche.
   */
  it('si a un cliente le reemplazan la carpeta por otra con la misma ruta, lo que se sube después llega igual', async () => {
    const ctx = armar();
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    await ctx.correr();

    ctx.origen.registrarCarpeta('carpeta-fumipro-2', RAIZ);
    ctx.clientes.clientes[0] = { ...ctx.clientes.clientes[0]!, carpetaOneDriveId: 'carpeta-fumipro-2' };
    expect((await ctx.correr()).clientesNuevosRecorridos).toBe(1);

    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'subido-despues.pdf', Buffer.from('nuevo'));
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.nuevosEnTotal).toBe(1);
    expect([...ctx.estado.rutasDeClientes.keys()]).toEqual(['carpeta-fumipro-2']);
  });

  it('con una carpeta de cliente dentro de otra, el cambio va a la más específica', async () => {
    const ctx = armar();
    ctx.origen.registrarCarpeta('carpeta-anidada', `${RAIZ}/SUCURSAL`);
    agregarCliente(ctx, NUEVO, 'SUCURSAL S.A.', 'carpeta-anidada');
    await ctx.correr();

    ctx.origen.sembrar(`${RAIZ}/SUCURSAL/PERIODO 2026`, 'de-la-sucursal.pdf', Buffer.from('s'));
    const resumen = await ctx.correr();

    expect(resumen.modo).toBe('incremental');
    expect(resumen.nuevosEnTotal).toBe(1);
    expect(ctx.documentos.documentos.at(-1)?.clienteId).toBe(NUEVO);
  });

  it(`con más de ${MAXIMO_DE_CLIENTES_NUEVOS_INCREMENTALES} clientes nuevos juntos (una carga masiva), recorre todo`, async () => {
    const ctx = armar();
    await ctx.correr();

    for (let i = 0; i <= MAXIMO_DE_CLIENTES_NUEVOS_INCREMENTALES; i += 1) {
      const carpeta = `carpeta-masiva-${i}`;
      ctx.origen.registrarCarpeta(carpeta, `CLIENTES/${200 + i} MASIVO ${i}`);
      agregarCliente(ctx, `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`, `MASIVO ${i} S.A.`, carpeta);
    }

    const resumen = await ctx.correr();
    expect(resumen.modo).toBe('completa');
    expect(resumen.motivoDePasadaCompleta).toMatch(/todos juntos/);
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

/*
 * 2026-11-12. El punto vivía solo en memoria y cada despliegue arrancaba con
 * una pasada completa de 22 minutos. Ahora se guarda en la base. Cada prueba de
 * acá es una forma en que retomar podría hacer perder un cambio, o en que una
 * falla del guardado podría pasar en silencio.
 */
describe('el punto de sincronización sobrevive a un reinicio del servidor', () => {
  it('con el punto guardado, después de reiniciar NO recorre todo y trae lo que cambió mientras estuvo apagado', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    expect((await ctx.correr()).modo).toBe('completa');
    expect(ctx.origen.recorridosCompletos).toBe(1);

    ctx.reiniciarServidor();
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'subido-durante-el-despliegue.pdf', Buffer.from('b'));
    const despues = await ctx.correr();

    expect(despues.modo).toBe('incremental');
    expect(despues.cambiosRecibidos).toBe(1);
    expect(despues.nuevosEnTotal).toBe(1);
    expect(despues.avisoDelPunto).toBeNull();
    expect(ctx.origen.recorridosCompletos).toBe(1);
    expect(ctx.documentos.documentos).toHaveLength(2);
  });

  it('sin almacén se comporta como siempre: cada arranque recorre todo', async () => {
    const ctx = armar();
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    await ctx.correr();

    ctx.reiniciarServidor();
    const despues = await ctx.correr();

    expect(despues.modo).toBe('completa');
    expect(ctx.origen.recorridosCompletos).toBe(2);
  });

  it('sin punto guardado todavía, recorre todo y dice por qué', async () => {
    const ctx = armar(undefined, { conAlmacen: true });

    const primera = await ctx.correr();

    expect(primera.modo).toBe('completa');
    expect(primera.motivoDePasadaCompleta).toMatch(/no había un punto de sincronización guardado/);
    expect(ctx.almacen.guardado?.token).not.toBeNull();
    expect(ctx.almacen.guardado?.rutasDeClientes).toEqual({ 'carpeta-fumipro': RAIZ });
  });

  it('el punto guardado avanza con cada vuelta limpia', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    await ctx.correr();
    const alArrancar = ctx.almacen.guardado!.token;

    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'b.pdf', Buffer.from('b'));
    await ctx.correr();

    expect(ctx.almacen.guardado!.token).not.toBe(alArrancar);
  });

  it('si un archivo falló al copiarse, el punto guardado NO avanza: tras reiniciar se vuelve a pedir ese cambio', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    await ctx.correr();
    const antes = ctx.almacen.guardado!.token;

    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'se-corta.pdf', Buffer.from('c'));
    ctx.fallarLaProximaCopia();
    const conFallo = await ctx.correr();
    expect(conFallo.errores).toBe(1);
    expect(ctx.almacen.guardado!.token).toBe(antes);

    ctx.reiniciarServidor();
    const reintento = await ctx.correr();

    expect(reintento.modo).toBe('incremental');
    expect(reintento.nuevosEnTotal).toBe(1);
    expect(ctx.documentos.documentos).toHaveLength(1);
  });

  it('si la pasada completa no terminó limpia, lo guardado queda sin punto y tras reiniciar se recorre todo', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    ctx.fallarLaProximaCopia();
    const primera = await ctx.correr();
    expect(primera.errores).toBe(1);
    expect(ctx.almacen.guardado).toMatchObject({ token: null });

    ctx.reiniciarServidor();
    const segunda = await ctx.correr();

    expect(segunda.modo).toBe('completa');
    expect(segunda.motivoDePasadaCompleta).toMatch(/no terminó limpia/);
    expect(segunda.nuevosEnTotal).toBe(1);
  });

  it('la pasada de medianoche sigue valiendo después de un reinicio', async () => {
    const ctx = armar(new Date('2026-09-24T12:00:00Z'), { conAlmacen: true });
    await ctx.correr();

    ctx.reiniciarServidor();
    ctx.avanzarHoras(24);
    const alOtroDia = await ctx.correr();

    expect(alOtroDia.modo).toBe('completa');
    expect(alOtroDia.motivoDePasadaCompleta).toMatch(/medianoche/);
  });

  it('un cliente que el punto guardado no conocía: después de reiniciar se lista solo su carpeta, y queda guardado', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    await ctx.correr();
    const recorridosAntes = ctx.origen.recorridosCompletos;

    ctx.reiniciarServidor();
    ctx.origen.registrarCarpeta('carpeta-nuevo', 'CLIENTES/003 NUEVO');
    ctx.origen.sembrar('CLIENTES/003 NUEVO', 'viejo.pdf', Buffer.from('v'));
    agregarCliente(ctx, NUEVO, 'NUEVO S.A.', 'carpeta-nuevo');
    const despues = await ctx.correr();

    expect(despues.modo).toBe('incremental');
    expect(despues.clientesNuevosRecorridos).toBe(1);
    expect(despues.nuevosEnTotal).toBe(1);
    expect(ctx.origen.recorridosCompletos).toBe(recorridosAntes + 1);
    expect(ctx.almacen.guardado?.rutasDeClientes).toEqual({
      'carpeta-fumipro': RAIZ,
      'carpeta-nuevo': 'CLIENTES/003 NUEVO',
    });
  });

  it('si el punto no se puede leer, no se adivina: recorre todo y dice por qué', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    await ctx.correr();

    ctx.reiniciarServidor();
    ctx.almacen.fallarAlLeer = true;
    const despues = await ctx.correr();

    expect(despues.modo).toBe('completa');
    expect(despues.motivoDePasadaCompleta).toMatch(/no se pudo leer el punto de sincronización guardado \(la tabla no existe\)/);
    expect(ctx.origen.recorridosCompletos).toBe(2);
  });

  it('si el punto no se puede guardar, la sincronización sigue y el resultado lo avisa', async () => {
    const ctx = armar(undefined, { conAlmacen: true });
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));
    ctx.almacen.fallarAlGuardar = true;

    const primera = await ctx.correr();
    expect(primera.nuevosEnTotal).toBe(1);
    expect(primera.avisoDelPunto).toMatch(/no se pudo guardar el punto de sincronización \(sin conexión a la base\)/);

    // En memoria el punto sí quedó: mientras el servidor no se reinicie, sigue por cambios.
    const segunda = await ctx.correr();
    expect(segunda.modo).toBe('incremental');
    expect(segunda.avisoDelPunto).toMatch(/no se pudo guardar/);

    // Y cuando la base vuelve, el aviso se va.
    ctx.almacen.fallarAlGuardar = false;
    expect((await ctx.correr()).avisoDelPunto).toBeNull();
    expect(ctx.almacen.guardado?.token).not.toBeNull();
  });
});

/*
 * 2026-11-13, Daniel: «solo se hace la sincro a pedido y solo el archivo que se
 * pide o la carpeta de ese cliente». Lo que tiene que quedar fijo: recorre UNA
 * carpeta, no toca el punto de las vueltas por cambios, y no trae nada de otro
 * cliente.
 */
describe('sincronizar un solo cliente a pedido', () => {
  it('lista entera la carpeta de ese cliente y ninguna otra', async () => {
    const ctx = armar();
    ctx.origen.registrarCarpeta('carpeta-nuevo', 'CLIENTES/003 NUEVO');
    agregarCliente(ctx, NUEVO, 'NUEVO S.A.', 'carpeta-nuevo');
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'de-fumipro.pdf', Buffer.from('f'));
    ctx.origen.sembrar('CLIENTES/003 NUEVO', 'del-nuevo.pdf', Buffer.from('n'));

    const resumen = await sincronizarUnCliente(ctx.deps, USUARIO, NUEVO);

    expect(resumen.modo).toBe('cliente');
    expect(resumen.nuevosEnTotal).toBe(1);
    expect(ctx.origen.recorridosCompletos).toBe(1);
    expect(ctx.documentos.documentos.map((d) => d.clienteId)).toEqual([NUEVO]);
  });

  it('no toca el punto de las vueltas por cambios', async () => {
    const ctx = armar();
    await ctx.correr();
    const token = ctx.estado.token;
    const rutas = new Map(ctx.estado.rutasDeClientes);

    await sincronizarUnCliente(ctx.deps, USUARIO, FUMIPRO);

    expect(ctx.estado.token).toBe(token);
    expect(ctx.estado.rutasDeClientes).toEqual(rutas);
    expect((await ctx.correr()).modo).toBe('incremental');
  });

  it('lo que trajo a pedido no se vuelve a copiar en la vuelta por cambios', async () => {
    const ctx = armar();
    await ctx.correr();
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'recien-subido.pdf', Buffer.from('r'));

    expect((await sincronizarUnCliente(ctx.deps, USUARIO, FUMIPRO)).nuevosEnTotal).toBe(1);
    const vuelta = await ctx.correr();

    expect(vuelta.cambiosRecibidos).toBe(1);
    expect(vuelta.nuevosEnTotal).toBe(0);
    expect(ctx.documentos.documentos).toHaveLength(1);
  });

  it('un cliente dado de baja no se sincroniza aunque se lo pida', async () => {
    const ctx = armar();
    ctx.clientes.clientes[0] = { ...ctx.clientes.clientes[0]!, activo: false };
    ctx.origen.sembrar(`${RAIZ}/PERIODO 2026`, 'a.pdf', Buffer.from('a'));

    const resumen = await sincronizarUnCliente(ctx.deps, USUARIO, FUMIPRO);

    expect(resumen.nuevosEnTotal).toBe(0);
    expect(ctx.origen.recorridosCompletos).toBe(0);
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

  // Revisión del 2026-11-13: repetir sin parar «sincronizar un cliente» no puede
  // dejar a los demás clientes sin sincronizar.
  it('si una vuelta general está esperando, un pedido de un cliente cede el turno', async () => {
    let liberar!: () => void;
    const deUnCliente = intentarSincronizar(() => new Promise<string>((r) => { liberar = () => r('cliente'); }), { alcance: 'cliente' });

    expect(await intentarSincronizar(async () => 'general')).toEqual({ ocupado: true });
    // La general quedó esperando: otro pedido de un cliente no le gana el turno.
    liberar();
    await deUnCliente;
    expect(await intentarSincronizar(async () => 'otro cliente', { alcance: 'cliente' })).toEqual({ ocupado: true });

    // La general corre, y después los pedidos de un cliente vuelven a entrar.
    expect(await intentarSincronizar(async () => 'general')).toEqual({ ocupado: false, valor: 'general' });
    expect(await intentarSincronizar(async () => 'cliente', { alcance: 'cliente' })).toEqual({ ocupado: false, valor: 'cliente' });
  });

  it('si la tarea falla, el candado se libera', async () => {
    await expect(intentarSincronizar(async () => { throw new Error('falló'); })).rejects.toThrow('falló');
    expect(await intentarSincronizar(async () => 'ok')).toEqual({ ocupado: false, valor: 'ok' });
  });
});
