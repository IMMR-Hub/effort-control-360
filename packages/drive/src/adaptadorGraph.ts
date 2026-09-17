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

import { ErrorTransitorioDeDrive, type ArchivoDrive, type DriveDeArchivos } from './puerto.js';

export interface ConfiguracionGraph {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /**
   * Id del drive, si se conoce. Puede omitirse: con `usuarioPrincipal`
   * alcanza, y el adaptador se lo pregunta a Graph la primera vez.
   */
  readonly driveId?: string | undefined;
  /**
   * Correo del dueño del drive (`effort360@effort.com.py`).
   *
   * Es la forma preferida de configurarlo. El id del drive no es un secreto ni
   * un dato que alguien recuerde: es una cadena opaca de 66 caracteres que hay
   * que ir a buscar. El correo, en cambio, lo sabe cualquiera del equipo, y de
   * él se deduce el id. Menos configuración que puede faltar o quedar mal
   * copiada — que es exactamente lo que pasó al desplegar el 2026-09-11.
   */
  readonly usuarioPrincipal?: string | undefined;
  /** Espera entre reintentos. Solo se reemplaza en los tests, para no esperar de verdad. */
  readonly esperar?: ((milisegundos: number) => Promise<void>) | undefined;
}

/** Intentos de lectura ante una falla pasajera (el primero más dos reintentos). */
const INTENTOS_DE_LECTURA = 3;
/** Tope de espera entre intentos, aunque Graph pida más en `Retry-After`. */
const ESPERA_MAXIMA_MS = 30_000;

