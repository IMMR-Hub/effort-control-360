/**
 * Recordatorios automáticos de seguimiento: apagados salvo que se enciendan
 * a propósito (tarea 96).
 *
 * Mismo criterio que programador-avisos.test.ts: REGLA 0-bis de `CLAUDE.md`
 * dice que ningún correo real sale sin que Daniel lo autorice. Estos tests
 * fijan que, con `RECORDATORIOS_AUTOMATICOS=no` (el valor por defecto), no
 * sale nada — aunque haya una solicitud abierta, una regla activa, y el
 * recordatorio le corresponda hoy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CorreoFalso } from '@effort/drive';

import { programarRecordatoriosDeSeguimiento } from '../src/servicios/programador.js';
import type { Dependencias } from '../src/servidor.js';
import { BitacoraFalsa, ClientesFalsos, ContactosFalsos, UsuariosFalsos } from './dobles.js';
import { AlertasFalsas, RecordatoriosFalsos, ReglasDeNotificacionFalsas, SolicitudesFalsas } from './dobles-dominio.js';

const HOY = new Date('2026-09-16T13:00:00Z'); // miércoles
/** La primera corrida de este trabajo espera 10 minutos más que la de vencimientos. */
const PRIMERA_CORRIDA_MS = 20 * 60 * 1000;

function armar(configuracion: Record<string, unknown>) {
  const correo = new CorreoFalso();
  const usuarios = new UsuariosFalsos();
  usuarios.usuarios.push({
    id: 'usr-sistema',
    email: 'effort360@effort.com.py',
    rol: 'direccion',
    activo: true,
    hashContrasena: 'x',
    secretoTotp: null,
    segundoFactorActivo: false,
    debeCambiarContrasena: false,
    veTodosLosClientes: true,
  });

  const clientes = new ClientesFalsos();
  clientes.clientes.push({
    id: 'cli-1',
    nombre: 'FUMIPRO S.A.',
    ruc: '80119631-0',
    tipoPersona: 'JURIDICA',
    regimenTributario: null,
    email: 'cliente@ejemplo.com.py',
    telefono: null,
    canalPreferido: null,
    carpetaOneDriveId: null,
    activo: true,
    observaciones: null,
  });

  const reglas = new ReglasDeNotificacionFalsas();
  reglas.reglas.push({
    id: 'regla-1',
    nombre: 'Entrega de documentación mensual',
    activa: true,
    evento: 'DOCUMENTACION_NO_ENTREGADA',
    diasHabilesDePlazo: 1,
    horaDeEnvio: '09:00',
    reintentarCadaDiasHabiles: 2,
    maximoRecordatorios: 3,
    escalarAPartirDelRecordatorio: 3,
    destinatariosIniciales: [{ tipo: 'CORREO_LIBRE', valor: 'responsable@effort.com.py' }],
    destinatariosDeEscalamiento: [],
    clientesAlcanzados: [],
    plantillaId: null,
  });

  const solicitudes = new SolicitudesFalsas();
  solicitudes.solicitudes.push({
    id: 'sol-1',
    clienteId: 'cli-1',
    periodo: '2026-08',
    estado: 'ABIERTA',
    // Lunes 14: límite martes 15, recordatorio miércoles 16 — HOY.
    cuentaDesde: new Date('2026-09-14T00:00:00.000Z'),
    recordatoriosEnviados: 0,
    ultimoRecordatorioEn: null,
    reglaId: 'regla-1',
  });

  const contactos = new ContactosFalsos();

  const deps = {
    configuracion: { TRABAJOS_AUTOMATICOS: 'si', ...configuracion },
    usuarios,
    clientes,
    contactos,
    reglasDeNotificacion: reglas,
    solicitudes,
    recordatorios: new RecordatoriosFalsos(),
    alertas: new AlertasFalsas(),
    bitacora: new BitacoraFalsa(),
    correo,
    ahora: () => HOY,
  } as unknown as Dependencias;

  const registrador = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { deps, correo, contactos, registrador };
}

async function correrUnaVez(ctx: ReturnType<typeof armar>) {
  programarRecordatoriosDeSeguimiento(ctx.deps, ctx.registrador as never);
  await vi.advanceTimersByTimeAsync(PRIMERA_CORRIDA_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recordatorios automáticos de seguimiento', () => {
  it('con el valor por defecto (RECORDATORIOS_AUTOMATICOS=no) no sale nada', async () => {
    const ctx = armar({});

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toEqual([]);
    expect(ctx.registrador.error).not.toHaveBeenCalled();
  });

  it('con RECORDATORIOS_AUTOMATICOS=no explícito tampoco, aunque el recordatorio corresponda hoy', async () => {
    const ctx = armar({ RECORDATORIOS_AUTOMATICOS: 'no' });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toEqual([]);
  });

  it('con TRABAJOS_AUTOMATICOS=no no sale nada aunque RECORDATORIOS_AUTOMATICOS esté en sí', async () => {
    const ctx = armar({ TRABAJOS_AUTOMATICOS: 'no', RECORDATORIOS_AUTOMATICOS: 'si' });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toEqual([]);
  });

  it('con los dos interruptores en sí, manda el recordatorio que corresponde y deja el contacto', async () => {
    const ctx = armar({ RECORDATORIOS_AUTOMATICOS: 'si' });

    await correrUnaVez(ctx);

    expect(ctx.correo.enviados).toHaveLength(1);
    expect(ctx.correo.enviados[0]!.destinatario).toBe('responsable@effort.com.py');
    expect(ctx.contactos.contactos).toHaveLength(1);
  });
});
