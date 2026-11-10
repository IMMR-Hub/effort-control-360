/**
 * Ajuste del 2026-11-10 pedido por Daniel: el sistema queda con los clientes de la planilla de EFFORT y cada
 * colaborador ve solo los suyos.
 *
 * Daniel, 2026-11-10: «Los clientes que NO figuran en el listado que te pase recien, simpelemte asumimos que son
 * clientes sin movimiento, por ende no los incluyas en el sistema Effort 360. lo demás, actualizalo todo y dale
 * acceso solo de acuerdo al excel a cada uno de los colaboradores. No olvides que Laura y Lili, tienen acceso a todo
 * (asi como yo tambien). Nunca olvides que todo lo creado, modificado o borrado queda registrado en una bitacora por
 * cliente.»
 *
 * Qué hace (todo con los mismos métodos que usa la API, y cada cambio con su evento en la bitácora):
 * 1. Los clientes que no están en la planilla (`docs/clientes/CLIENTES ACTIVOS - CRUCE CON EL SISTEMA -
 *    10-11-2026.xlsx`, hoja «No están en la planilla») pasan a INACTIVOS. No se borra nada: sus documentos y su
 *    historia quedan, la sincronización deja de leerlos y no aparecen en las pantallas. Se vuelven a activar desde
 *    Clientes. Evento `cliente.actualizado` con su `clienteId`.
 * 2. Los colaboradores que no son de dirección dejan de ver todos los clientes: ven solo los de su cartera (la que se
 *    cargó el 01-11 desde la misma planilla). Dirección (Laura, Lili, Daniel) sigue viendo todo. Evento
 *    `usuario.actualizado`, y además uno por cada cliente de la cartera, para que figure en la bitácora del cliente.
 * 3. Los RUC que la planilla trae y el sistema no tenía (071 y 128), con el día de vencimiento ya comprobado.
 *
 * Las tres preguntas de CLAUDE.md:
 * 1. ¿Es necesario? Sí: hoy los 8 responsables ven los 128 clientes y 47 no son clientes con movimiento.
 * 2. ¿Qué pasa si sale mal? Nada se borra; todo se revierte con otra edición. Exige el respaldo del día.
 * 3. ¿Forma correcta? La de las rutas PATCH de clientes y usuarios, sin SQL suelto.
 *
 * Uso: node scripts/ajustar-clientes-y-accesos-2026-11-10.mjs [--aplicar]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const APLICAR = process.argv.includes('--aplicar');
const CUENTA_DEL_SISTEMA = 'effort360@effort.com.py';
const MOTIVO = 'Sin movimiento: no figura en la planilla de clientes de EFFORT (Daniel, 2026-11-10).';
const RUC_DE_LA_PLANILLA = { '071': '2432482-5', '128': '80022736-0' };
// Figuran en el mismo archivo, en la lista «IPS REI / REOP» de la hoja ARIANA: están en el listado, así que siguen
// activos (sin responsable en la planilla: los ve dirección).
const EN_LISTA_IPS_REOP = ['001', '014', '015', '108', '109', '110'];

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

// Los códigos fuera de la planilla, leídos del Excel del cruce (la hoja que revisan Laura y Lili).
const { default: ExcelJS } = await import('exceljs').catch(() => ({ default: null }));
let fuera;
if (ExcelJS) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(RAIZ, 'docs/clientes/CLIENTES ACTIVOS - CRUCE CON EL SISTEMA - 10-11-2026.xlsx'));
  fuera = [];
  wb.getWorksheet('No están en la planilla').eachRow((fila, n) => { if (n > 3 && /^\d{3}$/.test(String(fila.getCell(1).value))) fuera.push(String(fila.getCell(1).value)); });
} else {
  fuera = JSON.parse(readFileSync(process.env.FUERA_JSON, 'utf8'));
}

try {
  const operador = await prisma.usuario.findFirst({ where: { email: CUENTA_DEL_SISTEMA }, select: { id: true } });
  const todos = await prisma.cliente.findMany({ select: { id: true, codigo: true, nombre: true, ruc: true, activo: true, observaciones: true } });
  const porCodigo = new Map(todos.map((c) => [c.codigo, c]));
  const aDesactivar = fuera.filter((cod) => !EN_LISTA_IPS_REOP.includes(cod)).map((cod) => porCodigo.get(cod)).filter((c) => c && c.activo);
  const enCartera = await prisma.asignacionCliente.findMany({ where: { hasta: null, cliente: { codigo: { in: fuera } } }, select: { cliente: { select: { codigo: true } } } });
  console.log(`1. Clientes a desactivar: ${aDesactivar.length} de ${fuera.length} fuera de la planilla (${aDesactivar.map((c) => c.codigo).join(', ')})`);
  if (enCartera.length) throw new Error(`Hay clientes fuera de la planilla con responsable asignado: ${enCartera.map((a) => a.cliente.codigo).join(', ')}`);

  const colaboradores = await prisma.usuario.findMany({ where: { rol: { not: 'direccion' } }, select: { id: true, nombre: true, apellido: true, veTodosLosClientes: true, activo: true } });
  const direccion = await prisma.usuario.findMany({ where: { rol: 'direccion' }, select: { nombre: true, veTodosLosClientes: true } });
  console.log(`2. Dirección (ve todo): ${direccion.map((u) => `${u.nombre}${u.veTodosLosClientes ? '' : ' (¡NO ve todo!)'}`).join(', ')}`);
  for (const u of colaboradores) console.log(`   ${u.nombre} ${u.apellido}: ve todos = ${u.veTodosLosClientes} → solo su cartera (${(await usuarios.clientesAsignados(u.id)).length} clientes)`);

  const rucs = [];
  for (const [cod, ruc] of Object.entries(RUC_DE_LA_PLANILLA)) {
    const c = porCodigo.get(cod);
    const otro = await prisma.cliente.findFirst({ where: { ruc }, select: { codigo: true } });
    if (!c || c.ruc || otro) { console.log(`3. ${cod}: no se carga (${!c ? 'no existe' : c.ruc ? 'ya tiene ' + c.ruc : 'RUC usado por ' + otro.codigo})`); continue; }
    rucs.push({ c, ruc }); console.log(`3. ${cod} ${c.nombre}: RUC ${ruc}`);
  }

  if (!APLICAR) { console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar.'); }
  else {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!readdirSync(join(RAIZ, 'respaldos')).some((f) => f.includes(hoy))) throw new Error('No hay respaldo de hoy: node scripts/respaldar-base.mjs');
    for (const c of aDesactivar) {
      const obs = [c.observaciones, MOTIVO].filter(Boolean).join('\n');
      const nuevo = await clientes.actualizar(c.id, { activo: false, observaciones: obs }, operador.id);
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CLIENTE_ACTUALIZADO, entidad: 'cliente', entidadId: c.id, clienteId: c.id,
        datosAntes: { codigo: c.codigo, nombre: c.nombre, ruc: c.ruc, activo: true }, datosDespues: { codigo: nuevo.codigo, nombre: nuevo.nombre, ruc: nuevo.ruc, activo: nuevo.activo, motivo: MOTIVO } });
    }
    console.log(`   desactivados: ${aDesactivar.length}`);
    for (const u of colaboradores) {
      const cartera = await usuarios.clientesAsignados(u.id);
      if (u.veTodosLosClientes) {
        await usuarios.actualizar(u.id, { veTodosLosClientes: false }, operador.id);
        await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.USUARIO_ACTUALIZADO, entidad: 'usuario', entidadId: u.id, clienteId: null,
          datosAntes: { veTodosLosClientes: true }, datosDespues: { veTodosLosClientes: false, clientesAsignados: cartera, origen: 'acceso según la planilla de EFFORT (Daniel, 2026-11-10)' } });
      }
      for (const clienteId of cartera) {
        await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.USUARIO_ACTUALIZADO, entidad: 'asignacion_cliente', entidadId: u.id, clienteId,
          datosAntes: { veTodosLosClientes: u.veTodosLosClientes }, datosDespues: { responsable: `${u.nombre} ${u.apellido}`, acceso: 'solo su cartera, según la planilla de EFFORT', asignadoDesde: '2026-11-01' } });
      }
      console.log(`   ${u.nombre} ${u.apellido}: ahora ve ${cartera.length} clientes`);
    }
    for (const { c, ruc } of rucs) {
      const nuevo = await clientes.actualizar(c.id, { ruc }, operador.id);
      await registrarEvento(bitacora, log, { usuarioId: operador.id, accion: ACCIONES.CLIENTE_ACTUALIZADO, entidad: 'cliente', entidadId: c.id, clienteId: c.id,
        datosAntes: { codigo: c.codigo, nombre: c.nombre, ruc: null, activo: c.activo }, datosDespues: { codigo: nuevo.codigo, nombre: nuevo.nombre, ruc: nuevo.ruc, activo: nuevo.activo, origen: 'planilla CLIENTES - ARIANA CAMPOS DA ROSA.xlsx' } });
      console.log(`   RUC cargado: ${c.codigo} ${ruc}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
