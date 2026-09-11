/**
 * Sincronización desde la carpeta real de EFFORT.
 *
 * Lo que se prueba acá no es que copie archivos —eso es lo fácil— sino las tres
 * reglas que hacen que se pueda dejar corriendo sola cada 15 minutos sin
 * romper nada: que nunca escriba en la carpeta de EFFORT, que no duplique, y
 * que un archivo roto no arrastre a los demás.
 */

import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { DriveFalso } from '@effort/drive';

import { sincronizarDesdeOneDrive } from '../src/servicios/sincronizadorDeOneDrive.js';
import type { AltaDeEvidencia } from '../src/servicios/sincronizadorDeOneDrive.js';
import { ClientesFalsos, clienteMinimo } from './dobles.js';
import { DocumentosFalsos } from './dobles-dominio.js';

const FUMIPRO = '11111111-1111-4111-8111-111111111111';
const CARPETA_FUMIPRO = 'carpeta-fumipro';
const USUARIO = 'usr-sistema';

/** Registro de evidencias en memoria, con la misma unicidad por sha256. */
function crearRegistro() {
  const porSha = new Map<string, { id: string }>();
  const altas: AltaDeEvidencia[] = [];

  return {
    altas,
    async registrar(datos: AltaDeEvidencia) {
      const yaEstaba = porSha.get(datos.sha256);
      if (yaEstaba) {
        // Igual que la base: se le anota el origen para no volver a bajarlo.
        altas.push(datos);
        return { evidencia: yaEstaba, esNueva: false };
      }
      const evidencia = { id: randomUUID() };
      porSha.set(datos.sha256, evidencia);
      altas.push(datos);
      return { evidencia, esNueva: true };
    },
    async huellas(clienteId: string) {
      return altas
        .filter((a) => a.clienteId === clienteId && a.itemIdOrigen !== null)
        .map((a) => ({ itemIdOrigen: a.itemIdOrigen!, modificadoEnOrigen: a.modificadoEnOrigen }));
    },
  };
}

function armar() {
  const clientes = new ClientesFalsos();
  const documentos = new DocumentosFalsos();
  const origen = new DriveFalso();
  const destino = new DriveFalso();
  const registro = crearRegistro();

  clientes.clientes.push({
    ...clienteMinimo({ id: FUMIPRO, nombre: 'FUMIPRO S.A.', ruc: '80119631-0', activo: true }),
    carpetaOneDriveId: CARPETA_FUMIPRO,
  });

  origen.registrarCarpeta(CARPETA_FUMIPRO, 'CLIENTES/002 FUMIPRO');

  return {
    clientes,
    documentos,
    origen,
    destino,
    registro,
    deps: {
      clientes,
      documentos,
      origen,
      destino,
      registrarEvidencia: (datos: AltaDeEvidencia) => registro.registrar(datos),
      huellasDeOrigen: (clienteId: string) => registro.huellas(clienteId),
      ahora: () => new Date('2026-09-11T12:00:00Z'),
    },
  };
}

