# Manual de procedimiento de documentos — EFFORT Consultora E.A.S.

**Versión 1.1 · 6 de octubre de 2026 · Vigente para todo documento nuevo.**

> Fuente del Word que se entrega a Laura y Lili (`Manual de procedimiento de documentos - EFFORT.docx`). Si una regla cambia, se actualiza este archivo, se anota en el control de cambios del final y se vuelve a generar el Word (también está en esta carpeta).

## Hoja rápida — para imprimir y tener a mano

Diez reglas. Si solo se recuerda esto, el 90 % del orden está asegurado.

1. **Un documento, un lugar, un nombre.** Nunca dos copias del mismo archivo.
2. **La carpeta es el período que el documento declara, no el día en que se guardó.** El IVA de marzo presentado en abril va en 03 MARZO.
3. **El nombre dice qué es:** `QUÉ ES + PERÍODO + CLIENTE`. Período mensual MMAAAA (032026), anual AAAA (2026). Ejemplo: `DDJJ IVA 032026 FUMIPRO SA.pdf`.
4. **La prueba de presentación se baja en PDF desde Marangatú.** Nunca una foto, una captura ni un escaneo: el sistema no los puede leer.
5. **Las planillas RG 90 se guardan siempre como .xlsx**, nunca .xls.
6. **Una planilla corregida empieza con CORRECCION.** Una versión nueva de cualquier otro documento se guarda con el MISMO nombre en el MISMO lugar (OneDrive guarda el historial).
7. **Prohibido en un nombre:** copia, (1), nuevo, final, ok, IMG, WhatsApp, scan.
8. **Nada se borra.** Si hay una duda, el archivo se guarda en la carpeta `ZZ A CLASIFICAR` del cliente (una carpeta como cualquier otra, dentro de la carpeta de cada cliente) y se avisa.
9. **Todo se guarda en la carpeta del cliente en OneDrive.** Nada se queda en el escritorio, en Descargas, en el correo ni en un chat.
10. **Después de guardar, mirar la pantalla Faltantes** del sistema: si algo falta o no tiene comprobante, ahí aparece.

### El árbol de carpetas, en una mirada

```
CLIENTES/
└─ 133 NOMBRE DEL CLIENTE SA/
   ├─ 00 PERMANENTE/                      lo que no tiene año
   │   ├─ SOCIETARIO/
   │   └─ TRIBUTARIO/
   ├─ PERIODO 2026/                       el año al que corresponden los documentos
   │   ├─ DOCUMENTOS CONTABLES/
   │   │   ├─ 01 ENERO/ … 12 DICIEMBRE/   documentos de cada mes
   │   │   └─ CIERRE 2026/                impuestos y balances anuales
   │   ├─ DOCUMENTOS LEGALES Y SOCIETARIOS/
   │   ├─ DOCUMENTOS LABORALES/           IPS y MTESS
   │   └─ DOCUMENTOS VARIOS/
   └─ ZZ A CLASIFICAR/                    lo que no se sabe dónde va

CLIENTES/ZZ A CLASIFICAR/                 además, una general: para lo que ni siquiera se sabe de qué cliente es
```

## 1. Para qué sirve este manual

EFFORT guarda los documentos de más de cien clientes en un único OneDrive. Cuando cada persona los guarda a su manera, el costo aparece más tarde: documentos que no se encuentran, el mismo archivo repetido veinte veces, declaraciones guardadas en el cliente equivocado y un sistema de control que no puede saber qué hay en cada carpeta.

Este manual fija **una sola forma correcta** de guardar, nombrar y ordenar todo documento nuevo. No describe cómo se trabajó hasta hoy: define cómo se trabaja de ahora en adelante. Es la norma de la casa. Cualquier duda se resuelve acá, y cualquier cambio lo aprueban Laura, Lili o Daniel y queda anotado al final.

**Alcance:** vale para todo documento nuevo. Lo que ya está guardado no se toca: ordenarlo, si se decide hacerlo, es un trabajo aparte y lo hace una persona del equipo.

### Los cuatro principios

- **Una sola copia.** Si un documento existe en dos lugares, alguien va a trabajar sobre el equivocado. Si se necesita en dos lugares, se enlaza; no se copia.
- **El período manda.** Todo lo que declara el mes de marzo vive junto, sin importar cuándo se hizo, cuándo se presentó o cuándo se pagó. Así una auditoría se resuelve abriendo una sola carpeta.
- **El nombre se entiende solo.** Un archivo que sale por correo, se descarga o se imprime pierde su carpeta. Su nombre tiene que decir qué es, de cuándo y de quién.
- **Nada se borra, nada se pisa.** Un documento mal guardado se mueve y se corrige. Un documento actualizado se guarda con el mismo nombre para que OneDrive conserve el historial.

