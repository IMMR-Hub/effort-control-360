/**
 * Seguimiento: pestañas «Pendientes» y «Equipo» (pedidos del equipo, 2026-11-27).
 *
 * El orden de la bandeja y el «vencido» son de `@effort/core` y tienen sus
 * propios tests; acá se prueba lo que hace la pantalla con eso: respeta el orden
 * del servidor, marca el vencido, manda la acción correcta a la API y no le
 * muestra ningún botón de escritura a quien no es de dirección (regla 12).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fechaCivilAIso, hoyEnParaguay } from '@effort/core';

import { crearFetchMock, respuestaJson } from './ayuda-fetch-mock.js';

/** 'AAAA-MM-DD' de hoy en Paraguay más `dias`. */
function diaDesdeHoy(dias: number): string {
  const hoy = hoyEnParaguay(new Date());
  const fecha = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + dias));
  return fechaCivilAIso({ anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate() });
}

function unUsuario(id: string, nombre: string, apellido: string, rol: string) {
  return {
    id,
    nombre,
    apellido,
    email: `${nombre.toLowerCase()}@effort.com.py`,
    telefono: null,
    cargo: null,
    rol,
    activo: true,
    veTodosLosClientes: rol === 'direccion',
    ultimoAccesoEn: null,
  };
}

const LAURA = unUsuario('u-laura', 'Laura', 'Pérez', 'direccion');
const LILI = unUsuario('u-lili', 'Lili', 'Benítez', 'direccion');
const ANA = unUsuario('u-ana', 'Ana', 'Gómez', 'responsable');
const BEA = unUsuario('u-bea', 'Bea', 'Ríos', 'responsable');

function unPedido(datos: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    solicitanteUsuarioId: 'u-ana',
    destinatarioUsuarioIds: ['u-laura'],
    clienteId: null,
    clienteNombre: null,
    asunto: 'No me aparece el cliente nuevo',
    prioridad: 'MEDIA',
    estado: 'ABIERTO',
    recordarEl: null,
    motivoDeCancelacion: null,
    derivadoASoporte: false,
    derivadoASoporteEn: null,
    creadoEn: '2026-11-20T12:00:00.000Z',
    actualizadoEn: '2026-11-20T12:00:00.000Z',
    solicitanteNombre: 'Ana Gómez',
    destinatarioNombres: ['Laura Pérez'],
    ...datos,
  };
}

function unMensaje(datos: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    pedidoId: 'p1',
    autorUsuarioId: 'u-ana',
    canal: 'WHATSAPP',
    ocurridoEn: '2026-11-20T12:00:00.000Z',
    texto: 'Cargué el cliente ayer y no aparece en la lista.',
    notaInterna: false,
    registradoPorUsuarioId: 'u-laura',
    corregidoPorId: null,
    creadoEn: '2026-11-20T12:00:00.000Z',
    autorNombre: 'Ana Gómez',
    ...datos,
  };
}

function unItem(datos: Record<string, unknown> = {}) {
  return {
    tipo: 'EQUIPO',
    id: 'p1',
    prioridad: 'MEDIA',
    recordarEl: null,
    creadoEn: '2026-11-20T12:00:00.000Z',
    estado: 'ABIERTO',
    titulo: 'No me aparece el cliente nuevo',
    deQuien: 'Ana Gómez',
    clienteId: null,
    periodo: null,
    solicitanteUsuarioId: 'u-ana',
    derivadoASoporte: false,
    ...datos,
  };
}

