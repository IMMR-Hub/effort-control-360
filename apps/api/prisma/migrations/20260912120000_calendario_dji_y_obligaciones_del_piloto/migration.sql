-- Corrige las obligaciones del piloto para que realmente generen vencimientos.
--
-- Hasta esta migración, de las cuatro obligaciones cargadas SOLO el IVA producía
-- algo. Las otras tres —justamente IRE, estados financieros y la planilla
-- RG 90, las que EFFORT nombró como las que más importan— se omitían en
-- silencio, por tres motivos que se acumulaban:
--
--   1. Las tres anuales no tenían `mes_de_cierre_anual`. Sin ese dato el cálculo
--      de la fecha falla y la obligación se descarta con un motivo que nadie
--      estaba leyendo.
--   2. La RG 90 estaba marcada ANUAL. Es MENSUAL: vence todos los meses.
--   3. Las tres tenían `confirmada_por_effort = false`, y el generador ignora a
--      propósito lo que EFFORT todavía no confirmó.
--
-- Los datos que se cargan acá están confirmados por dos caminos independientes:
-- las fechas que Daniel pasó cliente por cliente el 2026-09-11, y el portal de
-- la DNIT (Resolución General 38/2020, artículo 3°). Las diez fechas que dio
-- coinciden exactamente con las dos tablas oficiales.

-- IRE anual: cierre 31/12, se presenta en el CUARTO mes siguiente (abril), por
-- el calendario de declaraciones DETERMINATIVAS (días 7 a 25).
UPDATE "obligacion_tributaria"
SET "periodicidad"            = 'ANUAL',
    "mes_de_cierre_anual"     = 4,
    "dias_por_terminacion_ruc" = ARRAY[7,9,11,13,15,17,19,21,23,25],
    "confirmada_por_effort"   = true,
    "fuente"                  = 'DNIT, Resolución General 38/2020 art. 3° (calendario de determinativas). Fechas confirmadas por Daniel el 2026-09-11 para los 5 clientes del piloto.',
    "actualizado_en"          = now()
WHERE "codigo" = 'IRE';

-- Estados financieros: mismo mes que el IRE (abril) y, por decisión de EFFORT,
-- el MISMO día que el IRE.
--
-- Ojo, acá hay una diferencia con la norma que quedó anotada en
-- docs/DISCREPANCIAS.md, punto 19: la DNIT ubica los estados financieros en el
-- calendario de INFORMATIVAS (días 8 a 26), un día después del IRE. Daniel los
-- dio junto al IRE, en el mismo día. Se aplica lo que dio EFFORT, que además es
-- el lado conservador del error —avisa un día antes, nunca después— y queda
-- planteada la pregunta en vez de resolverse por criterio propio.
UPDATE "obligacion_tributaria"
SET "periodicidad"            = 'ANUAL',
    "mes_de_cierre_anual"     = 4,
    "dias_por_terminacion_ruc" = ARRAY[7,9,11,13,15,17,19,21,23,25],
    "confirmada_por_effort"   = true,
    "fuente"                  = 'Fechas confirmadas por Daniel el 2026-09-11 (mismo día que el IRE). La DNIT los ubica en el calendario de informativas, un día después: ver DISCREPANCIAS #19.',
    "actualizado_en"          = now()
WHERE "codigo" = 'EEFF';

-- Planilla RG 90: MENSUAL, no anual, y por el calendario de declaraciones
-- INFORMATIVAS (días 8 a 26) — un día después que las determinativas.
--
-- Es el caso que confirmó que la DNIT publica dos calendarios y no uno: Daniel
-- dio "RG 90, 26 de cada mes" para ECOAGRO (terminación 9), que es exactamente
-- el día 26 de la tabla de informativas, no el 25 de la de determinativas.
UPDATE "obligacion_tributaria"
SET "periodicidad"            = 'MENSUAL',
    "mes_de_cierre_anual"     = NULL,
    "dias_por_terminacion_ruc" = ARRAY[8,10,12,14,16,18,20,22,24,26],
    "confirmada_por_effort"   = true,
    "fuente"                  = 'DNIT, Resolución General 38/2020 art. 3° (calendario de informativas / DJI). Confirmado por Daniel el 2026-09-11: "RG 90, 26 de cada mes" para ECOAGRO, terminación 9.',
    "actualizado_en"          = now()
WHERE "codigo" = 'PLANILLA_RG90';
