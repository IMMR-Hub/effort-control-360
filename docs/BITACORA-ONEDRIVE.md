# Bitácora de movimientos en el OneDrive real de EFFORT

Registro obligatorio de **todo** acceso al OneDrive real de EFFORT
(`effort360@effort.com.py`), desde que Daniel autorizó lectura de esa cuenta
el 2026-09-09. Cada entrada: Cuándo, Qué se hizo, Por qué, Para qué. Sirve
también como material de entrenamiento/referencia a futuro.

## Regla vigente (autorizada por Daniel, 2026-09-09)

> "Puedes escribir y cambiar y modificar lo que sea necesario dentro de las
> carpetas creadas (donde puedes duplicar los datos de los 5 clientes) para
> hacer la prueba, pero NUNCA uses las carpetas actuales para nada que no sea
> SOLO LECTURA. Solo en las carpetas creadas por vos, podes hacer
> modificaciones [...] manten un libro de movimientos."

En concreto:
- **Carpetas reales de EFFORT** (lo que Laura/Lili usan a diario) — **solo
  lectura**. Nunca `escribir()`, nunca ningún método de borrado (no existe
  ninguno en `DriveDeArchivos`, ver `packages/drive/src/puerto.ts`).
- **`/EFFORT Control 360/Entrada|Salida|Respaldo/`** (la carpeta nueva creada
  para este proyecto, vacía hasta ahora) — lectura y escritura, incluyendo
  copiar/duplicar ahí datos reales para pruebas.
- Esto no cambia la regla 5 de `CLAUDE.md` sobre no borrar nada — la
  refina: ahora sí se puede *leer* la carpeta real (antes ni eso), pero
  *escribir* sigue limitado exclusivamente a la carpeta nueva.

## Movimientos

- **2026-09-09, ~19:00** — Primera exploración de solo lectura de la cuenta
  real (`effort360@effort.com.py`), nunca hecha antes (hasta ahora solo se
  había verificado `GET /drive/root/children` → 200 OK como prueba de acceso,
  tarea 88, sin explorar contenido). **Por qué:** Daniel compartió los nombres
  de los 5 clientes piloto (Ecoagro, Dibec, SIPAR, Fumipro, Copesa) pero sin
  RUC ni razón social completa — datos obligatorios para sembrarlos (tarea 56)
  que no se pueden inventar. **Para qué:** buscar si esos datos ya existen en
  algún archivo real de EFFORT (registro de clientes, exportación SIGA) antes
  de pedírselos de nuevo a Daniel.
  **Resultado:** tres llamadas de solo lectura (`GET /users/effort360@.../drive/root/children`,
  `GET /sites/root`, `GET /sites/root/drive/root/children`), todas 200 OK,
  todas vacías o sin datos útiles. `effort360@effort.com.py` es la cuenta
  propia de Daniel dentro del tenant (confirmado en la bitácora del roadmap,
  2026-09-04) — su OneDrive está vacío, no es donde Laura/Lili trabajan a
  diario. El sitio raíz de SharePoint del tenant (`effortconsultora.sharepoint.com`,
  "Sitio de comunicación") también está vacío — es el auto-provisto por
  Microsoft 365, no un sitio de trabajo real. `GET /sites?search=*` dio 403
  (permiso no concedido para buscar sitios). **No se intentó adivinar ni
  probar acceder a la cuenta personal de Laura o Lili** — expandir el acceso
  a una cuenta o sitio específico sin que Daniel lo nombre primero se
  consideró fuera de lo autorizado. Conclusión: hace falta que Daniel diga
  dónde vive realmente el material de trabajo diario (¿OneDrive de Laura o
  Lili? ¿un sitio de Teams/SharePoint con otro nombre?) antes de seguir
  explorando.

