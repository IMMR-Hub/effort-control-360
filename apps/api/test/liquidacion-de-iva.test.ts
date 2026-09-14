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
import { ClientesFalsos, clienteMinimo } from './dobles.js';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const USUARIO = 'usr-sistema';
const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
  readonly registro: 'COMPRAS' | 'VENTAS';
  readonly numero: string;
  readonly gravado10: number;
  readonly iva10: number;
  readonly periodo?: string;
}

async function planilla(comprobantes: readonly Comprobante[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Datos');
  hoja.addRow(ENCABEZADOS);
  for (const c of comprobantes) {
    hoja.addRow([
      '80119631', 'FUMIPRO S.A.', '80108594', 'RUC', 'PASANA SA',
      c.registro, 'FACTURA', '19/02/2026', c.periodo ?? '02/2026', 'CONTADO', 'NO',
      '18535669', c.numero, '',
      c.gravado10, c.iva10, 0, 0, 0, c.gravado10, 'SI', 'NO', 'NO', 'NO',
      '', '', '16/03/2026', 'IMPORTACION',
    ]);
  }
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
   * dos y el crédito fiscal del período salía doble.
   */
  it('un comprobante que está en dos planillas cuenta una vez, y manda la corrección', async () => {
    const contenidos = new Map<string, Buffer | Error>([
      ['correccion', await planilla([
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 10000 },
      ])],
      ['original', await planilla([
        // En el original el IVA estaba mal cargado; la corrección lo arregló.
        { registro: 'COMPRAS', numero: '001-001-0000001', gravado10: 110000, iva10: 9000 },
        { registro: 'COMPRAS', numero: '001-001-0000002', gravado10: 220000, iva10: 20000 },
      ])],
    ]);
    const ctx = armar(
      [
        // La corrección llega primero a propósito: el orden de lectura no puede
        // depender del orden en que el repositorio devuelve los archivos.
        archivo({ itemIdOneDrive: 'correccion', nombreArchivo: 'CORRECCION RG COMPRAS 07 2026 - FUMIPRO SA.xlsx' }),
        archivo({ itemIdOneDrive: 'original', nombreArchivo: 'RG COMPRAS 07 2026 - FUMIPRO SA.xlsx' }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.comprobantesRepetidos).toBe(1);
    expect(ctx.liquidaciones[0]!.comprobantesCompras).toBe(2);
    // 10.000 de la corrección + 20.000 del segundo comprobante. No 39.000.
    expect(ctx.liquidaciones[0]!.creditoFiscal).toBe(gs(30000));
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
    ]);
    const ctx = armar(
      [
        archivo({ itemIdOneDrive: 'excel' }),
        archivo({ itemIdOneDrive: 'pdf', nombreArchivo: 'RG COMPRAS FEBRERO 2026.pdf', tipoMime: 'application/pdf' }),
        archivo({ itemIdOneDrive: 'otro', nombreArchivo: 'BALANCE 2025.xlsx' }),
      ],
      contenidos,
    );

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.archivosLeidos).toBe(1);
    expect(resumen.fallos).toEqual([]);
  });

  it('un cliente inactivo no se liquida', async () => {
    const ctx = armar([archivo({ itemIdOneDrive: 'it-1' })], new Map());
    ctx.deps.clientes.clientes[0]!.activo = false;

    const resumen = await liquidarIvaDesdeLibros(ctx.deps, USUARIO);

    expect(resumen.periodosCalculados).toBe(0);
    expect(resumen.fallos).toEqual([]);
  });
});