function esperarDeVerdad(milisegundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

/** 429 y 5xx son de Graph, no del archivo: vale la pena reintentar. */
function esEstadoPasajero(estado: number): boolean {
  return estado === 429 || estado >= 500;
}

/** Milisegundos a esperar según `Retry-After` (segundos), o la espera exponencial. */
function esperaAntesDe(intento: number, reintentarDespues: string | null): number {
  const segundos = reintentarDespues === null ? Number.NaN : Number(reintentarDespues);
  const pedida = Number.isFinite(segundos) && segundos >= 0 ? segundos * 1000 : 1000 * 2 ** intento;
  return Math.min(pedida, ESPERA_MAXIMA_MS);
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

/** Tope de carpetas a recorrer. Ver `listarRecursivoPorId`. */
const MAXIMO_DE_CARPETAS = 500;

/** Arriba de esto, Graph exige abrir una sesión de carga. */
const LIMITE_DE_CARGA_SIMPLE = 4 * 1024 * 1024;

/** Recorta barras iniciales/finales: Graph las rechaza en las rutas `root:/...:/`. */
function normalizarCarpeta(carpeta: string): string {
  return carpeta.replace(/^\/+/, '').replace(/\/+$/, '');
}

export class DriveGraph implements DriveDeArchivos {
  #tokenEnCache: { token: string; expiraEn: number } | null = null;
  #driveEnCache: string | null = null;

  constructor(private readonly configuracion: ConfiguracionGraph) {
    if (!configuracion.driveId && !configuracion.usuarioPrincipal) {
      throw new Error(
        'DriveGraph necesita el id del drive o el correo de su dueño para poder deducirlo.',
      );
    }
  }

  /**
   * Id del drive, preguntándoselo a Graph si hace falta.
   *
   * Se resuelve una sola vez por instancia: el id de un drive no cambia.
   */
  async #drive(): Promise<string> {
    if (this.configuracion.driveId) return this.configuracion.driveId;
    if (this.#driveEnCache) return this.#driveEnCache;

    const respuesta = await this.#peticion(
      `/users/${encodeURIComponent(this.configuracion.usuarioPrincipal!)}/drive?$select=id`,
    );
    const { id } = (await respuesta.json()) as { id: string };
    this.#driveEnCache = id;
    return id;
  }

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
      `/drives/${await this.#drive()}/root:/${encodeURI(ruta)}:/children`,
    );
    const datos = (await respuesta.json()) as ListadoGraph;

    return datos.value.filter((item) => !item.folder).map((item) => aArchivoDrive(item, carpeta));
  }

  /**
   * Recorre una carpeta y todo lo que cuelga de ella.
   *
   * Para leer el drive de otra persona (el de Laura, donde EFFORT trabaja a
   * diario) se crea OTRA instancia de este adaptador apuntando a ese drive, en
   * vez de que una misma instancia mezcle dos. Así es imposible que una lectura
   * del drive ajeno y una escritura en el propio se confundan entre sí — y la
   * regla de que las carpetas reales de EFFORT son de solo lectura
   * (`CLAUDE.md`) no depende de acordarse de pasar el parámetro correcto.
   */
  async listarRecursivoPorId(itemId: string): Promise<ArchivoDrive[]> {
    const drive = await this.#drive();
    const encontrados: ArchivoDrive[] = [];
    // Iterativo y no recursivo: una jerarquía profunda no debe poder agotar la
    // pila, y así el tope de carpetas de más abajo es fácil de hacer cumplir.
    const pendientes: { id: string; ruta: string }[] = [{ id: itemId, ruta: '' }];
    let carpetasRecorridas = 0;

    while (pendientes.length > 0) {
      const actual = pendientes.pop()!;

      if (++carpetasRecorridas > MAXIMO_DE_CARPETAS) {
        throw new Error(
          `La carpeta tiene más de ${MAXIMO_DE_CARPETAS} subcarpetas. ` +
            'Se corta para no quedar recorriendo indefinidamente: revisá si es la carpeta correcta.',
        );
      }

      let url: string | null =
        `/drives/${drive}/items/${actual.id}/children` +
        '?$top=200&$select=id,name,size,lastModifiedDateTime,file,folder';

      while (url) {
        const respuesta = await this.#peticion(url);
        const datos = (await respuesta.json()) as ListadoGraph & { '@odata.nextLink'?: string };

        for (const item of datos.value) {
          const ruta = actual.ruta === '' ? item.name : `${actual.ruta}/${item.name}`;
          if (item.folder) {
            pendientes.push({ id: item.id, ruta });
          } else {
            encontrados.push(aArchivoDrive(item, actual.ruta));
          }
        }

        // Graph pagina de a 200: sin seguir `nextLink` se perderían archivos en
        // silencio, que es la peor forma posible de fallar en una importación.
        const siguiente = datos['@odata.nextLink'];
        url = siguiente ? siguiente.replace('https://graph.microsoft.com/v1.0', '') : null;
      }
    }

    return encontrados;
  }

  async enlaceWeb(itemId: string): Promise<string> {
    const respuesta = await this.#peticion(
      `/drives/${await this.#drive()}/items/${itemId}?$select=webUrl`,
    );
    const { webUrl } = (await respuesta.json()) as { webUrl?: string };
    if (!webUrl) throw new Error(`Microsoft Graph no devolvió la dirección web de ${itemId}.`);
    return webUrl;
  }

  /**
   * Baja el contenido de un archivo, reintentando las fallas pasajeras.
   *
   * Hasta el 2026-09-16 un solo 429 o un "fetch failed" hacía que la planilla
   * más nueva de un período no se leyera, y ganaba en silencio la versión
   * vieja. Reintentar es seguro acá porque leer no cambia nada. Si la falla
   * sigue, se lanza `ErrorTransitorioDeDrive` para que quien llama no la
   * confunda con un archivo roto. Un 404 o un 403 no se reintentan: no se
   * arreglan esperando.
   */
  async leer(itemId: string): Promise<Buffer> {
    const esperar = this.configuracion.esperar ?? esperarDeVerdad;
    const ruta = `/drives/${await this.#drive()}/items/${itemId}/content`;
    let ultimoMotivo = '';

    for (let intento = 1; intento <= INTENTOS_DE_LECTURA; intento += 1) {
      let respuesta: Response;
      try {
        const token = await this.#token();
        respuesta = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, {
          headers: { authorization: `Bearer ${token}` },
        });
      } catch (error) {
        // Corte de red: el pedido ni siquiera llegó a tener respuesta.
        ultimoMotivo = error instanceof Error ? error.message : String(error);
        if (intento < INTENTOS_DE_LECTURA) await esperar(esperaAntesDe(intento, null));
        continue;
      }

      if (respuesta.ok) return Buffer.from(await respuesta.arrayBuffer());

      const cuerpo = await respuesta.text();
      if (!esEstadoPasajero(respuesta.status)) {
        throw new Error(`Microsoft Graph devolvió ${respuesta.status} en ${ruta}: ${cuerpo}`);
      }
      ultimoMotivo = `Microsoft Graph devolvió ${respuesta.status}`;
      if (intento < INTENTOS_DE_LECTURA) {
        await esperar(esperaAntesDe(intento, respuesta.headers.get('retry-after')));
      }
    }

    throw new ErrorTransitorioDeDrive(
      `No se pudo leer ${itemId} después de ${INTENTOS_DE_LECTURA} intentos (${ultimoMotivo}).`,
    );
  }

  /**
   * Sube un archivo, eligiendo el mecanismo según su tamaño.
   *
   * Hasta 4 MiB va en una sola petición ("simple upload"). Arriba de eso Graph
   * la rechaza y hay que abrir una sesión de carga — ver `#escribirPorSesion`.
   */
  async escribir(carpeta: string, nombre: string, contenido: Buffer): Promise<ArchivoDrive> {
    // Arriba de 4 MiB la carga simple no sirve y hay que abrir una sesión.
    // Antes esto era un error: al sincronizar el OneDrive real de EFFORT, el
    // estatuto social de Copesa (5,7 MB) fallaba en cada corrida, para siempre.
    if (contenido.byteLength > LIMITE_DE_CARGA_SIMPLE) {
      return this.#escribirPorSesion(carpeta, nombre, contenido);
    }

    const ruta = normalizarCarpeta(carpeta);
    const respuesta = await this.#peticion(
      `/drives/${await this.#drive()}/root:/${encodeURI(ruta)}/${encodeURIComponent(nombre)}:/content`,
      {
        method: 'PUT',
        body: contenido,
        headers: { 'content-type': 'application/octet-stream' },
      },
    );

    const item = (await respuesta.json()) as ElementoGraph;
    return aArchivoDrive(item, carpeta);
  }

  /**
   * Sube un archivo grande abriendo una sesión de carga.
   *
   * Se manda el contenido completo en un solo `PUT` con su `Content-Range`, que
   * Graph admite: partirlo en trozos solo haría falta para archivos muy
   * grandes o conexiones que se cortan, y ninguna de las dos cosas describe a
   * los documentos de EFFORT.
   *
   * La sesión NO lleva el token de autorización en el `PUT`: la URL que
   * devuelve Graph ya viene firmada, y mandar el token ahí hace fallar la
   * subida.
   */
  async #escribirPorSesion(
    carpeta: string,
    nombre: string,
    contenido: Buffer,
  ): Promise<ArchivoDrive> {
    const ruta = normalizarCarpeta(carpeta);
    const sesion = await this.#peticion(
      `/drives/${await this.#drive()}/root:/${encodeURI(ruta)}/${encodeURIComponent(nombre)}:/createUploadSession`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
      },
    );

    const { uploadUrl } = (await sesion.json()) as { uploadUrl: string };
    const total = contenido.byteLength;

    const subida = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-length': String(total),
        'content-range': `bytes 0-${total - 1}/${total}`,
      },
      body: new Uint8Array(contenido),
    });

    if (!subida.ok) {
      throw new Error(
        `No se pudo subir ${nombre} (${total} bytes) por sesión: ${subida.status} ${await subida.text()}`,
      );
    }

    const item = (await subida.json()) as ElementoGraph;
    return aArchivoDrive(item, carpeta);
  }

}
