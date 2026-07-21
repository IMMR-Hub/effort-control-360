/**
 * Entidades del sistema.
 *
 * Todo gira alrededor del mismo eje, tal como lo define el handoff:
 *   cliente + período + obligación → estado + responsable + próxima acción + evidencia
 *
 * Cada entidad tiene tres esquemas:
 *   - `Schema`         lo que sale de la base de datos
 *   - `crearSchema`    lo que la API acepta para crear
 *   - `actualizarSchema` lo que la API acepta para modificar
 *
 * Los tres son distintos a propósito. El de creación no acepta `id` ni campos
 * de auditoría (los pone el servidor), y el de actualización no acepta los
 * campos que nadie debería poder cambiar por API, como `origen`.
 */

import { z } from 'zod';

import {
  auditoriaSchema,
  canalRecepcionSchema,
  emailSchema,
  estadoGeneralSchema,
  fechaIsoSchema,
  guaraniesSchema,
  horaSchema,
  idSchema,
  nivelRiesgoSchema,
  origenRegistroSchema,
  periodoSchema,
  rolSchema,
  rucSchema,
  tasaIvaSchema,
  telefonoSchema,
  textoCorto,
  textoLargo,
  textoOpcional,
  tipoDocumentoSchema,
} from './primitivos.js';

/* ========================================================================== */
/* Usuarios y equipo                                                          */
/* ========================================================================== */

export const usuarioSchema = z
  .object({
    id: idSchema,
    nombre: textoCorto,
    apellido: textoCorto,
    email: emailSchema,
    telefono: telefonoSchema.nullable(),
    cargo: textoCorto.nullable(),
    rol: rolSchema,
    activo: z.boolean(),
    /** Solo sus clientes asignados, o toda la cartera. */
    veTodosLosClientes: z.boolean(),
    /** Obligatorio para dirección y responsable; ver `apps/api/src/seguridad`. */
    segundoFactorActivo: z.boolean(),
    ultimoAccesoEn: z.coerce.date().nullable(),
  })
  .merge(auditoriaSchema)
  .strict();
export type Usuario = z.infer<typeof usuarioSchema>;

/**
 * Lo que la API devuelve de un usuario.
 *
 * Nunca incluye el hash de contraseña ni el secreto TOTP. No es por omisión:
 * el esquema los excluye para que un `select *` accidental en una consulta no
 * termine serializando credenciales en una respuesta.
 */
export const usuarioPublicoSchema = usuarioSchema.omit({
  creadoPorUsuarioId: true,
  actualizadoPorUsuarioId: true,
  origen: true,
});

export const crearUsuarioSchema = z
  .object({
    nombre: textoCorto,
    apellido: textoCorto,
    email: emailSchema,
    telefono: telefonoSchema.nullable().default(null),
    cargo: textoCorto.nullable().default(null),
    rol: rolSchema,
    veTodosLosClientes: z.boolean().default(false),
    clientesAsignados: z.array(idSchema).default([]),
  })
  .strict();

export const actualizarUsuarioSchema = crearUsuarioSchema.partial().strict();

/* ========================================================================== */
/* Clientes                                                                   */
/* ========================================================================== */

export const clienteSchema = z
  .object({
    id: idSchema,
    nombre: textoCorto,
    ruc: rucSchema,
    tipoPersona: z.enum(['FISICA', 'JURIDICA']),
    regimenTributario: textoCorto.nullable(),
    email: emailSchema.nullable(),
    telefono: telefonoSchema.nullable(),
    canalPreferido: canalRecepcionSchema.nullable(),
    responsableId: idSchema.nullable(),
    coordinadorId: idSchema.nullable(),
    auxiliarId: idSchema.nullable(),
    revisorBalanceId: idSchema.nullable(),
    carpetaOneDriveId: z.string().max(200).nullable(),
    activo: z.boolean(),
    observaciones: textoOpcional,
  })
  .merge(auditoriaSchema)
  .strict();
export type Cliente = z.infer<typeof clienteSchema>;

export const crearClienteSchema = clienteSchema
  .omit({
    id: true,
    creadoEn: true,
    creadoPorUsuarioId: true,
    actualizadoEn: true,
    actualizadoPorUsuarioId: true,
    origen: true,
  })
  .strict();

