/**
 * Credenciales propias: alta del segundo factor y cambio de contraseña.
 *
 * Mismo patrón que `Acceso.test.tsx`: el mock de `fetch` responde por
 * (método, ruta) y no por orden de llegada — ver el comentario largo de ese
 * archivo para por qué.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

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

function sinSesionInicial() {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ error: 'sin_sesion', mensaje: 'No hay sesión.' }, { status: 401 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
}

async function montarAcceso() {
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

async function ingresar() {
  await usuario.type(screen.getByLabelText('Correo electrónico'), 'laura@effort.com.py');
  await usuario.type(screen.getByLabelText('Contraseña'), 'una frase larga y memorable');
  await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('alta del segundo factor desde la pantalla de acceso', () => {
  it('muestra la clave para cargar en la aplicación de autenticación', async () => {
    sinSesionInicial();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({
        segundoFactorRequerido: true,
        segundoFactorPorConfigurar: true,
        debeCambiarContrasena: false,
      }),
    );
    mock.mockDeRuta('POST /api/v1/mi/segundo-factor', () =>
      respuestaJson({
        secreto: 'JBSWY3DPEHPK3PXP',
        url: 'otpauth://totp/EFFORT%20Control%20360:laura@effort.com.py?secret=JBSWY3DPEHPK3PXP',
      }),
    );

    await montarAcceso();
    await ingresar();

    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de tu aplicación')).toBeInTheDocument();
  });

  it('un código válido cierra el alta y deja la sesión establecida', async () => {
    sinSesionInicial();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({
        segundoFactorRequerido: true,
        segundoFactorPorConfigurar: true,
        debeCambiarContrasena: false,
      }),
    );
    mock.mockDeRuta('POST /api/v1/mi/segundo-factor', () =>
      respuestaJson({ secreto: 'JBSWY3DPEHPK3PXP', url: 'otpauth://totp/x' }),
    );
    mock.mockDeRuta('POST /api/v1/mi/segundo-factor/confirmar', () =>
      respuestaJson({ segundoFactorActivo: true }),
    );

    await montarAcceso();
    await ingresar();
    await screen.findByLabelText('Código de tu aplicación');

    // Recién ahora hay sesión: el guardia de sesión dejaría de mostrar Acceso.
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({
        usuarioId: 'usr-1', rol: 'direccion', veTodosLosClientes: true,
        cantidadDeClientesAsignados: 0, debeCambiarContrasena: false,
      }),
    );

    await usuario.type(screen.getByLabelText('Código de tu aplicación'), '123456');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar y entrar' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/mi/segundo-factor/confirmar')).toHaveLength(1);
    });
  });

  it('un código rechazado muestra el mensaje del servidor y no avanza', async () => {
    sinSesionInicial();
    mock.mockDeRuta('POST /api/v1/acceso', () =>
      respuestaJson({
        segundoFactorRequerido: true,
        segundoFactorPorConfigurar: true,
        debeCambiarContrasena: false,
      }),
    );
    mock.mockDeRuta('POST /api/v1/mi/segundo-factor', () =>
      respuestaJson({ secreto: 'JBSWY3DPEHPK3PXP', url: 'otpauth://totp/x' }),
    );
    mock.mockDeRuta('POST /api/v1/mi/segundo-factor/confirmar', () =>
      respuestaJson({ error: 'codigo_invalido', mensaje: 'Código incorrecto.' }, { status: 401 }),
    );

    await montarAcceso();
    await ingresar();
    await screen.findByLabelText('Código de tu aplicación');

    await usuario.type(screen.getByLabelText('Código de tu aplicación'), '000000');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar y entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorrecto.');
    expect(screen.getByLabelText('Código de tu aplicación')).toBeInTheDocument();
  });
});

describe('cambio de contraseña obligatorio', () => {
  async function montarAplicacion() {
    vi.resetModules();
    const { Aplicacion } = await import('../src/Aplicacion.js');
    render(<Aplicacion />);
  }

  it('con la contraseña por cambiar se muestra esa pantalla, no el panel', async () => {
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({
        usuarioId: 'usr-1', rol: 'auxiliar', veTodosLosClientes: true,
        cantidadDeClientesAsignados: 0, debeCambiarContrasena: true,
      }),
    );

    await montarAplicacion();

    expect(await screen.findByLabelText('Contraseña actual')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument();
  });

  it('si las dos contraseñas nuevas no coinciden, ni siquiera llama al servidor', async () => {
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({
        usuarioId: 'usr-1', rol: 'auxiliar', veTodosLosClientes: true,
        cantidadDeClientesAsignados: 0, debeCambiarContrasena: true,
      }),
    );

    await montarAplicacion();
    await screen.findByLabelText('Contraseña actual');

    await usuario.type(screen.getByLabelText('Contraseña actual'), 'la de siempre');
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'una frase nueva y larga');
    await usuario.type(screen.getByLabelText('Repetí la contraseña nueva'), 'otra cosa distinta');
    await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    expect(mock.llamadasA('POST /api/v1/mi/contrasena')).toHaveLength(0);
  });

  it('al cambiarla avisa que se cerraron todas las sesiones', async () => {
    mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
    mock.mockDeRuta('GET /api/v1/yo', () =>
      respuestaJson({
        usuarioId: 'usr-1', rol: 'auxiliar', veTodosLosClientes: true,
        cantidadDeClientesAsignados: 0, debeCambiarContrasena: true,
      }),
    );
    mock.mockDeRuta('POST /api/v1/mi/contrasena', () =>
      respuestaJson({ contrasenaCambiada: true, sesionCerrada: true }),
    );

    await montarAplicacion();
    await screen.findByLabelText('Contraseña actual');

    await usuario.type(screen.getByLabelText('Contraseña actual'), 'la de siempre');
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'una frase nueva y larga');
    await usuario.type(screen.getByLabelText('Repetí la contraseña nueva'), 'una frase nueva y larga');
    await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument();
  });
});
