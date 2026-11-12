/**
 * Carga la regla de vencimiento de IRP, IRE SIMPLE, IDU (declaración informativa)
 * y anticipos de IRE, que hasta hoy estaban en el catálogo «sin regla» (sin
 * confirmar y sin días), y genera el anticipo que vence en noviembre de 2026.
 *
 * Daniel, 2026-11-12: «Cargá las reglas de IRP, IRE SIMPLE, IDU y anticipos».
 *
 * **Ninguna fecha sale de la memoria** (`CLAUDE.md`, lección 22). Cada regla
 * tiene dos fuentes que coinciden: la norma, leída en dnit.gov.py el 2026-11-12,
 * y la planilla de clientes de EFFORT (`CLIENTES - ARIANA CAMPOS DA ROSA.xlsx`).
 *
 * | Obligación    | Mes                      | Día (terminación de RUC) | Norma                                   | Planilla de EFFORT            |
 * |---------------|--------------------------|--------------------------|-----------------------------------------|-------------------------------|
 * | IRP           | marzo (3.er mes)         | 7 … 25 (determinativas)  | RG 38/2020 art. 2° y 3°                 | columna IRP: «marzo»          |
 * | IRE SIMPLE    | marzo (3.er mes)         | 7 … 25                   | RG 38/2020 art. 2° y 3°                 | «marzo» en la mayoría (*)     |
 * | Anticipos IRE | mayo, julio, set., nov.  | 7 … 25                   | RG 38/2020 art. 4° (cierre a diciembre) | leyenda: «4 vencimientos …»   |
 * | IDU (DJI)     | junio (6.º mes)          | 8 … 26 (informativas)    | RG 70/2020 art. 2° → RG 38/2020 art. 6° | leyenda: «anual, vence junio» |
 *
 * (*) En cuatro filas de clientes de IRE SIMPLE la planilla dice «abril» (ORL
 * COMERCIAL, MARCO PENONI, FATIMA PEÑA, RAMIRO GARCIA). La norma dice tercer mes
 * y es lo que se carga; queda anotado en `docs/DISCREPANCIAS.md`.
 *
 * Citas textuales de la norma: IRE SIMPLE e IRP, «hasta el día del vencimiento
 * del tercer mes después de finalizado el ejercicio fiscal»; anticipos, «serán
 * abonados en el primer, tercer, quinto y séptimo mes siguientes al vencimiento
 * del plazo de presentación de la declaración jurada (…) de acuerdo al
 * Calendario Perpetuo de Vencimientos previsto en el artículo 3°»; IDU, «deberá
 * presentarse dentro del sexto mes posterior al cierre del ejercicio fiscal, de
 * acuerdo con el Calendario de Vencimientos de DJI previsto en el artículo 6° de
 * la Resolución General N° 38/2020».
 *
 * **Los anticipos son cuatro obligaciones, no una.** El generador conoce
 * «mensual» y «anual con un mes de presentación»; un anticipo es exactamente
 * eso: una vez por ejercicio, en un mes fijo del año siguiente al cierre sobre
 * el que se calcula. Cuatro filas (`ANTICIPO_IRE_1` … `_4`) usan la maquinaria
 * ya probada sin tocar el esquema. La fila genérica `ANTICIPO_IRE` se desactiva
 * (`activa = false`); no se borra.
 *
 * **Qué vencimientos aparecen.** Todas rigen desde 2026-10-01, igual que el
 * resto de la carga del 12-11: lo anual del ejercicio 2026 se genera solo en
 * diciembre y vence en 2027. La única excepción es el cuarto anticipo, que rige
 * desde 2025-12-01 para que exista el que vence en noviembre de 2026 — los tres
 * anteriores (mayo, julio, setiembre) ya pasaron y no se generan. La planilla
 * avisa que el anticipo «depende de la liquidación del IRE para quedar o no
 * obligado a pagar». Hoy la pantalla no tiene cómo marcar «No aplica»: es un
 * pendiente (DISCREPANCIAS 46(f)), no algo que ya se pueda hacer.
 *
 * **Las tres preguntas de `CLAUDE.md`:**
 * 1. *¿Es necesario?* Sí: sin regla, 51 clientes figuran incompletos y esos
 *    vencimientos no aparecen en ningún lado.
 * 2. *¿Qué pasa si sale mal?* Simula por defecto. `--aplicar` exige respaldo de
 *    hoy. Solo hace UPDATE de las 4 filas del catálogo (queda el valor anterior
 *    en la bitácora) e INSERT de filas nuevas; no hay DELETE. Una regla mal
 *    cargada se corrige con otro UPDATE o poniendo `confirmadaPorEffort = false`
 *    (deja de generar). Un vencimiento generado de más queda a la vista hasta
 *    que exista la acción «No aplica» (pendiente).
 * 3. *¿Cuál es la forma correcta?* La del proyecto: simular, `--aplicar` con
 *    respaldo, bitácora, y generar con `generarVencimientosDelPeriodo` — el
 *    mismo generador de siempre, acotado a la obligación nueva.
 *
 * Uso (desde la raíz del repo):
 *   node scripts/cargar-reglas-irp-simple-idu-anticipos.mjs            → simula
 *   node scripts/cargar-reglas-irp-simple-idu-anticipos.mjs --aplicar
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const APLICAR = process.argv.includes('--aplicar');

const DETERMINATIVAS = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
const INFORMATIVAS = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
const LEIDA = 'leída en dnit.gov.py el 2026-11-12';
const ORDEN = 'Cargada por orden de Daniel el 2026-11-12.';

/** Reglas que se completan sobre filas que ya existen en el catálogo. */
const REGLAS = [
  {
    codigo: 'IRP',
    datos: {
      nombre: 'IRP — Impuesto a la Renta Personal', mesDeCierreAnual: 3, diasPorTerminacionRuc: DETERMINATIVAS,
      fuente: `RG 38/2020 art. 2° («hasta el día del vencimiento del tercer mes después de finalizado el ejercicio fiscal») y art. 3° (calendario perpetuo, días 7 a 25), ${LEIDA}. Coincide con la planilla de clientes de EFFORT (columna IRP: «marzo»). ${ORDEN}`,
    },
  },
  {
    codigo: 'IRE_SIMPLE',
    datos: {
      nombre: 'IRE SIMPLE', formulario: '501', mesDeCierreAnual: 3, diasPorTerminacionRuc: DETERMINATIVAS,
      fuente: `RG 38/2020 art. 2° (SIMPLE: «hasta el día del vencimiento del tercer mes después de finalizado el ejercicio fiscal») y art. 3° (días 7 a 25), ${LEIDA}. La planilla de EFFORT dice «marzo» en la mayoría de los clientes SIMPLE y «abril» en cuatro (DISCREPANCIAS). Formulario 501 según el nombre de los archivos de EFFORT («… IRE SIMPLE SEGUN FORM 501»). ${ORDEN}`,
    },
  },
  {
    codigo: 'IDU',
    datos: {
      nombre: 'IDU — declaración jurada informativa (DJI)', mesDeCierreAnual: 6, diasPorTerminacionRuc: INFORMATIVAS,
      fuente: `RG 70/2020 art. 2° («deberá presentarse dentro del sexto mes posterior al cierre del ejercicio fiscal, de acuerdo con el Calendario de Vencimientos de DJI previsto en el artículo 6° de la Resolución General N° 38/2020»: días 8 a 26), ${LEIDA}. Coincide con la leyenda de la planilla de EFFORT («IDU: anual, vence en junio»). No es la retención mensual de IDU, que sigue sin regla. ${ORDEN}`,
    },
  },
];

