# Discrepancias y confirmaciones pendientes con EFFORT

Toda regla que el sistema aplica sobre dinero, plazos o estados y que todavía no
fue contrastada contra un documento real de EFFORT se anota acá. Ninguna se
resuelve por criterio propio: se confirma con Laura o Lili, o se deja marcada.

---

## 1. Divisores de IVA — CONFIRMADO VERBALMENTE, FALTA CONTRASTE DOCUMENTAL

**Regla aplicada:** IVA 10% = total / 11 · IVA 5% = total / 21 · redondeo desde
0,5 hacia arriba, resultado en guaraníes enteros.

**Estado:** confirmado por EFFORT vía Daniel (jul-2026). Falta el contraste
contra un documento ya presentado.

**Cómo se cierra:** tomar **una liquidación real de un cliente, de un período ya
cerrado y presentado**, cargarla en el sistema y comparar el IVA calculado
contra el de la liquidación, comprobante por comprobante. Si coincide al
guaraní en todos, la regla queda cerrada y se quita
`requiere_confirmacion_cliente` de la tabla `regla_impositiva`.

**Por qué importa:** es la única regla del sistema que mueve dinero y que
todavía no se validó contra un documento que la DNIT ya recibió. Si el criterio
de redondeo de EFFORT difiere en algún caso de borde, es mejor descubrirlo con
una liquidación vieja que con una nueva.

---

## 2. Redondeo de importes negativos — DECISIÓN TOMADA, CONVIENE VALIDAR

**Regla aplicada:** -2,5 redondea a -3 (en magnitud), no a -2.

**Dónde aparece:** notas de crédito y saldos de IVA a favor arrastrados.

**Por qué se eligió así:** para que un saldo a favor y un saldo a pagar del mismo
importe redondeen al mismo valor absoluto. Con la convención alternativa, un
crédito fiscal arrastrado se erosionaría de a un guaraní por período.

**Cómo se cierra:** mostrar a EFFORT una nota de crédito real con importe que
caiga justo en la mitad y confirmar el criterio. Ver
`docs/adr/0002-representacion-del-dinero.md`.

---

## 3. Clientes piloto — CERRADO (2026-09-09)

El handoff original listaba: GARSO S.A., LAURA SOSA, RAMIRO GARCIA, GERARDO
SOSA, NR REGISTROS GANADEROS — desactualizado, reemplazado.

**2026-09-09, confirmado por Daniel:** los 5 clientes piloto son **Ecoagro,
Dibec, SIPAR, Fumipro, Copesa**. Solo los nombres — para sembrarlos (tarea 56)
todavía hace falta, por cada uno: RUC, razón social completa, y al menos un
contacto (nombre + correo). No se pueden inventar estos datos (regla del
proyecto de cero datos falsos, y un RUC inventado podría chocar con el de una
empresa real). Se buscó si estos datos ya estaban en el OneDrive real de
EFFORT antes de pedírselos de nuevo a Daniel — ver
`docs/BITACORA-ONEDRIVE.md`, entrada 2026-09-09 — sin resultado: la cuenta
`effort360@effort.com.py` (la de Daniel dentro del tenant) tiene el OneDrive
vacío, no es donde Laura/Lili trabajan a diario.

**Cerrado el mismo día:** el archivo sí existía — en el OneDrive de Laura
Sosa (`CLIENTES EFFORT E.A.S/CLIENTES/`, 144 subcarpetas, una por cliente
real de EFFORT), leído en modo solo lectura (ver `docs/BITACORA-ONEDRIVE.md`).
Cada carpeta de cliente tiene su constancia oficial de RUC de Marangatú (SET
Paraguay). Datos finales, sembrados en la base real (tarea 56):

| Cliente | RUC | Razón social oficial |
|---|---|---|
| Fumipro | 80119631-0 | FUMIPRO S.A. |
| Copesa | 80003112-1 | COPESA CONSTRUCCIONES SA |
| Sipar | 80012742-0 | SILICATOS PARAGUAYOS SA (SIPAR S.A.) |
| Ecoagro | 80022319-5 | ECOAGRO SA |
| Dibec | 80082006-1 | DIBEC SOCIEDAD ANONIMA |

`Dibec` tenía dos entidades legales distintas en el registro de EFFORT: la
sociedad anónima de arriba, y un "DIBEC UNIPERSONAL" a nombre de una persona
física (Diego Beconi) — no la misma cosa con otro nombre. Daniel confirmó
que la del piloto es la S.A., no la unipersonal, antes de cargar nada.

---

## 4. Período del piloto — DEFINIDO, FALTA CONFIRMAR CON EFFORT

**Definido con Daniel (jul-2026):** enero a junio de 2026, los mismos 6 períodos
para los 5 clientes. Seis períodos por cinco clientes son 30 filas de proceso
mensual.

**Cómo se cierra:** confirmar que EFFORT tenga los 6 períodos completos y
cerrados para los 5 clientes. Si algún cliente arranca más tarde, se registra
como período no aplicable en vez de quedar como faltante.

---

## 5. Umbrales de alerta de vencimientos — VALOR POR DEFECTO

**Regla aplicada:** 30 / 15 / 7 / 2 días y vencido.

Viene de `Proximos_Pasos_EFFORT_Control_360.md`, sección 14. Cada obligación
puede sobreescribirlo con su propio `dias_alerta`.

**Cómo se cierra:** revisar con EFFORT obligación por obligación. Una
presentación ante Abogacía probablemente necesite más de 30 días de aviso: la
multa de Gs. 6.000.000 sugiere que el problema fue enterarse tarde, no
olvidarse el último día.

---

## 6. Acceso a OneDrive — CERRADO (2026-09-04)

**Definido:** cuenta de sistema dedicada (`effort360@effort.com.py`, tenant
"EFFORT CONSULTORA E.A.S.") con acceso vía Microsoft Graph API con registro de
aplicación en Azure AD.

**Por qué una cuenta dedicada y no la de Laura o Lili:** si el sistema usa una
cuenta personal, un cambio de contraseña o un reseteo de 2FA lo deja sin acceso
sin aviso, y los permisos quedan atados a una persona en vez de a la empresa.

**Avance real, hecho junto con Daniel el 2026-08-09** (los datos no sensibles
quedan acá; el secreto vive únicamente en `.env`, nunca en este documento ni
en el chat):

1. La cuenta `effort360@effort.com.py` resultó tener permisos de administrador
   en Microsoft Entra ID del tenant de EFFORT — alcanzó para hacer todo esto
   sin depender de que alguien más lo hiciera.
2. Registro de aplicación creado en Azure AD: **"EFFORT Control 360"**.
   - `Tenant ID`: `ae2788f8-bef0-48e0-80f8-574443fc3cc7`
   - `Client ID`: `08a003d4-ec28-4229-a35b-2db115e3c325`
   - `Client Secret`: generado, cargado en `.env` local (`AZURE_TENANT_ID`,
     `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` — ver `.env.example`).
3. **Verificado con una llamada real** (no solo "se guardó"): se pidió un
   token contra `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
   con `grant_type=client_credentials` — devolvió un token Bearer válido. Las
   tres credenciales son correctas.
4. **Todavía sin permisos de Graph asignados**: una llamada de prueba a
   `/v1.0/users/effort360@effort.com.py/drive/root/children` devolvió
   `404 ResourceNotFound — User's mysite not found`, no un 403 de permisos.
   Puede ser que el OneDrive de esa cuenta no esté aprovisionado todavía, o
   que simplemente falten los permisos de aplicación — no se puede saber cuál
   de las dos causas es hasta completar el paso 5.
