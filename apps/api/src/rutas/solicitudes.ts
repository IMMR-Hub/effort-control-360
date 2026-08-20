/**
 * Solicitudes de documentación: el seguimiento de "quién no entregó todavía".
 *
 * El motor que decide cuándo insistir y cuándo escalar ya existe en
 * `@effort/core/seguimiento.ts` desde la Parte 1.3 (`planificarProximoRecordatorio`).
 * Esta ruta solo abre y cierra el seguimiento de un período; el job que manda
 * los recordatorios de verdad y que incrementa `recordatoriosEnviados` es la
 * Parte 6 (despachador de notificaciones), todavía no construida — hasta
 * entonces esos avisos se registran a mano como contactos (`rutas/contactos.ts`).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { fechaIsoSchema, idSchema, periodoSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import type { SolicitudAlmacenada } from '../puertos-dominio.js';
import { autorizar, paramsCliente, paramsId } from './comun.js';

const consultaPeriodo = z.object({ periodo: periodoSchema }).strict();

const abrirSchema = z
  .object({
    periodo: periodoSchema,
    /** Fecha desde la que corre el plazo en días hábiles. */
    cuentaDesde: fechaIsoSchema,
    reglaId: idSchema.nullable().default(null),
  })
  .strict();

const cerrarSchema = z
  .object({
    estado: z.enum(['ENTREGADA', 'CERRADA_MANUALMENTE']),
  })
  .strict();

const ESTADOS_TERMINALES = new Set(['ENTREGADA', 'CERRADA_MANUALMENTE']);

function aSalida(solicitud: SolicitudAlmacenada) {
  return {
    ...solicitud,
    cuentaDesde: solicitud.cuentaDesde.toISOString().slice(0, 10),
    ultimoRecordatorioEn: solicitud.ultimoRecordatorioEn?.toISOString().slice(0, 10) ?? null,
  };
}

export async function registrarRutasDeSolicitudes(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /** Vista de toda la cartera para un período: es la tabla de la pantalla de seguimiento. */
  app.get('/api/v1/solicitudes-documentacion', async (peticion) => {
    const sujeto = autorizar(peticion, 'solicitud', 'ver');
    const { periodo } = consultaPeriodo.parse(peticion.query ?? {});

    const solicitudes = await deps.solicitudes.listarPorPeriodo(periodo, filtroDeClientes(sujeto));
    return { solicitudes: solicitudes.map(aSalida) };
  });

  app.get('/api/v1/clientes/:clienteId/solicitudes-documentacion', async (peticion) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'solicitud', 'ver', clienteId);

    const solicitudes = await deps.solicitudes.listarPorCliente(
      clienteId,
      filtroDeClientes(sujeto),
    );
    return { solicitudes: solicitudes.map(aSalida) };
  });

  /**
   * Abre el seguimiento de un cliente para un período.
   *
   * Idempotente: pedirlo de nuevo para el mismo (cliente, período) no crea una
   * fila nueva ni pisa el progreso ya hecho — el repositorio lo resuelve con
   * `upsert`, no esta ruta.
   */
  app.post('/api/v1/clientes/:clienteId/solicitudes-documentacion', async (peticion, respuesta) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'solicitud', 'crear', clienteId);
    const cuerpo = abrirSchema.parse(peticion.body);

    const solicitud = await deps.solicitudes.registrar({
      clienteId,
      periodo: cuerpo.periodo,
      cuentaDesde: new Date(cuerpo.cuentaDesde),
      reglaId: cuerpo.reglaId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.SOLICITUD_REGISTRADA,
      entidad: 'solicitud_documentacion',
      entidadId: solicitud.id,
      clienteId,
      datosDespues: { periodo: solicitud.periodo, cuentaDesde: cuerpo.cuentaDesde },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ solicitud: aSalida(solicitud) });
  });

  /**
   * Cierra manualmente: el cliente entregó, o EFFORT decidió no seguir
   * insistiendo. No es la única forma en que una solicitud llega a un estado
   * terminal (el motor de seguimiento también puede marcarla `AGOTADA`), pero
   * es la única acción manual que expone esta ruta.
   */
  app.post('/api/v1/solicitudes-documentacion/:id/cerrar', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'solicitud', 'cerrar');
    const cuerpo = cerrarSchema.parse(peticion.body);

    const previa = await deps.solicitudes.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previa) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (ESTADOS_TERMINALES.has(previa.estado)) {
      throw new ErrorDeAplicacion(409, 'Esta solicitud ya está cerrada.', 'ya_cerrada');
    }

    const solicitud = await deps.solicitudes.cerrar(id, cuerpo.estado, sujeto.usuarioId);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.SOLICITUD_CERRADA,
      entidad: 'solicitud_documentacion',
      entidadId: id,
      clienteId: previa.clienteId,
      datosAntes: { estado: previa.estado },
      datosDespues: { estado: solicitud.estado },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { solicitud: aSalida(solicitud) };
  });
}