const FUENTE_ANTICIPO =
  `RG 38/2020 art. 4° («serán abonados en el primer, tercer, quinto y séptimo mes siguientes al vencimiento del plazo de presentación de la declaración jurada», cierre a diciembre: mayo, julio, setiembre y noviembre, por el calendario del art. 3°), ${LEIDA}. Coincide con la leyenda de la planilla de EFFORT («4 vencimientos: mayo/julio/setiembre/noviembre»), que además avisa que «depende de la liquidación del IRE para quedar o no obligado a pagar». La pantalla todavía no tiene cómo marcar un vencimiento como «No aplica» (pendiente, DISCREPANCIAS 46(f)). ${ORDEN}`;
const ANTICIPOS = [
  { n: 1, mes: 5, nombreMes: 'mayo', desde: '2026-10-01' },
  { n: 2, mes: 7, nombreMes: 'julio', desde: '2026-10-01' },
  { n: 3, mes: 9, nombreMes: 'setiembre', desde: '2026-10-01' },
  // Rige desde antes del cierre 2025 para que exista el que vence en noviembre de 2026.
  { n: 4, mes: 11, nombreMes: 'noviembre', desde: '2025-12-01' },
].map((a) => ({
  ...a,
  codigo: `ANTICIPO_IRE_${a.n}`,
  nombre: `Anticipo de IRE ${a.n} de 4 — vence en ${a.nombreMes} del año siguiente al ejercicio`,
}));

