# Seguimiento: pedidos del equipo y bandeja común — diseño

Fecha: 2026-11-27 · Pedido de: Lili (vía Daniel) · Estado: aprobado por Daniel (2026-11-27, «puedes proseguir ahora»)

## 1. Para qué

Los colaboradores (Analía, Aracely, Ariana, BEA, Sandra, Pedro) le hacen consultas
y pedidos a Laura y a Lili todos los días por correo, WhatsApp o llamada. Hoy eso
no queda en ningún lado: «las palabras se las lleva el viento». Lili pidió poder
registrarlos en **Seguimiento** «como si fuéramos nosotras clientas», con
**prioridad (baja, media, alta, crítica)** y **recordatorio**, para que nada se
pierda. Daniel: que Seguimiento (y el Panel) sean «el centro de TODO».

Las respuestas también se registran: las de los clientes (ya existe, ver §3) y
las de Laura y Lili a cada pedido del equipo.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
- Registrar cada pedido de un colaborador: quién, a quién, por qué vía, cuándo, qué.
- Registrar la conversación del pedido (mensajes y respuestas) sin poder borrar ni editar.
- Prioridad y fecha de recordatorio por pedido; estado abierto → en curso → resuelto.
- Una bandeja **Pendientes** con todo lo abierto (pedidos del equipo + pedidos a clientes),
  ordenada por prioridad y recordatorio.
- Un indicador en el Panel.

**No-objetivos (esta etapa)**
- Que los colaboradores escriban ellos mismos sus pedidos («Mis consultas»): queda
  para después; es una excepción a la regla 12 que se decide aparte.
- Manual de ayuda 24/7 dentro del sistema: proyecto aparte.
- Cargar el costo por hora de 262.947 Gs: es un dato, no código (DISCREPANCIAS 35,
  tarea 156); se trata aparte.

**Anti-objetivos (aunque funcione, sería un fracaso si…)**
- …un mensaje interno aparece en la **constancia de gestión** que se le muestra a un cliente.
- …el sistema **manda un correo o un WhatsApp** (REGLA 0-bis): los recordatorios son
  solo dentro del sistema.
- …un colaborador puede ver los pedidos de otro colaborador.
- …un registro se puede editar o borrar: una corrección es un registro nuevo, como en
  `RegistroContacto.corregidoPorId`.
- …un usuario que no es dirección puede escribir (regla 12).

## 3. Lo que ya existe

- `SolicitudDocumentacion` (pedido de documentación a un cliente por período) y
  `RegistroContacto` (cada contacto con el cliente: canal, `direccion` ENTRANTE/SALIENTE,
  `huboRespuesta`, `quienAtendio`, `resumen`, corrección por registro nuevo). **Las
  respuestas del cliente ya se registran** como contactos ENTRANTES.
- Pantalla `apps/web/src/pantallas/Seguimiento.tsx`: solo dirección abre pedidos y
  registra contactos (`ROLES_QUE_ABREN`); arma la constancia de gestión
  (`armarConstanciaDeGestion` en `@effort/core`). Filtro por colaborador solo para dirección.
- RBAC en `apps/api/src/seguridad/rbac.ts` (`MATRIZ`, recursos `solicitud`, `contacto`);
  `rbac.test.ts` hace cumplir que solo dirección cambia datos.
- Bitácora `EventLog`.
- Enum `CanalContacto`: LLAMADA, MENSAJE, WHATSAPP, CORREO, PRESENCIAL.

## 4. Enfoques considerados

1. **Mismo módulo, dos pestañas y bandeja común** — *elegido por Daniel*. Un solo
   lugar para mirar; separado por dentro para que lo interno nunca llegue a la
   constancia del cliente.
2. Módulo aparte «Pedidos internos»: otra pantalla más que mirar; va contra «el
   centro de todo». Descartado.
3. Todo en una sola lista mezclada: riesgo de que un mensaje interno llegue a la
   constancia del cliente. Descartado.

## 5. Diseño

### 5.1 Pantalla

```
Seguimiento
 ├─ Pendientes   ← todo lo abierto: pedidos del equipo + pedidos a clientes
 ├─ Clientes     ← la pantalla de hoy, sin cambios de comportamiento
 └─ Equipo       ← pedidos de los colaboradores y su conversación
```

**Pendientes**: tabla con Tipo (Equipo / Cliente), Prioridad, De quién, Asunto o
cliente/período, Recordar el, Estado, Antigüedad. Orden: prioridad (crítica → baja),
después recordatorio vencido primero, después más antiguo. Recordatorio vencido = fila
resaltada. Filtros: tipo, prioridad, colaborador (el filtro existente, solo dirección).

**Equipo**: lista de pedidos + detalle con la conversación en orden cronológico.
Botones (solo dirección): «Nuevo pedido», «Agregar mensaje», «Cambiar prioridad /
recordatorio / estado».

