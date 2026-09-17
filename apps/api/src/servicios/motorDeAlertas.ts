/**
 * Motor de alertas: convierte el estado real del sistema en avisos accionables.
 *
 * Hasta el 2026-09-10 esto no existía. La tabla `alerta` estaba desde el
 * principio, la pantalla también, y el repositorio sabía listarlas y cerrarlas
 * — pero no había forma de crear una. Nadie lo había notado porque una pantalla
 * de alertas vacía se parece mucho a "no hay nada que avisar".
 *
 * Las reglas de acá no inventan criterios nuevos: reusan los umbrales que ya
 * usa el radar de vencimientos (`nivelAlertaPorDias` de `@effort/core`), para
 * que la pantalla de Vencimientos y la de Alertas no puedan contradecirse.
 *
 * Es seguro de correr muchas veces: el índice único parcial de la base impide
 * dos alertas abiertas del mismo origen sobre la misma entidad.
 */

import {
  diasRestantes,
  fechaCivilDesdeIso,
  nivelAlertaPorDias,
  type NivelAlerta,
} from '@effort/core';

import type {
  AltaDeAlerta,
  RepositorioDeAlertas,
  RepositorioDeProcesoMensual,
  RepositorioDeVencimientos,
} from '../puertos-dominio.js';

export interface DependenciasDelMotorDeAlertas {
  readonly alertas: RepositorioDeAlertas;
  readonly vencimientos: RepositorioDeVencimientos;
  readonly procesoMensual: RepositorioDeProcesoMensual;
  /**
   * Comprobantes con riesgo de multa, agrupados por cliente y período.
   *
   * Se pide agrupado y no fila por fila a propósito. En los datos reales del
   * piloto hay 49 comprobantes con riesgo: una alerta por cada uno serían 49
   * líneas nuevas en la pantalla, y una pantalla con 49 alertas del mismo tipo
   * es una pantalla que nadie mira — que es exactamente el problema que este
   * motor existe para evitar.
   */
  readonly riesgoDeLibro: RepositorioDeRiesgoDeLibro;
}

/** Resumen de lo que hay que revisar en el libro de un cliente y período. */
export interface RiesgoDeLibroPorPeriodo {
  readonly clienteId: string;
  readonly periodo: string;
  /**
   * La liquidación de ese período, que es la entidad con la que se relaciona
   * la alerta.
   *
   * Hace falta porque `entidad_relacionada_id` es una columna UUID y la única
   * que evita alertas repetidas es `(origen, entidad_relacionada_id)`. El
   * primer intento armó una clave compuesta `clienteId|periodo` y Postgres la
   * rechazó: no es un UUID. Los tests no lo agarraron porque el doble no valida
   * el tipo — solo la base real lo hace.
   *
   * La liquidación del período ya ES esa entidad, con su propio identificador.
   * No hacía falta inventar una clave: había que mirar mejor el modelo.
   */
  readonly liquidacionId: string;
  readonly comprobantes: number;
  /** Cuánto IVA está en juego, en valor absoluto. */
  readonly ivaEnRiesgo: bigint;
}

export interface RepositorioDeRiesgoDeLibro {
  porPeriodo(): Promise<readonly RiesgoDeLibroPorPeriodo[]>;
}

/**
 * Usuario al que se le atribuye un cierre automático.
 *
 * Se deja explícito en la bitácora que cerró el sistema y no una persona: una
 * alerta cerrada por alguien y una que se resolvió sola son cosas distintas
 * cuando después hay que rendir cuentas.
 */
const CERRADA_POR_EL_SISTEMA = 'El problema que la originó ya no existe.';

export interface ResumenDeAlertas {
  readonly creadas: number;
  readonly yaEstabanAbiertas: number;
  readonly evaluadas: number;
  /** Cerradas solas porque el problema que las originó ya no existe. */
  readonly resueltas: number;
}

export const ORIGEN_VENCIMIENTO = 'vencimiento_por_vencer';
export const ORIGEN_DOCUMENTACION = 'documentacion_faltante';
/**
 * Comprobantes del libro cuyo IVA declarado no coincide con la regla.
 *
 * Daniel, 2026-09-13: *"estas discrepancias también tienen que alertar, ya que
 * al final puede representar una multa administrativa"*. El monto en juego es
 * chico —decenas de guaraníes en todo el piloto— y decirlo es parte del aviso:
 * el problema no es la plata, es que la DNIT cruza estos datos contra los del
 * proveedor y una diferencia dispara una revisión.
 */
export const ORIGEN_LIBRO_RIESGO = 'libro_con_riesgo_de_multa';

