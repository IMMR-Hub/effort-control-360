-- Estado del sistema: el punto de sincronización con OneDrive (2026-11-12).
--
-- Daniel, 2026-11-12: «Esto debe ser rápido y eficiente». El punto desde el que
-- Microsoft Graph informa «qué cambió» vivía solo en la memoria del servidor,
-- así que cada despliegue arrancaba con una pasada completa por las carpetas de
-- los 87 clientes: 22 minutos compitiendo con las pantallas por las conexiones
-- a la base. El 2026-11-12 pasó seis veces. Con esta tabla el punto sobrevive
-- al reinicio y el servidor retoma desde donde quedó.
--
-- Una fila por clave; hoy una sola, `onedrive`. No guarda datos del negocio ni
-- secretos: el token de Graph no sirve sin las credenciales de la aplicación.
--
-- SOLO CREA UNA TABLA NUEVA. No toca datos existentes.

CREATE TABLE "estado_del_sistema" (
  "clave"          VARCHAR(50)    NOT NULL,
  "valor"          JSONB          NOT NULL,
  "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "estado_del_sistema_pkey" PRIMARY KEY ("clave")
);

-- RLS como el resto: sin política, `effort_app` no lee ni una fila y lo hace
-- en silencio (docs/DISCREPANCIAS.md, puntos 7 y 8). Sin DELETE, como el resto
-- del sistema: la fila se pisa con el punto nuevo, nunca se borra.
ALTER TABLE "estado_del_sistema" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "estado_del_sistema" TO effort_app;

    DROP POLICY IF EXISTS app_acceso ON "estado_del_sistema";
    CREATE POLICY app_acceso ON "estado_del_sistema"
      FOR ALL TO effort_app USING (true) WITH CHECK (true);
  END IF;
END $$;
