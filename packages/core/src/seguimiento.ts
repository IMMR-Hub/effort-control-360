/**
 * Seguimiento al cliente: recordatorios, escalamiento y constancia de gestión.
 *
 * Resuelve dos problemas distintos que se apoyan en los mismos datos:
 *
 * 1. Perseguir la entrega de documentación sin que nadie tenga que acordarse.
 * 2. Poder demostrar, meses después, que se persiguió. Cuando un cliente llama
 *    a reclamar que no se le hizo la contabilidad, EFFORT necesita mostrar
 *    cuándo se le pidió, por qué vía, quién atendió y qué contestó.
 *
 * Por eso todo intento de contacto queda registrado, incluidos los automáticos,
 * y por eso un contacto registrado no se puede editar libremente: es evidencia.
 */

import {
  proximoDiaHabil,
  sumarDiasHabiles,
  type CalendarioHabil,
} from './diasHabiles.js';
import { diasEntre, fechaCivilAIso, type FechaCivil, type Periodo } from './fechas.js';

/* ------------------------------------------------------------------------- */
/* Bitácora de contactos                                                      */
/* ------------------------------------------------------------------------- */

export type CanalContacto = 'LLAMADA' | 'MENSAJE' | 'WHATSAPP' | 'CORREO' | 'PRESENCIAL';

export type DireccionContacto = 'SALIENTE' | 'ENTRANTE';

/**
 * Un contacto AUTOMATICO lo generó el sistema al enviar un correo; su evidencia
 * es el log de envío. Uno MANUAL lo cargó una persona después de llamar o
 * escribir por WhatsApp. La distinción importa ante un reclamo: el automático
 * es verificable contra el servidor de correo, el manual es un testimonio
 * fechado de un empleado identificado.
 */
export type OrigenContacto = 'AUTOMATICO' | 'MANUAL';

export interface RegistroContacto {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: Periodo;
  /** Solicitud de documentación a la que responde este contacto, si aplica. */
  readonly solicitudId: string | null;
  readonly canal: CanalContacto;
  readonly direccion: DireccionContacto;
  readonly origen: OrigenContacto;
  /** Instante exacto del contacto. Se muestra en hora de Paraguay. */
  readonly ocurridoEn: Date;
  /** Usuario de EFFORT que hizo o registró el contacto. */
  readonly registradoPorUsuarioId: string;
  /** Si del otro lado contestaron. Es el dato que decide si hubo gestión efectiva. */
  readonly huboRespuesta: boolean;
  /** Nombre de quien atendió del lado del cliente. Vacío si no atendió nadie. */
  readonly quienAtendio: string | null;
  readonly resumen: string;
  /** Captura de WhatsApp, PDF del correo, grabación: lo que respalde el registro. */
  readonly evidenciaId: string | null;
}

export class ErrorDeSeguimiento extends Error {
  override readonly name = 'ErrorDeSeguimiento';
}

/**
 * Valida un registro antes de guardarlo.
 *
 * Un contacto con respuesta tiene que decir quién atendió: "llamé y me
 * atendieron" sin nombre no sirve como constancia ante un reclamo, que es
 * exactamente para lo que existe este registro.
 */
export function validarRegistroContacto(registro: RegistroContacto): void {
  if (registro.huboRespuesta && !registro.quienAtendio?.trim()) {
    throw new ErrorDeSeguimiento(
      'Un contacto con respuesta debe indicar quién atendió: sin ese dato no sirve como constancia.',
    );
  }

  if (!registro.huboRespuesta && registro.quienAtendio?.trim()) {
    throw new ErrorDeSeguimiento(
      'Se indicó quién atendió pero el contacto figura como sin respuesta. Corregí una de las dos cosas.',
    );
  }

  if (!registro.registradoPorUsuarioId.trim()) {
    throw new ErrorDeSeguimiento('Todo contacto debe quedar atribuido a un usuario identificado.');
  }

  if (registro.origen === 'MANUAL' && !registro.resumen.trim()) {
    throw new ErrorDeSeguimiento('Un contacto cargado a mano debe describir qué se habló.');
  }
}

/* ------------------------------------------------------------------------- */
/* Reglas de notificación configurables                                       */
/* ------------------------------------------------------------------------- */

