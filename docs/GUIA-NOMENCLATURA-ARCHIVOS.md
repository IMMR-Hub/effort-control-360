# Guía de nombres de archivos y carpetas — PROPUESTA

**Estado:** propuesta del 2026-09-14, para revisar con Lili y Laura. No está
aceptada. Mientras no lo esté, el sistema sigue funcionando con los nombres de
siempre.

## Por qué existe

De 3.963 documentos de los cinco clientes del piloto, **2.415 figuran como
"Otro"**. No es que el sistema no sepa qué son: es que el nombre no lo dice.
`ENERO.pdf`, `05 MAYO.xlsx`, `fc 23.pdf`, `WhatsApp Image 2026-02-18.jpeg`.

Mirando la carpeta donde están, el sistema ya resuelve 973 de esos 2.415. Los
1.442 restantes no se pueden resolver sin adivinar, y **adivinar es peor que no
clasificar**: un documento en "Otro" alguien lo corrige; uno mal clasificado
nadie lo sospecha.

La solución de fondo no es un clasificador más listo. Es que los archivos
nuevos se nombren de una forma que diga qué son.

## Quién hace qué — y qué NO hace el sistema

| | |
|---|---|
| **EFFORT** | Decide si adopta esta guía, la ajusta, y nombra los archivos **nuevos** así. Renombra los viejos solo si quiere, y lo hace una persona del equipo. |
| **El sistema** | Lee los nombres y las carpetas. **Nunca renombra, mueve ni borra un archivo de EFFORT.** No tiene ni va a tener forma de hacerlo (`CLAUDE.md`, regla 5 y REGLA 0). |

Clasificar un documento en el sistema cambia una **etiqueta en la base de datos
del sistema**. El archivo en OneDrive queda exactamente igual.

## La regla general

```
<QUÉ ES> <PERÍODO> <CLIENTE>.<extensión>
```

- **Qué es** primero, con las palabras de la tabla de abajo.
- **Período** como `MMAAAA` (mensual) o `AAAA` (anual): `032026`, `2025`.
- **Cliente** al final, opcional si la carpeta ya es del cliente.

Ejemplos: `DDJJ IVA 032026 ECOAGRO SA.pdf`, `EXTRACTO ITAU 042026.pdf`,
`NOTA DE CREDITO 001-001-0000245.pdf`.

## Tabla de palabras que el sistema reconoce

Cada fila ya funciona hoy. Son las formas que EFFORT **ya usa** en muchos de
sus archivos; la guía solo pide usarlas siempre.

| Tipo | Empezar el nombre con | Ejemplo real que ya funciona |
|---|---|---|
| Declaración jurada | `DDJJ IVA`, `DDJJ IRE`, `DDJJ` + impuesto | `DDJJ IVA 052026 ECOAGRO SA.pdf` |
| Talón de la RG 90 | `TALON RG 90` | `TALON DE CONFIRMACION RG 90 02-2024.pdf` |
| Planilla RG 90 (Excel) | `RG COMPRAS` / `RG VENTAS` | `RG COMPRAS MARZO 2026 - FUMIPRO SA.xlsx` |
| Corrección de planilla | `CORRECCION RG COMPRAS` | `CORRECCION RG COMPRAS 07 2026 - FUMIPRO SA.xlsx` |
| Pago | `BOLETA DE PAGO` + impuesto | `Boleta de Pago IRE 2024 DIBEC SA.pdf` |
| Cálculo del impuesto | `CALCULO IVA`, `CALCULO IRE` | `CALCULO IRE GENERAL CIERRE 2025.pdf` |
| Retención | `RETENCION` o `FORM 525` | `525 01-2025.pdf` dentro de `FORM 525` |
| Extracto bancario | `EXTRACTO` + banco | `EXTRACTO ITAU 042026.pdf` |
| Nota de crédito | `NOTA DE CREDITO` | dentro de `NC EMITIDAS ABRIL 2026` |
| Factura de compra | `FACTURA COMPRA` | — |
| Factura de venta | `FACTURA VENTA` | — |
| Balance / EEFF | `BALANCE`, `EEFF` | `EEFF 2025 DNIT.pdf` |
| Acta | `ACTA`, `ASAMBLEA` | dentro de `ASAMBLEA 2026` |
| Certificado | `CCT`, `CERTIFICADO` | `CCT VIGENTE 05 2026.pdf` |
| Constancia | `CONSTANCIA` | `Constancia _ MARANGATU.pdf` |

## Carpetas que ya clasifican solas

Si el archivo está dentro de una de estas carpetas (hasta tres niveles arriba),
el nombre puede ser cualquiera:

`NOTAS DE CREDITO` · `NC EMITIDAS` / `NC RECIBIDAS` · `EXTRACTOS BANCARIOS` ·
`RG 90 COMPRAS` / `RG 90 VENTAS` · `LIBRO COMPRA` / `LIBRO VENTA` ·
`FORM 120` / `FORMULARIO 120` / `DDJJ IVA` · `FORM 122` / `FORM 525` ·
`ASAMBLEA` · `CCT`

## Lo que conviene evitar

| Hoy | Problema | Mejor |
|---|---|---|
| `ENERO.pdf` suelto en una carpeta de mes | No dice qué es | `EXTRACTO ITAU 012026.pdf` |
| `fc 23.pdf` | ¿Compra o venta? | `FACTURA COMPRA 23.pdf` |
| `WhatsApp Image 2026-02-18 at 12.22.12.jpeg` | Nada | `FACTURA COMPRA PROVEEDOR 022026.jpeg` |
| `DDJJ MARZO 2026 - FUMIPRO SA.pdf` | ¿Qué impuesto? | `DDJJ IVA 032026 FUMIPRO SA.pdf` |
| `DET DE IMPUESTO IVA …` | Parece la declaración y es el cálculo | `CALCULO IVA 082026 FUMIPRO SA.pdf` |
| `PROFORMA DDJJ 500 REC 2025.pdf` | Un borrador con nombre de declaración | `BORRADOR DDJJ IRE 2025.pdf` |

## Una nota importante sobre las presentaciones

Para saber si una obligación **se presentó**, el sistema **no usa el nombre**:
lee el PDF de la DNIT y busca el número de orden y la fecha de presentación. Un
archivo mal nombrado no hace que algo figure como presentado sin estarlo. Lo
peor que puede pasar con un mal nombre es que el documento quede en "Otro".

## Preguntas para decidir

1. ¿Esta estructura se parece a cómo ya trabajan, o conviene otra?
2. ¿Quién la aplicaría a los archivos nuevos: cada responsable, o una persona?
3. ~~¿Qué es el formulario 145 y el 526?~~ Verificado abriendo los PDFs: el
   145 es la Declaración Rectificativa, el 525 la liquidación de retenciones de
   las rentas y el 526 la liquidación de retenciones del IDU.

## Archivos duplicados

La lista de archivos con contenido idéntico, con nombre y ubicación de cada
copia, está en `docs/propuestas/ARCHIVOS-DUPLICADOS.md`. Es solo una propuesta:
el sistema no borra nada.
