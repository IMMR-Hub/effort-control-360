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

> **Estado al 2026-09-13 — histórico, ya NO vigente, se deja como parte de la
> lección de REGLA 0.** La base de producción fue borrada por accidente ese
> día. Lo que decía este cuadro ("pendiente de reconstrucción: usuarios,
> clientes, documentos, vencimientos, alertas y obligaciones") **ya se hizo**:
> según `docs/ROADMAP-MAESTRO.md` ("Foto de producción", 2026-09-15) hay 5
> clientes, 3.969 documentos, 150 vencimientos y 83 alertas abiertas. La
> bitácora de auditoría (`event_log`) previa al incidente se perdió sin
> fuente de recuperación — eso sí sigue siendo cierto: la bitácora de antes
> del 13/09 no existe.
>
> **Para el estado real y lo que sigue, la fuente es siempre
> `docs/ROADMAP-MAESTRO.md`** (sección "▶ EMPEZAR ACÁ"), nunca este cuadro.

**Este archivo se revisa cada 6 meses**, o cuando una conversación descubra algo
que la siguiente necesitaría redescubrir. Última revisión: **2026-09-21**. No es
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

## REGLA 0-bis — NINGÚN CORREO A NADIE HASTA QUE DANIEL LO DIGA

Daniel, 2026-09-16: *"hasta que no te lo diga, NO QUIERO QUE MANDES NINGUN
CORREO a nadie."* Vale para Claude y para todo lo que Claude construya o
despliegue:

1. Claude no envía correos ni mensajes por ningún medio (Microsoft Graph,
   SMTP, conectores de correo, formularios).
2. Ningún cambio que se despliegue puede dejar al sistema enviando correos:
   los avisos por correo y los recordatorios quedan **apagados por defecto**,
   y un push que los encienda no se hace sin autorización expresa.
3. No se corre nada que pueda disparar un envío real: servidores locales con
   credenciales de Azure y trabajos automáticos encendidos (`npm run dev`, un
   e2e colgado), scripts o pruebas contra Graph.
4. Los correos se habilitan recién en las pruebas finales con Laura y Lili,
   **cuando Daniel lo autorice** (decisión A6 del plan maestro).

Una autorización anterior no cuenta: esta regla la levanta solo Daniel, por
escrito, en la conversación.

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

9. **Un secreto pasado como argumento de un subproceso queda expuesto en
   cualquier error.** Un script de prueba (no versionado, en el scratchpad de
   una sesión de Claude) armó una llamada a `curl` con `AZURE_CLIENT_SECRET`
   como argumento de línea de comandos (`-d client_secret=...`). Cuando el
   comando falló por un corte de red, Node imprimió el comando completo —
   secreto incluido — en el mensaje de error, y quedó en el chat y en un
   archivo de log en disco (2026-09-18). Se roto el secreto en Azure AD el
   mismo día. *Lección: un secreto nunca va como argumento de un subproceso
   (`curl`, `node -e`, cualquier CLI) — va por la variable de entorno del
   proceso hijo (`env` de `child_process`, nunca `args`), o por stdin. Un
   argumento de proceso es visible en los logs de error, en la lista de
   procesos del sistema, y en cualquier lugar que imprima el comando que
   falló — no hace falta que nadie lo imprima a propósito.*

10. **Un script que vuelca "las claves del `.env`" también vuelca lo que no es
    una clave.** Al día siguiente del incidente anterior, un script pensado
    para listar solo los NOMBRES de las variables (sin sus valores) imprimió
    igual el secreto viejo de Azure: alguien había dejado una nota suelta en
    el `.env` (`Contraseña vieja:<secreto>`, sin el `=` de una variable real)
    y el script la mostró completa porque no distinguía "línea con formato de
    variable" de "cualquier línea del archivo" (2026-09-19). *Lección: nunca
    hay que leer ni volcar el contenido de un `.env` completo para "solo
    sacar los nombres" — un archivo de secretos puede tener cualquier cosa
    adentro, con o sin el formato esperado. Si hace falta saber qué variables
    existen, se lee el código que las declara (`configuracion.ts`), no el
    archivo con los valores reales.*
11. **"Pregunta pendiente" significa una sola cosa, siempre.** Al describir la
    tarea 138 se escribió "antes de tocarla: respaldo y las tres preguntas de
    `CLAUDE.md`" — una frase real (esas tres preguntas existen, son el
    autochequeo de la sección de arriba), pero mezclada en el mismo texto
    donde el roadmap también usa "pregunta" para las de la COLA B, que sí son
    respuestas que EFFORT tiene que dar. Daniel la leyó como si hubiera
    preguntas de EFFORT bloqueando la 138, cuando en realidad no había
    ninguna — lo que faltaba era una verificación de Claude contra un archivo
    real, todavía sin hacer (2026-09-19). *Lección: "pregunta pendiente" en
    este proyecto se reserva SIEMPRE para lo que espera una respuesta de
    Daniel o de EFFORT (las de la COLA B). Un autochequeo de Claude (las tres
    preguntas de las decisiones difíciles) o una verificación técnica
    pendiente (leer un archivo real antes de programar) se nombran así — "
    autochequeo" o "verificación pendiente" — nunca "pregunta", ni en el
    roadmap ni en la respuesta al chat. Y antes de escribir el "qué hacer" de
    una tarea que asume poder leer un dato nuevo de un archivo real (un
    campo, una columna, un texto), hay que decir explícitamente si esa
    lectura ya se probó contra un archivo real o si sigue siendo un
    supuesto — nunca dejarlo implícito.*

