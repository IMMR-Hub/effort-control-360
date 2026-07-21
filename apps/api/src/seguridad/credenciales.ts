/**
 * Contraseñas y segundo factor.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { authenticator } from 'otplib';

/**
 * Parámetros de Argon2id.
 *
 * Argon2id y no bcrypt: resiste tanto ataques con GPU como los de canal lateral.
 * 19 MiB y 2 iteraciones es la línea base recomendada por OWASP; el costo de
 * memoria es lo que encarece el ataque masivo, porque una GPU tiene muchos
 * núcleos pero poca memoria por núcleo.
 *
 * El algoritmo no se declara acá: la biblioteca usa Argon2id por defecto, y su
 * enumeración es un `const enum` ambiente que no se puede importar con
 * `verbatimModuleSyntax`. En vez de fijar el número mágico 2, el test
 * `seguridad.test.ts` comprueba que el hash generado empiece con `$argon2id$`.
 * Es una garantía más fuerte que la declaración: verifica el resultado real.
 */
const PARAMETROS_ARGON = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const LARGO_MINIMO_CONTRASENA = 12;

export class ErrorDeCredenciales extends Error {
  override readonly name = 'ErrorDeCredenciales';
}

/**
 * Reglas de contraseña.
 *
 * Se exige largo antes que composición: una frase larga es más fuerte y más
 * memorable que ocho caracteres con un símbolo, y la exigencia de símbolos
 * empuja a la gente a variantes previsibles del tipo `Effort2026!`.
 */
export function validarFortaleza(contrasena: string): void {
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    throw new ErrorDeCredenciales(
      `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
    );
  }

  if (contrasena.length > 200) {
    throw new ErrorDeCredenciales('La contraseña es demasiado larga.');
  }

  if (/^\s|\s$/.test(contrasena)) {
    throw new ErrorDeCredenciales('La contraseña no puede empezar ni terminar con espacios.');
  }

  const previsibles = ['effort', 'contrasena', 'password', '123456', 'qwerty', 'admin'];
  const normalizada = contrasena.toLowerCase();
  if (previsibles.some((termino) => normalizada.includes(termino))) {
    throw new ErrorDeCredenciales('La contraseña contiene un término demasiado previsible.');
  }
}

export async function hashearContrasena(contrasena: string): Promise<string> {
  validarFortaleza(contrasena);
  return argonHash(contrasena, PARAMETROS_ARGON);
}

/**
 * Verifica una contraseña.
 *
 * Devuelve `false` ante un hash corrupto en vez de propagar la excepción: un
 * registro con hash inválido debe fallar como credencial incorrecta, no
 * romper el endpoint de acceso con un 500 que además revela el problema.
 */
export async function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  try {
    return await argonVerify(hash, contrasena);
  } catch {
    return false;
  }
}

/* --- Segundo factor ------------------------------------------------------- */

authenticator.options = {
  // Una ventana de tolerancia a cada lado: cubre relojes levemente desfasados
  // sin ampliar de más el período en que un código robado sigue sirviendo.
  window: 1,
  step: 30,
};

export function generarSecretoTotp(): string {
  return authenticator.generateSecret(20);
}

export function urlDeConfiguracionTotp(email: string, secreto: string): string {
  return authenticator.keyuri(email, 'EFFORT Control 360', secreto);
}

export function verificarCodigoTotp(codigo: string, secreto: string): boolean {
  const limpio = codigo.replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return false;

  try {
    return authenticator.verify({ token: limpio, secret: secreto });
  } catch {
    return false;
  }
}

/* --- Códigos de recuperación ---------------------------------------------- */

/**
 * Códigos de un solo uso para cuando alguien pierde el teléfono.
 *
 * Sin esto, perder el teléfono con dirección o responsable deja a esa persona
 * fuera del sistema, y la salida de emergencia terminaría siendo desactivarle
 * el segundo factor a mano en la base.
 */
export function generarCodigosDeRecuperacion(cantidad = 8): string[] {
  return Array.from({ length: cantidad }, () =>
    randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
  );
}

export function codigosCoinciden(a: string, b: string): boolean {
  const bufferA = Buffer.from(a.trim().toUpperCase(), 'utf8');
  const bufferB = Buffer.from(b.trim().toUpperCase(), 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
