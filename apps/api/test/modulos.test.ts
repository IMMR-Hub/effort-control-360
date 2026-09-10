/**
 * Tests de los módulos de negocio: documentos, proceso mensual, vencimientos,
 * balances y alertas.
 *
 * Ejercitan el servidor completo con dobles de persistencia. Lo que se prueba
 * acá es el comportamiento de las rutas: permisos, alcance de cartera,
 * validación, reglas de negocio y bitácora. El SQL de cada repositorio se
 * prueba aparte, en `test/integracion/`.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { calcularDigitoVerificadorRuc } from '@effort/schema';

import type { AlertaAlmacenada } from '../src/puertos-dominio.js';
import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeDocumentos } from '../src/rutas/documentos.js';
import { registrarRutasDeVencimientos } from '../src/rutas/vencimientos.js';
import { registrarRutasDeSolicitudes } from '../src/rutas/solicitudes.js';
import { registrarRutasDeBalances } from '../src/rutas/balances.js';
import { registrarRutasDeAlertas } from '../src/rutas/alertas.js';
import { registrarRutasDeUsuarios } from '../src/rutas/usuarios.js';
import { registrarRutasDeReglasImpositivas } from '../src/rutas/reglas-impositivas.js';
import { registrarRutasDeReglasDeNotificacion } from '../src/rutas/reglas-notificacion.js';
import { registrarRutasDeEventos } from '../src/rutas/eventos.js';
import { registrarRutasDeClientes } from '../src/rutas/clientes.js';
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
  SesionesFalsas,
  UsuariosFalsos,
} from './dobles.js';
import {
  AlertasFalsas,
  BalancesFalsos,
  DocumentosFalsos,
  ProcesoMensualFalso,
  ReglasDeNotificacionFalsas,
  ReglasImpositivasFalsas,
  SolicitudesFalsas,
  VencimientosFalsos,
  ExportacionesSigaFalsas,
  LiquidacionesFalsas,
  ObligacionesFalsas,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const MIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';
/** Secreto de prueba para completar el segundo factor de dirección. */
const SECRETO_TOTP_DIRECCION = 'JBSWY3DPEHPK3PXP';

/** Reloj congelado: los días restantes de un vencimiento deben ser deterministas. */
const HOY = new Date('2026-04-21T13:00:00Z');

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
  documentos: DocumentosFalsos;
  procesoMensual: ProcesoMensualFalso;
  vencimientos: VencimientosFalsos;
  obligaciones: ObligacionesFalsas;
  solicitudes: SolicitudesFalsas;
  balances: BalancesFalsos;
  alertas: AlertasFalsas;
  usuarios: UsuariosFalsos;
  reglasImpositivas: ReglasImpositivasFalsas;
  reglasDeNotificacion: ReglasDeNotificacionFalsas;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const clientes = new ClientesFalsos();
  const bitacora = new BitacoraFalsa();
  const documentos = new DocumentosFalsos();
  const procesoMensual = new ProcesoMensualFalso();
  const vencimientos = new VencimientosFalsos();
  const obligaciones = new ObligacionesFalsas();
  const solicitudes = new SolicitudesFalsas();
  const balances = new BalancesFalsos();
  const alertas = new AlertasFalsas();
  const reglasImpositivas = new ReglasImpositivasFalsas();
  const reglasDeNotificacion = new ReglasDeNotificacionFalsas();
  const hash = await hashearContrasena(CONTRASENA);

  const base = {
    activo: true, hashContrasena: hash, secretoTotp: null,
    segundoFactorActivo: false, debeCambiarContrasena: false,
  };

  usuarios.usuarios.push(
    {
      id: 'usr-direccion', email: 'laura@effort.com.py', rol: 'direccion', veTodosLosClientes: true,
      ...base, secretoTotp: SECRETO_TOTP_DIRECCION, segundoFactorActivo: true,
    },
    {
      id: 'usr-responsable', email: 'responsable@effort.com.py', rol: 'responsable', veTodosLosClientes: true,
      ...base, secretoTotp: SECRETO_TOTP_DIRECCION, segundoFactorActivo: true,
    },
    { id: 'usr-auxiliar', email: 'aracely@effort.com.py', rol: 'auxiliar', veTodosLosClientes: false, ...base },
    { id: 'usr-coordinador', email: 'karina@effort.com.py', rol: 'coordinador', veTodosLosClientes: false, ...base },
    { id: 'usr-revisor', email: 'revisor@effort.com.py', rol: 'revisor_balance', veTodosLosClientes: true, ...base },
    { id: 'usr-lectura', email: 'lectura@effort.com.py', rol: 'solo_lectura', veTodosLosClientes: true, ...base },
  );

  usuarios.asignaciones.set('usr-auxiliar', [MIO]);
  usuarios.asignaciones.set('usr-coordinador', [MIO]);

  clientes.clientes.push(
    clienteMinimo({ id: MIO, nombre: 'GARSO S.A.', ruc: '80017726-6', activo: true }),
    clienteMinimo({ id: AJENO, nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', activo: true }),
  );

  const deps: Dependencias = {
    configuracion,
    usuarios,
    sesiones: new SesionesFalsas(),
    clientes,
    contactos: new ContactosFalsos(),
    bitacora,
    documentos,
    procesoMensual,
    vencimientos,
    obligaciones,
    solicitudes,
    balances,
    exportacionesSiga: new ExportacionesSigaFalsas(),
    liquidaciones: new LiquidacionesFalsas(),
    alertas,
    reglasImpositivas,
    reglasDeNotificacion,
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => HOY,
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeDocumentos(app, deps);
  await registrarRutasDeVencimientos(app, deps);
  await registrarRutasDeSolicitudes(app, deps);
  await registrarRutasDeBalances(app, deps);
  await registrarRutasDeAlertas(app, deps);
  await registrarRutasDeUsuarios(app, deps);
  await registrarRutasDeReglasImpositivas(app, deps);
  await registrarRutasDeReglasDeNotificacion(app, deps);
  await registrarRutasDeEventos(app, deps);
  await registrarRutasDeClientes(app, deps);
  await app.ready();
  await activarCsrfEnInject(app);

  return {
    app, bitacora, documentos, procesoMensual, vencimientos, obligaciones, solicitudes, balances, alertas,
    usuarios, reglasImpositivas, reglasDeNotificacion,
  };
}

/**
 * Accede y, si el rol exige segundo factor, lo completa con un código TOTP
 * real generado a partir del secreto de la persona — la sesión no queda
 * `VIGENTE` para el resto de las pruebas hasta que eso pasa.
 */
async function acceder(ctx: Contexto, email: string): Promise<string> {
  const respuesta = await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso', payload: { email, contrasena: CONTRASENA },
  });
  const cookieObj = respuesta.cookies.find((c) => c.name === nombreCookieSesion(false));
  if (!cookieObj) throw new Error(`Sin cookie: ${respuesta.body}`);
  const cookie = `${cookieObj.name}=${cookieObj.value}`;

  const { segundoFactorRequerido } = JSON.parse(respuesta.body);
  if (segundoFactorRequerido) {
    const usuario = ctx.usuarios.usuarios.find((candidato) => candidato.email === email);
    if (!usuario?.secretoTotp) throw new Error(`Falta secretoTotp para completar el 2FA de ${email}`);

    const codigo = authenticator.generate(usuario.secretoTotp);
    await ctx.app.inject({
      method: 'POST', url: '/api/v1/acceso/segundo-factor',
      headers: { cookie }, payload: { codigo },
    });
  }

  return cookie;
}

let ctx: Contexto;
let direccion = '';
let responsable = '';
let auxiliar = '';
let coordinador = '';
let revisor = '';
let soloLectura = '';

