/**
 * Adaptador real contra Microsoft Graph API.
 *
 * Sin dependencias nuevas a propósito: el flujo de credenciales de aplicación
 * (client credentials) es tres llamadas HTTP documentadas por Microsoft, y
 * `fetch` ya viene con Node — no hace falta el SDK de Graph para esto.
 *
 * Todavía no se puede ejercitar contra una cuenta real: falta que EFFORT
 * registre la aplicación en Azure AD y cree la cuenta dedicada (ver
 * `docs/DISCREPANCIAS.md`, punto 6). El código sigue la documentación oficial
 * de Graph, pero no tiene una prueba de integración real todavía — cuando
 * exista la cuenta, corresponde agregar una (ver `verify:drive` en
 * `scripts/verify.mjs`).
 */

import type { ArchivoDrive, DriveDeArchivos } from './puerto.js';

export interface ConfiguracionGraph {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /** Id del drive de la cuenta dedicada del sistema (no el de una persona). */
  readonly driveId: string;
}

interface RespuestaToken {
  readonly access_token: string;
  readonly expires_in: number;
}

interface ElementoGraph {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly lastModifiedDateTime: string;
  readonly file?: { readonly mimeType?: string };
  readonly folder?: unknown;
}

interface ListadoGraph {
  readonly value: readonly ElementoGraph[];
}

function aArchivoDrive(item: ElementoGraph, carpeta: string): ArchivoDrive {
  return {
    itemId: item.id,
    nombre: item.name,
    rutaCarpeta: carpeta,
    tamanoBytes: item.size,
    modificadoEn: new Date(item.lastModifiedDateTime),
    tipoMime: item.file?.mimeType ?? null,
  };
}

/** Recorta barras iniciales/finales: Graph las rechaza en las rutas `root:/...:/`. */
function normalizarCarpeta(carpeta: string): string {
  return carpeta.replace(/^\/+/, '').replace(/\/+$/, '');
}

export class DriveGraph implements DriveDeArchivos {
  #tokenEnCache: { token: string; expiraEn: number } | null = null;

  constructor(private readonly configuracion: ConfiguracionGraph) {}

  async #token(): Promise<string> {
    if (this.#tokenEnCache && Date.now() < this.#tokenEnCache.expiraEn) {
      return this.#tokenEnCache.token;
    }

    const respuesta = await fetch(
      `https://login.microsoftonline.com/${this.configuracion.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.configuracion.clientId,
          client_secret: this.configuracion.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );

    if (!respuesta.ok) {
      throw new Error(
        `No se pudo autenticar contra Microsoft Graph (${respuesta.status}): ${await respuesta.text()}`,
      );
    }

    const datos = (await respuesta.json()) as RespuestaToken;
    // Se resta un minuto de margen para no usar un token que vence a mitad
    // de la siguiente llamada.
    this.#tokenEnCache = {
      token: datos.access_token,
      expiraEn: Date.now() + (datos.expires_in - 60) * 1000,
    };
    return this.#tokenEnCache.token;
  }

  async #peticion(ruta: string, opciones: RequestInit = {}): Promise<Response> {
    const token = await this.#token();
    const respuesta = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, {
      ...opciones,
      headers: { ...opciones.headers, authorization: `Bearer ${token}` },
    });

    if (!respuesta.ok) {
      throw new Error(
        `Microsoft Graph devolvió ${respuesta.status} en ${ruta}: ${await respuesta.text()}`,
      );
    }

    return respuesta;
  }

  async listar(carpeta: string): Promise<ArchivoDrive[]> {
    const ruta = normalizarCarpeta(carpeta);
    const respuesta = await this.#peticion(
      `/drives/${this.configuracion.driveId}/root:/${encodeURI(ruta)}:/children`,
    );
    const datos = (await respuesta.json()) as ListadoGraph;

    return datos.value.filter((item) => !item.folder).map((item) => aArchivoDrive(item, carpeta));
  }

  async leer(itemId: string): Promise<Buffer> {
    const respuesta = await this.#peticion(
      `/drives/${this.configuracion.driveId}/items/${itemId}/content`,
    );
    return Buffer.from(await respuesta.arrayBuffer());
  }

  /**
   * Sube el contenido completo en una sola petición ("simple upload" de
   * Graph). Válido hasta 4 MiB — los archivos de EFFORT (planillas de
   * comprobantes, exportaciones SIGA) están muy por debajo de ese límite. Un
   * archivo más grande necesitaría una sesión de carga por partes, que este
   * adaptador no implementa porque el caso de uso actual no la necesita.
   */
  async escribir(carpeta: string, nombre: string, contenido: Buffer): Promise<ArchivoDrive> {
    if (contenido.byteLength > 4 * 1024 * 1024) {
      throw new Error(
        `Archivo de ${contenido.byteLength} bytes supera el límite de 4 MiB de la carga simple de Graph.`,
      );
    }

    const ruta = normalizarCarpeta(carpeta);
    const respuesta = await this.#peticion(
      `/drives/${this.configuracion.driveId}/root:/${encodeURI(ruta)}/${encodeURIComponent(nombre)}:/content`,
      {
        method: 'PUT',
        body: contenido,
        headers: { 'content-type': 'application/octet-stream' },
      },
    );

    const item = (await respuesta.json()) as ElementoGraph;
    return aArchivoDrive(item, carpeta);
  }
}
