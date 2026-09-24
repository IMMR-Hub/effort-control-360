/**
 * El ciclo completo de cálculo: genera los vencimientos del período,
 * recalcula el IVA desde los libros, detecta presentaciones leyendo los PDF
 * de la DNIT, y evalúa alertas — en ese orden, porque cada paso puede
 * cambiar lo que el siguiente encuentra (ver los comentarios de cada llamada
 * más abajo, que explican por qué ese orden y no otro).
 *
 * Un solo lugar para esto, reusado por dos disparadores — mismo criterio que
 * ya usa `rutas/onedrive.ts` para sincronizar ("el botón no es un camino
 * paralelo, es el mismo con otro disparador"):
 * 1. El trabajo programado cada hora (`programador.ts`).
 * 2. El botón "Actualizar ahora" (`rutas/actualizar-ahora.ts`, tarea 152-bis):
 *    Daniel, 2026-09-23, pensando en la demo con Laura y Lili: *"una vez que
 *    suban los archivos, le pueda dar actualizar para que vean como
 *    desaparecen automáticamente las alertas de los archivos faltantes"* —
 *    sin esperar hasta una hora a que corra solo.
 *
 * Lo que NO hace esta función, a propósito: mandar avisos por correo. Eso
 * sigue siendo exclusivo del trabajo programado, después de llamar a esta
 * función — la REGLA 0-bis de `CLAUDE.md` (ningún correo sin que Daniel lo
 * diga) no se relaja por tener un botón más que puede disparar el cálculo.
 */

import { DIVISORES_CONFIRMADOS_POR_EFFORT, hoyEnParaguay } from '@effort/core';

import type { Dependencias } from '../servidor.js';
import { generarVencimientosDelPeriodo } from './generadorDeVencimientos.js';
import { intentarConCandado } from './candadoDeIva.js';
import { evaluarAlertas } from './motorDeAlertas.js';
import { liquidarIvaDesdeLibros } from './liquidacionDeIva.js';
import { detectarPresentaciones } from './detectorDePresentaciones.js';
import { extraerTextoDePdf } from './textoDePdf.js';

export interface ResumenDelCiclo {
  readonly periodo: string;
  readonly vencimientosGenerados: number;
  readonly aniosSinRevisarFeriados: readonly number[];
  readonly ivaPeriodosCalculados: number;
  readonly ivaHallazgosNuevos: number;
  /** Otro cálculo de IVA ya estaba en curso (el automático, o alguien más apretando el botón): esta vuelta lo salteó. */
  readonly ivaOcupado: boolean;
  readonly presentacionesMarcadas: number;
  readonly presentadasFueraDeTermino: number;
  readonly alertasCreadas: number;
  readonly alertasActualizadas: number;
  readonly alertasResueltas: number;
  /**
   * Cuánto tardó cada etapa, en milisegundos. Sin esto, «el ciclo tarda 19 s»
   * no dice dónde: la tarea 158 dejó la sincronización en segundos y el resto
   * es el cálculo, y hay que saber cuál de las cuatro etapas es la lenta antes
   * de tocar nada.
   */
  readonly tiemposMs: {
    readonly vencimientos: number;
    readonly iva: number;
    readonly presentaciones: number;
    readonly alertas: number;
  };
}

