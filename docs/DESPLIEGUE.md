# Despliegue — Parte 8 del roadmap

Guía de referencia para las tareas 107-111. El spec de la app vive en
`.do/app.yaml` — este documento es el paso a paso para usarlo, no lo
reemplaza.

## Arquitectura

Un solo dominio (`effort360.disaak.com`), dos componentes en la misma app
de DigitalOcean:

- **`web`** (sitio estático): sirve `apps/web` compilado, en `/`.
- **`api`** (servicio): sirve `apps/api`, en `/api`.

Mismo origen para los dos — nada de CORS entre interfaz y API, y la cookie
de sesión (que en producción exige HTTPS por el prefijo `__Host-`, ver
`apps/api/src/seguridad/sesiones.ts`) funciona sin ningún caso especial.
Antes de esta tarea, `principal()` (el arranque real del servidor) nunca se
había invocado fuera de los tests end-to-end de Playwright — acá pasa a ser
también el punto de entrada de producción (`apps/api/src/arrancar.ts`).

## Tarea 107 — Crear la app

1. Entrar a `cloud.digitalocean.com` → **Apps** → **Create App**.
2. Conectar la cuenta de GitHub si todavía no está conectada, y autorizar
   acceso al repositorio `IMMR-Hub/effort-control-360` (esto lo hace Daniel
   desde su cuenta, no algo que se automatice).
3. DigitalOcean va a proponer una configuración auto-detectada — **no
   usarla tal cual**: es un monorepo con dos piezas distintas (API +
   interfaz), y el asistente típicamente detecta solo una. Usar en cambio la
   vista de **"Edit as YAML"** / **App Spec** que ofrece el asistente, y
   pegar el contenido de `.do/app.yaml` (ajustando lo que haga falta —
   región, nombres — antes de confirmar).
4. Antes de confirmar la creación, revisar el costo mostrado — recién ahí
   está gastando dinero real. Confirmar con Daniel antes del clic final si
   hay cualquier duda sobre el plan/tamaño.

### El build necesita `NPM_CONFIG_INCLUDE=dev`

Sin esta variable (alcance **Build Time**) el build falla siempre, y por
caminos que no se parecen entre sí. El buildpack de Heroku lee
`NODE_ENV=production` y le pasa a npm la configuración de producción, así
que `npm ci` **no instala las devDependencies** — donde están `typescript`,
`@types/node` y el CLI de `prisma`, o sea todo lo que el build usa.

Cuesta reconocerlo porque ningún síntoma nombra la causa:

| Síntoma | Falta en realidad |
|---|---|
| `Cannot find name 'process'` / `Buffer` / `node:crypto` | `@types/node` |
| `sh: 1: prisma: not found` (exit 127) | CLI de `prisma` |
| Build colgado 30 min, sin salida y con 0% de CPU | `typescript` — `npx tsc` se queda intentando bajarlo del registry |

