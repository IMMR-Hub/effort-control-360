/**
 * Adjunta el token CSRF a las peticiones mutantes de `app.inject()` en tests.
 *
 * El servidor ahora exige `x-csrf-token` + su cookie en toda petición
 * POST/PUT/PATCH/DELETE. Reescribir a mano los ~140 `inject()` ya existentes
 * en los tests de rutas para agregarles el header sería enorme y frágil (un
 * inject nuevo que se olvide del token fallaría con un 403 sin explicación
 * obvia). En cambio, se parchea `app.inject()` una sola vez por test file,
 * justo después de `app.ready()`: toda petición mutante posterior lo lleva
 * automático, sin tocar el resto de los tests.
 */

import type { FastifyInstance, InjectOptions } from 'fastify';

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Devuelve el `inject` original, sin el token automático — para los tests que
 * prueban específicamente el rechazo por CSRF ausente o inválido.
 */
export async function activarCsrfEnInject(app: FastifyInstance): Promise<FastifyInstance['inject']> {
  const respuestaToken = await app.inject({ method: 'GET', url: '/api/v1/csrf' });
  const csrfToken = (JSON.parse(respuestaToken.body) as { csrfToken: string }).csrfToken;
  const cookieCsrf = respuestaToken.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const injectOriginal = app.inject.bind(app);

  app.inject = ((opciones: InjectOptions) => {
    const metodo = String(opciones.method ?? 'GET').toUpperCase();
    if (!METODOS_MUTANTES.has(metodo)) {
      return injectOriginal(opciones);
    }

    const headersPrevios = (opciones.headers ?? {}) as Record<string, string>;
    const cookiePrevia = headersPrevios['cookie'];

    return injectOriginal({
      ...opciones,
      headers: {
        ...headersPrevios,
        'x-csrf-token': csrfToken,
        cookie: cookiePrevia ? `${cookiePrevia}; ${cookieCsrf}` : cookieCsrf,
      },
    });
  }) as typeof app.inject;

  return injectOriginal;
}
