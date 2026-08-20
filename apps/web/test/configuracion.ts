/**
 * Configuración común de los tests de `apps/web`.
 *
 * Se carga antes de cada archivo de test (`setupFiles` en `vitest.config.ts`).
 * Hace dos cosas que, si faltaran, darían fallos difíciles de diagnosticar:
 *
 *  1. Registra los matchers de `jest-dom` (`toBeVisible`, `toBeDisabled`, …),
 *     que describen el estado real que ve una persona en pantalla en vez de
 *     obligar a revisar atributos del DOM a mano.
 *  2. Desmonta lo renderizado después de cada test. Sin esto, dos tests que
 *     rendericen la misma pantalla dejan dos copias en el documento y las
 *     consultas fallan con "se encontró más de un elemento" — un error que
 *     apunta al test equivocado.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
