# Seguimiento: pedidos del equipo y bandeja común — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar en Seguimiento los pedidos que los colaboradores les hacen a Laura y Lili (con su conversación, prioridad y recordatorio) y mostrar en una bandeja «Pendientes» todo lo abierto: pedidos del equipo y pedidos de documentación a clientes.

**Architecture:** Dos tablas nuevas que solo se agregan (`pedido_del_equipo`, `mensaje_de_pedido`), más `prioridad` y `recordar_el` en `solicitud_documentacion`. La regla de orden y de «vencido» vive en `@effort/core` (función pura, un solo lugar). Las rutas nuevas van bajo `/api/v1/seguimiento/`. La pantalla `Seguimiento.tsx` gana tres pestañas: lo que hoy existe pasa a ser «Clientes», sin cambios de comportamiento.

**Tech Stack:** Fastify, Zod, Prisma 6.19.3 sobre PostgreSQL (Supabase), React con Vitest y Testing Library, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-27-seguimiento-pedidos-del-equipo-design.md`. Leelo entero antes de empezar.

## Global Constraints

- Todo en español: código, nombres, comentarios, textos de interfaz (regla 7 de `CLAUDE.md`).
- **REGLA 0:** nada se borra. Sin `DELETE`, ni `deleteMany`, ni método de borrado en los repositorios. Una corrección es un registro nuevo (`corregidoPorId`).
- **REGLA 0-bis:** nada manda correos ni WhatsApp. `recordarEl` es solo una marca visual y nunca dispara un envío.
- **Regla 12:** solo `direccion` escribe. `rbac.test.ts` («solo dirección puede hacer cambios») tiene que seguir en verde sin tocar el test.
- Migración escrita a mano en `apps/api/prisma/migrations/20261127120000_pedidos_del_equipo/migration.sql`. Prohibidos `migrate dev`, `db push` y `migrate diff --shadow-database-url`.
- RLS activo en las tablas nuevas, con política `app_acceso` para `effort_app` (mismo bloque `DO $$` que `20260921120000_registro_de_horas`). Sin `GRANT DELETE`.
- Las dos tablas nuevas entran en `MODELOS_DEL_RESPALDO` (`packages/core/src/modelosDelRespaldo.ts`).
- Límites de texto: asunto ≤ 200, texto de mensaje ≤ 4000, motivo de cancelación ≤ 500. Todos obligatorios y sin espacios en blanco solos (`.trim().min(1)`).
- Fechas: `recordarEl` es `DATE` (sin hora), interpretado en `America/Asuncion`. «Vencido» = `recordarEl` ≤ hoy en Paraguay (`hoyEnParaguay` de `packages/core/src/fechas.ts`).
- Cada escritura deja un evento en `EventLog` vía `registrarEvento`, con `datosAntes` y `datosDespues` cuando cambia algo.
- El orden de despliegue es respaldo, después migración, después push (lección 12). Nada de push ni migración con alguien del equipo conectado (sesiones con `ultimo_uso_en` de los últimos 20 minutos): se pregunta a Daniel.
- `[x]` en el roadmap solo después de verlo en pantalla en producción (lección 14).

## Review Focus

1. **Un colaborador pide por id el pedido de otro colaborador.** Tiene que recibir 404 («Recurso inexistente.»), no 403 ni el pedido. Test en la Tarea 5.
2. **Las notas internas no le llegan a un colaborador por ningún camino:** ni en `GET pedidos-equipo/:id`, ni en `GET pedidos-equipo`, ni en `GET pendientes`. Tests en las Tareas 4 y 5.
3. **«Vencido» cerca de la medianoche.** A las 22:00 de Paraguay ya es el día siguiente en UTC, pero un recordatorio de hoy sigue siendo «hoy», no «ayer». Test en la Tarea 2.
4. **Cancelar con motivo vacío o solo espacios** → 400, y el pedido no cambia. Test en la Tarea 5.
5. **Derivar a alguien que no es de dirección, o que está inactivo** → 400. Test en la Tarea 5.

---

### Task 1: Esquema, migración y respaldo

**Files:**
- Create: `apps/api/prisma/migrations/20261127120000_pedidos_del_equipo/migration.sql`
- Modify: `apps/api/prisma/schema.prisma` (enums y modelos nuevos; campos nuevos en `SolicitudDocumentacion`; relaciones inversas en `Usuario` y `Cliente`)
- Modify: `packages/core/src/modelosDelRespaldo.ts`
- Test: `packages/core/test/modelosDelRespaldo.test.ts` (existe y ya compara la lista contra `schema.prisma`)

**Interfaces:**
- Produces, en Prisma:
  - `enum Prioridad { BAJA MEDIA ALTA CRITICA }`
  - `enum EstadoPedido { ABIERTO EN_CURSO RESUELTO CANCELADO }`
  - `model PedidoDelEquipo` (`@@map("pedido_del_equipo")`), con estos campos:
    - `id`, `solicitanteUsuarioId`
    - `destinatarioUsuarioIds String[] @db.Uuid`
    - `clienteId String?`, `asunto VarChar(200)`
    - `prioridad Prioridad @default(MEDIA)`, `estado EstadoPedido @default(ABIERTO)`
    - `recordarEl DateTime? @db.Date`, `motivoDeCancelacion String? VarChar(500)`
    - `derivadoASoporte Boolean @default(false)`, `derivadoASoporteEn DateTime?`
    - los de auditoría: `creadoPorUsuarioId`, `creadoEn`, `actualizadoEn`, `actualizadoPorUsuarioId`
    - `origen Origen @default(REAL)`
  - `model MensajeDePedido` (`@@map("mensaje_de_pedido")`), con estos campos:
    - `id`, `pedidoId`, `autorUsuarioId`
    - `canal CanalContacto`, `ocurridoEn`, `texto VarChar(4000)`
    - `notaInterna Boolean @default(false)`, `registradoPorUsuarioId`
    - `corregidoPorId String? @unique`, `creadoEn`, `origen`
  - `SolicitudDocumentacion` gana `prioridad Prioridad @default(MEDIA)` y `recordarEl DateTime? @db.Date`.
  - `MODELOS_DEL_RESPALDO` agrega `'pedidoDelEquipo'` y `'mensajeDePedido'`, después de `'registroDeHoras'`.

- [ ] **Step 1: Agregar los modelos a `schema.prisma` y correr el test de cobertura del respaldo**

Run: `npx vitest run packages/core/test/modelosDelRespaldo.test.ts`
Expected: FAIL, porque faltan `pedidoDelEquipo` y `mensajeDePedido` en la lista.

- [ ] **Step 2: Agregarlos a `MODELOS_DEL_RESPALDO` y compilar core**

Run: `npm run build --workspace @effort/core && npx vitest run packages/core/test/modelosDelRespaldo.test.ts`
Expected: PASS

- [ ] **Step 3: Escribir `migration.sql` a mano**

Contenido:
- `CREATE TYPE` para los dos enums;
- `CREATE TABLE` para las dos tablas, con FKs `ON DELETE RESTRICT` a `usuario`, `cliente` y `pedido_del_equipo`;
- un índice en `(estado, prioridad)` y otro en `(solicitante_usuario_id)`;
- índice único en `mensaje_de_pedido.corregido_por_id`;
- `ALTER TABLE "solicitud_documentacion" ADD COLUMN "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA', ADD COLUMN "recordar_el" DATE`;
- un disparador que rechace `DELETE` y `UPDATE` sobre `mensaje_de_pedido`, igual que el de `registro_contacto` (buscalo en las migraciones con `grep -rn "registro_contacto" apps/api/prisma/migrations`);
- RLS más `GRANT SELECT, INSERT, UPDATE` (sin `UPDATE` para `mensaje_de_pedido`) y la política `app_acceso`.

