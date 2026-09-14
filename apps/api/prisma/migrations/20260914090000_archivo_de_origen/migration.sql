-- Registro de qué archivos del origen ya se miraron.
--
-- Existe por un bug que dejó la sincronización en un bucle infinito el
-- 2026-09-14: corrió 73 veces seguidas sin crear un solo documento, y cuatro de
-- los cinco clientes quedaron en cero.
--
-- LA CAUSA. `evidencia` guarda UN solo `item_id_origen`, y la unicidad de la
-- tabla es por `sha256` — o sea, por CONTENIDO. Cuando cinco archivos distintos
-- del OneDrive de EFFORT tienen el mismo contenido (el mismo PDF copiado en
-- cinco carpetas de período, que es lo normal en su forma de trabajar), los
-- cinco colapsan en una sola evidencia y solo el último queda anotado. Los otros
-- cuatro nunca se marcan, así que la corrida siguiente los vuelve a bajar. Y la
-- siguiente. Para siempre.
--
-- El comentario del repositorio decía "se le anota de dónde vino para no volver
-- a descargarlo nunca más". Era cierto para un archivo y falso para cinco.
--
-- LA CORRECCIÓN. Un archivo del origen y una evidencia son cosas distintas:
-- muchos archivos pueden tener el mismo contenido. Esta tabla guarda esa
-- relación de muchos a uno, que es la que faltaba. Ahora "ya lo miré" se
-- responde por archivo, no por contenido.
CREATE TABLE "archivo_de_origen" (
  "id"                   UUID           NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"           UUID           NOT NULL,
  -- Identificador del archivo en el drive de EFFORT. Sobrevive a que lo renombren.
  "item_id_origen"       VARCHAR(200)   NOT NULL,
  -- Fecha de modificación en el origen: si cambia, hay que volver a bajarlo.
  "modificado_en_origen" TIMESTAMPTZ(3),
  -- A qué evidencia corresponde su contenido. Varios archivos, una evidencia.
  "evidencia_id"         UUID           NOT NULL,
  "visto_en"             TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "archivo_de_origen_pkey" PRIMARY KEY ("id")
);

-- Un archivo del origen se registra una sola vez por cliente. Volver a
-- sincronizar actualiza su fecha, no agrega una fila.
CREATE UNIQUE INDEX "archivo_de_origen_unico"
  ON "archivo_de_origen" ("cliente_id", "item_id_origen");
CREATE INDEX "archivo_de_origen_evidencia_idx"
  ON "archivo_de_origen" ("evidencia_id");

ALTER TABLE "archivo_de_origen"
  ADD CONSTRAINT "archivo_de_origen_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "archivo_de_origen"
  ADD CONSTRAINT "archivo_de_origen_evidencia_id_fkey"
  FOREIGN KEY ("evidencia_id") REFERENCES "evidencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo ya marcado en `evidencia` se trae para no volver a bajar 1.167 archivos que
-- ya están. Es una fila por evidencia, que es exactamente la información que
-- había: la que se perdía eran las repeticiones, y esas no se pueden recuperar
-- sin volver a mirarlas.
INSERT INTO "archivo_de_origen" ("cliente_id", "item_id_origen", "modificado_en_origen", "evidencia_id")
SELECT "cliente_id", "item_id_origen", "modificado_en_origen", "id"
FROM "evidencia"
WHERE "item_id_origen" IS NOT NULL AND "cliente_id" IS NOT NULL
ON CONFLICT ("cliente_id", "item_id_origen") DO NOTHING;

-- RLS como el resto: sin política, `effort_app` no lee ni una fila y lo hace en
-- silencio. Ver docs/DISCREPANCIAS.md, puntos 7 y 8.
ALTER TABLE "archivo_de_origen" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "archivo_de_origen" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "archivo_de_origen";
    CREATE POLICY app_acceso ON "archivo_de_origen"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
