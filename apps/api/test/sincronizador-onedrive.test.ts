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
      if (porSha.has(datos.sha256)) return null;
      const evidencia = { id: randomUUID() };
      porSha.set(datos.sha256, evidencia);
      altas.push(datos);
      return evidencia;
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
    expect(segunda.clientes[0]!.yaEstaban).toBe(1);
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
