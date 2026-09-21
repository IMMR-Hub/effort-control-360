-- Planilla diaria de horas (tarea 144).
--
-- Daniel, 2026-09-21: "medir finalmente cuánto le cuesta a EFFORT cada
-- cliente... controlar si solo 'trabajó' más horas o si realmente sus horas
-- fueron eficientes en base al avance de su trabajo". El "avance" ya existía
-- sin tocar el esquema: casi toda tabla del sistema atribuye sus acciones a
-- un usuario y a un cliente. Lo que faltaba era el otro lado de la cuenta —
-- cuánto TIEMPO le dedicó cada quien — y eso no se puede inferir de la
-- actividad en pantalla sin mentir, así que se autoreporta.
--
-- SOLO CREA UNA TABLA NUEVA. No toca datos existentes.

CREATE TABLE "registro_de_horas" (
  -- Sin default en la base: Prisma genera el UUID del lado del cliente
  -- (`@default(uuid())`), igual que el resto de las tablas del sistema.
  "id"             UUID           NOT NULL,
  "usuario_id"     UUID           NOT NULL,
  -- NULL es tiempo interno, no asignado a ningún cliente. Sin esta opción,
  -- alguien con tiempo administrativo lo carga contra un cliente cualquiera
  -- para que el total del día cierre, y el costo por cliente queda falso.
  "cliente_id"     UUID,
  "fecha"          DATE           NOT NULL,

  -- Minutos, no horas con decimales: mismo motivo que el dinero en enteros
  -- (ADR 0002) — sumar cientos de registros en el resumen no puede acumular
  -- redondeo flotante.
  "minutos"        INTEGER        NOT NULL,
  "tarea"          VARCHAR(400),

  "creado_en"      TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
  "origen"         "Origen"       NOT NULL DEFAULT 'REAL',

  CONSTRAINT "registro_de_horas_pkey" PRIMARY KEY ("id")
);

-- Un registro por persona, cliente y día: cargar de nuevo CORRIGE el mismo
-- registro (upsert desde la aplicación), no lo duplica — tiempo interno
-- (cliente_id NULL) incluido, porque la aplicación busca por
-- "clienteId: null" con un WHERE normal antes de crear o actualizar, y ahí
-- NULL sí se compara como NULL. Este índice solo, sin esa lógica, dejaría
-- pasar dos filas con cliente_id NULL el mismo día (mismo comportamiento ya
-- documentado para `archivo_de_origen`), pero la aplicación nunca llega a
-- ese caso — ver el comentario en `HorasPrisma.registrar`.
CREATE UNIQUE INDEX "registro_de_horas_usuario_id_cliente_id_fecha_key"
  ON "registro_de_horas" ("usuario_id", "cliente_id", "fecha");

CREATE INDEX "registro_de_horas_cliente_id_fecha_idx"
  ON "registro_de_horas" ("cliente_id", "fecha");

CREATE INDEX "registro_de_horas_usuario_id_fecha_idx"
  ON "registro_de_horas" ("usuario_id", "fecha");

ALTER TABLE "registro_de_horas"
  ADD CONSTRAINT "registro_de_horas_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registro_de_horas"
  ADD CONSTRAINT "registro_de_horas_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS como el resto: sin política, `effort_app` no lee ni una fila y lo hace
-- en silencio. Ver docs/DISCREPANCIAS.md, puntos 7 y 8. Sin DELETE a
-- propósito, mismo criterio que el resto del sistema: se corrige con un
-- upsert desde la aplicación, nunca se borra una fila de horas ya cargada.
ALTER TABLE "registro_de_horas" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "registro_de_horas" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "registro_de_horas";
    CREATE POLICY app_acceso ON "registro_de_horas"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