beforeEach(async () => {
  ctx = await montar();
  direccion = await acceder(ctx, 'laura@effort.com.py');
  responsable = await acceder(ctx, 'responsable@effort.com.py');
  auxiliar = await acceder(ctx, 'aracely@effort.com.py');
  coordinador = await acceder(ctx, 'karina@effort.com.py');
  revisor = await acceder(ctx, 'revisor@effort.com.py');
  soloLectura = await acceder(ctx, 'lectura@effort.com.py');
});

afterEach(async () => {
  await ctx.app.close();
});

/* ========================================================================== */

describe('documentos', () => {
  const comprobante = {
    periodo: '2026-03',
    tipo: 'FACTURA_COMPRA',
    canalRecepcion: 'WHATSAPP',
    recibidoEn: '2026-04-05T12:00:00Z',
    rucEmisor: '80017726-6',
    timbrado: '12345678',
    numeroComprobante: '001-001-0000001',
    total: '1100000',
    tasa: 'DIEZ',
  };

  it('registra un comprobante y devuelve el importe como texto, no como número', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: auxiliar }, payload: comprobante,
    });

    expect(respuesta.statusCode).toBe(201);
    const { documento } = JSON.parse(respuesta.body);

    // Si viajara como número, un importe grande perdería precisión en el JSON.
    expect(documento.total).toBe('1100000');
    expect(typeof documento.total).toBe('string');
  });

  it('exige la terna completa de identificación del comprobante', async () => {
    // Sin timbrado ni número, el comprobante no se puede conciliar contra SIGA
    // ni detectar como duplicado.
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: auxiliar },
      payload: { ...comprobante, timbrado: null, numeroComprobante: null },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('acepta un documento sin identificación de comprobante (un contrato, un acta)', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: auxiliar },
      payload: {
        periodo: '2026-03', tipo: 'CONTRATO', canalRecepcion: 'EMAIL',
        recibidoEn: '2026-04-05T12:00:00Z',
        rucEmisor: null, timbrado: null, numeroComprobante: null,
        total: null, tasa: null,
      },
    });

    expect(respuesta.statusCode).toBe(201);
  });

  it('un documento con importe debe declarar su tasa de IVA', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: auxiliar }, payload: { ...comprobante, tasa: null },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('no se pueden cargar documentos en un cliente ajeno', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${AJENO}/documentos`,
      headers: { cookie: auxiliar }, payload: comprobante,
    });

    expect(respuesta.statusCode).toBe(403);
    expect(ctx.documentos.documentos).toHaveLength(0);
  });

  it('solo_lectura no puede cargar documentos', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: soloLectura }, payload: comprobante,
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('rechazar un documento exige explicar por qué', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: auxiliar }, payload: comprobante,
    });
    const { documento } = JSON.parse(alta.body);

    const sinMotivo = await ctx.app.inject({
      method: 'PATCH', url: `/api/v1/documentos/${documento.id}/estado`,
      headers: { cookie: coordinador }, payload: { estado: 'RECHAZADO' },
    });
    expect(sinMotivo.statusCode).toBe(400);

    const conMotivo = await ctx.app.inject({
      method: 'PATCH', url: `/api/v1/documentos/${documento.id}/estado`,
      headers: { cookie: coordinador },
      payload: { estado: 'RECHAZADO', motivoRechazo: 'Comprobante ilegible.' },
    });
    expect(conMotivo.statusCode).toBe(200);
  });

  it('el cambio de estado queda en la bitácora con el valor anterior', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: auxiliar }, payload: comprobante,
    });
    const { documento } = JSON.parse(alta.body);

    await ctx.app.inject({
      method: 'PATCH', url: `/api/v1/documentos/${documento.id}/estado`,
      headers: { cookie: coordinador }, payload: { estado: 'CARGADO_EN_SIGA' },
    });

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'documento.cambio_estado');
    expect(entrada).toBeDefined();
    expect((entrada?.datosAntes as Record<string, unknown>)['estado']).toBe('RECIBIDO');
    expect((entrada?.datosDespues as Record<string, unknown>)['estado']).toBe('CARGADO_EN_SIGA');
  });
});

/* ========================================================================== */

describe('proceso mensual', () => {
  it('editar un período que nadie abrió lo crea al vuelo', async () => {
    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: coordinador },
      payload: { comprobantesRetirados: true, documentosRecibidos: 42 },
    });

    expect(respuesta.statusCode).toBe(200);
    const { proceso } = JSON.parse(respuesta.body);
    expect(proceso.comprobantesRetirados).toBe(true);
    expect(proceso.documentosRecibidos).toBe(42);
  });

  it('el IVA no puede quedar a pagar y a favor al mismo tiempo', async () => {
    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: coordinador },
      payload: { ivaSaldoAPagar: '500000', ivaSaldoAFavor: '300000' },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('acepta saldo a pagar con el otro en cero', async () => {
    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: coordinador },
      payload: { ivaSaldoAPagar: '500000', ivaSaldoAFavor: '0' },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(JSON.parse(respuesta.body).proceso.ivaSaldoAPagar).toBe('500000');
  });

  it('rechaza campos que no existen en el proceso mensual', async () => {
    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: coordinador },
      payload: { clienteId: AJENO, comprobantesRetirados: true },
    });

    // clienteId no es editable: mover un mes de un cliente a otro no es una edición.
    expect(respuesta.statusCode).toBe(400);
  });

  it('el tablero del período solo trae los clientes de la cartera', async () => {
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: coordinador }, payload: { comprobantesRetirados: true },
    });
    ctx.procesoMensual.procesos.push({
      ...ctx.procesoMensual.procesos[0]!, id: 'otro', clienteId: AJENO,
    });

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/proceso-mensual/2026-03', headers: { cookie: coordinador },
    });

    const { procesos } = JSON.parse(respuesta.body);
    expect(procesos).toHaveLength(1);
    expect(procesos[0].clienteId).toBe(MIO);
  });

  it('un auxiliar puede editar el proceso, un solo_lectura no', async () => {
    const conAuxiliar = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: auxiliar }, payload: { documentosRecibidos: 10 },
    });
    expect(conAuxiliar.statusCode).toBe(200);

    const conLectura = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/proceso-mensual/2026-03`,
      headers: { cookie: soloLectura }, payload: { documentosRecibidos: 10 },
    });
    expect(conLectura.statusCode).toBe(403);
  });
});

/* ========================================================================== */

