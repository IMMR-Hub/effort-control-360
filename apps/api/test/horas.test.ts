/**
 * Planilla de horas (tarea 144).
 *
 * Lo que importa acá, en orden de gravedad si fallara:
 *   1. nadie ve ni carga las horas de otra persona, ni siquiera dirección;
 *   2. el resumen agregado es exclusivo de dirección y nunca expone una fila
 *      individual, solo el total;
 *   3. cargar el mismo (usuario, cliente, día) corrige, no duplica;
 *   4. tiempo interno (`clienteId: null`) no exige cartera y siempre entra
 *      al resumen, sin importar qué clientes vea quien lo pide.
 */

import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { beforeEach, describe, expect, it } from 'vitest';

import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeHoras } from '../src/rutas/horas.js';
import { hashearContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { nombreCookieSesion } from '../src/seguridad/sesiones.js';
import type { Configuracion } from '../src/configuracion.js';
import { activarCsrfEnInject } from './csrf-en-tests.js';
import {
  BitacoraFalsa,
  ClientesFalsos,
  ContactosFalsos,
  HorasFalsas,
  SesionesFalsas,
  UsuariosFalsos,
} from './dobles.js';

const CONTRASENA = 'una frase larga y memorable';
const MIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';
/** Secreto de prueba: `direccion` y `responsable` exigen segundo factor. */
const SECRETO_TOTP = 'JBSWY3DPEHPK3PXP';

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
  usuarios: UsuariosFalsos;
  horas: HorasFalsas;
  bitacora: BitacoraFalsa;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const horas = new HorasFalsas();
  const bitacora = new BitacoraFalsa();
  const hash = await hashearContrasena(CONTRASENA);
  const base = {
    activo: true, hashContrasena: hash, secretoTotp: null,
    segundoFactorActivo: false, debeCambiarContrasena: false,
  };

  // `direccion` y `responsable` exigen segundo factor (`rbac.ts`,
  // `ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO`): sin `secretoTotp` la sesión
  // queda pendiente y ninguna ruta real se habilita.
  const con2fa = { secretoTotp: SECRETO_TOTP, segundoFactorActivo: true };

  usuarios.usuarios.push(
    { id: 'usr-direccion', email: 'laura@effort.com.py', rol: 'direccion', veTodosLosClientes: true, ...base, ...con2fa },
    // Dirección con cartera acotada: caso sintético, no el real (el script de
    // alta siempre le da veTodosLosClientes), pero el resumen tiene que
    // respetar el filtro igual si alguna vez se da así.
    { id: 'usr-direccion-acotada', email: 'lilian@effort.com.py', rol: 'direccion', veTodosLosClientes: false, ...base, ...con2fa },
    { id: 'usr-responsable', email: 'responsable@effort.com.py', rol: 'responsable', veTodosLosClientes: false, ...base, ...con2fa },
    { id: 'usr-otro-responsable', email: 'otro@effort.com.py', rol: 'responsable', veTodosLosClientes: false, ...base, ...con2fa },
    { id: 'usr-lectura', email: 'lectura@effort.com.py', rol: 'solo_lectura', veTodosLosClientes: true, ...base },
  );
  usuarios.asignaciones.set('usr-responsable', [MIO]);
  usuarios.asignaciones.set('usr-otro-responsable', [MIO]);
  usuarios.asignaciones.set('usr-direccion-acotada', [MIO]);

  const deps: Dependencias = {
    configuracion,
    usuarios,
    sesiones: new SesionesFalsas(),
    clientes: new ClientesFalsos(),
    contactos: new ContactosFalsos(),
    bitacora,
    horas,
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => new Date(),
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeHoras(app, deps);
  await activarCsrfEnInject(app);

  return { app, usuarios, horas, bitacora };
}

/**
 * Inicia sesión y completa el segundo factor cuando el rol lo exige. Mismo
 * flujo de dos pasos que `test/modulos.test.ts`.
 */
async function acceder(ctx: Contexto, email: string): Promise<string> {
  const respuesta = await ctx.app.inject({
    method: 'POST',
    url: '/api/v1/acceso',
    payload: { email, contrasena: CONTRASENA },
  });
  const cookieObj = respuesta.cookies.find((c) => c.name === nombreCookieSesion());
  if (!cookieObj) throw new Error(`No se pudo iniciar sesión como ${email}: ${respuesta.body}`);
  const cookie = `${cookieObj.name}=${cookieObj.value}`;

  const { segundoFactorRequerido } = JSON.parse(respuesta.body);
  if (segundoFactorRequerido) {
    const usuario = ctx.usuarios.usuarios.find((candidato) => candidato.email === email);
    if (!usuario?.secretoTotp) throw new Error(`Falta secretoTotp para completar el 2FA de ${email}`);

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/acceso/segundo-factor',
      headers: { cookie },
      payload: { codigo: authenticator.generate(usuario.secretoTotp) },
    });
  }

  return cookie;
}

