/**
 * Configuración desde variables de entorno.
 *
 * Se valida al arrancar y el proceso no levanta si falta algo o si un valor es
 * inseguro. Es deliberado: es preferible que el servidor no arranque a que
 * arranque con la cookie sin `secure` en producción, o con un secreto de
 * sesión de ocho caracteres, y nadie se entere hasta que haya un incidente.
 */

import { z } from 'zod';

/**
 * Un interruptor `si`/`no` que tolera cómo se escribe a mano en un panel.
 *
 * Hasta el 2026-09-16 un "Si" o un "sí" cargado en DigitalOcean hacía que la
 * API no arrancara (el valor tenía que ser exactamente `si`), y los chequeos
 * del tipo `=== 'no'` dejaban ENCENDIDO un interruptor cuya variable faltaba.
 * Ahora se normaliza acá, en un solo lugar, y quien lo usa compara con
 * `=== 'si'`: lo que no está explícitamente encendido, está apagado.
 */
function interruptor(porDefecto: 'si' | 'no') {
  return z.preprocess((valor) => {
    if (typeof valor !== 'string') return valor;
    const limpio = valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (['si', 'true', '1', 'yes', 's'].includes(limpio)) return 'si';
    if (['no', 'false', '0', 'n'].includes(limpio)) return 'no';
    return limpio;
  }, z.enum(['si', 'no']).default(porDefecto));
}

/** Lista de correos separados por coma. Vacía si no se cargó. */
const listaDeCorreos = z
  .string()
  .optional()
  .transform((valor) =>
    (valor ?? '')
      .split(',')
      .map((correo) => correo.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().email('AVISOS_DESTINATARIOS tiene una dirección de correo inválida.')));

const camposDeConfiguracion = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

    /** Cadena de conexión a PostgreSQL (Supabase). */
    DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL.'),

    /**
     * Secreto para firmar cookies. 32 caracteres como mínimo: por debajo de eso
     * la firma se puede atacar por fuerza bruta con hardware común.
     */
    SECRETO_COOKIES: z.string().min(32, 'SECRETO_COOKIES debe tener al menos 32 caracteres.'),

    /** Origen exacto de la interfaz. Sin comodines: un `*` anularía el CORS. */
    ORIGEN_PERMITIDO: z.string().url('ORIGEN_PERMITIDO debe ser una URL completa.'),

    /** Clave de Cloudflare Turnstile. Si falta, queda solo el límite de intentos. */
    TURNSTILE_SECRET: z.string().optional(),

    /**
     * Credenciales de Microsoft Graph y drive de la cuenta del sistema.
     *
     * Opcionales: sin ellas el sistema arranca igual y solo se pierde la
     * descarga de archivos desde OneDrive. Es a propósito -- que falte una
     * variable de un módulo no puede impedir que EFFORT entre a trabajar.
     */
    AZURE_TENANT_ID: z.string().optional(),
    AZURE_CLIENT_ID: z.string().optional(),
    AZURE_CLIENT_SECRET: z.string().optional(),
    /**
     * Los drives se identifican por el correo de su dueño, no por el id.
     *
     * Con valor por defecto a propósito: así el despliegue no depende de que
     * alguien cargue una cadena opaca de 66 caracteres en el panel del
     * hosting. El id igual se puede forzar con `AZURE_DRIVE_ID` si alguna vez
     * hiciera falta, pero no es el camino normal.
     */
    ONEDRIVE_USUARIO_SISTEMA: z.string().default('effort360@effort.com.py'),
    /** Cuenta donde EFFORT trabaja a diario. De ahí se LEE, nunca se escribe. */
    ONEDRIVE_USUARIO_ORIGEN: z.string().default('lsosa@effort.com.py'),
    AZURE_DRIVE_ID: z.string().optional(),
    AZURE_DRIVE_ID_ORIGEN: z.string().optional(),

    NIVEL_LOG: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    /**
     * Interruptor de los trabajos que corren solos (sincronización de OneDrive,
     * cálculo de vencimientos, avisos por correo).
     *
     * Existe por una caída real: el 2026-09-12 la sincronización automática
     * tumbó el servicio en producción y lo dejó en ciclo de reinicio, con lo
     * cual NADIE podía entrar al sistema. Sin un interruptor, la única forma de
     * cortar el trabajo que mata al servicio es desplegar código nuevo — media
     * hora larga con el sistema caído. Con esto se apaga desde el panel del
     * hosting en dos minutos, y el resto del sistema sigue funcionando: lo que
     * se pierde es que la importación y el cálculo haya que dispararlos a mano
     * con los botones que ya existen.
     */
    TRABAJOS_AUTOMATICOS: interruptor('si'),

    /**
     * Avisos por correo de las alertas críticas. APAGADOS por defecto.
     *
     * Daniel, 2026-09-16: "hasta que no te lo diga, NO QUIERO QUE MANDES NINGÚN
     * CORREO a nadie". Hasta esa fecha los avisos salían solos, a todos los
     * usuarios de dirección, sin tope: la primera corrida después de calcular
     * el IVA de COPESA habría mandado decenas de correos. Se encienden recién
     * en las pruebas finales con EFFORT, con `si` y con destinatarios
     * explícitos (plan maestro, decisión A6).
     */
    AVISOS_POR_CORREO: interruptor('no'),
    /**
     * A quiénes se avisa, separados por coma. Sin nadie cargado no sale ningún
     * correo aunque el interruptor esté encendido: los destinatarios ya no se
     * deducen de los usuarios de dirección, para que una cuenta nueva no
     * reciba de golpe todo lo acumulado.
     */
    AVISOS_DESTINATARIOS: listaDeCorreos,
    /** Máximo de correos por corrida. El resto queda en la pantalla de Alertas. */
    AVISOS_TOPE_POR_CORRIDA: z.coerce.number().int().min(0).max(100).default(5),
  })
  .strict();

