/**
 * Tipos primitivos compartidos entre la API, la base de datos y la interfaz.
 *
 * Todo esquema de este paquete usa `.strict()`: un campo desconocido en el
 * cuerpo de una petición es un rechazo, no algo que se ignora en silencio.
 * Ignorar campos de más es cómo se cuelan escaladas de privilegios del tipo
 * `{ "rol": "direccion" }` en un endpoint que solo debía actualizar el teléfono.
 */

import { z } from 'zod';

/* --- Identificadores ------------------------------------------------------ */

export const idSchema = z.string().uuid({ message: 'Identificador inválido.' });

/* --- Dinero --------------------------------------------------------------- */

/**
 * Importe en guaraníes, transportado como cadena de dígitos.
 *
 * No es `z.number()` a propósito: JSON no distingue enteros de flotantes y un
 * importe grande perdería precisión al deserializarse. La API recibe y devuelve
 * texto; el dominio lo convierte a `bigint` con `gs()`.
 */
export const guaraniesSchema = z
  .string()
  .regex(/^-?\d+$/, 'El importe debe ser un entero en guaraníes, sin puntos ni decimales.')
  .refine((valor) => valor.length <= 20, 'Importe fuera de rango.');

/* --- Fechas y períodos ---------------------------------------------------- */

export const fechaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Se espera una fecha AAAA-MM-DD.')
  .refine((valor) => {
    const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return (
      fecha.getUTCFullYear() === anio &&
      fecha.getUTCMonth() === mes - 1 &&
      fecha.getUTCDate() === dia
    );
  }, 'La fecha no existe en el calendario.');

export const periodoSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Se espera un período AAAA-MM.');

export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Se espera una hora HH:MM.');

/* --- Identificación tributaria -------------------------------------------- */

/**
 * Dígito verificador del RUC paraguayo, algoritmo módulo 11 con base 11.
 *
 * Se valida en vez de aceptar cualquier texto porque un RUC mal tipeado no
 * falla al cargarlo: falla meses después, cuando la presentación se rechaza o
 * cuando la conciliación no encuentra el comprobante del proveedor.
 */
export function calcularDigitoVerificadorRuc(numeroBase: string): number {
  const digitos = numeroBase.replace(/\D/g, '');
  if (digitos.length === 0) {
    throw new Error('El RUC no contiene dígitos.');
  }

  let total = 0;
  let multiplicador = 2;

  for (let posicion = digitos.length - 1; posicion >= 0; posicion -= 1) {
    total += Number(digitos[posicion]) * multiplicador;
    multiplicador += 1;
    if (multiplicador > 11) multiplicador = 2;
  }

  const resto = total % 11;
  return resto > 1 ? 11 - resto : 0;
}

const FORMATO_RUC = /^\d{1,8}-\d$/;

export const rucSchema = z
  .string()
  .trim()
  .regex(FORMATO_RUC, 'Se espera un RUC con formato 80012345-6.')
  .refine((valor) => {
    // Zod no corta la cadena de validaciones cuando el regex de arriba
    // falla: este refine igual se ejecuta. Sin revalidar acá, un RUC sin
    // dígitos (o sin guion) llega a calcularDigitoVerificadorRuc(), que
    // lanza en vez de devolver `false` — convertiría un rechazo normal de
    // safeParse() en una excepción sin capturar.
    if (!FORMATO_RUC.test(valor)) return false;
    const [base, verificador] = valor.split('-') as [string, string];
    return calcularDigitoVerificadorRuc(base) === Number(verificador);
  }, 'El dígito verificador del RUC no corresponde.');

/* --- Contacto ------------------------------------------------------------- */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Correo electrónico inválido.')
  .max(254);

export const telefonoSchema = z
  .string()
  .trim()
  .regex(/^[\d+()\s-]{6,25}$/, 'Teléfono inválido.');

/* --- Texto ---------------------------------------------------------------- */

/**
 * Texto libre acotado. El tope no es estético: un campo sin límite es una vía
 * para agotar memoria y para guardar cargas útiles en la base.
 */
export const textoCorto = z.string().trim().min(1).max(200);
export const textoLargo = z.string().trim().max(4000);
export const textoOpcional = z.string().trim().max(4000).nullable();

/* --- Enumeraciones del dominio -------------------------------------------- */

export const rolSchema = z.enum([
  'direccion',
  'responsable',
  'coordinador',
  'auxiliar',
  'revisor_balance',
  'solo_lectura',
]);
export type Rol = z.infer<typeof rolSchema>;

export const estadoGeneralSchema = z.enum([
  'COMPLETO',
  'PARCIAL',
  'PENDIENTE',
  'OBSERVADO',
  'CRITICO',
]);

export const nivelRiesgoSchema = z.enum(['BAJO', 'MEDIO', 'ALTO', 'CRITICO']);

export const canalRecepcionSchema = z.enum([
  'WHATSAPP',
  'EMAIL',
  'ONEDRIVE',
  'FISICO_ESCANEADO',
  'SISTEMA',
]);

export const tipoDocumentoSchema = z.enum([
  'FACTURA_COMPRA',
  'FACTURA_VENTA',
  'RECIBO',
  'RETENCION',
  'NOTA_CREDITO',
  'NOTA_DEBITO',
  'EXTRACTO_BANCARIO',
  'COMPROBANTE_PAGO',
  'CONTRATO',
  'PODER',
  'ACTA',
  'ESTATUTO',
  'CERTIFICADO',
  'CONSTANCIA',
  'LIQUIDACION',
  // Agregados el 2026-09-11: los documentos reales de EFFORT incluyen balances,
  // estados de resultados, planillas de determinación y libros de SIGA. Sin
  // estos tipos, 831 de 1023 documentos quedaban como 'OTRO'.
  'BALANCE',
  'ESTADO_RESULTADOS',
  'DECLARACION_JURADA',
  'LIBRO_COMPRAS',
  'LIBRO_VENTAS',
  'OTRO',
]);

export const tasaIvaSchema = z.enum(['DIEZ', 'CINCO', 'EXENTA']);

export const origenRegistroSchema = z.enum(['REAL', 'SEMILLA', 'IMPORTADO']);

export const criticidadSchema = z.enum(['CRITICA', 'ALTA', 'MEDIA', 'INFORMATIVA']);

export const estadoAlertaSchema = z.enum(['ABIERTA', 'EN_CURSO', 'CERRADA', 'DESCARTADA']);

/** Marca de auditoría que llevan todas las entidades persistidas. */
export const auditoriaSchema = z
  .object({
    creadoEn: z.coerce.date(),
    creadoPorUsuarioId: idSchema,
    actualizadoEn: z.coerce.date(),
    actualizadoPorUsuarioId: idSchema,
    origen: origenRegistroSchema,
  })
  .strict();
