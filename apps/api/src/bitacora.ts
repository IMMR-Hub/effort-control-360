/**
 * Escritura del registro de eventos.
 *
 * Toda operación que cambia estado pasa por acá. No es opcional ni "cuando nos
 * acordamos": es lo que permite responder, meses después, quién aprobó un
 * balance, quién cambió una tasa de IVA o cuándo se le reclamó a un cliente.
 *
 * Dos reglas que se cumplen sin excepción:
 *
 *  1. Los datos se sanean antes de persistirse. Un `datosDespues` con el hash
 *     de una contraseña adentro convertiría la bitácora en el lugar más
 *     peligroso de la base.
 *
 *  2. Un fallo al escribir la bitácora NO tumba la operación de negocio, pero
 *     sí se registra como error grave. El criterio es discutible en ambos
 *     sentidos; se eligió así porque perder la trazabilidad de un contacto es
 *     malo, pero impedir que EFFORT registre el contacto es peor.
 */

import { sanear, truncarIp } from './seguridad/privacidad.js';

export interface EntradaDeBitacora {
  readonly usuarioId: string | null;
  readonly accion: string;
  readonly entidad: string;
  readonly entidadId: string | null;
  readonly clienteId: string | null;
  readonly datosAntes?: unknown;
  readonly datosDespues?: unknown;
  readonly ip?: string | null;
  readonly agenteUsuario?: string | null;
  readonly peticionId?: string | null;
}

/** Fila lista para insertar, ya saneada. */
export interface FilaDeBitacora {
  readonly usuarioId: string | null;
  readonly accion: string;
  readonly entidad: string;
  readonly entidadId: string | null;
  readonly clienteId: string | null;
  readonly datosAntes: unknown;
  readonly datosDespues: unknown;
  readonly ipTruncada: string | null;
  readonly agenteUsuario: string | null;
  readonly peticionId: string | null;
}

/** Longitud máxima del agente de usuario que se guarda. */
const LARGO_MAXIMO_AGENTE = 300;

/**
 * Prepara una entrada para persistirla.
 *
 * Función pura: se puede probar sin base de datos, que es justamente lo que
 * hace verificable el saneo.
 */
export function prepararEntrada(entrada: EntradaDeBitacora): FilaDeBitacora {
  return {
    usuarioId: entrada.usuarioId,
    accion: entrada.accion,
    entidad: entrada.entidad,
    entidadId: entrada.entidadId,
    clienteId: entrada.clienteId,
    datosAntes: entrada.datosAntes === undefined ? null : sanear(entrada.datosAntes),
    datosDespues: entrada.datosDespues === undefined ? null : sanear(entrada.datosDespues),
    ipTruncada: truncarIp(entrada.ip),
    agenteUsuario: entrada.agenteUsuario?.slice(0, LARGO_MAXIMO_AGENTE) ?? null,
    peticionId: entrada.peticionId ?? null,
  };
}

/** Puerto de persistencia. La ruta no conoce Prisma; conoce esta interfaz. */
export interface RepositorioDeBitacora {
  registrar(fila: FilaDeBitacora): Promise<void>;
}

export interface RegistradorDeErrores {
  error(datos: Record<string, unknown>, mensaje: string): void;
}

/**
 * Escribe en la bitácora sin poder tumbar la operación que la originó.
 * Si falla, lo reporta como error grave para que se note en el monitoreo.
 */
export async function registrarEvento(
  repositorio: RepositorioDeBitacora,
  registrador: RegistradorDeErrores,
  entrada: EntradaDeBitacora,
): Promise<void> {
  try {
    await repositorio.registrar(prepararEntrada(entrada));
  } catch (error) {
    registrador.error(
      {
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        causa: error instanceof Error ? error.message : 'desconocida',
      },
      'No se pudo escribir en la bitácora de eventos.',
    );
  }
}

/** Acciones registradas. Enumeradas para que no se inventen nombres sueltos. */
export const ACCIONES = Object.freeze({
  ACCESO_EXITOSO: 'acceso.exitoso',
  ACCESO_FALLIDO: 'acceso.fallido',
  ACCESO_BLOQUEADO: 'acceso.bloqueado',
  SEGUNDO_FACTOR_SUPERADO: 'acceso.segundo_factor_superado',
  SEGUNDO_FACTOR_FALLIDO: 'acceso.segundo_factor_fallido',
  SESION_CERRADA: 'sesion.cerrada',
  SESION_REVOCADA: 'sesion.revocada',
  PERMISO_DENEGADO: 'seguridad.permiso_denegado',

  CLIENTE_CREADO: 'cliente.creado',
  CLIENTE_ACTUALIZADO: 'cliente.actualizado',
  USUARIO_CREADO: 'usuario.creado',
  USUARIO_ACTUALIZADO: 'usuario.actualizado',

  CONTACTO_REGISTRADO: 'contacto.registrado',
  RECORDATORIO_ENVIADO: 'recordatorio.enviado',
  CONSTANCIA_EMITIDA: 'constancia.emitida',

  DOCUMENTO_REGISTRADO: 'documento.registrado',
  DOCUMENTO_CAMBIO_ESTADO: 'documento.cambio_estado',
  PROCESO_MENSUAL_ACTUALIZADO: 'proceso_mensual.actualizado',

  VENCIMIENTO_REGISTRADO: 'vencimiento.registrado',
  VENCIMIENTO_PRESENTADO: 'vencimiento.presentado',

  SIGA_EXPORTACION_IMPORTADA: 'siga.exportacion_importada',
  SIGA_CONCILIACION_REVISADA: 'siga.conciliacion_revisada',

  LIQUIDACION_GENERADA: 'liquidacion.generada',
  LIQUIDACION_ENVIADA: 'liquidacion.enviada',
  LIQUIDACION_RESPONDIDA: 'liquidacion.respondida',

  BALANCE_ACTUALIZADO: 'balance.actualizado',
  BALANCE_APROBADO: 'balance.aprobado',
  REGLA_IMPOSITIVA_MODIFICADA: 'regla_impositiva.modificada',
  REGLA_NOTIFICACION_MODIFICADA: 'regla_notificacion.modificada',
} as const);
