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

// En desarrollo, interfaz (5173) y API (3000) son orígenes distintos: hace
// falta la URL completa. En producción son el mismo origen (ruteo por path,
// sin CORS — ver .do/app.yaml), así que basta con `window.location.origin`;
// eso evita tener que fijar de antemano cuál va a ser el dominio final.
const URL_BASE =
  import.meta.env['VITE_API_URL'] ?? (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * URL absoluta de una ruta de la API, para lo que no pasa por `fetch`.
 *
 * Lo usa el botón de abrir un archivo: el navegador tiene que navegar a la
 * dirección, no recibir el contenido por JavaScript. La cookie de sesión viaja
 * sola porque es del mismo origen.
 */
export function urlDeApi(ruta: string): string {
  return new URL(ruta, URL_BASE).toString();
}

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
export function peticion<TRespuesta>(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  query?: QueryParams,
): Promise<TRespuesta> {
  const metodoMayuscula = metodo.toUpperCase();
  const pedir = () => pedirAlServidor<TRespuesta>(metodoMayuscula, ruta, cuerpo, query);
  if (metodoMayuscula !== 'GET' || cuerpo !== undefined) return pedir();

  const clave = construirUrl(ruta, query);
  if (anotandoPrecarga) {
    const promesa = pedir();
    // Si nadie la llega a usar (no había sesión), su error no es de nadie.
    promesa.catch(() => undefined);
    precargas.set(clave, { promesa, pedidaEn: Date.now() });
    return promesa;
  }

  const adelantada = precargas.get(clave);
  if (adelantada) {
    // Se usa una sola vez: la segunda vez que alguien pide lo mismo quiere el
    // dato de ahora, no el de cuando se abrió la página.
    precargas.delete(clave);
    if (Date.now() - adelantada.pedidaEn <= VIDA_DE_PRECARGA_MS) {
      // Una precarga que falló nunca le muestra un error a nadie: se pide de nuevo.
      return (adelantada.promesa as Promise<TRespuesta>).catch(pedir);
    }
  }
  return pedir();
}

/*
 * Precarga (2026-11-12). Al abrir la página, lo primero que se hacía era
 * preguntar «quién soy» y recién con la respuesta se pedían los datos del
 * Panel: dos tandas en fila, y cada pedido a producción cuesta ~0,2 s de ida y
 * vuelta más lo que tarde el servidor. Con la precarga las dos tandas salen
 * juntas: los GET que se piden dentro de `precargar` quedan anotados por su
 * dirección exacta, y el primer pedido igual que llegue después usa esa misma
 * respuesta en vez de volver al servidor.
 *
 * Lo que la hace segura:
 *  - solo GET, que no cambian nada;
 *  - el servidor decide con la cookie, como siempre: sin sesión responde 401 y
 *    la precarga se descarta sin que nadie vea el error;
 *  - cada respuesta se usa una sola vez y vence a los 15 s;
 *  - `descartarPrecargas` se llama cuando no hay sesión y cada vez que alguien
 *    ingresa o sale, para que nunca se le muestre a una persona lo que se pidió
 *    con la sesión de otra.
 */
const VIDA_DE_PRECARGA_MS = 15_000;
const precargas = new Map<string, { promesa: Promise<unknown>; pedidaEn: number }>();
let anotandoPrecarga = false;

/**
 * Adelanta los GET que `pedir` dispare. `pedir` tiene que hacer los pedidos en
 * el momento (sin esperar nada antes): lo que pida después de un `await` ya no
 * queda anotado.
 */
export function precargar(pedir: () => unknown): void {
  anotandoPrecarga = true;
  try {
    const resultado = pedir();
    if (resultado instanceof Promise) resultado.catch(() => undefined);
  } catch {
    // Una precarga que no se pudo armar no rompe nada: se pedirá normalmente.
  } finally {
    anotandoPrecarga = false;
  }
}

export function descartarPrecargas(): void {
  precargas.clear();
}

async function pedirAlServidor<TRespuesta>(
  metodoMayuscula: string,
  ruta: string,
  cuerpo: unknown,
  query: QueryParams | undefined,
): Promise<TRespuesta> {
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
