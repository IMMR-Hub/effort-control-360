/**
 * Exportaciones de SIGA y conciliación.
 *
 * Este módulo es el que responde la pregunta comercial del piloto: "¿qué
 * recibimos que todavía no está cargado en SIGA, y qué hay en SIGA que no
 * tenemos respaldado?".
 *
 * El sistema **no toca SIGA**. Trabaja sobre las exportaciones Excel/CSV que
 * SIGA produce, y compara sus filas contra los documentos registrados usando
 * `conciliarConSiga` de `@effort/core` — el mismo motor que tiene sus propios
 * tests unitarios. La ruta transporta datos; no reimplementa la comparación.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  conciliarConSiga,
  fechaCivilDesdeIso,
  gs,
  magnitudDeLasDiferencias,
  type Comprobante,
} from '@effort/core';
import {
  fechaIsoSchema,
  guaraniesSchema,
  idSchema,
  periodoSchema,
  tasaIvaSchema,
  textoLargo,
} from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import type {
  ComprobanteSigaAlmacenado,
  DocumentoAlmacenado,
} from '../puertos-dominio.js';
import { autorizar, consultaPeriodoOpcional, paramsCliente, paramsClientePeriodo } from './comun.js';

const filaSigaSchema = z
  .object({
    rucEmisor: z.string().trim().min(1).max(20),
    timbrado: z.string().trim().min(1).max(20),
    numeroComprobante: z.string().trim().min(1).max(30),
    total: guaraniesSchema,
    tasa: tasaIvaSchema,
    anulado: z.boolean().default(false),
    fecha: fechaIsoSchema,
  })
  .strict();

const importarExportacionSchema = z
  .object({
    periodo: periodoSchema,
    tipoReporte: z.enum([
      'LIBRO_COMPRAS',
      'LIBRO_VENTAS',
      'DETERMINACION_IVA',
      'COMPROBANTES_CARGADOS',
      'RETENCIONES',
      'MAYOR_CONTABLE',
      'SUMAS_Y_SALDOS',
      'BALANCE_GENERAL',
      'ESTADO_RESULTADOS',
      'OTRO',
    ]),
    formato: z.enum(['EXCEL', 'CSV', 'PDF']),
    evidenciaId: idSchema.nullable().default(null),
    observaciones: textoLargo.nullable().default(null),
    // Tope alto pero finito: un archivo con cien mil filas es un error de
    // origen, no un mes de trabajo, y sin tope agota la memoria del proceso.
    comprobantes: z.array(filaSigaSchema).max(20_000).default([]),
  })
  .strict();

/**
 * Adapta un documento propio a la forma que entiende el motor de conciliación.
 *
 * Solo se traducen los que tienen la terna de identificación completa: sin
 * ella no hay clave natural con la cual comparar. Los demás se cuentan aparte
 * y se informan, en vez de desaparecer del reporte.
 */
function documentoAComprobante(doc: DocumentoAlmacenado): Comprobante | null {
  if (!doc.rucEmisor || !doc.timbrado || !doc.numeroComprobante || doc.total === null) {
    return null;
  }

  return {
    rucEmisor: doc.rucEmisor,
    timbrado: doc.timbrado,
    numero: doc.numeroComprobante,
    tipo: 'FACTURA',
    origen: 'COMPRA',
    fecha: fechaCivilDesdeIso(doc.recibidoEn.toISOString().slice(0, 10)),
    total: gs(doc.total),
    tasa: (doc.tasa ?? 'EXENTA') as 'DIEZ' | 'CINCO' | 'EXENTA',
    anulado: doc.anulado,
  };
}

function filaSigaAComprobante(fila: ComprobanteSigaAlmacenado): Comprobante {
  return {
    rucEmisor: fila.rucEmisor,
    timbrado: fila.timbrado,
    numero: fila.numeroComprobante,
    tipo: 'FACTURA',
    origen: 'COMPRA',
    fecha: fechaCivilDesdeIso(fila.fecha.toISOString().slice(0, 10)),
    total: gs(fila.total),
    tasa: fila.tasa as 'DIEZ' | 'CINCO' | 'EXENTA',
    anulado: fila.anulado,
  };
}

/** Resume un comprobante para la respuesta, con el importe como texto. */
function aSalida(comprobante: Comprobante) {
  return {
    rucEmisor: comprobante.rucEmisor,
    timbrado: comprobante.timbrado,
    numeroComprobante: comprobante.numero,
    total: comprobante.total.toString(),
    tasa: comprobante.tasa,
    anulado: comprobante.anulado,
  };
}