12. **Un respaldo que depende del cliente del ORM falla justo cuando más hace
    falta.** El 2026-09-21, antes de aplicar una migración, `respaldar-base.mjs`
    falló dos veces con `P2021` y `P2022` («la tabla / la columna no existe»):
    el cliente de Prisma ya conocía lo nuevo porque el código va adelante del
    esquema desplegado, y el respaldo se cae en el único momento en que se
    necesita. El respaldo automático diario tiene la misma fragilidad
    (`lectorParaRespaldo: prisma` en `index.ts`). Se resolvió con un script
    descartable que leyó esas dos tablas con SQL crudo. *Lección: el orden es
    respaldar → migrar → pushear, nunca al revés (si el código llega antes que
    su migración, las rutas nuevas y el respaldo del día fallan contra una base
    sin la columna). La forma robusta es leer las tablas con `SELECT *`, y
    **sin aflojar la cobertura total**: ese mismo día el test que compara la
    lista de respaldo contra `schema.prisma` atajó que `registro_de_horas` no
    estaba incluida. Ver `docs/DISCREPANCIAS.md` punto 33 y la tarea 150.*
13. **Lo que se razona sobre la base hay que probarlo contra la base.** Tres
    veces el 2026-09-21 una suposición sobre PostgreSQL o Prisma cayó ante una
    prueba real, con los dobles en verde: (a) Prisma rechaza `null` dentro de la
    clave compuesta de un `upsert` («Argument `clienteId` must not be null»);
    (b) escribí en un comentario, como un hecho, que dos cargas de tiempo
    interno el mismo día quedarían como dos filas, y el test de integración
    mostró lo contrario; (c) `type="number"` descartaba la coma decimal
    española. *Lección (refuerza la 6 y la 7): no se escribe en un comentario,
    en una migración ni en un documento, como hecho, algo que solo se razonó.
    Todo repositorio con lógica de unicidad o de valores nulos lleva su prueba
    contra PostgreSQL real, y si la prueba contradice el comentario, se corrige
    el comentario en el mismo commit.*
14. **«Desplegado» no es «hecho», y la casilla y su nota tienen que decir lo
    mismo.** El 2026-09-21 la tarea 149 quedó marcada `[x]` en el roadmap con
    una nota que decía «falta desplegar y verlo en pantalla»: el propio renglón
    contradecía la regla 4 del roadmap (hecho = verificado en producción,
    mirando la pantalla). Se descubrió recién al actualizar el documento.
    *Lección: `[x]` solo después de ver la pantalla. Si la nota dice «falta»,
    la casilla es `[ ]`. Y en todo resumen se distinguen dos estados que no son
    uno: «desplegado» (el bundle nuevo se sirve, confirmado con
    `esperar-despliegue.mjs`) y «verificado en pantalla».*
