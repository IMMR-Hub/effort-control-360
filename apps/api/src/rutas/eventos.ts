/**
 * Consulta del registro de eventos (event log).
 *
 * Solo lectura: la escritura pasa siempre por `registrarEvento`, nunca por
 * acá. Es la ruta que responde "¿quién aprobó este balance?" o "¿cuándo se
 * le cambió el rol a esta persona?" meses después de que pasó.
 *
 * Acceso acotado a propósito: `direccion`, `responsable` y `revisor_balance`
 * — ver la matriz de RBAC. El resto de los roles no necesita auditar al
 * equipo entero para hacer su trabajo del día a día.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { idSchema } from '@effort/schema';

import type { EventoAlmacenado } from '../bitacora.js';
import type { Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar } from './comun.js';

const consultaSchema = z
  .object({
    usuarioId: idSchema.optional(),
    entidad: z.string().trim().min(1).max(80).optional(),
    entidadId: z.string().trim().min(1).max(80).optional(),
    clienteId: idSchema.optional(),
    desde: z.coerce.date().optional(),
    hasta: z.coerce.date().optional(),
    limite: z.coerce.number().int().min(1).max(200).default(50),
    desplazamiento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

function aSalida(evento: EventoAlmacenado) {
  return { ...evento, ocurridoEn: evento.ocurridoEn.toISOString() };
}

export async function registrarRutasDeEventos(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/eventos', async (peticion) => {
    const sujeto = autorizar(peticion, 'evento', 'ver');
    const filtros = consultaSchema.parse(peticion.query ?? {});

    const eventos = await deps.bitacora.listar(
      {
        usuarioId: filtros.usuarioId,
        entidad: filtros.entidad,
        entidadId: filtros.entidadId,
        clienteId: filtros.clienteId,
        desde: filtros.desde,
        hasta: filtros.hasta,
      },
      filtroDeClientes(sujeto),
      filtros.limite,
      filtros.desplazamiento,
    );

    return { eventos: eventos.map(aSalida) };
  });
}
