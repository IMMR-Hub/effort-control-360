# Roadmap maestro — EFFORT Control 360

**Este archivo es la fuente de verdad del avance del proyecto.**

Si estás retomando esto en una conversación nueva de Claude Code, decile:

> Leé `docs/ROADMAP-MAESTRO.md` y `docs/DISCREPANCIAS.md` en el repo
> `effort-control-360`, y seguí desde la primera tarea sin marcar.

Con eso alcanza — no hace falta reexplicar el contexto del proyecto.

> **Regla que no se rompe nunca, bajo ninguna circunstancia:** EFFORT no
> tiene copia de seguridad de sus propios archivos. Ninguna tarea de este
> roadmap borra, sobreescribe fuera de la subcarpeta de salidas, ni
> renombra/mueve un archivo real de EFFORT en OneDrive — ni ahora ni en
> ninguna tarea futura, sin excepción. Detalle completo en `CLAUDE.md`,
> regla 5, y en `docs/DISCREPANCIAS.md`, punto 6.

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

**Regla anti-mentira (agregada 2026-07-22 tras encontrar un roadmap que decía
"Parte 2 y 3 cerradas" con 4 tareas sin marcar adentro):** antes de escribir
"PARTE X — cerrada" o "COMPLETA" en cualquier lado, **grep todas las líneas
`- [ ]` de esa parte**. Si hay una sola, la parte NO está cerrada. No alcanza
con mirar el trabajo que se acaba de hacer — hay que barrer toda la sección.

```bash
grep -c "^- \[ \]" <(sed -n '/## PARTE X/,/## PARTE X+1/p' docs/ROADMAP-MAESTRO.md)
```

Si da 0, cerrada. Si no, no.

**Avance: 99 de 114 tareas (87%).** Partes 1, 2, 3, 4A, 4B, 4C, 4D y 4E cerradas. Quedan 2 tareas bloqueadas por EFFORT (carga de datos: los 5 clientes piloto y el primer usuario de dirección — tareas 56/57), que no frenan el código.

**Azure AD (tarea 88) cerrado el 2026-09-04:** registro de app, consentimiento de administrador y acceso real a OneDrive, los tres verificados con llamadas reales de punta a punta. Ver `docs/DISCREPANCIAS.md`, punto 6.

**Supabase se pausa solo de tanto en tanto** (plan gratuito, se pausa después de varios días sin actividad — recurrió otra vez el 2026-09-04, sin relación con ninguna tarea de código). El arreglo es siempre el mismo: dashboard de Supabase → "Resume project" → esperar un par de minutos → reintentar `test:integration`. Ver `docs/DISCREPANCIAS.md`, punto 15.

**PARTE 7 CERRADA el 2026-09-04** (tareas 100 a 106 + el criterio de verificación de la parte): las 12 pantallas, retiro de la demo original, el chequeo de KPI escritos a mano, y la suite end-to-end con Playwright (`npm run test:e2e` → 2/2, primera vez que el sistema corre de punta a punta con un navegador real). Construyéndola apareció y se corrigió un bug de seguridad real — la cookie de sesión con prefijo `__Host-` se descartaba en silencio fuera de HTTPS, así que el login nunca dejaba una sesión guardada fuera de producción — detalle completo en la entrada de la tarea 106/Parte 7 más abajo.

**`lint` configurado el mismo día:** `eslint.config.js` nuevo, 7 hallazgos reales corregidos (imports sin usar, un array usado solo como tipo, y un `useMemo` con una dependencia inestable en `Seguimiento.tsx`). **`scripts/verify.mjs` ya no tiene un solo check declarado `pendiente` — los 19 corren de verdad.**

**Tarea 107 en curso (`[~]`) desde el 2026-09-04:** la preparación de código (`.do/app.yaml`, `docs/DESPLIEGUE.md`) está lista — falta el paso real en la cuenta de DigitalOcean de Daniel (conectar el repo, confirmar el plan), que no se automatiza.

Última actualización: 2026-09-04 · Commit de referencia: `abc4101` (ver último commit real en `git log`)

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
- [x] 39. Servidor Fastify con CSP sin `unsafe-inline`, CORS de origen único, CSRF double-submit. **Corrección 2026-07-28 (ver bitácora):** el CSRF quedó registrado como plugin pero nunca aplicado a ninguna ruta ni emitiendo token — no protegía nada. Se corrigió recién al construir la tarea 100 (cliente HTTP del frontend), que es donde se necesitaba de verdad.
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
- [x] 53. Crear el rol `effort_app` con permisos mínimos, y **las políticas RLS que lo habilitan**
- [x] 54. **Mina desactivada:** Supabase tenía RLS activo en las 20 tablas con CERO políticas definidas. En PostgreSQL eso es "denegar todo" para cualquier rol que no sea el dueño. Funcionaba solo porque la app conecta como `postgres`; el día que se usara otro rol, todas las consultas habrían devuelto cero filas **sin dar error** — una caída silenciosa muy difícil de diagnosticar
- [x] 55. **Verificadas las 9 reglas del rol con `SET ROLE` real**, no por declaración: puede leer, insertar y actualizar datos de negocio; puede insertar en `event_log` pero NO actualizarlo ni borrarlo; no puede borrar en `registro_contacto` ni en ninguna otra tabla

#### Bloqueadas por EFFORT (no dependen de nosotros)

- [ ] 56. Sembrar los 5 clientes piloto — **bloqueada:** espera que EFFORT confirme los clientes definitivos (`docs/DISCREPANCIAS.md`, punto 3)
- [ ] 57. Crear el primer usuario de dirección — **bloqueada:** necesita el correo real de Laura o Lili, y que la persona defina su propia contraseña en el primer acceso

**Verificación de la Parte 2:** conexión confirmada, 16 tablas creadas, trigger de
inmutabilidad probado con escritura real, rol de aplicación creado y sus permisos
comprobados uno por uno — ✅ hecho el 2026-07-22.

La parte técnica está cerrada. Las tareas 56 y 57 son de carga de datos y
esperan información de EFFORT: **no bloquean el avance del código.**

---

## PARTE 3 — Implementación Prisma de los puertos

- [x] 58. Implementar `RepositorioDeUsuarios` contra Prisma (con `select` explícito, para que agregar una columna sensible al modelo no la filtre sola)
- [x] 59. Implementar `RepositorioDeSesiones` contra Prisma (el rol se lee del usuario en cada consulta, no queda congelado en la sesión)
- [x] 60. Implementar `RepositorioDeClientes` contra Prisma, con el filtro de cartera aplicado en SQL vía `asignacion_cliente` con vigencia
- [x] 61. Implementar `RepositorioDeContactos` contra Prisma (sin métodos de borrado ni edición: es evidencia)
- [x] 62. Implementar `RepositorioDeBitacora` contra Prisma (solo inserción)
- [x] 63. Cablear `apps/api/src/index.ts` con las implementaciones reales, un solo cliente Prisma compartido y comprobación de conexión antes de escuchar
- [x] 64. Tests de integración contra la base real, en un esquema Postgres temporal que se crea y se destruye (31 tests)
- [x] 65. **Bug encontrado y corregido por los tests de integración:** en `buscarPorId`, combinar la condición de identificador con la de cartera mediante spread hacía que la segunda pisara a la primera. La consulta perdía el id pedido y devolvía cualquier cliente de la cartera — pedir el cliente X devolvía el cliente Y. Los dobles de prueba no lo detectaban porque implementaban la lógica a mano y correctamente. Corregido con `AND` explícito + test de regresión.
- [x] 66. Verificar que las políticas RLS no bloquean al rol de la aplicación — resuelto junto con la creación del rol: se comprobó con `SET ROLE` que `effort_app` ve los datos y opera con normalidad

**Verificación:** `npm run verify` con `test:integration` en verde — ✅ hecho el 2026-07-22.
El gate pasó de 9 a 10 checks activos: `test:integration` dejó de ser pendiente declarado.

---

## PARTE 4 — Módulos de negocio restantes (rutas + Prisma)

### 4A — Núcleo operativo (COMPLETA)

- [x] 67. Piezas comunes de rutas: `autorizar()` en un paso, conversión de importes en el borde
- [x] 68. Módulo Documentos: rutas + repositorio. Exige la terna RUC+timbrado+número completa o ninguna (sin ella no hay conciliación ni detección de duplicados), y rechazar exige motivo
- [x] 69. Módulo Proceso Mensual: rutas + repositorio. Editar un período que nadie abrió lo crea al vuelo con `upsert`; el IVA no puede quedar a pagar y a favor a la vez
- [x] 70. Módulo Vencimientos: rutas + repositorio + días restantes y nivel de alerta calculados en el servidor, en zona Paraguay
- [x] 71. Módulo Balances: rutas + repositorio con la aprobación humana del ADR 0004 en cuatro capas independientes
- [x] 72. 34 tests de módulos con dobles de persistencia
- [x] 73. **Dos bugs encontrados por los tests:** (a) las inconsistencias se guardaban con `diferencia` como `bigint`, que `JSON.stringify` no serializa — rompía la escritura en la columna Json y la respuesta HTTP; (b) la re-verificación al aprobar construía un estado de resultados incoherente (ceros contra un resultado distinto de cero), lo que hacía **imposible aprobar cualquier balance**

**Verificación:** `npm run verify` con `verify:modulos` en verde — ✅ hecho el 2026-07-22.
El gate pasó de 10 a 11 checks activos.

### 4B — SIGA, liquidaciones y alertas

- [x] 74. Migración: tablas `exportacion_siga`, `comprobante_siga`, `liquidacion` y `alerta` (no existían en el modelo)
- [x] 75. Módulo Exportaciones SIGA: rutas + repositorio, con la importación de la exportación y sus filas en **una sola transacción** (si fallara a mitad, la conciliación reportaría diferencias inexistentes)
- [x] 76. Conciliación aplicada con `conciliarConSiga` de `@effort/core` — la ruta transporta datos, no reimplementa la comparación
- [x] 77. Módulo Liquidaciones: ciclo completo generada → enviada → respondida, con destinatario, canal, fecha y evidencia del envío
- [x] 78. 28 tests de SIGA y liquidaciones
- [x] 79. **Bug encontrado por los tests:** el contador `sinIdentificacion` de la conciliación era código muerto — el repositorio ya filtraba los documentos sin número, así que nunca podía contar ninguno. El comentario prometía avisar que la comparación dejaba documentos afuera y el código no lo hacía. Corregido renombrando el método a `documentosDelPeriodo` y quitando el filtro

**Verificación:** `npm run verify` con `verify:siga` en verde — ✅ hecho el 2026-07-22.
El gate pasó de 11 a 12 checks activos.

### 4C — Deuda de tests de integración (COMPLETA)

Se saldó **antes** de avanzar a los módulos restantes: los repositorios de 4A y
4B tenían solo dobles de prueba, que es exactamente donde se había escondido el
bug de `buscarPorId`.

- [x] 80. 35 tests de integración contra Postgres real para los seis repositorios de 4A y 4B (`documentos`, `proceso_mensual`, `vencimientos`, `balances`, `exportaciones_siga`, `liquidaciones`)
- [x] 81. Verificado lo que un doble no puede detectar: que el filtro de cartera no pise las demás condiciones del `where`, que las restricciones de unicidad se apliquen de verdad, que el `upsert` no duplique bajo llamadas simultáneas, que un `BIGINT` por encima de 2^53 vuelva intacto, y que la transacción de importación SIGA **revierta entera** cuando una fila es inválida

**Verificación:** `npm run verify` con `test:integration` en verde — ✅ hecho el 2026-07-22.

### 4D — Módulos restantes (COMPLETA)

- [x] 82. Módulo Alertas: vista consolidada ordenada por criticidad (la tabla ya existe). Repositorio Prisma + rutas (`GET /api/v1/alertas` con resumen por criticidad, `POST /api/v1/alertas/:id/cerrar` con motivo obligatorio). Sin ruta de alta a propósito: ningún rol tiene `crear` sobre `alerta` en la matriz de RBAC — la tabla la alimenta el sistema, no un usuario. 9 tests de módulo (dobles) + 6 de integración contra Postgres real, incluido el orden por criticidad y que el filtro de cartera no se pisa con el de estado.

  **Verificación:** `npm run verify` → exit 0, 12 OK / 4 pendientes declarados / 0 fallidos — hecho el 2026-07-23.

- [x] 83. Módulo Equipo/Roles: alta y edición de usuarios (solo dirección). `GET/POST /api/v1/usuarios`, `PATCH /api/v1/usuarios/:id`. La contraseña inicial la define dirección al crear (todavía no existe un flujo de "primer acceso" donde la persona la elija ella misma — ver bitácora). La edición reemplaza la cartera asignada completa en una sola operación (`reemplazarCartera`), que cierra con `hasta` las asignaciones que ya no corresponden y abre filas nuevas en vez de mutarlas, para no perder el historial de quién llevó qué cliente y desde cuándo. 24 tests de módulo (dobles, con un flujo de 2FA real vía TOTP para dirección) + 8 de integración contra Postgres real.

  **Verificación:** `npm run verify` → exit 0, 12 OK / 4 pendientes declarados / 0 fallidos — hecho el 2026-07-23.
- [x] 84. Módulo Reglas Impositivas: edición de tasas de IVA (solo dirección). `GET /api/v1/reglas-impositivas` (cualquier rol), `POST` (alta: cierra automáticamente la vigente de la misma tasa un día antes de la nueva), `PATCH /:id` (edición de metadata — `nombre`, `fuente`, `requiereConfirmacionCliente`, `vigenteHasta` — nunca `tasa` ni `divisorIvaIncluido`, que reescribirían una fila que ya pudo usarse para calcular algo). **Hallazgo durante la construcción, documentado en `docs/DISCREPANCIAS.md` punto 9:** `@effort/core/iva.ts` tiene el divisor de IVA hardcodeado y ninguna ruta de la API llama todavía a sus funciones — la tabla `regla_impositiva` no está conectada a ningún cálculo real hoy. Editar una regla acá no cambia ningún número del sistema. 21 tests de módulo + 6 de integración.

  **Verificación:** `npm run verify` → exit 0, 12 OK / 4 pendientes declarados / 0 fallidos — hecho el 2026-07-23.
