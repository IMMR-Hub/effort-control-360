-- PROPUESTA — NO APLICADA. Requiere autorización expresa de Daniel (REGLA 0).
--
-- Está fuera de `apps/api/prisma/migrations/` a propósito: DigitalOcean corre
-- `prisma migrate deploy` en cada despliegue, y un archivo ahí se aplicaría solo
-- al hacer push, sin que nadie lo autorice.
--
-- QUÉ HACE. Borra las filas repetidas de `hallazgo_libro_rg90` y crea el índice
-- único que impide que vuelvan a aparecer.
--
-- POR QUÉ HAY REPETIDOS. El índice único incluía `tasa`, que es NULL en los
-- hallazgos "las partes no suman el total", y en PostgreSQL dos NULL no son
-- iguales para un índice único. Cada corrida horaria volvía a insertarlos. Al
-- 2026-09-14: 2.069 filas de ese tipo para 152 comprobantes distintos.
--
-- LAS TRES PREGUNTAS.
--  1. ¿Es necesario? No para que el sistema funcione: desde el 2026-09-14 el
--     código ya no inserta repetidos y todas las lecturas los descartan. Sí para
--     poder crear el índice que lo garantiza en la base, que es lo correcto.
--  2. ¿Qué pasa si sale mal? Se pierden filas de hallazgos. Son datos DERIVADOS:
--     se recalculan desde las planillas RG 90 de OneDrive con "Recalcular desde
--     los libros". Hay respaldo previo en
--     `respaldos/hallazgo_libro_rg90-antes-de-decisiones-2026-09-14.json`.
--     Todo corre en una transacción: si el índice no se puede crear, no se borra
--     nada.
--  3. ¿Cuál es la forma correcta? Conservar la fila MÁS VIEJA de cada grupo (la
--     original, y la que tiene la decisión si alguien ya decidió: las decisiones
--     se aplican a todo el grupo), y recién después crear el índice.
--
-- CÓMO SE APLICA, una vez autorizado: se mueve a
-- `apps/api/prisma/migrations/<fecha>_limpiar_hallazgos_repetidos/migration.sql`
-- y se aplica con `prisma migrate deploy`.

BEGIN;

-- Cuántas se van a borrar, para dejarlo escrito en la salida.
SELECT COUNT(*) AS filas_repetidas_a_borrar
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY cliente_id, periodo, tipo_registro, numero_comprobante, contraparte, tipo, tasa
    ORDER BY detectado_en, id
  ) AS n
  FROM hallazgo_libro_rg90
) x
WHERE n > 1;

DELETE FROM hallazgo_libro_rg90
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY cliente_id, periodo, tipo_registro, numero_comprobante, contraparte, tipo, tasa
      ORDER BY detectado_en, id
    ) AS n
    FROM hallazgo_libro_rg90
  ) x
  WHERE n > 1
);

-- La clave completa: con la contraparte (dos proveedores pueden repetir número
-- de comprobante) y con NULLS NOT DISTINCT (PostgreSQL 15+; la base es 17.6).
DROP INDEX IF EXISTS hallazgo_libro_unico;
CREATE UNIQUE INDEX hallazgo_libro_unico
  ON hallazgo_libro_rg90 (cliente_id, periodo, tipo_registro, numero_comprobante, contraparte, tipo, tasa)
  NULLS NOT DISTINCT;

COMMIT;