El encabezado del archivo dice «SOLO CREA TABLAS Y AGREGA COLUMNAS CON DEFAULT. No toca datos existentes.»

- [ ] **Step 4: Regenerar el cliente y compilar**

Run: `npx prisma generate --schema apps/api/prisma/schema.prisma && npm run typecheck`
Expected: sin errores. **No** se aplica a producción en esta tarea: eso es la Tarea 9.

- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: esquema y migración de pedidos del equipo (sin aplicar)"`

### Task 2: Orden y «vencido» de la bandeja, en `@effort/core`

**Files:**
- Create: `packages/core/src/pendientes.ts` (exportarlo desde `packages/core/src/index.ts`)
- Test: `packages/core/test/pendientes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  export interface ItemPendiente {
    readonly tipo: 'EQUIPO' | 'CLIENTE';
    readonly id: string;
    readonly prioridad: Prioridad;
    readonly recordarEl: string | null;   // 'AAAA-MM-DD'
    readonly creadoEn: string;            // ISO con hora
  }
  export function recordatorioVencido(recordarEl: string | null, ahora: Date): boolean;
  export function ordenarPendientes<T extends ItemPendiente>(items: readonly T[], ahora: Date): T[];
  export function resumirPendientes(items: readonly ItemPendiente[], ahora: Date):
    { readonly total: number; readonly criticos: number; readonly vencidos: number };
  ```