## 2. La estructura de carpetas

### 2.1 La carpeta del cliente

Dentro de `CLIENTES` hay una carpeta por cliente, con este formato exacto:

```
NNN NOMBRE DEL CLIENTE

Ejemplos:  133 FUMIPRO SA   ·   134 MARIA GOMEZ   ·   135 AGRO DEL ESTE EAS
```

- **NNN** es el código del cliente, de tres cifras, en orden de alta. El próximo disponible es el **133**.
- **Los códigos no se reutilizan.** Un cliente dado de baja conserva su código para siempre. (Hoy no existen el 045, el 070 ni el 099: se dejan vacíos.)
- **El nombre** se escribe en mayúsculas, como figura en la constancia de RUC, sin puntos: `SA`, `SRL`, `EAS`, `SAS`.
- **El nombre de la carpeta no se cambia nunca** una vez creada: el sistema reconoce al cliente por su carpeta.

### 2.2 Qué hay dentro, carpeta por carpeta

| Carpeta | Qué va adentro |
|---|---|
| 00 PERMANENTE / SOCIETARIO | Lo que no cambia con el año: estatuto y sus modificaciones, poderes, registro de accionistas, contratos vigentes. |
| 00 PERMANENTE / TRIBUTARIO | Constancia de RUC, cédula tributaria, certificado de cumplimiento tributario (CCT), timbrados y habilitaciones. |
| PERIODO AAAA | Una carpeta por año. **AAAA es el año al que corresponden los documentos**, no el año en que se guardan. El IVA de diciembre de 2025 presentado en enero de 2026 va en PERIODO 2025. |
| DOCUMENTOS CONTABLES / 01 ENERO … 12 DICIEMBRE | Todo lo del mes: declaración de IVA, planillas RG 90, libros, boletas de pago, retenciones, extractos, facturas, notas de crédito. Se escribe siempre con dos cifras y el mes: `01 ENERO`, `09 SETIEMBRE`, `12 DICIEMBRE`. |
| DOCUMENTOS CONTABLES / CIERRE AAAA | Lo anual del ejercicio AAAA: declaración del IRE o del IRP, estados financieros, cálculo del impuesto del cierre, boleta de pago anual. |
| DOCUMENTOS LEGALES Y SOCIETARIOS | Lo societario del año: la carpeta `ASAMBLEA AAAA` (convocatoria, acta, memoria, informe del síndico, asistencia), actas de directorio, presentaciones por SIARA. |
| DOCUMENTOS LABORALES | Subcarpetas `IPS` (aportes y estados de cuenta) y `MTESS` (libros laborales y planillas). |
| DOCUMENTOS VARIOS | Lo que no es contable, legal ni laboral: la subcarpeta `FACTURACION EFFORT` (los honorarios que EFFORT le factura al cliente), pedidos de bancos, préstamos, correspondencia. |
| ZZ A CLASIFICAR (dentro del cliente) | Es una carpeta más, al final de la lista (por eso empieza con ZZ). Lo único que puede estar fuera de su lugar: documentos de un cliente conocido de los que no se sabe el período o el tipo. Se vacía **una vez por semana** (ver 4.8). |
| CLIENTES / ZZ A CLASIFICAR (general) | Una única carpeta, al lado de las carpetas de los clientes, para documentos de los que **no se sabe ni de qué cliente son**. También se vacía cada semana. |

### 2.3 Subcarpetas dentro de un mes: solo en estos tres casos

- `NC EMITIDAS MMAAAA` y `NC RECIBIDAS MMAAAA`: las notas de crédito, **solo si son más de cinco** en el mes. Si son cinco o menos, van sueltas en la carpeta del mes.
- `IMPUTACION MASIVA`: los archivos de imputación masiva y los zip del SET, tal como los entrega el sistema. **Estos no se renombran.**
- No se crean otras subcarpetas dentro de un mes. Si parece hacer falta una, se consulta primero con Laura o Lili.

> Las carpetas se crean cuando hacen falta, no por adelantado. La carpeta `PERIODO AAAA` y sus cuatro carpetas se crean al empezar el año (o al dar de alta al cliente); la carpeta de cada mes, cuando llega el primer documento de ese mes.

## 3. Cómo se nombra un archivo

