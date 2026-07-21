/**
 * Privacidad de datos sensibles en logs, errores y bitácora.
 *
 * EFFORT maneja RUC, facturación, saldos y datos de contacto de empresas de
 * terceros. Un log es un archivo que se copia, se envía a soporte, se guarda
 * en un servicio externo y sobrevive años. Todo lo que no debería salir de la
 * base tampoco debería entrar a un log.
 *
 * Este módulo se aplica en tres lugares: al escribir logs, al construir la
 * respuesta de un error, y antes de persistir `datosAntes`/`datosDespues` en
 * el registro de eventos.
 */

/** Campos que nunca se registran, en ninguna forma. */
const CAMPOS_PROHIBIDOS = new Set([
  'password',
  'contrasena',
  'contrasenia',
  'clave',
  'hashcontrasena',
  'hashdelaconstrasena',
  'token',
  'tokendesesion',
  'refreshtoken',
  'secreto',
  'secretototp',
  'totp',
  'codigo2fa',
  'codigosderecuperacion',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
  'clientsecret',
  'privatekey',
]);

/** Campos que se registran parcialmente: sirven para investigar, no para identificar. */
const CAMPOS_A_ENMASCARAR = new Set(['email', 'correo', 'telefono', 'ruc', 'documento']);

const MARCA_OCULTO = '[oculto]';

/**
 * Enmascara un correo dejando lo justo para reconocerlo en una investigación:
 * `laura.sosa@effort.com.py` → `l***@effort.com.py`.
 */
export function enmascararEmail(valor: string): string {
  const arroba = valor.indexOf('@');
  if (arroba <= 0) return MARCA_OCULTO;
  return `${valor[0]}***${valor.slice(arroba)}`;
}

/** Deja los últimos dígitos: `80012345-6` → `***345-6`. */
export function enmascararIdentificador(valor: string): string {
  const limpio = valor.trim();
  if (limpio.length <= 4) return MARCA_OCULTO;
  return `***${limpio.slice(-5)}`;
}

/**
 * Trunca una dirección IP.
 *
 * IPv4 pierde el último octeto y IPv6 conserva solo el prefijo /48. Alcanza
 * para detectar un patrón de ataque desde una red, y deja de ser un dato que
 * apunta a una persona concreta.
 */
export function truncarIp(ip: string | null | undefined): string | null {
  if (!ip) return null;

  const limpia = ip.replace(/^::ffff:/, '').trim();

  if (limpia.includes('.')) {
    const octetos = limpia.split('.');
    if (octetos.length !== 4) return null;
    return `${octetos[0]}.${octetos[1]}.${octetos[2]}.0`;
  }

  if (limpia.includes(':')) {
    const grupos = limpia.split(':').filter(Boolean);
    return `${grupos.slice(0, 3).join(':')}::`;
  }

  return null;
}

/**
 * Recorre un objeto y sanea sus campos sensibles.
 *
 * Devuelve una copia: no muta lo que recibe, para que sanear un objeto de cara
 * al log no altere el objeto que la aplicación sigue usando.
 */
export function sanear(valor: unknown, profundidad = 0): unknown {
  // Tope de profundidad: una estructura circular o muy anidada no debe poder
  // colgar el proceso desde el camino del logueo.
  if (profundidad > 12) return '[demasiado anidado]';

  if (valor === null || valor === undefined) return valor;
  if (typeof valor === 'bigint') return valor.toString();
  if (typeof valor !== 'object') return valor;

  if (Array.isArray(valor)) {
    return valor.slice(0, 100).map((elemento) => sanear(elemento, profundidad + 1));
  }

  if (valor instanceof Date) return valor.toISOString();
  if (valor instanceof Error) {
    return { nombre: valor.name, mensaje: valor.message };
  }

  const resultado: Record<string, unknown> = {};

  for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
    const claveNormalizada = clave.toLowerCase().replace(/[_\-\s]/g, '');

    if (CAMPOS_PROHIBIDOS.has(claveNormalizada)) {
      resultado[clave] = MARCA_OCULTO;
      continue;
    }

    if (CAMPOS_A_ENMASCARAR.has(claveNormalizada) && typeof contenido === 'string') {
      resultado[clave] = claveNormalizada.includes('mail')
        ? enmascararEmail(contenido)
        : enmascararIdentificador(contenido);
      continue;
    }

    resultado[clave] = sanear(contenido, profundidad + 1);
  }

  return resultado;
}

/**
 * Mensaje de error que se le devuelve al cliente HTTP.
 *
 * Un error interno nunca viaja con su texto original: el mensaje de una falla
 * de base de datos suele traer nombres de tablas, fragmentos de consulta y a
 * veces valores. El detalle queda en el log del servidor, referenciado por el
 * identificador de petición que sí se devuelve.
 */
export function mensajePublicoDeError(codigoHttp: number, peticionId: string): string {
  if (codigoHttp >= 500) {
    return `Ocurrió un error interno. Referencia: ${peticionId}`;
  }
  return 'La solicitud no pudo procesarse.';
}
