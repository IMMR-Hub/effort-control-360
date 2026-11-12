/**
 * Asigna a cada cliente activo las obligaciones que dice la planilla de
 * clientes de EFFORT, y NADA MÁS, para que el sistema les genere vencimientos.
 *
 * **Por qué existe.** Daniel, 2026-11-12: el Panel, las notificaciones y
 * Vencimientos mostraban solo los 5 clientes del piloto, porque solo ellos
 * tenían `obligacion_de_cliente`. La fuente es la planilla
 * `CLIENTES - ARIANA CAMPOS DA ROSA.xlsx` (columna OBLIGACIONES): «Acá está todo
 * lo que debe presentar cada cliente, en qué mes y a qué usuario le
 * corresponde» y «Solo lo que está en el Excel, no inventes otra cosa».
 *
 * La planilla está pasada a
 * `docs/clientes/obligaciones-segun-planilla-ariana-2026-11-12.json`, con el
 * código de carpeta resuelto nombre por nombre (13 números de la columna DRIVE
 * no son el de la carpeta: LILCY/ECOAGRO/SETRINI corridos, QUIMECO/R3J
 * cruzados, ALMA BENITEZ es la 105, MBV la 118, NR GANADERA la 088, DIEGO
 * BECONI la 023).
 *
 * | Planilla  | Obligación del catálogo |
 * |-----------|-------------------------|
 * | IVA       | IVA_GENERAL             |
 * | IRE GRAL  | IRE                     |
 * | EEFF      | EEFF                    |
 *
 * Lo demás que marca la planilla (IRP, IRE SIMPLE, IDU, anticipos de IRE,
 * retenciones, auditoría impositiva) todavía no tiene regla de vencimiento en el
 * catálogo: se informa como faltante, no se asigna. RG 90 no figura en la
 * planilla y no se asigna. Clientes en suspensión o «S/M» sin impuesto marcado:
 * nada.
 *
 * **`desde` = 2026-10-01 por defecto.** El sistema genera los vencimientos del
 * mes anterior y del actual: arrancar en octubre muestra lo que vence ahora y lo
 * que viene, sin una pila de atrasos de meses viejos.
 *
 * ---
 *
 * **Las tres preguntas de `CLAUDE.md`:**
 *
 * 1. *¿Es necesario?* Sí: sin obligación asignada no hay vencimiento.
 * 2. *¿Qué pasa si sale mal?* Simula por defecto. Con `--aplicar` exige un
 *    respaldo de la base del mismo día; solo INSERTA en `obligacion_de_cliente`
 *    (no hay UPDATE, DELETE ni `deleteMany` en este archivo); es idempotente; y
 *    cada alta deja un `cliente.actualizado` en la bitácora del cliente. Una
 *    asignación equivocada se corta poniéndole `hasta`.
 * 3. *¿Cuál es la forma correcta?* La de las operaciones masivas del proyecto:
 *    simular, escribir solo con `--aplicar`, respaldo previo, bitácora.
 *
 * Uso:
 *   node scripts/asignar-obligaciones-segun-planilla.mjs              → simula (solo lee)
 *   node scripts/asignar-obligaciones-segun-planilla.mjs --aplicar    → escribe (pide respaldo de hoy)
 *   --desde AAAA-MM-DD   desde cuándo rigen (por defecto 2026-10-01)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const RUTA_PLANILLA = 'docs/clientes/obligaciones-segun-planilla-ariana-2026-11-12.json';

/** De la planilla al catálogo. Lo que no está acá no tiene regla todavía. */
export const CATALOGO_POR_MARCA = { IVA: 'IVA_GENERAL', IRE_GRAL: 'IRE', EEFF: 'EEFF' };
const NOMBRE_SIN_REGLA = {
  IRP: 'IRP', IRE_SIMPLE: 'IRE SIMPLE', IDU: 'IDU', ANT_IRE: 'anticipos de IRE', RET_IDU: 'retención de IDU',
  RET_IVA: 'retención de IVA', RET_IRE: 'retenciones IRE/IRP/INR', AUDITORIA: 'auditoría impositiva',
};

/** Qué se asigna y qué queda como faltante, para una fila de la planilla. Pura. */
export function planDeLaFila(fila) {
  if (!fila) return { asignar: [], sinRegla: [], nota: 'no está en la planilla' };
  const asignar = fila.obligaciones.filter((m) => CATALOGO_POR_MARCA[m]).map((m) => CATALOGO_POR_MARCA[m]);
  const sinRegla = fila.obligaciones.filter((m) => !CATALOGO_POR_MARCA[m]).map((m) => NOMBRE_SIN_REGLA[m] ?? m);
  const nota = fila.estado === 'SUSPENSIÓN' ? 'en suspensión' : fila.obligaciones.length === 0 ? (fila.texto || 'sin obligaciones marcadas') : null;
  return { asignar, sinRegla, nota };
}

