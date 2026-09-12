/**
 * @effort/drive — integración con Microsoft 365: archivos y correo.
 *
 * Empezó siendo solo OneDrive; cuando apareció el envío de avisos resultó que
 * usaba las mismas credenciales y el mismo flujo de token, así que vive acá en
 * vez de duplicar la autenticación en otro paquete.
 *
 * Un solo puerto (`DriveDeArchivos`) con dos implementaciones: `DriveFalso`
 * para tests y desarrollo sin credenciales, `DriveGraph` para producción una
 * vez que EFFORT complete el registro en Azure AD.
 */

export * from './puerto.js';
export * from './adaptadorFalso.js';
export * from './adaptadorGraph.js';
export * from './espejo.js';
export * from './autenticacionGraph.js';
export * from './correo.js';
