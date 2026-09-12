/**
 * Envío de correo desde la cuenta del sistema.
 *
 * Sale de `effort360@effort.com.py` usando Microsoft Graph, con las MISMAS
 * credenciales que ya se usan para OneDrive: el permiso `Mail.Send` ya estaba
 * concedido en Azure desde el 2026-08-09 (ver `docs/DISCREPANCIAS.md`, punto 6),
 * así que no hace falta contratar ni configurar ningún proveedor de correo
 * aparte, ni pagar por envío.
 *
 * Eso resuelve el punto 13 de DISCREPANCIAS ("¿qué proveedor de correo?") de la
 * forma más barata posible: el que EFFORT ya tiene.
 */

import { AutenticacionGraph, type CredencialesGraph } from './autenticacionGraph.js';

export interface CorreoAEnviar {
  readonly destinatario: string;
  readonly asunto: string;
  /** Cuerpo en texto plano. Graph lo acepta sin HTML. */
  readonly cuerpo: string;
  /** Copias, para escalar a dirección sin mandar un correo aparte. */
  readonly copias?: readonly string[];
}

export interface ResultadoDeEnvio {
  /** Identificador con el que se puede rastrear el envío en la casilla. */
  readonly idMensaje: string;
}

/**
 * Puerto de envío. El motor de avisos depende de esto y no de Graph, para
 * poder probarse sin mandar un solo correo real.
 */
export interface EnviadorDeCorreo {
  enviar(correo: CorreoAEnviar): Promise<ResultadoDeEnvio>;
}

export interface ConfiguracionDeCorreo extends CredencialesGraph {
  /** Casilla desde la que sale el correo. */
  readonly remitente: string;
}

export class CorreoGraph implements EnviadorDeCorreo {
  readonly #autenticacion: AutenticacionGraph;

  constructor(private readonly configuracion: ConfiguracionDeCorreo) {
    this.#autenticacion = new AutenticacionGraph(configuracion);
  }

  async enviar(correo: CorreoAEnviar): Promise<ResultadoDeEnvio> {
    const token = await this.#autenticacion.token();

    /*
     * `saveToSentItems: true` a propósito: el correo queda en los Enviados de
     * effort360, así que existe una copia verificable fuera del sistema. Si
     * alguna vez hay una discusión sobre si se avisó o no, la prueba no depende
     * de nuestra propia base de datos.
     */
    const respuesta = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.configuracion.remitente)}/sendMail`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: correo.asunto,
            body: { contentType: 'Text', content: correo.cuerpo },
            toRecipients: [{ emailAddress: { address: correo.destinatario } }],
            ccRecipients: (correo.copias ?? []).map((direccion) => ({
              emailAddress: { address: direccion },
            })),
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!respuesta.ok) {
      throw new Error(
        `No se pudo enviar el correo a ${correo.destinatario} (${respuesta.status}): ${await respuesta.text()}`,
      );
    }

    // `sendMail` devuelve 202 sin cuerpo: no hay id de mensaje que guardar.
    // Se compone uno con la fecha y el destinatario, que es lo que permite
    // encontrarlo después en la casilla de Enviados.
    return { idMensaje: `${new Date().toISOString()}|${correo.destinatario}` };
  }
}

/** Enviador en memoria: los tests no mandan correos de verdad. */
export class CorreoFalso implements EnviadorDeCorreo {
  readonly enviados: CorreoAEnviar[] = [];
  /** Si se define, `enviar` falla — para probar el camino del error. */
  falla: string | null = null;

  async enviar(correo: CorreoAEnviar): Promise<ResultadoDeEnvio> {
    if (this.falla) throw new Error(this.falla);
    this.enviados.push(correo);
    return { idMensaje: `falso-${this.enviados.length}` };
  }
}
