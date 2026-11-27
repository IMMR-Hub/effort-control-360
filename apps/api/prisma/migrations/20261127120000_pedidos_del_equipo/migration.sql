-- Pedidos del equipo en Seguimiento (Daniel, 2026-11-27).
--
-- Un colaborador le pide algo a dirección y queda registrado: quién, a quién,
-- con qué prioridad, qué se dijo y cómo terminó. Además, las solicitudes de
-- documentación a clientes ganan prioridad y recordatorio, para que una sola
-- regla de orden sirva a las dos cosas.
--
-- `recordar_el` es SOLO una marca visual: nunca dispara un correo ni un
-- WhatsApp (REGLA 0-bis).
--
-- CREA dos tablas, tipos, índices, funciones y disparadores (triggers),
-- políticas de RLS y permisos (grants), y AGREGA COLUMNAS CON DEFAULT a
-- `solicitud_documentacion`. No modifica ni elimina datos existentes.

CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

CREATE TYPE "EstadoPedido" AS ENUM ('ABIERTO', 'EN_CURSO', 'RESUELTO', 'CANCELADO');

CREATE TABLE "pedido_del_equipo" (
  "id"                         UUID           NOT NULL,
  "solicitante_usuario_id"     UUID           NOT NULL,
  -- Lista de ids de usuarios de dirección. No es una relación: se guarda lo
  -- que se eligió al crear el pedido.
  "destinatario_usuario_ids"   UUID[]         NOT NULL,
  "cliente_id"                 UUID,
  "asunto"                     VARCHAR(200)   NOT NULL,
  "prioridad"                  "Prioridad"    NOT NULL DEFAULT 'MEDIA',
  "estado"                     "EstadoPedido" NOT NULL DEFAULT 'ABIERTO',
  "recordar_el"                DATE,
  "motivo_de_cancelacion"      VARCHAR(500),
  "derivado_a_soporte"         BOOLEAN        NOT NULL DEFAULT false,
  "derivado_a_soporte_en"      TIMESTAMPTZ(3),
  "creado_por_usuario_id"      UUID           NOT NULL,
  "creado_en"                  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "actualizado_en"             TIMESTAMPTZ(3) NOT NULL,
  "actualizado_por_usuario_id" UUID,
  "origen"                     "Origen"       NOT NULL DEFAULT 'REAL',

  CONSTRAINT "pedido_del_equipo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensaje_de_pedido" (
  "id"                        UUID            NOT NULL,
  "pedido_id"                 UUID            NOT NULL,
  "autor_usuario_id"          UUID            NOT NULL,
  "canal"                     "CanalContacto" NOT NULL,
  "ocurrido_en"               TIMESTAMPTZ(3)  NOT NULL,
  "texto"                     VARCHAR(4000)   NOT NULL,
  "nota_interna"              BOOLEAN         NOT NULL DEFAULT false,
  "registrado_por_usuario_id" UUID            NOT NULL,
  -- Mensaje que corrige a este. La corrección es un mensaje nuevo.
  "corregido_por_id"          UUID,
  "creado_en"                 TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "origen"                    "Origen"        NOT NULL DEFAULT 'REAL',

  CONSTRAINT "mensaje_de_pedido_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pedido_del_equipo_estado_prioridad_idx"
  ON "pedido_del_equipo" ("estado", "prioridad");

CREATE INDEX "pedido_del_equipo_solicitante_usuario_id_idx"
  ON "pedido_del_equipo" ("solicitante_usuario_id");

CREATE UNIQUE INDEX "mensaje_de_pedido_corregido_por_id_key"
  ON "mensaje_de_pedido" ("corregido_por_id");

CREATE INDEX "mensaje_de_pedido_pedido_id_ocurrido_en_idx"
  ON "mensaje_de_pedido" ("pedido_id", "ocurrido_en");

ALTER TABLE "pedido_del_equipo"
  ADD CONSTRAINT "pedido_del_equipo_solicitante_usuario_id_fkey"
  FOREIGN KEY ("solicitante_usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pedido_del_equipo"
  ADD CONSTRAINT "pedido_del_equipo_creado_por_usuario_id_fkey"
  FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pedido_del_equipo"
  ADD CONSTRAINT "pedido_del_equipo_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mensaje_de_pedido"
  ADD CONSTRAINT "mensaje_de_pedido_pedido_id_fkey"
  FOREIGN KEY ("pedido_id") REFERENCES "pedido_del_equipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mensaje_de_pedido"
  ADD CONSTRAINT "mensaje_de_pedido_autor_usuario_id_fkey"
  FOREIGN KEY ("autor_usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mensaje_de_pedido"
  ADD CONSTRAINT "mensaje_de_pedido_registrado_por_usuario_id_fkey"
  FOREIGN KEY ("registrado_por_usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Solicitudes a clientes: prioridad y recordatorio visual, con default.
ALTER TABLE "solicitud_documentacion"
  ADD COLUMN "prioridad"   "Prioridad" NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN "recordar_el" DATE;


-- Los mensajes de un pedido son evidencia, igual que `registro_contacto`:
-- no se borran ni se editan. Se corrigen agregando un mensaje nuevo, y lo
-- único que se admite es marcar el original con `corregido_por_id`.
CREATE OR REPLACE FUNCTION rechazar_borrado_mensaje_de_pedido()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'mensaje_de_pedido no se borra: es evidencia. Corregí agregando un mensaje que referencie al anterior.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mensaje_de_pedido_sin_delete ON mensaje_de_pedido;
CREATE TRIGGER mensaje_de_pedido_sin_delete
  BEFORE DELETE ON mensaje_de_pedido
  FOR EACH ROW EXECUTE FUNCTION rechazar_borrado_mensaje_de_pedido();

DROP TRIGGER IF EXISTS mensaje_de_pedido_sin_truncate ON mensaje_de_pedido;
CREATE TRIGGER mensaje_de_pedido_sin_truncate
  BEFORE TRUNCATE ON mensaje_de_pedido
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_borrado_mensaje_de_pedido();

-- UPDATE: solo se admite que `corregido_por_id` pase de NULL a un valor.
-- Cualquier otro cambio (texto, autor, fecha, nota interna, o volver a
-- corregir un mensaje ya corregido) se rechaza. Protege contra la aplicación
-- y contra cualquier rol normal; el dueño de la tabla o un superusuario
-- todavía puede saltearlo a propósito (apagando el disparador o con
-- session_replication_role): para eso están el respaldo y la REGLA 0.
CREATE OR REPLACE FUNCTION rechazar_edicion_mensaje_de_pedido()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.corregido_por_id IS NULL
     AND NEW.corregido_por_id IS NOT NULL
     AND NEW.id                        IS NOT DISTINCT FROM OLD.id
     AND NEW.pedido_id                 IS NOT DISTINCT FROM OLD.pedido_id
     AND NEW.autor_usuario_id          IS NOT DISTINCT FROM OLD.autor_usuario_id
     AND NEW.canal                     IS NOT DISTINCT FROM OLD.canal
     AND NEW.ocurrido_en               IS NOT DISTINCT FROM OLD.ocurrido_en
     AND NEW.texto                     IS NOT DISTINCT FROM OLD.texto
     AND NEW.nota_interna              IS NOT DISTINCT FROM OLD.nota_interna
     AND NEW.registrado_por_usuario_id IS NOT DISTINCT FROM OLD.registrado_por_usuario_id
     AND NEW.creado_en                 IS NOT DISTINCT FROM OLD.creado_en
     AND NEW.origen                    IS NOT DISTINCT FROM OLD.origen
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'mensaje_de_pedido es de solo agregar: lo único que se admite es marcar corregido_por_id de NULL a un valor.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mensaje_de_pedido_solo_corregir ON mensaje_de_pedido;
CREATE TRIGGER mensaje_de_pedido_solo_corregir
  BEFORE UPDATE ON mensaje_de_pedido
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_mensaje_de_pedido();


-- RLS como el resto: sin política, `effort_app` no lee ni una fila y lo hace
-- en silencio. Ver docs/DISCREPANCIAS.md, puntos 7 y 8. Sin DELETE a
-- propósito: un pedido se resuelve o se cancela con motivo, nunca se borra.
-- Mensajes: SELECT e INSERT, y UPDATE solo de `corregido_por_id`.
ALTER TABLE "pedido_del_equipo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensaje_de_pedido" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "pedido_del_equipo" TO effort_app;
    GRANT SELECT, INSERT ON "mensaje_de_pedido" TO effort_app;
    -- `20260722180000_rol_aplicacion_y_rls` dejó privilegios por defecto
    -- (SELECT, INSERT, UPDATE en toda tabla nueva), así que la tabla ya nace
    -- con UPDATE completo: se quita antes de dar solo la columna.
    REVOKE UPDATE, DELETE, TRUNCATE ON "mensaje_de_pedido" FROM effort_app;
    GRANT UPDATE ("corregido_por_id") ON "mensaje_de_pedido" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "pedido_del_equipo";
    CREATE POLICY app_acceso ON "pedido_del_equipo"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS app_acceso ON "mensaje_de_pedido";
    CREATE POLICY app_acceso ON "mensaje_de_pedido"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
