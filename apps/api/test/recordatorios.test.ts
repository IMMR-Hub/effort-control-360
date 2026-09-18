/**
 * Despachador de recordatorios de seguimiento (tareas 96, 97 y 99).
 *
 * Igual que en avisos-por-correo.test.ts, lo que importa no es que mande un
 * correo: es que no repita el mismo recordatorio, que deje constancia de
 * contacto (tarea 97), y que tres fallos seguidos del mismo recordatorio
 * levanten una alerta a dirección (tarea 99) sin duplicarla en cada corrida.
 */

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { crearCalendario, DIAS_LABORABLES_LUNES_A_VIERNES } from '@effort/core';
import { CorreoFalso } from '@effort/drive';

import { enviarRecordatorios, type DependenciasDeRecordatorios } from '../src/servicios/recordatorios.js';
import type {
  AltaDeAlerta,
  AltaDeRecordatorioEnviado,
  RecordatorioEnviadoAlmacenado,
  ReglaDeNotificacionAlmacenada,
  SolicitudAlmacenada,
} from '../src/puertos-dominio.js';
import type { ContactoAlmacenado } from '../src/puertos.js';

const CALENDARIO = crearCalendario([], DIAS_LABORABLES_LUNES_A_VIERNES);
const HOY = { anio: 2026, mes: 9, dia: 16 }; // miércoles

function regla(parcial: Partial<ReglaDeNotificacionAlmacenada> = {}): ReglaDeNotificacionAlmacenada {
  return {
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
    destinatariosDeEscalamiento: [{ tipo: 'CORREO_LIBRE', valor: 'direccion@effort.com.py' }],
    clientesAlcanzados: [],
    plantillaId: null,
    ...parcial,
  };
}

function solicitud(parcial: Partial<SolicitudAlmacenada> = {}): SolicitudAlmacenada {
  return {
    id: 'sol-1',
    clienteId: 'cli-1',
    periodo: '2026-08',
    estado: 'ABIERTA',
    // Lunes 14: con diasHabilesDePlazo=1 el límite es el martes 15, y el
    // primer recordatorio "corresponde" el miércoles 16 — HOY.
    cuentaDesde: new Date('2026-09-14T00:00:00.000Z'),
    recordatoriosEnviados: 0,
    ultimoRecordatorioEn: null,
    reglaId: 'regla-1',
    ...parcial,
  };
}

function armar(solicitudes: SolicitudAlmacenada[], reglas: ReglaDeNotificacionAlmacenada[]) {
  const correo = new CorreoFalso();
  const envios: RecordatorioEnviadoAlmacenado[] = [];
  const contactos: ContactoAlmacenado[] = [];
  const alertas: AltaDeAlerta[] = [];
  const solicitudesActualizadas: { id: string; numeroDeRecordatorio: number; esEscalamiento: boolean }[] = [];

  const deps: DependenciasDeRecordatorios = {
    reglasDeNotificacion: { listar: async () => reglas },
    solicitudes: {
      listarAbiertas: async () =>
        solicitudes.filter((s) => !['ENTREGADA', 'CERRADA_MANUALMENTE', 'AGOTADA'].includes(s.estado)),
      registrarRecordatorioEnviado: async (id, fecha, numeroDeRecordatorio, esEscalamiento) => {
        solicitudesActualizadas.push({ id, numeroDeRecordatorio, esEscalamiento });
        const indice = solicitudes.findIndex((s) => s.id === id);
        solicitudes[indice] = {
          ...solicitudes[indice]!,
          recordatoriosEnviados: numeroDeRecordatorio,
          ultimoRecordatorioEn: fecha,
          ...(esEscalamiento ? { estado: 'ESCALADA' } : {}),
        };
        return solicitudes[indice]!;
      },
    },
    recordatorios: {
      enviados: async () =>
        envios.filter((e) => e.estado === 'ENVIADO').map((e) => ({
          solicitudId: e.solicitudId,
          numeroDeRecordatorio: e.numeroDeRecordatorio,
        })),
      listarPorSolicitud: async (solicitudId) =>
        envios
          .filter((e) => e.solicitudId === solicitudId)
          .slice()
          .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime()),
      registrar: async (datos: AltaDeRecordatorioEnviado) => {
        envios.push({ id: randomUUID(), creadoEn: new Date(), ...datos });
      },
    },
    contactos: {
      registrar: async (datos) => {
        const contacto: ContactoAlmacenado = { id: randomUUID(), ...datos };
        contactos.push(contacto);
        return contacto;
      },
    },
    usuarios: {
      listar: async () => [],
      buscarListadoPorId: async () => null,
      listarAsignadosAlCliente: async () => [],
    },
    clientes: {
      buscarPorId: async () => ({ email: 'cliente@ejemplo.com.py', nombre: 'FUMIPRO S.A.' }),
    },
    alertas: {
      crear: async (altas: readonly AltaDeAlerta[]) => {
        alertas.push(...altas);
        return altas.length;
      },
    },
    correo,
    calendario: CALENDARIO,
    hoy: HOY,
    ahora: () => new Date('2026-09-16T12:00:00.000Z'),
    usuarioSistemaId: 'usr-sistema',
  };

  return { deps, correo, envios, contactos, alertas, solicitudesActualizadas, solicitudes };
}

