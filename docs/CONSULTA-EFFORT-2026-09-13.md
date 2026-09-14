# Consulta a Lili y Laura — 2026-09-13

**Cinco preguntas** que salieron de leer **39 planillas RG 90 reales** de los
cinco clientes del piloto (4206 comprobantes). No son dudas teóricas: cada una
cambia un número que el sistema le va a mostrar a EFFORT, y ninguna se puede
contestar mirando el código.

Están ordenadas por lo que cuesta equivocarse. La primera sección ya está
resuelta y queda como constancia de qué regla aplica el sistema.

---

## 1. Redondeo del IVA — RESUELTO, no hace falta preguntarlo

Se preguntaba cómo redondear el IVA. **Daniel lo confirmó el 2026-09-13 y
coincide con lo que el sistema ya hacía**: redondeo normal — de 0,50 para
arriba sube, por debajo de 0,50 baja, y un resultado exacto no se toca.

| Valor | Queda en |
|---|---|
| 9.245,51 | 9.246 |
| 9.245,50 | 9.246 |
| 9.245,48 | **9.245** |
| 87.272,72 | 87.273 |
| 87.272,21 | **87.272** |
| 20.875 (exacto) | 20.875 |

Verificado contra la función real del sistema (`dividirRedondeado`): los siete
casos dan lo indicado. Es la regla del ADR 0002, que no hubo que cambiar.

Y coincide con los datos: de los 3.788 comprobantes reales del piloto, **3.723
(98,3%) siguen esta regla**. Las 65 excepciones son justamente las que el
sistema ahora marca como hallazgos — ver el final de este documento.

---

## 2. ¿De dónde salen estas planillas, y por qué las de ventas son distintas?

**Lo que se encontró.** Las planillas de COMPRAS y las de VENTAS tienen las
mismas 28 columnas, en el mismo orden, pero **dos de ellas se llaman distinto**:

| Columna | En COMPRAS | En VENTAS |
|---|---|---|
| Período | `Periodo de Emisión` | `Periodo` |
| Fecha | `Fecha de Emisión` (con tilde) | `Fecha de Emision` (sin tilde) |

Además apareció **un archivo con una fila de datos arriba del encabezado**
(`RG COMPRAS MARZO 2026 - FUMIPRO SA.xlsx`), y ese mismo archivo tiene una
segunda hoja llamada `Hoja1`.

**Por qué importa.** El sistema ya maneja las dos variantes, así que esto **no
está bloqueando nada**. Se pregunta para saber si hay que seguir esperando
variantes nuevas o si el formato está bajo control.

**La pregunta:**

> ¿Estas planillas las genera SIGA, las exporta el Marangatú de la DNIT, o se
> arman a mano en Excel? Si las genera SIGA: ¿compras y ventas salen del mismo
> menú o de dos reportes distintos? ¿Puede ser que algunas se hayan exportado
> con una versión más vieja del sistema?

**Y la que decide cuánto trabajo es:**

> ¿Alguien alguna vez abre estas planillas para corregirlas a mano antes de
> presentarlas?

Si la respuesta es "sí, a veces", entonces las variantes van a seguir
apareciendo para siempre y el sistema tiene que tolerarlas — que es como está
hecho hoy. Si es "no, salen así del sistema y se presentan", entonces las
variantes son finitas y conviene documentarlas de una vez.

---

## 3. Los importes vienen con decimales. ¿Es a propósito?

**Lo que se encontró.** En las planillas, algunos importes tienen decimales
aunque el guaraní no los tenga:

- `IVA 10%` = **5.364,25000001**
- `Monto Gravado 10%` = **59.006,75**
- y en la misma fila, `Total Comprobante` = **59.000** (entero)

O sea: el total es un número limpio y las columnas calculadas arrastran
decimales.

**La pregunta:**

> ¿Estas planillas se usan para cargar datos en SIGA, y SIGA hace el redondeo al
> recibirlas? ¿O se presentan a la DNIT tal cual están, con los decimales?

**Por qué importa.** Si los decimales son un paso intermedio que SIGA después
limpia, no hay nada que arreglar: el sistema los redondea al leer y listo (es lo
que hace hoy). Pero si estas planillas se presentan así, entonces **los
decimales van en una declaración jurada** y conviene saberlo.

De cualquier forma, ya está definido que **los informes que genere el sistema
van a salir sin decimales y en formato SIGA**, con todas las reglas aplicadas.

---

## 4. ¿Hace falta una auditoría de los Excel antes de seguir?

Esta la preguntó Daniel y la respuesta corta es **no, no como requisito previo**.
Pero conviene entender por qué, porque la intuición dice lo contrario.

**Los números.** De 4206 filas reales, el sistema interpreta **4092 (97,3%)**.
Las 3 que rechaza son filas de sección mal armadas, y quedan reportadas con el
motivo — no se pierden en silencio.

**El argumento.** Una auditoría previa "para unificar los Excel" tiene dos
problemas. El primero es que congela: habría que revisar 105 archivos a mano
antes de que el sistema sirva para algo, y mientras tanto no sirve para nada. El
segundo es más de fondo — los archivos **viejos no se van a poder unificar**,
ya están presentados. Y los nuevos van a seguir saliendo del mismo lugar que
salieron siempre.

**Lo que sí conviene, y es lo contrario de una auditoría previa:** que el sistema
sea el que audita, todos los meses, solo. Ya lo hace — de las 4206 filas
encontró **166 hallazgos**: 49 con riesgo de multa, 16 en contra del cliente y
101 comprobantes que no cierran consigo mismos. Ninguno de esos se habría visto
revisando 105 archivos a ojo.