### 3.1 La fórmula

```
QUÉ ES   DETALLE (si hace falta)   PERÍODO   CLIENTE . extensión

DDJJ IVA 032026 FUMIPRO SA.pdf
EXTRACTO ITAU USD 042026 FUMIPRO SA.pdf
RG COMPRAS 062026 FUMIPRO SA.xlsx
```

- **Qué es:** siempre primero, en mayúsculas, con las palabras de las tablas de 3.3. Es lo que permite al sistema (y a cualquier persona) reconocer el documento.
- **Detalle:** banco, número de factura, proveedor, cuota. Va entre el «qué es» y el período.
- **Período:** mensual `MMAAAA` en seis cifras, sin separadores (`032026` es marzo de 2026). Anual `AAAA` (`2026`).
- **Cliente:** el nombre de la carpeta sin el código (`FUMIPRO SA`). **Siempre**: es lo que permite reconocer el archivo cuando sale de su carpeta.
- **Un solo espacio** entre palabras, ninguno antes del punto ni al final. Extensión en minúscula.
- **No usar** estos signos, que OneDrive no acepta o que confunden: `\ / : * ? " < > | # % & ~`. Tildes y eñes sí se pueden usar.
- **Largo:** hasta 80 caracteres el nombre. Si queda más largo, se abrevia el detalle, nunca el «qué es».

### 3.2 Las palabras reservadas: cuidado con ellas

El sistema decide qué tipo de documento es **por las palabras del nombre**. Estas palabras tienen un significado fijo. Usarlas para otra cosa hace que el documento se clasifique mal, y un documento mal clasificado es peor que uno sin clasificar porque nadie lo sospecha.

| Palabra | El sistema entiende | Entonces |
|---|---|---|
| EXTRACTO | Extracto bancario | Solo para bancos y tarjetas. Para IPS: `IPS APORTES 012026`, no «extracto IPS». |
| PLANILLA | Declaración jurada | Solo para planillas de impuestos. Para sueldos: `SUELDOS 2024 CLIENTE`, no «planilla salarial». |
| COMPRAS / VENTAS | Libro de compras o de ventas | Solo para los libros y las planillas RG 90. Una lista de compras a proveedores no se llama así. |
| FACTURA | Factura de compra (salvo que diga VENTA) | Escribir siempre `FACTURA COMPRA` o `FACTURA VENTA`. |
| FORMULARIO + número | Declaración jurada | Para retenciones se usa `RETENCION` antes del formulario (`RETENCION IVA FORM 122`). |
| ACTA, ASAMBLEA, DIRECTORIO | Acta | Solo para documentos societarios. |
| CERT, CERTIFICADO, CCT | Certificado | Solo para certificados. |
| LIQUIDACION, CALCULO, PROFORMA | Cálculo del impuesto | Un borrador de una declaración se llama `CALCULO …`, **nunca `DDJJ …`**. |
| BOLETA DE PAGO | Comprobante de pago | Siempre seguido del impuesto: `BOLETA DE PAGO IVA …`. |

Los documentos laborales (IPS, MTESS) y otros que no tienen un tipo propio en el sistema figuran como «Otro». Está bien: la carpeta los identifica. Lo que no está bien es que figuren con un tipo equivocado.

### 3.3 Nombre exacto de cada documento

### Documentos del mes — carpeta del mes del período (ejemplo: 03 MARZO)

