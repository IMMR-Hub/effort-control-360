/**
 * Alta masiva de clientes desde la planilla de clientes de EFFORT.
 *
 * **Por qué existe.** El sistema controla 5 clientes (piloto) y EFFORT tiene
 * 120 con carpeta en el OneDrive. Daniel, 2026-11-01: «Todos los clientes que
 * están en las carpetas de EFFORT son clientes, así que deben ser tratados como
 * tal. Hazlos clientes con el mismo número que ya aparece». Darlos de alta uno por uno desde la pantalla
 * son 120 formularios, y la pantalla tampoco conecta la carpeta de OneDrive ni
 * asigna obligaciones (roadmap, «alta masiva»). Esto lee la planilla que EFFORT
 * devuelve completa (`docs/analisis-onedrive-2026-10/Planilla de clientes -
 * EFFORT Control 360.xlsx`) y los ids de las carpetas `CLIENTES/NNN NOMBRE`, y
 * arma el alta de todos de una vez.
 *
 * ---
 *
 * **Las tres preguntas de `CLAUDE.md`, escritas antes de la primera corrida:**
 *
 * 1. *¿Es necesario?* Sí: sin cliente en la base, el sistema no lee su carpeta
 *    ni le genera vencimientos. La alternativa (la pantalla) no conecta carpetas
 *    ni obligaciones.
 * 2. *¿Qué pasa si sale mal?* Simula por defecto: sin `--aplicar` no escribe una
 *    sola fila. Con `--aplicar` exige un respaldo de la base del mismo día
 *    (`node scripts/respaldar-base.mjs`), **nunca borra** (no hay ni un DELETE
 *    ni un `deleteMany` en este archivo), nunca pisa un dato cargado a mano sin
 *    `--forzar-campo`, y cada cambio deja su entrada en `event_log` con el valor
 *    anterior. Es idempotente: repetirlo no duplica, así que un corte de red a
 *    la mitad se arregla volviendo a correrlo. **Riesgo real:** cada carpeta que
 *    se conecta empieza a sincronizarse sola en la vuelta siguiente (cada 15
 *    min); con 120 clientes son 17–45 h de descargas y la memoria del servidor
 *    es el riesgo (DISCREPANCIAS 43). Por eso existe `--codigos`, para aplicar
 *    en tandas.
 * 3. *¿Cuál es la forma correcta?* La que ya usa el proyecto para operaciones
 *    masivas: simular primero y escribir solo con `--aplicar`
 *    (`aplicar-prorroga.mjs`, `reclasificar-documentos.mjs`), y escribir por el
 *    repositorio de clientes de la API (`ClientesPrisma`) y la bitácora
 *    (`BitacoraPrisma` + `registrarEvento`), no con SQL suelto.
 *
 * **OneDrive: solo lectura (REGLA 5).** `--leer-carpetas` hace únicamente GET a
 * Microsoft Graph (el único POST es al servidor de identidad de Microsoft, para
 * pedir el token — mismo patrón que `revision.mjs` del ordenamiento). El
 * cliente HTTP de este archivo no tiene forma de mandar otro método a Graph.
 * Los secretos van del `.env` al cuerpo del `fetch`: nunca se imprimen ni van
 * como argumento de un subproceso (regla 8).
 *
 * **Lo que el esquema obliga, y lo que este script NO inventa** (migración
 * `20261101120000_codigo_de_cliente_y_ruc_pendiente`):
 * - Se da de alta a **todos los que tienen carpeta** `CLIENTES/NNN NOMBRE`, con
 *   su código (el número de la carpeta), su nombre y su carpeta. Una fila de la
 *   planilla sin carpeta (045, 070, 099…) no se da de alta.
 * - `cliente.codigo` es único: cada cliente se reconoce por su código. Si un
 *   cliente anterior no lo tiene, se lo reconoce por la carpeta o el RUC y se le
 *   completa el código (nunca se pisa uno que ya tenga).
 * - `cliente.ruc` es opcional: **el RUC se carga solo si es confiable** (formato
 *   y dígito verificador válidos, no repetido en la planilla, no observado en
 *   `RUC_OBSERVADOS`, no usado por otro cliente de la base). Si no, el cliente
 *   queda «RUC pendiente» y no se le calculan los vencimientos que dependen de
 *   la terminación del RUC. Nunca se pone uno de relleno: daría fechas falsas.
 * - `cliente.tipo_persona` es obligatorio: sin él (en la planilla), no hay alta.
 * - `obligacion_de_cliente.desde` es obligatorio y no está en la planilla: las
 *   obligaciones se asignan solo con `--desde AAAA-MM-DD` explícito, solo las
 *   que la planilla marca «Sí», y nunca se quita una (un «No» con la obligación
 *   ya asignada se informa, no se borra).
 * - Régimen, tipo de persona y obligaciones son propuestas sin validar hasta
 *   que EFFORT devuelva la planilla (DISCREPANCIAS 40). El RUC propuesto para el
 *   056 es del 045 (DISCREPANCIAS 44): no se carga, el 056 queda «RUC
 *   pendiente». El 113 (PAVISA) y los RUC «de 1 de 1» se cargan con aviso.
 *
 * Uso:
 *   node scripts/alta-masiva-clientes.mjs                       → simula contra la base (solo lee)
 *   node scripts/alta-masiva-clientes.mjs --sin-base            → simula sin conectarse a nada
 *   node scripts/alta-masiva-clientes.mjs --leer-carpetas       → lee de Graph (GET) los ids de las carpetas
 *   node scripts/alta-masiva-clientes.mjs --aplicar --codigos 001,003 [--desde 2026-01-01]
 *
 * Opciones:
 *   --planilla <ruta>        planilla devuelta por EFFORT (por defecto, la de docs/analisis-onedrive-2026-10/)
 *   --carpetas <ruta>        archivo de `--leer-carpetas` con los ids (por defecto, docs/analisis-onedrive-2026-10/datos/carpetas-de-clientes.json)
 *   --plan <ruta>            sin archivo de ids: lista de carpetas (sin ids, solo para simular) del plan del ordenamiento
 *                            (por defecto, C:\Users\Daniel\DATOS ORDENAMIENTO EFFORT 2026-10\plan.json; si no está, el inventario del 2026-10-03)
 *   --salida <ruta>          dónde guarda `--leer-carpetas` (por defecto, la misma ruta de --carpetas)
 *   --codigos 001,002        solo esos clientes (para aplicar en tandas)
 *   --desde AAAA-MM-DD       fecha desde la que rigen las obligaciones marcadas «Sí» (sin esto, no se asignan)
 *   --forzar-campo a,b       permite pisar esos campos aunque ya tengan un valor cargado
 *                            (nombre, ruc, tipoPersona, regimenTributario, email, telefono, carpetaOneDriveId, observaciones, activo)
 *   --sin-carpetas           con --aplicar: permite dar de alta sin ids de carpeta (se conectan en otra corrida)
 *   --respaldo <ruta>        respaldo del día a usar (por defecto, el más reciente de ./respaldos de hoy)
 *   --detalle                repite en cada fila los avisos que hoy aplican a casi todas (régimen, obligaciones, confirmación)
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------------- */
/* Constantes                                                                */
/* ------------------------------------------------------------------------- */

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

