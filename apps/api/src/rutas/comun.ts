/**
 * Piezas compartidas por las rutas de dominio.
 *
 * Existen para que el preámbulo de seguridad de cada ruta sea una línea y no
 * cuatro. No esconden nada: `autorizar` hace exactamente lo que dice y falla
 * ruidosamente. La alternativa —copiar el preámbulo en cada ruta— termina en
 * una ruta a la que se le olvidó una comprobación, y eso no se nota leyendo.
 */

import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { gs, type Gs } from '@effort/core';
import { idSchema, periodoSchema } from '@effort/schema';

import { exigirPermiso, type Accion, type Recurso, type SujetoAutenticado } from '../seguridad/rbac.js';
import { exigirSesion } from '../servidor.js';

/**
 * Exige sesión y permiso en un solo paso.
 *
 * Pasar `clienteId` activa la segunda capa del control de acceso (alcance por
 * cartera). Omitirlo es válido solo cuando la operación no es sobre un cliente
 * concreto — por ejemplo, listar la cartera propia.
 */
export function autorizar(
  peticion: FastifyRequest,
  recurso: Recurso,
  accion: Accion,
  clienteId?: string | null,
): SujetoAutenticado {
  const sujeto = exigirSesion(peticion);
  exigirPermiso(sujeto, recurso, accion, clienteId);
  return sujeto;
}

/* --- Parámetros y consultas frecuentes ------------------------------------ */

export const paramsCliente = z.object({ clienteId: idSchema }).strict();

export const paramsClientePeriodo = z
  .object({ clienteId: idSchema, periodo: periodoSchema })
  .strict();

export const paramsId = z.object({ id: idSchema }).strict();

export const consultaPeriodoOpcional = z
  .object({ periodo: periodoSchema.optional() })
  .strict();

/* --- Dinero en el borde de la API ----------------------------------------- */

/**
 * Convierte un importe de la base (`bigint`) al formato de transporte.
 *
 * Siempre `string`, nunca `number`: `JSON.stringify` no sabe serializar
 * `bigint`, y convertirlo a número reintroduciría el problema de precisión que
 * todo el diseño de dinero existe para evitar.
 */
export function importeASalida(valor: bigint | null): string | null {
  return valor === null ? null : valor.toString();
}

/** Convierte un importe recibido por API al tipo del dominio. */
export function importeDeEntrada(valor: string | null | undefined): Gs | null {
  return valor === null || valor === undefined ? null : gs(valor);
}

/**
 * Convierte varios importes de una fila de golpe.
 *
 * Se usa al serializar respuestas: si un campo monetario se olvidara, saldría
 * como `bigint` y `JSON.stringify` lanzaría en tiempo de ejecución. Que falle
 * ruidosamente es preferible a que salga un número con precisión perdida.
 */
export function importesASalida<T extends object>(
  fila: T,
  campos: readonly (keyof T)[],
): Record<string, unknown> {
  const salida: Record<string, unknown> = { ...(fila as Record<string, unknown>) };

  for (const campo of campos) {
    const valor = fila[campo];
    salida[campo as string] = typeof valor === 'bigint' ? valor.toString() : valor;
  }

  return salida;
}
