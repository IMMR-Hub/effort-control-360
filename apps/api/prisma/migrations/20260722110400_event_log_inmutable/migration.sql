-- Inmutabilidad del registro de eventos.
--
-- El sistema existe, entre otras cosas, para poder demostrar qué pasó: cuándo
-- se le pidió la documentación a un cliente, quién aprobó un balance, quién
-- cambió una tasa de IVA. Si esa bitácora se puede editar, no prueba nada.
--
-- "El código nunca hace UPDATE sobre event_log" no es una garantía: alcanza con
-- que alguien abra un cliente SQL con la cadena de conexión. La garantía tiene
-- que vivir en la base, y por eso son disparadores y permisos, no convenciones.

CREATE OR REPLACE FUNCTION rechazar_modificacion_event_log()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'event_log es de solo escritura: no se admite % sobre esta tabla.', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_log_sin_update ON event_log;
CREATE TRIGGER event_log_sin_update
  BEFORE UPDATE ON event_log
  FOR EACH ROW EXECUTE FUNCTION rechazar_modificacion_event_log();

DROP TRIGGER IF EXISTS event_log_sin_delete ON event_log;
CREATE TRIGGER event_log_sin_delete
  BEFORE DELETE ON event_log
  FOR EACH ROW EXECUTE FUNCTION rechazar_modificacion_event_log();

-- TRUNCATE no dispara triggers de fila, así que necesita el suyo propio:
-- sin esto, un TRUNCATE borraría toda la bitácora esquivando los anteriores.
DROP TRIGGER IF EXISTS event_log_sin_truncate ON event_log;
CREATE TRIGGER event_log_sin_truncate
  BEFORE TRUNCATE ON event_log
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_modificacion_event_log();


-- Segunda barrera: permisos.
--
-- El usuario con el que corre la aplicación no necesita poder modificar ni
-- borrar la bitácora, así que no se le otorga. Los disparadores frenan también
-- a un superusuario distraído; los permisos frenan a la aplicación aunque
-- alguien introduzca un UPDATE por error o por una inyección.
--
-- Ajustar el nombre del rol al usuario real de la aplicación antes de aplicar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'effort_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON event_log FROM effort_app;
    GRANT INSERT, SELECT ON event_log TO effort_app;
  END IF;
END $$;


-- La misma protección para la bitácora de contactos: es la evidencia con la
-- que EFFORT responde un reclamo. Se corrige agregando un registro nuevo que
-- referencia al anterior, nunca editando el original.
CREATE OR REPLACE FUNCTION rechazar_borrado_registro_contacto()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'registro_contacto no se borra: es evidencia. Corregí agregando un registro que referencie al anterior.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS registro_contacto_sin_delete ON registro_contacto;
CREATE TRIGGER registro_contacto_sin_delete
  BEFORE DELETE ON registro_contacto
  FOR EACH ROW EXECUTE FUNCTION rechazar_borrado_registro_contacto();

DROP TRIGGER IF EXISTS registro_contacto_sin_truncate ON registro_contacto;
CREATE TRIGGER registro_contacto_sin_truncate
  BEFORE TRUNCATE ON registro_contacto
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_borrado_registro_contacto();
