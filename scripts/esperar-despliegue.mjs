#!/usr/bin/env node
/**
 * Espera a que el sitio público sirva la versión desplegada.
 *
 * Hasta el 2026-09-16 la única forma de saber si un despliegue terminó era
 * "bajar el .js y buscar un texto nuevo" a mano (`docs/ROADMAP-MAESTRO.md`,
 * regla 7 de CLAUDE.md). Eso alcanza para saber que la WEB cambió, pero no
 * dice nada de la API — una web nueva contra una API vieja pasa inadvertida
 * si solo se mira el bundle.
 *
 * Por eso este script pide DOS señales, no una:
 *  1. El bundle principal de la web contiene el marcador que se le pasa (un
 *     texto que solo existe en el código nuevo).
 *  2. Un endpoint público de la API responde 200 (prueba que el proceso nuevo
 *     está arriba y atendiendo, no que el DNS resuelve).
 *
 * Solo hace peticiones GET a rutas públicas. No manda credenciales, no lee
 * `.env`, no escribe nada. Sondea cada 60 segundos y se rinde a los 30
 * minutos: un despliegue de DigitalOcean que tarda más que eso es en sí mismo
 * una señal de que algo anda mal, y hay que mirarlo a mano.
 *
 * Uso:
 *   node scripts/esperar-despliegue.mjs --marcador "texto nuevo del bundle"
 *   node scripts/esperar-despliegue.mjs --marcador "..." --base https://effort360.disaak.com
 *
 * Sale con código 0 si encontró las dos señales, 1 si se agotó el tiempo.
 */

const SONDEO_MS = 60 * 1000;
const TOPE_MS = 30 * 60 * 1000;
const BASE_POR_DEFECTO = 'https://effort360.disaak.com';
/** Ruta pública que no exige sesión: solo confirma que el proceso responde. */
const RUTA_DE_SALUD = '/api/v1/csrf';

function leerArgumentos(argv) {
  const args = { base: BASE_POR_DEFECTO, marcador: null, tope: TOPE_MS, sondeo: SONDEO_MS };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--marcador') args.marcador = argv[++i];
    else if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--tope-ms') args.tope = Number(argv[++i]);
    else if (argv[i] === '--sondeo-ms') args.sondeo = Number(argv[++i]);
  }
  return args;
}

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/** Encuentra la primera URL de script `.js` que referencia el HTML servido. */
function extraerRutaDelBundle(html) {
  const coincidencia = html.match(/<script[^>]+src="([^"]+\.js)"/);
  return coincidencia?.[1] ?? null;
}

/**
 * Busca el marcador en el bundle principal de la web.
 *
 * Devuelve `null` si todavía no lo encuentra (para reintentar) y lanza si la
 * petición en sí falla de forma que no tiene sentido reintentar (por ejemplo,
 * el HTML no tiene ningún script — señal de que la ruta cambió y hay que
 * revisar a mano, no seguir sondeando 30 minutos para nada).
 */
async function bundleTieneMarcador(base, marcador) {
  const html = await fetch(base, { redirect: 'follow' }).then((r) => r.text());
  const rutaDelBundle = extraerRutaDelBundle(html);
  if (!rutaDelBundle) {
    throw new Error(
      `No se encontró ningún <script src="*.js"> en ${base}. ¿Cambió la forma de servir la web?`,
    );
  }
  const urlDelBundle = new URL(rutaDelBundle, base).toString();
  const bundle = await fetch(urlDelBundle).then((r) => r.text());
  return bundle.includes(marcador);
}

async function apiResponde(base) {
  try {
    const respuesta = await fetch(new URL(RUTA_DE_SALUD, base).toString());
    return respuesta.ok;
  } catch {
    return false;
  }
}

async function principal() {
  const { base, marcador, tope, sondeo } = leerArgumentos(process.argv.slice(2));

  if (!marcador) {
    console.error('Falta --marcador "texto que solo está en el código nuevo".');
    process.exit(2);
  }

  console.log(`Esperando el despliegue de ${base} (marcador: "${marcador}")…`);
  const desde = Date.now();

  while (Date.now() - desde < tope) {
    const [bundleOk, apiOk] = await Promise.all([
      bundleTieneMarcador(base, marcador).catch((error) => {
        console.warn(`  (bundle: ${error.message})`);
        return false;
      }),
      apiResponde(base),
    ]);

    console.log(
      `  [${new Date().toISOString()}] bundle nuevo: ${bundleOk ? 'sí' : 'todavía no'} · API responde: ${apiOk ? 'sí' : 'no'}`,
    );

    if (bundleOk && apiOk) {
      console.log('Despliegue confirmado: el bundle tiene el marcador y la API responde.');
      process.exit(0);
    }

    await esperar(sondeo);
  }

  console.error(
    `Se agotaron los ${Math.round(tope / 60000)} minutos sin confirmar el despliegue. Revisar a mano ` +
      'en el panel de DigitalOcean (Activity, Runtime Logs) antes de seguir.',
  );
  process.exit(1);
}

await principal();
