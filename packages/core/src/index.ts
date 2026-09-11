/**
 * @effort/core — motor de dominio de EFFORT Control 360.
 *
 * Este paquete no hace entrada/salida: no lee archivos, no toca la base de datos
 * y no llama a la red. Solo transforma datos. Eso lo hace verificable con tests
 * puros y deja el cálculo contable aislado de todo lo que puede fallar alrededor.
 */

export * from './dinero.js';
export * from './iva.js';
export * from './fechas.js';
export * from './comprobantes.js';
export * from './conciliacion.js';
export * from './balance.js';
export * from './diasHabiles.js';
export * from './seguimiento.js';
export * from './vencimientosTributarios.js';
export * from './clasificacionDeDocumentos.js';
