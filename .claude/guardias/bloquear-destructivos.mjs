/**
 * Freno mecánico contra comandos destructivos.
 *
 * Existe por un incidente real: el 2026-09-13, trabajando en effort-control-360,
 * se corrió `prisma migrate diff --shadow-database-url "$DIRECT_URL"`. Prisma
 * RESETEA la base que recibe como shadow — es su diseño — y ahí apuntaba la base
 * de producción. Se borraron usuarios, clientes, 1574 documentos, vencimientos,
 * alertas y la bitácora de auditoría entera.
 *
 * Lo que falló no fue la falta de una regla escrita: las reglas escritas ya
 * existían y hablaban de no borrar nada de EFFORT. Falló que **nada mecánico lo
 * impidiera**. Una regla que solo vive en un documento depende del criterio de
 * quien la lee, y el criterio falla.
 *
 * Este archivo es lo que no depende del criterio.
 *
 * ---
 *
 * **Qué hace.** Corre antes de cada comando de shell (hook `PreToolUse` sobre
 * Bash, PowerShell y Monitor). Si el comando coincide con un patrón destructivo,
 * sale con código 2 y el comando NO se ejecuta.
 *
 * **Falla cerrado.** Si este archivo tiene un error, o la entrada no se puede
 * leer, bloquea en vez de dejar pasar (2026-09-16: la versión anterior dejaba
 * pasar todo si fallaba). El hook de `settings.json` agrega `|| exit 2` para el
 * caso en que el archivo directamente no exista.
 *
 * **Qué NO hace, y conviene tenerlo claro.** No es infalible: no lee el
 * contenido de los scripts o archivos SQL que un comando ejecuta, y quien tenga
 * permiso de editar este archivo puede desactivarlo. Por eso hay una copia
 * versionada en `effort-control-360/.claude/guardias/`: un cambio ahí aparece en
 * `git diff`.
 *
 * **Cómo se autoriza un borrado legítimo.** No desde acá: lo corre Daniel en su
 * propia terminal, o lo autoriza expresamente y queda registrado. El punto es
 * que la decisión sea de una persona.
 *
 * **Regla que no tiene excepción:** nada se borra ni se modifica en las
 * carpetas de OneDrive de EFFORT (las de Laura y Lili). Ni con autorización.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
// Las pruebas escriben en otro archivo: el registro real es para intentos reales.
const REGISTRO = process.env.GUARDIA_REGISTRO || join(AQUI, 'intentos-bloqueados.log');

/** Prefijo de `git` que admite opciones antes del subcomando (`git -C <ruta> push`). */
const GIT = String.raw`\bgit(?:\s+(?:-C\s+(?:"[^"]*"|'[^']*'|\S+)|-c\s+\S+|--[\w-]+(?:=\S+)?))*\s+`;
/** Un tramo del mismo comando: hasta el próximo separador. */
const TRAMO = String.raw`[^\n;&|]*`;
/** Método HTTP DELETE, en cualquiera de las formas en que se escribe. */
const METODO_DELETE = String.raw`(?:-X\s*|--request[\s=]+|-Method\s+|--method[\s=]+)['"]?delete\b|method\s*:\s*['"]delete['"]`;

/**
 * Patrones prohibidos.
 *
 * Cada uno lleva el motivo que se le muestra a quien lo intenta: un bloqueo que
 * no explica por qué bloquea invita a buscarle la vuelta.
 */