| Documento | Nombre exacto (y ejemplo) |
|---|---|
| Declaración jurada de IVA, presentada (Form. 120) | `DDJJ IVA MMAAAA CLIENTE.pdf` → DDJJ IVA 032026 FUMIPRO SA.pdf |
| Declaración rectificativa (Form. 145) | `DDJJ IVA MMAAAA RECTIFICATIVA CLIENTE.pdf` → DDJJ IVA 032026 RECTIFICATIVA FUMIPRO SA.pdf |
| Presentación de la RG 90 (Form. 241) | `TALON RG 90 MMAAAA CLIENTE.pdf` → TALON RG 90 032026 FUMIPRO SA.pdf |
| Planilla RG 90 de compras | `RG COMPRAS MMAAAA CLIENTE.xlsx` → RG COMPRAS 032026 FUMIPRO SA.xlsx |
| Planilla RG 90 de ventas | `RG VENTAS MMAAAA CLIENTE.xlsx` → RG VENTAS 032026 FUMIPRO SA.xlsx |
| Planilla RG 90 corregida | `CORRECCION RG COMPRAS MMAAAA CLIENTE.xlsx` → CORRECCION RG COMPRAS 032026 FUMIPRO SA.xlsx |
| Libro de compras o ventas del SIGA | `LIBRO COMPRAS MMAAAA CLIENTE.pdf` · `LIBRO VENTAS MMAAAA CLIENTE.pdf` |
| Cálculo o borrador del IVA | `CALCULO IVA MMAAAA CLIENTE.xlsx` → CALCULO IVA 032026 FUMIPRO SA.xlsx |
| Boleta de pago de un impuesto | `BOLETA DE PAGO IVA MMAAAA CLIENTE.pdf` → BOLETA DE PAGO IVA 032026 FUMIPRO SA.pdf. Va en el mes del período que paga, aunque se haya pagado después. |
| Anticipo del IRE | `BOLETA DE PAGO ANTICIPO IRE CUOTA 2 DE 4 MMAAAA CLIENTE.pdf`. Va en el mes del vencimiento de esa cuota. |
| Retención de IVA (Form. 122) | `RETENCION IVA FORM 122 MMAAAA CLIENTE.pdf` |
| Retención de renta (Form. 525) | `RETENCION RENTA FORM 525 MMAAAA CLIENTE.pdf` |
| Retención del IDU (Form. 526) | `RETENCION IDU FORM 526 MMAAAA CLIENTE.pdf` |
| Extracto bancario | `EXTRACTO BANCO MMAAAA CLIENTE.pdf` → EXTRACTO ITAU 032026 FUMIPRO SA.pdf. En dólares: `EXTRACTO ITAU USD 032026 …`. Tarjeta: `EXTRACTO TC ITAU 032026 …`. |
| Factura de compra | `FACTURA COMPRA NRO PROVEEDOR MMAAAA CLIENTE.pdf` → FACTURA COMPRA 001-001-0000245 PROVEEDOR SA 032026 FUMIPRO SA.pdf |
| Factura de venta | `FACTURA VENTA NRO MMAAAA CLIENTE.pdf` |
| Nota de crédito | `NOTA DE CREDITO NRO CLIENTE.pdf` → NOTA DE CREDITO 001-001-0000245 FUMIPRO SA.pdf |
| Recibo | `RECIBO NRO DETALLE MMAAAA CLIENTE.pdf` |

### Documentos anuales — carpeta CIERRE AAAA del ejercicio

| Documento | Nombre exacto (y ejemplo) |
|---|---|
| Declaración jurada del IRE, presentada (Form. 500) | `DDJJ IRE AAAA CLIENTE.pdf` → DDJJ IRE 2025 FUMIPRO SA.pdf |
| Declaración jurada del IRP (personas físicas) | `DDJJ IRP AAAA CLIENTE.pdf` |
| Estados financieros firmados | `EEFF AAAA CLIENTE.pdf` → EEFF 2025 FUMIPRO SA.pdf |
| Presentación de los estados financieros ante la DNIT (Form. 158) | `EEFF AAAA PRESENTADO FORM 158 CLIENTE.pdf` |
| Cálculo del impuesto del cierre | `CALCULO IRE AAAA CLIENTE.xlsx` · `CALCULO IRP AAAA CLIENTE.xlsx` |
| Boleta de pago del IRE | `BOLETA DE PAGO IRE AAAA CLIENTE.pdf` |

### Documentos legales, laborales y varios

