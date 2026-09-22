-- Saldo a favor de IVA tal como lo declaró el formulario 120 (tarea 138).
--
-- El saldo a favor de IVA se toma de lo DECLARADO ante la DNIT, no de lo
-- calculado desde las planillas: recalcularlo puede contradecir una
-- determinación ya presentada (COPESA, febrero 2026, trae un saldo a favor
-- que ninguna planilla explica). El texto del formulario 120 trae DOS
-- "saldo a favor" distintos -- el técnico (Rubro 4, casilla 47, el que se
-- arrastra) y el financiero (Rubro 5, casilla 54, "no trasladable al Rubro
-- 4") -- verificado contra un PDF real el 2026-09-20 (docs/DISCREPANCIAS.md,
-- punto 32). Solo el 47 corresponde acá.
--
-- Se agregan a `lectura_de_declaracion`, no a una tabla nueva: ya es la fila
-- que guarda lo que el sistema leyó de cada PDF de la DNIT, una por
-- evidencia, y este es un dato más de esa misma lectura.
--
-- SOLO AGREGA DOS COLUMNAS NULLABLE. No toca ningún dato existente.

ALTER TABLE "lectura_de_declaracion"
  ADD COLUMN "saldo_a_favor_a_trasladar"     BIGINT,
  ADD COLUMN "saldo_a_favor_periodo_anterior" BIGINT;
