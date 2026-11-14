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

import type { DriveDeArchivos, EnviadorDeCorreo } from '@effort/drive';

import { esProduccion, type Configuracion } from './configuracion.js';
import type { LibroRg90Prisma } from './repositorios/libroRg90.js';
import type { DeclaracionesPrisma } from './repositorios/declaraciones.js';
import type { ArchivosDeOrigenPrisma } from './repositorios/dominio.js';
import type { AlmacenDelPuntoDeSincronizacion } from './servicios/sincronizacionIncremental.js';
import type { RepositorioDeDeclaracionesAjenas } from './servicios/motorDeAlertas.js';
import type { LectorDeTablas } from './servicios/respaldoAutomatico.js';
import { ErrorDeAutorizacion, type SujetoAutenticado } from './seguridad/rbac.js';
import {
  evaluarSesion,
  hashDelToken,
  nombreCookieSesion,
} from './seguridad/sesiones.js';
import { mensajePublicoDeError, sanear, truncarIp } from './seguridad/privacidad.js';
import { AlmacenEnMemoria } from './seguridad/limites.js';
import type { RepositorioDeBitacora } from './bitacora.js';
import type {
  ContextoDeSesion,
  RepositorioDeClientes,
  RepositorioDeContactos,
  RepositorioDeHoras,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from './puertos.js';
import type {
  RepositorioDeAlertas,
  RepositorioDeBalances,
  RepositorioDeDocumentos,
  RepositorioDeProcesoMensual,
  RepositorioDeEnvios,
  RepositorioDeEvidencias,
  RepositorioDeObligaciones,
  RepositorioDeRecordatorios,
  RepositorioDeReglasDeNotificacion,
  RepositorioDeReglasImpositivas,
  RepositorioDeSolicitudes,
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
  readonly horas: RepositorioDeHoras;
  readonly bitacora: RepositorioDeBitacora;
  readonly documentos: RepositorioDeDocumentos;
  readonly procesoMensual: RepositorioDeProcesoMensual;
  readonly vencimientos: RepositorioDeVencimientos;
  readonly obligaciones: RepositorioDeObligaciones;
  readonly evidencias: RepositorioDeEvidencias;
  /** Qué archivos del OneDrive de EFFORT ya se miraron. Ver `ArchivosDeOrigenPrisma`. */
  readonly archivosDeOrigen: ArchivosDeOrigenPrisma;
  /**
   * Dónde se guarda hasta dónde llegó la sincronización con OneDrive, para que
   * un reinicio no obligue a recorrer todo. Sin esto vive solo en memoria.
   */
  readonly puntoDeSincronizacion?: AlmacenDelPuntoDeSincronizacion | null;
  /**
   * Acceso de solo lectura a todas las tablas, para el respaldo diario.
   *
   * Se declara con el tipo mínimo que el respaldo necesita —`findMany` y nada
   * más— en vez de pasar el cliente de Prisma entero. No es ceremonia: es lo
   * que hace imposible que la herramienta que existe para proteger los datos
   * pueda modificarlos.
   */
  readonly lectorParaRespaldo: LectorDeTablas;
  readonly envios: RepositorioDeEnvios;
  /** Envío de correo desde la casilla del sistema. `null` sin credenciales. */
  readonly correo: EnviadorDeCorreo | null;
  /**
   * Acceso a OneDrive. Opcional: si faltan las credenciales de Azure el
   * sistema arranca igual y solo se pierde abrir archivos, en vez de no
   * arrancar por una variable de un modulo.
   */
  readonly drive: DriveDeArchivos | null;
  /**
   * Drive donde EFFORT trabaja a diario. **Solo lectura**: es una instancia
   * aparte justamente para que una escritura no pueda ir a parar ahí.
   */
  readonly driveDeOrigen: DriveDeArchivos | null;
  readonly solicitudes: RepositorioDeSolicitudes;
  /** Recordatorios de seguimiento efectivamente mandados (tarea 96). */
  readonly recordatorios: RepositorioDeRecordatorios;
  readonly balances: RepositorioDeBalances;
  readonly exportacionesSiga: RepositorioDeExportacionesSiga;
  readonly liquidaciones: RepositorioDeLiquidaciones;
  /**
   * IVA calculado desde las planillas RG 90 y sus hallazgos.
   *
   * Opcional como el drive y por el mismo motivo: sin OneDrive no hay planillas
   * que leer, y que falte un módulo no puede impedir que EFFORT entre a
   * trabajar con el resto del sistema.
   */
  readonly libroRg90: LibroRg90Prisma | null;
  /**
   * PDFs leídos buscando presentaciones ante la DNIT. Opcional por lo mismo
   * que el libro: sin OneDrive no hay declaraciones que leer.
   */
  readonly declaraciones?: DeclaracionesPrisma | null;
  /**
   * Declaraciones archivadas bajo el cliente equivocado (tarea 143). Opcional
   * por lo mismo: se lee de lo que dejó el detector de presentaciones.
   */
  readonly declaracionesAjenas?: RepositorioDeDeclaracionesAjenas | null;
  readonly alertas: RepositorioDeAlertas;
  readonly reglasImpositivas: RepositorioDeReglasImpositivas;
  readonly reglasDeNotificacion: RepositorioDeReglasDeNotificacion;
  readonly intentosDeAcceso: AlmacenEnMemoria;
  /** Reloj inyectable: los tests de expiración no pueden esperar ocho horas. */
  readonly ahora: () => Date;
}

/**
 * Sesión probada por contraseña pero todavía sin segundo factor.
 *
 * No es un sujeto autenticado y no se puede usar como tal: no lleva rol ni
 * cartera a propósito, para que sea imposible pasarla por error a `exigirPermiso`.
 * Lo único que habilita es el alta del propio segundo factor.
 */
export interface SesionEnConfiguracion {
  readonly sesionId: string;
  readonly usuarioId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    sujeto: SujetoAutenticado | null;
    sesionId: string | null;
    sesionEnConfiguracion: SesionEnConfiguracion | null;
    /** Lo trae el hook de sesión, para que `/yo` no vuelva a pedir el usuario a la base. */
    debeCambiarContrasena?: boolean;
    /** Milisegundos que tardó identificar al usuario (encabezado `Server-Timing`). */
    msDeSesion?: number;
  }
}