export const actualizarClienteSchema = crearClienteSchema.partial().strict();

/* ========================================================================== */
/* Obligaciones                                                               */
/* ========================================================================== */

export const obligacionSchema = z
  .object({
    id: idSchema,
    nombre: textoCorto,
    tipo: z.enum(['TRIBUTARIA', 'CONTABLE', 'SOCIETARIA', 'LEGAL', 'MUNICIPAL', 'PREVISIONAL']),
    entidad: textoCorto,
    periodicidad: z.enum(['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICA']),
    requiereDocumentos: z.boolean(),
    requierePresentacion: z.boolean(),
    requiereLiquidacion: z.boolean(),
    requiereBalance: z.boolean(),
    /** Umbrales de aviso propios, en días. Vacío usa los del sistema. */
    diasAlerta: z.array(z.number().int().min(0).max(365)).max(6),
    responsableDefectoId: idSchema.nullable(),
    riesgoSiIncumple: textoLargo,
    activa: z.boolean(),
  })
  .merge(auditoriaSchema)
  .strict();

/* ========================================================================== */
/* Reglas impositivas                                                         */
/* ========================================================================== */

/**
 * Las tasas de IVA viven acá, no en el código.
 *
 * `requiereConfirmacionCliente` queda en true hasta que EFFORT contraste el
 * cálculo contra una liquidación real ya presentada. Ver docs/DISCREPANCIAS.md.
 */
export const reglaImpositivaSchema = z
  .object({
    id: idSchema,
    nombre: textoCorto,
    tasa: tasaIvaSchema,
    /** Divisor que despeja el impuesto de un total que ya lo incluye. */
    divisorIvaIncluido: z.number().int().positive().nullable(),
    vigenteDesde: fechaIsoSchema,
    vigenteHasta: fechaIsoSchema.nullable(),
    requiereConfirmacionCliente: z.boolean(),
    fuente: textoLargo,
  })
  .merge(auditoriaSchema)
  .strict();

/* ========================================================================== */
/* Documentos y evidencias                                                    */
/* ========================================================================== */

export const documentoSchema = z
  .object({
    id: idSchema,
    clienteId: idSchema,
    periodo: periodoSchema,
    tipo: tipoDocumentoSchema,
    canalRecepcion: canalRecepcionSchema,
    recibidoEn: z.coerce.date(),
    /* Identidad del comprobante. Nula en documentos que no son comprobantes. */
    rucEmisor: z.string().max(20).nullable(),
    timbrado: z.string().max(20).nullable(),
    numeroComprobante: z.string().max(30).nullable(),
    total: guaraniesSchema.nullable(),
    tasa: tasaIvaSchema.nullable(),
    anulado: z.boolean(),
    estado: z.enum(['RECIBIDO', 'OBSERVADO', 'RECHAZADO', 'DUPLICADO', 'CARGADO_EN_SIGA']),
    motivoRechazo: textoOpcional,
    evidenciaId: idSchema.nullable(),
    observaciones: textoOpcional,
  })
  .merge(auditoriaSchema)
  .strict();

/**
 * Archivo respaldatorio guardado en OneDrive.
 *
 * `sha256` es lo que da idempotencia a la importación: el mismo archivo subido
 * dos veces no genera dos registros. Y es lo que permite demostrar, meses
 * después, que el archivo que se está mirando es el que se recibió.
 */
export const evidenciaSchema = z
  .object({
    id: idSchema,
    clienteId: idSchema.nullable(),
    periodo: periodoSchema.nullable(),
    nombreArchivo: textoCorto,
    rutaOneDrive: z.string().max(1000),
    itemIdOneDrive: z.string().max(200).nullable(),
    tipoMime: z.string().max(120),
    tamanoBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Hash sha256 inválido.'),
    /** Copia de respaldo en el OneDrive espejo. */
    respaldadoEn: z.coerce.date().nullable(),
    subidoPorUsuarioId: idSchema,
  })
  .merge(auditoriaSchema)
  .strict();

