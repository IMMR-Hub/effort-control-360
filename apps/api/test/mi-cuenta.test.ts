/**
 * Credenciales propias: alta del segundo factor y cambio de contraseña.
 *
 * Se prueba contra el servidor entero (`inject`), no contra las funciones
 * sueltas: lo que importa acá no es que una función devuelva lo correcto, sino
 * que la sesión habilite exactamente lo que tiene que habilitar y nada más.
 */

import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { beforeEach, describe, expect, it } from 'vitest';

import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeClientes } from '../src/rutas/clientes.js';
import { registrarRutasDeMiCuenta } from '../src/rutas/mi-cuenta.js';
import { hashearContrasena, verificarContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { nombreCookieSesion } from '../src/seguridad/sesiones.js';
import type { Configuracion } from '../src/configuracion.js';
import { activarCsrfEnInject } from './csrf-en-tests.js';
import {
  BitacoraFalsa,
  ClientesFalsos,
  ContactosFalsos,
  SesionesFalsas,
  UsuariosFalsos,
  clienteMinimo,
} from './dobles.js';
import {
  BalancesFalsos,
  DocumentosFalsos,
  ProcesoMensualFalso,
  VencimientosFalsos,
  ExportacionesSigaFalsas,
  LiquidacionesFalsas,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const CONTRASENA_NUEVA = 'otra frase distinta y larga';
const CLIENTE = '11111111-1111-4111-8111-111111111111';

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
  sesiones: SesionesFalsas;
  bitacora: BitacoraFalsa;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const sesiones = new SesionesFalsas();
  const bitacora = new BitacoraFalsa();
  const clientes = new ClientesFalsos();
  const hash = await hashearContrasena(CONTRASENA);

  usuarios.usuarios.push(
    // Segundo factor obligatorio por su rol y todavía sin configurar.
    {
      id: 'usr-sin-2fa', email: 'laura@effort.com.py', rol: 'direccion', activo: true,
      veTodosLosClientes: true, hashContrasena: hash, secretoTotp: null,
      segundoFactorActivo: false, debeCambiarContrasena: false,
    },
    // Sin segundo factor obligatorio: entra directo, sirve para probar el
    // cambio de contraseña sin arrastrar el alta del segundo factor.
    {
      id: 'usr-auxiliar', email: 'aracely@effort.com.py', rol: 'auxiliar', activo: true,
      veTodosLosClientes: true, hashContrasena: hash, secretoTotp: null,
      segundoFactorActivo: false, debeCambiarContrasena: false,
    },
    // Con la contraseña por cambiar: no debería poder hacer nada más.
    {
      id: 'usr-estrena', email: 'nueva@effort.com.py', rol: 'auxiliar', activo: true,
      veTodosLosClientes: true, hashContrasena: hash, secretoTotp: null,
      segundoFactorActivo: false, debeCambiarContrasena: true,
    },
  );

  clientes.clientes.push(clienteMinimo({ id: CLIENTE, nombre: 'GARSO S.A.', ruc: '80017726-6', activo: true }));

  const deps: Dependencias = {
    configuracion,
    usuarios,
    sesiones,
    clientes,
    contactos: new ContactosFalsos(),
    bitacora,
    documentos: new DocumentosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
    vencimientos: new VencimientosFalsos(),
    balances: new BalancesFalsos(),
    exportacionesSiga: new ExportacionesSigaFalsas(),
    liquidaciones: new LiquidacionesFalsas(),
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => new Date(),
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeClientes(app, deps);
  await registrarRutasDeMiCuenta(app, deps);
  await app.ready();
  await activarCsrfEnInject(app);

  return { app, usuarios, sesiones, bitacora };
}

/** Entra con contraseña y devuelve la cookie, sin resolver el segundo factor. */
async function acceder(ctx: Contexto, email: string, contrasena = CONTRASENA): Promise<string> {
  const respuesta = await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso', payload: { email, contrasena },
  });

  const galleta = respuesta.cookies.find((c) => c.name === nombreCookieSesion(false));
  if (!galleta) throw new Error(`El acceso no devolvió cookie: ${respuesta.body}`);
  return `${galleta.name}=${galleta.value}`;
}

let ctx: Contexto;

beforeEach(async () => {
  ctx = await montar();
});

