-- Motor de alertas: que el sistema pueda levantar una alerta.
--
-- Hasta acá la tabla `alerta` se podía leer y cerrar, pero no existía forma de
-- crear una: `RepositorioDeAlertas` no tenía método de alta y ninguna línea del
-- sistema insertaba en esta tabla. La pantalla de Alertas iba a estar vacía
-- para siempre.
--
-- Este índice es lo que hace que el motor se pueda correr cada 15 minutos sin
-- llenar la pantalla de repetidas: no puede haber dos alertas ABIERTAS del
-- mismo origen sobre la misma entidad. Es parcial a propósito — una vez que la
-- alerta se cierra, si el problema vuelve a aparecer se puede levantar otra.
--
-- Va como índice parcial en SQL y no en schema.prisma porque Prisma no sabe
-- expresar un índice con WHERE. `createMany({ skipDuplicates: true })` lo
-- respeta igual: se traduce a ON CONFLICT DO NOTHING, que aplica a cualquier
-- índice único de la tabla.

CREATE UNIQUE INDEX "alerta_abierta_unica"
    ON "alerta" ("origen", "entidad_relacionada_id")
    WHERE "estado" IN ('ABIERTA', 'EN_CURSO') AND "entidad_relacionada_id" IS NOT NULL;
