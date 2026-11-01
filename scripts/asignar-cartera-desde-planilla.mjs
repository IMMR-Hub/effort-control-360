/**
 * Asigna a cada empleado los clientes que lleva, según la planilla de EFFORT
 * (`docs/clientes/cartera-por-empleado-2026-11-01.json`, sacada de la columna
 * «CLIENTE DE:» de «CLIENTES - ARIANA CAMPOS DA ROSA.xlsx», con los números ya
 * corregidos contra las carpetas de CLIENTES).
 *
 * Daniel, 2026-11-01: «fíjate que esté también actualizado qué cliente va con
 * qué empleado»; «dejemos los 9 [de BEA] sin asignar». «KARI» queda para cuando
 * Laura o Lili digan cuál de las dos Karinas es (`--kari <email>`).
 *
 * Las tres preguntas de CLAUDE.md:
 * 1. ¿Es necesario? Sí: sin cartera, un responsable no ve sus clientes y nadie
 *    figura a cargo (hoy no hay ninguna asignación vigente).
 * 2. ¿Qué pasa si sale mal? Por defecto SIMULA. Con `--aplicar` exige el
 *    respaldo del día; escribe con el mismo método que la pantalla de Usuarios
 *    (`UsuariosPrisma.reemplazarCartera`), que nunca borra: cierra con fecha lo
 *    que ya no corresponde y abre lo nuevo; cada cambio queda en la bitácora.
 * 3. ¿Forma correcta? La de la ruta PATCH /api/v1/usuarios/:id, sin SQL suelto.
 *
 * Uso: node scripts/asignar-cartera-desde-planilla.mjs [--aplicar] [--kari <email>]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
for (const linea of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const argv = process.argv.slice(2);
const APLICAR = argv.includes('--aplicar');
const KARI = argv.includes('--kari') ? argv[argv.indexOf('--kari') + 1] : null;
const CUENTA_DEL_SISTEMA = 'effort360@effort.com.py';
// Sigla de la planilla → usuaria del sistema (por nombre; los cuatro son únicos). BEA no existe: queda sin asignar.
const POR_NOMBRE = { ANALIA: 'Analia', ARA: 'Aracely', ARI: 'Ariana', SANDRA: 'Sandra' };

const { clientePorCodigo } = JSON.parse(readFileSync(join(RAIZ, 'docs/clientes/cartera-por-empleado-2026-11-01.json'), 'utf8'));
const { PrismaClient } = await import('@effort/api/node_modules/@prisma/client/default.js').catch(() => import('@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const { UsuariosPrisma } = await import('@effort/api/dist/repositorios/usuarios.js');
const { BitacoraPrisma } = await import('@effort/api/dist/repositorios/bitacora.js');
const { registrarEvento, ACCIONES } = await import('@effort/api/dist/bitacora.js');
const usuarios = new UsuariosPrisma(prisma);
const bitacora = new BitacoraPrisma(prisma);

try {
  const clientes = await prisma.cliente.findMany({ select: { id: true, codigo: true, nombre: true } });
  const idPorCodigo = new Map(clientes.map((c) => [c.codigo, c.id]));
  const empleados = { ...POR_NOMBRE };
  const destino = new Map(); // usuarioId → { nombre, clienteIds, codigos }
  const sinAsignar = [];
  for (const [codigo, sigla] of Object.entries(clientePorCodigo)) {
    let usuario = null;
    if (empleados[sigla]) usuario = await prisma.usuario.findFirst({ where: { nombre: empleados[sigla], activo: true }, select: { id: true, nombre: true, rol: true } });
    else if (sigla === 'KARI' && KARI) usuario = await prisma.usuario.findFirst({ where: { email: KARI, activo: true }, select: { id: true, nombre: true, rol: true } });
    const clienteId = idPorCodigo.get(codigo);
    if (!usuario || !clienteId) { sinAsignar.push(`${codigo} (${sigla}${!clienteId ? ', cliente no está en el sistema' : ''})`); continue; }
    if (usuario.rol !== 'responsable' && usuario.rol !== 'coordinador' && usuario.rol !== 'auxiliar') { sinAsignar.push(`${codigo} (${usuario.nombre}: su rol no lleva cartera)`); continue; }
    const d = destino.get(usuario.id) ?? { nombre: usuario.nombre, rol: usuario.rol, clienteIds: [], codigos: [] };
    d.clienteIds.push(clienteId); d.codigos.push(codigo); destino.set(usuario.id, d);
  }
  for (const [id, d] of destino) {
    const antes = await usuarios.clientesAsignados(id);
    console.log(`${d.nombre}: ${d.codigos.length} clientes (${d.codigos.sort().join(', ')}) · hoy tiene ${antes.length}`);
  }
  console.log(`Sin asignar: ${sinAsignar.length} · ${sinAsignar.join(' · ')}`);
  if (!APLICAR) { console.log('\nSIMULACIÓN: no se escribió nada. Agregá --aplicar.'); }
  else {
    const hoy = new Date().toISOString().slice(0, 10);
    const respaldo = readdirSync(join(RAIZ, 'respaldos')).find((f) => f.includes(hoy) || f.includes(hoy.replace(/-/g, '')));
    if (!respaldo) throw new Error('No hay respaldo de hoy en ./respaldos: correr node scripts/respaldar-base.mjs');
    const operador = await prisma.usuario.findFirst({ where: { email: CUENTA_DEL_SISTEMA }, select: { id: true } });
    for (const [id, d] of destino) {
      const antes = await usuarios.clientesAsignados(id);
      await usuarios.reemplazarCartera(id, d.clienteIds, d.rol, new Date());
      await registrarEvento(bitacora, { error: (x, m) => console.error(m, x) }, {
        usuarioId: operador?.id ?? null, accion: ACCIONES.USUARIO_ACTUALIZADO, entidad: 'usuario', entidadId: id, clienteId: null,
        datosAntes: { clientesAsignados: antes }, datosDespues: { clientesAsignados: d.clienteIds, origen: 'planilla CLIENTES - ARIANA CAMPOS DA ROSA.xlsx' },
      });
      console.log(`  asignado: ${d.nombre} → ${d.clienteIds.length} clientes`);
    }
    console.log(`\nListo (respaldo usado: ${respaldo}).`);
  }
} finally {
  await prisma.$disconnect();
}
