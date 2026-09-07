/**
 * Balances.
 *
 * Regla que gobierna todo este archivo: **el sistema no aprueba balances**.
 * Verifica consistencia, arma el checklist y deja el balance listo para que una
 * persona lo revise. Aprobar es un acto profesional con responsabilidad legal
 * ante DNIT y ante el cliente: quien firma responde.
 *
 * Ver `docs/adr/0004-el-sistema-no-aprueba-balances.md`.
 *
 * La regla está impuesta en cuatro capas independientes:
 *   1. `revisarBalance()` no puede devolver APROBADO — no está en su tipo.
 *   2. `guardarCifras()` rechaza APROBADO explícitamente.
 *   3. `aprobarBalance()` del dominio exige cero bloqueantes y rol habilitado.
 *   4. El RBAC solo permite la acción `aprobar` a `revisor_balance` y `direccion`.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  ErrorDeAprobacion,
  aprobarBalance,
  gs,
  revisarBalance,
  type CifrasBalance,
  type CifrasEstadoResultados,
} from '@effort/core';
import { guaraniesSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar, consultaPeriodoOpcional, importesASalida, paramsClientePeriodo } from './comun.js';

const IMPORTES_BALANCE = ['activo', 'pasivo', 'patrimonioNeto', 'resultadoEjercicio'] as const;

const guardarBalanceSchema = z
  .object({
    activo: guaraniesSchema,
    pasivo: guaraniesSchema,
    patrimonioNeto: guaraniesSchema,
    resultadoEjercicio: guaraniesSchema,
    estadoResultados: z
      .object({
        ingresos: guaraniesSchema,
        costos: guaraniesSchema,
        gastos: guaraniesSchema,
        resultado: guaraniesSchema,
      })
      .strict(),
  })
  .strict();

export async function registrarRutasDeBalances(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/balances', async (peticion) => {
    const { periodo } = consultaPeriodoOpcional.parse(peticion.query ?? {});
    const sujeto = autorizar(peticion, 'balance', 'ver');

    const balances = await deps.balances.listar(periodo ?? null, filtroDeClientes(sujeto));

    return { balances: balances.map((b) => importesASalida(b, IMPORTES_BALANCE)) };
  });

  app.get('/api/v1/clientes/:clienteId/balances/:periodo', async (peticion) => {
    const { clienteId, periodo } = paramsClientePeriodo.parse(peticion.params);
    const sujeto = autorizar(peticion, 'balance', 'ver', clienteId);

    const balance = await deps.balances.buscar(clienteId, periodo, filtroDeClientes(sujeto));
    if (!balance) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    return { balance: importesASalida(balance, IMPORTES_BALANCE) };
  });

  /**
   * Guarda las cifras y corre la revisión previa.
   *
   * El estado resultante lo decide el dominio a partir de lo que encuentra:
   * OBSERVADO si hay algo bloqueante, LISTO_PARA_REVISION si está limpio.
   * Nunca APROBADO.
   */
  app.put('/api/v1/clientes/:clienteId/balances/:periodo', async (peticion) => {
    const { clienteId, periodo } = paramsClientePeriodo.parse(peticion.params);
    const sujeto = autorizar(peticion, 'balance', 'editar', clienteId);
    const cuerpo = guardarBalanceSchema.parse(peticion.body);

    const cifras: CifrasBalance = {
      activo: gs(cuerpo.activo),
      pasivo: gs(cuerpo.pasivo),
      patrimonioNeto: gs(cuerpo.patrimonioNeto),
      resultadoEjercicio: gs(cuerpo.resultadoEjercicio),
    };

    const estadoResultados: CifrasEstadoResultados = {
      ingresos: gs(cuerpo.estadoResultados.ingresos),
      costos: gs(cuerpo.estadoResultados.costos),
      gastos: gs(cuerpo.estadoResultados.gastos),
      resultado: gs(cuerpo.estadoResultados.resultado),
    };

    // El contexto operativo sale del proceso mensual, no de lo que declare
    // quien envía el balance: si dependiera del cuerpo, alcanzaría con mentir
    // en un campo para que un balance con documentos faltantes pase a revisión.
    const proceso = await deps.procesoMensual.buscar(clienteId, periodo, filtroDeClientes(sujeto));

    const revision = revisarBalance(cifras, estadoResultados, {
      documentosFaltantes: proceso?.documentosFaltantes ?? 0,
      diferenciasConSiga: 0,
      liquidacionEnviada: proceso?.liquidacionEnviada ?? false,
      extractosBancariosRecibidos: proceso?.extractosRecibidos ?? false,
      conciliacionBancariaRealizada: proceso?.conciliacionBancariaRealizada ?? false,
    });

    // Las inconsistencias se convierten a una forma serializable ANTES de
    // guardarse: `diferencia` es un importe (`bigint`) y `JSON.stringify` no
    // sabe serializarlo. Persistirlas crudas rompe tanto la escritura en la
    // columna Json como la respuesta HTTP.
    const inconsistenciasParaGuardar = revision.inconsistencias.map((i) => ({
      codigo: i.codigo,
      gravedad: i.gravedad,
      detalle: i.detalle,
      diferencia: i.diferencia?.toString() ?? null,
    }));

    const balance = await deps.balances.guardarCifras(
      clienteId,
      periodo,
      cifras,
      revision.estadoSugerido,
      inconsistenciasParaGuardar,
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.BALANCE_ACTUALIZADO,
      entidad: 'balance',
      entidadId: balance.id,
      clienteId,
      datosDespues: {
        periodo,
        estado: balance.estado,
        bloqueantes: revision.bloqueantes,
        advertencias: revision.advertencias,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return {
      balance: importesASalida(balance, IMPORTES_BALANCE),
      revision: {
        estadoSugerido: revision.estadoSugerido,
        bloqueantes: revision.bloqueantes,
        advertencias: revision.advertencias,
        inconsistencias: inconsistenciasParaGuardar,
      },
    };
  });

  /**
   * Aprobación humana del balance.
   *
   * Es la única ruta de todo el sistema que lleva un balance a APROBADO, y
   * exige una persona identificada con rol habilitado. No hay job programado ni
   * regla automática que llegue acá.
   */
  app.post('/api/v1/clientes/:clienteId/balances/:periodo/aprobar', async (peticion) => {
    const { clienteId, periodo } = paramsClientePeriodo.parse(peticion.params);

    // El RBAC ya limita la acción `aprobar` a revisor_balance y direccion.
    const sujeto = autorizar(peticion, 'balance', 'aprobar', clienteId);

    const balance = await deps.balances.buscar(clienteId, periodo, filtroDeClientes(sujeto));
    if (!balance) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    if (balance.estado === 'APROBADO') {
      throw new ErrorDeAplicacion(409, 'Este balance ya fue aprobado.', 'ya_aprobado');
    }

    // Las cifras se comprueban antes que el estado, para que el mensaje sea el
    // más específico de los dos: un balance sin cargar también estaría en un
    // estado no aprobable, pero "no tiene cifras" le dice a la persona
    // exactamente qué falta.
    if (
      balance.activo === null ||
      balance.pasivo === null ||
      balance.patrimonioNeto === null ||
      balance.resultadoEjercicio === null
    ) {
      throw new ErrorDeAplicacion(
        409,
        'El balance no tiene cifras cargadas: no hay nada que aprobar.',
        'balance_incompleto',
      );
    }

    // El estado guardado resume la revisión completa hecha al guardar, incluida
    // la del estado de resultados, que no se persiste como cifras y por lo tanto
    // no se puede recalcular acá. Si el balance no quedó LISTO_PARA_REVISION,
    // hay algo pendiente y no corresponde aprobarlo.
    if (balance.estado !== 'LISTO_PARA_REVISION') {
      throw new ErrorDeAplicacion(
        409,
        `El balance está en estado ${balance.estado} y no está listo para revisión.`,
        'no_aprobable',
      );
    }

    const cifras: CifrasBalance = {
      activo: gs(balance.activo),
      pasivo: gs(balance.pasivo),
      patrimonioNeto: gs(balance.patrimonioNeto),
      resultadoEjercicio: gs(balance.resultadoEjercicio),
    };

    // El estado de resultados no se persiste como cifras propias, así que esta
    // segunda revisión NO lo re-verifica: eso ya ocurrió al guardar, y su
    // resultado quedó grabado en el estado del balance (por eso se exige más
    // abajo que sea LISTO_PARA_REVISION).
    //
    // Lo que sí se re-verifica es la ecuación patrimonial y el contexto
    // operativo, que pueden haber cambiado desde que se guardó: un documento
    // que pasó a faltante deja el balance no aprobable aunque antes lo fuera.
    //
    // Se construye un estado de resultados internamente coherente
    // (ingresos = resultado, sin costos ni gastos) para no introducir una
    // inconsistencia falsa. Pasar ceros con un resultado distinto de cero hacía
    // que `verificarSumatoriaEstadoResultados` fallara siempre, y ningún
    // balance podía aprobarse jamás.
    const proceso = await deps.procesoMensual.buscar(clienteId, periodo, filtroDeClientes(sujeto));

    const revision = revisarBalance(
      cifras,
      {
        ingresos: cifras.resultadoEjercicio,
        costos: gs(0),
        gastos: gs(0),
        resultado: cifras.resultadoEjercicio,
      },
      {
        documentosFaltantes: proceso?.documentosFaltantes ?? 0,
        diferenciasConSiga: 0,
        liquidacionEnviada: proceso?.liquidacionEnviada ?? false,
        extractosBancariosRecibidos: proceso?.extractosRecibidos ?? false,
        conciliacionBancariaRealizada: proceso?.conciliacionBancariaRealizada ?? false,
      },
    );

    try {
      // El dominio vuelve a exigir cero bloqueantes y rol habilitado. Es
      // redundante con el RBAC a propósito: si alguien agrega una ruta nueva y
      // se olvida del permiso, esta comprobación sigue de pie.
      aprobarBalance(revision, {
        aprobadoPorUsuarioId: sujeto.usuarioId,
        rolDelAprobador: sujeto.rol,
        aprobadoEn: deps.ahora(),
      });
    } catch (error) {
      if (error instanceof ErrorDeAprobacion) {
        throw new ErrorDeAplicacion(409, error.message, 'no_aprobable');
      }
      throw error;
    }

    const momento = deps.ahora();
    const aprobado = await deps.balances.aprobar(clienteId, periodo, sujeto.usuarioId, momento);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.BALANCE_APROBADO,
      entidad: 'balance',
      entidadId: aprobado.id,
      clienteId,
      datosAntes: { estado: balance.estado },
      datosDespues: {
        estado: 'APROBADO',
        periodo,
        aprobadoPor: sujeto.usuarioId,
        rol: sujeto.rol,
        aprobadoEn: momento.toISOString(),
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { balance: importesASalida(aprobado, IMPORTES_BALANCE) };
  });
}