- [ ] **Step 1: Escribir los tests**

```ts
it('crítica antes que alta, alta antes que media, media antes que baja', ...);
it('a igual prioridad, el recordatorio vencido va primero', ...);
it('a igual prioridad y vencimiento, el más antiguo va primero', ...);
it('un recordatorio de hoy está vencido; uno de mañana no', ...);
// Review Focus 3: 22:00 en Paraguay = 01:00 UTC del día siguiente.
it('a las 22:00 de Paraguay, el recordatorio de mañana todavía no está vencido', () => {
  const ahora = new Date('2026-11-28T01:00:00Z'); // 27/11 22:00 en Asunción (UTC-3)
  expect(recordatorioVencido('2026-11-28', ahora)).toBe(false);
  expect(recordatorioVencido('2026-11-27', ahora)).toBe(true);
});
it('sin recordatorio nunca está vencido', ...);
it('el resumen cuenta críticos y vencidos sobre el total', () => {
  // 3 ítems: 1 CRITICA sin fecha, 1 MEDIA vencida, 1 BAJA futura
  expect(resumirPendientes(items, ahora)).toEqual({ total: 3, criticos: 1, vencidos: 1 });
});
```

- [ ] **Step 2: Run** `npx vitest run packages/core/test/pendientes.test.ts`. Expected: FAIL (el módulo no existe).
- [ ] **Step 3: Implementar.** `recordatorioVencido` compara contra `fechaCivilAIso(hoyEnParaguay(ahora))` como texto. `ordenarPendientes` devuelve una copia y no muta la entrada.
- [ ] **Step 4: Run** de nuevo, más `npm run build --workspace @effort/core`. Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: orden y vencimiento de la bandeja de pendientes"`

### Task 3: Permisos

**Files:**
- Modify: `apps/api/src/seguridad/rbac.ts`
- Test: `apps/api/test/rbac.test.ts`

**Interfaces:**
- Produces:
  - `Recurso` agrega `'pedido_equipo'`;
  - `direccion.pedido_equipo = ['ver', 'crear', 'editar']`;
  - `direccion.solicitud` agrega `'editar'`;
  - el resto de los roles: `pedido_equipo: ['ver']`.

- [ ] **Step 1: Agregar tests a `rbac.test.ts`**

```ts
it('dirección crea y edita pedidos del equipo', () => {
  expect(puede('direccion', 'pedido_equipo', 'crear')).toBe(true);
  expect(puede('direccion', 'pedido_equipo', 'editar')).toBe(true);
});
it('un responsable solo ve pedidos del equipo', () => {
  expect(puede('responsable', 'pedido_equipo', 'ver')).toBe(true);
  expect(puede('responsable', 'pedido_equipo', 'crear')).toBe(false);
});
```

Usá el nombre real del verificador que ya usa el archivo.

