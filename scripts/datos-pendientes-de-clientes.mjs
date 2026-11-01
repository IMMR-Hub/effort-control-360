/**
 * Documento de datos pendientes de los clientes (2026-11-01).
 *
 * Daniel: «Hazlos clientes con el mismo número que ya aparece y haz un
 * documento con los datos pendientes a completar». Genera
 * `docs/clientes/DATOS PENDIENTES DE CLIENTES - 01-11-2026.xlsx`: una fila por
 * cliente con carpeta, ordenada por código, y una hoja «Dudas».
 *
 * **No inventa ningún dato.** Las únicas fuentes son:
 * - la planilla de clientes de EFFORT
 *   (`docs/analisis-onedrive-2026-10/Planilla de clientes - EFFORT Control 360.xlsx`),
 *   leída con el mismo código que el alta masiva;
 * - la lista de carpetas (`cod` y `cliente`) del plan del ordenamiento
 *   (`C:\Users\Daniel\DATOS ORDENAMIENTO EFFORT 2026-10\plan.json`);
 * - el criterio del alta masiva para decidir si un RUC es confiable
 *   (`planificarAlta`, con `RUC_OBSERVADOS` de DISCREPANCIAS 44): lo que el
 *   alta no cargaría figura como «PENDIENTE», igual que en el sistema.
 *
 * Solo lee y escribe el Excel: no toca la base, ni OneDrive, ni Graph.
 *
 * Uso:
 *   node scripts/datos-pendientes-de-clientes.mjs [--planilla <ruta>] [--plan <ruta>] [--salida <ruta>]
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  argumento,
  cargarValidadores,
  carpetasDelPlan,
  leerPlanilla,
  OBLIGACIONES_CONTROLADAS,
  PLAN_DEL_ORDENAMIENTO,
  PLANILLA_POR_DEFECTO,
  planificarAlta,
  RUC_OBSERVADOS,
} from './alta-masiva-clientes.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const SALIDA_POR_DEFECTO = join(RAIZ, 'docs/clientes/DATOS PENDIENTES DE CLIENTES - 01-11-2026.xlsx');

/** Nombre de cada obligación como lo dice la planilla de EFFORT. */
const NOMBRE_DE_OBLIGACION = Object.freeze({
  IVA_GENERAL: 'IVA mensual (Form. 120)',
  PLANILLA_RG90: 'Planilla RG 90 mensual',
  IRE: 'IRE anual (Form. 500)',
  EEFF: 'Estados financieros anuales',
});

export const PENDIENTE = 'PENDIENTE';

/** Obligaciones que la planilla marca «Sí», más las «otras» que anotó EFFORT. */
export function textoDeObligaciones(fila) {
  const si = OBLIGACIONES_CONTROLADAS.filter((o) => fila.obligaciones[o] === true).map((o) => NOMBRE_DE_OBLIGACION[o]);
  const partes = [...si];
  if (fila.otras) partes.push(`Otras: ${fila.otras}`);
  return partes.length > 0 ? partes.join('; ') : PENDIENTE;
}

/**
 * «Qué falta», en palabras simples, a partir de la fila de la planilla y de lo
 * que decidió el alta masiva sobre ella. Una frase por renglón.
 */
