/**
 * Avisos por correo.
 *
 * Lo que importa probar no es que mande un correo, sino que NO mande el mismo
 * dos veces y que un fallo quede escrito. Un motor que corre solo cada hora y
 * no recuerda lo que ya mandó convierte el aviso en spam, y un aviso que llega
 * treinta veces deja de leerse — con lo cual el sistema pierde justo lo que lo
 * hace útil.
 */

import { describe, expect, it } from 'vitest';

import { CorreoFalso } from '@effort/drive';

import { enviarAvisosDeAlertas, type AltaDeEnvio } from '../src/servicios/avisosPorCorreo.js';
import type { AlertaAlmacenada } from '../src/puertos-dominio.js';

const DIRECCION = ['lsosa@effort.com.py', 'llaconich@effort.com.py'];

function alerta(parcial: Partial<AlertaAlmacenada> = {}): AlertaAlmacenada {
  return {
    id: 'alerta-1',
    clienteId: 'cli-1',
    periodo: null,
    origen: 'vencimiento_por_vencer',
    criticidad: 'CRITICA',
    titulo: 'Vencido sin presentar: IVA General — período 2026-01',
    detalle: 'Venció el 2026-02-09 ante DNIT y todavía no está registrado como presentado.',
    entidadRelacionada: 'vencimiento',
    entidadRelacionadaId: 'venc-1',
    responsableId: null,
    fechaLimite: new Date('2026-02-09'),
    estado: 'ABIERTA',
    cerradaPorUsuarioId: null,
    cerradaEn: null,
    motivoCierre: null,
    ...parcial,
  };
}

function armar(alertas: AlertaAlmacenada[]) {
  const correo = new CorreoFalso();
  const registro: AltaDeEnvio[] = [];

  return {
    correo,
    registro,
    deps: {
      alertas: { listar: async () => alertas },
      correo,
      yaEnviados: async () =>
        registro
          .filter((r) => r.estado === 'ENVIADO')
          .map((r) => ({ alertaId: r.alertaId, destinatario: r.destinatario })),
      registrarEnvio: async (datos: AltaDeEnvio) => {
        registro.push(datos);
      },
      destinatarios: DIRECCION,
      nombreDeCliente: () => 'FUMIPRO S.A.',
      ahora: () => new Date('2026-09-12T10:00:00Z'),
    },
  };
}

describe('avisos por correo', () => {
  it('avisa a dirección de una alerta crítica, con el cliente en el asunto', async () => {
    const ctx = armar([alerta()]);

    const resumen = await enviarAvisosDeAlertas(ctx.deps);

    expect(resumen.enviados).toBe(2);
    expect(ctx.correo.enviados[0]!.asunto).toContain('FUMIPRO S.A.');
    expect(ctx.correo.enviados[0]!.cuerpo).toContain('Venció el 2026-02-09');
    expect(ctx.correo.enviados.map((c) => c.destinatario)).toEqual(DIRECCION);
  });

  // El que justifica que exista la tabla de envíos.
  it('no vuelve a avisar de la misma alerta', async () => {
    const ctx = armar([alerta()]);

    await enviarAvisosDeAlertas(ctx.deps);
    const segunda = await enviarAvisosDeAlertas(ctx.deps);

    expect(segunda.enviados).toBe(0);
    expect(segunda.yaAvisadas).toBe(2);
    expect(ctx.correo.enviados).toHaveLength(2);
  });

  it('no avisa por correo de lo que no es crítico', async () => {
    const ctx = armar([alerta({ criticidad: 'MEDIA' }), alerta({ id: 'a2', criticidad: 'ALTA' })]);

    const resumen = await enviarAvisosDeAlertas(ctx.deps);

    expect(resumen.enviados).toBe(0);
    expect(ctx.correo.enviados).toHaveLength(0);
  });

  // Un aviso que no salió y nadie sabe que no salió es peor que no tener avisos.
  it('si el envío falla, queda registrado el fallo con su causa', async () => {
    const ctx = armar([alerta()]);
    ctx.correo.falla = 'El buzón no existe.';

    const resumen = await enviarAvisosDeAlertas(ctx.deps);

    expect(resumen.fallidos).toBe(2);
    expect(ctx.registro[0]!.estado).toBe('FALLIDO');
    expect(ctx.registro[0]!.errorProveedor).toContain('buzón no existe');
    expect(ctx.registro[0]!.despachadoEn).toBeNull();
  });

  it('un fallo con un destinatario no impide avisar al otro', async () => {
    const ctx = armar([alerta()]);
    let intentos = 0;
    ctx.correo.enviar = async (c) => {
      intentos += 1;
      if (intentos === 1) throw new Error('Casilla llena.');
      ctx.correo.enviados.push(c);
      return { idMensaje: 'ok' };
    };

    const resumen = await enviarAvisosDeAlertas(ctx.deps);

    expect(resumen.fallidos).toBe(1);
    expect(resumen.enviados).toBe(1);
  });

  it('un fallo se puede reintentar en la corrida siguiente', async () => {
    const ctx = armar([alerta()]);
    ctx.correo.falla = 'Sin conexión.';
    await enviarAvisosDeAlertas(ctx.deps);

    ctx.correo.falla = null;
    const segunda = await enviarAvisosDeAlertas(ctx.deps);

    expect(segunda.enviados).toBe(2);
  });
});