export const PLANILLA_POR_DEFECTO = join(
  RAIZ,
  'docs/analisis-onedrive-2026-10/Planilla de clientes - EFFORT Control 360.xlsx',
);
export const CARPETAS_POR_DEFECTO = join(RAIZ, 'docs/analisis-onedrive-2026-10/datos/carpetas-de-clientes.json');
/**
 * Plan del ordenamiento del OneDrive (tarea 164), aplicado el 2026-10-30/11-01:
 * una entrada por archivo, con `cod` y `cliente` (la carpeta). Es la lista de
 * carpetas con archivos más reciente que hay en disco, sin ids. Solo simula.
 */
export const PLAN_DEL_ORDENAMIENTO = 'C:/Users/Daniel/DATOS ORDENAMIENTO EFFORT 2026-10/plan.json';
/** Inventario del 2026-10-03: tiene los nombres de las carpetas, no sus ids. Sirve solo para simular. */
export const NOMBRES_DE_CARPETAS = join(RAIZ, 'docs/analisis-onedrive-2026-10/datos/clientes-por-codigo.json');

export const BASE_CLIENTES = 'CLIENTES EFFORT E.A.S/CLIENTES';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const CUENTA_DEL_SISTEMA = 'effort360@effort.com.py';
const VIA = 'scripts/alta-masiva-clientes.mjs';

/**
 * RUC de la planilla que se sabe que NO son del cliente, o que hay que confirmar.
 * Fuente: `docs/DISCREPANCIAS.md` punto 44 (revisión de los 91 RUC propuestos
 * contra el nombre que dicen sus propias declaraciones). Solo aplica mientras la
 * planilla siga trayendo ESE RUC: si EFFORT lo corrige, la observación se cae.
 */
export const RUC_OBSERVADOS = Object.freeze({
  '056': {
    ruc: '1300663-0',
    bloquea: true,
    motivo:
      'es de ROMERO CABALLERO DAVID TADEO FRANCISCO (la carpeta «045 DAVID ROMERO» está dentro del 056), no del 056 — DISCREPANCIAS 44',
  },
  '113': {
    ruc: '80051798-9',
    bloquea: false,
    motivo: 'sus declaraciones dicen «PAVISA SOCIEDAD ANONIMA»: confirmar con EFFORT que es CASA VIVA — DISCREPANCIAS 44',
  },
});

/** Las cuatro obligaciones que el sistema controla, por su código en `obligacion_tributaria`. */
export const OBLIGACIONES_CONTROLADAS = Object.freeze(['IVA_GENERAL', 'PLANILLA_RG90', 'IRE', 'EEFF']);

/**
 * Columnas de la hoja «Clientes», reconocidas por el texto del encabezado y no
 * por la posición (lección 3: suponer el formato de un Excel real sale mal; y
 * EFFORT puede devolverla con una columna movida).
 */
const COLUMNAS = Object.freeze({
  codigo: 'codigo',
  carpeta: 'carpeta en el onedrive',
  sigueSiendoCliente: 'sigue siendo cliente',
  ruc: 'ruc completo',
  origenRuc: 'como salio el ruc',
  tipoPersona: 'tipo de persona',
  regimen: 'regimen tributario',
  IVA_GENERAL: 'iva mensual',
  PLANILLA_RG90: 'planilla rg 90',
  IRE: 'ire anual',
  EEFF: 'estados financieros',
  otras: 'otras obligaciones',
  responsable: 'responsable en effort',
  email: 'correo del cliente',
  telefono: 'telefono',
  observaciones: 'observaciones',
  aviso: 'aviso del sistema',
});
const COLUMNAS_OBLIGATORIAS = ['codigo', 'carpeta', 'ruc', 'tipoPersona', 'regimen'];

export const CAMPOS_FORZABLES = Object.freeze([
  'nombre',
  'ruc',
  'tipoPersona',
  'regimenTributario',
  'email',
  'telefono',
  'carpetaOneDriveId',
  'observaciones',
  'activo',
]);

/* ------------------------------------------------------------------------- */
/* Utilidades puras                                                          */
/* ------------------------------------------------------------------------- */

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Texto de una celda de ExcelJS, sea texto, número, fecha, enlace, fórmula o texto enriquecido. */
export function textoDeCelda(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if (Array.isArray(valor.richText)) return valor.richText.map((t) => t.text).join('').trim();
    if ('text' in valor) return textoDeCelda(valor.text);
    if ('result' in valor) return textoDeCelda(valor.result);
    return '';
  }
  return String(valor).trim();
}

function siNo(texto) {
  const t = normalizar(texto);
  if (t === 'si' || t === 's') return true;
  if (t === 'no' || t === 'n') return false;
  return null;
}

function tipoPersona(texto) {
  const t = normalizar(texto);
  if (t.startsWith('fisica')) return 'FISICA';
  if (t.startsWith('juridica')) return 'JURIDICA';
  return null;
}

function vacioANulo(texto) {
  const t = String(texto ?? '').trim();
  return t === '' ? null : t;
}

/** Lee un argumento con valor: `--clave valor`. */
export function argumento(argv, clave) {
  const indice = argv.indexOf(`--${clave}`);
  return indice >= 0 && argv[indice + 1] && !argv[indice + 1].startsWith('--') ? argv[indice + 1] : null;
}

export function listaDeArgumento(argv, clave) {
  const valor = argumento(argv, clave);
  return valor ? valor.split(',').map((v) => v.trim()).filter(Boolean) : [];
}

/** Fecha de hoy (AAAA-MM-DD) en Asunción, que es la que manda para «el respaldo del día». */
export function fechaEnAsuncion(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(fecha);
}

/* ------------------------------------------------------------------------- */
/* Planilla                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Interpreta la hoja «Clientes». Recibe la hoja de ExcelJS ya abierta, para
 * poder probarla con un libro armado en memoria.
 *
 * El encabezado se busca en las primeras filas (en la planilla real está en la
 * fila 2: la 1 es una instrucción). Si no aparece, o no se reconoce ninguna
 * fila, **falla**: un importador que no encuentra nada tiene que gritar, no
 * devolver vacío (lección 3).
 */
