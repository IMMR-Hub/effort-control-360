/**
 * Clientes.
 *
 * Alta y edición, además de la lectura que ya existía desde la Parte 1.6.
 * RBAC ya distinguía esto: `direccion` y `responsable` crean y editan,
 * el resto de los roles solo ve la cartera que le corresponde.
 *
 * Desde el 2026-11-01 todo cliente nuevo lleva su código de EFFORT (el número
 * de su carpeta) y puede darse de alta con el RUC pendiente: Daniel ordenó dar
 * de alta a todos los clientes que tienen carpeta, y 41 no tienen RUC todavía.
 * Un RUC que llega se valida igual que siempre (formato y dígito verificador);
 * lo que no se hace nunca es inventar uno.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  canalRecepcionSchema,
  codigoClienteSchema,
  emailSchema,
  rucSchema,
  telefonoSchema,
  textoCorto,
  textoOpcional,
} from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar, paramsId } from './comun.js';

const tipoPersonaSchema = z.enum(['FISICA', 'JURIDICA']);

const altaSchema = z
  .object({
    codigo: codigoClienteSchema,
    nombre: textoCorto,
    // Sin RUC (o null) el cliente queda «RUC pendiente».
    ruc: rucSchema.nullable().default(null),
    tipoPersona: tipoPersonaSchema,
    regimenTributario: textoCorto.nullable().default(null),
    email: emailSchema.nullable().default(null),
    telefono: telefonoSchema.nullable().default(null),
    canalPreferido: canalRecepcionSchema.nullable().default(null),
    observaciones: textoOpcional.default(null),
  })
  .strict();

const edicionSchema = z
  .object({
    codigo: codigoClienteSchema.optional(),
    nombre: textoCorto.optional(),
    // Se puede cargar o corregir el RUC, no borrarlo: un RUC ya cargado no
    // vuelve a «pendiente» por una edición.
    ruc: rucSchema.optional(),
    tipoPersona: tipoPersonaSchema.optional(),
    regimenTributario: textoCorto.nullable().optional(),
    email: emailSchema.nullable().optional(),
    telefono: telefonoSchema.nullable().optional(),
    canalPreferido: canalRecepcionSchema.nullable().optional(),
    carpetaOneDriveId: z.string().max(200).nullable().optional(),
    activo: z.boolean().optional(),
    observaciones: textoOpcional.optional(),
  })
  .strict();

export async function registrarRutasDeClientes(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/clientes', async (peticion) => {
    const sujeto = autorizar(peticion, 'cliente', 'ver');
    const clientes = await deps.clientes.listar(filtroDeClientes(sujeto));
    return { clientes };
  });

  app.get('/api/v1/clientes/:id', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'cliente', 'ver');

    const cliente = await deps.clientes.buscarPorId(id, filtroDeClientes(sujeto));
    if (!cliente) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }
    return { cliente };
  });

  app.post('/api/v1/clientes', async (peticion, respuesta) => {
    const sujeto = autorizar(peticion, 'cliente', 'crear');
    const cuerpo = altaSchema.parse(peticion.body);

    const conEseCodigo = await deps.clientes.buscarPorCodigo(cuerpo.codigo);
    if (conEseCodigo) {
      throw new ErrorDeAplicacion(409, 'Ya existe un cliente con ese código.', 'codigo_en_uso');
    }
    if (cuerpo.ruc !== null) {
      const existente = await deps.clientes.buscarPorRuc(cuerpo.ruc);
      if (existente) {
        throw new ErrorDeAplicacion(409, 'Ya existe un cliente con ese RUC.', 'ruc_en_uso');
      }
    }

    const cliente = await deps.clientes.crear({
      codigo: cuerpo.codigo,
      nombre: cuerpo.nombre,
      ruc: cuerpo.ruc,
      tipoPersona: cuerpo.tipoPersona,
      regimenTributario: cuerpo.regimenTributario,
      email: cuerpo.email,
      telefono: cuerpo.telefono,
      canalPreferido: cuerpo.canalPreferido,
      observaciones: cuerpo.observaciones,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.CLIENTE_CREADO,
      entidad: 'cliente',
      entidadId: cliente.id,
      clienteId: cliente.id,
      datosDespues: {
        codigo: cliente.codigo,
        nombre: cliente.nombre,
        ruc: cliente.ruc,
        tipoPersona: cliente.tipoPersona,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ cliente });
  });

  app.patch('/api/v1/clientes/:id', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'cliente', 'editar', id);
    const cuerpo = edicionSchema.parse(peticion.body);

    const previo = await deps.clientes.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previo) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (cuerpo.codigo && cuerpo.codigo !== previo.codigo) {
      const conEseCodigo = await deps.clientes.buscarPorCodigo(cuerpo.codigo);
      if (conEseCodigo && conEseCodigo.id !== id) {
        throw new ErrorDeAplicacion(409, 'Ya existe un cliente con ese código.', 'codigo_en_uso');
      }
    }

    if (cuerpo.ruc && cuerpo.ruc !== previo.ruc) {
      const conEseRuc = await deps.clientes.buscarPorRuc(cuerpo.ruc);
      if (conEseRuc && conEseRuc.id !== id) {
        throw new ErrorDeAplicacion(409, 'Ya existe un cliente con ese RUC.', 'ruc_en_uso');
      }
    }

    const cliente = await deps.clientes.actualizar(id, cuerpo, sujeto.usuarioId);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.CLIENTE_ACTUALIZADO,
      entidad: 'cliente',
      entidadId: id,
      clienteId: id,
      datosAntes: { codigo: previo.codigo, nombre: previo.nombre, ruc: previo.ruc, activo: previo.activo },
      datosDespues: { codigo: cliente.codigo, nombre: cliente.nombre, ruc: cliente.ruc, activo: cliente.activo },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { cliente };
  });
}
