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

> **Estado al 2026-09-13 — leer antes de trabajar con datos.** La base de
> producción fue borrada por accidente (ver REGLA 0). El esquema está intacto;
> los datos no. Pendiente de reconstrucción: usuarios, clientes, documentos,
> vencimientos, alertas y obligaciones. **Los archivos de OneDrive no fueron
> afectados** — los 1574 documentos están enteros y la sincronización los vuelve
> a indexar. La bitácora de auditoría (`event_log`) se perdió sin fuente de
> recuperación.

**Este archivo se revisa cada 6 meses**, o cuando una conversación descubra algo
que la siguiente necesitaría redescubrir. Última revisión: **2026-09-13**. No es
un documento de arranque: es la memoria del proyecto, y su valor está en lo que
evita repetir. Se agrega; no se borra.

## REGLA 0 — NADA SE BORRA SIN AUTORIZACIÓN EXPRESA DE DANIEL

**Esta regla está primera porque es la única que ya se rompió, y salió cara.**

El 2026-09-13 se corrió `prisma migrate diff --shadow-database-url "$DIRECT_URL"`.
Prisma **resetea** la base que recibe como shadow — es su diseño — y ahí apuntaba
producción. Se borraron los 11 usuarios, los 5 clientes, 1574 documentos, 150
vencimientos, 95 alertas y **la bitácora de auditoría completa**. La bitácora no
se puede reconstruir desde ninguna fuente.

Las reglas que existían hablaban de no borrar archivos de EFFORT. No decían nada
de la base de datos. **El hueco no estaba en el criterio: estaba en que nada
mecánico lo impedía.**

1. **Ningún dato se borra ni se resetea sin que Daniel lo autorice expresamente,
   para esa operación concreta, en esa conversación.** Vale para la base, para
   OneDrive, para el repositorio y para cualquier servicio (Supabase,
   DigitalOcean, GitHub). Una autorización previa no se extiende a la siguiente.
2. **Los archivos originales de EFFORT no se borran NUNCA, bajo ninguna
   circunstancia, ni con autorización.** EFFORT no tiene copia de seguridad de
   sus propios archivos. `DriveDeArchivos` no tiene método de borrado y no debe
   ganar uno jamás.
3. **Antes de correr un comando contra producción hay que saber qué hace, no
   suponerlo.** `--shadow-database-url` no dice "borra esta base" en ningún
   lado, y la borra. Ante la duda: no se corre.
4. **Restaurar también es destructivo**: pisa el estado actual. Entra en la
   regla 1.

Esto lo hace cumplir `.claude/guardias/bloquear-destructivos.mjs`, un hook que
corre antes de cada comando de shell y bloquea los patrones destructivos. **No
se desactiva para seguir adelante.** Si un borrado es legítimo, lo ejecuta
Daniel.

## Las tres preguntas — antes de cualquier acción difícil de deshacer

Daniel, 2026-09-13: *"no quiero tener que autorizarte todo uno por uno (…). Hay
que encontrar la forma de que no metas la pata teniendo todo documentado y que
te pongas a analizar primero si es necesario hacer lo que hiciste, qué pasa si
lo haces, y cuál es la manera CORRECTA de hacerlo."*

Tiene razón, y por una razón práctica: **pedir autorización para todo no es más
seguro, es menos.** Obliga a estar mirando la pantalla, y cuando son cincuenta
permisos por día se aprueban sin leer. La autorización se gasta. Lo que no se
gasta es parar a pensar antes de las pocas acciones que importan.

Antes de correr algo contra producción, borrar cualquier cosa, o tocar un
servicio externo (Supabase, DigitalOcean, GitHub, OneDrive, Azure), **hay que
escribir estas tres respuestas primero**. No pensarlas: escribirlas, donde
Daniel las pueda leer.

1. **¿Es necesario?** ¿Qué problema resuelve, y hay una forma de conseguir lo
   mismo sin esto? *(La migración del incidente se podía escribir a mano — como
   las otras cuatro de ese mismo día.)*
2. **¿Qué pasa si sale mal?** ¿Qué se pierde, y se puede deshacer? Si la
   respuesta es "no se puede deshacer", ahí se para y se pregunta. *(Nadie se
   preguntó qué le hace `--shadow-database-url` a la base que recibe.)*
3. **¿Cuál es la forma correcta?** La que el proyecto ya usa. Si lo que estoy
   por hacer no se parece a cómo se hizo las veces anteriores, eso es la señal.
   *(Las migraciones acá se escriben a mano y se aplican con `migrate deploy`.)*

**Esto aplica siempre, aunque el guardia deje pasar el comando.** El guardia
conoce patrones conocidos; las tres preguntas cubren lo que a nadie se le
ocurrió todavía — que es exactamente donde estaba el hueco.