/* ========================================================================== */
/* Proceso mensual                                                            */
/* ========================================================================== */

export const procesoMensualSchema = z
  .object({
    id: idSchema,
    clienteId: idSchema,
    periodo: periodoSchema,
    responsableId: idSchema.nullable(),
    comprobantesRetirados: z.boolean(),
    fechaRetiro: fechaIsoSchema.nullable(),
    documentosRecibidos: z.number().int().nonnegative(),
    documentosFaltantes: z.number().int().nonnegative(),
    documentosObservados: z.number().int().nonnegative(),
    comprasCargadasSiga: z.boolean(),
    ventasCargadasSiga: z.boolean(),
    retencionesCargadas: z.boolean(),
    extractosRecibidos: z.boolean(),
    conciliacionBancariaRealizada: z.boolean(),
    ivaRevisado: z.boolean(),
    ivaSaldoAPagar: guaraniesSchema.nullable(),
    ivaSaldoAFavor: guaraniesSchema.nullable(),
    liquidacionGenerada: z.boolean(),
    liquidacionEnviada: z.boolean(),
    balanceAplica: z.boolean(),
    estadoGeneral: estadoGeneralSchema,
    riesgo: nivelRiesgoSchema,
    proximaAccion: textoOpcional,
    fechaLimiteInterna: fechaIsoSchema.nullable(),
    observaciones: textoOpcional,
  })
  .merge(auditoriaSchema)
  .strict();

/* ========================================================================== */
/* Vencimientos                                                               */
/* ========================================================================== */

export const vencimientoSchema = z
  .object({
    id: idSchema,
    clienteId: idSchema,
    obligacionId: idSchema.nullable(),
    tipoDocumento: tipoDocumentoSchema,
    descripcion: textoCorto,
    entidad: textoCorto,
    fechaEmision: fechaIsoSchema.nullable(),
    fechaVencimiento: fechaIsoSchema,
    fechaPresentacion: fechaIsoSchema.nullable(),
    responsableId: idSchema.nullable(),
    estado: z.enum(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'PRESENTADO', 'NO_APLICA']),
    riesgo: nivelRiesgoSchema,
    evidenciaId: idSchema.nullable(),
    proximaAccion: textoOpcional,
  })
  .merge(auditoriaSchema)
  .strict();

/* ========================================================================== */
/* Seguimiento al cliente                                                     */
/* ========================================================================== */

export const destinatarioSchema = z
  .object({
    tipo: z.enum([
      'CLIENTE',
      'RESPONSABLE_DEL_CLIENTE',
      'COORDINADOR_DEL_CLIENTE',
      'ROL',
      'USUARIO',
      'CORREO_LIBRE',
    ]),
    valor: z.string().max(254).nullable(),
  })
  .strict()
  .refine(
    (destinatario) =>
      !['ROL', 'USUARIO', 'CORREO_LIBRE'].includes(destinatario.tipo) || Boolean(destinatario.valor),
    'Los destinatarios de tipo ROL, USUARIO y CORREO_LIBRE requieren un valor.',
  );

export const reglaNotificacionSchema = z
  .object({
    id: idSchema,
    nombre: textoCorto,
    activa: z.boolean(),
    evento: z.enum([
      'DOCUMENTACION_NO_ENTREGADA',
      'VENCIMIENTO_PROXIMO',
      'BALANCE_OBSERVADO',
      'BALANCE_LISTO_PARA_REVISION',
      'LIQUIDACION_NO_ENVIADA',
      'LIQUIDACION_SIN_CONFIRMAR',
      'DIFERENCIAS_CON_SIGA',
      'CLIENTE_SIN_RESPUESTA',
    ]),
    diasHabilesDePlazo: z.number().int().min(0).max(60),
    horaDeEnvio: horaSchema,
    reintentarCadaDiasHabiles: z.number().int().min(1).max(60),
    maximoRecordatorios: z.number().int().min(1).max(20),
    escalarAPartirDelRecordatorio: z.number().int().min(1).max(20),
    destinatariosIniciales: z.array(destinatarioSchema).min(1),
    destinatariosDeEscalamiento: z.array(destinatarioSchema),
    plantillaId: idSchema,
    /** Vacío aplica a toda la cartera; con ids, solo a esos clientes. */
    clientesAlcanzados: z.array(idSchema),
  })
  .merge(auditoriaSchema)
  .strict();

