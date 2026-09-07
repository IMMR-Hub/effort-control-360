/**
 * Punto de entrada para correr el servidor como proceso real.
 *
 * `index.ts` expone `principal()` para que quien lo use decida cuándo
 * llamarlo (los tests nunca lo hacen, arman el servidor en memoria con
 * `construirServidor` + `.inject()`). Este archivo es el único lugar que
 * invoca `principal()` de verdad — hoy, exclusivamente para los tests
 * end-to-end de Playwright (`e2e/`), que necesitan un servidor real
 * escuchando en un puerto.
 */

import { principal } from './index.js';

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
