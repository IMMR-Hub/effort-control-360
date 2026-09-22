#!/usr/bin/env node
/**
 * Completa el saldo de IVA declarado en las lecturas YA hechas (tarea 138).
 *
 * **Por qué hace falta, y no alcanza con esperar.** `detectorDePresentaciones`
 * solo lee un PDF una vez: `pdfsPorLeer` filtra por
 * `lectura_de_declaracion.evidencia_id IS NULL`. Las 230 declaraciones de IVA
 * (formulario 120) que ya se leyeron ANTES de esta tarea nunca se van a
 * volver a mirar solas, así que sus dos columnas nuevas
 * (`saldo_a_favor_a_trasladar`, `saldo_a_favor_periodo_anterior`) van a
 * quedar en NULL para siempre si nadie las completa una vez. Verificado en
 * producción el 2026-09-22: 230 lecturas de formulario 120, 0 con saldo.
 *
 * **Qué NO toca.** Solo actualiza las dos columnas de saldo. Nunca escribe
 * `numero_de_orden`, `fecha_de_presentacion` ni `ruc`: esos datos ya están
 * correctos (son los que el detector usa para marcar presentaciones, y una
 * presentación ya marcada no se vuelve a tocar). Es de solo lectura contra
 * OneDrive — nunca escribe, mueve ni borra un archivo real de EFFORT
 * (`CLAUDE.md`, regla 5).
 *
 * ---
 *
 * **Las tres preguntas de `CLAUDE.md`:**
 *
 * 1. *¿Es necesario?* Sí: sin esto, la columna nueva de la pantalla de IVA
 *    dice "sin declaración leída" para el 100% de los períodos, para siempre,
 *    aunque el PDF con el saldo ya esté en el sistema.
 * 2. *¿Qué pasa si sale mal?* Nada irreversible: dos columnas nullable, un
 *    `UPDATE` que no toca ninguna otra. Simula por defecto. Si una extracción
 *    da un valor raro, no escribe nada distinto de lo que el PDF dice.
 * 3. *¿Cuál es la forma correcta?* La misma que ya usa el detector: leer el
 *    PDF de OneDrive (solo lectura), extraer texto, reconocer el saldo con la
 *    misma función ya probada (`extraerSaldoDeIvaDeclarado`).
 *
 * Uso:
 *   node scripts/completar-saldo-de-iva.mjs             → simula
 *   node scripts/completar-saldo-de-iva.mjs --aplicar   → escribe
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function cargarEntorno(ruta) {
  try {
    for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
      const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Sin .env se usa lo que ya esté en el entorno.
  }
}

async function principal() {
  const aplicar = process.argv.includes('--aplicar');

  cargarEntorno(fileURLToPath(new URL('../.env', import.meta.url)));
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
    process.exit(1);
  }
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    console.error('Faltan las credenciales de Azure (AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET).');
    process.exit(1);
  }

  const { PrismaClient } = await import(
    '@effort/api/node_modules/@prisma/client/default.js'
  ).catch(() => import('@prisma/client'));
  const { DriveGraph } = await import('@effort/drive');
  const { extraerTextoDePdf } = await import('@effort/api/dist/servicios/textoDePdf.js');
  const { extraerSaldoDeIvaDeclarado } = await import('@effort/importers');

  const prisma = new PrismaClient({ datasourceUrl: url });
  // `lectura_de_declaracion` guarda `evidencia.item_id_onedrive`, que es el id
  // en el drive del SISTEMA (`effort360@effort.com.py`, la copia que la
  // sincronización ya hizo) — no el drive de ORIGEN donde Laura/Lili trabajan.
  // `detectarPresentaciones` en producción lee con `deps.drive` (el del
  // sistema), nunca con `deps.driveDeOrigen`; usar el de origen acá daba 404
  // en los 230, incluidos archivos de agosto de 2026 recién sincronizados.
  const drive = new DriveGraph({
    tenantId: AZURE_TENANT_ID,
    clientId: AZURE_CLIENT_ID,
    clientSecret: AZURE_CLIENT_SECRET,
    usuarioPrincipal: process.env.ONEDRIVE_USUARIO_SISTEMA ?? 'effort360@effort.com.py',
    ...(process.env.AZURE_DRIVE_ID ? { driveId: process.env.AZURE_DRIVE_ID } : {}),
  });

  try {
    const pendientes = await prisma.$queryRaw`
      SELECT l."evidencia_id", l."cliente_id", l."periodo", e."item_id_onedrive", e."nombre_archivo"
      FROM "lectura_de_declaracion" l
      JOIN "evidencia" e ON e."id" = l."evidencia_id"
      WHERE l."formulario" = '120'
        AND l."saldo_a_favor_a_trasladar" IS NULL
        AND e."item_id_onedrive" IS NOT NULL
      ORDER BY l."periodo" DESC
    `;

    console.log(`\nDeclaraciones de IVA sin saldo completado: ${pendientes.length}\n`);

    let completadas = 0;
    let sinCasilla47 = 0;
    let fallos = 0;

    for (const fila of pendientes) {
      let saldo;
      try {
        const contenido = await drive.leer(fila.item_id_onedrive);
        const texto = await extraerTextoDePdf(contenido);
        saldo = extraerSaldoDeIvaDeclarado(texto);
      } catch (motivo) {
        fallos += 1;
        console.log(
          `  FALLO  ${fila.periodo}  ${fila.nombre_archivo}: ` +
            (motivo instanceof Error ? motivo.message : String(motivo)),
        );
        continue;
      }

      if (!saldo) {
        sinCasilla47 += 1;
        console.log(`  SIN CASILLA 47  ${fila.periodo}  ${fila.nombre_archivo}`);
        continue;
      }

      console.log(
        `  ${aplicar ? 'COMPLETADA' : 'A COMPLETAR'}  ${fila.periodo}  ${fila.nombre_archivo}: ` +
          `saldo a trasladar ${saldo.saldoATrasladar}`,
      );
      completadas += 1;

      if (aplicar) {
        await prisma.$executeRaw`
          UPDATE "lectura_de_declaracion"
          SET "saldo_a_favor_a_trasladar" = ${saldo.saldoATrasladar},
              "saldo_a_favor_periodo_anterior" = ${saldo.saldoDePeriodoAnterior}
          WHERE "evidencia_id" = ${fila.evidencia_id}::uuid
        `;
      }
    }

    console.log(
      `\n${aplicar ? 'Completadas' : 'A completar'}: ${completadas} · sin casilla 47: ${sinCasilla47} · ` +
        `fallos de lectura: ${fallos}`,
    );
    if (!aplicar) {
      console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar para hacerlo de verdad.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

await principal();