export function queFalta(fila, accion) {
  const faltas = [];
  const ruc = accion.datos.ruc;
  const observado = RUC_OBSERVADOS[fila.codigo];

  if (!fila.ruc) {
    faltas.push('El RUC, con su dígito verificador.');
  } else if (!ruc) {
    if (observado && observado.bloquea && observado.ruc === fila.ruc) {
      faltas.push(`El RUC correcto: el que se había propuesto (${fila.ruc}) ${observado.motivo.replace(/ — DISCREPANCIAS 44$/, '')}.`);
    } else {
      const motivo = accion.problemas.find((p) => /queda «RUC pendiente»/.test(p.texto));
      faltas.push(`El RUC correcto: el propuesto (${fila.ruc}) no se puede usar${motivo ? ` — ${motivo.texto.replace(/: no se carga, el cliente queda «RUC pendiente»$/, '')}` : ''}.`);
    }
  } else if (observado && observado.ruc === ruc) {
    faltas.push(`Confirmar el RUC ${ruc}: ${observado.motivo.replace(/ — DISCREPANCIAS 44$/, '')}.`);
  } else if (fila.origenRuc && /sale de 1 de 1 /i.test(fila.origenRuc)) {
    faltas.push(`Confirmar el RUC ${ruc}: salió de una sola declaración de su carpeta.`);
  }

  if (!fila.regimen) faltas.push('El régimen tributario.');
  if (OBLIGACIONES_CONTROLADAS.every((o) => fila.obligaciones[o] === null)) {
    faltas.push('Qué obligaciones tiene (IVA, RG 90, IRE, estados financieros, otras).');
  }
  if (!fila.tipoPersona) faltas.push('Si es persona física o jurídica.');

  if (faltas.length > 0) return faltas.join('\n');
  return accion.existenteSegunPlanilla
    ? 'Nada: ya está cargado en el sistema con estos datos.'
    : 'Nada: la planilla tiene todos los datos.';
}

/**
 * Una fila por carpeta (cliente), ordenada por código. Una carpeta sin fila
 * en la planilla también aparece: le falta todo.
 */
export function armarFilas({ filas, carpetas, validar }) {
  const plan = planificarAlta({ filas, carpetas, conIds: false, existentes: null, validar });
  const accionPorCodigo = new Map(plan.acciones.map((a) => [a.codigo, a]));
  const filaPorCodigo = new Map(filas.map((f) => [f.codigo, f]));

  return [...carpetas]
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((c) => {
      const fila = filaPorCodigo.get(c.codigo);
      const accion = accionPorCodigo.get(c.codigo);
      if (!fila || !accion) {
        return {
          codigo: c.codigo,
          carpeta: c.carpeta,
          ruc: PENDIENTE,
          regimen: PENDIENTE,
          obligaciones: PENDIENTE,
          queFalta: 'Todo: la carpeta no tiene fila en la planilla de clientes (RUC, tipo de persona, régimen y obligaciones).',
        };
      }
      return {
        codigo: c.codigo,
        carpeta: c.carpeta,
        ruc: accion.datos.ruc ?? PENDIENTE,
        regimen: fila.regimen ?? PENDIENTE,
        obligaciones: textoDeObligaciones(fila),
        queFalta: queFalta(fila, accion),
      };
    });
}

