/**
 * Casos dorados.
 *
 * Cada archivo de `fixtures/golden/` es un contrato contable escrito en datos,
 * no en código: puede leerlo un contador sin saber TypeScript, y EFFORT puede
 * validarlo contra una liquidación real ya presentada.
 *
 * Si una de estas expectativas cambia, tiene que cambiar porque cambió la regla
 * — nunca porque cambió la implementación. Por eso viven fuera del código.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  desglosarIvaIncluido,
  DIVISORES_CONFIRMADOS_POR_EFFORT,
  determinarIva,
  diasRestantes,
  dividirRedondeado,
  fechaCivilDesdeIso,
  gs,
  nivelAlertaPorDias,
  type NivelAlerta,
  type TipoTasaIva,
} from '../src/index.js';

const carpetaGolden = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden');

function cargar<T>(archivo: string): T {
  return JSON.parse(readFileSync(join(carpetaGolden, archivo), 'utf8')) as T;
}

interface ArchivoGolden<C> {
  readonly descripcion: string;
  readonly fuente_de_la_regla: string;
  readonly casos: readonly C[];
}

describe('golden: redondeo a guaraní entero', () => {
  const archivo = cargar<
    ArchivoGolden<{ nombre: string; numerador: string; denominador: string; esperado: string }>
  >('redondeo.json');

  it('tiene la fuente de la regla documentada', () => {
    expect(archivo.fuente_de_la_regla).not.toBe('');
  });

  for (const caso of archivo.casos) {
    it(caso.nombre, () => {
      const resultado = dividirRedondeado(BigInt(caso.numerador), BigInt(caso.denominador));
      expect(resultado.toString()).toBe(caso.esperado);
    });
  }
});

describe('golden: desglose de IVA incluido', () => {
  const archivo = cargar<
    ArchivoGolden<{
      nombre: string;
      total: string;
      tasa: TipoTasaIva;
      iva: string;
      gravado: string;
    }>
  >('iva-desglose.json');

  for (const caso of archivo.casos) {
    it(caso.nombre, () => {
      const desglose = desglosarIvaIncluido(gs(caso.total), caso.tasa, DIVISORES_CONFIRMADOS_POR_EFFORT);

      expect(desglose.iva.toString()).toBe(caso.iva);
      expect(desglose.gravado.toString()).toBe(caso.gravado);
    });
  }

  it('el invariante gravado + iva === total se cumple en todos los casos', () => {
    for (const caso of archivo.casos) {
      const desglose = desglosarIvaIncluido(gs(caso.total), caso.tasa, DIVISORES_CONFIRMADOS_POR_EFFORT);
      expect(desglose.gravado + desglose.iva).toBe(desglose.total);
    }
  });
});

describe('golden: determinación mensual de IVA', () => {
  const archivo = cargar<
    ArchivoGolden<{
      nombre: string;
      debitoFiscal: string;
      creditoFiscal: string;
      saldoAFavorAnterior: string;
      saldoAPagar: string;
      saldoAFavor: string;
    }>
  >('iva-determinacion.json');

  for (const caso of archivo.casos) {
    it(caso.nombre, () => {
      const resultado = determinarIva({
        debitoFiscal: gs(caso.debitoFiscal),
        creditoFiscal: gs(caso.creditoFiscal),
        saldoAFavorAnterior: gs(caso.saldoAFavorAnterior),
      });

      expect(resultado.saldoAPagar.toString()).toBe(caso.saldoAPagar);
      expect(resultado.saldoAFavor.toString()).toBe(caso.saldoAFavor);
    });
  }

  it('nunca produce a pagar y a favor simultáneamente, ni valores negativos', () => {
    for (const caso of archivo.casos) {
      const resultado = determinarIva({
        debitoFiscal: gs(caso.debitoFiscal),
        creditoFiscal: gs(caso.creditoFiscal),
        saldoAFavorAnterior: gs(caso.saldoAFavorAnterior),
      });

      expect(resultado.saldoAPagar >= 0n).toBe(true);
      expect(resultado.saldoAFavor >= 0n).toBe(true);
      expect(resultado.saldoAPagar === 0n || resultado.saldoAFavor === 0n).toBe(true);
    }
  });
});

describe('golden: días restantes y nivel de alerta', () => {
  const archivo = cargar<
    ArchivoGolden<{
      nombre: string;
      instanteUtc: string;
      fechaVencimiento: string;
      diasRestantes: number;
      nivel: NivelAlerta;
    }>
  >('vencimientos.json');

  for (const caso of archivo.casos) {
    it(caso.nombre, () => {
      const dias = diasRestantes(
        fechaCivilDesdeIso(caso.fechaVencimiento),
        new Date(caso.instanteUtc),
      );

      expect(dias).toBe(caso.diasRestantes);
      expect(nivelAlertaPorDias(dias)).toBe(caso.nivel);
    });
  }
});
