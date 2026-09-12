/**
 * Configuración desde variables de entorno.
 *
 * Se valida al arrancar y el proceso no levanta si falta algo o si un valor es
 * inseguro. Es deliberado: es preferible que el servidor no arranque a que
 * arranque con la cookie sin `secure` en producción, o con un secreto de
 * sesión de ocho caracteres, y nadie se entere hasta que haya un incidente.
 */

import { z } from 'zod';

const configuracionSchema = z
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
    TRABAJOS_AUTOMATICOS: z.enum(['si', 'no']).default('si'),
  })
  .strict()
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
  const soloLasNuestras = {
    NODE_ENV: entorno['NODE_ENV'],
    PORT: entorno['PORT'],
    DATABASE_URL: entorno['DATABASE_URL'],
    SECRETO_COOKIES: entorno['SECRETO_COOKIES'],
    ORIGEN_PERMITIDO: entorno['ORIGEN_PERMITIDO'],
    TURNSTILE_SECRET: entorno['TURNSTILE_SECRET'],
    AZURE_TENANT_ID: entorno['AZURE_TENANT_ID'],
    AZURE_CLIENT_ID: entorno['AZURE_CLIENT_ID'],
    AZURE_CLIENT_SECRET: entorno['AZURE_CLIENT_SECRET'],
    AZURE_DRIVE_ID: entorno['AZURE_DRIVE_ID'],
    AZURE_DRIVE_ID_ORIGEN: entorno['AZURE_DRIVE_ID_ORIGEN'],
    ONEDRIVE_USUARIO_SISTEMA: entorno['ONEDRIVE_USUARIO_SISTEMA'],
    ONEDRIVE_USUARIO_ORIGEN: entorno['ONEDRIVE_USUARIO_ORIGEN'],
    NIVEL_LOG: entorno['NIVEL_LOG'],
    TRABAJOS_AUTOMATICOS: entorno['TRABAJOS_AUTOMATICOS'],
  };

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
