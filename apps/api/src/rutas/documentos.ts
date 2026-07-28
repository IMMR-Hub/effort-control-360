/**
 * Documentos y proceso mensual.
 *
 * El proceso mensual es el tablero operativo principal: una fila por cliente y
 * período, con el estado de cada paso del mes. Es la pantalla que responde
 * "¿qué cliente está trabado y por qué?".
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { importarComprobantes } from '@effort/importers';
import type { Comprobante } from '@effort/core';
import {
  canalRecepcionSchema,
  estadoGeneralSchema,
  fechaIsoSchema,
  guaraniesSchema,
  idSchema,
  nivelRiesgoSchema,
  periodoSchema,
  tasaIvaSchema,
  textoLargo,
  tipoDocumentoSchema,
} from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import {
  autorizar,
  consultaPeriodoOpcional,
  importesASalida,
  paramsCliente,
  paramsClientePeriodo,
  paramsId,
} from './comun.js';

/**
 * Traduce el tipo+origen del dominio de comprobantes (`@effort/core`) al
 * `tipoDocumentoSchema` de la API. Solo FACTURA se bifurca por origen — el
 * resto de los tipos de `@effort/core` calzan 1 a 1 con el nombre del enum de
 * documentos.
 */
function tipoDocumentoDesdeComprobante(comprobante: Comprobante): z.infer<typeof tipoDocumentoSchema> {
  if (comprobante.tipo === 'FACTURA') {
    return comprobante.origen === 'VENTA' ? 'FACTURA_VENTA' : 'FACTURA_COMPRA';
  }
  return comprobante.tipo;
}

const MAXIMO_CARACTERES_BASE64 = 10_000_000; // ~7,5 MB decodificados: de sobra para una planilla de comprobantes.

const importarArchivoDeComprobantesSchema = z
  .object({
    periodo: periodoSchema,
    nombreArchivo: z.string().trim().min(1).max(200),
    contenidoBase64: z.string().min(1).max(MAXIMO_CARACTERES_BASE64),
    // Sin default a propósito: la tarea 93 exige que el modo sea explícito en
    // cada llamada, nunca sobreentendido. Omitirlo es un 400, no un dry-run.
    modo: z.enum(['simulacion', 'real']),
  })
  .strict();

const crearDocumentoSchema = z
  .object({
    periodo: periodoSchema,
    tipo: tipoDocumentoSchema,
    canalRecepcion: canalRecepcionSchema,
    recibidoEn: z.coerce.date(),
    rucEmisor: z.string().trim().max(20).nullable().default(null),
    timbrado: z.string().trim().max(20).nullable().default(null),
    numeroComprobante: z.string().trim().max(30).nullable().default(null),
    total: guaraniesSchema.nullable().default(null),
    tasa: tasaIvaSchema.nullable().default(null),
    anulado: z.boolean().default(false),
    evidenciaId: idSchema.nullable().default(null),
    observaciones: textoLargo.nullable().default(null),
  })
  .strict()
  .refine(
    // Un comprobante sin número no se puede conciliar contra SIGA ni detectar
    // como duplicado. Se exige la terna completa o ninguna parte de ella.
    (doc) => {
      const partes = [doc.rucEmisor, doc.timbrado, doc.numeroComprobante];
      const completas = partes.filter((parte) => parte !== null && parte !== '').length;
      return completas === 0 || completas === 3;
    },
    {
      message:
        'Un comprobante necesita RUC del emisor, timbrado y número juntos, o ninguno de los tres.',
      path: ['numeroComprobante'],
    },
  )
  .refine((doc) => doc.total === null || doc.tasa !== null, {
    message: 'Un documento con importe debe indicar su tasa de IVA.',
    path: ['tasa'],
  });

const cambiarEstadoSchema = z
  .object({
    estado: z.enum(['RECIBIDO', 'OBSERVADO', 'RECHAZADO', 'DUPLICADO', 'CARGADO_EN_SIGA']),
    motivoRechazo: textoLargo.nullable().default(null),
  })
  .strict()
  .refine((cambio) => cambio.estado !== 'RECHAZADO' || Boolean(cambio.motivoRechazo?.trim()), {
    message: 'Rechazar un documento exige explicar por qué.',
    path: ['motivoRechazo'],
  });