5. Se agregaron los permisos de aplicación de Microsoft Graph
   `Files.ReadWrite.All` (OneDrive) y `Mail.Send` (tarea 95 — mismo registro
   sirve para las dos, no hace falta repetir el registro completo). Quedaron
   marcados como **"No concedido para EFFORT CONSULTORA E.A.S."**
6. **Bloqueado en el último paso el 2026-08-09** (ya no lo está, ver
   corrección abajo): el botón "Conceder consentimiento de administrador"
   estaba deshabilitado para `effort360@effort.com.py` porque esa cuenta
   podía crear y configurar aplicaciones, pero no era Administrador Global
   del tenant. Se había verificado en Entra ID → Roles y administradores →
   "Administrador global": solo Laura y Lili tenían ese rol.

**Corregido el 2026-09-03:** `effort360@effort.com.py` es la cuenta de
Daniel — confirmado por él directamente, y verificado en una captura de
Entra ID → Roles y administradores → "Administrador global" → Asignaciones,
que ahora lista a `effort360`, `lsosa@effort.com.py` (Laura) y
`llaconich@effort.com.py` (Lilian) como Administradores Globales. No se sabe
si el rol se agregó después del 2026-08-09 o si la comprobación de esa fecha
tenía un error — no importa para seguir: **el bloqueo ya no existe.** Daniel
puede entrar directo con `effort360@effort.com.py` (ya confirmado que
funciona sin errores de tenant) y completar él mismo: Registros de
aplicaciones → EFFORT Control 360 → Permisos de API → "Conceder
consentimiento de administrador".

**Consentimiento concedido el 2026-09-04** (captura de "Permisos de API"
mostrando "Se ha otorgado correctamente el consentimiento del administrador"
y los tres permisos —`Files.ReadWrite.All`, `Mail.Send`, `User.Read`— como
"Concedido para EFFORT..."). Se repitió la llamada de prueba del punto 4
(lectura únicamente, nada se escribió) y **el 404 sigue igual** — eso ya
descarta la causa "faltaban permisos": no era eso.

**Diagnóstico completo, mismo día:** con el token de la app ya autorizado,
se probaron tres lecturas más:
- `GET /v1.0/sites/root` → **200 OK**, devuelve
  `effortconsultora.sharepoint.com` — el SharePoint del tenant existe y
  responde bien.
- `GET /v1.0/users/effort360@effort.com.py/drive` → mismo
  `404 ResourceNotFound — User's mysite not found`.
- `GET /v1.0/users/effort360@effort.com.py` → `403 Authorization_RequestDenied`
  (falta el permiso `User.Read.All` de aplicación para leer perfiles de
  usuario — no es del OneDrive, es un permiso que no se pidió porque no hace
  falta para nada de lo que este sistema necesita hacer).

**Conclusión:** el tenant y los permisos están bien. Lo que falta es que el
**OneDrive personal de la cuenta `effort360@effort.com.py` nunca se
aprovisionó** — pasa cuando una cuenta nunca abrió OneDrive al menos una vez,
o no tiene licencia de OneDrive/SharePoint asignada.

**Cerrado el mismo día:** Daniel entró una vez con `effort360@effort.com.py`
a `https://effortconsultora-my.sharepoint.com` y abrió OneDrive (pantalla
vacía, "Los archivos recientes se mostrarán aquí" — alcanza con que cargue,
no hacía falta subir nada). Eso disparó el aprovisionamiento. Se repitió la
llamada de prueba del punto 4 una vez más: **`200 OK`, `{"value": []}`** —
ya no da 404. Acceso real a OneDrive confirmado de punta a punta: token →
consentimiento → lectura real de la carpeta raíz.

**Tarea 88 cerrada.**

**Carpeta raíz definida el 2026-09-04, acordada con Daniel:** en vez de
apuntar el sistema a la carpeta real donde Laura/Lili ya trabajan a diario
(el lugar con los archivos irremplazables, sin backup propio), se usa una
carpeta **nueva, que hoy no existe**, dueña por completo del sistema, en el
OneDrive de `effort360@effort.com.py`:

```
/EFFORT Control 360/
    /Entrada/    ← EFFORT copia (no mueve) ahí lo que el sistema tiene que leer
    /Salida/     ← lo que el sistema genera (reportes, liquidaciones, etc.)
    /Respaldo/   ← espejo de seguridad de lo ya procesado
```

**Creada de verdad el 2026-09-10** (hasta esa fecha existía solo como
decisión escrita acá: el OneDrive de `effort360` estaba vacío). Verificada
leyéndola de vuelta: `/EFFORT Control 360/` con `Entrada/`, `Salida/` y
`Respaldo/`, en el OneDrive de `effort360@effort.com.py`. **Es la única
carpeta donde el sistema escribe.** Todo lo demás —incluido el registro de
clientes de EFFORT, que vive en el OneDrive de Laura— es de **solo
lectura**: se copia desde ahí hacia `/Entrada/`, nunca al revés.

**Por qué:** como la carpeta no tiene nada adentro hoy, es imposible que el
sistema cruce con un archivo real de un cliente — no por promesa de código,
sino porque ese archivo no está ahí. El costo es un paso manual: alguien de
EFFORT tiene que copiar los comprobantes/exportaciones de SIGA del período a
`/Entrada/` antes de que el sistema los procese. Automatizar ese copiado
desde la carpeta real de trabajo diario queda como decisión futura, a
evaluar recién cuando haya confianza acumulada — no ahora.

El adaptador real (`DriveGraph`) sigue sin cablearse contra esta carpeta
todavía — los tests automáticos siguen usando el doble en memoria
(`DriveFalso`). Cablearlo contra `/EFFORT Control 360/` de verdad es trabajo
de la Parte 5 en adelante, **probado primero contra una carpeta de prueba
separada** antes de apuntar contra la real, aunque la real ya sea "solo del
sistema" (ver `CLAUDE.md`, regla 5).

**2026-09-09 — Corrección importante a un supuesto de este punto: "la
carpeta real donde Laura/Lili ya trabajan a diario" (mencionada arriba) no
está en Microsoft 365.** Con permiso de Daniel de leer (nunca escribir) las
carpetas reales, se exploró a fondo, solo lectura: el OneDrive de
`effort360@effort.com.py`, el sitio raíz de SharePoint, y el sitio de Teams
"EFFORT CONSULTORA E.A.S." — los tres vacíos. Confirmado de forma
concluyente desde el **Centro de administración de SharePoint** (que lista
todos los sitios del tenant, sin importar membresía): existen exactamente 3
sitios en total, los tres con 0.00 GB, y **el tenant completo usa 15.00 MB
de 1.11 TB disponibles**. Detalle completo en `docs/BITACORA-ONEDRIVE.md`.

**Esto no es un problema de permisos — es que los archivos reales de EFFORT
nunca estuvieron guardados en Microsoft 365.** Tienen que vivir localmente
en alguna computadora, o en un servicio en la nube ajeno a este tenant.
Cambia el supuesto de fondo de la Parte 5: no hay ninguna "carpeta real en
OneDrive" de la que copiar automáticamente — el paso manual de copiar a
`/Entrada/` (arriba) puede terminar siendo la única forma posible, no un
paso transitorio hasta poder automatizarlo. **Pendiente de confirmar con
Daniel:** dónde viven realmente los archivos hoy.

