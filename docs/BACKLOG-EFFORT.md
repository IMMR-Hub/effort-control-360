# Backlog futuro — pedido directo de EFFORT

Compartido por Daniel el 2026-09-09 (fotos de notas manuscritas + capturas
reales de SIGA). **Nada de esto está en el alcance actual del piloto** — se
documenta acá para no perderlo, y para priorizarlo con EFFORT más adelante.
No tocar sin que el roadmap lo incorpore explícitamente como tarea nueva.

## Lista de 16 pedidos (transcripción literal, orden original)

1. Migración de facturas electrónicas — evaluar si podría cargarse con las
   cuentas según proveedor/cliente, y que figure el número de asiento.
2. Recordatorio de los timbrados próximos a vencer.
3. Importar recibos (electrónicos) de facturas electrónicas directo al
   Marangatú (SET, Paraguay).
4. ~~Las notas de crédito — estado de cuenta cliente-proveedores / libro
   mayor.~~ Tachado en el original por EFFORT — descartado o de menor
   prioridad, no asumir que sigue vigente sin confirmar.
5. Planilla de control mensual y anual, directo desde el sistema.
6. Separar de forma correcta (sin más detalle en el original — preguntar a
   qué se refiere antes de tomarlo como tarea).
7. Alerta de obligaciones y deudas pendientes.
8. Facturas de consumición (supermercados) que el sistema detecte y
   proporcione directamente el 70%/30% (deducible/no deducible).
9. Corregir errores de duplicación de documentos (preimpresos y
   electrónicos).
10. Que no se duplique la cuenta contable, y actualización de saldos en el
    asiento de apertura.
11. Redacción de asientos escaneando la planilla de IPS.
12. Redacción automática de asientos de liquidación de IVA.
13. Automatización del devengamiento de seguros.
14. Alertar si falta algún documento en las carpetas mes a mes (en el
    Drive/OneDrive).
15. Alerta de sistema cuando las ventas alcancen los umbrales legales:
    - ₲ 80.000.000 → IRP
    - ₲ 2.000.000.000 → IRE General
    - ₲ 9.000.000.000 → Auditoría obligatoria

## Referencia: campos reales de SIGA (capturas compartidas por Daniel)

Útil para cuando se retome el importador SIGA (Parte 5, tareas 91-94 ya
hechas para exportaciones Excel/CSV — esto es la carga manual dentro de SIGA
mismo, un flujo distinto).

**Carga de Documentos Electrónicos** — modal de una sola pregunta: "Digite
el Código de CDC del Documento Electrónico" (Confirmar/Cerrar). El CDC es el
identificador único de 44 dígitos de la factura electrónica paraguaya.

**Grilla de Compras** — columnas: Fecha, RUC, Razón Social, Tipo Comprobante,
N° Comprobante, Importe, Forma Pago, N° Control, Origen, N° Timbrado, Exenta.
Acciones disponibles: Detalle de Impuestos, Rubro/Inciso (F3), Ver Cuotas
(F4), Ver Cheques (F9), Asignar Timbrado, Imprimir Retención (F7), Carga de
Documento Electrónico (dispara el modal de CDC de arriba), Generar Asiento
(F2), Ver Detalle IRP, Ver Detalle NC, Cambiar Cuenta, Retención (F6), Orden
de Pago (F10), Asignar N° Factura a Nota de Crédito.

**Formulario "RUC Compra"** (detalle de un comprobante) — campos: Sucursal,
Ruc, Fecha, Tipo Comprobante (Factura / NC / Factura Virtual, etc.), N° de
Comprobante (carga manual), N° de Timbrado, Moneda, Total, Exentas, Gravadas
10%, Gravadas 05%, Base Imponible, desglose de I.V.A. por Rubro/Inciso
(manual, salvo que el cálculo lo haga el sistema automáticamente), Cuenta
Exenta / Cuenta Grav. 10% / Cuenta Grav. 05% (cuentas contables), Centro,
Forma Pago (Contado/Crédito — el crédito alimenta el módulo 70/30), casillas
"No Enviar al Libro I.V.A." (para otros gastos que no sean IVA) y "No
generar asiento", Concepto.

Con factura electrónica: **todos estos campos se completan solos al pegar el
CDC** — el flujo real es pegar el código, dejar que SIGA los complete, y
solo confirmar (salvo el caso de consumo 70/30, que sigue necesitando
revisión manual).
