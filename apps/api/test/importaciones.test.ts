/**
 * Rutas de importación desde archivo (tarea 93, Parte 5).
 *
 * Ejercitan el servidor completo con dobles de persistencia, igual que
 * `modulos.test.ts` y `siga.test.ts`. Lo que se prueba acá es específico de
 * estas dos rutas: el gate obligatorio simulación/real, que la simulación
 * nunca toca la base, y que el reporte de aceptados/rechazados llega intacto
 * desde `@effort/importers`. El parseo en sí ya está probado exhaustivamente
 * en `packages/importers`; acá no hace falta repetirlo.
 */

import ExcelJS from 'exceljs';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { construirServidor, type Dependencias } from '../src/servidor.js';
import { registrarRutasDeAutenticacion } from '../src/rutas/autenticacion.js';
import { registrarRutasDeDocumentos } from '../src/rutas/documentos.js';
import { registrarRutasDeSiga } from '../src/rutas/siga.js';
import { hashearContrasena } from '../src/seguridad/credenciales.js';
import { AlmacenEnMemoria } from '../src/seguridad/limites.js';
import { NOMBRE_COOKIE_SESION } from '../src/seguridad/sesiones.js';
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
  AlertasFalsas,
  BalancesFalsos,
  DocumentosFalsos,
  ExportacionesSigaFalsas,
  LiquidacionesFalsas,
  ProcesoMensualFalso,
  ReglasDeNotificacionFalsas,
  ReglasImpositivasFalsas,
  VencimientosFalsos,
} from './dobles-dominio.js';

const CONTRASENA = 'una frase larga y memorable';
const MIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';
const HOY = new Date('2026-04-21T13:00:00Z');
const RUC_VALIDO = '80017726-6';

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
  siga: ExportacionesSigaFalsas;
}

async function montar(): Promise<Contexto> {
  const usuarios = new UsuariosFalsos();
  const clientes = new ClientesFalsos();
  const bitacora = new BitacoraFalsa();
  const documentos = new DocumentosFalsos();
  const siga = new ExportacionesSigaFalsas();
  const hash = await hashearContrasena(CONTRASENA);

  const base = {
    activo: true, hashContrasena: hash, secretoTotp: null,
    segundoFactorActivo: false, debeCambiarContrasena: false,
  };

  usuarios.usuarios.push(
    { id: 'usr-coordinador', email: 'karina@effort.com.py', rol: 'coordinador', veTodosLosClientes: false, ...base },
    { id: 'usr-lectura', email: 'lectura@effort.com.py', rol: 'solo_lectura', veTodosLosClientes: true, ...base },
  );
  usuarios.asignaciones.set('usr-coordinador', [MIO]);

  clientes.clientes.push(
    clienteMinimo({ id: MIO, nombre: 'GARSO S.A.', ruc: RUC_VALIDO, activo: true }),
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
    procesoMensual: new ProcesoMensualFalso(),
    vencimientos: new VencimientosFalsos(),
    balances: new BalancesFalsos(),
    exportacionesSiga: siga,
    liquidaciones: new LiquidacionesFalsas(),
    alertas: new AlertasFalsas(),
    reglasImpositivas: new ReglasImpositivasFalsas(),
    reglasDeNotificacion: new ReglasDeNotificacionFalsas(),
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => HOY,
  };

  const app = await construirServidor(deps);
  await registrarRutasDeAutenticacion(app, deps);
  await registrarRutasDeDocumentos(app, deps);
  await registrarRutasDeSiga(app, deps);
  await app.ready();
  await activarCsrfEnInject(app);

  return { app, bitacora, documentos, siga };
}

async function acceder(ctx: Contexto, email: string): Promise<string> {
  const r = await ctx.app.inject({
    method: 'POST', url: '/api/v1/acceso', payload: { email, contrasena: CONTRASENA },
  });
  const cookie = r.cookies.find((c) => c.name === NOMBRE_COOKIE_SESION);
  if (!cookie) throw new Error(`Sin cookie: ${r.body}`);
  return `${cookie.name}=${cookie.value}`;
}

const ENCABEZADOS_COMPROBANTES = [
  'RUC Emisor', 'Timbrado', 'Numero', 'Tipo', 'Origen', 'Fecha', 'Total', 'Tasa', 'Anulado',
];
const ENCABEZADOS_SIGA = [
  'RUC Emisor', 'Timbrado', 'Numero Comprobante', 'Total', 'Tasa', 'Anulado', 'Fecha',
];

async function base64Xlsx(encabezados: string[], filas: (readonly unknown[])[]): Promise<string> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Datos');
  hoja.addRow(encabezados);
  for (const fila of filas) hoja.addRow([...fila]);
  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
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

/* ========================================================================== */

