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
          name: 'api',
          root: './apps/api',
          // Solo los tests que no tocan la base. Corren en milisegundos y no
          // dependen de nada externo, así que pueden correr siempre.
          include: ['test/*.test.ts'],
          environment: 'node',
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
