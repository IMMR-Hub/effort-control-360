/**
 * Cliente HTTP tipado contra la API de EFFORT Control 360 (tarea 100).
 *
 * Dos cosas que todo llamado necesita y que acá se resuelven una sola vez:
 *
 *  - **Sesión**: la cookie es `httpOnly`, así que el navegador la maneja solo;
 *    alcanza con `credentials: 'include'` en cada `fetch`.
 *  - **CSRF**: el servidor exige `x-csrf-token` en toda petición mutante
 *    (POST/PUT/PATCH/DELETE) desde que se corrigió la tarea 39 — antes estaba
 *    registrado pero no se aplicaba a nada. El token se pide una vez a
 *    `GET /api/v1/csrf`, se cachea en memoria, y si el servidor lo rechaza
 *    (403 — puede vencer, o cerrarse sesión en otra pestaña) se pide uno
 *    nuevo y se reintenta una sola vez antes de darse por vencido.
 *
 * El servidor responde los errores siempre con la misma forma
 * (`{error, mensaje, peticionId?}, ver `apps/api/src/servidor.ts`
 * `setErrorHandler`), así que `ErrorDeApi` la reproduce tal cual en vez de
 * inventar una forma nueva del lado del cliente.
 */

const URL_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ErrorDeApi extends Error {
  constructor(
    readonly statusCode: number,
    readonly codigo: string,
    mensaje: string,
    readonly peticionId?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
  }
}

interface CuerpoDeErrorApi {
  readonly error: string;
  readonly mensaje: string;
  readonly peticionId?: string;
}

let tokenCsrfEnCache: string | null = null;

async function obtenerTokenCsrf(): Promise<string> {
  if (tokenCsrfEnCache) return tokenCsrfEnCache;

  const respuesta = await fetch(`${URL_BASE}/api/v1/csrf`, { credentials: 'include' });
  if (!respuesta.ok) {
    throw new ErrorDeApi(
      respuesta.status,
      'csrf_no_disponible',
      'No se pudo establecer conexión segura con el servidor.',
    );
  }

  const datos = (await respuesta.json()) as { csrfToken: string };
  tokenCsrfEnCache = datos.csrfToken;
  return tokenCsrfEnCache;
}

export type QueryParams = Readonly<Record<string, string | number | boolean | undefined>>;

function construirUrl(ruta: string, query?: QueryParams): string {
  const url = new URL(ruta, URL_BASE);
  if (query) {
    for (const [clave, valor] of Object.entries(query)) {
      if (valor !== undefined) url.searchParams.set(clave, String(valor));
    }
  }
  return url.toString();
}

async function ejecutarFetch(
  metodo: string,
  ruta: string,
  cuerpo: unknown,
  query: QueryParams | undefined,
  reintentandoCsrf: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';
  if (METODOS_MUTANTES.has(metodo)) {
    headers['x-csrf-token'] = await obtenerTokenCsrf();
  }

  const respuesta = await fetch(construirUrl(ruta, query), {
    method: metodo,
    credentials: 'include',
    headers,
    body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
  });

  // El token pudo quedar viejo (venció, se cerró sesión en otra pestaña).
  // Se pide uno nuevo y se reintenta una sola vez: si vuelve a fallar, ahí sí
  // es un rechazo real y no una cuestión de caché.
  if (respuesta.status === 403 && METODOS_MUTANTES.has(metodo) && !reintentandoCsrf) {
    tokenCsrfEnCache = null;
    return ejecutarFetch(metodo, ruta, cuerpo, query, true);
  }

  return respuesta;
}

/**
 * Petición tipada genérica. `TRespuesta` es la forma esperada del cuerpo en
 * éxito — la tipa quien llama, contra los tipos ya definidos en
 * `@effort/schema`/`@effort/core` o específicos de cada pantalla.
 */
export async function peticion<TRespuesta>(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  query?: QueryParams,
): Promise<TRespuesta> {
  const metodoMayuscula = metodo.toUpperCase();
  const respuesta = await ejecutarFetch(metodoMayuscula, ruta, cuerpo, query, false);

  if (!respuesta.ok) {
    const datos = (await respuesta.json().catch(() => null)) as CuerpoDeErrorApi | null;
    throw new ErrorDeApi(
      respuesta.status,
      datos?.error ?? 'error_desconocido',
      datos?.mensaje ?? 'Ocurrió un error inesperado.',
      datos?.peticionId,
    );
  }

  return (await respuesta.json()) as TRespuesta;
}
