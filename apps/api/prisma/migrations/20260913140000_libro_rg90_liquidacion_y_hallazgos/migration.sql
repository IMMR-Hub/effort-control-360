-- Libro RG 90: dónde se guardan el IVA calculado y los hallazgos.
--
-- Escrita a mano, como el resto de las migraciones de este proyecto. El intento
-- de generarla con `prisma migrate diff` fue lo que borró la base el
-- 2026-09-13: ese comando resetea la base que recibe como shadow database.
--
-- Las dos tablas cierran la cadena que faltaba. Hasta acá el sistema podía leer
-- las planillas RG 90 y calcular IVA crédito y débito, pero el resultado se
-- perdía al terminar el proceso: no se guardaba en ningún lado y por lo tanto
-- no se podía mostrar ni alertar sobre él.

-- IVA de un cliente en un período, calculado desde las planillas que EFFORT ya
-- presentó. Reemplaza a cargar los saldos a mano en `proceso_mensual`: acá cada
-- cifra se puede rastrear hasta el comprobante que la originó.
CREATE TABLE "liquidacion_iva_rg90" (
  "id"                       UUID         NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"               UUID         NOT NULL,
  "periodo"                  VARCHAR(7)   NOT NULL,

  "credito_fiscal"           BIGINT       NOT NULL,
  "debito_fiscal"            BIGINT       NOT NULL,
  "saldo_a_pagar"            BIGINT       NOT NULL,
  "saldo_a_favor"            BIGINT       NOT NULL,

  "comprobantes_compras"     INTEGER      NOT NULL,
  "comprobantes_ventas"      INTEGER      NOT NULL,

  "gravado_10_compras"       BIGINT       NOT NULL,
  "gravado_5_compras"        BIGINT       NOT NULL,
  "exento_compras"           BIGINT       NOT NULL,
  "gravado_10_ventas"        BIGINT       NOT NULL,
  "gravado_5_ventas"         BIGINT       NOT NULL,
  "exento_ventas"            BIGINT       NOT NULL,

  "archivos_leidos"          INTEGER      NOT NULL,
  "filas_rechazadas"         INTEGER      NOT NULL,

  "calculado_en"             TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "calculado_por_usuario_id" UUID,

  CONSTRAINT "liquidacion_iva_rg90_pkey" PRIMARY KEY ("id")
);

-- Una sola liquidación por cliente y período: volver a importar el mismo
-- período la reemplaza, no la duplica.
CREATE UNIQUE INDEX "liquidacion_iva_rg90_cliente_id_periodo_key"
  ON "liquidacion_iva_rg90" ("cliente_id", "periodo");
CREATE INDEX "liquidacion_iva_rg90_periodo_idx"
  ON "liquidacion_iva_rg90" ("periodo");

ALTER TABLE "liquidacion_iva_rg90"
  ADD CONSTRAINT "liquidacion_iva_rg90_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Algo que hay que mirar en un libro antes de presentarlo.
--
-- Existe por una corrección de Daniel del 2026-09-12: las diferencias de IVA
-- "también tienen que alertar, ya que al final puede representar una multa
-- administrativa". Sobre los datos reales del piloto aparecieron 166.
CREATE TABLE "hallazgo_libro_rg90" (
  "id"                 UUID           NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"         UUID           NOT NULL,
  "periodo"            VARCHAR(7)     NOT NULL,

  -- IVA_DECLARADO_NO_COINCIDE | PARTES_NO_SUMAN_EL_TOTAL
  "tipo"               VARCHAR(40)    NOT NULL,
  -- CREDITO_DE_MAS | DEBITO_DE_MENOS | EN_CONTRA_DEL_CLIENTE | INCONSISTENCIA
  "riesgo"             VARCHAR(30)    NOT NULL,

  "tipo_registro"      VARCHAR(10)    NOT NULL,
  "numero_comprobante" VARCHAR(30)    NOT NULL,
  "contraparte"        VARCHAR(300)   NOT NULL,
  "tasa"               VARCHAR(5),

  "declarado"          BIGINT         NOT NULL,
  "calculado"          BIGINT         NOT NULL,
  "diferencia"         BIGINT         NOT NULL,
  "detalle"            VARCHAR(1000)  NOT NULL,

  "detectado_en"       TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "hallazgo_libro_rg90_pkey" PRIMARY KEY ("id")
);

-- Idempotencia: volver a importar el mismo libro no duplica hallazgos.
-- `tasa` es nula en los que no son de una tasa puntual, y en Postgres un NULL
-- nunca colisiona — mismo criterio que ya usan `documento` y `vencimiento`.
CREATE UNIQUE INDEX "hallazgo_libro_unico"
  ON "hallazgo_libro_rg90" ("cliente_id", "periodo", "numero_comprobante", "tipo", "tasa");
CREATE INDEX "hallazgo_libro_rg90_cliente_id_periodo_idx"
  ON "hallazgo_libro_rg90" ("cliente_id", "periodo");
CREATE INDEX "hallazgo_libro_rg90_riesgo_idx"
  ON "hallazgo_libro_rg90" ("riesgo");

ALTER TABLE "hallazgo_libro_rg90"
  ADD CONSTRAINT "hallazgo_libro_rg90_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las tablas nuevas nacen con RLS activo y la misma política permisiva que el
-- resto: sin esto, `effort_app` no lee ni una fila y lo hace en silencio, sin
-- error. Ver docs/DISCREPANCIAS.md, puntos 7 y 8.
ALTER TABLE "liquidacion_iva_rg90" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hallazgo_libro_rg90" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "liquidacion_iva_rg90" TO effort_app;
    GRANT SELECT, INSERT, UPDATE ON "hallazgo_libro_rg90" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "liquidacion_iva_rg90";
    CREATE POLICY app_acceso ON "liquidacion_iva_rg90"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS app_acceso ON "hallazgo_libro_rg90";
    CREATE POLICY app_acceso ON "hallazgo_libro_rg90"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
