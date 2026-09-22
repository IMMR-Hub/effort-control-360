/**
 * Lee las tablas con SQL crudo, para que el respaldo no dependa del esquema
 * que el código cree que hay.
 *
 * El 2026-09-21, justo antes de aplicar una migración, `respaldar-base.mjs`
 * falló dos veces con `P2021` y `P2022` («la tabla / la columna no existe»):
 * el cliente de Prisma ya conocía lo nuevo porque el código iba adelante del
 * esquema desplegado, y **el respaldo se cae en el único momento en que hace
 * falta**, que es antes de migrar. El respaldo diario tenía la misma
 * fragilidad (`lectorParaRespaldo: prisma` en `index.ts`).
 *
 * `SELECT *` devuelve las columnas que existen de verdad, no las que el
 * cliente generado espera. Con eso, un respaldo tomado con el código adelante
 * del esquema sale igual, con las columnas viejas — que es exactamente lo que
 * se quiere guardar antes de migrar.
 *
 * **Por qué es seguro pese a usar `$queryRawUnsafe`:** el nombre de la tabla
 * no viene de ninguna entrada de usuario. Sale del DMMF del propio cliente de
 * Prisma (el `@@map` de `schema.prisma`), se valida contra un identificador
 * simple y se cita. No hay valores interpolados: la consulta es siempre un
 * `SELECT` sin cláusulas, y este módulo no tiene forma de escribir nada.
 */

import { MODELOS_DEL_RESPALDO } from '@effort/core';

import type { LectorDeTablas } from './respaldoAutomatico.js';

/** Lo poco que se necesita de un cliente de Prisma, para poder doblarlo en pruebas. */
export interface ClienteConSqlCrudo {
  $queryRawUnsafe(consulta: string): Promise<unknown[]>;
}

/** El DMMF que trae el cliente generado: nombre del modelo y su `@@map`. */
interface ModeloDelDmmf {
  readonly name: string;
  readonly dbName?: string | null;
}

/** `HallazgoDeLibroRg90` → `hallazgoDeLibroRg90`, que es como lo lista el respaldo. */
function nombreDePropiedad(nombreDeModelo: string): string {
  return nombreDeModelo.charAt(0).toLowerCase() + nombreDeModelo.slice(1);
}

/**
 * Mapa modelo → tabla real.
 *
 * No se puede deducir por convención: `HallazgoDeLibroRg90` vive en
 * `hallazgo_libro_rg90`, que no es el snake_case del nombre. El `@@map` es el
 * único dato correcto, y el DMMF lo trae.
 */
export function tablasPorModelo(modelos: readonly ModeloDelDmmf[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const modelo of modelos) {
    mapa.set(nombreDePropiedad(modelo.name), modelo.dbName ?? modelo.name);
  }
  return mapa;
}

const IDENTIFICADOR_SIMPLE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Un lector de tablas que lee con `SELECT *`, apto para `generarRespaldo`.
 *
 * Un modelo sin tabla en la base queda fuera del lector, igual que antes
 * quedaba fuera un modelo que el cliente no conocía: `generarRespaldo` lo
 * cuenta como salteado y sigue. Eso es lo que permite respaldar contra una
 * base a la que le falta una migración, en vez de morir en el intento.
 */
export function crearLectorCrudo(
  cliente: ClienteConSqlCrudo,
  modelosDelDmmf: readonly ModeloDelDmmf[],
  modelos: readonly string[] = MODELOS_DEL_RESPALDO,
): LectorDeTablas {
  const tablas = tablasPorModelo(modelosDelDmmf);
  const lector: Record<string, { findMany: () => Promise<unknown[]> }> = {};

  for (const modelo of modelos) {
    const tabla = tablas.get(modelo);
    if (!tabla || !IDENTIFICADOR_SIMPLE.test(tabla)) continue;

    lector[modelo] = {
      findMany: () => cliente.$queryRawUnsafe(`SELECT * FROM "${tabla}"`),
    };
  }

  return lector as LectorDeTablas;
}
