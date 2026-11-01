-- Código de cliente y RUC pendiente (alta de todos los clientes, 2026-11-01).
--
-- Daniel, 2026-11-01: «Todos los clientes que están en las carpetas de EFFORT
-- son clientes, así que deben ser tratados como tal. Hazlos clientes con el
-- mismo número que ya aparece». Dos cosas del esquema lo impedían:
--
-- 1. `cliente` no tenía el código de EFFORT (001…132). Se agrega `codigo`,
--    único, igual al número de la carpeta `CLIENTES/NNN NOMBRE`. Es nullable
--    solo por las filas anteriores a esta migración; la API y el alta masiva lo
--    exigen para todo cliente nuevo. El CHECK impide un código que no sean
--    exactamente tres cifras.
--
-- 2. `cliente.ruc` era NOT NULL, y 41 clientes con carpeta no tienen RUC
--    todavía (la planilla de EFFORT no lo trae). Se vuelve opcional: un cliente
--    sin RUC queda «RUC pendiente», el generador de vencimientos no le calcula
--    los que dependen de la terminación del RUC, y dirección ve el aviso. Nunca
--    se pone un RUC de relleno: produciría vencimientos falsos. El índice único
--    `cliente_ruc_key` se conserva (PostgreSQL admite varios NULL en un índice
--    único). El CHECK impide guardar un RUC vacío como si fuera un dato.
--
-- NO BORRA NI PISA NINGÚN DATO: agrega una columna nullable, afloja un NOT
-- NULL, agrega dos CHECK que las filas actuales ya cumplen, y le pone el código
-- a los cinco clientes del piloto (solo si todavía no tienen uno).

ALTER TABLE "cliente" ALTER COLUMN "ruc" DROP NOT NULL;

ALTER TABLE "cliente" ADD COLUMN "codigo" VARCHAR(3);

CREATE UNIQUE INDEX "cliente_codigo_key" ON "cliente"("codigo");

ALTER TABLE "cliente"
  ADD CONSTRAINT "cliente_codigo_tres_cifras" CHECK ("codigo" IS NULL OR "codigo" ~ '^[0-9]{3}$'),
  ADD CONSTRAINT "cliente_ruc_no_vacio"       CHECK ("ruc" IS NULL OR btrim("ruc") <> '');

-- Código de los cinco clientes del piloto, por su RUC. Salen del número de su
-- carpeta en `CLIENTES` (la misma que ya tienen conectada, migración
-- 20260913150000) y de la planilla de clientes de EFFORT, donde figuran como
-- «Ya cargado en el sistema». DIBEC es la S.A. (032), no la unipersonal (023):
-- DISCREPANCIAS 3 y 40.
--
-- Solo en `public`, con la misma guarda que la reconstrucción del 2026-09-13:
-- las migraciones también corren en los esquemas efímeros de las pruebas de
-- integración, que no tienen estos clientes.
DO $$
BEGIN
IF current_schema() <> 'public' THEN
  RETURN;
END IF;

UPDATE "cliente" AS c
   SET "codigo" = v.codigo
  FROM (VALUES
    ('80119631-0', '002'),  -- FUMIPRO S.A.
    ('80003112-1', '021'),  -- COPESA CONSTRUCCIONES SA
    ('80082006-1', '032'),  -- DIBEC SOCIEDAD ANONIMA
    ('80012742-0', '043'),  -- SILICATOS PARAGUAYOS SA (SIPAR S.A.)
    ('80022319-5', '068')   -- ECOAGRO SA
  ) AS v(ruc, codigo)
 WHERE c."ruc" = v.ruc
   AND c."codigo" IS NULL;
END $$;
