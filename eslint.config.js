// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Config de ESLint (flat config, v9).
 *
 * A propósito sin las reglas "type-checked" de typescript-eslint (las que
 * exigen `parserOptions.project`): este es un monorepo con un `tsconfig`
 * distinto por paquete y varios que ni siquiera son parte del grafo de
 * `tsc --build` (`e2e/`, `apps/web`) — armar esa relación en ESLint hoy
 * sería una tarea en sí misma, separada de simplemente dejar de tener el
 * check en `pendiente`. Lo que sí importa (tipos, `exactOptionalPropertyTypes`,
 * etc.) ya lo cubren `typecheck`, `verify:web-typecheck` y
 * `verify:e2e-typecheck` — ESLint acá agrega lo que esos no hacen: variables
 * sin usar, patrones inseguros de JS, reglas básicas de estilo.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'apps/web/dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // El propio compilador de TS (`noUnusedLocals`/`noUnusedParameters` no
      // están activos, pero `noUncheckedIndexedAccess` y el resto de
      // `tsconfig.base.json` ya cubren la seguridad de tipos) no marca
      // variables sin usar — esta regla sí, y es justo lo que ESLint debería
      // agregar por encima del typecheck. `_` como prefijo para lo que se
      // descarta a propósito (parámetros de callback que no se usan, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` explícito ya aparece en algunos puntos de interoperabilidad
      // deliberados (ver comentarios en el código correspondiente) — se
      // permite pero como warning, no como error, para no bloquear el check
      // por casos ya evaluados y no repetir la discusión acá.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Solo las pantallas: son el único lugar del repo con hooks de React.
    files: ['apps/web/src/**/*.{ts,tsx,js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Solo las dos reglas clásicas, no el paquete `flat.recommended`
      // completo de la v7 — ese incluye una decena de reglas nuevas
      // orientadas al React Compiler que nadie pidió ni el código anticipó.
      // Varias pantallas ya traían comentarios `eslint-disable-next-line
      // react-hooks/exhaustive-deps` escritos antes de que este plugin
      // existiera en el proyecto — esto es exactamente lo que esos
      // comentarios esperaban que se configurara.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Scripts de Node en la raíz (`scripts/*.mjs`): `console`/`process` son
    // globals reales acá, no errores de `no-undef`.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