const PROHIBIDOS = [
  {
    patron: /--shadow-database-url/i,
    motivo:
      'Prisma RESETEA la base que recibe como shadow database. Esto fue exactamente ' +
      'lo que borró la base de producción de EFFORT el 2026-09-13. ' +
      'Para generar una migración: escribí el SQL a mano, como el resto de las migraciones del proyecto.',
  },
  {
    patron: /\bprisma(?:@\S+)?\s+migrate\s+(?:reset|dev|resolve)\b/i,
    motivo:
      '`migrate reset` borra todos los datos, `migrate dev` puede resetear sin preguntar, y ' +
      '`migrate resolve` marca migraciones como aplicadas sin aplicarlas. En este proyecto se usa ' +
      '`migrate deploy`, que solo aplica.',
  },
  {
    patron: /\bprisma(?:@\S+)?\s+db\s+push\b/i,
    motivo:
      '`db push` puede descartar datos para hacer encajar el esquema. Las migraciones de este ' +
      'proyecto se escriben a mano y se aplican con `migrate deploy`.',
  },
  {
    patron:
      /\bdrop\s+(?:database|schema|table|owned|type|view|materialized\s+view|trigger|policy|function|role|user|index|sequence|extension)\b/i,
    motivo:
      'DROP elimina objetos de la base de forma irreversible. Un DROP TRIGGER o DROP POLICY, además, ' +
      'quita las protecciones de la bitácora de auditoría y de RLS.',
  },
  {
    patron: /\balter\s+table\b[^;]*\bdrop\b|\bdisable\s+(?:row\s+level\s+security|trigger)\b/i,
    motivo: 'Quitar columnas, restricciones o protecciones de una tabla no se deshace.',
  },
  {
    patron: /\btruncate\b/i,
    motivo: 'TRUNCATE vacía una tabla entera sin dejar rastro ni posibilidad de deshacer.',
  },
  {
    patron: /\bdropdb\b|\bpg_restore\b[^\n;&|]*(?:\s--clean\b|\s-[a-zA-Z]*c)/i,
    motivo: 'Borra o pisa una base entera. Restaurar también es destructivo: pisa el estado actual.',
  },
  {
    patron: /\.deleteMany\s*\(\s*(?:\{\s*(?:where\s*:\s*\{\s*\}\s*,?\s*)?\}\s*)?\)/i,
    motivo: '`deleteMany` sin filtro (o con filtro vacío) borra todas las filas del modelo.',
  },
  {
    patron: new RegExp(
      GIT +
        String.raw`push\b` +
        TRAMO +
        String.raw`?(?:\s--force(?!-with-lease)\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+\S|\s--mirror\b|\s--delete\b|\s-d\b|\s:\S)`,
      'i',
    ),
    motivo:
      'Un push forzado (--force, -f, +rama) o que borra ramas remotas (--delete, :rama, --mirror) ' +
      'puede eliminar commits del repositorio remoto.',
  },
  {
    patron: new RegExp(GIT + String.raw`reset\b` + TRAMO + String.raw`--hard`, 'i'),
    motivo: '`git reset --hard` descarta cambios locales sin posibilidad de recuperarlos.',
  },
  {
    patron: new RegExp(GIT + String.raw`clean\b` + TRAMO + String.raw`(?:\s-[a-zA-Z]*f|\s--force)`, 'i'),
    motivo: '`git clean` con -f borra archivos sin seguimiento, que git no puede recuperar.',
  },
  {
    patron: new RegExp(GIT + String.raw`stash\s+(?:drop|clear)\b`, 'i'),
    motivo: 'Descartar un stash borra trabajo guardado que no está en ningún commit.',
  },
  {
    // Sin la bandera `i`: -D (forzado) y -d (seguro) se distinguen por mayúscula.
    patron: new RegExp(GIT + String.raw`branch\b` + TRAMO + String.raw`\s(?:-D\b|-[a-zA-Z]*D|--delete\s+--force|--force\s+--delete)`),
    motivo: '`git branch -D` borra una rama aunque tenga commits que no están en ningún otro lado.',
  },
  {
    patron: /\bgh\s+repo\s+(?:delete|archive|rename)\b|\bgh\s+repo\s+sync\b[^\n;&|]*--force/i,
    motivo: 'Borra, archiva o pisa el repositorio de GitHub.',
  },
  {
    patron: new RegExp(String.raw`\bgh\s+api\b` + TRAMO + '(?:' + METODO_DELETE + ')', 'i'),
    motivo: 'Una llamada DELETE a la API de GitHub borra algo del repositorio o de la cuenta.',
  },
  {
    patron: /\bsupabase\b[^\n;&|]*\bdb\s+reset\b|\bsupabase\s+projects\s+delete\b/i,
    motivo: '`supabase db reset` borra la base (con --linked, la de la nube).',
  },
  {
    patron: /\bdoctl\b[^\n;&|]*\s(?:delete|destroy|rm|update)\b/i,
    motivo: 'Cambia o borra recursos de DigitalOcean, donde corre producción.',
  },
  {
    patron: new RegExp(String.raw`supabase\.co\S*` + TRAMO + '(?:' + METODO_DELETE + ')|(?:' + METODO_DELETE + ')' + TRAMO + String.raw`supabase\.co`, 'i'),
    motivo: 'Un DELETE contra la API de Supabase borra filas de la base.',
  },
];