15. **Un rojo intermitente ni se descarta como «la red» ni se declara verde sin
    decirlo.** El 2026-09-21 la conexión a la base fue intermitente todo el día
    y `npm run verify` dio 20/21, 20/21, 19/21 y finalmente 21/21. Pero la
    corrida de 19/21 mezclaba un fallo **real** (el test de cobertura del
    respaldo, lección 12) con uno de red. *Lección: antes de decir «es la red»,
    mirar QUÉ falló — un fallo de red habla de conexión o de un timeout de
    transacción, no de una aserción —, correr ese archivo solo, y contarle a
    Daniel que fue intermitente sin maquillarlo. Ver `docs/DISCREPANCIAS.md`
    punto 34.*
16. **Cambiar el marcado de un componente compartido rompe pruebas de otras
    pantallas.** Al agregarle un ícono a `Indicador` envolví la etiqueta en un
    `div` nuevo, y fallaron las pruebas de Vencimientos y del Panel, que ubican
    la tarjeta con `.closest('div')` desde el texto de la etiqueta. Lo
    encontraron esas pruebas, no yo. *Lección: antes de tocar el HTML de un
    primitivo de `apps/web/src/ui/`, buscar `closest(` en `apps/web/test/` y
    agregar sin anidar (el ícono quedó posicionado en absoluto). Las
    consecuencias de un primitivo compartido llegan a todas las pantallas que
    lo usan, no solo a la que se está mirando.*
17. **Una referencia visual no es una especificación.** Daniel trajo capturas
    de un mockup anterior que había gustado mucho. Tenía cosas reales de las
    que aprender (un menú lateral, indicadores que llevan a su módulo) y cosas
    que eran de maqueta de venta: clientes inventados, «36 horas ahorradas», un
    forecast de carga a 14 días, «98 clientes» cuando son 144. *Lección: se
    copia la forma (estructura, densidad, navegación), nunca las cifras: una
    cifra que no sale de un cálculo del sistema rompe la regla 6. Y una skill o
    un plugin de terceros no se instala sin leerlo antes — instalarlo cambia
    cómo trabaja Claude en este proyecto (se leyó `taste-skill` y no se
    instaló).*

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
4. **No se toca SIGA.** Se trabaja sobre sus exportaciones Excel/CSV/PDF.
   SIGA **no tiene API** (confirmado por Daniel el 2026-09-21), pero **sí
   acepta carga de planillas en su formato**: esa es la única vía de escritura
   hacia SIGA — el sistema arma la planilla y **una persona la sube por la
   función oficial** (tarea 145, en espera de la plantilla que tiene que dar
   EFFORT). **Nunca un agente ni un navegador automatizado que maneje la
   pantalla de SIGA:** no hace falta, arriesga la cuenta de EFFORT (términos
   de uso, verificaciones anti-bot que no se sortean), y lo que se carga ahí
   termina en declaraciones reales ante la DNIT. El envío de cualquier
   formulario oficial lo confirma siempre una persona.
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
   - **Superado el 2026-09-15/17.** Esta viñeta decía que escribir o borrar en
     una carpeta real algún día podía decidirse "con EFFORT presente". Daniel
     lo cerró sin dejar esa puerta: *"No quiero que modifiques ni borres ni
     cambies NADA en la carpeta de Lau y Lili. Eso quedó prohibido"*
     (2026-09-15), y lo repitió en estos términos el 2026-09-17: *"mantené
     siempre la regla vital de NO BORRAR NI MODIFICAR NADA de la carpeta
     original OneDrive de Effort"*. No hay decisión que lo habilite, ni con
     EFFORT presente: es absoluto, sin excepción.
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
8. **Ningún secreto (Azure, Supabase, cookies, lo que sea) va como argumento
   de línea de comandos de un subproceso** (`curl -d`, `node -e`, o
   cualquier CLI), ni siquiera en un script de prueba fuera del repo. Va
   por la variable de entorno del proceso hijo. Ver lección 9 más arriba —
   costó un secreto de Azure AD expuesto en un chat, el 2026-09-18.