**La pregunta, que es la única que queda:**

> De los 101 comprobantes donde las partes no suman el total (ejemplo real:
> FUMIPRO, comprobante `087-005-0337754`, las partes dan Gs. 56.468 y el total
> dice Gs. 56.450) — ¿son errores de carga que habría que corregir, o hay alguna
> razón por la que un comprobante legítimamente no cierre?

La respuesta decide si eso es una alerta que EFFORT tiene que atender o un ruido
conocido que el sistema debería dejar de mostrar.

---

## 5. Los 49 con riesgo de multa son DOS cosas distintas — ¿se tratan igual?

Daniel preguntó si los 49 eran ciertos. Se reverificaron contra los archivos
originales: sí, 49 sobre 4.092 comprobantes. Pero mirar la aritmética mostró que
no son un solo fenómeno.

**44 difieren en exactamente ±1 guaraní.** Es compatible con que el proveedor
redondee hacia arriba en vez de a la mitad. Discutible, pero explicable.

**5 difieren en más de 1**, y eso ninguna regla de redondeo lo produce — un
redondeo se equivoca como mucho en un guaraní:

| Base | ÷ 11 exacto | La regla da | La planilla declara | Diferencia |
|---|---|---|---|---|
| 1.548.000 | 140.727,27 | 140.727 | 140.739 | **+12** |
| 1.459.200 | 132.654,55 | 132.655 | 132.666 | **+11** |
| 286.500 | 26.045,45 | 26.045 | 26.047 | +2 |
| 739.800 | 67.254,55 | 67.255 | 67.257 | +2 |
| 39.000 | 3.545,45 | 3.545 | 3.547 | +2 |

Los dos primeros son de **AGROSOL PARAGUAY S.A.** hacia ECOAGRO; los otros tres,
de proveedores de FUMIPRO.

**Las preguntas:**

> ¿Una diferencia de un guaraní por redondeo del proveedor es algo que EFFORT
> quiere ver, o es ruido conocido que el sistema debería callar?

> Los cinco de más de un guaraní, ¿los revisarían? Son los únicos que no se
> explican por redondeo.

**Qué cambia según la respuesta:** hoy el sistema los trata igual y alerta por
los 49. Si el ±1 es ruido aceptado, la alerta pasaría a nombrar solo los 5 — y
sería una alerta que se lee, en vez de una que se archiva.

---

## 6. SIPAR entrega sus libros en otro formato, y ese formato no trae el IVA

**El hallazgo.** Cuatro de los cinco clientes entregan su libro como planilla
RG 90 en Excel (`RG COMPRAS MARZO 2026 - FUMIPRO SA.xlsx`). **SIPAR no.** Los
suyos son archivos de texto con el nombre que les pone la DNIT:

```
80012742_202603_COMPRAS_304254_1.txt
80012742_202606_VENTAS_438202_1.txt
```

Separados por tabulaciones, codificados en Latin-1, con doce columnas:

```
CDC | RUC vendedor | Razón social | Fecha | Tipo | Nº comprobante | Timbrado | TOTAL | s n n n
```

**Por qué importa:** ese formato **no trae el desglose del IVA**. Solo el total
del comprobante. Y sin saber la tasa, el IVA no se puede deducir — un total de
Gs. 586.710 puede ser 10% o 5%, y no hay forma de distinguirlo desde el archivo.

Por eso SIPAR es el único cliente con documentos cargados (216) y **cero
liquidaciones de IVA**. No es una falla del sistema: es que el dato no está en
los archivos que SIPAR entrega.

Se revisó si tenían la planilla en otro lado: el único Excel entre sus libros es
un balance, no un libro de compras.

**Las preguntas:**

> ¿SIPAR entrega también la planilla RG 90 en Excel, o su libro siempre viene en
> este formato de texto?

> Si siempre viene así: ¿cómo se liquida hoy el IVA de SIPAR? ¿Lo calcula SIGA a
> partir de estos archivos, o hay otro documento con el desglose?

**Qué cambia según la respuesta.** Si existe la planilla y solo falta ubicarla,
SIPAR queda igual que los otros cuatro sin tocar una línea de código. Si su
libro siempre viene así, hay que decidir de dónde sale la tasa de cada
comprobante antes de poder calcular su IVA — y hasta entonces el sistema no debe
inventarlo.

---

## Lo que el sistema ya encontró, para que sirva de contexto

Sobre los 5 clientes del piloto, sin que nadie revisara nada a mano:

| | Cantidad |
|---|---|
| Comprobantes con **riesgo de multa** (crédito fiscal de más) | **49** |
| Comprobantes donde el cliente pagó de más | 16 |
| Comprobantes que no cierran consigo mismos | 101 |

El IVA en riesgo suma **Gs. 73** en total. Es poco dinero, y decirlo es parte de
la respuesta: **el problema no es el monto, es que la DNIT cruza estos datos
contra los del proveedor**, y una diferencia dispara una revisión que cuesta
mucho más que 73 guaraníes.

El caso más grande: **ECOAGRO, período 2026-03**, comprobante
`001-001-0000028` de AGROSOL PARAGUAY S.A. — sobre Gs. 1.548.000 al 10%, la
factura declara Gs. 140.739 de IVA y la regla da Gs. 140.727. Doce guaraníes de
crédito fiscal de más.