/** Una solicitud de documentación a un cliente, como fila de la bandeja. */
function unaSolicitud(id: string, clienteId: string, deQuien: string, periodo = '2026-11') {
  return unItem({
    tipo: 'CLIENTE',
    id,
    estado: 'ABIERTA',
    titulo: `Documentación ${periodo} de ${deQuien}`,
    deQuien,
    clienteId,
    periodo,
    solicitanteUsuarioId: null,
  });
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

function bandeja(items: readonly unknown[]) {
  const lista = items as readonly { prioridad: string; recordarEl: string | null }[];
  return respuestaJson({
    items,
    resumen: {
      total: lista.length,
      criticos: lista.filter((i) => i.prioridad === 'CRITICA').length,
      vencidos: lista.filter((i) => i.recordarEl !== null && i.recordarEl <= diaDesdeHoy(0)).length,
    },
  });
}

async function montar({
  rol = 'direccion',
  pestana,
  clientes = [],
}: { rol?: string; pestana?: 'pendientes' | 'clientes' | 'equipo'; clientes?: readonly unknown[] } = {}) {
  const usuarioId = rol === 'direccion' ? 'u-laura' : 'u-ana';
  mock.mockDeRuta('GET /api/v1/yo', () =>
    respuestaJson({ usuarioId, rol, veTodosLosClientes: rol === 'direccion', cantidadDeClientesAsignados: 0 }),
  );
  mock.mockDeRuta('GET /api/v1/csrf', () => respuestaJson({ csrfToken: 'token-de-prueba' }));
  mock.mockDeRuta('GET /api/v1/usuarios', () => respuestaJson({ usuarios: [LAURA, LILI, ANA, BEA] }));
  mock.mockDeRuta('GET /api/v1/clientes', () => respuestaJson({ clientes }));

  vi.resetModules();
  const { ProveedorDeSesion } = await import('../src/contexts/SesionContext.js');
  const Seguimiento = (await import('../src/pantallas/Seguimiento.js')).default;

  render(
    <ProveedorDeSesion>
      {pestana ? <Seguimiento pestanaInicial={pestana} /> : <Seguimiento />}
    </ProveedorDeSesion>,
  );

  await waitFor(() => {
    expect(mock.llamadasA('GET /api/v1/yo')).toHaveLength(1);
  });
}

/** El cuerpo JSON de la `n`-ésima llamada a una ruta. */
function cuerpoDe(clave: `${string} ${string}`, n = 0): unknown {
  const llamada = mock.llamadasA(clave)[n];
  return JSON.parse(String((llamada?.[1] as RequestInit | undefined)?.body));
}

const filaDe = (texto: string) => screen.getByText(texto).closest('tr')!;

describe('pestaña Pendientes', () => {
  it('abre en Pendientes y muestra primero lo crítico', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([
        unItem({ id: 'p9', prioridad: 'CRITICA', titulo: 'Consulta urgente de IVA' }),
        unItem({
          tipo: 'CLIENTE',
          id: 'sol-1',
          prioridad: 'MEDIA',
          estado: 'ABIERTA',
          titulo: 'Documentación 2026-11',
          deQuien: 'GARSO S.A.',
          clienteId: 'cli-garso',
          periodo: '2026-11',
        }),
        unItem({ id: 'p1', prioridad: 'BAJA' }),
      ]),
    );
    await montar();

    expect(screen.getByRole('tab', { name: 'Pendientes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Clientes' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Equipo' })).toHaveAttribute('aria-selected', 'false');

    const tabla = await screen.findByRole('table', { name: 'Pendientes de seguimiento' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(3);
    // El orden es el del servidor: no se reordena en la pantalla.
    expect(filas[0]).toHaveTextContent('Crítica');
    expect(filas[0]).toHaveTextContent('Consulta urgente de IVA');
    expect(filas[0]).toHaveTextContent('Equipo');
    expect(filas[1]).toHaveTextContent('Cliente');
    expect(filas[1]).toHaveTextContent('GARSO S.A.');
    expect(filas[1]).toHaveTextContent('Sin entregar');
    expect(filas[2]).toHaveTextContent('Baja');
    expect(screen.getByText(/3 abiertos · 1 crítico · 0 con recordatorio vencido/)).toBeVisible();
  });

  it('un recordatorio vencido se ve marcado como «Vencido»', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([
        unItem({ id: 'p1', titulo: 'Llamar a Ana', recordarEl: diaDesdeHoy(-1) }),
        unItem({ id: 'p2', titulo: 'Revisar planilla', recordarEl: diaDesdeHoy(1) }),
        unItem({ id: 'p3', titulo: 'Avisar hoy', recordarEl: diaDesdeHoy(0) }),
      ]),
    );
    await montar();
    await screen.findByText('Llamar a Ana');

    expect(filaDe('Llamar a Ana')).toHaveClass('bg-critico-fondo');
    expect(within(filaDe('Llamar a Ana')).getByText('Vencido')).toBeVisible();
    // Hoy también cuenta como vencido (el recordatorio es para hoy).
    expect(filaDe('Avisar hoy')).toHaveClass('bg-critico-fondo');
    expect(within(filaDe('Avisar hoy')).getByText('Vencido')).toBeVisible();
    // Mañana todavía no.
    expect(filaDe('Revisar planilla')).not.toHaveClass('bg-critico-fondo');
    expect(within(filaDe('Revisar planilla')).queryByText('Vencido')).not.toBeInTheDocument();
    expect(within(filaDe('Revisar planilla')).getByText(diaDesdeHoy(1).split('-').reverse().join('/'))).toBeVisible();
  });

  it('tildar manda {accion:"tildar"} y el pedido sale de Pendientes', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () => bandeja([unItem()]));
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido({ estado: 'RESUELTO' }) }),
    );
    await montar();
    await screen.findByText('No me aparece el cliente nuevo');

    // Lo que devuelva el servidor después del cambio ya no lo trae.
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () => bandeja([]));
    await usuario.click(within(filaDe('No me aparece el cliente nuevo')).getByRole('button', { name: 'Tildar' }));

    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({ accion: 'tildar' });
    await waitFor(() => expect(screen.queryByText('No me aparece el cliente nuevo')).not.toBeInTheDocument());
    expect(screen.getByText('No hay pendientes abiertos.')).toBeVisible();
  });

  it('cancelar pide motivo y no deja confirmar vacío', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () => bandeja([unItem()]));
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido({ estado: 'CANCELADO', motivoDeCancelacion: 'Ya no hace falta' }) }),
    );
    await montar();
    await screen.findByText('No me aparece el cliente nuevo');

    await usuario.click(within(filaDe('No me aparece el cliente nuevo')).getByRole('button', { name: 'Cancelar' }));

    const confirmar = screen.getByRole('button', { name: 'Confirmar cancelación' });
    expect(confirmar).toBeDisabled();
    await usuario.type(screen.getByLabelText('Motivo de la cancelación'), '   ');
    expect(confirmar).toBeDisabled();
    await usuario.click(confirmar);
    expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(0);

    await usuario.type(screen.getByLabelText('Motivo de la cancelación'), 'Ya no hace falta ');
    expect(confirmar).toBeEnabled();
    await usuario.click(confirmar);

    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({
      accion: 'cancelar',
      motivo: 'Ya no hace falta',
    });
  });

  it('reagendar «Mañana» manda la fecha de mañana en Paraguay; en una solicitud va a su propia ruta', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([
        unItem(),
        unItem({
          tipo: 'CLIENTE',
          id: 'sol-1',
          estado: 'ABIERTA',
          titulo: 'Documentación 2026-11',
          deQuien: 'GARSO S.A.',
          clienteId: 'cli-garso',
          periodo: '2026-11',
        }),
      ]),
    );
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () => respuestaJson({ pedido: unPedido() }));
    mock.mockDeRuta('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad', () => respuestaJson({ solicitud: {} }));
    await montar();
    await screen.findByText('No me aparece el cliente nuevo');

    const filaDelPedido = filaDe('No me aparece el cliente nuevo');
    await usuario.click(within(filaDelPedido).getByRole('button', { name: 'Reagendar' }));
    for (const opcion of ['Mañana', 'En 3 días', 'Próxima semana', 'Elegir fecha']) {
      expect(within(filaDelPedido).getByRole('button', { name: opcion })).toBeVisible();
    }
    await usuario.click(within(filaDelPedido).getByRole('button', { name: 'Mañana' }));
    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({
      accion: 'reagendar',
      recordarEl: diaDesdeHoy(1),
    });

    const filaDeLaSolicitud = filaDe('Documentación 2026-11');
    // A una solicitud de cliente solo se le reagenda o se la cierra.
    expect(within(filaDeLaSolicitud).queryByRole('button', { name: 'Tildar' })).not.toBeInTheDocument();
    expect(within(filaDeLaSolicitud).getByRole('button', { name: 'Cerrar' })).toBeVisible();
    await usuario.click(within(filaDeLaSolicitud).getByRole('button', { name: 'Reagendar' }));
    await usuario.click(within(filaDeLaSolicitud).getByRole('button', { name: 'En 3 días' }));
    await waitFor(() =>
      expect(mock.llamadasA('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad')).toHaveLength(1),
    );
    expect(cuerpoDe('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad')).toEqual({
      recordarEl: diaDesdeHoy(3),
    });
  });

  it('dirección filtra por colaborador: sus pedidos por solicitante y las solicitudes por su cartera', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([
        unItem({ id: 'p1', titulo: 'Pedido de Ana' }),
        unItem({ id: 'p2', titulo: 'Pedido de Bea', deQuien: 'Bea Ríos', solicitanteUsuarioId: 'u-bea' }),
        unaSolicitud('sol-garso', 'cli-garso', 'GARSO S.A.'),
        unaSolicitud('sol-otro', 'cli-otro', 'OTRO S.A.'),
      ]),
    );
    mock.mockDeRuta('GET /api/v1/usuarios/u-ana/clientes', () => respuestaJson({ clienteIds: ['cli-garso'] }));
    await montar();
    await screen.findByText('Pedido de Ana');

    await usuario.selectOptions(await screen.findByLabelText('Colaborador'), 'u-ana');

    await waitFor(() => expect(screen.getByText('Documentación 2026-11 de GARSO S.A.')).toBeVisible());
    expect(screen.getByText('Pedido de Ana')).toBeVisible();
    expect(screen.queryByText('Pedido de Bea')).not.toBeInTheDocument();
    expect(screen.queryByText('Documentación 2026-11 de OTRO S.A.')).not.toBeInTheDocument();
    expect(screen.getByText(/con estos filtros se ven 2 · colaborador: Ana Gómez/)).toBeVisible();

    await usuario.selectOptions(screen.getByLabelText('Colaborador'), '');
    expect(screen.getByText('Pedido de Bea')).toBeVisible();
    expect(screen.getByText('Documentación 2026-11 de OTRO S.A.')).toBeVisible();
  });

  it('se filtra por tipo y por prioridad, sin cambiar el orden', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([
        unItem({ id: 'p9', prioridad: 'CRITICA', titulo: 'Urgente' }),
        unaSolicitud('sol-garso', 'cli-garso', 'GARSO S.A.'),
        unItem({ id: 'p1', prioridad: 'BAJA', titulo: 'Cuando se pueda' }),
      ]),
    );
    await montar();
    const tabla = await screen.findByRole('table', { name: 'Pendientes de seguimiento' });

    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'EQUIPO');
    let filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas.map((f) => within(f).getAllByRole('cell')[3]!.textContent)).toEqual(['Urgente', 'Cuando se pueda']);

    await usuario.selectOptions(screen.getByLabelText('Prioridad'), 'BAJA');
    filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas.map((f) => within(f).getAllByRole('cell')[3]!.textContent)).toEqual(['Cuando se pueda']);

    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'CLIENTE');
    expect(screen.getByText('Ningún pendiente con estos filtros.')).toBeVisible();
  });

  it('el error del servidor se muestra con su mensaje', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () => bandeja([unItem()]));
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson(
        { error: 'transicion_invalida', mensaje: 'No se puede hacer «tildar» con un pedido CANCELADO.' },
        { status: 409 },
      ),
    );
    await montar();
    await screen.findByText('No me aparece el cliente nuevo');

    await usuario.click(within(filaDe('No me aparece el cliente nuevo')).getByRole('button', { name: 'Tildar' }));

    expect(await screen.findByText('No se puede hacer «tildar» con un pedido CANCELADO.')).toBeVisible();
  });
});

