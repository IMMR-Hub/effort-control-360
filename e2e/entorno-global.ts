/**
 * Setup global de los tests end-to-end (Playwright).
 *
 * A diferencia de todo el resto de la suite (tests unitarios con dobles,
 * tests de integración contra un esquema real pero sin servidor HTTP, tests
 * de pantalla con `fetch` mockeado), esto es lo único que prueba el sistema
 * completo de punta a punta: un navegador real, contra un servidor Fastify
 * real escuchando en un puerto, contra un esquema de PostgreSQL real, con
 * cookies y CSRF de verdad — nada mockeado.
 *
 * Reusa el mismo esquema aislado que ya usan los tests de integración
 * (`apps/api/test/integracion/entorno.ts`): se crea, se migran las mismas
 * migraciones que corren en producción, y se destruye al final. Nunca toca
 * `public` — el esquema del piloto real de EFFORT queda intacto.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { crearEntorno, HAY_BASE_DE_DATOS } from '../apps/api/test/integracion/entorno.js';
import { hashearContrasena } from '../apps/api/src/seguridad/credenciales.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PUERTO_API = 3901;
export const PUERTO_WEB = 5183;

/**
 * Fijo, no generado con `generarSecretoTotp()` — ese secreto no es real, es
 * un dato de prueba, así que no hay ningún motivo para que sea aleatorio.
 * Al contrario: Playwright ejecuta `globalSetup` y el worker que corre cada
 * spec en procesos separados, cada uno con su propia instanciación de este
 * módulo — si el secreto se generara en el nivel superior del archivo, el
 * proceso de `globalSetup` sembraría uno y el spec, en su propia
 * instanciación del módulo, calcularía el código TOTP con otro completamente
 * distinto. Encontrado así: el primer intento generaba el secreto acá mismo
 * y el servidor rechazaba el código con "Código incorrecto." todas las
 * veces, aunque el flujo estuviera bien.
 */
const SECRETO_TOTP_DIRECCION = 'HVVTSECMMVLXYZQKKFKAOUSSPEOBS7IF';

export const CREDENCIALES = {
  // `direccion` está en `ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO` (ver
  // `apps/api/src/seguridad/rbac.ts`) — sin `secretoTotp`, el servidor
  // rechaza el login con 403 antes de emitir ninguna sesión.
  direccion: {
    email: 'e2e.direccion@effort.com.py',
    password: 'clave-de-pruebas-e2e-para-playwright-2026',
    secretoTotp: SECRETO_TOTP_DIRECCION,
  },
  auxiliar: { email: 'e2e.auxiliar@effort.com.py', password: 'clave-de-pruebas-e2e-para-playwright-2026' },
} as const;

export const CLIENTE_SEMBRADO = { nombre: 'GARSO S.A.', ruc: '80017726-6' };

/** Espera a que una URL responda algo (aunque sea un error HTTP) en vez de rechazar la conexión. */
async function esperarServidor(url: string, limiteMs: number): Promise<void> {
  const limite = Date.now() + limiteMs;
  let ultimoError: unknown;

  while (Date.now() < limite) {
    try {
      await fetch(url);
      return;
    } catch (error) {
      ultimoError = error;
      await new Promise((resuelve) => setTimeout(resuelve, 300));
    }
  }

  throw new Error(`El servidor en ${url} no respondió a tiempo. Último error: ${String(ultimoError)}`);
}

function detenerProceso(proceso: ChildProcess): Promise<void> {
  return new Promise((resuelve) => {
    if (proceso.exitCode !== null || proceso.killed) {
      resuelve();
      return;
    }
    proceso.once('exit', () => resuelve());
    proceso.kill();
  });
}