---

## 7. Rol de aplicación en producción — DEFINIDO, FALTA ASIGNAR CONTRASEÑA

**Estado:** el rol `effort_app` ya existe en Supabase con los permisos mínimos y
sus políticas RLS, pero está creado **sin contraseña y NOLOGIN** a propósito:
una contraseña en un archivo de migración queda en el historial de git para
siempre.

**Qué puede y qué no** (verificado con `SET ROLE`, las 9 comprobaciones pasan):

| Operación | `effort_app` |
|---|---|
| Leer, insertar y actualizar datos de negocio | Sí |
| Insertar en `event_log` | Sí |
| Actualizar o borrar `event_log` | **No** |
| Borrar en `registro_contacto` | **No** |
| Borrar en cualquier tabla | **No** |

**Cómo se cierra**, en el despliegue (Parte 8):

```sql
ALTER ROLE effort_app WITH LOGIN PASSWORD '<generada en el despliegue>';
```

Y en producción:
- `DATABASE_URL` (la app en marcha) usa **`effort_app`**.
- `DIRECT_URL` (las migraciones) sigue usando el dueño del esquema, porque
  crear tablas y tipos necesita permisos que la aplicación no debe tener.

---

## 8. RLS de Supabase — MINA DESACTIVADA, PERO CONVIENE SABERLO

Al crear el proyecto se activó "Enable automatic RLS", así que las 20 tablas
tienen Row Level Security habilitado. **No había ninguna política definida**, y
en PostgreSQL eso significa denegar todo a cualquier rol que no sea el dueño de
la tabla.

Funcionaba solo porque la aplicación conecta como `postgres`, que es el dueño y
omite RLS. El día que se conectara con otro rol, **todas las consultas habrían
devuelto cero filas sin dar error**: una caída silenciosa, sin excepción ni log,
que se diagnostica muy mal.

Ya está resuelto: la migración `20260722180000_rol_aplicacion_y_rls` crea
políticas explícitas para `effort_app`.

**Qué recordar hacia adelante:** cualquier rol nuevo de base de datos necesita
su política RLS antes de poder leer nada. Si alguna vez se habilita la Data API
de Supabase, los roles `anon` y `authenticated` no tienen políticas y por lo
tanto no ven absolutamente nada — que es justamente lo que se quiere.

---

## 9. `regla_impositiva` no está conectada al cálculo de IVA — MITAD CERRADA (2026-09-12)

> **Lo que se cerró.** Los divisores ya no son una constante del código: son un
> parámetro **obligatorio** de `desglosarIvaIncluido` y `totalizar`, así que no
> hay forma de calcular IVA sin decir con qué regla se calculó. La tabla
> `regla_impositiva`, que estaba **vacía**, quedó cargada con las tres reglas
> (10% divisor 11, 5% divisor 21, exenta sin divisor) por la migración
> `20260912190000_reglas_impositivas_iva`, con su fuente y marcadas
> `requiere_confirmacion_cliente = true` — porque siguen sin contrastarse contra
> una liquidación real (punto 1). El comentario del archivo, que aseguraba algo
> que no era cierto, ahora lo es.
>
> **Lo que NO se cerró, y es más grande de lo que este punto suponía.** Al
> buscar dónde enchufar la regla apareció que **el motor de IVA no lo llama
> nadie**. `desglosarIvaIncluido` y `totalizar` están completos, con 52 golden
> tests, y no tienen un solo llamador en producción. Los números de IVA que
> guarda el sistema (`proceso_mensual.iva_saldo_a_pagar` y `iva_saldo_a_favor`)
> son los que alguien **escribe a mano** en la pantalla.
>
> Medido contra la base real el 2026-09-12: **1387 documentos, 0 con importe** y
> 5 con tasa; **0 procesos mensuales**. O sea que aunque el motor estuviera
> conectado, no tendría sobre qué calcular.
>
> La cadena que falta es: alguien tiene que poblar `documento.total` y
> `documento.tasa`. Eso lo haría el importador de comprobantes o la extracción
> por IA — que está **fuera del alcance de esta etapa** por decisión explícita
> (ver `CLAUDE.md`). Hasta entonces, el motor contable del IVA existe y está
> probado, pero no participa del sistema.
>
> **Qué decidir con EFFORT:** si el piloto tiene que calcular IVA de verdad —y
> entonces hay que resolver de dónde salen los importes— o si por ahora alcanza
> con controlar que los documentos lleguen y las fechas se cumplan, que es lo que
> el sistema sí hace hoy.

**Hallazgo original (2026-07-23), que sigue valiendo como contexto:**

**Qué se encontró:** al construir el módulo de reglas impositivas (tarea 84),
se comprobó que `packages/core/src/iva.ts` tiene el divisor del IVA
**hardcodeado** en la constante `DIVISOR_IVA_INCLUIDO` (`DIEZ: 11n, CINCO: 21n`),
pese a que el comentario del archivo dice *"las tasas NO están hardcodeadas en
la lógica de negocio: viven en la tabla `regla_impositiva`"*. Ese comentario
describe la intención, no el código actual.

**Alcance real, verificado con grep:** ninguna ruta de `apps/api` llama todavía
a `desglosarIvaIncluido` ni a `totalizar` de `@effort/core`. La determinación
de IVA del proceso mensual (`ivaSaldoAPagar` / `ivaSaldoAFavor`) se carga a
mano vía `PATCH` en el módulo de Proceso Mensual (Parte 4A) — nada la calcula
todavía a partir de los documentos. Es decir: hoy no hay ningún camino de
código que lea `regla_impositiva.divisorIvaIncluido` para calcular nada.

**Por qué importa:** el módulo de la tarea 84 deja a dirección editar la
tabla `regla_impositiva` (agregar una tasa nueva, cerrar la vigente). Esa
edición **no cambia ningún cálculo del sistema hoy**, porque no hay ningún
cálculo que lea esa tabla. Es tentador asumir lo contrario porque el nombre
de la tabla lo sugiere.

**Cómo se cierra:** cuando se conecte la determinación automática de IVA a
partir de los documentos del período (no está en el roadmap todavía como
tarea numerada), esa lógica tiene que leer el divisor vigente desde
`regla_impositiva` — filtrando por `tasa` y por vigencia en la fecha del
comprobante — en vez de seguir usando la constante de `iva.ts`. Mientras tanto,
`DIVISOR_IVA_INCLUIDO` sigue siendo la única fuente real, y debería coincidir
con lo que diga la fila vigente de `regla_impositiva` — si alguna vez
divergen, hay que decidir cuál manda antes de calcular nada.

---

## 10. Layout de columnas del importador de comprobantes — SIN CONFIRMAR

**Qué se asumió:** al construir `@effort/importers` (tarea 91, Parte 5) no
había ningún archivo real de EFFORT para copiar el formato exacto, así que se
definió un layout de columnas razonable pero inventado:

| Columna esperada (acepta variantes de mayúsculas/acentos) | Campo |
|---|---|
| RUC Emisor / RUC del Emisor | `rucEmisor` |
| Timbrado | `timbrado` |
| Numero / Numero de comprobante | `numero` |
| Tipo (FACTURA, NOTA_CREDITO, NOTA_DEBITO, RECIBO, RETENCION, EXTRACTO_BANCARIO, COMPROBANTE_PAGO, OTRO) | `tipo` |
| Origen (COMPRA, VENTA) | `origen` |
| Fecha (AAAA-MM-DD en CSV, celda de fecha en Excel) | `fecha` |
| Total (celda numérica; si es texto, exige dígitos sin separadores) | `total` |
| Tasa (DIEZ, CINCO, EXENTA) | `tasa` |
| Anulado (SI/NO) | `anulado` |

**Por qué importa:** si la planilla real de EFFORT usa otros nombres de
columna, otro orden, u otros valores para Tipo/Origen/Tasa, el importador va a
rechazar todas las filas hasta que se ajuste `ENCABEZADOS` en
`packages/importers/src/comprobantes.ts`. No rompe nada — el reporte de
rechazados va a explicar fila por fila qué no matcheó — pero conviene
confirmarlo antes de usarlo con datos reales para no perder tiempo ajustando a
ciegas.

**Cómo se cierra:** conseguir una planilla real de comprobantes de EFFORT (aunque
sea de un mes viejo) y correr el importador contra ella. Ajustar `ENCABEZADOS`
y los valores aceptados de Tipo/Origen/Tasa/Anulado según lo que aparezca.

---

## 11. Layout de columnas del importador de exportaciones SIGA — SIN CONFIRMAR

**Qué se asumió:** igual que el punto 10, pero para `importarExportacionSiga()`
en `packages/importers/src/siga.ts` (tarea 92). Sin un archivo real exportado
por SIGA, se asumieron estas columnas:

| Columna esperada | Campo |
|---|---|
| RUC Emisor / RUC del Emisor | `rucEmisor` |
| Timbrado | `timbrado` |
| Numero Comprobante / Numero de Comprobante / Numero | `numeroComprobante` |
| Total | `total` |
| Tasa (DIEZ, CINCO, EXENTA) | `tasa` |
| Anulado (SI/NO) | `anulado` |
| Fecha | `fecha` |

A diferencia del importador de comprobantes, acá no hay columna de Tipo ni de
Origen: un reporte exportado de SIGA ya es "libro de compras" o "libro de
ventas" entero — esa distinción se guarda en `tipoReporte` al registrar la
exportación (`POST /api/v1/clientes/:clienteId/siga`), no fila por fila.

**Cómo se cierra:** igual que el punto 10 — conseguir una exportación real de
SIGA (cualquiera de los `tipoReporte` que ya acepta la ruta: libro de compras,
libro de ventas, etc.) y ajustar `ENCABEZADOS` según sus columnas reales.

---

## 12. `npm audit` en rojo por `brace-expansion` — EXCEPCIÓN DOCUMENTADA, NO ES UNA REGRESIÓN

**Qué pasó:** el 2026-07-24, sin ningún cambio de dependencias de por medio,
`npm audit --audit-level=high` (el check `audit` de `scripts/verify.mjs`) pasó
de 0 vulnerabilidades altas a 14. Se confirmó con `git stash` de
`package-lock.json` que el árbol de dependencias no cambió — el aviso
(GHSA-mh99-v99m-4gvg, DoS por expansión sin límite en `brace-expansion`) se
publicó recién, y pasó a marcar como vulnerables versiones de
`brace-expansion` que ya estaban instaladas desde la tarea 91.

**Dos caminos hasta la vulnerabilidad, ninguno alcanzable con nuestro uso real:**
1. `eslint` → `minimatch` → `brace-expansion`. El check `lint` está declarado
   `pendiente` en `scripts/verify.mjs` — `eslint` no corre nunca en este
   proyecto todavía, es peso muerto en `node_modules`.
2. `exceljs` → `archiver` → `archiver-utils`/`readdir-glob` → `minimatch` →
   `brace-expansion`. `archiver` es la pieza de `exceljs` que **escribe** un
   `.xlsx` (comprime a zip). El código de producción de
   `packages/importers/src/archivo.ts` solo **lee** (`workbook.xlsx.load()`);
   nunca llama a `.writeBuffer()`/`.write()`. Ningún patrón glob con datos de
   un archivo real llega a esa función en ningún camino de ejecución real —
   los tests sí usan `writeBuffer()` para armar los `.xlsx` de prueba, pero
   con contenido que el propio test genera, no con un patrón glob de un
   tercero.

**Por qué no se fuerza el fix ahora:** no existe todavía una versión de
`minimatch`, `glob`, `eslint` o `archiver` publicada que dependa de
`brace-expansion@5.0.8` (la versión parcheada). La única forma de silenciar
el aviso hoy es `npm audit fix --force`, que sube `eslint` a una major sin
probar y **baja `exceljs` a 3.4.0** — más vieja que la 4.4.0 ya validada con
los 18 tests de `@effort/importers`. Cambiar dependencias para tapar una
vulnerabilidad que no es explotable en como se usa, a cambio de arriesgar una
regresión real, es peor negocio.

**Estado del gate:** el check `audit` de `npm run verify` queda **en rojo a
propósito** desde el 2026-07-24 hasta que se cierre este punto — no se bajó el
umbral de `--audit-level` para taparlo, porque eso dejaría de avisar sobre
cualquier otra vulnerabilidad alta futura que sí importe. Cuando el roadmap
diga "X OK / Y pendientes / 1 fallido" con este punto citado, es este caso
conocido, no una regresión sin diagnosticar.

**Cómo se cierra:** correr `npm audit` de nuevo cada tanto; en cuanto
`minimatch`/`glob`/`eslint` publiquen una versión que resuelva
`brace-expansion@>=5.0.8`, correr `npm update` (o `npm audit fix`) y verificar
que el check vuelva a OK sin tocar `exceljs`.

---

## 13. Proveedor de envío de correo (tarea 95, Parte 6) — SIN CONFIRMAR

**Qué falta:** la tarea 95 (despachador de notificaciones) necesita saber con
qué servicio EFFORT envía correo hoy. Sabemos que usan **Microsoft 365** (ya
confirmado, ver bitácora del 2026-07-21 — es la razón por la que se eligió
OneDrive), pero no está confirmado si el correo lo manejan a través de ese
mismo Microsoft 365/Exchange Online o con otro proveedor separado.

**Recomendación técnica ya evaluada, pendiente de confirmar:** usar
**Microsoft Graph** (`/users/{id}/sendMail`) con el mismo mecanismo de
autenticación client-credentials que `DriveGraph` (tarea 89) — reusa el mismo
registro de Azure AD de la tarea 88 en vez de sumar un proveedor externo
(Resend, SES) con un dominio nuevo que verificar. Mejor entregabilidad (el
correo sale de un `@effort.com.py` real) y sin costo adicional si el plan de
Microsoft 365 Business Basic ya definido incluye Exchange Online.

**Cómo se cierra:** confirmar con Laura o Lili qué proveedor de correo usa
EFFORT realmente antes de construir la tarea 95. Si confirman Microsoft 365,
se sigue con la recomendación de arriba. Si usan otra cosa, hay que
reevaluar — la tarea 95 queda pausada hasta entonces.

---

## 14. `npm audit` en rojo por `deepmerge-ts` (vía Prisma) — EXCEPCIÓN DOCUMENTADA, NO ES UNA REGRESIÓN

