/**
 * Pantalla de Reglas (tarea 104, pantalla 10 de 12).
 *
 * Dos tableros con RBAC distinto en el mismo `Recurso`: `regla_impositiva`
 * solo la edita `direccion`; `regla_notificacion` la crea `direccion`, la
 * edita también `responsable`, y ni siquiera aparece para `auxiliar` /
 * `revisor_balance` / `solo_lectura` en la matriz — por eso el mock de
 * `GET /api/v1/reglas-notificacion` da 403 para esos roles, cubierto acá
 * porque el tablero de impositivas tiene que seguir andando igual.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

const GARSO = {
  id: 'cli-garso',
  nombre: 'GARSO S.A.',
  ruc: '80017726-6',
  tipoPersona: 'JURIDICA',
  regimenTributario: null,
  email: null,
  telefono: null,
  canalPreferido: 'WHATSAPP',
  carpetaOneDriveId: null,
  activo: true,
  observaciones: null,
};

const REGLA_IVA_DIEZ = {
  id: 'regla-iva-10',
  nombre: 'IVA General 10%',
  tasa: 'DIEZ',
  divisorIvaIncluido: 11,
  vigenteDesde: '2024-01-01',
  vigenteHasta: null,
  requiereConfirmacionCliente: true,
  fuente: 'Ley 125/91, Art. 91',
};

const REGLA_NOTIF = {
  id: 'regla-notif-1',
  nombre: 'Recordatorio de documentación',
  activa: true,
  evento: 'DOCUMENTACION_NO_ENTREGADA',
  diasHabilesDePlazo: 3,
  horaDeEnvio: '09:00',
  reintentarCadaDiasHabiles: 2,
  maximoRecordatorios: 3,
  escalarAPartirDelRecordatorio: 2,
  destinatariosIniciales: [{ tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null }],
  destinatariosDeEscalamiento: [],
  clientesAlcanzados: [],
  plantillaId: null,
};

const ROLES_CON_ACCESO_A_NOTIFICACION = new Set(['direccion', 'responsable', 'coordinador']);

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

async function montar(rol: string = 'direccion') {
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId: 'u1', rol, veTodosLosClientes: true, cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes: [GARSO] }));
  mock.mockDeRuta('GET /api/v1/reglas-impositivas', () => respuestaJson({ reglas: [REGLA_IVA_DIEZ] }));

  if (ROLES_CON_ACCESO_A_NOTIFICACION.has(rol)) {
    mock.mockDeRuta('GET /api/v1/reglas-notificacion', () => respuestaJson({ reglas: [REGLA_NOTIF] }));
  } else {
    mock.mockDeRuta('GET /api/v1/reglas-notificacion', () =>
      respuestaJson({ error: 'no_autorizado', mensaje: 'No tenés permiso para realizar esta acción.' }, { status: 403 }),
    );
  }

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Reglas = (await import('../src/pantallas/Reglas.js')).default;

  render(
    <ProveedorDeSesion>
      <Reglas />
    </ProveedorDeSesion>,
  );

  await screen.findByText('IVA General 10%');
  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

describe('pantalla de reglas', () => {
  it('muestra ambos tableros con los datos del servidor', async () => {
    await montar();

    expect(screen.getByText('IVA General 10%')).toBeVisible();
    expect(screen.getByText('Ley 125/91, Art. 91')).toBeVisible();
    expect(await screen.findByText('Recordatorio de documentación')).toBeVisible();
    expect(screen.getByText('Documentación no entregada')).toBeVisible();
  });

  it('un rol sin acceso a reglas de notificación ve ese tablero con el mensaje del servidor, sin que rompa el de impositivas', async () => {
    await montar('auxiliar');

    expect(screen.getByText('IVA General 10%')).toBeVisible();
    expect(await screen.findByText('No tenés permiso para realizar esta acción.')).toBeVisible();
    expect(screen.queryByText('Recordatorio de documentación')).not.toBeInTheDocument();
  });

  it('coordinador ve las dos tablas pero no puede editar ninguna', async () => {
    await montar('coordinador');
    await screen.findByText('Recordatorio de documentación');

    expect(screen.queryByRole('button', { name: 'Nueva tasa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar IVA General/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva regla' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar Recordatorio/ })).not.toBeInTheDocument();
  });

  it('responsable puede editar reglas de notificación pero no darlas de alta, y no toca reglas impositivas', async () => {
    await montar('responsable');
    await screen.findByText('Recordatorio de documentación');

    expect(screen.queryByRole('button', { name: 'Nueva tasa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar IVA General/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva regla' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar Recordatorio/ })).toBeVisible();
  });

  it('dirección da de alta una regla impositiva nueva', async () => {
    await montar();

    await usuario.click(screen.getByRole('button', { name: 'Nueva tasa' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'IVA General 5%');
    await usuario.selectOptions(screen.getByLabelText('Tasa'), 'CINCO');
    await usuario.clear(screen.getByLabelText('Divisor de IVA incluido'));
    await usuario.type(screen.getByLabelText('Divisor de IVA incluido'), '21');
    await usuario.type(screen.getByLabelText('Vigente desde'), '2026-01-01');
    await usuario.type(screen.getByLabelText('Fuente'), 'Ley 125/91, Art. 91, canasta básica');

    mock.mockDeRuta('POST /api/v1/reglas-impositivas', () =>
      respuestaJson({ regla: { ...REGLA_IVA_DIEZ, id: 'regla-iva-5', nombre: 'IVA General 5%', tasa: 'CINCO' } }, { status: 201 }),
    );
    mock.mockDeRuta('GET /api/v1/reglas-impositivas', () =>
      respuestaJson({ reglas: [REGLA_IVA_DIEZ, { ...REGLA_IVA_DIEZ, id: 'regla-iva-5', nombre: 'IVA General 5%', tasa: 'CINCO' }] }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear regla' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/reglas-impositivas')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/reglas-impositivas')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo).toEqual({
      nombre: 'IVA General 5%',
      tasa: 'CINCO',
      divisorIvaIncluido: 21,
      vigenteDesde: '2026-01-01',
      fuente: 'Ley 125/91, Art. 91, canasta básica',
    });

    expect(await screen.findByText('IVA General 5%')).toBeVisible();
  });

  it('editar una regla impositiva no permite tocar la tasa ya vigente', async () => {
    await montar();

    await usuario.click(screen.getByRole('button', { name: 'Editar IVA General 10%' }));

    expect(screen.getByLabelText('Tasa')).toBeDisabled();
    expect(screen.getByLabelText('Tasa')).toHaveValue('10%');
    expect(screen.queryByLabelText('Divisor de IVA incluido')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Requiere confirmación del cliente')).toBeChecked();

    mock.mockDeRuta('PATCH /api/v1/reglas-impositivas/regla-iva-10', () =>
      respuestaJson({ regla: { ...REGLA_IVA_DIEZ, vigenteHasta: '2026-12-31' } }),
    );

    await usuario.type(screen.getByLabelText('Vigente hasta'), '2026-12-31');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mock.llamadasA('PATCH /api/v1/reglas-impositivas/regla-iva-10')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('PATCH /api/v1/reglas-impositivas/regla-iva-10')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.tasa).toBeUndefined();
    expect(cuerpo.divisorIvaIncluido).toBeUndefined();
    expect(cuerpo.vigenteHasta).toBe('2026-12-31');
  });

  it('dirección da de alta una regla de notificación con cartera acotada', async () => {
    await montar();
    await screen.findByText('Recordatorio de documentación');

    await usuario.click(screen.getByRole('button', { name: 'Nueva regla' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Aviso de vencimiento próximo');
    await usuario.click(screen.getByLabelText('GARSO S.A.'));

    mock.mockDeRuta('POST /api/v1/reglas-notificacion', () =>
      respuestaJson(
        { regla: { ...REGLA_NOTIF, id: 'regla-notif-2', nombre: 'Aviso de vencimiento próximo', clientesAlcanzados: ['cli-garso'] } },
        { status: 201 },
      ),
    );
    mock.mockDeRuta('GET /api/v1/reglas-notificacion', () =>
      respuestaJson({
        reglas: [REGLA_NOTIF, { ...REGLA_NOTIF, id: 'regla-notif-2', nombre: 'Aviso de vencimiento próximo', clientesAlcanzados: ['cli-garso'] }],
      }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Crear regla' }));

    await waitFor(() => {
      expect(mock.llamadasA('POST /api/v1/reglas-notificacion')).toHaveLength(1);
    });
    const [, opciones] = mock.llamadasA('POST /api/v1/reglas-notificacion')[0]!;
    const cuerpo = JSON.parse(String(opciones?.body));
    expect(cuerpo.nombre).toBe('Aviso de vencimiento próximo');
    expect(cuerpo.clientesAlcanzados).toEqual(['cli-garso']);
    expect(cuerpo.destinatariosIniciales).toEqual([{ tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null }]);

    expect(await screen.findByText('Aviso de vencimiento próximo')).toBeVisible();
  });

  it('el editor de destinatarios agrega y quita filas', async () => {
    await montar();
    await screen.findByText('Recordatorio de documentación');

    await usuario.click(screen.getByRole('button', { name: 'Nueva regla' }));

    expect(screen.getAllByLabelText(/Destinatarios iniciales — tipo/)).toHaveLength(1);

    // Dos editores en la misma pantalla (iniciales y escalamiento): el de
    // iniciales se dibuja primero.
    const [agregarIniciales] = screen.getAllByRole('button', { name: 'Agregar destinatario' });
    await usuario.click(agregarIniciales!);

    expect(screen.getAllByLabelText(/Destinatarios iniciales — tipo/)).toHaveLength(2);

    const segundoTipo = screen.getByLabelText('Destinatarios iniciales — tipo 2');
    await usuario.selectOptions(segundoTipo, 'CORREO_LIBRE');
    await usuario.type(screen.getByLabelText('Destinatarios iniciales — valor 2'), 'contacto@garso.com.py');

    await usuario.click(screen.getByRole('button', { name: 'Quitar destinatario 1 de Destinatarios iniciales' }));

    expect(screen.getAllByLabelText(/Destinatarios iniciales — tipo/)).toHaveLength(1);
    expect(screen.getByLabelText('Destinatarios iniciales — valor 1')).toHaveValue('contacto@garso.com.py');
  });

  it('cancelar cierra el formulario sin llamar al servidor', async () => {
    await montar();

    await usuario.click(screen.getByRole('button', { name: 'Nueva tasa' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Vigente desde')).not.toBeInTheDocument();
    expect(mock.llamadasA('POST /api/v1/reglas-impositivas')).toHaveLength(0);
  });
});