/**
 * Variables que lee el sistema: salen del esquema, no de una lista aparte.
 *
 * Antes eran una lista escrita a mano que había que mantener sincronizada con
 * el esquema; una variable agregada al esquema y olvidada en la lista se
 * ignoraba sin ningún aviso, aunque estuviera cargada en el panel.
 */
export const VARIABLES_DE_CONFIGURACION = Object.keys(camposDeConfiguracion.shape);

const configuracionSchema = camposDeConfiguracion
  .superRefine((config, contexto) => {
    if (config.NODE_ENV !== 'production') return;

    if (config.ORIGEN_PERMITIDO.startsWith('http://')) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ORIGEN_PERMITIDO'],
        message: 'En producción el origen debe ser https: sobre http la cookie de sesión viaja en claro.',
      });
    }

    const secretosDeEjemplo = ['cambiame', 'changeme', 'secreto', 'development'];
    if (secretosDeEjemplo.some((termino) => config.SECRETO_COOKIES.toLowerCase().includes(termino))) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SECRETO_COOKIES'],
        message: 'SECRETO_COOKIES conserva un valor de ejemplo. Generá uno nuevo antes de desplegar.',
      });
    }
  });

export type Configuracion = z.infer<typeof configuracionSchema>;

export class ErrorDeConfiguracion extends Error {
  override readonly name = 'ErrorDeConfiguracion';
}

export function cargarConfiguracion(entorno: NodeJS.ProcessEnv = process.env): Configuracion {
  const soloLasNuestras = Object.fromEntries(
    VARIABLES_DE_CONFIGURACION.map((clave) => [clave, entorno[clave]]),
  );

  // Quita las que no vinieron, para que los valores por defecto de Zod apliquen.
  const presentes = Object.fromEntries(
    Object.entries(soloLasNuestras).filter(([, valor]) => valor !== undefined),
  );

  const resultado = configuracionSchema.safeParse(presentes);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');

    // El mensaje nombra la variable pero nunca su valor: este error termina
    // en los logs de despliegue, que suele ver más gente de la que debería.
    throw new ErrorDeConfiguracion(
      `La configuración del entorno es inválida:\n${detalle}\n\nRevisá tu archivo .env contra .env.example.`,
    );
  }

  return resultado.data;
}

export function esProduccion(config: Configuracion): boolean {
  return config.NODE_ENV === 'production';
}
