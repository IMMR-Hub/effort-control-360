/**
 * Alertas operativas.
 *
 * La tabla la alimenta el sistema, no las personas: sigue sin haber alta
 * manual, y `crear` en la matriz de permisos significa "puede pedirle al
 * sistema que evalúe", no "puede inventar una alerta".
 *
 * Ese "la alimenta el sistema" era, hasta el 2026-09-10, una intención
 * escrita en este comentario y en ningún lado más: no existía el motor que la
 * alimentara ni forma de insertar una fila. Ver `servicios/motorDeAlertas.ts`.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { periodoSchema, textoLargo } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar, paramsId } from './comun.js';
import { evaluarAlertas } from '../servicios/motorDeAlertas.js';

const cerrarSchema = z
  .object({
    motivoCierre: textoLargo.min(1, 'Explicá por qué se cierra la alerta.'),
  })
  .strict();

/** Mismo orden que el enum `Criticidad` en `schema.prisma`, para el resumen. */
type Criticidad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFORMATIVA';

export async function registrarRutasDeAlertas(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /**
   * Vuelve a evaluar el estado real y levanta las alertas que correspondan.
   *
   * Se puede repetir sin ensuciar nada: no vuelve a abrir una alerta que ya
   * está abierta para la misma entidad (lo garantiza un índice de la base, no
   * este código). Una alerta cerrada sí puede volver a levantarse — si el
   * problema reaparece, corresponde avisar de nuevo.
   */
  app.post('/api/v1/alertas/evaluar', async (peticion) => {
    const sujeto = autorizar(peticion, 'alerta', 'crear');
    const { periodo } = z.object({ periodo: periodoSchema }).strict().parse(peticion.body);

    const resumen = await evaluarAlertas(
      {
        alertas: deps.alertas,
        vencimientos: deps.vencimientos,
        procesoMensual: deps.procesoMensual,
      },
      deps.ahora(),
      periodo,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.ALERTAS_EVALUADAS,
      entidad: 'alerta',
      entidadId: null,
      clienteId: null,
      datosDespues: { periodo, creadas: resumen.creadas, evaluadas: resumen.evaluadas },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return resumen;
  });

  /**
   * El radar consolidado de la cartera, ordenado por criticidad.
   *
   * El resumen por nivel alimenta los indicadores de la pantalla, igual que en
   * vencimientos: se cuenta acá para que la interfaz no tenga que hacerlo.
   */
  app.get('/api/v1/alertas', async (peticion) => {
    const sujeto = autorizar(peticion, 'alerta', 'ver');

    const alertas = await deps.alertas.listar(filtroDeClientes(sujeto));

    const resumen: Record<Criticidad, number> = {
      CRITICA: 0,
      ALTA: 0,
      MEDIA: 0,
      INFORMATIVA: 0,
    };
    for (const alerta of alertas) {
      resumen[alerta.criticidad as Criticidad] += 1;
    }

    return { resumen, alertas };
  });

  /**
   * Cierra una alerta con motivo.
   *
   * Exige explicación porque una alerta cerrada sin decir por qué no se
   * distingue de una que se ignoró, y esa diferencia importa cuando después
   * hay que rendir cuentas de qué se hizo con cada aviso.
   */
  app.post('/api/v1/alertas/:id/cerrar', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'alerta', 'cerrar');
    const cuerpo = cerrarSchema.parse(peticion.body);

    const previa = await deps.alertas.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previa) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (previa.estado === 'CERRADA' || previa.estado === 'DESCARTADA') {
      throw new ErrorDeAplicacion(409, 'Esta alerta ya está cerrada.', 'ya_cerrada');
    }

    const alerta = await deps.alertas.cerrar(
      id,
      cuerpo.motivoCierre,
      sujeto.usuarioId,
      deps.ahora(),
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.ALERTA_CERRADA,
      entidad: 'alerta',
      entidadId: id,
      clienteId: previa.clienteId,
      datosAntes: { estado: previa.estado },
      datosDespues: { estado: 'CERRADA', motivoCierre: cuerpo.motivoCierre },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { alerta };
  });
}
