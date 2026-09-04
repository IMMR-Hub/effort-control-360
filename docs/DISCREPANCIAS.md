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

## 3. Clientes piloto — SIN CONFIRMAR

El handoff lista: GARSO S.A., LAURA SOSA, RAMIRO GARCIA, GERARDO SOSA,
NR REGISTROS GANADEROS. El propio handoff pide confirmarlos antes de cargar la
estructura final.

**Cómo se cierra:** confirmación de Laura o Lili. Si cambian, cambian filas de
datos, no código.

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

**Tarea 88 cerrada.** Único pendiente, no bloqueante: confirmar con EFFORT
cuál es la carpeta raíz real a usar como origen de los importadores — con
`Files.ReadWrite.All` de aplicación el acceso ya es a nivel de todo el
tenant, no hace falta compartir una carpeta puntual como se planeó
originalmente. El adaptador real (`DriveGraph`) sigue sin cablearse contra
esa carpeta todavía — los tests automáticos siguen usando el doble en
memoria (`DriveFalso`); cablear el real contra una carpeta de EFFORT de
verdad es trabajo de la Parte 5 en adelante, **primero contra una carpeta de
prueba separada**, nunca directo contra la carpeta real de producción (ver
`CLAUDE.md`, regla 5).

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

## 9. `regla_impositiva` no está conectada al cálculo de IVA — HALLAZGO 2026-07-23

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