export type EventoDisparador =
  | 'DOCUMENTACION_NO_ENTREGADA'
  | 'VENCIMIENTO_PROXIMO'
  | 'BALANCE_OBSERVADO'
  | 'BALANCE_LISTO_PARA_REVISION'
  | 'LIQUIDACION_NO_ENVIADA'
  | 'LIQUIDACION_SIN_CONFIRMAR'
  | 'DIFERENCIAS_CON_SIGA'
  | 'CLIENTE_SIN_RESPUESTA';

export type TipoDestinatario =
  | 'CLIENTE'
  | 'RESPONSABLE_DEL_CLIENTE'
  | 'COORDINADOR_DEL_CLIENTE'
  | 'ROL'
  | 'USUARIO'
  | 'CORREO_LIBRE';

export interface Destinatario {
  readonly tipo: TipoDestinatario;
  /** Nombre del rol, id del usuario o dirección de correo, según el tipo. */
  readonly valor: string | null;
}

export interface ReglaNotificacion {
  readonly id: string;
  readonly nombre: string;
  readonly activa: boolean;
  readonly evento: EventoDisparador;

  /** Plazo que se le da al cliente, en días hábiles, desde el inicio del conteo. */
  readonly diasHabilesDePlazo: number;
  /** Hora local de Paraguay a la que sale el aviso. Formato "HH:MM". */
  readonly horaDeEnvio: string;
  /** Cada cuántos días hábiles se insiste mientras no haya respuesta. */
  readonly reintentarCadaDiasHabiles: number;
  /** Después de esta cantidad de recordatorios, el sistema deja de insistir solo. */
  readonly maximoRecordatorios: number;
  /**
   * A partir de qué número de recordatorio se suma a los dueños de EFFORT.
   * Con valor 3, el tercer aviso ya va con copia a dirección.
   */
  readonly escalarAPartirDelRecordatorio: number;

  readonly destinatariosIniciales: readonly Destinatario[];
  readonly destinatariosDeEscalamiento: readonly Destinatario[];
  readonly plantillaId: string;
}

export function validarReglaNotificacion(regla: ReglaNotificacion): void {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(regla.horaDeEnvio)) {
    throw new ErrorDeSeguimiento(`Hora de envío inválida: "${regla.horaDeEnvio}". Se espera HH:MM.`);
  }
  if (regla.reintentarCadaDiasHabiles < 1) {
    throw new ErrorDeSeguimiento('El reintento debe ser de al menos un día hábil.');
  }
  if (regla.maximoRecordatorios < 1) {
    throw new ErrorDeSeguimiento('La regla debe permitir al menos un recordatorio.');
  }
  if (regla.escalarAPartirDelRecordatorio < 1) {
    throw new ErrorDeSeguimiento('El escalamiento debe partir del recordatorio 1 o posterior.');
  }
  if (regla.destinatariosIniciales.length === 0) {
    throw new ErrorDeSeguimiento('La regla debe tener al menos un destinatario inicial.');
  }
}

/* ------------------------------------------------------------------------- */
/* Solicitud de documentación y planificación de recordatorios                */
/* ------------------------------------------------------------------------- */

export type EstadoSolicitud =
  | 'ABIERTA'
  | 'RESPONDIDA_SIN_ENTREGA'
  | 'ENTREGADA'
  | 'ESCALADA'
  | 'AGOTADA'
  | 'CERRADA_MANUALMENTE';

export interface SolicitudDocumentacion {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: Periodo;
  readonly estado: EstadoSolicitud;
  /** Fecha desde la que corre el plazo en días hábiles. */
  readonly cuentaDesde: FechaCivil;
  /** Recordatorios automáticos ya enviados. */
  readonly recordatoriosEnviados: number;
  /** Fecha del último recordatorio enviado, si hubo alguno. */
  readonly ultimoRecordatorioEn: FechaCivil | null;
}

export interface PlanDeEnvio {
  readonly solicitudId: string;
  readonly clienteId: string;
  /** Número de recordatorio que corresponde enviar: 1 es el primero. */
  readonly numeroDeRecordatorio: number;
  readonly fecha: FechaCivil;
  readonly hora: string;
  readonly destinatarios: readonly Destinatario[];
  /** True cuando este envío ya lleva copia a los dueños de EFFORT. */
  readonly esEscalamiento: boolean;
  readonly plantillaId: string;
}