- **2026-09-09, ~19:20** — Daniel pidió revisar
  `https://effortconsultora.sharepoint.com/.../onedrive` a través del
  navegador (Claude in Chrome, sesión ya logueada como Daniel, administrador
  global). Se encontró un sitio de Teams real, **"EFFORT CONSULTORA
  E.A.S."**, que la búsqueda por API no había podido ver antes
  (`/sites?search=*` daba 403 — sin ese permiso concedido). Se navegó su
  biblioteca de documentos, solo lectura, primero por la interfaz (sin
  éxito: la vista "En canales" mostraba una carpeta "General" pero ningún
  clic — simple, doble, ni la URL directa — lograba abrirla) y después con
  una llamada de Graph directa: `GET /sites/{id}/drives` → un único drive
  "Documentos"; `GET /drives/{id}/root/children` → **0 elementos, la raíz
  está completamente vacía**, ni siquiera existe la carpeta "General" a
  nivel de archivo (Teams solo crea la carpeta real de un canal la primera
  vez que alguien comparte un archivo ahí — nunca pasó). **Conclusión, con
  bastante confianza ahora:** el Team "EFFORT CONSULTORA E.A.S." existe como
  objeto de Teams pero nunca se usó para guardar archivos. No es donde vive
  el material real de Laura/Lili. Se agotaron las vías de descubrimiento
  disponibles sin necesitar más permisos ni nombrar cuentas de terceros a
  ciegas — falta que Daniel diga el correo específico de la persona (Laura o
  Lili) cuyo OneDrive sí tiene los archivos, o confirme que ese material
  solo existe localmente en una computadora, no en la nube.