describe('despachador de recordatorios de seguimiento', () => {
  it('manda el recordatorio que corresponde hoy, y deja el contacto automático (tarea 97)', async () => {
    const ctx = armar([solicitud()], [regla()]);

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.enviados).toBe(1);
    expect(ctx.correo.enviados[0]!.destinatario).toBe('responsable@effort.com.py');
    expect(ctx.correo.enviados[0]!.asunto).toContain('FUMIPRO S.A.');
    expect(ctx.contactos).toHaveLength(1);
    expect(ctx.contactos[0]!.origenContacto).toBe('AUTOMATICO');
    expect(ctx.contactos[0]!.solicitudId).toBe('sol-1');
    expect(ctx.contactos[0]!.registradoPorUsuarioId).toBe('usr-sistema');
    expect(ctx.solicitudesActualizadas).toEqual([
      { id: 'sol-1', numeroDeRecordatorio: 1, esEscalamiento: false },
    ]);
  });

  it('no manda nada si todavía no corresponde (el límite es mañana, no hoy)', async () => {
    const ctx = armar(
      [solicitud({ cuentaDesde: new Date('2026-09-15T00:00:00.000Z') })], // martes: límite miércoles, recordatorio jueves
      [regla()],
    );

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.enviados).toBe(0);
    expect(ctx.correo.enviados).toEqual([]);
  });

  it('no repite el mismo recordatorio en una segunda corrida el mismo día', async () => {
    const ctx = armar([solicitud()], [regla()]);

    await enviarRecordatorios(ctx.deps);
    const segunda = await enviarRecordatorios(ctx.deps);

    expect(segunda.enviados).toBe(0);
    expect(ctx.correo.enviados).toHaveLength(1);
  });

  it('una regla inactiva no manda nada', async () => {
    const ctx = armar([solicitud()], [regla({ activa: false })]);

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.enviados).toBe(0);
  });

  it('una solicitud ya entregada no recibe recordatorio', async () => {
    const ctx = armar([solicitud({ estado: 'ENTREGADA' })], [regla()]);

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.enviados).toBe(0);
  });

  it('el recordatorio que escala pasa la solicitud a ESCALADA y suma la copia a dirección', async () => {
    const ctx = armar(
      [solicitud({ recordatoriosEnviados: 2, ultimoRecordatorioEn: new Date('2026-09-14T00:00:00.000Z') })],
      [regla({ escalarAPartirDelRecordatorio: 3, reintentarCadaDiasHabiles: 2 })],
    );

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.enviados).toBe(2); // destinatario inicial + el de escalamiento
    expect(resumen.escalados).toBe(1);
    expect(ctx.correo.enviados.map((c) => c.destinatario).sort()).toEqual(
      ['direccion@effort.com.py', 'responsable@effort.com.py'].sort(),
    );
    expect(ctx.solicitudesActualizadas[0]!.esEscalamiento).toBe(true);
  });

  it('si el envío falla, queda registrado el fallo y NO se actualiza la solicitud', async () => {
    const ctx = armar([solicitud()], [regla()]);
    ctx.correo.falla = 'El buzón no existe.';

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.fallidos).toBe(1);
    expect(resumen.enviados).toBe(0);
    expect(ctx.envios[0]!.estado).toBe('FALLIDO');
    expect(ctx.envios[0]!.errorProveedor).toContain('buzón no existe');
    expect(ctx.solicitudesActualizadas).toEqual([]);
    expect(ctx.contactos).toEqual([]);
  });

  it('tres fallos consecutivos del mismo recordatorio levantan una alerta a dirección (tarea 99)', async () => {
    const ctx = armar([solicitud()], [regla()]);
    ctx.correo.falla = 'Sin conexión.';

    await enviarRecordatorios(ctx.deps);
    await enviarRecordatorios(ctx.deps);
    const tercera = await enviarRecordatorios(ctx.deps);

    expect(tercera.alertasDeFalloLevantadas).toBe(1);
    expect(ctx.alertas).toHaveLength(1);
    expect(ctx.alertas[0]!.origen).toBe('recordatorio_fallido');
    expect(ctx.alertas[0]!.entidadRelacionadaId).toBe('sol-1');
    expect(ctx.alertas[0]!.criticidad).toBe('ALTA');
  });

  it('sin destinatarios resueltos no manda nada, pero tampoco marca el recordatorio como usado', async () => {
    const ctx = armar(
      [solicitud()],
      [regla({ destinatariosIniciales: [{ tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null }] })],
    );

    const resumen = await enviarRecordatorios(ctx.deps);

    expect(resumen.enviados).toBe(0);
    expect(ctx.correo.enviados).toEqual([]);
    expect(ctx.solicitudesActualizadas).toEqual([]);
  });
});