describe('alta del segundo factor', () => {
  it('entrega un secreto a quien lo tiene pendiente, y no lo escribe en la bitácora', async () => {
    const cookie = await acceder(ctx, 'laura@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/segundo-factor', headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(200);
    const { secreto, url } = JSON.parse(respuesta.body);
    expect(secreto).toMatch(/^[A-Z2-7]+$/);
    expect(url).toContain('otpauth://totp/');

    // El secreto es la credencial: si aparece en la bitácora, la bitácora pasa
    // a ser el lugar más peligroso de la base.
    expect(JSON.stringify(ctx.bitacora.filas)).not.toContain(secreto);
    expect(ctx.bitacora.accionesRegistradas()).toContain('usuario.segundo_factor_iniciado');
  });

  it('confirmar con un código válido activa el segundo factor y habilita la sesión', async () => {
    const cookie = await acceder(ctx, 'laura@effort.com.py');

    const alta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/segundo-factor', headers: { cookie },
    });
    const { secreto } = JSON.parse(alta.body);

    // Antes de confirmar, la sesión sigue sin habilitar nada.
    const antes = await ctx.app.inject({ method: 'GET', url: '/api/v1/clientes', headers: { cookie } });
    expect(antes.statusCode).toBe(401);

    const confirmacion = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/segundo-factor/confirmar', headers: { cookie },
      payload: { codigo: authenticator.generate(secreto) },
    });
    expect(confirmacion.statusCode).toBe(200);

    const usuario = ctx.usuarios.usuarios.find((u) => u.id === 'usr-sin-2fa');
    expect(usuario?.segundoFactorActivo).toBe(true);

    // Y ahora sí, la misma sesión sirve: probó contraseña y segundo factor.
    const despues = await ctx.app.inject({ method: 'GET', url: '/api/v1/clientes', headers: { cookie } });
    expect(despues.statusCode).toBe(200);
  });

  it('un código incorrecto no activa nada y deja la sesión sin habilitar', async () => {
    const cookie = await acceder(ctx, 'laura@effort.com.py');
    await ctx.app.inject({ method: 'POST', url: '/api/v1/mi/segundo-factor', headers: { cookie } });

    const confirmacion = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/segundo-factor/confirmar', headers: { cookie },
      payload: { codigo: '000000' },
    });

    expect(confirmacion.statusCode).toBe(401);
    expect(ctx.usuarios.usuarios.find((u) => u.id === 'usr-sin-2fa')?.segundoFactorActivo).toBe(false);

    const protegida = await ctx.app.inject({ method: 'GET', url: '/api/v1/clientes', headers: { cookie } });
    expect(protegida.statusCode).toBe(401);
  });

  it('no se puede pedir un secreto nuevo si ya hay uno configurado', async () => {
    const cookie = await acceder(ctx, 'laura@effort.com.py');
    await ctx.app.inject({ method: 'POST', url: '/api/v1/mi/segundo-factor', headers: { cookie } });

    // Regenerarlo con la sesión de la víctima es justo el ataque que el
    // segundo factor tiene que frenar.
    const segundo = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/segundo-factor', headers: { cookie },
    });

    expect(segundo.statusCode).toBe(409);
    expect(JSON.parse(segundo.body).error).toBe('segundo_factor_ya_configurado');
  });

  it('sin sesión no se puede empezar el alta', async () => {
    const respuesta = await ctx.app.inject({ method: 'POST', url: '/api/v1/mi/segundo-factor' });
    expect(respuesta.statusCode).toBe(401);
  });
});

describe('cambio de contraseña propia', () => {
  it('cambia la contraseña y cierra todas las sesiones', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/contrasena', headers: { cookie },
      payload: { contrasenaActual: CONTRASENA, contrasenaNueva: CONTRASENA_NUEVA },
    });

    expect(respuesta.statusCode).toBe(200);

    const usuario = ctx.usuarios.usuarios.find((u) => u.id === 'usr-auxiliar');
    expect(await verificarContrasena(CONTRASENA_NUEVA, usuario!.hashContrasena)).toBe(true);
    expect(usuario?.debeCambiarContrasena).toBe(false);

    // Si alguien más conocía la contraseña vieja y tenía sesión abierta, el
    // cambio tiene que echarlo. Incluida la sesión desde la que se cambió.
    const despues = await ctx.app.inject({ method: 'GET', url: '/api/v1/clientes', headers: { cookie } });
    expect(despues.statusCode).toBe(401);
  });

  it('la contraseña vieja deja de servir y la nueva sirve', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/contrasena', headers: { cookie },
      payload: { contrasenaActual: CONTRASENA, contrasenaNueva: CONTRASENA_NUEVA },
    });

    const conLaVieja = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: CONTRASENA },
    });
    expect(conLaVieja.statusCode).toBe(401);

    const conLaNueva = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: CONTRASENA_NUEVA },
    });
    expect(conLaNueva.statusCode).toBe(200);
  });

  it('rechaza si la contraseña actual no es correcta', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/contrasena', headers: { cookie },
      payload: { contrasenaActual: 'no es la que corresponde', contrasenaNueva: CONTRASENA_NUEVA },
    });

    expect(respuesta.statusCode).toBe(401);
    const usuario = ctx.usuarios.usuarios.find((u) => u.id === 'usr-auxiliar');
    expect(await verificarContrasena(CONTRASENA, usuario!.hashContrasena)).toBe(true);
  });

  it('rechaza una contraseña nueva igual a la actual', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/contrasena', headers: { cookie },
      payload: { contrasenaActual: CONTRASENA, contrasenaNueva: CONTRASENA },
    });

    expect(respuesta.statusCode).toBe(400);
    expect(JSON.parse(respuesta.body).error).toBe('contrasena_sin_cambio');
  });

  it('rechaza una contraseña nueva demasiado previsible', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/contrasena', headers: { cookie },
      payload: { contrasenaActual: CONTRASENA, contrasenaNueva: 'effort2026seguro' },
    });

    expect(respuesta.statusCode).toBe(400);
    expect(JSON.parse(respuesta.body).error).toBe('contrasena_debil');
  });
});

describe('contraseña por cambiar', () => {
  it('no habilita ninguna ruta de negocio', async () => {
    const cookie = await acceder(ctx, 'nueva@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/clientes', headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(403);
    expect(JSON.parse(respuesta.body).error).toBe('contrasena_por_cambiar');
  });

  it('pero sí habilita cambiar la contraseña, que es la salida', async () => {
    const cookie = await acceder(ctx, 'nueva@effort.com.py');

    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/mi/contrasena', headers: { cookie },
      payload: { contrasenaActual: CONTRASENA, contrasenaNueva: CONTRASENA_NUEVA },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(ctx.usuarios.usuarios.find((u) => u.id === 'usr-estrena')?.debeCambiarContrasena).toBe(false);
  });
});