9. **El `.env` nunca se lee completo, ni siquiera "solo para ver qué claves
   hay".** Para saber qué variables existen, se lee `configuracion.ts` (la
   fuente de verdad de qué se espera), no el archivo con los valores reales.
   Ver lección 10 — un secreto ya expuesto una vez volvió a aparecer al día
   siguiente por esto mismo, el 2026-09-19.
10. **Las horas se autoreportan; nunca se infieren de la actividad.** El tiempo
    entre dos clics puede ser una llamada, un papel o un café, y el número de
    horas va a decidir precios y sueldos (Daniel, 2026-09-21; tarea 144).
    Cada persona ve y carga **solo las suyas** —siempre `sujeto.usuarioId`, nunca
    uno que llegue en la petición, ni siquiera para dirección—; el resumen del
    equipo es **solo de dirección y solo con totales**, jamás el día a día de
    otra persona (mismo criterio que restringió la bitácora el 2026-09-10). El
    resumen dice en voz alta que son horas autoreportadas. **No se convierten en
    guaraníes con una tarifa supuesta**: ese dato no lo tenemos (DISCREPANCIAS 35).
11. **Una fecha que se aparta de la regla del calendario lleva su motivo.** Una
    prórroga de la DNIT es un dato del sistema, no un `UPDATE` silencioso: se
    guarda la fecha que fijaba el calendario, el motivo es obligatorio (la
    resolución) y una segunda prórroga no pisa la fecha original (tarea 146).
    Sin eso, dentro de seis meses nadie sabe por qué esa fila no sigue la regla.

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

**Las prórrogas de la DNIT llegan por resolución y cambian el vencimiento real.**
La **RG 50/2026** (7 de abril de 2026) corrió al **30/06/2026** los estados
financieros del ejercicio 2025 de los contribuyentes de IRE Régimen General, y
EFFORT confirmó (2026-09-21) que **los cinco clientes lo son**. El sistema tenía
esos vencimientos en abril y mostraba a DIBEC, FUMIPRO y ECOAGRO con 60 a 64 días
de atraso cuando habían presentado a tiempo: un atraso falso dicho con
seguridad es peor que no decir nada. Daniel: *«es una resolución de prórroga que
suelen sacar»* — va a volver a pasar (regla 11; tarea 146).

**En el formulario 120, el saldo que se arrastra es la casilla 47, no la 54.**
Verificado contra un PDF real (2026-09-20): el Rubro 4 trae el *saldo técnico* de
IVA (casilla **47**, entra al período siguiente por la 46) y el Rubro 5 trae un
*saldo financiero* (casilla 54) que el propio formulario declara «no
trasladable al Rubro 4». Tomar la 54 sería un error silencioso. Los importes
usan el punto como separador de miles y no llevan decimales (DISCREPANCIAS 32).

**En la carpeta de un cliente puede haber una declaración de otro contribuyente,
y el RUC del PDF manda, no el nombre del archivo ni la carpeta.** Pasó con tres
archivos reales (un 120 de MACOMA en la carpeta de COPESA, un 158 de FUMIPRO en
la de DIBEC, un acuse de una persona física). El riesgo no es solo que el
sistema los tome por presentados —no lo hace— sino que una persona los abra
creyendo que son del cliente y transcriba esos importes al SIGA equivocado
(tarea 143; DISCREPANCIAS 31).

**Lo que dijo EFFORT el 2026-09-21 y ya es criterio del sistema:** una fila de
autofactura con las partes en cero es «porque no existe autofactura cargada»,
no un error de lectura; cuando hay dos versiones de una planilla y ninguna dice
«CORRECCION», gana **la más reciente** (y de ahora en más van a usar la palabra
«CORRECCION»); y un talón de RG 90 que no está en OneDrive **existe, guardado
en otro lugar**, así que figurar como faltante es correcto — no está archivado
donde corresponde.

## Fuera de alcance de esta etapa

OCR de facturas, WhatsApp Business API, portal de cliente, app móvil,
aprobación automática de balances, y **cualquier cosa que maneje la pantalla de
SIGA** (regla 4). La API de SIGA no existe. Lo que sí está previsto, en cuanto
EFFORT entregue la plantilla, es **generar la planilla en el formato de carga
de SIGA** (tarea 145): la sube una persona.

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

## Trampas que ya costaron tiempo