describe('radar de vencimientos', () => {
  const abogacia = {
    tipoDocumento: 'CONSTANCIA',
    descripcion: 'Presentación anual ante Abogacía',
    entidad: 'Abogacía del Tesoro',
    fechaVencimiento: '2026-04-28',
    riesgo: 'CRITICO',
  };

  it('calcula los días restantes en zona Paraguay, no en la del navegador', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador }, payload: abogacia,
    });

    expect(respuesta.statusCode).toBe(201);
    const { vencimiento } = JSON.parse(respuesta.body);

    // Del 21 al 28 de abril de 2026 hay 7 días.
    expect(vencimiento.diasRestantes).toBe(7);
    expect(vencimiento.nivelAlerta).toBe('ALTA');
  });

  it('clasifica el nivel de alerta según los días que faltan', async () => {
    // Umbrales: critica <= 2, alta <= 7, media <= 15, informativa <= 30.
    const fechas: Array<[string, number, string]> = [
      ['2026-04-19', -2, 'VENCIDO'],
      ['2026-04-22', 1, 'CRITICA'],
      ['2026-04-23', 2, 'CRITICA'],
      ['2026-04-27', 6, 'ALTA'],
      ['2026-04-28', 7, 'ALTA'],
      ['2026-04-30', 9, 'MEDIA'],
      ['2026-05-06', 15, 'MEDIA'],
      ['2026-05-07', 16, 'INFORMATIVA'],
      ['2026-05-21', 30, 'INFORMATIVA'],
      ['2026-05-22', 31, 'SIN_ALERTA'],
    ];

    for (const [fecha, dias, nivel] of fechas) {
      const respuesta = await ctx.app.inject({
        method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
        headers: { cookie: coordinador },
        payload: { ...abogacia, fechaVencimiento: fecha },
      });

      const { vencimiento } = JSON.parse(respuesta.body);
      expect(vencimiento.diasRestantes, `fecha ${fecha}`).toBe(dias);
      expect(vencimiento.nivelAlerta, `fecha ${fecha}`).toBe(nivel);
    }
  });

  it('el radar resume cuántos hay en cada nivel', async () => {
    for (const fecha of ['2026-04-19', '2026-04-22', '2026-04-30']) {
      await ctx.app.inject({
        method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
        headers: { cookie: coordinador },
        payload: { ...abogacia, fechaVencimiento: fecha },
      });
    }

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/vencimientos', headers: { cookie: coordinador },
    });

    const { resumen, vencimientos } = JSON.parse(respuesta.body);
    expect(resumen.VENCIDO).toBe(1); // 19/04, dos días atrás
    expect(resumen.CRITICA).toBe(1); // 22/04, mañana
    expect(resumen.MEDIA).toBe(1); //   30/04, en nueve días

    // Ordenado por urgencia: lo que ya venció va primero.
    expect(vencimientos[0].fechaVencimiento).toBe('2026-04-19');
  });

  it('rechaza una emisión posterior al vencimiento', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador },
      payload: { ...abogacia, fechaEmision: '2026-05-01' },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('marcar como presentado saca la obligación del radar', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador }, payload: abogacia,
    });
    const { vencimiento } = JSON.parse(alta.body);

    const presentar = await ctx.app.inject({
      method: 'POST', url: `/api/v1/vencimientos/${vencimiento.id}/presentar`,
      headers: { cookie: coordinador },
      payload: { fechaPresentacion: '2026-04-20' },
    });
    expect(presentar.statusCode).toBe(200);

    const radar = await ctx.app.inject({
      method: 'GET', url: '/api/v1/vencimientos', headers: { cookie: coordinador },
    });
    expect(JSON.parse(radar.body).vencimientos).toHaveLength(0);
  });

  it('no se puede presentar dos veces la misma obligación', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador }, payload: abogacia,
    });
    const { vencimiento } = JSON.parse(alta.body);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/vencimientos/${vencimiento.id}/presentar`,
      headers: { cookie: coordinador }, payload: { fechaPresentacion: '2026-04-20' },
    });

    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/vencimientos/${vencimiento.id}/presentar`,
      headers: { cookie: coordinador }, payload: { fechaPresentacion: '2026-04-21' },
    });

    expect(segunda.statusCode).toBe(409);
  });

  it('la presentación queda en la bitácora: es la prueba de que se hizo', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador }, payload: abogacia,
    });
    const { vencimiento } = JSON.parse(alta.body);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/vencimientos/${vencimiento.id}/presentar`,
      headers: { cookie: coordinador }, payload: { fechaPresentacion: '2026-04-20' },
    });

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'vencimiento.presentado');
    expect(entrada?.usuarioId).toBe('usr-coordinador');
    expect((entrada?.datosDespues as Record<string, unknown>)['fechaPresentacion']).toBe(
      '2026-04-20',
    );
  });

  it('el radar de un usuario no incluye vencimientos de clientes ajenos', async () => {
    ctx.vencimientos.vencimientos.push({
      id: 'venc-ajeno', clienteId: AJENO, tipoDocumento: 'CERTIFICADO',
      descripcion: 'De otro cliente', entidad: 'DNIT',
      fechaEmision: null, fechaVencimiento: new Date('2026-04-25'),
      fechaPresentacion: null, responsableId: null, estado: 'VIGENTE',
      riesgo: 'ALTO', evidenciaId: null, proximaAccion: null,
    });

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/vencimientos', headers: { cookie: coordinador },
    });

    expect(JSON.parse(respuesta.body).vencimientos).toHaveLength(0);
  });
});

/* ========================================================================== */

describe('solicitudes de documentación', () => {
  const PERIODO = '2026-03';

  it('abrir el seguimiento de un cliente para un período lo deja ABIERTA', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: coordinador },
      payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });

    expect(respuesta.statusCode).toBe(201);
    const { solicitud } = JSON.parse(respuesta.body);
    expect(solicitud.estado).toBe('ABIERTA');
    expect(solicitud.recordatoriosEnviados).toBe(0);
  });

  it('abrir el mismo (cliente, período) dos veces no duplica', async () => {
    const primera = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: coordinador },
      payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });
    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: coordinador },
      payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });

    expect(JSON.parse(primera.body).solicitud.id).toBe(JSON.parse(segunda.body).solicitud.id);
    expect(ctx.solicitudes.solicitudes).toHaveLength(1);
  });

  it('la vista por período respeta la cartera del usuario', async () => {
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: direccion }, payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${AJENO}/solicitudes-documentacion`,
      headers: { cookie: direccion }, payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET', url: `/api/v1/solicitudes-documentacion?periodo=${PERIODO}`,
      headers: { cookie: coordinador },
    });

    const { solicitudes } = JSON.parse(respuesta.body);
    expect(solicitudes).toHaveLength(1);
    expect(solicitudes[0].clienteId).toBe(MIO);
  });

  it('cerrar marca el estado indicado y queda en la bitácora', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: coordinador }, payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });
    const { solicitud } = JSON.parse(alta.body);

    const cierre = await ctx.app.inject({
      method: 'POST', url: `/api/v1/solicitudes-documentacion/${solicitud.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { estado: 'ENTREGADA' },
    });

    expect(cierre.statusCode).toBe(200);
    expect(JSON.parse(cierre.body).solicitud.estado).toBe('ENTREGADA');

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'solicitud.cerrada');
    expect(entrada?.usuarioId).toBe('usr-coordinador');
    expect((entrada?.datosDespues as Record<string, unknown>)['estado']).toBe('ENTREGADA');
  });

  it('no se puede cerrar dos veces la misma solicitud', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: coordinador }, payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });
    const { solicitud } = JSON.parse(alta.body);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/solicitudes-documentacion/${solicitud.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { estado: 'ENTREGADA' },
    });
    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/solicitudes-documentacion/${solicitud.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { estado: 'CERRADA_MANUALMENTE' },
    });

    expect(segunda.statusCode).toBe(409);
  });

  it('no se puede cerrar una solicitud de un cliente fuera de la cartera', async () => {
    const alta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${AJENO}/solicitudes-documentacion`,
      headers: { cookie: direccion }, payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });
    const { solicitud } = JSON.parse(alta.body);

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/solicitudes-documentacion/${solicitud.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { estado: 'ENTREGADA' },
    });

    expect(respuesta.statusCode).toBe(404);
  });

  it('un auxiliar no puede abrir el seguimiento de un período (solo ver)', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/solicitudes-documentacion`,
      headers: { cookie: auxiliar },
      payload: { periodo: PERIODO, cuentaDesde: '2026-04-01' },
    });

    expect(respuesta.statusCode).toBe(403);
  });
});

/* ========================================================================== */

describe('balances: el sistema no aprueba', () => {
  /** Balance que cierra y con estado de resultados coherente. */
  const balanceLimpio = {
    activo: '1000000000',
    pasivo: '400000000',
    patrimonioNeto: '600000000',
    resultadoEjercicio: '150000000',
    estadoResultados: {
      ingresos: '500000000', costos: '200000000', gastos: '150000000', resultado: '150000000',
    },
  };

  /** Deja el proceso mensual del período en condiciones de no bloquear. */
  async function prepararProceso(): Promise<void> {
    await ctx.procesoMensual.asegurar(MIO, '2026-03');
    await ctx.procesoMensual.actualizar(MIO, '2026-03', {
      documentosFaltantes: 0,
      extractosRecibidos: true,
      conciliacionBancariaRealizada: true,
      liquidacionEnviada: true,
    });
  }

  it('un balance consistente queda listo para revisión humana, nunca aprobado', async () => {
    await prepararProceso();

    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });

    expect(respuesta.statusCode).toBe(200);
    const { balance, revision } = JSON.parse(respuesta.body);

    expect(balance.estado).toBe('LISTO_PARA_REVISION');
    expect(balance.estado).not.toBe('APROBADO');
    expect(revision.bloqueantes).toBe(0);
  });

  it('un balance que no cierra queda observado, con la diferencia exacta', async () => {
    await prepararProceso();

    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador },
      payload: { ...balanceLimpio, activo: '1000000001' },
    });

    const { balance, revision } = JSON.parse(respuesta.body);
    expect(balance.estado).toBe('OBSERVADO');

    const ecuacion = revision.inconsistencias.find(
      (i: { codigo: string }) => i.codigo === 'ECUACION_PATRIMONIAL_NO_CIERRA',
    );
    expect(ecuacion.diferencia).toBe('1');
  });

  it('los documentos faltantes del proceso mensual bloquean el balance', async () => {
    await ctx.procesoMensual.asegurar(MIO, '2026-03');
    await ctx.procesoMensual.actualizar(MIO, '2026-03', {
      documentosFaltantes: 4, extractosRecibidos: true, conciliacionBancariaRealizada: true,
    });

    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });

    const { balance, revision } = JSON.parse(respuesta.body);
    expect(balance.estado).toBe('OBSERVADO');
    expect(revision.inconsistencias.map((i: { codigo: string }) => i.codigo)).toContain(
      'DOCUMENTOS_FALTANTES',
    );
  });

  it('el contexto operativo sale del proceso mensual, no del cuerpo de la petición', async () => {
    await ctx.procesoMensual.asegurar(MIO, '2026-03');
    await ctx.procesoMensual.actualizar(MIO, '2026-03', { documentosFaltantes: 4 });

    // Intentar declarar en el cuerpo que no falta nada.
    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador },
      payload: { ...balanceLimpio, documentosFaltantes: 0 },
    });

    // El campo de más se rechaza; y aunque pasara, el dato sale del proceso.
    expect(respuesta.statusCode).toBe(400);
  });

  it('el revisor de balance puede aprobar uno que está listo', async () => {
    await prepararProceso();
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: revisor },
    });

    expect(respuesta.statusCode).toBe(200);
    const { balance } = JSON.parse(respuesta.body);
    expect(balance.estado).toBe('APROBADO');
    expect(balance.aprobadoPorUsuarioId).toBe('usr-revisor');
    expect(balance.aprobadoEn).not.toBeNull();
  });

  it('un coordinador puede preparar el balance pero no aprobarlo', async () => {
    await prepararProceso();
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: coordinador },
    });

    expect(respuesta.statusCode).toBe(403);
    expect(ctx.balances.balances[0]?.estado).not.toBe('APROBADO');
  });

  it('un auxiliar tampoco puede aprobar', async () => {
    await prepararProceso();
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: auxiliar },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('no se puede aprobar un balance observado, ni siendo revisor', async () => {
    await prepararProceso();
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador },
      payload: { ...balanceLimpio, activo: '999999999' },
    });

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: revisor },
    });

    expect(respuesta.statusCode).toBe(409);
    expect(JSON.parse(respuesta.body).error).toBe('no_aprobable');
  });

  it('no se puede aprobar dos veces', async () => {
    await prepararProceso();
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: revisor },
    });

    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: revisor },
    });

    expect(segunda.statusCode).toBe(409);
    expect(JSON.parse(segunda.body).error).toBe('ya_aprobado');
  });

  it('la aprobación queda en la bitácora con nombre, rol y momento', async () => {
    await prepararProceso();
    await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: revisor },
    });

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'balance.aprobado');
    expect(entrada?.usuarioId).toBe('usr-revisor');

    const datos = entrada?.datosDespues as Record<string, unknown>;
    expect(datos['rol']).toBe('revisor_balance');
    expect(datos['aprobadoEn']).toBe(HOY.toISOString());
  });

  it('no se puede aprobar un balance sin cifras cargadas', async () => {
    ctx.balances.balances.push({
      id: 'bal-vacio', clienteId: MIO, periodo: '2026-03',
      activo: null, pasivo: null, patrimonioNeto: null, resultadoEjercicio: null,
      estado: 'PENDIENTE', preparadoPorUsuarioId: null,
      aprobadoPorUsuarioId: null, aprobadoEn: null,
      inconsistencias: null, proximaAccion: null,
    });

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/balances/2026-03/aprobar`,
      headers: { cookie: revisor },
    });

    expect(respuesta.statusCode).toBe(409);
    expect(JSON.parse(respuesta.body).error).toBe('balance_incompleto');
  });

  it('los importes del balance viajan como texto', async () => {
    await prepararProceso();
    const respuesta = await ctx.app.inject({
      method: 'PUT', url: `/api/v1/clientes/${MIO}/balances/2026-03`,
      headers: { cookie: coordinador }, payload: balanceLimpio,
    });

    const { balance } = JSON.parse(respuesta.body);
    expect(balance.activo).toBe('1000000000');
    expect(typeof balance.activo).toBe('string');
  });
});

