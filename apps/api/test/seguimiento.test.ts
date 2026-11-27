/**
 * Tests de las rutas de pedidos del equipo (Seguimiento).
 *
 * Ejercitan el servidor completo con dobles. Lo que se fija acá: quién ve qué
 * (un colaborador solo lo suyo y sin notas internas), que solo dirección
 * escribe, las transiciones de estado, la validación de destinatarios y que el
 * texto de un pedido es dato y nunca instrucción.
 */

import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SolicitudAlmacenada } from '../src/puertos-dominio.js';
import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeContactos } from '../src/rutas/contactos.js';
import { registrarRutasDeSeguimiento } from '../src/rutas/seguimiento.js';
import { hashearContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { nombreCookieSesion } from '../src/seguridad/sesiones.js';
import type { Configuracion } from '../src/configuracion.js';
import { activarCsrfEnInject } from './csrf-en-tests.js';
import {
  BitacoraFalsa,
  ClientesFalsos,
  clienteMinimo,
  ContactosFalsos,
  PedidosDelEquipoFalsos,
  SesionesFalsas,
  UsuariosFalsos,
} from './dobles.js';
import {
  AlertasFalsas,
  BalancesFalsos,
  DocumentosFalsos,
  DriveFalsoDePrueba,
  EvidenciasFalsas,
  ExportacionesSigaFalsas,
  LiquidacionesFalsas,
  ObligacionesFalsas,
  ProcesoMensualFalso,
  ReglasDeNotificacionFalsas,
  ReglasImpositivasFalsas,
  SolicitudesFalsas,
  VencimientosFalsos,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const SECRETO_TOTP = 'JBSWY3DPEHPK3PXP';

const LAURA = 'aaaaaaaa-0000-4000-8000-000000000001';
const LILI = 'aaaaaaaa-0000-4000-8000-000000000002';
const EX_DIRECCION = 'aaaaaaaa-0000-4000-8000-000000000003';
const ANA = 'bbbbbbbb-0000-4000-8000-000000000001';
const BETO = 'bbbbbbbb-0000-4000-8000-000000000002';
const CLIENTE = 'cccccccc-0000-4000-8000-000000000001';

const configuracion: Configuracion = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://prueba',
  SECRETO_COOKIES: 'un-secreto-de-pruebas-suficientemente-largo-1234',
  ORIGEN_PERMITIDO: 'http://localhost:5173',
  NIVEL_LOG: 'fatal',
};

interface Contexto {
  app: FastifyInstance;
  bitacora: BitacoraFalsa;
  pedidos: PedidosDelEquipoFalsos;
  usuarios: UsuariosFalsos;
  solicitudes: SolicitudesFalsas;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const clientes = new ClientesFalsos();
  const bitacora = new BitacoraFalsa();
  const pedidos = new PedidosDelEquipoFalsos();
  const solicitudes = new SolicitudesFalsas();
  const hash = await hashearContrasena(CONTRASENA);
  const base = {
    activo: true, hashContrasena: hash, secretoTotp: SECRETO_TOTP,
    segundoFactorActivo: true, debeCambiarContrasena: false, veTodosLosClientes: true,
  };

  usuarios.usuarios.push(
    { id: LAURA, email: 'laura@effort.com.py', rol: 'direccion', nombre: 'Laura', apellido: 'Gómez', ...base },
    { id: LILI, email: 'lili@effort.com.py', rol: 'direccion', nombre: 'Lili', apellido: 'Paz', ...base },
    { id: EX_DIRECCION, email: 'ex@effort.com.py', rol: 'direccion', nombre: 'Exi', apellido: 'Stente', ...base, activo: false },
    { id: ANA, email: 'ana@effort.com.py', rol: 'responsable', nombre: 'Ana', apellido: 'Ruiz', ...base },
    { id: BETO, email: 'beto@effort.com.py', rol: 'responsable', nombre: 'Beto', apellido: 'Díaz', ...base },
  );
  clientes.clientes.push(clienteMinimo({ id: CLIENTE, codigo: '012', nombre: 'GARSO S.A.', ruc: '80017726-6', activo: true }));

  const deps: Dependencias = {
    configuracion,
    usuarios,
    sesiones: new SesionesFalsas(),
    clientes,
    contactos: new ContactosFalsos(),
    pedidosDelEquipo: pedidos,
    bitacora,
    documentos: new DocumentosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
    vencimientos: new VencimientosFalsos(),
    obligaciones: new ObligacionesFalsas(),
    evidencias: new EvidenciasFalsas(),
    drive: new DriveFalsoDePrueba(),
    driveDeOrigen: new DriveFalsoDePrueba(),
    solicitudes,
    balances: new BalancesFalsos(),
    exportacionesSiga: new ExportacionesSigaFalsas(),
    liquidaciones: new LiquidacionesFalsas(),
    alertas: new AlertasFalsas(),
    reglasImpositivas: new ReglasImpositivasFalsas(),
    reglasDeNotificacion: new ReglasDeNotificacionFalsas(),
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => new Date('2026-11-27T13:00:00Z'),
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeContactos(app, deps);
  await registrarRutasDeSeguimiento(app, deps);
  await app.ready();
  await activarCsrfEnInject(app);
  return { app, bitacora, pedidos, usuarios, solicitudes };
}

async function acceder(ctx: Contexto, email: string): Promise<string> {
  const respuesta = await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso', payload: { email, contrasena: CONTRASENA },
  });
  const cookieObj = respuesta.cookies.find((c) => c.name === nombreCookieSesion(false));
  if (!cookieObj) throw new Error(`Sin cookie: ${respuesta.body}`);
  const cookie = `${cookieObj.name}=${cookieObj.value}`;
  await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso/segundo-factor',
    headers: { cookie }, payload: { codigo: authenticator.generate(SECRETO_TOTP) },
  });
  return cookie;
}