**Qué pasó:** el 2026-08-10, sin cambiar ninguna dependencia de Prisma, el
check `audit` empezó a fallar por un aviso nuevo (GHSA-ggr8-5vv4-36mx,
agotamiento de pila al combinar objetos recursivos) en `deepmerge-ts`, que
llega transitivamente vía `@prisma/config` → `prisma` (devDependency). Mismo
patrón que el punto 12: un aviso recién publicado que empieza a marcar una
dependencia que ya estaba instalada, sin que el código propio haya cambiado.

**Por qué no se aplica el fix:** `npm audit fix --force` instalaría
`prisma@6.12.0` — **una versión por debajo de la fijada en el proyecto
(6.19.3, ver `CLAUDE.md`)**. Prisma 7 ya está descartado ahí mismo porque
cambia la configuración de conexión de forma incompatible; bajar a 6.12.0 es
el mismo tipo de riesgo, no una mejora. Además, la vulnerabilidad es en una
herramienta de build/CLI que combina el propio archivo de configuración del
proyecto — no procesa ningún dato de un usuario ni corre en producción.

**Cómo se cierra:** esperar a que `prisma`/`@prisma/config` publiquen una
versión ≥6.19.3 que dependa de `deepmerge-ts` parcheado, y correr
`npm update`. Revisar en cada `npm run verify` (ya pasa automáticamente).

---

## 15. Supabase inalcanzable el 2026-08-10 — CERRADO el 2026-08-20 (proyecto pausado)

**Qué pasó:** `npm run verify` falló dos veces seguidas en `test:integration`
con `FATAL: (ENOTFOUND) tenant/user postgres.nrslhqtdyybmtvvwgirq not found`.
No es el problema intermitente de concurrencia ya documentado en otras
entradas de la bitácora (ese da `tuple concurrently updated` o
`Can't reach database server`, y se resuelve reintentando). Se verificó por
partes antes de asumir nada:

- El DNS de `aws-0-sa-east-1.pooler.supabase.com` resuelve bien
  (`54.94.90.106`) — no es un problema de red.
- El pooler de Supabase responde, pero dice explícitamente que no reconoce el
  proyecto `nrslhqtdyybmtvvwgirq` como un tenant válido.

Esto apunta a que el proyecto de Supabase esté **pausado** — el plan
gratuito/Nano se pausa solo después de varios días sin actividad — o que algo
haya cambiado del lado de la cuenta.

**No bloquea nada más:** el resto de `npm run verify` (14 checks, incluidos
los 22 tests nuevos de la tarea 102 y una verificación real en el navegador)
pasó en verde. Solo los 2 tests que necesitan una conexión real a Postgres
quedan sin poder correr hasta que se confirme el estado del proyecto.

**Cómo se cierra:** entrar al dashboard de Supabase y confirmar si el
proyecto está pausado (reanudarlo con un clic si es así) o si cambió algo más
serio (contraseña reseteada, proyecto movido). Una vez resuelto, correr
`npm run verify` de nuevo para confirmar que `test:integration` vuelve a
pasar.

**Seguía caído el 2026-08-20**, diez días después, mismo `FATAL: (ENOTFOUND)
tenant/user postgres.nrslhqtdyybmtvvwgirq not found`. Además de los tests ya
mencionados, quedaron sin poder correr contra la base real los 4 tests de
integración nuevos de `SolicitudesPrisma` (tarea 101 del roadmap). No es un
problema nuevo — es el mismo punto 15, todavía sin resolver del lado de
Supabase.

**Cerrado el 2026-08-20, mismo día:** Daniel confirmó en el dashboard de
Supabase que el proyecto estaba efectivamente **pausado** (pantalla "Project
'Effort-Control-360' is paused", resumible hasta el 09-sep-2027) — exactamente
la causa sospechada arriba, no una credencial rota ni un cambio de cuenta. Lo
reanudó con el botón "Resume project". El primer reintento inmediatamente
después todavía dio el mismo `ENOTFOUND` (el pooler tarda un par de minutos en
volver a reconocer el tenant); un segundo reintento ~3 minutos más tarde
conectó sin problemas. `npx vitest run --project integracion` → **106/106
tests en verde**, incluidos los 4 nuevos de `SolicitudesPrisma`. `npm run
verify` completo → 16 OK / 3 pendientes declarados / 1 fallido (`audit`,
excepción de los puntos 12 y 14, sin relación). No hace falta ninguna acción
de código — el punto queda como referencia de qué hacer la próxima vez que el
proyecto se pause solo por inactividad: entrar al dashboard, reanudar, y
esperar un par de minutos antes de reintentar `test:integration`.

**Recurrió el 2026-09-03** (tarea 104, pantalla Alertas): mismo síntoma,
primero `ENOTFOUND tenant/user postgres.nrslhqtdyybmtvvwgirq not found` y
luego, en un reintento posterior en la misma sesión, `Can't reach database
server at aws-0-sa-east-1.pooler.supabase.com:5432`.

**Cerrado el mismo día:** Daniel confirmó que Supabase ya respondía;
`npx vitest run --project integracion` → **106/106 en verde**, sin tocar
nada de código. Mismo patrón de siempre — plan gratuito/Nano que se pausa
solo por inactividad. Arreglo de referencia para la próxima vez: dashboard
de Supabase → "Resume project" → esperar un par de minutos → reintentar.

---

## 16. No existía forma de que un usuario gestione sus propias credenciales — CERRADO (2026-09-10)

**Encontrado** al ir a sembrar los 10 usuarios reales de EFFORT (tarea 57
ampliada). Verificado con `grep` sobre las rutas, no supuesto:

- **No hay ruta de cambio de contraseña.** Las únicas rutas que tocan
  usuarios son `POST /api/v1/usuarios` (alta, solo dirección, recibe
  `contrasenaInicial`) y `PATCH /api/v1/usuarios/:id` (edición) — y el
  `edicionSchema` **no tiene ningún campo de contraseña**. Ni la persona
  puede cambiar la suya, ni dirección puede resetearla.
- **`debeCambiarContrasena` es una bandera que nada lee.** Está en el modelo
  y se pone en `true` al crear, pero no existe ningún flujo que la haga
  cumplir ni que permita cumplirla.
- **No hay flujo de alta del segundo factor.** `generarSecretoTotp()` y
  `urlDeConfiguracionTotp()` existen en `seguridad/credenciales.ts` pero
  **no se llaman desde ninguna ruta**. Y como `direccion` y `responsable`
  tienen segundo factor obligatorio (`ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO`),
  un usuario de esos roles sin `secretoTotp` recibe un 403 en el login y
  **no se le crea sesión** — así que no puede llegar a ningún endpoint de
  configuración. Es un círculo cerrado.

**Por qué importa, y por qué no es un detalle cosmético:** Daniel pidió el
2026-09-10 que el sistema *"siempre tiene que decir quién hizo qué
modificación"*. La bitácora hace exactamente eso (ver `bitacora.ts`:
registra `usuarioId`, acción, entidad, valores antes/después, IP y fecha).
Pero si la contraseña de cada persona la fija un administrador y esa persona
no puede cambiarla nunca, entonces **quien dio de alta la cuenta conoce para
siempre la credencial de esa persona**, y la línea "Karina modificó X" deja
de ser prueba de que lo hizo Karina. Para una consultora cuyo producto es
evidencia auditable, eso vacía de valor el registro.