/**
 * Lo único alcanzable mientras la contraseña esté por cambiar.
 *
 * `salida` y `yo` están para que la interfaz pueda mostrar quién es y ofrecer
 * cerrar sesión sin quedar en un callejón; `csrf` porque cambiar la contraseña
 * es una petición mutante y necesita el token.
 */
const RUTAS_CON_CONTRASENA_PENDIENTE: ReadonlySet<string> = new Set([
  'POST /api/v1/mi/contrasena',
  'POST /api/v1/salida',
  'GET /api/v1/yo',
  'GET /api/v1/csrf',
]);

/** Identifica la ruta por su patrón, no por la URL concreta con sus parámetros. */
function rutaDe(peticion: FastifyRequest): string {
  return `${peticion.method} ${peticion.routeOptions?.url ?? ''}`;
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

/**
 * El mismo contexto que `contextoPorHash`, con las consultas de siempre. Es el
 * camino de los repositorios que no tienen la consulta única.
 */
async function contextoDeSesionEnPasos(deps: Dependencias, hash: string): Promise<ContextoDeSesion | null> {
  const sesion = await deps.sesiones.buscarPorHash(hash);
  if (!sesion) return null;
  const [usuario, clientesAsignados] = await Promise.all([
    deps.usuarios.buscarPorId(sesion.usuarioId),
    deps.usuarios.clientesAsignados(sesion.usuarioId),
  ]);
  if (!usuario) return null;
  return {
    sesion,
    usuario: {
      id: usuario.id,
      rol: usuario.rol,
      activo: usuario.activo,
      veTodosLosClientes: usuario.veTodosLosClientes,
      debeCambiarContrasena: usuario.debeCambiarContrasena,
    },
    clientesAsignados,
  };
}

/** Cada cuánto se renueva `ultimo_uso_en` de una sesión en uso (la ventana de inactividad es de 8 horas). */
export const RENOVAR_SESION_CADA_MS = 60 * 1000;

export async function construirServidor(deps: Dependencias): Promise<FastifyInstance> {
  const produccion = esProduccion(deps.configuracion);

  /*
   * Pedidos simultáneos de la misma sesión comparten UNA consulta (2026-11-13).
   * Al abrir el Panel salen 8 pedidos juntos; cada uno identificaba la sesión por
   * su cuenta y los 8 competían por las 5 conexiones a la base: medido en
   * producción, 5 de los 8 esperaban ~1,1 s solo para eso. No es un caché: la
   * consulta compartida es la que está en vuelo en ese momento y se olvida apenas
   * responde, así que nada se lee más viejo que si cada pedido la hubiera hecho
   * a la vez. Una sesión revocada deja de valer en el pedido siguiente, igual que
   * antes.
   */
  const contextosEnVuelo = new Map<string, Promise<ContextoDeSesion | null>>();
  function contextoCompartido(hash: string): Promise<ContextoDeSesion | null> {
    const enVuelo = contextosEnVuelo.get(hash);
    if (enVuelo) return enVuelo;
    const consulta = (
      deps.sesiones.contextoPorHash ? deps.sesiones.contextoPorHash(hash) : contextoDeSesionEnPasos(deps, hash)
    ).finally(() => contextosEnVuelo.delete(hash));
    contextosEnVuelo.set(hash, consulta);
    return consulta;
  }

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

  /**
   * Exige el token CSRF en toda petición que cambia estado.
   *
   * Un solo hook global, no un `preHandler` por ruta: la alternativa es una
   * ruta nueva que se olvide de ponerlo, que es exactamente cómo este chequeo
   * quedó registrado pero nunca aplicado a nada durante la Parte 1 — el
   * plugin estaba pero no protegía una sola ruta. GET/HEAD no cambian estado
   * y no lo necesitan; ahí es donde el cliente pide el token la primera vez.
   */
  const METODOS_PROTEGIDOS_POR_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  app.addHook('preHandler', (peticion, respuesta, done) => {
    if (!METODOS_PROTEGIDOS_POR_CSRF.has(peticion.method)) {
      done();
      return;
    }
    app.csrfProtection(peticion, respuesta, done);
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
  app.decorateRequest('sesionEnConfiguracion', null);

  /**
   * Resuelve la sesión en cada petición.
   *
   * No rechaza: solo deja el sujeto disponible. Quién exige autenticación es
   * cada ruta, mediante `exigirSesion`. Así las rutas públicas (el acceso, la
   * comprobación de salud) no necesitan una excepción.
   */
  app.addHook('preHandler', async (peticion) => {
    const token = peticion.cookies[nombreCookieSesion(produccion)];
    if (!token) return;
    const inicioDeSesion = performance.now();

    // Sesión, usuario y cartera en un solo viaje a la base cuando el
    // repositorio lo permite: este hook corre en TODA petición y cada viaje
    // cuesta ~130 ms desde producción (2026-11-12).
    const hash = hashDelToken(token);
    const contexto = await contextoCompartido(hash);
    if (!contexto) return;
    const { sesion, usuario } = contexto;
    const cartera = [...contexto.clientesAsignados];

    const momento = deps.ahora();
    const estado = evaluarSesion(sesion, momento);
    if (estado !== 'VIGENTE' && estado !== 'SEGUNDO_FACTOR_PENDIENTE') return;
    if (!usuario.activo) return;


    peticion.sesionId = sesion.id;

    // Contraseña probada, segundo factor todavía no. No se puebla `sujeto`, así
    // que ninguna ruta de negocio la acepta: lo único que habilita es dar de
    // alta el propio segundo factor (`rutas/mi-cuenta.ts`).
    if (estado === 'SEGUNDO_FACTOR_PENDIENTE') {
      peticion.sesionEnConfiguracion = { sesionId: sesion.id, usuarioId: usuario.id };
      return;
    }

    peticion.sujeto = {
      usuarioId: usuario.id,
      rol: usuario.rol,
      activo: usuario.activo,
      veTodosLosClientes: usuario.veTodosLosClientes,
      clientesAsignados: usuario.veTodosLosClientes ? [] : cartera,
    };
    peticion.debeCambiarContrasena = usuario.debeCambiarContrasena;

    // Contraseña por cambiar: la sesión es válida, pero lo único que habilita
    // es cambiarla. Va como guarda global y no ruta por ruta, por el mismo
    // criterio que el hook de CSRF: una ruta nueva que se olvide de
    // comprobarlo es exactamente cómo se abre un agujero sin que nadie lo note.
    if (usuario.debeCambiarContrasena && !RUTAS_CON_CONTRASENA_PENDIENTE.has(rutaDe(peticion))) {
      throw new ErrorDeAplicacion(
        403,
        'Tenés que cambiar tu contraseña antes de continuar.',
        'contrasena_por_cambiar',
      );
    }

    // Renueva la ventana de inactividad. Sin esto, alguien trabajando ocho
    // horas seguidas se quedaría afuera a mitad de la jornada. Una vez por
    // minuto alcanza: la ventana es de 8 horas, y escribir en la base en cada
    // petición era un viaje más en el camino de todas (2026-11-12).
    if (momento.getTime() - sesion.ultimoUsoEn.getTime() >= RENOVAR_SESION_CADA_MS) {
      await deps.sesiones.tocar(sesion.id, momento);
    }
    peticion.msDeSesion = performance.now() - inicioDeSesion;
  });

  /**
   * Cuánto tardó cada respuesta, y cuánto de eso fue identificar al usuario,
   * visible en las herramientas del navegador (`Server-Timing`). Existe para
   * medir la lentitud desde la pantalla real sin acceso a los registros del
   * servidor (2026-11-12). No expone datos: solo milisegundos.
   */
  app.addHook('onSend', async (peticion, respuesta, cuerpo) => {
    const total = respuesta.elapsedTime;
    const partes = [`total;dur=${total.toFixed(0)}`];
    if (peticion.msDeSesion !== undefined) partes.unshift(`sesion;dur=${peticion.msDeSesion.toFixed(0)}`);
    respuesta.header('Server-Timing', partes.join(', '));
    return cuerpo;
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

  /**
   * Emite el token CSRF. Pública a propósito: el cliente la llama al cargar
   * la aplicación, antes de que exista una sesión — el login también es una
   * petición mutante y necesita el token igual que cualquier otra.
   */
  app.get('/api/v1/csrf', async (_peticion, respuesta) => ({
    csrfToken: respuesta.generateCsrf(),
  }));

  return app;
}

/** Exige sesión válida. Las rutas que manejan datos la llaman siempre. */
export function exigirSesion(peticion: FastifyRequest): SujetoAutenticado {
  if (!peticion.sujeto) {
    throw new ErrorDeAplicacion(401, 'Necesitás iniciar sesión.', 'sin_sesion');
  }
  return peticion.sujeto;
}

/**
 * Exige una sesión con la contraseña ya probada, con o sin segundo factor.
 *
 * Solo la usan las rutas de alta del segundo factor: son las únicas que tienen
 * que atender a alguien que todavía no lo configuró. Devuelve el id del usuario
 * y el de la sesión, nunca un `SujetoAutenticado` — así no hay forma de pasarla
 * por descuido a una comprobación de permisos.
 */
export function exigirSesionEnConfiguracion(peticion: FastifyRequest): SesionEnConfiguracion {
  if (peticion.sesionEnConfiguracion) return peticion.sesionEnConfiguracion;

  if (peticion.sujeto && peticion.sesionId) {
    return { sesionId: peticion.sesionId, usuarioId: peticion.sujeto.usuarioId };
  }

  throw new ErrorDeAplicacion(401, 'Necesitás iniciar sesión.', 'sin_sesion');
}