| Documento | Dónde y nombre exacto |
|---|---|
| Estatuto social | 00 PERMANENTE / SOCIETARIO → `ESTATUTO SOCIAL CLIENTE.pdf`. Una modificación: `ESTATUTO MODIFICACION AAAA CLIENTE.pdf`. |
| Poder | 00 PERMANENTE / SOCIETARIO → `PODER APODERADO AAAA CLIENTE.pdf` |
| Contrato | 00 PERMANENTE / SOCIETARIO → `CONTRATO DETALLE AAAA CLIENTE.pdf` |
| Constancia de RUC, cédula tributaria | 00 PERMANENTE / TRIBUTARIO → `CONSTANCIA RUC AAAA CLIENTE.pdf` · `CEDULA TRIBUTARIA AAAA CLIENTE.pdf` |
| Certificado de cumplimiento tributario | 00 PERMANENTE / TRIBUTARIO → `CCT MMAAAA CLIENTE.pdf` (mes y año de emisión). Cada renovación es un archivo nuevo; no se pisa el anterior. |
| Asamblea | DOCUMENTOS LEGALES Y SOCIETARIOS / ASAMBLEA AAAA → `CONVOCATORIA ASAMBLEA AAAA CLIENTE.pdf` · `ACTA DE ASAMBLEA AAAA CLIENTE.pdf` · `MEMORIA DEL DIRECTORIO AAAA CLIENTE.pdf` · `INFORME DEL SINDICO AAAA CLIENTE.pdf` |
| Acta de directorio | DOCUMENTOS LEGALES Y SOCIETARIOS → `ACTA DE DIRECTORIO ASUNTO AAAA CLIENTE.pdf` |
| IPS | DOCUMENTOS LABORALES / IPS → `IPS APORTES MMAAAA CLIENTE.pdf` · `IPS ESTADO DE CUENTA MMAAAA CLIENTE.pdf` |
| MTESS | DOCUMENTOS LABORALES / MTESS → `MTESS LIBRO LABORAL AAAA CLIENTE.pdf` · `MTESS LIBRO LABORAL MENSUAL MMAAAA CLIENTE.pdf` |
| Honorarios que EFFORT factura al cliente | DOCUMENTOS VARIOS / FACTURACION EFFORT → `FACTURA COMPRA EFFORT NRO MMAAAA CLIENTE.pdf` (para el cliente es una compra). |
| Cualquier otro documento | Se aplica la fórmula: `QUÉ ES DETALLE PERÍODO CLIENTE`. Si no se sabe dónde va, a ZZ A CLASIFICAR. |

### 3.4 Fotos, capturas y escaneos

Una foto o una captura de pantalla **no es un documento válido** para guardar: no se puede buscar ni leer. Siempre se pide o se baja el original (el PDF del proveedor, el comprobante de Marangatú, el Excel del cliente). Si el cliente solo puede mandar una foto y no hay otra forma, se guarda con su nombre correcto —`FACTURA COMPRA PROVEEDOR 032026 CLIENTE.jpg`— y se avisa al cliente que la próxima vez mande el original.

## 4. Procedimientos paso a paso

### 4.1 Llega un documento (del cliente, por correo, por WhatsApp o de un portal)

1. Identificar **a qué cliente** y **a qué período** corresponde. El período es el que declara el documento, no el día en que llegó.
2. Si es una foto, una captura o un escaneo y existe el original, **pedir o bajar el original** (3.4).
3. Ponerle el nombre correcto **antes de guardarlo**, mientras todavía está en Descargas o en el chat (3.3).
4. Guardarlo en la carpeta que indica la tabla de 3.3, dentro del cliente y del año correctos. Si falta la carpeta del mes, se crea (con el formato `MM MES`).
5. Si no se sabe a qué período o tipo pertenece: guardarlo en la carpeta `ZZ A CLASIFICAR` del cliente y avisar al responsable. Si ni siquiera se sabe de qué cliente es: guardarlo en `CLIENTES / ZZ A CLASIFICAR` (la general) y avisar.
6. Comprobar que no haya ya una copia: abrir la carpeta y mirar. Si la hay y es idéntica, no se guarda otra.
7. Borrar el archivo del escritorio, de Descargas o del chat. **Solo de ahí, nunca de OneDrive.**

### 4.2 Cierre mensual del IVA de un cliente

1. Reunir los documentos del mes (facturas, extractos, notas de crédito) y guardarlos en la carpeta del mes (4.1).
2. Preparar las planillas RG 90 de compras y de ventas y guardarlas como **.xlsx** con su nombre (`RG COMPRAS …`, `RG VENTAS …`). Si el programa las entrega como .xls: Archivo → Guardar como → .xlsx.
3. Guardar el cálculo del IVA como `CALCULO IVA MMAAAA CLIENTE.xlsx`.
4. Presentar la declaración (Form. 120) y la RG 90 (Form. 241) en Marangatú.
5. **Bajar de Marangatú el PDF de cada constancia** y guardarlos como `DDJJ IVA MMAAAA CLIENTE.pdf` y `TALON RG 90 MMAAAA CLIENTE.pdf`. Nunca una captura ni una foto.
6. Pagar y guardar la boleta como `BOLETA DE PAGO IVA MMAAAA CLIENTE.pdf` **en el mes del período que paga**.
7. Abrir el sistema, ir a **Faltantes** y apretar **Actualizar ahora**. Comprobar que el cliente ya no figura con algo pendiente, y que en **Vencimientos** aparece presentado con su comprobante.

Si algo no aparece, no se vuelve a guardar el archivo: se revisa el nombre, la carpeta y que el PDF tenga texto seleccionable (4.6).

