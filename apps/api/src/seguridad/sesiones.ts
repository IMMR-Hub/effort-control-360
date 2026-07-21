/**
 * Sesiones.
 *
 * La sesión vive en el servidor y el navegador solo lleva un identificador
 * opaco en una cookie. No se usa un JWT autocontenido: un JWT no se puede
 * revocar antes de que expire, y acá hace falta poder cerrar la sesión de
 * alguien en el acto — cuando se va de la empresa, cuando pierde la notebook,
 * o cuando se detecta un acceso raro.
 *
 * Dos vencimientos, no uno:
 *   - inactividad: cierra la sesión olvidada en una máquina compartida;
 *   - absoluto: acota cuánto sirve un identificador robado, aunque lo usen.
 *
 * El reloj se inyecta para poder probar los vencimientos sin esperar ocho horas.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { Rol } from '@effort/schema';

export const DURACION_POR_INACTIVIDAD_MS = 8 * 60 * 60 * 1000;
export const DURACION_ABSOLUTA_MS = 24 * 60 * 60 * 1000;

export interface Sesion {
  readonly id: string;
  /** Hash del token. El token en claro no se guarda en ningún lado. */
  readonly hashDelToken: string;
  readonly usuarioId: string;
  readonly rol: Rol;
  readonly creadaEn: Date;
  readonly ultimoUsoEn: Date;
  /** Falsa mientras el usuario no completó el segundo factor. */
  readonly segundoFactorSuperado: boolean;
  readonly ipTruncada: string | null;
  readonly agenteUsuario: string | null;
  readonly revocadaEn: Date | null;
}

export type MotivoDeCierre =
  | 'VIGENTE'
  | 'REVOCADA'
  | 'EXPIRADA_POR_INACTIVIDAD'
  | 'EXPIRADA_POR_TIEMPO_ABSOLUTO'
  | 'SEGUNDO_FACTOR_PENDIENTE';

/**
 * Genera un token de sesión.
 *
 * 32 bytes de `randomBytes` (CSPRNG del sistema operativo). `Math.random` sería
 * predecible y permitiría adivinar sesiones ajenas.
 */
export function generarTokenDeSesion(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash del token para guardarlo.
 *
 * SHA-256 sin sal alcanza acá y no sería suficiente para una contraseña: el
 * token ya tiene 256 bits de entropía aleatoria, así que no hay diccionario ni
 * fuerza bruta posible. Lo que se busca es que una copia de la base no permita
 * suplantar sesiones activas.
 */
export function hashDelToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compara dos hashes en tiempo constante.
 *
 * Una comparación con `===` corta en el primer byte distinto, y esa diferencia
 * de tiempo, medida muchas veces, permite reconstruir el valor esperado.
 */
export function hashesCoinciden(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function evaluarSesion(sesion: Sesion, ahora: Date): MotivoDeCierre {
  if (sesion.revocadaEn) return 'REVOCADA';

  if (ahora.getTime() - sesion.creadaEn.getTime() >= DURACION_ABSOLUTA_MS) {
    return 'EXPIRADA_POR_TIEMPO_ABSOLUTO';
  }

  if (ahora.getTime() - sesion.ultimoUsoEn.getTime() >= DURACION_POR_INACTIVIDAD_MS) {
    return 'EXPIRADA_POR_INACTIVIDAD';
  }

  if (!sesion.segundoFactorSuperado) return 'SEGUNDO_FACTOR_PENDIENTE';

  return 'VIGENTE';
}

export function sesionUtilizable(sesion: Sesion, ahora: Date): boolean {
  return evaluarSesion(sesion, ahora) === 'VIGENTE';
}

/** Atributos de la cookie de sesión. */
export interface OpcionesDeCookie {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: 'strict';
  readonly path: '/';
  readonly maxAge: number;
}

/**
 * `httpOnly` impide que un XSS lea la cookie desde JavaScript.
 * `sameSite: strict` impide que un sitio ajeno la envíe en una petición cruzada.
 * `secure` viaja solo por HTTPS; se permite apagarlo únicamente en desarrollo,
 * donde no hay certificado y no hay datos reales.
 */
export function opcionesDeCookie(esProduccion: boolean): OpcionesDeCookie {
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(DURACION_POR_INACTIVIDAD_MS / 1000),
  };
}

export const NOMBRE_COOKIE_SESION = '__Host-effort_sesion';