- [ ] **Step 2: Run** `npx vitest run apps/api/test/rbac.test.ts`. Expected: FAIL
- [ ] **Step 3: Editar `MATRIZ`**, con un comentario que cite la regla 12 y la spec §5.3.
- [ ] **Step 4: Run** de nuevo. Expected: PASS, incluido «solo dirección puede hacer cambios».
- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: permisos de pedidos del equipo"`

### Task 4: Repositorio de pedidos del equipo

**Files:**
- Modify: `apps/api/src/puertos-dominio.ts` (tipos y puerto)
- Create: `apps/api/src/repositorios/pedidosDelEquipo.ts`
- Modify: `apps/api/test/dobles.ts` (doble en memoria `PedidosDelEquipoFalsos`)
- Test: `apps/api/test/integracion/pedidos-del-equipo.test.ts` (contra Postgres, con el entorno de `integracion/entorno.ts`)

**Interfaces:**
- Produces (en `puertos-dominio.ts`):
  ```ts
  export interface PedidoAlmacenado {
    id; solicitanteUsuarioId; destinatarioUsuarioIds: readonly string[]; clienteId: string | null;
    asunto; prioridad: Prioridad; estado: 'ABIERTO'|'EN_CURSO'|'RESUELTO'|'CANCELADO';
    recordarEl: string | null; motivoDeCancelacion: string | null;
    derivadoASoporte: boolean; derivadoASoporteEn: Date | null; creadoEn: Date; actualizadoEn: Date;
  }
  export interface MensajeAlmacenado {
    id; pedidoId; autorUsuarioId; canal; ocurridoEn: Date; texto; notaInterna: boolean;
    registradoPorUsuarioId; corregidoPorId: string | null; creadoEn: Date;
  }
  export interface AltaDePedido { solicitanteUsuarioId; destinatarioUsuarioIds; clienteId; asunto;
    prioridad; recordarEl; primerMensaje: { canal; ocurridoEn: Date; texto }; registradoPorUsuarioId }
  export type CambioDePedido = Partial<Pick<PedidoAlmacenado,
    'prioridad'|'estado'|'recordarEl'|'motivoDeCancelacion'|'destinatarioUsuarioIds'|'derivadoASoporte'|'asunto'|'clienteId'>>;
  /** `null` = dirección (ve todo); un id = solo los pedidos de ese solicitante, sin notas internas. */
  export type AlcanceDePedidos = { readonly todo: true } | { readonly soloDe: string };
  export interface RepositorioDePedidosDelEquipo {
    crear(alta: AltaDePedido): Promise<PedidoAlmacenado>;              // pedido + primer mensaje en una transacción
    listar(alcance: AlcanceDePedidos, filtro: { estados?: readonly string[] }): Promise<PedidoAlmacenado[]>;
    buscar(id: string, alcance: AlcanceDePedidos): Promise<{ pedido: PedidoAlmacenado; mensajes: MensajeAlmacenado[] } | null>;
    agregarMensaje(pedidoId: string, datos: Omit<MensajeAlmacenado, 'id'|'pedidoId'|'corregidoPorId'|'creadoEn'>): Promise<MensajeAlmacenado>;
    corregirMensaje(mensajeId: string, datos: Omit<MensajeAlmacenado, 'id'|'pedidoId'|'corregidoPorId'|'creadoEn'>): Promise<MensajeAlmacenado>;
    cambiar(id: string, cambio: CambioDePedido, usuarioId: string): Promise<PedidoAlmacenado>;
    listarDerivadosASoporte(): Promise<PedidoAlmacenado[]>;
  }
  ```
  El alcance `soloDe` filtra `solicitanteUsuarioId` **y** quita los mensajes con `notaInterna` dentro del repositorio, nunca en la ruta. `corregirMensaje` crea el mensaje nuevo y marca `corregidoPorId` en el viejo con SQL crudo de una sola columna; si el disparador lo impide, la corrección se modela al revés (el nuevo apunta al viejo con `corrige_a_id`), y se anota la decisión en la spec. Si el mensaje ya estaba corregido → `ErrorDeAplicacion(409, 'Ese mensaje ya fue corregido.', 'ya_corregido')`.
