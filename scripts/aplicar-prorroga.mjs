#!/usr/bin/env node
/**
 * Aplica una prórroga de la DNIT a toda una obligación, sin navegador.
 *
 * **Por qué existe, y no alcanza con el botón de la pantalla.** Daniel,
 * 2026-09-22: *"ahora son 4 pero luego serán más de 140 y va a aumentar mes a
 * mes"*. El botón sirve cuando hay alguien mirando la pantalla; esto sirve
 * siempre, y es lo que permite que la operación la haga quien está trabajando
 * —persona o Claude— sin depender de una sesión abierta ni de la contraseña de
 * nadie (`CLAUDE.md`, regla 5 del roadmap: nunca se inicia sesión como Daniel).
 *
 * **El trabajo no crece con los clientes: crece con las resoluciones.** Una RG
 * de prórroga alcanza a todos los contribuyentes de un régimen, así que esto es
 * una corrida por resolución, sean 5 clientes o 500.
 *
 * ---
 *
 * **Las tres preguntas de `CLAUDE.md`, escritas antes de la primera corrida:**
 *
 * 1. *¿Es necesario?* Sí. Los cinco EEFF del ejercicio 2025 tienen fecha de
 *    abril y la RG 50/2026 los corrió al 30/06/2026; hasta que se cargue, el
 *    sistema muestra a tres clientes con 60 a 64 días de atraso que en realidad
 *    presentaron a tiempo. Un atraso falso dicho con seguridad es peor que no
 *    decir nada.
 * 2. *¿Qué pasa si sale mal?* Se puede deshacer: la fecha que fijaba el
 *    calendario queda guardada en `fecha_vencimiento_original`, y cada cambio
 *    deja su entrada en `event_log` con el valor anterior. Además simula por
 *    defecto: sin `--aplicar` no escribe una sola fila. No borra nada, no toca
 *    OneDrive y no envía ningún correo.
 * 3. *¿Cuál es la forma correcta?* La que el proyecto ya usa para una
 *    operación masiva: simular primero y escribir solo cuando se pide
 *    explícitamente, igual que `reclasificar-documentos.mjs`. Las mismas
 *    reglas que la ruta de la API (`POST /api/v1/vencimientos/prorrogar-lote`):
 *    la primera prórroga guarda el origen y una segunda no lo pisa, los que ya
 *    están en la fecha nueva se saltan, y queda una entrada de bitácora por
 *    vencimiento.
 *
 * Uso:
 *   node scripts/aplicar-prorroga.mjs --descripcion "Estados Financieros — período 2025-12" \
 *       --nueva-fecha 2026-06-30 --motivo "RG 50/2026"            → simula
 *   node scripts/aplicar-prorroga.mjs ... --aplicar                → escribe
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Qué se corre y qué no, dado lo que hay en la base.
 *
 * Pura a propósito: es la única parte con criterio, y así se prueba sin base.
 * Saltear los que ya están en la fecha nueva es lo que hace que repetir la
 * corrida sea seguro — y una corrida que se puede repetir es una que se puede
 * reintentar cuando la red se corta a la mitad, que en esta máquina pasa.
 */
export function planificarProrroga(filas, nuevaFecha) {
  const aCorrer = [];
  const yaEstaban = [];

  for (const fila of filas) {
    const actual = fila.fecha_vencimiento.toISOString().slice(0, 10);
    if (actual === nuevaFecha) {
      yaEstaban.push(fila);
      continue;
    }
    aCorrer.push({
      ...fila,
      fechaAnterior: actual,
      // Solo la PRIMERA prórroga guarda el origen: lo que hay que poder
      // mostrar dentro de seis meses es la fecha que fijaba el calendario, no
      // una prórroga intermedia.
      fechaOriginal: fila.fecha_vencimiento_original
        ? fila.fecha_vencimiento_original.toISOString().slice(0, 10)
        : actual,
    });
  }

  return { aCorrer, yaEstaban };
}

