-- Prórroga de un vencimiento (tarea 146).
--
-- La DNIT corre plazos por resolución más seguido de lo que uno esperaría.
-- Daniel, 2026-09-21: "es una resolución de prórroga que suelen sacar". El
-- caso que la motivó: la RG 50/2026 movió los estados financieros del
-- ejercicio 2025 de abril al 30/06/2026, y por no tenerlo cargado el sistema
-- mostraba a DIBEC, FUMIPRO y ECOAGRO con 60 a 64 días de atraso cuando
-- habían presentado a tiempo.
--
-- Por qué dos columnas y no solo cambiar la fecha: si `fecha_vencimiento` se
-- pisa en silencio, esa fila deja de seguir la regla general del calendario y
-- nadie puede saber por qué. Guardar de dónde venía y el motivo convierte una
-- fecha rara en un hecho explicado.
--
-- SOLO AGREGA DOS COLUMNAS NULLABLE. No toca ningún dato existente.

ALTER TABLE "vencimiento"
  ADD COLUMN "fecha_vencimiento_original" DATE,
  ADD COLUMN "motivo_prorroga"            VARCHAR(300);
