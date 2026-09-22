# Discrepancias y confirmaciones pendientes con EFFORT

Toda regla que el sistema aplica sobre dinero, plazos o estados y que todavía no
fue contrastada contra un documento real de EFFORT se anota acá. Ninguna se
resuelve por criterio propio: se confirma con Laura o Lili, o se deja marcada.

## ▶ Índice de estado — actualizado el 2026-09-21

**Esta tabla manda sobre los títulos de cada punto.** Si un título de más abajo
dice otra cosa, vale lo que dice esta tabla (algunos títulos son históricos).
"Quién" indica quién tiene que hacer algo para cerrarlo: **EFFORT** (respuesta
de Lili o Laura), **Daniel** (decisión o acción en una cuenta), **Claude**
(trabajo de código, está en la cola del roadmap), o **nadie** (cerrado).

| # | Tema | Estado | Quién | Qué falta, exactamente |
|---|---|---|---|---|
| 1 | Divisores de IVA | Cerrado | nadie | — (contrastado con 1.188 filas reales) |
| 2 | Redondeo de negativos | Abierto, no urgente | EFFORT | Confirmar con una nota de crédito real que -2,5 redondea a -3 |
| 3 | Clientes piloto | Cerrado | nadie | — |
| 4 | Período del piloto | Abierto, no urgente | EFFORT | Confirmar que enero–junio 2026 es el período del piloto |
| 5 | Umbrales de alerta 30/15/7/2 | Abierto, no urgente | EFFORT | Revisar por obligación (Abogacía necesita más aviso) |
| 6 | Acceso a OneDrive | Cerrado | nadie | — |
| 7 | Rol `effort_app` sin contraseña | Abierto | Daniel | La `.env` local conecta como `postgres` (dueño del esquema). El valor de `DATABASE_URL` en producción es un secreto de DigitalOcean y no se verificó. Para cerrarlo: asignar contraseña a `effort_app` y usarlo en `DATABASE_URL` de producción |
| 8 | RLS de Supabase | Cerrado (mina desactivada) | nadie | Regla vigente: toda tabla nueva lleva su política `app_acceso` |
| 9 | `regla_impositiva` no conectada | Mitad cerrado | Claude, sin cola | El divisor sale de `DIVISORES_CONFIRMADOS_POR_EFFORT`; conectar a la tabla cuando haya determinación desde documentos |
| 10 | Layout del importador de comprobantes | Abierto | EFFORT | Una planilla real de comprobantes |
| 11 | Layout del importador SIGA | Abierto | EFFORT | Una exportación real de SIGA |
| 12 | `npm audit` brace-expansion | Excepción documentada | nadie | — |
| 13 | Proveedor de correo | **Cerrado 2026-09-15** | nadie | Se usa Microsoft Graph `sendMail` (ver el punto) |
| 14 | `npm audit` deepmerge-ts | Excepción documentada | nadie | — |
| 15 | Supabase inalcanzable (pausa) | Cerrado | nadie | Si se pausa: "Resume project" en Supabase |
| 16 | Credenciales propias de cada usuario | Cerrado | nadie | — |
| 17 | Calendario DNIT | Cerrado | nadie | — |
| 18 | Latencia base ↔ API | Medido, decisión pendiente. **2026-09-21: además la conexión desde la máquina de trabajo es intermitente (punto 34)** | Daniel | Decidir si la base se muda a EE.UU.; tarea 116 midió dos veces |
| 19 | Feriados y dos calendarios | Cerrado, **salvo 19(e)** | EFFORT | 19(e): ver punto 26 (prórroga de EEFF) |
| 20 | Tolerancia de redondeo del proveedor | Cerrado | nadie | Toda diferencia alerta; se acepta o se revisa |
| 21 | Hallazgos repetidos en la base | Corregido en código, limpieza pendiente | Daniel | Autorizar `docs/propuestas/limpiar-hallazgos-repetidos.sql` (borra filas) |
| 22 | Autofacturas con columnas en cero | **MEDIDO 2026-09-22** (tarea 148). Falta decidir con Daniel | Daniel | De los 4.779 `PARTES_NO_SUMAN_EL_TOTAL`: **1.640 (34%)** tienen las partes en cero (el caso «no hay autofactura cargada»), **1.237 (26%)** difieren 1–2 Gs, **1.385 (29%)** entre 3 y 100 Gs, **479 (10%)** entre 101 y 10.000, y **38 (0,8%)** más de 10.000 Gs. O sea: el caso conocido NO es la mayoría, y lo realmente accionable son ~517 filas. Decidir si se separan en tres grupos en pantalla |
| 23 | Presentaciones desde el PDF de la DNIT | **Cerrado en código y producción 2026-09-15** | nadie | 42 de 150 presentados; lo que falta está en 27 y 28 |
| 24 | IVA sumaba planillas repetidas | **Cerrado — criterio confirmado 2026-09-21** (gana la más reciente) | nadie | EFFORT va a usar «CORRECCION» en el nombre de ahora en más |
| 25 | Planillas RG 90 reconocidas por nombre | **Cerrado 2026-09-18** (D1: se miró la pantalla de IVA de COPESA) | EFFORT | Solo queda una pregunta: si una «CORRECCION» es siempre el libro completo o solo las filas cambiadas (B7/P1) |
| 26 | Prórroga de EEFF 2025 (RG DNIT 50/2026) | **Respondido 2026-09-21: aplica a los 5. FALTA APLICARLO** | Claude | Tarea 146: el botón «Prórroga» está desplegado, pero **no llega a las 3 filas presentadas** (DIBEC, ECOAGRO, FUMIPRO) — hay que agregarlo a la tabla de Presentados; después prorrogar los 5 a 30/06/2026 |
| 27 | SIPAR sin declaraciones en OneDrive | **Respondido 2026-09-21: «sí se puede»** exportar la RG 90 | EFFORT | Subir el Excel de la RG 90 de SIPAR a su carpeta. No hay nada que programar |
| 28 | Talones de RG 90 que no están | **Respondido 2026-09-21**: existen, guardados fuera de OneDrive | Claude (menor) / EFFORT | El faltante es correcto y no se cambia. Solo mejorar el texto: «no está archivado», no algo que suene a «nunca se presentó» |
| 29 | Migraciones no automáticas en DigitalOcean | Abierto | Daniel | El job `migrar-base` no corre; se aplican a mano |
| 30 | Esquemas de prueba sobrantes en Supabase | Abierto | Daniel | Autorizar el borrado de `pruebas_*` sobrantes |
| 31 | Declaraciones archivadas bajo el cliente equivocado | **Alertado por el sistema (tarea 143, verificada 2026-09-21).** Sin respuesta de EFFORT | EFFORT | **¿COPESA presentó el IVA de julio 2026?** Y reubicar los 3 archivos (el sistema no los mueve) |
| 32 | Cómo aparece el saldo a favor en el formulario 120 | Verificado contra un PDF real 2026-09-20 | Claude | Tarea 138: extraer la casilla **47** (no la 54). Lleva migración: respaldo + las tres preguntas |
| 33 | El respaldo falla si el código va adelante del esquema | **Cerrado 2026-09-22** | nadie | Tarea 150 hecha: `crearLectorCrudo` lee con `SELECT *` (tabla real del `@@map`, vía DMMF) en el script y en el respaldo diario. Una tabla que falta se saltea; un corte de red sigue cortando el respaldo. 4 pruebas |
| 34 | Conexión a la base intermitente desde la máquina de trabajo | **Observado 2026-09-21** | Daniel (decisión) | Reintentar antes de sospechar de un cambio; relacionado con el punto 18 |
| 35 | Costo por hora de cada colaborador | **Abierto** (2026-09-21) | Daniel / EFFORT | Sin ese dato la planilla de horas no puede decir cuánto cuesta un cliente en guaraníes |

