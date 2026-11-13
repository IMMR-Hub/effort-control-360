/**
 * Cliente HTTP tipado (tarea 100).
 *
 * `fetch` global mockeado: no hace falta un servidor real para probar el
 * manejo de CSRF (caché del token, reintento único ante un 403) ni el
 * mapeo de errores a `ErrorDeApi`. `vi.resetModules()` + import dinámico en
 * cada test para que el token cacheado a nivel de módulo no se filtre de un
 * test al siguiente.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function respuestaJson(cuerpo: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function importarClienteFresco() {
  vi.resetModules();
  return import('../src/api/cliente.js');
}

describe('cliente HTTP', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET no pide token CSRF y manda credentials: include', async () => {
    const { peticion } = await importarClienteFresco();
    fetchMock.mockResolvedValueOnce(respuestaJson({ estado: 'ok' }));

    const resultado = await peticion<{ estado: string }>('GET', '/salud');

    expect(resultado).toEqual({ estado: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(opciones.credentials).toBe('include');
    expect((opciones.headers as Record<string, string>)['x-csrf-token']).toBeUndefined();
  });

  it('POST pide el token CSRF primero y lo manda en el header', async () => {
    const { peticion } = await importarClienteFresco();
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-123' }))
      .mockResolvedValueOnce(respuestaJson({ ok: true }));

    await peticion('POST', '/api/v1/algo', { dato: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [urlToken] = fetchMock.mock.calls[0] as [string];
    expect(urlToken).toContain('/api/v1/csrf');
    const [, opciones] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((opciones.headers as Record<string, string>)['x-csrf-token']).toBe('token-123');
    expect(opciones.body).toBe(JSON.stringify({ dato: 1 }));
  });

  it('el token CSRF se cachea: dos POST seguidos solo piden el token una vez', async () => {
    const { peticion } = await importarClienteFresco();
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-123' }))
      .mockResolvedValueOnce(respuestaJson({ ok: true }))
      .mockResolvedValueOnce(respuestaJson({ ok: true }));

    await peticion('POST', '/api/v1/a', {});
    await peticion('POST', '/api/v1/b', {});

    const llamadasATokenCsrf = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/csrf'),
    );
    expect(llamadasATokenCsrf).toHaveLength(1);
  });

  it('si el token es rechazado (403), pide uno nuevo y reintenta una vez', async () => {
    const { peticion } = await importarClienteFresco();
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-viejo' }))
      .mockResolvedValueOnce(respuestaJson({ error: 'csrf_invalido', mensaje: 'no' }, { status: 403 }))
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-nuevo' }))
      .mockResolvedValueOnce(respuestaJson({ ok: true }));

    const resultado = await peticion<{ ok: boolean }>('POST', '/api/v1/algo', {});

    expect(resultado).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const ultimaLlamada = fetchMock.mock.calls[3] as [string, RequestInit];
    expect((ultimaLlamada[1].headers as Record<string, string>)['x-csrf-token']).toBe('token-nuevo');
  });

  it('si el segundo intento también da 403, se rinde y lanza ErrorDeApi', async () => {
    const { peticion, ErrorDeApi } = await importarClienteFresco();
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-1' }))
      .mockResolvedValueOnce(respuestaJson({ error: 'csrf_invalido', mensaje: 'no 1' }, { status: 403 }))
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-2' }))
      .mockResolvedValueOnce(respuestaJson({ error: 'csrf_invalido', mensaje: 'no 2' }, { status: 403 }));

    await expect(peticion('POST', '/api/v1/algo', {})).rejects.toThrow(ErrorDeApi);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('un error del servidor se convierte en ErrorDeApi con los mismos datos', async () => {
    const { peticion, ErrorDeApi } = await importarClienteFresco();
    fetchMock.mockResolvedValueOnce(
      respuestaJson(
        { error: 'validacion', mensaje: 'Los datos enviados no son válidos.', peticionId: 'abc-123' },
        { status: 400 },
      ),
    );

    const error = await peticion('GET', '/api/v1/algo').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorDeApi);
    expect((error as InstanceType<typeof ErrorDeApi>).statusCode).toBe(400);
    expect((error as InstanceType<typeof ErrorDeApi>).codigo).toBe('validacion');
    expect((error as InstanceType<typeof ErrorDeApi>).message).toBe('Los datos enviados no son válidos.');
    expect((error as InstanceType<typeof ErrorDeApi>).peticionId).toBe('abc-123');
  });

  /*
   * Precarga (2026-11-12): los datos del Panel se piden mientras se comprueba
   * la sesión. Lo que tiene que quedar fijo es que nunca cambia lo que se ve:
   * solo ahorra un pedido, una vez, y ante cualquier duda vuelve al servidor.
   */
  describe('precarga', () => {
    it('lo que se adelantó se usa una sola vez: el mismo GET no vuelve al servidor, el siguiente sí', async () => {
      const { peticion, precargar } = await importarClienteFresco();
      fetchMock.mockResolvedValueOnce(respuestaJson({ vuelta: 1 }));
      fetchMock.mockResolvedValueOnce(respuestaJson({ vuelta: 2 }));

      precargar(() => peticion('GET', '/api/v1/clientes'));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      expect(await peticion('GET', '/api/v1/clientes')).toEqual({ vuelta: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      expect(await peticion('GET', '/api/v1/clientes')).toEqual({ vuelta: 2 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('solo coincide el mismo pedido exacto: otro período es otro pedido', async () => {
      const { peticion, precargar } = await importarClienteFresco();
      fetchMock.mockResolvedValueOnce(respuestaJson({ periodo: '2026-10' }));
      fetchMock.mockResolvedValueOnce(respuestaJson({ periodo: '2026-11' }));

      precargar(() => peticion('GET', '/api/v1/balances', undefined, { periodo: '2026-10' }));

      expect(await peticion('GET', '/api/v1/balances', undefined, { periodo: '2026-11' })).toEqual({ periodo: '2026-11' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('una precarga que falló (sin sesión todavía) no le muestra el error a nadie: se pide de nuevo', async () => {
      const { peticion, precargar } = await importarClienteFresco();
      fetchMock.mockResolvedValueOnce(respuestaJson({ error: 'no_autenticado', mensaje: 'Sin sesión.' }, { status: 401 }));
      fetchMock.mockResolvedValueOnce(respuestaJson({ clientes: ['ACME'] }));

      precargar(() => peticion('GET', '/api/v1/clientes'));

      expect(await peticion('GET', '/api/v1/clientes')).toEqual({ clientes: ['ACME'] });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('descartada, no se usa: lo que se pidió con una sesión no llega a la siguiente', async () => {
      const { peticion, precargar, descartarPrecargas } = await importarClienteFresco();
      fetchMock.mockResolvedValueOnce(respuestaJson({ de: 'la sesión anterior' }));
      fetchMock.mockResolvedValueOnce(respuestaJson({ de: 'la sesión nueva' }));

      precargar(() => peticion('GET', '/api/v1/clientes'));
      descartarPrecargas();

      expect(await peticion('GET', '/api/v1/clientes')).toEqual({ de: 'la sesión nueva' });
    });

    it('vence a los 15 segundos: después se pide el dato de ahora', async () => {
      const { peticion, precargar } = await importarClienteFresco();
      fetchMock.mockResolvedValueOnce(respuestaJson({ dato: 'viejo' }));
      fetchMock.mockResolvedValueOnce(respuestaJson({ dato: 'de ahora' }));
      const reloj = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

      precargar(() => peticion('GET', '/api/v1/clientes'));
      reloj.mockReturnValue(1_000_000 + 15_001);

      expect(await peticion('GET', '/api/v1/clientes')).toEqual({ dato: 'de ahora' });
      reloj.mockRestore();
    });

    it('lo que cambia datos nunca se adelanta ni se reutiliza', async () => {
      const { peticion, precargar } = await importarClienteFresco();
      fetchMock.mockImplementation(async (url: string) =>
        String(url).endsWith('/csrf') ? respuestaJson({ csrfToken: 't' }) : respuestaJson({ ok: true }),
      );

      precargar(() => peticion('POST', '/api/v1/alertas/1/cerrar', { motivo: 'x' }));
      await peticion('POST', '/api/v1/alertas/1/cerrar', { motivo: 'x' });

      const posts = fetchMock.mock.calls.filter(([, o]) => (o as RequestInit | undefined)?.method === 'POST');
      expect(posts).toHaveLength(2);
    });
  });

  it('arma la query string y omite los valores undefined', async () => {
    const { peticion } = await importarClienteFresco();
    fetchMock.mockResolvedValueOnce(respuestaJson([]));

    await peticion('GET', '/api/v1/clientes/1/documentos', undefined, {
      periodo: '2026-03',
      vacio: undefined,
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('periodo=2026-03');
    expect(url).not.toContain('vacio');
  });
});
