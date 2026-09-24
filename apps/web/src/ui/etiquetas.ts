/**
 * Etiquetas y tonos de badge para los enums compartidos entre pantallas.
 * Ver `../api/tipos-compartidos.ts` para los tipos.
 */

import type { NivelRiesgo, TipoDocumento } from '../api/tipos-compartidos.js';
import type { Criticidad } from '../api/alertas.js';
import type { NivelAlerta } from '../api/vencimientos.js';

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  FACTURA_COMPRA: 'Factura de compra',
  FACTURA_VENTA: 'Factura de venta',
  RECIBO: 'Recibo',
  RETENCION: 'Retención',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
  EXTRACTO_BANCARIO: 'Extracto bancario',
  COMPROBANTE_PAGO: 'Comprobante de pago',
  CONTRATO: 'Contrato',
  PODER: 'Poder',
  ACTA: 'Acta',
  ESTATUTO: 'Estatuto',
  CERTIFICADO: 'Certificado',
  CONSTANCIA: 'Constancia',
  LIQUIDACION: 'Liquidación',
  BALANCE: 'Balance',
  ESTADO_RESULTADOS: 'Estado de resultados',
  DECLARACION_JURADA: 'Declaración jurada',
  LIBRO_COMPRAS: 'Libro de compras',
  LIBRO_VENTAS: 'Libro de ventas',
  OTRO: 'Otro',
};

export const OPCIONES_TIPO_DOCUMENTO = Object.entries(ETIQUETA_TIPO_DOCUMENTO).map(
  ([valor, etiqueta]) => ({ valor, etiqueta }),
);

export const TONO_RIESGO: Record<NivelRiesgo, 'completo' | 'pendiente' | 'parcial' | 'critico'> = {
  BAJO: 'completo',
  MEDIO: 'pendiente',
  ALTO: 'parcial',
  CRITICO: 'critico',
};

export const OPCIONES_RIESGO = Object.keys(TONO_RIESGO).map((v) => ({ valor: v, etiqueta: v }));

export const TONO_NIVEL_ALERTA: Record<NivelAlerta, 'critico' | 'parcial' | 'pendiente' | 'proceso' | 'completo'> = {
  VENCIDO: 'critico',
  CRITICA: 'critico',
  ALTA: 'parcial',
  MEDIA: 'pendiente',
  INFORMATIVA: 'proceso',
  SIN_ALERTA: 'completo',
};

export const ETIQUETA_NIVEL_ALERTA: Record<NivelAlerta, string> = {
  VENCIDO: 'Vencido',
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  INFORMATIVA: 'Informativa',
  SIN_ALERTA: 'Sin alerta',
};

export const TONO_CRITICIDAD: Record<Criticidad, 'critico' | 'parcial' | 'pendiente' | 'proceso'> = {
  CRITICA: 'critico',
  ALTA: 'parcial',
  MEDIA: 'pendiente',
  INFORMATIVA: 'proceso',
};

export const ETIQUETA_CRITICIDAD: Record<Criticidad, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  INFORMATIVA: 'Informativa',
};

/**
 * Filtro de la lista de vencimientos por nivel de alerta.
 *
 * «Próximos» no es un nivel del servidor: es el nombre que el Panel le da a los
 * críticos, los altos y los medios juntos (vencen en 15 días o menos; Daniel,
 * 2026-09-24, antes eran 7). Vive acá para que el Panel y la lista cuenten lo
 * mismo con la misma palabra.
 */
export type FiltroDeNivel = 'TODOS' | 'PROXIMOS' | NivelAlerta;

export const OPCIONES_FILTRO_DE_NIVEL: { valor: FiltroDeNivel; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'VENCIDO', etiqueta: 'Vencidos' },
  { valor: 'PROXIMOS', etiqueta: 'Próximos (15 días o menos)' },
  { valor: 'CRITICA', etiqueta: 'Solo críticos' },
  { valor: 'ALTA', etiqueta: 'Solo altos' },
  { valor: 'MEDIA', etiqueta: 'Medios' },
  { valor: 'INFORMATIVA', etiqueta: 'Informativos' },
  { valor: 'SIN_ALERTA', etiqueta: 'Sin alerta' },
];

export function coincideConNivel(nivel: NivelAlerta, filtro: FiltroDeNivel): boolean {
  if (filtro === 'TODOS') return true;
  if (filtro === 'PROXIMOS') return nivel === 'CRITICA' || nivel === 'ALTA' || nivel === 'MEDIA';
  return nivel === filtro;
}