describe('pestaña Equipo', () => {
  it('dirección crea un pedido desde «Nuevo pedido» y aparece en la lista', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [] }));
    await montar({ pestana: 'equipo' });
    expect(await screen.findByText('No hay pedidos abiertos')).toBeVisible();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo pedido' }));
    await usuario.selectOptions(await screen.findByLabelText('De'), 'u-ana');
    // «Para» trae marcada a la persona de dirección que lo está cargando.
    const para = screen.getByRole('group', { name: 'Para' });
    expect(within(para).getByLabelText('Laura Pérez')).toBeChecked();
    expect(within(para).getByLabelText('Lili Benítez')).not.toBeChecked();
    // Un colaborador no es destinatario posible.
    expect(within(para).queryByLabelText('Ana Gómez')).not.toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText('Vía'), 'WHATSAPP');
    expect(screen.getByLabelText('Prioridad')).toHaveValue('MEDIA');
    await usuario.type(screen.getByLabelText('Asunto'), 'No me aparece el cliente nuevo');
    await usuario.type(screen.getByLabelText('Texto del pedido'), 'Cargué el cliente ayer y no aparece.');

    const creado = unPedido();
    mock.mockDeRuta('POST /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedido: creado }, { status: 201 }));
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [creado] }));
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: creado, mensajes: [unMensaje()] }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Guardar pedido' }));

    await waitFor(() => expect(mock.llamadasA('POST /api/v1/seguimiento/pedidos-equipo')).toHaveLength(1));
    expect(cuerpoDe('POST /api/v1/seguimiento/pedidos-equipo')).toEqual({
      solicitanteUsuarioId: 'u-ana',
      destinatarioUsuarioIds: ['u-laura'],
      clienteId: null,
      asunto: 'No me aparece el cliente nuevo',
      prioridad: 'MEDIA',
      recordarEl: null,
      canal: 'WHATSAPP',
      ocurridoEn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      texto: 'Cargué el cliente ayer y no aparece.',
    });

    const tabla = await screen.findByRole('table', { name: 'Pedidos del equipo' });
    expect(within(tabla).getByText('No me aparece el cliente nuevo')).toBeVisible();
    expect(screen.queryByText('No hay pedidos abiertos')).not.toBeInTheDocument();
  });

  it('una nota interna se ve marcada, y «Agregar mensaje» manda la casilla', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [unPedido()] }));
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({
        pedido: unPedido(),
        mensajes: [
          unMensaje(),
          unMensaje({
            id: 'm2',
            autorUsuarioId: 'u-laura',
            autorNombre: 'Laura Pérez',
            texto: 'Revisar con Daniel antes de contestarle.',
            notaInterna: true,
          }),
        ],
      }),
    );
    mock.mockDeRuta('POST /api/v1/seguimiento/pedidos-equipo/p1/mensajes', () =>
      respuestaJson({ mensaje: unMensaje({ id: 'm3' }) }, { status: 201 }),
    );
    await montar({ pestana: 'equipo' });

    await usuario.click(await screen.findByRole('button', { name: 'No me aparece el cliente nuevo' }));

    const conversacion = await screen.findByRole('list', { name: 'Conversación del pedido' });
    const mensajes = within(conversacion).getAllByRole('listitem');
    expect(mensajes[0]).toHaveTextContent('Cargué el cliente ayer y no aparece en la lista.');
    expect(within(mensajes[0]!).queryByText('Nota interna')).not.toBeInTheDocument();
    expect(within(mensajes[1]!).getByText('Nota interna')).toBeVisible();

    await usuario.click(screen.getByRole('button', { name: 'Agregar mensaje' }));
    await usuario.selectOptions(screen.getByLabelText('Autor'), 'u-laura');
    await usuario.type(screen.getByLabelText('Texto'), 'Ya lo vemos mañana.');
    await usuario.click(screen.getByRole('checkbox', { name: 'Nota interna' }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar mensaje' }));

    await waitFor(() => expect(mock.llamadasA('POST /api/v1/seguimiento/pedidos-equipo/p1/mensajes')).toHaveLength(1));
    expect(cuerpoDe('POST /api/v1/seguimiento/pedidos-equipo/p1/mensajes')).toEqual({
      autorUsuarioId: 'u-laura',
      canal: 'WHATSAPP',
      ocurridoEn: expect.stringMatching(/Z$/),
      texto: 'Ya lo vemos mañana.',
      notaInterna: true,
    });
  });

  it('un responsable ve la pestaña Equipo sin botones ni acciones', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [unPedido()] }));
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido(), mensajes: [unMensaje()] }),
    );
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () => bandeja([unItem()]));
    await montar({ rol: 'responsable', pestana: 'equipo' });

    const tabla = await screen.findByRole('table', { name: 'Pedidos del equipo' });
    expect(within(tabla).getByText('No me aparece el cliente nuevo')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrados' })).toBeVisible();

    for (const texto of ['Nuevo pedido', 'Tildar', 'Reagendar', 'Cancelar', 'Derivar', 'Derivar a soporte', 'Soporte']) {
      expect(screen.queryByRole('button', { name: texto })).not.toBeInTheDocument();
    }

    await usuario.click(screen.getByRole('button', { name: 'No me aparece el cliente nuevo' }));
    expect(await screen.findByText('Cargué el cliente ayer y no aparece en la lista.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Agregar mensaje' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Nota interna' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Prioridad')).not.toBeInTheDocument();

    // La lista del equipo es solo de dirección: ni se pide.
    expect(mock.llamadasA('GET /api/v1/usuarios')).toHaveLength(0);

    // Pendientes, también en lectura.
    await usuario.click(screen.getByRole('tab', { name: 'Pendientes' }));
    await screen.findByRole('table', { name: 'Pendientes de seguimiento' });
    expect(screen.queryByRole('button', { name: 'Tildar' })).not.toBeInTheDocument();
    // El filtro por colaborador es solo de dirección.
    expect(screen.queryByLabelText('Colaborador')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument();
  });

  it('«Cerrados» trae los resueltos y cancelados; dirección los puede reabrir', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [] }));
    await montar({ pestana: 'equipo' });
    await screen.findByText('No hay pedidos abiertos');

    const cancelado = unPedido({ estado: 'CANCELADO', motivoDeCancelacion: 'Ya no hace falta' });
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [cancelado] }));
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () => respuestaJson({ pedido: unPedido() }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrados' }));

    const fila = (await screen.findByText('No me aparece el cliente nuevo')).closest('tr')!;
    expect(within(fila).getByText('Cancelado')).toBeVisible();
    const pedidos = mock.llamadasA('GET /api/v1/seguimiento/pedidos-equipo');
    expect(String(pedidos[pedidos.length - 1]![0])).toContain('estado=RESUELTO%2CCANCELADO');

    await usuario.click(within(fila).getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({ accion: 'reabrir' });
  });
});

