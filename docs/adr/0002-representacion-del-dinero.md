# ADR 0002 — Representación del dinero

Fecha: 2026-07-21
Estado: aceptado

## Contexto

EFFORT liquida impuestos con importes reales. Un error de un guaraní en una
determinación de IVA es una diferencia contra la exportación de SIGA que hay
que rastrear a mano; un error sistemático es una presentación mal hecha.

El guaraní no tiene subunidad en circulación: todos los importes operativos son
enteros. Los montos que maneja EFFORT llegan a cientos de millones.

## Decisión

**Todo importe es `bigint`. Nunca `number`, nunca `float`, nunca `parseFloat`.**

Se serializa como `string` en JSON y en la API, y se guarda como `BIGINT` en la
base de datos.

El redondeo ocurre en una sola función, `dividirRedondeado()`, con la regla
confirmada por EFFORT: **desde 0,5 se redondea hacia arriba en magnitud**
(equivalente a `ROUND_HALF_UP` de la librería `decimal` de Python, verificado
contra ella al construir los casos dorados).

Para los negativos se redondea en magnitud y no hacia +infinito. Es decir,
-2,5 da -3 y no -2. Así, un saldo a favor y un saldo a pagar del mismo importe
redondean al mismo valor absoluto. Con la otra convención, arrastrar un crédito
fiscal negativo lo iría erosionando de a un guaraní por período.

## Razones

- Un `number` de JavaScript pierde precisión por encima de 2^53 (9.007.199.254.740.992).
  Un balance con activo de 9 mil millones de guaraníes todavía entra, pero una
  suma intermedia de varios clientes no necesariamente.
- Peor que el rango es la coma flotante: `0.1 + 0.2 !== 0.3`. Con importes
  enteros y `bigint` ese problema no existe por construcción.
- Un solo lugar de redondeo significa un solo lugar donde auditar la regla, y
  un solo lugar donde cambiarla si EFFORT la corrige.

## Consecuencias

- `JSON.stringify` no sabe serializar `bigint`: hay que usar `aTexto()` en el
  borde de la API. El test `dinero.test.ts` verifica que el `TypeError` ocurre,
  para que nadie lo descubra en producción.
- El constructor `gs()` **rechaza decimales** en vez de redondearlos. Si un
  importe llega con decimales desde un Excel, es un problema de la fuente y
  tiene que resolverse ahí, con criterio contable, no silenciosamente.
- Prisma devuelve `BIGINT` como `bigint` en TypeScript: el tipo se mantiene
  desde la base hasta el dominio sin conversión intermedia.

## Alternativas descartadas

- **Enteros en `number`**: alcanza para los montos de hoy, pero deja la puerta
  abierta a que una división introduzca un decimal sin que nadie lo note.
- **Librería decimal (decimal.js, dinero.js)**: resuelve el problema pero agrega
  una dependencia y una API que hay que aprender, para un caso donde el dominio
  es enteros puros. `bigint` es nativo y suficiente.
