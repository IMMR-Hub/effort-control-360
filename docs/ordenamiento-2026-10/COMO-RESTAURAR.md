# Cómo deshacer o corregir el ordenamiento del OneDrive (tarea 164, 2026-10-30/31)

Si algo del ordenamiento salió mal, todo se puede volver atrás. **Nada se borró**: los archivos se movieron y se
renombraron dentro del mismo OneDrive, y hay tres registros independientes para reconstruir cualquier cosa.

## Los registros

| Qué | Dónde | Para qué |
|---|---|---|
| **Diario de cada movimiento** | `C:\Users\Daniel\DATOS ORDENAMIENTO EFFORT 2026-10\onedrive\diario-onedrive.jsonl` (copia en `D:\DATOS ORDENAMIENTO 2026-10-20\onedrive\`) | Una línea por cambio en el OneDrive: `movido` (id del archivo, carpeta y nombre de ANTES con su id, carpeta y nombre de DESPUÉS, fecha), `carpetaCreada` (id y ruta) y `carpetaVaciaApartada` (carpeta vieja vacía llevada a `CLIENTES/ZZ CARPETAS VACIAS PARA REVISAR/<cliente>/`). |
| **El plan aplicado** | `...\DATOS ORDENAMIENTO EFFORT 2026-10\plan.json` | Por archivo: ruta original, ruta nueva y motivo. Es lo mismo que la bitácora en Excel. |
| **Bitácora para personas** | `docs/ordenamiento-2026-10/bitacora/` (Excel + un `.txt` por cliente) | Qué se hizo con cada archivo y por qué, por cliente. |
| **Copia de seguridad del contenido** | `D:\COPIA ONEDRIVE EFFORT 2026-10-19\` (36.926 archivos al 2026-10-30, verificados con la huella de Microsoft) + `_registro\versiones anteriores 2026-10-30\` | El contenido de cada archivo tal como estaba ANTES del ordenamiento, en su estructura ORIGINAL. `_registro\copiados.jsonl` dice qué id de OneDrive es cada archivo. |
| **Imagen del resultado esperado** | `D:\ORDENADO\` | Cómo tiene que quedar el OneDrive después del ordenamiento (plan v3 aplicado a una copia). |

## Casos

1. **Deshacer TODO el ordenamiento** (cada archivo vuelve a su carpeta y su nombre originales):
   `node deshacer-onedrive.mjs` (simula) → `node deshacer-onedrive.mjs --aplicar`. Lee el diario de atrás para
   adelante. Las carpetas nuevas quedan vacías (sacarlas es borrar: lo decide una persona).
2. **Deshacer solo algunos clientes:** `node deshacer-onedrive.mjs --clientes 002,021 --aplicar`.
3. **Un archivo puntual quedó mal:** buscar su nombre en `diario-onedrive.jsonl` (o en la hoja «Acciones» de la
   bitácora) → ahí está su ruta y nombre de antes. Se mueve a mano en OneDrive, o con `deshacer-onedrive` filtrando.
4. **Un archivo se dañó o se perdió el contenido** (no debería: nunca se tocó el contenido): está en
   `D:\COPIA ONEDRIVE EFFORT 2026-10-19\<ruta original>`. La ruta original sale del diario (`deRuta`) o de
   `_registro\copiados.jsonl` buscando el id. Se sube a mano a OneDrive.
5. **Alguien de EFFORT no encuentra un archivo:** buscar el nombre viejo en la hoja «Acciones» de la bitácora
   (columna «Nombre original») → la columna «Ruta nueva» dice dónde quedó.
6. **Duplicados:** están en `CLIENTES/ZZ DUPLICADOS PARA REVISAR/<cliente>/<ruta original>`; la hoja «Duplicados»
   dice cuál se conservó. Borrarlos, si se decide, lo hace una persona de EFFORT.

## Qué NO se tocó

- El contenido de ningún archivo (solo nombre y carpeta).
- Las carpetas raíz de cada cliente (`NNN NOMBRE`), que es por donde el sistema reconoce al cliente.
- El cliente modelo `999 CLIENTE MUESTRA` y las carpetas que no son de clientes (`PLANTILLAS, WORD, EXCEL`,
  `materiales EFFORT`, `PRESUPUESTOS EFFORT`, `CLIENTES A CONFIRMAR`, etc.).
- Archivos que cambiaron después de armar el plan, o que estaban abiertos por alguien: quedaron donde estaban (están
  listados en los `informe-*.json`).
- Nada se borró.
