# Roadmap maestro — EFFORT Control 360

**Este archivo es la fuente de verdad del avance del proyecto.**

Si estás retomando esto en una conversación nueva de Claude Code, decile:

> Leé `docs/ROADMAP-MAESTRO.md` y `docs/DISCREPANCIAS.md` en el repo
> `effort-control-360`, y seguí desde la primera tarea sin marcar.

Con eso alcanza — no hace falta reexplicar el contexto del proyecto. Este
archivo y `docs/DISCREPANCIAS.md` son la memoria persistente.

**Regla de este documento:** cada tarea se marca `[x]` recién cuando el
`npm run verify` de esa etapa corrió en verde y quedó commiteado en git. Una
tarea marcada sin commit real detrás es peor que no marcarla — hace perder
confianza en todo el resto del documento.

Última actualización: 2026-07-22 · Commit de referencia: ver último commit en `git log`

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

- [ ] 56. Implementar `RepositorioDeUsuarios` contra Prisma
- [ ] 57. Implementar `RepositorioDeSesiones` contra Prisma
- [ ] 58. Implementar `RepositorioDeClientes` contra Prisma (con el filtro de cartera real, vía tabla `asignacion_cliente`)
- [ ] 59. Implementar `RepositorioDeContactos` contra Prisma
- [ ] 60. Implementar `RepositorioDeBitacora` contra Prisma
- [ ] 61. Cablear `apps/api/src/index.ts` con las implementaciones reales (hoy usa las interfaces sin implementación)
- [ ] 62. Tests de integración de cada repositorio contra la base real de Supabase
- [ ] 63. Verificar en Supabase que las políticas RLS no bloquean al rol de la aplicación (dijimos activarlas como defensa en profundidad)

**Verificación:** `npm run test:integration` → exit 0 contra la base real

---

## PARTE 4 — Módulos de negocio restantes (rutas + Prisma)

- [ ] 64. Módulo Documentos: rutas + repositorio (recepción, canal, estado, evidencia)
- [ ] 65. Módulo Proceso Mensual: rutas + repositorio (el tablero operativo principal)
- [ ] 66. Módulo Exportaciones SIGA: rutas + repositorio + conciliación aplicada
- [ ] 67. Módulo Liquidaciones: rutas + repositorio
- [ ] 68. Módulo Balances: rutas + repositorio, con la aprobación humana obligatoria del ADR 0004
- [ ] 69. Módulo Vencimientos: rutas + repositorio + cálculo de alertas por umbral
- [ ] 70. Módulo Alertas: vista consolidada ordenada por criticidad
- [ ] 71. Módulo Equipo/Roles: alta y edición de usuarios (solo dirección)
- [ ] 72. Módulo Reglas Impositivas: edición de tasas de IVA (solo dirección)
- [ ] 73. Módulo Reglas de Notificación: alta/edición de reglas de recordatorio (ya tiene motor, falta la ruta)
- [ ] 74. Módulo Event Log: consulta filtrable del historial (solo dirección/revisor)

**Verificación de cada módulo:** su propio archivo de test de integración en verde antes de pasar al siguiente

---

## PARTE 5 — Importadores desde OneDrive

- [ ] 75. Registrar la aplicación en Azure AD (requiere que EFFORT cree la cuenta `sistema.effort360@...`)
- [ ] 76. Implementar `packages/drive` — adaptador Microsoft Graph API + adaptador falso para tests
- [ ] 77. Espejo automático hacia el OneDrive de respaldo, con manifiesto sha256
- [ ] 78. Importador de comprobantes (Excel/CSV) con reporte de filas aceptadas/rechazadas
- [ ] 79. Importador de exportaciones SIGA
- [ ] 80. Modo simulación (`dry-run`) obligatorio antes de escribir en la base
- [ ] 81. Idempotencia verificada: importar el mismo archivo dos veces no duplica

**Verificación:** `npm run verify:drive` → exit 0 contra el adaptador real (o falso si Azure AD no está listo)

---

## PARTE 6 — Despachador de notificaciones

- [ ] 82. Proveedor de envío de correo (a definir: Resend, SES, o el que EFFORT prefiera)
- [ ] 83. Job programado que corre `planificarProximoRecordatorio` sobre todas las solicitudes abiertas
- [ ] 84. Registro automático en `registro_contacto` con `origen=AUTOMATICO` por cada envío real
- [ ] 85. Registro en `envio_notificacion` con el id del proveedor, para poder auditar contra su panel
- [ ] 86. Manejo de fallos de envío (reintento, alerta a dirección si un correo rebota)

**Verificación:** test de integración con proveedor de correo en modo sandbox

---

## PARTE 7 — Interfaz completa contra la API real

- [ ] 87. Cliente HTTP tipado en `apps/web`, con manejo de sesión/CSRF
- [ ] 88. Reemplazar `datos-semilla/` por llamadas reales a la API
- [ ] 89. Pantalla de login con flujo de 2FA en dos pasos
- [ ] 90. Las 12 pantallas del handoff, una por una, contra datos reales
- [ ] 91. Retirar por completo `apps/App.jsx` (la demo original) una vez que todas las pantallas tengan reemplazo
- [ ] 92. `verify:no-hardcoded-kpi` — ningún número escrito a mano en la interfaz

**Verificación:** `npm run test:e2e` (Playwright) → exit 0

---

## PARTE 8 — Despliegue

- [ ] 93. Crear la app en DigitalOcean App Platform, conectada al repositorio
- [ ] 94. Configurar variables de entorno de producción (secretos distintos a los de desarrollo)
- [ ] 95. Configurar el subdominio `effort360.disaak.com` (registro CNAME)
- [ ] 96. Verificar HTTPS y que `ORIGEN_PERMITIDO`/cookies funcionan en producción
- [ ] 97. Corrida de humo completa en producción con el usuario real de dirección

---

## PARTE 9 — Validación final con EFFORT

- [ ] 98. Contrastar el cálculo de IVA contra una liquidación real ya presentada (cierra la discrepancia #1 de `docs/DISCREPANCIAS.md`)
- [ ] 99. Confirmar los 5 clientes piloto definitivos con Laura/Lili
- [ ] 100. Primera revisión guiada con EFFORT: los 12 módulos, en vivo, con sus propios datos

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