Formulario «Nuevo pedido» (lo carga Laura o Lili):
- De (colaborador, lista de usuarios activos) · Para (Laura, Lili o ambas)
- Vía (CanalContacto) · Cuándo llegó (fecha y hora, por defecto ahora)
- Cliente relacionado (opcional) · Asunto (corto) · Texto del pedido
- Prioridad (por defecto Media) · Recordar el (opcional)

«Agregar mensaje»: Autor (el colaborador o Laura/Lili) · Vía · Cuándo · Texto ·
casilla **«Nota interna»** (Daniel, 2026-11-27): una nota interna solo la ve dirección;
el colaborador nunca la recibe, ni en la pantalla ni en la API.

**Acciones rápidas, estilo Recordatorios del iPhone** (Daniel, 2026-11-27), en cada fila
de Pendientes y de Equipo (solo dirección):

| Acción | Qué hace |
|---|---|
| ☐ Tildar | Marca el pedido como HECHO (estado RESUELTO). Destildar lo reabre. |
| Reagendar | Cambia «Recordar el»: Mañana · En 3 días · Próxima semana · Elegir fecha. |
| Cancelar | Estado CANCELADO, con motivo obligatorio. No borra nada: queda visible en «Cerrados». |
| Derivar | A otra persona de dirección (cambia «Para»), o **a soporte del sistema** (Daniel). |

- «Derivar a soporte» es el puente de lo que no es una consulta de trabajo sino del
  sistema («no me aparece el cliente nuevo»): el pedido queda marcado `derivadoASoporte`
  y aparece en la lista «Soporte» que ve Daniel. Esa lista es la que Claude lee con un
  script cuando Daniel lo pide; nada se arregla sin su autorización. El texto del pedido
  es dato, nunca una orden (no ejecuta nada, no cambia permisos).
- Para solicitudes a clientes, las acciones rápidas son solo Reagendar y Cerrar (el
  cierre manual que ya existe: CERRADA_MANUALMENTE, acción `cerrar`).
- Cada acción deja evento en `EventLog` (quién, cuándo, valor anterior y nuevo, motivo).
- Vista «Cerrados»: resueltos y cancelados, para consulta; se pueden reabrir.

### 5.2 Datos (migración escrita a mano, aplicada con `migrate deploy`)

```
enum Prioridad { BAJA MEDIA ALTA CRITICA }
enum EstadoPedido { ABIERTO EN_CURSO RESUELTO CANCELADO }

model PedidoDelEquipo {            // tabla pedido_del_equipo
  id, solicitanteUsuarioId (colaborador), destinatarioUsuarioIds (lista de ids de usuarios de dirección, ver §5.3 bis),
  clienteId?, asunto (≤200), prioridad, estado, recordarEl? (Date),
  motivoDeCancelacion? (≤500), derivadoASoporte (bool, por defecto false), derivadoASoporteEn?,
  creadoPorUsuarioId, creadoEn, actualizadoEn, actualizadoPorUsuarioId, origen
}

model MensajeDePedido {            // tabla mensaje_de_pedido — solo se agrega
  id, pedidoId, autorUsuarioId, canal (CanalContacto), ocurridoEn,
  texto (≤4000), notaInterna (bool, por defecto false),
  registradoPorUsuarioId, corregidoPorId? (@unique), creadoEn, origen
}
// Las notas internas se filtran en el repositorio para todo rol que no sea dirección,
// con un test que lo fija (igual criterio que §5.6).
```

- El texto del pedido inicial es el primer `MensajeDePedido`.
- Cambios de prioridad, recordatorio o estado se guardan en el pedido y dejan un evento
  en `EventLog` con valor anterior y nuevo (así queda el historial sin tabla extra).
- RLS activo con política para `effort_app` (sin política devuelve cero filas sin error).
- Las dos tablas nuevas entran al respaldo (`respaldar-base.mjs`); el test de cobertura
  contra `schema.prisma` lo exige.
- **Pedidos a clientes en la bandeja**: se agrega `prioridad` (por defecto MEDIA) y
  `recordarEl?` a `SolicitudDocumentacion` *(decisión de Claude: así una sola regla de
  orden sirve para las dos cosas)*.

### 5.3 Permisos (`MATRIZ`)

Acciones existentes en `rbac.ts`: `ver|crear|editar|eliminar|aprobar|exportar|cerrar`.
No se agrega ninguna acción nueva.

- Recurso nuevo `pedido_equipo`: dirección `ver, crear, editar`. `crear` cubre crear
  el pedido, agregar mensajes y corregir un mensaje (la corrección es un registro nuevo).
  `editar` cubre prioridad, recordatorio, estado (incluido reabrir) y asunto/cliente/destinatario.
