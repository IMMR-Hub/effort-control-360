/**
 * Con qué cadena se conecta la aplicación en marcha a la base.
 *
 * **El problema, medido el 2026-11-12.** Supabase ofrece dos entradas al mismo
 * servidor: la de transacciones (puerto 6543, que Prisma usa con
 * `pgbouncer=true`) y la de sesión (puerto 5432). Con la primera, Prisma hace
 * unas CINCO idas y vueltas por consulta (abre una transacción, limpia las
 * sentencias preparadas, prepara, ejecuta, confirma) para asegurarse de que todo
 * caiga en la misma conexión; con la de sesión hace una. Medido con las mismas
 * credenciales, desde la máquina de trabajo: `SELECT 1` en ~220 ms contra ~45
 * ms, y 30 consultas a la vez en 1,7 s contra 0,6 s. Desde producción —la API
 * en Atlanta, la base en São Paulo— cada ida y vuelta cuesta más de 100 ms, y
 * eso daba ~600 ms por consulta: `/api/v1/yo`, que hacía cinco, tardaba 3,2 s
 * con el servidor ocioso (5 % de CPU).
 *
 * La entrada de transacciones existe para funciones que nacen y mueren con
 * cada petición. Esta API es un proceso único de larga vida con su propio pool:
 * la de sesión es la que le corresponde.
 *
 * **Qué hace.** Si `DATABASE_URL` apunta al pooler de Supabase por el puerto
 * 6543, arma la cadena equivalente por el 5432: mismo servidor, mismo usuario,
 * misma clave — no hay credencial nueva que cargar en ningún lado. Cualquier
 * otra cadena (una base local, un túnel, otro proveedor) se deja como está.
 *
 * **El límite de conexiones no es un detalle.** En modo sesión cada conexión
 * del pool ocupa un lugar real en Supabase (15 por usuario y base, salvo que se
 * suba). Por eso se fija `connection_limit`: sin él, Prisma abre
 * `núcleos × 2 + 1`, y dos instancias conviviendo durante un despliegue más las
 * herramientas de trabajo podrían agotar el cupo y dejar a la aplicación sin
 * poder conectarse.
 *
 * **Interruptor** (`CLAUDE.md`, lección 4): `CONEXION_A_LA_BASE=transacciones`
 * vuelve al comportamiento anterior sin desplegar código.
 */

export type ModoDeConexion = 'sesion' | 'transacciones';

const PUERTO_DE_TRANSACCIONES = '6543';
const PUERTO_DE_SESION = '5432';

export interface ConexionDeLaApp {
  readonly url: string;
  /** Lo que se deja dicho en el log al arrancar. Nunca incluye la cadena. */
  readonly descripcion: string;
}

export function conexionDeLaApp(
  databaseUrl: string,
  modo: ModoDeConexion,
  conexionesMaximas: number,
): ConexionDeLaApp {
  if (modo === 'transacciones') {
    return { url: databaseUrl, descripcion: 'la de DATABASE_URL, sin cambios (CONEXION_A_LA_BASE=transacciones)' };
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { url: databaseUrl, descripcion: 'la de DATABASE_URL, sin cambios (no se pudo interpretar)' };
  }

  const esPoolerDeSupabase = url.hostname.endsWith('.pooler.supabase.com');
  if (!esPoolerDeSupabase || url.port !== PUERTO_DE_TRANSACCIONES) {
    return { url: databaseUrl, descripcion: 'la de DATABASE_URL, sin cambios (no es el pooler de transacciones de Supabase)' };
  }

  url.port = PUERTO_DE_SESION;
  url.searchParams.delete('pgbouncer');
  url.searchParams.set('connection_limit', String(conexionesMaximas));

  return {
    url: url.toString(),
    descripcion: `modo sesión de Supabase (puerto ${PUERTO_DE_SESION}), hasta ${conexionesMaximas} conexiones`,
  };
}
