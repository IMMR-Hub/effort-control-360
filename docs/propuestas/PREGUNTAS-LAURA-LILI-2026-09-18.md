# Preguntas para Laura y Lilian — 2026-09-18

Documento para pasar tal cual a Laura Sosa y Lilian Laconich. Cierra las
preguntas B1, B3, B4 y algunas de B7 de `docs/ROADMAP-MAESTRO.md`. Cada
pregunta indica qué cambia en el sistema según la respuesta.

---

## 0. La más importante: nombres de archivo (`docs/GUIA-NOMENCLATURA-ARCHIVOS.md`)

De 3.963 documentos de los 5 clientes, **2.415 quedan clasificados como
"Otro"** porque el nombre del archivo no dice qué es (`ENERO.pdf`,
`fc 23.pdf`). Hay una guía ya escrita, lista para adoptar — no pide cambiar
cómo trabajan, solo nombrar los archivos **nuevos** de una forma que el
sistema ya reconoce hoy (`RG COMPRAS`, `DDJJ IVA`, `TALON RG 90`, etc. — está
el detalle completo en el archivo).

**Preguntas para decidir:**
1. ¿La estructura de la guía se parece a cómo ya trabajan, o prefieren otra?
2. ¿Quién nombraría así los archivos nuevos — cada responsable, o una sola
   persona designada?

**Importante:** el sistema **nunca renombra, mueve ni borra** un archivo de
ustedes — eso lo decide y lo hace EFFORT, si quiere, para los archivos viejos.
La guía es sobre archivos nuevos. Adjunto el archivo completo aparte.

---

## 0-bis. URGENTE: tres archivos guardados en la carpeta de otro cliente

Encontrado el 2026-09-20 al abrir un formulario 120 para verificar un cálculo.
**Tres declaraciones están en la carpeta de un cliente pero por dentro son de
otro contribuyente:**

| Está en la carpeta de | Archivo | Pero por dentro dice |
|---|---|---|
| COPESA | `120-07-2026.pdf` | RUC 80135322 — **MACOMA ENVIRONMENTAL TECHNOLOGIES** |
| COPESA | `ACUSE DDJJ IVA 102023 MARIO ANTONIO VILALBA VILLALBA .pdf` | RUC 7243805 — una persona física |
| DIBEC | `FORM 158 FUMIPRO 2022.pdf` | RUC 80119631 — **FUMIPRO** |

**Por qué se avisa aparte y primero.** El sistema compara el RUC antes de dar
algo por presentado, así que no se equivocó: no marcó nada. El riesgo es otro
y es humano — si alguien abre el `120-07-2026.pdf` creyendo que es el de
COPESA y transcribe esos importes al SIGA, los números de una empresa terminan
en la contabilidad de otra, y eso después se corrige con una rectificativa.

**Consecuencia concreta que hay que mirar hoy:** el IVA de **COPESA del período
2026-07** figura como NO presentado en el sistema, porque el único formulario
120 de julio que hay en su carpeta es el de MACOMA.

**Las preguntas:**
1. ¿COPESA presentó el IVA de julio 2026? Si sí, ¿dónde quedó ese formulario
   120? (Si existe y nos dicen dónde, el sistema lo toma solo.)
2. Los tres archivos, ¿los mueven ustedes a donde corresponde?

**El sistema no los mueve ni los borra**: no toca nunca el OneDrive de ustedes.
Lo único que va a hacer de ahora en más es **avisar** cuando encuentre un caso
así, en vez de ignorarlo en silencio como venía haciendo.

---

## 1. Prórroga de Estados Financieros 2025 (B1)

La Resolución General DNIT N° 50/2026 (7 de abril de 2026) extiende hasta el
**30 de junio de 2026** la presentación de Estados Financieros del ejercicio
cerrado el 31/12/2025, **para contribuyentes de IRE Régimen General**.

**Pregunta:** ¿DIBEC S.A., FUMIPRO S.A. y ECOAGRO S.A. están bajo **IRE
Régimen General**?

- Si **sí** para los tres: sus EEFF 2025 (presentados entre el 10 y el 26 de
  junio de 2026) están **a tiempo**, no atrasados.
- Si **no** para alguno: ese cliente sigue con el vencimiento de abril, y el
  atraso real se mantiene (~60 días).

---

## 2. SIPAR — RG 90 en Excel (B3)