---

## 1. Divisores de IVA — CONTRASTADOS CONTRA DOCUMENTOS REALES (2026-09-12)

> **Se hizo exactamente lo que este punto pedía desde julio:** comparar el IVA
> calculado contra el de liquidaciones ya presentadas, comprobante por
> comprobante. Se contrastaron **1188 filas** de planillas RG 90 reales de
> FUMIPRO, de períodos ya declarados ante la DNIT.
>
> **Resultado sobre el divisor: correcto.** 1165 filas coinciden al guaraní
> (98,1%). Las 23 restantes difieren por ±1 Gs.
>
> **Resultado sobre el redondeo: la pregunta estaba mal planteada.** Las
> diferencias no siguen ninguna regla:
>
> | Base | Nuestro cálculo | La planilla dice |
> |---|---|---|
> | 101.700 | 9.245 (9.245,45 → mitad arriba) | **9.246** |
> | 960.000 | 87.273 (87.272,72 → mitad arriba) | **87.272** |
> | 229.625 | 20.875 (**exacto**, sin decimales) | **20.876** |
>
> El tercero cierra la discusión: ningún criterio de redondeo se aleja de un
> resultado exacto. **Esas cifras no se calculan: se copian de la factura del
> proveedor**, y cada proveedor redondea como quiere. La DNIT acepta la cifra
> impresa en el comprobante.
>
> **Consecuencia de diseño, ya aplicada.** Donde el IVA está declarado, el
> sistema lo **lee** y no lo recalcula (`packages/importers/src/libroRg90.ts`).
> Recalcularlo daría un número distinto del que EFFORT ya presentó, y el sistema
> estaría contradiciendo una declaración jurada por un guaraní. El divisor
> propio sigue existiendo y sigue siendo correcto, pero es para **deducir** un
> IVA que nadie declaró, no para pisar uno declarado.
>
> **Lo que queda abierto:** el criterio de redondeo propio (mitad hacia arriba
> en magnitud) sigue sin contrastarse, porque los datos reales no lo ejercitan —
> en ellos el IVA nunca se deduce. Se cerrará el día que haya que calcular IVA
> de un comprobante sin IVA declarado. Hasta entonces es una regla que el
> sistema tiene pero casi no usa.

**Planteo original (jul-2026), que sigue valiendo como contexto:**

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

## 13. Proveedor de envío de correo (tarea 95, Parte 6) — CERRADO (2026-09-15)

> **Cierre:** se implementó con la recomendación de abajo — Microsoft Graph
> `sendMail` con la cuenta del sistema y el mismo registro de Azure. Está en uso
> para los avisos de alertas críticas (`apps/api/src/servicios/avisosPorCorreo.ts`)
> y deja cada envío en `envio_notificacion`. Lo que sigue es historia.

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
2. ~~**Reducir llamadas por pantalla.** `Seguimiento` hace una consulta de
   contactos POR CLIENTE (patrón N+1); con 144 clientes reales eso no escala.
   Arreglarlo es código nuestro y no depende de nadie más.~~ **Revisado el
   2026-09-19: ya está resuelto.** `Seguimiento.tsx` usa
   `listarContactosDelPeriodo` (una sola consulta para toda la cartera) y
   agrupa en memoria — el comentario del propio código lo dice: "se agrupan
   acá, en memoria, en vez de pedirlos cliente por cliente". No se encontró
   ningún otro patrón de consulta por cliente en el resto de las pantallas
   (`grep` sobre todas). Este punto quedaba desactualizado, no reflejaba el
   código actual.
3. **Dejarlo así.** Con 5 clientes es incómodo pero usable. Con 144, sin la
   opción 2 (ya resuelta) probablemente ya alcance — falta medirlo con más
   clientes reales para confirmarlo.

Ninguna es urgente hoy, pero la 2 conviene hacerla igual, y la 1 conviene
decidirla antes de cargar los 144 clientes reales — mover una base con datos
es mucho más caro que elegir bien la región al principio.

**Remedido el 2026-09-18 (tarea 116), contra el pooler de TRANSACCIÓN (6543,
el que usa la app en producción, no el de sesión que usan los tests):** 10
`SELECT 1` seguidos dieron `[2684, 457, 204, 781, 2095, 327, 392, 377, 1533,
767]` ms — **promedio 962 ms, mínimo 204 ms, máximo 2.684 ms.** Una consulta
real (contar alertas abiertas) tardó 306 ms, en línea con la tabla del
2026-09-11. Dos cosas para leer esto bien: **(a)** el máximo de 2.684 ms
supera el umbral de ~2 s que marca la tarea 116, pero **(b)** la variación
entre corridas (204 ms a 2.684 ms, sobre la misma consulta) es demasiado
grande para explicarse solo por distancia geográfica — esa parte es
constante. Es más compatible con el pooler de transacción abriendo y
cerrando conexiones bajo carga variable, o con inestabilidad de red del lado
de quien mide, que se dio varias veces en esta misma sesión al conectar con
Microsoft Graph (no relacionado a Supabase, pero sí un dato de que la red de
este entorno tuvo cortes intermitentes ese día). **No se cambió
`connection_limit` ni ninguna configuración de producción** — la tarea pide
solo medir y anotar, y la decisión (mover de región, o no) sigue siendo de
Daniel, como ya decía este punto.

**Segunda medición, el 2026-09-19, mismo método:** `[899, 201, 314, 226, 205,
271, 218, 226, 196, 458]` ms — **promedio 321 ms, mínimo 196 ms, máximo 899
ms.** Una consulta real (alertas abiertas) tardó 803 ms. Esto confirma la
hipótesis (b) de arriba: sin cambiar nada, un día después, el pooler está
casi tres veces más rápido en promedio y el máximo bajó de 2.684 ms a 899 ms.
El pico del 2026-09-18 fue una condición puntual de esa medición (probable
inestabilidad de red del entorno, no del pooler de Supabase en sí) — no un
problema persistente que necesite acción inmediata. Sigue valiendo medir de
nuevo alguna vez más, pero no urge.


**2026-09-21 — otra cosa, distinta de la latencia:** la conexión al Session pooler (5432) desde la máquina de trabajo fue **intermitente** todo el día. Ver el punto 34.

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

### e) Prórroga de estados financieros — REABIERTO, VER PUNTO 26 (2026-09-15)

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

---

## 20. Tolerancia de redondeo del proveedor en el IVA — CERRADO (2026-09-14)

**Lo que estaba.** El análisis del libro marcaba como riesgo de multa cualquier
diferencia entre el IVA declarado y la regla, aunque fuera de un guaraní: 65
comprobantes con todas las planillas sincronizadas, 60 de ellos por ±1.

**Primera respuesta** (Lili y Laura vía Daniel, 2026-09-14): *"5 sigue siendo
aceptable, diría que 10 ya se revisará"*. Se aplicó una tolerancia de 5 Gs y
quedaban 2 con riesgo (commit `87e414b`).

**Decisión final** (Daniel, horas después): *"mejor alertar a partir de 1
guaraní a partir de ahora, y que luego puedan aceptar o revisar"*.