- **2026-09-09, ~19:45** — Daniel abrió la sesión de Laura Sosa
  (`lsosa@effort.com.py`) en su propio Chrome y pidió revisar por qué él, como
  Administrador Global, no veía los mismos archivos. **Encontrada la carpeta
  real de trabajo de EFFORT**, algo que no vivía ni en `effort360`, ni en el
  sitio raíz de SharePoint, ni en el sitio de Teams (los tres explorados
  antes, los tres vacíos): `CLIENTES EFFORT E.A.S/CLIENTES/` en el OneDrive
  de Laura — **144 subcarpetas, una por cliente real de EFFORT**, cada una
  organizada por período (2020-2026), con constancia oficial de RUC de
  Marangatú adentro. Confirma que ser Administrador Global no da acceso
  automático al contenido de un OneDrive privado ajeno (es una separación
  deliberada de Microsoft) — la forma correcta sin necesitar la contraseña de
  nadie es "Obtener acceso" desde el Centro de administración de SharePoint,
  no usada acá porque la sesión de Laura ya estaba abierta.
  **Por qué:** confirmar RUC y razón social real de los 5 clientes piloto
  (Ecoagro, Dibec, SIPAR, Fumipro, Copesa) para poder sembrarlos (tarea 56)
  sin inventar ningún dato. **Para qué:** cerrar de una vez el punto 3 de
  `docs/DISCREPANCIAS.md`, bloqueado desde el handoff original.
  **Solo lectura, verificado:** se descargaron 5 PDFs de constancias
  oficiales (uno por cliente, más el de Copesa que estaba en otro nombre de
  archivo) directo al disco local, se les extrajo el texto con `pdftotext`, y
  se borraron todos después de usarlos — nunca se subió, modificó ni tocó
  nada en el OneDrive de Laura. Un sexto intento (descargar el certificado de
  cumplimiento tributario de Diego Beconi, la persona física detrás de "023
  DIBEC UNIPERSONAL") fue bloqueado por el clasificador de seguridad de
  Claude Code — dato personal de un individuo, no de una empresa — y no se
  insistió; se resolvió la ambigüedad de Dibec preguntándole directo a
  Daniel en el chat en vez de leer ese documento.
  **Resultado:** los 5 RUC reales confirmados y sembrados en la base de
  producción el mismo día (tarea 56, `docs/DISCREPANCIAS.md` punto 3 —
  ambos cerrados).

- **2026-09-09, ~20:15** — Daniel pidió configurar el acceso correcto de
  `effort360@effort.com.py` al OneDrive de Laura, sin depender de que su
  sesión quede abierta. Hecho desde el Centro de administración de
  SharePoint → Más características → Perfiles de usuario → Administrar
  perfiles de usuario → buscar `lsosa` → menú del perfil → **"Administrar
  propietarios de la colección de sitios"**: se agregó `effort360` a la
  lista de "Administradores de la colección de sitios" (sin sacar a Laura,
  que sigue como administradora principal). Verificado reabriendo el mismo
  diálogo después de guardar: quedó `effort360; Laura Sosa;`. **Esto es una
  configuración persistente del tenant, no una lectura de archivos** — se
  registra acá por transparencia, aunque la regla de bitácora de arriba
  hablaba en principio de archivos, no de permisos. De ahora en más,
  `effort360` puede entrar directo al OneDrive de Laura sin necesitar que
  su sesión esté abierta en el navegador.

- **2026-09-10 — PRIMERA ESCRITURA, y en la carpeta propia.** Daniel aclaró
  el alcance con más énfasis: *"No borres ni modifiques nada de las carpetas
  creadas por otras personas. Copia los datos y pegalos a la carpeta que tu
  hiciste como carpeta raiz y solo modifica esas. NUNCA las que no creaste,
  esas SOLAMENTE puedes leer y copiar a TU CARPETA"*. Al ir a aplicarlo se
  descubrió que **la carpeta raíz nunca había existido**: estaba decidida en
  `docs/DISCREPANCIAS.md` punto 6 desde el 2026-09-04, pero nadie la había
  creado — el OneDrive de `effort360` estaba completamente vacío. **Creada
  ahora, en el OneDrive de `effort360@effort.com.py` (no en el de nadie
  más):** `/EFFORT Control 360/` con `Entrada/`, `Salida/` y `Respaldo/`.
  Verificado leyéndola de vuelta después de crearla. Esta es, de acá en
  adelante, la única carpeta donde el sistema escribe.
  **Aclaración técnica que hacía falta:** todas las lecturas de este
  proyecto se hacen con el *registro de aplicación* "EFFORT Control 360"
  (credenciales de `.env`, permiso `Files.ReadWrite.All` a nivel
  organización) — **nunca con la sesión ni la identidad de Laura**. Cuando
  en esta bitácora se dice "el OneDrive de Laura" se habla de dónde están
  guardados los archivos, no de con qué cuenta se entra.

- **2026-09-10 — Relevamiento del personal real de EFFORT** (solo lectura,
  sin descargar ningún archivo). **Por qué:** para sembrar los usuarios
  reales del sistema (tarea 57 ampliada: no solo dirección, sino el equipo
  entero con sus roles y cartera), hacía falta saber quién trabaja en EFFORT.
  **Para qué:** que el control de acceso por rol y el filtro por cartera se
  puedan probar de verdad, no solo con el rol dirección que ve todo.
  Se intentó primero `126 RRHH EFFORT/FUNCIONARIOS.xlsx` — **bloqueado por
  el clasificador de seguridad de Claude Code** por ser un legajo de RRHH con
  datos personales de empleados; no se insistió, y de todos modos era
  desproporcionado: para crear un usuario solo hacen falta nombre, correo y
  rol, no un legajo. Se usó en cambio el **directorio de la organización**
  (Centro de administración de Microsoft 365 → Usuarios activos), que es
  información laboral básica. Resultado: **10 personas con cuenta
  `@effort.com.py` con licencia**, más la cuenta `effort360`. Los otros ~14
  perfiles del tenant son invitados externos (`#EXT#`, sin licencia):
  contactos de clientes como `adm_fumipro`, `dibecgerencia`, `contamedalf`,
  no personal de EFFORT. Se agregaron las columnas "Título" y "Departamento"
  al listado para intentar deducir el rol de cada persona: **están vacías
  para todas** — EFFORT nunca completó esos campos en Microsoft 365. Por eso
  el rol de cada persona dentro del sistema queda como dato a confirmar con
  Daniel/Laura/Lili, no algo que se pueda deducir de ninguna fuente.

- **2026-09-09, ~19:30** — Daniel preguntó por qué, siendo Administrador
  Global, no ve los mismos archivos que Laura/Lili — se le explicó que ser
  admin no da acceso automático al contenido de un OneDrive ajeno (es
  privado por diseño) y que "Mis Teams" solo muestra sitios de los que uno
  es miembro, no todos los que existen. Para confirmarlo con datos reales en
  vez de solo teoría, se entró al **Centro de administración de SharePoint**
  (`effortconsultora-admin.sharepoint.com`, con la sesión de Daniel como
  admin global) → **Sitios activos**, que sí lista TODOS los sitios del
  tenant sin importar membresía. **Resultado, definitivo:** existen
  exactamente 3 sitios en todo el tenant — "All Company", "EFFORT
  CONSULTORA E.A.S." y el "Sitio de comunicación" raíz — los tres con
  **0.00 GB usados**, y el tenant completo marca **15.00 MB de 1.11 TB**
  disponibles. De paso, se descubrió el correo real de Laura Sosa
  (`lsosa@effort.com.py`) porque su sesión ya estaba conectada en el
  navegador de Daniel — no se inició sesión como ella ni se accedió a nada
  suyo, ese dato solo apareció en el selector de cuentas de Microsoft.
  **Conclusión:** no es un problema de acceso — los archivos reales de
  EFFORT nunca estuvieron en Microsoft 365 (ni SharePoint ni Teams ni ningún
  OneDrive de la organización). Tienen que estar guardados localmente en
  alguna computadora, o en un servicio en la nube ajeno a este tenant
  (Google Drive personal, Dropbox, etc.). Le queda a Daniel confirmar cuál
  de los dos casos es.

- **2026-09-10 — Primera carga real de documentos, los 5 clientes piloto,
  período completo (enero-junio 2026).** Daniel pidió cargar "uno por uno
  todos los documentos sin repetirlos". Se acotó el alcance al período del
  piloto (`docs/DISCREPANCIAS.md`, punto 4) por ser lo que efectivamente
  ejercita vencimientos/alertas/IVA, no todo el historial de cada cliente
  (eso queda para más adelante si hace falta). **Solo lectura** sobre el
  registro real de EFFORT en el OneDrive de Laura
  (`CLIENTES EFFORT E.A.S/CLIENTES/<cliente>/PERIODO 2026`); **solo
  escritura** en la carpeta propia (`/EFFORT Control 360/Entrada/<cliente>/`,
  en el OneDrive de `effort360`) — cada archivo se copió ahí antes de
  registrarse, nunca se tocó ni se modificó nada del lado de Laura.

  Mecanismo, replicado del código real (no inventado aparte):
  `repositorios/dominio.ts` ya define cómo se registra un documento —
  `Evidencia.sha256` único (un mismo archivo no se importa dos veces aunque
  se reintente todo el proceso) y `Documento` único por
  (cliente, RUC emisor, timbrado, número) vía `skipDuplicates: true`. El
  script de una sola vez usado para esto reprodujo exactamente esas dos
  garantías, en vez de escribir una lógica de deduplicación paralela.

  **Resultado, verificado contra la base real:** 671 documentos, 671
  evidencias, cero huérfanos.

  | Cliente | Documentos |
  |---|---|
  | Copesa Construcciones SA | 195 |
  | Fumipro S.A. | 174 |
  | Ecoagro SA | 153 |
  | Silicatos Paraguayos SA (Sipar) | 77 |
  | Dibec Sociedad Anónima | 72 |

  Clasificación por nombre de archivo (metadato, no una cifra): 479 `OTRO`,
  53 `CERTIFICADO`, 46 `ACTA`, 40 `COMPROBANTE_PAGO`, 16 `RETENCION`, 14
  `FACTURA_COMPRA`, 11 `ESTATUTO`, 4 `CONSTANCIA`, 3 `CONTRATO`, 3
  `EXTRACTO_BANCARIO`, 1 `RECIBO`, 1 `NOTA_CREDITO`.

  **Identidad de comprobante (RUC+timbrado+número+total+tasa) solo para 5
  facturas electrónicas**, extraída leyendo el texto real del PDF — nunca
  inventada. De los 14 archivos clasificados como `FACTURA_COMPRA` por su
  nombre, la mayoría son escaneos o formatos que el extractor no pudo leer
  con certeza; quedaron sin esos campos (`null`, un estado válido del
  modelo) en vez de adivinarlos. Es una limitación real del extractor
  actual, no un problema de los datos — si más adelante se necesita el
  monto real de esas facturas, hay que mejorar la extracción o cargarlas a
  mano, nunca completar un total sin poder verificarlo contra el documento.

  Errores transitorios de red durante la carga (mismo patrón que ya venía
  pasando hoy con Supabase): 1 en Fumipro, 2 en Sipar — los tres se
  resolvieron reintentando el mismo cliente completo, que gracias al
  `sha256` volvió a saltar todo lo ya cargado y solo completó lo que había
  fallado. Cero pérdida de datos, cero duplicados.

  El script usado (`scratchpad_importar_documentos.mjs`) no quedó en el
  repositorio: fue una migración real de datos de una sola vez, con RUC y
  rutas de OneDrive de los 5 clientes hardcodeados a propósito, no una
  herramienta genérica. La conexión automática y reutilizable entre
  OneDrive y el sistema (que un archivo nuevo se importe solo, sin correr
  un script a mano) sigue siendo trabajo pendiente — ver
  `docs/DISCREPANCIAS.md`, punto 6.

---

## 2026-09-14 / 2026-09-15 — Lectura de PDFs buscando presentaciones ante la DNIT

- **Qué:** se leyó el texto (primeras dos páginas) de **2.434 PDFs** de los
  cinco clientes, desde las copias del sistema en
  `EFFORT Control 360/Entrada/`, y además se **listó** (sin abrir archivos) la
  estructura de carpetas de los cinco clientes en el OneDrive de origen
  (`lsosa@effort.com.py`) para ubicar los archivos con contenido idéntico.
- **Por qué:** Daniel preguntó por qué había 0 de 150 vencimientos marcados
  como presentados teniendo las declaraciones en OneDrive, y pidió una lista
  de archivos duplicados con nombre y ubicación.
- **Para qué:** marcar presentaciones con la prueba oficial (número de orden y
  fecha de la DNIT) y proponer a EFFORT qué copias podría revisar.
- **Qué se escribió:** NADA en OneDrive. Solo filas en la base del sistema
  (`lectura_de_declaracion`, 2.434 lecturas; 42 vencimientos marcados como
  presentados, cada uno en la bitácora de eventos). La lista de duplicados es
  un documento del repositorio: `docs/propuestas/ARCHIVOS-DUPLICADOS.md`.
- **Qué NO se hizo, y no se va a hacer:** borrar, mover o renombrar ningún
  archivo. Daniel, 2026-09-15: *"No quiero que modifiques ni borres ni cambies
  NADA en la carpeta de Lau y Lili. Eso quedó prohibido."*

---

## 2026-09-18 — Relectura de la carpeta de SIPAR (P10 / punto 27)

- **Qué:** se listó (recursivo, `GET` únicamente, nada bajado ni escrito) la
  carpeta completa `CLIENTES EFFORT E.A.S/CLIENTES/043 SIPAR S.A` en el
  OneDrive de origen (`lsosa@effort.com.py`).
- **Por qué:** Daniel mostró una captura con una subcarpeta `RG 90` (10
  elementos) y archivos de balance/IRE con fecha de modificación reciente
  (2026-09-16) que la lectura del 2026-09-15 no había visto — necesario
  confirmar si cambió algo desde esa fecha antes de responder.
- **Para qué:** cerrar o actualizar el punto 27 de `docs/DISCREPANCIAS.md` y
  B3 del roadmap con datos reales, en vez de repetir la respuesta vieja.
- **Qué se encontró:** la carpeta tiene subcarpetas por año (`2024/`, `2025/`,
  `2026/`), cada una con su propia `DOCUMENTOS CONTABLES` — la del año actual
  (`2026/DOCUMENTOS CONTABLES/`) sí tiene contenido nuevo, agregado
  recientemente: `BALANCE 2025-2024 SILICATOS.xlsx` (modificado 2026-09-16),
  `CALCULO IRE SIPAR S.A. 2025.xlsx`, `PATENTE 1ER PERIODO SILICATOS 2026`, y
  una carpeta `EXTRACTOS DE CUENTA` creada ese mismo día. **Pero la subcarpeta
  `RG 90` (10 elementos) sigue siendo exactamente lo que el punto 27 ya
  describía: exportaciones TXT/ZIP de Marangatú
  (`80012742_202603_COMPRAS_304254_1.txt` y similares), sin desglose de IVA
  por comprobante — no la planilla Excel de 28 columnas que el sistema
  necesita.** No es una carpeta distinta ni una cuenta distinta: es la misma
  de siempre, con más contenido nuevo alrededor pero el mismo hueco en el
  centro.
- **Qué NO se hizo:** nada se bajó, escribió, movió ni borró.

## 2026-09-22 — Relectura de declaraciones de IVA para completar su saldo (tarea 138)

- **Qué:** `scripts/completar-saldo-de-iva.mjs` volvió a leer (`GET .../content`
  únicamente) los 230 PDFs de formulario 120 que el sistema ya había leído
  antes, para extraer la casilla 47. Las dos primeras corridas, en modo
  simulación, apuntaron por error al drive de **origen** (`lsosa@`) con el id
  de archivo del drive del **sistema**: las 230 lecturas dieron `404` — no se
  bajó ni se tocó nada. La tercera corrida (simulación) y la definitiva
  (`--aplicar`) leyeron del drive del **sistema** (`effort360@`, la copia que
  ya hace la sincronización), no del original.
- **Por qué:** el detector de presentaciones lee cada PDF una sola vez; sin
  esta relectura, el saldo declarado nunca iba a aparecer para lo ya leído.
- **Qué se escribió:** solo dos columnas de la base (`saldo_a_favor_*` de
  `lectura_de_declaracion`). En OneDrive, **nada**.

## 2026-09-23 — Auditoría: ¿el sistema modificó algo del OneDrive original?

- **Qué:** a pedido de Daniel, se listaron (`GET` recursivo, solo metadatos,
  nada bajado ni escrito) las carpetas de los 5 clientes en el OneDrive de
  origen (`lsosa@effort.com.py`), pidiendo a Microsoft Graph `createdBy` y
  `lastModifiedBy` de cada elemento.
- **Resultado:** **5.155 elementos revisados; 0 creados o modificados por la
  aplicación «EFFORT Control 360» ni por la cuenta `effort360@`.** Las únicas
  aplicaciones que figuran como autoras son las del propio equipo de EFFORT
  (OneDrive de escritorio 2.130, Microsoft Office 122, OneDrive iOS 17,
  SharePoint 8). De los 81 archivos modificados desde el 2026-09-09, todos los
  modificó una persona de EFFORT (kmedina, mgonzalez, kbaez, asanguina,
  acampos, llaconich, aalvarenga) o su OneDrive de escritorio.
- **Límite, dicho explícito:** `lastModifiedBy` prueba que no se escribió ni
  se renombró nada, pero un archivo **borrado** ya no aparece en la lista. Ese
  caso lo descarta el código: el adaptador (`packages/drive/src/adaptadorGraph.ts`)
  no tiene ninguna llamada `DELETE` ni `PATCH`, y `DriveDeArchivos` no tiene
  método de borrar, mover ni renombrar.
- **Qué NO se hizo:** nada se bajó, escribió, movió ni borró.

## 2026-09-24 — Cronometraje del listado de carpetas (tarea 158)

- **Qué:** una corrida de **solo lectura** que lista (`GET .../children`, solo
  metadatos) las carpetas de los 5 clientes en el OneDrive de origen
  (`lsosa@effort.com.py`) y mide cuánto tarda. Script descartable en el
  scratchpad de la sesión, no versionado.
- **Por qué:** «Actualizar ahora» tardaba ~2 minutos con IVA ya salteado y la
  sincronización automática de cada 15 minutos usa la misma función. Daniel:
  «cuando sean 150, ¿cuántas horas va a demorar?». Había que medirlo, no suponerlo.
- **Resultado:** 4.519 archivos en 5 clientes, **215 s** solo de listado (COPESA
  2.132 archivos / 208 carpetas: 81 s; DIBEC 26 s; ECOAGRO 62 s; FUMIPRO 34 s;
  SIPAR 12 s). Cuesta ~0,4 s por carpeta, en secuencia.
- **Qué NO se hizo:** nada se bajó, escribió, movió ni borró. Los secretos se
  leyeron del entorno del proceso y no se imprimieron.

## 2026-10-01 — Inventario de metadatos de los 144 clientes, para estimar orden y migración

- **Qué:** una corrida de **solo lectura** sobre el OneDrive de origen
  (`lsosa@effort.com.py`): la consulta de cambios de Graph desde cero
  (`/root/delta`, 210 páginas, 41.856 elementos, 2 min 29 s) pidiendo solo
  nombre, tamaño, carpeta, fecha y la huella `quickXorHash` que calcula
  Microsoft. Script descartable en el scratchpad de la sesión, no versionado.
- **Por qué:** Daniel pidió saber cuánto llevaría ordenar el OneDrive de EFFORT
  (duplicados, mal ubicados, mal nombrados) y migrar todos los clientes al
  sistema, **sin hacer nada todavía**.
- **Resultado:** `CLIENTES EFFORT E.A.S/CLIENTES` tiene 146 elementos, 139
  carpetas de cliente (8 vacías), **27.755 archivos en 5.204 carpetas, 15,1 GB**;
  65 archivos de más de 25 MB; **1.185 copias idénticas dentro del mismo cliente
  (853 MB)** — el piloto da 423, coincide con las 422 del informe del 15/09
  hecho bajando los archivos. Fuera del piloto: 134 clientes, 23.208 archivos,
  4.557 carpetas, 12,3 GB, 762 copias idénticas. Mediana 94 archivos por
  cliente; el más grande, 2.234; hasta 8 niveles de carpetas.
- **Qué NO se hizo:** no se bajó el contenido de ningún archivo, no se escribió,
  movió, renombró ni borró nada. Los secretos se leyeron del entorno del
  proceso y no se imprimieron.

## 2026-10-03 — Clientes por código (001, 002…) y su peso

- **Qué:** una corrida de **solo lectura** sobre el OneDrive de origen
  (`lsosa@effort.com.py`): la consulta de cambios de Graph desde cero (41.929
  elementos, 4 min 53 s), con nombre, tamaño, carpeta, fecha y huella. Script
  descartable en el scratchpad de la sesión, no versionado.
- **Por qué:** Daniel pidió saber cuántos clientes hay —cada uno con su código
  001, 002, 003…— y cuántos GB son, para fijar con Laura y Lili cuándo ordenar el
  OneDrive y migrar todo al sistema.
- **Resultado:** `CLIENTES EFFORT E.A.S/CLIENTES` tiene **129 carpetas con código
  (001 a 132; no existen 045, 070 ni 099), 121 con archivos y 8 vacías: 26.724
  archivos, 5.120 subcarpetas, 14,02 GB, 1.068 copias idénticas dentro del mismo
  cliente (0,82 GB)**. Última actividad: 96 desde julio de 2026, 9 en el primer
  semestre de 2026, 5 en 2025 y 11 antes de 2025. Además hay 10 carpetas sin
  código que no son clientes (plantillas, presupuestos, procedimientos…; 0,78 GB)
  y 7 archivos sueltos. Toda la carpeta CLIENTES: 14,80 GB; todo el OneDrive:
  18,94 GB. Fuera de CLIENTES hay dos copias de un escritorio viejo
  (`Escritorio/S.A.C ESTUDIO CONTABLE/EFFORT/…`) con 26 carpetas de clientes
  numeradas de otra forma (p. ej. BAIRES como `017_014`): no son clientes aparte.
  El piloto son 002 FUMIPRO, 021 COPESA, 043 SIPAR, 068 ECOAGRO y DIBEC (falta
  confirmar si el «DIBEC SOCIEDAD ANONIMA» del sistema es la 023 DIBEC
  UNIPERSONAL o la 032 DIBEC S.A). **Resuelto el 2026-10-05 (lectura de solo lectura del id de
  carpeta que usa el sistema): es la 032 DIBEC S.A.**
- **Qué NO se hizo:** no se bajó el contenido de ningún archivo, no se escribió,
  movió, renombró ni borró nada. Los secretos se leyeron al proceso y no se
  imprimieron.

## 2026-10-03 — Análisis de orden: lectura por dentro de 21.182 archivos

- **Qué:** lectura **de solo lectura** del OneDrive de origen (`lsosa@`): listado completo de
  CLIENTES (33.178 elementos) y descarga **a memoria** de 16.944 PDF (≤ 5 MB) y 4.238 Excel
  (≤ 20 MB) para leerlos y descartarlos en el acto. No se guardó ninguna copia, no se escribió,
  movió, renombró ni borró nada. Tardó unas 4 horas (Microsoft entrega ~4 archivos por segundo).
  Scripts descartables en el scratchpad de la sesión, no versionados; secretos solo por entorno.
- **Por qué:** Daniel pidió el tiempo exacto de ordenar el OneDrive (duplicados, mal ubicados,
  mal nombrados) y de migrar a todos los clientes, sin hacer nada todavía.
- **Resultado:** 1.068 copias idénticas sobrantes (0,82 GB, en 52 clientes); de 2.366
  declaraciones de la DNIT leídas, 54 con problema (2,3 %): 12 de otro RUC (11 con su cliente
  correcto identificado), 10 en mes equivocado, 32 en año equivocado; 858 archivos se pueden
  renombrar con certeza (son declaraciones leídas); 10.518 tienen un nombre que no dice qué son
  (3.025 imágenes, 2.853 PDF escaneados sin texto: solo una persona puede saberlo); 3.385 fuera
  de la estructura PERIODO AAAA, el 81 % en 6 clientes (014, 085, 043, 106, 113, 111); 107 Excel
  con vínculos a otros archivos (se rompen si se mueven); 487 carpetas vacías; 29 de 121 clientes
  sin ningún hallazgo; 38 archivos repetidos entre clientes distintos.
- **Qué NO se hizo:** ninguna modificación. Hacerlas exige que Daniel cambie por escrito las
  reglas 0 y 5 de `CLAUDE.md` (que prohíben tocar y borrar el original) y una herramienta nueva
  con registro y reversa.

## 2026-10-07 — ÚNICA ESCRITURA AUTORIZADA en el OneDrive de EFFORT: el cliente de muestra «999 CLIENTE MUESTRA»

- **Autorización (Daniel, en el chat, 2026-10-07):** «necesito que me crees en el OneDrive el cliente 999 que
  se llamará 999 Cliente Muestra. Esto es lo único que puedes crear y tocar. Lo demás en OneDrive NO LO TOCAS,
  BORRAS, NI MODIFICAS.» Es una excepción puntual a la regla 5 de `CLAUDE.md`, para esta operación y ninguna otra:
  no se extiende a ningún otro cambio.
- **Qué se creó:** `CLIENTES EFFORT E.A.S/CLIENTES/999 CLIENTE MUESTRA/` (lsosa@effort.com.py): 31 subcarpetas
  y 212 archivos (157 PDF, 44 Excel, 5 Word, 3 fotos JPEG, 2 txt y 1 zip; 0,68 MB) que siguen el Manual de
  procedimiento de documentos v1.2: `00 LEGAL Y SOCIETARIO` (con `ASAMBLEA 2026`), `00 TRIBUTARIO`,
  `PERIODO 2026` (los 12 meses con el juego base de documentos; marzo con todos los tipos, incluidas las
  subcarpetas `NC EMITIDAS`, `NC RECIBIDAS` e `IMPUTACION MASIVA`; `CIERRE 2026`; `DOCUMENTOS LABORALES` con `IPS`
  y `MTESS`; `DOCUMENTOS VARIOS` con `FACTURACION EFFORT`), `PERIODO 2025` (solo `12 DICIEMBRE` y `CIERRE 2025`,
  para mostrar que el período manda) y `ZZ A CLASIFICAR`, **vacía a propósito** (el manual dice que debe estar
  vacía). El nombre del cliente va en mayúsculas porque así lo exige el manual (Daniel escribió «Cliente Muestra»).
  Todo el contenido son documentos de ejemplo, sin RUC ni datos reales, con el texto «DOCUMENTO DE MUESTRA».
- **Cómo se hizo:** un script aparte, no el del sistema (`DriveDeArchivos` sigue sin tener ninguna forma de
  escribir en el origen). Solo usa GET, PUT y POST; no tiene ninguna rama de PATCH, DELETE, mover ni copiar; todo
  PUT/POST se valida contra la ruta `…/999 CLIENTE MUESTRA/` y usa `conflictBehavior=fail` (nunca pisa nada);
  aborta si ya existe cualquier cosa que empiece con «999». Primero corrió en simulación.
- **Verificación posterior (solo lectura):** en OneDrive hay exactamente los 212 archivos y las 31 subcarpetas
  previstos, con el mismo peso; `CLIENTES` pasó de 143 a 144 elementos y lo único nuevo es `999 CLIENTE MUESTRA`;
  no desapareció ninguno.
- **Qué NO se hizo:** no se movió, renombró ni borró nada; no se conectó el cliente 999 al sistema (no tiene
  `carpetaOneDriveId`, así que la sincronización no lo lee). No se creó la carpeta general `CLIENTES/ZZ A CLASIFICAR`.
- **Observación (no es obra nuestra):** entre el 2026-10-03 y hoy desaparecieron de la raíz de `CLIENTES` tres
  archivos sueltos (`PHOTO-2026-05-05-12-04-38.jpg`, `…-40.jpg`, `…-42.jpg`; estaban allí al 03/10, la última
  modificación era del 19/05). Alguien de EFFORT los movió o los borró; todas las lecturas de esta conversación son
  GET.
- **Para deshacerlo:** si Laura, Lili o Daniel quieren sacar el modelo, basta con borrar la carpeta
  `999 CLIENTE MUESTRA`. La borra una persona de EFFORT, no Claude.
- **Corrección el mismo día (2026-10-07, dentro del mismo alcance autorizado: «lo único que puedes crear y tocar»
  es el cliente 999):** Daniel vio que las carpetas de primer nivel decían «00 …» y no «999 …». Era un error de
  diseño del Manual v1.2 (el prefijo «00» se confundía con un código de cliente). Se renombraron las 5 carpetas
  de primer nivel de `999 CLIENTE MUESTRA`: `00 LEGAL Y SOCIETARIO` → `999 LEGAL Y SOCIETARIO`, `00 TRIBUTARIO` →
  `999 TRIBUTARIO`, `PERIODO 2025` → `999 PERIODO 2025`, `PERIODO 2026` → `999 PERIODO 2026` y `ZZ A CLASIFICAR` →
  `999 ZZ A CLASIFICAR`. Script aparte, solo GET y PATCH; solo renombra carpetas que están directamente dentro
  de `999 CLIENTE MUESTRA` y figuran en una tabla fija; `conflictBehavior=fail`. Verificado: mismo contenido
  (212 archivos y 31 subcarpetas) y `CLIENTES` sigue con 144 elementos. El manual pasó a la versión 1.3.
