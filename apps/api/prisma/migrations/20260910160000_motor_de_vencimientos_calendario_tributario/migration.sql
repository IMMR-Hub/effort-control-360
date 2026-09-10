-- Motor de vencimientos: catálogo de obligaciones tributarias y su calendario.
--
-- Hasta acá el sistema tenía la tabla `vencimiento` pero nada que la llenara:
-- había que cargar cada vencimiento a mano, uno por uno, por cliente y por mes.
-- Estas tablas son el dato que faltaba para poder generarlos.
--
-- `dias_por_terminacion_ruc` es un arreglo de diez enteros (posiciones 0 a 9):
-- el día del mes que le toca a cada terminación de RUC. Va como dato y no como
-- constante en el código porque la DNIT lo cambia por resolución.
--
-- Nada empieza a generarse solo por correr esta migración: no inserta ninguna
-- obligación. El calendario real lo confirma EFFORT antes de cargarse, y hasta
-- que `confirmada_por_effort` no sea true, el generador la ignora.

CREATE TYPE "Periodicidad" AS ENUM ('MENSUAL', 'ANUAL');

CREATE TABLE "obligacion_tributaria" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "entidad" VARCHAR(200) NOT NULL,
    "formulario" VARCHAR(40),
    "periodicidad" "Periodicidad" NOT NULL,
    "mes_de_cierre_anual" INTEGER,
    "dias_por_terminacion_ruc" INTEGER[],
    "confirmada_por_effort" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fuente" VARCHAR(4000) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "obligacion_tributaria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obligacion_tributaria_codigo_key" ON "obligacion_tributaria"("codigo");

CREATE TABLE "obligacion_de_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "obligacion_id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_usuario_id" UUID,
    "origen" "Origen" NOT NULL DEFAULT 'REAL',

    CONSTRAINT "obligacion_de_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obligacion_de_cliente_cliente_id_obligacion_id_key"
    ON "obligacion_de_cliente"("cliente_id", "obligacion_id");
CREATE INDEX "obligacion_de_cliente_cliente_id_idx" ON "obligacion_de_cliente"("cliente_id");

ALTER TABLE "obligacion_de_cliente"
    ADD CONSTRAINT "obligacion_de_cliente_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obligacion_de_cliente"
    ADD CONSTRAINT "obligacion_de_cliente_obligacion_id_fkey"
    FOREIGN KEY ("obligacion_id") REFERENCES "obligacion_tributaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo que vuelve idempotente a la generación. En Postgres un NULL nunca colisiona
-- con otro NULL en un índice único, así que los vencimientos cargados a mano
-- (obligacion_id y periodo nulos) quedan fuera de la restricción y se pueden
-- repetir libremente. Mismo criterio que ya usa `documento`.
ALTER TABLE "vencimiento" ADD COLUMN "obligacion_id" UUID;
ALTER TABLE "vencimiento" ADD COLUMN "periodo" VARCHAR(7);

ALTER TABLE "vencimiento"
    ADD CONSTRAINT "vencimiento_obligacion_id_fkey"
    FOREIGN KEY ("obligacion_id") REFERENCES "obligacion_tributaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "vencimiento_cliente_id_obligacion_id_periodo_key"
    ON "vencimiento"("cliente_id", "obligacion_id", "periodo");

-- Las tablas nuevas nacen con RLS activo y la misma política permisiva que el
-- resto: sin esto, `effort_app` no lee ni una fila y lo hace en silencio, sin
-- error. Ver docs/DISCREPANCIAS.md, puntos 7 y 8.
ALTER TABLE "obligacion_tributaria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligacion_de_cliente" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "obligacion_tributaria" TO effort_app;
    GRANT SELECT, INSERT, UPDATE ON "obligacion_de_cliente" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "obligacion_tributaria";
    CREATE POLICY app_acceso ON "obligacion_tributaria"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS app_acceso ON "obligacion_de_cliente";
    CREATE POLICY app_acceso ON "obligacion_de_cliente"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
