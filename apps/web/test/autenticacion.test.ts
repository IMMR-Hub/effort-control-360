import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function respuestaJson(cuerpo: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function importarFresco() {
  vi.resetModules();
  return import('../src/api/autenticacion.js');
}

describe('autenticación', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('obtenerSesionActual devuelve null en vez de lanzar cuando no hay sesión (401)', async () => {
    const { obtenerSesionActual } = await importarFresco();
    fetchMock.mockResolvedValueOnce(
      respuestaJson({ error: 'sin_sesion', mensaje: 'No hay sesión.' }, { status: 401 }),
    );

    const sesion = await obtenerSesionActual();

    expect(sesion).toBeNull();
  });

  it('obtenerSesionActual devuelve los datos cuando sí hay sesión', async () => {
    const { obtenerSesionActual } = await importarFresco();
    fetchMock.mockResolvedValueOnce(
      respuestaJson({
        usuarioId: 'usr-1', rol: 'coordinador', veTodosLosClientes: false, cantidadDeClientesAsignados: 3,
      }),
    );

    const sesion = await obtenerSesionActual();

    expect(sesion?.usuarioId).toBe('usr-1');
    expect(sesion?.rol).toBe('coordinador');
  });

  it('un error que no es 401 sigue propagándose', async () => {
    const { obtenerSesionActual } = await importarFresco();
    fetchMock.mockResolvedValueOnce(
      respuestaJson({ error: 'error_interno', mensaje: 'Algo falló.' }, { status: 500 }),
    );

    await expect(obtenerSesionActual()).rejects.toThrow();
  });

  it('iniciarAcceso manda el token CSRF y el cuerpo correcto', async () => {
    const { iniciarAcceso } = await importarFresco();
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ csrfToken: 'token-1' }))
      .mockResolvedValueOnce(respuestaJson({ segundoFactorRequerido: true, debeCambiarContrasena: false }));

    const resultado = await iniciarAcceso('karina@effort.com.py', 'una-contrasena');

    expect(resultado.segundoFactorRequerido).toBe(true);
    const [, opciones] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(opciones.body).toBe(
      JSON.stringify({ email: 'karina@effort.com.py', contrasena: 'una-contrasena' }),
    );
  });
});
