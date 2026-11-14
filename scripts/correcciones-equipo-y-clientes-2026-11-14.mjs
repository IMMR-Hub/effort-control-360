/**
 * Correcciones del 2026-11-14 (Daniel), contra la planilla `CLIENTES - ARIANA CAMPOS DA ROSA.xlsx`:
 *
 * 1. **Cuentas que no están en la planilla, desactivadas.** Daniel: «Desactiva a los que no están en el
 *    Excel, pero no te olvides de agregar a Laura y a Lili también y obvia a mí también». En la columna
 *    «CLIENTE DE» están ANALIA, ARA, ARI, SANDRA, BEA (`kbaez@`, usa el correo viejo) y PEDRO
 *    (`pbarrios@`, «kmedina es ahora pbarrios»). Laura y Lili son dirección y ven todo; Daniel también.
 *    Quedan afuera Jorge Barrios, Karina Medina y Melany González, que venían de la lista de septiembre
 *    (`crear-equipo.mjs`), no de la planilla. Desactivar no borra nada: la cuenta, su historia y su
 *    bitácora quedan, y se reactiva desde la pantalla de Usuarios. Se cierran sus sesiones (nunca
 *    entraron, pero así no queda ninguna abierta).
 *
 * 2. **096 vuelve a estar activo: es DIEGO SOSA.** La planilla trae «DIEGO SOSA» (ARA, SOLO IVA, vence el
 *    21) sin número de carpeta, y el 2026-11-10 di de baja el 096 «DIEGO CAMPUZANO» por no encontrarlo por
 *    nombre. La declaración de IVA de setiembre 2026 que está en esa carpeta (formulario 120, presentada el
 *    19/10/2026) es de «SOSA ARGAÑA CAMPUZANO, DIEGO MARTIN JOSE», RUC 2036307-9: el mismo RUC del 096, y
 *    su terminación (7) vence el día 21, como dice la planilla. La cartera (Aracely) y la obligación (IVA)
 *    las cargan después los scripts de siempre, con la entrada 096 agregada a
 *    `docs/clientes/obligaciones-segun-planilla-ariana-2026-11-12.json`.
 *
 * Simula por defecto; `--aplicar` exige respaldo de hoy. Repetirlo no cambia lo que ya está bien.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const APLICAR = process.argv.includes('--aplicar');
const FUERA_DE_LA_PLANILLA = ['jbarrios@effort.com.py', 'kmedina@effort.com.py', 'mgonzalez@effort.com.py'];
/** Nunca se desactivan: los de la planilla, dirección y la cuenta del sistema (Daniel). */
const SE_QUEDAN = [
  'aalvarenga@effort.com.py', 'asanguina@effort.com.py', 'acampos@effort.com.py', 'sferreira@effort.com.py',
  'kbaez@effort.com.py', 'pbarrios@effort.com.py', 'lsosa@effort.com.py', 'llaconich@effort.com.py', 'effort360@effort.com.py',
];
const MOTIVO_CUENTA = 'No figura en la planilla de clientes de EFFORT (Daniel, 2026-11-14: «Desactiva a los que no están en el Excel»).';
const MOTIVO_096 = 'Vuelve a estar activo: es DIEGO SOSA de la planilla (RUC 2036307-9 en su declaración de IVA de setiembre 2026). Lo había dado de baja por error el 2026-11-10.';

