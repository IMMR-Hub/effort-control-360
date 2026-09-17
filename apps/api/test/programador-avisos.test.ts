/**
 * Correos del cálculo automático: apagados salvo que se enciendan a propósito.
 *
 * Daniel, 2026-09-16: "hasta que no te lo diga, NO QUIERO QUE MANDES NINGÚN
 * CORREO a nadie". Hasta esa fecha el cálculo de cada hora mandaba un correo
 * por cada alerta crítica a todos los usuarios de dirección, sin tope. Estos
 * tests fijan que eso no vuelva a pasar por accidente: sin
 * `AVISOS_POR_CORREO=si` y una lista explícita de destinatarios, no sale nada.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CorreoFalso } from '@effort/drive';

import type { AltaDeEnvio } from '../src/servicios/avisosPorCorreo.js';
import { programarCalculoDeVencimientosYAlertas } from '../src/servicios/programador.js';
import type { Dependencias } from '../src/servidor.js';
import { BitacoraFalsa, ClientesFalsos, UsuariosFalsos } from './dobles.js';
import { AlertasFalsas, ObligacionesFalsas, ProcesoMensualFalso, VencimientosFalsos } from './dobles-dominio.js';

const HOY = new Date('2026-09-16T13:00:00Z');
/** La primera corrida espera la sincronización (10 min) y 5 más. */
const PRIMERA_CORRIDA_MS = 15 * 60 * 1000;

function alertaCritica(id: string) {
  return {
    id,
    clienteId: null,
    periodo: '2026-09',
    // Un origen que el motor no cierra solo: así la alerta sigue abierta al avisar.
    origen: 'origen_de_prueba',
    criticidad: 'CRITICA',
    titulo: `Alerta ${id}`,
    detalle: 'detalle',
    entidadRelacionada: null,
    entidadRelacionadaId: null,
    responsableId: null,
    fechaLimite: null,
    estado: 'ABIERTA',
    cerradaPorUsuarioId: null,
    cerradaEn: null,
    motivoCierre: null,
    creadoEn: new Date(HOY.getTime() - 60_000),
  };
}

function armar(configuracion: Record<string, unknown>) {
  const correo = new CorreoFalso();
  const registro: AltaDeEnvio[] = [];
  const usuarios = new UsuariosFalsos();
  const base = {
    activo: true, hashContrasena: 'x', secretoTotp: null,
    segundoFactorActivo: false, debeCambiarContrasena: false, veTodosLosClientes: true,
  };
  usuarios.usuarios.push(
    { id: 'usr-sistema', email: 'effort360@effort.com.py', rol: 'direccion', ...base },
    // Una persona de dirección: NO tiene que recibir nada que no pida la lista.
    { id: 'usr-laura', email: 'lsosa@effort.com.py', rol: 'direccion', ...base },
  );
  const alertas = new AlertasFalsas();
  alertas.alertas.push(alertaCritica('a1'), alertaCritica('a2'));

  const deps = {
    configuracion: { TRABAJOS_AUTOMATICOS: 'si', ...configuracion },
    usuarios,
    clientes: new ClientesFalsos(),
    obligaciones: new ObligacionesFalsas(),
    vencimientos: new VencimientosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
    alertas,
    bitacora: new BitacoraFalsa(),
    drive: null,
    libroRg90: undefined,
    declaraciones: undefined,
    correo,
    envios: {
      enviados: async () => registro.map((r) => ({ alertaId: r.alertaId, destinatario: r.destinatario })),
      registrar: async (datos: AltaDeEnvio) => void registro.push(datos),
    },
    ahora: () => HOY,
  } as unknown as Dependencias;

  const registrador = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { deps, correo, registrador };
}

async function correrUnaVez(ctx: ReturnType<typeof armar>) {
  programarCalculoDeVencimientosYAlertas(ctx.deps, ctx.registrador as never);
  await vi.advanceTimersByTimeAsync(PRIMERA_CORRIDA_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('correos del cálculo automático', () => {
  it('sin AVISOS_POR_CORREO no sale ningún correo, aunque haya destinatarios', async () => {
    const ctx = armar({ AVISOS_DESTINATARIOS: ['daniel@ejemplo.com'], AVISOS_TOPE_POR_CORRIDA: 10 });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toEqual([]);
    expect(ctx.registrador.error).not.toHaveBeenCalled();
  });

  it('con AVISOS_POR_CORREO=no no sale ningún correo', async () => {
    const ctx = armar({
      AVISOS_POR_CORREO: 'no',
      AVISOS_DESTINATARIOS: ['daniel@ejemplo.com'],
      AVISOS_TOPE_POR_CORRIDA: 10,
    });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toEqual([]);
  });

  it('encendido pero sin destinatarios, no sale nada y lo avisa en el log', async () => {
    const ctx = armar({ AVISOS_POR_CORREO: 'si', AVISOS_DESTINATARIOS: [], AVISOS_TOPE_POR_CORRIDA: 10 });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toEqual([]);
    expect(ctx.registrador.warn).toHaveBeenCalledWith(expect.stringMatching(/AVISOS_DESTINATARIOS está vacío/));
  });

  it('encendido, avisa SOLO a la lista explícita y respeta el tope', async () => {
    const ctx = armar({
      AVISOS_POR_CORREO: 'si',
      AVISOS_DESTINATARIOS: ['daniel@ejemplo.com'],
      AVISOS_TOPE_POR_CORRIDA: 1,
    });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toHaveLength(1);
    expect(ctx.correo.enviados[0]!.destinatario).toBe('daniel@ejemplo.com');
    expect(ctx.correo.enviados.some((c) => c.destinatario === 'lsosa@effort.com.py')).toBe(false);
  });
});
