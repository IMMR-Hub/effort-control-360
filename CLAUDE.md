# EFFORT Control 360 — reglas del proyecto

Capa de control operativo sobre SIGA, OneDrive y planillas, para EFFORT
Consultora (contable/tributaria, Paraguay). Piloto: 5 clientes, enero a junio
de 2026.

## Antes de tocar nada

1. Leé **`docs/ROADMAP-MAESTRO.md`** — dice exactamente en qué tarea quedó el
   proyecto y qué sigue. Es la fuente de verdad del avance.
2. Leé **`docs/DISCREPANCIAS.md`** — reglas que el sistema aplica pero que
   EFFORT todavía no validó contra un documento real.
3. Para el criterio de ingeniería general, se aplica la skill
   **`backend-datos-sensibles`** (global). Este archivo solo agrega lo
   específico de EFFORT.

## Reglas que no se rompen

1. **El dinero es guaraní entero, en `bigint`.** Nunca `number`. Redondeo mitad
   hacia arriba en magnitud, en un solo lugar (`dividirRedondeado`).
   Ver `docs/adr/0002-representacion-del-dinero.md`.
2. **El sistema no aprueba balances.** Prepara la revisión; aprobar es un acto
   humano registrado, con nombre y fecha, y solo por `revisor_balance` o
   `direccion`. Ver `docs/adr/0004-el-sistema-no-aprueba-balances.md`.
3. **Vencimientos en `America/Asuncion`**, vía base IANA. Nunca offset fijo.
4. **No se toca SIGA.** Se trabaja sobre sus exportaciones Excel/CSV/PDF. No
   hay API de SIGA confirmada por el proveedor.
5. **No se borra nada en OneDrive.** El sistema lee de la carpeta de EFFORT y
   escribe solo en su propia subcarpeta de salidas, con espejo de respaldo.
6. **Ninguna cifra de la interfaz está escrita a mano.** Toda sale de un cálculo
   sobre datos importados.
7. **Todo el código, comentarios, nombres y textos de interfaz en español.**
   Los términos técnicos del dominio son los que usa EFFORT (liquidación,
   timbrado, comprobante, retención).

## Fuera de alcance de esta etapa

OCR de facturas, carga automática a SIGA, API de SIGA, WhatsApp Business API,
portal de cliente, app móvil, aprobación automática de balances.

El extractor de facturas con IA está previsto como contrato (`ExtractorPort`)
para conectarse después sin rehacer nada — pero no se implementa ahora.

## Comandos

```bash
npm run verify            # único comando que decide si algo está terminado
npm run test:unit         # suite completa
npm run dev               # interfaz en localhost:5173
```

Los tests de integración necesitan `DIRECT_URL` en `.env` (Session pooler de
Supabase, puerto 5432). Sin eso se saltean solos.

## Base de datos

Supabase (São Paulo). **Dos cadenas de conexión, hacen falta las dos:**

- `DATABASE_URL` — Transaction pooler (6543), para la app en marcha.
- `DIRECT_URL` — Session pooler (5432), para migraciones y tests.

Usar solo la de 6543 hace fallar `prisma migrate` con *"prepared statement
already exists"*. Prisma está fijado en **6.19.3**: la versión 7 cambió la
configuración de conexión de forma incompatible.

Si se resetea la contraseña de Supabase, revisar que los caracteres especiales
(`#`, `%`, `@`) queden codificados con `encodeURIComponent` en la URL.

**RLS está activo en las 20 tablas.** Cualquier rol de base de datos nuevo
necesita su política antes de poder leer nada: sin política, RLS devuelve cero
filas **sin dar error**. El rol de aplicación `effort_app` ya tiene la suya.
Ver `docs/DISCREPANCIAS.md`, puntos 7 y 8.

## Al terminar cualquier tarea

1. Correr `npm run verify` y pegar la salida real.
2. Commitear.
3. **Actualizar `docs/ROADMAP-MAESTRO.md`**: marcar la tarea, y corregir la
   numeración o el total si cambió el alcance. Un roadmap desactualizado hace
   que la próxima conversación duplique trabajo o se desvíe.
4. Si apareció una decisión no trivial, agregarla a la bitácora al final del
   roadmap.

## No hacer sin permiso explícito

- `git push` (el repositorio es `IMMR-Hub/effort-control-360` en GitHub).
- Tocar nada fuera de `effort-control-360/`.
- Agregar dependencias fuera de las ya presentes sin justificarlo.
- Commitear `.env` ni credenciales.
