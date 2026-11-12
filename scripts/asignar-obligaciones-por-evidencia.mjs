/**
 * Asigna a cada cliente activo las obligaciones del catálogo que SU PROPIA
 * EVIDENCIA demuestra que tiene, para que el sistema le genere vencimientos.
 *
 * **Por qué existe.** Daniel, 2026-11-12: el Panel, las notificaciones y
 * Vencimientos mostraban solo los 5 clientes del piloto, aunque el sistema ya
 * tenía cargados los archivos de los 87. Los vencimientos salen de
 * `obligacion_de_cliente`, y solo el piloto la tenía. La planilla que se le
 * pidió a EFFORT para confirmar las obligaciones (2026-10-05) no volvió.
 *
 * **La regla: se asigna solo lo que el cliente ya presentó.** No se supone el
 * régimen ni se adivina:
 *
 * | Obligación      | Se asigna si…                                                        |
 * |-----------------|----------------------------------------------------------------------|
 * | IVA_GENERAL     | hay formularios 120 leídos de al menos 3 meses distintos de 2026      |
 * | PLANILLA_RG90   | hay libros de compras o ventas de al menos 3 meses distintos de 2026  |
 * | IRE             | hay un formulario 500 leído del ejercicio 2024 o posterior            |
 * | EEFF            | hay un formulario 158 leído del ejercicio 2024 o posterior            |
 *
 * El umbral de 3 meses deja afuera a quien presentó una o dos veces (pudo
 * cambiar de régimen o ser un caso suelto): esos se listan para que Laura y Lili
 * decidan, no se asignan.
 *
 * **`desde` = 2026-10-01 por defecto.** El sistema genera los vencimientos del
 * mes anterior y del actual. Empezar en octubre muestra lo que vence ahora y lo
 * que viene, sin llenar la pantalla de atrasos de meses viejos cuya declaración
 * puede estar archivada en otro lado (EFFORT, 2026-09-21: un talón que no está en
 * OneDrive existe, guardado en otro lugar). Los meses anteriores se pueden
 * sumar después con otro `--desde`, una vez revisado.
 *
 * ---
 *
 * **Las tres preguntas de `CLAUDE.md`:**
 *
 * 1. *¿Es necesario?* Sí: sin obligación asignada no hay vencimiento, y sin
 *    vencimiento el Panel y Vencimientos no muestran al cliente.
 * 2. *¿Qué pasa si sale mal?* Simula por defecto. Con `--aplicar` exige un
 *    respaldo de la base del mismo día; solo INSERTA en `obligacion_de_cliente`
 *    (no hay UPDATE, DELETE ni `deleteMany` en este archivo), es idempotente (la
 *    clave única cliente+obligación hace que repetir no duplique), y cada alta
 *    deja un `cliente.actualizado` en la bitácora del cliente. Una asignación
 *    equivocada se corta poniéndole `hasta` desde la pantalla de Reglas — eso
 *    sí lo decide dirección, no este script.
 * 3. *¿Cuál es la forma correcta?* La de las operaciones masivas del proyecto:
 *    simular primero, escribir solo con `--aplicar`, respaldo previo, bitácora
 *    (`alta-masiva-clientes.mjs`, `aplicar-prorroga.mjs`).
 *
 * Uso:
 *   node scripts/asignar-obligaciones-por-evidencia.mjs              → simula (solo lee)
 *   node scripts/asignar-obligaciones-por-evidencia.mjs --aplicar    → escribe (pide respaldo de hoy)
 *   --desde AAAA-MM-DD   desde cuándo rigen (por defecto 2026-10-01)
 *   --codigos 001,002    solo esos clientes
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

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
cargarEntorno(`${RAIZ}.env`);

const argumentos = process.argv.slice(2);
const opcion = (nombre) => {
  const i = argumentos.indexOf(nombre);
  return i >= 0 ? argumentos[i + 1] : undefined;
};
const APLICAR = argumentos.includes('--aplicar');
const DESDE = opcion('--desde') ?? '2026-10-01';
const CODIGOS = opcion('--codigos')?.split(',').map((c) => c.trim()) ?? null;
if (!/^\d{4}-\d{2}-\d{2}$/.test(DESDE)) {
  console.error('--desde tiene que ser AAAA-MM-DD.');
  process.exit(1);
}

export const MESES_MINIMOS = 3;

/**
 * **Fuente principal: la planilla de EFFORT** (`CLIENTES - ARIANA CAMPOS DA
 * ROSA.xlsx`, columna OBLIGACIONES), pasada a
 * `docs/clientes/obligaciones-segun-planilla-ariana-2026-11-12.json` con el
 * código de carpeta corregido (13 números de la planilla no son el de la
 * carpeta: cruce del 2026-11-10). Daniel, 2026-11-12: «Acá está todo lo que debe
 * presentar cada cliente». Lo que la planilla dice manda sobre la evidencia.
 *
 * - IVA_GENERAL, IRE (general) y EEFF: según la planilla.
 * - PLANILLA_RG90: la planilla no la nombra; se asigna si hay libros de compras o
 *   ventas de al menos 3 meses de 2026 (evidencia propia).
 * - Un cliente activo sin fila en la planilla: solo por evidencia, con el mismo
 *   umbral, y se lista para que Laura y Lili confirmen.
 * - IRE SIMPLE, IRP, IDU, anticipos y retenciones: la planilla los marca pero el
 *   catálogo todavía no tiene su regla de vencimiento; se informan, no se asignan.
 */
