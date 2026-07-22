# Roadmap maestro — EFFORT Control 360

**Este archivo es la fuente de verdad del avance del proyecto.**

Si estás retomando esto en una conversación nueva de Claude Code, decile:

> Leé `docs/ROADMAP-MAESTRO.md` y `docs/DISCREPANCIAS.md` en el repo
> `effort-control-360`, y seguí desde la primera tarea sin marcar.

Con eso alcanza — no hace falta reexplicar el contexto del proyecto.

La memoria persistente del proyecto son cuatro archivos:

| Archivo | Qué guarda |
|---|---|
| `docs/ROADMAP-MAESTRO.md` | En qué tarea quedó y qué sigue (este archivo) |
| `docs/DISCREPANCIAS.md` | Reglas aplicadas que EFFORT todavía no validó |
| `CLAUDE.md` | Reglas del proyecto — se carga solo en cada sesión |
| `docs/adr/` | Por qué se decidió cada cosa no obvia |

El criterio de ingeniería general (dinero, RBAC, auditoría, tests) vive en la
skill global **`backend-datos-sensibles`**, reutilizable en otros proyectos.

**Regla de este documento:** cada tarea se marca `[x]` recién cuando el
`npm run verify` de esa etapa corrió en verde y quedó commiteado en git. Una
tarea marcada sin commit real detrás es peor que no marcarla — hace perder
confianza en todo el resto del documento.

**Avance: 73 de 109 tareas.** Partes 1, 2, 3, 4A y 4B cerradas.

Última actualización: 2026-07-22 · Commit de referencia: ver último commit en `git log`

> El total **no es un número fijo**: sube y baja a medida que el alcance de cada
> parte se vuelve concreto. Si agregás, quitás o insertás una tarea, **renumerá
> todo el archivo** antes de commitear, o la próxima conversación va a leer
> números que no coinciden entre partes. Para renumerar:
>
> ```bash
> node -e "const f='docs/ROADMAP-MAESTRO.md';const fs=require('fs');let n=0;\
> fs.writeFileSync(f,fs.readFileSync(f,'utf8').split('\n').map(l=>{\
> const m=l.match(/^- \[([ x~])\] \d+\. (.*)\$/);return m?\`- [\${m[1]}] \${++n}. \${m[2]}\`:l}).join('\n'))"
> ```
>
> Después actualizá el conteo de arriba.

---

## Cómo leer este documento

- `[x]` = terminado, verificado y commiteado.
- `[ ]` = pendiente.
- `[~]` = en curso ahora mismo (debería haber como máximo una de estas a la vez).
- Cada bloque termina con su **comando de verificación**: si ese comando no
  corre en verde, el bloque no está terminado, sin importar lo que diga el chat.
- Las tareas están en orden de dependencia real, no solo cronológico: no se
  puede saltar una tarea a la siguiente si la anterior no cerró.

---

## PARTE 1 — Cimientos (COMPLETA)

### 1.1 — Scaffold y motor contable
- [x] 1. Crear rama de seguridad `demo-original` apuntando al commit de la demo original
- [x] 2. Convertir el repo en monorepo npm workspaces (`packages/*`, `apps/*`)
- [x] 3. Mover la demo original a `apps/web`, sin tocar su código
- [x] 4. Configurar TypeScript strict en modo `--build` con project references
- [x] 5. Configurar Vitest con proyectos separados por paquete
- [x] 6. Construir `packages/core/src/dinero.ts` — guaraníes como `bigint`, redondeo mitad-arriba en magnitud
- [x] 7. Construir `packages/core/src/iva.ts` — desglose IVA 10%/5%, determinación mensual con saldo a favor arrastrado
- [x] 8. Construir `packages/core/src/fechas.ts` — zona horaria `America/Asuncion`, períodos contables
- [x] 9. Construir `packages/core/src/comprobantes.ts` — clave natural, duplicados, anulados
- [x] 10. Construir `packages/core/src/conciliacion.ts` — comparación contra exportación SIGA
- [x] 11. Construir `packages/core/src/balance.ts` — ecuación patrimonial, el sistema nunca aprueba solo
- [x] 12. Escribir 52 casos dorados en JSON con fuente de cada regla citada, verificados contra una implementación Python independiente
- [x] 13. Escribir `scripts/verify.mjs` — el único comando que decide si algo está terminado
- [x] 14. ADR 0002 (representación del dinero) y ADR 0004 (el sistema no aprueba balances)
- [x] 15. `docs/DISCREPANCIAS.md` — reglas pendientes de confirmar con EFFORT

