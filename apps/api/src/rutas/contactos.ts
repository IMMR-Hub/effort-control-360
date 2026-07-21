/**
 * Clientes y bitácora de contactos.
 *
 * Cada ruta hace lo mismo, en el mismo orden, sin excepción:
 *   1. exige sesión;
 *   2. exige permiso de rol y de cartera;
 *   3. valida el cuerpo con Zod estricto;
 *   4. opera;
 *   5. registra el evento.
 *
 * Que sea repetitivo es la idea. Una ruta que se saltea el paso 2 no se nota
 * leyendo el código si cada ruta tiene su propia forma.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { armarConstanciaDeGestion, periodoDesdeTexto } from '@effort/core';
import { crearRegistroContactoSchema, idSchema, periodoSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, exigirSesion, type Dependencias } from '../servidor.js';
import { exigirPermiso, filtroDeClientes } from '../seguridad/rbac.js';

const parametrosDeCliente = z.object({ clienteId: idSchema }).strict();
const consultaDePeriodo = z.object({ periodo: periodoSchema.optional() }).strict();

export async function registrarRutasDeContactos(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /* --- Clientes ----------------------------------------------------------- */

  app.get('/api/v1/clientes', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    exigirPermiso(sujeto, 'cliente', 'ver');

    // El filtro no es opcional: viaja hasta la consulta. Un usuario sin
    // clientes asignados recibe una lista vacía, no la cartera completa.
    const clientes = await deps.clientes.listar(filtroDeClientes(sujeto));
    return { clientes };
  });

  app.get('/api/v1/clientes/:clienteId', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    const { clienteId } = parametrosDeCliente.parse(peticion.params);

    // Se comprueba el permiso de rol, pero deliberadamente NO se pasa el
    // clienteId: eso daría 403 y confirmaría que el identificador corresponde
    // a algo. El alcance de cartera se aplica en la consulta, y un cliente
    // fuera de la cartera vuelve como `null`, igual que uno inexistente.
    exigirPermiso(sujeto, 'cliente', 'ver');

    const cliente = await deps.clientes.buscarPorId(clienteId, filtroDeClientes(sujeto));

    // Mismo 404 para "no existe" y para "no tenés acceso": sin esa distinción
    // no hay forma de sondear qué clientes tiene EFFORT en cartera.
    if (!cliente) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    return { cliente };
  });

  /* --- Bitácora de contactos ---------------------------------------------- */

  app.get('/api/v1/clientes/:clienteId/contactos', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    const { clienteId } = parametrosDeCliente.parse(peticion.params);
    const { periodo } = consultaDePeriodo.parse(peticion.query ?? {});

    exigirPermiso(sujeto, 'contacto', 'ver', clienteId);

    const contactos = await deps.contactos.listarPorCliente(clienteId, periodo ?? null);
    return { contactos };
  });

  app.post('/api/v1/clientes/:clienteId/contactos', async (peticion, respuesta) => {
    const sujeto = exigirSesion(peticion);
    const { clienteId } = parametrosDeCliente.parse(peticion.params);

    exigirPermiso(sujeto, 'contacto', 'crear', clienteId);

    const cuerpo = crearRegistroContactoSchema.parse(peticion.body);

    // El cliente de la ruta manda sobre el del cuerpo: si no coincidieran, se
    // podría registrar un contacto en la ficha de un cliente al que sí se tiene
    // acceso, pero apuntando a otro.
    if (cuerpo.clienteId !== clienteId) {
      throw new ErrorDeAplicacion(
        400,
        'El cliente del cuerpo no coincide con el de la ruta.',
        'cliente_inconsistente',
      );
    }

    const contacto = await deps.contactos.registrar({
      clienteId,
      periodo: cuerpo.periodo,
      canal: cuerpo.canal,
      direccion: cuerpo.direccion,
      // Lo carga una persona a través de la API: por definición es manual.
      // El sistema marca AUTOMATICO solo desde el despachador de correos.
      origenContacto: 'MANUAL',
      ocurridoEn: cuerpo.ocurridoEn,
      registradoPorUsuarioId: sujeto.usuarioId,
      huboRespuesta: cuerpo.huboRespuesta,
      quienAtendio: cuerpo.quienAtendio,
      resumen: cuerpo.resumen,
      evidenciaId: cuerpo.evidenciaId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.CONTACTO_REGISTRADO,
      entidad: 'registro_contacto',
      entidadId: contacto.id,
      clienteId,
      datosDespues: {
        canal: contacto.canal,
        huboRespuesta: contacto.huboRespuesta,
        periodo: contacto.periodo,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ contacto });
  });

  /* --- Constancia de gestión ---------------------------------------------- */

  app.get('/api/v1/clientes/:clienteId/constancia', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    const { clienteId } = parametrosDeCliente.parse(peticion.params);
    const consulta = z.object({ periodo: periodoSchema }).strict().parse(peticion.query ?? {});

    exigirPermiso(sujeto, 'constancia', 'ver', clienteId);

    const contactos = await deps.contactos.listarPorCliente(clienteId, consulta.periodo);
    const periodo = periodoDesdeTexto(consulta.periodo);

    // El cálculo lo hace el dominio, no la ruta. La ruta transporta.
    const constancia = armarConstanciaDeGestion(
      clienteId,
      periodo,
      contactos.map((contacto) => ({
        id: contacto.id,
        clienteId: contacto.clienteId,
        periodo,
        solicitudId: null,
        canal: contacto.canal as 'LLAMADA' | 'MENSAJE' | 'WHATSAPP' | 'CORREO' | 'PRESENCIAL',
        direccion: contacto.direccion as 'SALIENTE' | 'ENTRANTE',
        origen: contacto.origenContacto as 'AUTOMATICO' | 'MANUAL',
        ocurridoEn: contacto.ocurridoEn,
        registradoPorUsuarioId: contacto.registradoPorUsuarioId,
        huboRespuesta: contacto.huboRespuesta,
        quienAtendio: contacto.quienAtendio,
        resumen: contacto.resumen,
        evidenciaId: contacto.evidenciaId,
      })),
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.CONSTANCIA_EMITIDA,
      entidad: 'constancia',
      entidadId: null,
      clienteId,
      datosDespues: { periodo: consulta.periodo, intentos: constancia.totalDeContactos },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { constancia };
  });
}