function cargarEntorno(ruta) {
  try {
    for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
      const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* Sin .env se usa lo que ya esté en el entorno. */
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cargarEntorno(`${RAIZ}.env`);
  const argumentos = process.argv.slice(2);
  const APLICAR = argumentos.includes('--aplicar');
  const i = argumentos.indexOf('--desde');
  const DESDE = i >= 0 ? argumentos[i + 1] : '2026-10-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DESDE)) {
    console.error('--desde tiene que ser AAAA-MM-DD.');
    process.exit(1);
  }

  const { PrismaClient } = createRequire(`${RAIZ}apps/api/package.json`)('@prisma/client');
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
    process.exit(1);
  }
  if (APLICAR) {
    const hoy = new Date().toISOString().slice(0, 10);
    let respaldos = [];
    try {
      respaldos = readdirSync(`${RAIZ}respaldos`).filter((f) => f.startsWith(`respaldo-${hoy}`));
    } catch {
      /* sin carpeta de respaldos */
    }
    if (respaldos.length === 0) {
      console.error(`--aplicar exige un respaldo de hoy (${hoy}): corré antes  node scripts/respaldar-base.mjs`);
      process.exit(1);
    }
    console.log(`Respaldo de hoy: ${respaldos.at(-1)}`);
  }

  const planilla = JSON.parse(readFileSync(`${RAIZ}${RUTA_PLANILLA}`, 'utf8'));
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const catalogo = new Map(
      (await prisma.obligacionTributaria.findMany({ where: { activa: true, confirmadaPorEffort: true }, select: { id: true, codigo: true } }))
        .map((o) => [o.codigo, o.id]),
    );
    for (const codigo of Object.values(CATALOGO_POR_MARCA)) {
      if (!catalogo.has(codigo)) throw new Error(`La obligación ${codigo} no está activa y confirmada en el catálogo.`);
    }
    const clientes = await prisma.cliente.findMany({ where: { activo: true }, select: { id: true, codigo: true, nombre: true, ruc: true }, orderBy: { codigo: 'asc' } });
    const yaAsignadas = new Set(
      (await prisma.obligacionDeCliente.findMany({ select: { clienteId: true, obligacionId: true } })).map((a) => `${a.clienteId}|${a.obligacionId}`),
    );
    const operador = await prisma.usuario.findUnique({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });

    const plan = [];
    const faltantes = [];
    for (const c of clientes) {
      const { asignar, sinRegla, nota } = planDeLaFila(planilla[c.codigo]);
      const nuevas = asignar.filter((codigo) => !yaAsignadas.has(`${c.id}|${catalogo.get(codigo)}`));
      if (nuevas.length > 0) plan.push({ cliente: c, nuevas });
      const falta = [];
      if (!c.ruc && asignar.length > 0) falta.push('RUC (sin RUC no hay fecha de vencimiento)');
      if (sinRegla.length > 0) falta.push(`regla de vencimiento de ${sinRegla.join(', ')}`);
      if (falta.length > 0 || nota) faltantes.push(`${c.codigo} ${c.nombre}: ${[nota, ...falta].filter(Boolean).join(' · ')}`);
    }
    const sinFila = Object.keys(planilla).filter((cod) => !clientes.some((c) => c.codigo === cod));

    const cuenta = (codigo) => plan.filter((p) => p.nuevas.includes(codigo)).length;
    console.log(`\n${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (no escribe nada)'} · desde ${DESDE}`);
    console.log(`Clientes que reciben obligaciones nuevas: ${plan.length} · IVA_GENERAL ${cuenta('IVA_GENERAL')} · IRE ${cuenta('IRE')} · EEFF ${cuenta('EEFF')}`);
    console.log(`\nIncompletos y lo que les falta: ${faltantes.length}`);
    for (const linea of faltantes) console.log(`  ${linea}`);
    if (sinFila.length) console.log(`\nEn la planilla pero no activos en el sistema: ${sinFila.join(', ')}`);

    if (!APLICAR) {
      console.log('\nNo se escribió nada. Para aplicar: respaldo de hoy y --aplicar.');
    } else {
      let altas = 0;
      const fallos = [];
      for (const { cliente, nuevas } of plan) {
        for (const codigo of nuevas) {
          try {
            await prisma.$transaction([
              prisma.obligacionDeCliente.create({
                data: { clienteId: cliente.id, obligacionId: catalogo.get(codigo), desde: new Date(`${DESDE}T00:00:00.000Z`), creadoPorUsuarioId: operador?.id ?? null },
              }),
              prisma.eventLog.create({
                data: {
                  usuarioId: operador?.id ?? null,
                  accion: 'cliente.actualizado',
                  entidad: 'cliente',
                  entidadId: cliente.id,
                  clienteId: cliente.id,
                  datosDespues: { obligacionAsignada: codigo, desde: DESDE, criterio: 'planilla de clientes de EFFORT (CLIENTES - ARIANA CAMPOS DA ROSA.xlsx), columna OBLIGACIONES' },
                },
              }),
            ]);
            altas += 1;
          } catch (error) {
            if (error?.code === 'P2002') continue; // ya estaba: repetir es seguro
            fallos.push(`${cliente.codigo} ${codigo}: ${error instanceof Error ? error.message.slice(0, 120) : 'error'}`);
          }
        }
      }
      console.log(`\nListo: ${altas} obligaciones asignadas, ${fallos.length} fallos.`);
      for (const f of fallos) console.log(`  FALLÓ ${f}`);
      console.log('Los vencimientos aparecen en la próxima vuelta del cálculo (cada hora) o con «Actualizar ahora».');
    }
  } finally {
    await prisma.$disconnect();
  }
}
