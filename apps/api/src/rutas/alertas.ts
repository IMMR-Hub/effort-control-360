/**
 * Alertas operativas.
 *
 * La tabla la alimenta el sistema (vencimientos vencidos, conciliaciones con
 * diferencias, balances con inconsistencias); este módulo solo expone la
 * vista consolidada y el cierre. Por eso no hay ruta de alta: crear una
 * alerta a mano no está en la matriz de permisos de ningún rol.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { textoLargo } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar, paramsId } from './comun.js';

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
