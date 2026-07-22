/**
 * Liquidaciones.
 *
 * Registra el ciclo completo del entregable mensual: generada, enviada, y si
 * el cliente acusó recibo. Los tres estados son distintos a propósito —
 * "la preparamos", "se la mandamos" y "la recibió" no son lo mismo, y la
 * diferencia importa cuando un cliente reclama que nunca le llegó nada.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { emailSchema, idSchema, periodoSchema, textoCorto, textoLargo } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar, consultaPeriodoOpcional, paramsCliente, paramsId } from './comun.js';

const crearLiquidacionSchema = z
  .object({
    periodo: periodoSchema,
    tipo: textoCorto,
    archivoEvidenciaId: idSchema.nullable().default(null),
    responsableId: idSchema.nullable().default(null),
    observaciones: textoLargo.nullable().default(null),
  })
  .strict();

const enviarSchema = z
  .object({
    canal: z.enum(['EMAIL', 'WHATSAPP', 'ONEDRIVE', 'FISICO_ESCANEADO', 'SISTEMA']),
    destinatario: z.string().trim().min(1).max(254),
    fechaEnvio: z.coerce.date(),
    evidenciaEnvioId: idSchema.nullable().default(null),
  })
  .strict()
  .refine(
    // Si el canal es correo, el destinatario tiene que ser una dirección
    // válida: un envío registrado contra un destinatario mal escrito parece
    // gestión hecha y no lo es.
    (envio) => envio.canal !== 'EMAIL' || emailSchema.safeParse(envio.destinatario).success,
    { message: 'Para envíos por correo el destinatario debe ser una dirección válida.', path: ['destinatario'] },
  )
  .refine((envio) => envio.fechaEnvio.getTime() <= Date.now() + 60_000, {
    message: 'No se puede registrar un envío con fecha futura.',
    path: ['fechaEnvio'],
  });

const respuestaSchema = z
  .object({
    respuesta: textoLargo.min(1, 'Registrá qué respondió el cliente.'),
    respondidaEn: z.coerce.date(),
  })
  .strict();

export async function registrarRutasDeLiquidaciones(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/liquidaciones', async (peticion) => {
    const { periodo } = consultaPeriodoOpcional.parse(peticion.query ?? {});
    const sujeto = autorizar(peticion, 'liquidacion', 'ver');

    const liquidaciones = await deps.liquidaciones.listar(periodo ?? null, filtroDeClientes(sujeto));

    return { liquidaciones };
  });

  app.get('/api/v1/clientes/:clienteId/liquidaciones', async (peticion) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'liquidacion', 'ver', clienteId);

    const liquidaciones = await deps.liquidaciones.listarPorCliente(
      clienteId,
      filtroDeClientes(sujeto),
    );

    return { liquidaciones };
  });

  app.post('/api/v1/clientes/:clienteId/liquidaciones', async (peticion, respuesta) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'liquidacion', 'crear', clienteId);
    const cuerpo = crearLiquidacionSchema.parse(peticion.body);

    const liquidacion = await deps.liquidaciones.registrar({
      clienteId,
      periodo: cuerpo.periodo,
      tipo: cuerpo.tipo,
      archivoEvidenciaId: cuerpo.archivoEvidenciaId,
      responsableId: cuerpo.responsableId,
      observaciones: cuerpo.observaciones,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.LIQUIDACION_GENERADA,
      entidad: 'liquidacion',
      entidadId: liquidacion.id,
      clienteId,
      datosDespues: { periodo: cuerpo.periodo, tipo: cuerpo.tipo, estado: liquidacion.estado },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ liquidacion });
  });

  /**
   * Registra el envío al cliente.
   *
   * Guarda destinatario, canal, fecha y evidencia. Es la entrada que sostiene
   * la respuesta ante "a mí nunca me mandaron la liquidación".
   */
  app.post('/api/v1/liquidaciones/:id/enviar', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'liquidacion', 'editar');
    const cuerpo = enviarSchema.parse(peticion.body);

    const previa = await deps.liquidaciones.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previa) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (previa.estado === 'ENVIADA' || previa.estado === 'RESPONDIDA') {
      throw new ErrorDeAplicacion(
        409,
        'Esta liquidación ya figura como enviada.',
        'ya_enviada',
      );
    }

    const liquidacion = await deps.liquidaciones.marcarEnviada(
      id,
      {
        destinatario: cuerpo.destinatario,
        canal: cuerpo.canal,
        fechaEnvio: cuerpo.fechaEnvio,
        evidenciaEnvioId: cuerpo.evidenciaEnvioId,
      },
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.LIQUIDACION_ENVIADA,
      entidad: 'liquidacion',
      entidadId: id,
      clienteId: previa.clienteId,
      datosAntes: { estado: previa.estado },
      datosDespues: {
        estado: 'ENVIADA',
        canal: cuerpo.canal,
        destinatario: cuerpo.destinatario,
        fechaEnvio: cuerpo.fechaEnvio.toISOString(),
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { liquidacion };
  });

  app.post('/api/v1/liquidaciones/:id/respuesta', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'liquidacion', 'editar');
    const cuerpo = respuestaSchema.parse(peticion.body);

    const previa = await deps.liquidaciones.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previa) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    // No se puede registrar la respuesta de algo que nunca se envió: sería
    // una contradicción en el historial del cliente.
    if (previa.estado !== 'ENVIADA' && previa.estado !== 'RECLAMADA') {
      throw new ErrorDeAplicacion(
        409,
        'No se puede registrar una respuesta de una liquidación que todavía no fue enviada.',
        'no_enviada',
      );
    }

    const liquidacion = await deps.liquidaciones.registrarRespuesta(
      id,
      cuerpo.respuesta,
      cuerpo.respondidaEn,
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.LIQUIDACION_RESPONDIDA,
      entidad: 'liquidacion',
      entidadId: id,
      clienteId: previa.clienteId,
      datosAntes: { estado: previa.estado },
      datosDespues: { estado: 'RESPONDIDA', respondidaEn: cuerpo.respondidaEn.toISOString() },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { liquidacion };
  });
}
