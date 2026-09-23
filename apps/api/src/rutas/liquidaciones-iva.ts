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
import { esRiesgoDeMulta, grupoDeInconsistencia, type RiesgoDeHallazgo } from '@effort/importers';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { autorizar } from './comun.js';
import { intentarConCandado } from '../servicios/candadoDeIva.js';
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

    const drive = deps.drive;
    const libroRg90 = deps.libroRg90;
    const intento = await intentarConCandado(() =>
      liquidarIvaDesdeLibros(
        {
          clientes: deps.clientes,
          librosDelCliente: (clienteId) => libroRg90.librosDelCliente(clienteId),
          drive,
          guardarLiquidacion: (datos) => libroRg90.guardarLiquidacion(datos),
          guardarHallazgos: (datos) => libroRg90.guardarHallazgos(datos),
          divisores: DIVISORES_CONFIRMADOS_POR_EFFORT,
          ahora: deps.ahora,
        },
        sujeto.usuarioId,
      ),
    );

    // Otro cálculo en curso (el automático de cada hora, o alguien que apretó
    // el botón antes): dos a la vez duplican memoria y pueden repetir hallazgos.
    if (intento.ocupado) {
      throw new ErrorDeAplicacion(
        409,
        'Ya hay un cálculo de IVA en curso. Esperá unos minutos y volvé a intentar.',
        'calculo_en_curso',
      );
    }
    const resumen = intento.valor;

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
        ignorados: resumen.archivosIgnorados,
        avisos: resumen.avisos.length,
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

    // El saldo DECLARADO (formulario 120, tarea 138) es aparte del calculado:
    // recalcularlo desde las planillas puede contradecir una determinación que
    // la DNIT ya recibió. Se busca uno por período; si no hay lectura de ese
    // período, o si el módulo de declaraciones no está disponible (no requiere
    // OneDrive de origen en todos los entornos), no se muestra nada — nunca se
    // inventa un saldo que ningún PDF dijo.
    const saldosDeclarados = deps.declaraciones
      ? await Promise.all(
          liquidaciones.map((l) => deps.declaraciones!.saldoDeIvaDeclarado(clienteId, l.periodo)),
        )
      : liquidaciones.map(() => null);

    return {
      liquidaciones: liquidaciones.map((l, indice) => {
        const declarado = saldosDeclarados[indice];
        return {
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
          saldoAFavorDeclarado: declarado ? declarado.saldoATrasladar.toString() : null,
        };
      }),
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

    // Lo aceptado por una persona ya no cuenta como riesgo: se decidió, con
    // nombre y motivo. Lo que está en revisión sí sigue contando.
    const conRiesgo = hallazgos.filter(
      (h) =>
        h.estado !== 'ACEPTADO' &&
        esRiesgoDeMulta({ riesgo: h.riesgo as RiesgoDeHallazgo, diferencia: h.diferencia }),
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
        // Solo los comprobantes que no cierran: SIN_AUTOFACTURA, REDONDEO o
        // A_REVISAR (tarea 148). Clasifica, no esconde: todos se devuelven.
        grupo: grupoDeInconsistencia(h),
        detalle: h.detalle,
        estado: h.estado,
        notaDecision: h.notaDecision,
        decididoEn: h.decididoEn?.toISOString() ?? null,
      })),
      resumen: {
        total: hallazgos.length,
        conRiesgoDeMulta: conRiesgo.length,
        enRevision: hallazgos.filter((h) => h.estado === 'EN_REVISION').length,
        aceptados: hallazgos.filter((h) => h.estado === 'ACEPTADO').length,
        // Los comprobantes que no cierran, separados por lo que ya se sabe de
        // ellos. Suman exactamente lo mismo que antes: nada se descuenta.
        inconsistencias: {
          sinAutofactura: hallazgos.filter((h) => grupoDeInconsistencia(h) === 'SIN_AUTOFACTURA').length,
          redondeo: hallazgos.filter((h) => grupoDeInconsistencia(h) === 'REDONDEO').length,
          aRevisar: hallazgos.filter((h) => grupoDeInconsistencia(h) === 'A_REVISAR').length,
        },
        // En valor absoluto: un crédito de más y un débito de menos son dos
        // problemas, no uno que compensa al otro.
        ivaEnRiesgo: conRiesgo
          .reduce((suma, h) => suma + (h.diferencia < 0n ? -h.diferencia : h.diferencia), 0n)
          .toString(),
      },
    };
  });

  /**
   * Una persona acepta un hallazgo o lo manda a revisar.
   *
   * Daniel, 2026-09-14: *"mejor alertar a partir de 1 guaraní, y que luego
   * puedan aceptar o revisar"*. El sistema avisa de todo; decide una persona.
   *
   * **Aceptar exige motivo**, igual que cerrar una alerta: una aceptación sin
   * explicación no se distingue de un clic para sacarse el aviso de encima, y
   * la diferencia importa el día que la DNIT pregunte por ese comprobante. La
   * base también lo exige (`hallazgo_libro_rg90_aceptado_con_motivo`).
   *
   * Se puede volver de ACEPTADO a EN_REVISION: equivocarse al aceptar tiene
   * que tener arreglo, y el arreglo también queda en la bitácora.
   */
  app.post('/api/v1/liquidaciones-iva/hallazgos/:id/decision', async (peticion) => {
    const sujeto = autorizar(peticion, 'liquidacion', 'editar');
    const { id } = z.object({ id: z.string().uuid() }).strict().parse(peticion.params);
    const cuerpo = decisionSchema.parse(peticion.body);

    if (!deps.libroRg90) {
      throw new ErrorDeAplicacion(503, 'El módulo de IVA no está disponible.', 'sin_modulo');
    }

    const previo = await deps.libroRg90.hallazgoPorId(id);
    // Mismo 404 si no existe o si es de un cliente fuera de su cartera: decir
    // "existe pero no es tuyo" ya es filtrar información.
    const cliente = previo
      ? await deps.clientes.buscarPorId(previo.clienteId, filtroDeClientes(sujeto))
      : null;
    if (!previo || !cliente) {
      throw new ErrorDeAplicacion(404, 'No se encontró el hallazgo.', 'no_encontrado');
    }

    await deps.libroRg90.decidirHallazgo({
      id,
      estado: cuerpo.decision,
      nota: cuerpo.nota?.trim() || null,
      usuarioId: sujeto.usuarioId,
      ahora: deps.ahora(),
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.HALLAZGO_DE_LIBRO_DECIDIDO,
      entidad: 'hallazgo_libro_rg90',
      entidadId: id,
      clienteId: previo.clienteId,
      datosAntes: { estado: previo.estado, nota: previo.notaDecision },
      datosDespues: { estado: cuerpo.decision, nota: cuerpo.nota ?? null },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { id, estado: cuerpo.decision };
  });
}

const decisionSchema = z
  .object({
    decision: z.enum(['ACEPTADO', 'EN_REVISION']),
    nota: z.string().max(500).optional(),
  })
  .strict()
  .refine((c) => c.decision !== 'ACEPTADO' || (c.nota?.trim().length ?? 0) >= 5, {
    message: 'Para aceptar un hallazgo hay que dejar escrito el motivo.',
    path: ['nota'],
  });