export function interpretarHojaDeClientes(hoja) {
  if (!hoja) throw new Error('La planilla no tiene una hoja «Clientes».');

  let filaEncabezado = null;
  let indices = null;
  for (let r = 1; r <= Math.min(10, hoja.rowCount); r += 1) {
    const fila = hoja.getRow(r);
    const encabezados = [];
    for (let c = 1; c <= Math.max(fila.cellCount, hoja.columnCount); c += 1) {
      encabezados[c] = normalizar(textoDeCelda(fila.getCell(c).value));
    }
    const encontrados = {};
    for (const [clave, texto] of Object.entries(COLUMNAS)) {
      const c = encabezados.findIndex((e) => e && e.startsWith(texto));
      if (c > 0) encontrados[clave] = c;
    }
    if (encontrados.codigo && encontrados.ruc) {
      filaEncabezado = r;
      indices = encontrados;
      break;
    }
  }
  if (!indices) {
    throw new Error('No se encontró el encabezado de la hoja «Clientes» (columnas «Código» y «RUC completo»).');
  }
  const faltan = COLUMNAS_OBLIGATORIAS.filter((c) => !indices[c]);
  if (faltan.length > 0) {
    throw new Error(`Faltan columnas en la hoja «Clientes»: ${faltan.map((c) => COLUMNAS[c]).join(', ')}.`);
  }

  const filas = [];
  const ilegibles = [];
  for (let r = filaEncabezado + 1; r <= hoja.rowCount; r += 1) {
    const fila = hoja.getRow(r);
    const celda = (clave) => (indices[clave] ? textoDeCelda(fila.getCell(indices[clave]).value) : '');
    const codigoCrudo = celda('codigo');
    if (!codigoCrudo) continue;
    const codigo = /^\d{1,3}$/.test(codigoCrudo) ? codigoCrudo.padStart(3, '0') : null;
    if (!codigo) {
      ilegibles.push({ filaExcel: r, codigo: codigoCrudo });
      continue;
    }
    const obligaciones = {};
    for (const codigoObligacion of OBLIGACIONES_CONTROLADAS) obligaciones[codigoObligacion] = siNo(celda(codigoObligacion));

    filas.push({
      filaExcel: r,
      codigo,
      nombre: vacioANulo(celda('carpeta')),
      sigueSiendoCliente: siNo(celda('sigueSiendoCliente')),
      ruc: vacioANulo(celda('ruc')),
      origenRuc: vacioANulo(celda('origenRuc')),
      tipoPersonaTexto: vacioANulo(celda('tipoPersona')),
      tipoPersona: tipoPersona(celda('tipoPersona')),
      regimen: vacioANulo(celda('regimen')),
      obligaciones,
      otras: vacioANulo(celda('otras')),
      responsable: vacioANulo(celda('responsable')),
      email: vacioANulo(celda('email')),
      telefono: vacioANulo(celda('telefono')),
      observaciones: vacioANulo(celda('observaciones')),
      aviso: vacioANulo(celda('aviso')),
    });
  }
  if (filas.length === 0) {
    throw new Error('La hoja «Clientes» tiene encabezado pero ninguna fila con código: no se reconoció nada.');
  }
  return { filaEncabezado, filas, ilegibles };
}

export async function leerPlanilla(ruta, ExcelJS) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  return interpretarHojaDeClientes(libro.getWorksheet('Clientes'));
}

/* ------------------------------------------------------------------------- */
/* Carpetas de OneDrive                                                      */
/* ------------------------------------------------------------------------- */

/** De los hijos de `CLIENTES/` se queda con las carpetas `NNN NOMBRE`; deja aparte el resto. */
export function interpretarCarpetas(items) {
  const carpetas = [];
  const ignoradas = [];
  for (const item of items) {
    if (!item.folder) continue;
    const m = /^(\d{3})(?!\d)\s*(.*)$/.exec(item.name);
    if (!m || m[1] === '999') {
      ignoradas.push(item.name);
      continue;
    }
    carpetas.push({ codigo: m[1], nombre: m[2].trim(), carpeta: item.name, id: item.id });
  }
  carpetas.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { carpetas, ignoradas };
}

/**
 * Cliente HTTP de Graph que solo sabe hacer GET.
 *
 * No recibe un método como parámetro a propósito: no hay llamada que pueda
 * convertirse en POST/PATCH/DELETE a Graph por un descuido. Tampoco manda el
 * token a otro servidor: un `@odata.nextLink` que no sea de Graph corta.
 */
