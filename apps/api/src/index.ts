/**
 * Punto de entrada del servidor.
 *
 * Su único trabajo es cablear las dependencias reales y levantar el proceso.
 * Toda la lógica vive en módulos que no saben de `process.env` ni de puertos,
 * y por eso se pueden probar sin levantar nada.
 */

import { cargarConfiguracion, type Configuracion } from './configuracion.js';
import { construirServidor, type Dependencias } from './servidor.js';
import { registrarRutasDeAutenticacion } from './rutas/autenticacion.js';
import { registrarRutasDeContactos } from './rutas/contactos.js';
import { AlmacenEnMemoria } from './seguridad/limites.js';
import { comprobarConexion, crearClientePrisma } from './repositorios/prisma.js';
import { UsuariosPrisma } from './repositorios/usuarios.js';
import { SesionesPrisma } from './repositorios/sesiones.js';
import { ClientesPrisma } from './repositorios/clientes.js';
import { ContactosPrisma } from './repositorios/contactos.js';
import { BitacoraPrisma } from './repositorios/bitacora.js';
import {
  AlertasPrisma,
  BalancesPrisma,
  DocumentosPrisma,
  ProcesoMensualPrisma,
  ReglasDeNotificacionPrisma,
  ReglasImpositivasPrisma,
  SolicitudesPrisma,
  VencimientosPrisma,
} from './repositorios/dominio.js';
import { registrarRutasDeDocumentos } from './rutas/documentos.js';
import { registrarRutasDeVencimientos } from './rutas/vencimientos.js';
import { registrarRutasDeSolicitudes } from './rutas/solicitudes.js';
import { registrarRutasDeBalances } from './rutas/balances.js';
import { ExportacionesSigaPrisma, LiquidacionesPrisma } from './repositorios/siga.js';
import { registrarRutasDeSiga } from './rutas/siga.js';
import { registrarRutasDeLiquidaciones } from './rutas/liquidaciones.js';
import { registrarRutasDeAlertas } from './rutas/alertas.js';
import { registrarRutasDeUsuarios } from './rutas/usuarios.js';
import { registrarRutasDeReglasImpositivas } from './rutas/reglas-impositivas.js';
import { registrarRutasDeReglasDeNotificacion } from './rutas/reglas-notificacion.js';
import { registrarRutasDeEventos } from './rutas/eventos.js';
import { registrarRutasDeClientes } from './rutas/clientes.js';

export interface DependenciasReales extends Dependencias {
  readonly cerrar: () => Promise<void>;
}

/**
 * Arma las dependencias reales.
 *
 * Un solo cliente de Prisma para todos los repositorios: comparten el pool de
 * conexiones, que en Supabase Nano es de 15 y se agota rápido si cada
 * repositorio abre el suyo.
 */
export function construirDependencias(configuracion: Configuracion): DependenciasReales {
  const prisma = crearClientePrisma();

  return {
    configuracion,
    usuarios: new UsuariosPrisma(prisma),
    sesiones: new SesionesPrisma(prisma),
    clientes: new ClientesPrisma(prisma),
    contactos: new ContactosPrisma(prisma),
    bitacora: new BitacoraPrisma(prisma),
    documentos: new DocumentosPrisma(prisma),
    procesoMensual: new ProcesoMensualPrisma(prisma),
    vencimientos: new VencimientosPrisma(prisma),
    solicitudes: new SolicitudesPrisma(prisma),
    balances: new BalancesPrisma(prisma),
    exportacionesSiga: new ExportacionesSigaPrisma(prisma),
    liquidaciones: new LiquidacionesPrisma(prisma),
    alertas: new AlertasPrisma(prisma),
    reglasImpositivas: new ReglasImpositivasPrisma(prisma),
    reglasDeNotificacion: new ReglasDeNotificacionPrisma(prisma),
    intentosDeAcceso: new AlmacenEnMemoria(),
    ahora: () => new Date(),
    cerrar: () => prisma.$disconnect(),
  };
}

export async function arrancar(dependencias: Dependencias): Promise<void> {
  const app = await construirServidor(dependencias);

  await registrarRutasDeAutenticacion(app, dependencias);
  await registrarRutasDeContactos(app, dependencias);
  await registrarRutasDeDocumentos(app, dependencias);
  await registrarRutasDeVencimientos(app, dependencias);
  await registrarRutasDeSolicitudes(app, dependencias);
  await registrarRutasDeBalances(app, dependencias);
  await registrarRutasDeSiga(app, dependencias);
  await registrarRutasDeLiquidaciones(app, dependencias);
  await registrarRutasDeAlertas(app, dependencias);
  await registrarRutasDeUsuarios(app, dependencias);
  await registrarRutasDeReglasImpositivas(app, dependencias);
  await registrarRutasDeReglasDeNotificacion(app, dependencias);
  await registrarRutasDeEventos(app, dependencias);
  await registrarRutasDeClientes(app, dependencias);

  // Purga periódica del almacén de intentos: sin esto crece indefinidamente
  // mientras el proceso siga vivo.
  const purga = setInterval(
    () => dependencias.intentosDeAcceso.purgar(dependencias.ahora(), 15 * 60 * 1000),
    5 * 60 * 1000,
  );
  purga.unref();

  // Cierre ordenado: termina las peticiones en curso antes de salir, para no
  // cortar a alguien a mitad de guardar un contacto durante un despliegue.
  for (const senal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(senal, () => {
      app.log.info(`Señal ${senal} recibida, cerrando.`);
      void app.close().then(() => process.exit(0));
    });
  }

  await app.listen({ port: dependencias.configuracion.PORT, host: '0.0.0.0' });
}

/**
 * Arranque completo.
 *
 * Comprueba la base ANTES de escuchar peticiones: es preferible que el proceso
 * muera de entrada con un mensaje claro a que levante, acepte un acceso y falle
 * recién cuando un usuario intenta guardar algo.
 */
export async function principal(): Promise<void> {
  const configuracion = cargarConfiguracion();
  const dependencias = construirDependencias(configuracion);

  const prisma = crearClientePrisma();
  try {
    await comprobarConexion(prisma);
  } finally {
    await prisma.$disconnect();
  }

  await arrancar(dependencias);
}

export { cargarConfiguracion, construirServidor, AlmacenEnMemoria };
export type { Dependencias };
