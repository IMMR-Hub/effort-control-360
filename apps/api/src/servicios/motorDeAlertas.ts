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
  const [vencimientos, procesos, abiertas] = await Promise.all([
    deps.vencimientos.listar(null),
    deps.procesoMensual.listar(periodo, null),
    deps.alertas.listar(null),
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
    if (alerta.origen !== ORIGEN_VENCIMIENTO && alerta.origen !== ORIGEN_DOCUMENTACION) continue;

    const clave = `${alerta.origen}|${alerta.entidadRelacionadaId ?? ''}`;
    if (vigentes.has(clave)) continue;

    await deps.alertas.cerrar(alerta.id, CERRADA_POR_EL_SISTEMA, usuarioId, ahora);
    resueltas += 1;
  }

  return {
    creadas,
    yaEstabanAbiertas: candidatas.length - creadas,
    evaluadas: vencimientos.length + procesos.length,
    resueltas,
  };
}
