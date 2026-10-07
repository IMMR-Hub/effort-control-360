# Análisis del OneDrive de EFFORT — octubre de 2026

Resultados y herramientas de la lectura **de solo lectura** del OneDrive de origen (`lsosa@effort.com.py`)
del 2026-10-03, más los entregables que salieron de ahí. Está en el repositorio porque la carpeta temporal de
la conversación donde se hizo no la ve la conversación siguiente. Registro de accesos: `docs/BITACORA-ONEDRIVE.md`.

## `datos/` (resultados; no se vuelven a calcular si no hace falta)

| Archivo | Qué es |
|---|---|
| `clientes-por-codigo.json` | Las 129 carpetas de cliente con código (001–132; no existen 045, 070 ni 099): archivos, subcarpetas, peso, último movimiento. Más las 10 carpetas sin código y los 7 archivos sueltos de `CLIENTES`. |
| `analisis-por-cliente.json` | Por cliente: copias idénticas, declaraciones en mes/año equivocado o de otro RUC, nombres que no dicen qué son, archivos fuera de la estructura, Excel con vínculos. Más totales y ejemplos. |
| `repetidos-por-cliente.json` | Los 986 grupos de archivos idénticos dentro de un mismo cliente (1.068 copias, 52 clientes) con ruta y fecha de cada copia, y los 38 archivos iguales entre clientes distintos. |
| `faltantes-2026-10-06.json` | Lo que muestra la pantalla Faltantes (41 períodos, 55 comprobantes, 19 planillas RG 90 incompletas), reconstruido con el mismo código del sistema. |

## `Planilla de clientes - EFFORT Control 360.xlsx`

La planilla de 132 filas (código 001 a 132) que EFFORT tiene que completar: RUC con dígito verificador, tipo de
persona, régimen, las 4 obligaciones que el sistema controla (IVA, RG 90, IRE, estados financieros),
responsable, contacto y observaciones. Las celdas amarillas se completan; la letra azul es una propuesta
sacada de las declaraciones de su carpeta (RUC en 91 clientes). El régimen y las obligaciones están vacíos a
propósito. 045, 070 y 099 aparecen en naranja (no tienen carpeta). **Cuando EFFORT la devuelva, es la entrada
del alta masiva** (tarea de la 164).

## `herramientas/` (scripts descartables, como `.txt`)

Son los scripts que se usaron, sin tocar. Tienen rutas de la carpeta temporal de esa sesión: hay que ajustarlas.
Leen los secretos de Azure del `.env` hacia el proceso (nunca como argumento ni impresos) y los de **lectura**
(`1-listado`, `2-contenido`, `clientes-por-codigo`, `faltantes`) solo usan GET o SELECT.

| Script | Para qué |
|---|---|
| `comun.mjs` | Acceso a Microsoft Graph, solo GET, con reintentos ante cortes de red. |
| `1-listado.mjs` | Lista completa de `CLIENTES` por la consulta de cambios de Graph (~3 min, 33.000 elementos). |
| `2-contenido.mjs` | Lee por dentro los PDF (≤ 5 MB) y Excel (≤ 20 MB) a memoria, sin guardarlos (~4 h, ~4 archivos por segundo). Reanudable. |
| `3-analisis.mjs` | Cuenta qué habría que ordenar, por cliente. |
| `5-planilla-regimen.cjs` | Arma la planilla de clientes para EFFORT. |
| `clientes-por-codigo.mjs` | Inventario de clientes por código y peso. |
| `faltantes.mjs`, `repetidos.cjs`, `informe.cjs` | Reconstruyen los faltantes, agrupan los repetidos y arman el Word «Documentos faltantes y archivos repetidos». |
| `plan.cjs`, `generar.cjs`, `fotos.ps1`, `subir.mjs`, `renombrar.mjs` | Crearon el cliente de muestra `999 CLIENTE MUESTRA` (única escritura autorizada en el origen, 2026-10-07). `subir.mjs` y `renombrar.mjs` son el modelo de cómo escribir en el origen **solo cuando Daniel lo autoriza**: puerta única de salida, sin DELETE, `conflictBehavior=fail`, simulación por defecto. |

## Lo que mostró el análisis (resumen)

- **129 clientes con código** (001–132), 121 con archivos y 8 vacías; 26.724 archivos, **14,02 GB**; 105 con movimiento en 2026.
- Piloto en el sistema: 002 FUMIPRO, 021 COPESA, **032 DIBEC S.A** (no la 023), 043 SIPAR, 068 ECOAGRO.
- **1.068 copias idénticas** (0,82 GB, 52 clientes). De 2.366 declaraciones de la DNIT leídas, **54 con problema (2,3 %)**:
  12 de otro RUC, 10 en mes equivocado, 32 en año equivocado. 858 archivos se pueden renombrar con certeza.
- 10.518 nombres que no dicen qué son (3.025 fotos y 2.853 PDF escaneados sin texto: no se pueden clasificar solos).
- 3.385 archivos fuera de la estructura `PERIODO AAAA`, 81 % en 6 clientes (014, 085, 043, 106, 113, 111).
- **107 Excel con vínculos** a otros archivos (se rompen si se mueven o renombran).
- La carpeta «045 DAVID ROMERO» está metida dentro de «056 FACUNDO CARRASCOSA» (3 archivos de 2024); del 070 y del 099 no hay rastro.
- Entre el 03/10 y el 07/10 desaparecieron de la raíz de `CLIENTES` tres fotos sueltas (`PHOTO-2026-05-05-…jpg`): las movió o borró alguien de EFFORT.
