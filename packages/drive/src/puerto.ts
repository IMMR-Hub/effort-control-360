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

/**
 * El token de cambios que se tenía ya no sirve (Graph respondió 410 Gone).
 *
 * Quien llama tiene que hacer una pasada completa: no hay forma de saber qué
 * cambió mientras el token estuvo vencido (tarea 158).
 */
export class TokenDeCambiosVencido extends Error {
  override readonly name = 'TokenDeCambiosVencido';
}

/** Un archivo que Graph informó como creado, modificado o borrado desde un token. */
export interface CambioDeArchivo {
  readonly itemId: string;
  readonly nombre: string;
  readonly tamanoBytes: number;
  readonly modificadoEn: Date;
  readonly tipoMime: string | null;
  readonly eliminado: boolean;
  /** Las carpetas también aparecen entre los cambios; no se copian. */
  readonly esCarpeta: boolean;
}

/**
 * Detectar qué cambió en el drive sin recorrerlo entero (tarea 158).
 *
 * Recorrer todas las carpetas de todos los clientes cuesta ~0,4 s por carpeta y
 * crece con la cantidad de clientes; preguntar «qué cambió desde la última vez»
 * cuesta una llamada. Es un contrato aparte de `DriveDeArchivos` para que el
 * resto del sistema no dependa de él: quien no lo tenga sigue recorriendo todo.
 *
 * Todo es de solo lectura.
 */
export interface FuenteDeCambios {
  /** Un token que representa «desde ahora». No devuelve los archivos existentes. */
  tokenDeCambiosActual(): Promise<string>;
  /**
   * Cambios de todo el drive desde `token`, y el token para la próxima vez.
   * Lanza `TokenDeCambiosVencido` si el token ya no sirve.
   */
  cambiosDesde(token: string): Promise<{ readonly cambios: readonly CambioDeArchivo[]; readonly tokenSiguiente: string }>;
  /** Ruta, desde la raíz del drive, de la carpeta que contiene el archivo; `null` si ya no existe. */
  rutaDeLaCarpetaDe(itemId: string): Promise<string | null>;
  /** Ruta, desde la raíz del drive, de una carpeta identificada por su id. */
  rutaDeCarpetaPorId(itemId: string): Promise<string>;
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