**Lo aplicado.** `TOLERANCIA_DE_REDONDEO_DEL_PROVEEDOR = 0n`, y cada hallazgo
tiene `estado`: PENDIENTE, EN_REVISION o ACEPTADO (migración
`20260914160000_decision_sobre_hallazgos`, que solo agrega columnas). Aceptar
exige motivo —lo controlan la ruta y una restricción de la base— y queda en la
bitácora con usuario y fecha. EN_REVISION sigue alertando. La alerta del período
se cierra sola cuando todos sus comprobantes con riesgo están aceptados.

Por qué es mejor que la tolerancia: con una tolerancia el sistema decide qué no
importa y nadie se entera de lo que calló; con decisiones, avisa de todo y
decide una persona con nombre y motivo.

---

## 21. Hallazgos repetidos en la base — CORREGIDO EN CÓDIGO, LIMPIEZA PENDIENTE DE AUTORIZACIÓN (2026-09-14)

**Lo que pasaba.** El índice único de `hallazgo_libro_rg90` incluía `tasa`, que
es NULL en los hallazgos "las partes no suman el total". En PostgreSQL dos NULL
no son iguales para un índice único, así que `skipDuplicates` no saltaba nada y
cada corrida horaria del programador volvía a insertar los mismos.

**El daño.** 2.069 filas de ese tipo para 152 comprobantes distintos. El
informe de avance del 2026-09-14 habló de "1.905 inconsistencias" y "679 filas
con las partes en cero"; los números reales eran **152 y 60**. Las alertas de
riesgo de multa **no** estaban afectadas: esos hallazgos tienen tasa, y el
índice sí los deduplicaba.

**Por qué no lo agarró ningún test.** El doble en memoria compara
`null === null` y da verdadero, lo contrario de la base. Ahora hay un test de
integración contra PostgreSQL real (`apps/api/test/integracion/libro-rg90.test.ts`).

**Lo corregido.** `guardarHallazgos` compara contra lo existente con la clave
completa (incluida la contraparte: dos proveedores pueden repetir número de
comprobante), y todas las lecturas descartan repetidos.

**Lo pendiente — necesita autorización de Daniel, porque borra filas.** Limpiar
los repetidos y crear el índice con `NULLS NOT DISTINCT`. El SQL, con las tres
preguntas contestadas, está en `docs/propuestas/limpiar-hallazgos-repetidos.sql`.
No está en la carpeta de migraciones a propósito: DigitalOcean las aplica solas
en cada despliegue.

---

## 22. Las 60 filas con las partes en cero son AUTOFACTURAS — RESPONDIDO POR EFFORT (2026-09-21)

Mirando las celdas crudas de las planillas (ECOAGRO, por ejemplo
`RG COMPRAS 092025.xlsx`, H Y N AVICULTURA LTDA, total Gs. 29.880.506): **no es
un error de lectura**. La planilla trae `0` escrito en Monto Gravado 10%, IVA
10%, Monto Gravado 5%, IVA 5% y Monto No Gravado/Exento, y el total con importe.
Las 33 revisadas en ECOAGRO 2025 son todas `TIPO DE COMPROBANTE = AUTOFACTURA`.

Una autofactura no lleva IVA, pero el importe debería ir como "no gravado /
exento" para que la planilla cierre. Pregunta para EFFORT: ¿SIGA las exporta
así a propósito, o se están cargando mal?

**Respuesta de EFFORT (Daniel, 2026-09-21): «está en 0 porque no existe
autofactura cargada».** O sea: la planilla sale con las partes en cero porque
detrás, en SIGA, no hay una autofactura cargada. **No es un error de lectura
del sistema ni de la exportación** — la fila refleja un hueco de carga en SIGA.

**Lo que abre esta respuesta, y que hay que medir antes de tocar nada:** hoy el
sistema tiene **4.779 hallazgos `PARTES_NO_SUMAN_EL_TOTAL`, el 95% de los 5.050
totales**. Si la mayoría son este caso, no son inconsistencias para revisar una
por una: son el mismo hueco de carga repetido, y deberían contarse y explicarse
aparte en vez de inflar el contador de "qué revisar". **Pero primero se mide**
(tarea 148): bajar un contador de 4.779 a 271 sin entender exactamente qué se
está sacando sería lo contrario de lo que este sistema existe para hacer.

**Lo que sí era error de lectura, y apareció mirando esto:** el encabezado real
dice "RUC / **Nº** de Identificación del Informado", y la normalización no saca
el "º". El RUC del proveedor se leía vacío en todas las filas. Corregido con un
alias y un test.

---

## 23. Presentaciones: se leen del PDF de la DNIT, no del nombre — CERRADO EN CÓDIGO Y PRODUCCIÓN (2026-09-15)

**El problema.** 150 vencimientos, 0 marcados como presentados, 96 alertas
críticas de "vencido sin presentar". Las declaraciones estaban en OneDrive;
nada las cruzaba con los vencimientos.

