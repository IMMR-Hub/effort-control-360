# Guía para mostrarle el sistema a Lili y Laura

Recorrido de unos 15 minutos con los **datos reales** de los cinco clientes del
piloto. Los números de esta guía son los de producción del 2026-09-15; si
cambiaron, manda la pantalla.

**Antes de empezar:** entrar con la cuenta de dirección en
`https://effort360.disaak.com`. Lo que se ve es de solo lectura sobre OneDrive:
el sistema **no modifica, mueve ni borra** nada de la carpeta de EFFORT.

---

## 1. Panel general (la pantalla de inicio) — 2 minutos

**Qué mostrar:** el estado de la cartera de un vistazo.

- 5 clientes activos · 55 vencimientos vencidos sin prueba de presentación.
- **Presentadas con atraso**: cuántas y cuántos días en total.
- Arriba a la derecha, el filtro: **Todas las fechas / Por mes / Fecha exacta /
  Desde–hasta / Últimos 15, 30, 60 o 90 días**. Probar "Últimos 30 días" y ver
  cómo cambian los números.

**Qué decir:** cada número sale de un documento o de un cálculo; ninguno se
escribe a mano.

## 2. Vencimientos — 4 minutos

**Qué mostrar:**

1. El **radar**: lo que falta, ordenado por urgencia, con los días.
2. Abajo, **Presentados**: 42 obligaciones que el sistema encontró presentadas
   leyendo los PDF de la DNIT (número de orden y fecha), con los **días de
   atraso**.
3. En una fila, **"Ver declaración"**: abre el PDF original en su OneDrive.

**El momento clave:** el sistema no confía en el nombre del archivo. Ejemplos
reales para contar:

- `DDJJ IVA 072026 DIBEC SA.pdf` contiene en realidad la declaración de
  **agosto**. La de julio no está (solo la proforma), y el sistema la sigue
  mostrando como pendiente.
- El IVA de COPESA estaba guardado como `120-01-2026.pdf`, `120-02-2026.pdf`…
  y el sistema lo encontró igual, abriéndolos.

## 3. IVA — 4 minutos

**Qué mostrar:**

- Elegir **ECOAGRO**, el más completo. Crédito, débito y saldo por período,
  calculados desde las planillas RG 90.
- **No mostrar COPESA en esta pantalla todavía:** tiene IVA de solo 2 períodos
  hasta que se haga la tarea 141 del roadmap (sus planillas tienen otros
  nombres y el sistema todavía las busca por nombre).
- **Qué revisar antes de presentar:** toda diferencia de IVA entre la factura y
  la regla, desde 1 guaraní. El caso más grande: AGROSOL → ECOAGRO, 12 Gs. de
  crédito de más en 2026-03.
- Botones **Aceptar** (pide el motivo) y **Revisar**. Aceptar queda registrado
  con nombre, fecha y motivo.

## 4. Documentos — 2 minutos

- 3.969 documentos traídos de OneDrive; 2.526 ya clasificados por tipo. El
  resto está en "Otro" porque el nombre no dice qué son (fotos de WhatsApp,
  `ENERO.pdf`).
- Filtro por "Últimos 30 días": los documentos por fecha de recepción.

## 5. Alertas — 1 minuto

- Las alertas se cierran **solas** cuando el problema desaparece (una
  presentación encontrada, una planilla corregida). Nunca se "ignoran".

## 6. Cierre — 2 minutos: lo que el sistema necesita de ellas

Estas preguntas van a salir solas en la demo. Conviene llevarlas escritas:

1. **SIPAR**: su carpeta `043 SIPAR S.A` no tiene ninguna declaración de
   2025-2026 ni el Excel de la RG 90. ¿Dónde las guardan?
2. **RG 90 de DIBEC, FUMIPRO y ECOAGRO**: ningún talón de presentación en sus
   carpetas. ¿Dónde está?
3. **Estados financieros 2025 — la más importante.** DIBEC, FUMIPRO y ECOAGRO
   los presentaron entre el 10 y el 26 de junio; el sistema los tiene con
   vencimiento en abril (mismo día que el IRE, dato de Lili) y por eso muestra
   ~60 días de atraso. Pero la **Resolución General DNIT N° 50/2026** extendió la
   presentación de los EEFF del ejercicio 2025 hasta el **30 de junio de 2026**
   (fuente: dnit.gov.py, "Extienden plazo para presentación de estados
   financieros"). Con esa prórroga las tres presentaron **a tiempo**. **¿La
   aplicamos?** (Ojo con el nombre: la RG 90 es el formulario de compras y
   ventas; la RG 50 es esta prórroga, son cosas distintas.)
4. **Nombres de archivo**: ¿les sirve la propuesta de
   `docs/GUIA-NOMENCLATURA-ARCHIVOS.md`?
5. **Archivos duplicados**: `docs/propuestas/ARCHIVOS-DUPLICADOS.md` lista 404
   grupos de copias idénticas (124 MB). Solo para que decidan ellas; el sistema
   no borra nada.
6. **Autofacturas** con todas las columnas en cero en la planilla RG 90: ¿así
   las exporta SIGA?

---

## Lo que NO conviene mostrar todavía

- **Seguimiento**: está vacío hasta que se abra el período (hay un botón) y se
  configure la regla de "Entrega de documentación". Mostrarlo vacío genera más
  preguntas que respuestas.
- **Equipo**: todavía existe una sola cuenta; las diez del equipo se crean con
  `node scripts\crear-equipo.mjs`.
- **Saldo a favor arrastrado entre períodos**: todavía no se calcula (la
  pantalla de IVA lo dice). Se va a tomar de lo declarado en el formulario 120,
  no de las planillas, para que nunca contradiga la declaración jurada.
