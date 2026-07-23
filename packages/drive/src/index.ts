/**
 * @effort/drive — acceso a archivos en OneDrive.
 *
 * Un solo puerto (`DriveDeArchivos`) con dos implementaciones: `DriveFalso`
 * para tests y desarrollo sin credenciales, `DriveGraph` para producción una
 * vez que EFFORT complete el registro en Azure AD.
 */

export * from './puerto.js';
export * from './adaptadorFalso.js';
export * from './adaptadorGraph.js';
