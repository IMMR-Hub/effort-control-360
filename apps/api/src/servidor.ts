/**
 * Servidor HTTP.
 *
 * Las barreras se instalan una sola vez acá y aplican a todo lo que se registre
 * después. Ninguna ruta puede olvidarse de poner CSRF o cabeceras de seguridad,
 * porque no es cada ruta la que las pone.
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import csrf from '@fastify/csrf-protection';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import { esProduccion, type Configuracion } from './configuracion.js';
import { ErrorDeAutorizacion, type SujetoAutenticado } from './seguridad/rbac.js';
import {
  NOMBRE_COOKIE_SESION,
  evaluarSesion,
  hashDelToken,
} from './seguridad/sesiones.js';
import { mensajePublicoDeError, sanear, truncarIp } from './seguridad/privacidad.js';
import { AlmacenEnMemoria } from './seguridad/limites.js';
import type { RepositorioDeBitacora } from './bitacora.js';
import type {
  RepositorioDeClientes,
  RepositorioDeContactos,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from './puertos.js';
import type {
  RepositorioDeAlertas,
  RepositorioDeBalances,
  RepositorioDeDocumentos,
  RepositorioDeProcesoMensual,
  RepositorioDeReglasImpositivas,
  RepositorioDeVencimientos,
  RepositorioDeExportacionesSiga,
  RepositorioDeLiquidaciones,
} from './puertos-dominio.js';

export interface Dependencias {
  readonly configuracion: Configuracion;
  readonly usuarios: RepositorioDeUsuarios;
  readonly sesiones: RepositorioDeSesiones;
  readonly clientes: RepositorioDeClientes;
  readonly contactos: RepositorioDeContactos;
  readonly bitacora: RepositorioDeBitacora;
  readonly documentos: RepositorioDeDocumentos;
  readonly procesoMensual: RepositorioDeProcesoMensual;
  readonly vencimientos: RepositorioDeVencimientos;
  readonly balances: RepositorioDeBalances;
  readonly exportacionesSiga: RepositorioDeExportacionesSiga;
  readonly liquidaciones: RepositorioDeLiquidaciones;
  readonly alertas: RepositorioDeAlertas;
  readonly reglasImpositivas: RepositorioDeReglasImpositivas;
  readonly intentosDeAcceso: AlmacenEnMemoria;
  /** Reloj inyectable: los tests de expiración no pueden esperar ocho horas. */
  readonly ahora: () => Date;
}

declare module 'fastify' {
  interface FastifyRequest {
    sujeto: SujetoAutenticado | null;
    sesionId: string | null;
  }
}

export class ErrorDeAplicacion extends Error {
  override readonly name = 'ErrorDeAplicacion';

  constructor(
    readonly codigoHttp: number,
    mensaje: string,
    readonly codigo: string = 'solicitud_invalida',
  ) {
    super(mensaje);
  }
}

/** Quita la cadena de consulta de una URL, para no loguear filtros con identificadores. */
function rutaSinConsulta(url: string): string {
  const corte = url.indexOf('?');
  return corte === -1 ? url : url.slice(0, corte);
}