export async function registrarRutasDeSiga(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/clientes/:clienteId/siga', async (peticion) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const { periodo } = consultaPeriodoOpcional.parse(peticion.query ?? {});
    const sujeto = autorizar(peticion, 'exportacion_siga', 'ver', clienteId);

    const exportaciones = await deps.exportacionesSiga.listar(
      clienteId,
      periodo ?? null,
      filtroDeClientes(sujeto),
    );

    return { exportaciones };
  });

  app.post('/api/v1/clientes/:clienteId/siga', async (peticion, respuesta) => {
    const { clienteId } = paramsCliente.parse(peticion.params);
    const sujeto = autorizar(peticion, 'exportacion_siga', 'crear', clienteId);
    const cuerpo = importarExportacionSchema.parse(peticion.body);

    const exportacion = await deps.exportacionesSiga.registrar({
      clienteId,
      periodo: cuerpo.periodo,
      tipoReporte: cuerpo.tipoReporte,
      formato: cuerpo.formato,
      evidenciaId: cuerpo.evidenciaId,
      observaciones: cuerpo.observaciones,
      comprobantes: cuerpo.comprobantes.map((fila) => ({
        rucEmisor: fila.rucEmisor,
        timbrado: fila.timbrado,
        numeroComprobante: fila.numeroComprobante,
        total: BigInt(fila.total),
        tasa: fila.tasa,
        anulado: fila.anulado,
        fecha: new Date(fila.fecha),
      })),
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.SIGA_EXPORTACION_IMPORTADA,
      entidad: 'exportacion_siga',
      entidadId: exportacion.id,
      clienteId,
      datosDespues: {
        periodo: cuerpo.periodo,
        tipoReporte: cuerpo.tipoReporte,
        filas: cuerpo.comprobantes.length,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ exportacion });
  });

  /**
   * Concilia los documentos recibidos contra lo que SIGA tiene cargado.
   *
   * No modifica nada: es una lectura que compara dos conjuntos y devuelve las
   * diferencias. Corregirlas es una decisión de una persona — el sistema
   * señala, no ajusta.
   */
  app.get('/api/v1/clientes/:clienteId/siga/:periodo/conciliacion', async (peticion) => {
    const { clienteId, periodo } = paramsClientePeriodo.parse(peticion.params);
    const sujeto = autorizar(peticion, 'exportacion_siga', 'ver', clienteId);

    // Se comprueba el alcance antes de leer: `comprobantesDelPeriodo` no
    // recibe filtro de cartera porque siempre se lo invoca sobre un cliente
    // ya autorizado, y esta guarda es la que lo garantiza.
    const cliente = await deps.clientes.buscarPorId(clienteId, filtroDeClientes(sujeto));
    if (!cliente) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    const documentos = await deps.documentos.documentosDelPeriodo(clienteId, periodo);
    const filasSiga = await deps.exportacionesSiga.comprobantesDelPeriodo(clienteId, periodo);

    const recibidos: Comprobante[] = [];
    let sinIdentificacion = 0;

    for (const doc of documentos) {
      const comprobante = documentoAComprobante(doc);
      if (comprobante) recibidos.push(comprobante);
      else sinIdentificacion += 1;
    }

    const resultado = conciliarConSiga(recibidos, filasSiga.map(filaSigaAComprobante));

    return {
      periodo,
      conciliado: resultado.conciliado,
      totalRecibidos: resultado.totalRecibidos,
      totalEnSiga: resultado.totalEnSiga,
      coincidentes: resultado.coincidentes,
      /**
       * Documentos que no se pudieron comparar por no tener la terna de
       * identificación. Se informan explícitamente: si se omitieran, la
       * conciliación diría "todo cuadra" sobre un conjunto incompleto.
       */
      sinIdentificacion,
      faltaCargarEnSiga: resultado.faltaCargarEnSiga.map(aSalida),
      sinRespaldoDocumental: resultado.sinRespaldoDocumental.map(aSalida),
      diferenciasDeMonto: resultado.diferenciasDeMonto.map((dif) => ({
        clave: dif.clave,
        recibido: dif.recibido.total.toString(),
        enSiga: dif.enSiga.total.toString(),
        diferencia: dif.diferencia.toString(),
      })),
      magnitudDeLasDiferencias: magnitudDeLasDiferencias(resultado).toString(),
    };
  });
}