**Consecuencia práctica:** sembrar los 10 usuarios *antes* de construir
esto significaría repartir 10 credenciales permanentes conocidas por el
administrador, y volver a repartirlas cuando el flujo exista. Es
exactamente el retrabajo que Daniel pidió evitar.

**Cómo se cierra:** construir, antes de sembrar el equipo:
1. Cambio de contraseña propia (exigiendo la actual), que baje
   `debeCambiarContrasena` y actualice `contrasenaActualizadaEn`.
2. Primer acceso obligatorio: con `debeCambiarContrasena = true`, la sesión
   solo habilita cambiar la contraseña, nada más.
3. Alta del segundo factor por autoservicio: mostrar secreto/QR una vez,
   confirmar con un código válido, recién ahí `segundoFactorActivo = true`.
   Requiere decidir cómo se emite una sesión limitada de configuración para
   un rol con segundo factor obligatorio que todavía no lo tiene — hoy ese
   caso se corta con 403 antes de crear sesión (`rutas/autenticacion.ts`).

**Nota:** el usuario `effort360` pudo entrar porque su secreto TOTP se
cargó directamente en la base con un script, no por un flujo del producto.
Es la prueba de que el hueco existe.

**Cerrado el mismo día.** Construido lo que faltaba, backend e interfaz:

1. `POST /api/v1/mi/segundo-factor` entrega el secreto **una sola vez**. Si ya
   hay uno configurado responde 409 y no lo regenera: hacerlo con la sesión de
   la víctima es justo el ataque que el segundo factor debería frenar. La
   condición está en la propia consulta (`where: { secretoTotp: null }`), no
   solo en la ruta.
2. `POST /api/v1/mi/segundo-factor/confirmar` exige un código real del
   dispositivo antes de activar. Guardar el secreto no prueba que la persona
   llegó a cargarlo en su aplicación; si se activara al entregarlo, quien
   cierra la pantalla a mitad de camino quedaría bloqueado con un secreto que
   nadie tiene.
3. `POST /api/v1/mi/contrasena` exige la contraseña actual y cierra **todas**
   las sesiones, incluida la propia: si alguien más conocía la vieja y tenía
   sesión abierta, el cambio tiene que echarlo.

El login ya no responde 403 sin sesión cuando falta configurar el segundo
factor: emite una sesión **pendiente**. `evaluarSesion` ya la rechazaba para
toda ruta de negocio (devuelve `SEGUNDO_FACTOR_PENDIENTE`, no `VIGENTE`), así
que lo único que habilita es configurar el propio segundo factor — se
aprovechó una garantía que ya existía en vez de agregar un estado nuevo.

`debeCambiarContrasena` se hace cumplir con una **guarda global** en el
`preHandler`, con una lista corta de rutas permitidas, no ruta por ruta: mismo
criterio que el hook de CSRF, porque una ruta nueva que se olvide de
comprobarlo es exactamente cómo se abre un agujero sin que nadie lo note.

**Verificado, no asumido:** 12 tests nuevos en `apps/api/test/mi-cuenta.test.ts`,
6 en `apps/web/test/CredencialesPropias.test.tsx`, y sobre todo
`e2e/pruebas/primer-acceso.spec.ts` — que recorre el camino entero en un
navegador real contra servidor y base reales: entra con la contraseña inicial,
**lee el secreto de la pantalla** (no uno hardcodeado, así comprueba que lo que
se le muestra a la persona sirve de verdad), lo confirma, cambia la contraseña,
comprueba que la vieja ya no sirve y vuelve a entrar con la nueva.

Queda pendiente, y es una decisión de EFFORT, no un hueco: **qué hacer si
alguien pierde su dispositivo**. Hoy no hay forma de regenerar un segundo
factor ya configurado, a propósito. Corresponde un procedimiento con dirección
de por medio, no un botón de autoservicio.

**Variante del mismo problema, 2026-09-10:** con el proyecto **despierto y
respondiendo**, dos corridas fallaron igual por saturación momentánea del
pooler, no por pausa: `npx playwright test` no pudo ni crear el esquema
temporal (`Can't reach database server`), y `test:integration` cortó con
`Transaction API error: Unable to start a transaction in the given time` en
`reemplazarCartera` — código que nadie había tocado. Las dos pasaron al
reintentar sin cambiar nada (3/3 y 106/106). Antes de investigar un fallo
así como si fuera de código: **reintentar una vez**. Si pasa, era esto.

---

## 17. Calendario tributario de la DNIT — CASI CERRADO (2026-09-10)

> **Actualización 2026-09-12 — confirmado contra la fuente oficial.** Los puntos
> (a) y (b) dejaron de depender de la palabra de nadie: el portal de la DNIT
> publica la tabla, y coincide exactamente con la que EFFORT había pasado.
> Norma: **Resolución General N° 38/2020** (5 de febrero de 2020), artículo 3°,
> "Calendario Perpetuo".
> Página: `dnit.gov.py/web/portal-institucional/w/vencimiento-ley-n-6380/19`.
> La DNIT dice textualmente "el último dígito del RUC **sin considerar el dígito
> verificador**" — que es, palabra por palabra, el criterio que EFFORT dio con el
> ejemplo del `80007729-6`. El dato que dio tres vueltas quedó confirmado por dos
> caminos independientes.
>
> **Aparecieron dos cosas que no sabíamos, y una era un error del sistema.** Ver
> el punto 19, abierto el mismo día.
>
> No pude descargar el PDF firmado de la RG 38/2020 (el buscador del portal
> devuelve la ficha HTML, no el archivo). Lo citado sale de la ficha oficial del
> portal de la DNIT, que es oficial pero es resumen, no la norma firmada.

El motor de vencimientos está construido, probado y **ya generando** con el
calendario que EFFORT confirmó. Queda un solo punto abierto, el (d).

**a) Qué día vence cada terminación de RUC — CERRADO.** Los diez días viven en
`obligacion_tributaria.dias_por_terminacion_ruc`, como dato editable y no como
constante en el código. Ninguno está escrito en el código fuente.

**b) Cuál es la "terminación" del RUC — CERRADO el 2026-09-10.** Es **la última
cifra del NÚMERO, sin contar el dígito verificador**. En `80007729-6` la
terminación es **9**, no 6. Confirmado por EFFORT con la tabla oficial y ese
ejemplo textual, que quedó como test en
`packages/core/test/vencimientosTributarios.test.ts`.

Vale la pena dejar escrito el camino, porque es la mejor defensa de por qué
existe este documento: el dato dio una vuelta completa antes de asentarse.
Primera implementación: la cifra del número (correcta, pero sin confirmar).
Consulta a EFFORT: respondieron "el dígito verificador", y se cambió.
Al día siguiente llegó la tabla oficial con el ejemplo textual, que decía lo
contrario, y se volvió a la primera versión. Todo eso pasó en horas y sin
consecuencias **porque la regla vivía en una función propia, marcada como
pendiente de confirmar, y no enterrada en línea dentro del cálculo**. Si
hubiera estado dispersa, corregirla habría sido otra historia.

**a-bis) Los días confirmados.** Tabla provista por EFFORT el 2026-09-10:

| Termina en | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Día | 7 | 9 | 11 | 13 | 15 | 17 | 19 | 21 | 23 | 25 |

