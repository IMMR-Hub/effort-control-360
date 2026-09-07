import { defineConfig, devices } from '@playwright/test';

/**
 * Config de los tests end-to-end.
 *
 * Un solo worker, sin paralelismo: todos los specs comparten el mismo
 * esquema de PostgreSQL y el mismo servidor real levantados por
 * `e2e/entorno-global.ts` — correrlos en paralelo pisaría datos entre sí.
 * Es el mismo criterio que ya usa `test:integration` (`fileParallelism:
 * false` en `vitest.config.ts`), por la misma razón.
 */
export default defineConfig({
  testDir: './e2e/pruebas',
  globalSetup: './e2e/entorno-global.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  // Generoso a propósito: el servidor real arranca en frío en cada corrida
  // (sin caché de JIT ni de Vite), y el login pasa por Argon2id real, lento
  // por diseño (ver `apps/api/src/seguridad/credenciales.ts`) — 5s por
  // defecto no alcanza para la primera petición real del proceso.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env['E2E_WEB_URL'] ?? 'http://localhost:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