describe('alertas', () => {
  function fixture(overrides: Partial<AlertaAlmacenada> = {}): AlertaAlmacenada {
    return {
      id: randomUUID(),
      clienteId: MIO,
      periodo: '2026-03',
      origen: 'vencimiento',
      criticidad: 'MEDIA',
      titulo: 'Vencimiento próximo',
      detalle: 'La presentación ante Abogacía vence en 5 días.',
      entidadRelacionada: 'vencimiento',
      entidadRelacionadaId: randomUUID(),
      responsableId: null,
      fechaLimite: null,
      estado: 'ABIERTA',
      cerradaPorUsuarioId: null,
      cerradaEn: null,
      motivoCierre: null,
      ...overrides,
    };
  }

  it('la vista consolidada ordena por criticidad, más urgente primero', async () => {
    ctx.alertas.alertas.push(
      fixture({ criticidad: 'MEDIA', titulo: 'media' }),
      fixture({ criticidad: 'CRITICA', titulo: 'critica' }),
      fixture({ criticidad: 'ALTA', titulo: 'alta' }),
      fixture({ criticidad: 'INFORMATIVA', titulo: 'informativa' }),
    );

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/alertas', headers: { cookie: coordinador },
    });

    expect(respuesta.statusCode).toBe(200);
    const { alertas, resumen } = JSON.parse(respuesta.body);
    expect(alertas.map((a: { titulo: string }) => a.titulo)).toEqual([
      'critica', 'alta', 'media', 'informativa',
    ]);
    expect(resumen).toEqual({ CRITICA: 1, ALTA: 1, MEDIA: 1, INFORMATIVA: 1 });
  });

  it('no muestra alertas cerradas ni descartadas en la vista consolidada', async () => {
    ctx.alertas.alertas.push(
      fixture({ estado: 'CERRADA', titulo: 'cerrada' }),
      fixture({ estado: 'DESCARTADA', titulo: 'descartada' }),
      fixture({ estado: 'ABIERTA', titulo: 'abierta' }),
    );

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/alertas', headers: { cookie: coordinador },
    });

    const { alertas } = JSON.parse(respuesta.body);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].titulo).toBe('abierta');
  });

  it('un usuario con cartera acotada no ve alertas de un cliente ajeno', async () => {
    ctx.alertas.alertas.push(fixture({ clienteId: AJENO }));

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/alertas', headers: { cookie: auxiliar },
    });

    const { alertas } = JSON.parse(respuesta.body);
    expect(alertas).toHaveLength(0);
  });

  it('una alerta sin cliente asignado no llega a un usuario con cartera acotada', async () => {
    // Una alerta general (sin dueño) no entra por el filtro `IN (...)`: es la
    // aplicación del mismo "negar por defecto" que el resto del sistema.
    ctx.alertas.alertas.push(fixture({ clienteId: null }));

    const acotado = await ctx.app.inject({
      method: 'GET', url: '/api/v1/alertas', headers: { cookie: auxiliar },
    });
    expect(JSON.parse(acotado.body).alertas).toHaveLength(0);

    const sinRestriccion = await ctx.app.inject({
      method: 'GET', url: '/api/v1/alertas', headers: { cookie: revisor },
    });
    expect(JSON.parse(sinRestriccion.body).alertas).toHaveLength(1);
  });

  it('cerrar una alerta exige explicar el motivo', async () => {
    const alerta = fixture();
    ctx.alertas.alertas.push(alerta);

    const sinMotivo = await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: coordinador }, payload: {},
    });
    expect(sinMotivo.statusCode).toBe(400);

    const conMotivo = await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { motivoCierre: 'Se presentó a tiempo.' },
    });
    expect(conMotivo.statusCode).toBe(200);
    expect(JSON.parse(conMotivo.body).alerta.estado).toBe('CERRADA');
  });

  it('no se puede cerrar dos veces la misma alerta', async () => {
    const alerta = fixture();
    ctx.alertas.alertas.push(alerta);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { motivoCierre: 'Resuelta.' },
    });

    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { motivoCierre: 'De nuevo.' },
    });

    expect(segunda.statusCode).toBe(409);
    expect(JSON.parse(segunda.body).error).toBe('ya_cerrada');
  });

  it('no se puede cerrar una alerta de un cliente ajeno a la cartera', async () => {
    const alerta = fixture({ clienteId: AJENO });
    ctx.alertas.alertas.push(alerta);

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { motivoCierre: 'Intento.' },
    });

    expect(respuesta.statusCode).toBe(404);
  });

  it('solo_lectura no puede cerrar una alerta', async () => {
    const alerta = fixture();
    ctx.alertas.alertas.push(alerta);

    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: soloLectura }, payload: { motivoCierre: 'Intento.' },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('el cierre queda en la bitácora con el motivo y el estado anterior', async () => {
    const alerta = fixture();
    ctx.alertas.alertas.push(alerta);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/alertas/${alerta.id}/cerrar`,
      headers: { cookie: coordinador }, payload: { motivoCierre: 'Se presentó a tiempo.' },
    });

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'alerta.cerrada');
    expect(entrada).toBeDefined();
    expect((entrada?.datosAntes as Record<string, unknown>)['estado']).toBe('ABIERTA');
    expect((entrada?.datosDespues as Record<string, unknown>)['motivoCierre']).toBe(
      'Se presentó a tiempo.',
    );
  });
});

describe('usuarios (equipo)', () => {
  const altaValida = {
    nombre: 'Nueva',
    apellido: 'Persona',
    email: 'nueva.persona@effort.com.py',
    rol: 'auxiliar',
    contrasenaInicial: 'una contraseña bien larga',
  };

  async function darDeAlta(payload: Record<string, unknown>) {
    return ctx.app.inject({
      method: 'POST', url: '/api/v1/usuarios',
      headers: { cookie: direccion }, payload,
    });
  }

  it('dirección da de alta un usuario y la respuesta no incluye el hash', async () => {
    const respuesta = await darDeAlta(altaValida);

    expect(respuesta.statusCode).toBe(201);
    const { usuario } = JSON.parse(respuesta.body);
    expect(usuario.email).toBe(altaValida.email);
    expect(usuario.activo).toBe(true);
    expect(usuario.hashContrasena).toBeUndefined();
    expect(usuario.secretoTotp).toBeUndefined();
  });

  it('un rol distinto de dirección no puede dar de alta un usuario', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/usuarios',
      headers: { cookie: auxiliar }, payload: altaValida,
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('no se puede repetir el correo de otro usuario', async () => {
    const respuesta = await darDeAlta({ ...altaValida, email: 'aracely@effort.com.py' });

    expect(respuesta.statusCode).toBe(409);
    expect(JSON.parse(respuesta.body).error).toBe('correo_en_uso');
  });

  it('rechaza una contraseña inicial demasiado corta', async () => {
    const respuesta = await darDeAlta({
      ...altaValida, email: 'otra@effort.com.py', contrasenaInicial: 'corta',
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('rechaza una contraseña inicial larga pero previsible', async () => {
    // Pasa el mínimo de largo del esquema Zod, pero cae en `validarFortaleza`.
    const respuesta = await darDeAlta({
      ...altaValida, email: 'otra2@effort.com.py', contrasenaInicial: 'unacontrasenalarga',
    });

    expect(respuesta.statusCode).toBe(400);
    expect(JSON.parse(respuesta.body).error).toBe('contrasena_debil');
  });

  it('un rol sin cartera no puede recibir clientes asignados', async () => {
    // direccion ve toda la cartera por diseño: no tiene un RolEnCliente válido.
    const respuesta = await darDeAlta({
      ...altaValida, email: 'otra2@effort.com.py', rol: 'direccion', clientesAsignados: [MIO],
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('el alta asigna la cartera indicada', async () => {
    const respuesta = await darDeAlta({
      ...altaValida, email: 'con.cartera@effort.com.py', clientesAsignados: [MIO],
    });

    const { usuario } = JSON.parse(respuesta.body);
    expect(await ctx.usuarios.clientesAsignados(usuario.id)).toEqual([MIO]);
  });

  it('el alta queda en la bitácora', async () => {
    await darDeAlta(altaValida);

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'usuario.creado');
    expect(entrada).toBeDefined();
    expect(entrada?.usuarioId).toBe('usr-direccion');
  });

  it('la vista de equipo solo la ve dirección (según la matriz de RBAC)', async () => {
    const conAcceso = await ctx.app.inject({
      method: 'GET', url: '/api/v1/usuarios', headers: { cookie: direccion },
    });
    expect(conAcceso.statusCode).toBe(200);
    expect(JSON.parse(conAcceso.body).usuarios.length).toBeGreaterThan(0);

    const sinAcceso = await ctx.app.inject({
      method: 'GET', url: '/api/v1/usuarios', headers: { cookie: auxiliar },
    });
    expect(sinAcceso.statusCode).toBe(403);
  });

  describe('edición', () => {
    async function usuarioDePrueba(payload: Record<string, unknown> = {}) {
      const alta = await darDeAlta({ ...altaValida, email: `editable-${randomUUID()}@effort.com.py`, ...payload });
      return JSON.parse(alta.body).usuario as { id: string };
    }

    it('edita rol y estado', async () => {
      const usuario = await usuarioDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${usuario.id}`,
        headers: { cookie: direccion }, payload: { rol: 'coordinador', activo: false },
      });

      expect(respuesta.statusCode).toBe(200);
      const { usuario: actualizado } = JSON.parse(respuesta.body);
      expect(actualizado.rol).toBe('coordinador');
      expect(actualizado.activo).toBe(false);
    });

    it('reemplaza la cartera asignada', async () => {
      const usuario = await usuarioDePrueba({ clientesAsignados: [MIO] });
      expect(await ctx.usuarios.clientesAsignados(usuario.id)).toEqual([MIO]);

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${usuario.id}`,
        headers: { cookie: direccion }, payload: { clientesAsignados: [AJENO] },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(await ctx.usuarios.clientesAsignados(usuario.id)).toEqual([AJENO]);
    });

    it('editar sin mencionar clientesAsignados no toca la cartera existente', async () => {
      const usuario = await usuarioDePrueba({ clientesAsignados: [MIO] });

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${usuario.id}`,
        headers: { cookie: direccion }, payload: { cargo: 'Auxiliar contable' },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(await ctx.usuarios.clientesAsignados(usuario.id)).toEqual([MIO]);
    });

    it('un rol sin cartera no puede recibir clientes asignados al editar', async () => {
      const usuario = await usuarioDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${usuario.id}`,
        headers: { cookie: direccion },
        payload: { rol: 'solo_lectura', clientesAsignados: [MIO] },
      });

      expect(respuesta.statusCode).toBe(400);
    });

    it('no se puede editar un usuario inexistente', async () => {
      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${randomUUID()}`,
        headers: { cookie: direccion }, payload: { activo: false },
      });

      expect(respuesta.statusCode).toBe(404);
    });

    it('un rol distinto de dirección no puede editar', async () => {
      const usuario = await usuarioDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${usuario.id}`,
        headers: { cookie: auxiliar }, payload: { activo: false },
      });

      expect(respuesta.statusCode).toBe(403);
    });

    it('la edición queda en la bitácora con el estado anterior', async () => {
      const usuario = await usuarioDePrueba();

      await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/usuarios/${usuario.id}`,
        headers: { cookie: direccion }, payload: { activo: false },
      });

      const entrada = ctx.bitacora.filas.find((f) => f.accion === 'usuario.actualizado');
      expect(entrada).toBeDefined();
      expect((entrada?.datosAntes as Record<string, unknown>)['activo']).toBe(true);
      expect((entrada?.datosDespues as Record<string, unknown>)['activo']).toBe(false);
    });
  });

  describe('cartera de un usuario', () => {
    async function usuarioDePrueba(payload: Record<string, unknown> = {}) {
      const alta = await darDeAlta({ ...altaValida, email: `cartera-${randomUUID()}@effort.com.py`, ...payload });
      return JSON.parse(alta.body).usuario as { id: string };
    }

    it('devuelve la cartera vigente, para precargar el formulario de edición', async () => {
      const usuario = await usuarioDePrueba({ clientesAsignados: [MIO] });

      const respuesta = await ctx.app.inject({
        method: 'GET', url: `/api/v1/usuarios/${usuario.id}/clientes`,
        headers: { cookie: direccion },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(JSON.parse(respuesta.body).clienteIds).toEqual([MIO]);
    });

    it('un usuario sin cartera propia devuelve la lista vacía, no un error', async () => {
      const usuario = await usuarioDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'GET', url: `/api/v1/usuarios/${usuario.id}/clientes`,
        headers: { cookie: direccion },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(JSON.parse(respuesta.body).clienteIds).toEqual([]);
    });

    it('un usuario inexistente da 404, no una lista vacía silenciosa', async () => {
      const respuesta = await ctx.app.inject({
        method: 'GET', url: `/api/v1/usuarios/${randomUUID()}/clientes`,
        headers: { cookie: direccion },
      });

      expect(respuesta.statusCode).toBe(404);
    });

    it('un rol distinto de dirección/responsable no puede leer la cartera de otro usuario', async () => {
      const usuario = await usuarioDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'GET', url: `/api/v1/usuarios/${usuario.id}/clientes`,
        headers: { cookie: auxiliar },
      });

      expect(respuesta.statusCode).toBe(403);
    });
  });
});