describe('sincronización desde OneDrive', () => {
  it('trae los archivos nuevos, incluidos los de subcarpetas', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));
    ctx.origen.sembrar(
      'CLIENTES/002 FUMIPRO/PERIODO 2026/01 ENERO',
      'factura.pdf',
      Buffer.from('dos'),
    );

    const resumen = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(resumen.nuevosEnTotal).toBe(2);
    expect(resumen.fallos).toEqual([]);
    expect(ctx.documentos.documentos).toHaveLength(2);
  });

  // La regla que más importa: la carpeta de EFFORT no tiene copia de seguridad.
  it('NUNCA escribe en el drive de origen', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));

    await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    // Lo que había al principio sigue igual, y no apareció nada nuevo.
    const enOrigen = await ctx.origen.listarRecursivoPorId(CARPETA_FUMIPRO);
    expect(enOrigen).toHaveLength(1);
    expect(enOrigen[0]!.nombre).toBe('contrato.pdf');
  });

  it('la copia va a la carpeta propia del sistema, no a la de EFFORT', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));

    await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(ctx.registro.altas[0]!.rutaOneDrive).toMatch(/^EFFORT Control 360\/Entrada\//);
  });

  it('correrlo dos veces no duplica nada', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));

    await sincronizarDesdeOneDrive(ctx.deps, USUARIO);
    const segunda = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(segunda.nuevosEnTotal).toBe(0);
    // Se saltea sin descargar: mismo archivo, misma fecha.
    expect(segunda.clientes[0]!.sinCambios).toBe(1);
    expect(ctx.documentos.documentos).toHaveLength(1);
  });

  // El mismo contenido con otro nombre es el mismo archivo: la huella del
  // contenido manda, no cómo se llame ni dónde esté.
  it('un archivo renombrado no vuelve a entrar', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('mismo contenido'));
    await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    ctx.origen.sembrar(
      'CLIENTES/002 FUMIPRO/ARCHIVO',
      'contrato-firmado-final.pdf',
      Buffer.from('mismo contenido'),
    );
    const segunda = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(segunda.nuevosEnTotal).toBe(0);
    expect(ctx.documentos.documentos).toHaveLength(1);
  });

  /**
   * El caso que justifica toda la marca de origen: probando contra el OneDrive
   * real, la primera corrida no terminaba porque bajaba los ~700 archivos para
   * calcular su huella y recién ahí descubría que ya los tenía. Corriendo cada
   * 15 minutos, eso no se sostiene.
   */
  it('en la segunda corrida NO vuelve a descargar lo que no cambió', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'acta.pdf', Buffer.from('dos'));

    await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    let descargas = 0;
    const leerOriginal = ctx.origen.leer.bind(ctx.origen);
    ctx.origen.leer = async (itemId: string) => {
      descargas += 1;
      return leerOriginal(itemId);
    };

    const segunda = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(descargas).toBe(0);
    expect(segunda.clientes[0]!.sinCambios).toBe(2);
    expect(segunda.nuevosEnTotal).toBe(0);
  });

  it('si el archivo cambió en el origen, sí se vuelve a leer', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'), {
      itemId: 'item-contrato',
      modificadoEn: new Date('2026-09-01T10:00:00Z'),
    });
    await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    // El MISMO archivo (mismo id), con contenido y fecha nuevos: lo editaron.
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno corregido'), {
      itemId: 'item-contrato',
      modificadoEn: new Date('2026-09-10T16:00:00Z'),
    });

    const segunda = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(segunda.clientes[0]!.sinCambios).toBe(0);
    expect(segunda.nuevosEnTotal).toBe(1);
  });

  it('un cliente sin carpeta asignada se saltea sin romper la corrida', async () => {
    const ctx = armar();
    ctx.clientes.clientes.push(
      clienteMinimo({ id: 'otro', nombre: 'SIN CARPETA S.A.', ruc: '80000000-1', activo: true }),
    );
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));

    const resumen = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(resumen.nuevosEnTotal).toBe(1);
    expect(resumen.clientes.map((c) => c.cliente)).toEqual(['FUMIPRO S.A.']);
  });

  it('un cliente dado de baja no se sincroniza', async () => {
    const ctx = armar();
    ctx.clientes.clientes[0] = {
      ...clienteMinimo({ id: FUMIPRO, nombre: 'FUMIPRO S.A.', ruc: '80119631-0', activo: false }),
      carpetaOneDriveId: CARPETA_FUMIPRO,
    };
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));

    const resumen = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(resumen.nuevosEnTotal).toBe(0);
  });

  // Con cientos de archivos, cortar todo por uno solo significa no importar
  // nada — y encima sin que nadie se entere de cuál fue el problema.
  it('un archivo que falla no frena a los demás, y queda reportado', async () => {
    const ctx = armar();
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'bueno.pdf', Buffer.from('uno'));
    const roto = ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'roto.pdf', Buffer.from('dos'));

    const leerOriginal = ctx.origen.leer.bind(ctx.origen);
    ctx.origen.leer = async (itemId: string) => {
      if (itemId === roto.itemId) throw new Error('El archivo está dañado.');
      return leerOriginal(itemId);
    };

    const resumen = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(resumen.nuevosEnTotal).toBe(1);
    expect(resumen.fallos).toHaveLength(1);
    expect(resumen.fallos[0]!.archivo).toBe('roto.pdf');
    expect(resumen.fallos[0]!.motivo).toMatch(/dañado/);
  });

  it('si no se puede leer la carpeta de un cliente, se sigue con los otros', async () => {
    const ctx = armar();
    ctx.clientes.clientes.push({
      ...clienteMinimo({ id: 'otro', nombre: 'OTRO S.A.', ruc: '80000000-1', activo: true }),
      carpetaOneDriveId: 'carpeta-que-no-existe',
    });
    ctx.origen.sembrar('CLIENTES/002 FUMIPRO', 'contrato.pdf', Buffer.from('uno'));

    const resumen = await sincronizarDesdeOneDrive(ctx.deps, USUARIO);

    expect(resumen.nuevosEnTotal).toBe(1);
    expect(resumen.fallos).toHaveLength(1);
    expect(resumen.fallos[0]!.cliente).toBe('OTRO S.A.');
  });
});