export function crearLectorDeGraph({ fetch: hacerFetch = globalThis.fetch, entorno = process.env, esperar } = {}) {
  const pausa = esperar ?? ((ms) => new Promise((resolver) => setTimeout(resolver, ms)));
  let token = null;
  let vence = 0;

  async function obtenerToken() {
    if (token && Date.now() < vence) return token;
    const faltan = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'].filter((v) => !entorno[v]);
    if (faltan.length > 0) throw new Error(`Faltan variables de entorno: ${faltan.join(', ')}.`);
    // El único POST: al servidor de identidad, no a Graph. El secreto va en el cuerpo, nunca en la URL.
    const r = await hacerFetch(
      `https://login.microsoftonline.com/${encodeURIComponent(entorno.AZURE_TENANT_ID)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: entorno.AZURE_CLIENT_ID,
          client_secret: entorno.AZURE_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );
    if (!r.ok) throw new Error(`No se pudo obtener el token de Microsoft (HTTP ${r.status}).`);
    const j = await r.json();
    token = j.access_token;
    vence = Date.now() + (Number(j.expires_in ?? 3600) - 300) * 1000;
    return token;
  }

  return async function leer(ruta) {
    const url = ruta.startsWith('http') ? ruta : `${GRAPH}${ruta}`;
    if (!url.startsWith(`${GRAPH}/`)) throw new Error('Se intentó leer fuera de Microsoft Graph: se corta.');
    for (let intento = 1; intento <= 5; intento += 1) {
      const r = await hacerFetch(url, { method: 'GET', headers: { authorization: `Bearer ${await obtenerToken()}` } });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) {
        await pausa(Number(r.headers?.get?.('retry-after') ?? 0) * 1000 || 2000 * intento);
        continue;
      }
      throw new Error(`GET ${url.slice(GRAPH.length, GRAPH.length + 120)} → HTTP ${r.status}`);
    }
    throw new Error('Microsoft Graph no respondió después de 5 intentos.');
  };
}

/** Lee (solo GET) las carpetas de `CLIENTES EFFORT E.A.S/CLIENTES` con sus ids. */
export async function leerCarpetasDeGraph({ fetch: hacerFetch, entorno = process.env, esperar } = {}) {
  const leer = crearLectorDeGraph({ fetch: hacerFetch, entorno, esperar });
  const usuario = entorno.ONEDRIVE_USUARIO_ORIGEN ?? 'lsosa@effort.com.py';
  const driveId = entorno.AZURE_DRIVE_ID_ORIGEN ?? (await leer(`/users/${encodeURIComponent(usuario)}/drive?$select=id`)).id;
  const ruta = BASE_CLIENTES.split('/').map(encodeURIComponent).join('/');
  let url = `/drives/${driveId}/root:/${ruta}:/children?$select=id,name,folder&$top=999`;
  const items = [];
  while (url) {
    const pagina = await leer(url);
    items.push(...(pagina.value ?? []));
    url = pagina['@odata.nextLink'] ?? null;
  }
  return { leidoEn: new Date().toISOString(), base: BASE_CLIENTES, ...interpretarCarpetas(items) };
}

/**
 * Carpetas `NNN NOMBRE` del plan del ordenamiento (una entrada por archivo):
 * una por código, ordenadas. Sin ids.
 */
export function carpetasDelPlan(entradas) {
  const porCodigo = new Map();
  for (const e of entradas) {
    if (!e?.cod || !e?.cliente || !/^\d{3}$/.test(e.cod) || e.cod === '999') continue;
    if (!porCodigo.has(e.cod)) porCodigo.set(e.cod, new Set());
    porCodigo.get(e.cod).add(e.cliente);
  }
  const carpetas = [];
  for (const [codigo, nombres] of porCodigo) {
    for (const carpeta of nombres) {
      carpetas.push({ codigo, nombre: carpeta.slice(codigo.length).trim(), carpeta, id: null });
    }
  }
  return carpetas.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/**
 * Carpetas a usar: las del archivo de `--leer-carpetas` (con ids); si no
 * existe, las del plan del ordenamiento; y si tampoco, los nombres del
 * inventario del 2026-10-03. Las dos últimas no tienen ids: sirven para
 * simular, no para aplicar.
 */
export function cargarCarpetas({ rutaIds, rutaPlan = null, rutaNombres, leer = (r) => readFileSync(r, 'utf8') }) {
  try {
    const j = JSON.parse(leer(rutaIds));
    return { fuente: rutaIds, conIds: true, leidoEn: j.leidoEn ?? null, carpetas: j.carpetas };
  } catch {
    // Sin archivo de ids: se cae al plan o a los nombres.
  }
  if (rutaPlan) {
    try {
      const carpetas = carpetasDelPlan(JSON.parse(leer(rutaPlan)));
      if (carpetas.length > 0) return { fuente: rutaPlan, conIds: false, leidoEn: null, carpetas };
    } catch {
      // Sin plan: se cae al inventario.
    }
  }
  try {
    const j = JSON.parse(leer(rutaNombres));
    const carpetas = (j.clientes ?? []).map((c) => ({ codigo: c.codigo, nombre: c.nombre, carpeta: c.carpeta, id: null }));
    return { fuente: rutaNombres, conIds: false, leidoEn: j.fecha ?? null, carpetas };
  } catch {
    return { fuente: null, conIds: false, leidoEn: null, carpetas: [] };
  }
}

/* ------------------------------------------------------------------------- */
/* Validación de datos de la planilla                                        */
/* ------------------------------------------------------------------------- */

/**
 * Validadores de la API (`@effort/schema`). Se inyectan para que el plan sea
 * una función pura; el CLI pasa los reales, los tests también (es el mismo
 * paquete que valida el formulario de alta en la pantalla).
 */
export async function cargarValidadores() {
  const { rucSchema, emailSchema, telefonoSchema } = await import('@effort/schema');
  return {
    ruc: (v) => rucSchema.safeParse(v).success,
    email: (v) => emailSchema.safeParse(v).success,
    telefono: (v) => telefonoSchema.safeParse(v).success,
  };
}

/* ------------------------------------------------------------------------- */
/* Plan                                                                      */
/* ------------------------------------------------------------------------- */

/** `general`: aviso que hoy aplica a casi todas las filas; el informe lo resume en vez de repetirlo (salvo --detalle). */
const problema = (bloquea, texto, general = false) => ({ bloquea, texto, general });

function iguales(a, b) {
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Decide qué se hace con cada fila. Pura: es la única parte con criterio, y así
 * se prueba sin base ni OneDrive.
 *
 * `problema.bloquea`: `'todo'` no se escribe nada de ese cliente; `'alta'`
 * impide crearlo, pero si ya existe se le puede completar lo demás; `false` es
 * un aviso.
 */
export function planificarAlta({
  filas,
  carpetas = [],
  conIds = false,
  existentes = null,
  asignaciones = [],
  catalogo = [],
  validar,
  forzar = [],
  codigos = [],
  desde = null,
}) {
  const baseLeida = Array.isArray(existentes);
  const forzados = new Set(forzar);
  const soloCodigos = new Set(codigos);
  const catalogoPorCodigo = new Map(catalogo.map((o) => [o.codigo, o]));
  const asignadas = new Set(asignaciones.map((a) => `${a.clienteId}|${a.obligacionId}`));

  const carpetasPorCodigo = new Map();
  for (const c of carpetas) carpetasPorCodigo.set(c.codigo, [...(carpetasPorCodigo.get(c.codigo) ?? []), c]);

  const filasPorCodigo = new Map();
  for (const f of filas) filasPorCodigo.set(f.codigo, [...(filasPorCodigo.get(f.codigo) ?? []), f]);

  const codigosPorRuc = new Map();
  for (const f of filas) {
    if (!f.ruc) continue;
    codigosPorRuc.set(f.ruc, [...(codigosPorRuc.get(f.ruc) ?? []), f.codigo]);
  }

  const acciones = [];
  for (const fila of filas) {
    if (soloCodigos.size > 0 && !soloCodigos.has(fila.codigo)) continue;
    const problemas = [];

    // --- Identidad: código, nombre y carpeta ---------------------------------
    if ((filasPorCodigo.get(fila.codigo) ?? []).length > 1) {
      problemas.push(problema('todo', `el código ${fila.codigo} aparece en más de una fila de la planilla`));
    }
    const nombre = fila.nombre && !/completar nombre/i.test(fila.nombre) ? fila.nombre : null;
    if (!nombre) problemas.push(problema('todo', 'sin nombre (EFFORT tiene que decir qué cliente es)'));

    const suyas = carpetasPorCodigo.get(fila.codigo) ?? [];
    let carpeta = null;
    if (suyas.length > 1) {
      problemas.push(problema('todo', `hay ${suyas.length} carpetas con el código ${fila.codigo} en CLIENTES`));
    } else if (suyas.length === 1) {
      carpeta = suyas[0];
      if (nombre && normalizar(`${fila.codigo} ${nombre}`) !== normalizar(carpeta.carpeta)) {
        problemas.push(problema(false, `la carpeta se llama «${carpeta.carpeta}», la planilla dice «${nombre}»`));
      }
    }
    const carpetaId = carpeta?.id ?? null;

    // --- RUC: se carga solo si es confiable; si no, queda pendiente -----------
    // Nunca bloquea el alta (Daniel, 2026-11-01: todos los que tienen carpeta
    // son clientes). Lo que nunca se hace es cargar un RUC dudoso o inventado:
    // un RUC equivocado da vencimientos falsos y cruza declaraciones ajenas.
    let rucValido = null;
    const pendiente = (motivo) => problemas.push(problema(false, `${motivo}: no se carga, el cliente queda «RUC pendiente»`));
    if (!fila.ruc) {
      problemas.push(problema(false, 'RUC pendiente: EFFORT todavía no lo dio; sin RUC no se calculan sus vencimientos'));
    } else if (!validar.ruc(fila.ruc)) {
      pendiente(`RUC «${fila.ruc}» con formato o dígito verificador inválido`);
    } else {
      const otros = (codigosPorRuc.get(fila.ruc) ?? []).filter((c) => c !== fila.codigo);
      const observado = RUC_OBSERVADOS[fila.codigo];
      if (otros.length > 0) {
        pendiente(`RUC ${fila.ruc} repetido en la planilla (también en ${otros.join(', ')})`);
      } else if (observado && observado.ruc === fila.ruc && observado.bloquea) {
        pendiente(`RUC ${fila.ruc} no corresponde: ${observado.motivo}`);
      } else {
        rucValido = fila.ruc;
        if (observado && observado.ruc === fila.ruc) problemas.push(problema(false, `RUC ${fila.ruc}: ${observado.motivo}`));
        if (fila.origenRuc && /sale de 1 de 1 /i.test(fila.origenRuc)) {
          problemas.push(problema(false, 'RUC deducido de una sola declaración: confirmar (lección de DISCREPANCIAS 44)'));
        }
      }
    }

    // --- Resto de los datos --------------------------------------------------
    if (!fila.tipoPersona) problemas.push(problema('alta', 'sin tipo de persona (Física / Jurídica): el esquema lo exige'));
    if (!fila.regimen) problemas.push(problema(false, 'régimen vacío: se carga sin régimen', true));
    if (fila.sigueSiendoCliente === null) problemas.push(problema(false, 'EFFORT no confirmó que siga siendo cliente', true));
    if (fila.aviso && !/no hay carpeta/i.test(fila.aviso)) problemas.push(problema(false, `aviso de la planilla: ${fila.aviso}`));

    let email = fila.email;
    if (email && !validar.email(email)) {
      problemas.push(problema(false, `correo «${email}» inválido: no se carga`));
      email = null;
    }
    let telefono = fila.telefono;
    if (telefono && !validar.telefono(telefono)) {
      problemas.push(problema(false, `teléfono «${telefono}» inválido: no se carga`));
      telefono = null;
    }
    const partesObs = [];
    if (fila.observaciones) partesObs.push(fila.observaciones);
    if (fila.otras) partesObs.push(`Otras obligaciones (el sistema todavía no las controla): ${fila.otras}`);
    const observaciones = partesObs.length > 0 ? partesObs.join(' | ').slice(0, 4000) : null;
    if (fila.responsable) {
      problemas.push(problema(false, `responsable «${fila.responsable}»: no se asigna acá (la cartera se carga desde Equipo)`));
    }

    // --- Cliente existente: por código, y si no, por carpeta o RUC ------------
    let existente = null;
    let existenteSegunPlanilla = false;
    if (baseLeida) {
      const porCodigo = existentes.find((c) => c.codigo === fila.codigo) ?? null;
      const porCarpeta = carpetaId ? existentes.find((c) => c.carpetaOneDriveId === carpetaId) ?? null : null;
      const porRuc = rucValido ? existentes.find((c) => c.ruc === rucValido) ?? null : null;
      const distintos = [...new Map([porCodigo, porCarpeta, porRuc].filter(Boolean).map((c) => [c.id, c])).values()];
      if (distintos.length > 1) {
        problemas.push(
          problema(
            'todo',
            `el código, la carpeta o el RUC apuntan a clientes distintos (${distintos.map((c) => `«${c.nombre}»`).join(', ')}): revisar a mano`,
          ),
        );
      }
      existente = porCodigo ?? porCarpeta ?? porRuc ?? null;
      if (existente && existente.codigo && existente.codigo !== fila.codigo) {
        problemas.push(problema('todo', `«${existente.nombre}» ya tiene el código ${existente.codigo}, no el ${fila.codigo}: revisar a mano`));
      }
      // Un RUC que en la base ya tiene otro cliente cae en uno de los dos
      // bloqueos de arriba (apuntan a clientes distintos, o ese cliente ya
      // tiene otro código): nunca se le carga a un segundo cliente.
    } else {
      existenteSegunPlanilla = /ya cargado en el sistema/i.test(fila.origenRuc ?? '');
    }

    if (!existente && !carpeta && !existenteSegunPlanilla) {
      problemas.push(problema('alta', 'sin carpeta en CLIENTES: no se da de alta (los clientes son los que tienen carpeta)'));
    }

    // --- Obligaciones ----------------------------------------------------------
    const marcadas = OBLIGACIONES_CONTROLADAS.filter((o) => fila.obligaciones[o] === true);
    const sinDato = OBLIGACIONES_CONTROLADAS.filter((o) => fila.obligaciones[o] === null);
    if (sinDato.length === OBLIGACIONES_CONTROLADAS.length) {
      problemas.push(problema(false, 'obligaciones sin completar en la planilla: no se asigna ninguna', true));
    }
    const obligacionesAAsignar = [];
    if (marcadas.length > 0 && !desde) {
      problemas.push(problema(false, `marca ${marcadas.join(', ')} pero falta --desde: no se asignan`));
    }
    for (const codigoObligacion of OBLIGACIONES_CONTROLADAS) {
      const enCatalogo = catalogoPorCodigo.get(codigoObligacion);
      const yaAsignada = existente && enCatalogo ? asignadas.has(`${existente.id}|${enCatalogo.id}`) : false;
      if (fila.obligaciones[codigoObligacion] === false && yaAsignada) {
        problemas.push(problema(false, `la planilla dice «No» a ${codigoObligacion} pero ya está asignada: no se quita`));
      }
      if (fila.obligaciones[codigoObligacion] !== true || !desde || yaAsignada) continue;
      if (baseLeida && !enCatalogo) {
        problemas.push(problema(false, `${codigoObligacion} no existe en obligacion_tributaria: no se asigna`));
        continue;
      }
      obligacionesAAsignar.push({ codigo: codigoObligacion, obligacionId: enCatalogo?.id ?? null });
    }

    // --- Decisión ----------------------------------------------------------------
    const datos = {
      codigo: fila.codigo,
      nombre,
      ruc: rucValido,
      tipoPersona: fila.tipoPersona,
      regimenTributario: fila.regimen,
      email,
      telefono,
      carpetaOneDriveId: carpetaId,
      observaciones,
    };
    const accion = {
      codigo: fila.codigo,
      nombre: nombre ?? fila.nombre,
      carpeta: carpeta?.carpeta ?? null,
      rucDePlanilla: fila.ruc,
      datos,
      problemas,
      cambios: {},
      conservados: [],
      obligaciones: obligacionesAAsignar,
      existente: existente ? { id: existente.id, nombre: existente.nombre, ruc: existente.ruc, codigo: existente.codigo ?? null } : null,
      existenteSegunPlanilla,
      tipo: null,
    };

    if (problemas.some((p) => p.bloquea === 'todo')) {
      accion.tipo = 'bloqueado';
    } else if (existente) {
      // El código no se pisa nunca (ni con --forzar-campo): solo se completa.
      if (!existente.codigo) accion.cambios.codigo = fila.codigo;
      for (const campo of ['nombre', 'tipoPersona', 'regimenTributario', 'email', 'telefono', 'carpetaOneDriveId', 'observaciones', 'ruc']) {
        const propuesto = datos[campo];
        if (propuesto === null || propuesto === undefined) continue;
        const actual = existente[campo];
        if (actual === null || actual === undefined || actual === '') accion.cambios[campo] = propuesto;
        else if (iguales(actual, propuesto)) continue;
        else if (forzados.has(campo)) accion.cambios[campo] = propuesto;
        else accion.conservados.push({ campo, actual, propuesto });
      }
      if (fila.sigueSiendoCliente !== null && existente.activo !== fila.sigueSiendoCliente) {
        if (forzados.has('activo')) accion.cambios.activo = fila.sigueSiendoCliente;
        else accion.conservados.push({ campo: 'activo', actual: existente.activo, propuesto: fila.sigueSiendoCliente });
      }
      accion.tipo = Object.keys(accion.cambios).length > 0 || obligacionesAAsignar.length > 0 ? 'actualizar' : 'sin_cambios';
    } else if (fila.sigueSiendoCliente === false) {
      accion.tipo = 'baja';
    } else if (existenteSegunPlanilla) {
      accion.tipo = 'existente_sin_verificar';
    } else if (!carpeta) {
      accion.tipo = 'sin_carpeta';
    } else if (problemas.some((p) => p.bloquea === 'alta')) {
      accion.tipo = 'bloqueado';
    } else {
      accion.tipo = 'crear';
    }
    acciones.push(accion);
  }

  const codigosDePlanilla = new Set(filas.map((f) => f.codigo));
  const carpetasSinCliente = carpetas.filter((c) => !codigosDePlanilla.has(c.codigo));

  const contar = (tipo) => acciones.filter((a) => a.tipo === tipo).length;
  const tienen = (a, re) => a.problemas.some((p) => re.test(p.texto));
  const conCarpeta = acciones.filter((a) => a.carpeta || a.existente || a.existenteSegunPlanilla);
  const resumen = {
    filas: acciones.length,
    crear: contar('crear'),
    crearConRucPendiente: acciones.filter((a) => a.tipo === 'crear' && !a.datos.ruc).length,
    actualizar: contar('actualizar'),
    sinCambios: contar('sin_cambios'),
    existentesSinVerificar: contar('existente_sin_verificar'),
    bloqueados: contar('bloqueado'),
    bajas: contar('baja'),
    sinCarpeta: contar('sin_carpeta'),
    carpetasSinCliente: carpetasSinCliente.length,
    conCarpetaAConectar: acciones.filter(
      (a) => (a.tipo === 'crear' && a.datos.carpetaOneDriveId) || (a.tipo === 'actualizar' && a.cambios.carpetaOneDriveId),
    ).length,
    obligacionesAAsignar: acciones
      .filter((a) => a.tipo === 'crear' || a.tipo === 'actualizar')
      .reduce((n, a) => n + a.obligaciones.length, 0),
    // Lo que falta de EFFORT, contado solo entre los clientes con carpeta.
    faltaDeEffort: {
      sinRuc: conCarpeta.filter((a) => tienen(a, /^RUC pendiente/)).length,
      rucQueNoCorresponde: conCarpeta.filter((a) => tienen(a, /no corresponde|repetido|ya es de|dígito verificador/)).length,
      rucAConfirmar: conCarpeta.filter((a) => a.datos.ruc && tienen(a, /confirmar/)).length,
      sinRegimen: conCarpeta.filter((a) => tienen(a, /^régimen vacío/)).length,
      sinObligaciones: conCarpeta.filter((a) => tienen(a, /^obligaciones sin completar/)).length,
      sinConfirmarQueSigue: conCarpeta.filter((a) => tienen(a, /no confirmó/)).length,
      sinNombre: acciones.filter((a) => tienen(a, /^sin nombre/)).length,
    },
  };

  return { acciones, carpetasSinCliente, resumen, baseLeida, conIds };
}

/* ------------------------------------------------------------------------- */
/* Informe                                                                   */
/* ------------------------------------------------------------------------- */

export function formatearInforme(plan, { fuenteCarpetas = null, detalle = false } = {}) {
  const l = [];
  const r = plan.resumen;
  const fila = (a) => {
    const d = a.datos;
    const carpeta = d.carpetaOneDriveId ? 'carpeta conectada' : a.carpeta ? 'carpeta sin id (falta --leer-carpetas)' : 'sin carpeta';
    const obl = a.obligaciones.length > 0 ? ` · obligaciones: ${a.obligaciones.map((o) => o.codigo).join(', ')}` : '';
    const ruc = d.ruc ?? (a.rucDePlanilla ? `PENDIENTE (${a.rucDePlanilla} no se usa)` : 'PENDIENTE');
    return `  ${a.codigo} ${String(a.nombre ?? '').padEnd(32).slice(0, 32)} RUC ${ruc} · ${d.tipoPersona ?? '—'} · régimen: ${d.regimenTributario ?? '—'} · ${carpeta}${obl}`;
  };
  const avisos = (a) =>
    a.problemas.filter((p) => detalle || !p.general).map((p) => `      ${p.bloquea ? '✗' : '·'} ${p.texto}`);

  l.push('');
  l.push(`Base de datos: ${plan.baseLeida ? 'leída (solo lectura)' : 'NO leída (--sin-base): no se sabe qué ya existe'}`);
  l.push(`Carpetas: ${fuenteCarpetas ?? 'ninguna fuente'}${plan.conIds ? '' : ' — SIN ids: con esto no se puede aplicar'}`);
  l.push('');
  l.push(
    `Filas: ${r.filas} · crear: ${r.crear} (con RUC pendiente: ${r.crearConRucPendiente}) · actualizar: ${r.actualizar} · sin cambios: ${r.sinCambios}` +
      (r.existentesSinVerificar ? ` · ya cargados según la planilla (sin verificar): ${r.existentesSinVerificar}` : '') +
      ` · sin carpeta (no son clientes del OneDrive): ${r.sinCarpeta} · no se dan de alta: ${r.bloqueados} · bajas: ${r.bajas}`,
  );

  const grupo = (titulo, tipo, detalle) => {
    const lista = plan.acciones.filter((a) => a.tipo === tipo);
    if (lista.length === 0) return;
    l.push('');
    l.push(`${titulo} (${lista.length})`);
    for (const a of lista) {
      l.push(fila(a));
      if (detalle) detalle(a);
      l.push(...avisos(a));
    }
  };
  grupo('CREAR', 'crear');
  grupo('ACTUALIZAR', 'actualizar', (a) => {
    for (const [campo, valor] of Object.entries(a.cambios)) l.push(`      → ${campo}: ${JSON.stringify(valor)}`);
    for (const c of a.conservados) {
      l.push(`      = ${c.campo}: se conserva ${JSON.stringify(c.actual)} (la planilla dice ${JSON.stringify(c.propuesto)}; --forzar-campo ${c.campo} para pisarlo)`);
    }
  });
  grupo('SIN CAMBIOS', 'sin_cambios', (a) => {
    for (const c of a.conservados) l.push(`      = ${c.campo}: se conserva ${JSON.stringify(c.actual)} (la planilla dice ${JSON.stringify(c.propuesto)})`);
  });
  grupo('YA CARGADOS SEGÚN LA PLANILLA (sin leer la base no se puede comparar)', 'existente_sin_verificar');
  grupo('NO SE DAN DE ALTA', 'bloqueado');
  grupo('SIN CARPETA EN CLIENTES (no se dan de alta: los clientes son los que tienen carpeta)', 'sin_carpeta');
  grupo('BAJAS (la planilla dice que ya no son clientes: no se crean)', 'baja');

  if (plan.carpetasSinCliente.length > 0) {
    l.push('');
    l.push(`CARPETAS SIN FILA EN LA PLANILLA (${plan.carpetasSinCliente.length}: falta al menos el tipo de persona, no se crean)`);
    for (const c of plan.carpetasSinCliente) l.push(`  ${c.carpeta}`);
  }

  const f = r.faltaDeEffort;
  l.push('');
  l.push('LO QUE FALTA DE EFFORT (clientes con carpeta)');
  l.push(`  RUC pendiente: ${f.sinRuc} · RUC que no corresponde, repetido o inválido: ${f.rucQueNoCorresponde} · RUC cargado a confirmar: ${f.rucAConfirmar} · sin nombre: ${f.sinNombre}`);
  l.push(`  sin régimen: ${f.sinRegimen} · sin obligaciones: ${f.sinObligaciones} · sin confirmar que siguen: ${f.sinConfirmarQueSigue}`);
  if (!detalle) l.push('  (régimen, obligaciones y confirmación no se repiten fila por fila; --detalle los muestra)');
  if (r.conCarpetaAConectar > 0) {
    l.push('');
    l.push(
      `OJO: ${r.conCarpetaAConectar} carpeta(s) se conectarían. Cada una empieza a sincronizarse en la vuelta siguiente ` +
        '(cada 15 min, con tope por vuelta). Con muchas a la vez la memoria del servidor es el riesgo (DISCREPANCIAS 43): aplicar en tandas con --codigos.',
    );
  }
  return l.join('\n');
}

/* ------------------------------------------------------------------------- */
/* Respaldo del día                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Busca en `./respaldos` un respaldo de hoy (fecha de Asunción o de UTC, porque
 * `respaldar-base.mjs` nombra el archivo con la hora UTC) que se pueda leer y
 * que tenga la tabla de clientes. Devuelve la ruta o `null`.
 */
export function buscarRespaldoDelDia({
  carpeta,
  ahora = new Date(),
  sistema = { readdirSync, statSync, readFileSync },
  rutaExplicita = null,
}) {
  const fechas = new Set([fechaEnAsuncion(ahora), ahora.toISOString().slice(0, 10)]);
  let candidatos;
  if (rutaExplicita) {
    candidatos = [rutaExplicita];
  } else {
    let nombres = [];
    try {
      nombres = sistema.readdirSync(carpeta);
    } catch {
      return null;
    }
    candidatos = nombres
      .filter((n) => {
        const m = /^respaldo-(\d{4}-\d{2}-\d{2})T.*\.json$/.exec(n);
        return m && fechas.has(m[1]);
      })
      .sort()
      .reverse()
      .map((n) => join(carpeta, n));
  }
  for (const ruta of candidatos) {
    try {
      const nombre = ruta.replace(/\\/g, '/').split('/').pop();
      const m = /^respaldo-(\d{4}-\d{2}-\d{2})T/.exec(nombre);
      if (!m || !fechas.has(m[1])) continue;
      if (sistema.statSync(ruta).size === 0) continue;
      const contenido = JSON.parse(sistema.readFileSync(ruta, 'utf8'));
      if (Array.isArray(contenido?.modelos?.cliente)) return ruta;
    } catch {
      // Ilegible: no cuenta como respaldo.
    }
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* Aplicar                                                                   */
/* ------------------------------------------------------------------------- */

function esViolacionDeUnicidad(error) {
  return error?.code === 'P2002' || /unique constraint/i.test(error?.message ?? '');
}

/**
 * Escribe lo planificado. Las dependencias se inyectan: en producción son
 * `ClientesPrisma`, `prisma.obligacionDeCliente` y `BitacoraPrisma` +
 * `registrarEvento`; en los tests, dobles. **No hay ninguna operación de
 * borrado** entre las que recibe ni entre las que llama.
 *
 * Un error en un cliente no corta a los demás (la red de esta máquina se corta
 * a la mitad): se anota y se sigue. Repetir la corrida completa lo que faltó.
 */
export async function aplicarPlan(plan, { clientes, obligaciones, registrar, operadorId, desde, log = () => {} }) {
  const resultado = { creados: 0, actualizados: 0, obligaciones: 0, fallos: [] };
  const evento = (accion, clienteId, datosAntes, datosDespues) =>
    registrar({
      usuarioId: operadorId,
      accion,
      entidad: 'cliente',
      entidadId: clienteId,
      clienteId,
      datosAntes,
      datosDespues: { ...datosDespues, via: VIA },
      agenteUsuario: VIA,
    });

  for (const a of plan.acciones) {
    if (a.tipo !== 'crear' && a.tipo !== 'actualizar') continue;
    try {
      let clienteId;
      if (a.tipo === 'crear') {
        // Se vuelve a mirar justo antes de escribir: entre la simulación y esto
        // alguien pudo cargarlo por la pantalla.
        const conEseCodigo = await clientes.buscarPorCodigo(a.codigo);
        if (conEseCodigo) {
          throw new Error(`ya existe un cliente con el código ${a.codigo} («${conEseCodigo.nombre}»); volver a simular`);
        }
        if (a.datos.ruc) {
          const yaEsta = await clientes.buscarPorRuc(a.datos.ruc);
          if (yaEsta) throw new Error(`ya existe un cliente con el RUC ${a.datos.ruc} («${yaEsta.nombre}»); volver a simular`);
        }
        const creado = await clientes.crear({
          codigo: a.codigo,
          nombre: a.datos.nombre,
          ruc: a.datos.ruc,
          tipoPersona: a.datos.tipoPersona,
          regimenTributario: a.datos.regimenTributario,
          email: a.datos.email,
          telefono: a.datos.telefono,
          canalPreferido: null,
          observaciones: a.datos.observaciones,
          creadoPorUsuarioId: operadorId,
        });
        clienteId = creado.id;
        // `crear` del repositorio no recibe la carpeta (la pantalla tampoco): se conecta con `actualizar`.
        if (a.datos.carpetaOneDriveId) {
          await clientes.actualizar(clienteId, { carpetaOneDriveId: a.datos.carpetaOneDriveId }, operadorId);
        }
        await evento('cliente.creado', clienteId, undefined, {
          codigo: a.codigo,
          nombre: a.datos.nombre,
          ruc: a.datos.ruc,
          tipoPersona: a.datos.tipoPersona,
          carpetaOneDriveId: a.datos.carpetaOneDriveId,
        });
        resultado.creados += 1;
        log(`  creado: ${a.codigo} ${a.datos.nombre}`);
      } else {
        clienteId = a.existente.id;
        if (Object.keys(a.cambios).length > 0) {
          if (a.cambios.codigo) {
            const conEseCodigo = await clientes.buscarPorCodigo(a.cambios.codigo);
            if (conEseCodigo && conEseCodigo.id !== clienteId) {
              throw new Error(`el código ${a.cambios.codigo} ya es de «${conEseCodigo.nombre}»`);
            }
          }
          if (a.cambios.ruc) {
            const conEseRuc = await clientes.buscarPorRuc(a.cambios.ruc);
            if (conEseRuc && conEseRuc.id !== clienteId) {
              throw new Error(`el RUC ${a.cambios.ruc} ya es de «${conEseRuc.nombre}»`);
            }
          }
          const previo = await clientes.buscarPorId(clienteId, null);
          await clientes.actualizar(clienteId, a.cambios, operadorId);
          const antes = Object.fromEntries(Object.keys(a.cambios).map((c) => [c, previo?.[c] ?? null]));
          await evento('cliente.actualizado', clienteId, antes, { codigo: a.codigo, ...a.cambios });
          resultado.actualizados += 1;
          log(`  actualizado: ${a.codigo} ${a.nombre} (${Object.keys(a.cambios).join(', ')})`);
        }
      }

      for (const o of a.obligaciones) {
        try {
          await obligaciones.crear({
            data: {
              clienteId,
              obligacionId: o.obligacionId,
              desde: new Date(`${desde}T00:00:00.000Z`),
              creadoPorUsuarioId: operadorId,
            },
          });
        } catch (error) {
          if (esViolacionDeUnicidad(error)) continue; // ya estaba: repetir la corrida es seguro
          throw error;
        }
        await evento('cliente.actualizado', clienteId, undefined, { codigo: a.codigo, obligacionAsignada: o.codigo, desde });
        resultado.obligaciones += 1;
      }
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      resultado.fallos.push({ codigo: a.codigo, motivo });
      log(`  FALLÓ ${a.codigo} ${a.nombre}: ${motivo}`);
    }
  }
  return resultado;
}

/* ------------------------------------------------------------------------- */
/* CLI                                                                       */
/* ------------------------------------------------------------------------- */

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
  if (argv.includes('--ayuda') || argv.includes('-h')) {
    console.log('Ver el comentario al principio de scripts/alta-masiva-clientes.mjs.');
    return;
  }
  const aplicar = argv.includes('--aplicar');
  const sinBase = argv.includes('--sin-base');
  const rutaPlanilla = argumento(argv, 'planilla') ?? PLANILLA_POR_DEFECTO;
  const rutaCarpetas = argumento(argv, 'carpetas') ?? CARPETAS_POR_DEFECTO;
  const desde = argumento(argv, 'desde');
  const forzar = listaDeArgumento(argv, 'forzar-campo');
  const codigos = listaDeArgumento(argv, 'codigos').map((c) => c.padStart(3, '0'));

  const desconocidos = forzar.filter((c) => !CAMPOS_FORZABLES.includes(c));
  if (desconocidos.length > 0) {
    console.error(`--forzar-campo no conoce: ${desconocidos.join(', ')}. Campos: ${CAMPOS_FORZABLES.join(', ')}.`);
    process.exit(1);
  }
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    console.error('--desde va en formato AAAA-MM-DD.');
    process.exit(1);
  }
  if (aplicar && sinBase) {
    console.error('--aplicar necesita leer la base: no se combina con --sin-base.');
    process.exit(1);
  }

  cargarEntorno(join(RAIZ, '.env'));

  // --- Lectura de carpetas (solo GET a Graph) -------------------------------
  if (argv.includes('--leer-carpetas')) {
    const salida = argumento(argv, 'salida') ?? rutaCarpetas;
    console.log(`Leyendo (solo GET) las carpetas de «${BASE_CLIENTES}» en el OneDrive de EFFORT…`);
    const leido = await leerCarpetasDeGraph({ fetch: globalThis.fetch, entorno: process.env });
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(salida, `${JSON.stringify(leido, null, 1)}\n`, 'utf8');
    console.log(`${leido.carpetas.length} carpetas con código guardadas en ${salida}.`);
    if (leido.ignoradas.length > 0) console.log(`Sin código (no son clientes o hay que preguntar): ${leido.ignoradas.join(' · ')}`);
    console.log('Anotar esta lectura en docs/BITACORA-ONEDRIVE.md (regla 5: todo acceso de lectura a una carpeta real se registra).');
    return;
  }

  // --- Planilla y carpetas ----------------------------------------------------
  const { default: ExcelJS } = await import('exceljs');
  const { filas, ilegibles, filaEncabezado } = await leerPlanilla(rutaPlanilla, ExcelJS);
  console.log(`\nPlanilla: ${rutaPlanilla}`);
  console.log(`  hoja «Clientes», encabezado en la fila ${filaEncabezado}, ${filas.length} filas con código`);
  for (const i of ilegibles) console.log(`  (fila ${i.filaExcel}: código «${i.codigo}» ilegible, se saltea)`);

  const carpetas = cargarCarpetas({
    rutaIds: rutaCarpetas,
    rutaPlan: argumento(argv, 'plan') ?? PLAN_DEL_ORDENAMIENTO,
    rutaNombres: NOMBRES_DE_CARPETAS,
  });
  const validar = await cargarValidadores();

  // --- Base (solo lectura salvo --aplicar) -----------------------------------
  let prisma = null;
  let existentes = null;
  let asignaciones = [];
  let catalogo = [];
  let repositorioClientes = null;
  if (!sinBase) {
    const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!url) {
      console.error('Falta DIRECT_URL o DATABASE_URL en el entorno. Para simular sin base: --sin-base.');
      process.exit(1);
    }
    const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(
      () => import('@prisma/client'),
    );
    prisma = new PrismaClient({ datasourceUrl: url });
    const { ClientesPrisma } = await import('@effort/api/dist/repositorios/clientes.js');
    repositorioClientes = new ClientesPrisma(prisma);
    existentes = await repositorioClientes.listar(null);
    asignaciones = await prisma.obligacionDeCliente.findMany({ select: { clienteId: true, obligacionId: true } });
    catalogo = await prisma.obligacionTributaria.findMany({ select: { id: true, codigo: true, activa: true } });
  }

  try {
    const plan = planificarAlta({
      filas,
      carpetas: carpetas.carpetas,
      conIds: carpetas.conIds,
      existentes,
      asignaciones,
      catalogo,
      validar,
      forzar,
      codigos,
      desde,
    });
    console.log(formatearInforme(plan, { fuenteCarpetas: carpetas.fuente, detalle: argv.includes('--detalle') }));

    if (!aplicar) {
      console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar para hacerlo de verdad.');
      return;
    }

    // --- Candados antes de escribir ------------------------------------------
    if (!carpetas.conIds && !argv.includes('--sin-carpetas')) {
      console.error(
        '\nNo hay ids de carpeta (falta correr --leer-carpetas). Sin ellos los clientes quedan sin conectar. ' +
          'Si es a propósito: --sin-carpetas.',
      );
      process.exitCode = 1;
      return;
    }
    const respaldo = buscarRespaldoDelDia({
      carpeta: join(process.cwd(), 'respaldos'),
      rutaExplicita: argumento(argv, 'respaldo'),
    });
    if (!respaldo) {
      console.error('\nNo hay un respaldo de la base de HOY. Correr antes: node scripts/respaldar-base.mjs');
      process.exitCode = 1;
      return;
    }
    console.log(`\nRespaldo del día: ${respaldo}`);
    if (plan.resumen.crear + plan.resumen.actualizar === 0) {
      console.log('No hay nada que escribir.');
      return;
    }

    const operador = await prisma.usuario.findFirst({ where: { email: CUENTA_DEL_SISTEMA }, select: { id: true } });
    if (!operador) {
      console.error('No se encontró la cuenta del sistema para atribuir los cambios. Se aborta.');
      process.exitCode = 1;
      return;
    }
    const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
    const { registrarEvento } = await import('@effort/api/dist/bitacora.js');
    const bitacora = new BitacoraPrisma(prisma);
    const registradorDeErrores = { error: (datos, mensaje) => console.error(`  ${mensaje}`, datos) };

    const resultado = await aplicarPlan(plan, {
      clientes: repositorioClientes,
      obligaciones: { crear: (args) => prisma.obligacionDeCliente.create(args) },
      registrar: (entrada) => registrarEvento(bitacora, registradorDeErrores, entrada),
      operadorId: operador.id,
      desde,
      log: (t) => console.log(t),
    });
    console.log(
      `\nListo: ${resultado.creados} creados, ${resultado.actualizados} actualizados, ${resultado.obligaciones} obligaciones asignadas, ${resultado.fallos.length} fallos.`,
    );
    if (resultado.fallos.length > 0) {
      console.log('Volver a correr el mismo comando completa lo que faltó (no duplica).');
      process.exitCode = 1;
    }
  } finally {
    await prisma?.$disconnect();
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