export const crearReglaNotificacionSchema = reglaNotificacionSchema
  .omit({
    id: true,
    creadoEn: true,
    creadoPorUsuarioId: true,
    actualizadoEn: true,
    actualizadoPorUsuarioId: true,
    origen: true,
  })
  .strict();

export const registroContactoSchema = z
  .object({
    id: idSchema,
    clienteId: idSchema,
    periodo: periodoSchema,
    solicitudId: idSchema.nullable(),
    canal: z.enum(['LLAMADA', 'MENSAJE', 'WHATSAPP', 'CORREO', 'PRESENCIAL']),
    direccion: z.enum(['SALIENTE', 'ENTRANTE']),
    origen: z.enum(['AUTOMATICO', 'MANUAL']),
    ocurridoEn: z.coerce.date(),
    registradoPorUsuarioId: idSchema,
    huboRespuesta: z.boolean(),
    quienAtendio: textoCorto.nullable(),
    resumen: textoLargo,
    evidenciaId: idSchema.nullable(),
  })
  .merge(auditoriaSchema)
  .strict();

/**
 * Alta de un contacto.
 *
 * Repite acá las dos reglas que `@effort/core` valida en el dominio, para que
 * un cuerpo inválido se rechace en el borde de la API con un 400 claro en vez
 * de llegar hasta el dominio y salir como error 500.
 */
export const crearRegistroContactoSchema = z
  .object({
    clienteId: idSchema,
    periodo: periodoSchema,
    solicitudId: idSchema.nullable().default(null),
    canal: z.enum(['LLAMADA', 'MENSAJE', 'WHATSAPP', 'CORREO', 'PRESENCIAL']),
    direccion: z.enum(['SALIENTE', 'ENTRANTE']).default('SALIENTE'),
    ocurridoEn: z.coerce.date(),
    huboRespuesta: z.boolean(),
    quienAtendio: textoCorto.nullable().default(null),
    resumen: textoLargo.min(1, 'Describí qué se habló: este registro es evidencia.'),
    evidenciaId: idSchema.nullable().default(null),
  })
  .strict()
  .refine(
    (contacto) => !contacto.huboRespuesta || Boolean(contacto.quienAtendio?.trim()),
    { message: 'Si hubo respuesta, indicá quién atendió.', path: ['quienAtendio'] },
  )
  .refine(
    (contacto) => contacto.huboRespuesta || !contacto.quienAtendio?.trim(),
    { message: 'Se indicó quién atendió pero el contacto figura sin respuesta.', path: ['quienAtendio'] },
  )
  .refine(
    (contacto) => contacto.ocurridoEn.getTime() <= Date.now() + 60_000,
    { message: 'Un contacto no puede registrarse con fecha futura.', path: ['ocurridoEn'] },
  );

/* ========================================================================== */
/* Registro de eventos                                                        */
/* ========================================================================== */

/**
 * Bitácora inmutable. Se escribe, nunca se modifica ni se borra: la base tiene
 * un disparador que rechaza UPDATE y DELETE sobre esta tabla.
 *
 * `datosAntes` y `datosDespues` guardan el cambio, no la fila entera, y pasan
 * por un filtro que quita campos sensibles antes de persistirse.
 */
export const eventoSchema = z
  .object({
    id: idSchema,
    ocurridoEn: z.coerce.date(),
    usuarioId: idSchema.nullable(),
    accion: z.string().max(80),
    entidad: z.string().max(80),
    entidadId: z.string().max(80).nullable(),
    clienteId: idSchema.nullable(),
    datosAntes: z.unknown().nullable(),
    datosDespues: z.unknown().nullable(),
    /** Dirección IP truncada: ver `apps/api/src/seguridad/privacidad.ts`. */
    ipTruncada: z.string().max(45).nullable(),
    agenteUsuario: z.string().max(300).nullable(),
    peticionId: z.string().max(60).nullable(),
  })
  .strict();

export const origenSchema = origenRegistroSchema;