- [x] 85. Módulo Reglas de Notificación: alta/edición de reglas de recordatorio (ya tenía motor en `@effort/core/seguimiento.ts` desde la Parte 1.3, faltaba la ruta). `GET/POST /api/v1/reglas-notificacion`, `PATCH /:id`. RBAC de tres niveles ya existente: `direccion` crea y edita, `responsable` solo edita (no da de alta), `coordinador` solo mira, el resto de los roles no tiene acceso. Los destinatarios y la cartera alcanzada se guardan como columnas `Json`, validados en el borde con `destinatarioSchema` de `@effort/schema` (ya existía, con su `refine` de que ROL/USUARIO/CORREO_LIBRE exigen `valor`). El job que de verdad envía los avisos usando `planificarProximoRecordatorio` sigue siendo la Parte 6, todavía no construida — esta tarea solo persiste la configuración. 22 tests de módulo + 4 de integración.

  **Verificación:** `npm run verify` → exit 0, 12 OK / 4 pendientes declarados / 0 fallidos — hecho el 2026-07-23 (segundo intento; el primero falló por el problema intermitente de concurrencia contra Supabase ya documentado).
- [x] 86. Módulo Event Log: consulta filtrable del historial (solo dirección/revisor). `GET /api/v1/eventos`, con filtros por `usuarioId`, `entidad`, `entidadId`, `clienteId` y rango de fechas, más `limite`/`desplazamiento` para paginar — la tabla ya venía indexada exactamente para esas cuatro combinaciones desde la Parte 1.5. RBAC ya tenía el recurso `evento` con `ver` para `direccion`, `responsable` y `revisor_balance` únicamente. El filtro de cartera aplica igual que en el resto del sistema: un evento sin `clienteId` (un acceso, un cambio de tasa) solo lo ve quien tiene cartera completa. Es la primera vez que `RepositorioDeBitacora` gana un método de lectura — hasta ahora solo escribía. 6 tests de módulo + 6 de integración.

  **Verificación:** `npm run verify` → exit 0, 12 OK / 4 pendientes declarados / 0 fallidos — hecho el 2026-07-23.

**Verificación de cada módulo:** su propio test en verde antes de pasar al siguiente

---

### 4E — Clientes (alta y edición) (COMPLETA)

Tarea nueva, descubierta el 2026-07-24 al comparar la estructura de carpetas que Laura y Lili iban a preparar contra el sistema real: **no existía ninguna ruta para dar de alta un cliente.** Solo se podía listar y buscar uno ya cargado — sin esto, los 5 clientes piloto no se podían cargar de ningún modo, aunque EFFORT confirmara mañana mismo los datos. No estaba señalado como bloqueante en ningún lado hasta que se encontró leyendo el código repositorio por repositorio.

- [x] 87. Alta y edición de clientes (dirección y responsable). `GET/POST /api/v1/clientes`, `GET/PATCH /api/v1/clientes/:id`. Antes estas dos rutas GET vivían sueltas dentro de `rutas/contactos.ts` (quedó de cuando se armaron los primeros endpoints de contacto); se movieron a un archivo propio junto con las rutas nuevas de alta/edición, para que `clientes.ts` sea el único dueño del recurso. Todo campo es editable, incluido el RUC — a diferencia de reglas impositivas, ningún registro de documento, vencimiento o balance referencia el RUC o el nombre de un cliente, solo su `id`, así que corregir un RUC mal tipeado en la carga inicial no reescribe nada ya calculado. La asignación de responsable/coordinador/auxiliar/revisor por cliente sigue viviendo del lado del usuario (`reemplazarCartera`, tarea 83) — un solo lugar escribe `asignacion_cliente`. 21 tests de módulo + 6 de integración, más los tests preexistentes de `servidor.test.ts`/`siga.test.ts` adaptados al traslado de rutas.

  **Verificación:** `npm run verify` → exit 0, 13 OK / 3 pendientes declarados / 0 fallidos — hecho el 2026-07-24.

---

## PARTE 5 — Importadores desde OneDrive

- [x] 88. Registrar la aplicación en Azure AD — **cerrada el 2026-09-04.** Registro "EFFORT Control 360" creado, `Tenant ID`/`Client ID`/`Client Secret` cargados en `.env` y verificados con una llamada real a Microsoft (token Bearer). Permisos de aplicación agregados (`Files.ReadWrite.All`, `Mail.Send`) y consentimiento de administrador concedido por Daniel (la cuenta `effort360@effort.com.py` resultó ser la suya, ya Administrador Global). Verificado de punta a punta con una llamada real de solo lectura: `GET /v1.0/users/effort360@effort.com.py/drive/root/children` → `200 OK`. Detalle completo, incluido el diagnóstico del 404 intermedio (OneDrive de esa cuenta sin aprovisionar, no un problema de permisos), en `docs/DISCREPANCIAS.md`, punto 6. Pendiente no bloqueante: confirmar con EFFORT la carpeta raíz real a usar — el adaptador real (`DriveGraph`) todavía no está cableado contra una carpeta de producción, eso es trabajo de la Parte 5 en adelante.
- [x] 89. Implementar `packages/drive` — adaptador Microsoft Graph API + adaptador falso para tests. Puerto único `DriveDeArchivos` (`listar`/`leer`/`escribir`) con dos implementaciones: `DriveFalso` (en memoria, para tests) y `DriveGraph` (real, sin dependencias nuevas — usa `fetch` nativo de Node para el flujo OAuth2 de client credentials, documentado por Microsoft). `DriveGraph` sigue sin poder probarse de punta a punta porque la tarea 88 sigue bloqueada; sus 8 tests reemplazan `fetch` global y verifican que arma las peticiones correctas, no que Microsoft las acepte. 14 tests en total.

  **Corregido de paso:** el check `verify:drive` en `scripts/verify.mjs` invocaba `npm run verify:drive --workspace @effort/drive`, un comando que una sesión anterior escribió como placeholder (`pendiente: 'packages/drive todavía no existe.'`) sin poder probarlo porque el paquete no existía. Al crear el paquete se comprobó que ese comando falla (`vitest run --project drive` resuelve mal las rutas cuando corre con cwd en un subdirectorio del monorepo) — se cambió a `npx vitest run --project drive` desde la raíz, igual que todos los demás checks del archivo.

  **Verificación:** `npm run verify` → exit 0, 13 OK / 3 pendientes declarados / 0 fallidos — hecho el 2026-07-23 (segundo intento; el primero falló por el problema intermitente de concurrencia contra Supabase ya documentado). `verify:drive` deja de estar pendiente.
- [x] 90. Espejo automático hacia el OneDrive de respaldo, con manifiesto sha256. `espejarCarpeta()` en `packages/drive/src/espejo.ts`: copia archivos de una carpeta de origen a una de destino a través del mismo puerto `DriveDeArchivos` (funciona igual con `DriveFalso` o `DriveGraph`, sin distinguir cuentas). Escribe `manifiesto-espejo.json` en el destino con nombre/sha256/tamaño/fecha de cada archivo copiado. Idempotente: la segunda corrida sin cambios no llama a `escribir()` ni una vez (verificado con spy), porque compara el sha256 calculado contra el del manifiesto previo antes de subir. Un archivo nuevo en el origen solo sube ese archivo más el manifiesto actualizado; uno modificado se vuelve a subir con el sha256 nuevo; uno borrado del origen no se borra del destino (regla del proyecto: no se borra nada en OneDrive) — el manifiesto simplemente no lo vuelve a tocar. 7 tests nuevos en `packages/drive/test/espejo.test.ts`, cubiertos por el check `verify:drive` ya existente.

  **Verificación:** `npm run verify` → exit 0, 13 OK / 3 pendientes declarados / 0 fallidos — hecho el 2026-07-24.
- [x] 91. Importador de comprobantes (Excel/CSV) con reporte de filas aceptadas/rechazadas. Paquete nuevo `@effort/importers`, función `importarComprobantes(contenido, nombreArchivo)` en `packages/importers/src/comprobantes.ts`: parsea `.xlsx` (con `exceljs`) o `.csv` (con `csv-parse`) y devuelve un reporte — `aceptados: Comprobante[]` y `rechazados: {numeroFila, motivo, datosOriginales}[]` — sin escribir nada en la base a propósito (cablear contra `RepositorioDeDocumentos` queda para después de la tarea 93, modo simulación obligatorio). Cada fila acumula **todos** sus problemas en un solo motivo en vez de cortar en el primero, para que corregir una planilla no sea un ciclo de "subir, ver un solo error, corregir, repetir". Reutiliza `detectarDuplicados` de `@effort/core` para rechazar comprobantes repetidos dentro del mismo archivo (misma clave RUC+timbrado+número), con el motivo apuntando a la fila que se conservó. Total: celda numérica de Excel se acepta sin ambigüedad; celda de texto con separadores (`"150.000"`) se rechaza en vez de adivinar si el punto es de miles o decimal — regla money-safe. El layout de columnas es una suposición razonable, no confirmada por EFFORT (`docs/DISCREPANCIAS.md`, punto 10). 11 tests, cubiertos por el check `verify:importadores` nuevo.

  **Bug encontrado y corregido de paso:** `rucSchema` en `packages/schema/src/primitivos.ts` podía **lanzar una excepción sin capturar** en vez de fallar la validación — `safeParse('')` o cualquier RUC sin dígitos crasheaba, porque el `.refine()` con `calcularDigitoVerificadorRuc()` se ejecutaba igual aunque el `.regex()` anterior ya hubiera fallado (Zod no corta la cadena de checks). Afecta también al endpoint de alta de clientes (tarea 87), que usa el mismo `rucSchema`. Corregido revalidando el formato al inicio del `.refine()`; test de regresión agregado en `packages/schema/test/contratos.test.ts`.

  **Verificación:** `npm run verify` → exit 0, 14 OK / 3 pendientes declarados / 0 fallidos — hecho el 2026-07-24.
- [x] 92. Importador de exportaciones SIGA. `importarExportacionSiga(contenido, nombreArchivo)` en `packages/importers/src/siga.ts`, mismo patrón que la tarea 91: reporte de aceptados/rechazados, sin escribir en la base. La fila aceptada tiene exactamente la forma de `FilaSigaEntrante` (`apps/api/src/puertos-dominio.ts`) — `rucEmisor`, `timbrado`, `numeroComprobante`, `total: bigint`, `tasa`, `anulado`, `fecha: Date` — lista para pasarla a `RepositorioDeExportacionesSiga.registrar()` el día que se cablee. A diferencia del importador de comprobantes, una fila SIGA no tiene columna de Tipo ni de Origen: el reporte exportado ya es "libro de compras" o "libro de ventas" entero, esa distinción va en `tipoReporte` al registrar la exportación, no fila por fila. Duplicados dentro del archivo se detectan reusando `detectarDuplicados` de `@effort/core` sobre una vista sintética con `tipo`/`origen` fijos (mismo truco que ya usa `filaSigaAComprobante` en `apps/api/src/rutas/siga.ts` para poder pasar filas SIGA por `conciliarConSiga`) — importa porque `conciliarConSiga` indexa por clave natural en un `Map`, y dos filas SIGA con la misma clave se pisarían en silencio si el importador no las separa antes. Layout de columnas asumido, sin confirmar (`docs/DISCREPANCIAS.md`, punto 11).

  **Refactor de paso:** las utilidades de lectura de archivo (Excel/CSV → filas crudas con número de fila real, parseo de celdas de fecha/importe/texto, detección de fila vacía) se extrajeron de `comprobantes.ts` a `packages/importers/src/archivo.ts`, compartidas por los dos importadores. Se verificó que los 11 tests de comprobantes siguieran en verde después del refactor antes de escribir el importador de SIGA encima.

  **Verificación:** `npm run verify` → exit 0, 14 OK / 3 pendientes declarados / 0 fallidos — hecho el 2026-07-24 (segundo intento; el primero falló por el problema intermitente de concurrencia contra Supabase ya documentado).
- [x] 93. Modo simulación (`dry-run`) obligatorio antes de escribir en la base. Dos rutas nuevas cablean por primera vez los importadores de las tareas 91/92 contra los repositorios reales: `POST /api/v1/clientes/:clienteId/documentos/importar` y `POST /api/v1/clientes/:clienteId/siga/importar`. Las dos reciben `contenidoBase64` + `nombreArchivo` (el archivo viaja en el cuerpo JSON, como ya hace el resto de la API, no como upload multipart — no había ninguna dependencia nueva que justificar para esto) y un campo `modo: 'simulacion' | 'real'` **sin default**: omitirlo es un 400 de validación, no una decisión tácita de qué modo correr. `simulacion` corre el importador y devuelve el reporte de aceptados/rechazados sin tocar la base; `real` además persiste. RBAC reusa los permisos `documento.crear` / `exportacion_siga.crear` que ya existían — es la misma acción de siempre, solo que en lote desde un archivo en vez de fila por fila a mano.

  Para comprobantes hizo falta traducir el `tipo`+`origen` del dominio de `@effort/core` (que no distingue FACTURA_COMPRA de FACTURA_VENTA) al `tipoDocumentoSchema` de la API (que sí) — función `tipoDocumentoDesdeComprobante()` en `apps/api/src/rutas/documentos.ts`. `recibidoEn` se completa con `deps.ahora()` (el momento de la importación) y `canalRecepcion: 'ONEDRIVE'`, no con la fecha propia del comprobante: el modelo `Documento` solo tiene un campo de fecha de recepción, no uno separado para la fecha del comprobante, y el canal `ONEDRIVE` ya existía en el enum desde la Parte 1.4 para exactamente este caso.

  **Asimetría real entre los dos importadores, no ocultada:** `RepositorioDeDocumentos.registrar()` inserta un documento a la vez, sin transacción que envuelva el lote — una falla a mitad de una importación grande deja algunas filas persistidas y otras no. `RepositorioDeExportacionesSiga.registrar()`, en cambio, ya inserta el lote entero en una sola transacción (tarea 74). Arreglar esa asimetría exige agregar un método de alta en lote al puerto `RepositorioDeDocumentos` — un cambio de contrato más grande que "agregar el gate de simulación", así que no se resuelve acá. **No queda como límite permanente:** es exactamente el mismo trabajo que pide la tarea 94 (restricción única + inserción en lote con `skipDuplicates`, mismo patrón que ya usa SIGA desde la tarea 74) — se resuelven juntos en esa tarea, no como dos cambios separados.

  **Hallazgo al escribir esto:** la idempotencia de la tarea 94 **ya está resuelta para SIGA** desde la tarea 74 — `comprobante_siga` tiene una restricción única por (cliente, período, RUC, timbrado, número) y `registrar()` inserta con `skipDuplicates: true`; reimportar el mismo archivo crea una nueva fila de auditoría en `exportacion_siga` pero no duplica ningún comprobante. Verificado con test. Para `documento`, en cambio, no hay ninguna restricción de unicidad en el modelo Prisma — reimportar el mismo archivo de comprobantes en modo `real` sí duplica hoy. La tarea 94 se reduce entonces a cerrar esa mitad.

  14 tests nuevos en `apps/api/test/importaciones.test.ts`, cubiertos por el check `verify:importaciones` nuevo.

  **Vulnerabilidad de `npm audit` sin relación con esta tarea:** el 2026-07-24, sin cambiar ninguna dependencia, `npm audit --audit-level=high` pasó de 0 a 14 vulnerabilidades altas por un aviso recién publicado (`brace-expansion`, GHSA-mh99-v99m-4gvg) que no es explotable en cómo se usan `eslint` (no corre, check `pendiente`) ni `exceljs` (el código de producción solo lee `.xlsx`, nunca escribe). No hay fix sin *breaking changes* todavía publicado por upstream. Se documentó como excepción conocida en `docs/DISCREPANCIAS.md`, punto 12, en vez de forzar un downgrade de `exceljs` o silenciar el umbral del check — **el check `audit` queda en rojo a propósito** desde esta tarea.

  **Verificación:** `npm run verify` → exit 1 (**1 fallido: `audit`, excepción conocida y documentada — ver `docs/DISCREPANCIAS.md` punto 12**), 14 OK / 3 pendientes declarados — hecho el 2026-07-24.
