# Ordenamiento de prueba de las carpetas de clientes (tarea 164) — octubre de 2026

Ordenar **una copia** del OneDrive de EFFORT con la lógica del Manual de procedimiento de documentos v1.3 y del
cliente modelo `999 CLIENTE MUESTRA`, para que Laura y Lili lo vean y lo aprueben **antes** de tocar el OneDrive.
Pedido de Daniel (2026-10-20): segunda copia en el disco externo, ordenar y ensayar ahí, no inventar documentos,
renombrar y ubicar según el 999, corregir lo mal nombrado y llevar una bitácora por cliente con su número.

**El OneDrive real no se tocó.** Todo se hizo sobre `D:\ORDENADO` (copia de la foto `D:\COPIA ONEDRIVE EFFORT 2026-10-19`).

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `bitacora/BITACORA DEL ORDENAMIENTO - 22-10-2026.xlsx` | **El plan corregido (v2)**: hojas «Cómo leer», «Resumen por cliente», «Acciones» (una fila por archivo, antes y después, y por qué), «Duplicados» y «A clasificar». |
| `bitacora/POR CLIENTE/NNN NOMBRE.txt` | Lo mismo, un archivo por cliente (120): al inicio, resumen, al final, y las listas de duplicados, nombres con problema, renombrados, movidos, enviados/recibidos de otro cliente, a clasificar y Excel con vínculos. |
| `bitacora-v1-DESCARTADA-error-045/` | La bitácora de la primera pasada (la que se aplicó el 20-10). **No usar**: ordenaba la carpeta «045 DAVID ROMERO» como si fuera del 056. Se dejó porque la guardia de borrado no deja quitarla (correcto: la quita Daniel si quiere). |
| `resumen-plan.json` | Totales por cliente del plan v2. |
| `herramientas/*.txt` | Los scripts (ver abajo). |

