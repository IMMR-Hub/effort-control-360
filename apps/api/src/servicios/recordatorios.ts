/**
 * Despachador de recordatorios de seguimiento (Parte 6, tareas 96/97/99).
 *
 * `planificarProximoRecordatorio` (`@effort/core`) ya sabe CUÁNDO le toca un
 * recordatorio a una solicitud. Lo que faltaba, y es lo que agrega este
 * archivo, es quién lo manda de verdad: resolver los `Destinatario` de la
 * regla a direcciones de correo reales, enviar, y dejar constancia de las
 * tres cosas que hacen falta después —tarea 97 (bitácora de contacto), tarea
 * 99 (fallos y escalamiento)— sin que nada de esto dependa de que una
 * persona se acuerde de hacerlo a mano.
 *
 * Apagado por defecto (`RECORDATORIOS_AUTOMATICOS=no`, REGLA 0-bis de
 * `CLAUDE.md`): el interruptor vive un nivel arriba, en `programador.ts`, no
 * acá — este archivo no sabe si está encendido o apagado, solo sabe mandar.
 */

import {
  correspondeEnviar,
  fechaCivilAIso,
  fechaCivilDesdeIso,
  planificarProximoRecordatorio,
  type CalendarioHabil,
  type Destinatario,
  type FechaCivil,
  type ReglaNotificacion,
  type SolicitudDocumentacion,
} from '@effort/core';
import type { EnviadorDeCorreo } from '@effort/drive';

import type {
  AltaDeRecordatorioEnviado,
  ReglaDeNotificacionAlmacenada,
  RecordatorioEnviadoAlmacenado,
  RepositorioDeAlertas,
  RepositorioDeRecordatorios,
  RepositorioDeReglasDeNotificacion,
  RepositorioDeSolicitudes,
  SolicitudAlmacenada,
} from '../puertos-dominio.js';
import type { ContactoAlmacenado, RepositorioDeContactos, RepositorioDeUsuarios } from '../puertos.js';

/** A partir de cuántos fallos consecutivos del mismo recordatorio se avisa a dirección. */
export const FALLOS_CONSECUTIVOS_PARA_ALERTAR = 3;

function aFechaCivil(fecha: Date): FechaCivil {
  return fechaCivilDesdeIso(fecha.toISOString().slice(0, 10));
}

function aDate(fecha: FechaCivil): Date {
  return new Date(`${fechaCivilAIso(fecha)}T00:00:00.000Z`);
}

function solicitudDeDominio(solicitud: SolicitudAlmacenada): SolicitudDocumentacion {
  return {
    id: solicitud.id,
    clienteId: solicitud.clienteId,
    periodo: fechaCivilDesdeIso(`${solicitud.periodo}-01`),
    estado: solicitud.estado as SolicitudDocumentacion['estado'],
    cuentaDesde: aFechaCivil(solicitud.cuentaDesde),
    recordatoriosEnviados: solicitud.recordatoriosEnviados,
    ultimoRecordatorioEn: solicitud.ultimoRecordatorioEn ? aFechaCivil(solicitud.ultimoRecordatorioEn) : null,
  };
}

function reglaDeDominio(regla: ReglaDeNotificacionAlmacenada): ReglaNotificacion {
  return {
    id: regla.id,
    nombre: regla.nombre,
    activa: regla.activa,
    evento: regla.evento as ReglaNotificacion['evento'],
    diasHabilesDePlazo: regla.diasHabilesDePlazo,
    horaDeEnvio: regla.horaDeEnvio,
    reintentarCadaDiasHabiles: regla.reintentarCadaDiasHabiles,
    maximoRecordatorios: regla.maximoRecordatorios,
    escalarAPartirDelRecordatorio: regla.escalarAPartirDelRecordatorio,
    // `DestinatarioRegla.tipo` es `string` del lado de la base (columna Json,
    // sin enum); ya viene validado por el Zod de la ruta de reglas al
    // guardarse, así que el casteo acá es seguro.
    destinatariosIniciales: regla.destinatariosIniciales as readonly Destinatario[],
    destinatariosDeEscalamiento: regla.destinatariosDeEscalamiento as readonly Destinatario[],
    plantillaId: regla.plantillaId ?? '',
  };
}

