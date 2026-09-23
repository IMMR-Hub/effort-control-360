/**
 * Planilla de horas (tarea 144).
 *
 * Tres reglas que no se repiten en cada ruta porque viven en una sola: nadie
 * carga ni ve el registro día a día de otra persona (siempre
 * `sujeto.usuarioId`, nunca uno de la petición); el resumen agregado es
 * exclusivo de `direccion`; y el tiempo interno (`clienteId: null`) no pasa
 * por el chequeo de cartera porque no es un cliente.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { costoDeMinutos, gs } from '@effort/core';
import { fechaIsoSchema, registrarHorasSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { exigirSesion, type Dependencias } from '../servidor.js';
import { exigirPermiso, filtroDeClientes } from '../seguridad/rbac.js';
import { importeASalida } from './comun.js';

const consultaDeRango = z
  .object({ desde: fechaIsoSchema, hasta: fechaIsoSchema })
  .strict()
  .refine((rango) => rango.desde <= rango.hasta, {
    message: '"desde" tiene que ser anterior o igual a "hasta".',
    path: ['hasta'],
  });

/** `AAAA-MM-DD` → medianoche UTC, la misma convención que usa la columna `@db.Date`. */
function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function registrarRutasDeHoras(app: FastifyInstance, deps: Dependencias): Promise<void> {
  /**
   * Carga o corrige las horas de un día. Upsert por (usuario, cliente, día):
   * volver a cargar el mismo día y cliente reemplaza el valor, no lo suma.
   */
  app.post('/api/v1/horas', async (peticion, respuesta) => {
    const sujeto = exigirSesion(peticion);
    const cuerpo = registrarHorasSchema.parse(peticion.body);

    // `clienteId` puede ser `null` (tiempo interno): `exigirPermiso` salta el
    // chequeo de cartera en ese caso, que es lo correcto — no hay cartera que
    // comprobar para algo que no es un cliente.
    exigirPermiso(sujeto, 'horas', 'crear', cuerpo.clienteId);

    const registro = await deps.horas.registrar({
      usuarioId: sujeto.usuarioId,
      clienteId: cuerpo.clienteId,
      fecha: aFecha(cuerpo.fecha),
      minutos: cuerpo.minutos,
      tarea: cuerpo.tarea,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.HORAS_REGISTRADAS,
      entidad: 'registro_de_horas',
      entidadId: registro.id,
      clienteId: cuerpo.clienteId,
      datosDespues: { fecha: cuerpo.fecha, minutos: cuerpo.minutos },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ registro });
  });

  /**
   * Los propios registros del período, para que cada persona vea (y corrija)
   * lo que ya cargó. Siempre sobre `sujeto.usuarioId`: no hay forma de pedir
   * los de otra persona por acá, ni pasando su id en la consulta.
   */
  app.get('/api/v1/horas', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    const { desde, hasta } = consultaDeRango.parse(peticion.query ?? {});

    exigirPermiso(sujeto, 'horas', 'ver');

    const registros = await deps.horas.listarPropios(sujeto.usuarioId, aFecha(desde), aFecha(hasta));
    return { registros };
  });

  /**
   * Resumen agregado por colaborador y cliente — exclusivo de `direccion`.
   * Nunca trae una fila individual de otra persona, solo el total del rango.
   *
   * `costoGs` (tarea 156, DISCREPANCIAS 35) se calcula acá, no en la
   * pantalla: multiplicar minutos por un valor por hora es un cálculo de
   * dinero, y todo cálculo de dinero pasa por `@effort/core`
   * (`costoDeMinutos`), nunca a mano en el navegador. Sin `costoPorHora`
   * configurado para alguien (no debería pasar, tiene valor por defecto),
   * la fila no inventa un costo: queda `null`.
   */
  app.get('/api/v1/horas/resumen', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    const { desde, hasta } = consultaDeRango.parse(peticion.query ?? {});

    exigirPermiso(sujeto, 'resumen_horas', 'ver');

    const [totales, usuarios] = await Promise.all([
      deps.horas.resumen(aFecha(desde), aFecha(hasta), filtroDeClientes(sujeto)),
      deps.usuarios.listar(),
    ]);
    const costoPorHoraPorUsuario = new Map(usuarios.map((u) => [u.id, u.costoPorHora]));

    return {
      totales: totales.map((t) => {
        const costoPorHora = costoPorHoraPorUsuario.get(t.usuarioId);
        return {
          ...t,
          costoGs: costoPorHora != null ? importeASalida(costoDeMinutos(t.minutos, gs(costoPorHora))) : null,
        };
      }),
    };
  });
}