const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(() => import('@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const { UsuariosPrisma } = await import('@effort/api/dist/repositorios/usuarios.js');
const { ClientesPrisma } = await import('@effort/api/dist/repositorios/clientes.js');
const { SesionesPrisma } = await import('@effort/api/dist/repositorios/sesiones.js');
const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
const { registrarEvento, ACCIONES } = await import('@effort/api/dist/bitacora.js');
const usuarios = new UsuariosPrisma(prisma);
const clientes = new ClientesPrisma(prisma);
const sesiones = new SesionesPrisma(prisma);
const bitacora = new BitacoraPrisma(prisma);
const log = { error: (x, m) => console.error(m, x) };

try {
  if (FUERA_DE_LA_PLANILLA.some((e) => SE_QUEDAN.includes(e))) throw new Error('Una cuenta a desactivar está en la lista de las que se quedan.');
  if (APLICAR) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!readdirSync(join(RAIZ, 'respaldos')).some((f) => f.includes(hoy))) throw new Error('No hay respaldo de hoy: node scripts/respaldar-base.mjs');
  }
  const operador = await prisma.usuario.findFirst({ where: { email: 'effort360@effort.com.py' }, select: { id: true } });
  const ahora = new Date();

  for (const email of FUERA_DE_LA_PLANILLA) {
    const u = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nombre: true, apellido: true, activo: true } });
    if (!u) { console.log(`${email}: no existe`); continue; }
    console.log(`${u.nombre} ${u.apellido} (${email}): ${u.activo ? 'activa → se desactiva' : 'ya estaba desactivada'}`);
    if (!APLICAR || !u.activo) continue;
    await usuarios.actualizar(u.id, { activo: false }, operador.id);
    await sesiones.revocarTodasDelUsuario(u.id, ahora, 'cuenta desactivada');
    await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.USUARIO_ACTUALIZADO, entidad: 'usuario', entidadId: u.id, clienteId: null,
      datosAntes: { activo: true }, datosDespues: { activo: false, motivo: MOTIVO_CUENTA } });
  }
  for (const email of SE_QUEDAN) {
    const u = await prisma.usuario.findUnique({ where: { email }, select: { activo: true } });
    console.log(`  se queda: ${email}${u ? (u.activo ? '' : ' (¡DESACTIVADA!)') : ' (todavía no tiene cuenta)'}`);
  }

  const c = await prisma.cliente.findFirst({ where: { codigo: '096' }, select: { id: true, codigo: true, nombre: true, ruc: true, activo: true, observaciones: true } });
  if (!c || c.ruc !== '2036307-9') throw new Error('El 096 no es el cliente esperado (RUC 2036307-9): no se toca.');
  console.log(`\n096 ${c.nombre} (RUC ${c.ruc}): ${c.activo ? 'ya está activo' : 'inactivo → vuelve a estar activo'}`);
  if (APLICAR && !c.activo) {
    const observaciones = [c.observaciones, MOTIVO_096].filter(Boolean).join('\n');
    const nuevo = await clientes.actualizar(c.id, { activo: true, observaciones }, operador.id);
    await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CLIENTE_ACTUALIZADO, entidad: 'cliente', entidadId: c.id, clienteId: c.id,
      datosAntes: { codigo: c.codigo, nombre: c.nombre, ruc: c.ruc, activo: false },
      datosDespues: { codigo: nuevo.codigo, nombre: nuevo.nombre, ruc: nuevo.ruc, activo: nuevo.activo, motivo: MOTIVO_096 } });
  }
  // IVA del 096 («SOLO IVA» en la planilla), desde 2026-10-01 como el resto. Igual que
  // `asignar-obligaciones-segun-planilla.mjs`, pero solo esta fila: ese script, corrido entero,
  // volvería a crear el anticipo genérico que el 2026-11-12 se reemplazó por ANTICIPO_IRE_1..4.
  const iva = await prisma.obligacionTributaria.findFirst({ where: { codigo: 'IVA_GENERAL' }, select: { id: true } });
  const yaTiene = await prisma.obligacionDeCliente.findFirst({ where: { clienteId: c.id, obligacionId: iva.id }, select: { id: true } });
  console.log(`096 IVA General: ${yaTiene ? 'ya lo tiene' : 'se asigna desde 2026-10-01'}`);
  if (APLICAR && !yaTiene) {
    await prisma.$transaction([
      prisma.obligacionDeCliente.create({
        data: { clienteId: c.id, obligacionId: iva.id, desde: new Date('2026-10-01T00:00:00.000Z'), creadoPorUsuarioId: operador.id },
      }),
      prisma.eventLog.create({
        data: {
          usuarioId: operador.id, accion: 'cliente.actualizado', entidad: 'cliente', entidadId: c.id, clienteId: c.id,
          datosDespues: { obligacionAsignada: 'IVA_GENERAL', desde: '2026-10-01', criterio: 'planilla de clientes de EFFORT, fila DIEGO SOSA: SOLO IVA' },
        },
      }),
    ]);
  }
  if (!APLICAR) console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar.');
} finally {
  await prisma.$disconnect();
}
