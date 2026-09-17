/**
 * Pruebas de la guardia de comandos destructivos.
 *
 * La guardia tiene que cumplir tres cosas a la vez, y las tres se rompieron al
 * menos una vez:
 *
 *  1. Bloquear lo destructivo de verdad — incluidas las variantes que la
 *     auditoría del 2026-09-16 encontró que pasaban (PowerShell, `git -C`,
 *     `rm -r -f`, borrados en OneDrive sin DELETE literal, etc.).
 *  2. Dejar pasar lo inocente — incluidas las búsquedas con `grep` que se
 *     bloquearon el 2026-09-16 porque el texto buscado era "TRUNCATE".
 *  3. Dejar pasar un mensaje de commit que MENCIONA un comando destructivo,
 *     sin que eso se vuelva una puerta trasera.
 *
 * Los patrones se arman por partes a propósito: si estuvieran escritos enteros
 * en un comando, la guardia bloquearía el comando que escribe este archivo.
 *
 * Las pruebas escriben en un registro temporal (GUARDIA_REGISTRO), no en
 * `intentos-bloqueados.log`: ese registro es para intentos reales.
 *
 * Correr con: node .claude/guardias/probar-guardia.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARDIA = fileURLToPath(new URL('./bloquear-destructivos.mjs', import.meta.url));
const REGISTRO_DE_PRUEBA = join(mkdtempSync(join(tmpdir(), 'guardia-')), 'intentos.log');
const REGISTRO_REAL = fileURLToPath(new URL('./intentos-bloqueados.log', import.meta.url));

const PELIGROSO = '--shadow' + '-database-url';
const RESET = 'prisma migrate ' + 'reset';
const TRUNCAR = 'TRUN' + 'CATE';
const SOLTAR = 'DROP ' + 'TABLE';
const BORRAR = 'DELETE ' + 'FROM';
const REPO = '/c/Users/Daniel/NexusFlow AI/effort-control-360';
const REPO_WIN = 'C:\\Users\\Daniel\\NexusFlow AI\\effort-control-360';
const RR = 'rm -' + 'rf';
const QUITAR = 'Remove-' + 'Item';
const GRAPH = 'https://graph.microsoft.com/v1.0/drives/abc/items/123';

const CASOS = [
  // ——— 2. Lo inocente pasa ———
  { nombre: 'comando inocente', comando: 'git status', esperado: 0 },
  { nombre: 'limpiar node_modules', comando: `${RR} node_modules`, esperado: 0 },
  { nombre: 'limpiar dist', comando: `${RR} apps/web/dist`, esperado: 0 },
  { nombre: 'limpiar dist en PowerShell', comando: `${QUITAR} -Recurse -Force apps\\web\\dist`, esperado: 0 },
  { nombre: 'borrar un temporal del scratchpad', comando: `${RR} "C:/Users/Daniel/AppData/Local/Temp/claude/x/scratchpad/viejo"`, esperado: 0 },
  { nombre: 'git rm -r (recuperable desde git)', comando: 'git rm -r --cached apps/api/dist', esperado: 0 },
  { nombre: 'lectura de la base', comando: 'node scripts/respaldar-base.mjs', esperado: 0 },
  { nombre: 'aplicar migraciones (permitido)', comando: 'npx prisma migrate deploy', esperado: 0 },
  { nombre: 'push normal', comando: 'git push origin main', esperado: 0 },
  { nombre: 'push con lease', comando: 'git push --force-with-lease origin tarea/141', esperado: 0 },
  { nombre: 'push con seguimiento', comando: 'git push -u origin tarea/141', esperado: 0 },
  { nombre: 'borrar rama ya integrada (-d)', comando: 'git branch -d tarea/vieja', esperado: 0 },
  { nombre: 'DELETE con WHERE', comando: `psql -c "${BORRAR} sesion WHERE id = 'x'"`, esperado: 0 },
  // Falsos positivos reales del 2026-09-16.
  { nombre: 'grep que busca TRUNCATE', comando: `grep -n -i "drop\\|delete\\|${TRUNCAR.toLowerCase()}" guardias/x.mjs`, esperado: 0 },
  { nombre: 'grep que busca DELETE FROM', comando: `cd repo && grep -rn "${BORRAR}" apps --include=*.ts | head -20`, esperado: 0 },
  { nombre: 'Select-String que busca DROP TABLE', comando: `Select-String -Path x.sql -Pattern '${SOLTAR}'`, esperado: 0 },
  { nombre: 'git log que busca TRUNCATE', comando: `git log --oneline -S "${TRUNCAR}"`, esperado: 0 },

  // ——— 3. Mensajes de commit ———
  {
    nombre: 'mensaje de commit (heredoc) que menciona el comando',
    comando: `git commit -F - <<'FIN'\nSe corrio ${PELIGROSO} y borro la base\nFIN`,
    esperado: 0,
  },
  {
    nombre: 'commit precedido de cd y git add',
    comando: `cd /repo && git add -A && git commit -q -F - <<'FIN'\nMenciona ${TRUNCAR} y ${PELIGROSO}\nFIN`,
    esperado: 0,
  },
  { nombre: 'commit -m que menciona el comando', comando: `git commit -m "Bloquea ${TRUNCAR} y ${SOLTAR}"`, esperado: 0 },
  {
    nombre: 'here-string de PowerShell con comillas simples',
    comando: `@'\nMenciona ${SOLTAR}\n'@ | git commit -F -`,
    esperado: 0,
  },
  {
    nombre: 'commit seguido de un comando destructivo',
    comando: `git commit -m "algo"; psql -c "${SOLTAR} usuario"`,
    esperado: 2,
  },
  {
    // Hueco de la versión anterior: se borraba el resto de la línea que abre el heredoc.
    nombre: 'destructivo en la MISMA línea que abre el heredoc',
    comando: `git commit -F - <<'FIN' && ${RR} "${REPO}"\nmensaje\nFIN`,
    esperado: 2,
  },
  {
    // Sin comillas, bash expande $(…) dentro del cuerpo: eso se ejecuta.
    nombre: 'heredoc SIN comillas con sustitución de comandos',
    comando: `git commit -F - <<FIN\n$(psql -c "${SOLTAR} usuario")\nFIN`,
    esperado: 2,
  },
  {
    nombre: 'heredoc que SI ejecutaria algo destructivo',
    comando: `bash <<'EOF'\npsql -c "${SOLTAR} usuario"\nEOF`,
    esperado: 2,
  },
  {
    nombre: 'grep con sustitución de comandos no es solo lectura',
    comando: `grep x $(psql -c "${SOLTAR} usuario")`,
    esperado: 2,
  },

  {
    // `\"` no abre comillas en bash: el `;` sí separa y el DROP se ejecuta.
    nombre: 'grep con comilla escapada seguida de un destructivo',
    comando: `grep \\"x ; psql -c ${SOLTAR} usuario`,
    esperado: 2,
  },
  {
    nombre: 'grep con comillas sin cerrar no se da por lectura',
    comando: `grep "x ; psql -c ${SOLTAR} usuario`,
    esperado: 2,
  },

  // ——— 1. Lo destructivo se bloquea ———
  { nombre: 'el comando del incidente', comando: `npm exec -- prisma migrate diff ${PELIGROSO} "$DIRECT_URL"`, esperado: 2 },
  { nombre: 'reseteo de migraciones', comando: `npm exec -- ${RESET}`, esperado: 2 },
  { nombre: 'reseteo con versión fijada', comando: 'npx prisma@6.19.3 migrate ' + 'reset --force', esperado: 2 },
  { nombre: 'db push con versión fijada', comando: 'npx prisma@6.19.3 db ' + 'push', esperado: 2 },
  { nombre: 'migrate resolve', comando: 'npx prisma migrate ' + 'resolve --applied x', esperado: 2 },
  { nombre: 'vaciar una tabla', comando: `psql -c "${TRUNCAR} usuario"`, esperado: 2 },
  { nombre: 'eliminar una tabla', comando: `psql -c "${SOLTAR} usuario"`, esperado: 2 },
  { nombre: 'quitar el trigger de la bitácora', comando: 'psql -c "DROP ' + 'TRIGGER event_log_inmutable ON event_log"', esperado: 2 },
  { nombre: 'DROP OWNED', comando: 'psql -c "DROP ' + 'OWNED BY effort_app"', esperado: 2 },
  { nombre: 'dropdb', comando: 'drop' + 'db effort', esperado: 2 },
  { nombre: 'DELETE sin WHERE', comando: `psql -c "${BORRAR} documento"`, esperado: 2 },
  { nombre: 'DELETE sin WHERE con WHERE en otra sentencia', comando: `psql -c "${BORRAR} documento" -c "SELECT 1 FROM x WHERE id=1"`, esperado: 2 },
  { nombre: 'DELETE con WHERE true', comando: `psql -c "${BORRAR} documento WHERE true"`, esperado: 2 },
  { nombre: 'UPDATE sin WHERE', comando: 'psql -c "UPDATE ' + 'usuario SET activo = false"', esperado: 2 },
  { nombre: 'borrado masivo por Prisma', comando: 'await prisma.usuario.delete' + 'Many()', esperado: 2 },
  { nombre: 'borrado masivo con where vacío', comando: 'await prisma.documento.delete' + 'Many({ where: {} })', esperado: 2 },
  { nombre: 'push forzado', comando: 'git push --' + 'force origin main', esperado: 2 },
  { nombre: 'push forzado con banderas juntas', comando: 'git push -u' + 'f origin main', esperado: 2 },
  { nombre: 'push forzado con +', comando: 'git push origin +' + 'main', esperado: 2 },
  { nombre: 'push forzado con git -C', comando: `git -C "${REPO}" push --` + 'force', esperado: 2 },
  { nombre: 'borrar rama remota', comando: 'git push origin --' + 'delete main', esperado: 2 },
  { nombre: 'borrar rama remota con :', comando: 'git push origin :' + 'main', esperado: 2 },
  { nombre: 'reset --hard con git -C', comando: `git -C "${REPO}" reset --` + 'hard HEAD~1', esperado: 2 },
  { nombre: 'git clean con banderas separadas', comando: 'git clean -x -d -' + 'f', esperado: 2 },
  { nombre: 'descartar stash', comando: 'git stash ' + 'drop', esperado: 2 },
  { nombre: 'borrar rama forzado', comando: 'git branch -' + 'D tarea/141', esperado: 2 },
  { nombre: 'borrar el repositorio entero', comando: `${RR} ${REPO}`, esperado: 2 },
  { nombre: 'rm con banderas separadas', comando: `rm -r -` + `f "${REPO}"`, esperado: 2 },
  { nombre: 'rm --recursive', comando: `rm --recursive "${REPO}"`, esperado: 2 },
  { nombre: 'rm que mezcla dist con otra carpeta', comando: `${RR} apps/web/dist apps/api/src`, esperado: 2 },
  { nombre: 'rm con node_modules en otro tramo', comando: `${RR} apps && ls node_modules`, esperado: 2 },
  { nombre: 'rm que se escapa de node_modules', comando: `${RR} node_modules/../../apps`, esperado: 2 },
  { nombre: 'Remove-Item -Recurse del repositorio', comando: `${QUITAR} -Recurse -Force "${REPO_WIN}"`, esperado: 2 },
  { nombre: 'Remove-Item -r abreviado', comando: `${QUITAR} "${REPO_WIN}" -r`, esperado: 2 },
  { nombre: 'rmdir /s de cmd', comando: `rmd` + `ir /s /q "${REPO_WIN}"`, esperado: 2 },
  { nombre: 'find -exec rm', comando: `find . -name "*.ts" -exec ${RR} {} +`, esperado: 2 },
  { nombre: 'gh repo delete', comando: 'gh repo ' + 'delete IMMR-Hub/effort-control-360 --yes', esperado: 2 },
  { nombre: 'gh repo sync --force', comando: 'gh repo sync --' + 'force', esperado: 2 },
  { nombre: 'gh api DELETE', comando: 'gh api -X ' + 'DELETE repos/IMMR-Hub/effort-control-360', esperado: 2 },
  { nombre: 'supabase db reset', comando: 'supabase db ' + 'reset --linked', esperado: 2 },
  { nombre: 'doctl apps delete', comando: 'doctl apps ' + 'delete abc', esperado: 2 },
  { nombre: 'DELETE a la API de Supabase', comando: 'curl -X ' + 'DELETE "https://x.supabase.co/rest/v1/documento"', esperado: 2 },

  // ——— OneDrive: sin excepción ———
  { nombre: 'OneDrive: curl -X DELETE', comando: `curl -X ` + `DELETE "${GRAPH}"`, esperado: 2 },
  { nombre: 'OneDrive: DELETE entre comillas', comando: `curl -X "` + `DELETE" "${GRAPH}"`, esperado: 2 },
  { nombre: 'OneDrive: fetch con method', comando: `node -e "fetch('${GRAPH}', { method: '` + `DELETE' })"`, esperado: 2 },
  { nombre: 'OneDrive: Invoke-RestMethod -Method Delete', comando: `Invoke-RestMethod -Uri "${GRAPH}" -Method ` + 'Delete', esperado: 2 },
  { nombre: 'OneDrive: permanentDelete (POST)', comando: `curl -X POST "${GRAPH}/permanent` + `Delete"`, esperado: 2 },
  { nombre: 'OneDrive: cmdlet de Microsoft Graph', comando: 'Remove-Mg' + 'DriveItem -DriveId abc -DriveItemId 123', esperado: 2 },

  // ——— Falla cerrado ———
  { nombre: 'entrada ilegible se bloquea', entradaCruda: 'esto no es JSON', esperado: 2 },
  { nombre: 'otra herramienta sin comando pasa', entradaCruda: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' } }), esperado: 0 },
];

let fallidos = 0;
const tamanoRealAntes = existsSync(REGISTRO_REAL) ? readFileSync(REGISTRO_REAL).length : 0;

for (const caso of CASOS) {
  const resultado = spawnSync(process.execPath, [GUARDIA], {
    input: caso.entradaCruda ?? JSON.stringify({ tool_name: 'Bash', tool_input: { command: caso.comando } }),
    encoding: 'utf8',
    env: { ...process.env, GUARDIA_REGISTRO: REGISTRO_DE_PRUEBA },
  });

  const obtenido = resultado.status ?? -1;
  const bien = obtenido === caso.esperado;
  if (!bien) fallidos += 1;

  const etiqueta = caso.esperado === 2 ? 'bloquea' : 'permite';
  console.log(`${bien ? 'OK  ' : 'MAL '} ${etiqueta.padEnd(8)} ${caso.nombre}${bien ? '' : `  (salió ${obtenido})`}`);
}

// Las pruebas no pueden ensuciar el registro de intentos reales.
const tamanoRealDespues = existsSync(REGISTRO_REAL) ? readFileSync(REGISTRO_REAL).length : 0;
if (tamanoRealDespues !== tamanoRealAntes) {
  fallidos += 1;
  console.log('MAL  las pruebas escribieron en el registro real de intentos');
}

console.log(`\n${CASOS.length - fallidos}/${CASOS.length} correctos.`);
process.exit(fallidos === 0 ? 0 : 1);
