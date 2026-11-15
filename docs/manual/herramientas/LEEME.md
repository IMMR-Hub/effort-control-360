# Cómo regenerar el manual

Los PDF de `docs/manual/` salen de estos archivos. Las capturas son del **entorno de prueba** (esquema
aislado que crea y destruye `e2e/entorno-global.ts`), con datos de ejemplo: nunca de producción.

1. Capturas (cada `.spec.ts` se copia a `e2e/pruebas/`, se corre y se borra la copia):

   ```bash
   cp docs/manual/herramientas/capturas.spec.ts e2e/pruebas/zz-capturas.spec.ts
   TRABAJOS_AUTOMATICOS=no RECORDATORIOS_AUTOMATICOS=no npx playwright test e2e/pruebas/zz-capturas.spec.ts
   rm e2e/pruebas/zz-capturas.spec.ts
   ```

   Igual con `pantallas.spec.ts` (todas las pantallas, con datos de ejemplo) y `editar-cliente.spec.ts`.
   En `capturas.spec.ts` el import es `../entorno-global.js` cuando está copiado en `e2e/pruebas/`.

2. Dibujos del celular: `python -I docs/manual/herramientas/ilustraciones.py`.
3. PDF: `python -I docs/manual/herramientas/generar_pdfs.py`.

Los textos que el manual cita entre «» salen de `apps/web/src/pantallas/` (relevados el 2026-11-15). Si cambia
una pantalla, hay que actualizar el texto en `generar_pdfs.py` y volver a capturar.