Cada una con su motivo; ver las lecciones de más arriba.

- **La conexión a Supabase desde la máquina de trabajo es intermitente.**
  Consultas, tests de integración y `npm run verify` fallan a veces con «Can't
  reach database server» o con un timeout de transacción de 5.000 ms.
  Reintentar, y mirar qué falló, antes de sospechar de un cambio (lección 15).
- **Migrar antes de pushear, con respaldo previo** (lección 12). Si
  `respaldar-base.mjs` falla con `P2021`/`P2022`, el código va adelante del
  esquema: no es un bug del respaldo, es el orden.
- **Al esperar un despliegue, el marcador de `scripts/esperar-despliegue.mjs`
  tiene que ser un texto que EXISTA en el bundle.** Comprobarlo antes contra
  `apps/web/dist/assets/*.js` (una vez se usó uno inventado y el script falló
  por un despliegue que había salido bien).
- **En los tests de API, `await activarCsrfEnInject(app)`.** Sin el `await`, los
  `inject` mutantes salen sin token y fallan con un 400 genérico que no explica
  nada. Además `direccion` y `responsable` exigen segundo factor: el helper de
  acceso tiene que completar el TOTP, como en `test/modulos.test.ts`.
- **`window.prompt` (lo usan «Presentar» y «Prórroga») puede no funcionar con la
  automatización del navegador.** Si no anda, lo carga una persona o se
  reemplaza por un formulario.
- **`prisma migrate diff`, `migrate dev`, `db push` y `migrate reset` están
  bloqueados, y hacen bien.** Las migraciones se escriben a mano y se aplican con
  `migrate deploy`.
- **Los scripts largos de Python en el shell**: un bloque con muchas comillas
  puede cortar el comando sin aplicar nada. Escribirlo a un archivo y correrlo.

## Al terminar cualquier tarea

1. Correr `npm run verify` y pegar la salida real.
2. Commitear.
3. **Actualizar `docs/ROADMAP-MAESTRO.md`**: marcar la tarea — `[x]` solo si se
   vio en pantalla, no si solo se desplegó (lección 14) —, y corregir la
   numeración o el total si cambió el alcance. Un roadmap desactualizado hace
   que la próxima conversación duplique trabajo o se desvíe.
4. Si apareció una decisión no trivial, agregarla a la bitácora al final del
   roadmap.

## No hacer sin permiso explícito

- Tocar nada fuera de `effort-control-360/`.
- Agregar dependencias fuera de las ya presentes sin justificarlo.
- Commitear `.env` ni credenciales.

**`git push` — autorización permanente desde 2026-09-23, con condiciones.**
Daniel: *"no sé luego por qué por cada cosita me pides permiso si ya tienes el
permiso en Auto y si las reglas son demasiado claras"*. Tiene razón: pedir
confirmación para cada push entrena a aprobar sin leer, que es exactamente lo
que la sección de "las tres preguntas" (más arriba) dice que hay que evitar.
Por eso `git push` a `main` **ya no pide autorización caso por caso**, siempre
que se cumplan las tres, sin excepción:

1. `npm run verify` (completo o el subconjunto relevante al cambio) está en
   verde, y se corrió de verdad — no se asume.
2. Es la tarea que sigue en `docs/ROADMAP-MAESTRO.md`, en su orden — nunca
   trabajo nuevo que no esté ahí.
3. Se hizo el respaldo previo (`node scripts/respaldar-base.mjs`) cuando el
   cambio toca la base — no hace falta si es solo frontend/documentación.

**Esto NO toca ninguna otra regla.** Sigue exactamente igual de absoluto,
sin excepción y sin importar el modo: REGLA 0 (nada se borra ni se resetea
sin autorización expresa, para esa operación, en esa conversación), REGLA
0-bis (ningún correo sin que Daniel lo diga) y REGLA 5 (las carpetas reales
de EFFORT en OneDrive son de solo lectura, siempre — no se escribe, no se
mueve, no se renombra, no se borra nada ahí, ni con autorización). Git push
mueve código a producción, que se revierte con otro commit; borrar datos o
tocar OneDrive no se puede deshacer, y por eso siguen pidiendo autorización
cada vez.
