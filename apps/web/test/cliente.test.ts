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
