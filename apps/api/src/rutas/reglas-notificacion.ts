/**
 * Reglas de notificación.
 *
 * El motor que interpreta estas reglas (plazos, reintentos, escalamiento) ya
 * existe y está probado en `@effort/core/seguimiento.ts` desde la Parte 1.3.
 * Esta ruta solo persiste la configuración; el job que de verdad envía avisos
 * usando `planificarProximoRecordatorio` es la Parte 6 (todavía no construida).
 *
 * RBAC ya distingue tres niveles: `direccion` crea y edita, `responsable`
 * solo edita (no da de alta reglas nuevas), `coordinador` solo mira. Ningún
 * otro rol tiene acceso al recurso.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { destinatarioSchema, horaSchema, idSchema, textoCorto } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { autorizar, paramsId } from './comun.js';

/** Mismos ocho eventos que `EventoDisparador` en `@effort/core/seguimiento.ts`. */
const eventoSchema = z.enum([
  'DOCUMENTACION_NO_ENTREGADA',
  'VENCIMIENTO_PROXIMO',
  'BALANCE_OBSERVADO',
  'BALANCE_LISTO_PARA_REVISION',
  'LIQUIDACION_NO_ENVIADA',
  'LIQUIDACION_SIN_CONFIRMAR',
  'DIFERENCIAS_CON_SIGA',
  'CLIENTE_SIN_RESPUESTA',
]);

/**
 * Los límites numéricos repiten acá lo que `validarReglaNotificacion` exige
 * en `@effort/core`, para que un cuerpo inválido se rechace en el borde de la
 * API con un 400 claro en vez de llegar hasta el dominio.
 */
const altaSchema = z
  .object({
    nombre: textoCorto,
    activa: z.boolean().default(true),
    evento: eventoSchema,
    diasHabilesDePlazo: z.number().int().min(0).max(60),
    horaDeEnvio: horaSchema,
    reintentarCadaDiasHabiles: z.number().int().min(1).max(60),
    maximoRecordatorios: z.number().int().min(1).max(20),
    escalarAPartirDelRecordatorio: z.number().int().min(1).max(20),
    destinatariosIniciales: z
      .array(destinatarioSchema)
      .min(1, 'La regla debe tener al menos un destinatario inicial.'),
    destinatariosDeEscalamiento: z.array(destinatarioSchema).default([]),
    /** Vacío alcanza a toda la cartera; con ids, solo a esos clientes. */
    clientesAlcanzados: z.array(idSchema).default([]),
    /** Todavía no existe la tabla de plantillas: se acepta nula. */
    plantillaId: idSchema.nullable().default(null),
  })
  .strict();

const edicionSchema = z
  .object({
    nombre: textoCorto.optional(),
    activa: z.boolean().optional(),
    evento: eventoSchema.optional(),
    diasHabilesDePlazo: z.number().int().min(0).max(60).optional(),
    horaDeEnvio: horaSchema.optional(),
    reintentarCadaDiasHabiles: z.number().int().min(1).max(60).optional(),
    maximoRecordatorios: z.number().int().min(1).max(20).optional(),
    escalarAPartirDelRecordatorio: z.number().int().min(1).max(20).optional(),
    destinatariosIniciales: z
      .array(destinatarioSchema)
      .min(1, 'La regla debe tener al menos un destinatario inicial.')
      .optional(),
    destinatariosDeEscalamiento: z.array(destinatarioSchema).optional(),
    clientesAlcanzados: z.array(idSchema).optional(),
    plantillaId: idSchema.nullable().optional(),
  })
  .strict();

export async function registrarRutasDeReglasDeNotificacion(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/reglas-notificacion', async (peticion) => {
    autorizar(peticion, 'regla_notificacion', 'ver');

    const reglas = await deps.reglasDeNotificacion.listar();
    return { reglas };
  });

  app.post('/api/v1/reglas-notificacion', async (peticion, respuesta) => {
    const sujeto = autorizar(peticion, 'regla_notificacion', 'crear');
    const cuerpo = altaSchema.parse(peticion.body);

    const regla = await deps.reglasDeNotificacion.crear({
      ...cuerpo,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.REGLA_NOTIFICACION_CREADA,
      entidad: 'regla_notificacion',
      entidadId: regla.id,
      clienteId: null,
      datosDespues: { nombre: regla.nombre, evento: regla.evento, activa: regla.activa },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ regla });
  });

  app.patch('/api/v1/reglas-notificacion/:id', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'regla_notificacion', 'editar');
    const cuerpo = edicionSchema.parse(peticion.body);

    const previa = await deps.reglasDeNotificacion.buscarPorId(id);
    if (!previa) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    const regla = await deps.reglasDeNotificacion.actualizar(id, cuerpo, sujeto.usuarioId);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.REGLA_NOTIFICACION_MODIFICADA,
      entidad: 'regla_notificacion',
      entidadId: id,
      clienteId: null,
      datosAntes: { activa: previa.activa, evento: previa.evento },
      datosDespues: { activa: regla.activa, evento: regla.evento },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { regla };
  });
}
