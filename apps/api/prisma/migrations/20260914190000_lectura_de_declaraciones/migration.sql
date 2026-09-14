-- Qué PDFs del OneDrive ya se leyeron buscando presentaciones ante la DNIT, y
-- qué se encontró en cada uno.
--
-- Daniel, 2026-09-14: "¿por qué tenés 0 de 150? ¿No encontraste los documentos
-- de que se presentó?". Estaban: la sincronización había traído las
-- declaraciones juradas y los talones de la RG 90. Nada los cruzaba con los
-- vencimientos, y el motor avisaba "vencido sin presentar" de lo presentado.
--
-- Por qué una tabla y no leer los PDFs en cada corrida: son miles, cada uno hay
-- que bajarlo de OneDrive, y el contenedor tiene 512 MB. Un PDF se lee UNA vez;
-- lo que dice no cambia. Una fila con todo en NULL también es información:
-- "este PDF se miró y no es una presentación", y no hay que volver a bajarlo.
--
-- SOLO CREA UNA TABLA NUEVA. No toca datos existentes.

CREATE TABLE "lectura_de_declaracion" (
  "evidencia_id"          UUID           NOT NULL,
  "cliente_id"            UUID           NOT NULL,

  -- Todo NULL cuando el PDF no es una presentación reconocible.
  -- 120 IVA, 500 IRE, 158 estados financieros, 241 talón de la RG 90.
  "formulario"            VARCHAR(5),
  -- RUC que figura en el formulario, sin dígito verificador. Se compara con el
  -- del cliente: en una carpeta puede haber declaraciones de otra persona.
  "ruc"                   VARCHAR(15),
  "periodo"               VARCHAR(7),
  "numero_de_orden"       VARCHAR(20),
  "fecha_de_presentacion" DATE,

  -- Si el PDF no se pudo leer (roto, cifrado): se guarda para no reintentar
  -- para siempre, y para que se vea.
  "error"                 VARCHAR(200),
  "leida_en"              TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "lectura_de_declaracion_pkey" PRIMARY KEY ("evidencia_id")
);

CREATE INDEX "lectura_de_declaracion_cliente_formulario_periodo_idx"
  ON "lectura_de_declaracion" ("cliente_id", "formulario", "periodo");

ALTER TABLE "lectura_de_declaracion"
  ADD CONSTRAINT "lectura_de_declaracion_evidencia_id_fkey"
  FOREIGN KEY ("evidencia_id") REFERENCES "evidencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lectura_de_declaracion"
  ADD CONSTRAINT "lectura_de_declaracion_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS como el resto: sin política, `effort_app` no lee ni una fila y lo hace en
-- silencio. Ver docs/DISCREPANCIAS.md, puntos 7 y 8.
ALTER TABLE "lectura_de_declaracion" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "lectura_de_declaracion" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "lectura_de_declaracion";
    CREATE POLICY app_acceso ON "lectura_de_declaracion"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