export async function construirServidor(deps: Dependencias): Promise<FastifyInstance> {
  const produccion = esProduccion(deps.configuracion);

  const app = Fastify({
    logger: {
      level: deps.configuracion.NIVEL_LOG,
      // El log nunca sale crudo: pasa por el mismo saneo que la bitácora.
      // Sin esto, el cuerpo de un login quedaría escrito con la contraseña.
      serializers: {
        req(peticion: FastifyRequest) {
          return {
            method: peticion.method,
            // Sin la cadena de consulta: ahí viajan filtros que pueden traer
            // identificadores de clientes, y el log no los necesita.
            url: rutaSinConsulta(peticion.url),
            ip: truncarIp(peticion.ip) ?? 'desconocida',
            peticionId: String(peticion.id),
          };
        },
        res(respuesta: { statusCode: number }) {
          return { estado: respuesta.statusCode };
        },
        err(error: Error) {
          const saneado = sanear({ nombre: error.name, mensaje: error.message }) as Record<
            string,
            unknown
          >;
          return { ...saneado, type: error.name, message: error.message, stack: '' };
        },
      },
    },
    genReqId: () => `pet-${randomUUID().slice(0, 12)}`,
    // Sin esto Fastify confía en X-Forwarded-For de cualquiera, y el límite de
    // intentos por IP se evade mandando una cabecera falsa. Se confía solo
    // detrás del proxy del hosting.
    trustProxy: produccion,
    bodyLimit: 1_048_576,
    disableRequestLogging: false,
  });

  /* --- Cabeceras de seguridad -------------------------------------------- */

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Sin 'unsafe-inline': un XSS que logre inyectar un <script> inline
        // no se ejecuta. Es la diferencia entre un bug y una fuga de datos.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", deps.configuracion.ORIGEN_PERMITIDO],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: produccion ? [] : null,
      },
    },
    hsts: produccion ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    xFrameOptions: { action: 'deny' },
    noSniff: true,
  });

  /* --- CORS: un solo origen, explícito ----------------------------------- */

  app.addHook('onRequest', async (peticion, respuesta) => {
    const origen = peticion.headers.origin;

    // Se compara contra el origen configurado, no se refleja el recibido.
    // Reflejar el Origin con credenciales habilitadas equivale a no tener CORS.
    if (origen && origen === deps.configuracion.ORIGEN_PERMITIDO) {
      respuesta.header('Access-Control-Allow-Origin', origen);
      respuesta.header('Access-Control-Allow-Credentials', 'true');
      respuesta.header('Vary', 'Origin');
    }

    if (peticion.method === 'OPTIONS') {
      respuesta
        .header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
        .header('Access-Control-Allow-Headers', 'content-type,x-csrf-token')
        .code(204)
        .send();
    }
  });

  /* --- Cookies y CSRF ----------------------------------------------------- */

  await app.register(cookie, {
    secret: deps.configuracion.SECRETO_COOKIES,
    parseOptions: { httpOnly: true, sameSite: 'strict', path: '/', secure: produccion },
  });

  // SameSite=strict ya frena la mayoría de los ataques de petición cruzada;
  // el token es la segunda barrera, para navegadores viejos y para el caso de
  // una redirección de nivel superior que sí manda la cookie.
  await app.register(csrf, {
    sessionPlugin: '@fastify/cookie',
    cookieOpts: { signed: true, httpOnly: false, sameSite: 'strict', path: '/', secure: produccion },
    getToken: (peticion) => peticion.headers['x-csrf-token'] as string | undefined,
  });

  /* --- Límite global de peticiones --------------------------------------- */

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // Por IP truncada: una oficina entera comparte IP y no debe bloquearse
    // por el uso normal de una sola persona.
    keyGenerator: (peticion) => truncarIp(peticion.ip) ?? peticion.ip,
    errorResponseBuilder: () => ({
      error: 'demasiadas_peticiones',
      mensaje: 'Demasiadas solicitudes. Esperá un momento y volvé a intentar.',
    }),
  });

  /* --- Contexto de la petición -------------------------------------------- */

  app.decorateRequest('sujeto', null);
  app.decorateRequest('sesionId', null);

  /**
   * Resuelve la sesión en cada petición.
   *
   * No rechaza: solo deja el sujeto disponible. Quién exige autenticación es
   * cada ruta, mediante `exigirSesion`. Así las rutas públicas (el acceso, la
   * comprobación de salud) no necesitan una excepción.
   */
  app.addHook('preHandler', async (peticion) => {
    const token = peticion.cookies[NOMBRE_COOKIE_SESION];
    if (!token) return;

    const sesion = await deps.sesiones.buscarPorHash(hashDelToken(token));
    if (!sesion) return;

    const momento = deps.ahora();
    if (evaluarSesion(sesion, momento) !== 'VIGENTE') return;

    const usuario = await deps.usuarios.buscarPorId(sesion.usuarioId);
    if (!usuario || !usuario.activo) return;

    peticion.sesionId = sesion.id;
    peticion.sujeto = {
      usuarioId: usuario.id,
      rol: usuario.rol,
      activo: usuario.activo,
      veTodosLosClientes: usuario.veTodosLosClientes,
      clientesAsignados: usuario.veTodosLosClientes
        ? []
        : await deps.usuarios.clientesAsignados(usuario.id),
    };

    // Renueva la ventana de inactividad. Sin esto, alguien trabajando ocho
    // horas seguidas se quedaría afuera a mitad de la jornada.
    await deps.sesiones.tocar(sesion.id, momento);
  });

  /* --- Manejo de errores --------------------------------------------------- */

  app.setErrorHandler((error, peticion, respuesta) => {
    const peticionId = String(peticion.id);

    if (error instanceof ZodError) {
      // Los problemas de validación sí se detallan: son del cliente y no
      // revelan nada del servidor.
      return respuesta.code(400).send({
        error: 'validacion',
        mensaje: 'Los datos enviados no son válidos.',
        problemas: error.issues.map((problema) => ({
          campo: problema.path.join('.'),
          detalle: problema.message,
        })),
        peticionId,
      });
    }

    if (error instanceof ErrorDeAutorizacion) {
      peticion.log.warn(
        { usuarioId: peticion.sujeto?.usuarioId ?? null, ruta: rutaSinConsulta(peticion.url) },
        'Permiso denegado.',
      );
      return respuesta.code(403).send({ error: 'sin_permiso', mensaje: error.message, peticionId });
    }

    if (error instanceof ErrorDeAplicacion) {
      return respuesta
        .code(error.codigoHttp)
        .send({ error: error.codigo, mensaje: error.message, peticionId });
    }

    // Cualquier otra cosa es un fallo nuestro. El detalle queda en el log del
    // servidor; al cliente solo le llega la referencia. Un mensaje de error de
    // base de datos trae nombres de tablas y, a veces, valores.
    peticion.log.error({ err: error }, 'Error no controlado.');

    // Fastify tipa el error como `unknown` en el manejador; los errores de
    // parseo del cuerpo traen `statusCode` y deben responder 4xx, no 500.
    const estadoDeclarado =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;

    const codigo =
      typeof estadoDeclarado === 'number' && estadoDeclarado >= 400 && estadoDeclarado < 500
        ? estadoDeclarado
        : 500;
    return respuesta.code(codigo).send({
      error: codigo >= 500 ? 'error_interno' : 'solicitud_invalida',
      mensaje: mensajePublicoDeError(codigo, peticionId),
      peticionId,
    });
  });

  app.setNotFoundHandler((peticion, respuesta) => {
    respuesta.code(404).send({ error: 'no_encontrado', mensaje: 'Recurso inexistente.' });
  });

  /* --- Comprobación de salud ---------------------------------------------- */

  // Sin datos del sistema: la usa el balanceador del hosting y es pública.
  // Devolver versión o estado de la base acá es regalarle información a quien sondea.
  app.get('/salud', async () => ({ estado: 'ok' }));

  return app;
}

/** Exige sesión válida. Las rutas que manejan datos la llaman siempre. */
export function exigirSesion(peticion: FastifyRequest): SujetoAutenticado {
  if (!peticion.sujeto) {
    throw new ErrorDeAplicacion(401, 'Necesitás iniciar sesión.', 'sin_sesion');
  }
  return peticion.sujeto;
}
