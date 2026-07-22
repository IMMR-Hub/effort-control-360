-- CreateEnum
CREATE TYPE "TipoReporteSiga" AS ENUM ('LIBRO_COMPRAS', 'LIBRO_VENTAS', 'DETERMINACION_IVA', 'COMPROBANTES_CARGADOS', 'RETENCIONES', 'MAYOR_CONTABLE', 'SUMAS_Y_SALDOS', 'BALANCE_GENERAL', 'ESTADO_RESULTADOS', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoRevisionSiga" AS ENUM ('IMPORTADA', 'EN_REVISION', 'CONCILIADA', 'CON_DIFERENCIAS');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('PENDIENTE', 'GENERADA', 'ENVIADA', 'RECLAMADA', 'RESPONDIDA', 'CONFIRMADA');

-- CreateEnum
CREATE TYPE "Criticidad" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'INFORMATIVA');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ABIERTA', 'EN_CURSO', 'CERRADA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "exportacion_siga" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "tipo_reporte" "TipoReporteSiga" NOT NULL,
    "formato" VARCHAR(10) NOT NULL,
    "evidencia_id" UUID,
    "importada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filas_leidas" INTEGER NOT NULL DEFAULT 0,
    "estado_revision" "EstadoRevisionSiga" NOT NULL DEFAULT 'IMPORTADA',
    "proxima_accion" VARCHAR(4000),
    "observaciones" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "exportacion_siga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante_siga" (
    "id" UUID NOT NULL,
    "exportacion_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "ruc_emisor" VARCHAR(20) NOT NULL,
    "timbrado" VARCHAR(20) NOT NULL,
    "numero_comprobante" VARCHAR(30) NOT NULL,
    "total" BIGINT NOT NULL,
    "tasa" "TasaIva" NOT NULL,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "fecha" DATE NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "Origen" NOT NULL DEFAULT 'IMPORTADO',

    CONSTRAINT "comprobante_siga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "archivo_evidencia_id" UUID,
    "destinatario" VARCHAR(254),
    "canal" VARCHAR(30),
    "fecha_envio" TIMESTAMPTZ(3),
    "evidencia_envio_id" UUID,
    "responsable_id" UUID,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'PENDIENTE',
    "respuesta_cliente" VARCHAR(4000),
    "respondida_en" TIMESTAMPTZ(3),
    "proxima_accion" VARCHAR(4000),
    "observaciones" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL,
    "cliente_id" UUID,
    "periodo" VARCHAR(7),
    "origen" VARCHAR(60) NOT NULL,
    "criticidad" "Criticidad" NOT NULL,
    "titulo" VARCHAR(300) NOT NULL,
    "detalle" VARCHAR(4000) NOT NULL,
    "entidad_relacionada" VARCHAR(60),
    "entidad_relacionada_id" UUID,
    "responsable_id" UUID,
    "fecha_limite" DATE,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ABIERTA',
    "cerrada_por_usuario_id" UUID,
    "cerrada_en" TIMESTAMPTZ(3),
    "motivo_cierre" VARCHAR(4000),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen_registro" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exportacion_siga_cliente_id_periodo_idx" ON "exportacion_siga"("cliente_id", "periodo");

-- CreateIndex
CREATE INDEX "comprobante_siga_cliente_id_periodo_idx" ON "comprobante_siga"("cliente_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_siga_cliente_id_periodo_ruc_emisor_timbrado_num_key" ON "comprobante_siga"("cliente_id", "periodo", "ruc_emisor", "timbrado", "numero_comprobante");

-- CreateIndex
CREATE INDEX "liquidacion_estado_idx" ON "liquidacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_cliente_id_periodo_tipo_key" ON "liquidacion"("cliente_id", "periodo", "tipo");

-- CreateIndex
CREATE INDEX "alerta_estado_criticidad_idx" ON "alerta"("estado", "criticidad");

-- CreateIndex
CREATE INDEX "alerta_cliente_id_estado_idx" ON "alerta"("cliente_id", "estado");

-- AddForeignKey
ALTER TABLE "exportacion_siga" ADD CONSTRAINT "exportacion_siga_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_siga" ADD CONSTRAINT "comprobante_siga_exportacion_id_fkey" FOREIGN KEY ("exportacion_id") REFERENCES "exportacion_siga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
