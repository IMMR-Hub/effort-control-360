/**
 * Liquidación de IVA desde las planillas RG 90.
 *
 * Lo que importa probar acá no es que sume —eso ya está probado en el
 * importador— sino las decisiones de este servicio: qué archivos elige, qué
 * hace cuando uno falla, y que correrlo dos veces no ensucie nada. Es un
 * servicio que va a correr solo, y un servicio automático que duplica o que se
 * cae por un archivo roto deja de servir el primer día que pasa.
 */

import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

import { DIVISORES_CONFIRMADOS_POR_EFFORT, gs } from '@effort/core';

import {
  liquidarIvaDesdeLibros,
  type AltaDeHallazgo,
  type AltaDeLiquidacion,
  type ArchivoDeLibro,
} from '../src/servicios/liquidacionDeIva.js';
import { ErrorTransitorioDeDrive } from '@effort/drive';

import { ClientesFalsos, clienteMinimo } from './dobles.js';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const USUARIO = 'usr-sistema';
const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Mediodía del 16 de septiembre de 2026 en Asunción: el mes en curso es 2026-09. */
const HOY = new Date('2026-09-16T15:00:00Z');

const ENCABEZADOS = [
  'RUC del Informante', 'Nombre o Razon Social del Informante',
  'RUC / Nº de Identificacion del Informado', 'Tipo de Identificación del Informado',
  'Nombre o Razón Social del Informado', 'Tipo de Registro', 'Tipo de Comprobante',
  'Fecha de Emisión', 'Periodo de Emisión', 'Condicion de la Operacion',
  'Operación en Moneda Extranjera', 'Timbrado del Comprobante', 'Numero de Comprobante',
  'CDC', 'Monto Gravado 10%', 'IVA 10%', 'Monto Gravado 5%', 'IVA 5%',
  'Monto No Gravado / Exento ', 'Total Comprobante', 'Imputa IVA', 'Imputa IRE',
  'Imputa IRP', 'No Imputar', 'Numero de Comprobante Asociado',
  'Timbrado del Comprobante Asociado', 'Fecha de Registro', 'Origen de la Información',
];

interface Comprobante {
  /** Cualquier otro texto hace que el importador rechace la fila. */
  readonly registro: 'COMPRAS' | 'VENTAS' | 'OTRO';
  readonly numero: string;
  readonly gravado10: number;
  readonly iva10: number;
  readonly periodo?: string;
  readonly emision?: string;
}

