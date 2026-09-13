-- Reconstrucción de clientes y obligaciones después del borrado del 2026-09-13.
--
-- Los datos no salieron de la memoria de nadie: los RUC y razones sociales
-- estaban en `docs/DISCREPANCIAS.md` (punto 3), confirmados contra las
-- constancias oficiales de Marangatú; los ids de carpeta de OneDrive se
-- releyeron del drive real; y los calendarios son los que quedaron probados
-- contra el portal de la DNIT y contra las fechas que dio EFFORT.
--
-- Es idempotente a propósito (`ON CONFLICT DO UPDATE`): si algo ya está, se
-- corrige en vez de fallar o duplicar. Después de un incidente no se sabe con
-- certeza qué sobrevivió, y una reconstrucción que solo funciona sobre una base
-- vacía no sirve justo cuando hace falta.
--
-- TODO ESTO CORRE SOLO EN `public`, y la guarda no es decorativa.
--
-- Las migraciones se aplican también en los esquemas efímeros que arman los
-- tests de integración y los de punta a punta. Sin la guarda, esta migración
-- sembraba sus cinco clientes en CADA esquema de prueba: el test que verifica
-- "1 cliente activo" pasó a ver 6 y falló. Una migración que siembra datos de
-- producción contamina todo lo que se pruebe después.
--
-- La lección más general, que vale para la próxima: el esquema va en
-- migraciones, los datos no. Esto es una reconstrucción puntual de un
-- incidente, no una estructura — y por eso lleva candado.
--
-- El bloque usa `$$` y no una etiqueta con nombre: el banco de pruebas parte
-- los archivos SQL en sentencias respetando solo `$$ ... $$`, y una etiqueta
-- propia lo cortaba al medio.

DO $$
BEGIN
IF current_schema() <> 'public' THEN
  RETURN;
END IF;

/* -------------------------------------------------------------------------- */
/* Clientes del piloto                                                        */
/* -------------------------------------------------------------------------- */

