-- Carga las reglas de IVA como DATO, que es donde tienen que vivir.
--
-- La tabla `regla_impositiva` existía desde el principio y estaba VACÍA. El
-- cálculo, mientras tanto, usaba una constante del código — con un comentario
-- arriba que aseguraba lo contrario. Ver DISCREPANCIAS #9.
--
-- `requiere_confirmacion_cliente = true` no es un descuido: estos divisores
-- están confirmados de palabra por EFFORT pero NUNCA se compararon contra una
-- liquidación que la DNIT ya haya recibido (DISCREPANCIAS #1). Es la única regla
-- del sistema que mueve dinero y todavía no se contrastó contra un documento
-- real. La marca se saca cuando eso pase, no antes.
--
-- Vigente desde el 2019-09-25: fecha de la Ley 6380/19, que es el régimen que
-- fija estas tasas. No se usa la fecha de hoy a propósito — una regla vigente
-- "desde hoy" no podría explicar un cálculo de un período anterior, y el piloto
-- justamente trabaja sobre períodos pasados.

INSERT INTO "regla_impositiva"
  ("id", "nombre", "tasa", "divisor_iva_incluido", "vigente_desde",
   "requiere_confirmacion_cliente", "fuente", "creado_en", "actualizado_en")
VALUES
  (gen_random_uuid(), 'IVA 10% — tasa general', 'DIEZ', 11, DATE '2019-09-25', true,
   'Ley 6380/19. Divisor 11 para despejar el IVA de un total que ya lo incluye (total*0,10/1,10). Confirmado verbalmente por EFFORT vía Daniel (jul-2026); falta contraste contra una liquidación ya presentada — ver DISCREPANCIAS #1.',
   now(), now()),
  (gen_random_uuid(), 'IVA 5% — tasa reducida', 'CINCO', 21, DATE '2019-09-25', true,
   'Ley 6380/19. Divisor 21 para despejar el IVA de un total que ya lo incluye (total*0,05/1,05). Confirmado verbalmente por EFFORT vía Daniel (jul-2026); falta contraste contra una liquidación ya presentada — ver DISCREPANCIAS #1.',
   now(), now()),
  (gen_random_uuid(), 'Exenta — sin IVA', 'EXENTA', NULL, DATE '2019-09-25', false,
   'Ley 6380/19. Sin divisor porque no hay impuesto que despejar: el total es todo base. No requiere confirmación — que una operación exenta no lleve IVA no es un criterio de EFFORT, es la definición.',
   now(), now());