Cómo confirmarlo en un log de build, sin adivinar: comparar el conteo de
`npm ci`. La instalación completa son 626 paquetes ("136 packages are
looking for funding"); la de producción, 270 ("42 packages are looking for
funding"). Si el log dice 42, faltan las devDependencies.

No hay que tocar `NODE_ENV`: en la resolución de configuración de npm,
`include` gana sobre `omit`/`production`, y `NODE_ENV=production` sí se
necesita en ejecución (de él depende el prefijo `__Host-` de la cookie).

### El CLI de `prisma` no se puede invocar desde la raíz del repo

`npx prisma ...` en el Build Command falla con `sh: 1: prisma: not found`
(exit 127), aunque el paquete esté instalado. El comando corre desde la raíz
del repo, y `prisma` es devDependency del workspace `apps/api`: npm enlaza su
binario en `apps/api/node_modules/.bin`, **no** en el `.bin` de la raíz, que
es el único donde `npx` mira desde ahí. `npx tsc` sí funciona, porque
`typescript` es devDependency de la raíz.

Por eso **el Build Command no lleva ningún `prisma generate`**: el cliente lo
genera el `postinstall` de `apps/api/package.json`, que corre dentro de
`npm ci` y sí lo encuentra (npm arma el PATH de los scripts de ciclo de vida
con el `.bin` del propio workspace). Agregar un `prisma generate` "por las
dudas" no es redundancia inofensiva: rompe el build entero.

Si alguna vez hace falta invocar el CLI desde la raíz, la forma que funciona
es `npm exec --workspace @effort/api -- prisma <lo que sea>` (además cambia
el directorio de trabajo a `apps/api`, así que el schema se resuelve solo).

**Importante — el App Spec de una app ya creada no se sincroniza solo con
cambios en `.do/app.yaml` del repo.** Si se edita ese archivo después de
crear la app (como pasó al agregar `npx prisma generate` al
`build_command`, ver bitácora del roadmap), hay que reflejar el cambio a
mano en el panel: Settings → el componente `api` → **Commands** → Edit, o
Settings → **Manage App Spec**. Un `git push` con `Autodeploy: On` sí
dispara un build nuevo, pero usa el `build_command` que la app tiene
guardado en DigitalOcean, no el del archivo del repo.

## Tarea 108 — Variables de entorno de producción

**Ninguna se copia de `.env` local — todas nuevas, generadas para
producción específicamente** (así lo pide el roadmap, tarea 108, y es la
única forma de que un secreto de desarrollo filtrado no sirva para nada en
producción):

| Variable | Cómo se genera |
|---|---|
| `SECRETO_COOKIES` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — correrlo de nuevo en el momento, no reusar ningún valor ya mostrado en un chat o documento. |
| `DATABASE_URL` | Supabase → mismo proyecto → botón "Connect" → pestaña ORMs → "Transaction pooler" (6543). |
| `DIRECT_URL` | Igual, pero "Session pooler" (5432). |
| `TURNSTILE_SECRET` | Opcional — solo si se decide activar Cloudflare Turnstile. |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Los mismos que ya están en el `.env` local (son credenciales de la app "EFFORT Control 360" en Azure AD, no de un usuario — no hace falta generar otras). |

Todas se cargan como **"Encrypted"** en el panel de DigitalOcean (Settings →
la variable correspondiente → App-Level o Component-Level Environment
Variables), nunca en `.do/app.yaml` ni en ningún archivo del repo.

`ORIGEN_PERMITIDO` no es secreto — ya queda declarado en `.do/app.yaml`
como `https://effort360.disaak.com`.

## Tarea 109 — Subdominio

1. Confirmar dónde está delegado el DNS de `disaak.com` (pendiente de
   confirmar — ver `docs/ROADMAP-MAESTRO.md`).
2. En DigitalOcean: Apps → la app → Settings → Domains → agregar
   `effort360.disaak.com`.
3. DigitalOcean va a pedir un registro **CNAME** apuntando a la URL que
   asigna la app (algo como `effort-control-360-xxxxx.ondigitalocean.app`).
   Ese CNAME se carga donde esté administrado el DNS de `disaak.com`.
4. Esperar la propagación (minutos a un par de horas) antes de pasar a la
   110.

## Tarea 110 — Verificar HTTPS y cookies en producción

DigitalOcean emite el certificado HTTPS automáticamente para dominios
propios una vez que el CNAME resuelve — no hace falta ningún paso manual
para eso. Verificar con una llamada real, no asumir:

```bash
curl -I https://effort360.disaak.com/api/v1/csrf
```

→ tiene que dar `200` (es una ruta pública, sin sesión). La ruta `/salud`
que usa `health_check` en `.do/app.yaml` **no** sirve para este chequeo
externo: DigitalOcean la consulta directo contra el contenedor, no a
través del dominio público, y no vive bajo `/api` — pedirla desde afuera
da `404` a propósito, no es un error. Después, probar el login real desde
el navegador y
confirmar en las herramientas de desarrollador (Application → Cookies) que
la cookie `__Host-effort_sesion` quedó guardada — es la prueba de que
`nombreCookieSesion(esProduccion)` está usando la rama de producción de
verdad (ver `apps/api/src/seguridad/sesiones.ts`).

## Tarea 111 — Corrida de humo

Con el primer usuario de dirección ya sembrado (tareas 56/57, siguen
esperando confirmación de EFFORT — sin eso, tampoco hay con qué hacer esta
corrida): login real, navegar 3-4 pantallas, confirmar que muestran datos
reales, cerrar sesión. Documentar el resultado en
`docs/ROADMAP-MAESTRO.md` antes de marcar la Parte 8 cerrada.

---

## Verificar que un despliegue terminó (2026-09-17)

Antes: bajar el `.js` a mano y buscar un texto nuevo (regla 7 de `CLAUDE.md`).
Ahora hay un script que hace las dos comprobaciones que importan — que la WEB
cambió y que la API nueva responde — sin credenciales:

```bash
node scripts/esperar-despliegue.mjs --marcador "texto que solo está en el código que se acaba de pushear"
```

Sondea cada 60 segundos, se rinde a los 30 minutos (`--tope-ms` para ajustar) y
sale con código 0 solo si las dos señales aparecen juntas. Si se agota el
tiempo, hay que mirar el panel de DigitalOcean a mano antes de seguir — no es
necesariamente una falla, puede ser una compilación lenta.

## Consultas de solo lectura contra producción (2026-09-17)

Para las "fotos" de antes y después de un push (contar alertas, hallazgos,
liquidaciones):

```bash
node scripts/consultar-produccion.mjs "SELECT count(*) FROM alerta WHERE estado = 'ABIERTA'"
```

Corre la consulta en una transacción `SET TRANSACTION READ ONLY`: un INSERT,
UPDATE o DELETE por accidente falla porque lo rechaza PostgreSQL, no por una
convención del script. Probado contra PostgreSQL real (no un doble) en
`apps/api/test/integracion/consultar-produccion.test.ts`. Nunca imprime la
cadena de conexión.

## Interruptores de los trabajos automáticos (2026-09-17)

Se cambian en el panel de DigitalOcean (Settings → el componente de la API →
Environment Variables). Guardar un cambio **reinicia el servicio**: tratarlo
como un despliegue (no hacerlo mientras hay otro en curso). `.do/app.yaml` no se
sincroniza solo con el panel.

Los valores aceptan `si`/`no` escritos de cualquier forma (`Si`, `sí`, `NO`,
`true`, `0`). Cualquier otro valor frena el arranque, con un mensaje que nombra
la variable.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `TRABAJOS_AUTOMATICOS` | `si` | Sincronización de OneDrive, cálculo de IVA, vencimientos y alertas cada hora. `no` apaga todo eso; los botones manuales siguen funcionando. |
| `AVISOS_POR_CORREO` | `no` | Correos de las alertas críticas. **Apagado por orden de Daniel (2026-09-16)**: se enciende recién en las pruebas finales con EFFORT, con su autorización. |
| `AVISOS_DESTINATARIOS` | vacío | A quiénes se avisa, separados por coma. Vacío = no sale ningún correo aunque el interruptor esté en `si`. Ya no se deducen de los usuarios de dirección. |
| `AVISOS_TOPE_POR_CORRIDA` | `5` | Máximo de correos por corrida (0 a 100). El resto queda en la pantalla de Alertas. Solo se avisa de alertas levantadas en las últimas 24 horas. |

Las alertas de libro (diferencias de IVA) solo se levantan desde el período
`2025-01` (`PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO` en
`apps/api/src/servicios/motorDeAlertas.ts`, pendiente de confirmar con EFFORT).
