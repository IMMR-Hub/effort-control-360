/**
 * Avisos por correo de las alertas críticas.
 *
 * Lo que resuelve, con las palabras de Daniel (2026-09-11): que el aviso salga
 * "sin depender de que se tome el tiempo una persona". El seguimiento por
 * WhatsApp o llamada lo sigue haciendo alguien, y lo registra a mano en
 * Seguimiento — pero el primer aviso ya no depende de que nadie se acuerde.
 *
 * Tres decisiones que valen la pena:
 *
 *  1. **Un correo por alerta, una sola vez.** La tabla `envio_notificacion`
 *     guarda qué se mandó; antes de mandar se consulta. Un motor que corre solo
 *     cada hora y no recuerda lo que ya mandó convierte el correo en spam, y un
 *     aviso que llega treinta veces deja de leerse.
 *  2. **Solo lo crítico.** Avisar por correo de algo que vence en dos semanas
 *     entrena a la gente a ignorar los correos del sistema.
 *  3. **Si falla el envío, queda registrado el fallo.** Un aviso que no salió y
 *     nadie sabe que no salió es peor que no tener avisos.
 */

import type { EnviadorDeCorreo } from '@effort/drive';

import type { AlertaAlmacenada } from '../puertos-dominio.js';

/** Un envío ya realizado, para no repetirlo. */
export interface EnvioRegistrado {
  readonly alertaId: string;
  readonly destinatario: string;
}

export interface AltaDeEnvio {
  readonly clienteId: string | null;
  readonly alertaId: string;
  readonly destinatario: string;
  readonly asunto: string;
  readonly estado: 'ENVIADO' | 'FALLIDO';
  readonly idMensajeProveedor: string | null;
  readonly errorProveedor: string | null;
  readonly despachadoEn: Date | null;
}

export interface DependenciasDeAvisos {
  readonly alertas: { listar(filtro: null): Promise<AlertaAlmacenada[]> };
  readonly correo: EnviadorDeCorreo;
  readonly yaEnviados: () => Promise<readonly EnvioRegistrado[]>;
  readonly registrarEnvio: (datos: AltaDeEnvio) => Promise<void>;
  /** A quiénes se avisa. Hoy, dirección. */
  readonly destinatarios: readonly string[];
  readonly nombreDeCliente: (clienteId: string | null) => string;
  readonly ahora: () => Date;
}

export interface ResumenDeAvisos {
  readonly enviados: number;
  readonly fallidos: number;
  readonly yaAvisadas: number;
}

function cuerpoDelAviso(alerta: AlertaAlmacenada, cliente: string): string {
  return [
    `Cliente: ${cliente}`,
    '',
    alerta.titulo,
    '',
    alerta.detalle,
    '',
    alerta.fechaLimite ? `Fecha límite: ${alerta.fechaLimite.toISOString().slice(0, 10)}` : '',
    '',
    '---',
    'Este aviso lo generó EFFORT Control 360 automáticamente.',
    'La alerta se cierra sola cuando el documento se carga o la presentación se registra.',
  ]
    .filter((linea) => linea !== undefined)
    .join('\n');
}

export async function enviarAvisosDeAlertas(
  deps: DependenciasDeAvisos,
): Promise<ResumenDeAvisos> {
  const [alertas, enviados] = await Promise.all([deps.alertas.listar(null), deps.yaEnviados()]);

  const yaAvisado = new Set(enviados.map((e) => `${e.alertaId}|${e.destinatario}`));

  let contadorEnviados = 0;
  let contadorFallidos = 0;
  let contadorYaAvisadas = 0;

  for (const alerta of alertas) {
    if (alerta.criticidad !== 'CRITICA') continue;

    const cliente = deps.nombreDeCliente(alerta.clienteId);

    for (const destinatario of deps.destinatarios) {
      if (yaAvisado.has(`${alerta.id}|${destinatario}`)) {
        contadorYaAvisadas += 1;
        continue;
      }

      const asunto = `[EFFORT Control 360] ${cliente}: ${alerta.titulo}`;

      try {
        const { idMensaje } = await deps.correo.enviar({
          destinatario,
          asunto,
          cuerpo: cuerpoDelAviso(alerta, cliente),
        });

        await deps.registrarEnvio({
          clienteId: alerta.clienteId,
          alertaId: alerta.id,
          destinatario,
          asunto,
          estado: 'ENVIADO',
          idMensajeProveedor: idMensaje,
          errorProveedor: null,
          despachadoEn: deps.ahora(),
        });
        contadorEnviados += 1;
      } catch (error) {
        // El fallo se registra y se sigue: que no salga un correo no puede
        // impedir que salgan los demás.
        await deps.registrarEnvio({
          clienteId: alerta.clienteId,
          alertaId: alerta.id,
          destinatario,
          asunto,
          estado: 'FALLIDO',
          idMensajeProveedor: null,
          errorProveedor: error instanceof Error ? error.message.slice(0, 1000) : 'Error desconocido.',
          despachadoEn: null,
        });
        contadorFallidos += 1;
      }
    }
  }

  return {
    enviados: contadorEnviados,
    fallidos: contadorFallidos,
    yaAvisadas: contadorYaAvisadas,
  };
}
