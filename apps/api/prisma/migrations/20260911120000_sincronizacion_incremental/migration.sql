-- Sincronización incremental: saber de dónde vino cada archivo.
--
-- Sin estas dos columnas, cada corrida de la sincronización tiene que DESCARGAR
-- todos los archivos del cliente para calcular su huella y recién ahí descubrir
-- que ya los tenía. Con ~700 archivos y una corrida cada 15 minutos, eso es
-- insostenible: se detectó al probar contra el OneDrive real, donde la primera
-- corrida no había terminado después de diez minutos.
--
-- Con el id del archivo en el drive de origen y su fecha de modificación de
-- allá, una corrida normal solo lista (una llamada por carpeta) y descarga
-- únicamente lo nuevo o lo que cambió.
--
-- Quedan nulas en las 671 evidencias anteriores: se importaron con un script
-- que no registraba el origen. Esas se van a volver a leer una única vez, y
-- desde ahí quedan con su marca.

ALTER TABLE "evidencia" ADD COLUMN "item_id_origen" VARCHAR(200);
ALTER TABLE "evidencia" ADD COLUMN "modificado_en_origen" TIMESTAMPTZ(3);

CREATE INDEX "evidencia_cliente_id_item_id_origen_idx"
    ON "evidencia" ("cliente_id", "item_id_origen");