Y al revés: el guardia está calibrado para **casi nunca dispararse**. Si bloquea
algo cotidiano, el problema es el guardia y hay que afinarlo, no desactivarlo.
Un guardia que estorba todos los días termina apagado, y entonces no protege
nada. Sus pruebas están en `.claude/guardias/probar-guardia.mjs`.

## Lecciones que costaron caro

Esta sección existe por una idea de Daniel: **"en vez de prohibir, hay que
enseñar para que no vuelva a pasar"**. Las reglas de arriba dicen qué no hacer;
esto dice **por qué**, con el costo real al lado. Una regla sin su historia se
obedece mal, porque no se sabe qué caso de borde cubre.

**Cada entrada acá le pasó a alguien. Ninguna es hipotética.**

1. **Un parámetro que no dice lo que hace igual lo hace.** `--shadow-database-url`
   no tiene la palabra "borrar" en ningún lado, y resetea la base que recibe.
   Costó la base de producción entera (2026-09-13). *Lección: contra producción,
   no se corre un comando cuyo efecto no se verificó. El nombre del parámetro no
   es documentación.*

2. **Rechazar un dato es una decisión de negocio, no técnica.** El importador de
   libros rechazaba las filas donde las partes no sumaban el total, y descartaba
   el 8% de los comprobantes — IVA que el cliente perdía sin enterarse. *Lección:
   antes de descartar una fila, preguntarse qué se pierde. Leer y juzgar son
   trabajos distintos: el importador lee todo, el análisis decide.*

3. **Suponer el formato de un archivo real siempre sale mal.** Se supuso que el
   encabezado de un Excel está en la fila 1. Un archivo real lo tenía en la 2, y
   el importador devolvía 196 filas con cero columnas reconocidas: **no fallaba,
   mentía.** *Lección: un importador que no encuentra nada tiene que gritar, no
   devolver vacío.*

4. **Un trabajo de fondo puede tumbar todo el sistema.** La sincronización de
   OneDrive bajaba archivos enteros a memoria sin mirar el tamaño, en un
   contenedor de 512 MB. El kernel mataba el proceso cada 2 minutos, sin dejar
   una sola línea en el log. Nadie pudo entrar al sistema durante horas
   (2026-09-12). *Lección: todo trabajo automático necesita un tope y un
   interruptor para apagarlo sin desplegar.*

5. **Un proceso que muere en silencio cuesta horas de diagnóstico.** No había
   manejadores de `unhandledRejection` ni `uncaughtException`. *Lección: un
   servidor que corre solo tiene que dejar dicho por qué se muere.*

6. **Una regla afirmada en un texto tiene que estar comprobada donde se afirma.**
   La alerta decía "todavía no está registrado como presentado" pero el motor no
   lo comprobaba: el filtro vivía en el repositorio, en otro archivo. *Lección:
   la regla vive donde se afirma, con un test que la fija.*

7. **Un comentario puede mentir durante meses.** `iva.ts` aseguraba que las tasas
   venían de la tabla `regla_impositiva` mientras leía una constante del propio
   archivo, y la tabla estaba vacía. *Lección: si un comentario describe una
   intención y no el código, es un bug.*

8. **Los datos reales enseñan lo que ningún diseño anticipa.** Las planillas de
   VENTAS nombran dos columnas distinto que las de COMPRAS; los importes traen
   decimales aunque el guaraní no los tenga; hay archivos con el nombre mal
   escrito ("BOLEETA"). *Lección: correr el código contra los archivos de verdad
   lo antes posible, y convertir cada rareza en un test con el dato textual.*

**Cómo se usa esta sección:** antes de escribir algo que lea archivos externos,
borre datos, o corra solo, buscá acá si ya nos pasó. Y cuando algo salga mal,
agregá la entrada — el valor está en que siga creciendo.

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
5. **No se borra ni se modifica nada en las carpetas reales de EFFORT,
   nunca — EFFORT no tiene copia de seguridad de sus propios archivos, así
   que un error acá no tiene forma de deshacerse.** Regla vigente desde
   2026-09-09, precisada por Daniel:
   - **Carpetas reales de EFFORT** (donde Laura/Lili trabajan a diario) —
     **solo lectura**, siempre. Nunca `escribir()`, nunca ningún método de
     borrado (no existe ninguno en `DriveDeArchivos`, `packages/drive`, y no
     debe ganar uno nunca).
   - **`/EFFORT Control 360/Entrada|Salida|Respaldo/`** (la carpeta nueva
     dedicada a este proyecto) — ahí sí se puede leer y escribir, incluido
     duplicar datos reales para pruebas.
   - **Todo acceso de lectura a una carpeta real de EFFORT, y toda escritura
     en la carpeta nueva, se registra en `docs/BITACORA-ONEDRIVE.md`**
     (cuándo, qué, por qué, para qué) — sirve de auditoría y de material de
     entrenamiento a futuro.
   - Si algún día hiciera falta escribir o borrar algo en una carpeta real,
     es una decisión nueva que se toma con EFFORT presente y por escrito —
     no algo que se agrega calladamente en una tarea de otra cosa.
   - Hasta el 2026-09-09 esto era en gran parte teórico: el adaptador real
     (`DriveGraph`) nunca había tocado ningún archivo de producción, solo se
     probaba contra el doble en memoria (`DriveFalso`). La primera lectura
     real (`effort360@effort.com.py`, cuenta de Daniel dentro del tenant —
     no la de uso diario de Laura/Lili) está documentada en
     `docs/BITACORA-ONEDRIVE.md`. Ver también `docs/DISCREPANCIAS.md`,
     punto 6.
