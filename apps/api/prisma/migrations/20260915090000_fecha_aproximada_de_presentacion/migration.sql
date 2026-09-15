-- Marca las presentaciones cuya fecha es un máximo y no un dato exacto.
--
-- Aparecieron el 2026-09-15 al leer los PDFs de COPESA 2026: el "talón" de la
-- RG 90 está guardado como el aviso del buzón de Marangatú impreso desde el
-- navegador. Prueba la presentación (trae el número de orden) pero la única
-- fecha es la de impresión, que puede ser semanas posterior.
--
-- Daniel pidió mostrar los días de atraso. Con estas fechas, los días son un
-- máximo ("hasta N días"), y la pantalla tiene que poder decirlo.
--
-- SOLO AGREGA UNA COLUMNA. Todas las filas existentes quedan en `false`, que es
-- lo correcto: hasta hoy solo se reconocían formularios con fecha exacta.

ALTER TABLE "lectura_de_declaracion"
  ADD COLUMN "fecha_aproximada" BOOLEAN NOT NULL DEFAULT false;
