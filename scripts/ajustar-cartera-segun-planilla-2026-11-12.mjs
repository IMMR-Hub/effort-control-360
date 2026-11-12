/**
 * Ajusta la cartera de cada colaborador a la columna «CLIENTE DE» de la planilla
 * `CLIENTES - ARIANA CAMPOS DA ROSA.xlsx` (Daniel, 2026-11-12: «a qué usuario le
 * corresponde»), solo para las personas con cuenta en el sistema.
 *
 * Usa `UsuariosPrisma.reemplazarCartera`, el mismo camino que la pantalla de
 * Usuarios: lo que sale de una cartera se CIERRA con fecha (`hasta`), no se borra,
 * y cada cliente que entra o sale deja `cartera.cliente_asignado` /
 * `cartera.cliente_quitado` en la bitácora de ese cliente.
 *
 * PEDRO (`pbarrios@`) entra en lugar de Karina Baez: Daniel, 2026-11-12, «pbarrios
 * entra por kbaez ahora» y, preguntado a quién pasan los clientes de BEA
 * (`kbaez@` en la planilla), «A Pedro Barrios». Lleva los suyos y los de BEA. Si
 * su cuenta todavía no existe, se lo saltea y se puede volver a correr después
 * de `crear-equipo.mjs`: repetirlo no cambia lo que ya está bien.
 *
 * Simula por defecto; `--aplicar` exige respaldo de hoy. Solo toca a las personas
 * de `PERSONAS`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const APLICAR = process.argv.includes('--aplicar');
const PERSONAS = ['aalvarenga@effort.com.py', 'asanguina@effort.com.py', 'acampos@effort.com.py', 'sferreira@effort.com.py', 'pbarrios@effort.com.py'];
/** Responsable de la planilla → quién lo lleva hoy. */
const REEMPLAZOS = { 'kbaez@effort.com.py': 'pbarrios@effort.com.py' };
const responsableDe = (codigo) => {
  const email = planilla[codigo]?.email_responsable ?? null;
  return REEMPLAZOS[email] ?? email;
};
const planilla = JSON.parse(readFileSync(join(RAIZ, 'docs/clientes/obligaciones-segun-planilla-ariana-2026-11-12.json'), 'utf8'));

const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(() => import('@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const { UsuariosPrisma } = await import('@effort/api/dist/repositorios/usuarios.js');
const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
const { registrarEvento, ACCIONES } = await import('@effort/api/dist/bitacora.js');
const usuarios = new UsuariosPrisma(prisma);
const bitacora = new BitacoraPrisma(prisma);
const log = { error: (x, m) => console.error(m, x) };

try {
  if (APLICAR) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!readdirSync(join(RAIZ, 'respaldos')).some((f) => f.includes(hoy))) throw new Error('No hay respaldo de hoy: node scripts/respaldar-base.mjs');
  }
  const operador = await prisma.usuario.findFirst({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });
  const clientes = await prisma.cliente.findMany({ where: { activo: true }, select: { id: true, codigo: true, nombre: true } });
  const porId = new Map(clientes.map((c) => [c.id, c]));
  for (const email of PERSONAS) {
    const u = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nombre: true, apellido: true } });
    if (!u) {
      const pendientes = clientes.filter((c) => responsableDe(c.codigo) === email).map((c) => c.codigo);
      console.log(`${email}: todavía no tiene cuenta (le corresponden ${pendientes.length}: ${pendientes.join(', ')})`);
      continue;
    }
    const deseados = clientes.filter((c) => responsableDe(c.codigo) === email).map((c) => c.id);
    const antes = await usuarios.clientesAsignados(u.id);
    const entran = deseados.filter((id) => !antes.includes(id));
    const salen = antes.filter((id) => !deseados.includes(id));
    console.log(`${u.nombre} ${u.apellido}: ${antes.length} → ${deseados.length}` +
      (entran.length ? ` · entran ${entran.map((id) => porId.get(id)?.codigo ?? id).join(', ')}` : '') +
      (salen.length ? ` · salen ${salen.map((id) => porId.get(id)?.codigo ?? id).join(', ')}` : ''));
    if (!APLICAR || (entran.length === 0 && salen.length === 0)) continue;
    await usuarios.reemplazarCartera(u.id, deseados, 'responsable', new Date());
    const persona = `${u.nombre} ${u.apellido}`;
    for (const clienteId of entran) {
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CARTERA_CLIENTE_ASIGNADO, entidad: 'asignacion_cliente', entidadId: u.id, clienteId,
        datosAntes: null, datosDespues: { responsable: persona, origen: 'planilla de clientes de EFFORT, columna CLIENTE DE (2026-11-12)' } });
    }
    for (const clienteId of salen) {
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CARTERA_CLIENTE_QUITADO, entidad: 'asignacion_cliente', entidadId: u.id, clienteId,
        datosAntes: { responsable: persona }, datosDespues: { origen: 'planilla de clientes de EFFORT, columna CLIENTE DE (2026-11-12)' } });
    }
  }
  if (!APLICAR) console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar.');
} finally {
  await prisma.$disconnect();
}