describe('POST /clientes/:clienteId/documentos/importar', () => {
  const filaValida = [
    RUC_VALIDO, '12345678', '001-001-0000001', 'FACTURA', 'COMPRA',
    new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'NO',
  ];

  it('modo simulacion informa el reporte sin persistir nada', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'simulacion' },
    });

    expect(r.statusCode).toBe(200);
    const cuerpo = JSON.parse(r.body);
    expect(cuerpo.modo).toBe('simulacion');
    expect(cuerpo.aceptados).toHaveLength(1);
    expect(cuerpo.rechazados).toEqual([]);
    expect(cuerpo.persistidos).toEqual([]);
    expect(ctx.documentos.documentos).toHaveLength(0);
  });

  it('modo real persiste cada fila aceptada y mapea tipo+origen a FACTURA_COMPRA', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'real' },
    });

    expect(r.statusCode).toBe(200);
    const cuerpo = JSON.parse(r.body);
    expect(cuerpo.modo).toBe('real');
    expect(cuerpo.persistidos).toHaveLength(1);
    expect(ctx.documentos.documentos).toHaveLength(1);
    expect(ctx.documentos.documentos[0]?.tipo).toBe('FACTURA_COMPRA');
    expect(ctx.documentos.documentos[0]?.canalRecepcion).toBe('ONEDRIVE');
    expect(ctx.documentos.documentos[0]?.total).toBe(150000n);
    expect(ctx.documentos.documentos[0]?.observaciones).toMatch(/marzo\.xlsx/);
  });

  it('una factura de venta mapea a FACTURA_VENTA', async () => {
    const filaVenta = [
      RUC_VALIDO, '12345678', '001-001-0000002', 'FACTURA', 'VENTA',
      new Date(Date.UTC(2026, 2, 15)), 150000, 'DIEZ', 'NO',
    ];
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaVenta]);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'real' },
    });

    expect(ctx.documentos.documentos[0]?.tipo).toBe('FACTURA_VENTA');
  });

  it('el modo es obligatorio: omitirlo es un 400, no un dry-run por defecto', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64 },
    });

    expect(r.statusCode).toBe(400);
    expect(ctx.documentos.documentos).toHaveLength(0);
  });

  it('un archivo que no se puede leer da 400 con mensaje claro, no 500', async () => {
    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', nombreArchivo: 'marzo.xlsx',
        contenidoBase64: Buffer.from('esto no es un xlsx').toString('base64'),
        modo: 'simulacion',
      },
    });

    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error).toBe('archivo_invalido');
  });

  it('filas inválidas quedan en rechazados con el motivo, y no se persisten', async () => {
    const filaInvalida = ['no-es-ruc', '', '', 'X', 'X', 'x', 'x', 'X', 'x'];
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida, filaInvalida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'real' },
    });

    const cuerpo = JSON.parse(r.body);
    expect(cuerpo.aceptados).toHaveLength(1);
    expect(cuerpo.rechazados).toHaveLength(1);
    expect(cuerpo.rechazados[0].motivo).toMatch(/RUC inválido/);
    expect(ctx.documentos.documentos).toHaveLength(1);
  });

  it('un solo_lectura no puede importar', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: soloLectura },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'simulacion' },
    });

    expect(r.statusCode).toBe(403);
  });

  it('no se puede importar en un cliente ajeno', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${AJENO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'simulacion' },
    });

    expect(r.statusCode).toBe(403);
  });

  it('la importación real queda en la bitácora, la simulación no', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'simulacion' },
    });
    expect(ctx.bitacora.filas.find((f) => f.accion === 'documento.importado_desde_archivo')).toBeUndefined();

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'real' },
    });
    const entrada = ctx.bitacora.filas.find((f) => f.accion === 'documento.importado_desde_archivo');
    expect(entrada?.clienteId).toBe(MIO);
    expect((entrada?.datosDespues as Record<string, unknown>)['persistidos']).toBe(1);
  });

  it('reimportar el mismo archivo no duplica el documento (tarea 94)', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]);
    const payload = { periodo: '2026-03', nombreArchivo: 'marzo.xlsx', contenidoBase64, modo: 'real' as const };

    const primera = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador }, payload,
    });
    const segunda = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador }, payload,
    });

    // La segunda corrida no debe reventar (era el riesgo real antes de esta
    // tarea: la restricción única de la base ya existía y create() por fila
    // habría lanzado un error sin capturar) ni duplicar el documento.
    expect(primera.statusCode).toBe(200);
    expect(segunda.statusCode).toBe(200);
    expect(JSON.parse(primera.body).persistidos).toHaveLength(1);
    expect(JSON.parse(segunda.body).persistidos).toHaveLength(0);
    expect(ctx.documentos.documentos).toHaveLength(1);
  });

  it('en un lote con una fila nueva y una ya importada, solo persiste la nueva', async () => {
    const filaOtra = [
      RUC_VALIDO, '12345678', '001-001-0000002', 'FACTURA', 'COMPRA',
      new Date(Date.UTC(2026, 2, 16)), 200000, 'DIEZ', 'NO',
    ];

    await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', nombreArchivo: 'marzo.xlsx',
        contenidoBase64: await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida]),
        modo: 'real',
      },
    });

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/documentos/importar`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', nombreArchivo: 'abril.xlsx',
        contenidoBase64: await base64Xlsx(ENCABEZADOS_COMPROBANTES, [filaValida, filaOtra]),
        modo: 'real',
      },
    });

    expect(JSON.parse(r.body).persistidos).toHaveLength(1);
    expect(ctx.documentos.documentos).toHaveLength(2);
  });

  it('dos documentos sin RUC/timbrado/número (ej. contratos) nunca chocan entre sí', async () => {
    // NULL no colisiona con NULL en la restricción única real: dos filas sin
    // la terna completa tienen que poder coexistir sin límite.
    await ctx.documentos.registrar({
      clienteId: MIO, periodo: '2026-03', tipo: 'CONTRATO', canalRecepcion: 'EMAIL',
      recibidoEn: HOY, rucEmisor: null, timbrado: null, numeroComprobante: null,
      total: null, tasa: null, anulado: false, evidenciaId: null, observaciones: null,
      creadoPorUsuarioId: 'usr-coordinador',
    });

    const insertados = await ctx.documentos.registrarLote([
      {
        clienteId: MIO, periodo: '2026-03', tipo: 'CONTRATO', canalRecepcion: 'EMAIL',
        recibidoEn: HOY, rucEmisor: null, timbrado: null, numeroComprobante: null,
        total: null, tasa: null, anulado: false, evidenciaId: null, observaciones: null,
        creadoPorUsuarioId: 'usr-coordinador',
      },
    ]);

    expect(insertados).toHaveLength(1);
    expect(ctx.documentos.documentos).toHaveLength(2);
  });
});

/* ========================================================================== */

describe('POST /clientes/:clienteId/siga/importar', () => {
  const filaValida = [RUC_VALIDO, '12345678', '001-001-0000001', 150000, 'DIEZ', 'NO', new Date(Date.UTC(2026, 2, 15))];

  it('modo simulacion informa el reporte sin persistir nada', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_SIGA, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga/importar`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        nombreArchivo: 'libro-compras.xlsx', contenidoBase64, modo: 'simulacion',
      },
    });

    expect(r.statusCode).toBe(200);
    const cuerpo = JSON.parse(r.body);
    expect(cuerpo.modo).toBe('simulacion');
    expect(cuerpo.aceptados).toHaveLength(1);
    expect(ctx.siga.exportaciones).toHaveLength(0);
    expect(ctx.siga.comprobantes).toHaveLength(0);
  });

  it('modo real registra la exportación completa con sus filas', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_SIGA, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga/importar`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        nombreArchivo: 'libro-compras.xlsx', contenidoBase64, modo: 'real',
      },
    });

    expect(r.statusCode).toBe(201);
    const cuerpo = JSON.parse(r.body);
    expect(cuerpo.exportacion.filasLeidas).toBe(1);
    expect(ctx.siga.exportaciones).toHaveLength(1);
    expect(ctx.siga.comprobantes).toHaveLength(1);
  });

  it('reimportar el mismo archivo no duplica comprobantes (ya resuelto desde la tarea 74)', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_SIGA, [filaValida]);
    const payload = {
      periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
      nombreArchivo: 'libro-compras.xlsx', contenidoBase64, modo: 'real' as const,
    };

    await ctx.app.inject({ method: 'POST', url: `/api/v1/clientes/${MIO}/siga/importar`, headers: { cookie: coordinador }, payload });
    await ctx.app.inject({ method: 'POST', url: `/api/v1/clientes/${MIO}/siga/importar`, headers: { cookie: coordinador }, payload });

    // Dos exportaciones (cada corrida es su propio evento auditable), un solo comprobante.
    expect(ctx.siga.exportaciones).toHaveLength(2);
    expect(ctx.siga.comprobantes).toHaveLength(1);
  });

  it('el modo es obligatorio', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_SIGA, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga/importar`,
      headers: { cookie: coordinador },
      payload: {
        periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        nombreArchivo: 'libro-compras.xlsx', contenidoBase64,
      },
    });

    expect(r.statusCode).toBe(400);
  });

  it('un solo_lectura no puede importar', async () => {
    const contenidoBase64 = await base64Xlsx(ENCABEZADOS_SIGA, [filaValida]);

    const r = await ctx.app.inject({
      method: 'POST', url: `/api/v1/clientes/${MIO}/siga/importar`,
      headers: { cookie: soloLectura },
      payload: {
        periodo: '2026-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        nombreArchivo: 'libro-compras.xlsx', contenidoBase64, modo: 'simulacion',
      },
    });

    expect(r.statusCode).toBe(403);
  });
});
