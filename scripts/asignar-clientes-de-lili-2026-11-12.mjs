/**
 * SIPAR, NEO y SOMOS PIRI son clientes de Lili (Daniel, 2026-11-12: «Sipar, Neo y
 * Somos Piri EAS son clientes de Lili»).
 *
 * - **043 SIPAR** se había dado de baja el 2026-11-10 por no figurar en la planilla
 *   de clientes de EFFORT. Daniel confirmó que fue un olvido de la planilla: vuelve
 *   a estar activo, con las obligaciones que ya tenía cargadas desde el piloto. No
 *   se le agrega ni se le quita ninguna.
 * - **014 NEO HOLDING GROUP** y **015 SOMOS PIRI EAS** ya estaban activos (figuran
 *   en la lista «IPS REI / REOP» de la planilla), sin responsable.
 * - Los tres pasan a la cartera de Lilian Laconich. Se suman a lo que ya tenga:
 *   este script nunca saca un cliente de su cartera.
 *
 * Mismo camino que las pantallas (`ClientesPrisma.actualizar`,
 * `UsuariosPrisma.reemplazarCartera`): nada se borra y cada cambio queda en la
 * bitácora del cliente. Simula por defecto; `--aplicar` exige respaldo de hoy.
 * Repetirlo no cambia lo que ya está bien.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const APLICAR = process.argv.includes('--aplicar');
const LILI = 'llaconich@effort.com.py';
const CODIGOS = ['014', '015', '043'];
const A_REACTIVAR = ['043'];
const ORIGEN = 'Daniel, 2026-11-12: «Sipar, Neo y Somos Piri EAS son clientes de Lili»';

const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(() => import('@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const { ClientesPrisma } = await import('@effort/api/dist/repositorios/clientes.js');
const { UsuariosPrisma } = await import('@effort/api/dist/repositorios/usuarios.js');
const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
const { registrarEvento, ACCIONES } = await import('@effort/api/dist/bitacora.js');
const clientes = new ClientesPrisma(prisma);
const usuarios = new UsuariosPrisma(prisma);
const bitacora = new BitacoraPrisma(prisma);
const log = { error: (x, m) => console.error(m, x) };

try {
  if (APLICAR) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!readdirSync(join(RAIZ, 'respaldos')).some((f) => f.includes(hoy))) throw new Error('No hay respaldo de hoy: node scripts/respaldar-base.mjs');
  }
  const operador = await prisma.usuario.findFirst({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });
  const lili = await prisma.usuario.findUnique({ where: { email: LILI }, select: { id: true, nombre: true, apellido: true, activo: true } });
  if (!operador || !lili || !lili.activo) throw new Error('Falta la cuenta del sistema o la de Lili, o la de Lili no está activa.');

  const filas = await prisma.cliente.findMany({ where: { codigo: { in: CODIGOS } }, select: { id: true, codigo: true, nombre: true, ruc: true, activo: true, observaciones: true } });
  if (filas.length !== CODIGOS.length) throw new Error(`Se esperaban ${CODIGOS.length} clientes y hay ${filas.length}.`);
  filas.sort((a, b) => a.codigo.localeCompare(b.codigo));

  for (const c of filas) {
    if (!A_REACTIVAR.includes(c.codigo) && !c.activo) throw new Error(`${c.codigo} ${c.nombre} está inactivo y no estaba previsto reactivarlo.`);
    console.log(`${c.codigo} ${c.nombre}: ${c.activo ? 'activo' : 'INACTIVO → vuelve a estar activo'}`);
    if (c.activo || !APLICAR) continue;
    const observaciones = [c.observaciones, `Vuelve a estar activo: es cliente de Lili, faltaba en la planilla (${ORIGEN}).`].filter(Boolean).join('\n');
    const nuevo = await clientes.actualizar(c.id, { activo: true, observaciones }, operador.id);
    await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CLIENTE_ACTUALIZADO, entidad: 'cliente', entidadId: c.id, clienteId: c.id,
      datosAntes: { codigo: c.codigo, nombre: c.nombre, ruc: c.ruc, activo: false },
      datosDespues: { codigo: nuevo.codigo, nombre: nuevo.nombre, ruc: nuevo.ruc, activo: nuevo.activo, motivo: ORIGEN } });
  }

  const antes = await usuarios.clientesAsignados(lili.id);
  const entran = filas.map((c) => c.id).filter((id) => !antes.includes(id));
  const persona = `${lili.nombre} ${lili.apellido}`;
  console.log(`Cartera de ${persona}: ${antes.length} → ${antes.length + entran.length}` +
    (entran.length ? ` · entran ${filas.filter((c) => entran.includes(c.id)).map((c) => c.codigo).join(', ')}` : ' · sin cambios'));
  if (APLICAR && entran.length > 0) {
    await usuarios.reemplazarCartera(lili.id, [...antes, ...entran], 'responsable', new Date());
    for (const clienteId of entran) {
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CARTERA_CLIENTE_ASIGNADO, entidad: 'asignacion_cliente', entidadId: lili.id, clienteId,
        datosAntes: null, datosDespues: { responsable: persona, origen: ORIGEN } });
    }
  }
  if (!APLICAR) console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar.');
} finally {
  await prisma.$disconnect();
}