describe('ajustes de la revisión final', () => {
  it('una solicitud a un cliente cambia de prioridad desde Pendientes y se recarga del servidor', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([unaSolicitud('sol-1', 'cli-garso', 'GARSO S.A.')]),
    );
    mock.mockDeRuta('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad', () => respuestaJson({ solicitud: {} }));
    await montar();
    await screen.findByText('Documentación 2026-11 de GARSO S.A.');
    const antes = mock.llamadasA('GET /api/v1/seguimiento/pendientes').length;

    const fila = filaDe('Documentación 2026-11 de GARSO S.A.');
    await usuario.selectOptions(within(fila).getByLabelText('Cambiar prioridad'), 'CRITICA');

    await waitFor(() =>
      expect(mock.llamadasA('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad')).toHaveLength(1),
    );
    expect(cuerpoDe('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad')).toEqual({ prioridad: 'CRITICA' });
    await waitFor(() =>
      expect(mock.llamadasA('GET /api/v1/seguimiento/pendientes').length).toBeGreaterThan(antes),
    );
  });

  it('un responsable no ve el selector de prioridad de las solicitudes', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([unaSolicitud('sol-1', 'cli-garso', 'GARSO S.A.')]),
    );
    await montar({ rol: 'responsable' });
    await screen.findByText('Documentación 2026-11 de GARSO S.A.');
    expect(screen.queryByLabelText('Cambiar prioridad')).not.toBeInTheDocument();
  });

  it('«Derivar a soporte» pide confirmación antes de mandar nada y no aparece si ya está derivado', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([unItem(), unItem({ id: 'p2', titulo: 'Ya derivado', derivadoASoporte: true })]),
    );
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido({ derivadoASoporte: true }) }),
    );
    await montar();
    await screen.findByText('No me aparece el cliente nuevo');

    expect(within(filaDe('Ya derivado')).queryByRole('button', { name: 'Derivar a soporte' })).not.toBeInTheDocument();

    const fila = filaDe('No me aparece el cliente nuevo');
    await usuario.click(within(fila).getByRole('button', { name: 'Derivar a soporte' }));
    expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(0);
    expect(within(fila).getByText(/no se puede deshacer/)).toBeVisible();

    await usuario.click(within(fila).getByRole('button', { name: 'Confirmar derivación a soporte' }));
    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({ accion: 'derivar_a_soporte' });
  });

  it('«Recordar el» se ve como dd/mm/aaaa en Pendientes, Equipo y el detalle', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([unItem({ recordarEl: '2099-12-31' })]),
    );
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () =>
      respuestaJson({ pedidos: [unPedido({ recordarEl: '2099-12-31' })] }),
    );
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido({ recordarEl: '2099-12-31' }), mensajes: [unMensaje()] }),
    );
    await montar();
    await screen.findByText('31/12/2099');
    expect(screen.queryByText('2099-12-31')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Equipo' }));
    const tabla = await screen.findByRole('table', { name: 'Pedidos del equipo' });
    expect(within(tabla).getByText('31/12/2099')).toBeVisible();

    await usuario.click(within(tabla).getByRole('button', { name: 'No me aparece el cliente nuevo' }));
    expect(await screen.findByText('Recordar el 31/12/2099')).toBeVisible();
    expect(screen.queryByText(/2099-12-31/)).not.toBeInTheDocument();
  });

  it('en Equipo, «Derivar» abre con los destinatarios actuales tildados', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () =>
      respuestaJson({
        pedidos: [unPedido({ destinatarioUsuarioIds: ['u-lili'], destinatarioNombres: ['Lili Benítez'] })],
      }),
    );
    await montar({ pestana: 'equipo' });
    const tabla = await screen.findByRole('table', { name: 'Pedidos del equipo' });

    await usuario.click(within(tabla).getByRole('button', { name: 'Derivar' }));

    expect(screen.getByRole('checkbox', { name: 'Lili Benítez' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Laura Pérez' })).not.toBeChecked();
  });

  it('el detalle muestra el error de otro pedido en vez de quedarse cargando, y el de una recarga fallida', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () =>
      respuestaJson({ pedidos: [unPedido(), unPedido({ id: 'p2', asunto: 'Segundo pedido' })] }),
    );
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido(), mensajes: [unMensaje()] }),
    );
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p2', () =>
      respuestaJson({ error: 'caido', mensaje: 'No se pudo abrir el segundo pedido.' }, { status: 500 }),
    );
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido({ estado: 'EN_CURSO' }) }),
    );
    await montar({ pestana: 'equipo' });

    await usuario.click(await screen.findByRole('button', { name: 'No me aparece el cliente nuevo' }));
    expect(await screen.findByText('Cargué el cliente ayer y no aparece en la lista.')).toBeVisible();

    // De A a B, y B falla: se ve el error, no «Cargando…» para siempre.
    await usuario.click(screen.getByRole('button', { name: 'Segundo pedido' }));
    expect(await screen.findByText('No se pudo abrir el segundo pedido.')).toBeVisible();
    expect(screen.queryByText('Cargando el pedido…')).not.toBeInTheDocument();

    // Vuelve a A (carga bien) y después una recarga falla: el mensaje se ve.
    await usuario.click(screen.getByRole('button', { name: 'No me aparece el cliente nuevo' }));
    expect(await screen.findByText('Cargué el cliente ayer y no aparece en la lista.')).toBeVisible();
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ error: 'caido', mensaje: 'El servidor no respondió.' }, { status: 500 }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Marcar en curso' }));
    expect(await screen.findByText('El servidor no respondió.')).toBeVisible();
  });

  it('dirección puede agregar y corregir mensajes en un pedido cerrado', async () => {
    const cerrado = unPedido({ estado: 'RESUELTO' });
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [] }));
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: cerrado, mensajes: [unMensaje()] }),
    );
    await montar({ pestana: 'equipo' });
    await screen.findByText('No hay pedidos abiertos');
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [cerrado] }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrados' }));
    await usuario.click(await screen.findByRole('button', { name: 'No me aparece el cliente nuevo' }));

    expect(await screen.findByRole('button', { name: 'Agregar mensaje' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeVisible();
  });
});

