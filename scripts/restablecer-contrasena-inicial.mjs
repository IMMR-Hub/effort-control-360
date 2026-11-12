/**
 * Pone una contraseña inicial nueva a las cuentas del equipo que TODAVÍA NO
 * ENTRARON NUNCA, para repartirla el día que empiezan a usar el sistema.
 *
 * **Lo corre Daniel, no Claude**: pide una contraseña, y Claude no maneja
 * contraseñas (mismo criterio que `crear-equipo.mjs`).
 *
 * Por qué existe: las cuentas se crearon el 2026-09-20 con una contraseña
 * inicial que eligió Daniel. Si no se recuerda, no hay pantalla para
 * restablecerla, y este script hace lo mismo que la creación original:
 *
 * - la persona queda OBLIGADA a cambiarla en su primer acceso
 *   (`debe_cambiar_contrasena = true`);
 * - y a configurar el Authenticator (se limpia cualquier segundo factor a medio
 *   configurar).
 *
 * Qué NO toca:
 * - una cuenta que ya entró alguna vez (`ultimo_acceso_en` con fecha): esa
 *   persona ya eligió su contraseña y su Authenticator, y pisarlos la dejaría
 *   afuera;
 * - `jbarrios` y `kmedina`: ya no trabajan en EFFORT (sus liquidaciones están en
 *   RRHH). Darles una contraseña conocida sería abrirles la puerta. Quedan
 *   pendientes de desactivar.
 *
 * Mínimo 12 caracteres, igual que la pantalla de Usuarios: el sistema está en
 * internet y QUIEN ENTRA PRIMERO con la contraseña inicial configura su propio
 * Authenticator y se queda con la cuenta. Una contraseña tipo `12345678` es la
 * primera que prueba cualquiera.
 *
 * Deja un evento `usuario.contrasena_restablecida` por cuenta en la bitácora
 * (sin la contraseña, obviamente).
 *
 * Uso (PowerShell):
 *   cd "C:\Users\Daniel\NexusFlow AI\effort-control-360"
 *   node scripts/restablecer-contrasena-inicial.mjs
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { leerContrasena } from './leer-contrasena.mjs';

const CUENTAS = [
  'lsosa@effort.com.py',
  'llaconich@effort.com.py',
  'asanguina@effort.com.py',
  'aalvarenga@effort.com.py',
  'acampos@effort.com.py',
  'kbaez@effort.com.py',
  'mgonzalez@effort.com.py',
  'sferreira@effort.com.py',
];

const LARGO_MINIMO = 12;

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

cargarEntorno(fileURLToPath(new URL('../.env', import.meta.url)));

const requerirDesdeLaApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = requerirDesdeLaApi('@prisma/client');
const { hash: argonHash } = requerirDesdeLaApi('@node-rs/argon2');

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
  process.exit(1);
}
const prisma = new PrismaClient({ datasourceUrl: url });

const usuarios = await prisma.usuario.findMany({
  where: { email: { in: CUENTAS } },
  select: { id: true, email: true, nombre: true, apellido: true, ultimoAccesoEn: true, activo: true },
});

const aTocar = usuarios.filter((u) => u.activo && !u.ultimoAccesoEn);
const yaEntraron = usuarios.filter((u) => u.ultimoAccesoEn);

if (yaEntraron.length > 0) {
  console.log('No se tocan porque ya entraron alguna vez:');
  for (const u of yaEntraron) console.log(`  ${u.nombre} ${u.apellido} — ${u.email}`);
  console.log('');
}
if (aTocar.length === 0) {
  console.log('No hay cuentas para restablecer.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`Se va a poner la contraseña inicial a ${aTocar.length} cuenta(s):\n`);
for (const u of aTocar) console.log(`  ${u.nombre} ${u.apellido} — ${u.email}`);
console.log('\nCada persona la cambia y configura el Authenticator en su primer acceso.\n');

async function pedirContrasena() {
  for (;;) {
    console.log(`Mínimo ${LARGO_MINIMO} caracteres. Ctrl+C para salir.`);
    const primera = await leerContrasena('Contraseña inicial (se muestra un * por letra): ');
    if (primera.length < LARGO_MINIMO) {
      console.error(`  Tiene ${primera.length} caracteres y hacen falta ${LARGO_MINIMO}. Probá de nuevo.\n`);
      continue;
    }
    const segunda = await leerContrasena('Repetir contraseña: ');
    if (primera !== segunda) {
      console.error('  Las dos no coinciden. Probá de nuevo.\n');
      continue;
    }
    return primera;
  }
}

const hashContrasena = await argonHash(await pedirContrasena());
const ahora = new Date();

let hechas = 0;
for (const u of aTocar) {
  try {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: u.id },
        data: {
          hashContrasena,
          contrasenaActualizadaEn: ahora,
          debeCambiarContrasena: true,
          segundoFactorActivo: false,
          secretoTotp: null,
        },
      }),
      prisma.eventLog.create({
        data: {
          accion: 'usuario.contrasena_restablecida',
          entidad: 'usuario',
          entidadId: u.id,
          datosDespues: {
            motivo: 'Contraseña inicial para el primer acceso (script restablecer-contrasena-inicial, lo corrió Daniel)',
            debeCambiarContrasena: true,
          },
        },
      }),
    ]);
    hechas += 1;
    console.log(`  lista: ${u.email}`);
  } catch (error) {
    console.error(`  FALLÓ ${u.email}: ${error instanceof Error ? error.message.slice(0, 120) : 'error desconocido'}`);
  }
}

await prisma.$disconnect();
console.log(`\n${hechas} cuenta(s) listas para el primer acceso en https://effort360.disaak.com`);