### 4.3 Corregir algo que ya se presentó

1. **Planilla RG 90:** guardar la planilla nueva como `CORRECCION RG COMPRAS MMAAAA CLIENTE.xlsx` (o `RG VENTAS`) en la carpeta del mes **y dejar la anterior donde está**. El sistema usa la que empieza con CORRECCION.
2. **Declaración (Form. 120):** presentar la rectificativa (Form. 145), bajar su PDF y guardarlo como `DDJJ IVA MMAAAA RECTIFICATIVA CLIENTE.pdf` en el mes del período. La declaración original queda donde está.
3. **Cualquier otro documento actualizado:** guardar la versión nueva con el **mismo nombre y en el mismo lugar**. OneDrive conserva el historial de versiones. Nunca `V2`, `final`, `copia` ni `actualizado`.

### 4.4 Cierre anual de un cliente (ejercicio AAAA)

1. Todo va en `PERIODO AAAA / DOCUMENTOS CONTABLES / CIERRE AAAA`, **aunque se haga en el año siguiente**.
2. Guardar los estados financieros firmados (`EEFF AAAA CLIENTE.pdf`) y el cálculo del impuesto (`CALCULO IRE AAAA …`).
3. Presentar la declaración del IRE (Form. 500) o del IRP y bajar su PDF de Marangatú: `DDJJ IRE AAAA CLIENTE.pdf`.
4. Presentar los estados financieros ante la DNIT (Form. 158) y guardar la constancia: `EEFF AAAA PRESENTADO FORM 158 CLIENTE.pdf`.
5. Guardar la boleta de pago: `BOLETA DE PAGO IRE AAAA CLIENTE.pdf`.
6. Si hay asamblea: todo en `DOCUMENTOS LEGALES Y SOCIETARIOS / ASAMBLEA AAAA`.
7. Comprobar en **Vencimientos** que el IRE y los estados financieros figuran presentados.

> Los estados financieros en Excel con macros (.xlsm) suelen tener vínculos a otros archivos. Antes de mover o renombrar un archivo de un balance, abrir el balance y comprobar que sigue funcionando (4.7).

### 4.5 Alta de un cliente nuevo

1. Asignar el próximo código libre (hoy, **133**) y anotarlo en la lista de clientes.
2. Crear la carpeta `NNN NOMBRE` dentro de `CLIENTES` (2.1).
3. Dentro, crear: `00 PERMANENTE` (con `SOCIETARIO` y `TRIBUTARIO`), `PERIODO AAAA` del año en curso (con `DOCUMENTOS CONTABLES`, `DOCUMENTOS LEGALES Y SOCIETARIOS`, `DOCUMENTOS LABORALES` y `DOCUMENTOS VARIOS`) y `ZZ A CLASIFICAR`.
4. Guardar la constancia de RUC en `00 PERMANENTE / TRIBUTARIO`.
5. Dar de alta al cliente en el sistema: pantalla **Clientes → Nuevo cliente** (nombre, RUC completo con dígito verificador, tipo de persona, régimen tributario).
6. **Avisar a Daniel** con el código, el RUC, el régimen y las obligaciones del cliente (IVA, RG 90, IRE, estados financieros) para que conecte la carpeta y las obligaciones al sistema. Hoy esto no se puede hacer desde la pantalla.

### 4.6 El sistema no encuentra un documento: qué revisar, en este orden

1. ¿El nombre empieza con las palabras de 3.3 y no contiene una palabra reservada usada de otra forma (3.2)?
2. ¿Está en el cliente correcto, en el año del período y en el mes del período?
3. ¿Es un **PDF con texto**? Abrirlo e intentar seleccionar una palabra con el mouse. Si no se puede seleccionar, es una imagen: el sistema no puede leerlo. Bajar el original de Marangatú.
4. ¿Pesa menos de 8 MB? El sistema **no lee** los PDF de 8 MB o más, y **no copia** los de más de 25 MB. Una constancia de Marangatú pesa unos 100 KB: si pesa más, se imprimió o se escaneó. Bajar el original.
5. ¿Es una planilla RG 90 en .xlsx y de menos de 15 MB? Un .xls no se puede leer.
6. Esperar hasta 15 minutos (el sistema se actualiza solo) o apretar **Actualizar ahora** en Faltantes (unos 25 segundos).
7. Si después de todo esto sigue sin aparecer, avisar a Daniel con el nombre del cliente y del archivo.

### 4.7 Excel con vínculos a otros archivos

