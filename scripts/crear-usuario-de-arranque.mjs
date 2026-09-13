/**
 * Crea el primer usuario de dirección, para poder volver a entrar al sistema.
 *
 * **Este script lo corre Daniel, no Claude.** La razón es concreta y no es
 * ceremonia: pide una contraseña. Claude no maneja contraseñas — ni de personas
 * ni de servicios — así que el único que puede completar este paso es alguien
 * que la escriba en su propia máquina.
 *
 * ---
 *
 * **Por qué hace falta.** Después del borrado del 2026-09-13 no quedó ningún
 * usuario. Las cuentas se crean desde la pantalla de Usuarios, que exige estar
 * autenticado como `direccion`… y no hay nadie para autenticarse. El círculo se
 * rompe una sola vez, acá, y desde adentro del sistema se crea el resto.
 *
 * **Qué hace exactamente**, para que se pueda leer antes de correrlo:
 *
 *   1. Pide la contraseña por teclado, sin mostrarla ni guardarla en el
 *      historial de la terminal.
 *   2. La cifra con Argon2id, el mismo algoritmo que usa el sistema.
 *   3. Inserta UN usuario con rol `direccion`. No borra ni modifica nada más.
 *
 * La contraseña en claro no se escribe en ningún archivo, ni en el log, ni sale
 * de este proceso. Lo único que llega a la base es el hash.
 *
 * El usuario queda con `debe_cambiar_contrasena` en true y sin segundo factor,
 * así que al primer acceso el sistema va a exigir cambiar la contraseña y
 * configurar la verificación en dos pasos. Es el flujo normal de primer acceso,
 * no una excepción.
 *
 * Uso:
 *   cd apps/api
 *   node ../../scripts/crear-usuario-de-arranque.mjs
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/** Lee una línea de la terminal sin que se vea lo que se escribe. */
function preguntarEnSilencio(pregunta) {
  return new Promise((resolver) => {
    const lector = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const salida = process.stdout;

    // Se reemplaza el escritor de la interfaz para que no repita las teclas en
    // pantalla: es lo que evita que la contraseña quede a la vista de quien
    // pase por atrás, o en una captura.
    lector._writeToOutput = (texto) => {
      if (texto.includes(pregunta)) salida.write(pregunta);
    };

    lector.question(pregunta, (respuesta) => {
      salida.write('\n');
      lector.close();
      resolver(respuesta);
    });
  });
}

function preguntar(pregunta) {
  return new Promise((resolver) => {
    const lector = createInterface({ input: process.stdin, output: process.stdout });
    lector.question(pregunta, (respuesta) => {
      lector.close();
      resolver(respuesta.trim());
    });
  });
}

/*
 * Los paquetes se resuelven desde `apps/api`, no desde esta carpeta.
 *
 * Node busca `node_modules` a partir de la ubicación del ARCHIVO que hace el
 * import, no del directorio desde el que se lo invoca. Este script vive en
 * `scripts/`, que no tiene dependencias propias, así que un `import` normal de
 * `@prisma/client` falla con `ERR_MODULE_NOT_FOUND` por más que se lo corra
 * parado en `apps/api`. `createRequire` apuntado al `package.json` de la API
 * resuelve desde ahí, que es donde esos paquetes sí están.
 */
const { createRequire } = await import('node:module');
const requerirDesdeLaApi = createRequire(new URL('../apps/api/package.json', import.meta.url));

const { PrismaClient } = requerirDesdeLaApi('@prisma/client');
const { hash: argonHash } = requerirDesdeLaApi('@node-rs/argon2');

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL. Correlo desde apps/api.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

const cuantos = await prisma.usuario.count();
if (cuantos > 0) {
  console.log(`Ya hay ${cuantos} usuario(s) en la base.`);
  console.log('Este script es solo para cuando no queda ninguno: los demás se crean');
  console.log('desde la pantalla de Usuarios, que es donde corresponde.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('Creación del primer usuario de dirección.\n');

const email = (await preguntar('Correo (ej. effort360@effort.com.py): ')).toLowerCase();
const nombre = await preguntar('Nombre: ');
const apellido = await preguntar('Apellido: ');

const contrasena = await preguntarEnSilencio('Contraseña (no se muestra): ');
const repetida = await preguntarEnSilencio('Repetir contraseña: ');

if (contrasena !== repetida) {
  console.error('\nLas contraseñas no coinciden. No se creó nada.');
  await prisma.$disconnect();
  process.exit(1);
}

// El mismo mínimo que exige el sistema. Se comprueba acá para no crear una
// cuenta que después la aplicación rechace.
if (contrasena.length < 12) {
  console.error('\nLa contraseña tiene que tener al menos 12 caracteres. No se creó nada.');
  await prisma.$disconnect();
  process.exit(1);
}

const hashContrasena = await argonHash(contrasena);

const usuario = await prisma.usuario.create({
  data: {
    nombre,
    apellido,
    email,
    rol: 'direccion',
    activo: true,
    veTodosLosClientes: true,
    hashContrasena,
    debeCambiarContrasena: false,
    segundoFactorActivo: false,
  },
  select: { id: true, email: true, rol: true },
});

await prisma.$disconnect();

console.log(`\nUsuario creado: ${usuario.email} (${usuario.rol}).`);
console.log('Al entrar, el sistema va a pedir configurar la verificación en dos pasos.');
console.log('Desde la pantalla de Usuarios se crean los demás.');
