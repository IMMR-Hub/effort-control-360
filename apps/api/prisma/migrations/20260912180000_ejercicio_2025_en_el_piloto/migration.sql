-- Extiende las asignaciones cliente-obligación al ejercicio 2025.
--
-- Por qué: una obligación anual se genera en el período AAAA-12 del ejercicio
-- que cierra, no en el mes en que se presenta. Como las cinco asignaciones
-- arrancaban el 2026-01-01, el IRE y los estados financieros del ejercicio 2025
-- —que se presentaron en abril de 2026, o sea DENTRO del período del piloto—
-- no se generaban nunca. El sistema no tenía forma de saber que existían.
--
-- Daniel, 2026-09-12: "siempre en el año se presentan los balances y los IRE del
-- periodo contable anterior". Es la regla normal, no una excepción del 2025 —
-- por eso se corrige la fecha de inicio en vez de agregar un caso especial.
--
-- El 2025-01-01 no es arbitrario: es el inicio del ejercicio contable cuyas
-- declaraciones vencen dentro del piloto. Más atrás no haría falta y generaría
-- vencimientos de períodos que EFFORT no está controlando acá.

UPDATE "obligacion_de_cliente"
SET "desde" = DATE '2025-01-01'
WHERE "desde" = DATE '2026-01-01';
