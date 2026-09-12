/**
 * @effort/importers — parseo y validación de archivos de origen externo.
 *
 * Cada importador transforma un archivo en un reporte de filas aceptadas y
 * rechazadas. No toca la base de datos ni el drive: recibe un `Buffer` (ya
 * leído por `@effort/drive`) y devuelve datos del dominio de `@effort/core`,
 * listos para que una capa posterior decida qué hacer con ellos.
 */

export * from './archivo.js';
export * from './comprobantes.js';
export * from './libroRg90.js';
export * from './siga.js';