**d) Qué pasa cuando el día cae en fin de semana o feriado — CERRADO el
2026-09-11.** Daniel lo confirmó textualmente: *"si cae sábado, domingo o
feriado, pasa al siguiente día hábil"*. Es exactamente lo que el sistema ya
hacía (`proximoDiaHabil` en `packages/core/src/vencimientosTributarios.ts`),
así que no hubo nada que cambiar.

Queda anotado igual porque la confirmación vale por sí sola: era la dirección
riesgosa del error. Si la fecha hubiera sido fija y el sistema la trasladaba,
habría dado por vigente algo ya vencido el domingo anterior. Ejemplo real del
piloto: Ecoagro (RUC 80022319-5, terminación 9 → día 25) en abril de 2026 cae
sábado, y el sistema lo pone el lunes 27 — ahora se sabe que está bien.

**Con esto el punto 17 queda cerrado entero, salvo el (c):** falta el mes de
presentación de IRE, EEFF y Planilla RG90. Las tres están cargadas y asignadas
a los 5 clientes, pero sin confirmar, así que no generan vencimientos.

**c) Qué obligaciones tiene cada uno de los 5 clientes.** IVA general, IRE,
IRP, anticipos, retenciones: no todos deben lo mismo, y lo que deben cambia con
el tiempo. Por eso `obligacion_de_cliente` lleva `desde`/`hasta`.

**Cómo está protegido mientras tanto:** toda obligación nace con
`confirmada_por_effort = false`, y el generador **ignora** las no confirmadas.
Se pueden cargar y revisar sin que produzcan un solo aviso. Hasta que alguien
de EFFORT las confirme contra la resolución vigente de la DNIT, el sistema no
genera vencimientos — que es preferible a generarlos mal.

Mismo criterio que los feriados (`diasHabiles.ts`) y que las reglas impositivas
(punto 9): el dato regulatorio se inyecta y se confirma, no se entierra en el
código.

---

## 18. Latencia: la base está lejos de la API — MEDIDO, DECISIÓN PENDIENTE (2026-09-11)

Daniel reportó que cada pantalla tarda en cargar. Medido, no supuesto:

| Consulta | Tiempo |
|---|---|
| `SELECT 1` (ida y vuelta pura) | 313 ms |
| Listar los 5 clientes | 323 ms |
| Radar de vencimientos | 397 ms |
| Alertas abiertas | 408 ms |
| Documentos de un período | 348 ms |

**Lo que dice esta tabla:** `SELECT 1` tarda lo mismo que una consulta real. El
costo no está en la consulta sino en el viaje. La interfaz corre en Paraguay, la
API en Nueva York (DigitalOcean no tiene región en Sudamérica) y la base en São
Paulo: cada dato baja, sube y vuelve a bajar. Una pantalla que hace 6 llamadas
paga ese viaje 6 veces.

**Opciones, para decidir con EFFORT:**

1. **Mover la base a una región de EE.UU.** (misma que la API). El viaje
   API↔base pasaría de ~310 ms a ~5 ms, que es la mejora más grande y de lejos.
   Contra: los datos contables de EFFORT saldrían de Sudamérica — es una
   decisión de la empresa, no técnica, y por eso no se toma acá.
2. **Reducir llamadas por pantalla.** `Seguimiento` hace una consulta de
   contactos POR CLIENTE (patrón N+1); con 144 clientes reales eso no escala.
   Arreglarlo es código nuestro y no depende de nadie más.
3. **Dejarlo así.** Con 5 clientes es incómodo pero usable. Con 144 no.

Ninguna es urgente hoy, pero la 2 conviene hacerla igual, y la 1 conviene
decidirla antes de cargar los 144 clientes reales — mover una base con datos
es mucho más caro que elegir bien la región al principio.

---

## 19. Feriados, traslados por decreto y el segundo calendario de la DNIT — ABIERTO (2026-09-12)

Salió de buscar la fuente oficial del calendario tributario (ver punto 17). Lo
que se buscaba era confirmar una tabla; aparecieron tres cosas que no estaban.

### a) Hay DOS calendarios, no uno — CERRADO, ya implementado

La DNIT publica dos tablas por terminación de RUC:

| | Días | Qué incluye |
|---|---|---|
| **Determinativas** | 7, 9, 11, 13, 15, 17, 19, 21, 23, 25 | IVA, IRE (todos los regímenes), IRP, ISC, anticipos |
| **Informativas (DJI)** | 8, 10, 12, 14, 16, 18, 20, 22, 24, 26 | **RG 90** (libro de compras y ventas), **estados financieros**, dictamen de auditoría externa impositiva |

Esto explica exactamente lo que Daniel había pasado el 2026-09-11 sin saber que
eran dos calendarios distintos: "EEFF IRE 25/04, RG 90 26 de cada mes" para
ECOAGRO. El 25 es el calendario determinativo y el 26 el informativo, y las
cinco empresas del piloto coinciden con las dos tablas, una por una.

**No hizo falta cambiar nada de estructura**: `dias_por_terminacion_ruc` se
guarda por obligación, así que las dos tablas conviven desde siempre. Quedó
probado en `packages/core/test/vencimientosTributarios.test.ts`.

**Ojo con los estados financieros**: van por el calendario informativo (8 a 26),
no por el determinativo, aunque venzan el mismo mes que el IRE anual. Es el
error fácil de cometer al cargar las obligaciones.

### b) Los feriados trasladables estaban mal para 2026 — CERRADO, era un bug real

`feriadosParaguay()` devolvía las fechas ORIGINALES de los feriados móviles. En
Paraguay esos feriados no se trasladan por una regla: el Ejecutivo los mueve
**por decreto, año a año** (Ley 7544/2025), y no hay fórmula que lo derive.

Además faltaba un feriado entero: la **Jura de la Constitución (20 de junio)**,
creada por esa misma ley y vigente desde 2026.

**El caso que lo hizo visible.** El RG 90 de ECOAGRO vence el 26. El 26 de
setiembre de 2026 cae sábado, así que corre al lunes 28 — que es el día al que
el Decreto N° 6601 trasladó la Victoria de Boquerón. El vencimiento real es el
martes 29. El sistema decía 28: **daba por vencida la obligación un día antes
que la DNIT**, y habría marcado a ECOAGRO en falta estando todavía en plazo.

Corregido con una tabla de traslados confirmados por año
(`TRASLADOS_DECRETADOS` en `packages/core/src/diasHabiles.ts`), con la fuente al
lado de cada fecha. **Hay que actualizarla cada año.** Mientras un año no esté
cargado se usan las fechas originales, que es el comportamiento conservador: si
algo se movió y no lo sabemos, el sistema avisa antes, nunca después.

### c) Lo que se preguntó — RESPONDIDO POR DANIEL EL 2026-09-12

1. **¿Un feriado extraordinario corre un vencimiento?** → **SÍ. Cualquier
   feriado corre la fecha**, sin distinguir de qué tipo es. La regla que aplica
   EFFORT es más simple que la letra del decreto: el del 2026-06-30 exceptúa
   expresamente a la recaudación tributaria, y aun así corre. **CERRADO** —
   quedó cargado en `FERIADOS_EXTRAORDINARIOS`, con test.
2. **¿La regla de día inhábil aplica a las obligaciones de fecha fija?** →
   **SÍ**, misma respuesta. **CERRADO** — no hizo falta ningún caso especial:
   una obligación de fecha fija son las mismas diez posiciones con el mismo día
   repetido, así que pasa por el mismo corrimiento. Quedó con test.