6. **Ninguna cifra de la interfaz está escrita a mano.** Toda sale de un cálculo
   sobre datos importados.
7. **Todo el código, comentarios, nombres y textos de interfaz en español.**
   Los términos técnicos del dominio son los que usa EFFORT (liquidación,
   timbrado, comprobante, retención).

## Lo que sabemos del dominio, y costó descubrir

Esto no está en ningún manual: salió de leer 39 planillas reales y de
correcciones de EFFORT. Sin esto, la próxima conversación lo redescubre a mano.

**La DNIT publica DOS calendarios, no uno.** Confirmado contra el portal
(Resolución General 38/2020, art. 3°) y contra las fechas que dio EFFORT:

| | Días por terminación de RUC | Qué incluye |
|---|---|---|
| Determinativas | 7, 9, 11 … 25 | IVA, IRE, IRP, ISC, anticipos |
| Informativas (DJI) | 8, 10, 12 … 26 | **RG 90**, estados financieros, dictamen de auditoría |

La terminación es **la última cifra del número, sin el dígito verificador**: en
`80007729-6` es el **9**, no el 6.

**Cualquier feriado corre la fecha** — regulares, trasladados y extraordinarios,
y también para las obligaciones de fecha fija (confirmado por Daniel,
2026-09-12). Los feriados móviles se mueven **por decreto, año a año**: no hay
fórmula. Hay que revisarlos **cada mes** y actualizar `TRASLADOS_DECRETADOS` y
`REVISION_DE_FERIADOS` en `packages/core/src/diasHabiles.ts`.

**El redondeo del IVA es el normal**, confirmado por Daniel el 2026-09-13 y
coincidente con 3.723 de 3.788 comprobantes reales: `9.245,51 → 9.246`,
`9.245,48 → 9.245`, `9.245,50 → 9.246`, y un resultado exacto no se toca. Es lo
que ya hacía `dividirRedondeado`.

**Pero el IVA declarado se LEE, no se recalcula.** En las planillas, el IVA por
comprobante viene de la factura del proveedor, y cada proveedor redondea a su
manera: hay casos donde la planilla se aparta de un resultado matemáticamente
exacto. Recalcularlo haría que el sistema contradiga una declaración jurada que
la DNIT ya recibió. El divisor propio es para **deducir** un IVA que nadie
declaró, no para pisar uno declarado. Las diferencias se informan como hallazgos
(`packages/importers/src/analisisDeLibro.ts`) porque pueden derivar en multa.

**Dónde viven los importes reales.** No en los documentos: en las **planillas
RG 90** (`RG COMPRAS …`, `RG VENTAS …`, Excel, formato oficial de 28 columnas).
Es la única fuente de dinero real del sistema.

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

### Comandos que NO se corren contra esta base

Lista concreta, para no depender de recordar el principio general. Todos están
bloqueados por el hook, pero conviene saber qué hace cada uno:

| Comando | Qué hace de verdad |
|---|---|
| `prisma migrate diff --shadow-database-url <url>` | **Resetea** la base de `<url>`. Borró producción el 2026-09-13. |
| `prisma migrate reset` | Borra todos los datos y reaplica migraciones. |
| `prisma migrate dev` | Puede resetear sin preguntar si detecta deriva del esquema. |
| `prisma db push` | Descarta datos para hacer encajar el esquema. |
| `DROP` / `TRUNCATE` / `DELETE` sin `WHERE` | Lo que dicen. |
| `deleteMany()` sin filtro | Borra todas las filas del modelo. |

**Cómo se crea una migración en este proyecto:** se escribe el `.sql` a mano en
`apps/api/prisma/migrations/<fecha>_<nombre>/migration.sql` y se aplica con
`prisma migrate deploy`, que **solo aplica, nunca borra**. Es como están hechas
todas las migraciones existentes.

**El respaldo no es opcional.** Supabase en plan Free **no tiene backups** — no
los tuvo nunca, ni antes del incidente. La base pesa decenas de MB (guarda
metadatos, no archivos), así que un volcado completo es barato. Ver
`docs/RESPALDO.md`.

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