describe('reglas impositivas', () => {
  const altaDiez = {
    nombre: 'IVA 10% general',
    tasa: 'DIEZ',
    divisorIvaIncluido: 11,
    vigenteDesde: '2026-01-01',
    fuente: 'Ley 125/91, art. 91.',
  };

  async function darDeAlta(payload: Record<string, unknown>) {
    return ctx.app.inject({
      method: 'POST', url: '/api/v1/reglas-impositivas',
      headers: { cookie: direccion }, payload,
    });
  }

  it('cualquier rol autenticado puede ver las reglas', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/reglas-impositivas', headers: { cookie: auxiliar },
    });
    expect(respuesta.statusCode).toBe(200);
  });

  it('un rol distinto de dirección no puede dar de alta una regla', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: '/api/v1/reglas-impositivas',
      headers: { cookie: auxiliar }, payload: altaDiez,
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('dirección da de alta una regla nueva', async () => {
    const respuesta = await darDeAlta(altaDiez);

    expect(respuesta.statusCode).toBe(201);
    const { regla } = JSON.parse(respuesta.body);
    expect(regla.tasa).toBe('DIEZ');
    expect(regla.divisorIvaIncluido).toBe(11);
    expect(regla.vigenteHasta).toBeNull();
  });

  it('una tasa exenta no puede llevar divisor', async () => {
    const respuesta = await darDeAlta({
      ...altaDiez, tasa: 'EXENTA', divisorIvaIncluido: 11,
    });
    expect(respuesta.statusCode).toBe(400);
  });

  it('una tasa gravada exige divisor', async () => {
    const respuesta = await darDeAlta({ ...altaDiez, divisorIvaIncluido: null });
    expect(respuesta.statusCode).toBe(400);
  });

  it('una tasa exenta sin divisor es válida', async () => {
    const respuesta = await darDeAlta({
      ...altaDiez, tasa: 'EXENTA', divisorIvaIncluido: null, nombre: 'Exenta',
    });
    expect(respuesta.statusCode).toBe(201);
  });

  it('dar de alta una segunda regla de la misma tasa cierra la anterior', async () => {
    const primera = await darDeAlta(altaDiez);
    const { regla: reglaVieja } = JSON.parse(primera.body);

    const segunda = await darDeAlta({ ...altaDiez, vigenteDesde: '2026-07-01', nombre: 'IVA 10% actualizado' });
    expect(segunda.statusCode).toBe(201);

    const { reglas } = JSON.parse(
      (await ctx.app.inject({
        method: 'GET', url: '/api/v1/reglas-impositivas', headers: { cookie: direccion },
      })).body,
    );

    const vieja = reglas.find((r: { id: string }) => r.id === reglaVieja.id);
    expect(vieja.vigenteHasta).toBe('2026-06-30');
  });

  it('el alta queda en la bitácora', async () => {
    await darDeAlta(altaDiez);
    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'regla_impositiva.creada');
    expect(entrada).toBeDefined();
    expect(entrada?.usuarioId).toBe('usr-direccion');
  });

  describe('edición', () => {
    async function reglaDePrueba() {
      const alta = await darDeAlta(altaDiez);
      return JSON.parse(alta.body).regla as { id: string; vigenteDesde: string };
    }

    it('edita metadata sin tocar la tasa', async () => {
      const regla = await reglaDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-impositivas/${regla.id}`,
        headers: { cookie: direccion },
        payload: { requiereConfirmacionCliente: false, fuente: 'Confirmado contra liquidación real.' },
      });

      expect(respuesta.statusCode).toBe(200);
      const { regla: actualizada } = JSON.parse(respuesta.body);
      expect(actualizada.requiereConfirmacionCliente).toBe(false);
      expect(actualizada.tasa).toBe('DIEZ');
    });

    it('no acepta cambiar la tasa ni el divisor por esta vía', async () => {
      const regla = await reglaDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-impositivas/${regla.id}`,
        headers: { cookie: direccion }, payload: { tasa: 'CINCO' },
      });

      expect(respuesta.statusCode).toBe(400);
    });

    it('la vigencia no puede cerrar antes de haber empezado', async () => {
      const regla = await reglaDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-impositivas/${regla.id}`,
        headers: { cookie: direccion }, payload: { vigenteHasta: '2025-01-01' },
      });

      expect(respuesta.statusCode).toBe(400);
      expect(JSON.parse(respuesta.body).error).toBe('vigencia_invalida');
    });

    it('no se puede editar una regla inexistente', async () => {
      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-impositivas/${randomUUID()}`,
        headers: { cookie: direccion }, payload: { fuente: 'x' },
      });

      expect(respuesta.statusCode).toBe(404);
    });

    it('un rol distinto de dirección no puede editar', async () => {
      const regla = await reglaDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-impositivas/${regla.id}`,
        headers: { cookie: auxiliar }, payload: { fuente: 'x' },
      });

      expect(respuesta.statusCode).toBe(403);
    });

    it('la edición queda en la bitácora', async () => {
      const regla = await reglaDePrueba();

      await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-impositivas/${regla.id}`,
        headers: { cookie: direccion }, payload: { requiereConfirmacionCliente: false },
      });

      const entrada = ctx.bitacora.filas.find((f) => f.accion === 'regla_impositiva.modificada');
      expect(entrada).toBeDefined();
      expect((entrada?.datosAntes as Record<string, unknown>)['requiereConfirmacionCliente']).toBe(true);
      expect((entrada?.datosDespues as Record<string, unknown>)['requiereConfirmacionCliente']).toBe(false);
    });
  });
});