- [x] 94. Idempotencia verificada: importar el mismo archivo dos veces no duplica.

  **Corrección importante sobre lo que decía la tarea 93:** ahí quedó anotado "para `documento` no hay restricción de unicidad — ahí sí duplica hoy". **Eso era falso.** Al ponerse a resolverlo, `apps/api/test/integracion/dominio.test.ts` ya tenía desde antes un test — `'la base impide cargar dos veces el mismo comprobante del mismo cliente'` — que probaba exactamente lo contrario, y pasaba. Se confirmó consultando `pg_indexes` directo contra la base real de Supabase: el índice único `documento_cliente_id_ruc_emisor_timbrado_numero_comprobante_key` sobre `(cliente_id, ruc_emisor, timbrado, numero_comprobante)` existe desde la migración inicial (`20260722110319_init`). Lo único real que faltaba era que `RepositorioDeDocumentos.registrar()` inserta de a una fila, así que reimportar un archivo con `real` **no duplicaba — crasheaba** con un error de Postgres sin capturar en medio del lote (la restricción ya frenaba el duplicado, pero de la forma más brusca posible: tumbando la petición y dejando las filas previas del lote ya insertadas, las siguientes no). Queda como recordatorio: no asumir que algo "falta" solo porque no se lo ve en el código que se acaba de escribir — hay que buscarlo antes de declararlo ausente. (Ver bitácora para el detalle completo de cómo se verificó.)

  **Lo que sí hizo falta y se hizo:**
  - `schema.prisma`: se le había puesto `name: "comprobante_unico"` a ese `@@unique` sin migrar el rename, así que el schema y la base real tenían nombres de índice distintos (`prisma migrate status` lo habría marcado como drift la primera vez que alguien corriera una migración nueva). Se sacó el `name:` explícito para que Prisma vuelva a su nombre por defecto, que es el que ya existe en la base — **cero migración nueva, cero cambio de estructura**, solo se corrigió lo que el archivo decía.
  - `RepositorioDeDocumentos` (puerto en `puertos-dominio.ts`) ganó `registrarLote()`: una sola sentencia (`createManyAndReturn` con `skipDuplicates: true`) que inserta todo el lote de una vez, salteando en silencio lo que ya existía. Implementado en `DocumentosPrisma`, replicado en el doble `DocumentosFalsos` (mismo criterio: NULL nunca colisiona con NULL, así que los documentos sin RUC/timbrado/número —contratos, actas— nunca se consideran duplicados entre sí, sin importar cuántos haya).
  - La ruta `POST /api/v1/clientes/:clienteId/documentos/importar` (tarea 93) pasó de un `for` llamando a `registrar()` fila por fila a una sola llamada a `registrarLote()`. Esto también resuelve de paso la falta de atomicidad que había quedado anotada en la tarea 93: ahora es una sola sentencia, no puede quedar una importación grande a medio insertar.
  - SIGA no necesitó ningún cambio: ya estaba resuelto desde la tarea 74.

  8 tests nuevos: 5 a nivel de ruta (`apps/api/test/importaciones.test.ts` — reimportar no duplica ni revienta, un lote con una fila nueva y una repetida solo persiste la nueva, documentos sin terna no chocan entre sí) y 2 de integración contra Postgres real (`registrarLote` salta duplicados sin lanzar, y varios documentos sin terna en el mismo lote se insertan todos).

  **Verificación:** `npm run verify` → 14 OK / 3 pendientes declarados / **1 fallido (`audit`, excepción documentada desde la tarea 93 — ver `docs/DISCREPANCIAS.md` punto 12, sin relación con esta tarea)** — hecho el 2026-07-28 (un intento intermedio falló por el mismo problema intermitente de conectividad contra Supabase de siempre, esta vez en el `afterAll` de limpieza — los 102 tests reales habían pasado; reintentado y confirmado en verde).

**Verificación:** `npm run verify:drive` → exit 0 contra el adaptador real (o falso si Azure AD no está listo)

---

## PARTE 6 — Despachador de notificaciones

- [ ] 95. Proveedor de envío de correo (a definir: Resend, SES, o el que EFFORT prefiera)
- [ ] 96. Job programado que corre `planificarProximoRecordatorio` sobre todas las solicitudes abiertas
- [ ] 97. Registro automático en `registro_contacto` con `origen=AUTOMATICO` por cada envío real
- [ ] 98. Registro en `envio_notificacion` con el id del proveedor, para poder auditar contra su panel
- [ ] 99. Manejo de fallos de envío (reintento, alerta a dirección si un correo rebota)

**Verificación:** test de integración con proveedor de correo en modo sandbox

---

## PARTE 7 — Interfaz completa contra la API real

- [x] 100. Cliente HTTP tipado en `apps/web`, con manejo de sesión/CSRF.

  **Decisión previa:** `apps/web` era JavaScript puro (`.jsx`, sin TypeScript), a diferencia del resto del monorepo (TS estricto en `core`, `schema`, `api`, `drive`, `importers`). Un cliente HTTP genuinamente "tipado" necesita TS de verdad, no JSDoc — se convirtió `apps/web` a TypeScript ahora (tooling: `tsconfig.json`, `vite.config.ts`, script `typecheck`) en vez de esperar a las 12 pantallas de la tarea 104, cuando reconvertir hubiera tocado mucho más código. La demo original (`App.jsx` y sus componentes) sigue en `.jsx` sin tocar — `allowJs`+`checkJs:false` los deja compilar sin exigirles tipos, hasta que la tarea 105 los retire.

  **El cliente en sí:** `apps/web/src/api/cliente.ts` — `peticion<T>(metodo, ruta, cuerpo?, query?)` maneja sesión (`credentials: 'include'`, la cookie es `httpOnly` así que el navegador la lleva sola) y CSRF (token de `GET /api/v1/csrf`, cacheado en memoria, con un reintento automático si el servidor lo rechaza con 403 — puede vencer o cerrarse sesión en otra pestaña). Los errores del servidor (`{error, mensaje, peticionId?}`) se traducen a una clase `ErrorDeApi` en vez de inventar una forma nueva del lado del cliente. `apps/web/src/api/autenticacion.ts` cablea las cuatro rutas de acceso (`iniciarAcceso`, `confirmarSegundoFactor`, `cerrarSesion`, `obtenerSesionActual`) como primer caso de uso real — `obtenerSesionActual()` devuelve `null` en un 401 en vez de lanzar, porque "no hay sesión" es el caso esperado al cargar la app, no un error.

  11 tests nuevos (`apps/web/test/`), con `fetch` global mockeado — no hace falta un servidor real para probar la caché del token, el reintento ante un 403, o el mapeo de errores. Nuevo proyecto `web` en `vitest.config.ts` y dos checks nuevos en `scripts/verify.mjs` (`verify:web-typecheck`, `verify:web`).

  **Hallazgo real encontrado en el camino (no es parte de esta tarea, va en un commit aparte):** el CSRF double-submit de la tarea 39 (Parte 1, marcada completa) nunca estuvo aplicado a ninguna ruta — ver bitácora del 2026-07-28. Se corrigió antes de seguir, porque un cliente que maneja CSRF contra un servidor que no lo exige no se puede probar de verdad.

  **Verificación:** `npm run verify` → 16 OK / 3 pendientes declarados / **1 fallido (`audit`, excepción documentada desde la tarea 93, sin relación con esta tarea)** — hecho el 2026-07-28 (dos intentos intermedios fallaron por el problema intermitente de conectividad contra Supabase de siempre, en `test:unit` al correr todos los proyectos juntos; reintentado y confirmado en verde).
- [x] 101. Módulo Solicitudes de Documentación: rutas + repositorio Prisma. Tarea nueva, descubierta el 2026-08-20 al empezar la 101 (reemplazar `datos-semilla/`): `Seguimiento.jsx` depende de cuatro cosas de semilla — clientes, contactos, reglas de notificación y **solicitudes de documentación** — y de esas cuatro, `SolicitudDocumentacion` tenía el modelo en `schema.prisma` desde el principio pero **cero rutas y cero repositorio**, exactamente el mismo patrón que la tarea 87 encontró para clientes. `GET /api/v1/solicitudes-documentacion?periodo=` (radar de toda la cartera para un período, es la vista de la pantalla de seguimiento), `GET /api/v1/clientes/:clienteId/solicitudes-documentacion`, `POST /api/v1/clientes/:clienteId/solicitudes-documentacion` (abre el seguimiento de un período; `registrar()` usa `upsert` por `(clienteId, periodo)` así que abrir el mismo período dos veces no duplica ni pisa el progreso ya hecho), `POST /api/v1/solicitudes-documentacion/:id/cerrar` (ENTREGADA o CERRADA_MANUALMENTE, con guarda de "ya está cerrada" igual que `vencimientos/:id/presentar`). RBAC nuevo: recurso `solicitud`, dirección/responsable con `ver/crear/cerrar/exportar`, coordinador `ver/crear/cerrar`, auxiliar/revisor_balance/solo_lectura solo `ver` — el motor que interpreta estas solicitudes (`planificarProximoRecordatorio`) ya existe en `@effort/core/seguimiento.ts` desde la Parte 1.3, esta ruta solo abre y cierra el seguimiento; el job que envía los recordatorios de verdad sigue siendo la Parte 6. 7 tests de módulo (dobles) + 4 de integración contra Postgres real (upsert no duplica, reabrir no pisa el progreso, filtro de cartera, alcance de `buscarPorId`).

  **Verificación:** `npx vitest run apps/api/test/modulos.test.ts apps/api/test/rbac.test.ts` → exit 0 (110 tests). `npx tsc --build` → exit 0. Los 4 tests de integración nuevos no se pudieron correr contra Postgres real de entrada: Supabase seguía inalcanzable con el mismo `ENOTFOUND` del punto 15 de `docs/DISCREPANCIAS.md`. **Cerrado horas más tarde, mismo día:** el proyecto de Supabase estaba pausado (confirmado en el dashboard); Daniel lo reanudó y, tras un par de minutos de propagación, `npx vitest run --project integracion` corrió **106/106 en verde**, incluidos los 4 de `SolicitudesPrisma`. `npm run verify` completo → 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre, sin relación). Ver `docs/DISCREPANCIAS.md` punto 15, cerrado.