const IMPORTES_DOCUMENTO = ['total'] as const;
const IMPORTES_PROCESO = ['ivaSaldoAPagar', 'ivaSaldoAFavor'] as const;

export async function registrarRutasDeDocumentos(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /* --- Documentos --------------------------------------------------------- */

  app.get('/api/v1/clientes/:clienteId/documentos', async (peticion) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const { periodo } = consultaPeriodoOpcional.parse(peticion.query ?? {});
    const sujeto = autorizar(peticion, 'documento', 'ver', clienteId);

    const documentos = await deps.documentos.listar(
      clienteId,
      periodo ?? null,
      filtroDeClientes(sujeto),
    );

    return { documentos: documentos.map((doc) => importesASalida(doc, IMPORTES_DOCUMENTO)) };
  });

  app.post('/api/v1/clientes/:clienteId/documentos', async (peticion, respuesta) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'documento', 'crear', clienteId);
    const cuerpo = crearDocumentoSchema.parse(peticion.body);

    const documento = await deps.documentos.registrar({
      clienteId,
      periodo: cuerpo.periodo,
      tipo: cuerpo.tipo,
      canalRecepcion: cuerpo.canalRecepcion,
      recibidoEn: cuerpo.recibidoEn,
      rucEmisor: cuerpo.rucEmisor,
      timbrado: cuerpo.timbrado,
      numeroComprobante: cuerpo.numeroComprobante,
      total: cuerpo.total === null ? null : BigInt(cuerpo.total),
      tasa: cuerpo.tasa,
      anulado: cuerpo.anulado,
      evidenciaId: cuerpo.evidenciaId,
      observaciones: cuerpo.observaciones,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.DOCUMENTO_REGISTRADO,
      entidad: 'documento',
      entidadId: documento.id,
      clienteId,
      datosDespues: { tipo: documento.tipo, periodo: documento.periodo },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({
      documento: importesASalida(documento, IMPORTES_DOCUMENTO),
    });
  });

  /**
   * Importa comprobantes desde un archivo Excel/CSV (tareas 93 y 94, Parte 5).
   *
   * `modo: 'simulacion'` corre el parseo y la validación de
   * `@effort/importers` y devuelve el reporte sin tocar la base — nada se
   * persiste. `modo: 'real'` además inserta todas las filas aceptadas con
   * `deps.documentos.registrarLote()`, en una sola sentencia: la restricción
   * única de `(clienteId, rucEmisor, timbrado, numeroComprobante)` (ya
   * existía en la base desde la migración inicial, con nombre distinto al
   * declarado en `schema.prisma` — corregido en la tarea 94, ver bitácora)
   * hace que reimportar el mismo archivo salte en silencio las filas que ya
   * estaban en vez de duplicarlas o de romper todo el lote por una sola.
   */
  app.post('/api/v1/clientes/:clienteId/documentos/importar', async (peticion) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'documento', 'crear', clienteId);
    const cuerpo = importarArchivoDeComprobantesSchema.parse(peticion.body);

    let reporte: Awaited<ReturnType<typeof importarComprobantes>>;
    try {
      reporte = await importarComprobantes(
        Buffer.from(cuerpo.contenidoBase64, 'base64'),
        cuerpo.nombreArchivo,
      );
    } catch (error) {
      throw new ErrorDeAplicacion(
        400,
        `No se pudo leer el archivo: ${error instanceof Error ? error.message : 'error desconocido'}`,
        'archivo_invalido',
      );
    }

    const aceptadosParaSalida = reporte.aceptados.map((comprobante) =>
      importesASalida(comprobante, ['total']),
    );

    if (cuerpo.modo === 'simulacion') {
      return {
        modo: 'simulacion' as const,
        totalFilas: reporte.totalFilas,
        aceptados: aceptadosParaSalida,
        rechazados: reporte.rechazados,
        persistidos: [],
      };
    }

    // Una sola sentencia para todo el lote (tarea 94): ni una fila persistida
    // suelta si algo fallara a mitad de camino, y reimportar el mismo archivo
    // no duplica — la restricción única de la base salta en silencio lo que
    // ya existía en vez de romper el lote entero.
    const persistidos = await deps.documentos.registrarLote(
      reporte.aceptados.map((comprobante) => ({
        clienteId,
        periodo: cuerpo.periodo,
        tipo: tipoDocumentoDesdeComprobante(comprobante),
        canalRecepcion: 'ONEDRIVE',
        recibidoEn: deps.ahora(),
        rucEmisor: comprobante.rucEmisor,
        timbrado: comprobante.timbrado,
        numeroComprobante: comprobante.numero,
        total: comprobante.total,
        tasa: comprobante.tasa,
        anulado: comprobante.anulado,
        evidenciaId: null,
        observaciones: `Importado automáticamente desde ${cuerpo.nombreArchivo}.`,
        creadoPorUsuarioId: sujeto.usuarioId,
      })),
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.DOCUMENTO_IMPORTADO_DESDE_ARCHIVO,
      entidad: 'documento',
      entidadId: null,
      clienteId,
      datosDespues: {
        nombreArchivo: cuerpo.nombreArchivo,
        periodo: cuerpo.periodo,
        totalFilas: reporte.totalFilas,
        aceptados: reporte.aceptados.length,
        // Puede ser menor que `aceptados` si el archivo ya se había
        // importado antes: esas filas se saltean, no se duplican.
        persistidos: persistidos.length,
        rechazados: reporte.rechazados.length,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return {
      modo: 'real' as const,
      totalFilas: reporte.totalFilas,
      aceptados: aceptadosParaSalida,
      rechazados: reporte.rechazados,
      persistidos: persistidos.map((documento) => importesASalida(documento, IMPORTES_DOCUMENTO)),
    };
  });

  app.patch('/api/v1/documentos/:id/estado', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'documento', 'editar');
    const cuerpo = cambiarEstadoSchema.parse(peticion.body);

    // Se busca con el filtro de cartera antes de tocar nada: si el documento
    // pertenece a un cliente ajeno, no existe para este usuario.
    const previo = await deps.documentos.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previo) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    const documento = await deps.documentos.cambiarEstado(
      id,
      cuerpo.estado,
      cuerpo.motivoRechazo,
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.DOCUMENTO_CAMBIO_ESTADO,
      entidad: 'documento',
      entidadId: id,
      clienteId: previo.clienteId,
      datosAntes: { estado: previo.estado },
      datosDespues: { estado: documento.estado, motivoRechazo: documento.motivoRechazo },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { documento: importesASalida(documento, IMPORTES_DOCUMENTO) };
  });

  /* --- Proceso mensual ---------------------------------------------------- */

  const actualizarProcesoSchema = z
    .object({
      comprobantesRetirados: z.boolean().optional(),
      fechaRetiro: fechaIsoSchema.nullable().optional(),
      documentosRecibidos: z.number().int().min(0).max(100_000).optional(),
      documentosFaltantes: z.number().int().min(0).max(100_000).optional(),
      documentosObservados: z.number().int().min(0).max(100_000).optional(),
      comprasCargadasSiga: z.boolean().optional(),
      ventasCargadasSiga: z.boolean().optional(),
      retencionesCargadas: z.boolean().optional(),
      extractosRecibidos: z.boolean().optional(),
      conciliacionBancariaRealizada: z.boolean().optional(),
      ivaRevisado: z.boolean().optional(),
      ivaSaldoAPagar: guaraniesSchema.nullable().optional(),
      ivaSaldoAFavor: guaraniesSchema.nullable().optional(),
      liquidacionGenerada: z.boolean().optional(),
      liquidacionEnviada: z.boolean().optional(),
      balanceAplica: z.boolean().optional(),
      estadoGeneral: estadoGeneralSchema.optional(),
      riesgo: nivelRiesgoSchema.optional(),
      proximaAccion: textoLargo.nullable().optional(),
      fechaLimiteInterna: fechaIsoSchema.nullable().optional(),
      observaciones: textoLargo.nullable().optional(),
    })
    .strict()
    .refine(
      // El IVA del período se salda a favor o a pagar, nunca las dos cosas.
      // Guardar ambos distintos de cero deja un período que no se puede liquidar.
      (cambios) =>
        !(
          cambios.ivaSaldoAPagar &&
          cambios.ivaSaldoAPagar !== '0' &&
          cambios.ivaSaldoAFavor &&
          cambios.ivaSaldoAFavor !== '0'
        ),
      {
        message: 'El IVA del período no puede tener saldo a pagar y a favor al mismo tiempo.',
        path: ['ivaSaldoAFavor'],
      },
    );

  app.get('/api/v1/proceso-mensual/:periodo', async (peticion) => {
    const { periodo } = z.object({ periodo: periodoSchema }).strict().parse(peticion.params);
    const sujeto = autorizar(peticion, 'proceso_mensual', 'ver');

    const filas = await deps.procesoMensual.listar(periodo, filtroDeClientes(sujeto));

    return { periodo, procesos: filas.map((fila) => importesASalida(fila, IMPORTES_PROCESO)) };
  });

  app.get('/api/v1/clientes/:clienteId/proceso-mensual/:periodo', async (peticion) => {
    const { clienteId, periodo } = paramsClientePeriodo.parse(peticion.params);
    const sujeto = autorizar(peticion, 'proceso_mensual', 'ver', clienteId);

    const proceso = await deps.procesoMensual.buscar(clienteId, periodo, filtroDeClientes(sujeto));
    if (!proceso) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    return { proceso: importesASalida(proceso, IMPORTES_PROCESO) };
  });

  app.put('/api/v1/clientes/:clienteId/proceso-mensual/:periodo', async (peticion) => {
    const { clienteId, periodo } = paramsClientePeriodo.parse(peticion.params);
    const sujeto = autorizar(peticion, 'proceso_mensual', 'editar', clienteId);
    const cambios = actualizarProcesoSchema.parse(peticion.body);

    // Crea la fila si el período todavía no se abrió: para el usuario, editar
    // un mes que nadie tocó y editar uno en curso son la misma acción.
    const previo = await deps.procesoMensual.asegurar(clienteId, periodo, sujeto.usuarioId);

    // Los cuatro campos que llegan como texto se separan del resto y se
    // convierten al tipo del dominio. Sin sacarlos del spread, las fechas
    // entrarían como cadena y los importes también, y Prisma los rechazaría
    // recién en tiempo de ejecución.
    const { fechaRetiro, fechaLimiteInterna, ivaSaldoAPagar, ivaSaldoAFavor, ...resto } = cambios;

    const proceso = await deps.procesoMensual.actualizar(
      clienteId,
      periodo,
      {
        ...resto,
        ...(fechaRetiro !== undefined
          ? { fechaRetiro: fechaRetiro === null ? null : new Date(fechaRetiro) }
          : {}),
        ...(fechaLimiteInterna !== undefined
          ? {
              fechaLimiteInterna:
                fechaLimiteInterna === null ? null : new Date(fechaLimiteInterna),
            }
          : {}),
        ...(ivaSaldoAPagar !== undefined
          ? { ivaSaldoAPagar: ivaSaldoAPagar === null ? null : BigInt(ivaSaldoAPagar) }
          : {}),
        ...(ivaSaldoAFavor !== undefined
          ? { ivaSaldoAFavor: ivaSaldoAFavor === null ? null : BigInt(ivaSaldoAFavor) }
          : {}),
      },
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.PROCESO_MENSUAL_ACTUALIZADO,
      entidad: 'proceso_mensual',
      entidadId: proceso.id,
      clienteId,
      datosAntes: { estadoGeneral: previo.estadoGeneral, riesgo: previo.riesgo },
      datosDespues: { estadoGeneral: proceso.estadoGeneral, riesgo: proceso.riesgo, ...cambios },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { proceso: importesASalida(proceso, IMPORTES_PROCESO) };
  });
}
