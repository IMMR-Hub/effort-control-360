/**
 * IVA crédito y débito, calculado desde las planillas RG 90.
 *
 * Es la primera pantalla del sistema que muestra **plata calculada sobre
 * documentos reales** y no un dato que alguien escribió a mano. Cada cifra sale
 * de una planilla que EFFORT ya presentó ante la DNIT y se puede rastrear hasta
 * el comprobante que la originó.
 *
 * Usa el recurso `liquidacion` de la matriz de permisos, que ya existía y ya
 * reparte bien: dirección y responsables calculan, el resto solo mira.
 *
 * **No hay alta manual, y no es un olvido.** No existe ruta para escribir un
 * saldo de IVA a mano: el único camino es calcularlo desde los libros. Un
 * sistema que permite corregir el número a mano deja de poder explicar de dónde
 * salió, y explicarlo es justamente para lo que sirve.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { DIVISORES_CONFIRMADOS_POR_EFFORT } from '@effort/core';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar } from './comun.js';
import { liquidarIvaDesdeLibros } from '../servicios/liquidacionDeIva.js';

const filtroSchema = z
  .object({
    clienteId: z.string().uuid().optional(),
    soloRiesgo: z
      .enum(['true', 'false'])
      .optional()
      .transform((valor) => valor === 'true'),
  })
  .strict();

export async function registrarRutasDeLiquidacionesIva(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /**
   * Recalcula el IVA de todos los clientes desde sus planillas.
   *
   * Es seguro repetirlo: reemplaza la liquidación del período y no duplica
   * hallazgos. Se puede disparar a mano después de corregir una planilla, sin
   * esperar a la corrida automática.
   */
  app.post('/api/v1/liquidaciones-iva/calcular', async (peticion) => {
    const sujeto = autorizar(peticion, 'liquidacion', 'crear');

    if (!deps.drive || !deps.libroRg90) {
      throw new ErrorDeAplicacion(
        503,
        'Falta la conexión con OneDrive: sin ella no se pueden leer las planillas.',
        'sin_drive',
      );
    }

    const resumen = await liquidarIvaDesdeLibros(
      {
        clientes: deps.clientes,
        librosDelCliente: (clienteId) => deps.libroRg90!.librosDelCliente(clienteId),
        drive: deps.drive,
        guardarLiquidacion: (datos) => deps.libroRg90!.guardarLiquidacion(datos),
        guardarHallazgos: (datos) => deps.libroRg90!.guardarHallazgos(datos),
        divisores: DIVISORES_CONFIRMADOS_POR_EFFORT,
      },
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.LIQUIDACION_IVA_CALCULADA,
      entidad: 'liquidacion',
      entidadId: null,
      clienteId: null,
      datosDespues: {
        periodos: resumen.periodosCalculados,
        archivos: resumen.archivosLeidos,
        filas: resumen.filasInterpretadas,
        hallazgosNuevos: resumen.hallazgosNuevos,
        fallos: resumen.fallos.length,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return resumen;
  });

  /**
   * Liquidaciones de un cliente, de la más reciente a la más vieja.
   *
   * Exige `clienteId` a propósito: el IVA es por contribuyente, y una lista
   * mezclando cinco empresas no es una vista útil de nada.
   */
  app.get('/api/v1/liquidaciones-iva', async (peticion) => {
    const sujeto = autorizar(peticion, 'liquidacion', 'ver');
    const { clienteId } = filtroSchema.parse(peticion.query);

    if (!clienteId) {
      throw new ErrorDeAplicacion(400, 'Indicá de qué cliente querés el IVA.', 'falta_cliente');
    }
    if (!deps.libroRg90) {
      throw new ErrorDeAplicacion(503, 'El módulo de IVA no está disponible.', 'sin_modulo');
    }

    // El alcance por cartera se comprueba sobre el CLIENTE, que es el dueño del
    // dato: si no lo puede ver, tampoco su IVA.
    const cliente = await deps.clientes.buscarPorId(clienteId, filtroDeClientes(sujeto));
    if (!cliente) {
      throw new ErrorDeAplicacion(404, 'No se encontró el cliente.', 'no_encontrado');
    }

    const liquidaciones = await deps.libroRg90.liquidacionesDeCliente(clienteId);

    return {
      liquidaciones: liquidaciones.map((l) => ({
        periodo: l.periodo,
        creditoFiscal: l.creditoFiscal.toString(),
        debitoFiscal: l.debitoFiscal.toString(),
        saldoAPagar: l.saldoAPagar.toString(),
        saldoAFavor: l.saldoAFavor.toString(),
        comprobantesCompras: l.comprobantesCompras,
        comprobantesVentas: l.comprobantesVentas,
        archivosLeidos: l.archivosLeidos,
        filasRechazadas: l.filasRechazadas,
        calculadoEn: l.calculadoEn.toISOString(),
      })),
    };
  });

  /**
   * Lo que hay que mirar antes de presentar: diferencias de IVA e
   * incoherencias de los comprobantes.
   *
   * `soloRiesgo=true` deja únicamente las que pueden derivar en multa. Es el
   * filtro que importa: entre ciento y pico de inconsistencias menores, las
   * cuarenta y nueve que arriesgan multa se pierden de vista.
   */
  app.get('/api/v1/liquidaciones-iva/hallazgos', async (peticion) => {
    const sujeto = autorizar(peticion, 'liquidacion', 'ver');
    const { clienteId, soloRiesgo } = filtroSchema.parse(peticion.query);

    if (!deps.libroRg90) {
      throw new ErrorDeAplicacion(503, 'El módulo de IVA no está disponible.', 'sin_modulo');
    }

    if (clienteId) {
      const cliente = await deps.clientes.buscarPorId(clienteId, filtroDeClientes(sujeto));
      if (!cliente) {
        throw new ErrorDeAplicacion(404, 'No se encontró el cliente.', 'no_encontrado');
      }
    }

    // `clienteId` se omite en vez de mandarse en `undefined`: el proyecto usa
    // `exactOptionalPropertyTypes`, que distingue "sin filtro" de "filtro
    // vacío" — y esa distinción es justo la que evita devolver de más.
    const hallazgos = await deps.libroRg90.hallazgos({
      ...(clienteId ? { clienteId } : {}),
      soloRiesgo,
    });

    const conRiesgo = hallazgos.filter(
      (h) => h.riesgo === 'CREDITO_DE_MAS' || h.riesgo === 'DEBITO_DE_MENOS',
    );

    return {
      hallazgos: hallazgos.map((h) => ({
        id: h.id,
        clienteId: h.clienteId,
        periodo: h.periodo,
        tipo: h.tipo,
        riesgo: h.riesgo,
        tipoRegistro: h.tipoRegistro,
        numeroComprobante: h.numeroComprobante,
        contraparte: h.contraparte,
        tasa: h.tasa,
        diferencia: h.diferencia.toString(),
        detalle: h.detalle,
      })),
      resumen: {
        total: hallazgos.length,
        conRiesgoDeMulta: conRiesgo.length,
        // En valor absoluto: un crédito de más y un débito de menos son dos
        // problemas, no uno que compensa al otro.
        ivaEnRiesgo: conRiesgo
          .reduce((suma, h) => suma + (h.diferencia < 0n ? -h.diferencia : h.diferencia), 0n)
          .toString(),
      },
    };
  });
}
