/**
 * Adaptador en memoria para tests.
 *
 * Implementa el mismo contrato que `DriveGraph` sin tocar la red. Es lo que
 * permite probar los importadores y el espejo de respaldo completos antes de
 * que exista una cuenta real en Azure AD.
 */

import { randomUUID } from 'node:crypto';

import type { ArchivoDrive, DriveDeArchivos } from './puerto.js';

interface EntradaFalsa {
  readonly meta: ArchivoDrive;
  readonly contenido: Buffer;
}

export class DriveFalso implements DriveDeArchivos {
  readonly #archivos = new Map<string, EntradaFalsa>();

  async listar(carpeta: string): Promise<ArchivoDrive[]> {
    return [...this.#archivos.values()]
      .filter((entrada) => entrada.meta.rutaCarpeta === carpeta)
      .map((entrada) => entrada.meta);
  }

  async leer(itemId: string): Promise<Buffer> {
    const entrada = this.#archivos.get(itemId);
    if (!entrada) {
      throw new Error(`Archivo inexistente en el drive falso: ${itemId}`);
    }
    return entrada.contenido;
  }

  async escribir(carpeta: string, nombre: string, contenido: Buffer): Promise<ArchivoDrive> {
    // Mismo comportamiento que OneDrive real: subir con el mismo nombre en la
    // misma carpeta actualiza el archivo existente en vez de duplicarlo.
    const existente = [...this.#archivos.entries()].find(
      ([, entrada]) => entrada.meta.rutaCarpeta === carpeta && entrada.meta.nombre === nombre,
    );

    const meta: ArchivoDrive = {
      itemId: existente?.[0] ?? randomUUID(),
      nombre,
      rutaCarpeta: carpeta,
      tamanoBytes: contenido.length,
      modificadoEn: new Date(),
      tipoMime: null,
    };

    this.#archivos.set(meta.itemId, { meta, contenido });
    return meta;
  }

  /**
   * Solo para preparar escenarios de prueba: simula un archivo que ya estaba
   * en el drive antes de que corriera el código bajo prueba (a diferencia de
   * `escribir`, que es la operación real que también usaría un importador).
   */
  sembrar(carpeta: string, nombre: string, contenido: Buffer): ArchivoDrive {
    const meta: ArchivoDrive = {
      itemId: randomUUID(),
      nombre,
      rutaCarpeta: carpeta,
      tamanoBytes: contenido.length,
      modificadoEn: new Date(),
      tipoMime: null,
    };
    this.#archivos.set(meta.itemId, { meta, contenido });
    return meta;
  }
}
