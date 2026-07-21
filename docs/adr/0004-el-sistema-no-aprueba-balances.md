# ADR 0004 — El sistema no aprueba balances

Fecha: 2026-07-21
Estado: aceptado

## Contexto

Hoy la revisión de balances de EFFORT depende de una sola persona. Si esa
persona falta una semana, la revisión se pospone. Ese cuello de botella es una
de las razones por las que EFFORT contrató este sistema.

La tentación evidente es que el sistema apruebe automáticamente los balances
que "dan bien". Sería la solución más rápida al problema declarado.

## Decisión

**El sistema nunca aprueba un balance.** Verifica, arma el checklist, marca las
inconsistencias y deja el balance en `LISTO_PARA_REVISION`. La transición a
`APROBADO` exige:

1. cero inconsistencias bloqueantes;
2. un usuario identificado, con rol `revisor_balance` o `direccion`;
3. registro en el `event_log` con nombre y fecha.

`revisarBalance()` tiene como estado máximo sugerido `LISTO_PARA_REVISION` —
por tipo, no puede devolver `APROBADO`. La única función que produce ese estado
es `aprobarBalance()`, y exige los tres requisitos de arriba.

## Razones

- Aprobar un balance es un acto profesional con responsabilidad legal. Quien lo
  firma responde ante DNIT y ante el cliente. Un sistema no puede asumir eso, y
  EFFORT no puede delegarlo.
- Un balance puede cerrar aritméticamente y estar mal: cuentas mal imputadas,
  un gasto personal cargado como gasto de la empresa, una amortización no
  registrada. Ninguna verificación automática detecta eso.
- El cuello de botella real no se resuelve aprobando solo: se resuelve
  **repartiendo la preparación** (que el sistema sí automatiza) y habilitando a
  más de una persona a revisar. Por eso `direccion` también puede aprobar: si
  el revisor principal falta, Lili no queda bloqueada.

## Consecuencias

- El sistema promete "preparar la revisión en minutos en vez de horas", no
  "revisar por vos". Es lo que se le dice a EFFORT y lo que hace el código.
- `balance.test.ts` verifica explícitamente que un auxiliar y un coordinador no
  pueden aprobar, que no se aprueba con bloqueantes, y que no existe aprobación
  anónima.
- Cualquier módulo futuro (incluida una IA de revisión documental) puede
  proponer y señalar, pero entra por el mismo cuello: no hay otra ruta a
  `APROBADO`.