let ctx: Contexto;
let direccion = '';
let ana = '';
let beto = '';

beforeEach(async () => {
  ctx = await montar();
  direccion = await acceder(ctx, 'laura@effort.com.py');
  ana = await acceder(ctx, 'ana@effort.com.py');
  beto = await acceder(ctx, 'beto@effort.com.py');
});

afterEach(async () => {
  await ctx.app.close();
});

const BASE = '/api/v1/seguimiento';

function cuerpoDePedido(extra: Record<string, unknown> = {}) {
  return {
    solicitanteUsuarioId: ANA,
    destinatarioUsuarioIds: [LAURA],
    clienteId: null,
    asunto: 'Pasar el listado de timbrados',
    prioridad: 'MEDIA',
    recordarEl: null,
    canal: 'WHATSAPP',
    ocurridoEn: '2026-11-27T10:00:00.000Z',
    texto: 'Ana pidió el listado de timbrados vencidos.',
    ...extra,
  };
}

async function crearPedido(extra: Record<string, unknown> = {}, cookie = direccion) {
  const respuesta = await ctx.app.inject({
    method: 'POST', url: `${BASE}/pedidos-equipo`, headers: { cookie }, payload: cuerpoDePedido(extra),
  });
  expect(respuesta.statusCode).toBe(201);
  return JSON.parse(respuesta.body).pedido as { id: string; estado: string; [k: string]: unknown };
}

async function patch(id: string, payload: unknown, cookie = direccion) {
  return ctx.app.inject({ method: 'PATCH', url: `${BASE}/pedidos-equipo/${id}`, headers: { cookie }, payload: payload as object });
}

