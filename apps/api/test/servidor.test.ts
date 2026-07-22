/**
 * Tests de integración del servidor.
 *
 * Ejercitan el servidor completo con `inject`: pasan por las barreras, el
 * resolutor de sesión, el RBAC y el manejador de errores, sin abrir un puerto
 * ni necesitar PostgreSQL.
 */

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeContactos } from '../src/rutas/contactos.js';
import { hashearContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { NOMBRE_COOKIE_SESION } from '../src/seguridad/sesiones.js';
import type { Configuracion } from '../src/configuracion.js';
import {
  BitacoraFalsa,
  BitacoraRota,
  ClientesFalsos,
  ContactosFalsos,
  SesionesFalsas,
  UsuariosFalsos,
} from './dobles.js';
import {
  BalancesFalsos,
  DocumentosFalsos,
  ProcesoMensualFalso,
  VencimientosFalsos,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const CLIENTE_ASIGNADO = '11111111-1111-4111-8111-111111111111';
const CLIENTE_AJENO = '22222222-2222-4222-8222-222222222222';

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
  deps: Dependencias;
  usuarios: UsuariosFalsos;
  clientes: ClientesFalsos;
  contactos: ContactosFalsos;
  bitacora: BitacoraFalsa;
}

async function montar(opciones: { bitacoraRota?: boolean } = {}): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const clientes = new ClientesFalsos();
  const contactos = new ContactosFalsos();
  const bitacora = new BitacoraFalsa();
  const hash = await hashearContrasena(CONTRASENA);

  usuarios.usuarios.push(
    {
      id: 'usr-auxiliar', email: 'aracely@effort.com.py', rol: 'auxiliar', activo: true,
      veTodosLosClientes: false, hashContrasena: hash, secretoTotp: null,
      segundoFactorActivo: false, debeCambiarContrasena: false,
    },
    {
      id: 'usr-direccion', email: 'lili@effort.com.py', rol: 'direccion', activo: true,
      veTodosLosClientes: true, hashContrasena: hash, secretoTotp: 'JBSWY3DPEHPK3PXP',
      segundoFactorActivo: true, debeCambiarContrasena: false,
    },
    {
      id: 'usr-inactivo', email: 'exempleado@effort.com.py', rol: 'coordinador', activo: false,
      veTodosLosClientes: false, hashContrasena: hash, secretoTotp: null,
      segundoFactorActivo: false, debeCambiarContrasena: false,
    },
    {
      id: 'usr-direccion-sin-2fa', email: 'laura@effort.com.py', rol: 'direccion', activo: true,
      veTodosLosClientes: true, hashContrasena: hash, secretoTotp: null,
      segundoFactorActivo: false, debeCambiarContrasena: false,
    },
  );

  usuarios.asignaciones.set('usr-auxiliar', [CLIENTE_ASIGNADO]);

  clientes.clientes.push(
    { id: CLIENTE_ASIGNADO, nombre: 'GARSO S.A.', ruc: '80017726-6', activo: true },
    { id: CLIENTE_AJENO, nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', activo: true },
  );

  const deps: Dependencias = {
    configuracion,
    usuarios,
    sesiones: new SesionesFalsas(),
    clientes,
    contactos,
    bitacora: opciones.bitacoraRota ? new BitacoraRota() : bitacora,
    documentos: new DocumentosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
    vencimientos: new VencimientosFalsos(),
    balances: new BalancesFalsos(),
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => new Date(),
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeContactos(app, deps);
  await app.ready();

  return { app, deps, usuarios, clientes, contactos, bitacora };
}

/** Accede y devuelve la cookie de sesión ya con el segundo factor resuelto. */
async function acceder(ctx: Contexto, email: string): Promise<string> {
  const respuesta = await ctx.app.inject({
    method: 'POST',
    url: '/api/v1/acceso',
    payload: { email, contrasena: CONTRASENA },
  });

  const cookie = respuesta.cookies.find((c) => c.name === NOMBRE_COOKIE_SESION);
  if (!cookie) throw new Error(`El acceso no devolvió cookie: ${respuesta.body}`);
  return `${cookie.name}=${cookie.value}`;
}

let ctx: Contexto;

beforeEach(async () => {
  ctx = await montar();
});

afterEach(async () => {
  await ctx.app.close();
});

/* ------------------------------------------------------------------------- */

describe('cabeceras de seguridad', () => {
  it('la política de contenido no admite scripts en línea', async () => {
    const respuesta = await ctx.app.inject({ method: 'GET', url: '/salud' });
    const csp = respuesta.headers['content-security-policy'] as string;

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('impide que la aplicación se embeba en un iframe ajeno', async () => {
    const respuesta = await ctx.app.inject({ method: 'GET', url: '/salud' });
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
  });

  it('no deja adivinar el tipo de contenido', async () => {
    const respuesta = await ctx.app.inject({ method: 'GET', url: '/salud' });
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
  });

  it('la comprobación de salud no revela nada del sistema', async () => {
    const respuesta = await ctx.app.inject({ method: 'GET', url: '/salud' });
    expect(JSON.parse(respuesta.body)).toEqual({ estado: 'ok' });
  });
});

describe('CORS', () => {
  it('acepta el origen configurado', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/salud', headers: { origin: 'http://localhost:5173' },
    });
    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('no refleja un origen ajeno', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/salud', headers: { origin: 'https://sitio-malicioso.com' },
    });
    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('acceso', () => {
  it('concede acceso con credenciales correctas y entrega cookie httpOnly', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: CONTRASENA },
    });

    expect(respuesta.statusCode).toBe(200);
    const cookie = respuesta.cookies.find((c) => c.name === NOMBRE_COOKIE_SESION);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
  });

  it('rechaza una contraseña incorrecta', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: 'otra cosa cualquiera' },
    });
    expect(respuesta.statusCode).toBe(401);
  });

  it('da el mismo mensaje para un correo inexistente que para una contraseña mala', async () => {
    const inexistente = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'nadie@effort.com.py', contrasena: CONTRASENA },
    });
    const malaContrasena = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: 'incorrecta pero larga' },
    });

    expect(inexistente.statusCode).toBe(malaContrasena.statusCode);
    expect(JSON.parse(inexistente.body).mensaje).toBe(JSON.parse(malaContrasena.body).mensaje);
  });

  it('un usuario desactivado no puede entrar', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'exempleado@effort.com.py', contrasena: CONTRASENA },
    });
    expect(respuesta.statusCode).toBe(401);
  });

  it('dirección queda con el segundo factor pendiente', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'lili@effort.com.py', contrasena: CONTRASENA },
    });
    expect(JSON.parse(respuesta.body).segundoFactorRequerido).toBe(true);
  });

  it('la sesión con segundo factor pendiente no habilita ninguna ruta', async () => {
    const cookie = await acceder(ctx, 'lili@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/clientes', headers: { cookie },
    });
    expect(respuesta.statusCode).toBe(401);
  });

  it('dirección sin segundo factor configurado no puede acceder', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'laura@effort.com.py', contrasena: CONTRASENA },
    });
    expect(respuesta.statusCode).toBe(403);
    expect(JSON.parse(respuesta.body).error).toBe('segundo_factor_no_configurado');
  });

  it('bloquea tras cinco intentos fallidos', async () => {
    for (let intento = 0; intento < 5; intento += 1) {
      await ctx.app.inject({
        method: 'POST', url: '/api/v1/acceso',
        payload: { email: 'aracely@effort.com.py', contrasena: 'incorrecta pero larga' },
      });
    }

    const bloqueado = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: CONTRASENA },
    });

    // Ni siquiera con la contraseña correcta: el bloqueo es del intento, no de la credencial.
    expect(bloqueado.statusCode).toBe(429);
  });

  it('cerrar sesión revoca la sesión y borra la cookie', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');

    const salida = await ctx.app.inject({ method: 'POST', url: '/api/v1/salida', headers: { cookie } });
    expect(salida.statusCode).toBe(200);

    const despues = await ctx.app.inject({
      method: 'GET', url: '/api/v1/clientes', headers: { cookie },
    });
    expect(despues.statusCode).toBe(401);
  });

  it('sin cookie no se accede a ninguna ruta de datos', async () => {
    const respuesta = await ctx.app.inject({ method: 'GET', url: '/api/v1/clientes' });
    expect(respuesta.statusCode).toBe(401);
  });

  it('una cookie inventada no sirve', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/clientes',
      headers: { cookie: `${NOMBRE_COOKIE_SESION}=token-inventado` },
    });
    expect(respuesta.statusCode).toBe(401);
  });
});