describe('planilla de horas (tarea 144)', () => {
  let ctx: Contexto;

  beforeEach(async () => {
    ctx = await montar();
  });

  it('un responsable carga sus horas de un cliente de su cartera', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/horas',
      headers: { cookie },
      payload: { clienteId: MIO, fecha: '2026-09-20', minutos: 180, tarea: 'Carga de documentos' },
    });

    expect(respuesta.statusCode).toBe(201);
    expect(ctx.horas.registros).toHaveLength(1);
    expect(ctx.horas.registros[0]!.minutos).toBe(180);
  });

  it('cargar el mismo día y cliente otra vez CORRIGE el registro, no lo duplica', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');
    const carga = (minutos: number) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/horas',
        headers: { cookie },
        payload: { clienteId: MIO, fecha: '2026-09-20', minutos, tarea: null },
      });

    await carga(120);
    const segunda = await carga(90);

    expect(segunda.statusCode).toBe(201);
    expect(ctx.horas.registros).toHaveLength(1);
    expect(ctx.horas.registros[0]!.minutos).toBe(90);
  });

  it('no se puede cargar tiempo contra un cliente fuera de la propia cartera', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/horas',
      headers: { cookie },
      payload: { clienteId: AJENO, fecha: '2026-09-20', minutos: 60, tarea: null },
    });

    expect(respuesta.statusCode).toBe(403);
    expect(ctx.horas.registros).toHaveLength(0);
  });

  it('el tiempo interno (sin cliente) no exige cartera', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/horas',
      headers: { cookie },
      payload: { clienteId: null, fecha: '2026-09-20', minutos: 45, tarea: 'Reunión de equipo' },
    });

    expect(respuesta.statusCode).toBe(201);
  });

  it('solo_lectura no puede cargar horas: no hace trabajo facturable', async () => {
    const cookie = await acceder(ctx, 'lectura@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/horas',
      headers: { cookie },
      payload: { clienteId: null, fecha: '2026-09-20', minutos: 30, tarea: null },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('rechaza una fecha futura', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');
    const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const respuesta = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/horas',
      headers: { cookie },
      payload: { clienteId: null, fecha: enUnMes, minutos: 30, tarea: null },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('rechaza minutos en cero o por encima de un turno de 16 horas', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');
    const carga = (minutos: number) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/horas',
        headers: { cookie },
        payload: { clienteId: null, fecha: '2026-09-20', minutos, tarea: null },
      });

    expect((await carga(0)).statusCode).toBe(400);
    expect((await carga(16 * 60 + 1)).statusCode).toBe(400);
  });

  it('cada quien ve solo sus propios registros, nunca los de otra persona', async () => {
    const cookieResponsable = await acceder(ctx, 'responsable@effort.com.py');
    const cookieOtro = await acceder(ctx, 'otro@effort.com.py');

    await ctx.app.inject({
      method: 'POST', url: '/api/v1/horas', headers: { cookie: cookieResponsable },
      payload: { clienteId: MIO, fecha: '2026-09-20', minutos: 60, tarea: null },
    });
    await ctx.app.inject({
      method: 'POST', url: '/api/v1/horas', headers: { cookie: cookieOtro },
      payload: { clienteId: MIO, fecha: '2026-09-20', minutos: 90, tarea: null },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/horas?desde=2026-09-01&hasta=2026-09-30',
      headers: { cookie: cookieResponsable },
    });

    const { registros } = respuesta.json();
    expect(registros).toHaveLength(1);
    expect(registros[0].minutos).toBe(60);
  });

  it('un responsable no puede ver el resumen agregado del equipo', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/horas/resumen?desde=2026-09-01&hasta=2026-09-30',
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('dirección ve el resumen: totales agregados, nunca una fila individual', async () => {
    const cookieResponsable = await acceder(ctx, 'responsable@effort.com.py');
    const cookieDireccion = await acceder(ctx, 'laura@effort.com.py');

    await ctx.app.inject({
      method: 'POST', url: '/api/v1/horas', headers: { cookie: cookieResponsable },
      payload: { clienteId: MIO, fecha: '2026-09-20', minutos: 60, tarea: 'confidencial: no debería salir' },
    });
    await ctx.app.inject({
      method: 'POST', url: '/api/v1/horas', headers: { cookie: cookieResponsable },
      payload: { clienteId: MIO, fecha: '2026-09-21', minutos: 30, tarea: null },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/horas/resumen?desde=2026-09-01&hasta=2026-09-30',
      headers: { cookie: cookieDireccion },
    });

    expect(respuesta.statusCode).toBe(200);
    const { totales } = respuesta.json();
    expect(totales).toEqual([{ usuarioId: 'usr-responsable', clienteId: MIO, minutos: 90 }]);
    // Ninguna fila trae `tarea`, `fecha` ni nada del día a día — solo el total.
    expect(JSON.stringify(totales)).not.toContain('confidencial');
  });

  it('el resumen incluye siempre el tiempo interno, aunque el que consulta tenga cartera acotada', async () => {
    const cookieResponsable = await acceder(ctx, 'responsable@effort.com.py');
    const cookieDireccionAcotada = await acceder(ctx, 'lilian@effort.com.py');

    await ctx.app.inject({
      method: 'POST', url: '/api/v1/horas', headers: { cookie: cookieResponsable },
      payload: { clienteId: null, fecha: '2026-09-20', minutos: 40, tarea: null },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/horas/resumen?desde=2026-09-01&hasta=2026-09-30',
      headers: { cookie: cookieDireccionAcotada },
    });

    const { totales } = respuesta.json();
    expect(totales).toContainEqual({ usuarioId: 'usr-responsable', clienteId: null, minutos: 40 });
  });

  it('deja constancia en la bitácora, con el cliente correcto', async () => {
    const cookie = await acceder(ctx, 'responsable@effort.com.py');

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/horas',
      headers: { cookie },
      payload: { clienteId: MIO, fecha: '2026-09-20', minutos: 60, tarea: null },
    });

    const evento = ctx.bitacora.filas.find((e) => e.accion === 'registro_de_horas.registradas');
    expect(evento?.clienteId).toBe(MIO);
    expect(evento?.usuarioId).toBe('usr-responsable');
  });
});