export async function ejecutarCicloDeCalculo(
  deps: Dependencias,
  usuarioId: string,
  disparo: 'automático' | 'manual',
): Promise<ResumenDelCiclo> {
  const hoy = hoyEnParaguay(deps.ahora());
  const periodo = `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  // El mes anterior también: el IVA de septiembre se presenta en octubre, así
  // que en los primeros días del mes lo que urge es el período pasado.
  const anterior =
    hoy.mes === 1 ? `${hoy.anio - 1}-12` : `${hoy.anio}-${String(hoy.mes - 1).padStart(2, '0')}`;

  const marca = () => Date.now();
  let inicioDeEtapa = marca();
  const tiempos = { vencimientos: 0, iva: 0, presentaciones: 0, alertas: 0 };
  const cerrarEtapa = (nombre: keyof typeof tiempos) => {
    const ahoraMs = marca();
    tiempos[nombre] = ahoraMs - inicioDeEtapa;
    inicioDeEtapa = ahoraMs;
  };

  let vencimientosGenerados = 0;
  const sinRevisar = new Set<number>();
  for (const cual of [anterior, periodo]) {
    const resumen = await generarVencimientosDelPeriodo(
      { clientes: deps.clientes, obligaciones: deps.obligaciones, vencimientos: deps.vencimientos },
      cual,
      usuarioId,
    );
    vencimientosGenerados += resumen.creados;
    for (const anio of resumen.aniosSinRevisarFeriados) sinRevisar.add(anio);
  }
  cerrarEtapa('vencimientos');

  /*
   * El IVA se recalcula ANTES de evaluar alertas: un hallazgo nuevo tiene que
   * avisar en esta misma vuelta y no una hora más tarde. Presentar una
   * declaración con una diferencia es de las cosas que no se deshacen.
   */
  let ivaPeriodosCalculados = 0;
  let ivaHallazgosNuevos = 0;
  let ivaOcupado = false;
  if (deps.drive && deps.libroRg90) {
    const drive = deps.drive;
    const libroRg90 = deps.libroRg90;
    // Comparte el candado con el botón "Recalcular" de IVA y con la corrida
    // automática: dos cálculos a la vez duplicarían memoria y hallazgos.
    const intento = await intentarConCandado(() =>
      liquidarIvaDesdeLibros(
        {
          clientes: deps.clientes,
          librosDelCliente: (clienteId) => libroRg90.librosDelCliente(clienteId),
          drive,
          guardarLiquidacion: (datos) => libroRg90.guardarLiquidacion(datos),
          guardarHallazgos: (datos) => libroRg90.guardarHallazgos(datos),
          ultimoCalculoDelCliente: (clienteId) => libroRg90.ultimoCalculoDelCliente(clienteId),
          divisores: DIVISORES_CONFIRMADOS_POR_EFFORT,
          ahora: deps.ahora,
        },
        usuarioId,
        // Solo lo que cambió (tarea 157): releer todos los libros de todos los
        // clientes tardaba más de 10 minutos. El botón «Recalcular» de IVA sí
        // relee todo, porque quien lo aprieta lo pide.
        { soloLoQueCambio: true },
      ),
    );
    if (intento.ocupado) {
      ivaOcupado = true;
    } else {
      ivaPeriodosCalculados = intento.valor.periodosCalculados;
      ivaHallazgosNuevos = intento.valor.hallazgosNuevos;
    }
  }
  cerrarEtapa('iva');

  /*
   * Las presentaciones se detectan ANTES de evaluar alertas, por la misma
   * razón que el IVA: si la declaración ya está en OneDrive, la alerta de
   * "vencido sin presentar" no tiene que salir en esta vuelta.
   */
  let presentacionesMarcadas = 0;
  let presentadasFueraDeTermino = 0;
  if (deps.drive && deps.declaraciones) {
    const repo = deps.declaraciones;
    const drive = deps.drive;
    const detectadas = await detectarPresentaciones(
      {
        pdfsPorLeer: (limite) => repo.pdfsPorLeer(limite),
        leerArchivo: (itemId) => drive.leer(itemId),
        extraerTexto: extraerTextoDePdf,
        guardarLectura: (pdf, resultado) => repo.guardarLectura(pdf, resultado),
        presentacionesLeidas: () => repo.presentacionesLeidas(),
        vencimientosPendientes: () => repo.vencimientosPendientes(),
        marcarPresentado: async (id, fecha, evidenciaId, quien) => {
          await deps.vencimientos.marcarPresentado(id, fecha, evidenciaId, quien);
        },
        registrarEnBitacora: (entrada) =>
          deps.bitacora.registrar({
            usuarioId,
            accion: 'vencimiento.presentado',
            entidad: 'vencimiento',
            entidadId: entrada.vencimientoId,
            clienteId: entrada.clienteId,
            datosAntes: null,
            datosDespues: {
              estado: 'PRESENTADO',
              fechaPresentacion: entrada.fechaDePresentacion,
              evidenciaId: entrada.evidenciaId,
              numeroDeOrden: entrada.numeroDeOrden,
              fueraDeTermino: entrada.fueraDeTermino,
              diasDeAtraso: entrada.diasDeAtraso,
              fechaAproximada: entrada.fechaAproximada,
              disparo: `${disparo}: declaración de la DNIT encontrada en OneDrive`,
            },
            ipTruncada: null,
            agenteUsuario: null,
            peticionId: null,
          }),
      },
      usuarioId,
    );
    presentacionesMarcadas = detectadas.vencimientosMarcados;
    presentadasFueraDeTermino = detectadas.fueraDeTermino;
  }
  cerrarEtapa('presentaciones');

  const alertas = await evaluarAlertas(
    {
      alertas: deps.alertas,
      vencimientos: deps.vencimientos,
      procesoMensual: deps.procesoMensual,
      riesgoDeLibro: { porPeriodo: async () => deps.libroRg90?.riesgoPorPeriodo() ?? [] },
      declaracionesAjenas: deps.declaracionesAjenas ?? undefined,
    },
    deps.ahora(),
    periodo,
    usuarioId,
  );

  return {
    periodo,
    vencimientosGenerados,
    aniosSinRevisarFeriados: [...sinRevisar],
    ivaPeriodosCalculados,
    ivaHallazgosNuevos,
    ivaOcupado,
    presentacionesMarcadas,
    presentadasFueraDeTermino,
    alertasCreadas: alertas.creadas,
    alertasActualizadas: alertas.actualizadas,
    alertasResueltas: alertas.resueltas,
    tiemposMs: (cerrarEtapa('alertas'), tiempos),
  };
}