/** Fecha límite de entrega según el plazo en días hábiles de la regla. */
export function fechaLimiteDeEntrega(
  solicitud: SolicitudDocumentacion,
  regla: ReglaNotificacion,
  calendario: CalendarioHabil,
): FechaCivil {
  return sumarDiasHabiles(solicitud.cuentaDesde, regla.diasHabilesDePlazo, calendario);
}

/**
 * Calcula el próximo recordatorio que corresponde a una solicitud.
 *
 * Devuelve `null` cuando no hay que enviar nada: la solicitud se cerró, el
 * cliente entregó, o ya se agotaron los recordatorios configurados. Que el
 * sistema deje de insistir es deliberado: pasado ese punto el problema dejó de
 * ser de recordatorios y pasa a ser una decisión comercial de EFFORT.
 */
export function planificarProximoRecordatorio(
  solicitud: SolicitudDocumentacion,
  regla: ReglaNotificacion,
  calendario: CalendarioHabil,
): PlanDeEnvio | null {
  if (!regla.activa) return null;

  const estadosCerrados: readonly EstadoSolicitud[] = [
    'ENTREGADA',
    'CERRADA_MANUALMENTE',
    'AGOTADA',
  ];
  if (estadosCerrados.includes(solicitud.estado)) return null;

  const numeroDeRecordatorio = solicitud.recordatoriosEnviados + 1;
  if (numeroDeRecordatorio > regla.maximoRecordatorios) return null;

  const fecha = fechaDelRecordatorio(solicitud, regla, calendario, numeroDeRecordatorio);
  const esEscalamiento = numeroDeRecordatorio >= regla.escalarAPartirDelRecordatorio;

  return {
    solicitudId: solicitud.id,
    clienteId: solicitud.clienteId,
    numeroDeRecordatorio,
    fecha,
    hora: regla.horaDeEnvio,
    destinatarios: esEscalamiento
      ? [...regla.destinatariosIniciales, ...regla.destinatariosDeEscalamiento]
      : regla.destinatariosIniciales,
    esEscalamiento,
    plantillaId: regla.plantillaId,
  };
}

function fechaDelRecordatorio(
  solicitud: SolicitudDocumentacion,
  regla: ReglaNotificacion,
  calendario: CalendarioHabil,
  numeroDeRecordatorio: number,
): FechaCivil {
  // El primer recordatorio sale el día hábil siguiente al vencimiento del plazo:
  // avisar el mismo día que vence sería avisar cuando todavía está en término.
  if (numeroDeRecordatorio === 1 || !solicitud.ultimoRecordatorioEn) {
    const limite = fechaLimiteDeEntrega(solicitud, regla, calendario);
    return sumarDiasHabiles(limite, 1, calendario);
  }

  return sumarDiasHabiles(
    solicitud.ultimoRecordatorioEn,
    regla.reintentarCadaDiasHabiles,
    calendario,
  );
}

/** True si al plan le corresponde salir hoy o antes: es lo que consulta el job de envíos. */
export function correspondeEnviar(plan: PlanDeEnvio, hoy: FechaCivil): boolean {
  return diasEntre(plan.fecha, hoy) >= 0;
}

/* ------------------------------------------------------------------------- */
/* Constancia de gestión                                                      */
/* ------------------------------------------------------------------------- */

export interface ConstanciaDeGestion {
  readonly clienteId: string;
  readonly periodo: Periodo;
  readonly totalDeContactos: number;
  readonly contactosPorCanal: Readonly<Record<CanalContacto, number>>;
  readonly contactosAutomaticos: number;
  readonly contactosManuales: number;
  readonly vecesQueRespondieron: number;
  readonly personasQueAtendieron: readonly string[];
  readonly primerContacto: Date | null;
  readonly ultimoContacto: Date | null;
  /** Días corridos entre el primer y el último intento. */
  readonly diasDeGestion: number;
  /**
   * Resumen en una línea, pensado para encabezar el PDF que se le muestra
   * al cliente que reclama.
   */
  readonly sintesis: string;
}