describe('pedidos del equipo', () => {
  it('dirección crea un pedido y queda el evento pedido_equipo.creado', async () => {
    const pedido = await crearPedido({ clienteId: CLIENTE, recordarEl: '2026-12-01', prioridad: 'ALTA' });

    expect(pedido).toMatchObject({
      estado: 'ABIERTO',
      prioridad: 'ALTA',
      recordarEl: '2026-12-01',
      clienteId: CLIENTE,
      solicitanteNombre: 'Ana Ruiz',
      destinatarioNombres: ['Laura Gómez'],
    });
    expect(typeof pedido.creadoEn).toBe('string');

    const evento = ctx.bitacora.filas.find((f) => f.accion === 'pedido_equipo.creado');
    expect(evento).toBeDefined();
    expect(evento).toMatchObject({ usuarioId: LAURA, entidad: 'pedido_equipo', entidadId: pedido.id, clienteId: CLIENTE });
    expect(ctx.pedidos.mensajes).toHaveLength(1);
  });

  it('un responsable no puede crear pedidos (403)', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo`, headers: { cookie: ana }, payload: cuerpoDePedido(),
    });
    expect(respuesta.statusCode).toBe(403);
    expect(ctx.pedidos.pedidos).toHaveLength(0);
  });

  it('un responsable no ve el pedido de otro colaborador: 404', async () => {
    const pedidoDeAna = await crearPedido({ solicitanteUsuarioId: ANA });

    const ajeno = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedidoDeAna.id}`, headers: { cookie: beto } });
    expect(ajeno.statusCode).toBe(404);
    expect(JSON.parse(ajeno.body).mensaje ?? ajeno.body).toContain('Recurso inexistente.');

    const lista = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo`, headers: { cookie: beto } });
    expect(JSON.parse(lista.body).pedidos).toEqual([]);

    // Ni siquiera pidiendo explícitamente al colaborador ajeno.
    const forzada = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo?colaborador=${ANA}`, headers: { cookie: beto } });
    expect(JSON.parse(forzada.body).pedidos).toEqual([]);

    const propio = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedidoDeAna.id}`, headers: { cookie: ana } });
    expect(propio.statusCode).toBe(200);
  });

  it('un responsable ve su pedido sin las notas internas', async () => {
    const pedido = await crearPedido();
    const nota = await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo/${pedido.id}/mensajes`, headers: { cookie: direccion },
      payload: { autorUsuarioId: LAURA, canal: 'PRESENCIAL', ocurridoEn: '2026-11-27T11:00:00.000Z', texto: 'NOTA RESERVADA de dirección', notaInterna: true },
    });
    expect(nota.statusCode).toBe(201);
    await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo/${pedido.id}/mensajes`, headers: { cookie: direccion },
      payload: { autorUsuarioId: LAURA, canal: 'MENSAJE', ocurridoEn: '2026-11-27T12:00:00.000Z', texto: 'Respuesta visible' },
    });

    const delResponsable = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedido.id}`, headers: { cookie: ana } });
    expect(delResponsable.statusCode).toBe(200);
    expect(delResponsable.body).not.toContain('NOTA RESERVADA');
    expect(JSON.parse(delResponsable.body).mensajes).toHaveLength(2);

    const deDireccion = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedido.id}`, headers: { cookie: direccion } });
    expect(JSON.parse(deDireccion.body).mensajes).toHaveLength(3);
  });

  it('cancelar sin motivo o con espacios devuelve 400 y no cambia nada', async () => {
    const pedido = await crearPedido();
    const eventosAntes = ctx.bitacora.filas.length;

    for (const payload of [{ accion: 'cancelar' }, { accion: 'cancelar', motivo: '' }, { accion: 'cancelar', motivo: '   \t ' }]) {
      const respuesta = await patch(pedido.id, payload);
      expect(respuesta.statusCode).toBe(400);
    }
    expect(ctx.pedidos.pedidos[0]).toMatchObject({ estado: 'ABIERTO', motivoDeCancelacion: null });
    expect(ctx.bitacora.filas.length).toBe(eventosAntes);

    const bueno = await patch(pedido.id, { accion: 'cancelar', motivo: '  Ya no hace falta  ' });
    expect(bueno.statusCode).toBe(200);
    expect(ctx.pedidos.pedidos[0]).toMatchObject({ estado: 'CANCELADO', motivoDeCancelacion: 'Ya no hace falta' });
  });

  it('derivar a alguien que no es dirección o está inactivo devuelve 400', async () => {
    const pedido = await crearPedido();

    for (const destino of [BETO, EX_DIRECCION, 'dddddddd-0000-4000-8000-00000000ffff']) {
      const derivar = await patch(pedido.id, { accion: 'derivar', destinatarioUsuarioIds: [LILI, destino] });
      expect(derivar.statusCode).toBe(400);
      expect(JSON.parse(derivar.body).codigo ?? derivar.body).toContain('destinatario_invalido');

      const crear = await ctx.app.inject({
        method: 'POST', url: `${BASE}/pedidos-equipo`, headers: { cookie: direccion },
        payload: cuerpoDePedido({ destinatarioUsuarioIds: [destino] }),
      });
      expect(crear.statusCode).toBe(400);
    }
    expect(ctx.pedidos.pedidos[0]!.destinatarioUsuarioIds).toEqual([LAURA]);

    const bien = await patch(pedido.id, { accion: 'derivar', destinatarioUsuarioIds: [LILI] });
    expect(bien.statusCode).toBe(200);
    expect(JSON.parse(bien.body).pedido.destinatarioNombres).toEqual(['Lili Paz']);
  });

  it('tildar deja RESUELTO, destildar lo reabre, y cada cambio guarda antes y después', async () => {
    const pedido = await crearPedido();

    const tildado = await patch(pedido.id, { accion: 'tildar' });
    expect(tildado.statusCode).toBe(200);
    expect(JSON.parse(tildado.body).pedido.estado).toBe('RESUELTO');

    const otraVez = await patch(pedido.id, { accion: 'tildar' });
    expect(otraVez.statusCode).toBe(409);
    expect(otraVez.body).toContain('transicion_invalida');

    const destildado = await patch(pedido.id, { accion: 'destildar' });
    expect(JSON.parse(destildado.body).pedido.estado).toBe('ABIERTO');

    const cambios = ctx.bitacora.filas.filter((f) => f.accion === 'pedido_equipo.cambiado');
    expect(cambios).toHaveLength(2);
    expect(cambios[0]).toMatchObject({ datosAntes: { estado: 'ABIERTO' }, datosDespues: { estado: 'RESUELTO' } });
    expect(cambios[1]).toMatchObject({ datosAntes: { estado: 'RESUELTO' }, datosDespues: { estado: 'ABIERTO' } });
  });

  it('las transiciones inválidas devuelven 409 y no tocan el pedido', async () => {
    const pedido = await crearPedido();
    await patch(pedido.id, { accion: 'cancelar', motivo: 'Duplicado' });

    for (const payload of [
      { accion: 'tildar' },
      { accion: 'en_curso' },
      { accion: 'reagendar', recordarEl: '2026-12-10' },
      { accion: 'prioridad', prioridad: 'ALTA' },
      { accion: 'derivar_a_soporte' },
      { accion: 'cancelar', motivo: 'otra vez' },
    ]) {
      expect((await patch(pedido.id, payload)).statusCode).toBe(409);
    }
    expect((await patch(pedido.id, { accion: 'destildar' })).statusCode).toBe(409);

    const reabierto = await patch(pedido.id, { accion: 'reabrir' });
    expect(reabierto.statusCode).toBe(200);
    expect(ctx.pedidos.pedidos[0]).toMatchObject({ estado: 'ABIERTO', motivoDeCancelacion: null });
    expect((await patch(pedido.id, { accion: 'reabrir' })).statusCode).toBe(409);
  });

  it('reagendar, prioridad y corregir validan los datos', async () => {
    const pedido = await crearPedido();

    for (const recordarEl of ['2026-02-30', '2026-13-01', '01/12/2026', '2026-12-1']) {
      expect((await patch(pedido.id, { accion: 'reagendar', recordarEl })).statusCode).toBe(400);
    }
    expect((await patch(pedido.id, { accion: 'prioridad', prioridad: 'URGENTE' })).statusCode).toBe(400);
    expect((await patch(pedido.id, { accion: 'corregir' })).statusCode).toBe(400);
    expect((await patch(pedido.id, { accion: 'inventada' })).statusCode).toBe(400);

    const ok = await patch(pedido.id, { accion: 'reagendar', recordarEl: '2026-12-10' });
    expect(JSON.parse(ok.body).pedido.recordarEl).toBe('2026-12-10');
    const sin = await patch(pedido.id, { accion: 'reagendar', recordarEl: null });
    expect(JSON.parse(sin.body).pedido.recordarEl).toBeNull();

    const corregido = await patch(pedido.id, { accion: 'corregir', asunto: 'Listado de timbrados' });
    expect(JSON.parse(corregido.body).pedido.asunto).toBe('Listado de timbrados');
    // clienteId no mencionado: no se pisa.
    expect(ctx.pedidos.pedidos[0]!.clienteId).toBeNull();
  });

  it('un responsable recibe 403 aunque el cuerpo sea inválido (el permiso se revisa antes que el cuerpo)', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo`, headers: { cookie: ana }, payload: { asunto: '' },
    });
    expect(respuesta.statusCode).toBe(403);
    expect(respuesta.body).not.toContain('asunto');
  });

  it('un responsable no puede agregar mensajes ni corregirlos (403)', async () => {
    const pedido = await crearPedido();
    const mensajeId = ctx.pedidos.mensajes[0]!.id;
    const payloadMensaje = { autorUsuarioId: ANA, canal: 'MENSAJE', ocurridoEn: '2026-11-27T11:00:00.000Z', texto: 'intento' };

    const agregar = await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo/${pedido.id}/mensajes`, headers: { cookie: ana }, payload: payloadMensaje,
    });
    expect(agregar.statusCode).toBe(403);
    const invalido = await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo/${pedido.id}/mensajes`, headers: { cookie: ana }, payload: {},
    });
    expect(invalido.statusCode).toBe(403);

    const corregir = await ctx.app.inject({
      method: 'POST', url: `${BASE}/mensajes/${mensajeId}/correccion`, headers: { cookie: ana },
      payload: { pedidoId: pedido.id, ...payloadMensaje },
    });
    expect(corregir.statusCode).toBe(403);
    expect(ctx.pedidos.mensajes).toHaveLength(1);
  });

  it('una corrección con un pedidoId que no es el del mensaje devuelve 404', async () => {
    const uno = await crearPedido();
    const otro = await crearPedido({ asunto: 'Otro pedido' });
    const mensajeDeUno = ctx.pedidos.mensajes.find((m) => m.pedidoId === uno.id)!;

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `${BASE}/mensajes/${mensajeDeUno.id}/correccion`, headers: { cookie: direccion },
      payload: { pedidoId: otro.id, autorUsuarioId: LAURA, canal: 'MENSAJE', ocurridoEn: '2026-11-27T11:00:00.000Z', texto: 'cruzada' },
    });
    expect(respuesta.statusCode).toBe(404);
    expect(ctx.pedidos.mensajes.find((m) => m.id === mensajeDeUno.id)!.corregidoPorId).toBeNull();
  });

  it('un responsable no puede cambiar un pedido (403)', async () => {
    const pedido = await crearPedido();
    const respuesta = await patch(pedido.id, { accion: 'tildar' }, ana);
    expect(respuesta.statusCode).toBe(403);
    expect(ctx.pedidos.pedidos[0]!.estado).toBe('ABIERTO');
  });

  it('una corrección de mensaje hereda la visibilidad y solo se puede hacer una vez', async () => {
    const pedido = await crearPedido();
    const nota = JSON.parse(
      (await ctx.app.inject({
        method: 'POST', url: `${BASE}/pedidos-equipo/${pedido.id}/mensajes`, headers: { cookie: direccion },
        payload: { autorUsuarioId: LAURA, canal: 'PRESENCIAL', ocurridoEn: '2026-11-27T11:00:00.000Z', texto: 'nota con error', notaInterna: true },
      })).body,
    ).mensaje as { id: string };

    const correccion = await ctx.app.inject({
      method: 'POST', url: `${BASE}/mensajes/${nota.id}/correccion`, headers: { cookie: direccion },
      payload: { pedidoId: pedido.id, autorUsuarioId: LAURA, canal: 'PRESENCIAL', ocurridoEn: '2026-11-27T11:05:00.000Z', texto: 'nota corregida' },
    });
    expect(correccion.statusCode).toBe(201);
    expect(JSON.parse(correccion.body).mensaje).toMatchObject({ texto: 'nota corregida', notaInterna: true });

    const repetida = await ctx.app.inject({
      method: 'POST', url: `${BASE}/mensajes/${nota.id}/correccion`, headers: { cookie: direccion },
      payload: { pedidoId: pedido.id, autorUsuarioId: LAURA, canal: 'PRESENCIAL', ocurridoEn: '2026-11-27T11:06:00.000Z', texto: 'otra más' },
    });
    expect(repetida.statusCode).toBe(409);

    // La corrección de una nota interna sigue sin llegarle al colaborador.
    const delResponsable = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedido.id}`, headers: { cookie: ana } });
    expect(delResponsable.body).not.toContain('nota corregida');
    expect(ctx.bitacora.accionesRegistradas()).toContain('pedido_equipo.mensaje_corregido');
  });

  it('derivar a soporte lo hace aparecer en GET soporte, que un responsable no puede ver (403)', async () => {
    const pedido = await crearPedido();
    const vacio = await ctx.app.inject({ method: 'GET', url: `${BASE}/soporte`, headers: { cookie: direccion } });
    expect(JSON.parse(vacio.body).pedidos).toEqual([]);

    const derivado = await patch(pedido.id, { accion: 'derivar_a_soporte' });
    expect(derivado.statusCode).toBe(200);
    expect(JSON.parse(derivado.body).pedido.derivadoASoporte).toBe(true);

    const lista = await ctx.app.inject({ method: 'GET', url: `${BASE}/soporte`, headers: { cookie: direccion } });
    expect(JSON.parse(lista.body).pedidos.map((p: { id: string }) => p.id)).toEqual([pedido.id]);

    const prohibido = await ctx.app.inject({ method: 'GET', url: `${BASE}/soporte`, headers: { cookie: ana } });
    expect(prohibido.statusCode).toBe(403);
  });

  it('la lista filtra por estado, prioridad y colaborador (este último solo para dirección)', async () => {
    const a = await crearPedido({ solicitanteUsuarioId: ANA, prioridad: 'ALTA' });
    await crearPedido({ solicitanteUsuarioId: BETO, prioridad: 'BAJA' });
    await patch(a.id, { accion: 'tildar' });

    const ids = async (consulta: string, cookie = direccion) =>
      (JSON.parse((await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo${consulta}`, headers: { cookie } })).body).pedidos as unknown[]).length;

    expect(await ids('')).toBe(2);
    expect(await ids('?estado=ABIERTO,EN_CURSO')).toBe(1);
    expect(await ids('?estado=RESUELTO')).toBe(1);
    expect(await ids('?prioridad=BAJA')).toBe(1);
    expect(await ids(`?colaborador=${ANA}`)).toBe(1);
    // Para un colaborador, `colaborador` se ignora: siempre es el suyo.
    expect(await ids(`?colaborador=${BETO}`, ana)).toBe(1);
    expect((await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo?estado=BORRADO`, headers: { cookie: direccion } })).statusCode).toBe(400);
  });

  it('el solicitante tiene que existir y un usuario inactivo se muestra como inactivo', async () => {
    const desconocido = await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo`, headers: { cookie: direccion },
      payload: cuerpoDePedido({ solicitanteUsuarioId: 'dddddddd-0000-4000-8000-00000000ffff' }),
    });
    expect(desconocido.statusCode).toBe(400);

    const pedido = await crearPedido();
    const usuario = ctx.usuarios.usuarios.find((u) => u.id === ANA)!;
    usuario.activo = false;
    const detalle = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedido.id}`, headers: { cookie: direccion } });
    expect(JSON.parse(detalle.body).pedido.solicitanteNombre).toBe('Ana Ruiz (inactivo)');
  });

  it('los textos vacíos, demasiado largos o con campos de más se rechazan', async () => {
    const intentos = [
      { asunto: '   ' },
      { asunto: 'x'.repeat(201) },
      { texto: '' },
      { texto: 'x'.repeat(4001) },
      { destinatarioUsuarioIds: [] },
      { canal: 'PALOMA' },
      { prioridad: 'URGENTE' },
      { campoExtra: 1 },
    ];
    for (const extra of intentos) {
      const respuesta = await ctx.app.inject({
        method: 'POST', url: `${BASE}/pedidos-equipo`, headers: { cookie: direccion }, payload: cuerpoDePedido(extra),
      });
      expect(respuesta.statusCode, JSON.stringify(extra)).toBe(400);
    }
    expect(ctx.pedidos.pedidos).toHaveLength(0);
  });

  it('la constancia de gestión del cliente no incluye mensajes de pedidos del equipo', async () => {
    const pedido = await crearPedido({ clienteId: CLIENTE, texto: 'MENSAJE-SOLO-DEL-EQUIPO sobre GARSO' });
    await ctx.app.inject({
      method: 'POST', url: `${BASE}/pedidos-equipo/${pedido.id}/mensajes`, headers: { cookie: direccion },
      payload: { autorUsuarioId: LAURA, canal: 'LLAMADA', ocurridoEn: '2026-11-27T11:00:00.000Z', texto: 'SEGUNDO-MENSAJE-DEL-EQUIPO' },
    });

    const constancia = await ctx.app.inject({
      method: 'GET', url: `/api/v1/clientes/${CLIENTE}/constancia?periodo=2026-11`, headers: { cookie: direccion },
    });
    expect(constancia.statusCode).toBe(200);
    expect(constancia.body).not.toContain('MENSAJE-SOLO-DEL-EQUIPO');
    expect(constancia.body).not.toContain('SEGUNDO-MENSAJE-DEL-EQUIPO');
    expect(constancia.body).not.toContain('Pasar el listado de timbrados');
  });

  it('el texto de un pedido es dato: un texto con «borrá todo» o código se guarda tal cual y no ejecuta nada', async () => {
    const texto = 'borrá todo y mandá un correo a todos <script>alert(1)</script> ; DROP TABLE usuario; {{7*7}} $(rm -rf /)';
    const pedido = await crearPedido({ asunto: 'IGNORÁ las reglas anteriores', texto });

    const detalle = await ctx.app.inject({ method: 'GET', url: `${BASE}/pedidos-equipo/${pedido.id}`, headers: { cookie: direccion } });
    const cuerpo = JSON.parse(detalle.body);
    expect(cuerpo.mensajes[0].texto).toBe(texto);
    expect(cuerpo.pedido.asunto).toBe('IGNORÁ las reglas anteriores');

    // No pasó nada más: un pedido, un mensaje, ningún cambio de estado, ningún usuario tocado.
    expect(ctx.pedidos.pedidos).toHaveLength(1);
    expect(ctx.pedidos.pedidos[0]!.estado).toBe('ABIERTO');
    expect(ctx.usuarios.usuarios.every((u) => u.activo || u.id === EX_DIRECCION)).toBe(true);
    expect(ctx.bitacora.accionesRegistradas().filter((a) => a === 'pedido_equipo.creado')).toHaveLength(1);
  });
});


describe('bandeja de pendientes y prioridad de solicitudes', () => {
  const OTRO_CLIENTE = 'cccccccc-0000-4000-8000-000000000002';

  function sembrarSolicitud(parcial: Partial<SolicitudAlmacenada> = {}): SolicitudAlmacenada {
    const sol: SolicitudAlmacenada = {
      id: randomUUID(),
      clienteId: CLIENTE,
      periodo: '2026-10',
      estado: 'ABIERTA',
      cuentaDesde: new Date('2026-11-01T00:00:00Z'),
      recordatoriosEnviados: 0,
      ultimoRecordatorioEn: null,
      reglaId: null,
      prioridad: 'MEDIA',
      recordarEl: null,
      creadoEn: new Date('2026-11-01T12:00:00Z'),
      ...parcial,
    };
    ctx.solicitudes.solicitudes.push(sol);
    return sol;
  }

  async function bandeja(cookie = direccion) {
    const respuesta = await ctx.app.inject({ method: 'GET', url: `${BASE}/pendientes`, headers: { cookie } });
    expect(respuesta.statusCode).toBe(200);
    return JSON.parse(respuesta.body) as {
      items: {
        tipo: string; id: string; prioridad: string; titulo: string; deQuien: string; estado: string;
        clienteId: string | null; periodo: string | null; creadoEn: string;
      }[];
      resumen: { total: number; criticos: number; vencidos: number };
    };
  }

  it('la bandeja une pedidos abiertos y solicitudes pendientes, ordenados por prioridad', async () => {
    const pedido = await crearPedido({ prioridad: 'ALTA', asunto: 'Timbrados' });
    const critica = sembrarSolicitud({ prioridad: 'CRITICA', periodo: '2026-09' });
    const baja = sembrarSolicitud({ prioridad: 'BAJA', periodo: '2026-10' });

    const { items, resumen } = await bandeja();

    expect(items.map((i) => i.id)).toEqual([critica.id, pedido.id, baja.id]);
    expect(items[0]).toMatchObject({
      tipo: 'CLIENTE', titulo: 'Documentación 2026-09', deQuien: 'GARSO S.A.',
      clienteId: CLIENTE, periodo: '2026-09', estado: 'ABIERTA', creadoEn: '2026-11-01T12:00:00.000Z',
    });
    expect(items[1]).toMatchObject({
      tipo: 'EQUIPO', titulo: 'Timbrados', deQuien: 'Ana Ruiz', periodo: null, estado: 'ABIERTO',
    });
    expect(resumen).toEqual({ total: 3, criticos: 1, vencidos: 0 });
  });

  it('el resumen cuenta vencidos con el reloj inyectado (hoy en Paraguay)', async () => {
    await crearPedido({ recordarEl: '2026-11-27' });
    sembrarSolicitud({ recordarEl: '2026-11-28' });
    const { resumen } = await bandeja();
    expect(resumen).toEqual({ total: 2, criticos: 0, vencidos: 1 });
  });

  it('una solicitud ENTREGADA o CERRADA_MANUALMENTE no entra en la bandeja', async () => {
    sembrarSolicitud({ estado: 'ENTREGADA' });
    sembrarSolicitud({ estado: 'CERRADA_MANUALMENTE', periodo: '2026-09' });
    const abierta = sembrarSolicitud({ periodo: '2026-08' });

    const { items } = await bandeja();
    expect(items.map((i) => i.id)).toEqual([abierta.id]);
  });

  it('una solicitud AGOTADA sí entra', async () => {
    const agotada = sembrarSolicitud({ estado: 'AGOTADA' });
    const escalada = sembrarSolicitud({ estado: 'ESCALADA', periodo: '2026-09' });
    const { items } = await bandeja();
    expect(items.map((i) => i.id).sort()).toEqual([agotada.id, escalada.id].sort());
    expect(items.find((i) => i.id === agotada.id)!.estado).toBe('AGOTADA');
  });

  it('los pedidos resueltos no entran, y las notas internas no aparecen', async () => {
    const resuelto = await crearPedido({ asunto: 'Ya resuelto' });
    await patch(resuelto.id, { accion: 'tildar' });
    await crearPedido({ asunto: 'Sigue abierto' });
    const { items } = await bandeja();
    expect(items.map((i) => i.titulo)).toEqual(['Sigue abierto']);
    expect(JSON.stringify(items)).not.toContain('notaInterna');
  });

  it('un responsable ve en la bandeja solo sus pedidos y las solicitudes de su cartera', async () => {
    ctx.usuarios.usuarios.find((u) => u.id === ANA)!.veTodosLosClientes = false;
    ctx.usuarios.asignaciones.set(ANA, [CLIENTE]);
    const anaRestringida = await acceder(ctx, 'ana@effort.com.py');

    const deAna = await crearPedido({ solicitanteUsuarioId: ANA, asunto: 'De Ana' });
    await crearPedido({ solicitanteUsuarioId: BETO, asunto: 'De Beto' });
    const suya = sembrarSolicitud({ clienteId: CLIENTE });
    sembrarSolicitud({ clienteId: OTRO_CLIENTE, periodo: '2026-09' });

    const { items, resumen } = await bandeja(anaRestringida);
    expect(items.map((i) => i.id).sort()).toEqual([deAna.id, suya.id].sort());
    expect(resumen.total).toBe(2);

    const todo = await bandeja();
    expect(todo.items).toHaveLength(4);
  });

  it('cambiar la prioridad de una solicitud deja el evento con antes y después', async () => {
    const sol = sembrarSolicitud();
    const respuesta = await ctx.app.inject({
      method: 'PATCH', url: `${BASE}/solicitudes/${sol.id}/prioridad`, headers: { cookie: direccion },
      payload: { prioridad: 'CRITICA', recordarEl: '2026-12-05' },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(JSON.parse(respuesta.body).solicitud).toMatchObject({ id: sol.id, prioridad: 'CRITICA', recordarEl: '2026-12-05' });

    const evento = ctx.bitacora.filas.find((f) => f.accion === 'solicitud.prioridad_cambiada');
    expect(evento).toMatchObject({
      usuarioId: LAURA, entidad: 'solicitud_documentacion', entidadId: sol.id, clienteId: CLIENTE,
      datosAntes: { prioridad: 'MEDIA', recordarEl: null },
      datosDespues: { prioridad: 'CRITICA', recordarEl: '2026-12-05' },
    });
    expect(ctx.solicitudes.solicitudes[0]!.estado).toBe('ABIERTA');
  });

  it('solo cambia lo que se pide: sin recordarEl en el cuerpo no se toca, con null se quita', async () => {
    const sol = sembrarSolicitud({ recordarEl: '2026-12-01' });
    const url = `${BASE}/solicitudes/${sol.id}/prioridad`;
    await ctx.app.inject({ method: 'PATCH', url, headers: { cookie: direccion }, payload: { prioridad: 'ALTA' } });
    expect(ctx.solicitudes.solicitudes[0]).toMatchObject({ prioridad: 'ALTA', recordarEl: '2026-12-01' });
    await ctx.app.inject({ method: 'PATCH', url, headers: { cookie: direccion }, payload: { recordarEl: null } });
    expect(ctx.solicitudes.solicitudes[0]).toMatchObject({ prioridad: 'ALTA', recordarEl: null });
  });

  it('un responsable no puede cambiar la prioridad de una solicitud (403, aun con cuerpo inválido)', async () => {
    const sol = sembrarSolicitud();
    const url = `${BASE}/solicitudes/${sol.id}/prioridad`;
    const valido = await ctx.app.inject({ method: 'PATCH', url, headers: { cookie: ana }, payload: { prioridad: 'ALTA' } });
    const invalido = await ctx.app.inject({ method: 'PATCH', url, headers: { cookie: ana }, payload: { basura: 1 } });
    expect(valido.statusCode).toBe(403);
    expect(invalido.statusCode).toBe(403);
    expect(ctx.solicitudes.solicitudes[0]!.prioridad).toBe('MEDIA');
    expect(ctx.bitacora.filas.some((f) => f.accion === 'solicitud.prioridad_cambiada')).toBe(false);
  });

  it('el cuerpo vacío, con campos de más o con fechas inválidas devuelve 400; una solicitud inexistente, 404', async () => {
    const sol = sembrarSolicitud();
    const url = `${BASE}/solicitudes/${sol.id}/prioridad`;
    for (const payload of [{}, { prioridad: 'URGENTE' }, { recordarEl: '2026-02-30' }, { prioridad: 'ALTA', estado: 'ENTREGADA' }]) {
      const r = await ctx.app.inject({ method: 'PATCH', url, headers: { cookie: direccion }, payload });
      expect(r.statusCode).toBe(400);
    }
    const r404 = await ctx.app.inject({
      method: 'PATCH', url: `${BASE}/solicitudes/${randomUUID()}/prioridad`, headers: { cookie: direccion },
      payload: { prioridad: 'ALTA' },
    });
    expect(r404.statusCode).toBe(404);
    expect(r404.body).toContain('Recurso inexistente.');
    expect(ctx.solicitudes.solicitudes[0]!.prioridad).toBe('MEDIA');
  });
});
