/**
 * Pone una contraseña provisoria a UNA cuenta que ya entró alguna vez y se
 * olvidó su contraseña. `restablecer-contrasena-inicial.mjs` no sirve para
 * eso: a propósito no toca cuentas que ya entraron.
 *
 * **Lo corre Daniel, no Claude**: pide la contraseña por teclado y Claude no
 * maneja contraseñas.
 *
 * Qué hace:
 * - pone la contraseña provisoria y obliga a cambiarla en el próximo acceso
 *   (`debe_cambiar_contrasena = true`);
 * - NO toca el segundo factor: la persona sigue entrando con el mismo
 *   Google Authenticator que ya configuró (si también lo perdió, eso es otro
 *   paso aparte);
 * - deja un evento `usuario.contrasena_restablecida` en la bitácora, sin la
 *   contraseña.
 *
 * Por qué existe: 2026-11-27, Laura (lsosa@) cambió su contraseña el 26/11 en
 * su primer ingreso y al día siguiente fallaba al entrar con «correo o
 * contraseña incorrectos».
 *
 * Uso (PowerShell):
 *   cd "C:\Users\Daniel\NexusFlow AI\effort-control-360"
 *   node scripts/restablecer-contrasena-de-una-cuenta.mjs lsosa@effort.com.py
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { leerContrasena } from './leer-contrasena.mjs';

const LARGO_MINIMO = 12;

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!/^[^@\s]+@effort\.com\.py$/.test(email)) {
  console.error('Uso: node scripts/restablecer-contrasena-de-una-cuenta.mjs <correo>@effort.com.py');
  process.exit(1);
}

try {
  for (const linea of readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8').split('\n')) {
    const m = linea.match(/^(DIRECT_URL|DATABASE_URL)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  /* Sin .env se usa lo que ya esté en el entorno. */
}

const requerirDesdeLaApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = requerirDesdeLaApi('@prisma/client');
const { hash: argonHash } = requerirDesdeLaApi('@node-rs/argon2');

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
  process.exit(1);
}
const prisma = new PrismaClient({ datasourceUrl: url });

try {
  const u = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nombre: true, apellido: true, activo: true, segundoFactorActivo: true },
  });
  if (!u) throw new Error(`No existe la cuenta ${email}.`);
  if (!u.activo) throw new Error(`La cuenta ${email} está desactivada: no se le pone contraseña.`);

  console.log(`Cuenta: ${u.nombre} ${u.apellido} — ${email}`);
  console.log(`Authenticator: ${u.segundoFactorActivo ? 'configurado (se mantiene)' : 'sin configurar (lo configura al entrar)'}\n`);

  let contrasena;
  for (;;) {
    console.log(`Mínimo ${LARGO_MINIMO} caracteres. Ctrl+C para salir.`);
    const primera = await leerContrasena('Contraseña provisoria (se muestra un * por letra): ');
    if (primera.length < LARGO_MINIMO) {
      console.error(`  Tiene ${primera.length} caracteres y hacen falta ${LARGO_MINIMO}. Probá de nuevo.\n`);
      continue;
    }
    const segunda = await leerContrasena('Repetir contraseña: ');
    if (primera !== segunda) {
      console.error('  Las dos no coinciden. Probá de nuevo.\n');
      continue;
    }
    contrasena = primera;
    break;
  }

  const hashContrasena = await argonHash(contrasena);
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: u.id },
      data: { hashContrasena, contrasenaActualizadaEn: new Date(), debeCambiarContrasena: true },
    }),
    prisma.eventLog.create({
      data: {
        accion: 'usuario.contrasena_restablecida',
        entidad: 'usuario',
        entidadId: u.id,
        datosDespues: {
          motivo: 'Olvidó su contraseña (script restablecer-contrasena-de-una-cuenta, lo corrió Daniel)',
          debeCambiarContrasena: true,
          segundoFactorSeMantiene: u.segundoFactorActivo,
        },
      },
    }),
  ]);
  console.log(`\nLista. ${u.nombre} entra en https://effort360.disaak.com con la provisoria, la cambia, y sigue usando su Authenticator.`);
} catch (error) {
  console.error(error instanceof Error ? error.message.split('\n').slice(-3).join(' ') : 'error desconocido');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