**Verificación:** `npm run verify:accounting` → exit 0, 52/52 casos dorados
**Commits:** `d99b086`, `aea94e4`

### 1.2 — Diseño de marca
- [x] 16. Extraer paleta y tipografía del Manual de Marca EFFORT (PDF)
- [x] 17. Verificar colores exactos por reconstrucción HSL→RGB (#6E2958, #231F20, #E7E8E8)
- [x] 18. Construir tokens semánticos con modo oscuro recalculado (no invertido)
- [x] 19. Cablear tokens a Tailwind con nombres semánticos (`bg-superficie`, `text-tinta`)
- [x] 20. Autoalojar fuentes Bodoni Moda + Raleway (sin depender de Google Fonts)

**Verificación:** visual en navegador, colores computados verificados por JS
**Commit:** `3cd236d`

### 1.3 — Motor de seguimiento al cliente
- [x] 21. Construir `packages/core/src/diasHabiles.ts` — calendario configurable, feriados paraguayos inyectados (con cálculo de Pascua)
- [x] 22. Construir `packages/core/src/seguimiento.ts` — reglas de recordatorio 100% configurables (plazo, hora, reintento, escalamiento)
- [x] 23. Construir bitácora de contactos con validación de evidencia (respuesta ⇒ quién atendió)
- [x] 24. Construir constancia de gestión (resumen para responder un reclamo)
- [x] 25. Pantalla `Seguimiento.jsx` conectada al motor real, con datos de semilla marcados

**Verificación:** `npx vitest run packages/core/test/seguimiento.test.ts` → 37/37
**Commit:** `3cd236d`

### 1.4 — Contratos de datos
- [x] 26. Construir `packages/schema` con Zod `.strict()` en todo — cero campos colados
- [x] 27. Validación de RUC paraguayo con dígito verificador (módulo 11)
- [x] 28. Esquemas de las 17 entidades del handoff, con altas/actualizaciones separadas de la lectura
- [x] 29. Verificar que el esquema público de usuario no puede filtrar credenciales

**Verificación:** `npx vitest run packages/schema/test/contratos.test.ts` → 16/16
**Commit:** `2981691`

### 1.5 — Núcleo de seguridad
- [x] 30. RBAC de dos capas: rol × recurso × acción, y alcance por cartera de clientes
- [x] 31. Matriz de permisos con negación por defecto — probada en las 714 combinaciones posibles
- [x] 32. Contraseñas con Argon2id, parámetros OWASP
- [x] 33. TOTP (2FA) con códigos de recuperación
- [x] 34. Sesiones server-side con doble vencimiento (8h inactividad / 24h absoluto), revocables
- [x] 35. Límite de intentos con bloqueo progresivo por (IP, correo)
- [x] 36. Saneo de logs y bitácora (credenciales ocultas, IP truncada, identificadores enmascarados)
- [x] 37. Modelo Prisma completo — dinero en `BIGINT`, sin cascadas de borrado
- [x] 38. Migración SQL: `event_log` y `registro_contacto` append-only por trigger de PostgreSQL (incluye `BEFORE TRUNCATE`)

**Verificación:** `npx vitest run --project api` → 52/52
**Commit:** `2981691`

### 1.6 — Servidor HTTP
- [x] 39. Servidor Fastify con CSP sin `unsafe-inline`, CORS de origen único, CSRF double-submit
- [x] 40. Resolutor de sesión con renovación de ventana de inactividad
- [x] 41. Manejador de errores que nunca filtra mensajes internos al cliente
- [x] 42. Rutas de autenticación en dos pasos (contraseña → 2FA) con mensajes que no revelan si un correo existe
- [x] 43. Rutas de clientes y contactos con RBAC aplicado en cada una
- [x] 44. 31 tests de integración contra el servidor completo, sin necesitar PostgreSQL (con dobles de prueba)
- [x] 45. `.env.example` documentado + `.env` local generado con secreto aleatorio de 48 bytes

**Verificación:** `npx vitest run apps/api/test/servidor.test.ts` → 31/31
**Commit:** `99d49ae`

**Total acumulado: 254 tests · `npm run verify` → exit 0 (9 OK, 5 pendientes declarados, 0 fallidos)**

---

## PARTE 2 — Conectar la base de datos real

- [x] 46. Corregir contraseña de Supabase con caracteres especiales sin codificar en la URL (`#`, `%` rompían el parseo — se codificaron con `encodeURIComponent`)
- [x] 47. Fijar Prisma en versión estable 6.19.3 (Prisma 7 recién salido cambió la configuración de conexión de forma incompatible)
- [x] 48. Confirmar conectividad real contra Supabase
- [x] 49. Descubrir y corregir: el string copiado era el "Transaction pooler" (6543), incompatible con sentencias preparadas de las migraciones. Se agregó `DIRECT_URL` (Session pooler, 5432) como `directUrl` del datasource
- [x] 50. Correr la migración inicial: 16 tablas de negocio creadas en Supabase
- [x] 51. Aplicar la migración de triggers de inmutabilidad de `event_log` y `registro_contacto`
- [x] 52. **Verificado con una prueba real** (no solo "no dio error"): insertar fila → UPDATE rechazado por el trigger → DELETE rechazado por el trigger → fila sigue intacta
- [ ] 53. Crear el rol `effort_app` en Postgres con permisos mínimos (segunda barrera además del trigger, para cuando exista un usuario de aplicación distinto del de migraciones)
- [ ] 54. Sembrar los 5 clientes piloto (marcados `origen=SEMILLA`) para poder probar de punta a punta
- [ ] 55. Crear el primer usuario real de dirección (Laura o Lili) con contraseña temporal + forzar cambio en primer acceso

**Verificación de la Parte 2:** conexión confirmada, 16 tablas creadas, trigger de inmutabilidad probado con una escritura real — ✅ hecho el 2026-07-22.
Falta 53-55 antes de poder probar el sistema de punta a punta con datos.

---

## PARTE 3 — Implementación Prisma de los puertos

- [x] 56. Implementar `RepositorioDeUsuarios` contra Prisma (con `select` explícito, para que agregar una columna sensible al modelo no la filtre sola)
- [x] 57. Implementar `RepositorioDeSesiones` contra Prisma (el rol se lee del usuario en cada consulta, no queda congelado en la sesión)
- [x] 58. Implementar `RepositorioDeClientes` contra Prisma, con el filtro de cartera aplicado en SQL vía `asignacion_cliente` con vigencia
- [x] 59. Implementar `RepositorioDeContactos` contra Prisma (sin métodos de borrado ni edición: es evidencia)
- [x] 60. Implementar `RepositorioDeBitacora` contra Prisma (solo inserción)
- [x] 61. Cablear `apps/api/src/index.ts` con las implementaciones reales, un solo cliente Prisma compartido y comprobación de conexión antes de escuchar
- [x] 62. Tests de integración contra la base real, en un esquema Postgres temporal que se crea y se destruye (31 tests)
- [x] 63. **Bug encontrado y corregido por los tests de integración:** en `buscarPorId`, combinar la condición de identificador con la de cartera mediante spread hacía que la segunda pisara a la primera. La consulta perdía el id pedido y devolvía cualquier cliente de la cartera — pedir el cliente X devolvía el cliente Y. Los dobles de prueba no lo detectaban porque implementaban la lógica a mano y correctamente. Corregido con `AND` explícito + test de regresión.
- [ ] 64. Verificar en Supabase que las políticas RLS no bloquean al rol de la aplicación (se activaron como defensa en profundidad; hoy la app usa el rol dueño del esquema, que las omite)

**Verificación:** `npm run verify` con `test:integration` en verde — ✅ hecho el 2026-07-22.
El gate pasó de 9 a 10 checks activos: `test:integration` dejó de ser pendiente declarado.

---

## PARTE 4 — Módulos de negocio restantes (rutas + Prisma)

### 4A — Núcleo operativo (COMPLETA)

- [x] 65. Piezas comunes de rutas: `autorizar()` en un paso, conversión de importes en el borde
- [x] 66. Módulo Documentos: rutas + repositorio. Exige la terna RUC+timbrado+número completa o ninguna (sin ella no hay conciliación ni detección de duplicados), y rechazar exige motivo
- [x] 67. Módulo Proceso Mensual: rutas + repositorio. Editar un período que nadie abrió lo crea al vuelo con `upsert`; el IVA no puede quedar a pagar y a favor a la vez
- [x] 68. Módulo Vencimientos: rutas + repositorio + días restantes y nivel de alerta calculados en el servidor, en zona Paraguay
- [x] 69. Módulo Balances: rutas + repositorio con la aprobación humana del ADR 0004 en cuatro capas independientes
- [x] 70. 34 tests de módulos con dobles de persistencia
- [x] 71. **Dos bugs encontrados por los tests:** (a) las inconsistencias se guardaban con `diferencia` como `bigint`, que `JSON.stringify` no serializa — rompía la escritura en la columna Json y la respuesta HTTP; (b) la re-verificación al aprobar construía un estado de resultados incoherente (ceros contra un resultado distinto de cero), lo que hacía **imposible aprobar cualquier balance**

**Verificación:** `npm run verify` con `verify:modulos` en verde — ✅ hecho el 2026-07-22.
El gate pasó de 10 a 11 checks activos.

### 4B — SIGA, liquidaciones y alertas

- [x] 72. Migración: tablas `exportacion_siga`, `comprobante_siga`, `liquidacion` y `alerta` (no existían en el modelo)
- [x] 73. Módulo Exportaciones SIGA: rutas + repositorio, con la importación de la exportación y sus filas en **una sola transacción** (si fallara a mitad, la conciliación reportaría diferencias inexistentes)
- [x] 74. Conciliación aplicada con `conciliarConSiga` de `@effort/core` — la ruta transporta datos, no reimplementa la comparación
- [x] 75. Módulo Liquidaciones: ciclo completo generada → enviada → respondida, con destinatario, canal, fecha y evidencia del envío
- [x] 76. 28 tests de SIGA y liquidaciones
- [x] 77. **Bug encontrado por los tests:** el contador `sinIdentificacion` de la conciliación era código muerto — el repositorio ya filtraba los documentos sin número, así que nunca podía contar ninguno. El comentario prometía avisar que la comparación dejaba documentos afuera y el código no lo hacía. Corregido renombrando el método a `documentosDelPeriodo` y quitando el filtro

**Verificación:** `npm run verify` con `verify:siga` en verde — ✅ hecho el 2026-07-22.
El gate pasó de 11 a 12 checks activos.

### 4C — Módulos restantes

- [ ] 78. Módulo Alertas: vista consolidada ordenada por criticidad (la tabla ya existe)
- [ ] 79. Módulo Equipo/Roles: alta y edición de usuarios (solo dirección)
- [ ] 80. Módulo Reglas Impositivas: edición de tasas de IVA (solo dirección)
- [ ] 81. Módulo Reglas de Notificación: alta/edición de reglas de recordatorio (ya tiene motor, falta la ruta)
- [ ] 82. Módulo Event Log: consulta filtrable del historial (solo dirección/revisor)
- [ ] 83. Tests de integración de los repositorios de la Parte 4 contra Postgres real (los de 4A todavía solo tienen dobles)

**Verificación de cada módulo:** su propio test en verde antes de pasar al siguiente

---

## PARTE 5 — Importadores desde OneDrive

- [ ] 84. Registrar la aplicación en Azure AD (requiere que EFFORT cree la cuenta `sistema.effort360@...`)
- [ ] 85. Implementar `packages/drive` — adaptador Microsoft Graph API + adaptador falso para tests
- [ ] 86. Espejo automático hacia el OneDrive de respaldo, con manifiesto sha256
- [ ] 87. Importador de comprobantes (Excel/CSV) con reporte de filas aceptadas/rechazadas
- [ ] 88. Importador de exportaciones SIGA
- [ ] 89. Modo simulación (`dry-run`) obligatorio antes de escribir en la base
- [ ] 90. Idempotencia verificada: importar el mismo archivo dos veces no duplica

**Verificación:** `npm run verify:drive` → exit 0 contra el adaptador real (o falso si Azure AD no está listo)

---

## PARTE 6 — Despachador de notificaciones

- [ ] 91. Proveedor de envío de correo (a definir: Resend, SES, o el que EFFORT prefiera)
- [ ] 92. Job programado que corre `planificarProximoRecordatorio` sobre todas las solicitudes abiertas
- [ ] 93. Registro automático en `registro_contacto` con `origen=AUTOMATICO` por cada envío real
- [ ] 94. Registro en `envio_notificacion` con el id del proveedor, para poder auditar contra su panel
- [ ] 95. Manejo de fallos de envío (reintento, alerta a dirección si un correo rebota)

**Verificación:** test de integración con proveedor de correo en modo sandbox

---

## PARTE 7 — Interfaz completa contra la API real

- [ ] 96. Cliente HTTP tipado en `apps/web`, con manejo de sesión/CSRF
- [ ] 97. Reemplazar `datos-semilla/` por llamadas reales a la API
- [ ] 98. Pantalla de login con flujo de 2FA en dos pasos
- [ ] 99. Las 12 pantallas del handoff, una por una, contra datos reales
- [ ] 100. Retirar por completo `apps/App.jsx` (la demo original) una vez que todas las pantallas tengan reemplazo
- [ ] 101. `verify:no-hardcoded-kpi` — ningún número escrito a mano en la interfaz

**Verificación:** `npm run test:e2e` (Playwright) → exit 0

---

## PARTE 8 — Despliegue

- [ ] 102. Crear la app en DigitalOcean App Platform, conectada al repositorio
- [ ] 103. Configurar variables de entorno de producción (secretos distintos a los de desarrollo)
- [ ] 104. Configurar el subdominio `effort360.disaak.com` (registro CNAME)
- [ ] 105. Verificar HTTPS y que `ORIGEN_PERMITIDO`/cookies funcionan en producción
- [ ] 106. Corrida de humo completa en producción con el usuario real de dirección

---

## PARTE 9 — Validación final con EFFORT

- [ ] 107. Contrastar el cálculo de IVA contra una liquidación real ya presentada (cierra la discrepancia #1 de `docs/DISCREPANCIAS.md`)
- [ ] 108. Confirmar los 5 clientes piloto definitivos con Laura/Lili
- [ ] 109. Primera revisión guiada con EFFORT: los 12 módulos, en vivo, con sus propios datos

---

## Bitácora de decisiones tomadas en el camino

*(Se agrega una línea cada vez que aparece una decisión no trivial, para no
tener que redescubrirla en la próxima conversación.)*

- **2026-07-21** — OneDrive en vez de Google Drive (EFFORT usa Microsoft 365, no Google Workspace).
- **2026-07-21** — Supabase en vez de Postgres local: necesario para multiusuario real desde el piloto.
- **2026-07-21** — Redondeo de dinero: mitad hacia arriba en magnitud, confirmado por EFFORT.
- **2026-07-22** — Prisma fijado en 6.19.3: la versión 7 recién salida cambió la configuración de conexión de forma incompatible con el schema existente; se prioriza estabilidad sobre estar en la última versión.
- **2026-07-22** — La contraseña de Supabase puede traer caracteres especiales (`#`, `%`, etc.) que rompen la URL de conexión si no se codifican con `encodeURIComponent`. Si se resetea la contraseña en el futuro, revisar este punto de nuevo.
- **2026-07-22** — Supabase entrega dos cadenas de conexión distintas y hacen falta las dos: `DATABASE_URL` (Transaction pooler, puerto 6543) para la app en marcha, `DIRECT_URL` (Session pooler, puerto 5432) para las migraciones de Prisma. Usar solo la de 6543 hace fallar `prisma migrate` con "prepared statement already exists".
- **2026-07-22** — Base de datos de Supabase conectada y migrada: 16 tablas creadas, trigger de inmutabilidad de `event_log`/`registro_contacto` verificado con una escritura real (insert → update rechazado → delete rechazado → fila intacta).
- **2026-07-22** — Los tests de integración corren en un esquema Postgres temporal (`pruebas_<aleatorio>`) que se crea, se migra y se destruye por corrida. No usan `public` porque los disparadores append-only impiden borrar filas de `event_log` y `registro_contacto`, así que cualquier test que escriba ahí dejaría basura permanente en la base del piloto.
- **2026-07-22** — Los tests de integración usan `DIRECT_URL` (Session pooler) y no `DATABASE_URL`: crear esquemas y tipos necesita sentencias preparadas que el pooler de transacción no admite.
- **2026-07-22** — Lección: los dobles de prueba validan el contrato, no la consulta. El bug de `buscarPorId` (spread pisando la clave `id`) pasó 31 tests con dobles y solo apareció contra Postgres real. Todo repositorio nuevo necesita su test de integración, no alcanza con el doble.
- **2026-07-22** — Todo lo que se persiste en una columna `Json` tiene que convertirse a una forma serializable ANTES de guardarse. Las inconsistencias de balance llevaban `diferencia` como `bigint` y `JSON.stringify` no lo serializa: rompía tanto la escritura como la respuesta HTTP. Regla general: ningún `bigint` cruza el borde de la aplicación sin pasar a `string`.
- **2026-07-22** — Al re-verificar un balance en el momento de aprobarlo, el estado de resultados NO se puede recalcular porque no se persiste como cifras propias. Se re-verifica solo la ecuación patrimonial y el contexto operativo, y se exige que el estado guardado sea `LISTO_PARA_REVISION` (que ya resume la revisión completa hecha al guardar). Un primer intento pasaba ceros como estado de resultados y hacía imposible aprobar cualquier balance.
- **2026-07-22** — Cuando dos guardas pueden rechazar la misma petición, va primero la que da el mensaje más específico. "El balance no tiene cifras cargadas" es más útil que "no está en un estado aprobable", aunque las dos sean ciertas.