describe('reglas de notificación', () => {
  const altaValida = {
    nombre: 'Documentación no entregada',
    evento: 'DOCUMENTACION_NO_ENTREGADA',
    diasHabilesDePlazo: 5,
    horaDeEnvio: '09:00',
    reintentarCadaDiasHabiles: 2,
    maximoRecordatorios: 4,
    escalarAPartirDelRecordatorio: 3,
    destinatariosIniciales: [{ tipo: 'RESPONSABLE_DEL_CLIENTE', valor: null }],
  };

  async function darDeAlta(payload: Record<string, unknown>) {
    return ctx.app.inject({
      method: 'POST', url: '/api/v1/reglas-notificacion',
      headers: { cookie: direccion }, payload,
    });
  }

  it('coordinador puede ver las reglas, pero no crearlas ni editarlas', async () => {
    const ver = await ctx.app.inject({
      method: 'GET', url: '/api/v1/reglas-notificacion', headers: { cookie: coordinador },
    });
    expect(ver.statusCode).toBe(200);

    const crear = await ctx.app.inject({
      method: 'POST', url: '/api/v1/reglas-notificacion',
      headers: { cookie: coordinador }, payload: altaValida,
    });
    expect(crear.statusCode).toBe(403);
  });

  it('auxiliar no tiene ningún acceso al recurso', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/reglas-notificacion', headers: { cookie: auxiliar },
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('dirección da de alta una regla', async () => {
    const respuesta = await darDeAlta(altaValida);

    expect(respuesta.statusCode).toBe(201);
    const { regla } = JSON.parse(respuesta.body);
    expect(regla.evento).toBe('DOCUMENTACION_NO_ENTREGADA');
    expect(regla.activa).toBe(true);
    expect(regla.destinatariosDeEscalamiento).toEqual([]);
    expect(regla.clientesAlcanzados).toEqual([]);
  });

  it('responsable puede editar reglas existentes, pero no dar de alta una nueva', async () => {
    const crear = await ctx.app.inject({
      method: 'POST', url: '/api/v1/reglas-notificacion',
      headers: { cookie: responsable }, payload: altaValida,
    });
    expect(crear.statusCode).toBe(403);

    const alta = await darDeAlta(altaValida);
    const { regla } = JSON.parse(alta.body);

    const editar = await ctx.app.inject({
      method: 'PATCH', url: `/api/v1/reglas-notificacion/${regla.id}`,
      headers: { cookie: responsable }, payload: { activa: false },
    });
    expect(editar.statusCode).toBe(200);
  });

  it('exige al menos un destinatario inicial', async () => {
    const respuesta = await darDeAlta({ ...altaValida, destinatariosIniciales: [] });
    expect(respuesta.statusCode).toBe(400);
  });

  it('un destinatario de tipo ROL exige valor', async () => {
    const respuesta = await darDeAlta({
      ...altaValida,
      destinatariosIniciales: [{ tipo: 'ROL', valor: null }],
    });
    expect(respuesta.statusCode).toBe(400);
  });

  it('rechaza una hora de envío mal formada', async () => {
    const respuesta = await darDeAlta({ ...altaValida, horaDeEnvio: '25:00' });
    expect(respuesta.statusCode).toBe(400);
  });

  it('el alta queda en la bitácora', async () => {
    await darDeAlta(altaValida);
    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'regla_notificacion.creada');
    expect(entrada).toBeDefined();
    expect(entrada?.usuarioId).toBe('usr-direccion');
  });

  describe('edición', () => {
    async function reglaDePrueba() {
      const alta = await darDeAlta(altaValida);
      return JSON.parse(alta.body).regla as { id: string };
    }

    it('puede desactivar una regla sin tocar el resto', async () => {
      const regla = await reglaDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-notificacion/${regla.id}`,
        headers: { cookie: direccion }, payload: { activa: false },
      });

      expect(respuesta.statusCode).toBe(200);
      const { regla: actualizada } = JSON.parse(respuesta.body);
      expect(actualizada.activa).toBe(false);
      expect(actualizada.evento).toBe('DOCUMENTACION_NO_ENTREGADA');
    });

    it('reemplaza los destinatarios de escalamiento', async () => {
      const regla = await reglaDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-notificacion/${regla.id}`,
        headers: { cookie: direccion },
        payload: { destinatariosDeEscalamiento: [{ tipo: 'ROL', valor: 'direccion' }] },
      });

      expect(respuesta.statusCode).toBe(200);
      const { regla: actualizada } = JSON.parse(respuesta.body);
      expect(actualizada.destinatariosDeEscalamiento).toEqual([{ tipo: 'ROL', valor: 'direccion' }]);
    });

    it('no se puede editar una regla inexistente', async () => {
      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-notificacion/${randomUUID()}`,
        headers: { cookie: direccion }, payload: { activa: false },
      });
      expect(respuesta.statusCode).toBe(404);
    });

    it('la edición queda en la bitácora con el estado anterior', async () => {
      const regla = await reglaDePrueba();

      await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/reglas-notificacion/${regla.id}`,
        headers: { cookie: direccion }, payload: { activa: false },
      });

      const entrada = ctx.bitacora.filas.find((f) => f.accion === 'regla_notificacion.modificada');
      expect(entrada).toBeDefined();
      expect((entrada?.datosAntes as Record<string, unknown>)['activa']).toBe(true);
      expect((entrada?.datosDespues as Record<string, unknown>)['activa']).toBe(false);
    });
  });
});

