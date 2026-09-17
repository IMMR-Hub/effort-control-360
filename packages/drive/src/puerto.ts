/**
 * Puerto de acceso a archivos en OneDrive.
 *
 * Los importadores (Parte 5) y el espejo de respaldo dependen de esta
 * interfaz, no de Microsoft Graph directamente. Mismo principio que el resto
 * del sistema: se puede probar todo el flujo de importación sin credenciales
 * reales, y el adaptador real se conecta el día que EFFORT complete el
 * registro en Azure AD (ver `docs/DISCREPANCIAS.md`, punto 6).
 */

/**
 * Falla pasajera al leer: Graph limitó las peticiones (429), tuvo un error
 * propio (5xx) o se cortó la conexión, y siguió así después de reintentar.
 *
 * Es un tipo aparte porque quien llama tiene que tratarla distinto de un
 * archivo roto o inexistente: si la planilla que manda en un período no se
 * pudo bajar por un corte, calcular igual con las otras haría ganar en
 * silencio a una versión vieja. Ante esto, lo correcto es no calcular ese
 * cliente en esta vuelta y avisar.
 */
export class ErrorTransitorioDeDrive extends Error {
  override readonly name = 'ErrorTransitorioDeDrive';
}

export interface ArchivoDrive {
  readonly itemId: string;
  readonly nombre: string;
  /** Ruta de la carpeta que lo contiene, relativa a la raíz del drive. */
  readonly rutaCarpeta: string;
  readonly tamanoBytes: number;
  readonly modificadoEn: Date;
  /** `null` cuando Graph no informa el tipo (carpetas, algunos formatos). */
  readonly tipoMime: string | null;
}

export interface DriveDeArchivos {
  /** Archivos directos de una carpeta. No baja a subcarpetas. */
  listar(carpeta: string): Promise<ArchivoDrive[]>;
  /**
   * Todos los archivos de una carpeta y de sus subcarpetas, identificando la
   * carpeta por su id en vez de por su ruta.
   *
   * Por id y no por ruta porque las carpetas de EFFORT se renombran: "PERIODO
   * 2026" pasa a "2026", alguien corrige un acento. El id sobrevive a eso; la
   * ruta no, y una sincronización que se rompe cuando alguien renombra una
   * carpeta no sirve para nada.
   *
   * Recursivo porque los documentos de un cliente viven varios niveles adentro
   * (`PERIODO 2026/DOCUMENTOS CONTABLES/01 ENERO/...`) y esa estructura la
   * decide EFFORT, no el sistema.
   */
  listarRecursivoPorId(itemId: string): Promise<ArchivoDrive[]>;
  leer(itemId: string): Promise<Buffer>;
  /**
   * Sube un archivo. Si ya existe uno con el mismo nombre en la carpeta,
   * Graph lo versiona en vez de duplicarlo — es el comportamiento nativo de
   * OneDrive y este puerto no lo cambia.
   */
  escribir(carpeta: string, nombre: string, contenido: Buffer): Promise<ArchivoDrive>;
  /**
   * Dirección web para abrir el archivo en OneDrive.
   *
   * Solo lee un dato del archivo; no lo baja, no lo copia, no lo comparte. Quien
   * abre el enlace necesita tener permiso sobre el archivo en OneDrive: el
   * sistema no amplía el acceso de nadie.
   */
  enlaceWeb(itemId: string): Promise<string>;
}
