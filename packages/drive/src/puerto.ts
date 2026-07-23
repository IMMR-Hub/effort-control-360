/**
 * Puerto de acceso a archivos en OneDrive.
 *
 * Los importadores (Parte 5) y el espejo de respaldo dependen de esta
 * interfaz, no de Microsoft Graph directamente. Mismo principio que el resto
 * del sistema: se puede probar todo el flujo de importación sin credenciales
 * reales, y el adaptador real se conecta el día que EFFORT complete el
 * registro en Azure AD (ver `docs/DISCREPANCIAS.md`, punto 6).
 */

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
  leer(itemId: string): Promise<Buffer>;
  /**
   * Sube un archivo. Si ya existe uno con el mismo nombre en la carpeta,
   * Graph lo versiona en vez de duplicarlo — es el comportamiento nativo de
   * OneDrive y este puerto no lo cambia.
   */
  escribir(carpeta: string, nombre: string, contenido: Buffer): Promise<ArchivoDrive>;
}