Algunos Excel (sobre todo los balances `EEFF …xlsm` y las liquidaciones del IRP) tienen fórmulas que apuntan a otros archivos. Si el archivo de destino se mueve o se renombra, la fórmula se rompe sin avisar y el balance muestra un resultado equivocado.

- **Nunca mover ni renombrar** un archivo del que dependen otros Excel, sin avisar a quien arma el balance.
- Al empezar un ejercicio nuevo, copiar **el libro completo** y revisar los vínculos (Datos → Editar vínculos) antes de usarlo.
- Guardar siempre el libro y todos sus archivos vinculados en la misma carpeta `CIERRE AAAA`.

### 4.8 Rutina semanal: vaciar las carpetas ZZ A CLASIFICAR

1. Una vez por semana (el viernes), la persona responsable abre la carpeta `ZZ A CLASIFICAR` general y la de cada cliente que tenga archivos.
2. Para cada archivo: identificar qué es, de qué cliente y de qué período, **moverlo** (no copiarlo) a su lugar con su nombre correcto.
3. Lo que no se logra identificar se consulta con quien lo guardó. **No se borra.**
4. El objetivo es que todas las carpetas `ZZ A CLASIFICAR` estén vacías cada fin de semana.

### 4.9 Un cliente se da de baja

1. Avisar a Laura, Lili o Daniel.
2. En el sistema, pantalla **Clientes**: apretar **Editar** en la fila del cliente y desmarcar **«Cliente activo»**. No se borra: queda guardado y se puede reactivar.
3. **La carpeta no se mueve, no se renombra y no se borra.** Su código queda ocupado para siempre.

## 5. Listas de control

### 5.1 Por cada cliente, cada mes

- El IVA del mes está presentado y su PDF guardado como `DDJJ IVA`, en la carpeta del mes del período.
- La RG 90 está presentada y el `TALON RG 90` guardado; las planillas en .xlsx.
- La boleta de pago está guardada en el mes del período que paga.
- Los extractos bancarios del mes están guardados.
- No hay nada en `ZZ A CLASIFICAR`.
- En **Faltantes** el cliente no figura con nada pendiente; en **Vencimientos**, todo lo vencido figura presentado.

### 5.2 Cada semana

- Vaciar `ZZ A CLASIFICAR` (4.8).
- Mirar **Alertas** y **Vencimientos** de los clientes propios.

### 5.3 Cada año

- En diciembre: crear `PERIODO AAAA` del año siguiente para cada cliente, con sus cuatro carpetas.
- Cierre del ejercicio: todo en `CIERRE AAAA` (4.4).
- Revisar que los clientes dados de baja figuran como Inactivos en el sistema.

## 6. Cómo controla el sistema lo que se guarda

- **Lee, no modifica.** El sistema EFFORT Control 360 lee los nombres y las carpetas. Nunca renombra, mueve ni borra un archivo de EFFORT. Clasificar un documento cambia una etiqueta dentro del sistema; el archivo queda exactamente igual.
- **Se actualiza solo cada 15 minutos.** También se puede apretar **Actualizar ahora** (en Faltantes), que tarda unos 25 segundos.
- **Sabe qué está presentado leyendo el PDF de la DNIT**, no el nombre del archivo: busca el número de orden y la fecha de presentación. Un archivo mal nombrado no hace que algo figure como presentado sin estarlo; lo peor que puede pasar es que quede como «Otro» o «sin comprobante».
- **Decide el período de una planilla RG 90 leyendo su contenido**, no su nombre. Aun así el nombre y la carpeta tienen que ser correctos para que las personas la encuentren.
- **Si hay dos versiones de una planilla**, usa la que empieza con `CORRECCION` y, si ninguna lo dice, la más reciente.
- **Muestra lo que falta** en la pantalla Faltantes y avisa en Alertas los vencimientos sin comprobante.

### Lo que el sistema NO puede leer

- PDF que son imágenes (escaneos, fotos, capturas): no tienen texto.
- PDF de 8 MB o más (no los lee) y archivos de más de 25 MB (no los copia).
- Excel .xls (formato viejo): hay que guardarlos como .xlsx.
- Planillas RG 90 de 15 MB o más.

## 7. Lo que está prohibido

