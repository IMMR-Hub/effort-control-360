-- Rol de aplicación con permisos mínimos, y políticas RLS que lo habilitan.
--
-- CONTEXTO DEL PROBLEMA QUE RESUELVE ESTA MIGRACIÓN
--
-- Al crear el proyecto se activó "Enable automatic RLS" en Supabase, así que
-- las 20 tablas tienen Row Level Security habilitado. Pero no había ninguna
-- política definida, y en PostgreSQL eso significa denegar todo a cualquier rol
-- que no sea el dueño de la tabla.
--
-- Hoy la aplicación conecta como `postgres`, que es el dueño y omite RLS, así
-- que funciona. El día que se conectara con otro rol, todas las consultas
-- devolverían CERO FILAS — sin error, sin log, sin nada. Una caída silenciosa
-- que se diagnostica muy mal.
--
-- Esta migración cierra las dos puntas:
--   1. Crea el rol `effort_app` con los permisos mínimos que la aplicación usa.
--   2. Le da políticas RLS explícitas para que pueda operar.
--
-- Lo que RLS sigue protegiendo: cualquier OTRO rol sin políticas (por ejemplo
-- `anon` y `authenticated`, si alguna vez se habilitara la Data API de Supabase
-- por error) sigue sin ver absolutamente nada.

-- ---------------------------------------------------------------------------
-- 1. El rol
-- ---------------------------------------------------------------------------
--
-- Se crea SIN contraseña y NOLOGIN a propósito: una contraseña en un archivo de
-- migración es una contraseña en el historial de git para siempre. La contraseña
-- se asigna en el despliegue, con el secreto fuera del repositorio:
--
--   ALTER ROLE effort_app WITH LOGIN PASSWORD '<generada en el despliegue>';
--
-- Ver docs/ROADMAP-MAESTRO.md, Parte 8.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    CREATE ROLE effort_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO effort_app;

-- ---------------------------------------------------------------------------
-- 2. Permisos de tabla
-- ---------------------------------------------------------------------------

-- Por defecto: leer, insertar y actualizar. Nunca borrar — las bajas del
-- sistema son lógicas, y en un sistema que existe para demostrar qué pasó el
-- borrado es la operación más peligrosa que hay.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO effort_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO effort_app;

-- Las tablas de evidencia son solo-escritura. Acá el permiso es la segunda
-- barrera: los disparadores frenan también a un superusuario distraído, pero
-- los permisos frenan a la aplicación aunque alguien introduzca un UPDATE por
-- error o a través de una inyección.
REVOKE UPDATE, DELETE, TRUNCATE ON event_log FROM effort_app;
REVOKE UPDATE, DELETE, TRUNCATE ON registro_contacto FROM effort_app;
GRANT SELECT, INSERT ON event_log TO effort_app;
GRANT SELECT, INSERT ON registro_contacto TO effort_app;

-- Las tablas que se creen en el futuro heredan los mismos permisos, para que
-- agregar una tabla no deje al rol sin acceso y a alguien depurando a ciegas.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO effort_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO effort_app;

-- ---------------------------------------------------------------------------
-- 3. Políticas RLS
-- ---------------------------------------------------------------------------
--
-- Permisivas para `effort_app`: la autorización real del sistema (qué usuario
-- ve qué cliente) vive en la capa de aplicación, en el RBAC de dos capas, y
-- necesita el contexto de la sesión HTTP que la base no tiene.
--
-- Que sean permisivas para este rol no las vuelve inútiles: siguen bloqueando a
-- cualquier otro rol que no tenga política propia.

-- `current_schema()` y no 'public' fijo. Corregido el 2026-09-10, después de
-- que esta migración ya estaba aplicada: el bucle leía los nombres de las
-- tablas de `public` pero ejecutaba el ALTER sin calificar el esquema, así que
-- en los tests de integración —que construyen un esquema aislado en la MISMA
-- base— intentaba crear políticas sobre tablas que en ese esquema todavía no
-- existían. Funcionaba solo mientras `public` y el esquema de prueba tuvieran
-- exactamente las mismas tablas; la primera tabla nueva del proyecto
-- (`obligacion_tributaria`) lo rompió.
--
-- Editar una migración ya aplicada normalmente no se hace. Acá es seguro y se
-- verificó antes de dejarlo: en `public`, `current_schema()` ES `public`, así
-- que no cambia nada de lo que ya corrió, y `prisma migrate deploy` contra la
-- base real sigue devolviendo 0 sin reclamar el checksum (probado).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename NOT LIKE '_prisma%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_acceso ON %I', t);
    EXECUTE format(
      'CREATE POLICY app_acceso ON %I FOR ALL TO effort_app USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