async function planilla(comprobantes: readonly Comprobante[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Datos');
  hoja.addRow(ENCABEZADOS);
  for (const c of comprobantes) {
    hoja.addRow([
      '80119631', 'FUMIPRO S.A.', '80108594', 'RUC', 'PASANA SA',
      c.registro, 'FACTURA', c.emision ?? '19/02/2026', c.periodo ?? '02/2026', 'CONTADO', 'NO',
      '18535669', c.numero, '',
      c.gravado10, c.iva10, 0, 0, 0, c.gravado10, 'SI', 'NO', 'NO', 'NO',
      '', '', '16/03/2026', 'IMPORTACION',
    ]);
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Un Excel con datos que no es planilla RG 90 (un resumen, un cálculo auxiliar). */
async function otroExcel(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Resumen');
  hoja.addRow(['Mes', 'Total compras', 'Total ventas']);
  hoja.addRow(['Enero', 1500000, 3200000]);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

function archivo(parcial: Partial<ArchivoDeLibro> & { itemIdOneDrive: string }): ArchivoDeLibro {
  return {
    evidenciaId: `ev-${parcial.itemIdOneDrive}`,
    clienteId: CLIENTE,
    nombreArchivo: 'RG COMPRAS FEBRERO 2026 - FUMIPRO SA.xlsx',
    tipoMime: EXCEL,
    ...parcial,
  };
}

function armar(archivos: readonly ArchivoDeLibro[], contenidos: Map<string, Buffer | Error>) {
  const clientes = new ClientesFalsos();
  clientes.clientes.push(
    clienteMinimo({ id: CLIENTE, nombre: 'FUMIPRO S.A.', ruc: '80119631-0', activo: true }),
  );

  const liquidaciones: AltaDeLiquidacion[] = [];
  const hallazgos: AltaDeHallazgo[] = [];

  return {
    liquidaciones,
    hallazgos,
    deps: {
      clientes,
      librosDelCliente: async () => archivos,
      drive: {
        leer: async (itemId: string) => {
          const contenido = contenidos.get(itemId);
          if (contenido instanceof Error) throw contenido;
          if (!contenido) throw new Error(`No existe ${itemId}`);
          return contenido;
        },
      } as never,
      guardarLiquidacion: async (datos: AltaDeLiquidacion) => {
        // Igual que la base: una sola liquidación por cliente y período.
        const indice = liquidaciones.findIndex(
          (l) => l.clienteId === datos.clienteId && l.periodo === datos.periodo,
        );
        if (indice >= 0) liquidaciones[indice] = datos;
        else liquidaciones.push(datos);
      },
      guardarHallazgos: async (datos: readonly AltaDeHallazgo[]) => {
        let nuevos = 0;
        for (const h of datos) {
          const clave = `${h.clienteId}|${h.periodo}|${h.numeroComprobante}|${h.tipo}|${h.tasa}`;
          if (hallazgos.some((x) => `${x.clienteId}|${x.periodo}|${x.numeroComprobante}|${x.tipo}|${x.tasa}` === clave)) continue;
          hallazgos.push(h);
          nuevos += 1;
        }
        return nuevos;
      },
      divisores: DIVISORES_CONFIRMADOS_POR_EFFORT,
      ahora: () => HOY,
    },
  };
}

describe('liquidación de IVA desde los libros', () => {
  it('separa crédito de compras y débito de ventas, y calcula el saldo', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['it-1', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 },
        { registro: 'VENTAS', numero: '001-001-0000002', gravado10: 330000, iva10: 30000 },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], contenidos);

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.periodosCalculados).toBe(1);
    const liquidacion = ctx.liquidaciones[0]!;
    expect(liquidacion.creditoFiscal).toBe(gs(10000));
    expect(liquidacion.debitoFiscal).toBe(gs(30000));
    expect(liquidacion.saldoAPagar).toBe(gs(20000));
    expect(liquidacion.saldoAFavor).toBe(gs(0));
  });

  it('un período con más crédito que débito cierra a favor del cliente', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['it-1', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 330000, iva10: 30000 },
        { registro: 'VENTAS', numero: '001-001-0000002', gravado10: 110000, iva10: 10000 },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], contenidos);

    await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones[0]!.saldoAPagar).toBe(gs(0));
    expect(ctx.liquidaciones[0]!.saldoAFavor).toBe(gs(20000));
  });

  // Compras y ventas vienen en archivos separados: el período se arma juntando
  // los dos. Si cada archivo generara su propia liquidación, el crédito y el
  // débito nunca se encontrarían y el saldo saldría siempre mal.
  it('junta las compras y las ventas del mismo período aunque vengan en archivos distintos', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['compras', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 }])],
      ['ventas', await planilla([{ registro: 'VENTAS', numero: '001-001-0000002', gravado10: 330000, iva10: 30000 }])],
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'compras' }),
        archivo({ itemIdOneDrive: 'ventas', nombreArchivo: 'RG VENTAS FEBRERO 2026 - FUMIPRO SA.xlsx' }),
      ],
      contenidos,
    );

    await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones).toHaveLength(1);
    expect(ctx.liquidaciones[0]!.creditoFiscal).toBe(gs(10000));
    expect(ctx.liquidaciones[0]!.debitoFiscal).toBe(gs(30000));
  });

  /*
   * Caso real: FUMIPRO julio 2026 tiene "RG COMPRAS 07 2026" y "CORRECCION RG
   * COMPRAS 07 2026" en la misma carpeta. Hasta el 2026-09-14 se sumaban las
   * dos y el crédito fiscal del período salía doble. Desde el 2026-09-16 (tarea
   * 141) no se mezclan: vale la corrección entera, y el original se informa.
   */
  it('con dos planillas del mismo período vale solo la corrección, entera', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['correccion', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 },
      ])],
      ['original', await planilla([
        // En el original el IVA estaba mal cargado y había un comprobante de más.
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 9000 },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 220000, iva10: 20000 },
      ])],
    ]);
    const ctx = armar(
      [
        // La corrección llega primero y es la MÁS VIEJA a propósito: "CORRECCION"
        // manda antes que la fecha, y el orden del repositorio no importa.
        archivo({
          itemIdOneDrive: 'correccion',
          nombreArchivo: 'CORRECCION RG COMPRAS 07 2026 - FUMIPRO SA.xlsx',
          modificadoEnOrigen: new Date('2026-08-01'),
        }),
        archivo({
          itemIdOneDrive: 'original',
          nombreArchivo: 'RG COMPRAS 07 2026 - FUMIPRO SA.xlsx',
          modificadoEnOrigen: new Date('2026-08-20'),
        }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones[0]!.comprobantesCompras).toBe(1);
    expect(ctx.liquidaciones[0]!.creditoFiscal).toBe(gs(10000));
    expect(resumen.avisos).toHaveLength(1);
    expect(resumen.avisos[0]!.archivo).toBe('RG COMPRAS 07 2026 - FUMIPRO SA.xlsx');
    // Ganó por ser corrección, no por fecha: el aviso tiene que decir eso
    // (auditoría 2026-09-16: antes decía "más reciente" aunque fuera más vieja).
    expect(resumen.avisos[0]!.motivo).toMatch(/manda la corrección/);
    expect(resumen.avisos[0]!.motivo).not.toMatch(/más reciente/);
  });

  /*
   * Caso real (b) de la tarea 141: COPESA tiene agosto 2025 en
   * "RG 90 COMPRAS/08 Agosto 2025 ok verificado.xlsx" (568 filas) y en
   * "RG 90 COMPRAS/AGOSTO 2025.xlsx" (464), con contenido distinto. Juntarlas
   * mezclaría dos versiones del libro.
   */
  it('sin corrección, vale la planilla modificada más recientemente y no se mezclan', async () => {
    const agosto = { periodo: '08/2025' } as const;
    const contenidos = new Map<string, Buffer | Error>([
      ['verificado', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, ...agosto },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 220000, iva10: 20000, ...agosto },
      ])],
      ['viejo', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, ...agosto },
        { registro: 'COMPRAS', numero: '001-001-0000003', gravado10: 550000, iva10: 50000, ...agosto },
      ])],
      ['ventas', await planilla([
        { registro: 'VENTAS', numero: '002-001-0000001', gravado10: 330000, iva10: 30000, ...agosto },
      ])],
    ]);
    const ctx = armar(
      [
        archivo({
          itemIdOneDrive: 'verificado',
          nombreArchivo: '08 Agosto 2025 ok verificado.xlsx',
          modificadoEnOrigen: new Date('2025-09-20'),
        }),
        archivo({
          itemIdOneDrive: 'viejo',
          nombreArchivo: 'AGOSTO 2025.xlsx',
          modificadoEnOrigen: new Date('2025-09-05'),
        }),
        // Las ventas del mismo período vienen en otro archivo y NO compiten con
        // las compras: la regla es por período Y tipo de registro.
        archivo({ itemIdOneDrive: 'ventas', nombreArchivo: '08AGOSTO.xlsx', modificadoEnOrigen: new Date('2025-09-01') }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones).toHaveLength(1);
    const liquidacion = ctx.liquidaciones[0]!;
    expect(liquidacion.periodo).toBe('2025-08');
    expect(liquidacion.comprobantesCompras).toBe(2);
    // 10.000 + 20.000 de la verificada. No 80.000 (unión) ni 60.000 (la vieja).
    expect(liquidacion.creditoFiscal).toBe(gs(30000));
    expect(liquidacion.debitoFiscal).toBe(gs(30000));
    expect(liquidacion.archivosLeidos).toBe(2);
    expect(resumen.avisos.map((a) => a.archivo)).toEqual(['AGOSTO 2025.xlsx']);
  });

  /*
   * Caso real (a) de la tarea 141: "PERIODO 2026/DOCUMENTOS CONTABLES/RG 90
   * COMPRAS/01 ENERO.xlsx" de COPESA trae filas con períodos 2027-01 …
   * 2032-01 porque la columna de período se arrastró en el Excel.
   */
  it('rechaza con motivo las filas con un período posterior al mes en curso', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['enero', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, periodo: '01/2026' },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 110000, iva10: 10000, periodo: '01/2027' },
        { registro: 'COMPRAS', numero: '001-001-0000003', gravado10: 110000, iva10: 10000, periodo: '01/2032' },
        // El mes en curso sí vale: se puede estar cargando.
        { registro: 'COMPRAS', numero: '001-001-0000004', gravado10: 110000, iva10: 10000, periodo: '09/2026' },
        { registro: 'COMPRAS', numero: '001-001-0000005', gravado10: 110000, iva10: 10000, periodo: '10/2026' },
      ])],
    ]);
    const ctx = armar(
      [archivo({ itemIdOneDrive: 'enero', nombreArchivo: '01 ENERO.xlsx' })],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones.map((l) => l.periodo).sort()).toEqual(['2026-01', '2026-09']);
    expect(resumen.filasRechazadas).toBe(3);
    const futuras = resumen.avisos.filter((a) => /posterior al mes en curso/.test(a.motivo));
    expect(futuras).toHaveLength(1);
    expect(futuras[0]!.motivo).toMatch(/3 filas rechazadas.*posterior al mes en curso \(2026-09\)/);
    // 2026-09 es una fila suelta en un libro cuyo mes principal es 2026-01: se
    // usa porque no hay otro libro de septiembre, pero se avisa.
    expect(resumen.avisos.some((a) => /COMPRAS 2026-09 se calculó con 1 filas/.test(a.motivo))).toBe(true);
    expect(resumen.fallos).toEqual([]);
  });

  /*
   * Caso real (c) de la tarea 141: los libros que descarga la DNIT,
   * "80003112_202501_COMPRAS_150121_1.xlsx", se leen con 0 filas.
   */
  it('ignora sin contarlo como fallo un libro de la DNIT sin filas', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['dnit', await planilla([])],
      ['buena', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 }])],
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'dnit', nombreArchivo: '80003112_202501_COMPRAS_150121_1.xlsx' }),
        archivo({ itemIdOneDrive: 'buena', nombreArchivo: '02 FEBRERO.xlsx' }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.fallos).toEqual([]);
    expect(resumen.archivosIgnorados).toBe(1);
    expect(resumen.archivosLeidos).toBe(1);
    expect(resumen.avisos).toEqual([]);
  });

  it('cada período del cliente se guarda por separado', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['it-1', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, periodo: '02/2026' },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 220000, iva10: 20000, periodo: '03/2026' },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], contenidos);

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.periodosCalculados).toBe(2);
    expect(ctx.liquidaciones.map((l) => l.periodo).sort()).toEqual(['2026-02', '2026-03']);
  });

  // Va a correr solo: si duplicara, la pantalla mostraría el IVA dos veces.
  it('correrlo dos veces no duplica ni la liquidación ni los hallazgos', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['it-1', await planilla([
        // IVA declarado 10001 contra 10000 calculado: levanta un hallazgo.
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10001 },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], contenidos);

    await liquidarIvaDesdeLibros(ctx.deps, USUARIO);
    const segunda = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones).toHaveLength(1);
    expect(ctx.hallazgos).toHaveLength(1);
    expect(segunda.hallazgosNuevos).toBe(0);
  });

  it('detecta el crédito fiscal de más y lo guarda como hallazgo', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['it-1', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 1548000, iva10: 140739 }])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], contenidos);

    await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.hallazgos).toHaveLength(1);
    expect(ctx.hallazgos[0]!.riesgo).toBe('CREDITO_DE_MAS');
    expect(ctx.hallazgos[0]!.clienteId).toBe(CLIENTE);
  });

  // Un archivo roto no puede dejar sin IVA a los demás períodos del cliente.
  it('una planilla ilegible se anota y no frena a las otras', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['rota', new Error('El archivo está dañado.')],
      ['buena', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 }])],
    ]);
    const ctx = armar(
      [archivo({ itemIdOneDrive: 'rota' }), archivo({ itemIdOneDrive: 'buena' })],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.fallos).toHaveLength(1);
    expect(resumen.fallos[0]!.motivo).toMatch(/dañado/);
    expect(ctx.liquidaciones).toHaveLength(1);
  });

  /*
   * El mismo libro existe como PDF y como Excel. Solo el Excel se puede leer, y
   * los dos se clasifican como libro de compras — si el servicio eligiera por
   * tipo de documento en vez de por formato y nombre, intentaría parsear el PDF
   * y ensuciaría el reporte con un fallo en cada corrida.
   */
  it('ignora lo que no es una planilla RG 90 en Excel', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['excel', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 }])],
      ['otro', await otroExcel()],
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'excel' }),
        archivo({ itemIdOneDrive: 'pdf', nombreArchivo: 'RG COMPRAS FEBRERO 2026.pdf', tipoMime: 'application/pdf' }),
        // Clasificado como libro, con nombre sugestivo, pero es un resumen.
        archivo({ itemIdOneDrive: 'otro', nombreArchivo: 'RG COMPRAS RESUMEN 2026.xlsx' }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.archivosLeidos).toBe(1);
    expect(resumen.archivosIgnorados).toBe(1);
    expect(resumen.fallos).toEqual([]);
  });

  /*
   * Tarea 141: COPESA guarda sus libros como "RG 90 COMPRAS/01 Enero total OK
   * verificado.xlsx" y "RG 90 VENTAS/01ENERO.xlsx". Con el filtro por nombre
   * no se leía ninguno.
   */
  it('reconoce la planilla por sus encabezados, se llame como se llame', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['compras', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 }])],
      ['ventas', await planilla([{ registro: 'VENTAS', numero: '001-001-0000002', gravado10: 330000, iva10: 30000 }])],
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'compras', nombreArchivo: '01 Enero total OK verificado.xlsx' }),
        archivo({ itemIdOneDrive: 'ventas', nombreArchivo: '01ENERO.xlsx' }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.archivosLeidos).toBe(2);
    expect(ctx.liquidaciones).toHaveLength(1);
    expect(ctx.liquidaciones[0]!.creditoFiscal).toBe(gs(10000));
    expect(ctx.liquidaciones[0]!.debitoFiscal).toBe(gs(30000));
  });

  // ——— Auditoría del 2026-09-16 (tarea N7) ———

  it('un empate se resuelve siempre igual, sin importar el orden en que llegan', async () => {
    const mismaFecha = new Date('2026-08-10T12:00:00Z');
    const contenidos = async () =>
      new Map<string, Buffer | Error>([
        ['a', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 }])],
        ['b', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 220000, iva10: 20000 }])],
      ]);
    const a = archivo({ itemIdOneDrive: 'a', nombreArchivo: 'COMPRAS FEBRERO A.xlsx', modificadoEnOrigen: mismaFecha, evidenciaId: 'ev-a' });
    const b = archivo({ itemIdOneDrive: 'b', nombreArchivo: 'COMPRAS FEBRERO B.xlsx', modificadoEnOrigen: mismaFecha, evidenciaId: 'ev-b' });

    const enUnOrden = armar([a, b], await contenidos());
    const enElOtro = armar([b, a], await contenidos());
    const primero = await liquidarIvaDesdeLibros(enUnOrden.deps, USUARIO);
    await liquidarIvaDesdeLibros(enElOtro.deps, USUARIO);

    expect(enUnOrden.liquidaciones[0]!.creditoFiscal).toBe(enElOtro.liquidaciones[0]!.creditoFiscal);
    expect(primero.avisos[0]!.motivo).toMatch(/empate/);
  });

  it('"CORRECCION" cuenta solo al principio del nombre, con tilde y con una C de menos', async () => {
    const { esCorreccion } = await import('../src/servicios/liquidacionDeIva.js');
    expect(esCorreccion('CORRECCION RG COMPRAS 07 2026.xlsx')).toBe(true);
    expect(esCorreccion('Corrección RG COMPRAS 07 2026.xlsx')).toBe(true);
    expect(esCorreccion('CORRECION RG COMPRAS 07 2026.xlsx')).toBe(true);
    expect(esCorreccion('CORRECCION_RG_COMPRAS.xlsx')).toBe(true);
    expect(esCorreccion('SIN CORRECCION RG COMPRAS.xlsx')).toBe(false);
    expect(esCorreccion('CORRECCIONES PENDIENTES.xlsx')).toBe(false);
    expect(esCorreccion('RG COMPRAS 07 2026.xlsx')).toBe(false);
  });

  /*
   * El "01 ENERO.xlsx" de COPESA 2026 trae filas de enero con período
   * 2027-01 … 2032-01. En enero de 2027 dejan de ser "futuras": la fecha de
   * emisión las tiene que seguir delatando.
   */
  it('las filas con el período arrastrado se dejan afuera aunque ya no sean futuras', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['enero', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, periodo: '01/2026', emision: '10/01/2026' },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 110000, iva10: 10000, periodo: '01/2027', emision: '11/01/2026' },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'enero', nombreArchivo: '01 ENERO.xlsx' })], contenidos);

    const resumen = await liquidarIvaDesdeLibros(
      { ...ctx.deps, ahora: () => new Date('2027-01-20T15:00:00Z') },
      USUARIO,
    );

    expect(ctx.liquidaciones.map((l) => l.periodo)).toEqual(['2026-01']);
    expect(resumen.avisos.some((a) => /1 filas dejadas afuera.*fecha de emisión/.test(a.motivo))).toBe(true);
  });

  it('un mes inválido en la planilla no crea una liquidación', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['rara', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, periodo: '12/2025', emision: '10/12/2025' },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 110000, iva10: 10000, periodo: '13/2025', emision: '10/12/2025' },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'rara', nombreArchivo: '12 DICIEMBRE.xlsx' })], contenidos);

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones.map((l) => l.periodo)).toEqual(['2025-12']);
    expect(ctx.liquidaciones[0]!.filasRechazadas).toBe(1);
    expect(resumen.avisos.some((a) => /no es un mes válido/.test(a.motivo))).toBe(true);
  });

  /*
   * Si la planilla que manda no se pudo bajar por un corte, calcular con las
   * otras haría ganar en silencio a la versión vieja. Ese cliente se saltea
   * entero, y los demás siguen.
   */
  it('una falla pasajera al bajar una planilla deja al cliente sin calcular, y lo dice', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['correccion', new ErrorTransitorioDeDrive('Microsoft Graph devolvió 503')],
      ['original', await planilla([{ registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 9000 }])],
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'original', nombreArchivo: 'RG COMPRAS 07 2026.xlsx' }),
        archivo({ itemIdOneDrive: 'correccion', nombreArchivo: 'CORRECCION RG COMPRAS 07 2026.xlsx' }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(ctx.liquidaciones).toEqual([]);
    expect(ctx.hallazgos).toEqual([]);
    expect(resumen.clientesOmitidos).toHaveLength(1);
    expect(resumen.clientesOmitidos[0]!.motivo).toMatch(/503/);
    expect(resumen.fallos).toEqual([]);
  });

  it('una planilla RG 90 sin ninguna fila legible es un fallo, no un aviso', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['rota', await planilla([
        { registro: 'OTRO', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 },
        { registro: 'OTRO', numero: '001-001-0000002', gravado10: 110000, iva10: 10000 },
      ])],
    ]);
    const ctx = armar([archivo({ itemIdOneDrive: 'rota', nombreArchivo: '02 FEBRERO.xlsx' })], contenidos);

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.fallos).toHaveLength(1);
    expect(resumen.fallos[0]!.motivo).toMatch(/Ninguna de sus 2 filas/);
    expect(ctx.liquidaciones).toEqual([]);
  });

  it('las filas rechazadas se guardan en el período de su planilla, no el total del cliente', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['enero', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, periodo: '01/2026', emision: '10/01/2026' },
        { registro: 'OTRO', numero: '001-001-0000002', gravado10: 110000, iva10: 10000, periodo: '01/2026' },
      ])],
      ['febrero', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000003', gravado10: 110000, iva10: 10000, periodo: '02/2026' },
        { registro: 'OTRO', numero: '001-001-0000004', gravado10: 110000, iva10: 10000, periodo: '02/2026' },
        { registro: 'OTRO', numero: '001-001-0000005', gravado10: 110000, iva10: 10000, periodo: '02/2026' },
      ])],
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'enero', nombreArchivo: '01 ENERO.xlsx' }),
        archivo({ itemIdOneDrive: 'febrero', nombreArchivo: '02 FEBRERO.xlsx' }),
      ],
      contenidos,
    );

    await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    const porPeriodo = Object.fromEntries(ctx.liquidaciones.map((l) => [l.periodo, l.filasRechazadas]));
    expect(porPeriodo).toEqual({ '2026-01': 1, '2026-02': 2 });
  });

  /*
   * Una planilla más nueva con dos filas sueltas de otro mes no puede
   * desplazar al libro completo de ese mes (auditoría: P141-H06).
   */
  it('unas filas sueltas de otro mes no le ganan al libro de ese mes', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['setiembre', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000010', gravado10: 110000, iva10: 10000, periodo: '09/2025', emision: '05/09/2025' },
        { registro: 'COMPRAS', numero: '001-001-0000011', gravado10: 110000, iva10: 10000, periodo: '09/2025', emision: '05/09/2025' },
        { registro: 'COMPRAS', numero: '001-001-0000012', gravado10: 110000, iva10: 10000, periodo: '09/2025', emision: '05/09/2025' },
        { registro: 'COMPRAS', numero: '001-001-0000099', gravado10: 990000, iva10: 90000, periodo: '08/2025', emision: '30/08/2025' },
      ])],
      ['agosto', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000, periodo: '08/2025', emision: '05/08/2025' },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 220000, iva10: 20000, periodo: '08/2025', emision: '06/08/2025' },
      ])],
    ]);
    const ctx = armar(
      [
        // La de setiembre es más nueva: por fecha ganaría agosto si compitiera.
        archivo({ itemIdOneDrive: 'setiembre', nombreArchivo: '09 SETIEMBRE.xlsx', modificadoEnOrigen: new Date('2025-10-10') }),
        archivo({ itemIdOneDrive: 'agosto', nombreArchivo: '08 AGOSTO.xlsx', modificadoEnOrigen: new Date('2025-09-10') }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    const agosto = ctx.liquidaciones.find((l) => l.periodo === '2025-08')!;
    expect(agosto.creditoFiscal).toBe(gs(30000));
    expect(agosto.comprobantesCompras).toBe(2);
    expect(resumen.avisos.some((a) => /Filas sueltas de COMPRAS 2025-08/.test(a.motivo))).toBe(true);
  });

  it('una planilla demasiado grande no se baja y se informa como fallo', async () => {
    const leidos: string[] = [];
    const ctx = armar(
      [archivo({ itemIdOneDrive: 'enorme', nombreArchivo: 'ENORME.xlsx', tamanoBytes: 80 * 1024 * 1024 })],
      new Map(),
    );
    const leerOriginal = ctx.deps.drive.leer;
    const deps = {
      ...ctx.deps,
      drive: { leer: async (id: string) => { leidos.push(id); return leerOriginal(id); } } as never,
    };

    const resumen = await liquidarIvaDesdeLibros(deps, USUARIO);

    expect(leidos).toEqual([]);
    expect(resumen.fallos[0]!.motivo).toMatch(/80\.0 MB/);
  });

  it('un .xls viejo se avisa una vez y no es un fallo', async () => {
    const ctx = armar(
      [archivo({ itemIdOneDrive: 'viejo', nombreArchivo: 'RG COMPRAS 2019.xls', tipoMime: 'application/vnd.ms-excel' })],
      new Map(),
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.fallos).toEqual([]);
    expect(resumen.avisos).toHaveLength(1);
    expect(resumen.avisos[0]!.motivo).toMatch(/\.xls/);
  });

  it('los avisos tienen tope, y lo que no entra se cuenta', async () => {
    const muchos = Array.from({ length: 205 }, (_, i) =>
      archivo({ itemIdOneDrive: `x${i}`, nombreArchivo: `VIEJO ${i}.xls`, tipoMime: 'application/vnd.ms-excel' }),
    );
    const ctx = armar(muchos, new Map());

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.avisos).toHaveLength(200);
    expect(resumen.avisosOmitidos).toBe(5);
  });

  it('los avisos nombran la ruta completa del archivo cuando se conoce', async () => {
    const ctx = armar(
      [archivo({
        itemIdOneDrive: 'viejo',
        nombreArchivo: '01 ENERO.xls',
        tipoMime: 'application/vnd.ms-excel',
        rutaOneDrive: 'EFFORT Control 360/Entrada/COPESA/PERIODO 2026/RG 90 COMPRAS/01 ENERO.xls',
      })],
      new Map(),
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.avisos[0]!.archivo).toBe('EFFORT Control 360/Entrada/COPESA/PERIODO 2026/RG 90 COMPRAS/01 ENERO.xls');
  });

  it('un cliente inactivo no se liquida', async () => {
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], new Map());
    ctx.deps.clientes.clientes[0]!.activo = false;

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.periodosCalculados).toBe(0);
    expect(resumen.fallos).toEqual([]);
  });
});
