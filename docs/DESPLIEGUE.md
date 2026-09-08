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
