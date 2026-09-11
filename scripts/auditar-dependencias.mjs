/**
 * Auditoría de dependencias con excepciones revisadas.
 *
 * `npm audit --audit-level=high` a secas venía fallando desde hacía semanas por
 * vulnerabilidades que NO se pueden arreglar sin romper algo (ver abajo, una
 * por una). Un check que siempre está en rojo no protege: enseña a ignorar el
 * rojo, y el día que aparezca una vulnerabilidad de verdad nadie la va a mirar.
 *
 * Este script falla solo ante algo NUEVO. Cada excepción lleva escrito por qué
 * se acepta y qué la cerraría — si alguna deja de hacer falta, sale de la lista
 * y el check vuelve a cubrirla sola.
 *
 * Revisado el 2026-09-11. Conviene repasarlo cada vez que se toquen las
 * dependencias.
 */

import { execSync } from 'node:child_process';

/**
 * Vulnerabilidades revisadas y aceptadas, por paquete.
 *
 * `motivo` explica por qué no se puede arreglar hoy. `cierra` dice qué haría
 * falta para sacarla de acá — sin eso, una excepción temporal se vuelve
 * permanente sin que nadie lo decida.
 */
const EXCEPCIONES = {
  prisma: {
    motivo:
      'El único arreglo que ofrece npm es bajar a prisma 6.12.0, que choca con ' +
      '@prisma/client 6.19.3; y 6.19.3 ya es la última de la línea 6. La 7 cambió ' +
      'la configuración de conexión de forma incompatible (ver CLAUDE.md). Además ' +
      'prisma es el CLI de migraciones: corre en el despliegue, no al atender una ' +
      'petición.',
    cierra: 'Cuando salga un parche en la línea 6, o cuando se migre a la 7 a propósito.',
  },
  '@prisma/config': { motivo: 'Viene con prisma. Misma situación.', cierra: 'Igual que prisma.' },
  'deepmerge-ts': { motivo: 'Viene con prisma. Misma situación.', cierra: 'Igual que prisma.' },
  exceljs: {
    motivo:
      'El "arreglo" es bajar a exceljs 3.4.0, una major anterior. Se usa para leer ' +
      'las exportaciones de SIGA; cambiar de major ahí es tocar el importador entero ' +
      'por una vulnerabilidad que no aplica (ver uuid).',
    cierra: 'Cuando exceljs 4.x publique una versión con el uuid parcheado.',
  },
  uuid: {
    motivo:
      'Falta un control de límites en uuid v3/v5/v6 cuando se le pasa un buffer ' +
      'propio. exceljs no le pasa buffer: genera identificadores sin ese argumento, ' +
      'así que el camino vulnerable no se ejecuta.',
    cierra: 'Cuando exceljs actualice su uuid.',
  },
  'fast-uri': {
    motivo:
      'Lo usa ajv para resolver los $ref de los esquemas JSON. Los esquemas los ' +
      'escribimos nosotros, no llegan de afuera, así que el parseo de URI nunca ve ' +
      'entrada de un tercero. Se intentó forzar la versión parcheada con overrides ' +
      'anidados y npm no los aplica: hay consumidores que piden ^3 y otros ^4, y el ' +
      'resolvedor prefiere no violar ninguno.',
    cierra: 'Cuando fastify actualice su cadena de ajv.',
  },
  vitest: { motivo: 'Solo desarrollo: el runner de tests no se despliega.', cierra: 'Al subir a vitest 5.' },
  '@vitest/mocker': { motivo: 'Solo desarrollo, viene con vitest.', cierra: 'Al subir a vitest 5.' },
  '@vitest/coverage-v8': { motivo: 'Solo desarrollo, viene con vitest.', cierra: 'Al subir a vitest 5.' },
};

const SEVERIDADES_QUE_IMPORTAN = new Set(['high', 'critical']);

/**
 * `npm audit` sale con código distinto de cero en cuanto encuentra algo, que
 * acá es el caso normal. Lo que interesa es el JSON, no el código de salida,
 * así que se lee igual desde la excepción.
 */
function auditar() {
  try {
    // Comando fijo, sin nada que venga de afuera: no hay argumentos que
    // escapar, y asi funciona igual en Windows que en el contenedor del
    // despliegue sin depender de como se llame el ejecutable de npm.
    return execSync('npm audit --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === 'string' && error.stdout.trim().startsWith('{')) {
      return error.stdout;
    }
    throw error;
  }
}

const reporte = JSON.parse(auditar());
const vulnerabilidades = reporte.vulnerabilities ?? {};

const nuevas = [];
const aceptadas = [];

for (const [nombre, datos] of Object.entries(vulnerabilidades)) {
  const excepcion = EXCEPCIONES[nombre];
  if (excepcion) {
    aceptadas.push({ nombre, severidad: datos.severity, ...excepcion });
    continue;
  }
  if (SEVERIDADES_QUE_IMPORTAN.has(datos.severity)) {
    nuevas.push({ nombre, severidad: datos.severity, rango: datos.range });
  }
}

const sinUsar = Object.keys(EXCEPCIONES).filter((nombre) => !(nombre in vulnerabilidades));

console.log(`Revisadas y aceptadas: ${aceptadas.length}`);
for (const a of aceptadas) {
  console.log(`  ${a.severidad.padEnd(8)} ${a.nombre}`);
}

if (sinUsar.length > 0) {
  console.log('');
  console.log('Excepciones que ya no hacen falta — sacalas de la lista:');
  for (const nombre of sinUsar) console.log(`  ${nombre}`);
}

if (nuevas.length > 0) {
  console.log('');
  console.log('VULNERABILIDADES NUEVAS, sin revisar:');
  for (const n of nuevas) {
    console.log(`  ${n.severidad.padEnd(8)} ${n.nombre}  ${n.rango}`);
  }
  console.log('');
  console.log('Revisá cada una: arreglala, o agregala a EXCEPCIONES con el motivo escrito.');
  process.exit(1);
}

console.log('');
console.log('Sin vulnerabilidades nuevas.');
