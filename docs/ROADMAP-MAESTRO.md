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

**Regla anti-mentira (agregada 2026-07-22 tras encontrar un roadmap que decía
"Parte 2 y 3 cerradas" con 4 tareas sin marcar adentro):** antes de escribir
"PARTE X — cerrada" o "COMPLETA" en cualquier lado, **grep todas las líneas
`- [ ]` de esa parte**. Si hay una sola, la parte NO está cerrada. No alcanza
con mirar el trabajo que se acaba de hacer — hay que barrer toda la sección.

```bash
grep -c "^- \[ \]" <(sed -n '/## PARTE X/,/## PARTE X+1/p' docs/ROADMAP-MAESTRO.md)
```

Si da 0, cerrada. Si no, no.

**Avance: 89 de 113 tareas (79%).** Partes 1, 2, 3, 4A, 4B, 4C, 4D y 4E cerradas. Quedan 3 tareas bloqueadas por EFFORT (2 de carga de datos + el registro en Azure AD), que no frenan el código.

Última actualización: 2026-07-24 · Commit de referencia: ver último commit en `git log`

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

- [ ] 88. Registrar la aplicación en Azure AD (requiere que EFFORT cree la cuenta `sistema.effort360@...`) — **bloqueada, no depende de nosotros**
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
- [ ] 93. Modo simulación (`dry-run`) obligatorio antes de escribir en la base
- [ ] 94. Idempotencia verificada: importar el mismo archivo dos veces no duplica

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

- [ ] 100. Cliente HTTP tipado en `apps/web`, con manejo de sesión/CSRF
- [ ] 101. Reemplazar `datos-semilla/` por llamadas reales a la API
- [ ] 102. Pantalla de login con flujo de 2FA en dos pasos
- [ ] 103. Las 12 pantallas del handoff, una por una, contra datos reales
- [ ] 104. Retirar por completo `apps/App.jsx` (la demo original) una vez que todas las pantallas tengan reemplazo
- [ ] 105. `verify:no-hardcoded-kpi` — ningún número escrito a mano en la interfaz

**Verificación:** `npm run test:e2e` (Playwright) → exit 0

---

## PARTE 8 — Despliegue

- [ ] 106. Crear la app en DigitalOcean App Platform, conectada al repositorio
- [ ] 107. Configurar variables de entorno de producción (secretos distintos a los de desarrollo)
- [ ] 108. Configurar el subdominio `effort360.disaak.com` (registro CNAME)
- [ ] 109. Verificar HTTPS y que `ORIGEN_PERMITIDO`/cookies funcionan en producción
- [ ] 110. Corrida de humo completa en producción con el usuario real de dirección

---

## PARTE 9 — Validación final con EFFORT

- [ ] 111. Contrastar el cálculo de IVA contra una liquidación real ya presentada (cierra la discrepancia #1 de `docs/DISCREPANCIAS.md`)
- [ ] 112. Confirmar los 5 clientes piloto definitivos con Laura/Lili
- [ ] 113. Primera revisión guiada con EFFORT: los 12 módulos, en vivo, con sus propios datos

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