Los **datos de trabajo** (plan completo, diario de movimientos, lectura del contenido de 21.986 archivos, 93 MB) están en
`C:\Users\Daniel\DATOS ORDENAMIENTO EFFORT 2026-10\` — **no** en el repositorio por el tamaño. Ahí se corren los scripts.

## Resultado del plan v2 (27.288 archivos de 120 clientes; el 999 no se toca)

| | Archivos |
|---|---|
| Movidos y renombrados con el nombre del manual (se supo con certeza qué son y de qué período) | 11.133 |
| Movidos a su carpeta conservando su nombre (solo se le quitó «(1)», «copia», espacios dobles) | 12.981 |
| Duplicados apartados a `CLIENTES/ZZ DUPLICADOS PARA REVISAR` (1.044 idénticos byte por byte + 229 la misma declaración, mismo número de orden de la DNIT, bajada otra vez). **No se borran**: se conserva el más antiguo | 1.273 |
| A `NNN ZZ A CLASIFICAR` con su ruta original (no se pudo saber con certeza el período o el tipo) | 1.892 |
| Declaraciones de otro cliente (por el RUC leído en el PDF), llevadas a su cliente | 8 (+1 de un RUC sin carpeta → `CLIENTES/ZZ A CLASIFICAR`) |
| Versiones anteriores marcadas «VERSION ANTERIOR n» (la más reciente queda con el nombre limpio) | 454 |
| Excel con vínculos a otros archivos (no se renombran) | 198 |

Nombres originales con problema: 3.478 con palabras prohibidas por el manual (copia, (1), IMG, WhatsApp…); 13.942 que
no dicen qué documento son; 182 cuyo nombre o ubicación contradice lo que dice el documento por dentro.

## Cómo decide (reglas, en orden)

1. **Duplicado:** misma huella y peso dentro del cliente, o misma declaración (mismo número de orden). Se conserva el más antiguo; a igual fecha, el que está en el cliente correcto y en la estructura normal.
2. **Carpeta de otro cliente metida dentro** (`045 DAVID ROMERO` dentro del 056): a ZZ entera, sin mezclarla.
3. **Lo leído por dentro manda:** una declaración de la DNIT (formularios 120, 145, 122, 525, 526, 500, 158, 241) va al período que declara; su RUC dice de qué cliente es. Una planilla RG 90 va al período de la mayoría de sus filas. El 120 es rectificativa cuando dice «Rectificativa 03 &lt;número de orden&gt;» (verificado en 197 PDF reales); el 145 dice qué formulario rectifica.
4. **Imputación masiva** y sustentos `_REC_AAAAMM` del SET: a su mes, sin renombrar.
5. **Pedidos y paquetes para terceros** (auditorías, bancos, solicitudes): se conservan juntos en DOCUMENTOS VARIOS.
6. **El nombre, cuando es claro** (CCT, constancia de RUC, asamblea, IPS, sueldos, estatuto, balance/EEFF/IRP), y si no **la carpeta más profunda que dice algo**.
7. **Mensual:** el mes de la carpeta; si no lo dice, el del nombre; un comprobante electrónico sin mes, la «Fecha emisión» de su texto. Una boleta de pago va al mes que paga (su nombre), no al que se guardó.
8. Lo que queda sin período o tipo seguro → `NNN ZZ A CLASIFICAR`, con su ruta original.
9. **Nombre:** solo se pone el del manual cuando hay certeza; si no, se conserva. Nombres repetidos: versiones (RG, libro, cálculo, DDJJ…) → la más reciente limpia y las otras «VERSION ANTERIOR n»; series (facturas, extractos, boletas) → 01, 02…; nombres originales → se les agrega la subcarpeta o el mes de donde venían.
10. Notas de crédito: subcarpeta `NC EMITIDAS/RECIBIDAS MMAAAA` solo si son más de cinco en el mes (emisor = primer RUC del documento electrónico).

## Herramientas (copiarlas a la carpeta de datos sin el `.txt` y correrlas desde ahí)

`1-inventario` (lista desde la foto) → `2-contenido` (lee PDF y Excel desde la foto, 6 procesos en paralelo, ~27 min) →
`3-plan` (arma `plan.json`) → `validar-plan` (destinos únicos, nada pisado, nombres válidos) → `4-aplicar` (simula; con
`--aplicar` mueve dentro de `D:\ORDENADO`, nunca pisa ni borra archivos, anota cada movimiento en `diario.jsonl`) →
`7-verificar` (cada archivo en su destino con su peso, total igual, solo las carpetas de primer nivel del manual) →
`5-bitacora <salida>`. `6-deshacer` vuelve todo atrás leyendo el diario; `comparar-con-foto` comprueba que quedó igual
a la foto; `rucs` compara el RUC de la planilla con el nombre de las declaraciones.

## Estado al 2026-10-30 — COPIA Y ORDENADO AL DÍA CON EL ONEDRIVE

- **Foto actualizada** con lo que cambió en OneDrive desde el 19-10 (449 nuevos, 31 modificados, 178 movidos o renombrados, 11 que ya no están): 36.926/36.926 verificados. Versiones viejas resguardadas en `_registro/versiones anteriores 2026-10-30/`. Ver `docs/BITACORA-ONEDRIVE.md`.
- **`D:\ORDENADO`:** se deshizo el v2 (27.288, 0 problemas); se igualó al OneDrive de hoy con `sincronizar-ordenado.mjs` (656 traídos de la foto, 218 apartados a `D:\ORDENADO\_FUERA DE ONEDRIVE 2026-10-30\`, nada borrado; 36.926/36.926 iguales a OneDrive); se leyeron por dentro los 438 PDF y Excel nuevos o modificados (`contenido-9.jsonl`), y se aplicó el **plan v3: 27.721 archivos de 120 clientes, 0 problemas, 27.721/27.721 verificados**, todos los clientes solo con las carpetas de primer nivel del manual.
- Plan v3: 11.389 renombrados según el manual · 13.109 movidos con su nombre · 1.314 duplicados a cuarentena · 1.900 a ZZ A CLASIFICAR · 8 a otro cliente · 485 versiones anteriores · 198 Excel con vínculos sin renombrar.
- Bitácora v3: `bitacora/BITACORA DEL ORDENAMIENTO - 30-10-2026.xlsx` + `bitacora/POR CLIENTE/` (también en el disco). Las anteriores quedan renombradas (v1 descartada, v2 reemplazada).
- **Para el ordenamiento final del OneDrive** hay que repetir la actualización ese mismo día, porque los archivos siguen cambiando: `actualizar.mjs --copiar` → `6-deshacer --aplicar` → `sincronizar-ordenado <fecha> --aplicar` → `1-inventario-actual` → `2-contenido-actual` con los ids nuevos → `3-plan` → `validar-plan` → `4-aplicar` → `7-verificar` → `5-bitacora`.

## Estado al 2026-10-22 18:40 — PLAN v2 APLICADO Y VERIFICADO EN `D:\ORDENADO`

- Disco reconectado: `chkdsk D:` solo análisis sin problemas (0 KB en sectores defectuosos). **Foto reverificada: 36.488 de 36.488 bien, 0 dañados.**
- Reversa del v1 terminada: 846 restantes devueltos. 2 audios de DIBEC (`PTT-20231018-WA0044/45.opus`) figuraban devueltos en el diario pero el disco no guardó el cambio al fallar: se comprobó que eran idénticos a la foto (huella) y se devolvieron a mano. `comparar-con-foto` → **0 diferencias** (36.488 archivos, 6.310 carpetas).
- **Plan v2 aplicado:** 27.288 movimientos, 0 problemas; `7-verificar` → 27.288/27.288 en su destino con su peso; los 120 clientes solo con las carpetas de primer nivel del manual. Bitácora v2 en el disco (`D:\ORDENADO\_BITACORA ORDENAMIENTO\`) y acá en `bitacora/`. La del 20-10 quedó renombrada «v1 DESCARTADA».
- El 056 FACUNDO CARRASCOSA tenía solo 3 archivos, los tres de David Romero (045): con el v2 quedan en `056 ZZ A CLASIFICAR`.
- **Lo que sigue:** mostrárselo a Laura y Lili (bitácora + el disco). Con su visto bueno, la aplicación en el OneDrive real es otra tarea y exige que Daniel levante las reglas 0 y 5 por escrito para esa operación.

## Historia: la falla del disco del 2026-10-22

- 2026-10-20: segunda copia `D:\ORDENADO` hecha y comprobada (36.488 archivos, 19,195 GB, robocopy 0 errores). Plan v1 aplicado: 27.288 movimientos, 0 problemas; verificado (27.288/27.288 en su lugar con su peso; 36.488 archivos en total; todos los clientes solo con las carpetas de primer nivel del manual).
- Al revisar apareció el error del 045 (arriba) → plan v2. Para aplicarlo se empezó a **deshacer** el v1.
- **2026-10-22 15:45: el disco Toshiba falló en medio de la reversa** (disk 51 «error durante una operación de paginación», ntfs 140 «no pudo vaciar el registro de transacción», ntfs 50 «error en la escritura demorada») y desapareció de Windows. Se habían devuelto 26.442 de 27.288 archivos. **Es la segunda falla del disco** (la primera, el 2026-10-19).
- Lo que sigue está en el HANDOFF de `docs/ROADMAP-MAESTRO.md`.
