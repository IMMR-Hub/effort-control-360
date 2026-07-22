#!/usr/bin/env node
/**
 * Puerta de verificación de EFFORT Control 360.
 *
 * Corre todos los checks, escribe `verify-report.json` y devuelve exit 0 solo
 * si todos pasaron. Es el único comando que decide si algo está terminado:
 * "funciona en mi máquina" no cuenta, la salida de este script sí.
 *
 * Los checks se agregan acá a medida que el sistema crece. Un check que todavía
 * no aplica se declara con `pendiente: true` y aparece en el reporte como
 * pendiente, en vez de desaparecer: un check ausente se lee como "cubierto".
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{nombre: string, comando: string, pendiente?: string}[]} */
const CHECKS = [
  { nombre: 'typecheck', comando: 'npx tsc --build' },
  { nombre: 'test:unit', comando: 'npx vitest run' },
  { nombre: 'verify:accounting', comando: 'npx vitest run packages/core/test/golden.test.ts' },

  // Checks previstos que todavía no tienen sobre qué correr. Se declaran
  // explícitamente para que el reporte muestre la cobertura real del sistema.
  { nombre: 'lint', comando: 'npx eslint .', pendiente: 'Falta configurar ESLint (slice de calidad).' },
  { nombre: 'verify:rbac', comando: 'npx vitest run apps/api/test/rbac.test.ts' },
  { nombre: 'verify:seguridad', comando: 'npx vitest run apps/api/test/seguridad.test.ts' },
  { nombre: 'verify:contratos', comando: 'npx vitest run packages/schema/test/contratos.test.ts' },
  { nombre: 'verify:servidor', comando: 'npx vitest run apps/api/test/servidor.test.ts' },
  { nombre: 'test:integration', comando: 'npx vitest run --project integracion' },
  { nombre: 'verify:drive', comando: 'npm run verify:drive --workspace @effort/drive', pendiente: 'packages/drive todavía no existe.' },
  { nombre: 'verify:no-hardcoded-kpi', comando: 'node scripts/verificar-kpi.mjs', pendiente: 'apps/web todavía muestra los datos de la demo anterior.' },
  { nombre: 'test:e2e', comando: 'npx playwright test', pendiente: 'apps/web todavía no consume la API.' },
  { nombre: 'audit', comando: 'npm audit --audit-level=high' },
  { nombre: 'build', comando: 'npm run build' },
];

const resultados = [];
let hayFallas = false;

for (const check of CHECKS) {
  if (check.pendiente) {
    resultados.push({
      nombre: check.nombre,
      comando: check.comando,
      estado: 'PENDIENTE',
      detalle: check.pendiente,
    });
    console.log(`  ·  ${check.nombre.padEnd(24)} PENDIENTE — ${check.pendiente}`);
    continue;
  }

  const inicio = Date.now();
  const ejecucion = spawnSync(check.comando, {
    cwd: raiz,
    shell: true,
    encoding: 'utf8',
  });
  const duracion = Date.now() - inicio;
  const codigo = ejecucion.status ?? 1;
  const paso = codigo === 0;

  if (!paso) hayFallas = true;

  const salida = `${ejecucion.stdout ?? ''}${ejecucion.stderr ?? ''}`.trim();

  resultados.push({
    nombre: check.nombre,
    comando: check.comando,
    estado: paso ? 'OK' : 'FALLO',
    exit_code: codigo,
    duracion_ms: duracion,
    detalle: paso ? '' : salida.slice(-4000),
  });

  console.log(
    `  ${paso ? '✓' : '✗'}  ${check.nombre.padEnd(24)} ${paso ? 'OK' : `FALLO (exit ${codigo})`}  ${duracion}ms`,
  );

  if (!paso) {
    console.error(salida.slice(-2000));
  }
}

const commit = spawnSync('git rev-parse HEAD', { cwd: raiz, shell: true, encoding: 'utf8' });

const reporte = {
  generado_en: new Date().toISOString(),
  commit: (commit.stdout ?? '').trim(),
  checks: resultados,
  checks_ok: resultados.filter((r) => r.estado === 'OK').length,
  checks_pendientes: resultados.filter((r) => r.estado === 'PENDIENTE').length,
  checks_fallidos: resultados.filter((r) => r.estado === 'FALLO').length,
  todo_verde: !hayFallas,
};

writeFileSync(join(raiz, 'verify-report.json'), `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');

console.log(
  `\n  ${reporte.checks_ok} OK · ${reporte.checks_pendientes} pendientes · ${reporte.checks_fallidos} fallidos`,
);
console.log('  Reporte escrito en verify-report.json');

process.exit(hayFallas ? 1 : 0);
