-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('direccion', 'responsable', 'coordinador', 'auxiliar', 'revisor_balance', 'solo_lectura');

-- CreateEnum
CREATE TYPE "Origen" AS ENUM ('REAL', 'SEMILLA', 'IMPORTADO');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "RolEnCliente" AS ENUM ('responsable', 'coordinador', 'auxiliar', 'revisor_balance');

-- CreateEnum
CREATE TYPE "TasaIva" AS ENUM ('DIEZ', 'CINCO', 'EXENTA');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('RECIBIDO', 'OBSERVADO', 'RECHAZADO', 'DUPLICADO', 'CARGADO_EN_SIGA');

-- CreateEnum
CREATE TYPE "EstadoGeneral" AS ENUM ('COMPLETO', 'PARCIAL', 'PENDIENTE', 'OBSERVADO', 'CRITICO');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "EstadoBalance" AS ENUM ('NO_APLICA', 'PENDIENTE', 'EN_PREPARACION', 'OBSERVADO', 'LISTO_PARA_REVISION', 'EN_REVISION', 'APROBADO');

-- CreateEnum
CREATE TYPE "EstadoVencimiento" AS ENUM ('VIGENTE', 'POR_VENCER', 'VENCIDO', 'PRESENTADO', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('ABIERTA', 'RESPONDIDA_SIN_ENTREGA', 'ENTREGADA', 'ESCALADA', 'AGOTADA', 'CERRADA_MANUALMENTE');

-- CreateEnum
CREATE TYPE "CanalContacto" AS ENUM ('LLAMADA', 'MENSAJE', 'WHATSAPP', 'CORREO', 'PRESENCIAL');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "apellido" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "telefono" VARCHAR(25),
    "cargo" VARCHAR(200),
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ve_todos_los_clientes" BOOLEAN NOT NULL DEFAULT false,
    "hash_contrasena" VARCHAR(255) NOT NULL,
    "contrasena_actualizada_en" TIMESTAMPTZ(3),
    "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT true,
    "secreto_totp" VARCHAR(64),
    "segundo_factor_activo" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_acceso_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_recuperacion" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "hash" VARCHAR(255) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL,
    "hash_del_token" VARCHAR(64) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocada_en" TIMESTAMPTZ(3),
    "motivo_revocacion" VARCHAR(120),
    "segundo_factor_superado" BOOLEAN NOT NULL DEFAULT false,
    "ip_truncada" VARCHAR(45),
    "agente_usuario" VARCHAR(300),

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "ruc" VARCHAR(20) NOT NULL,
    "tipo_persona" "TipoPersona" NOT NULL,
    "regimen_tributario" VARCHAR(200),
    "email" VARCHAR(254),
    "telefono" VARCHAR(25),
    "canal_preferido" VARCHAR(30),
    "carpeta_onedrive_id" VARCHAR(200),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" "RolEnCliente" NOT NULL,
    "desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMPTZ(3),

    CONSTRAINT "asignacion_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regla_impositiva" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "tasa" "TasaIva" NOT NULL,
    "divisor_iva_incluido" INTEGER,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "requiere_confirmacion_cliente" BOOLEAN NOT NULL DEFAULT true,
    "fuente" VARCHAR(4000) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,

    CONSTRAINT "regla_impositiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencia" (
    "id" UUID NOT NULL,
    "cliente_id" UUID,
    "periodo" VARCHAR(7),
    "nombre_archivo" VARCHAR(400) NOT NULL,
    "ruta_onedrive" VARCHAR(1000) NOT NULL,
    "item_id_onedrive" VARCHAR(200),
    "tipo_mime" VARCHAR(120) NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "respaldado_en" TIMESTAMPTZ(3),
    "subido_por_usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "canal_recepcion" VARCHAR(30) NOT NULL,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL,
    "ruc_emisor" VARCHAR(20),
    "timbrado" VARCHAR(20),
    "numero_comprobante" VARCHAR(30),
    "total" BIGINT,
    "tasa" "TasaIva",
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'RECIBIDO',
    "motivo_rechazo" VARCHAR(4000),
    "evidencia_id" UUID,
    "observaciones" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proceso_mensual" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "comprobantes_retirados" BOOLEAN NOT NULL DEFAULT false,
    "fecha_retiro" DATE,
    "documentos_recibidos" INTEGER NOT NULL DEFAULT 0,
    "documentos_faltantes" INTEGER NOT NULL DEFAULT 0,
    "documentos_observados" INTEGER NOT NULL DEFAULT 0,
    "compras_cargadas_siga" BOOLEAN NOT NULL DEFAULT false,
    "ventas_cargadas_siga" BOOLEAN NOT NULL DEFAULT false,
    "retenciones_cargadas" BOOLEAN NOT NULL DEFAULT false,
    "extractos_recibidos" BOOLEAN NOT NULL DEFAULT false,
    "conciliacion_bancaria_realizada" BOOLEAN NOT NULL DEFAULT false,
    "iva_revisado" BOOLEAN NOT NULL DEFAULT false,
    "iva_saldo_a_pagar" BIGINT,
    "iva_saldo_a_favor" BIGINT,
    "liquidacion_generada" BOOLEAN NOT NULL DEFAULT false,
    "liquidacion_enviada" BOOLEAN NOT NULL DEFAULT false,
    "balance_aplica" BOOLEAN NOT NULL DEFAULT false,
    "estado_general" "EstadoGeneral" NOT NULL DEFAULT 'PENDIENTE',
    "riesgo" "NivelRiesgo" NOT NULL DEFAULT 'BAJO',
    "proxima_accion" VARCHAR(4000),
    "fecha_limite_interna" DATE,
    "observaciones" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "proceso_mensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "activo" BIGINT,
    "pasivo" BIGINT,
    "patrimonio_neto" BIGINT,
    "resultado_ejercicio" BIGINT,
    "estado" "EstadoBalance" NOT NULL DEFAULT 'PENDIENTE',
    "preparado_por_usuario_id" UUID,
    "aprobado_por_usuario_id" UUID,
    "aprobado_en" TIMESTAMPTZ(3),
    "inconsistencias" JSONB,
    "proxima_accion" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vencimiento" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "tipo_documento" VARCHAR(40) NOT NULL,
    "descripcion" VARCHAR(400) NOT NULL,
    "entidad" VARCHAR(200) NOT NULL,
    "fecha_emision" DATE,
    "fecha_vencimiento" DATE NOT NULL,
    "fecha_presentacion" DATE,
    "responsable_id" UUID,
    "estado" "EstadoVencimiento" NOT NULL DEFAULT 'VIGENTE',
    "riesgo" "NivelRiesgo" NOT NULL DEFAULT 'MEDIO',
    "evidencia_id" UUID,
    "proxima_accion" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "vencimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_documentacion" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'ABIERTA',
    "cuenta_desde" DATE NOT NULL,
    "recordatorios_enviados" INTEGER NOT NULL DEFAULT 0,
    "ultimo_recordatorio_en" DATE,
    "regla_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "solicitud_documentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regla_notificacion" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "evento" VARCHAR(60) NOT NULL,
    "dias_habiles_de_plazo" INTEGER NOT NULL,
    "hora_de_envio" VARCHAR(5) NOT NULL,
    "reintentar_cada_dias_habiles" INTEGER NOT NULL,
    "maximo_recordatorios" INTEGER NOT NULL,
    "escalar_a_partir_del_recordatorio" INTEGER NOT NULL,
    "destinatarios_iniciales" JSONB NOT NULL,
    "destinatarios_de_escalamiento" JSONB NOT NULL,
    "clientes_alcanzados" JSONB NOT NULL,
    "plantilla_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,

    CONSTRAINT "regla_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_contacto" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "solicitud_id" UUID,
    "canal" "CanalContacto" NOT NULL,
    "direccion" VARCHAR(10) NOT NULL,
    "origen_contacto" VARCHAR(12) NOT NULL,
    "ocurrido_en" TIMESTAMPTZ(3) NOT NULL,
    "registrado_por_usuario_id" UUID NOT NULL,
    "hubo_respuesta" BOOLEAN NOT NULL,
    "quien_atendio" VARCHAR(200),
    "resumen" VARCHAR(4000) NOT NULL,
    "evidencia_id" UUID,
    "corregido_por_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "registro_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envio_notificacion" (
    "id" UUID NOT NULL,
    "regla_id" UUID,
    "cliente_id" UUID,
    "solicitud_id" UUID,
    "destinatario" VARCHAR(254) NOT NULL,
    "asunto" VARCHAR(400) NOT NULL,
    "numero_de_recordatorio" INTEGER,
    "es_escalamiento" BOOLEAN NOT NULL DEFAULT false,
    "estado" VARCHAR(20) NOT NULL,
    "id_mensaje_proveedor" VARCHAR(200),
    "error_proveedor" VARCHAR(1000),
    "despachado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_log" (
    "id" UUID NOT NULL,
    "ocurrido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "accion" VARCHAR(80) NOT NULL,
    "entidad" VARCHAR(80) NOT NULL,
    "entidad_id" VARCHAR(80),
    "cliente_id" UUID,
    "datos_antes" JSONB,
    "datos_despues" JSONB,
    "ip_truncada" VARCHAR(45),
    "agente_usuario" VARCHAR(300),
    "peticion_id" VARCHAR(60),

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_email_idx" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_activo_rol_idx" ON "usuario"("activo", "rol");

-- CreateIndex
CREATE INDEX "codigo_recuperacion_usuario_id_idx" ON "codigo_recuperacion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_hash_del_token_key" ON "sesion"("hash_del_token");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_revocada_en_idx" ON "sesion"("usuario_id", "revocada_en");

-- CreateIndex
CREATE INDEX "sesion_ultimo_uso_en_idx" ON "sesion"("ultimo_uso_en");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_ruc_key" ON "cliente"("ruc");

-- CreateIndex
CREATE INDEX "cliente_activo_idx" ON "cliente"("activo");

-- CreateIndex
CREATE INDEX "asignacion_cliente_usuario_id_hasta_idx" ON "asignacion_cliente"("usuario_id", "hasta");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_cliente_cliente_id_usuario_id_rol_key" ON "asignacion_cliente"("cliente_id", "usuario_id", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "evidencia_sha256_key" ON "evidencia"("sha256");

-- CreateIndex
CREATE INDEX "evidencia_cliente_id_periodo_idx" ON "evidencia"("cliente_id", "periodo");

-- CreateIndex
CREATE INDEX "documento_cliente_id_periodo_idx" ON "documento"("cliente_id", "periodo");

-- CreateIndex
CREATE INDEX "documento_estado_idx" ON "documento"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "documento_cliente_id_ruc_emisor_timbrado_numero_comprobante_key" ON "documento"("cliente_id", "ruc_emisor", "timbrado", "numero_comprobante");

-- CreateIndex
CREATE INDEX "proceso_mensual_estado_general_riesgo_idx" ON "proceso_mensual"("estado_general", "riesgo");

-- CreateIndex
CREATE UNIQUE INDEX "proceso_mensual_cliente_id_periodo_key" ON "proceso_mensual"("cliente_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "balance_cliente_id_periodo_key" ON "balance"("cliente_id", "periodo");

-- CreateIndex
CREATE INDEX "vencimiento_fecha_vencimiento_estado_idx" ON "vencimiento"("fecha_vencimiento", "estado");

-- CreateIndex
CREATE INDEX "vencimiento_cliente_id_idx" ON "vencimiento"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_documentacion_cliente_id_periodo_key" ON "solicitud_documentacion"("cliente_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "registro_contacto_corregido_por_id_key" ON "registro_contacto"("corregido_por_id");

-- CreateIndex
CREATE INDEX "registro_contacto_cliente_id_periodo_idx" ON "registro_contacto"("cliente_id", "periodo");

-- CreateIndex
CREATE INDEX "registro_contacto_ocurrido_en_idx" ON "registro_contacto"("ocurrido_en");

-- CreateIndex
CREATE INDEX "envio_notificacion_cliente_id_creado_en_idx" ON "envio_notificacion"("cliente_id", "creado_en");

-- CreateIndex
CREATE INDEX "event_log_ocurrido_en_idx" ON "event_log"("ocurrido_en");

-- CreateIndex
CREATE INDEX "event_log_entidad_entidad_id_idx" ON "event_log"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "event_log_cliente_id_ocurrido_en_idx" ON "event_log"("cliente_id", "ocurrido_en");

-- CreateIndex
CREATE INDEX "event_log_usuario_id_ocurrido_en_idx" ON "event_log"("usuario_id", "ocurrido_en");

-- AddForeignKey
ALTER TABLE "codigo_recuperacion" ADD CONSTRAINT "codigo_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente" ADD CONSTRAINT "asignacion_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_cliente" ADD CONSTRAINT "asignacion_cliente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_evidencia_id_fkey" FOREIGN KEY ("evidencia_id") REFERENCES "evidencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso_mensual" ADD CONSTRAINT "proceso_mensual_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance" ADD CONSTRAINT "balance_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vencimiento" ADD CONSTRAINT "vencimiento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_documentacion" ADD CONSTRAINT "solicitud_documentacion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_contacto" ADD CONSTRAINT "registro_contacto_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_contacto" ADD CONSTRAINT "registro_contacto_registrado_por_usuario_id_fkey" FOREIGN KEY ("registrado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_contacto" ADD CONSTRAINT "registro_contacto_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_documentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
