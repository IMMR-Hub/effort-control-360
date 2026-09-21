/**
 * Flujo de «Prórroga», compartido por el radar y por la lista de presentados.
 *
 * La DNIT corre plazos por resolución seguido. La fecha y el motivo los carga
 * una persona: una resolución es algo que alguien leyó y verificó, no algo que
 * el sistema pueda deducir. Devuelve `true` si se prorrogó y `false` si la
 * persona canceló en cualquiera de las dos preguntas; un error del servidor
 * se propaga para que cada pantalla lo muestre a su manera.
 */

import { prorrogar } from '../api/vencimientos.js';

export interface DatosParaProrrogar {
  readonly id: string;
  readonly descripcion: string;
  readonly fechaVencimiento: string;
  readonly motivoProrroga: string | null;
}

export async function pedirProrroga(vencimiento: DatosParaProrrogar): Promise<boolean> {
  const nuevaFecha = window.prompt(
    `Nueva fecha de vencimiento de "${vencimiento.descripcion}" (AAAA-MM-DD).\n` +
      `Hoy vence el ${vencimiento.fechaVencimiento}.`,
    vencimiento.fechaVencimiento,
  );
  if (!nuevaFecha?.trim()) return false;

  const motivo = window.prompt(
    '¿Por qué se prorroga? Poné la resolución, por ejemplo "RG 50/2026".',
    vencimiento.motivoProrroga ?? '',
  );
  if (!motivo?.trim()) return false;

  await prorrogar(vencimiento.id, nuevaFecha.trim(), motivo.trim());
  return true;
}