- Añadir `readonly pedidosDelEquipo: RepositorioDePedidosDelEquipo` a `Dependencias` en `servidor.ts`, `new PedidosDelEquipoPrisma(prisma)` en `index.ts`, y el doble en los 5 armados de tests (`grep -rn "contactos: new ContactosFalsos()" apps/api/test`).

- [ ] **Step 1: Tests de integración**

```ts
it('crea el pedido y su primer mensaje juntos', ...);           // buscar() trae 1 mensaje con el texto
it('un colaborador solo ve sus pedidos', ...);                   // listar({soloDe: A}) no trae el de B
it('un colaborador no ve las notas internas de su pedido', ...); // Review Focus 2
it('buscar un pedido ajeno con soloDe devuelve null', ...);      // Review Focus 1
it('la base rechaza borrar un mensaje', async () => {
  await expect(entorno.prisma.$executeRaw`DELETE FROM mensaje_de_pedido WHERE id = ${id}::uuid`).rejects.toThrow();
});
it('corregir dos veces el mismo mensaje falla', ...);
```

- [ ] **Step 2: Run** `npx vitest run apps/api/test/integracion/pedidos-del-equipo.test.ts`. Expected: FAIL. Antes aplicá la migración **solo a la base de tests**, igual que las otras (mirá cómo lo hace `entorno.ts`); si la base de tests es producción, **parar y preguntar a Daniel**.
- [ ] **Step 3: Implementar `PedidosDelEquipoPrisma`, el doble y el cableado.**
- [ ] **Step 4: Run** de nuevo, más `npm run typecheck`. Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: repositorio de pedidos del equipo"`

### Task 5: Rutas de pedidos del equipo

**Files:**
- Create: `apps/api/src/rutas/seguimiento.ts` (`registrarRutasDeSeguimiento(app, deps)`, registrada en `index.ts` y en `servidor.test`/`modulos.test` como las demás)
- Modify: `apps/api/src/bitacora.ts` (acciones)
- Test: `apps/api/test/seguimiento.test.ts` (con dobles y `await activarCsrfEnInject(app)`; dirección completa el TOTP como en `modulos.test.ts`)

**Interfaces:**
- Consumes: `RepositorioDePedidosDelEquipo` (Tarea 4), `autorizar(peticion, 'pedido_equipo', ...)`, `deps.usuarios` para validar destinatarios.
- Produces:
  - `ACCIONES`:
    - `PEDIDO_EQUIPO_CREADO: 'pedido_equipo.creado'`
    - `PEDIDO_EQUIPO_MENSAJE: 'pedido_equipo.mensaje_agregado'`
    - `PEDIDO_EQUIPO_MENSAJE_CORREGIDO: 'pedido_equipo.mensaje_corregido'`
    - `PEDIDO_EQUIPO_CAMBIADO: 'pedido_equipo.cambiado'`
  - Rutas:
    - `GET /api/v1/seguimiento/pedidos-equipo?estado=ABIERTO,EN_CURSO&prioridad=&colaborador=` → `{ pedidos: PedidoSalida[] }`.
    - `POST /api/v1/seguimiento/pedidos-equipo` → 201 `{ pedido }`. Cuerpo: `{ solicitanteUsuarioId, destinatarioUsuarioIds (≥1), clienteId|null, asunto, prioridad='MEDIA', recordarEl|null, canal, ocurridoEn, texto }`.
    - `GET /api/v1/seguimiento/pedidos-equipo/:id` → `{ pedido, mensajes }`.
    - `POST /api/v1/seguimiento/pedidos-equipo/:id/mensajes` → 201 `{ mensaje }`. Cuerpo: `{ autorUsuarioId, canal, ocurridoEn, texto, notaInterna=false }`.
    - `POST /api/v1/seguimiento/mensajes/:id/correccion` → 201 `{ mensaje }`.
    - `PATCH /api/v1/seguimiento/pedidos-equipo/:id` → `{ pedido }`. Cuerpo: unión discriminada por `accion`:
      - `{accion:'tildar'}` → RESUELTO;
      - `{accion:'destildar'}` → ABIERTO;
      - `{accion:'en_curso'}`;
      - `{accion:'reagendar', recordarEl: 'AAAA-MM-DD'|null}`;
      - `{accion:'cancelar', motivo}`;
      - `{accion:'reabrir'}` (desde CANCELADO o RESUELTO);
      - `{accion:'prioridad', prioridad}`;
      - `{accion:'derivar', destinatarioUsuarioIds}`;
      - `{accion:'derivar_a_soporte'}`;
      - `{accion:'corregir', asunto?, clienteId?}`.
    - `GET /api/v1/seguimiento/soporte` → `{ pedidos }`, con `autorizar(..., 'pedido_equipo', 'editar')` para que sea solo dirección.
  - `PedidoSalida` agrega `solicitanteNombre` y `destinatarioNombres`, con «(inactivo)» al final si el usuario está inactivo.
  - El alcance sale **siempre** de la sesión: dirección → `{todo:true}`; cualquier otro → `{soloDe: sujeto.usuarioId}`. El parámetro `colaborador` se ignora si no es dirección.