/**
 * Resuelve un destinatario de regla a direcciones de correo reales.
 *
 * Puede devolver más de una (`ROL`/`RESPONSABLE_DEL_CLIENTE` alcanzan a
 * varias personas) o ninguna (nadie tiene ese rol asignado todavía) — en ese
 * caso no es un error: el recordatorio sigue con los destinatarios que sí se
 * resolvieron, y se avisa por log, no se corta el envío entero por uno solo.
 */
async function resolverDestinatario(
  destinatario: Destinatario,
  clienteId: string,
  deps: {
    readonly usuarios: Pick<RepositorioDeUsuarios, 'listar' | 'buscarListadoPorId' | 'listarAsignadosAlCliente'>;
    readonly clientes: { buscarPorId(id: string, filtro: null): Promise<{ email: string | null } | null> };
  },
): Promise<string[]> {
  switch (destinatario.tipo) {
    case 'CORREO_LIBRE':
      return destinatario.valor ? [destinatario.valor] : [];

    case 'CLIENTE': {
      const cliente = await deps.clientes.buscarPorId(clienteId, null);
      return cliente?.email ? [cliente.email] : [];
    }

    case 'USUARIO': {
      if (!destinatario.valor) return [];
      const usuario = await deps.usuarios.buscarListadoPorId(destinatario.valor);
      return usuario && usuario.activo ? [usuario.email] : [];
    }

    case 'ROL': {
      if (!destinatario.valor) return [];
      const usuarios = await deps.usuarios.listar();
      return usuarios
        .filter((u) => u.rol === destinatario.valor && u.activo)
        .map((u) => u.email);
    }

    case 'RESPONSABLE_DEL_CLIENTE': {
      const usuarios = await deps.usuarios.listarAsignadosAlCliente(clienteId, 'responsable');
      return usuarios.filter((u) => u.activo).map((u) => u.email);
    }

    case 'COORDINADOR_DEL_CLIENTE': {
      const usuarios = await deps.usuarios.listarAsignadosAlCliente(clienteId, 'coordinador');
      return usuarios.filter((u) => u.activo).map((u) => u.email);
    }
  }
}

async function resolverDestinatarios(
  destinatarios: readonly Destinatario[],
  clienteId: string,
  deps: Parameters<typeof resolverDestinatario>[2],
): Promise<string[]> {
  const listas = await Promise.all(destinatarios.map((d) => resolverDestinatario(d, clienteId, deps)));
  // Un mismo correo puede llegar por dos vías (el responsable también tiene
  // rol ROL, por ejemplo): se manda una sola vez.
  return [...new Set(listas.flat())];
}

function cuerpoDelRecordatorio(
  nombreDeCliente: string,
  periodo: string,
  numeroDeRecordatorio: number,
  esEscalamiento: boolean,
): string {
  return [
    `Cliente: ${nombreDeCliente}`,
    `Período: ${periodo}`,
    '',
    `Todavía no se recibió la documentación de este período. Este es el recordatorio n.° ${numeroDeRecordatorio}.`,
    esEscalamiento ? '' : '',
    esEscalamiento
      ? 'Va con copia a dirección: se superó la cantidad de recordatorios sin respuesta que la regla considera normal.'
      : '',
    '',
    '---',
    'Este aviso lo generó EFFORT Control 360 automáticamente.',
  ]
    .filter((linea) => linea !== '')
    .join('\n');
}

export interface DependenciasDeRecordatorios {
  readonly reglasDeNotificacion: Pick<RepositorioDeReglasDeNotificacion, 'listar'>;
  readonly solicitudes: Pick<RepositorioDeSolicitudes, 'listarAbiertas' | 'registrarRecordatorioEnviado'>;
  readonly recordatorios: RepositorioDeRecordatorios;
  readonly contactos: Pick<RepositorioDeContactos, 'registrar'>;
  readonly usuarios: Pick<RepositorioDeUsuarios, 'listar' | 'buscarListadoPorId' | 'listarAsignadosAlCliente'>;
  readonly clientes: {
    buscarPorId(id: string, filtro: null): Promise<{ email: string | null; nombre: string } | null>;
  };
  readonly alertas: Pick<RepositorioDeAlertas, 'crear'>;
  readonly correo: EnviadorDeCorreo;
  readonly calendario: CalendarioHabil;
  readonly hoy: FechaCivil;
  readonly ahora: () => Date;
  /** Usuario del sistema al que se atribuye el contacto automático (tarea 97). */
  readonly usuarioSistemaId: string;
}