La carpeta `043 SIPAR S.A` tiene, para 2026, una subcarpeta `RG 90` con los
archivos de exportación de Marangatú (formato TXT/ZIP: RUC, timbrado,
número, fecha, monto total — sin desglose de IVA por tasa).

**Pregunta:** ¿Pueden exportar la RG 90 **en Excel** desde SIGA (el mismo
formato que usan para COPESA, FUMIPRO, DIBEC y ECOAGRO) y dejarla en esa
misma carpeta, junto a lo que ya está?

- Sin esto, el sistema no puede calcular el IVA de SIPAR — no es un límite
  de configuración, es que el dato con el desglose no existe en ningún
  archivo disponible hoy.

---

## 3. Talones de presentación de la RG 90 (B4)

Verificado contra las carpetas reales el 2026-09-18: la **planilla RG 90 en
Excel sí está**, para los 4 clientes, la mayoría de los meses de 2026. Lo
que falta es el **talón/comprobante de presentación** (formulario 241, o el
aviso del buzón de Marangatú) como documento aparte.

**3a. Para COPESA:** hay una carpeta `TALON DE PRESENTACION` en
`PERIODO 2026`, con enero, marzo, abril y mayo cargados. **Faltan febrero,
junio, julio y agosto 2026** (y diciembre 2025). ¿Dónde están, o no se
guardan para esos meses?

**3b. Para DIBEC, FUMIPRO y ECOAGRO:** no aparece ninguna carpeta con ese
nombre en 2025 ni 2026. ¿Guardan el talón como documento aparte en algún
otro lugar, o la DDJJ IVA en PDF que sí está cada mes ya cumple esa función
para ustedes?

---

## 4. RG 90 Ventas de ECOAGRO — dos meses sin el archivo

`RG COMPRAS` está completo enero–julio 2026 (7 de 7 meses). `RG VENTAS`
solo aparece en 5 de esos 7 meses — **faltan febrero y mayo 2026**.

**Pregunta:** ¿esos dos archivos existen en otro lugar, o no se generaron
para esos meses?

---

## 5. Autofacturas con columnas en cero (arrastrada de antes, B7)

Algunas filas de autofactura en las planillas RG 90 tienen todas las
columnas de monto en cero. ¿SIGA las exporta así a propósito (por ejemplo,
una autofactura anulada o de referencia), o es un error de la exportación?

## 6. ECOAGRO febrero 2025 — dos versiones sin "CORRECCION" en el nombre
(arrastrada de antes, B7)

Hay dos archivos para el mismo período sin que ninguno diga "CORRECCION" en
el nombre. El sistema toma el de fecha de modificación más reciente.
¿Es el criterio correcto para estos casos, o prefieren otra regla (por
ejemplo, que siempre haya que agregar "CORRECCION" al reemplazar una
planilla)?

---

## 7. SIGA — ¿cómo se le cargan datos hoy, y qué permite?

Para saber hasta dónde puede llegar el sistema en el paso siguiente (leer las
facturas y dejar el Excel armado en el formato de SIGA), necesitamos entender
cómo se conecta SIGA con el mundo exterior. Esto es información sobre SIGA, no
una decisión de ustedes:

7a. ¿SIGA tiene una opción de **importar un Excel o CSV** (carga masiva) desde
su propia pantalla? Si sí, ¿en qué formato exacto lo espera? (Con un ejemplo de
un archivo que ya hayan importado alcanza.)

7b. ¿Saben si SIGA ofrece una **conexión oficial para otros sistemas** (API), o
si sus términos de uso dicen algo sobre herramientas que cargan datos de forma
automática?

7c. ¿Tienen un contacto en el soporte de SIGA a quien se le pueda preguntar
esto?

**Por qué importa:** si SIGA permite importar por Excel, el sistema puede
entregarles el archivo perfecto y una persona lo sube por la función oficial —
sin ningún riesgo para la cuenta. Lo que **no** se va a hacer es un programa que
entre a SIGA "como si fuera una persona": si SIGA no lo permite, pone en riesgo
la cuenta de EFFORT, y lo que se carga ahí termina en declaraciones reales ante
la DNIT — esa parte siempre la confirma una persona antes de enviar.

---

**Cómo responder:** alcanza con las respuestas cortas por punto (sí/no, o
"están en tal carpeta"). No hace falta reunión para esto — se puede
responder por escrito.
