/**
 * Radar de vencimientos societarios, legales y tributarios.
 *
 * Este módulo existe por un hecho concreto: EFFORT pagó una multa de
 * Gs. 6.000.000 por no presentar a tiempo ante Abogacía. La vista principal
 * responde "qué vence, en cuántos días y quién lo tiene", ordenado por urgencia.
 *
 * Los días restantes y el nivel de alerta los calcula `@effort/core` en zona
 * `America/Asuncion`, no la base ni el navegador: un vencimiento que cae
 * "mañana" para un servidor en otro huso puede ser "hoy" en Asunción, y con
 * multas de por medio ese día de diferencia es justamente el problema.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  diasRestantes,
  fechaCivilDesdeIso,
  hoyEnParaguay,
  nivelAlertaPorDias,
  type NivelAlerta,
} from '@effort/core';
import { fechaIsoSchema, idSchema, nivelRiesgoSchema, periodoSchema, textoCorto, textoLargo, tipoDocumentoSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import type { VencimientoAlmacenado } from '../puertos-dominio.js';
import { generarVencimientosDelPeriodo } from '../servicios/generadorDeVencimientos.js';
import { autorizar, paramsCliente, paramsId } from './comun.js';

const crearVencimientoSchema = z
  .object({
    tipoDocumento: tipoDocumentoSchema,
    descripcion: textoCorto,
    entidad: textoCorto,
    fechaEmision: fechaIsoSchema.nullable().default(null),
    fechaVencimiento: fechaIsoSchema,
    responsableId: idSchema.nullable().default(null),
    riesgo: nivelRiesgoSchema.default('MEDIO'),
    evidenciaId: idSchema.nullable().default(null),
    proximaAccion: textoLargo.nullable().default(null),
  })
  .strict()
  .refine(
    (venc) =>
      venc.fechaEmision === null || venc.fechaEmision <= venc.fechaVencimiento,
    { message: 'La emisión no puede ser posterior al vencimiento.', path: ['fechaEmision'] },
  );

const presentarSchema = z
  .object({
    fechaPresentacion: fechaIsoSchema,
    evidenciaId: idSchema.nullable().default(null),
  })
  .strict();

/** Vencimiento con los días restantes y el nivel de alerta ya calculados. */
interface VencimientoConAlerta {
  readonly vencimiento: VencimientoAlmacenado;
  readonly diasRestantes: number;
  readonly nivelAlerta: NivelAlerta;
}

/**
 * Agrega días restantes y nivel de alerta.
 *
 * Se calcula acá y no en la interfaz para que el navegador del usuario, que
 * puede estar en cualquier huso, no cambie el resultado. La API es la única
 * que decide cuántos días faltan.
 */
function conAlerta(
  vencimiento: VencimientoAlmacenado,
  ahora: Date,
): VencimientoConAlerta {
  const fecha = fechaCivilDesdeIso(vencimiento.fechaVencimiento.toISOString().slice(0, 10));
  const dias = diasRestantes(fecha, ahora);

  return { vencimiento, diasRestantes: dias, nivelAlerta: nivelAlertaPorDias(dias) };
}

function aSalida(item: VencimientoConAlerta) {
  return {
    ...item.vencimiento,
    fechaEmision: item.vencimiento.fechaEmision?.toISOString().slice(0, 10) ?? null,
    fechaVencimiento: item.vencimiento.fechaVencimiento.toISOString().slice(0, 10),
    fechaPresentacion: item.vencimiento.fechaPresentacion?.toISOString().slice(0, 10) ?? null,
    diasRestantes: item.diasRestantes,
    nivelAlerta: item.nivelAlerta,
  };
}