export interface ResumenDeRecordatorios {
  readonly evaluadas: number;
  readonly enviados: number;
  readonly fallidos: number;
  readonly escalados: number;
  readonly alertasDeFalloLevantadas: number;
}

/**
 * Recorre las solicitudes abiertas, manda los recordatorios que correspondan
 * hoy, y deja constancia de todo: en `envio_notificacion` (para no repetir),
 * en `registro_contacto` con `origen=AUTOMATICO` (tarea 97, la evidencia de
 * gestión), y si un mismo recordatorio lleva `FALLOS_CONSECUTIVOS_PARA_ALERTAR`
 * fallos seguidos, una alerta a dirección (tarea 99) — con la misma
 * deduplicación por `entidadRelacionadaId` que usa el resto del motor de
 * alertas, así que no se repite en cada corrida mientras siga fallando.
 */
export async function enviarRecordatorios(
  deps: DependenciasDeRecordatorios,
): Promise<ResumenDeRecordatorios> {
  const [reglas, solicitudesAbiertas, yaEnviados] = await Promise.all([
    deps.reglasDeNotificacion.listar(),
    deps.solicitudes.listarAbiertas(),
    deps.recordatorios.enviados(),
  ]);

  const reglasPorId = new Map(reglas.map((regla) => [regla.id, regla]));
  const yaEnviado = new Set(yaEnviados.map((e) => `${e.solicitudId}|${e.numeroDeRecordatorio}`));

  let evaluadas = 0;
  let enviados = 0;
  let fallidos = 0;
  let escalados = 0;
  let alertasDeFalloLevantadas = 0;

  for (const solicitud of solicitudesAbiertas) {
    if (!solicitud.reglaId) continue;
    const reglaAlmacenada = reglasPorId.get(solicitud.reglaId);
    if (!reglaAlmacenada || !reglaAlmacenada.activa) continue;

    const regla = reglaDeDominio(reglaAlmacenada);
    const plan = planificarProximoRecordatorio(solicitudDeDominio(solicitud), regla, deps.calendario);
    if (!plan) continue;
    if (!correspondeEnviar(plan, deps.hoy)) continue;

    const clave = `${plan.solicitudId}|${plan.numeroDeRecordatorio}`;
    if (yaEnviado.has(clave)) continue;

    evaluadas += 1;

    const cliente = await deps.clientes.buscarPorId(solicitud.clienteId, null);
    const nombreDeCliente = cliente?.nombre ?? solicitud.clienteId;
    const destinatarios = await resolverDestinatarios(plan.destinatarios, solicitud.clienteId, deps);

    if (destinatarios.length === 0) {
      // Nadie a quién mandarle: no es un fallo de envío, es una regla sin
      // destinatarios resueltos para este cliente. Se deja para la próxima
      // corrida en vez de marcar el recordatorio como usado sin haber avisado
      // a nadie.
      continue;
    }

    const asunto = `[EFFORT Control 360] ${nombreDeCliente}: documentación pendiente (período ${solicitud.periodo})`;
    const cuerpo = cuerpoDelRecordatorio(nombreDeCliente, solicitud.periodo, plan.numeroDeRecordatorio, plan.esEscalamiento);

    let algunoEnviado = false;
    for (const destinatario of destinatarios) {
      const datosBase: Omit<AltaDeRecordatorioEnviado, 'estado' | 'idMensajeProveedor' | 'errorProveedor' | 'despachadoEn'> = {
        reglaId: regla.id,
        clienteId: solicitud.clienteId,
        solicitudId: solicitud.id,
        destinatario,
        asunto,
        numeroDeRecordatorio: plan.numeroDeRecordatorio,
        esEscalamiento: plan.esEscalamiento,
      };

      try {
        const { idMensaje } = await deps.correo.enviar({ destinatario, asunto, cuerpo });
        await deps.recordatorios.registrar({
          ...datosBase,
          estado: 'ENVIADO',
          idMensajeProveedor: idMensaje,
          errorProveedor: null,
          despachadoEn: deps.ahora(),
        });
        algunoEnviado = true;
        enviados += 1;
      } catch (error) {
        // Un destinatario que falla no puede impedir que salga para los
        // demás: se registra el fallo y se sigue.
        await deps.recordatorios.registrar({
          ...datosBase,
          estado: 'FALLIDO',
          idMensajeProveedor: null,
          errorProveedor: error instanceof Error ? error.message.slice(0, 1000) : 'Error desconocido.',
          despachadoEn: null,
        });
        fallidos += 1;
      }
    }

    // Se actualiza el contador de la solicitud si al menos uno de los
    // destinatarios recibió el correo: si todos fallaron, el próximo intento
    // tiene que seguir siendo el mismo recordatorio, no saltar al siguiente.
    if (algunoEnviado) {
      await deps.solicitudes.registrarRecordatorioEnviado(
        solicitud.id,
        aDate(plan.fecha),
        plan.numeroDeRecordatorio,
        plan.esEscalamiento,
      );
      if (plan.esEscalamiento) escalados += 1;

      await registrarContactoAutomatico(deps, solicitud, plan.numeroDeRecordatorio, cuerpo);
    }

    // Tarea 99: fallos consecutivos del MISMO recordatorio (mismo número), no
    // fallos acumulados de toda la historia de la solicitud — un recordatorio
    // 1 que falló dos veces y salió a la tercera no tiene que contar contra
    // el recordatorio 2.
    const historial = await deps.recordatorios.listarPorSolicitud(solicitud.id);
    const consecutivos = contarFallosConsecutivos(historial, plan.numeroDeRecordatorio);
    if (consecutivos >= FALLOS_CONSECUTIVOS_PARA_ALERTAR) {
      const creadas = await deps.alertas.crear([
        {
          clienteId: solicitud.clienteId,
          periodo: solicitud.periodo,
          origen: 'recordatorio_fallido',
          criticidad: 'ALTA',
          titulo: `Recordatorio de documentación sin poder enviarse — ${nombreDeCliente}`,
          detalle:
            `El recordatorio n.° ${plan.numeroDeRecordatorio} de "${regla.nombre}" falló ` +
            `${consecutivos} veces seguidas para este cliente y período. Revisar las direcciones ` +
            'de los destinatarios o el estado del envío de correo.',
          entidadRelacionada: 'solicitud_documentacion',
          entidadRelacionadaId: solicitud.id,
          fechaLimite: null,
        },
      ]);
      alertasDeFalloLevantadas += creadas;
    }
  }

  return { evaluadas, enviados, fallidos, escalados, alertasDeFalloLevantadas };
}