/** Lee un argumento con valor: `--clave valor`. */
export function argumento(argv, clave) {
  const indice = argv.indexOf(`--${clave}`);
  return indice >= 0 && argv[indice + 1] ? argv[indice + 1] : null;
}

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
  const argv = process.argv.slice(2);
  const descripcion = argumento(argv, 'descripcion');
  const nuevaFecha = argumento(argv, 'nueva-fecha');
  const motivo = argumento(argv, 'motivo');
  const aplicar = argv.includes('--aplicar');

  if (!descripcion || !nuevaFecha || !motivo) {
    console.error(
      'Faltan datos. Uso:\n' +
        '  node scripts/aplicar-prorroga.mjs --descripcion "<obligación — período>" \\\n' +
        '      --nueva-fecha AAAA-MM-DD --motivo "RG 50/2026" [--aplicar]',
    );
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)) {
    console.error('La fecha nueva va en formato AAAA-MM-DD.');
    process.exit(1);
  }

  cargarEntorno(fileURLToPath(new URL('../.env', import.meta.url)));
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
    process.exit(1);
  }

  const { PrismaClient } = await import(
    '@effort/api/node_modules/@prisma/client/default.js'
  ).catch(() => import('@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: url });

  try {
    const filas = await prisma.$queryRaw`
      SELECT v."id", v."cliente_id", v."descripcion", v."estado",
             v."fecha_vencimiento", v."fecha_vencimiento_original",
             c."nombre" AS cliente
      FROM "vencimiento" v
      JOIN "cliente" c ON c."id" = v."cliente_id"
      WHERE v."descripcion" = ${descripcion} AND v."estado" <> 'NO_APLICA'
      ORDER BY c."nombre"
    `;

    const { aCorrer, yaEstaban } = planificarProrroga(filas, nuevaFecha);

    console.log(`\nObligación: ${descripcion}`);
    console.log(`Fecha nueva: ${nuevaFecha} · motivo: ${motivo}`);
    console.log(`Alcanzados: ${filas.length} · a correr: ${aCorrer.length} · ya estaban: ${yaEstaban.length}\n`);
    for (const fila of aCorrer) {
      console.log(
        `  ${String(fila.cliente).padEnd(38)} ${fila.fechaAnterior} → ${nuevaFecha}  (${fila.estado})`,
      );
    }
    for (const fila of yaEstaban) {
      console.log(`  ${String(fila.cliente).padEnd(38)} ya estaba en ${nuevaFecha}`);
    }

    if (!aplicar) {
      console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar para hacerlo de verdad.');
      return;
    }
    if (aCorrer.length === 0) {
      console.log('\nNo hay nada que correr.');
      return;
    }

    // La bitácora tiene que decir quién hizo el cambio. Se usa la cuenta del
    // sistema y se deja dicho, en los datos del evento, que entró por este
    // script y no por la pantalla: dentro de seis meses la diferencia importa.
    const [operador] = await prisma.$queryRaw`
      SELECT "id" FROM "usuario" WHERE "correo" = 'effort360@effort.com.py' LIMIT 1
    `;
    if (!operador) {
      console.error('No se encontró la cuenta del sistema para atribuir el cambio. Se aborta.');
      process.exitCode = 1;
      return;
    }

    for (const fila of aCorrer) {
      await prisma.$transaction([
        prisma.$executeRaw`
          UPDATE "vencimiento"
          SET "fecha_vencimiento" = ${new Date(`${nuevaFecha}T00:00:00.000Z`)},
              "fecha_vencimiento_original" = ${new Date(`${fila.fechaOriginal}T00:00:00.000Z`)},
              "motivo_prorroga" = ${motivo},
              "actualizado_por_usuario_id" = ${operador.id}::uuid
          WHERE "id" = ${fila.id}::uuid
        `,
        prisma.$executeRaw`
          INSERT INTO "event_log" ("id", "usuario_id", "accion", "entidad", "entidad_id",
                                   "cliente_id", "datos_antes", "datos_despues")
          VALUES (gen_random_uuid(), ${operador.id}::uuid, 'vencimiento.prorrogado', 'vencimiento',
                  ${fila.id}, ${fila.cliente_id}::uuid,
                  ${JSON.stringify({ fechaVencimiento: fila.fechaAnterior })}::jsonb,
                  ${JSON.stringify({
                    fechaVencimiento: nuevaFecha,
                    motivo,
                    via: 'scripts/aplicar-prorroga.mjs',
                  })}::jsonb)
        `,
      ]);
      console.log(`  aplicado: ${fila.cliente}`);
    }

    console.log(`\nListo: ${aCorrer.length} vencimientos corridos al ${nuevaFecha}.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre como CLI; importarlo desde un test no dispara nada.
if (process.argv[1] && realpathSeguro(process.argv[1]) === realpathSeguro(fileURLToPath(import.meta.url))) {
  await principal();
}

function realpathSeguro(ruta) {
  try {
    return fileURLToPath(new URL(`file://${ruta}`)).replace(/\\/g, '/').toLowerCase();
  } catch {
    return String(ruta).replace(/\\/g, '/').toLowerCase();
  }
}
