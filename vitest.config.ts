import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: './packages/core',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'schema',
          root: './packages/schema',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'drive',
          root: './packages/drive',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'importers',
          root: './packages/importers',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          root: './apps/api',
          // Solo los tests que no tocan la base. Corren en milisegundos y no
          // dependen de nada externo, así que pueden correr siempre.
          include: ['test/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Mismo plugin que apps/web/vite.config.ts: sin esto, el JSX de los
        // .jsx que usan el runtime automático (sin `import React`) no se
        // transforma igual en los tests que en `vite build`, y revienta con
        // "React is not defined" apenas se monta el primer componente .jsx.
        plugins: [react()],
        test: {
          name: 'web',
          root: './apps/web',
          include: ['test/**/*.test.{ts,tsx}'],
          // jsdom y no 'node': las pantallas se prueban como las ve una
          // persona (hacer clic, escribir, leer un mensaje de error), no
          // inspeccionando el estado interno de React.
          environment: 'jsdom',
          setupFiles: ['./test/configuracion.ts'],
        },
      },
      {
        test: {
          name: 'integracion',
          root: './apps/api',
          include: ['test/integracion/**/*.test.ts'],
          environment: 'node',
          // Cada consulta viaja hasta Supabase en São Paulo. Los 5 segundos por
          // defecto alcanzan para un test unitario, no para uno que hace varias
          // idas y vueltas contra una base remota.
          testTimeout: 30_000,
          hookTimeout: 120_000,
          // Un solo hilo: cada archivo crea y destruye su propio esquema, y
          // varios en paralelo agotarían el pool de 15 conexiones del plan Nano.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