export const RUTA_PLANILLA = 'docs/clientes/obligaciones-segun-planilla-ariana-2026-11-12.json';

const SIN_REGLA_TODAVIA = ['IRE_SIMPLE', 'IRP', 'IDU', 'ANT_IRE', 'RET_IDU', 'RET_IVA', 'RET_IRE', 'AUDITORIA'];

/** Qué obligaciones corresponden a un cliente. Pura: se prueba sin base. */
export function obligacionesDemostradas(evidencia, filaDePlanilla) {
  const asignar = [];
  const revisar = [];
  if (filaDePlanilla) {
    const dice = new Set(filaDePlanilla.obligaciones);
    if (dice.has('IVA')) asignar.push('IVA_GENERAL');
    if (dice.has('IRE_GRAL')) asignar.push('IRE');
    if (dice.has('EEFF')) asignar.push('EEFF');
    else if (evidencia.formularios158 > 0) revisar.push('EEFF: presentó formulario 158 pero la planilla no lo marca');
    if (!dice.has('IRE_GRAL') && evidencia.formularios500 > 0) revisar.push('IRE: presentó formulario 500 pero la planilla no marca IRE general');
    const sinRegla = SIN_REGLA_TODAVIA.filter((o) => dice.has(o));
    if (sinRegla.length > 0) revisar.push(`sin regla en el sistema todavía: ${sinRegla.join(', ')}`);
  } else {
    if (evidencia.mesesIva2026 >= MESES_MINIMOS) asignar.push('IVA_GENERAL');
    if (evidencia.formularios500 > 0) asignar.push('IRE');
    if (evidencia.formularios158 > 0) asignar.push('EEFF');
    revisar.push('no está en la planilla: asignado solo por lo que presentó');
  }
  if (evidencia.mesesLibros2026 >= MESES_MINIMOS) asignar.push('PLANILLA_RG90');
  else if (evidencia.mesesLibros2026 > 0) revisar.push(`RG 90: libros en solo ${evidencia.mesesLibros2026} mes(es) de 2026`);
  return { asignar, revisar };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const requerir = createRequire(`${RAIZ}apps/api/package.json`);
  const { PrismaClient } = requerir('@prisma/client');
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

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const catalogo = new Map(
      (await prisma.obligacionTributaria.findMany({
        where: { activa: true, confirmadaPorEffort: true },
        select: { id: true, codigo: true },
      })).map((o) => [o.codigo, o.id]),
    );
    for (const codigo of ['IVA_GENERAL', 'PLANILLA_RG90', 'IRE', 'EEFF']) {
      if (!catalogo.has(codigo)) throw new Error(`La obligación ${codigo} no está activa y confirmada en el catálogo.`);
    }

    const filas = await prisma.$queryRawUnsafe(`
      SELECT c.id, c.codigo, c.nombre, c.ruc,
        (SELECT count(DISTINCT l.periodo)::int FROM lectura_de_declaracion l
          WHERE l.cliente_id = c.id AND l.formulario = '120' AND l.periodo LIKE '2026-%') AS "mesesIva2026",
        (SELECT count(DISTINCT d.periodo)::int FROM documento d
          WHERE d.cliente_id = c.id AND d.tipo IN ('LIBRO_COMPRAS', 'LIBRO_VENTAS')
            AND d.periodo >= '2026-01' AND d.periodo <= '2026-10') AS "mesesLibros2026",
        (SELECT count(*)::int FROM lectura_de_declaracion l
          WHERE l.cliente_id = c.id AND l.formulario = '500' AND l.periodo >= '2024-12') AS "formularios500",
        (SELECT count(*)::int FROM lectura_de_declaracion l
          WHERE l.cliente_id = c.id AND l.formulario = '158' AND l.periodo >= '2024-12') AS "formularios158"
      FROM cliente c WHERE c.activo ORDER BY c.codigo NULLS LAST`);
    const yaAsignadas = new Set(
      (await prisma.obligacionDeCliente.findMany({ select: { clienteId: true, obligacionId: true } }))
        .map((a) => `${a.clienteId}|${a.obligacionId}`),
    );
    const operador = await prisma.usuario.findUnique({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });

    const planilla = JSON.parse(readFileSync(`${RAIZ}${RUTA_PLANILLA}`, 'utf8'));
    const plan = [];
    const paraRevisar = [];
    const sinNada = [];
    for (const f of filas) {
      if (CODIGOS && !CODIGOS.includes(f.codigo)) continue;
      const { asignar, revisar } = obligacionesDemostradas(f, planilla[f.codigo]);
      const nuevas = asignar.filter((codigo) => !yaAsignadas.has(`${f.id}|${catalogo.get(codigo)}`));
      if (nuevas.length > 0) plan.push({ cliente: f, nuevas });
      if (revisar.length > 0) paraRevisar.push(`${f.codigo} ${f.nombre}: ${revisar.join('; ')}`);
      if (asignar.length === 0) sinNada.push(`${f.codigo} ${f.nombre}`);
    }

    const cuenta = (codigo) => plan.filter((p) => p.nuevas.includes(codigo)).length;
    console.log(`\n${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (no escribe nada)'} · desde ${DESDE}`);
    console.log(`Clientes que reciben obligaciones nuevas: ${plan.length}`);
    console.log(`  IVA_GENERAL ${cuenta('IVA_GENERAL')} · PLANILLA_RG90 ${cuenta('PLANILLA_RG90')} · IRE ${cuenta('IRE')} · EEFF ${cuenta('EEFF')}`);
    const sinRuc = plan.filter((p) => !p.cliente.ruc).map((p) => `${p.cliente.codigo} ${p.cliente.nombre}`);
    if (sinRuc.length) console.log(`  Sin RUC (se asignan, pero no tendrán fecha hasta cargar el RUC): ${sinRuc.join(' | ')}`);
    console.log(`\nPara que Laura y Lili decidan (NO se asigna): ${paraRevisar.length}`);
    for (const linea of paraRevisar) console.log(`  ${linea}`);
    console.log(`\nSin ninguna obligación demostrada: ${sinNada.length}`);
    if (sinNada.length) console.log(`  ${sinNada.join(' | ')}`);

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
                data: {
                  clienteId: cliente.id,
                  obligacionId: catalogo.get(codigo),
                  desde: new Date(`${DESDE}T00:00:00.000Z`),
                  creadoPorUsuarioId: operador?.id ?? null,
                },
              }),
              prisma.eventLog.create({
                data: {
                  usuarioId: operador?.id ?? null,
                  accion: 'cliente.actualizado',
                  entidad: 'cliente',
                  entidadId: cliente.id,
                  clienteId: cliente.id,
                  datosDespues: {
                    obligacionAsignada: codigo,
                    desde: DESDE,
                    criterio: planilla[cliente.codigo] ? 'planilla de clientes de EFFORT (Ariana), columna OBLIGACIONES; RG 90 por libros propios' : 'evidencia propia del cliente (no figura en la planilla)',
                  },
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