export async function registrarRutasDeVencimientos(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /**
   * El radar completo de la cartera.
   *
   * Devuelve además un resumen por nivel, que es lo que alimenta los
   * indicadores de la pantalla: cuántos vencidos, cuántos críticos, cuántos
   * altos. Se calcula acá para que la interfaz no tenga que contar nada.
   */
  app.get('/api/v1/vencimientos', async (peticion) => {
    const sujeto = autorizar(peticion, 'vencimiento', 'ver');
    const ahora = deps.ahora();

    const filas = await deps.vencimientos.listar(filtroDeClientes(sujeto));
    const conAlertas = filas.map((fila) => conAlerta(fila, ahora));

    const resumen: Record<NivelAlerta, number> = {
      VENCIDO: 0, CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0, SIN_ALERTA: 0,
    };
    for (const item of conAlertas) {
      resumen[item.nivelAlerta] += 1;
    }

    return {
      hoy: hoyEnParaguay(ahora),
      resumen,
      vencimientos: conAlertas.map(aSalida),
    };
  });

  /**
   * Genera los vencimientos del período a partir del calendario tributario.
   *
   * Se puede repetir sin miedo: lo que ya existe no se duplica ni se pisa (ver
   * `registrarGenerados`). Devuelve además qué NO se generó y por qué — una
   * generación que "salió bien" pero dejó un cliente afuera en silencio es
   * exactamente el tipo de falla que este sistema existe para evitar.
   */
  app.post('/api/v1/vencimientos/generar', async (peticion) => {
    const sujeto = autorizar(peticion, 'vencimiento', 'crear');
    const { periodo } = z
      .object({ periodo: periodoSchema })
      .strict()
      .parse(peticion.body);

    const resumen = await generarVencimientosDelPeriodo(
      { clientes: deps.clientes, obligaciones: deps.obligaciones, vencimientos: deps.vencimientos },
      periodo,
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.VENCIMIENTOS_GENERADOS,
      entidad: 'vencimiento',
      entidadId: null,
      clienteId: null,
      datosDespues: {
        periodo,
        creados: resumen.creados,
        yaExistian: resumen.yaExistian,
        omitidos: resumen.omitidos.length,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return resumen;
  });

  app.get('/api/v1/clientes/:clienteId/vencimientos', async (peticion) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'vencimiento', 'ver', clienteId);
    const ahora = deps.ahora();

    const filas = await deps.vencimientos.listarPorCliente(clienteId, filtroDeClientes(sujeto));

    return { vencimientos: filas.map((fila) => aSalida(conAlerta(fila, ahora))) };
  });

  app.post('/api/v1/clientes/:clienteId/vencimientos', async (peticion, respuesta) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'vencimiento', 'crear', clienteId);
    const cuerpo = crearVencimientoSchema.parse(peticion.body);

    const vencimiento = await deps.vencimientos.registrar({
      clienteId,
      tipoDocumento: cuerpo.tipoDocumento,
      descripcion: cuerpo.descripcion,
      entidad: cuerpo.entidad,
      fechaEmision: cuerpo.fechaEmision === null ? null : new Date(cuerpo.fechaEmision),
      fechaVencimiento: new Date(cuerpo.fechaVencimiento),
      responsableId: cuerpo.responsableId,
      riesgo: cuerpo.riesgo,
      evidenciaId: cuerpo.evidenciaId,
      proximaAccion: cuerpo.proximaAccion,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.VENCIMIENTO_REGISTRADO,
      entidad: 'vencimiento',
      entidadId: vencimiento.id,
      clienteId,
      datosDespues: {
        descripcion: vencimiento.descripcion,
        entidad: vencimiento.entidad,
        fechaVencimiento: cuerpo.fechaVencimiento,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ vencimiento: aSalida(conAlerta(vencimiento, deps.ahora())) });
  });

  /**
   * Marca una obligación como presentada.
   *
   * Es la acción que cierra el ciclo del radar. Queda en la bitácora con quién
   * la presentó y cuándo: si alguna vez hay una discusión sobre si una
   * presentación se hizo o no, esa entrada es la respuesta.
   */
  app.post('/api/v1/vencimientos/:id/presentar', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'vencimiento', 'editar');
    const cuerpo = presentarSchema.parse(peticion.body);

    const previo = await deps.vencimientos.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previo) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (previo.estado === 'PRESENTADO') {
      throw new ErrorDeAplicacion(
        409,
        'Esta obligación ya figura como presentada.',
        'ya_presentado',
      );
    }

    const vencimiento = await deps.vencimientos.marcarPresentado(
      id,
      new Date(cuerpo.fechaPresentacion),
      cuerpo.evidenciaId,
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.VENCIMIENTO_PRESENTADO,
      entidad: 'vencimiento',
      entidadId: id,
      clienteId: previo.clienteId,
      datosAntes: { estado: previo.estado },
      datosDespues: {
        estado: 'PRESENTADO',
        fechaPresentacion: cuerpo.fechaPresentacion,
        evidenciaId: cuerpo.evidenciaId,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { vencimiento: aSalida(conAlerta(vencimiento, deps.ahora())) };
  });
}
