/**
 * Control de acceso.
 *
 * Dos capas independientes, y las dos tienen que dar permiso:
 *
 *   1. ¿Este rol puede ejecutar esta acción sobre este tipo de recurso?
 *   2. ¿Este usuario puede ver a ESTE cliente en particular?
 *
 * La segunda es la que importa acá. EFFORT maneja datos contables de empresas
 * que compiten entre sí; que un auxiliar pueda leer la facturación de un
 * cliente que no le corresponde no es un detalle de permisos, es una fuga de
 * información sensible entre terceros.
 *
 * Principio: negar por defecto. La matriz enumera lo PERMITIDO. Todo lo que no
 * figura, se rechaza. Un recurso nuevo nace inaccesible hasta que alguien
 * decida explícitamente quién lo usa.
 */

import type { Rol } from '@effort/schema';

export type Recurso =
  | 'cliente'
  | 'usuario'
  | 'documento'
  | 'evidencia'
  | 'proceso_mensual'
  | 'exportacion_siga'
  | 'liquidacion'
  | 'balance'
  | 'vencimiento'
  | 'alerta'
  | 'obligacion'
  | 'regla_notificacion'
  | 'solicitud'
  | 'contacto'
  | 'constancia'
  | 'evento'
  | 'configuracion'
  | 'regla_impositiva';

export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar' | 'aprobar' | 'exportar' | 'cerrar';

type MatrizDePermisos = Readonly<Record<Rol, Readonly<Partial<Record<Recurso, readonly Accion[]>>>>>;

/**
 * Matriz de permisos.
 *
 * Ninguna combinación está implícita. `eliminar` casi no aparece a propósito:
 * en un sistema que existe para poder demostrar qué pasó, borrar es la
 * operación más peligrosa que hay. Los registros se dan de baja, no se borran.
 */
export const MATRIZ: MatrizDePermisos = Object.freeze({
  direccion: {
    cliente: ['ver', 'crear', 'editar', 'exportar'],
    usuario: ['ver', 'crear', 'editar'],
    documento: ['ver', 'crear', 'editar', 'exportar'],
    evidencia: ['ver', 'crear', 'exportar'],
    proceso_mensual: ['ver', 'crear', 'editar', 'exportar'],
    exportacion_siga: ['ver', 'crear', 'editar', 'exportar'],
    liquidacion: ['ver', 'crear', 'editar', 'exportar'],
    balance: ['ver', 'crear', 'editar', 'aprobar', 'exportar'],
    vencimiento: ['ver', 'crear', 'editar', 'exportar'],
    // 'crear' acá significa 'puede pedirle al sistema que evalúe y levante las
    // que correspondan', no 'puede inventar una alerta a mano': no existe ruta
    // de alta manual. Ver rutas/alertas.ts.
    alerta: ['ver', 'crear', 'cerrar', 'exportar'],
    obligacion: ['ver', 'crear', 'editar'],
    regla_notificacion: ['ver', 'crear', 'editar'],
    solicitud: ['ver', 'crear', 'cerrar', 'exportar'],
    contacto: ['ver', 'crear', 'exportar'],
    constancia: ['ver', 'exportar'],
    /**
     * La bitácora la ve SOLO dirección (Daniel, Lili y Laura).
     *
     * Restringido el 2026-09-10 a pedido de Daniel: antes también la veían
     * `responsable` y `revisor_balance`. Registra quién hizo cada cosa, y eso
     * incluye el trabajo de los compañeros — que todo el equipo pueda leerlo
     * cambia lo que la herramienta significa para quienes la usan.
     */
    evento: ['ver', 'exportar'],
    configuracion: ['ver', 'editar'],
    regla_impositiva: ['ver', 'crear', 'editar'],
  },

  responsable: {
    cliente: ['ver', 'crear', 'editar', 'exportar'],
    usuario: ['ver'],
    documento: ['ver', 'crear', 'editar', 'exportar'],
    evidencia: ['ver', 'crear', 'exportar'],
    proceso_mensual: ['ver', 'crear', 'editar', 'exportar'],
    exportacion_siga: ['ver', 'crear', 'editar', 'exportar'],
    liquidacion: ['ver', 'crear', 'editar', 'exportar'],
    balance: ['ver', 'crear', 'editar', 'exportar'],
    vencimiento: ['ver', 'crear', 'editar', 'exportar'],
    // 'crear' acá significa 'puede pedirle al sistema que evalúe y levante las
    // que correspondan', no 'puede inventar una alerta a mano': no existe ruta
    // de alta manual. Ver rutas/alertas.ts.
    alerta: ['ver', 'crear', 'cerrar', 'exportar'],
    obligacion: ['ver'],
    regla_notificacion: ['ver', 'editar'],
    solicitud: ['ver', 'crear', 'cerrar', 'exportar'],
    contacto: ['ver', 'crear', 'exportar'],
    constancia: ['ver', 'exportar'],
    configuracion: ['ver'],
    regla_impositiva: ['ver'],
  },

  coordinador: {
    cliente: ['ver'],
    documento: ['ver', 'crear', 'editar'],
    evidencia: ['ver', 'crear'],
    proceso_mensual: ['ver', 'editar'],
    exportacion_siga: ['ver', 'crear', 'editar'],
    liquidacion: ['ver', 'crear', 'editar'],
    balance: ['ver', 'editar'],
    vencimiento: ['ver', 'crear', 'editar'],
    alerta: ['ver', 'cerrar'],
    obligacion: ['ver'],
    regla_notificacion: ['ver'],
    solicitud: ['ver', 'crear', 'cerrar'],
    contacto: ['ver', 'crear'],
    constancia: ['ver', 'exportar'],
    configuracion: ['ver'],
    regla_impositiva: ['ver'],
  },

  auxiliar: {
    cliente: ['ver'],
    documento: ['ver', 'crear'],
    evidencia: ['ver', 'crear'],
    proceso_mensual: ['ver', 'editar'],
    exportacion_siga: ['ver', 'crear'],
    liquidacion: ['ver'],
    balance: ['ver'],
    vencimiento: ['ver'],
    alerta: ['ver'],
    obligacion: ['ver'],
    solicitud: ['ver'],
    contacto: ['ver', 'crear'],
    constancia: ['ver'],
    regla_impositiva: ['ver'],
  },

  revisor_balance: {
    cliente: ['ver'],
    documento: ['ver'],
    evidencia: ['ver'],
    proceso_mensual: ['ver'],
    exportacion_siga: ['ver'],
    liquidacion: ['ver'],
    // Único rol además de dirección que puede aprobar un balance.
    balance: ['ver', 'editar', 'aprobar', 'exportar'],
    vencimiento: ['ver'],
    alerta: ['ver'],
    obligacion: ['ver'],
    solicitud: ['ver'],
    contacto: ['ver'],
    constancia: ['ver'],
    regla_impositiva: ['ver'],
  },

  solo_lectura: {
    cliente: ['ver'],
    documento: ['ver'],
    proceso_mensual: ['ver'],
    exportacion_siga: ['ver'],
    liquidacion: ['ver'],
    balance: ['ver'],
    vencimiento: ['ver'],
    alerta: ['ver'],
    obligacion: ['ver'],
    solicitud: ['ver'],
    contacto: ['ver'],
    constancia: ['ver'],
    regla_impositiva: ['ver'],
  },
});

