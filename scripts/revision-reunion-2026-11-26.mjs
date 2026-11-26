/**
 * Revisión para la reunión del 2026-11-26. SOLO LECTURA en OneDrive (GET) y en la base (SELECT).
 *
 * 1. Baja la planilla `CLIENTES EFFORT E.A.S/CLIENTES EFFORT - ARIANA ACTUAL.xlsx` a la carpeta que se le pase
 *    (`--salida <carpeta>`), para leerla aparte.
 * 2. Lista TODOS los archivos de más de 25 MB de las carpetas de los clientes activos (los que la sincronización no
 *    copia), recorriendo cada carpeta con el mismo `DriveGraph.listarRecursivoPorId` que usa la sincronización.
 *    Escribe `archivos-grandes.json` en la carpeta de salida.
 *
 * El drive de origen se abre con el adaptador de solo lectura: no hay forma de escribir. Se anota en
 * docs/BITACORA-ONEDRIVE.md. Uso: node scripts/revision-reunion-2026-11-26.mjs --salida <carpeta>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const i = process.argv.indexOf('--salida');
if (i < 0) throw new Error('Falta --salida <carpeta>');
const SALIDA = process.argv[i + 1];
mkdirSync(SALIDA, { recursive: true });

const { crearLectorDeGraph } = await import(pathToFileURL(join(RAIZ, 'scripts/alta-masiva-clientes.mjs')).href);
const { DriveGraph } = await import(pathToFileURL(join(RAIZ, 'packages/drive/dist/index.js')).href);
const require = createRequire(join(RAIZ, 'apps/api/package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });

const LIMITE = 25 * 1024 * 1024;
const usuario = process.env.ONEDRIVE_USUARIO_ORIGEN ?? 'lsosa@effort.com.py';

try {
  // 1. Planilla nueva
  const leer = crearLectorDeGraph({});
  const driveId = process.env.AZURE_DRIVE_ID_ORIGEN ?? (await leer(`/users/${encodeURIComponent(usuario)}/drive?$select=id`)).id;
  const ruta = ['CLIENTES EFFORT E.A.S', 'CLIENTES EFFORT - ARIANA ACTUAL.xlsx'].map(encodeURIComponent).join('/');
  const item = await leer(`/drives/${driveId}/root:/${ruta}`);
  const url = item['@microsoft.graph.downloadUrl'];
  if (!url) throw new Error('Graph no devolvió el enlace de descarga de la planilla.');
  const r = await fetch(url); // enlace firmado por Microsoft, de un solo uso; GET
  if (!r.ok) throw new Error(`descarga de la planilla: HTTP ${r.status}`);
  writeFileSync(join(SALIDA, 'planilla-ariana-actual.xlsx'), Buffer.from(await r.arrayBuffer()));
  console.log(`planilla: ${item.name} · ${(item.size / 1024).toFixed(0)} KB · modificada ${item.lastModifiedDateTime} por ${item.lastModifiedBy?.user?.displayName ?? '?'}`);

  // 2. Archivos de más de 25 MB en las carpetas de los clientes activos
  const drive = new DriveGraph({
    tenantId: process.env.AZURE_TENANT_ID, clientId: process.env.AZURE_CLIENT_ID, clientSecret: process.env.AZURE_CLIENT_SECRET,
    usuarioPrincipal: usuario, driveId: process.env.AZURE_DRIVE_ID_ORIGEN,
  });
  const clientes = await prisma.cliente.findMany({
    where: { activo: true, carpetaOneDriveId: { not: null } }, select: { codigo: true, nombre: true, carpetaOneDriveId: true }, orderBy: { codigo: 'asc' },
  });
  const grandes = [];
  const errores = [];
  for (const c of clientes) {
    try {
      const archivos = await drive.listarRecursivoPorId(c.carpetaOneDriveId);
      for (const a of archivos) {
        if (a.tamanoBytes > LIMITE) {
          grandes.push({ codigo: c.codigo, cliente: c.nombre, carpeta: a.rutaCarpeta, archivo: a.nombre,
            mb: Math.round((a.tamanoBytes / 1048576) * 10) / 10, modificado: a.modificadoEn?.toISOString?.().slice(0, 10) ?? null });
        }
      }
      process.stdout.write('.');
    } catch (e) {
      errores.push(`${c.codigo} ${c.nombre}: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`);
    }
  }
  writeFileSync(join(SALIDA, 'archivos-grandes.json'), JSON.stringify({ leidoEn: new Date().toISOString(), clientes: clientes.length, grandes, errores }, null, 1));
  console.log(`\ncarpetas recorridas: ${clientes.length} · archivos de más de 25 MB: ${grandes.length} · carpetas con error: ${errores.length}`);
  for (const e of errores) console.log('  ERROR', e);
} finally {
  await prisma.$disconnect();
}