describe('eventos (event log)', () => {
  it('solo dirección puede consultar el historial', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/eventos', headers: { cookie: direccion },
    });
    expect(respuesta.statusCode).toBe(200);
  });

  // Restringido el 2026-09-10 a pedido de Daniel: antes `responsable` y
  // `revisor_balance` también entraban. La bitácora registra quién hizo cada
  // cosa, y eso incluye el trabajo de los compañeros — quién puede leerla
  // cambia lo que la herramienta significa para el equipo.
  it('ningún otro rol accede al historial, ni siquiera responsable o revisor', async () => {
    for (const cookie of [responsable, revisor, coordinador, auxiliar, soloLectura]) {
      const respuesta = await ctx.app.inject({
        method: 'GET', url: '/api/v1/eventos', headers: { cookie },
      });
      expect(respuesta.statusCode).toBe(403);
    }
  });

  it('trae los eventos ya generados por otras acciones, más reciente primero', async () => {
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador },
      payload: {
        tipoDocumento: 'CONSTANCIA', descripcion: 'Constancia RUC', entidad: 'SET',
        fechaVencimiento: '2026-12-31',
      },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/eventos', headers: { cookie: direccion },
    });

    const { eventos } = JSON.parse(respuesta.body);
    expect(eventos.some((e: { accion: string }) => e.accion === 'vencimiento.registrado')).toBe(true);
  });

  it('filtra por entidad', async () => {
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador },
      payload: {
        tipoDocumento: 'CONSTANCIA', descripcion: 'Constancia RUC', entidad: 'SET',
        fechaVencimiento: '2026-12-31',
      },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/eventos?entidad=vencimiento', headers: { cookie: direccion },
    });

    const { eventos } = JSON.parse(respuesta.body);
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e: { entidad: string }) => e.entidad === 'vencimiento')).toBe(true);
  });

  it('respeta el límite pedido', async () => {
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador },
      payload: {
        tipoDocumento: 'CONSTANCIA', descripcion: 'Uno', entidad: 'SET', fechaVencimiento: '2026-12-31',
      },
    });
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/vencimientos`,
      headers: { cookie: coordinador },
      payload: {
        tipoDocumento: 'CONSTANCIA', descripcion: 'Dos', entidad: 'SET', fechaVencimiento: '2026-12-31',
      },
    });

    const respuesta = await ctx.app.inject({
      method: 'GET', url: '/api/v1/eventos?limite=1', headers: { cookie: direccion },
    });

    const { eventos } = JSON.parse(respuesta.body);
    expect(eventos).toHaveLength(1);
  });

  it('el filtro de cartera excluye eventos de clientes ajenos, y también los que no tienen cliente', async () => {
    // Se prueba contra el doble directamente: la restricción de cartera no
    // depende de qué rol esté logueado, depende de `filtroDeClientes`, y acá
    // interesa aislar esa lógica sin necesitar un usuario acotado con acceso
    // al recurso `evento` (en la matriz real, solo lo tienen los roles que
    // ven toda la cartera).
    await ctx.bitacora.registrar({
      usuarioId: 'usr-direccion', accion: 'prueba.propia', entidad: 'prueba', entidadId: null,
      clienteId: MIO, datosAntes: null, datosDespues: null,
      ipTruncada: null, agenteUsuario: null, peticionId: null,
    });
    await ctx.bitacora.registrar({
      usuarioId: 'usr-direccion', accion: 'prueba.ajena', entidad: 'prueba', entidadId: null,
      clienteId: AJENO, datosAntes: null, datosDespues: null,
      ipTruncada: null, agenteUsuario: null, peticionId: null,
    });
    await ctx.bitacora.registrar({
      usuarioId: 'usr-direccion', accion: 'prueba.sin_cliente', entidad: 'prueba', entidadId: null,
      clienteId: null, datosAntes: null, datosDespues: null,
      ipTruncada: null, agenteUsuario: null, peticionId: null,
    });

    const acotado = await ctx.bitacora.listar({ entidad: 'prueba' }, [MIO], 50, 0);
    expect(acotado.map((e) => e.accion)).toEqual(['prueba.propia']);

    const completo = await ctx.bitacora.listar({ entidad: 'prueba' }, null, 50, 0);
    expect(completo.map((e) => e.accion).sort()).toEqual([
      'prueba.ajena', 'prueba.propia', 'prueba.sin_cliente',
    ]);
  });
});

describe('clientes', () => {
  const altaValida = {
    nombre: 'Nuevo Cliente S.A.',
    ruc: '80099999-1',
    tipoPersona: 'JURIDICA',
  };

  async function darDeAlta(payload: Record<string, unknown>, cookie: string) {
    return ctx.app.inject({ method: 'POST', url: '/api/v1/clientes', headers: { cookie }, payload });
  }

  it('dirección da de alta un cliente', async () => {
    const respuesta = await darDeAlta(altaValida, direccion);

    expect(respuesta.statusCode).toBe(201);
    const { cliente } = JSON.parse(respuesta.body);
    expect(cliente.ruc).toBe('80099999-1');
    expect(cliente.activo).toBe(true);
  });

  it('responsable también puede dar de alta', async () => {
    const respuesta = await darDeAlta(
      { ...altaValida, ruc: '80025000-1' }, responsable,
    );
    expect(respuesta.statusCode).toBe(201);
  });

  it('coordinador no puede dar de alta un cliente', async () => {
    const respuesta = await darDeAlta(altaValida, coordinador);
    expect(respuesta.statusCode).toBe(403);
  });

  it('no se puede repetir el RUC de otro cliente', async () => {
    // MIO ya está sembrado en el fixture con RUC 80017726-6.
    const respuesta = await darDeAlta({ ...altaValida, ruc: '80017726-6' }, direccion);

    expect(respuesta.statusCode).toBe(409);
    expect(JSON.parse(respuesta.body).error).toBe('ruc_en_uso');
  });

  it('auxiliar puede ver la cartera pero no dar de alta', async () => {
    const ver = await ctx.app.inject({
      method: 'GET', url: '/api/v1/clientes', headers: { cookie: auxiliar },
    });
    expect(ver.statusCode).toBe(200);

    const crear = await darDeAlta(altaValida, auxiliar);
    expect(crear.statusCode).toBe(403);
  });

  it('el alta queda en la bitácora', async () => {
    await darDeAlta(altaValida, direccion);
    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'cliente.creado');
    expect(entrada).toBeDefined();
    expect(entrada?.usuarioId).toBe('usr-direccion');
  });

  describe('edición', () => {
    async function clienteDePrueba() {
      const base = `800${Math.floor(Math.random() * 90000 + 10000)}`;
      const ruc = `${base}-${calcularDigitoVerificadorRuc(base)}`;
      const alta = await darDeAlta({ ...altaValida, ruc }, direccion);
      return JSON.parse(alta.body).cliente as { id: string; ruc: string };
    }

    it('edita observaciones y estado activo', async () => {
      const cliente = await clienteDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/clientes/${cliente.id}`,
        headers: { cookie: direccion }, payload: { activo: false, observaciones: 'Baja temporal.' },
      });

      expect(respuesta.statusCode).toBe(200);
      const { cliente: actualizado } = JSON.parse(respuesta.body);
      expect(actualizado.activo).toBe(false);
      expect(actualizado.observaciones).toBe('Baja temporal.');
    });

    it('corrige un RUC mal tipeado', async () => {
      const cliente = await clienteDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/clientes/${cliente.id}`,
        headers: { cookie: direccion }, payload: { ruc: '80054135-9' },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(JSON.parse(respuesta.body).cliente.ruc).toBe('80054135-9');
    });

    it('no permite cambiar el RUC a uno que ya usa otro cliente', async () => {
      const cliente = await clienteDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/clientes/${cliente.id}`,
        headers: { cookie: direccion }, payload: { ruc: '80017726-6' },
      });

      expect(respuesta.statusCode).toBe(409);
      expect(JSON.parse(respuesta.body).error).toBe('ruc_en_uso');
    });

    it('no se puede editar un cliente inexistente', async () => {
      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/clientes/${randomUUID()}`,
        headers: { cookie: direccion }, payload: { activo: false },
      });
      expect(respuesta.statusCode).toBe(404);
    });

    it('coordinador no puede editar', async () => {
      const cliente = await clienteDePrueba();

      const respuesta = await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/clientes/${cliente.id}`,
        headers: { cookie: coordinador }, payload: { activo: false },
      });
      expect(respuesta.statusCode).toBe(403);
    });

    it('la edición queda en la bitácora con el estado anterior', async () => {
      const cliente = await clienteDePrueba();

      await ctx.app.inject({
        method: 'PATCH', url: `/api/v1/clientes/${cliente.id}`,
        headers: { cookie: direccion }, payload: { activo: false },
      });

      const entrada = ctx.bitacora.filas.find((f) => f.accion === 'cliente.actualizado');
      expect(entrada).toBeDefined();
      expect((entrada?.datosAntes as Record<string, unknown>)['activo']).toBe(true);
      expect((entrada?.datosDespues as Record<string, unknown>)['activo']).toBe(false);
    });
  });
});
