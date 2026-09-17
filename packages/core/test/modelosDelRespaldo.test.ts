/**
 * La lista de modelos del respaldo, contra el esquema real.
 *
 * Lo que importa acá no es que la lista tenga una forma bonita: es que no se
 * desalinee con `schema.prisma` sin que nadie lo note. Antes de esta lista
 * compartida, eso ya había pasado dos veces (ver el comentario de
 * `modelosDelRespaldo.ts`), y un respaldo "completo" que no lo es no se
 * descubre hasta el día que hace falta restaurar.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EXCLUIDOS_DEL_RESPALDO_A_PROPOSITO, MODELOS_DEL_RESPALDO } from '../src/modelosDelRespaldo.js';

/** `PascalCase` del `model` de Prisma → el nombre de propiedad que usa el cliente. */
function nombreDePropiedad(nombreDeModelo: string): string {
  return nombreDeModelo.charAt(0).toLowerCase() + nombreDeModelo.slice(1);
}

function modelosDelEsquema(): string[] {
  const rutaEsquema = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'apps',
    'api',
    'prisma',
    'schema.prisma',
  );
  const texto = readFileSync(rutaEsquema, 'utf8');
  const modelos: string[] = [];
  for (const coincidencia of texto.matchAll(/^model\s+(\w+)\s*\{/gm)) {
    modelos.push(nombreDePropiedad(coincidencia[1]!));
  }
  return modelos;
}

describe('modelos del respaldo', () => {
  it('cubre TODOS los modelos del esquema: ninguno falta, entre la lista y los excluidos', () => {
    const delEsquema = new Set(modelosDelEsquema());
    const cubiertos = new Set([...MODELOS_DEL_RESPALDO, ...Object.keys(EXCLUIDOS_DEL_RESPALDO_A_PROPOSITO)]);

    const faltantes = [...delEsquema].filter((m) => !cubiertos.has(m));
    expect(faltantes).toEqual([]);
  });

  it('no tiene ningún nombre que ya no exista en el esquema', () => {
    const delEsquema = new Set(modelosDelEsquema());

    const sobrantesEnLista = MODELOS_DEL_RESPALDO.filter((m) => !delEsquema.has(m));
    expect(sobrantesEnLista).toEqual([]);

    const sobrantesEnExcluidos = Object.keys(EXCLUIDOS_DEL_RESPALDO_A_PROPOSITO).filter(
      (m) => !delEsquema.has(m),
    );
    expect(sobrantesEnExcluidos).toEqual([]);
  });

  it('no repite ningún modelo, ni dentro de la lista ni entre la lista y los excluidos', () => {
    expect(new Set(MODELOS_DEL_RESPALDO).size).toBe(MODELOS_DEL_RESPALDO.length);

    const repetidos = MODELOS_DEL_RESPALDO.filter((m) => m in EXCLUIDOS_DEL_RESPALDO_A_PROPOSITO);
    expect(repetidos).toEqual([]);
  });

  it('cada modelo excluido tiene un motivo escrito, no vacío', () => {
    for (const motivo of Object.values(EXCLUIDOS_DEL_RESPALDO_A_PROPOSITO)) {
      expect(motivo.trim().length).toBeGreaterThan(20);
    }
  });
});
