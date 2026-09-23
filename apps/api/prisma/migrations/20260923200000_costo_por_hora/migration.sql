-- Costo por hora de cada colaborador (tarea 156, DISCREPANCIAS 35).
-- Nullable con valor por defecto: no toca ninguna fila existente.
ALTER TABLE "usuario" ADD COLUMN "costo_por_hora" BIGINT DEFAULT 200000;
