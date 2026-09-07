/**
 * Tests de exportaciones SIGA, conciliación y liquidaciones.
 *
 * La conciliación es la función que sostiene el argumento comercial del
 * piloto, así que se prueba con casos que reproducen lo que realmente pasa en
 * una oficina contable: un comprobante que llegó por WhatsApp y nadie cargó,
 * uno que está en SIGA sin respaldo, y uno cargado con un importe distinto.
 */

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeDocumentos } from '../src/rutas/documentos.js';
import { registrarRutasDeSiga } from '../src/rutas/siga.js';
import { registrarRutasDeLiquidaciones } from '../src/rutas/liquidaciones.js';
import { hashearContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { nombreCookieSesion } from '../src/seguridad/sesiones.js';
import type { Configuracion } from '../src/configuracion.js';
import { activarCsrfEnInject } from './csrf-en-tests.js';
import {
  BitacoraFalsa,
  clienteMinimo,
  ClientesFalsos,
  ContactosFalsos,
  SesionesFalsas,
  UsuariosFalsos,
} from './dobles.js';
import {
  BalancesFalsos,
  DocumentosFalsos,
  ExportacionesSigaFalsas,
  LiquidacionesFalsas,
  ProcesoMensualFalso,
  VencimientosFalsos,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const MIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';
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
  siga: ExportacionesSigaFalsas;
  liquidaciones: LiquidacionesFalsas;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const clientes = new ClientesFalsos();
  const bitacora = new BitacoraFalsa();
  const siga = new ExportacionesSigaFalsas();
  const liquidaciones = new LiquidacionesFalsas();
  const hash = await hashearContrasena(CONTRASENA);

  const base = {
    activo: true, hashContrasena: hash, secretoTotp: null,
    segundoFactorActivo: false, debeCambiarContrasena: false,
  };

  usuarios.usuarios.push(
    { id: 'usr-coordinador', email: 'karina@effort.com.py', rol: 'coordinador', veTodosLosClientes: false, ...base },
    { id: 'usr-auxiliar', email: 'aracely@effort.com.py', rol: 'auxiliar', veTodosLosClientes: false, ...base },
    { id: 'usr-lectura', email: 'lectura@effort.com.py', rol: 'solo_lectura', veTodosLosClientes: true, ...base },
  );
  usuarios.asignaciones.set('usr-coordinador', [MIO]);
  usuarios.asignaciones.set('usr-auxiliar', [MIO]);

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
    documentos: new DocumentosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
    vencimientos: new VencimientosFalsos(),
    balances: new BalancesFalsos(),
    exportacionesSiga: siga,
    liquidaciones,
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => HOY,
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeDocumentos(app, deps);
  await registrarRutasDeSiga(app, deps);
  await registrarRutasDeLiquidaciones(app, deps);
  await app.ready();
  await activarCsrfEnInject(app);

  return { app, bitacora, siga, liquidaciones };
}

async function acceder(ctx: Contexto, email: string): Promise<string> {
  const r = await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso', payload: { email, contrasena: CONTRASENA },
  });
  const cookie = r.cookies.find((c) => c.name === nombreCookieSesion(false));
  if (!cookie) throw new Error(`Sin cookie: ${r.body}`);
  return `${cookie.name}=${cookie.value}`;
}

let ctx: Contexto;
let coordinador = '';
let soloLectura = '';

beforeEach(async () => {
  ctx = await montar();
  coordinador = await acceder(ctx, 'karina@effort.com.py');
  soloLectura = await acceder(ctx, 'lectura@effort.com.py');
});

afterEach(async () => {
  await ctx.app.close();
});

/** Carga un documento propio con la terna de identificación completa. */
async function cargarDocumento(numero: string, total: string): Promise<void> {
  await ctx.app.inject({
    method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
    headers: { cookie: coordinador },
    payload: {
      periodo: '2026-03', tipo: 'FACTURA_COMPRA', canalRecepcion: 'WHATSAPP',
      recibidoEn: '2026-03-15T12:00:00Z',
      rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: numero,
      total, tasa: 'DIEZ',
    },
  });
}

/** Importa una exportación de SIGA con las filas indicadas. */
async function importarSiga(
  filas: Array<{ numero: string; total: string }>,
): Promise<void> {
  await ctx.app.inject({
    method: 'POST', url: `/api/v1/clientes/${MIO}/siga`,
    headers: { cookie: coordinador },
    payload: {
      periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
      comprobantes: filas.map((f) => ({
        rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: f.numero,
        total: f.total, tasa: 'DIEZ', fecha: '2026-03-15',
      })),
    },
  });
}

