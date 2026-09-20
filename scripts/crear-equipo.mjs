/**
 * Crea las cuentas del equipo de EFFORT, en un solo paso.
 *
 * **Lo corre Daniel, no Claude**, por la misma razón que el script de arranque:
 * pide una contraseña. Claude no maneja contraseñas — ni de personas ni de
 * servicios.
 *
 * Existe para ahorrar diez formularios. Hace exactamente lo mismo que la
 * pantalla de Usuarios: crea la cuenta con su rol y una contraseña inicial que
 * la persona está obligada a cambiar en su primer acceso. No inventa un camino
 * nuevo ni se saltea nada del flujo normal.
 *
 * ---
 *
 * **La contraseña inicial es la misma para los diez, y conviene entender por
 * qué no es un problema:** las tres cosas que la hacen inofensiva son que cada
 * persona está obligada a cambiarla antes de poder usar el sistema
 * (`debe_cambiar_contrasena`), que además tiene que configurar la verificación
 * en dos pasos, y que quien la reparte es la misma persona que la eligió. Es el
 * mismo esquema que usa la pantalla cuando dirección da de alta a alguien.
 *
 * Lo que sí importa: **decírsela a cada uno por un canal distinto del correo**,
 * y que la cambien el mismo día.
 *
 * ---
 *
 * La lista de abajo se recuperó del historial de conversaciones después del
 * borrado del 2026-09-13. Los nombres, correos y roles son los que EFFORT tenía
 * cargados; `ana@effort.com.py` aparecía con un rol "superadmin" que no existe
 * en el sistema y Daniel confirmó que no correspondía, así que quedó afuera.
 *
 * Uso:
 *   cd effort-control-360
 *   node scripts/crear-equipo.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { leerContrasena } from './leer-contrasena.mjs';

/**
 * El equipo de EFFORT.
 *
 * Dirección son Laura y Lili. El resto trabaja sobre la cartera.
 */
const EQUIPO = [
  { nombre: 'Laura', apellido: 'Sosa', email: 'lsosa@effort.com.py', rol: 'direccion' },
  { nombre: 'Lilian', apellido: 'Laconich', email: 'llaconich@effort.com.py', rol: 'direccion' },
  { nombre: 'Analia', apellido: 'Sanguina', email: 'asanguina@effort.com.py', rol: 'responsable' },
  { nombre: 'Aracely', apellido: 'Alvarenga', email: 'aalvarenga@effort.com.py', rol: 'responsable' },
  { nombre: 'Ariana', apellido: 'Campos', email: 'acampos@effort.com.py', rol: 'responsable' },
  { nombre: 'Jorge', apellido: 'Barrios', email: 'jbarrios@effort.com.py', rol: 'responsable' },
  { nombre: 'Karina', apellido: 'Baez', email: 'kbaez@effort.com.py', rol: 'responsable' },
  { nombre: 'Karina', apellido: 'Medina', email: 'kmedina@effort.com.py', rol: 'responsable' },
  { nombre: 'Melany', apellido: 'González', email: 'mgonzalez@effort.com.py', rol: 'responsable' },
  { nombre: 'Sandra', apellido: 'Ferreira', email: 'sferreira@effort.com.py', rol: 'responsable' },
];

/**
 * Todos ven los cinco clientes del piloto.
 *
 * El sistema tiene un modelo de cartera (`asignacion_cliente`) que limita qué
 * clientes ve cada persona, y con los 144 clientes reales de EFFORT es el que
 * hay que usar. Para un piloto de cinco clientes donde todos trabajan sobre
 * todos, limitar la vista solo agregaría un paso de configuración sin proteger
 * nada.
 *
 * **Cuando el piloto crezca, esto se cambia a `false` y se cargan las carteras.**
 */
const VE_TODOS_LOS_CLIENTES = true;

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

// La lectura de la contraseña vive aparte (`leer-contrasena.mjs`) porque la
// comparte con el script de arranque y porque tiene su propia historia: la
// versión anterior no funcionaba en PowerShell.

// Igual que el script de arranque: los paquetes se resuelven desde `apps/api`,
// porque Node los busca a partir de la ubicación del archivo y no del
// directorio desde el que se lo invoca.
const { createRequire } = await import('node:module');
const requerirDesdeLaApi = createRequire(new URL('../apps/api/package.json', import.meta.url));

const { PrismaClient } = requerirDesdeLaApi('@prisma/client');
const { hash: argonHash } = requerirDesdeLaApi('@node-rs/argon2');

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

const existentes = new Set(
  (await prisma.usuario.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()),
);

const aCrear = EQUIPO.filter((p) => !existentes.has(p.email.toLowerCase()));

if (aCrear.length === 0) {
  console.log('Las diez cuentas del equipo ya existen. No hay nada que hacer.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`Se van a crear ${aCrear.length} cuenta(s):\n`);
for (const p of aCrear) console.log(`  ${p.nombre} ${p.apellido} — ${p.email} (${p.rol})`);
if (aCrear.length < EQUIPO.length) {
  console.log(`\n(${EQUIPO.length - aCrear.length} ya existían y no se tocan.)`);
}

console.log('\nCada persona va a tener que cambiar esta contraseña y configurar');
console.log('la verificación en dos pasos en su primer acceso.\n');

/**
 * Mínimo de caracteres. El mismo que exige la pantalla de Usuarios: este
 * script no puede ser una puerta de atrás con reglas más flojas.
 */
const LARGO_MINIMO = 12;

/**
 * Pide la contraseña hasta que sirva, en vez de abortar al primer tropiezo.
 *
 * La versión anterior cancelaba todo y había que volver a correr el script
 * desde cero. Daniel se comió eso tres veces seguidas el 2026-09-20 —dos por
 * un bug de lectura ya corregido y una por escribir once caracteres— y no hay
 * ninguna razón para castigar un error de tipeo con volver a empezar.
 */
async function pedirContrasena() {
  for (;;) {
    console.log(`Mínimo ${LARGO_MINIMO} caracteres. Ctrl+C para salir.`);
    const primera = await leerContrasena('Contraseña inicial (se muestra un * por letra): ');

    if (primera.length < LARGO_MINIMO) {
      console.error(
        `  Tiene ${primera.length} caracteres y hacen falta ${LARGO_MINIMO}. Probá de nuevo.\n`,
      );
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

const contrasena = await pedirContrasena();

// Se cifra UNA vez: Argon2id es deliberadamente lento, y hacerlo diez veces
// para el mismo texto sería esperar diez veces al pedo.
const hashContrasena = await argonHash(contrasena);

let creadas = 0;
for (const persona of aCrear) {
  try {
    await prisma.usuario.create({
      data: {
        nombre: persona.nombre,
        apellido: persona.apellido,
        email: persona.email,
        rol: persona.rol,
        activo: true,
        veTodosLosClientes: VE_TODOS_LOS_CLIENTES,
        hashContrasena,
        // Lo que hace que la contraseña compartida sea inofensiva.
        debeCambiarContrasena: true,
        segundoFactorActivo: false,
      },
    });
    creadas += 1;
    console.log(`  creada: ${persona.email}`);
  } catch (error) {
    // Una cuenta que falla no puede impedir las demás: es peor quedarse a
    // mitad sin saber cuáles entraron.
    console.error(
      `  FALLÓ ${persona.email}: ${error instanceof Error ? error.message.slice(0, 120) : 'error desconocido'}`,
    );
  }
}

await prisma.$disconnect();

console.log(`\n${creadas} cuenta(s) creada(s).`);
console.log('Pasales la contraseña por un canal que NO sea el correo, y pediles');
console.log('que entren hoy mismo a cambiarla.');