export default async function entornoGlobal(): Promise<() => Promise<void>> {
  if (!HAY_BASE_DE_DATOS) {
    throw new Error(
      'No hay DATABASE_URL/DIRECT_URL configurada — los tests e2e necesitan una base de datos real ' +
        '(mismo requisito que `test:integration`). Ver .env.example.',
    );
  }

  if (!existsSync(join(raiz, 'apps/api/dist/arrancar.js'))) {
    throw new Error(
      'apps/api/dist/arrancar.js no existe — corré `npx tsc --build` antes de `npx playwright test`.',
    );
  }

  const entorno = await crearEntorno();

  // Sembrado directo por Prisma, no por la API: es el mismo criterio que ya
  // usan los tests de integración — probar el servidor entero con un usuario
  // creado a través de sus propias rutas sería probar la ruta de alta, no el
  // login, y además complica el primer usuario porque `creadoPorUsuarioId`
  // normalmente exige una sesión ya autenticada.
  const hashDireccion = await hashearContrasena(CREDENCIALES.direccion.password);
  const hashAuxiliar = await hashearContrasena(CREDENCIALES.auxiliar.password);

  await entorno.prisma.usuario.create({
    data: {
      nombre: 'Dirección',
      apellido: 'E2E',
      email: CREDENCIALES.direccion.email,
      rol: 'direccion',
      veTodosLosClientes: true,
      hashContrasena: hashDireccion,
      debeCambiarContrasena: false,
      secretoTotp: CREDENCIALES.direccion.secretoTotp,
      segundoFactorActivo: true,
    },
  });

  await entorno.prisma.usuario.create({
    data: {
      nombre: 'Auxiliar',
      apellido: 'E2E',
      email: CREDENCIALES.auxiliar.email,
      rol: 'auxiliar',
      veTodosLosClientes: true,
      hashContrasena: hashAuxiliar,
      debeCambiarContrasena: false,
    },
  });

  await entorno.prisma.cliente.create({
    data: {
      nombre: CLIENTE_SEMBRADO.nombre,
      ruc: CLIENTE_SEMBRADO.ruc,
      tipoPersona: 'JURIDICA',
      activo: true,
    },
  });

  const origenWeb = `http://localhost:${PUERTO_WEB}`;

  const procesoApi = spawn(
    process.execPath,
    [join(raiz, 'apps/api/dist/arrancar.js')],
    {
      cwd: join(raiz, 'apps/api'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(PUERTO_API),
        DATABASE_URL: entorno.urlDeConexion,
        SECRETO_COOKIES: randomBytes(24).toString('hex'),
        ORIGEN_PERMITIDO: origenWeb,
        NIVEL_LOG: 'warn',
      },
      stdio: 'pipe',
    },
  );
  let salidaApi = '';
  procesoApi.stdout?.on('data', (fragmento) => (salidaApi += String(fragmento)));
  procesoApi.stderr?.on('data', (fragmento) => (salidaApi += String(fragmento)));

  const procesoWeb = spawn(
    process.execPath,
    [join(raiz, 'node_modules/vite/bin/vite.js'), 'dev', '--port', String(PUERTO_WEB), '--strictPort'],
    {
      cwd: join(raiz, 'apps/web'),
      env: { ...process.env, VITE_API_URL: `http://localhost:${PUERTO_API}` },
      stdio: 'pipe',
    },
  );
  let salidaWeb = '';
  procesoWeb.stdout?.on('data', (fragmento) => (salidaWeb += String(fragmento)));
  procesoWeb.stderr?.on('data', (fragmento) => (salidaWeb += String(fragmento)));

  async function apagarTodo(): Promise<void> {
    await Promise.all([detenerProceso(procesoApi), detenerProceso(procesoWeb)]);
    await entorno.destruir();
  }

  try {
    await esperarServidor(`http://localhost:${PUERTO_API}/api/v1/csrf`, 20_000);
    await esperarServidor(origenWeb, 20_000);
  } catch (error) {
    console.error('--- Salida del proceso de la API ---\n' + salidaApi);
    console.error('--- Salida del proceso de la web ---\n' + salidaWeb);
    await apagarTodo();
    throw error;
  }

  process.env['E2E_WEB_URL'] = origenWeb;

  return apagarTodo;
}
