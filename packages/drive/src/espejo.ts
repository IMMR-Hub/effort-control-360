/**
 * Espejo automático hacia el OneDrive de respaldo (tarea 90).
 *
 * Copia archivos de una carpeta de origen a una carpeta de destino y deja un
 * manifiesto sha256 en el destino (`manifiesto-espejo.json`). El manifiesto
 * cumple dos roles: permite verificar integridad después (comparar el
 * sha256 guardado contra el del archivo real) y evita volver a subir un
 * archivo que no cambió desde la corrida anterior.
 *
 * Respeta la regla del proyecto de no borrar nada: un archivo que desaparece
 * del origen simplemente deja de actualizarse, pero su copia y su entrada en
 * el manifiesto quedan en el destino.
 */

import { createHash } from 'node:crypto';

import type { DriveDeArchivos } from './puerto.js';

export const NOMBRE_MANIFIESTO_ESPEJO = 'manifiesto-espejo.json';

export interface EntradaManifiestoEspejo {
  readonly nombre: string;
  readonly sha256: string;
  readonly tamanoBytes: number;
  readonly copiadoEn: string;
}

export interface ResultadoEspejo {
  /** Archivos que se subieron en esta corrida (nuevos o con contenido distinto). */
  readonly copiados: readonly string[];
  /** Archivos que ya estaban al día en el destino y no se volvieron a subir. */
  readonly saltados: readonly string[];
  /** Estado completo del manifiesto después de la corrida. */
  readonly manifiesto: readonly EntradaManifiestoEspejo[];
}

export interface OpcionesEspejo {
  readonly origen: DriveDeArchivos;
  readonly destino: DriveDeArchivos;
  readonly carpetaOrigen: string;
  readonly carpetaDestino: string;
}

export async function espejarCarpeta(opciones: OpcionesEspejo): Promise<ResultadoEspejo> {
  const { origen, destino, carpetaOrigen, carpetaDestino } = opciones;

  const manifiestoPrevio = await leerManifiesto(destino, carpetaDestino);
  const previoPorNombre = new Map(manifiestoPrevio.map((entrada) => [entrada.nombre, entrada]));

  const archivosOrigen = (await origen.listar(carpetaOrigen)).filter(
    (archivo) => archivo.nombre !== NOMBRE_MANIFIESTO_ESPEJO,
  );

  const copiados: string[] = [];
  const saltados: string[] = [];
  const manifiestoActualizado = new Map(previoPorNombre);

  for (const archivo of archivosOrigen) {
    const contenido = await origen.leer(archivo.itemId);
    const sha256 = calcularSha256(contenido);
    const entradaPrevia = previoPorNombre.get(archivo.nombre);

    if (entradaPrevia?.sha256 === sha256) {
      saltados.push(archivo.nombre);
      continue;
    }

    await destino.escribir(carpetaDestino, archivo.nombre, contenido);
    copiados.push(archivo.nombre);
    manifiestoActualizado.set(archivo.nombre, {
      nombre: archivo.nombre,
      sha256,
      tamanoBytes: contenido.length,
      copiadoEn: new Date().toISOString(),
    });
  }

  const manifiestoFinal = [...manifiestoActualizado.values()];

  if (copiados.length > 0 || manifiestoPrevio.length === 0) {
    await destino.escribir(
      carpetaDestino,
      NOMBRE_MANIFIESTO_ESPEJO,
      Buffer.from(JSON.stringify(manifiestoFinal, null, 2), 'utf8'),
    );
  }

  return { copiados, saltados, manifiesto: manifiestoFinal };
}

async function leerManifiesto(
  destino: DriveDeArchivos,
  carpetaDestino: string,
): Promise<EntradaManifiestoEspejo[]> {
  const archivos = await destino.listar(carpetaDestino);
  const manifiesto = archivos.find((archivo) => archivo.nombre === NOMBRE_MANIFIESTO_ESPEJO);
  if (!manifiesto) return [];

  const contenido = await destino.leer(manifiesto.itemId);
  return JSON.parse(contenido.toString('utf8')) as EntradaManifiestoEspejo[];
}

function calcularSha256(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}
