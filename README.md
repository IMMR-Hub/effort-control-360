# EFFORT Control 360

Capa de control operativo sobre SIGA, OneDrive y las planillas de EFFORT
Consultora. No reemplaza SIGA ni toma decisiones contables: muestra qué falta,
qué vence, qué ya fue cargado, qué fue enviado, quién lo tiene y cuál es la
próxima acción.

Piloto: **5 clientes, períodos enero a junio de 2026.**

---

## Estado de construcción

Este repositorio está en fabricación. Lo que hay hoy:

| Parte | Estado |
|---|---|
| Monorepo (npm workspaces) | Listo |
| `packages/core` — motor contable | Listo, 118 tests |
| Casos dorados contables | Listos, 52 casos |
| Design tokens de marca | Listos |
| `packages/schema` — entidades | Pendiente |
| `apps/api` — backend, auth, RBAC | Pendiente |
| `packages/drive` — OneDrive/Graph | Pendiente |
| `packages/importers` — XLSX/CSV | Pendiente |
| `apps/web` — interfaz | Contiene todavía la demo anterior, con datos inventados |

`apps/web` sigue mostrando la demo comercial previa. Sus cifras son inventadas y
se eliminan cuando la interfaz pase a consumir la API. Hasta entonces, **nada de
lo que muestra esa pantalla es un dato real de EFFORT.**

---

## Requisitos

- Node.js 20.11 o superior (probado en 24.14)
- npm 10 o superior (probado en 11.9)

## Instalación

```bash
npm install
```

## Verificación

Un solo comando decide si el sistema está sano:

```bash
npm run verify
```

Corre typecheck, tests, casos dorados contables, auditoría de dependencias y
build; escribe `verify-report.json` y devuelve exit 0 solo si todo pasó. Los
checks que todavía no tienen sobre qué correr aparecen como `PENDIENTE` en vez
de desaparecer del reporte.

Comandos sueltos:

```bash
npm run typecheck          # tsc --build sobre todos los paquetes
npm run test:unit          # toda la suite
npm run test:watch         # suite en modo watch
npm run verify:accounting  # solo los casos dorados contables
npm run dev                # interfaz en http://localhost:5173
```

---

## Los casos dorados

`packages/core/test/fixtures/golden/*.json` son el contrato contable del
sistema, escrito en datos y no en código: se pueden leer sin saber programar y
cada archivo cita la fuente de la regla que codifica.

- `redondeo.json` — redondeo a guaraní entero (desde 0,5 hacia arriba)
- `iva-desglose.json` — IVA incluido: 10% = total/11, 5% = total/21
- `iva-determinacion.json` — débito menos crédito menos saldo a favor arrastrado
- `vencimientos.json` — días restantes y nivel de alerta en zona Paraguay

Si una de estas expectativas cambia, tiene que ser porque cambió la regla
contable, nunca porque cambió el código. Están fuera del código justamente para
que EFFORT pueda revisarlas.

---

## Reglas que el sistema no rompe

1. **El dinero es entero.** Guaraníes como `bigint`, nunca `number`. El
   constructor rechaza decimales en vez de redondear en silencio.
   Ver `docs/adr/0002-representacion-del-dinero.md`.
2. **El sistema no aprueba balances.** Prepara la revisión; la aprobación es un
   acto humano registrado, con nombre y fecha.
   Ver `docs/adr/0004-el-sistema-no-aprueba-balances.md`.
3. **Los vencimientos se calculan en `America/Asuncion`**, con la base horaria
   IANA y no con un offset fijo.
4. **No se toca SIGA.** Se trabaja sobre sus exportaciones Excel/CSV/PDF.
5. **No se borra nada en OneDrive.** El sistema lee de la carpeta de EFFORT y
   escribe únicamente en su propia subcarpeta de salidas.
6. **Ninguna cifra de la interfaz está escrita a mano.** Toda sale de un
   cálculo sobre datos importados.

---

## Qué falta para conectar los datos reales

Ver `docs/DISCREPANCIAS.md`. En resumen:

1. EFFORT crea la cuenta de sistema y comparte la carpeta raíz de OneDrive.
2. EFFORT confirma los 5 clientes piloto.
3. Se contrasta el cálculo de IVA contra una liquidación real ya presentada.
4. Se cargan los archivos de los 6 períodos en la estructura de 14 carpetas.

---

## Alcance de esta etapa

**Incluido:** control documental, proceso mensual, vencimientos, conciliación
contra exportaciones de SIGA, liquidaciones, revisión previa de balances,
alertas, equipo y roles, historial de eventos.

**No incluido:** OCR de facturas, carga automática a SIGA, integración con API
de SIGA, WhatsApp Business API, portal de cliente, app móvil, aprobación
automática de balances.

El extractor de facturas con IA queda previsto como contrato (`ExtractorPort`)
para poder conectarse después sin rehacer nada, pero no se implementa en esta
etapa.