/** Roles que están obligados a usar segundo factor. */
export const ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO: readonly Rol[] = Object.freeze([
  'direccion',
  'responsable',
]);

export function requiereSegundoFactor(rol: Rol): boolean {
  return ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO.includes(rol);
}

/** Lo mínimo que hace falta saber de un usuario para decidir un acceso. */
export interface SujetoAutenticado {
  readonly usuarioId: string;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly veTodosLosClientes: boolean;
  readonly clientesAsignados: readonly string[];
}

/** Capa 1: ¿el rol puede hacer esto sobre este tipo de recurso? */
export function puede(sujeto: SujetoAutenticado, recurso: Recurso, accion: Accion): boolean {
  if (!sujeto.activo) return false;

  const permisosDelRol = MATRIZ[sujeto.rol];
  const accionesPermitidas = permisosDelRol[recurso];

  return accionesPermitidas?.includes(accion) ?? false;
}

/**
 * Capa 2: ¿este usuario puede tocar los datos de ESTE cliente?
 *
 * Un usuario sin `veTodosLosClientes` solo alcanza su cartera asignada, sin
 * importar cuán amplio sea su rol.
 */
export function puedeAccederAlCliente(sujeto: SujetoAutenticado, clienteId: string): boolean {
  if (!sujeto.activo) return false;
  if (sujeto.veTodosLosClientes) return true;
  return sujeto.clientesAsignados.includes(clienteId);
}

/**
 * Filtro de cartera para las consultas.
 *
 * `null` significa "sin restricción". Un arreglo, aunque esté vacío, significa
 * "solo estos": un usuario sin clientes asignados no ve nada, en vez de verlo
 * todo. Ese caso es la falla clásica de este tipo de filtros.
 */
export function filtroDeClientes(sujeto: SujetoAutenticado): readonly string[] | null {
  return sujeto.veTodosLosClientes ? null : sujeto.clientesAsignados;
}

export class ErrorDeAutorizacion extends Error {
  override readonly name = 'ErrorDeAutorizacion';
  readonly codigoHttp = 403;

  constructor(mensaje: string) {
    super(mensaje);
  }
}

/**
 * Comprueba las dos capas y falla si alguna no da permiso.
 *
 * El mensaje de error es deliberadamente parco: decir "no tenés acceso al
 * cliente X" le confirma a quien sondea que el cliente X existe.
 */
export function exigirPermiso(
  sujeto: SujetoAutenticado,
  recurso: Recurso,
  accion: Accion,
  clienteId?: string | null,
): void {
  if (!puede(sujeto, recurso, accion)) {
    throw new ErrorDeAutorizacion('No tenés permiso para realizar esta acción.');
  }

  if (clienteId && !puedeAccederAlCliente(sujeto, clienteId)) {
    throw new ErrorDeAutorizacion('No tenés permiso para realizar esta acción.');
  }
}