describe('alcance por cartera en las rutas', () => {
  it('el auxiliar solo ve los clientes que tiene asignados', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/clientes', headers: { cookie },
    });

    const { clientes } = JSON.parse(respuesta.body);
    expect(clientes).toHaveLength(1);
    expect(clientes[0].id).toBe(CLIENTE_ASIGNADO);
  });

  it('pedir un cliente ajeno devuelve 404, no 403: su existencia no se confirma', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'GET', url: `/api/v1/clientes/${CLIENTE_AJENO}`, headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.body).not.toContain('AJENO');
  });

  it('no se pueden leer los contactos de un cliente ajeno', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'GET', url: `/api/v1/clientes/${CLIENTE_AJENO}/contactos`, headers: { cookie },
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('no se puede registrar un contacto en un cliente ajeno', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${CLIENTE_AJENO}/contactos`, headers: { cookie },
      payload: {
        clienteId: CLIENTE_AJENO, periodo: '2026-03', canal: 'LLAMADA',
        ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: false,
        resumen: 'Intento de registrar en cliente ajeno.',
      },
    });
    expect(respuesta.statusCode).toBe(403);
    expect(ctx.contactos.contactos).toHaveLength(0);
  });

  it('no se puede apuntar el contacto a otro cliente desde el cuerpo', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${CLIENTE_ASIGNADO}/contactos`, headers: { cookie },
      payload: {
        clienteId: CLIENTE_AJENO, periodo: '2026-03', canal: 'LLAMADA',
        ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: false,
        resumen: 'Ruta con un cliente, cuerpo con otro.',
      },
    });

    expect(respuesta.statusCode).toBe(400);
    expect(ctx.contactos.contactos).toHaveLength(0);
  });
});