- Guardar un documento en el escritorio, en Descargas, en el correo o en un chat como lugar definitivo.
- Dejar dos copias del mismo documento, aunque sea «por las dudas».
- Nombres con `copia`, `(1)`, `nuevo`, `final`, `ok`, `actualizado`, `IMG`, `WhatsApp`, `scan`, `Documento1`.
- Guardar una foto, una captura o un escaneo en lugar del original.
- Mover o renombrar un archivo del que dependen otros Excel sin avisar.
- **Borrar un archivo de OneDrive.** Ante una duda: `ZZ A CLASIFICAR` y aviso.
- Cambiar el nombre de la carpeta de un cliente.
- Compartir por enlace la carpeta entera de un cliente. Se comparte solo el archivo necesario, con permiso de solo lectura.
- Crear carpetas nuevas que no están en este manual, sin consultar.

## 8. Quién hace qué

Propuesta de reparto; Laura y Lili la ajustan a cómo se organiza el equipo.

| Quién | Responsabilidad |
|---|---|
| Quien recibe o prepara el documento | Lo nombra y lo guarda en su lugar **en el momento**, siguiendo 4.1. No lo deja «para después». |
| El responsable del cliente | El cierre mensual y anual del cliente (4.2 y 4.4), el control en el sistema y vaciar `ZZ A CLASIFICAR` cada semana. |
| Laura y Lili | Altas y bajas de clientes, decisiones sobre dudas de este manual y **aprobación de cualquier cambio al manual**. |
| Daniel | Conectar cada cliente nuevo y sus obligaciones al sistema, y resolver lo que el sistema no encuentra (4.6). |

## 9. Un cliente completo, como debe quedar

```
133 AGRO DEL ESTE SA/
├─ 00 PERMANENTE/
│   ├─ SOCIETARIO/
│   │   ├─ ESTATUTO SOCIAL AGRO DEL ESTE SA.pdf
│   │   └─ PODER JUAN PEREZ 2024 AGRO DEL ESTE SA.pdf
│   └─ TRIBUTARIO/
│       ├─ CONSTANCIA RUC 2026 AGRO DEL ESTE SA.pdf
│       └─ CCT 052026 AGRO DEL ESTE SA.pdf
├─ PERIODO 2026/
│   ├─ DOCUMENTOS CONTABLES/
│   │   ├─ 03 MARZO/
│   │   │   ├─ DDJJ IVA 032026 AGRO DEL ESTE SA.pdf
│   │   │   ├─ TALON RG 90 032026 AGRO DEL ESTE SA.pdf
│   │   │   ├─ RG COMPRAS 032026 AGRO DEL ESTE SA.xlsx
│   │   │   ├─ RG VENTAS 032026 AGRO DEL ESTE SA.xlsx
│   │   │   ├─ CALCULO IVA 032026 AGRO DEL ESTE SA.xlsx
│   │   │   ├─ BOLETA DE PAGO IVA 032026 AGRO DEL ESTE SA.pdf
│   │   │   ├─ EXTRACTO ITAU 032026 AGRO DEL ESTE SA.pdf
│   │   │   └─ NC EMITIDAS 032026/
│   │   │       └─ NOTA DE CREDITO 001-001-0000245 AGRO DEL ESTE SA.pdf
│   │   ├─ 04 ABRIL/ …
│   │   └─ CIERRE 2026/ …
│   ├─ DOCUMENTOS LEGALES Y SOCIETARIOS/
│   │   └─ ASAMBLEA 2026/
│   │       └─ ACTA DE ASAMBLEA 2026 AGRO DEL ESTE SA.pdf
│   ├─ DOCUMENTOS LABORALES/
│   │   ├─ IPS/    └─ MTESS/
│   └─ DOCUMENTOS VARIOS/
│       └─ FACTURACION EFFORT/
│           └─ FACTURA COMPRA EFFORT 783 032026 AGRO DEL ESTE SA.pdf
└─ ZZ A CLASIFICAR/                      (vacía)
```

## 10. Control de cambios

Este manual se actualiza **solo** con la aprobación de Laura, Lili o Daniel. Cada cambio se anota acá, con fecha y motivo.

| Versión | Fecha | Cambio |
|---|---|---|
| 1.1 | 6 de octubre de 2026 | La carpeta de dudas pasa de «99 A CLASIFICAR» a «ZZ A CLASIFICAR»: «99» se confundía con un código de cliente (el 099). Se agrega la carpeta general `CLIENTES / ZZ A CLASIFICAR` para documentos de los que no se sabe ni de qué cliente son. |
| 1.0 | 6 de octubre de 2026 | Primera versión. Amplía la «Guía de nombres de archivos y carpetas» del 1 de octubre de 2026, que sigue vigente: este manual agrega la estructura de carpetas, el principio del período y los procedimientos. |