/**
 * Borrar en OneDrive.
 *
 * `DriveDeArchivos` no tiene ni debe tener nunca un método de borrado (regla 5
 * de `effort-control-360/CLAUDE.md`). EFFORT no tiene copia de seguridad de sus
 * propios archivos: un borrado ahí no se deshace de ninguna forma. Se vigila
 * también desde acá porque es la regla más cara de romper de todo el proyecto.
 */
const PROHIBIDOS_ONEDRIVE = [
  {
    patron: new RegExp(
      String.raw`graph\.microsoft\.com` + TRAMO + '(?:' + METODO_DELETE + ')|(?:' + METODO_DELETE + ')' + TRAMO + String.raw`graph\.microsoft\.com`,
      'i',
    ),
    motivo:
      'Borrar en OneDrive. EFFORT no tiene copia de seguridad de sus archivos: ' +
      'esto no se deshace de ninguna forma. Prohibido sin excepción.',
  },
  {
    patron: /\bpermanentDelete\b|\bRemove-Mg(?:Drive|User|Group|Site)\w*/i,
    motivo:
      'Borrado permanente en OneDrive o Microsoft 365 (sin pasar por la papelera). ' +
      'Prohibido sin excepción.',
  },
];

/**
 * Comandos que solo leen.
 *
 * Existe por los falsos positivos del 2026-09-16: dos búsquedas con `grep` se
 * bloquearon porque el TEXTO buscado era "TRUNCATE" o "DELETE FROM". Buscar una
 * palabra no es ejecutarla. Un guardia que frena lo cotidiano se termina
 * desactivando (CLAUDE.md), así que lo que solo lee pasa entero.
 *
 * La excepción es estrecha a propósito: TODOS los tramos del comando tienen que
 * ser de lectura, y no puede haber sustitución de comandos (`$(…)`, comillas
 * invertidas), que ejecutaría algo aunque el comando de afuera solo lea.
 */
const SOLO_LECTURA = new Set([
  'grep', 'egrep', 'fgrep', 'rg', 'findstr', 'select-string', 'sls',
  'cat', 'type', 'get-content', 'gc', 'head', 'tail', 'less', 'more',
  'wc', 'sort', 'uniq', 'cut', 'ls', 'dir', 'get-childitem', 'gci',
  'cd', 'set-location', 'pushd', 'popd', 'pwd',
]);
const GIT_SOLO_LECTURA = new Set(['grep', 'log', 'show', 'diff', 'blame', 'status']);

/**
 * Parte el comando en tramos (`&&`, `||`, `;`, `|`, salto de línea), sin cortar
 * dentro de comillas: `grep "drop\|delete"` es un solo tramo.
 */
