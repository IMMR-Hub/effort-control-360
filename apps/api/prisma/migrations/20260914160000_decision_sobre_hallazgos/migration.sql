-- Decisión humana sobre cada hallazgo del libro RG 90: aceptarlo o mandarlo a revisar.
--
-- Daniel, 2026-09-14: "mejor alertar a partir de 1 guaraní a partir de ahora, y
-- que luego puedan aceptar o revisar". Esto reemplaza la tolerancia de 5 Gs que
-- se había aplicado ese mismo día con la respuesta de Lili y Laura: en vez de que
-- el sistema decida qué diferencia es aceptable, avisa de todas y decide una
-- persona, con nombre, fecha y motivo.
--
-- No es un "ignorar". Daniel pidió el 2026-09-11 que ninguna alerta se pueda
-- ignorar, y esto lo respeta: aceptar es un acto registrado —como aprobar un
-- balance (ADR 0004)— que queda en la bitácora y se puede auditar después.
--
-- SOLO AGREGA COLUMNAS. No borra ni modifica ninguna fila existente: todas
-- arrancan en PENDIENTE, que es exactamente su estado real hoy.

ALTER TABLE "hallazgo_libro_rg90"
  -- PENDIENTE: nadie lo miró. EN_REVISION: alguien lo está revisando, sigue
  -- alertando. ACEPTADO: una persona decidió que está bien y dejó el motivo.
  ADD COLUMN "estado"                  VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "decidido_por_usuario_id" UUID,
  ADD COLUMN "decidido_en"             TIMESTAMPTZ(3),
  ADD COLUMN "nota_decision"           VARCHAR(500);

ALTER TABLE "hallazgo_libro_rg90"
  ADD CONSTRAINT "hallazgo_libro_rg90_estado_valido"
  CHECK ("estado" IN ('PENDIENTE', 'EN_REVISION', 'ACEPTADO'));

-- Aceptar sin decir por qué no es una decisión, es un clic. La base lo exige
-- además de la ruta: una regla que solo vive en la API se saltea con un script.
ALTER TABLE "hallazgo_libro_rg90"
  ADD CONSTRAINT "hallazgo_libro_rg90_aceptado_con_motivo"
  CHECK ("estado" <> 'ACEPTADO' OR ("nota_decision" IS NOT NULL AND "decidido_por_usuario_id" IS NOT NULL));

ALTER TABLE "hallazgo_libro_rg90"
  ADD CONSTRAINT "hallazgo_libro_rg90_decidido_por_fkey"
  FOREIGN KEY ("decidido_por_usuario_id") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hallazgo_libro_rg90_estado_idx" ON "hallazgo_libro_rg90" ("estado");