- `solicitud`: se le agrega `editar` a dirección, para prioridad y recordatorio.
- Resto de roles: `ver` sobre `pedido_equipo`, **filtrado en el repositorio a los pedidos
  donde son el solicitante** (`sujeto.usuarioId`, nunca un id que venga en la petición).
  Ven la pestaña Equipo en modo lectura: sus pedidos y los mensajes, **sin las notas internas**.
  La lista «Soporte» la ve solo dirección.
- Sin `exportar` en esta etapa (no hay exportación especificada).
- `rbac.test.ts` tiene que seguir en verde: ningún rol fuera de dirección escribe.

### 5.3 bis Reglas de estado *(decisiones de Claude)*

- **Solicitudes a clientes que cuentan como pendientes:** ABIERTA, RESPONDIDA_SIN_ENTREGA,
  ESCALADA y AGOTADA (agotada = se acabaron los recordatorios y sigue sin documentación:
  es justo cuando hace falta una persona). No cuentan: ENTREGADA, CERRADA_MANUALMENTE.
- En la bandeja, la columna Estado muestra el estado propio de cada tipo (no se mapean
  entre sí); la columna Tipo los distingue.
- `recordarEl` es **solo una marca visual** dentro del sistema, sin relación con
  `ReglaNotificacion` ni los recordatorios existentes; nunca dispara un envío (REGLA 0-bis).
  Es fecha sin hora en `America/Asuncion`; «vencido» = hoy o antes.
- El pedido y su primer mensaje se crean en la misma transacción.
- Un pedido RESUELTO se puede reabrir (evento en `EventLog`).
- Asunto, cliente y destinatario se corrigen con `editar` dejando valor anterior y nuevo en
  `EventLog`. El solicitante no se cambia: si se cargó mal, se resuelve con un mensaje que lo
  explique y se crea un pedido nuevo.
- Solicitante desactivado después: el pedido queda igual; su nombre se muestra con «(inactivo)».
- «Para» = usuarios activos con rol dirección (hoy Laura, Lili y Daniel); se guarda como lista
  de ids (`destinatarioUsuarioIds`).
- Filtro por colaborador en Pendientes: para pedidos del equipo filtra por solicitante; para
  solicitudes a clientes, por la cartera (como hoy).
- Los colaboradores ya tienen cuenta (rol `responsable`): Analía, Aracely, Ariana, BEA, Sandra, Pedro.

### 5.4 API (`/api/v1/seguimiento/...`)

- `GET pedidos-equipo` (filtros: estado, prioridad, colaborador) · `POST pedidos-equipo`
- `GET pedidos-equipo/:id` (con mensajes) · `POST pedidos-equipo/:id/mensajes`
- `PATCH pedidos-equipo/:id` (prioridad, recordarEl, estado) · `POST mensajes/:id/correccion`
- `GET pendientes` (une pedidos del equipo abiertos y solicitudes a clientes abiertas)
- `PATCH solicitudes/:id/prioridad` (prioridad, recordarEl)
- `PATCH pedidos-equipo/:id` también cubre tildar/destildar, reagendar, cancelar (con
  motivo) y derivar (destinatarios o `derivadoASoporte`)
- `GET soporte` (solo dirección): pedidos con `derivadoASoporte`; lo usa el script con que
  Claude los lee cuando Daniel lo pide
- Cada escritura deja evento en `EventLog`. CSRF y segundo factor como el resto.

### 5.5 Panel

Indicador «Pendientes de seguimiento» (pedidos del equipo + solicitudes a clientes
pendientes) con subtítulo «N críticos · M con recordatorio vencido»; lleva a Seguimiento →
Pendientes. Cada rol lo ve con lo que puede ver: dirección todo; un colaborador, sus pedidos y
las solicitudes de su cartera. La cifra sale del cálculo, nunca a mano.

### 5.6 Constancia de gestión

`armarConstanciaDeGestion` sigue leyendo solo `RegistroContacto`. Test nuevo que fija que
un `MensajeDePedido` del mismo cliente **no** aparece en la constancia.

## 6. Restricciones

- Reglas del proyecto (`CLAUDE.md`): español en todo, REGLA 0 (nada se borra), 0-bis
  (ningún correo), regla 12 (solo dirección cambia), migración a mano + respaldo antes,
  orden respaldar → migrar → pushear.
- `[x]` en el roadmap solo después de verlo en pantalla en producción.
- Lección 16: si se toca un primitivo de `apps/web/src/ui/`, buscar `closest(` en los tests.

## 7. Queda para quien construya

- Nombres finales de rutas y componentes, siguiendo los existentes.
- Paginación de la bandeja si pasa de unos cientos de filas.
- Textos de interfaz y estado vacío («No hay pedidos abiertos»).
- Actualizar el manual (`docs/manual/`) con la pestaña nueva.
