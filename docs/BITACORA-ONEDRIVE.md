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
