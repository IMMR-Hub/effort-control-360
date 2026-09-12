/**
 * Autenticación contra Microsoft Graph, compartida por los adaptadores.
 *
 * La sacamos del adaptador de archivos cuando apareció el segundo adaptador (el
 * de correo): los dos usan las mismas credenciales de aplicación y el mismo
 * flujo, y tener dos copias del manejo del token es tener dos lugares donde
 * arreglar el mismo vencimiento.
 */

export interface CredencialesGraph {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

interface RespuestaToken {
  readonly access_token: string;
  readonly expires_in: number;
}

/**
 * Pide y cachea el token de aplicación.
 *
 * Se guarda por credencial, no global: dos adaptadores con las mismas
 * credenciales comparten el token, y si algún día hubiera dos aplicaciones
 * distintas no se pisarían entre sí.
 */
export class AutenticacionGraph {
  #enCache: { token: string; expiraEn: number } | null = null;

  constructor(private readonly credenciales: CredencialesGraph) {}

  async token(): Promise<string> {
    if (this.#enCache && Date.now() < this.#enCache.expiraEn) {
      return this.#enCache.token;
    }

    const respuesta = await fetch(
      `https://login.microsoftonline.com/${this.credenciales.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.credenciales.clientId,
          client_secret: this.credenciales.clientSecret,
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
    // Un minuto de margen: sin esto se podría usar un token que vence a mitad
    // de la llamada siguiente.
    this.#enCache = {
      token: datos.access_token,
      expiraEn: Date.now() + (datos.expires_in - 60) * 1000,
    };
    return this.#enCache.token;
  }
}
