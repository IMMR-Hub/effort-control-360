# Discrepancias y confirmaciones pendientes con EFFORT

Toda regla que el sistema aplica sobre dinero, plazos o estados y que todavía no
fue contrastada contra un documento real de EFFORT se anota acá. Ninguna se
resuelve por criterio propio: se confirma con Laura o Lili, o se deja marcada.

---

## 1. Divisores de IVA — CONFIRMADO VERBALMENTE, FALTA CONTRASTE DOCUMENTAL

**Regla aplicada:** IVA 10% = total / 11 · IVA 5% = total / 21 · redondeo desde
0,5 hacia arriba, resultado en guaraníes enteros.

**Estado:** confirmado por EFFORT vía Daniel (jul-2026). Falta el contraste
contra un documento ya presentado.

**Cómo se cierra:** tomar **una liquidación real de un cliente, de un período ya
cerrado y presentado**, cargarla en el sistema y comparar el IVA calculado
contra el de la liquidación, comprobante por comprobante. Si coincide al
guaraní en todos, la regla queda cerrada y se quita
`requiere_confirmacion_cliente` de la tabla `regla_impositiva`.

**Por qué importa:** es la única regla del sistema que mueve dinero y que
todavía no se validó contra un documento que la DNIT ya recibió. Si el criterio
de redondeo de EFFORT difiere en algún caso de borde, es mejor descubrirlo con
una liquidación vieja que con una nueva.

---

## 2. Redondeo de importes negativos — DECISIÓN TOMADA, CONVIENE VALIDAR

**Regla aplicada:** -2,5 redondea a -3 (en magnitud), no a -2.

**Dónde aparece:** notas de crédito y saldos de IVA a favor arrastrados.

**Por qué se eligió así:** para que un saldo a favor y un saldo a pagar del mismo
importe redondeen al mismo valor absoluto. Con la convención alternativa, un
crédito fiscal arrastrado se erosionaría de a un guaraní por período.

**Cómo se cierra:** mostrar a EFFORT una nota de crédito real con importe que
caiga justo en la mitad y confirmar el criterio. Ver
`docs/adr/0002-representacion-del-dinero.md`.

---

## 3. Clientes piloto — SIN CONFIRMAR

El handoff lista: GARSO S.A., LAURA SOSA, RAMIRO GARCIA, GERARDO SOSA,
NR REGISTROS GANADEROS. El propio handoff pide confirmarlos antes de cargar la
estructura final.

**Cómo se cierra:** confirmación de Laura o Lili. Si cambian, cambian filas de
datos, no código.

---

## 4. Período del piloto — DEFINIDO, FALTA CONFIRMAR CON EFFORT

**Definido con Daniel (jul-2026):** enero a junio de 2026, los mismos 6 períodos
para los 5 clientes. Seis períodos por cinco clientes son 30 filas de proceso
mensual.

**Cómo se cierra:** confirmar que EFFORT tenga los 6 períodos completos y
cerrados para los 5 clientes. Si algún cliente arranca más tarde, se registra
como período no aplicable en vez de quedar como faltante.

---

## 5. Umbrales de alerta de vencimientos — VALOR POR DEFECTO

**Regla aplicada:** 30 / 15 / 7 / 2 días y vencido.

Viene de `Proximos_Pasos_EFFORT_Control_360.md`, sección 14. Cada obligación
puede sobreescribirlo con su propio `dias_alerta`.

**Cómo se cierra:** revisar con EFFORT obligación por obligación. Una
presentación ante Abogacía probablemente necesite más de 30 días de aviso: la
multa de Gs. 6.000.000 sugiere que el problema fue enterarse tarde, no
olvidarse el último día.

---

## 6. Acceso a OneDrive — DEFINIDO, FALTA EJECUTAR

**Definido:** cuenta de sistema dedicada (`sistema.effort360@...`) con licencia
Microsoft 365 Business Basic (USD 7/usuario/mes desde julio 2026), acceso vía
Microsoft Graph API con registro de aplicación en Azure AD.

**Por qué una cuenta dedicada y no la de Laura o Lili:** si el sistema usa una
cuenta personal, un cambio de contraseña o un reseteo de 2FA lo deja sin acceso
sin aviso, y los permisos quedan atados a una persona en vez de a la empresa.

**Cómo se cierra:** EFFORT crea el usuario, comparte la carpeta raíz
`EFFORT CONTROL 360 - PILOTO` con esa cuenta como editor, y se registra la app
en Azure AD. Hasta entonces el adaptador de OneDrive corre contra un doble de
prueba y `verify:drive` valida contra ese doble, no contra la nube real.

---

## 7. Rol de aplicación en producción — DEFINIDO, FALTA ASIGNAR CONTRASEÑA

**Estado:** el rol `effort_app` ya existe en Supabase con los permisos mínimos y
sus políticas RLS, pero está creado **sin contraseña y NOLOGIN** a propósito:
una contraseña en un archivo de migración queda en el historial de git para
siempre.

**Qué puede y qué no** (verificado con `SET ROLE`, las 9 comprobaciones pasan):

| Operación | `effort_app` |
|---|---|
| Leer, insertar y actualizar datos de negocio | Sí |
| Insertar en `event_log` | Sí |
| Actualizar o borrar `event_log` | **No** |
| Borrar en `registro_contacto` | **No** |
| Borrar en cualquier tabla | **No** |

**Cómo se cierra**, en el despliegue (Parte 8):

```sql
ALTER ROLE effort_app WITH LOGIN PASSWORD '<generada en el despliegue>';
```

Y en producción:
- `DATABASE_URL` (la app en marcha) usa **`effort_app`**.
- `DIRECT_URL` (las migraciones) sigue usando el dueño del esquema, porque
  crear tablas y tipos necesita permisos que la aplicación no debe tener.

---

## 8. RLS de Supabase — MINA DESACTIVADA, PERO CONVIENE SABERLO

Al crear el proyecto se activó "Enable automatic RLS", así que las 20 tablas
tienen Row Level Security habilitado. **No había ninguna política definida**, y
en PostgreSQL eso significa denegar todo a cualquier rol que no sea el dueño de
la tabla.

Funcionaba solo porque la aplicación conecta como `postgres`, que es el dueño y
omite RLS. El día que se conectara con otro rol, **todas las consultas habrían
devuelto cero filas sin dar error**: una caída silenciosa, sin excepción ni log,
que se diagnostica muy mal.

Ya está resuelto: la migración `20260722180000_rol_aplicacion_y_rls` crea
políticas explícitas para `effort_app`.

**Qué recordar hacia adelante:** cualquier rol nuevo de base de datos necesita
su política RLS antes de poder leer nada. Si alguna vez se habilita la Data API
de Supabase, los roles `anon` y `authenticated` no tienen políticas y por lo
tanto no ven absolutamente nada — que es justamente lo que se quiere.
