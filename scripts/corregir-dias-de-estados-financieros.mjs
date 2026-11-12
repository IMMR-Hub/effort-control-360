/**
 * Corrige el calendario de la obligación `EEFF` (estados financieros): de los
 * días determinativos (7 a 25) a los de las declaraciones informativas (8 a 26).
 *
 * Daniel, 2026-11-12: «Corrige los días de estados financieros a 8–26, como dice
 * la norma».
 *
 * **Fuente.** RG 38/2020 art. 8°: los estados financieros de los contribuyentes
 * del IRE Régimen General vencen el cuarto mes posterior al cierre **por el
 * calendario de DJI** del art. 6° (terminación 0 → día 8 … terminación 9 → día
 * 26), leída en dnit.gov.py el 2026-11-12. Es lo que `docs/DISCREPANCIAS.md`
 * (punto 19) ya advertía como «el error fácil de cometer al cargar las
 * obligaciones»: la fila se había cargado el 2026-09-13 con los días del IRE.
 *
 * **Qué cambia y qué no.**
 * - La fila del catálogo: lo que se genere de ahora en más sale con 8 a 26.
 * - Los vencimientos de EEFF ya generados que TODAVÍA NO VENCIERON, siguen
 *   vigentes y no tienen prórroga (los del ejercicio 2026 del piloto, abril de
 *   2027): se recalculan con el mismo cálculo del generador (`fechaDeVencimiento`
 *   de `@effort/core`, con feriados) y cada cambio queda en la bitácora del
 *   cliente con la fecha anterior. No es una prórroga: era la regla la que estaba
 *   mal, así que `fecha_vencimiento_original` no se usa.
 * - No se tocan: los ya presentados, los vencidos y los que tienen prórroga (los
 *   de 2025, regidos por la RG 50/2026). Una fecha pasada no se reescribe.
 *
 * Las tres preguntas: (1) necesario — el sistema decía una fecha un día anterior
 * a la legal; (2) si sale mal — es un UPDATE de una fila, con el valor anterior en
 * la bitácora; se revierte con otro UPDATE; exige respaldo de hoy; (3) forma
 * correcta — simular, `--aplicar`, bitácora.
 *
 * Uso (desde la raíz del repo):
 *   node scripts/corregir-dias-de-estados-financieros.mjs [--aplicar]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const APLICAR = process.argv.includes('--aplicar');
const INFORMATIVAS = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];

const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(() => import('@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
const { registrarEvento } = await import('@effort/api/dist/bitacora.js');
const { crearCalendario, fechaDeVencimiento, feriadosParaguay, periodoDesdeTexto } = await import('@effort/core');

try {
  if (APLICAR) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!readdirSync(join(RAIZ, 'respaldos')).some((f) => f.includes(hoy))) throw new Error('No hay respaldo de hoy: node scripts/respaldar-base.mjs');
  }
  const fila = await prisma.obligacionTributaria.findUnique({ where: { codigo: 'EEFF' } });
  if (!fila) throw new Error('No existe EEFF en el catálogo.');
  const generados = await prisma.vencimiento.groupBy({ by: ['periodo', 'estado'], where: { obligacionId: fila.id }, _count: true, orderBy: { periodo: 'asc' } });

  console.log(`${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (no escribe nada)'}`);
  console.log(`EEFF hoy: días ${fila.diasPorTerminacionRuc.join(' ')} · mes ${fila.mesDeCierreAnual}`);
  console.log(`EEFF nuevo: días ${INFORMATIVAS.join(' ')} · mes ${fila.mesDeCierreAnual}`);
  console.log('Vencimientos de EEFF ya generados:');
  for (const g of generados) console.log(`  período ${g.periodo} · ${g.estado}: ${g._count}`);

  // Los que se recalculan: vigentes, sin prórroga y con fecha todavía por delante.
  const ahora = new Date();
  const pendientes = await prisma.vencimiento.findMany({
    where: { obligacionId: fila.id, estado: 'VIGENTE', fechaVencimientoOriginal: null, fechaVencimiento: { gt: ahora } },
    select: { id: true, periodo: true, fechaVencimiento: true, clienteId: true, cliente: { select: { codigo: true, nombre: true, ruc: true } } },
    orderBy: { fechaVencimiento: 'asc' },
  });
  const recalculos = [];
  for (const v of pendientes) {
    if (!v.cliente.ruc || !v.periodo) continue;
    const periodo = periodoDesdeTexto(v.periodo);
    const f = fechaDeVencimiento({
      ruc: v.cliente.ruc, periodo, periodicidad: 'ANUAL', mesDeCierreAnual: fila.mesDeCierreAnual, diasPorTerminacion: INFORMATIVAS,
      calendario: crearCalendario([...feriadosParaguay(periodo.anio), ...feriadosParaguay(periodo.anio + 1)]),
    });
    const nueva = new Date(Date.UTC(f.anio, f.mes - 1, f.dia));
    if (nueva.getTime() !== v.fechaVencimiento.getTime()) recalculos.push({ v, nueva });
  }
  console.log(`Vencimientos vigentes a futuro que se recalculan: ${recalculos.length}`);
  for (const { v, nueva } of recalculos) {
    console.log(`  ${v.cliente.codigo} ${v.cliente.nombre} (RUC ${v.cliente.ruc}) · período ${v.periodo}: ${v.fechaVencimiento.toISOString().slice(0, 10)} → ${nueva.toISOString().slice(0, 10)}`);
  }

  const yaEsta = INFORMATIVAS.every((d, i) => fila.diasPorTerminacionRuc[i] === d);
  const operador = await prisma.usuario.findFirst({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });
  const bitacora = new BitacoraPrisma(prisma);
  const registro = { error: (x, m) => console.error(m, x) };
  if (APLICAR) {
    for (const { v, nueva } of recalculos) {
      await prisma.vencimiento.update({ where: { id: v.id }, data: { fechaVencimiento: nueva, actualizadoPorUsuarioId: operador.id } });
      await registrarEvento(bitacora, registro, {
        usuarioId: operador.id, accion: 'vencimiento.actualizado', entidad: 'vencimiento', entidadId: v.id, clienteId: v.clienteId,
        datosAntes: { fechaVencimiento: v.fechaVencimiento.toISOString().slice(0, 10) },
        datosDespues: { fechaVencimiento: nueva.toISOString().slice(0, 10), motivo: 'Corrección del calendario de estados financieros: RG 38/2020 art. 8° manda los días de DJI (8 a 26), no los determinativos (7 a 25)' },
      });
    }
    if (recalculos.length) console.log(`Recalculados: ${recalculos.length}.`);
  }
  if (yaEsta) console.log('El catálogo ya tenía los días 8 a 26.');
  else if (APLICAR) {
    const fuente = `${fila.fuente} Corregido el 2026-11-12 por orden de Daniel: RG 38/2020 art. 8° manda el calendario de DJI del art. 6° (días 8 a 26), no el determinativo (7 a 25) con que se había cargado.`;
    await prisma.obligacionTributaria.update({ where: { id: fila.id }, data: { diasPorTerminacionRuc: INFORMATIVAS, fuente: fuente.slice(0, 4000), actualizadoPorUsuarioId: operador.id } });
    await registrarEvento(bitacora, registro, {
      usuarioId: operador.id, accion: 'obligacion.actualizada', entidad: 'obligacion_tributaria', entidadId: fila.id, clienteId: null,
      datosAntes: { diasPorTerminacionRuc: fila.diasPorTerminacionRuc },
      datosDespues: { diasPorTerminacionRuc: INFORMATIVAS, motivo: 'RG 38/2020 art. 8°: los estados financieros van por el calendario de DJI (art. 6°)' },
    });
    console.log('Catálogo corregido.');
  } else console.log('\nNo se escribió nada. Para aplicar: --aplicar.');
} finally {
  await prisma.$disconnect();
}
