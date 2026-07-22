/**
 * Tests de los módulos de negocio: documentos, proceso mensual, vencimientos
 * y balances.
 *
 * Ejercitan el servidor completo con dobles de persistencia. Lo que se prueba
 * acá es el comportamiento de las rutas: permisos, alcance de cartera,
 * validación, reglas de negocio y bitácora. El SQL de cada repositorio se
 * prueba aparte, en `test/integracion/`.
 */

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeDocumentos } from '../src/rutas/documentos.js';
import { registrarRutasDeVencimientos } from '../src/rutas/vencimientos.js';
import { registrarRutasDeBalances } from '../src/rutas/balances.js';
import { hashearContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { NOMBRE_COOKIE_SESION } from '../src/seguridad/sesiones.js';
import type { Configuracion } from '../src/configuracion.js';
import {
  BitacoraFalsa,
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
  ExportacionesSigaFalsas,
  LiquidacionesFalsas,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const MIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';

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
  balances: BalancesFalsos;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const clientes = new ClientesFalsos();
  const bitacora = new BitacoraFalsa();
  const documentos = new DocumentosFalsos();
  const procesoMensual = new ProcesoMensualFalso();
  const vencimientos = new VencimientosFalsos();
  const balances = new BalancesFalsos();
  const hash = await hashearContrasena(CONTRASENA);

  const base = {
    activo: true, hashContrasena: hash, secretoTotp: null,
    segundoFactorActivo: false, debeCambiarContrasena: false,
  };

  usuarios.usuarios.push(
    { id: 'usr-auxiliar', email: 'aracely@effort.com.py', rol: 'auxiliar', veTodosLosClientes: false, ...base },
    { id: 'usr-coordinador', email: 'karina@effort.com.py', rol: 'coordinador', veTodosLosClientes: false, ...base },
    { id: 'usr-revisor', email: 'revisor@effort.com.py', rol: 'revisor_balance', veTodosLosClientes: true, ...base },
    { id: 'usr-lectura', email: 'lectura@effort.com.py', rol: 'solo_lectura', veTodosLosClientes: true, ...base },
  );

  usuarios.asignaciones.set('usr-auxiliar', [MIO]);
  usuarios.asignaciones.set('usr-coordinador', [MIO]);

  clientes.clientes.push(
    { id: MIO, nombre: 'GARSO S.A.', ruc: '80017726-6', activo: true },
    { id: AJENO, nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', activo: true },
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
    balances,
    exportacionesSiga: new ExportacionesSigaFalsas(),
    liquidaciones: new LiquidacionesFalsas(),
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => HOY,
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeDocumentos(app, deps);
  await registrarRutasDeVencimientos(app, deps);
  await registrarRutasDeBalances(app, deps);
  await app.ready();

  return { app, bitacora, documentos, procesoMensual, vencimientos, balances };
}

async function acceder(ctx: Contexto, email: string): Promise<string> {
  const respuesta = await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso', payload: { email, contrasena: CONTRASENA },
  });
  const cookie = respuesta.cookies.find((c) => c.name === NOMBRE_COOKIE_SESION);
  if (!cookie) throw new Error(`Sin cookie: ${respuesta.body}`);
  return `${cookie.name}=${cookie.value}`;
}

let ctx: Contexto;
let auxiliar = '';
let coordinador = '';
let revisor = '';
let soloLectura = '';

beforeEach(async () => {
  ctx = await montar();
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