- [ ] **Step 1: Tests**

```ts
it('dirección crea un pedido y queda el evento pedido_equipo.creado', ...);
it('un responsable no puede crear pedidos (403)', ...);
it('un responsable no ve el pedido de otro colaborador: 404', ...);        // Review Focus 1
it('un responsable ve su pedido sin las notas internas', ...);             // Review Focus 2
it('cancelar sin motivo o con espacios devuelve 400 y no cambia nada', ...); // Review Focus 4
it('derivar a alguien que no es dirección o está inactivo devuelve 400', ...); // Review Focus 5
it('tildar deja RESUELTO, destildar lo reabre, y cada cambio guarda antes y después', ...);
it('derivar a soporte lo hace aparecer en GET soporte, que un responsable no puede ver (403)', ...);
it('la constancia de gestión del cliente no incluye mensajes de pedidos del equipo', ...); // spec §5.6, contra GET de la constancia existente en rutas/contactos.ts
it('el texto de un pedido es dato: un texto con «borrá todo» o código se guarda tal cual y no ejecuta nada', ...);
```

- [ ] **Step 2: Run** `npx vitest run apps/api/test/seguimiento.test.ts`. Expected: FAIL
- [ ] **Step 3: Implementar.** Esquemas Zod `.strict()`, límites de la spec, `ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado')` para lo ajeno o inexistente, y `409 'transicion_invalida'` para, por ejemplo, tildar un pedido cancelado.
- [ ] **Step 4: Run** de nuevo, más `npx vitest run apps/api/test/modulos.test.ts apps/api/test/servidor.test.ts`. Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: rutas de pedidos del equipo"`

### Task 6: Prioridad de solicitudes a clientes y bandeja «Pendientes»

**Files:**
- Modify: `apps/api/src/puertos-dominio.ts` (`SolicitudAlmacenada` gana `prioridad` y `recordarEl: string | null`, y `RepositorioDeSolicitudes` gana `cambiarPrioridad(id, { prioridad?, recordarEl? }, usuarioId)`)
- Modify: el repositorio Prisma de solicitudes (`grep -rn "class SolicitudesPrisma" apps/api/src`) y `SolicitudesFalsas` en `apps/api/test/dobles-dominio.ts`
- Modify: `apps/api/src/rutas/seguimiento.ts`, `apps/api/src/bitacora.ts` (`SOLICITUD_PRIORIDAD_CAMBIADA: 'solicitud.prioridad_cambiada'`)
- Test: `apps/api/test/seguimiento.test.ts`