/**
 * Desde qué período se alerta sobre los libros.
 *
 * Desde la tarea 141 el sistema lee planillas de 2022 en adelante (COPESA), y
 * sin un límite cada diferencia de un libro de hace cuatro años abría una alerta
 * CRITICA. El sistema opera desde 2025 (las carteras de clientes empiezan el
 * 2025-01-01). El valor está pendiente de confirmar con EFFORT (plan maestro,
 * pregunta P5); los libros anteriores se siguen calculando y mostrando en la
 * pantalla de IVA, solo no alertan.
 */
export const PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO = '2025-01';

/**
 * Motivo de cierre de una alerta de libro que quedó fuera del período vigilado.
 * No es "el problema ya no existe": el problema puede seguir ahí, y decir lo
 * contrario sería falso en la bitácora.
 */
const CERRADA_FUERA_DE_PERIODO =
  `El período es anterior a ${PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO}: sobre esos libros ya no se alerta. ` +
  'Las diferencias siguen visibles en la pantalla de IVA.';

/**
 * Un vencimiento solo levanta alerta cuando entra en zona de riesgo.
 *
 * `INFORMATIVA` y `SIN_ALERTA` no generan nada: avisar de algo que vence en 25
 * días, todos los días, es la forma más rápida de que la gente deje de mirar
 * las alertas — y entonces tampoco ve la que sí importaba.
 */
const CRITICIDAD_POR_NIVEL: Partial<Record<NivelAlerta, string>> = {
  VENCIDO: 'CRITICA',
  CRITICA: 'CRITICA',
  ALTA: 'ALTA',
  MEDIA: 'MEDIA',
};

function fechaAIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export async function evaluarAlertas(
  deps: DependenciasDelMotorDeAlertas,
  ahora: Date,
  periodo: string,
  usuarioId: string,
): Promise<ResumenDeAlertas> {
  const [vencimientos, procesos, abiertas, riesgos] = await Promise.all([
    deps.vencimientos.listar(null),
    deps.procesoMensual.listar(periodo, null),
    deps.alertas.listar(null),
    deps.riesgoDeLibro.porPeriodo(),
  ]);

  // Clave de lo que ya está abierto, para no recontar como "creada" algo que
  // la base va a saltar igual. La base es la que garantiza que no se duplique;
  // esto solo hace que el resumen que ve la persona sea honesto.
  const yaAbiertas = new Set(
    abiertas.map((alerta) => `${alerta.origen}|${alerta.entidadRelacionadaId ?? ''}`),
  );

  const candidatas: AltaDeAlerta[] = [];

  for (const vencimiento of vencimientos) {
    /*
     * Lo ya presentado no alerta. El repositorio ya lo filtra, así que esta
     * línea parece redundante — y sin embargo hace falta.
     *
     * El texto de la alerta AFIRMA "todavía no está registrado como
     * presentado". Una afirmación así no puede depender de que un repositorio,
     * en otro archivo, se acuerde de filtrar: el día que alguien agregue otra
     * forma de traer vencimientos, el motor empezaría a decirle a EFFORT que no
     * presentó algo que sí presentó. La regla vive donde se afirma, y acá tiene
     * un test que la fija.
     */
    if (vencimiento.estado === 'PRESENTADO' || vencimiento.estado === 'NO_APLICA') continue;

    const dias = diasRestantes(fechaCivilDesdeIso(fechaAIso(vencimiento.fechaVencimiento)), ahora);
    const criticidad = CRITICIDAD_POR_NIVEL[nivelAlertaPorDias(dias)];
    if (!criticidad) continue;

    const vencido = dias < 0;
    candidatas.push({
      clienteId: vencimiento.clienteId,
      periodo: null,
      origen: ORIGEN_VENCIMIENTO,
      criticidad,
      titulo: vencido
        ? `Vencido sin presentar: ${vencimiento.descripcion}`
        : `Vence en ${dias} día${dias === 1 ? '' : 's'}: ${vencimiento.descripcion}`,
      detalle: vencido
        ? `Venció el ${fechaAIso(vencimiento.fechaVencimiento)} ante ${vencimiento.entidad} ` +
          `y todavía no está registrado como presentado.`
        : `Vence el ${fechaAIso(vencimiento.fechaVencimiento)} ante ${vencimiento.entidad}.`,
      entidadRelacionada: 'vencimiento',
      entidadRelacionadaId: vencimiento.id,
      fechaLimite: vencimiento.fechaVencimiento,
    });
  }

  for (const proceso of procesos) {
    if (proceso.documentosFaltantes <= 0) continue;

    candidatas.push({
      clienteId: proceso.clienteId,
      periodo: proceso.periodo,
      origen: ORIGEN_DOCUMENTACION,
      criticidad: proceso.documentosFaltantes > 5 ? 'ALTA' : 'MEDIA',
      titulo: `Faltan ${proceso.documentosFaltantes} documentos del período ${proceso.periodo}`,
      detalle:
        `El proceso mensual de ${proceso.periodo} registra ${proceso.documentosFaltantes} ` +
        `documentos faltantes. Sin ellos no se puede cerrar la liquidación del período.`,
      entidadRelacionada: 'proceso_mensual',
      entidadRelacionadaId: proceso.id,
      fechaLimite: null,
    });
  }

  /*
   * Una alerta por cliente y período, no una por comprobante.
   *
   * Va en CRITICA porque una multa administrativa lo es, y porque la ventana
   * para corregir se cierra cuando se presenta la declaración: después ya no se
   * arregla, se rectifica.
   */
  for (const riesgo of riesgos) {
    if (riesgo.comprobantes <= 0) continue;
    if (riesgo.periodo < PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO) continue;

    const plural = riesgo.comprobantes === 1 ? 'comprobante' : 'comprobantes';
    candidatas.push({
      clienteId: riesgo.clienteId,
      periodo: riesgo.periodo,
      origen: ORIGEN_LIBRO_RIESGO,
      criticidad: 'CRITICA',
      titulo:
        `${riesgo.comprobantes} ${plural} con riesgo de multa en el libro de ${riesgo.periodo}`,
      detalle:
        `El IVA declarado en ${riesgo.comprobantes} ${plural} no coincide con el que ` +
        `corresponde por la regla (Gs. ${riesgo.ivaEnRiesgo} en juego). Revisalos: si el ` +
        'período todavía no se presentó, antes de presentarlo; si ya se presentó, puede hacer ' +
        'falta una rectificativa. La DNIT cruza estos datos contra los del proveedor, y una diferencia ' +
        'dispara una revisión que cuesta mucho más que la diferencia. En la pantalla de IVA ' +
        'cada uno se acepta con motivo o se manda a revisar; la alerta se cierra sola cuando ' +
        'todos están aceptados.',
      entidadRelacionada: 'liquidacion_iva_rg90',
      entidadRelacionadaId: riesgo.liquidacionId,
      fechaLimite: null,
    });
  }

  const nuevas = candidatas.filter(
    (alta) => !yaAbiertas.has(`${alta.origen}|${alta.entidadRelacionadaId ?? ''}`),
  );

  const creadas = await deps.alertas.crear(nuevas);

  /*
   * Cierre automático: una alerta abierta cuya causa ya no aparece entre las
   * candidatas es una alerta resuelta.
   *
   * Esto es lo que reemplaza al "ignorar". Daniel fue explícito el 2026-09-11:
   * el sistema NUNCA puede dejar que se ignore una alerta. La única forma de
   * sacarla de la pantalla es que el problema deje de existir — que el
   * vencimiento quede presentado, o que los documentos faltantes se carguen.
   * Entonces se cierra sola, acá, y queda escrito por qué.
   */
  const vigentes = new Set(
    candidatas.map((alta) => `${alta.origen}|${alta.entidadRelacionadaId ?? ''}`),
  );

  let resueltas = 0;
  for (const alerta of abiertas) {
    // Solo las que levanta este motor. Una alerta de otro origen no se toca:
    // no se sabe qué la resuelve.
    if (
      alerta.origen !== ORIGEN_VENCIMIENTO &&
      alerta.origen !== ORIGEN_DOCUMENTACION &&
      alerta.origen !== ORIGEN_LIBRO_RIESGO
    ) {
      continue;
    }

    const clave = `${alerta.origen}|${alerta.entidadRelacionadaId ?? ''}`;
    if (vigentes.has(clave)) continue;

    const fueraDePeriodo =
      alerta.origen === ORIGEN_LIBRO_RIESGO &&
      alerta.periodo !== null &&
      alerta.periodo < PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO;
    await deps.alertas.cerrar(
      alerta.id,
      fueraDePeriodo ? CERRADA_FUERA_DE_PERIODO : CERRADA_POR_EL_SISTEMA,
      usuarioId,
      ahora,
    );
    resueltas += 1;
  }

  return {
    creadas,
    yaEstabanAbiertas: candidatas.length - creadas,
    evaluadas: vencimientos.length + procesos.length + riesgos.length,
    resueltas,
  };
}
