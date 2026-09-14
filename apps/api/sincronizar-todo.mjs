import { readFileSync } from 'node:fs';
for (const l of readFileSync('../../.env','utf8').split('\n')) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,''); }
const { PrismaClient } = await import('@prisma/client');
const { DriveGraph } = await import('@effort/drive');
const { ClientesPrisma } = await import('./dist/repositorios/clientes.js');
const { DocumentosPrisma, EvidenciasPrisma } = await import('./dist/repositorios/dominio.js');
const { sincronizarDesdeOneDrive } = await import('./dist/servicios/sincronizadorDeOneDrive.js');

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
const sistema = await prisma.usuario.findUnique({ where: { email: 'effort360@effort.com.py' } });
const cred = { tenantId: process.env.AZURE_TENANT_ID, clientId: process.env.AZURE_CLIENT_ID, clientSecret: process.env.AZURE_CLIENT_SECRET };
const evidencias = new EvidenciasPrisma(prisma);

const deps = {
  clientes: new ClientesPrisma(prisma),
  documentos: new DocumentosPrisma(prisma),
  origen: new DriveGraph({ ...cred, usuarioPrincipal: process.env.ONEDRIVE_USUARIO_ORIGEN ?? 'lsosa@effort.com.py' }),
  destino: new DriveGraph({ ...cred, usuarioPrincipal: process.env.ONEDRIVE_USUARIO_SISTEMA ?? 'effort360@effort.com.py', driveId: process.env.AZURE_DRIVE_ID }),
  registrarEvidencia: (d) => evidencias.registrarOVincular(d),
  huellasDeOrigen: (id) => evidencias.huellasDeOrigen(id),
  ahora: () => new Date(),
};

for (let corrida = 1; corrida <= 20; corrida += 1) {
  const r = await sincronizarDesdeOneDrive(deps, sistema.id);
  const docs = await prisma.documento.count();
  console.log(`corrida ${corrida}: nuevos=${r.nuevosEnTotal} fallos=${r.fallos.length} pendientes=${r.quedaronPendientes} | documentos=${docs}`);
  for (const f of r.fallos.slice(0, 2)) console.log(`   fallo: ${f.archivo.slice(0,40)} -> ${f.motivo.slice(0,70)}`);
  if (!r.quedaronPendientes) { console.log('SINCRONIZACION COMPLETA'); break; }
}
console.log('documentos:', await prisma.documento.count(), '| evidencias:', await prisma.evidencia.count());
await prisma.$disconnect();
