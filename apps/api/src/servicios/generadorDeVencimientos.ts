/**
 * Generación de vencimientos a partir del calendario tributario.
 *
 * Esto es lo que le faltaba al sistema: la tabla `vencimiento` existía desde el
 * principio, pero no había nada que la llenara — había que cargar cada
 * vencimiento a mano, cliente por cliente y mes por mes, que es exactamente el
 * trabajo que EFFORT quería dejar de hacer.
 *
 * El cálculo de la fecha no vive acá sino en `@effort/core`
 * (`vencimientosTributarios.ts`), sin acceso a la base ni a la red, para poder
 * probarlo con casos de borde reales. Este archivo solo decide A QUIÉN le
 * corresponde qué, y deja el resultado guardado.
 *
 * Es seguro de repetir: la restricción única `(cliente, obligación, período)`
 * hace que volver a generar un período ya generado no duplique nada.
 */

import {
  crearCalendario,
  fechaDeVencimiento,
  feriadosParaguay,
  periodoDesdeTexto,
  revisionDeFeriados,
  type DiasPorTerminacion,
  type Periodo,
} from '@effort/core';

import type {
  AltaDeVencimientoGenerado,
  ObligacionAlmacenada,
  ObligacionDeClienteAlmacenada,
  RepositorioDeObligaciones,
  RepositorioDeVencimientos,
} from '../puertos-dominio.js';
import type { ClienteListado, RepositorioDeClientes } from '../puertos.js';

export interface DependenciasDelGenerador {
  readonly clientes: RepositorioDeClientes;
  readonly obligaciones: RepositorioDeObligaciones;
  readonly vencimientos: RepositorioDeVencimientos;
}

/** Por qué un cliente y una obligación no produjeron vencimiento. */
export interface Omision {
  readonly cliente: string;
  readonly obligacion: string;
  readonly motivo: string;
}

export interface ResumenDeGeneracion {
  readonly periodo: string;
  readonly creados: number;
  readonly yaExistian: number;
  readonly omitidos: readonly Omision[];
  /**
   * Años cuyo calendario de feriados nunca se revisó, de los que este cálculo
   * depende.
   *
   * Los feriados paraguayos no son un dato que se carga una vez: los móviles se
   * trasladan por decreto y los extraordinarios aparecen durante el año. Daniel
   * definió el 2026-09-12 que hay que revisarlos **cada mes, o cuando el
   * gobierno los confirme oficialmente**.
   *
   * Que un año esté acá no invalida el cálculo: sin traslados cargados se usan
   * las fechas originales, y eso hace que el sistema avise ANTES, nunca después.
   * Pero tiene que verse, en vez de depender de que alguien se acuerde.
   */
  readonly aniosSinRevisarFeriados: readonly number[];
}

/**
 * Una obligación anual del ejercicio AAAA se genera al pedir el período
 * AAAA-12, no en cada uno de los doce meses. Generar la declaración anual doce
 * veces sería ruido que tapa lo que sí vence este mes.
 */
function correspondeAlPeriodo(obligacion: ObligacionAlmacenada, periodo: Periodo): boolean {
  return obligacion.periodicidad === 'MENSUAL' || periodo.mes === 12;
}

/** ¿Estaba el cliente obligado durante el período que se liquida? */
function vigenteEnElPeriodo(
  asignacion: ObligacionDeClienteAlmacenada,
  periodo: Periodo,
): boolean {
  const primerDia = Date.UTC(periodo.anio, periodo.mes - 1, 1);
  const ultimoDia = Date.UTC(periodo.anio, periodo.mes, 0);

  if (asignacion.desde.getTime() > ultimoDia) return false;
  if (asignacion.hasta !== null && asignacion.hasta.getTime() < primerDia) return false;

  return true;
}

function esCalendarioUsable(dias: readonly number[]): dias is DiasPorTerminacion {
  return dias.length === 10;
}

export async function generarVencimientosDelPeriodo(
  deps: DependenciasDelGenerador,
  periodoTexto: string,
  usuarioId: string,
): Promise<ResumenDeGeneracion> {
  const periodo = periodoDesdeTexto(periodoTexto);

  const [clientes, obligaciones, asignaciones] = await Promise.all([
    deps.clientes.listar(null),
    deps.obligaciones.listarGenerables(),
    deps.obligaciones.asignacionesDeClientes(),
  ]);

  // Los feriados del año del período y del siguiente: un vencimiento de
  // diciembre se presenta en enero, y sin los feriados del año que viene el
  // corrimiento a día hábil se calcularía mal justo ahí.
  const calendario = crearCalendario([
    ...feriadosParaguay(periodo.anio),
    ...feriadosParaguay(periodo.anio + 1),
  ]);

  const clientesPorId = new Map<string, ClienteListado>(clientes.map((c) => [c.id, c]));
  const obligacionesPorId = new Map(obligaciones.map((o) => [o.id, o]));

  const altas: AltaDeVencimientoGenerado[] = [];
  const omitidos: Omision[] = [];

  for (const asignacion of asignaciones) {
    const obligacion = obligacionesPorId.get(asignacion.obligacionId);
    const cliente = clientesPorId.get(asignacion.clienteId);

    // Sin obligación generable (no confirmada o inactiva) no hay nada que
    // reportar: es una decisión deliberada, no una falla.
    if (!obligacion) continue;
    if (!cliente) continue;

    if (!cliente.activo) {
      omitidos.push({
        cliente: cliente.nombre,
        obligacion: obligacion.codigo,
        motivo: 'El cliente está dado de baja.',
      });
      continue;
    }

    if (!correspondeAlPeriodo(obligacion, periodo)) continue;
    if (!vigenteEnElPeriodo(asignacion, periodo)) continue;

    if (!esCalendarioUsable(obligacion.diasPorTerminacionRuc)) {
      omitidos.push({
        cliente: cliente.nombre,
        obligacion: obligacion.codigo,
        motivo:
          'El calendario de la obligación no tiene los 10 días (uno por terminación de RUC).',
      });
      continue;
    }

    // Un RUC ilegible o un calendario con un día imposible tienen que frenar
    // SOLO a ese cliente. Que un dato mal cargado impida generar los
    // vencimientos de los otros cuatro es peor que el dato mal cargado.
    try {
      const fecha = fechaDeVencimiento({
        ruc: cliente.ruc,
        periodo,
        periodicidad: obligacion.periodicidad,
        mesDeCierreAnual: obligacion.mesDeCierreAnual,
        diasPorTerminacion: obligacion.diasPorTerminacionRuc,
        calendario,
      });

      altas.push({
        clienteId: cliente.id,
        obligacionId: obligacion.id,
        periodo: periodoTexto,
        tipoDocumento: obligacion.codigo,
        descripcion: `${obligacion.nombre} — período ${periodoTexto}`,
        entidad: obligacion.entidad,
        fechaEmision: null,
        fechaVencimiento: new Date(Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia)),
        responsableId: null,
        riesgo: 'MEDIO',
        evidenciaId: null,
        proximaAccion: null,
        creadoPorUsuarioId: usuarioId,
      });
    } catch (error) {
      omitidos.push({
        cliente: cliente.nombre,
        obligacion: obligacion.codigo,
        motivo: error instanceof Error ? error.message : 'No se pudo calcular la fecha.',
      });
    }
  }

  const creados = await deps.vencimientos.registrarGenerados(altas);

  return {
    periodo: periodoTexto,
    creados,
    yaExistian: altas.length - creados,
    omitidos,
    aniosSinRevisarFeriados: [periodo.anio, periodo.anio + 1].filter(
      (anio) => revisionDeFeriados(anio) === null,
    ),
  };
}