3. **¿Cada cuánto se revisan los feriados móviles?** → **Cada mes, o cuando el
   gobierno los confirme oficialmente.** **CERRADO en lo que toca al código**:
   `REVISION_DE_FERIADOS` anota la fecha de la última revisión de cada año, y el
   cálculo automático de vencimientos registra un aviso cuando genera fechas de
   un año sin revisar. La revisión en sí es trabajo humano, mensual.
4. **Números de decreto** de los traslados del 1 de marzo y del 20 de junio de
   2026 — **sigue abierto**, pero es trazabilidad, no cálculo: las fechas están
   confirmadas (la del 20 de junio por la Agencia IP, agencia estatal).
5. **Los feriados extraordinarios que todavía no se decretaron** — abierto por
   definición. Al 2026-09-12 el Ejecutivo aún podría decretar hasta dos más este
   año. Es exactamente lo que la revisión mensual del punto 3 tiene que atrapar.

### d) Algo que conviene no olvidar

El traslado por día inhábil **no se propaga en cascada**. Texto de la DNIT: el
vencimiento se corre al primer día hábil siguiente "sin que ello implique el
diferimiento de los demás vencimientos". Si el día 7 cae domingo y pasa al lunes
8, el vencimiento del día 9 sigue siendo el 9. Pueden terminar venciendo dos
terminaciones el mismo día. El sistema ya lo hace bien —cada obligación calcula
su fecha por separado— pero es el tipo de cosa que alguien "arregla" alguna vez
creyendo que es un bug.

### e) Prórroga de estados financieros — NO SE APLICA, PERO CONVIENE RELEER ESTO

**Daniel, 2026-09-12:** *"Ninguno de los 5 clientes tiene RG50, solo el RG90"*.
Decisión tomada: **no se carga la prórroga**. Y es el lado seguro del error — sin
prórroga el sistema reclama en abril en vez de junio, o sea avisa antes.

**Lo que hay que releer con Lili o Laura antes de darlo por cerrado**, porque
puede haber un cruce de nombres: la **RG 90 es un formulario** (la planilla que
se presenta todos los meses), mientras que la **RG DNIT 50/2026 no es un
formulario sino una prórroga**: una resolución que corre la fecha de
presentación de los estados financieros del ejercicio cerrado al 31/12/2025,
del vencimiento de abril al 30 de junio de 2026. No es algo que un cliente
"tenga" o "no tenga" como una obligación — es un plazo más largo que aplica
solo por ser contribuyente de IRE Régimen General con ese cierre.

Puede perfectamente ser que EFFORT ya haya presentado todo en abril y la
prórroga sea irrelevante, que es la lectura más probable. Pero si la respuesta
fue por el nombre parecido al de la RG 90, conviene volver a preguntarlo.

Fuente de la prórroga: `dnit.gov.py/web/portal-institucional/w/extienden-plazo-para-presentaci%C3%B3n-de-estados-financieros`

### f) Dato original de la prórroga — CONFIRMADA EN FUENTE OFICIAL

**Resolución General DNIT N° 50/2026** (7 de abril de 2026): los contribuyentes
de IRE Régimen General con cierre al 31/12/2025 pueden presentar sus **estados
financieros hasta el 30 de junio de 2026**, por calendario DJI. Hay que tenerlo
en cuenta antes de generar alertas de EEFF del ejercicio 2025, o el sistema va a
reclamar algo que está prorrogado.
Fuente: `dnit.gov.py/web/portal-institucional/w/extienden-plazo-para-presentaci%C3%B3n-de-estados-financieros`

### g) El día de los estados financieros — CERRADO (2026-09-12)

> **Respuesta de Daniel:** *"usá los datos que te pasé porque son los que me dio
> Lili"*. Los estados financieros van el **mismo día que el IRE**, por el
> calendario de determinativas. Queda como está cargado, y ahora con la fuente
> nombrada: no es una preferencia nuestra, es lo que indicó Lili.
>
> Vale dejar dicho que sigue difiriendo un día de lo que publica la DNIT, que
> los ubica en el calendario de informativas. Si alguna vez aparece una multa
> por presentación tardía de estados financieros, éste es el primer lugar donde
> mirar. Pero la diferencia juega a favor: el sistema reclama un día antes.

**Lo que se había planteado, para contexto:**

Al cargar las obligaciones del piloto apareció una diferencia de un día que
conviene zanjar con EFFORT.

Daniel dio, para cada cliente, *"EEFF IRE 25/04"* — los estados financieros y el
IRE juntos, el mismo día. Pero la DNIT ubica a los estados financieros en el
calendario de **informativas** (días 8 a 26), un día después del IRE, que va por
el de **determinativas** (7 a 25). Para ECOAGRO: IRE el 25, estados financieros
el 26.

**Se cargó lo que dio EFFORT** (mismo día que el IRE), por dos razones: es quien
conoce su propia operación, y es el lado conservador — el sistema reclama un día
antes, nunca un día tarde.

**Cómo se cierra:** preguntar si los estados financieros se presentan el mismo
día que el IRE o el día siguiente. Es una línea de la migración
`20260912120000_calendario_dji_y_obligaciones_del_piloto` si hay que cambiarlo.

### h) El ejercicio 2025 no genera vencimientos — CERRADO (2026-09-12)

> **Respuesta de Daniel:** *"siempre en el año se presentan los balances y los
> IRE del periodo contable anterior"*. O sea que esto no era una particularidad
> del 2025: **es la regla normal**, y el sistema la tenía mal. Corregido en la
> migración `20260912180000_ejercicio_2025_en_el_piloto`, que corre el inicio de
> las asignaciones al 2025-01-01 — el ejercicio contable cuyas declaraciones
> vencen dentro del piloto.
>
> Resultado: IRE y estados financieros del ejercicio 2025 para los 5 clientes,
> venciendo en abril de 2026, que es lo que EFFORT efectivamente presentó este
> año.
>
> **Un error propio al hacerlo, que vale anotar:** la primera corrida generó los
> DOCE meses de 2025, no solo el ejercicio. Eso creó 110 vencimientos mensuales
> de períodos que se presentaron durante 2025 —fuera del piloto— y con ellos 110
> alertas críticas de golpe. Se borraron, y las alertas **se cerraron solas** por
> el cierre automático, sin tocar la tabla de alertas a mano. El episodio sirvió
> de prueba real de que ese cierre automático funciona.

**Lo que se había planteado, para contexto:**

Las cinco asignaciones cliente-obligación arrancan el **2026-01-01**. Como una
obligación anual se genera en el período `AAAA-12` del ejercicio que cierra, el
IRE y los estados financieros del **ejercicio 2025** —que vencieron en abril de
2026, o sea DENTRO del período del piloto— nunca se generan: el período 2025-12
es anterior al inicio de la asignación.

Hoy hay 5 vencimientos de IRE y 5 de estados financieros, todos del ejercicio
2026 (vencen en abril de 2027). Los del ejercicio 2025 no están.

**Cómo se cierra:** decidir con EFFORT si el piloto tiene que incluir lo del
ejercicio 2025 ya presentado. Si sí, es mover el `desde` de las asignaciones al
2025-01-01 y volver a generar. No se hizo por criterio propio porque cambia qué
se le va a reclamar a cinco clientes reales.
