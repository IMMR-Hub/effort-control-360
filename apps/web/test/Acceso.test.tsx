/**
 * Pantalla de acceso en dos pasos (tarea 102).
 *
 * El mock de `fetch` responde **por ruta**, no por orden de llegada. Con una
 * cola global (`mockResolvedValueOnce` encadenado) alcanza con que una sola
 * promesa de un test se resuelva un instante tarde para que "robe" la
 * respuesta que le tocaba al test siguiente — corriendo la cola para todo lo
 * que viene después, con fallas que no tienen nada que ver con el test que
 * las muestra. Enrutar por `(método, ruta)` hace que una llamada tardía a
 * `/api/v1/yo` de un test anterior siga yendo a la respuesta de `/api/v1/yo`,
 * nunca a la de otra ruta — el mismo patrón sirve para las 12 pantallas de la
 * tarea 103, así que vale la pena resolverlo bien acá una sola vez.
 *
 * `<ProveedorDeSesion>` pide la sesión actual apenas se monta (para saber si
 * ya hay una sesión activa) — por eso `montarConMockDeSesionVacia()` deja
 * `/api/v1/yo` respondiendo 401 antes de la interacción real, y los tests que
 * necesitan otra cosa la pisan con `mockDeRuta(...)` después.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function respuestaJson(cuerpo: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

type ClaveRuta = 'GET /api/v1/csrf' | 'POST /api/v1/acceso' | 'POST /api/v1/acceso/segundo-factor' | 'GET /api/v1/yo';

/** Enruta cada llamada de `fetch` por `(método, ruta)`, no por orden de llegada. */
function crearFetchMock() {
  const manejadores = new Map<ClaveRuta, () => Response>();

  const fetchMock = vi.fn((entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const ruta = new URL(String(entrada)).pathname;
    const metodo = (opciones?.method ?? 'GET').toUpperCase();
    const clave = `${metodo} ${ruta}` as ClaveRuta;
    const manejador = manejadores.get(clave);
    if (!manejador) {
      throw new Error(`Ruta no mockeada en este test: ${clave}`);
    }
    return Promise.resolve(manejador());
  });

  return {
    fetchMock,
    /** Reemplaza la respuesta de una ruta. Se puede llamar de nuevo para cambiarla a mitad de un test. */
    mockDeRuta(clave: ClaveRuta, fabrica: () => Response) {
      manejadores.set(clave, fabrica);
    },
    llamadasA(clave: ClaveRuta) {
      return fetchMock.mock.calls.filter(([entrada, opciones]) => {
        const ruta = new URL(String(entrada)).pathname;
        const metodo = String((opciones as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        return `${metodo} ${ruta}` === clave;
      });
    },
  };
}

let mock: ReturnType<typeof crearFetchMock>;
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  mock = crearFetchMock();
  vi.stubGlobal('fetch', mock.fetchMock);
  usuario = userEvent.setup();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function montarConMockDeSesionVacia() {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ error: 'sin_sesion', mensaje: 'No hay sesión.' }, { status: 401 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const { Acceso } = await import('../src/pantallas/Acceso.js');

  render(
    <ProveedorDeSesion>
      <Acceso />
    </ProveedorDeSesion>,
  );

  await screen.findByLabelText('Correo electrónico');
}

describe('pantalla de acceso', () => {
  it('si la comprobación de sesión inicial falla por red, muestra igual el login (no se queda cargando)', async () => {
    // Regresión: <ProveedorDeSesion> no capturaba el rechazo de
    // obtenerSesionActual() en su useEffect inicial. Un fallo de red al
    // cargar la página (el servidor caído, sin conexión) dejaba `sesion` en
    // `undefined` para siempre, y la pantalla mostraba "Cargando…" sin salida.
    vi.resetModules();
    const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
    const { Acceso } = await import('../src/pantallas/Acceso.js');

    mock.mockDeRuta('GET /api/v1/yo', () => {
      throw new TypeError('Failed to fetch');
    });

    render(
      <ProveedorDeSesion>
        <Acceso />
      </ProveedorDeSesion>,
    );

    expect(await screen.findByLabelText('Correo electrónico')).toBeVisible();
  });

  it('con un rol sin segundo factor, entra en un solo paso', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ segundoFactorRequerido: false, debeCambiarContrasena: false }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'aracely@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-contrasena-larga');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    // Tras el login exitoso, <SesionContext> vuelve a pedir /api/v1/yo para
    // confirmar la sesión — ahora sí tiene que devolver una sesión real, no
    // el 401 inicial. Se pisa la respuesta y se espera a que se use.
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({ usuarioId: 'u1', rol: 'auxiliar', veTodosLosClientes: false, cantidadDeClientesAsignados: 2 }),
    );

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/acceso')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/acceso')[0]!;
    expect(JSON.parse(String(opciones?.body))).toEqual({
      email: 'aracely@effort.com.py',
      contrasena: 'una-contrasena-larga',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con un rol que exige segundo factor, muestra el paso 2', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ segundoFactorRequerido: true, debeCambiarContrasena: false }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'karina@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-contrasena-larga');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByLabelText('Código de verificación')).toBeVisible();
    // El paso 1 no queda montado atrás: no hay dos formularios compitiendo.
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });

  it('completa el segundo factor y confirma la sesión', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ segundoFactorRequerido: true, debeCambiarContrasena: false }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'karina@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-contrasena-larga');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    await screen.findByLabelText('Código de verificación');

    mock.mockDeRuta('POST /api/v1/acceso/segundo-factor', () => respuestaJson({ acceso: 'concedido' }));
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({ usuarioId: 'u2', rol: 'direccion', veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
    );

    await usuario.type(screen.getByLabelText('Código de verificación'), '123456');
    await usuario.click(screen.getByRole('button', { name: 'Verificar' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/acceso/segundo-factor')).toHaveLength(1);
    });
  });

  it('credenciales inválidas: muestra el mensaje del servidor tal cual', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ error: 'credenciales_invalidas', mensaje: 'Correo o contraseña incorrectos.' }, { status: 401 }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'nadie@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'lo-que-sea');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    // Sigue en el paso 1: un error de credenciales no avanza al 2FA.
    expect(screen.getByLabelText('Contraseña')).toBeVisible();
  });

  it('demasiados intentos: muestra el mensaje con los segundos de espera', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson(
        { error: 'demasiados_intentos', mensaje: 'Demasiados intentos fallidos. Probá de nuevo en 30 segundos.' },
        { status: 429 },
      ),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'aracely@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'lo-que-sea');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('30 segundos');
  });

  it('segundo factor no configurado: se ve el motivo, no un error genérico', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson(
        { error: 'segundo_factor_no_configurado', mensaje: 'Tu rol requiere segundo factor. Configuralo antes de acceder.' },
        { status: 403 },
      ),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'karina@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'lo-que-sea');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Configuralo antes de acceder');
  });

  it('código de 2FA incorrecto: muestra el error y deja reintentar en el mismo paso', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ segundoFactorRequerido: true, debeCambiarContrasena: false }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'karina@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-contrasena-larga');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    await screen.findByLabelText('Código de verificación');

    mock.mockDeRuta('POST /api/v1/acceso/segundo-factor', () =>
      respuestaJson({ error: 'codigo_invalido', mensaje: 'Código incorrecto.' }, { status: 401 }),
    );

    await usuario.type(screen.getByLabelText('Código de verificación'), '000000');
    await usuario.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorrecto.');
    expect(screen.getByLabelText('Código de verificación')).toBeVisible();
  });

  it('si la sesión intermedia venció, vuelve al paso 1 con un mensaje claro', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ segundoFactorRequerido: true, debeCambiarContrasena: false }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'karina@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-contrasena-larga');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    await screen.findByLabelText('Código de verificación');

    mock.mockDeRuta('POST /api/v1/acceso/segundo-factor', () =>
      respuestaJson({ error: 'sin_sesion', mensaje: 'No hay un acceso en curso.' }, { status: 401 }),
    );

    await usuario.type(screen.getByLabelText('Código de verificación'), '123456');
    await usuario.click(screen.getByRole('button', { name: 'Verificar' }));

    await screen.findByLabelText('Contraseña');
    expect(screen.queryByLabelText('Código de verificación')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('venció');
  });

  it('el botón "Volver" del paso 2 regresa al paso 1 sin llamar al servidor', async () => {
    await montarConMockDeSesionVacia();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ segundoFactorRequerido: true, debeCambiarContrasena: false }),
    );

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'karina@effort.com.py');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-contrasena-larga');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    await screen.findByLabelText('Código de verificación');

    const llamadasAntes = mock.fetchMock.mock.calls.length;
    await usuario.click(screen.getByRole('button', { name: 'Volver' }));

    expect(await screen.findByLabelText('Contraseña')).toBeVisible();
    expect(mock.fetchMock.mock.calls.length).toBe(llamadasAntes);
  });

  it('accesibilidad: cada campo tiene su rótulo asociado y el error se anuncia', async () => {
    await montarConMockDeSesionVacia();
    const campoEmail = screen.getByLabelText('Correo electrónico');
    const campoContrasena = screen.getByLabelText('Contraseña');

    expect(campoEmail).toHaveAttribute('id');
    expect(campoContrasena).toHaveAttribute('id');
    expect(campoContrasena).toHaveAttribute('type', 'password');

    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({ error: 'credenciales_invalidas', mensaje: 'Correo o contraseña incorrectos.' }, { status: 401 }),
    );
    await usuario.type(campoEmail, 'nadie@effort.com.py');
    await usuario.type(campoContrasena, 'lo-que-sea');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('Correo o contraseña incorrectos.')).toBeVisible();
  });
});