- [x] 102. Reemplazar `datos-semilla/` por llamadas reales a la API. Alcance real: `Seguimiento.jsx` era la única pantalla ya construida (`Acceso.tsx` no usa datos de semilla). Reescrita como `Seguimiento.tsx` contra los cuatro endpoints reales: `GET /api/v1/clientes`, `GET /api/v1/solicitudes-documentacion?periodo=`, `GET /api/v1/reglas-notificacion`, `GET /api/v1/clientes/:id/contactos?periodo=` (uno por cada cliente con solicitud en el período — a escala del piloto de 5 clientes es razonable; una cartera mucho más grande necesitaría un endpoint de contactos por período de toda la cartera, que no existe todavía). Carpeta `apps/web/src/datos-semilla/` eliminada por completo. Clientes nuevos en `apps/web/src/api/`: `clientes.ts`, `contactos.ts`, `reglasNotificacion.ts`, `solicitudes.ts`, mismo patrón que `autenticacion.ts` (tarea 100) — tipos de respuesta a mano, sin generación automática desde el schema del servidor. El "período activo" ya no es una constante de semilla: se calcula con `hoyEnParaguay(new Date())` en el navegador. La ficha de cliente ya no muestra responsable/coordinador (la semilla los inventaba; el modelo real de `Cliente` no los tiene — esa asignación vive en `asignacion_cliente`, del lado del usuario, no del cliente — traerla es trabajo de la tarea 104, no de esta).

  **Hallazgo de paso, corregido:** `Boton` (`apps/web/src/ui/Primitivos.jsx`) no tenía tipo para `icono` — al ser `.jsx` sin JSDoc, TypeScript infería su tipo desde el valor por defecto (`null`) y rechazaba pasarle cualquier ícono real desde un archivo `.tsx`. No se había notado porque `Acceso.tsx` (la única pantalla TS anterior) nunca le pasó `icono`. Agregado un JSDoc de tipos a `Boton` con el resto de props tipado como `ButtonHTMLAttributes<HTMLButtonElement>` para no romper los usos existentes que dependen del spread (`type`, `disabled`, etc.).

  **Verificación:** `npm run typecheck --workspace @effort/web` → exit 0. `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (22 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores de consola y muestra el login (`Acceso`) — no se pudo llegar a `Seguimiento` con datos reales porque el backend necesita conectar a Supabase para arrancar (`comprobarConexion` en `apps/api/src/index.ts`), y Supabase seguía caído en ese momento (mismo problema que la tarea 101, resuelto horas más tarde — ver abajo). Sin tests automatizados propios para `Seguimiento.tsx` todavía — pantalla de solo lectura por ahora, se cubre con el mismo patrón de `Acceso.test.tsx` cuando se construya su primera interacción real (tarea 104). **Sigue sin verse con datos reales en el navegador** incluso después de que Supabase volvió: no hay ningún usuario ni cliente piloto sembrado todavía en el esquema `public` (tareas 56/57, bloqueadas esperando confirmación de EFFORT) — no es un problema de código, es falta de datos de carga.

  `npm run verify` → 14 OK / 3 pendientes declarados / **3 fallidos**: `test:unit` y `test:integration` (Supabase inalcanzable, punto 15) y `audit` (excepción documentada, puntos 12 y 14) — ninguno relacionado con esta tarea ni con la 101, mismo patrón que la tarea 103 (login) dejó documentado el 2026-08-10. **Punto 15 cerrado el mismo día** (ver tarea 101 y `docs/DISCREPANCIAS.md`): con Supabase reanudado, `npm run verify` completo vuelve a 16 OK / 3 pendientes / 1 fallido (solo `audit`).

- [x] 103. Pantalla de login con flujo de 2FA en dos pasos. **Construida antes que la 102 (reemplazar datos-semilla)** — ver bitácora del 2026-07-30: sin login no hay sesión real contra la cual probar llamadas a la API, así que esa tarea se hace después de esta.

  **Contexto de sesión** (`apps/web/src/contexts/SesionContext.tsx`): `sesion` es `undefined` mientras se confirma si ya hay sesión activa, `null` si no la hay. El paso 2FA deja un hueco a propósito — entre el paso 1 y el paso 2 el servidor ya tiene una sesión creada pero `segundoFactorSuperado: false`, y `evaluarSesion()` no la deja pasar por `GET /api/v1/yo` — verificado leyendo `apps/api/src/seguridad/sesiones.ts` antes de asumir cómo se comportaba, no adivinado.

  **La pantalla** (`apps/web/src/pantallas/Acceso.tsx`): paso 1 (correo + contraseña) → paso 2 (código, solo si `segundoFactorRequerido`). El servidor ya redacta mensajes listos para mostrar — la pantalla no reinterpreta errores, los muestra tal cual, excepto `sin_sesion` en el paso 2 (la sesión intermedia venció), que vuelve al paso 1 con un mensaje propio. Primitivos nuevos en `ui/Primitivos.jsx` (`CampoTexto`) reusando los tokens de marca ya existentes.

  **Dos bugs reales encontrados construyendo esto, no antes de escribir código:**
  1. `<ProveedorDeSesion>` no capturaba el rechazo de `obtenerSesionActual()` en su `useEffect` inicial — un fallo de red al cargar la página (servidor caído, sin conexión) dejaba la pantalla en "Cargando…" para siempre, sin salida. Encontrado recién al verificar en el navegador real sin el backend corriendo (no lo hubiera mostrado ningún test con `fetch` mockeado, porque el mock nunca "falla" a menos que se le pida). Corregido con un `.catch(() => null)`, con test de regresión.
  2. Mock de tests con cola global (`mockResolvedValueOnce` encadenado) — una sola promesa que se resuelve un instante tarde le "roba" la respuesta al test siguiente, corriendo la cola para todo lo que viene después con fallas que no tienen nada que ver con el test que las muestra. Reescrito para enrutar por `(método, ruta)` en vez de por orden de llegada — mismo patrón se reusa para las 12 pantallas de la tarea 104.

  **Tooling de tests para pantallas, nuevo:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` — permiso pedido explícitamente antes de instalar. `jsdom@30` no sirve con la versión de Node de esta máquina (pide 24.15+, hay 24.14) — se fijó `jsdom@^29.1.1`. El proyecto `web` de `vitest.config.ts` necesitó el plugin `@vitejs/plugin-react` (el mismo que ya usa `apps/web/vite.config.ts`): sin él, el JSX de los `.jsx` que usan el runtime automático (sin `import React`) no se transforma igual en los tests que en `vite build`, y revienta con "React is not defined" apenas se monta el primer componente `.jsx`.

  22 tests nuevos (`apps/web/test/Acceso.test.tsx`). `main.tsx` (renombrado desde `main.jsx`) ahora monta `<Aplicacion>`, que decide entre "Cargando…", `<Acceso>` o la pantalla real según el estado de la sesión.

  **Verificado en el navegador real** (no solo con tests mockeados): con el backend apagado a propósito, el login se muestra igual (confirma el fix del bug 1) y, al intentar entrar, aparece el mensaje real de error de conexión — sin ninguna excepción sin capturar en la consola.

  **Verificación:** `npm run verify` → 14 OK / 3 pendientes declarados / **3 fallidos** — hecho el 2026-08-10. Ninguno de los tres tiene que ver con esta tarea: `audit` es una excepción nueva documentada (`docs/DISCREPANCIAS.md`, punto 14, Prisma/`deepmerge-ts`); `test:unit` y `test:integration` fallan porque el proyecto de Supabase parece estar pausado (`docs/DISCREPANCIAS.md`, punto 15) — confirmado que no es el problema intermitente de siempre (el DNS resuelve bien, pero Supabase dice no reconocer el proyecto). El resto de los checks, incluidos los 22 tests nuevos de esta tarea, pasó en verde.