/** Hoja «Dudas». Lo que dice cada renglón sale de la planilla, de DISCREPANCIAS 40 y 44 y de las listas de carpetas. */
export function armarDudas({ filas, carpetas }) {
  const filaDe = (codigo) => filas.find((f) => f.codigo === codigo);
  const conCarpeta = new Set(carpetas.map((c) => c.codigo));
  const sinCarpeta = filas.filter((f) => !conCarpeta.has(f.codigo) && !['045', '070', '099'].includes(f.codigo));
  const r056 = filaDe('056')?.ruc ?? '—';
  const r113 = filaDe('113')?.ruc ?? '—';

  return [
    {
      tema: '045 DAVID ROMERO',
      queSeSabe:
        'No hay carpeta de cliente con el código 045. Hay una subcarpeta «045 DAVID ROMERO» dentro de «056 FACUNDO CARRASCOSA» ' +
        '(3 archivos de marzo de 2024: libros de compras y ventas e IVA 03-2024); en el ordenamiento quedó en ' +
        '«056 ZZ A CLASIFICAR/045 DAVID ROMERO». Su declaración dice ROMERO CABALLERO DAVID TADEO FRANCISCO, RUC 1300663 (DISCREPANCIAS 44).',
      queHayQueResponder:
        '¿Es el cliente 045? Si lo es: confirmar el nombre, el RUC y los demás datos, y crearle su carpeta. Sin carpeta no se da de alta.',
    },
    {
      tema: '056 FACUNDO CARRASCOSA',
      queSeSabe:
        `La planilla le propuso el RUC ${r056} porque era la única declaración de su carpeta, pero esa declaración es de David Romero (045). ` +
        'Se da de alta con el RUC PENDIENTE: ese RUC no se carga.',
      queHayQueResponder: '¿Cuál es el RUC de Facundo Carrascosa?',
    },
    {
      tema: '070',
      queSeSabe: 'No hay carpeta ni ningún archivo con el código 070 en todo el OneDrive. La planilla no tiene nombre para ese código.',
      queHayQueResponder: '¿Fue un cliente? Si sí, ¿cuál, y dónde están sus archivos? Si nunca existió, el número queda sin usar.',
    },
    {
      tema: '099',
      queSeSabe: 'No hay carpeta ni ningún archivo con el código 099 en todo el OneDrive. La planilla no tiene nombre para ese código.',
      queHayQueResponder: '¿Fue un cliente? Si sí, ¿cuál, y dónde están sus archivos? Si nunca existió, el número queda sin usar.',
    },
    {
      tema: '113 CASA VIVA',
      queSeSabe:
        `RUC propuesto ${r113} (${filaDe('113')?.origenRuc ?? 'según la planilla'}), pero sus declaraciones dicen «PAVISA SOCIEDAD ANONIMA». ` +
        'Se carga con aviso hasta que EFFORT lo confirme (DISCREPANCIAS 44).',
      queHayQueResponder: '¿CASA VIVA es el nombre de fantasía de PAVISA S.A.? Si no, ¿cuál es el RUC de CASA VIVA?',
    },
    {
      tema: 'DISCREPANCIAS 40 — supuestos de la planilla sin validar',
      queSeSabe:
        'Los datos de la planilla son propuestas, no confirmaciones: los RUC se dedujeron de las declaraciones de cada carpeta ' +
        '(el dígito verificador se comprobó solo con 3 RUC reales del piloto); el tipo de persona es un supuesto («RUC de 80.000.000 o más = jurídica»; ' +
        'sin RUC, por el nombre: S.A., S.R.L., E.A.S.); la lista de regímenes no la confirmó EFFORT, y el régimen y las obligaciones se dejaron vacíos a propósito. ' +
        'El sistema controla solo 4 obligaciones (IVA, RG 90, IRE, estados financieros): IRP, IPS, MTESS y anticipos quedan anotados en «Otras» y todavía no se controlan.',
      queHayQueResponder:
        'Confirmar o corregir RUC, tipo de persona, régimen y obligaciones de cada cliente. También: qué fueron 045, 070 y 099; qué hacer con las ' +
        'carpetas sin código y con «001 ELIAS EL KHOURY» metida dentro de «007 RAMIRO GARCIA VARESINI». (Si siguen siendo clientes los que no tienen ' +
        'movimiento ya lo respondió Daniel el 01-11-2026: todos los que tienen carpeta son clientes.)',
    },
    {
      tema: 'DISCREPANCIAS 44 — RUC de la planilla que no son del cliente',
      queSeSabe:
        'Se revisaron los 91 RUC propuestos comparando el nombre de la carpeta con el nombre que dicen las declaraciones de ese RUC. ' +
        'El del 056 es de David Romero (045); el del 113 figura como «PAVISA SOCIEDAD ANONIMA»; el de 023 DIBEC UNIPERSONAL figura como ' +
        '«BECONI OCHIPINTI DIEGO RAFAEL», que es correcto (es la persona física). Los RUC que salieron de una sola declaración se cargan con aviso para confirmar.',
      queHayQueResponder: 'Corregir el RUC del 056 y confirmar el del 113 y los que salieron de una sola declaración (marcados en «Qué falta»).',
    },
    {
      tema: `Códigos de la planilla sin carpeta con archivos (${sinCarpeta.map((f) => f.codigo).join(', ')})`,
      queSeSabe:
        'Tienen fila en la planilla pero no están en la lista de carpetas del ordenamiento (plan.json): ' +
        sinCarpeta.map((f) => `${f.codigo} ${f.nombre ?? ''}${f.aviso ? ` (${f.aviso.toLowerCase()})` : ''}`.trim()).join('; ') +
        '. No se dan de alta: los clientes son los que tienen carpeta.',
      queHayQueResponder: '¿Alguno sigue siendo cliente? Si sí, hay que crearle (o encontrarle) su carpeta.',
    },
  ];
}

