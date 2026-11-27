/**
 * Lo que comparten las tres pestañas de Seguimiento: quién escribe, cómo se
 * nombra cada estado y prioridad, y las fechas en hora de Paraguay.
 */

import {
  diaDeLaSemana,
  diasEntre,
  fechaCivilAIso,
  hoyEnParaguay,
  ZONA_PARAGUAY,
  type FechaCivil,
} from '@effort/core';

import { ErrorDeApi } from '../../api/cliente.js';
import type { SolicitudDocumentacion } from '../../api/solicitudes.js';
import type { CanalDePedido, EstadoDePedido, Prioridad } from '../../api/seguimiento.js';
import type { Usuario } from '../../api/usuarios.js';

/**
 * Los roles que la matriz deja escribir en Seguimiento: abrir solicitudes,
 * cargar pedidos del equipo y usar las acciones rápidas (regla 12).
 */
export const ROLES_QUE_ABREN = new Set(['direccion']);

export type Tono = 'completo' | 'critico' | 'parcial' | 'pendiente' | 'proceso';

export const ETIQUETA_ESTADO: Record<SolicitudDocumentacion['estado'], { texto: string; tono: Tono }> = {
  ENTREGADA: { texto: 'Entregada', tono: 'completo' },
  ABIERTA: { texto: 'Sin entregar', tono: 'critico' },
  RESPONDIDA_SIN_ENTREGA: { texto: 'Prometió entregar', tono: 'parcial' },
  ESCALADA: { texto: 'Escalada', tono: 'critico' },
  AGOTADA: { texto: 'Recordatorios agotados', tono: 'critico' },
  CERRADA_MANUALMENTE: { texto: 'Cerrada a mano', tono: 'pendiente' },
};

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoDePedido, { texto: string; tono: Tono }> = {
  ABIERTO: { texto: 'Abierto', tono: 'parcial' },
  EN_CURSO: { texto: 'En curso', tono: 'proceso' },
  RESUELTO: { texto: 'Resuelto', tono: 'completo' },
  CANCELADO: { texto: 'Cancelado', tono: 'pendiente' },
};

/** Estado de una fila de la bandeja: cada tipo con el suyo, sin mapearlos entre sí. */
export function etiquetaDeEstado(tipo: 'EQUIPO' | 'CLIENTE', estado: string): { texto: string; tono: Tono } {
  const tabla: Record<string, { texto: string; tono: Tono }> =
    tipo === 'EQUIPO' ? ETIQUETA_ESTADO_PEDIDO : ETIQUETA_ESTADO;
  return tabla[estado] ?? { texto: estado, tono: 'pendiente' };
}

export const ETIQUETA_PRIORIDAD: Record<Prioridad, { texto: string; tono: Tono }> = {
  CRITICA: { texto: 'Crítica', tono: 'critico' },
  ALTA: { texto: 'Alta', tono: 'parcial' },
  MEDIA: { texto: 'Media', tono: 'proceso' },
  BAJA: { texto: 'Baja', tono: 'pendiente' },
};

export const OPCIONES_PRIORIDAD = (['CRITICA', 'ALTA', 'MEDIA', 'BAJA'] as const).map((valor) => ({
  valor,
  etiqueta: ETIQUETA_PRIORIDAD[valor].texto,
}));

const CANALES: readonly CanalDePedido[] = ['LLAMADA', 'MENSAJE', 'WHATSAPP', 'CORREO', 'PRESENCIAL'];

export const OPCIONES_CANAL = CANALES.map((valor) => ({
  valor,
  etiqueta: valor.charAt(0) + valor.slice(1).toLowerCase(),
}));

export function nombreDeUsuario(usuario: Usuario): string {
  return `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
}

/** «Para» = personas de dirección activas (§5.3 bis del diseño). */
export function destinatariosPosibles(usuarios: readonly Usuario[]): { valor: string; etiqueta: string }[] {
  return usuarios
    .filter((u) => u.activo && u.rol === 'direccion')
    .map((u) => ({ valor: u.id, etiqueta: nombreDeUsuario(u) }));
}

export function mensajeDeError(motivo: unknown, alternativo = 'No se pudo conectar con el servidor.'): string {
  return motivo instanceof ErrorDeApi ? motivo.message : alternativo;
}

/* --- Fechas, siempre en Paraguay ------------------------------------------ */

function sumarDias(fecha: FechaCivil, dias: number): FechaCivil {
  const d = new Date(Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia + dias));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export type OpcionDeReagenda = 'manana' | 'tres_dias' | 'proxima_semana';

/**
 * La fecha de «Recordar el» de cada opción rápida, contada desde hoy en
 * Paraguay: «Mañana» +1, «En 3 días» +3, «Próxima semana» el lunes que viene
 * (si hoy es lunes, el de la semana siguiente).
 */
export function fechaDeReagenda(opcion: OpcionDeReagenda, ahora: Date): string {
  const hoy = hoyEnParaguay(ahora);
  if (opcion === 'manana') return fechaCivilAIso(sumarDias(hoy, 1));
  if (opcion === 'tres_dias') return fechaCivilAIso(sumarDias(hoy, 3));
  const hastaElLunes = (8 - diaDeLaSemana(hoy)) % 7 || 7;
  return fechaCivilAIso(sumarDias(hoy, hastaElLunes));
}

const PARTES_DE_PARAGUAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_PARAGUAY,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 'AAAA-MM-DDTHH:MM' del instante en Paraguay: el valor de un `<input type="datetime-local">`. */
export function horaDeParaguayParaCampo(instante: Date): string {
  const partes = Object.fromEntries(
    PARTES_DE_PARAGUAY.formatToParts(instante).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${partes['year']}-${partes['month']}-${partes['day']}T${partes['hour']}:${partes['minute']}`;
}

/** Diferencia entre la hora de pared de Paraguay y UTC en ese instante, en ms. */
function desfaseDeParaguay(instante: number): number {
  const comoUtc = Date.parse(`${horaDeParaguayParaCampo(new Date(instante))}:00Z`);
  return comoUtc - Math.floor(instante / 60_000) * 60_000;
}

/**
 * El instante (ISO UTC) que corresponde a una hora de pared en Paraguay. La
 * zona sale de la base IANA, no de un desfase fijo (regla 3 de `CLAUDE.md`).
 */
export function instanteDesdeHoraDeParaguay(valor: string): string {
  const comoUtc = Date.parse(`${valor}:00Z`);
  let instante = comoUtc - desfaseDeParaguay(comoUtc);
  const corregido = desfaseDeParaguay(instante);
  if (corregido !== comoUtc - instante) instante = comoUtc - corregido;
  return new Date(instante).toISOString();
}

/** 'AAAA-MM-DD' (fecha civil) como dd/mm/aaaa, sin pasar por `Date`: un día no tiene huso. */
export function formatearDia(dia: string): string {
  const [anio, mes, diaDelMes] = dia.slice(0, 10).split('-');
  return anio && mes && diaDelMes ? `${diaDelMes}/${mes}/${anio}` : dia;
}

export function formatearFechaHora(fechaIso: string): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: ZONA_PARAGUAY,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fechaIso));
}

/** «hoy», «1 día», «5 días»: desde el día de creación hasta hoy, los dos en Paraguay. */
export function antiguedad(creadoEn: string, ahora: Date): string {
  const dias = diasEntre(hoyEnParaguay(new Date(creadoEn)), hoyEnParaguay(ahora));
  if (dias <= 0) return 'hoy';
  return dias === 1 ? '1 día' : `${dias} días`;
}