async function conciliar(): Promise<Record<string, unknown>> {
  const r = await ctx.app.inject({
    method: 'GET', url: `/api/v1/clientes/${MIO}/siga/2026-03/conciliacion`,
    headers: { cookie: coordinador },
  });
  return JSON.parse(r.body);
}

/* ========================================================================== */

describe('importación de exportaciones SIGA', () => {
  it('registra la exportación con la cantidad de filas leídas', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        comprobantes: [
          { rucEmisor: '80017726-6', timbrado: '12345678', numeroComprobante: '001-001-0000001',
            total: '1100000', tasa: 'DIEZ', fecha: '2026-03-10' },
        ],
      },
    });

    expect(respuesta.statusCode).toBe(201);
    const { exportacion } = JSON.parse(respuesta.body);
    expect(exportacion.filasLeidas).toBe(1);
    expect(exportacion.estadoRevision).toBe('IMPORTADA');
  });

  it('acepta una exportación sin filas (un PDF de respaldo, por ejemplo)', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipoReporte: 'DETERMINACION_IVA', formato: 'PDF',
      },
    });

    expect(respuesta.statusCode).toBe(201);
    expect(JSON.parse(respuesta.body).exportacion.filasLeidas).toBe(0);
  });

  it('reimportar el mismo archivo no duplica comprobantes', async () => {
    await importarSiga([{ numero: '001-001-0000001', total: '1100000' }]);
    await importarSiga([{ numero: '001-001-0000001', total: '1100000' }]);

    // Dos exportaciones registradas, un solo comprobante: la clave natural
    // tiene unicidad, igual que en la base.
    expect(ctx.siga.exportaciones).toHaveLength(2);
    expect(ctx.siga.comprobantes).toHaveLength(1);
  });

  it('rechaza filas con la identificación incompleta', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        comprobantes: [{ rucEmisor: '80017726-6', timbrado: '', numeroComprobante: '001',
          total: '1100000', tasa: 'DIEZ', fecha: '2026-03-10' }],
      },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('un solo_lectura no puede importar', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga`,
      headers: { cookie: soloLectura },
      payload: { periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL' },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('no se puede importar en un cliente ajeno', async () => {
    const respuesta = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${AJENO}/siga`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL' },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('la importación queda en la bitácora', async () => {
    await importarSiga([{ numero: '001-001-0000001', total: '1100000' }]);

    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'siga.exportacion_importada');
    expect(entrada?.clienteId).toBe(MIO);
    expect((entrada?.datosDespues as Record<string, unknown>)['filas']).toBe(1);
  });
});

/* ========================================================================== */