**Interfaces:**
- Consumes: `ordenarPendientes`, `resumirPendientes` (Tarea 2).
- Produces:
  - `PATCH /api/v1/seguimiento/solicitudes/:id/prioridad`, con `autorizar('solicitud','editar')` y cuerpo `{ prioridad?, recordarEl? }`.
  - `GET /api/v1/seguimiento/pendientes` → `{ items: ItemDeBandeja[], resumen: { total, criticos, vencidos } }`.
  - `ItemDeBandeja` es `ItemPendiente` más:
    - `estado`, `titulo`, `deQuien`, `clienteId`, `periodo|null`;
    - para EQUIPO: `titulo` = asunto y `deQuien` = solicitanteNombre;
    - para CLIENTE: `titulo` = «Documentación AAAA-MM» y `deQuien` = nombre del cliente.
  - Qué entra en la bandeja:
    - pedidos ABIERTO y EN_CURSO, según el alcance;
    - solicitudes ABIERTA, RESPONDIDA_SIN_ENTREGA, ESCALADA y AGOTADA de la cartera (`filtroDeClientes(sujeto)`), de **todos** los períodos.

- [ ] **Step 1: Tests**

```ts
it('la bandeja une pedidos abiertos y solicitudes pendientes, ordenados por prioridad', ...);
it('una solicitud ENTREGADA o CERRADA_MANUALMENTE no entra en la bandeja', ...);
it('una solicitud AGOTADA sí entra', ...);
it('un responsable ve en la bandeja solo sus pedidos y las solicitudes de su cartera', ...);
it('cambiar la prioridad de una solicitud deja el evento con antes y después', ...);
it('un responsable no puede cambiar la prioridad de una solicitud (403)', ...);
```

- [ ] **Step 2: Run** `npx vitest run apps/api/test/seguimiento.test.ts`. Expected: FAIL
- [ ] **Step 3: Implementar.** Solicitudes, con un solo `findMany` por estados, para evitar el N+1 (ver el comentario en `RepositorioDeContactos.listarDelPeriodo`).
- [ ] **Step 4: Run** de nuevo, más `npx vitest run apps/api/test`. Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: bandeja de pendientes y prioridad de solicitudes"`

### Task 7: Pantalla Seguimiento con tres pestañas

**Files:**
- Create: `apps/web/src/api/seguimiento.ts` (funciones `listarPendientes`, `listarPedidosDelEquipo`, `obtenerPedido`, `crearPedido`, `agregarMensaje`, `corregirMensaje`, `cambiarPedido`, `cambiarPrioridadDeSolicitud`, `listarSoporte`, que reflejan la Tarea 5 y la 6 con `peticion` de `./cliente.js`)
- Create: `apps/web/src/pantallas/seguimiento/Pendientes.tsx`, `apps/web/src/pantallas/seguimiento/Equipo.tsx`, `apps/web/src/pantallas/seguimiento/AccionesRapidas.tsx`
- Modify: `apps/web/src/pantallas/Seguimiento.tsx`. El contenido actual pasa a la pestaña «Clientes» sin cambiar su lógica. Se agregan la prop `pestanaInicial?: 'pendientes'|'clientes'|'equipo'` (por defecto `'pendientes'`) y una barra de pestañas con `role="tablist"`.
- Test: `apps/web/test/Seguimiento.test.tsx` (los tests existentes se adaptan para abrir la pestaña «Clientes») y `apps/web/test/SeguimientoEquipo.test.tsx`

**Interfaces:**
- Consumes: rutas de las Tareas 5 y 6; `useSesion`; `listarUsuarios` (solo dirección) para «De» y «Para»; `CampoSelect` y los primitivos de `../ui/Primitivos.jsx` **sin modificarlos** (lección 16).
- Produces:
  - Textos fijos:
    - pestañas «Pendientes», «Clientes», «Equipo»;
    - botones «Nuevo pedido», «Agregar mensaje»;
    - casilla «Nota interna»;
    - acciones «Tildar», «Reagendar» (opciones «Mañana», «En 3 días», «Próxima semana», «Elegir fecha»), «Cancelar», «Derivar», «Derivar a soporte»;
    - estado vacío «No hay pedidos abiertos»;
    - vista «Cerrados».
  - Fila con recordatorio vencido: clase de resaltado y el texto «Vencido».
  - Con `ROLES_QUE_ABREN` ya existente: sin dirección no se ven ni botones ni acciones.