describe('registro de contactos', () => {
  it('registra un contacto válido y lo marca como manual', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${CLIENTE_ASIGNADO}/contactos`, headers: { cookie },
      payload: {
        clienteId: CLIENTE_ASIGNADO, periodo: '2026-03', canal: 'LLAMADA',
        ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: true,
        quienAtendio: 'Sra. González', resumen: 'Se pidieron las facturas de marzo.',
      },
    });

    expect(respuesta.statusCode).toBe(201);
    const { contacto } = JSON.parse(respuesta.body);
    expect(contacto.origenContacto).toBe('MANUAL');
    // Se atribuye a quien tiene la sesión, no a lo que diga el cuerpo.
    expect(contacto.registradoPorUsuarioId).toBe('usr-auxiliar');
  });

  it('rechaza un contacto con respuesta pero sin quién atendió', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${CLIENTE_ASIGNADO}/contactos`, headers: { cookie },
      payload: {
        clienteId: CLIENTE_ASIGNADO, periodo: '2026-03', canal: 'LLAMADA',
        ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: true,
        resumen: 'Atendieron pero no digo quién.',
      },
    });

    expect(respuesta.statusCode).toBe(400);
    expect(JSON.parse(respuesta.body).error).toBe('validacion');
  });

  it('rechaza campos desconocidos en el cuerpo', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${CLIENTE_ASIGNADO}/contactos`, headers: { cookie },
      payload: {
        clienteId: CLIENTE_ASIGNADO, periodo: '2026-03', canal: 'LLAMADA',
        ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: false,
        resumen: 'Con un campo de más.',
        origenContacto: 'AUTOMATICO',
      },
    });

    // Sin .strict(), esto habría dejado que un usuario marque un contacto suyo
    // como enviado por el sistema, que es evidencia de otra naturaleza.
    expect(respuesta.statusCode).toBe(400);
  });

  it('cada registro deja una entrada en la bitácora', async () => {
    const cookie = await acceder(ctx, 'aracely@effort.com.py');
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${CLIENTE_ASIGNADO}/contactos`, headers: { cookie },
      payload: {
        clienteId: CLIENTE_ASIGNADO, periodo: '2026-03', canal: 'WHATSAPP',
        ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: false,
        resumen: 'Mensaje sin respuesta.',
      },
    });

    expect(ctx.bitacora.accionesRegistradas()).toContain('contacto.registrado');
  });

  it('la bitácora no guarda datos sensibles del acceso', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      payload: { email: 'aracely@effort.com.py', contrasena: CONTRASENA },
    });

    const serializada = JSON.stringify(ctx.bitacora.filas);
    expect(serializada).not.toContain(CONTRASENA);
    expect(serializada).not.toContain('$argon2id$');
  });

  it('la IP se guarda truncada', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso', remoteAddress: '190.128.50.77',
      payload: { email: 'aracely@effort.com.py', contrasena: CONTRASENA },
    });

    const fila = ctx.bitacora.filas.at(-1);
    expect(fila?.ipTruncada).toBe('190.128.50.0');
  });
});

describe('resistencia', () => {
  it('si la bitácora falla, la operación de negocio igual se completa', async () => {
    const conBitacoraRota = await montar({ bitacoraRota: true });

    try {
      const cookie = await acceder(conBitacoraRota, 'aracely@effort.com.py');
      const respuesta = await conBitacoraRota.app.inject({
        method: 'POST',
        url: `/api/v1/clientes/${CLIENTE_ASIGNADO}/contactos`,
        headers: { cookie },
        payload: {
          clienteId: CLIENTE_ASIGNADO, periodo: '2026-03', canal: 'LLAMADA',
          ocurridoEn: '2026-04-10T13:00:00Z', huboRespuesta: false,
          resumen: 'La bitácora está caída pero el contacto se registra igual.',
        },
      });

      expect(respuesta.statusCode).toBe(201);
    } finally {
      await conBitacoraRota.app.close();
    }
  });

  it('una ruta inexistente responde 404 sin detalles', async () => {
    const respuesta = await ctx.app.inject({ method: 'GET', url: '/api/v1/inventado' });
    expect(respuesta.statusCode).toBe(404);
    expect(JSON.parse(respuesta.body)).toEqual({
      error: 'no_encontrado', mensaje: 'Recurso inexistente.',
    });
  });

  it('un cuerpo que no es JSON válido no rompe el servidor', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso',
      headers: { 'content-type': 'application/json' },
      payload: '{roto',
    });
    expect(respuesta.statusCode).toBeGreaterThanOrEqual(400);
    expect(respuesta.statusCode).toBeLessThan(500);
  });
});
