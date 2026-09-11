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
  readonly #carpetas = new Map<string, string>();

  async listar(carpeta: string): Promise<ArchivoDrive[]> {
    return [...this.#archivos.values()]
      .filter((entrada) => entrada.meta.rutaCarpeta === carpeta)
      .map((entrada) => entrada.meta);
  }

  /**
   * Equivalente en memoria del recorrido recursivo.
   *
   * En el drive real la carpeta se identifica por su id; acá no hay entidades
   * "carpeta", así que el id que se pasa es el de la carpeta raíz tal como la
   * registró `registrarCarpeta`, y se devuelven todos los archivos cuya ruta
   * cuelga de ella.
   */
  async listarRecursivoPorId(itemId: string): Promise<ArchivoDrive[]> {
    const raiz = this.#carpetas.get(itemId);
    if (raiz === undefined) {
      throw new Error(`Carpeta inexistente en el drive falso: ${itemId}`);
    }

    return [...this.#archivos.values()]
      .filter(
        (entrada) =>
          entrada.meta.rutaCarpeta === raiz || entrada.meta.rutaCarpeta.startsWith(`${raiz}/`),
      )
      .map((entrada) => entrada.meta);
  }

  /** Da de alta una carpeta con su id, para poder recorrerla en los tests. */
  registrarCarpeta(itemId: string, ruta: string): void {
    this.#carpetas.set(itemId, ruta);
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
  sembrar(
    carpeta: string,
    nombre: string,
    contenido: Buffer,
    // `itemId` y `modificadoEn` explícitos permiten simular que alguien EDITÓ
    // un archivo que ya estaba: mismo id, contenido y fecha nuevos. Sin esto
    // cada llamada crea un archivo distinto, que es otro escenario.
    opciones: { itemId?: string; modificadoEn?: Date } = {},
  ): ArchivoDrive {
    const meta: ArchivoDrive = {
      itemId: opciones.itemId ?? randomUUID(),
      nombre,
      rutaCarpeta: carpeta,
      tamanoBytes: contenido.length,
      modificadoEn: opciones.modificadoEn ?? new Date(),
      tipoMime: null,
    };
    this.#archivos.set(meta.itemId, { meta, contenido });
    return meta;
  }
}
