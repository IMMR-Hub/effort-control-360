/**
 * Saldo de IVA declarado (tarea 138), contra PostgreSQL real.
 *
 * Lo que importa probar acá: que `guardarLectura` no pierda el saldo al pasar
 * por Prisma (es un `bigint`, y el resto del sistema ya tuvo bugs de ese tipo
 * con otros campos), y que la lectura por cliente y período traiga la más
 * reciente cuando hay una original y una rectificativa.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';
import { DeclaracionesPrisma } from '../../src/repositorios/declaraciones.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('saldo de IVA declarado contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let declaraciones: DeclaracionesPrisma;
  let clienteId = '';
  let usuarioId = '';

  beforeAll(async () => {
    entorno = await crearEntorno();
    declaraciones = new DeclaracionesPrisma(entorno.prisma);

    const cliente = await entorno.prisma.cliente.create({
      data: { nombre: 'COPESA CONSTRUCCIONES SA', ruc: '80003112-1', tipoPersona: 'JURIDICA' },
    });
    clienteId = cliente.id;

    const usuario = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Lili', apellido: 'Laconich', email: 'lili-138@effort.com.py',
        rol: 'direccion', hashContrasena: '$argon2id$prueba', veTodosLosClientes: true,
      },
    });
    usuarioId = usuario.id;
  });

  afterAll(async () => {
    await entorno.destruir();
  });

  async function evidencia(nombreArchivo: string) {
    return entorno.prisma.evidencia.create({
      data: {
        clienteId,
        periodo: '2026-07',
        nombreArchivo,
        rutaOneDrive: `/prueba/${nombreArchivo}`,
        tipoMime: 'application/pdf',
        tamanoBytes: 1000n,
        sha256: Math.random().toString(16).slice(2).padEnd(64, '0'),
        subidoPorUsuarioId: usuarioId,
      },
    });
  }

  it('guarda y relee el saldo declarado como bigint, sin perder precisión', async () => {
    const ev = await evidencia('120-07-2026.pdf');

    await declaraciones.guardarLectura(
      { evidenciaId: ev.id, clienteId, itemIdOneDrive: 'x', nombreArchivo: ev.nombreArchivo },
      {
        declaracion: {
          formulario: '120',
          ruc: '80003112',
          periodo: '2026-07',
          numeroDeOrden: '12000000001',
          fechaDePresentacion: '2026-08-11',
          fechaAproximada: false,
          saldoDeIva: { saldoATrasladar: 954463n, saldoDePeriodoAnterior: 717945n },
        },
        error: null,
      },
    );

    const saldo = await declaraciones.saldoDeIvaDeclarado(clienteId, '2026-07');

    expect(saldo?.saldoATrasladar).toBe(954463n);
    expect(saldo?.saldoDePeriodoAnterior).toBe(717945n);
  });

  it('sin lectura de ese cliente y período, no hay saldo que mostrar', async () => {
    expect(await declaraciones.saldoDeIvaDeclarado(clienteId, '2099-01')).toBeNull();
  });

  /*
   * Igual que con las presentaciones (detectorDePresentaciones): si hay una
   * original y una rectificativa, la más nueva es la que vale — es lo que
   * EFFORT presentó en último término ante la DNIT.
   */
  it('con original y rectificativa, vale la más reciente', async () => {
    const original = await evidencia('DDJJ IVA 072026 COPESA SA.pdf');
    await declaraciones.guardarLectura(
      { evidenciaId: original.id, clienteId, itemIdOneDrive: 'x', nombreArchivo: original.nombreArchivo },
      {
        declaracion: {
          formulario: '120', ruc: '80003112', periodo: '2026-07',
          numeroDeOrden: '12000000002', fechaDePresentacion: '2026-08-11', fechaAproximada: false,
          saldoDeIva: { saldoATrasladar: 100n, saldoDePeriodoAnterior: null },
        },
        error: null,
      },
    );

    const rectificativa = await evidencia('CORRECCION DDJJ IVA 072026 COPESA SA.pdf');
    await declaraciones.guardarLectura(
      { evidenciaId: rectificativa.id, clienteId, itemIdOneDrive: 'x', nombreArchivo: rectificativa.nombreArchivo },
      {
        declaracion: {
          formulario: '120', ruc: '80003112', periodo: '2026-07',
          numeroDeOrden: '12000000003', fechaDePresentacion: '2026-08-15', fechaAproximada: false,
          saldoDeIva: { saldoATrasladar: 200n, saldoDePeriodoAnterior: null },
        },
        error: null,
      },
    );

    const saldo = await declaraciones.saldoDeIvaDeclarado(clienteId, '2026-07');
    expect(saldo?.saldoATrasladar).toBe(200n);
  });

  it('una lectura sin formulario 120 (otro impuesto) no cuenta como saldo de IVA', async () => {
    const ev = await evidencia('DDJJ IRE 2025 COPESA SA.pdf');
    await declaraciones.guardarLectura(
      { evidenciaId: ev.id, clienteId, itemIdOneDrive: 'x', nombreArchivo: ev.nombreArchivo },
      {
        declaracion: {
          formulario: '500', ruc: '80003112', periodo: '2025-12',
          numeroDeOrden: '50000000001', fechaDePresentacion: '2026-04-12', fechaAproximada: false,
        },
        error: null,
      },
    );

    expect(await declaraciones.saldoDeIvaDeclarado(clienteId, '2025-12')).toBeNull();
  });
});