const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(() => import('@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const { ClientesPrisma } = await import('@effort/api/dist/repositorios/clientes.js');
const { VencimientosPrisma } = await import('@effort/api/dist/repositorios/dominio.js');
const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
const { registrarEvento } = await import('@effort/api/dist/bitacora.js');
const { generarVencimientosDelPeriodo } = await import('@effort/api/dist/servicios/generadorDeVencimientos.js');
const clientes = new ClientesPrisma(prisma);
const bitacora = new BitacoraPrisma(prisma);
const log = { error: (x, m) => console.error(m, x) };

try {
  if (APLICAR) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!readdirSync(join(RAIZ, 'respaldos')).some((f) => f.includes(hoy))) throw new Error('No hay respaldo de hoy: node scripts/respaldar-base.mjs');
  }
  const operador = await prisma.usuario.findFirst({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });
  const catalogo = await prisma.obligacionTributaria.findMany();
  const porCodigo = new Map(catalogo.map((o) => [o.codigo, o]));

  console.log(`${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (no escribe nada)'}\n`);

  // 1. Reglas sobre filas existentes.
  for (const { codigo, datos } of REGLAS) {
    const fila = porCodigo.get(codigo);
    if (!fila) throw new Error(`No existe ${codigo} en el catálogo.`);
    const cuantos = await prisma.obligacionDeCliente.count({ where: { obligacionId: fila.id, hasta: null } });
    console.log(`${codigo}: mes ${datos.mesDeCierreAnual}, días ${datos.diasPorTerminacionRuc.join(' ')} · ${cuantos} clientes${fila.confirmadaPorEffort ? ' · ya estaba confirmada' : ''}`);
    if (APLICAR && !fila.confirmadaPorEffort) {
      await prisma.obligacionTributaria.update({ where: { id: fila.id }, data: { ...datos, confirmadaPorEffort: true, actualizadoPorUsuarioId: operador.id } });
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: 'obligacion.actualizada', entidad: 'obligacion_tributaria', entidadId: fila.id, clienteId: null,
        datosAntes: { nombre: fila.nombre, mesDeCierreAnual: fila.mesDeCierreAnual, diasPorTerminacionRuc: fila.diasPorTerminacionRuc, confirmadaPorEffort: false },
        datosDespues: { ...datos, confirmadaPorEffort: true } });
    }
  }

  // 2. Anticipos: cuatro obligaciones para los clientes que tienen la genérica.
  const generica = porCodigo.get('ANTICIPO_IRE');
  if (!generica) throw new Error('No existe ANTICIPO_IRE en el catálogo.');
  const conAnticipo = await prisma.obligacionDeCliente.findMany({ where: { obligacionId: generica.id, hasta: null }, select: { clienteId: true } });
  const listado = await clientes.listar(null);
  const clientePorId = new Map(listado.map((c) => [c.id, c]));
  console.log(`\nAnticipos de IRE: ${conAnticipo.length} clientes × 4 obligaciones (${ANTICIPOS.map((a) => a.nombreMes).join(', ')})`);

  const idDeAnticipo = new Map();
  for (const a of ANTICIPOS) {
    let fila = porCodigo.get(a.codigo);
    if (!fila && APLICAR) {
      fila = await prisma.obligacionTributaria.create({ data: { codigo: a.codigo, nombre: a.nombre, entidad: 'DNIT', formulario: null, periodicidad: 'ANUAL',
        mesDeCierreAnual: a.mes, diasPorTerminacionRuc: DETERMINATIVAS, confirmadaPorEffort: true, activa: true, fuente: FUENTE_ANTICIPO, creadoPorUsuarioId: operador.id } });
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: 'obligacion.creada', entidad: 'obligacion_tributaria', entidadId: fila.id, clienteId: null,
        datosAntes: null, datosDespues: { codigo: a.codigo, mesDeCierreAnual: a.mes, diasPorTerminacionRuc: DETERMINATIVAS, confirmadaPorEffort: true } });
    }
    // La fuente se mantiene igual a la de este archivo: si se corrige el texto acá, se corrige en la base.
    if (fila && APLICAR && fila.fuente !== FUENTE_ANTICIPO) {
      await prisma.obligacionTributaria.update({ where: { id: fila.id }, data: { fuente: FUENTE_ANTICIPO, actualizadoPorUsuarioId: operador.id } });
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: 'obligacion.actualizada', entidad: 'obligacion_tributaria', entidadId: fila.id, clienteId: null,
        datosAntes: { fuente: fila.fuente }, datosDespues: { fuente: FUENTE_ANTICIPO, motivo: 'corrección del texto de la fuente' } });
      console.log(`  ${a.codigo}: fuente corregida`);
    }
    idDeAnticipo.set(a.codigo, fila?.id ?? `simulada-${a.codigo}`);
    if (!APLICAR) continue;
    for (const { clienteId } of conAnticipo) {
      try {
        await prisma.obligacionDeCliente.create({ data: { clienteId, obligacionId: fila.id, desde: new Date(`${a.desde}T00:00:00.000Z`), creadoPorUsuarioId: operador.id } });
      } catch (error) {
        if (error?.code === 'P2002') continue; // ya estaba: repetir es seguro
        throw error;
      }
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: 'cliente.actualizado', entidad: 'cliente', entidadId: clienteId, clienteId,
        datosAntes: null, datosDespues: { obligacionAsignada: a.codigo, desde: a.desde, criterio: 'planilla de clientes de EFFORT (ANT IRE) y RG 38/2020 art. 4°' } });
    }
  }
  if (APLICAR && generica.activa) {
    await prisma.obligacionTributaria.update({ where: { id: generica.id }, data: { activa: false, actualizadoPorUsuarioId: operador.id,
      fuente: `${generica.fuente} Reemplazada el 2026-11-12 por ANTICIPO_IRE_1 a ANTICIPO_IRE_4 (una por vencimiento).` } });
    await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: 'obligacion.actualizada', entidad: 'obligacion_tributaria', entidadId: generica.id, clienteId: null,
      datosAntes: { activa: true }, datosDespues: { activa: false, motivo: 'reemplazada por ANTICIPO_IRE_1 a ANTICIPO_IRE_4' } });
  }

  // 3. El anticipo que vence en noviembre de 2026: el generador de siempre, acotado a esa obligación.
  const cuarto = ANTICIPOS[3];
  const obligacionDelCuarto = {
    id: idDeAnticipo.get(cuarto.codigo), codigo: cuarto.codigo, nombre: cuarto.nombre, entidad: 'DNIT', formulario: null, periodicidad: 'ANUAL',
    mesDeCierreAnual: cuarto.mes, diasPorTerminacionRuc: DETERMINATIVAS, confirmadaPorEffort: true, activa: true, fuente: FUENTE_ANTICIPO,
  };
  const asignacionesDelCuarto = conAnticipo.map(({ clienteId }, i) => ({
    id: `a-${i}`, clienteId, obligacionId: obligacionDelCuarto.id, desde: new Date(`${cuarto.desde}T00:00:00.000Z`), hasta: null,
  }));
  const capturadas = [];
  const resumen = await generarVencimientosDelPeriodo(
    {
      clientes,
      obligaciones: {
        listar: async () => [obligacionDelCuarto],
        listarGenerables: async () => [obligacionDelCuarto],
        asignacionesDeClientes: async () => asignacionesDelCuarto,
      },
      vencimientos: APLICAR
        ? new VencimientosPrisma(prisma)
        : { registrarGenerados: async (altas) => { capturadas.push(...altas); return 0; } },
    },
    '2025-12',
    operador.id,
  );
  console.log(`\nAnticipo 4 de 4 (noviembre de 2026): ${APLICAR ? `${resumen.creados} vencimientos creados, ${resumen.yaExistian} ya existían` : `${capturadas.length} vencimientos a crear`}`);
  for (const alta of capturadas.sort((x, y) => x.fechaVencimiento - y.fechaVencimiento)) {
    const c = clientePorId.get(alta.clienteId);
    console.log(`  ${alta.fechaVencimiento.toISOString().slice(0, 10)}  ${c.codigo} ${c.nombre} (RUC ${c.ruc})`);
  }
  for (const o of resumen.omitidos) console.log(`  OMITIDO ${o.cliente}: ${o.motivo}`);
  if (resumen.aniosSinRevisarFeriados.length) console.log(`  OJO: feriados sin revisar para ${resumen.aniosSinRevisarFeriados.join(', ')}`);
  if (!APLICAR) console.log('\nNo se escribió nada. Para aplicar: respaldo de hoy y --aplicar.');
} finally {
  await prisma.$disconnect();
}