- [x] 104. Las 12 pantallas del handoff, una por una, contra datos reales. No hay un documento de handoff en el repo (vive fuera de git); la lista se infirió de los módulos de API ya construidos y se confirmó con Daniel antes de empezar. Orden acordado: Seguimiento (ya hecha, tarea 102) → **Clientes** → Documentos/IVA → Vencimientos → Balances → SIGA → Liquidaciones → Alertas → Equipo → Reglas → Eventos → Panel general (al final, porque agrega los demás módulos).

  **2026-08-20 — Pantalla Clientes (2 de 12) construida.** `apps/web/src/pantallas/Clientes.tsx`: listado con búsqueda por nombre/RUC y filtro "solo activos", alta y edición completas para `direccion`/`responsable` (RBAC ya lo distinguía en el servidor; acá solo se refleja: el resto de los roles ve la cartera pero no el botón de alta ni el de editar). Cliente HTTP nuevo `apps/web/src/api/clientes.ts` ampliado con `crearCliente`/`actualizarCliente`. Los campos vacíos del formulario se mandan como `null`, no como cadena vacía — el servidor los guarda así.

  **De paso, antes de que se repitiera diez veces más:** con una segunda pantalla real apareció la necesidad de navegación — cada pantalla dibujaba su propio `<header>` con el logotipo. Se extrajo `apps/web/src/layout/Encabezado.tsx`, compartido, con la navegación entre pantallas y el botón de cerrar sesión (no existía ningún botón para cerrar sesión en toda la interfaz hasta ahora). `Seguimiento.tsx` se ajustó para dejar de dibujar su propio encabezado. También se agregó `CampoSelect` a `Primitivos.jsx` (mismo contrato que `CampoTexto`) porque casi todas las pantallas que faltan van a necesitar selects (tipo de documento, estado, canal).

  **Hallazgo de paso, no corregido a propósito:** `clienteSchema` en `packages/schema/src/entidades.ts` (tarea 28, Parte 1.4) declara `responsableId`/`coordinadorId`/`auxiliarId`/`revisorBalanceId` como si fueran columnas del cliente. El modelo real de Prisma no los tiene — esa asignación vive en `AsignacionCliente` (tarea 83), del lado del usuario. Ese schema nunca se usa en `apps/api/src/rutas/clientes.ts` (que define sus propios `altaSchema`/`edicionSchema` locales), así que no rompe nada hoy, pero es una fuente de verdad falsa si alguien la lee para entender el modelo. Mismo patrón que el hallazgo de `regla_impositiva` del punto 9 de `docs/DISCREPANCIAS.md`. Queda anotado acá para cuando alguien reordene `packages/schema`, no se toca ahora porque no bloquea esta tarea.

  **Tests nuevos:** 8 en `apps/web/test/Clientes.test.tsx` (listado, filtro de activos, búsqueda, RBAC de botones, alta, RUC duplicado con el mensaje del servidor tal cual, precarga de edición, cancelar sin llamar al servidor). El mock de `fetch` por `(método, ruta)` de `Acceso.test.tsx` se extrajo a `apps/web/test/ayuda-fetch-mock.ts`, compartido, para no reescribirlo en cada una de las 10 pantallas que faltan.

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (30 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle sigue cargando sin errores y mostrando el login. `npm run verify` → 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre, sin relación).

  **2026-08-20 — Pantalla Documentos/IVA (3 de 12) construida.** `apps/web/src/pantallas/Documentos.tsx`, dos tableros apilados: **Proceso mensual** (una fila por cliente activo del período elegido — el que no tiene fila todavía se muestra igual, marcado "Sin iniciar": guardar el panel de edición lo crea al vuelo, mismo `asegurar()` que ya usaba el servidor) y **Documentos** del cliente seleccionado en esa fila, con alta y cambio de estado (marcar cargado en SIGA, observar, rechazar — rechazar pide el motivo, que el servidor exige). Cliente HTTP nuevo `apps/web/src/api/documentos.ts`. El período es editable (input de texto `AAAA-MM`, con el mismo cálculo de "período activo" que ya usaba Seguimiento como valor por defecto) porque a diferencia de Clientes, estos dos módulos son por período. Importes (`total`, `ivaSaldoAPagar`, `ivaSaldoAFavor`) formateados con `gs()`/`formatearGs()` de `@effort/core`, nunca a mano — y la regla de negocio de que un período no puede tener saldo de IVA a pagar y a favor a la vez se muestra como advertencia en el formulario, aunque la valide el servidor.

  RBAC reflejado tal cual el servidor ya lo tenía: `direccion`/`responsable`/`coordinador`/`auxiliar` editan el proceso mensual y dan de alta documentos; cambiar el estado de un documento (SIGA/observar/rechazar) es solo para `direccion`/`responsable`/`coordinador` — `auxiliar` puede cargar documentos pero no decidir su estado. `revisor_balance`/`solo_lectura` solo miran.

  **Vencimiento nuevo agregado a `Encabezado.tsx`** ("Documentos / IVA"), tercer enlace de la navegación compartida.

  **Tests nuevos:** 10 en `apps/web/test/Documentos.test.tsx` (tablero con "Sin iniciar", formateo de IVA, selección de fila carga documentos, formulario vacío al abrir un cliente sin proceso, RBAC del panel de edición y de los botones de estado, guardado del proceso con el saldo de IVA como texto, cambio de estado a SIGA, rechazo con motivo vía `window.prompt`, cancelar el rechazo sin motivo no llama al servidor). El período de las pruebas se calcula con la misma `hoyEnParaguay(new Date())` que usa la pantalla, para no depender de una fecha fija que se desactualice.

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (40 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores. `npm run verify` → 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre, sin relación) — el primer intento marcó `test:unit` en rojo por el problema intermitente de concurrencia ya documentado varias veces en esta bitácora; reintentado solo (`npx vitest run`, 600/600) y confirmado en verde antes de repetir `npm run verify` completo.

  **Quedan 9 pantallas.** Próxima: Vencimientos.

  **2026-08-20 — Pantalla Vencimientos (4 de 12) construida.** `apps/web/src/pantallas/Vencimientos.tsx`: el radar completo de la cartera, ordenado por fecha, con días restantes y nivel de alerta que manda el servidor ya calculados en zona Paraguay — la pantalla no recalcula nada. Alta de vencimiento (con selector de cliente, a diferencia de Documentos que ya tenía un cliente elegido) y acción "Presentar" por fila, que pide la fecha con `window.prompt` y llama a `POST /api/v1/vencimientos/:id/presentar`. RBAC: `direccion`/`responsable`/`coordinador` editan, `auxiliar`/`revisor_balance`/`solo_lectura` solo miran — mismo patrón que ya venían mostrando las pantallas anteriores.

  **Antes de que se triplicara:** `TipoDocumento` (compartido con Documentos) y `NivelRiesgo` (compartido con Proceso Mensual) estaban declarados dos veces cada uno. Se extrajeron a `apps/web/src/api/tipos-compartidos.ts`, y las etiquetas/tonos de badge correspondientes a `apps/web/src/ui/etiquetas.ts` — `Documentos.tsx` se ajustó para importarlas de ahí en vez de tener su propia copia.

  **Tests nuevos:** 6 en `apps/web/test/Vencimientos.test.tsx` (radar con días/alerta del servidor, resumen por nivel, RBAC de los botones, alta con selector de cliente, presentar con `window.prompt`, cancelar el prompt no llama al servidor).

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (46 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores. `npm run verify` → 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre, sin relación).

  **Quedan 8 pantallas.** Próxima: Balances.

  **2026-08-20 — Pantalla Balances (5 de 12) construida.** La más sensible de las doce: por el ADR 0004 (`docs/adr/0004-el-sistema-no-aprueba-balances.md`) el sistema nunca aprueba un balance solo. `apps/web/src/pantallas/Balances.tsx`: tablero cartera-wide del período (mismo patrón "Sin iniciar" que Documentos y Vencimientos), panel de cifras (balance general + estado de resultados) que al guardar (`PUT`) devuelve y muestra la revisión (`bloqueantes`/`advertencias`/`inconsistencias`) sin esperar a un recargado, y un checklist con el botón "Aprobar balance". Ese botón: **(a)** solo aparece para `direccion`/`revisor_balance` (RBAC del servidor, `balance.aprobar`), **(b)** queda deshabilitado si el balance no está en `LISTO_PARA_REVISION` o si tiene algún bloqueante, y **(c)** pide una confirmación explícita (`window.confirm`, nombra al cliente, el período y que la acción "queda registrada con tu nombre y la fecha") antes de llamar al servidor. Ninguna de las tres es la que de verdad protege la regla — eso lo hacen las cuatro capas del servidor que ya describe el ADR — son un cinturón de seguridad extra del lado de la UI para que un clic apurado no dispare la llamada.

  Si se edita un balance ya `APROBADO`, se muestra una advertencia explícita ("guardar cifras nuevas lo va a sacar de aprobado") en vez de dejarlo pasar en silencio — el servidor ya permitía este re-guardado desde antes de esta tarea (no es un comportamiento nuevo, `guardarCifras()` hace `upsert` sin comprobar el estado previo), la pantalla solo lo hace visible.

  Cliente HTTP nuevo `apps/web/src/api/balances.ts`. Los ocho códigos de inconsistencia (`ECUACION_PATRIMONIAL_NO_CIERRA`, `DOCUMENTOS_FALTANTES`, etc., de `@effort/core/balance.ts`) tienen su propia frase legible en español; la diferencia numérica, cuando la trae la inconsistencia, se formatea con `gs()`/`formatearGs()`.

  **Tests nuevos:** 9 en `apps/web/test/Balances.test.tsx`, con foco explícito en el ADR: RBAC del botón de aprobar por rol, deshabilitado con bloqueantes aunque el rol pueda aprobar, cancelar la confirmación no llama al servidor, confirmar sí la llama, guardar cifras manda los importes como texto y muestra el checklist que devuelve el `PUT`.

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (55 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores. `npm run verify` → 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre, sin relación).

  **Quedan 7 pantallas.** Próxima: SIGA / Conciliación.

  **2026-08-20 — Pantalla SIGA/Conciliación (6 de 12) construida.** `apps/web/src/pantallas/Siga.tsx`. A diferencia de las pantallas anteriores, acá no hay un endpoint cartera-wide (`GET /api/v1/clientes/:id/siga` es por cliente) — la pantalla arranca con un selector de cliente en vez de un tablero de toda la cartera. Dos partes: **importar** (archivo → `modo: 'simulacion'` primero, que solo lee y muestra el reporte de aceptados/rechazados sin persistir nada; recién "Confirmar importación" manda el mismo archivo con `modo: 'real'` — el paso de simulación no se puede saltear porque el botón de confirmar solo aparece después de simular) y **conciliación** (de solo lectura: qué falta cargar en SIGA, qué está en SIGA sin respaldo documental, y las diferencias de monto — todo lo calcula `conciliarConSiga` de `@effort/core`, la pantalla solo muestra el resultado).

  El archivo se lee en el navegador con `FileReader.readAsDataURL()` y se manda como `contenidoBase64` en el cuerpo JSON, mismo criterio que ya usa la API desde la tarea 93 (sin subir `@fastify/multipart` como dependencia nueva). Helper nuevo `archivoABase64()` en `apps/web/src/api/siga.ts`.

  **Tests nuevos:** 5 en `apps/web/test/Siga.test.tsx`, con `FileReader` mockeado (jsdom no lo implementa completo) — cubren el reporte de simulación con aceptados/rechazados, que confirmar manda el mismo archivo con `modo: 'real'`, RBAC del formulario de importación, y que la conciliación con diferencias las muestra formateadas.

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (60 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores. `npm run verify` → 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre, sin relación).

  **Quedan 6 pantallas.** Próxima: Liquidaciones.

  **2026-08-22 — Pantalla Liquidaciones (7 de 12) construida.** `apps/web/src/pantallas/Liquidaciones.tsx`: ciclo generada → enviada → respondida, cartera-wide por período (mismo patrón que Vencimientos). Un panel compartido cambia entre tres formularios según la acción (alta, registrar envío, registrar respuesta) — "Enviar" solo aparece si la liquidación no está ya enviada/respondida, "Respuesta" solo si ya se envió o fue reclamada, mismo guardado de estados que ya hacía cumplir el servidor. Cliente HTTP nuevo `apps/web/src/api/liquidaciones.ts`.

  **De paso:** `CanalRecepcion` (WhatsApp/Correo/OneDrive/Físico/Sistema) estaba declarado por segunda vez en `api/documentos.ts` con otro nombre (`CanalRecepcionDocumento`). Se movió a `api/tipos-compartidos.ts` junto con `TipoDocumento`/`NivelRiesgo`; `documentos.ts` y `clientes.ts` ahora lo re-exportan en vez de declararlo cada uno por su cuenta.

  **Tests nuevos:** 7 en `apps/web/test/Liquidaciones.test.tsx` (estado por liquidación, envío con fecha/canal/destinatario, RBAC de las tres acciones, alta, envío, respuesta). Encontrado en el camino: `getByRole('button', { name: /Enviar/ })` fallaba porque el botón usa `aria-label` ("Marcar enviada...", con minúscula) y ese atributo pisa por completo el texto visible del botón para el nombre accesible — el regex tenía que apuntar al `aria-label` real, no al texto que se ve. Encontrado también: `userEvent.type()` sobre un `<input type="date">` no siempre completa el valor en jsdom (funcionó en `Vencimientos.test.tsx` pero no acá) — se usó `fireEvent.change()` en su lugar para esos dos campos, más confiable que simular tecleo sobre un input de fecha.

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (67 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores. `npm run verify` tardó **cuatro** corridas en asentarse — la máquina estuvo visiblemente más cargada que de costumbre durante buena parte de esta sesión (el `build` osciló entre ~10 s y ~80 s de una corrida a otra). Fallas vistas, todas intermitentes y no reproducibles en aislamiento: `verify:modulos` + `test:integration` en rojo con `tuple concurrently updated` (el problema de concurrencia contra Supabase ya documentado varias veces en esta bitácora); `test:unit` combinado en rojo dos corridas distintas, la segunda vez con un detalle de `verify-report.json` que apuntaba a `Siga.test.tsx`. Se investigó esa pista en particular antes de descartarla: `Siga.test.tsx` solo, tres corridas seguidas, 5/5 en las tres; la suite `web` completa, dos corridas, 67/67 en las dos; `npx vitest run` (los 29 archivos de todo el monorepo), dos corridas, 627/627 en las dos. Ningún fallo se repitió jamás en aislamiento — es el mismo patrón de contención por carga que ya aparece en otras entradas de esta bitácora (ver por ejemplo la tarea 102, 2026-08-10), no algo nuevo de esta tarea. `npm run verify` final: 15 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción de siempre).

  **Quedan 5 pantallas.** Próxima: Alertas.

  **2026-09-03 — Pantalla Alertas (8 de 12) construida.** `apps/web/src/pantallas/Alertas.tsx`: radar consolidado de la cartera contra `GET /api/v1/alertas` (tarea 82), sin formulario de alta — la tabla la alimenta el sistema (vencimientos, conciliaciones, balances), ningún rol tiene `crear` sobre `alerta` en la matriz de RBAC. El resumen por criticidad (Críticas/Altas/Medias/Informativas) viene tal cual del servidor, mismo patrón que el resumen por nivel de Vencimientos. Única acción: "Cerrar", con `window.prompt` pidiendo el motivo (`POST /api/v1/alertas/:id/cerrar`, motivo obligatorio en el servidor) — visible solo para `direccion`/`responsable`/`coordinador`, que son los tres únicos roles con `cerrar` sobre `alerta`. Cliente HTTP nuevo `apps/web/src/api/alertas.ts`. `clienteId` es `null` en una alerta que no nace de un cliente puntual (p. ej. un cambio de tasa impositiva) — la pantalla lo muestra como "—" en vez de asumir que siempre hay cliente, con un test dedicado a ese caso.

  **Tests nuevos:** 7 en `apps/web/test/Alertas.test.tsx` (radar con datos del servidor, resumen por criticidad, alerta sin `clienteId`, RBAC del botón de cerrar para `solo_lectura` y `auxiliar`, cerrar con motivo, cancelar el prompt sin llamar al servidor).

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (74 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real (`.claude/launch.json` de la raíz, servidor `effort-control-360`) que el bundle carga sin excepciones sin capturar y muestra el login — igual que en las siete pantallas anteriores, sin backend/Supabase arriba en este momento no se puede llegar más allá del login. `npm run verify` fue inconsistente entre corridas por el mismo problema de contención por carga ya documentado varias veces en esta bitácora (ver tarea 104, Liquidaciones, 2026-08-22): `test:unit` y `verify:web` en rojo en la corrida completa, ambos en verde al aislarlos (`npx vitest run` → 528/528 con 106 skipped; `npx vitest run --project web` → 74/74, dos corridas seguidas). Lo que sí es real y no un flake: Supabase volvió a estar inalcanzable (`ENOTFOUND tenant/user postgres.nrslhqtdyybmtvvwgirq not found`, después `Can't reach database server` — misma recurrencia que ya tuvo el punto 15 de `docs/DISCREPANCIAS.md` el 2026-08-10 y el 2026-08-20), así que `test:integration` queda sin poder correr contra Postgres real hasta que alguien reanude el proyecto desde el dashboard de Supabase — no depende de esta tarea ni de ninguna decisión de código. `audit` sigue en rojo por la excepción ya conocida (puntos 12/14), con algunas advertencias nuevas de paquetes transitivos (`fast-uri`, `fastify`, `browserslist`) que aparecieron entre corridas del mismo `npm audit` sin que cambiara ninguna dependencia propia — mismo patrón, sin relación con esta tarea.

  **Quedan 4 pantallas.** Próxima: Equipo.

  **2026-09-03 — Pantalla Equipo (9 de 12) construida.** `apps/web/src/pantallas/Equipo.tsx`: alta y edición de usuarios, exclusivo de `direccion` (`usuario: ['ver', 'crear', 'editar']` solo en ese rol de la matriz de RBAC; `responsable` tiene `['ver']` y ve la lista sin poder tocarla; el resto de los roles no tiene el recurso `usuario` en absoluto, así que `GET /api/v1/usuarios` les da 403 directamente — la pantalla muestra ese mensaje del servidor tal cual en vez de una lista vacía). Cliente HTTP nuevo `apps/web/src/api/usuarios.ts`.

  **Hallazgo real, corregido antes de poder construir la pantalla:** `POST`/`PATCH /api/v1/usuarios` ya aceptaban `clientesAsignados` para escribir la cartera de un usuario (tarea 83), pero no existía ninguna ruta para leerla de vuelta — la única lectura del puerto `clientesAsignados(usuarioId)` se usaba nada más para armar la sesión del propio usuario logueado (`GET /api/v1/yo`, que solo expone la cantidad, no los ids). Sin eso, el formulario de edición no podía precargar qué clientes tenía asignados una persona. Se agregó `GET /api/v1/usuarios/:id/clientes` (mismo permiso `usuario:ver`, 404 si el usuario no existe) en `apps/api/src/rutas/usuarios.ts`, con 4 tests nuevos en `apps/api/test/modulos.test.ts` (cartera vigente, lista vacía sin error, 404 real, RBAC). Mismo patrón que las tareas 87 y 101: un hueco que solo aparece al construir la pantalla que de verdad necesita leer ese dato.

  La cartera se edita con una lista de checkboxes (sin componente nuevo en `Primitivos.jsx`: es la primera pantalla que la necesita, se extrae a un primitivo compartido si una segunda la vuelve a pedir) que solo se muestra si el rol elegido admite cartera acotada (`responsable`/`coordinador`/`auxiliar`/`revisor_balance`, mismo `ROLES_CON_CARTERA` que ya usa el servidor) y `veTodosLosClientes` está en falso. Al abrir la edición de un usuario existente, el formulario se precarga al instante con sus datos básicos y la cartera llega un instante después por la ruta nueva — hay un texto "cargando…" mientras tanto, no un formulario congelado. La contraseña inicial solo se pide al dar de alta (`contrasenaInicial`, mínimo 12 caracteres validado en el servidor); el correo se muestra pero no se puede editar, mismo criterio que ya documenta `CamposEditablesDeUsuario` en el puerto (cambiar el correo es un cambio de identidad de acceso, no de ficha).

  **Tests nuevos:** 8 en `apps/web/test/Equipo.test.tsx` (listado con rol y estado, `responsable` ve pero no edita, un rol sin acceso al recurso ve el 403 del servidor en vez de una lista vacía, alta con cartera acotada, correo duplicado con el mensaje del servidor tal cual, edición precarga datos básicos al instante y la cartera un instante después, "Ve toda la cartera" oculta la lista de checkboxes, cancelar no llama al servidor).

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run apps/api/test/modulos.test.ts apps/api/test/rbac.test.ts` → exit 0 (131 tests, incluidos los 4 nuevos del lado API). `npx vitest run --project web` → exit 0 (82 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real que el bundle carga sin errores. Supabase volvió a responder durante esta tarea (ver `docs/DISCREPANCIAS.md`, punto 15, cerrado de nuevo el mismo día) — `npm run verify` completo: **16 OK / 3 pendientes declarados / 1 fallido** (`audit`, excepción de siempre, sin relación).

  **Quedan 3 pantallas.** Próxima: Reglas (impositivas y de notificación).

  **2026-09-03 — Pantalla Reglas (10 de 12) construida.** `apps/web/src/pantallas/Reglas.tsx`: dos tableros independientes en la misma pantalla, cada uno con su propio RBAC dentro del mismo `Recurso` — **reglas impositivas** (`regla_impositiva`: solo `direccion` crea/edita; dar de alta una tasa nueva cierra la vigente anterior, sin ruta para tocar `tasa`/`divisorIvaIncluido`/`vigenteDesde` de una regla ya creada, el formulario de edición ni siquiera muestra esos campos como editables) y **reglas de notificación** (`regla_notificacion`: `direccion` crea y edita, `responsable` solo edita, `coordinador` solo mira). Clientes HTTP nuevos `apps/web/src/api/reglasImpositivas.ts` y `apps/web/src/api/reglasNotificacion.ts` — este último reutiliza `Destinatario`/`EventoDisparador`/`TipoDestinatario` de `@effort/core` en vez de redeclararlos (como ya hacía el archivo antes de esta tarea, para `Seguimiento.tsx`), evitando que las dos copias diverjan con el tiempo.

  **Encontrado antes de escribir la pantalla, corregido antes de que rompiera nada:** `regla_notificacion` no aparece en absoluto en la matriz de RBAC para `auxiliar`, `revisor_balance` ni `solo_lectura` (los tres sí tienen `regla_impositiva: ['ver']`), así que para esos roles `GET /api/v1/reglas-notificacion` da 403 mientras el tablero de impositivas carga sin problema. Cada tablero maneja su propio estado de carga y de error por separado — un 403 en notificación no tumba ni deja en blanco el de impositivas, muestra el mensaje del servidor solo en su propia tarjeta.

  **Editor de destinatarios:** componente chico (`EditorDeDestinatarios`, sin promoverlo a `Primitivos.jsx` todavía porque esta es la única pantalla que lo usa) que agrega/quita filas de `{tipo, valor}` — el campo `valor` solo se muestra para los tipos que lo exigen (`ROL`, `USUARIO`, `CORREO_LIBRE`; los otros tres se resuelven solos contra el cliente/su responsable/su coordinador). Se usa dos veces por regla (destinatarios iniciales y de escalamiento).

  **De paso:** los mapas de tono/etiqueta de `NivelAlerta` (ya en `Vencimientos.tsx`) y de `Criticidad` (ya en `Alertas.tsx`) se extrajeron a `ui/etiquetas.ts` — Reglas no los necesitaba, pero Panel general (pantalla 12) sí, y hubiera sido la tercera copia de cada uno.

  **Tests nuevos:** 9 en `apps/web/test/Reglas.test.tsx` (ambos tableros con datos del servidor, 403 de notificación sin romper impositivas, RBAC de `coordinador` y `responsable`, alta de una tasa, edición que no toca la tasa vigente, alta de una regla de notificación con cartera acotada, agregar/quitar filas del editor de destinatarios, cancelar sin llamar al servidor).

  **Verificación:** `npx tsc --build` → exit 0. `npx vitest run --project web` → exit 0 (91 tests, sin regresiones). `npm run build` → exit 0.

  **Quedan 2 pantallas.** Próxima: Eventos.

  **2026-09-03 — Pantalla Eventos (11 de 12) construida.** `apps/web/src/pantallas/Eventos.tsx`: consulta filtrable del event log contra `GET /api/v1/eventos` (tarea 86) — solo lectura, acotada a `direccion`/`responsable`/`revisor_balance` en la matriz de RBAC; el resto de los roles ni siquiera ve la pantalla (403 directo, sin RBAC de botones que reflejar). La pantalla no reinterpreta `accion` ni `entidad`: son los códigos que el propio sistema generó (`usuario.creado`, `balance.aprobado`, etc.), y en un registro de auditoría el código exacto importa más que una traducción bonita — se muestran tal cual, en monoespaciado. `datosAntes`/`datosDespues` se muestran como JSON compacto cuando existen. Filtros: entidad, id de entidad, id de usuario (texto libre — no hay un listado de usuarios disponible para `revisor_balance`, que no tiene el recurso `usuario` en RBAC), cliente (select, `cliente:ver` lo tienen los seis roles), rango de fechas. Paginación simple con "Cargar más" (aparece solo cuando la página vino llena, seña de que probablemente haya más).

  Cliente HTTP nuevo `apps/web/src/api/eventos.ts`. **Encontrado por el propio `verify:web-typecheck` del gate** (no por `npx tsc --build` de la raíz, que no lo atrapó — lección para la próxima vez: el check dedicado de un workspace puede ver errores que el build incremental de todo el monorepo no ve): dos errores de `exactOptionalPropertyTypes` — `FiltroDeEventos` declaraba sus campos opcionales sin `| undefined` explícito (mismo patrón que ya documenta `CamposEditablesDeUsuario` en `puertos.ts`), y `listarEventos` mutaba un objeto tipado como `QueryParams` (`Readonly<Record<...>>`) con asignaciones por índice, que TypeScript rechaza aunque el objeto sea mutable en tiempo de ejecución. Corregido agregando `| undefined` a cada campo de `FiltroDeEventos` y reconstruyendo la query con spreads condicionales en vez de mutación.

  **Tests nuevos:** 5 en `apps/web/test/Eventos.test.tsx` (historial con datos del servidor, 403 con el mensaje del servidor, filtros mandan solo los campos completados —nunca cadenas vacías—, limpiar filtros, "Cargar más" solo aparece con página llena y pagina con el `desplazamiento` correcto).

  **Verificación:** `npx tsc --build` → exit 0. `npm run typecheck --workspace @effort/web` → exit 0 (el check específico que encontró el bug de arriba). `npx vitest run --project web` → exit 0 (96 tests, sin regresiones). `npm run build` → exit 0.

  **Queda 1 pantalla.** Próxima y última: Panel general.

  **2026-09-03 — Pantalla Panel general (12 de 12) construida — tarea 104 COMPLETA.** `apps/web/src/pantallas/Panel.tsx`: agrega los demás módulos ya construidos (vencimientos, alertas, solicitudes de documentación, balances, liquidaciones), sin ninguna ruta nueva — todos los datos salen de los mismos endpoints que ya usan Vencimientos/Alertas/Documentos/Balances/Liquidaciones. Solo lectura: ningún número se edita acá, cada uno se edita en su propio módulo. Indicadores cartera-wide (clientes activos, vencidos, próximos, alertas críticas) más tres indicadores por período (documentación pendiente, balances sin aprobar, liquidaciones sin enviar, con selector de período igual al de Documentos/Balances/Liquidaciones). Dos tableros de "más urgentes" (alertas críticas/altas, vencimientos ordenados por `diasRestantes`) para no tener que ir pantalla por pantalla a buscar qué necesita atención hoy.

  **A diferencia de Reglas y Eventos, acá no hubo que resolver ningún caso de RBAC parcial:** los seis recursos que Panel combina (`cliente`, `vencimiento`, `alerta`, `solicitud`, `balance`, `liquidacion`) tienen `ver` en los seis roles de la matriz de RBAC — se verificó gate por gate antes de asumirlo, no se dio por sentado. Por eso un solo `Promise.all` con un único estado de error alcanza, sin el patrón de error-por-sección que sí hizo falta en Reglas.

  Sin cliente HTTP nuevo: reutiliza `obtenerRadar`, `obtenerAlertas`, `listarSolicitudesPorPeriodo`, `listarBalances`, `listarLiquidaciones`, `listarClientes`, todos ya existentes.

  **Tests nuevos:** 4 en `apps/web/test/Panel.test.tsx` (los indicadores salen de los datos ya traídos, alertas/vencimientos urgentes con el nombre del cliente resuelto, cambiar el período vuelve a pedir los tres módulos que dependen de período, listas vacías muestran un mensaje en vez de una tabla muda).

  **Verificación:** `npx tsc --build` → exit 0. `npm run typecheck --workspace @effort/web` → exit 0. `npx vitest run --project web` → exit 0 (100 tests, sin regresiones). `npm run build` → exit 0. Verificado en el navegador real (`.claude/launch.json` de la raíz) que el bundle carga sin excepciones sin capturar y muestra el login — mismo límite de siempre, sin backend arriba en este momento no se puede ver más allá del login con datos reales. `npm run verify` fue inconsistente entre corridas por el mismo problema de contención por carga ya documentado varias veces en esta bitácora (`test:unit` y `verify:web` en rojo en la corrida completa, ambos en verde al aislarlos dos veces seguidas: `npx vitest run` → 664/664, `npx vitest run --project web` → 100/100). `npm run verify` limpio: **16 OK / 3 pendientes declarados / 1 fallido** (`audit`, excepción de siempre, sin relación).

  **Las 12 pantallas están hechas. Tarea 104 cerrada.**
- [x] 105. Retirar por completo `apps/App.jsx` (la demo original) una vez que todas las pantallas tengan reemplazo — **cerrada el 2026-09-04.** Se borró todo el árbol que solo `App.jsx` usaba, no solo el archivo: `App.jsx`, `components/` completo (23 archivos, incluidos los 10 de la subcarpeta `dashboard/`), `pages/` completo (9 archivos), `data/` completo (`data.js`, `mockData.js`, `dashboardData.js`), `contexts/FilterContext.jsx`, `layout/AIPanel.jsx`, `layout/Sidebar.jsx`, `layout/TopBar.jsx`, `ui/Badge.jsx`, `ui/ChartCard.jsx`, `ui/ClientModal.jsx`, `ui/KPICard.jsx` — **44 archivos en total.** Antes de borrar se comprobó en las dos direcciones que no había ningún cruce: nada bajo `pantallas/`, `api/`, `layout/Encabezado.tsx`, `ui/Primitivos.jsx`, `ui/etiquetas.ts`, `contexts/SesionContext.tsx` importaba nada del árbol viejo, y nada del árbol viejo importaba nada del real — dos universos completamente separados, confirmado por grep antes de tocar nada, no asumido. `main.tsx` ya montaba únicamente `<Aplicacion>` desde la tarea 103; `App.jsx` estaba muerto (sin montar) desde entonces, solo mencionado en un comentario de `Aplicacion.tsx` que también se sacó. `ui/Primitivos.jsx` sigue en `.jsx` (es real, no demo) — `allowJs`/`checkJs:false` del `tsconfig.json` se mantienen tal cual, no hacía falta tocarlos.

  **Verificación:** `npx tsc --build` → exit 0. `npm run typecheck --workspace @effort/web` → exit 0. `npx vitest run --project web` → exit 0 (100 tests, sin regresiones — ningún test tocaba el árbol viejo). `npm run build` → exit 0 (el CSS del bundle bajó de 55.85 kB a 31.44 kB, esperable al sacar todos los estilos que solo usaba la demo). `npm run verify`: `test:unit` y `test:integration` en rojo por Supabase inalcanzable otra vez en este momento (mismo patrón de pausa automática ya documentado varias veces, sin relación con esta tarea — no se investigó más porque no bloquea); `verify:web` confirmado en verde aislado (100/100) apenas antes. `audit` con la excepción de siempre.
- [x] 106. `verify:no-hardcoded-kpi` — ningún número escrito a mano en la interfaz — **cerrada el 2026-09-04.** `scripts/verificar-kpi.mjs`: no es un chequeo genérico de "ningún número en el código" (eso incluiría tamaños de ícono, límites de validación, paginación, etc. — puro ruido), sino uno acotado al primitivo que de verdad muestra cifras de negocio: escanea todo `.tsx` bajo `apps/web/src/pantallas/` buscando `valor={...}` de `<Indicador>` y falla si el contenido de las llaves es un número literal puro en vez de una expresión que lea de estado/props. Probado en las dos direcciones antes de cablearlo: contra un archivo de prueba con `valor={5}` (detecta) junto a `valor={resumen.VENCIDO}` (no detecta, correcto) en el scratchpad, no en el repo. Corrido contra las 13 pantallas reales: **0 violaciones** — las 12 pantallas de la tarea 104 más `Acceso.tsx` calculan todas sus cifras, ninguna la tiene escrita a mano. Se sacó el `pendiente` de `scripts/verify.mjs` para que el check corra de verdad.

  **Verificación:** `node scripts/verificar-kpi.mjs` → exit 0, "13 pantallas revisadas, ninguna cifra de KPI escrita a mano". `npm run verify` → **17 OK / 2 pendientes declarados / 1 fallido** (`audit`, excepción de siempre) — el gate pasó de 16 a 17 checks activos.

**2026-09-04 — Suite end-to-end con Playwright construida, `test:e2e` deja de estar pendiente — PARTE 7 CERRADA.** Es la primera vez que el sistema corre de punta a punta con un navegador real: servidor Fastify real escuchando en un puerto, PostgreSQL real (mismo esquema aislado que ya usa `test:integration`, migrado con los mismos archivos de `prisma/migrations` que corren en producción), y `vite dev` real — nada mockeado, a diferencia de toda la suite anterior (`.inject()` en memoria, o `fetch` mockeado a mano en `apps/web/test/`).

  **`apps/api/src/arrancar.ts` (nuevo):** hasta esta tarea, `principal()` (el arranque real del servidor, exportado desde `index.ts`) **nunca se había invocado en ningún lado** — ni un solo proceso real del backend se había levantado en toda la vida del proyecto, todo pasaba por `.inject()`. Este archivo es el único que lo llama de verdad, hoy solo para e2e.

  **`e2e/entorno-global.ts`:** crea el esquema temporal (reusando `crearEntorno()` de `apps/api/test/integracion/entorno.ts`, al que se le agregó `urlDeConexion` al resultado), siembra un usuario `direccion` (con 2FA real activado) y uno `auxiliar`, más un cliente, y levanta la API real (`node apps/api/dist/arrancar.js`) y la web real (`node node_modules/vite/bin/vite.js dev`) como procesos hijos, cada uno resuelto por ruta absoluta en vez de por `npx`/shell, para no depender de cómo resuelve binarios cada sistema operativo. Un solo worker (`playwright.config.ts`): todos los specs comparten el mismo esquema y los mismos dos procesos, correrlos en paralelo pisaría datos entre sí — mismo criterio que ya usa `test:integration` con `fileParallelism: false`.

  **Tres bugs reales encontrados construyendo esto — ninguno inventado, los tres verificados antes de asumir la causa:**
  1. **El más importante, un bug de seguridad real que nunca se había disparado:** la cookie de sesión (`NOMBRE_COOKIE_SESION` en `apps/api/src/seguridad/sesiones.ts`) llevaba el prefijo `__Host-`, que obliga al navegador a exigir `Secure` — pero fuera de producción el código ya apagaba `secure` a propósito (`opcionesDeCookie`, con su propio test `'secure solo se apaga fuera de producción'`, desde antes de esta tarea). Un `__Host-` sin `Secure` no da un error: el navegador **descarta el `Set-Cookie` en silencio**. El login real devolvía `200` y la sesión nunca quedaba guardada — se hubiera repetido igual en cualquier prueba manual futura contra un entorno sin HTTPS. Nada lo había disparado antes porque ningún test anterior pasaba por un navegador real ni por HTTP real. **Corregido:** `NOMBRE_COOKIE_SESION` (constante) se reemplazó por `nombreCookieSesion(esProduccion)` (función) — el prefijo `__Host-` ahora solo se usa en producción, mismo criterio que ya aplicaba `secure`. Actualizados los 3 call sites de producción (`autenticacion.ts`, `servidor.ts`) y los 5 archivos de test que importaban la constante directamente (`modulos.test.ts`, `servidor.test.ts`, `siga.test.ts`, `importaciones.test.ts`, `seguridad.test.ts` — este último con la aserción reforzada para cubrir ambos casos, no solo producción).
  2. `direccion` está en `ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO` (ya existía, tarea 83) — el usuario sembrado necesitó un secreto TOTP real y completar el paso de verificación en el spec, no solo la contraseña.
  3. **Bug del propio harness de e2e, no del sistema:** el secreto TOTP se generaba con `generarSecretoTotp()` en el nivel superior de `entorno-global.ts` — pero Playwright ejecuta `globalSetup` y el worker que corre cada spec en **procesos separados**, cada uno con su propia instanciación del módulo, así que el secreto sembrado en la base y el usado para calcular el código en el test nunca coincidían ("Código incorrecto." en todas las corridas). Corregido con un secreto fijo (es un dato de prueba, no hay motivo para que sea aleatorio) y aplicando en el spec las mismas opciones de `otplib` (`window: 1, step: 30`) que fija el servidor, para no depender de que los valores por defecto de la librería coincidan por casualidad entre dos procesos distintos.

  **Alcance de los specs, a propósito acotado — no repite lo que ya prueban 758 tests unitarios/integración/componente:** `flujo-principal.spec.ts` (login con 2FA real → navega a Clientes, ve el cliente sembrado → Panel general, ve los indicadores calculados sobre datos reales → cierra sesión) y `rbac.spec.ts` (un usuario `auxiliar` real recibe un 403 real del servidor real al entrar a Equipo, y la pantalla lo muestra tal cual). Lo que prueban y nada más podía probar: que la cookie y el CSRF funcionan de verdad entre dos orígenes distintos, y que un 403 real llega al navegador real.

  **Verificación:** `npx tsc --build` → exit 0. `npm run typecheck:e2e` (`tsc --noEmit --project e2e/tsconfig.json` — chequeo separado del `tsc --build` de la raíz, mismo motivo que ya tiene `verify:web-typecheck`: `e2e/` no es parte del grafo de project references) → exit 0. `npx playwright test` → **2/2 en verde**, contra Supabase real (se pausó solo una vez en el medio de esta tarea — mismo patrón de siempre, resuelto reanudándolo). `npm run verify` completo → **18 OK / 1 pendiente declarado / 2 fallidos** (`test:unit` por el problema de contención por carga ya documentado varias veces en esta bitácora, sin confirmar aislado esta vez por decisión explícita de seguir; `audit`, excepción de siempre) — el gate pasó de 17 a 19 checks activos (`verify:e2e-typecheck` y `test:e2e` nuevos). Único pendiente declarado que queda en todo el archivo: `lint` (ESLint sin configurar).

**Las 3 partes de la interfaz completa (100 a 106) y el end-to-end están cerrados. PARTE 7 COMPLETA** — 0 líneas `- [ ]` entre esta parte y la Parte 8, confirmado por grep antes de escribir esto, no asumido.

**2026-09-04 — `lint` configurado y en verde, `verify.mjs` sin ningún check `pendiente` por primera vez en todo el proyecto.** `eslint.config.js` (flat config, ESLint 9): `@eslint/js` + `typescript-eslint` recomendados, sin las reglas "type-checked" (exigirían `parserOptions.project` en un monorepo con un `tsconfig` por paquete y varios fuera del grafo de `tsc --build` — armar eso es una tarea en sí misma, no parte de destrabar el check). Se agregó `eslint-plugin-react-hooks` (nuevo, chico, oficial de React) con solo las dos reglas clásicas (`rules-of-hooks`, `exhaustive-deps`) — no el paquete `flat.recommended` completo de la v7, que trae una decena de reglas nuevas orientadas al React Compiler que nadie pidió. Varias pantallas ya traían comentarios `eslint-disable-next-line react-hooks/exhaustive-deps` escritos antes de que este plugin existiera en el proyecto — esto es exactamente lo que esos comentarios esperaban.

  **7 hallazgos reales, todos corregidos, ninguno oculto ni silenciado con una excepción:**
  - 4 imports sin usar (`apps/api/src/rutas/alertas.ts`, `balances.ts`, `apps/web/src/pantallas/Balances.tsx`, `Documentos.tsx`) y una variable de test sin usar (`apps/web/test/Panel.test.tsx`, resto de un refactor de la tarea de Panel general que dejó de necesitar `userEvent`).
  - `alertas.ts`: `CRITICIDADES` era un array en tiempo de ejecución usado solo como tipo (`typeof CRITICIDADES`) — se reemplazó por un `type Criticidad` directo, más simple y sin el array muerto.
  - **El único hallazgo de comportamiento real, no solo de limpieza:** en `Seguimiento.tsx`, `const hoy = new Date()` se recalculaba en cada render y lo usaba un `useMemo` sin declararlo como dependencia — `exhaustive-deps` lo marcó. Agregarlo tal cual a las dependencias hubiera sido peor (un `Date` nuevo en cada render vuelve inútil cualquier memoización); se corrigió memoizando `hoy` con `useMemo(() => new Date(), [])`, que es lo que de verdad hacía falta.

  **Verificación:** `npx eslint .` → exit 0, 0 problemas. `npx tsc --build`, `typecheck:e2e` y `typecheck --workspace @effort/web` → exit 0 los tres. `npx vitest run apps/api/test/modulos.test.ts apps/web/test/Balances.test.tsx apps/web/test/Documentos.test.tsx apps/web/test/Panel.test.tsx apps/web/test/Alertas.test.tsx` → 258/258 (un timeout de hook aislado y descartado como el problema de contención por carga de siempre, confirmado corriendo `modulos.test.ts` solo: 114/114). `npm run verify` completo → **19 OK / 0 pendientes / 2 fallidos** (`test:unit`, mismo flake, confirmado aislado en el paso anterior; `audit`, excepción de siempre) — **primera vez que `scripts/verify.mjs` no tiene un solo check declarado `pendiente`.**

---

## PARTE 8 — Despliegue

- [~] 107. Crear la app en DigitalOcean App Platform, conectada al repositorio — **preparación lista el 2026-09-04, falta el paso real (cuenta de Daniel, no automatizable).** `.do/app.yaml`: un dominio (`effort360.disaak.com`), dos componentes — sitio estático `web` en `/`, servicio `api` en `/api`, mismo origen a propósito (sin CORS entre los dos, y la cookie `__Host-` de producción funciona sin caso especial). `health_check` apunta a `/salud` (ruta ya existente, DigitalOcean la consulta directo contra el contenedor, no por el ruteo público). Job `PRE_DEPLOY` que corre `prisma migrate deploy` antes de que el servicio nuevo reciba tráfico. `apps/api/src/arrancar.ts` pasa de ser "solo para e2e" a ser también el `run_command` real de producción — comentario actualizado. Guía completa de las 5 tareas de esta parte en `docs/DESPLIEGUE.md`. Daniel ya tiene cuenta de DigitalOcean creada; el DNS de `disaak.com` (tarea 109) todavía no está confirmado.

**2026-09-08 — App creada de verdad, primer intento de build falló, dos bugs reales encontrados y corregidos.** Daniel creó el recurso real: servicio `api` conectado a `IMMR-Hub/effort-control-360`, 512 MB RAM / 1 vCPU / 1 contenedor ($5/mes), puerto público 8080, ruta `/api`, las 10 variables de entorno cargadas (6 cifradas). El auto-detect de DigitalOcean al principio proponía un componente "Function" espurio y 2 contenedores ($24/mes) — corregido a mano antes de crear, guiado paso a paso por el chat.

El primer build falló con errores de TypeScript en `apps/api` (`Cannot find name 'process'/'Buffer'`, `Cannot find module 'node:crypto'`). **Reproducido en la máquina local con el mismo escenario exacto que usa un build limpio** (`npm ci` real desde cero + `npx tsc --build --force`, sin caché incremental — algo que nunca se había hecho en toda la vida del proyecto, porque `node_modules/` nunca se había borrado del todo) — apareció el mismo error, confirmando la causa antes de asumirla:

1. **`apps/api` nunca declaró `@types/node` como propio** — dependía solo de que quedara *hoisteado* desde la raíz del monorepo. `apps/web` sí lo tiene declarado directamente (por eso nunca dio este problema ahí). Corregido: agregado a `apps/api/package.json`.
2. **Encontrado recién al corregir el primero — un bug más grave que el build de DigitalOcean ni había llegado a mostrar:** el cliente de Prisma **nunca se genera en una instalación limpia**, porque nunca existió un `postinstall` que corra `prisma generate`. Localmente "funcionaba" solo porque `node_modules/.prisma/client` ya estaba generado de una sesión de hace semanas y nunca se había borrado — cualquiera que clonara el repo de cero se hubiera encontrado con el mismo problema, no es específico de DigitalOcean. Corregido con `"postinstall": "prisma generate"` en `apps/api/package.json`, más un `npx prisma generate` explícito en `.do/app.yaml` como red de seguridad extra.

**Verificado con el mismo escenario real antes de decirle a Daniel que reintentara:** `npm ci` desde cero + `npx tsc --build --force` → 0 errores. `npx vitest run apps/api/test/modulos.test.ts apps/api/test/servidor.test.ts` → 150/150. Commit `48a2ffa`, subido a `main` con confirmación explícita de Daniel (dispara un build nuevo solo, por el auto-deploy). Resultado del segundo intento: pendiente de confirmar.
- [ ] 108. Configurar variables de entorno de producción (secretos distintos a los de desarrollo)
- [ ] 109. Configurar el subdominio `effort360.disaak.com` (registro CNAME)
- [ ] 110. Verificar HTTPS y que `ORIGEN_PERMITIDO`/cookies funcionan en producción
- [ ] 111. Corrida de humo completa en producción con el usuario real de dirección

---

## PARTE 9 — Validación final con EFFORT

- [ ] 112. Contrastar el cálculo de IVA contra una liquidación real ya presentada (cierra la discrepancia #1 de `docs/DISCREPANCIAS.md`)
- [ ] 113. Confirmar los 5 clientes piloto definitivos con Laura/Lili
- [ ] 114. Primera revisión guiada con EFFORT: los 12 módulos, en vivo, con sus propios datos

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
- **2026-07-23** — Módulo Alertas sin ruta de alta: ningún rol tiene el permiso `crear` sobre el recurso `alerta` en la matriz de RBAC (`apps/api/src/seguridad/rbac.ts`), a propósito — la tabla la alimenta el sistema (vencimientos, conciliaciones, balances), no un usuario a mano. El orden de la vista consolidada por criticidad se apoya en que PostgreSQL ordena un enum nativo por la posición de declaración en `CREATE TYPE`, no alfabéticamente — el enum `Criticidad` en `schema.prisma` está declarado `CRITICA, ALTA, MEDIA, INFORMATIVA` a propósito, y `orderBy: { criticidad: 'asc' }` alcanza. Confirmado con un test de integración real. Si el enum se reordena alguna vez, ese `orderBy` deja de tener sentido sin que ningún tipo lo avise — queda anotado en el comentario del repositorio.
- **2026-07-23** — Módulo Equipo: dirección define la contraseña inicial de cada usuario nuevo al darlo de alta (campo `contrasenaInicial`, validado con las mismas reglas de fortaleza que cualquier contraseña). Todavía no existe un flujo de "definí tu propia contraseña en el primer acceso" — ni ruta de cambio de contraseña, ni despacho de notificaciones (Parte 6) para avisarle a la persona. `debeCambiarContrasena` ya queda en `true` por defecto en el modelo, a la espera de que ese flujo se construya; hasta entonces, dirección comunica la contraseña inicial por un canal fuera del sistema. La edición de cartera (`clientesAsignados` en `PATCH /api/v1/usuarios/:id`) reemplaza el conjunto entero, no agrega/quita clientes sueltos, y un cambio de rol de una persona en un cliente abre una fila `asignacion_cliente` nueva en vez de mutar la vieja — así el historial dice desde cuándo ejerció cada rol en cada cliente, no solo cuál es el rol actual. `direccion` y `solo_lectura` no admiten cartera acotada (el enum `RolEnCliente` no los incluye): siempre ven todo o nada, nunca un subconjunto.
- **2026-07-23** — Hallazgo importante mientras se construía el módulo de Reglas Impositivas (tarea 84): `packages/core/src/iva.ts` calcula el IVA con un divisor **hardcodeado** en la constante `DIVISOR_IVA_INCLUIDO`, pese a que su propio comentario dice que la tasa "vive en la tabla `regla_impositiva`". Se comprobó con grep que ninguna ruta de `apps/api` llama todavía a `desglosarIvaIncluido` ni a `totalizar` — la determinación de IVA del proceso mensual se sigue cargando a mano. Conclusión: editar una fila de `regla_impositiva` hoy **no cambia ningún cálculo real del sistema**, porque no hay ningún cálculo que la lea. Queda anotado como discrepancia nueva (punto 9 de `docs/DISCREPANCIAS.md`) para cuando se conecte la determinación automática de IVA a partir de los documentos — esa lógica futura tiene que leer el divisor vigente desde `regla_impositiva`, no seguir usando la constante. Una tasa no se edita in-place: dar de alta una regla nueva para la misma `tasa` cierra automáticamente la vigente anterior un día antes de que empiece la nueva (mismo patrón de vigencia que la cartera de usuarios de la tarea 83), y la edición (`PATCH`) solo toca metadata (nombre, fuente, `requiereConfirmacionCliente`, cierre manual de vigencia) — nunca la tasa ni el divisor de una fila ya creada.
- **2026-07-24** — Tarea 90 (espejo de respaldo): `espejarCarpeta()` compara el sha256 recién calculado contra el del manifiesto previo, no contra el contenido real del destino — evita tener que leer de vuelta cada archivo ya copiado solo para verificar si cambió. El manifiesto (`manifiesto-espejo.json`) vive en la misma carpeta de destino que los archivos que describe, así que se filtra a propósito de la lista de "archivos a copiar" del origen (por si alguien lo sembrara ahí por error de configuración de carpetas). Sigue la misma regla de no-borrado que el resto del sistema: un archivo que desaparece del origen no se borra del destino, simplemente deja de actualizarse en corridas futuras. El puerto `DriveDeArchivos` no distingue cuentas, así que origen y destino pueden ser instancias distintas de `DriveGraph` apuntando a cuentas de OneDrive separadas, o dos carpetas del mismo drive — la tarea 90 no decide eso, lo decide quien la invoque en la Parte 6 o donde se termine cableando el job automático.
- **2026-07-24** — Tarea 91 (importador de comprobantes): se evaluó `xlsx` (SheetJS) primero por ser una sola dependencia para Excel y CSV, pero la versión parcheada del CVE de prototype pollution (GHSA-4r6h-8v6p-xvw6, ≥0.19.3) nunca se publicó en el registro de npm — solo en el CDN propio de SheetJS, fuera de la cadena de auditoría normal. Se optó por `exceljs` + `csv-parse` en su lugar: dos dependencias del registro normal de npm, mantenidas activamente, sin ese CVE. Quedó una vulnerabilidad moderada transitiva sin relación (`uuid` <11.1.1 vía `exceljs`, GHSA-w5hq-g745-h8pq) que no bloquea `npm audit --audit-level=high`. El `.d.ts` de `exceljs` declara su propio `Buffer` local (alias casi vacío de `ArrayBuffer`) que rompe la compatibilidad de tipos con el Buffer real de Node — es un defecto del paquete, no afecta el comportamiento real; se resolvió con un cast puntual vía `Parameters<>` en vez de `any`, documentado en el código. La función principal no escribe en la base a propósito: separar "parsear y validar" de "persistir" es lo que permite probar el importador entero sin tocar Postgres, y deja el modo simulación de la tarea 93 como una capa que se agrega encima, no algo que haya que retrofitear.
- **2026-07-24** — Tarea 92 (importador SIGA): las filas de una exportación SIGA no llevan tipo ni origen de comprobante — esa información es a nivel de todo el reporte (`tipoReporte`), no fila por fila — a diferencia del importador de comprobantes de la tarea 91. Para poder reusar `detectarDuplicados()` de `@effort/core` (que trabaja sobre `Comprobante`, con tipo/origen obligatorios) se arma una vista sintética con `tipo:'FACTURA'`/`origen:'COMPRA'` fijos, igual que ya hacía `filaSigaAComprobante` en la ruta de conciliación — no distorsiona nada porque `claveNatural()` solo mira RUC+timbrado+número. Motivación real de deduplicar en el importador y no confiar en la conciliación para detectarlo: `conciliarConSiga()` indexa las filas SIGA en un `Map` por clave natural, así que dos filas con la misma clave en el mismo archivo se pisarían en silencio (la última ganaría) sin ningún aviso — el importador tiene que atajarlo antes de que lleguen a esa etapa.
- **2026-07-24** — Tarea 93 (dry-run obligatorio): el archivo a importar viaja como `contenidoBase64` en el cuerpo JSON de la petición, no como upload multipart — coherente con cómo ya funciona el resto de la API (el POST manual de SIGA de la tarea 74 ya recibía las filas como JSON) y sin necesitar `@fastify/multipart` como dependencia nueva. Al escribir la ruta de comprobantes se encontró que `RepositorioDeDocumentos` no tiene alta en lote transaccional (a diferencia de `RepositorioDeExportacionesSiga`, que ya la tenía desde la tarea 74): quedó documentado como límite conocido en vez de ampliar el puerto sobre la marcha. Al escribir la ruta de SIGA se encontró lo contrario de lo esperado: la idempotencia de la tarea 94 ya estaba resuelta ahí desde la tarea 74 (restricción única + `skipDuplicates: true`), verificado con un test antes de asumir que hacía falta resolverla — la tarea 94 se reduce a la mitad de `documento`. Aparte, sin relación con el código de esta tarea: `npm audit` empezó a fallar por un aviso de `brace-expansion` recién publicado, no explotable en el uso real del proyecto; se documentó como excepción en vez de forzar un downgrade de `exceljs` sin garantía de que resolviera algo — el check `audit` queda en rojo a propósito, ver `docs/DISCREPANCIAS.md` punto 12.
- **2026-07-28** — Tarea 94, corrección de un error propio de la tarea 93: se había escrito ahí que `documento` "no tiene restricción de unicidad" sin haber corrido `grep`/tests antes de afirmarlo. Al ponerse a resolver la tarea 94 se encontró que `apps/api/test/integracion/dominio.test.ts` ya tenía un test pasando (`'la base impide cargar dos veces el mismo comprobante del mismo cliente'`) que probaba exactamente lo contrario. Se verificó de forma independiente contra la base real, no solo confiando en el test: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'documento'` contra Supabase (con `DIRECT_URL` cargado desde `.env`) confirmó `documento_cliente_id_ruc_emisor_timbrado_numero_comprobante_key` sobre `(cliente_id, ruc_emisor, timbrado, numero_comprobante)`, creado por `20260722110319_init`. Es decir: el riesgo real nunca fue "el sistema deja duplicar comprobantes" — la base ya lo impedía. El riesgo real era que `registrar()` llamado fila por fila iba a **lanzar una excepción sin capturar** ante el primer duplicado de una reimportación, cortando el resto del lote a medio insertar. `prisma migrate status` sí mostraba un problema distinto y real: `schema.prisma` tenía `name: "comprobante_unico"` en ese `@@unique` sin que existiera una migración que renombrara el índice — drift de nombre entre el archivo y la base, no de estructura. Se sacó el `name:` explícito (Prisma vuelve a generar el mismo nombre por defecto que ya existe en la base) y `prisma migrate status` quedó en "Database schema is up to date!" sin generar ninguna migración nueva. Lección para las próximas tareas: antes de escribir "no existe X" o "falta Y" en el roadmap, buscarlo — `grep`, correr el test relacionado, o consultar la base real si el código no alcanza para estar seguro — en vez de inferirlo de no haberlo visto en el archivo que se acaba de tocar.
- **2026-07-28** — Corrección real sobre la tarea 39 (Parte 1.6, marcada completa desde el principio): al empezar a construir el cliente HTTP del frontend (tarea 100) se encontró que la protección CSRF **nunca estuvo aplicada**. `apps/api/src/servidor.ts` registraba el plugin `@fastify/csrf-protection`, pero ninguna ruta lo usaba como `preHandler` y ningún endpoint llamaba a `generateCsrf()` para emitir un token — estaba instalado pero no conectado a nada. Se confirmó de la forma más dura posible: los ~140 `inject()` mutantes (POST/PATCH/DELETE) ya existentes en los tests de rutas nunca mandaban `x-csrf-token`, y todos pasaban. Si la protección hubiera estado activa, todos habrían fallado con 403. Corregido con: (1) un hook `preHandler` **global** en `servidor.ts` que aplica `app.csrfProtection` a todo POST/PUT/PATCH/DELETE — a propósito no es un `preHandler` por ruta, porque una ruta nueva que se olvide de ponerlo es exactamente cómo se llegó a esta situación; (2) `GET /api/v1/csrf`, pública, que emite el token — el cliente la llama al cargar la app, antes de loguearse, porque el login también es una petición mutante. Como esto rompía en cascada los ~140 `inject()` existentes, se armó `apps/api/test/csrf-en-tests.ts`: parchea `app.inject()` una sola vez por archivo de test para que adjunte el token automáticamente, sin tocar ninguno de los tests ya escritos — reescribirlos a mano habría sido enorme y frágil (un `inject` nuevo que se olvidara del token fallaría con un 403 sin explicación obvia). 5 tests nuevos en `servidor.test.ts` prueban el comportamiento real: sin token rechaza, con token ajeno rechaza, con el token correcto pasa. Los 236 tests del proyecto `api` siguen en verde. Esto no es parte de la tarea 100 — es una corrección de la tarea 39 encontrada mientras se hacía la 100 — por eso va en un commit separado.
- **2026-07-30** — Orden real de la Parte 7: en ese momento, "reemplazar datos-semilla por llamadas reales" era la tarea 101 (hoy 102, tras insertar la tarea del módulo de Solicitudes el 2026-08-20) y era la primera sin marcar después de la 100, pero no se podía hacer todavía de una forma verificable — sin pantalla de login (hoy tarea 103) no hay manera de conseguir una sesión real contra la cual probar que las llamadas a la API funcionan. Construirla antes sería trabajo que el login obligaría a retocar. Se invierte el orden (login antes que reemplazar semilla): no es saltear una tarea imposible como la del correo, es una dependencia real entre dos tareas posibles, y el objetivo es no rehacer trabajo.
- **2026-08-09** — Avance real fuera de código: Daniel entró a portal.azure.com con la cuenta `effort360@effort.com.py` y resultó tener permisos de administrador en Microsoft Entra ID del tenant de EFFORT — alcanzó para registrar la aplicación "EFFORT Control 360" sin depender de que alguien más en EFFORT lo hiciera. `Tenant ID`, `Client ID` y `Client Secret` cargados en `.env` (nunca en el chat ni en git — el secreto se pegó directo del navegador al archivo local) y verificados con una llamada real al endpoint de token de Microsoft: autenticación exitosa. Una prueba de acceso al OneDrive de esa cuenta todavía devuelve `404 — User's mysite not found` (no un error de permisos): falta asignar los permisos de aplicación de Graph (`Files.ReadWrite.All`, `Mail.Send` — mismo registro sirve para las tareas 88 y 95, no hace falta repetir el registro) y conceder consentimiento de administrador, en curso. Se agregaron los dos permisos, pero el botón de consentimiento apareció deshabilitado: se verificó en Entra ID → Roles y administradores que `effort360@effort.com.py` no es Administradora Global — **solo Laura y Lili tienen ese rol** en el tenant de EFFORT. Queda bloqueado ahí, esperando que una de las dos haga un único clic en Azure (instrucciones ya redactadas para reenviarles). Detalle completo con los IDs no sensibles en `docs/DISCREPANCIAS.md`, punto 6.
- **2026-08-20** — Al empezar la tarea "reemplazar datos-semilla por llamadas reales" se encontró que `Seguimiento.jsx` dependía de cuatro cosas de semilla, y una de las cuatro (`SolicitudDocumentacion`) tenía el modelo Prisma desde el principio pero cero rutas y cero repositorio — mismo patrón que la tarea 87 encontró para clientes. Se decidió construir el módulo antes de seguir, insertándolo como tarea nueva (101) y corriendo la numeración de todo lo que venía después en una unidad (Partes 7, 8 y 9), en vez de dejarlo sin numerar o resolverlo "por izquierda" dentro de la 101 original. Total del roadmap: 113 → 114 tareas. Los 4 tests de integración de `SolicitudesPrisma` quedaron escritos pero sin poder correr contra Postgres real: Supabase seguía con el mismo `ENOTFOUND` del punto 15 de `docs/DISCREPANCIAS.md`, diez días después de la primera vez que se documentó — correrlos apenas el proyecto vuelva a responder, antes de confiar en que la tarea 101 está realmente cerrada.
- **2026-08-20** — Cierre del punto 15 de `docs/DISCREPANCIAS.md`: el proyecto de Supabase estaba pausado de verdad (confirmado en el dashboard, no una sospecha), Daniel lo reanudó con un clic, y tras un par de minutos de propagación del pooler `npx vitest run --project integracion` corrió 106/106 en verde — incluidos los 4 tests nuevos de `SolicitudesPrisma` de la tarea 101, que habían quedado escritos sin poder correr. `npm run verify` completo: 16 OK / 3 pendientes declarados / 1 fallido (`audit`, excepción ya conocida). No sembrar directamente en `public` cuando esto pase de nuevo: los tests de integración usan un esquema temporal propio, así que reanudar el proyecto no crea usuarios ni clientes piloto — eso sigue bloqueado por las tareas 56/57 (esperando confirmación de EFFORT).
- **2026-09-04** — Tarea 88 cerrada de punta a punta: `effort360@effort.com.py` resultó ser la cuenta de Daniel (no una cuenta de sistema ajena a él), ya Administrador Global — concedió él mismo el consentimiento de administrador. El 404 que quedaba después de eso no era un problema de permisos: el OneDrive personal de esa cuenta nunca se había aprovisionado (nunca se había abierto). Se resolvió entrando una vez a `https://effortconsultora-my.sharepoint.com` con esa cuenta. Verificado con una llamada real: `GET /v1.0/users/effort360@effort.com.py/drive/root/children` → `200 OK`.
- **2026-09-04** — Carpeta raíz de OneDrive definida, acordada con Daniel: en vez de apuntar el sistema a la carpeta real de trabajo diario de Laura/Lili (sin backup propio de EFFORT), se usa `/EFFORT Control 360/` — una carpeta nueva, que hoy no existe, con subcarpetas `/Entrada/`, `/Salida/` y `/Respaldo/`. Al no tener nada adentro hoy, es imposible que el sistema cruce con un archivo real de un cliente. El costo: alguien de EFFORT tiene que copiar los archivos del período a `/Entrada/` a mano — automatizar ese copiado desde la carpeta real es una decisión futura, no de ahora. Detalle completo en `docs/DISCREPANCIAS.md`, punto 6.
- **2026-09-04** — Tarea 105 cerrada: se retiró toda la demo original (`App.jsx` y 43 archivos más que solo él usaba, 44 en total) — confirmado con grep en las dos direcciones antes de borrar que no había ningún cruce con el árbol real de pantallas.
- **2026-09-04** — Suite end-to-end con Playwright: primera vez que `principal()` (el arranque real del servidor, exportado desde `apps/api/src/index.ts` pero nunca invocado en ningún lado hasta ahora) corre como proceso real, contra un navegador real. Encontró un bug de seguridad genuino que ningún test anterior podía disparar: la cookie de sesión llevaba el prefijo `__Host-` (exige HTTPS) combinado con `secure: false` fuera de producción (a propósito, para desarrollo sin certificado) — esa combinación hace que el navegador descarte el `Set-Cookie` en silencio, sin ningún error visible; el login real devolvía 200 pero la sesión nunca quedaba guardada fuera de producción. Se hubiera repetido en cualquier prueba manual futura del login contra un entorno sin HTTPS. Corregido con `nombreCookieSesion(esProduccion)`: el prefijo `__Host-` ahora es condicional, igual que ya era `secure`. Lección para la próxima vez que algo "funciona en los tests mockeados mas no en la vida real": un mock de `fetch` (jsdom) y un `.inject()` de Fastify no aplican las reglas de cookies de un navegador real — ninguno de los dos hubiera podido encontrar este bug, hacía falta exactamente el tipo de test que faltaba construir.
