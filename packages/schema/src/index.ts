/**
 * @effort/schema — contratos de datos compartidos.
 *
 * Es la única definición de cada entidad. La API valida contra estos esquemas,
 * la interfaz deriva sus tipos de acá y la base de datos los refleja. Si un
 * campo existe en tres lugares con tres formas distintas, tarde o temprano los
 * tres divergen; acá hay uno solo.
 */

export * from './primitivos.js';
export * from './entidades.js';