-- COPESA conserva su id original a propósito: 68 evidencias sobrevivieron al
-- borrado apuntando a él. Restaurarlo con el mismo id las reconecta en vez de
-- dejarlas huérfanas y hacer que la sincronización vuelva a bajar esos archivos.
--
-- DIBEC: en el OneDrive de EFFORT hay DOS carpetas —"023 DIBEC UNIPERSONAL" y
-- "032 DIBEC S.A"— que son entidades legales distintas. El piloto es la S.A.,
-- confirmado por Daniel el 2026-09-09 (DISCREPANCIAS #3). Apuntar a la
-- unipersonal traería los documentos de otro contribuyente.
INSERT INTO "cliente" ("id", "nombre", "ruc", "tipo_persona", "carpeta_onedrive_id", "activo", "creado_en", "actualizado_en")
VALUES
  ('c9ab4f11-e0f2-4ac4-ad89-dd7e58690781', 'COPESA CONSTRUCCIONES SA',           '80003112-1', 'JURIDICA', '01256M3REYI7YSD4RO2BDZLOCVJVVQUYFF', true, now(), now()),
  (gen_random_uuid(),                      'FUMIPRO S.A.',                        '80119631-0', 'JURIDICA', '01256M3RBX5BKDBXM74NFKYN445ZET2OCR', true, now(), now()),
  (gen_random_uuid(),                      'SILICATOS PARAGUAYOS SA (SIPAR S.A.)','80012742-0', 'JURIDICA', '01256M3RFXWB7XYQBQTVGKS3TC2O4QHUHM', true, now(), now()),
  (gen_random_uuid(),                      'ECOAGRO SA',                          '80022319-5', 'JURIDICA', '01256M3REP73GCZZNFMFB2ZLZSVJSR7C7V', true, now(), now()),
  (gen_random_uuid(),                      'DIBEC SOCIEDAD ANONIMA',              '80082006-1', 'JURIDICA', '01256M3RD7ACFZ7CM3UZAZ56XUFMUBGIGD', true, now(), now())
ON CONFLICT ("ruc") DO UPDATE
  SET "nombre"              = EXCLUDED."nombre",
      "carpeta_onedrive_id" = EXCLUDED."carpeta_onedrive_id",
      "activo"              = true,
      "actualizado_en"      = now();

/* -------------------------------------------------------------------------- */
/* Obligaciones tributarias                                                   */
/* -------------------------------------------------------------------------- */

-- Los dos calendarios de la DNIT (Resolución General 38/2020, art. 3°):
--   determinativas 7..25  — IVA, IRE, IRP, ISC
--   informativas   8..26  — RG 90, estados financieros, dictamen de auditoría
--
-- Las diez fechas que dio Daniel el 2026-09-11 para los cinco clientes coinciden
-- exactamente con las dos tablas, una por una. Es la confirmación cruzada que
-- cierra el punto 17 de DISCREPANCIAS.
INSERT INTO "obligacion_tributaria"
  ("id", "codigo", "nombre", "entidad", "formulario", "periodicidad", "mes_de_cierre_anual",
   "dias_por_terminacion_ruc", "confirmada_por_effort", "activa", "fuente", "creado_en", "actualizado_en")
VALUES
  (gen_random_uuid(), 'IVA_GENERAL', 'IVA General', 'DNIT', '120', 'MENSUAL', NULL,
   ARRAY[7,9,11,13,15,17,19,21,23,25], true, true,
   'DNIT, RG 38/2020 art. 3° (calendario de determinativas). Se presenta al mes siguiente del período liquidado.',
   now(), now()),

  (gen_random_uuid(), 'IRE', 'IRE — Impuesto a la Renta Empresarial', 'DNIT', '500', 'ANUAL', 4,
   ARRAY[7,9,11,13,15,17,19,21,23,25], true, true,
   'DNIT, RG 38/2020 art. 3° (determinativas). Cierre 31/12, se presenta el cuarto mes siguiente. Fechas confirmadas por Daniel el 2026-09-11.',
   now(), now()),

  -- Los estados financieros van el MISMO día que el IRE por decisión de EFFORT
  -- (dato de Lili, confirmado por Daniel el 2026-09-13), aunque la DNIT los
  -- ubica un día después en el calendario de informativas. Ver DISCREPANCIAS
  -- #19 (g): se aplica lo que dijo EFFORT, que además reclama un día antes.
  (gen_random_uuid(), 'EEFF', 'Estados Financieros', 'DNIT', NULL, 'ANUAL', 4,
   ARRAY[7,9,11,13,15,17,19,21,23,25], true, true,
   'Mismo día que el IRE, confirmado por Lili vía Daniel (2026-09-13). La DNIT los ubica en el calendario de informativas, un día después: ver DISCREPANCIAS #19.',
   now(), now()),

  -- MENSUAL, no anual: "RG 90, 26 de cada mes" para ECOAGRO (terminación 9),
  -- que es exactamente el día 26 de la tabla de informativas.
  (gen_random_uuid(), 'PLANILLA_RG90', 'Planilla RG 90 — libro de compras y ventas', 'DNIT', 'RG 90', 'MENSUAL', NULL,
   ARRAY[8,10,12,14,16,18,20,22,24,26], true, true,
   'DNIT, RG 38/2020 art. 3° (calendario de informativas / DJI). Confirmado por Daniel el 2026-09-11.',
   now(), now())
ON CONFLICT ("codigo") DO UPDATE
  SET "nombre"                   = EXCLUDED."nombre",
      "periodicidad"             = EXCLUDED."periodicidad",
      "mes_de_cierre_anual"      = EXCLUDED."mes_de_cierre_anual",
      "dias_por_terminacion_ruc" = EXCLUDED."dias_por_terminacion_ruc",
      "confirmada_por_effort"    = true,
      "activa"                   = true,
      "fuente"                   = EXCLUDED."fuente",
      "actualizado_en"           = now();

/* -------------------------------------------------------------------------- */
/* Asignaciones: las cuatro obligaciones para los cinco clientes              */
/* -------------------------------------------------------------------------- */

-- `desde` el 2025-01-01 y no el 2026-01-01: una obligación anual se genera en el
-- período AAAA-12 del ejercicio que cierra, no en el mes en que se presenta.
-- Con el inicio en 2026 el IRE y los estados financieros del ejercicio 2025
-- —que EFFORT presentó en abril de 2026, dentro del piloto— no se generaban
-- nunca. Daniel, 2026-09-12: "siempre en el año se presentan los balances y los
-- IRE del periodo contable anterior".
INSERT INTO "obligacion_de_cliente" ("id", "cliente_id", "obligacion_id", "desde")
SELECT gen_random_uuid(), c."id", o."id", DATE '2025-01-01'
FROM "cliente" c
CROSS JOIN "obligacion_tributaria" o
WHERE c."ruc" IN ('80003112-1', '80119631-0', '80012742-0', '80022319-5', '80082006-1')
  AND o."codigo" IN ('IVA_GENERAL', 'IRE', 'EEFF', 'PLANILLA_RG90')
  AND NOT EXISTS (
    SELECT 1 FROM "obligacion_de_cliente" x
    WHERE x."cliente_id" = c."id" AND x."obligacion_id" = o."id"
  );

END $$;