describe('quitar recordatorio, corregir datos y nombre del cliente (2026-11-27)', () => {
  it('«Quitar recordatorio» solo aparece con fecha y manda recordarEl:null (pedido y solicitud)', async () => {
    mock.mockDeRuta('GET /api/v1/seguimiento/pendientes', () =>
      bandeja([
        unItem({ recordarEl: '2099-12-31' }),
        unItem({ id: 'p2', titulo: 'Sin fecha' }),
        unItem({
          tipo: 'CLIENTE',
          id: 'sol-1',
          estado: 'ABIERTA',
          titulo: 'Documentación 2026-11',
          deQuien: 'GARSO S.A.',
          clienteId: 'cli-garso',
          periodo: '2026-11',
          recordarEl: '2099-11-30',
        }),
      ]),
    );
    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () => respuestaJson({ pedido: unPedido() }));
    mock.mockDeRuta('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad', () => respuestaJson({ solicitud: {} }));
    await montar();
    await screen.findByText('No me aparece el cliente nuevo');

    const sinFecha = filaDe('Sin fecha');
    await usuario.click(within(sinFecha).getByRole('button', { name: 'Reagendar' }));
    expect(within(sinFecha).queryByRole('button', { name: 'Quitar recordatorio' })).not.toBeInTheDocument();

    const fila = filaDe('No me aparece el cliente nuevo');
    await usuario.click(within(fila).getByRole('button', { name: 'Reagendar' }));
    await usuario.click(within(fila).getByRole('button', { name: 'Quitar recordatorio' }));
    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({ accion: 'reagendar', recordarEl: null });

    const filaSol = filaDe('Documentación 2026-11');
    await usuario.click(within(filaSol).getByRole('button', { name: 'Reagendar' }));
    await usuario.click(within(filaSol).getByRole('button', { name: 'Quitar recordatorio' }));
    await waitFor(() => expect(mock.llamadasA('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad')).toHaveLength(1));
    expect(cuerpoDe('PATCH /api/v1/seguimiento/solicitudes/sol-1/prioridad')).toEqual({ recordarEl: null });
  });

  async function abrirDetalle(pedido: Record<string, unknown>, opciones: { rol?: string } = {}) {
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo', () => respuestaJson({ pedidos: [pedido] }));
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido, mensajes: [unMensaje()] }),
    );
    await montar({
      ...opciones,
      pestana: 'equipo',
      clientes: [{ id: 'cli-garso', codigo: '012', nombre: 'GARSO S.A.', ruc: '80017726-6', activo: true }],
    });
    await usuario.click(await screen.findByRole('button', { name: pedido.asunto as string }));
  }

  it('el detalle muestra clienteNombre aunque la lista de clientes no lo traiga', async () => {
    const pedido = unPedido({ clienteId: 'cli-otro', clienteNombre: 'INACTIVA S.A.' });
    await abrirDetalle(pedido, { rol: 'responsable' });
    expect(await screen.findByText(/cliente: INACTIVA S\.A\./)).toBeVisible();
  });

  it('«Corregir datos» manda solo lo que cambió, bloquea mientras envía y recarga del servidor', async () => {
    await abrirDetalle(unPedido());
    await usuario.click(await screen.findByRole('button', { name: 'Corregir datos' }));
    const form = screen.getByRole('form', { name: 'Corregir datos' });
    const asunto = within(form).getByLabelText('Asunto');
    await usuario.clear(asunto);
    await usuario.type(asunto, '  Cliente nuevo no aparece  ');

    // El PATCH queda colgado hasta que el test lo suelte; lo demás sigue por el mock de rutas.
    let soltar: () => void = () => {};
    const compuerta = new Promise<void>((resolver) => { soltar = resolver; });
    const original = mock.fetchMock.getMockImplementation()!;
    mock.fetchMock.mockImplementation((entrada: RequestInfo | URL, opciones?: RequestInit) =>
      opciones?.method === 'PATCH'
        ? compuerta.then(() => respuestaJson({ pedido: unPedido({ asunto: 'Cliente nuevo no aparece' }) }))
        : original(entrada, opciones),
    );
    await usuario.click(within(form).getByRole('button', { name: 'Guardar datos' }));
    expect(within(form).getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(within(form).getByLabelText('Asunto')).toBeDisabled();

    const versionesAntes = mock.llamadasA('GET /api/v1/seguimiento/pedidos-equipo/p1').length;
    mock.mockDeRuta('GET /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ pedido: unPedido({ asunto: 'Cliente nuevo no aparece' }), mensajes: [unMensaje()] }),
    );
    soltar();

    await waitFor(() =>
      expect(mock.llamadasA('GET /api/v1/seguimiento/pedidos-equipo/p1').length).toBeGreaterThan(versionesAntes),
    );
    const llamadas = mock.fetchMock.mock.calls.filter(([, o]) => (o as RequestInit | undefined)?.method === 'PATCH');
    expect(JSON.parse(String((llamadas[0]?.[1] as RequestInit).body))).toEqual({
      accion: 'corregir',
      asunto: 'Cliente nuevo no aparece',
    });
    expect(await screen.findByRole('heading', { name: 'Cliente nuevo no aparece' })).toBeVisible();
  });

  it('«Corregir datos» cambia el cliente (incluido «Ninguno» → null) y muestra el error del servidor', async () => {
    await abrirDetalle(unPedido({ clienteId: 'cli-garso', clienteNombre: 'GARSO S.A.' }));
    await usuario.click(await screen.findByRole('button', { name: 'Corregir datos' }));
    const form = screen.getByRole('form', { name: 'Corregir datos' });
    await usuario.selectOptions(within(form).getByLabelText('Cliente relacionado'), 'Ninguno');

    mock.mockDeRuta('PATCH /api/v1/seguimiento/pedidos-equipo/p1', () =>
      respuestaJson({ error: 'cliente_invalido', mensaje: 'El cliente no existe.' }, { status: 400 }),
    );
    await usuario.click(within(form).getByRole('button', { name: 'Guardar datos' }));
    expect(await screen.findByText('El cliente no existe.')).toBeVisible();
    expect(cuerpoDe('PATCH /api/v1/seguimiento/pedidos-equipo/p1')).toEqual({ accion: 'corregir', clienteId: null });
    expect(within(form).getByRole('button', { name: 'Guardar datos' })).toBeEnabled();
  });

  it('«Corregir datos» no deja guardar sin cambios ni con el asunto vacío', async () => {
    await abrirDetalle(unPedido());
    await usuario.click(await screen.findByRole('button', { name: 'Corregir datos' }));
    const form = screen.getByRole('form', { name: 'Corregir datos' });
    expect(within(form).getByRole('button', { name: 'Guardar datos' })).toBeDisabled();
    await usuario.clear(within(form).getByLabelText('Asunto'));
    expect(within(form).getByRole('button', { name: 'Guardar datos' })).toBeDisabled();
  });

  it('«Corregir datos» no se ofrece en un pedido cerrado', async () => {
    await abrirDetalle(unPedido({ estado: 'RESUELTO' }));
    await screen.findByRole('button', { name: 'Agregar mensaje' });
    expect(screen.queryByRole('button', { name: 'Corregir datos' })).not.toBeInTheDocument();
  });

  it('«Corregir datos» no se ofrece a un responsable', async () => {
    await abrirDetalle(unPedido(), { rol: 'responsable' });
    await screen.findByText('Cargué el cliente ayer y no aparece en la lista.');
    expect(screen.queryByRole('button', { name: 'Corregir datos' })).not.toBeInTheDocument();
  });
});
