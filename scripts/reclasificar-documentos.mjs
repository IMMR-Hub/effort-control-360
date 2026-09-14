/**
 * Reclasifica los documentos que figuran como "Otro", usando nombre y carpeta.
 *
 * **Por defecto NO escribe nada**: muestra qué cambiaría. Para aplicar hay que
 * pasar `--aplicar`, y eso lo decide Daniel.
 *
 * Qué toca y qué no — dicho explícitamente porque importa:
 *
 *  - Cambia UNA columna, `documento.tipo`, y solo en filas que hoy dicen `OTRO`.
 *    Nunca pisa un tipo ya asignado, ni por el sistema ni por una persona.
 *  - NO toca OneDrive. No renombra, mueve ni borra ningún archivo de EFFORT.
 *    El archivo queda igual; lo que cambia es la etiqueta en la base del sistema.
 *  - Cada cambio queda en la bitácora con el tipo anterior, así que se puede
 *    deshacer fila por fila si alguno resultara mal clasificado.
 *
 * Uso:
 *   node scripts/reclasificar-documentos.mjs             → simula
 *   node scripts/reclasificar-documentos.mjs --aplicar   → escribe
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

for (const linea of readFileSync(`${raiz}.env`, 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = createRequire(`${raiz}apps/api/package.json`)('@prisma/client');
const { clasificarDocumento } = await import(pathToFileURL(`${raiz}packages/core/dist/index.js`).href);

const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });

const sistema = await prisma.usuario.findUnique({ where: { email: 'effort360@effort.com.py' } });
if (aplicar && !sistema) {
  console.error('No existe el usuario del sistema: no se puede atribuir el cambio a nadie.');
  process.exit(1);
}

const documentos = await prisma.documento.findMany({
  where: { tipo: 'OTRO', evidenciaId: { not: null } },
  select: { id: true, clienteId: true, evidencia: { select: { nombreArchivo: true, rutaOneDrive: true } } },
});

const cambios = [];
for (const d of documentos) {
  if (!d.evidencia) continue;
  const carpeta = (d.evidencia.rutaOneDrive ?? '').split('/').slice(0, -1).join('/');
  const nuevo = clasificarDocumento(d.evidencia.nombreArchivo, carpeta);
  if (nuevo !== 'OTRO') cambios.push({ ...d, nuevo });
}

const porTipo = {};
for (const c of cambios) porTipo[c.nuevo] = (porTipo[c.nuevo] ?? 0) + 1;

console.log(`Documentos en "Otro": ${documentos.length}`);
console.log(`Se reclasificarían:   ${cambios.length}`);
console.table(porTipo);

if (!aplicar) {
  console.log('\nSimulación: no se escribió nada. Para aplicar: --aplicar');
  await prisma.$disconnect();
  process.exit(0);
}

let aplicados = 0;
for (const c of cambios) {
  // `tipo: 'OTRO'` en el where otra vez: si alguien lo clasificó a mano entre
  // la lectura y ahora, no se pisa.
  const { count } = await prisma.documento.updateMany({
    where: { id: c.id, tipo: 'OTRO' },
    data: { tipo: c.nuevo, actualizadoPorUsuarioId: sistema.id },
  });
  if (count === 0) continue;

  await prisma.eventLog.create({
    data: {
      usuarioId: sistema.id,
      accion: 'documento.reclasificado',
      entidad: 'documento',
      entidadId: c.id,
      clienteId: c.clienteId,
      datosAntes: { tipo: 'OTRO' },
      datosDespues: { tipo: c.nuevo, criterio: 'nombre y carpeta (scripts/reclasificar-documentos.mjs)' },
    },
  });
  aplicados += 1;
}

console.log(`\nReclasificados: ${aplicados}`);
await prisma.$disconnect();