- [ ] **Step 1: Tests**

```tsx
it('abre en Pendientes y muestra primero lo crítico', ...);
it('un recordatorio vencido se ve marcado como «Vencido»', ...);
it('dirección crea un pedido desde «Nuevo pedido» y aparece en la lista', ...);
it('tildar manda {accion:"tildar"} y el pedido sale de Pendientes', ...);
it('cancelar pide motivo y no deja confirmar vacío', ...);
it('un responsable ve la pestaña Equipo sin botones ni acciones', ...);
it('la pestaña Clientes sigue mostrando la tabla de hoy', ...); // los tests viejos
```

- [ ] **Step 2: Run** `npx vitest run apps/web/test/Seguimiento.test.tsx apps/web/test/SeguimientoEquipo.test.tsx` desde la raíz del repo, no desde `apps/web`. Expected: FAIL
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run** de nuevo, más `npm run verify:web-typecheck`. Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "Seguimiento: pestañas Pendientes, Clientes y Equipo"`

### Task 8: Indicador del Panel

**Files:**
- Modify: `apps/web/src/pantallas/Panel.tsx`
- Modify: `apps/web/src/Aplicacion.tsx`, para que `irA('seguimiento', { pestana: 'pendientes' })` llegue a `pestanaInicial` (mirá cómo viaja hoy `colaboradorInicial`)
- Test: `apps/web/test/Panel.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/seguimiento/pendientes` → `resumen`.
- Produces:
  - `IndicadorAnimado` con etiqueta «Pendientes de seguimiento», valor `resumen.total` y subtítulo «N críticos · M con recordatorio vencido»;
  - `tono="critico"` y `destacado` si `criticos > 0`;
  - `onIr` lleva a Seguimiento, pestaña Pendientes.

- [ ] **Step 1: Test**

```tsx
it('muestra los pendientes de seguimiento con críticos y vencidos, y lleva a Seguimiento', ...);
```

Ubicá la tarjeta como lo hacen los otros tests del Panel (`closest('div')`).

- [ ] **Step 2: Run** `npx vitest run apps/web/test/Panel.test.tsx`. Expected: FAIL
- [ ] **Step 3: Implementar.** Un error de ese pedido no tumba el Panel: el indicador muestra «—».
- [ ] **Step 4: Run** de nuevo. Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "Panel: indicador de pendientes de seguimiento"`

### Task 9: Despliegue, verificación en pantalla y documentación

**Files:**
- Modify: `docs/ROADMAP-MAESTRO.md` (tarea nueva más una entrada de bitácora), `docs/manual/` (sección de Seguimiento → Equipo y Pendientes)

- [ ] **Step 1:** `npm run verify`. Expected: todas las etapas OK. Si algo falla, mirar qué falló antes de decir «es la red» (lección 15).
- [ ] **Step 2: Revisar que no haya nadie conectado.** Leer con una consulta de sesiones con `ultimo_uso_en` de los últimos 20 minutos. Si hay alguien, parar y preguntar a Daniel.
- [ ] **Step 3: Respaldo.** `node scripts/respaldar-base.mjs`. Expected: «respaldo-….json» con el total de filas.
- [ ] **Step 4: Migración.** `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`. Expected: «1 migration applied». Escribir antes las tres preguntas de `CLAUDE.md`.
- [ ] **Step 5: Publicar.** `git push`, y después `node scripts/esperar-despliegue.mjs` con un marcador que exista en `apps/web/dist/assets/*.js` (por ejemplo «Pendientes de seguimiento»).
- [ ] **Step 6: Verificar en producción** con la sesión de Daniel:
  - crear un pedido de prueba con la etiqueta «PRUEBA — Daniel»;
  - tildarlo, reagendarlo y cancelarlo con el motivo «prueba de Claude»;
  - ver el indicador del Panel.

  No se borra: queda cancelado.
- [ ] **Step 7:** Marcar `[x]` en el roadmap solo después del Step 6. Commit y push de la documentación.