/**
 * Cuenta los fallos consecutivos más recientes del mismo número de
 * recordatorio, sin mirar los de otros recordatorios ya resueltos.
 */
function contarFallosConsecutivos(
  historial: readonly RecordatorioEnviadoAlmacenado[],
  numeroDeRecordatorio: number,
): number {
  let contador = 0;
  for (const envio of historial) {
    if (envio.numeroDeRecordatorio !== numeroDeRecordatorio) break;
    if (envio.estado !== 'FALLIDO') break;
    contador += 1;
  }
  return contador;
}

/**
 * Tarea 97: cada recordatorio que salió (a al menos un destinatario) deja un
 * contacto automático — es la evidencia de gestión que existe para responder
 * "ustedes nunca me pidieron nada" meses después.
 */
async function registrarContactoAutomatico(
  deps: Pick<DependenciasDeRecordatorios, 'contactos' | 'ahora' | 'usuarioSistemaId'>,
  solicitud: SolicitudAlmacenada,
  numeroDeRecordatorio: number,
  resumen: string,
): Promise<ContactoAlmacenado> {
  return deps.contactos.registrar({
    clienteId: solicitud.clienteId,
    periodo: solicitud.periodo,
    solicitudId: solicitud.id,
    canal: 'CORREO',
    direccion: 'SALIENTE',
    origenContacto: 'AUTOMATICO',
    ocurridoEn: deps.ahora(),
    registradoPorUsuarioId: deps.usuarioSistemaId,
    huboRespuesta: false,
    quienAtendio: null,
    resumen: `Recordatorio automático n.° ${numeroDeRecordatorio}.\n\n${resumen}`,
    evidenciaId: null,
  });
}
