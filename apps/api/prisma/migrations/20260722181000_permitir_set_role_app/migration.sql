-- Permite que el rol administrador asuma el rol de aplicación.
--
-- Sin esto, `SET ROLE effort_app` falla con "permission denied to set role":
-- en Supabase el usuario `postgres` no es superusuario, y un rol solo puede
-- asumir otro del que sea miembro.
--
-- Hace falta para dos cosas concretas:
--
--   1. Poder VERIFICAR los permisos del rol de aplicación sin necesitar su
--      contraseña — que a propósito todavía no existe. Sin poder verificarlo,
--      la garantía de "el rol de la aplicación no puede modificar la bitácora"
--      sería una declaración de intenciones, no un hecho comprobado.
--
--   2. Poder ejecutar tareas de mantenimiento con los permisos acotados de la
--      aplicación, en vez de hacerlo siempre como dueño del esquema.
--
-- No otorga ningún privilegio nuevo: `postgres` ya es dueño de todas las
-- tablas y puede hacer más que `effort_app`. Solo habilita el cambio de rol.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    EXECUTE format('GRANT effort_app TO %I', current_user);
  END IF;
END $$;