describe('conciliación contra SIGA', () => {
  it('todo cuadra cuando los dos conjuntos coinciden', async () => {
    await cargarDocumento('001-001-0000001', '1100000');
    await importarSiga([{ numero: '001-001-0000001', total: '1100000' }]);

    const resultado = await conciliar();

    expect(resultado['conciliado']).toBe(true);
    expect(resultado['coincidentes']).toBe(1);
    expect(resultado['faltaCargarEnSiga']).toHaveLength(0);
    expect(resultado['sinRespaldoDocumental']).toHaveLength(0);
  });

  it('detecta lo que llegó pero nadie cargó en SIGA', async () => {
    await cargarDocumento('001-001-0000001', '1100000');
    await cargarDocumento('001-001-0000002', '2200000');
    await importarSiga([{ numero: '001-001-0000001', total: '1100000' }]);

    const resultado = await conciliar();

    expect(resultado['conciliado']).toBe(false);
    const faltantes = resultado['faltaCargarEnSiga'] as Array<Record<string, string>>;
    expect(faltantes).toHaveLength(1);
    expect(faltantes[0]?.['numeroComprobante']).toBe('001-001-0000002');
  });

  it('detecta lo que está en SIGA sin respaldo documental', async () => {
    await cargarDocumento('001-001-0000001', '1100000');
    await importarSiga([
      { numero: '001-001-0000001', total: '1100000' },
      { numero: '001-001-0000009', total: '500000' },
    ]);

    const resultado = await conciliar();

    const sinRespaldo = resultado['sinRespaldoDocumental'] as Array<Record<string, string>>;
    expect(sinRespaldo).toHaveLength(1);
    expect(sinRespaldo[0]?.['numeroComprobante']).toBe('001-001-0000009');
  });

  it('detecta un importe cargado distinto y no lo corrige', async () => {
    await cargarDocumento('001-001-0000001', '1100000');
    await importarSiga([{ numero: '001-001-0000001', total: '1000000' }]);

    const resultado = await conciliar();
    const diferencias = resultado['diferenciasDeMonto'] as Array<Record<string, string>>;

    expect(diferencias).toHaveLength(1);
    expect(diferencias[0]?.['recibido']).toBe('1100000');
    expect(diferencias[0]?.['enSiga']).toBe('1000000');
    expect(diferencias[0]?.['diferencia']).toBe('100000');
    expect(resultado['magnitudDeLasDiferencias']).toBe('100000');
  });

  it('las diferencias en sentidos opuestos no se cancelan entre sí', async () => {
    await cargarDocumento('001-001-0000001', '1100000');
    await cargarDocumento('001-001-0000002', '900000');
    await importarSiga([
      { numero: '001-001-0000001', total: '1000000' },
      { numero: '001-001-0000002', total: '1000000' },
    ]);

    const resultado = await conciliar();

    // +100.000 y -100.000: hay 200.000 en discusión, no cero.
    expect(resultado['magnitudDeLasDiferencias']).toBe('200000');
  });

  it('informa cuántos documentos no se pudieron comparar por falta de identificación', async () => {
    await cargarDocumento('001-001-0000001', '1100000');

    // Un contrato no tiene RUC ni timbrado ni número: no es conciliable.
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipo: 'CONTRATO', canalRecepcion: 'EMAIL',
        recibidoEn: '2026-03-20T12:00:00Z',
        rucEmisor: null, timbrado: null, numeroComprobante: null, total: null, tasa: null,
      },
    });

    await importarSiga([{ numero: '001-001-0000001', total: '1100000' }]);

    const resultado = await conciliar();

    // Si no se informaran, la conciliación diría "todo cuadra" sobre un
    // conjunto incompleto.
    expect(resultado['sinIdentificacion']).toBe(1);
    expect(resultado['conciliado']).toBe(true);
  });

  it('un período sin nada concilia en vacío', async () => {
    const resultado = await conciliar();

    expect(resultado['conciliado']).toBe(true);
    expect(resultado['totalRecibidos']).toBe(0);
    expect(resultado['totalEnSiga']).toBe(0);
  });

  it('no se puede conciliar un cliente ajeno', async () => {
    const respuesta = await ctx.app.inject({
      method: 'GET', url: `/api/v1/clientes/${AJENO}/siga/2026-03/conciliacion`,
      headers: { cookie: coordinador },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('los importes de la conciliación viajan como texto', async () => {
    await cargarDocumento('001-001-0000001', '9007199254740993');
    await importarSiga([{ numero: '001-001-0000001', total: '1' }]);

    const resultado = await conciliar();
    const diferencias = resultado['diferenciasDeMonto'] as Array<Record<string, string>>;

    // Por encima del entero seguro de JavaScript: como número volvería alterado.
    expect(diferencias[0]?.['recibido']).toBe('9007199254740993');
    expect(typeof diferencias[0]?.['recibido']).toBe('string');
  });
});

/* ========================================================================== */

describe('liquidaciones', () => {
  const liquidacionMensual = { periodo: '2026-03', tipo: 'IVA mensual' };

  async function crear(): Promise<string> {
    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/liquidaciones`,
      headers: { cookie: coordinador }, payload: liquidacionMensual,
    });
    return JSON.parse(r.body).liquidacion.id;
  }

  it('una liquidación sin archivo nace pendiente', async () => {
    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/liquidaciones`,
      headers: { cookie: coordinador }, payload: liquidacionMensual,
    });

    expect(r.statusCode).toBe(201);
    expect(JSON.parse(r.body).liquidacion.estado).toBe('PENDIENTE');
  });

  it('con archivo adjunto nace generada', async () => {
    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/liquidaciones`,
      headers: { cookie: coordinador },
      payload: { ...liquidacionMensual, archivoEvidenciaId: '33333333-3333-4333-8333-333333333333' },
    });

    expect(JSON.parse(r.body).liquidacion.estado).toBe('GENERADA');
  });

  it('registrar el envío guarda destinatario, canal y fecha', async () => {
    const id = await crear();

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador },
      payload: {
        canal: 'EMAIL', destinatario: 'contacto@garso.com.py',
        fechaEnvio: '2026-04-10T14:00:00Z',
      },
    });

    expect(r.statusCode).toBe(200);
    const { liquidacion } = JSON.parse(r.body);
    expect(liquidacion.estado).toBe('ENVIADA');
    expect(liquidacion.destinatario).toBe('contacto@garso.com.py');
    expect(liquidacion.canal).toBe('EMAIL');
  });

  it('un envío por correo exige una dirección válida', async () => {
    const id = await crear();

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador },
      payload: {
        canal: 'EMAIL', destinatario: 'esto no es un correo',
        fechaEnvio: '2026-04-10T14:00:00Z',
      },
    });

    // Un envío registrado contra un destinatario mal escrito parece gestión
    // hecha y no lo es.
    expect(r.statusCode).toBe(400);
  });

  it('por WhatsApp el destinatario puede ser un número', async () => {
    const id = await crear();

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador },
      payload: {
        canal: 'WHATSAPP', destinatario: '+595 981 123456',
        fechaEnvio: '2026-04-10T14:00:00Z',
      },
    });

    expect(r.statusCode).toBe(200);
  });

  it('no se puede registrar un envío con fecha futura', async () => {
    const id = await crear();

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador },
      payload: {
        canal: 'EMAIL', destinatario: 'contacto@garso.com.py',
        fechaEnvio: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });

    expect(r.statusCode).toBe(400);
  });

  it('no se puede enviar dos veces', async () => {
    const id = await crear();
    const envio = {
      canal: 'EMAIL', destinatario: 'contacto@garso.com.py',
      fechaEnvio: '2026-04-10T14:00:00Z',
    };

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador }, payload: envio,
    });

    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador }, payload: envio,
    });

    expect(segunda.statusCode).toBe(409);
    expect(JSON.parse(segunda.body).error).toBe('ya_enviada');
  });

  it('no se puede registrar la respuesta de algo que nunca se envió', async () => {
    const id = await crear();

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/respuesta`,
      headers: { cookie: coordinador },
      payload: { respuesta: 'Recibido, gracias.', respondidaEn: '2026-04-11T10:00:00Z' },
    });

    // Sería una contradicción en el historial del cliente.
    expect(r.statusCode).toBe(409);
    expect(JSON.parse(r.body).error).toBe('no_enviada');
  });

  it('el ciclo completo queda registrado: generada, enviada, respondida', async () => {
    const id = await crear();

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador },
      payload: {
        canal: 'EMAIL', destinatario: 'contacto@garso.com.py',
        fechaEnvio: '2026-04-10T14:00:00Z',
      },
    });

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/respuesta`,
      headers: { cookie: coordinador },
      payload: { respuesta: 'Recibido, gracias.', respondidaEn: '2026-04-11T10:00:00Z' },
    });

    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).liquidacion.estado).toBe('RESPONDIDA');

    const acciones = ctx.bitacora.accionesRegistradas();
    expect(acciones).toContain('liquidacion.generada');
    expect(acciones).toContain('liquidacion.enviada');
    expect(acciones).toContain('liquidacion.respondida');
  });

  it('registrar la respuesta exige decir qué respondió el cliente', async () => {
    const id = await crear();
    await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/enviar`,
      headers: { cookie: coordinador },
      payload: {
        canal: 'EMAIL', destinatario: 'contacto@garso.com.py',
        fechaEnvio: '2026-04-10T14:00:00Z',
      },
    });

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/liquidaciones/${id}/respuesta`,
      headers: { cookie: coordinador },
      payload: { respuesta: '', respondidaEn: '2026-04-11T10:00:00Z' },
    });

    expect(r.statusCode).toBe(400);
  });

  it('un auxiliar puede ver las liquidaciones pero no crearlas', async () => {
    const auxiliar = await acceder(ctx, 'aracely@effort.com.py');

    const ver = await ctx.app.inject({
      method: 'GET', url: `/api/v1/clientes/${MIO}/liquidaciones`,
      headers: { cookie: auxiliar },
    });
    expect(ver.statusCode).toBe(200);

    const crear = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/liquidaciones`,
      headers: { cookie: auxiliar }, payload: liquidacionMensual,
    });
    expect(crear.statusCode).toBe(403);
  });

  it('no se ven las liquidaciones de clientes ajenos', async () => {
    ctx.liquidaciones.liquidaciones.push({
      id: 'liq-ajena', clienteId: AJENO, periodo: '2026-03', tipo: 'IVA mensual',
      archivoEvidenciaId: null, destinatario: null, canal: null, fechaEnvio: null,
      evidenciaEnvioId: null, responsableId: null, estado: 'PENDIENTE',
      respuestaCliente: null, respondidaEn: null, proximaAccion: null, observaciones: null,
    });

    const r = await ctx.app.inject({
      method: 'GET', url: '/api/v1/liquidaciones', headers: { cookie: coordinador },
    });

    expect(JSON.parse(r.body).liquidaciones).toHaveLength(0);
  });
});