**Por qué no por nombre.** Casos reales: `DET DE IMPUESTO IVA …` parece la
declaración y es la planilla de cálculo ("CALCULO AUXILIAR PARA DETERMINACION
DE IVA"); `PROFORMA DDJJ 500` es un borrador; `DDJJ MARZO 2026 - FUMIPRO SA` no
dice de qué impuesto es. Un falso "presentado" apaga la alerta que evita una
multa.

**Lo que se reconoce** (`packages/importers/src/declaracionDnit.ts`), con texto
real de los cinco clientes: la "DECLARACIÓN JURADA NORMALIZADA" (formularios
120 IVA, 500 IRE, 158 estados financieros) y el "TALÓN DE PRESENTACIÓN" de la
RG 90 (formulario 241). Se exige número de orden, fecha, período y RUC; el RUC
tiene que ser el del cliente.

**Lo que NO se reconoce, a propósito:** el impreso "ESTADOS FINANCIEROS" de
Marangatú (no trae número de orden ni fecha de presentación) y los formularios
**145** y **526**, que aparecen en los archivos sin saberse todavía qué son.

**Preguntas para EFFORT:**
1. ¿Qué son los formularios 145 y 526?
2. Los estados financieros de 2025, ¿se presentan por formulario 158 o solo se
   cargan en Marangatú? Si es lo segundo, el sistema no tiene cómo saber la
   fecha de presentación desde el PDF.

**Hallazgo real que el sistema va a mostrar:** DIBEC presentó el IVA de abril
de 2026 el 29/05/2026; su vencimiento (terminación de RUC 6) era el 19/05. Se
marca presentado, y queda registrado como fuera de término.

---

## 24. El IVA sumaba dos veces las planillas repetidas — CORREGIDO, CRITERIO CONFIRMADO POR EFFORT (2026-09-21)

**Respuesta de EFFORT (Daniel, 2026-09-21):** cuando hay dos versiones de una planilla y ninguna dice «CORRECCION», **se toma el archivo más reciente** — es el criterio que el sistema ya aplicaba, así que **no cambia nada en el código**. Y agregaron una regla de su lado: *«mejor la palabra corrección para diferenciar»*, que es justo lo que propone `docs/GUIA-NOMENCLATURA-ARCHIVOS.md`. Lo que sigue abierto (tarea 141/N7) es si una planilla «CORRECCION» es siempre el libro completo del período o solo las filas cambiadas.

Las filas de todas las planillas RG 90 de un cliente se juntaban por período
sin mirar repeticiones. En el OneDrive real: FUMIPRO julio 2026 tiene
`RG COMPRAS 07 2026` y `CORRECCION RG COMPRAS 07 2026`; ECOAGRO febrero 2025
tiene dos versiones en carpetas distintas. El crédito fiscal de esos períodos
salía sumado dos veces.

Ahora un comprobante (período, tipo de registro, tipo, timbrado, número,
proveedor) cuenta una vez. Si está en varias planillas manda la corrección; si
no hay corrección, la modificada más recientemente. El resumen informa cuántos
repetidos encontró.

**Queda para validar con EFFORT:** que "la más reciente" sea siempre la buena.
En ECOAGRO febrero 2025 no hay "CORRECCION" en el nombre; hay una subcarpeta
"2 FEBRERO 01".

**2026-09-16:** la unión deduplicada se reemplazó por "una sola planilla por
período y tipo de registro" (punto 25). Ya no se mezclan filas de dos
versiones.

### 23 (b). Simulación sobre los datos reales — 2026-09-14, sin escribir nada

1.174 PDFs leídos, 0 errores, **233 presentaciones reconocidas** (165 IVA, 12
IRE, 6 EEFF, 12 talones RG 90, y 14/12/12 de los formularios 145/525/526, que
no se cruzan con nada). Contra los 150 vencimientos: **30 se marcarían como
presentados**, y 65 vencidos siguen sin presentación encontrada.

Lo que la simulación confirmó:

- **El contenido manda sobre el nombre, y hacía falta.** `DDJJ IVA 072026 DIBEC
  SA.pdf` contiene la declaración de **agosto** (período 08/2026, presentada el
  03/09). La de julio no está en OneDrive: solo una PROFORMA con número de orden
  0, que se rechaza. Por nombre, julio habría quedado "presentado" sin estarlo.
- **COPESA 2026 no tiene sus declaraciones en OneDrive.** Lo que hay son
  "DETERMINACION IVA", planillas de cálculo auxiliar. Sus alertas quedan, y es
  lo correcto. La de febrero calcula ella misma una multa de Gs. 50.000 y mora
  del 4%: EFFORT registró que se presentó tarde.
- **Ningún vencimiento de RG 90 de 2025-12 en adelante tiene talón.** Los 12
  talones encontrados son de 2024. ¿Dónde guarda EFFORT el talón de la RG 90
  ahora?
- **SIPAR no tiene ninguna declaración reconocible** en su carpeta.

**15 de los 30 figuran presentados después de la fecha calculada** (entre 1 y
64 días). No se afirma que sean multas: la fecha del PDF ("Fecha: … Presentado
por") es la de presentación según el formulario, pero **puede haber prórrogas**
—sobre todo en IRE y estados financieros, que EFFORT presentó en junio— y el
calendario del sistema no las conoce (ver punto 19, nota de la RG 50). **Pregunta
para EFFORT:** ¿hubo prórroga para el IRE y los estados financieros 2025?


### 23 (c). Respuestas de Daniel y escaneo completo — 2026-09-15

**No hubo prórrogas** (Daniel: *"No hubo ninguna prórroga ni para el IRE ni
para ninguna otra presentación"*). Por eso los días de atraso que muestra el
sistema son reales, salvo los marcados como "hasta N días" (ver abajo). Y se
muestran **solo como días**, sin hablar de multa, por pedido expreso.

**Hipótesis de Daniel confirmada:** *"no encontrás el documento porque tiene un
nombre equivocado"*. El primer escaneo solo abría PDFs con nombre sugestivo.
Abriendo los 2.434 PDFs aparecieron, entre otros, el IVA de COPESA de
diciembre 2025 a junio 2026 guardado como `120-01-2026.pdf`, `120-02-2026.pdf`…
y los EEFF 2025 de FUMIPRO como `158-2025.pdf`. El detector de producción ahora
lee **todos** los PDFs (los de nombre sugestivo primero).

**Formularios verificados abriendo los PDFs** (no eran errores de tipeo):

| Formulario | Qué es, según el propio PDF |
|---|---|
| 145 | "Declaración Rectificativa" |
| 122 | (retención de IVA; ya estaba así en las reglas por nombre) |
| 525 | "Liquidación de retenciones de los impuestos a las rentas" |
| 526 | "Liquidación de retenciones del IDU" |

Ninguno es la presentación original de IVA, IRE, EEFF o RG 90, así que no se
cruzan con esos vencimientos.

**Talón de la RG 90:** es el formulario 241, "Talón de presentación — Registro
de comprobantes", que la DNIT genera al presentar la RG 90. COPESA lo guarda
en dos formatos: el talón (2023-2025) y, en 2026, el **aviso del buzón de
Marangatú impreso** ("SE GENERÓ EL FORMULARIO 241 … CON ORDEN N° …"). Ese aviso
prueba la presentación pero su única fecha es la de impresión: los días de
atraso salen como **"hasta N días"**.

**Resultado cargado en producción:** 42 de 150 vencimientos presentados, 27 con
días de atraso. Siguen sin prueba en OneDrive: la RG 90 de DIBEC, FUMIPRO y
ECOAGRO (ningún talón ni aviso en sus carpetas), la RG 90 de COPESA de
dic-2025, feb, jun y jul 2026, el IVA de COPESA de jul y ago 2026, el IVA de
DIBEC de julio 2026, el IRE 2025 de DIBEC, los EEFF 2025 de COPESA, y todo
SIPAR (su carpeta no tiene ninguna declaración: 226 archivos, mayormente
legales, extractos y los TXT de la RG 90).

---

## 25. Las planillas RG 90 se reconocían por su nombre — CERRADO, VERIFICADO EN PANTALLA (D1, 2026-09-18)

**Actualización 2026-09-21:** la D1 se hizo el 2026-09-18 (Daniel entró con su sesión y se leyó la pantalla de IVA de COPESA: último período 2026-07, 306 comprobantes, 2025 y 2026 completos). El título anterior quedó desactualizado; lo que sigue abajo es el registro de cómo se llegó ahí.

**Qué pasa.** `NOMBRE_DE_PLANILLA` en `apps/api/src/servicios/liquidacionDeIva.ts`
solo acepta archivos cuyo nombre empieza con `RG COMPRAS` o `RG VENTAS`
(opcionalmente `CORRECCION`). COPESA guarda sus libros como
`PERIODO 2026/DOCUMENTOS CONTABLES/RG 90 COMPRAS/01 ENERO.xlsx` y
`80003112_202501_COMPRAS_150121_1.xlsx`, así que el sistema tiene IVA de COPESA
para solo 2 períodos (2025-04 y 2025-09). Verificado en la pantalla de IVA en
producción el 2026-09-15.

**Por qué importa.** Es el mismo error que se corrigió para las declaraciones
(punto 23): decidir por el nombre del archivo en vez de por su contenido.

**Prueba de solo lectura del 2026-09-15** sobre los Excel de COPESA clasificados
como libro: 191 se leen como planilla RG 90 (períodos de 2022 a 2026) y 33 no.
Mostró tres problemas reales que la solución tiene que cubrir:

1. `PERIODO 2026/DOCUMENTOS CONTABLES/RG 90 COMPRAS/01 ENERO.xlsx` trae filas con
   períodos 2026-01, 2027-01 … 2032-01: la columna de período del Excel está mal.
   Regla: una fila con período posterior al mes en curso se rechaza con motivo.
2. Agosto 2025 está en dos planillas **con contenido distinto**
   (`08 Agosto 2025 ok verificado.xlsx`, 568 filas; `AGOSTO 2025.xlsx`, 464).
   Juntar las filas de ambas mezclaría dos versiones del libro. Regla: **un solo
   archivo por cliente + período + tipo de registro** — el que dice
   "CORRECCION"; si ninguno, el modificado más recientemente en OneDrive — y los
   demás se informan como descartados. Esto reemplaza, para ese caso, la unión
   deduplicada del punto 24.
3. Los archivos de la DNIT `80003112_AAAAMM_COMPRAS_NNNNNN_1.xlsx` dan 0 filas:
   se ignoran sin contarlos como fallo.

**Cómo se cierra.** Tarea 141 del roadmap, que tiene los pasos exactos y el
criterio de terminado (verificado en la pantalla de IVA de producción).

**2026-09-16 — corregido en código, falta verificarlo en producción.**
`liquidacionDeIva.ts` abre todos los Excel clasificados como libro y el
importador decide por los encabezados (`NoEsPlanillaRg90` → se ignora y se
cuenta en `archivosIgnorados`, no es fallo). Las tres reglas quedaron con un
test cada una, con los nombres reales de COPESA
(`apps/api/test/liquidacion-de-iva.test.ts`):

1. Filas con período posterior al mes en curso (en Paraguay): se rechazan y el
   resumen trae un aviso con la cantidad y el motivo.
2. Una planilla por cliente + período + tipo de registro: "CORRECCION" en
   cualquier parte del nombre (con o sin tilde) manda; si no, la de
   `modificadoEnOrigen` más reciente. Las demás salen en `avisos` como
   "planilla descartada por existir una más reciente", y la pantalla de IVA
   las lista después de "Recalcular".
3. Excel con encabezados y sin filas (libros de la DNIT): se ignoran.

**Consecuencia sobre el punto 24:** FUMIPRO julio 2026 ya no une "RG COMPRAS
07 2026" con su corrección: vale la corrección entera. Si la corrección de
EFFORT fuera solo las filas cambiadas (y no el libro completo), el IVA de ese
período quedaría corto — **preguntar a Lili** si una "CORRECCION" es siempre
el libro completo.

**2026-09-17 — ajustes por la auditoría del plan maestro (tarea N7), sin
desplegar todavía.** La regla 2 de arriba cambió así:

- "CORRECCION" cuenta solo si el nombre **empieza** con esa palabra (con o sin
  tilde, también "CORRECION"). "SIN CORRECCION …" ya no pasa por corrección.
  Otras formas de nombrarlas: pregunta P3 del plan.
- Si todo empata (sin corrección y con la misma fecha), decide el nombre y
  después el id: antes decidía el orden en que la base devolvía las filas, y el
  IVA podía cambiar entre corridas. El aviso dice "empate" y pide revisar.
- El aviso dice el motivo real: "manda la corrección", "modificada más
  recientemente" o "empate" (antes decía siempre "más reciente").
- Cada planilla tiene un **mes principal** (el de más filas). Unas filas
  sueltas de otro mes no le ganan a la planilla que tiene ese mes como
  principal; se usan solo si no hay otra, y se avisa.
- Además de las filas futuras, se dejan afuera las filas cuyo período está 12
  meses o más después de su fecha de emisión (las 2027-01 … 2032-01 del
  "01 ENERO.xlsx" de COPESA 2026, que en enero de 2027 dejan de ser futuras).
  El umbral espera la respuesta a la pregunta P4.
- Un mes inválido (13, 00) se rechaza al leer.
- Si una planilla no se puede bajar por una falla pasajera de Microsoft (después
  de reintentar), ese cliente **no se calcula en esa corrida** y se informa en
  `clientesOmitidos`: calcular sin ella podía hacer ganar a una versión vieja.
- Una planilla RG 90 sin ninguna fila legible es un fallo; los `.xls` viejos se
  avisan; una planilla de más de 15 MB no se baja.
- `filasRechazadas` y `archivosLeidos` de cada liquidación son ahora de ese
  período, no del cliente entero.

**2026-09-17 — pusheado, desplegado y verificado por base real, falta D1.**
Con autorización expresa de Daniel ("Antes hacé un respaldo y luego Dale,
empujá"): respaldo (`respaldos/respaldo-2026-09-17T14-28-26.json`, 21.514
filas), push `00efc49..eee60f1`, despliegue confirmado con
`esperar-despliegue.mjs` (2026-09-17T14:57Z).

Verificado con consultas de solo lectura contra producción
(`scripts/consultar-produccion.mjs`, nunca con la sesión de Daniel):

- **COPESA: 2 → 37 períodos de IVA, de 2022-01 a 2026-07.** Antes solo
  2025-04 y 2025-09.
- Los 4 clientes con planilla Excel suman **90 períodos** (antes 50).
- **Cero** filas con período posterior a 2026-09: el filtro de "período
  futuro" funciona con datos reales.
- **Cero** alertas de libro con período anterior a 2025-01: el piso de la
  tarea N6 (`PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO`) funciona.
- **Cero** correos enviados en las 2 horas posteriores al despliegue:
  `AVISOS_POR_CORREO=no` por defecto funciona de verdad, no solo en los
  tests.
- La corrida automática de las 2026-09-17T15:21:15Z quedó registrada en
  `event_log` (`accion='alerta.evaluadas'`): 90 períodos calculados, 441
  hallazgos nuevos, 18 alertas creadas, 6 resueltas, 0 avisos enviados.

**Lo que esto NO prueba todavía:** que la regla de "período principal" y el
tope de 12 meses de arrastre (N7) eligieron la planilla CORRECTA en cada
caso — eso necesita leer los Excel reales de COPESA (tarea 14/N8, sigue
pendiente) y que Daniel confirme mirando la pantalla de IVA (D1, regla 4 de
`docs/ROADMAP-MAESTRO.md`). Sin esos dos pasos, el número "37 períodos" está
verificado en cantidad, pero no en que cada período haya elegido la planilla
que corresponde.

**Efecto colateral notado durante la verificación, no relacionado con el
código de esta sesión:** la conexión a Supabase por el Session pooler
(puerto 5432 — el que usan los tests y `consultar-produccion.mjs`, NO el que
usa la app en producción, que es el pooler de transacción 6543) se cortó dos
veces de forma intermitente durante media hora aproximadamente, y se
recuperó sola sin que se tocara ninguna configuración. Anotado por si se
repite: no parece relacionado con el volumen de conexiones de esta sesión en
particular (se repitió incluso después de esperar y con pocas conexiones
simultáneas), pero tampoco se descartó como causa.

---

## 26. Prórroga de los estados financieros 2025 — RESPONDIDO POR EFFORT, FALTA APLICARLO (2026-09-21)

**Respuesta de EFFORT (Daniel, 2026-09-21):** *«Sí, todos están bajo el régimen
IRE GENERAL. Es una resolución de prórroga que suelen sacar; si es así, no hay
atraso por no presentar en abril.»*

Con eso se cierra la duda: **la RG 50/2026 les aplica a los cinco**, y el
vencimiento real de los EEFF del ejercicio 2025 era el **30/06/2026**.

**Lo que hay que corregir en producción (tarea 146), medido el 2026-09-21:**

| Cliente | Vencimiento cargado hoy | Presentado | Figura hoy | Con la prórroga |
|---|---|---|---|---|
| DIBEC | 20/04/2026 | 23/06/2026 | 64 días de atraso | **a tiempo** |
| FUMIPRO | 09/04/2026 | 10/06/2026 | 62 días de atraso | **a tiempo** |
| ECOAGRO | 27/04/2026 | 26/06/2026 | 60 días de atraso | **a tiempo** |
| COPESA | 13/04/2026 | sin presentar | vencido | vencido, pero desde el 30/06 |
| SIPAR | 13/04/2026 | sin presentar | vencido | vencido, pero desde el 30/06 |

**Cuidado al aplicarlo:** hay que corregir **la regla que genera la fecha**, no
solo las cinco filas — si se tocan solo las filas, la próxima generación las
vuelve a poner en abril. Y la prórroga es **solo del ejercicio 2025**: los
vencimientos de `2026-12` (abril de 2027) no se tocan, porque para ese ejercicio
no hay ninguna resolución todavía.

---

**Los hechos que se habían reunido antes de preguntar.**

- La **Resolución General DNIT N° 50/2026** (7 de abril de 2026) extendió la
  presentación de los estados financieros del ejercicio cerrado al 31/12/2025
  hasta el **30 de junio de 2026**, para contribuyentes de IRE Régimen General
  (punto 19 f, con la fuente oficial:
  `dnit.gov.py/web/portal-institucional/w/extienden-plazo-para-presentaci%C3%B3n-de-estados-financieros`).
- Las declaraciones leídas de OneDrive (formulario 158) muestran que **DIBEC
  presentó el 23/06/2026, FUMIPRO el 10/06/2026 y ECOAGRO el 26/06/2026**.
- El sistema tiene los EEFF con vencimiento en abril (el mismo día que el IRE,
  punto 19 g), así que hoy muestra **64, 62 y 60 días de atraso**.
- Daniel respondió el 2026-09-15: *"No hubo ninguna prórroga ni para el IRE ni
  para ninguna otra presentación"*. El punto 19(e) ya advertía, desde el
  2026-09-12, un posible cruce de nombres: la **RG 90** es el formulario de
  compras y ventas; la **RG 50/2026** es una prórroga, no un formulario que un
  cliente "tenga".

**Por qué no se aplicó por criterio propio.** Hay una respuesta explícita de
Daniel en contra. Pero el patrón es demasiado consistente para ignorarlo: tres
clientes distintos presentando los EEFF en la segunda quincena de junio, todos
antes del 30/06, es exactamente lo que produce esa prórroga.

**Cómo se cierra.** Preguntarle a Lili mostrándole la resolución. Si la prórroga
aplica: cambiar el vencimiento de EEFF del período 2025-12 de los 5 clientes al
30/06/2026 (corrido a día hábil según el calendario de informativas si
corresponde) y los atrasos se recalculan solos en la vista Presentados. Si no
aplica: queda como está y los 60 días de atraso son reales.

**No afecta al IRE.** La prórroga es solo de estados financieros. Los atrasos de
IRE (ECOAGRO 35 días, COPESA 8, FUMIPRO 3) siguen igual en cualquier caso.

---

## 27. SIPAR no tiene declaraciones en OneDrive — RESPONDIDO: EFFORT PUEDE EXPORTARLO (2026-09-21)

**Respuesta de EFFORT (Daniel, 2026-09-21): «sí se puede».** Pueden exportar la
RG 90 en Excel desde SIGA y dejarla en la carpeta de SIPAR, igual que para los
otros cuatro clientes.

**No hay nada que programar.** El sistema ya lee ese formato; lo que faltaba era
el archivo. En cuanto EFFORT lo suba, la sincronización lo toma y el IVA de
SIPAR se calcula en la siguiente corrida, sin tocar una línea de código.
Mientras tanto, que SIPAR figure con todo pendiente **es correcto** y ahora
además está explicado.

---

**Lo que se había verificado antes de preguntar (2026-09-18):**

Verificado en modo solo lectura contra el OneDrive de origen (`lsosa@`): SIPAR
tiene **una sola carpeta, `043 SIPAR S.A`, con 230 archivos**, todos
sincronizados por el sistema. Ninguno es una declaración de IVA, IRE ni EEFF de
2025-2026 ni un talón de RG 90, con ningún nombre (se leyó el contenido de todos
los PDFs). Lo que hay: actas y documentos legales, extractos de BASA,
`CALCULO IRE SIPAR S.A. 2025`, `BOLETA DE PAGO IRE GENERAL 2024`, y los libros de
compras y ventas como TXT de Marangatú (sin desglose de IVA, punto de la
consulta del 2026-09-13).

**Releído el 2026-09-18** (Daniel mostró una captura con contenido que parecía
nuevo): la carpeta tiene subcarpetas por año, y la de `2026/DOCUMENTOS
CONTABLES/` sí ganó contenido real desde el 2026-09-15 — `BALANCE 2025-2024
SILICATOS.xlsx`, `CALCULO IRE SIPAR S.A. 2025.xlsx`, `PATENTE 1ER PERIODO
SILICATOS 2026` y una carpeta `EXTRACTOS DE CUENTA` nueva. **Pero la subcarpeta
`2026/DOCUMENTOS CONTABLES/RG 90/` (10 elementos, la que aparece en la
captura) sigue siendo la misma exportación TXT/ZIP de Marangatú de siempre**
(`80012742_202603_COMPRAS_304254_1.txt` y siete pares más), sin desglose de
IVA por comprobante — no la planilla Excel de 28 columnas que
`importarLibroRg90` necesita para calcular el IVA. Detalle completo en
`docs/BITACORA-ONEDRIVE.md`, entrada 2026-09-18. No es un problema de carpeta
ni de cuenta equivocada: es la misma `043 SIPAR S.A` de siempre, con más
alrededor pero el mismo hueco en el centro.

**Cómo se cierra.** EFFORT dice dónde guarda las presentaciones de SIPAR y pasa
el Excel de la RG 90 que exporta SIGA (el que se exporta en formato Excel, no
el TXT de Marangatú que ya está). Mientras tanto, los 30 vencimientos de SIPAR
y su IVA siguen pendientes, y es lo correcto: el sistema no tiene prueba en el
formato que necesita.

---

## 28. Talones de RG 90 que no están en OneDrive — RESPONDIDO (2026-09-21)

**Respuesta de EFFORT (Daniel, 2026-09-21): «guardaron en otro lugar y no se
acordaron de subirlo al OneDrive».**

Los talones **existen**: se emitieron y se guardaron, solo que fuera de la
carpeta que el sistema mira. No es que EFFORT no los genere ni que la DDJJ IVA
los reemplace.

**Qué significa para el sistema, y es importante que no cambie nada:** que el
talón figure como faltante **es correcto** y hay que dejarlo así. El sistema
mira OneDrive; si el documento no está ahí, no está donde tiene que estar —
para el día que la DNIT lo pida, "lo tenemos en otro lado" no es lo mismo que
tenerlo archivado donde corresponde. El aviso está haciendo exactamente su
trabajo: señaló un archivo que se traspapeló.

**Lo que sí cambia:** el texto del faltante no debería sonar a «nunca se
presentó» sino a «no está archivado». Son dos cosas distintas y el sistema
hoy no las distingue. Queda anotado para cuando se toque esa pantalla.

---

**Lo verificado el 2026-09-18:**

El talón de la RG 90 es el **formulario 241, "Talón de presentación — Registro
de comprobantes"**, que la DNIT genera al presentar la planilla. COPESA lo
guardaba como PDF del talón (2023-2025) y en 2026 como el aviso del buzón de
Marangatú impreso; los dos formatos se reconocen.

**El texto original de este punto (2026-09-15) mezclaba dos cosas distintas y
llevaba a confusión — corregido con una relectura real el 2026-09-18** (Daniel
cuestionó si se estaba repitiendo el mismo error que con SIPAR; tenía razón en
parte):

- **La planilla RG 90 en sí (Excel) SÍ está**, para los tres clientes, la
  mayoría de los meses de 2025 y 2026 — esto NO es lo que falta. Verificado
  leyendo las carpetas reales:
  - FUMIPRO: `RG COMPRAS`/`RG VENTAS .xlsx` presentes enero–agosto 2026.
  - ECOAGRO: `RG COMPRAS` presente enero–julio 2026 (7/7); `RG VENTAS`
    presente en 5 de esos 7 meses (faltan febrero y mayo, a confirmar si es
    un hueco real o un archivo con otro nombre).
  - DIBEC: presente al menos enero–noviembre 2025 (no se releyó 2026 todavía
    con este mismo detalle).
  - COPESA: `RG 90 COMPRAS` y `RG 90 VENTAS` presentes enero–julio 2026 (7/7
    cada una). Agosto 2026 todavía no aparece en ninguno de los 4 clientes —
    esperable, es el mes que acaba de cerrar.
- **Lo que sí falta es el talón/comprobante de presentación como documento
  aparte:** de los 4 clientes, **solo COPESA tiene una carpeta dedicada**
  (`TALON DE PRESENTACION`, dentro de `PERIODO 2026`), y ahí están cargados
  **enero, marzo, abril y mayo — faltan febrero, junio, julio y agosto
  2026**. **DIBEC, FUMIPRO y ECOAGRO no tienen ninguna carpeta con ese nombre
  ni algo reconocible como talón** — puede ser que no lo guarden como
  documento aparte (la DDJJ IVA en PDF podría ser lo que hace de comprobante
  para ellos) o que esté en otro lugar. Esto sigue sin confirmar.

**Cómo se cierra.** Dos preguntas separadas para EFFORT: (1) para COPESA,
¿dónde están los talones de febrero/junio/julio/agosto 2026 (y diciembre
2025)? (2) para DIBEC, FUMIPRO y ECOAGRO, ¿guardan el talón de la RG 90 como
documento aparte, o la DDJJ IVA en PDF ya cumple esa función? Si lo guardan en
otro lugar, hay que sumar esa carpeta a la sincronización.

---

## 29. Las migraciones no se aplican solas en DigitalOcean — ABIERTO (2026-09-15)

**2026-09-21:** el procedimiento manual se usó dos veces más y funciona — `registro_de_horas` y `prorroga_de_vencimiento`, cada una con respaldo previo, con `migrate deploy` y **antes** del push (si el código llega primero, las rutas nuevas y el respaldo automático diario fallan contra una base sin la columna; ver el punto 33). Verificado tras cada una: columnas, RLS, índices, permisos de `effort_app` y que los datos existentes no cambiaron. Sigue siendo un procedimiento que depende de acordarse.

`.do/app.yaml` declara un job `migrar-base` (`PRE_DEPLOY`, corre
`prisma migrate deploy`), pero en los despliegues del 2026-09-14 y 15 las
migraciones nuevas no se aplicaron: la tabla `lectura_de_declaracion` no existía
con el código ya en producción. Se aplicaron a mano con `migrate deploy`, con
respaldo previo.

**Consecuencia mientras siga así.** Toda migración nueva hay que aplicarla a mano
**antes** del push, o el código nuevo va a fallar contra una base vieja.

**Cómo se cierra.** Revisar en DigitalOcean (App → Settings → App Spec) si el job
está en la especificación viva. Es un cambio en la cuenta: lo hace Daniel o lo
autoriza expresamente.

---

## 30. Esquemas de prueba sobrantes en Supabase — ABIERTO (2026-09-15)

Los tests de integración y e2e crean esquemas `pruebas_<id>` y los borran al
terminar; cuando una corrida se corta, quedan. El 2026-09-14 aparecieron
`pruebas_2c50f828c88c` y `pruebas_56778dd7401f` en la base de producción de
Supabase. No afectan a los datos de `public`, pero ocupan espacio en un plan
gratuito.

**Cómo se cierra.** Listar con
`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'pruebas_%';`
y borrarlos **solo con autorización expresa de Daniel** (es un `DROP SCHEMA`,
bloqueado además por el guardia de comandos).


---

## 31. Tres declaraciones archivadas bajo el cliente equivocado — AVISADO POR EL SISTEMA (2026-09-21), FALTA LA RESPUESTA DE EFFORT

**Al 2026-09-21 la pregunta sigue sin respuesta.** Daniel trajo las respuestas 1 a 6 del documento para Laura y Lili, pero no la 0 ni la 0-bis, que es esta. La más urgente: **¿COPESA presentó el IVA de julio 2026?** Hoy figura sin presentar porque el único formulario 120 de julio en su carpeta es de MACOMA ENVIRONMENTAL TECHNOLOGIES. Puede ser que el PDF correcto nunca se guardó (y entonces está presentado y nadie lo ve) o que no se presentó (y entonces la alerta es correcta y es una multa en curso). El sistema no puede distinguirlo.

Al bajar un formulario 120 real de OneDrive para la verificación técnica de la
tarea 138, el PDF que está en la carpeta de COPESA resultó ser de **otra
empresa**. Se revisó entonces todo lo leído (`lectura_de_declaracion` guarda el
RUC que dice cada PDF) contra el RUC del cliente en cuya carpeta está:

| Carpeta del cliente | RUC del cliente | Archivo | RUC que dice el PDF | Período |
|---|---|---|---|---|
| COPESA CONSTRUCCIONES SA | 80003112 | `120-07-2026.pdf` | 80135322 — MACOMA ENVIRONMENTAL TECHNOLOGIES | 2026-07 |
| COPESA CONSTRUCCIONES SA | 80003112 | `ACUSE DDJJ IVA 102023 MARIO ANTONIO VILALBA VILLALBA .pdf` | 7243805 (persona física) | 2023-10 |
| DIBEC SOCIEDAD ANONIMA | 80082006 | `FORM 158 FUMIPRO 2022.pdf` | 80119631 — FUMIPRO | 2022-12 |

**Lo bueno: el sistema NO se dejó engañar.** `detectorDePresentaciones.ts` exige
`p.ruc === rucBase(vencimiento.rucCliente)` antes de marcar un vencimiento como
presentado, así que ninguno de los tres apagó una alerta. La defensa que estaba
escrita justo para esto funcionó.

**Lo malo: nadie se entera.** El archivo se ignora en silencio. Consecuencia
concreta y verificada hoy en producción: el IVA de **COPESA período 2026-07**
figura `VIGENTE` sin fecha de presentación, porque el único formulario 120 de
julio que hay en su carpeta es de MACOMA. Las dos lecturas posibles son muy
distintas y el sistema no distingue:

1. COPESA sí presentó y el PDF correcto nunca se guardó (o se guardó en otro
   lado) — hay que pedírselo a EFFORT.
2. COPESA no presentó — la alerta es correcta y urgente.

**Cómo se cierra.** Dos cosas, ninguna bloqueada por Laura ni Lili:

- **En el sistema: HECHO (tarea 143).** Verificado en producción el 2026-09-21
  a las 01:14 UTC: el motor levantó las 3 alertas `ALTA`, una por archivo, con
  el nombre del archivo en el título y el RUC ajeno en el detalle. El texto
  advierte expresamente que no se transcriban esos importes al SIGA. Se cierran
  solas si EFFORT reubica los archivos.
- **Con EFFORT (a confirmar, no a asumir):** preguntar por el formulario 120 de
  COPESA de julio 2026, y avisar de los tres archivos mal ubicados. **No los
  mueve ni los borra el sistema**: los reubica EFFORT si corresponde.

---

## 32. Cómo aparece el saldo a favor en el formulario 120 — VERIFICADO (2026-09-20)

Verificación técnica que faltaba para la tarea 138, hecha contra un PDF real
(`120-07-2026.pdf`, bajado de OneDrive y leído con el mismo `extraerTextoDePdf`
que usa el detector). El texto sale limpio y **cada importe viene precedido por
el número de casilla de la DNIT**, que es lo que lo hace parseable sin ambigüedad:

```
... Inc. c Saldo a favor del contribuyente del periodo anterior ...   46   717.945
... Inc. d SALDO A FAVOR DEL CONTRIBUYENTE cuando el Inc. a sea menor ...  166   954.463
... Inc. f SALDO A FAVOR DEL CONTRIBUYENTE (Monto a trasladar ... siguiente periodo fiscal) ...  47   954.463
... Inc. g Saldo a favor del fisco ...   48   0
```

**Tres cosas que hay que no confundir, y que solo se ven mirando el PDF real:**

1. **Hay DOS "saldo a favor" distintos.** El del **Rubro 4** es el *saldo
   técnico* de IVA (casilla **47**, lo que se arrastra al período siguiente), y
   el del **Rubro 5** es el *saldo financiero* (casilla **54**, retenciones y
   percepciones, explícitamente "No trasladable al Rubro 4"). El que corresponde
   al arrastre de IVA es el **47**; tomar el 54 sería un error silencioso.
2. **La casilla 46 es la entrada y la 47 la salida.** La 46 de un período tiene
   que ser igual a la 47 del período anterior. Eso da una comprobación de
   continuidad gratis, sin planillas de por medio.
3. **Formato de número:** el punto es separador de miles y no hay decimales
   ("LOS IMPORTES SE CONSIGNARÁN SIN CÉNTIMOS"). `717.945` son seiscientos mil y
   pico de guaraníes, no 717 con 945 milésimas.

Con esto la tarea 138 ya no tiene supuestos sin verificar. Lo que queda es
programarla, y eso **lleva migración de base** — o sea, respaldo y el autochequeo
de `CLAUDE.md` antes de tocar nada.

---

## 33. El respaldo falla cuando el código va adelante del esquema desplegado — ABIERTO (2026-09-21)

**Qué pasó.** Antes de aplicar las dos migraciones del día, `node scripts/respaldar-base.mjs`
falló con `P2022` («la columna `vencimiento.fecha_vencimiento_original` no existe») y, la
vez anterior, con `P2021` («la tabla `registro_de_horas` no existe»). El respaldo usa el
cliente de Prisma, y ese cliente **ya conoce** las columnas y tablas nuevas porque el código
va adelante de lo que hay en producción — exactamente en el momento en que el respaldo más
hace falta: justo antes de migrar.

**Por qué es un problema de fondo y no una molestia.** El respaldo automático diario
(`apps/api/src/servicios/respaldoAutomatico.ts`) usa la misma lista y llama `findMany` sobre
el mismo cliente de Prisma (`lectorParaRespaldo: prisma` en `index.ts`). Si un
despliegue trae código nuevo antes que su migración, el respaldo de ese día falla — y un
respaldo que falla no siempre hace ruido. Es la clase de fragilidad que el 2026-09-13
convirtió un borrado en una pérdida.

**Cómo se resolvió hoy, sin tocar el repo:** un script descartable que lee esas dos tablas con
SQL crudo (`SELECT *`), que devuelve las columnas que EXISTEN de verdad, y el resto por el
camino normal. Respaldos: `respaldos/respaldo-2026-09-21T14-30-55-previo-a-horas.json`
(22.445 filas) y `…T18-04-01-previo-a-prorroga.json` (22.476).

**Cómo se cierra (tarea 150).** Leer TODAS las tablas con SQL crudo, en el script manual y en
el automático. **Lo que no se debe hacer es aflojar la cobertura:** el test
`packages/core/test/modelosDelRespaldo.test.ts`, que compara la lista de modelos contra
`schema.prisma`, atajó hoy mismo que `registro_de_horas` no estaba en el respaldo. Ese test
tiene que seguir mandando.

---

## 34. La conexión a la base es intermitente desde la máquina de trabajo — OBSERVADO (2026-09-21)

**Qué se vio.** Durante todo el día, y sin cambiar ninguna configuración: consultas de
`scripts/consultar-produccion.mjs` con «Can't reach database server»; tests de integración
que no llegaban ni a crear el esquema temporal; un `beforeAll` que tardó más de 120 s en una
corrida y 30 s en la siguiente; y una prueba de «reglas impositivas» que falló con
**«Transaction already closed… timeout 5000 ms, 5131 ms passed»**. `npm run verify` dio
20/21 dos veces —una por un `hook timed out` de `verify:modulos`, otra por el timeout de
transacción de arriba— y **21/21 en la corrida siguiente, sin tocar código entre medio**. Una
tercera corrida dio 19/21, pero **mezclaba un fallo real** (el test de cobertura del respaldo,
punto 33: `registro_de_horas` faltaba en la lista) **con uno de red**: no todo lo rojo del día
fue la red, y eso hay que decirlo.

**Qué NO es.** No es un cambio de esta sesión: los fallos aparecieron en código que no se
tocó, y la misma corrida pasó verde poco después. **No es la app en producción**: esa usa el
pooler de transacción (6543), y las pantallas que se miraron con el navegador real
(Panel general y Horas) cargaron y guardaron sin error.

**Qué hacer cuando aparece.** Reintentar **antes** de sospechar de un cambio; si un archivo
falla solo, correrlo solo (`npx vitest run --project integracion <archivo>`). Un fallo de
red se reconoce porque el mensaje habla de conexión o de un timeout de transacción, no de una
aserción. **Lo que no se hace:** declarar «todo verde» sobre una corrida que fue intermitente
sin decirlo, ni descartar un fallo como «la red» sin haberlo corrido de nuevo.

**Relación con el punto 18.** Allí se midió la latencia (≈310 ms por consulta) y se planteó
mudar la base a EE.UU. Esto es distinto —cortes, no lentitud— pero suma al mismo argumento, y
la decisión sigue siendo de Daniel.

---

## 35. Costo por hora de cada colaborador — ABIERTO (2026-09-21)

**Qué se pidió.** Daniel, 2026-09-21: medir *«cuánto le cuesta a EFFORT cada cliente»* y
justificar lo que EFFORT paga por el sistema, incluida la posibilidad de **cobrarle más a
algunos clientes**.

**Qué hay hoy.** La planilla de horas (tarea 144) da **horas por persona y cliente**. Falta
el otro factor de la cuenta: **cuánto cuesta una hora de cada persona**. Es un dato que el
sistema no tiene, que no se puede deducir de nada y que **no se inventa** — un costo por
cliente calculado con una tarifa supuesta sería un número sin fuente que alguien usaría para
fijar un precio.

**Y una advertencia de diseño, para quien lo construya.** Ese dato es sensible (cuánto cobra
o cuesta cada persona) y hay que decidir **quién lo ve** antes de guardarlo. El criterio
vigente para todo lo que expone el trabajo de los compañeros (bitácora, resumen de horas) es
**solo dirección, y solo totales**.

**Qué falta para cerrarlo.** Que Daniel decida si quiere ese cálculo y con qué dato: costo
por hora individual, una tarifa promedio por rol, o solo horas sin guaraníes. Hasta entonces
el resumen de horas dice horas, y lo dice sin convertirlas en plata.