export async function generarExcel({ filas, carpetas, validar, ExcelJS, salida }) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'EFFORT Control 360';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Clientes', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    { header: 'Código', key: 'codigo', width: 9 },
    { header: 'Nombre de carpeta', key: 'carpeta', width: 44 },
    { header: 'RUC', key: 'ruc', width: 14 },
    { header: 'Régimen', key: 'regimen', width: 24 },
    { header: 'Obligaciones', key: 'obligaciones', width: 48 },
    { header: 'Qué falta', key: 'queFalta', width: 80 },
  ];
  const lineas = armarFilas({ filas, carpetas, validar });
  for (const l of lineas) hoja.addRow(l);
  hoja.getRow(1).font = { bold: true };
  hoja.autoFilter = { from: 'A1', to: 'F1' };
  hoja.eachRow((fila, n) => {
    fila.alignment = { vertical: 'top', wrapText: true };
    if (n === 1) return;
    for (const clave of ['ruc', 'regimen', 'obligaciones']) {
      const celda = fila.getCell(clave);
      if (celda.value === PENDIENTE) celda.font = { bold: true, color: { argb: 'FFB45309' } };
    }
  });

  const dudas = libro.addWorksheet('Dudas', { views: [{ state: 'frozen', ySplit: 1 }] });
  dudas.columns = [
    { header: 'Código o tema', key: 'tema', width: 30 },
    { header: 'Qué se sabe', key: 'queSeSabe', width: 90 },
    { header: 'Qué hay que responder', key: 'queHayQueResponder', width: 60 },
  ];
  for (const d of armarDudas({ filas, carpetas })) dudas.addRow(d);
  dudas.getRow(1).font = { bold: true };
  dudas.eachRow((fila) => {
    fila.alignment = { vertical: 'top', wrapText: true };
  });

  mkdirSync(dirname(salida), { recursive: true });
  await libro.xlsx.writeFile(salida);
  return lineas;
}

async function principal() {
  const argv = process.argv.slice(2);
  const rutaPlanilla = argumento(argv, 'planilla') ?? PLANILLA_POR_DEFECTO;
  const rutaPlan = argumento(argv, 'plan') ?? PLAN_DEL_ORDENAMIENTO;
  const salida = argumento(argv, 'salida') ?? SALIDA_POR_DEFECTO;

  const { default: ExcelJS } = await import('exceljs');
  const { filas } = await leerPlanilla(rutaPlanilla, ExcelJS);
  const carpetas = carpetasDelPlan(JSON.parse(readFileSync(rutaPlan, 'utf8')));
  if (carpetas.length === 0) throw new Error(`No se encontró ninguna carpeta en ${rutaPlan}.`);
  const validar = await cargarValidadores();

  const lineas = await generarExcel({ filas, carpetas, validar, ExcelJS, salida });
  const pendientes = (campo) => lineas.filter((l) => l[campo] === PENDIENTE).length;
  console.log(`${lineas.length} clientes (carpetas) → ${salida}`);
  console.log(`  RUC pendiente: ${pendientes('ruc')} · régimen pendiente: ${pendientes('regimen')} · obligaciones pendientes: ${pendientes('obligaciones')}`);
  console.log(`  sin nada pendiente: ${lineas.filter((l) => /^Nada/.test(l.queFalta)).length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].replace(/\//g, '\\').toLowerCase()) {
  await principal();
}