function tramosDe(texto) {
  const tramos = [];
  let actual = '';
  let comilla = null;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    // `\"` no abre ni cierra comillas en bash (salvo dentro de comillas simples).
    if (c === '\\' && comilla !== "'") {
      actual += c + (texto[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (comilla) {
      if (c === comilla) comilla = null;
      actual += c;
      continue;
    }
    if (c === '"' || c === "'") {
      comilla = c;
      actual += c;
      continue;
    }
    if (c === '\n' || c === ';' || c === '|' || (c === '&' && texto[i + 1] === '&')) {
      tramos.push(actual);
      actual = '';
      if ((c === '|' || c === '&') && texto[i + 1] === c) i += 1;
      continue;
    }
    actual += c;
  }
  tramos.push(actual);
  const resultado = tramos.map((t) => t.trim().replace(/^[({]\s*/, '')).filter(Boolean);
  // Comillas sin cerrar: no se sabe dónde termina cada tramo. Quien llama lo
  // trata como "no se puede asegurar que solo lea".
  resultado.comillasSinCerrar = comilla !== null;
  return resultado;
}

function soloLee(texto) {
  if (/\$\(|`|<\(|\bxargs\b|-exec(?:dir)?\b|-delete\b|\bsed\s+[^\n;&|]*-i/i.test(texto)) return false;
  const tramos = tramosDe(texto);
  if (tramos.comillasSinCerrar) return false;
  return tramos.every((tramo) => {
    const palabras = tramo.split(/\s+/);
    const primera = palabras[0].toLowerCase();
    if (SOLO_LECTURA.has(primera)) return true;
    if (primera === 'sed') return /\s-n\b/.test(tramo);
    if (primera === 'find') return true; // -exec y -delete ya se descartaron arriba
    if (primera === 'git') {
      const sub = palabras.slice(1).find((p, i, arr) => !p.startsWith('-') && arr[i - 1] !== '-C' && arr[i - 1] !== '-c');
      return GIT_SOLO_LECTURA.has(String(sub).toLowerCase());
    }
    return false;
  });
}

/**
 * Quita el TEXTO de un mensaje de commit antes de revisar.
 *
 * Hizo falta el mismo día en que se instaló esta guardia: bloqueó un commit
 * cuyo MENSAJE describía el incidente y por lo tanto nombraba el comando
 * peligroso. Un mensaje de commit es texto, no una orden.
 *
 * Solo se quita lo que de verdad es texto:
 *  - el cuerpo de un heredoc atado a `git commit` con delimitador ENTRE
 *    COMILLAS (`<<'FIN'`). Sin comillas, bash expande `$(…)` dentro del cuerpo y
 *    eso SÍ se ejecuta. La línea que abre el heredoc se sigue revisando entera:
 *    la versión anterior borraba también lo que venía después de `<<'FIN'` en la
 *    misma línea (`git commit -F - <<'FIN' && <borrado>` pasaba).
 *  - un here-string de PowerShell con comillas simples (`@'…'@`), que tampoco
 *    expande nada.
 *  - el texto de `-m "…"` / `-m '…'`, salvo que tenga `$(` o comillas invertidas.
 */
function sinMensajeDeCommit(texto) {
  const esCommit = new RegExp(GIT + 'commit\\b', 'i');
  if (!esCommit.test(texto)) return texto;

  const lineas = texto.split('\n');
  const salida = [];
  let delimitador = null;
  for (const linea of lineas) {
    if (delimitador !== null) {
      if (linea.trim() === delimitador) {
        salida.push(linea);
        delimitador = null;
      }
      continue;
    }
    salida.push(linea);
    const abre = linea.match(new RegExp(GIT + String.raw`commit\b[^\n]*?<<-?\s*(['"])([A-Za-z_]\w*)\1`, 'i'));
    if (abre) delimitador = abre[2];
  }

  return salida
    .join('\n')
    .replace(/@'\r?\n[\s\S]*?\r?\n'@/g, "@''@")
    .replace(/(\s-m\s*)("(?:[^"\\$`]|\\.)*"|'[^']*')/g, '$1""');
}

/**
 * DELETE o UPDATE sin WHERE, revisando cada sentencia por separado.
 *
 * La versión anterior aceptaba cualquier WHERE que apareciera más adelante en
 * el comando, aunque fuera de otra sentencia (`-c "DELETE FROM x" -c "SELECT …
 * WHERE …"`), y aceptaba `WHERE true`.
 */
function sentenciaMasivaSinFiltro(texto) {
  const inicio = /\bdelete\s+from\b|\bupdate\s+[\w."]+\s+set\b/gi;
  let coincidencia;
  while ((coincidencia = inicio.exec(texto))) {
    const resto = texto.slice(coincidencia.index + coincidencia[0].length);
    const fin = resto.search(/[;"`\n]/);
    const sentencia = fin === -1 ? resto : resto.slice(0, fin);
    const filtro = sentencia.match(/\bwhere\b([\s\S]*)$/i);
    if (!filtro) return true;
    if (/^\s*(?:true|1\s*=\s*1|'1'\s*=\s*'1'|not\s+false)\s*$/i.test(filtro[1])) return true;
  }
  return false;
}

/** Carpetas desechables: se pueden borrar recursivamente sin preguntar. */
const DESCARTABLE =
  /(?:^|[\\/])(?:node_modules|dist|build|coverage|test-results|playwright-report|\.turbo|temp|tmp|scratchpad)(?:[\\/]|$)/i;

function partirArgumentos(texto) {
  return (texto.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((a) => a.replace(/^["']|["']$/g, ''));
}

/**
 * Borrado recursivo fuera de las carpetas desechables, en bash, PowerShell o cmd.
 *
 * Se revisa cada tramo y CADA destino: la versión anterior perdonaba el comando
 * entero si en cualquier lugar de la línea aparecía `node_modules`
 * (`rm -rf apps/web/dist apps/api/src` pasaba), no veía `rm -r -f` con las
 * banderas separadas, y no conocía `Remove-Item -Recurse`, que es lo que se usa
 * en PowerShell, la terminal principal de esta máquina.
 */
function borradoRecursivoPeligroso(texto) {
  for (const tramo of tramosDe(texto)) {
    const bash = tramo.match(/(?<![\w-])(?<!git\s)(?:sudo\s+)?rm\s+(.*)$/i);
    const ps = tramo.match(/(?<![\w-])(?:Remove-Item|ri|rmdir|rd|del|erase)\s+(.*)$/i);
    let argumentos = null;
    let recursivo = false;

    if (bash) {
      argumentos = partirArgumentos(bash[1]);
      recursivo = argumentos.some(
        (a) => a === '--recursive' || (/^-[a-zA-Z]+$/.test(a) && /[rR]/.test(a)),
      );
    } else if (ps) {
      argumentos = partirArgumentos(ps[1]);
      recursivo = argumentos.some((a) => /^-r(?:e(?:c(?:u(?:r(?:s(?:e)?)?)?)?)?)?$/i.test(a) || /^\/s$/i.test(a));
    }
    if (!recursivo) continue;

    // Banderas: `-x` en los dos mundos, y `/s` `/q` en cmd. Una ruta tipo
    // `/c/Users/…` no es bandera.
    const destinos = argumentos.filter((a) => !a.startsWith('-') && !(ps && /^\/[a-z?]$/i.test(a)));
    const esDescartable = (d) => DESCARTABLE.test(d) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(d);
    if (destinos.length === 0 || !destinos.every(esDescartable)) return true;
  }
  return false;
}

const CHEQUEOS_ESPECIALES = [
  {
    prueba: sentenciaMasivaSinFiltro,
    motivo: 'Un DELETE o UPDATE sin WHERE (o con WHERE true) afecta la tabla entera.',
  },
  {
    prueba: borradoRecursivoPeligroso,
    motivo:
      'Borrado recursivo fuera de las carpetas desechables (node_modules, dist, build, ' +
      'coverage, temporales). Si es una de esas, nombrala en cada ruta del comando.',
  },
];

function bloquear(motivo, patron, comandoCrudo) {
  try {
    mkdirSync(dirname(REGISTRO), { recursive: true });
    appendFileSync(
      REGISTRO,
      `${new Date().toISOString()}\t${patron}\t${String(comandoCrudo).replace(/\s+/g, ' ').slice(0, 400)}\n`,
      'utf8',
    );
  } catch {
    // Que no se pueda escribir el registro no puede impedir el bloqueo.
  }

  process.stderr.write(
    [
      'COMANDO BLOQUEADO por la guardia de operaciones destructivas.',
      '',
      `Motivo: ${motivo}`,
      '',
      'Esta guardia existe porque el 2026-09-13 se borró la base de producción de EFFORT',
      'con un comando parecido. No la desactives para seguir adelante.',
      '',
      'Si el borrado es legítimo, no lo corras: pedile a Daniel su autorización expresa,',
      'y que lo ejecute él. La decisión de borrar datos de EFFORT es de una persona.',
      '',
    ].join('\n'),
  );
  process.exit(2);
}

function principal() {
  let entrada;
  try {
    entrada = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    bloquear('La guardia no pudo leer el comando. Ante la duda, no se ejecuta.', 'entrada-ilegible', '');
  }

  const comandoCrudo = String(entrada?.tool_input?.command ?? entrada?.tool_input?.cmd ?? '');
  if (!comandoCrudo.trim()) process.exit(0);

  const comando = sinMensajeDeCommit(comandoCrudo);
  if (soloLee(comando)) process.exit(0);

  const regla =
    PROHIBIDOS.find((r) => r.patron.test(comando)) ??
    PROHIBIDOS_ONEDRIVE.find((r) => r.patron.test(comando));
  if (regla) bloquear(regla.motivo, regla.patron, comandoCrudo);

  const especial = CHEQUEOS_ESPECIALES.find((c) => c.prueba(comando));
  if (especial) bloquear(especial.motivo, especial.prueba.name, comandoCrudo);

  process.exit(0);
}

try {
  principal();
} catch (error) {
  // Falla cerrado: una guardia rota no puede convertirse en una puerta abierta.
  bloquear(
    `La guardia falló (${error instanceof Error ? error.message : error}). ` +
      'Ante la duda, no se ejecuta: hay que arreglar la guardia, no esquivarla.',
    'error-interno',
    '',
  );
}
