/**
 * Reglas impositivas.
 *
 * Solo dirección las edita — la matriz de RBAC ya lo impone (`regla_impositiva`
 * con `crear`/`editar` solo en `direccion`). Una tasa no se sobrescribe: se
 * cierra la vigente y se abre una nueva, para que quede registrado qué tasa
 * regía en cada período. Ver ADR y `docs/DISCREPANCIAS.md`, puntos 1 y 9.
 *
 * Importante: esta tabla todavía **no está conectada** a ningún cálculo de
 * IVA real — `@effort/core/iva.ts` usa un divisor hardcodeado. Editar una
 * regla acá no cambia ningún número del sistema hoy. Ver DISCREPANCIAS.md
 * punto 9 antes de asumir lo contrario.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { fechaIsoSchema, tasaIvaSchema, textoCorto, textoLargo } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import type { ReglaImpositivaAlmacenada } from '../puertos-dominio.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { autorizar, paramsId } from './comun.js';

/** Las fechas de vigencia viajan como `AAAA-MM-DD`, sin hora: son fechas civiles. */
function aSalida(regla: ReglaImpositivaAlmacenada) {
  return {
    ...regla,
    vigenteDesde: regla.vigenteDesde.toISOString().slice(0, 10),
    vigenteHasta: regla.vigenteHasta?.toISOString().slice(0, 10) ?? null,
  };
}

const altaSchema = z
  .object({
    nombre: textoCorto,
    tasa: tasaIvaSchema,
    divisorIvaIncluido: z.number().int().positive().nullable(),
    vigenteDesde: fechaIsoSchema,
    fuente: textoLargo.min(1, 'Citá de dónde sale esta regla.'),
  })
  .strict()
  .refine(
    (datos) => (datos.tasa === 'EXENTA') === (datos.divisorIvaIncluido === null),
    {
      message: 'Una tasa exenta no lleva divisor; una tasa gravada sí.',
      path: ['divisorIvaIncluido'],
    },
  );

const edicionSchema = z
  .object({
    nombre: textoCorto.optional(),
    vigenteHasta: fechaIsoSchema.nullable().optional(),
    requiereConfirmacionCliente: z.boolean().optional(),
    fuente: textoLargo.min(1).optional(),
  })
  .strict();

export async function registrarRutasDeReglasImpositivas(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/reglas-impositivas', async (peticion) => {
    autorizar(peticion, 'regla_impositiva', 'ver');

    const reglas = await deps.reglasImpositivas.listar();
    return { reglas: reglas.map(aSalida) };
  });

  /**
   * Da de alta una tasa nueva. Si había una vigente para la misma tasa, el
   * repositorio la cierra un día antes de que empiece esta — nunca quedan
   * dos reglas vigentes para la misma tasa al mismo tiempo.
   */
  app.post('/api/v1/reglas-impositivas', async (peticion, respuesta) => {
    const sujeto = autorizar(peticion, 'regla_impositiva', 'crear');
    const cuerpo = altaSchema.parse(peticion.body);

    const regla = await deps.reglasImpositivas.crear({
      nombre: cuerpo.nombre,
      tasa: cuerpo.tasa,
      divisorIvaIncluido: cuerpo.divisorIvaIncluido,
      vigenteDesde: new Date(cuerpo.vigenteDesde),
      fuente: cuerpo.fuente,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.REGLA_IMPOSITIVA_CREADA,
      entidad: 'regla_impositiva',
      entidadId: regla.id,
      clienteId: null,
      datosDespues: {
        nombre: regla.nombre,
        tasa: regla.tasa,
        divisorIvaIncluido: regla.divisorIvaIncluido,
        vigenteDesde: cuerpo.vigenteDesde,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ regla: aSalida(regla) });
  });

  /**
   * Edición en el lugar. No toca `tasa`, `divisorIvaIncluido` ni
   * `vigenteDesde` — eso es "qué se aplica y desde cuándo", y cambiarlo acá
   * reescribiría una fila que ya pudo haberse usado para calcular algo. Para
   * cambiar la tasa se da de alta una regla nueva.
   */
  app.patch('/api/v1/reglas-impositivas/:id', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'regla_impositiva', 'editar');
    const cuerpo = edicionSchema.parse(peticion.body);

    const previa = await deps.reglasImpositivas.buscarPorId(id);
    if (!previa) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (
      cuerpo.vigenteHasta !== undefined &&
      cuerpo.vigenteHasta !== null &&
      new Date(cuerpo.vigenteHasta) < previa.vigenteDesde
    ) {
      throw new ErrorDeAplicacion(
        400,
        'La vigencia no puede cerrar antes de haber empezado.',
        'vigencia_invalida',
      );
    }

    const regla = await deps.reglasImpositivas.actualizar(
      id,
      {
        nombre: cuerpo.nombre,
        vigenteHasta: cuerpo.vigenteHasta === undefined ? undefined : (
          cuerpo.vigenteHasta === null ? null : new Date(cuerpo.vigenteHasta)
        ),
        requiereConfirmacionCliente: cuerpo.requiereConfirmacionCliente,
        fuente: cuerpo.fuente,
      },
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.REGLA_IMPOSITIVA_MODIFICADA,
      entidad: 'regla_impositiva',
      entidadId: id,
      clienteId: null,
      datosAntes: {
        requiereConfirmacionCliente: previa.requiereConfirmacionCliente,
        vigenteHasta: previa.vigenteHasta?.toISOString().slice(0, 10) ?? null,
      },
      datosDespues: {
        requiereConfirmacionCliente: regla.requiereConfirmacionCliente,
        vigenteHasta: regla.vigenteHasta?.toISOString().slice(0, 10) ?? null,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { regla: aSalida(regla) };
  });
}