/**
 * Arma la constancia de gestión de un cliente en un período.
 *
 * Es la respuesta a "ustedes nunca me pidieron nada": cuántas veces se
 * intentó, por qué vías, en qué fechas, y cuántas de esas veces el cliente
 * efectivamente contestó.
 */
export function armarConstanciaDeGestion(
  clienteId: string,
  periodo: Periodo,
  contactos: readonly RegistroContacto[],
): ConstanciaDeGestion {
  const propios = contactos
    .filter((contacto) => contacto.clienteId === clienteId)
    .filter(
      (contacto) =>
        contacto.periodo.anio === periodo.anio && contacto.periodo.mes === periodo.mes,
    )
    .slice()
    .sort((a, b) => a.ocurridoEn.getTime() - b.ocurridoEn.getTime());

  const porCanal: Record<CanalContacto, number> = {
    LLAMADA: 0,
    MENSAJE: 0,
    WHATSAPP: 0,
    CORREO: 0,
    PRESENCIAL: 0,
  };
  for (const contacto of propios) {
    porCanal[contacto.canal] += 1;
  }

  const salientes = propios.filter((contacto) => contacto.direccion === 'SALIENTE');
  const conRespuesta = propios.filter((contacto) => contacto.huboRespuesta);

  const personas = [
    ...new Set(
      conRespuesta
        .map((contacto) => contacto.quienAtendio?.trim())
        .filter((nombre): nombre is string => Boolean(nombre)),
    ),
  ];

  const primero = propios[0]?.ocurridoEn ?? null;
  const ultimo = propios[propios.length - 1]?.ocurridoEn ?? null;

  const diasDeGestion =
    primero && ultimo
      ? Math.round((ultimo.getTime() - primero.getTime()) / 86_400_000)
      : 0;

  return {
    clienteId,
    periodo,
    totalDeContactos: propios.length,
    contactosPorCanal: porCanal,
    contactosAutomaticos: propios.filter((c) => c.origen === 'AUTOMATICO').length,
    contactosManuales: propios.filter((c) => c.origen === 'MANUAL').length,
    vecesQueRespondieron: conRespuesta.length,
    personasQueAtendieron: personas,
    primerContacto: primero,
    ultimoContacto: ultimo,
    diasDeGestion,
    sintesis: redactarSintesis(salientes.length, conRespuesta.length, diasDeGestion),
  };
}

function redactarSintesis(intentos: number, respuestas: number, dias: number): string {
  if (intentos === 0) {
    return 'No se registran intentos de contacto para este cliente y período.';
  }

  const cuerpo =
    `Se registran ${intentos} intento(s) de contacto a lo largo de ${dias} día(s), ` +
    `con ${respuestas} respuesta(s) del cliente.`;

  return respuestas === 0
    ? `${cuerpo} El cliente no respondió a ninguno de los intentos.`
    : cuerpo;
}

/**
 * Días desde el último contacto. Alimenta el orden de "a quién hay que llamar hoy":
 * el que hace más tiempo que no contesta va primero.
 */
export function diasSinContacto(
  contactos: readonly RegistroContacto[],
  hoy: FechaCivil,
): number | null {
  if (contactos.length === 0) return null;

  const ultimo = contactos.reduce((masReciente, contacto) =>
    contacto.ocurridoEn > masReciente.ocurridoEn ? contacto : masReciente,
  );

  const fechaUltimo = fechaCivilAIso({
    anio: ultimo.ocurridoEn.getUTCFullYear(),
    mes: ultimo.ocurridoEn.getUTCMonth() + 1,
    dia: ultimo.ocurridoEn.getUTCDate(),
  });

  const [anio, mes, dia] = fechaUltimo.split('-').map(Number) as [number, number, number];
  return diasEntre({ anio, mes, dia }, hoy);
}

/** Día hábil siguiente a la hora configurada: cuándo saldría un aviso disparado hoy. */
export function proximaVentanaDeEnvio(
  desde: FechaCivil,
  regla: ReglaNotificacion,
  calendario: CalendarioHabil,
): { fecha: FechaCivil; hora: string } {
  return { fecha: proximoDiaHabil(desde, calendario), hora: regla.horaDeEnvio };
}
