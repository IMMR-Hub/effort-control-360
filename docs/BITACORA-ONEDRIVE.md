# Bitácora de movimientos en el OneDrive real de EFFORT

Registro obligatorio de **todo** acceso al OneDrive real de EFFORT
(`effort360@effort.com.py`), desde que Daniel autorizó lectura de esa cuenta
el 2026-09-09. Cada entrada: Cuándo, Qué se hizo, Por qué, Para qué. Sirve
también como material de entrenamiento/referencia a futuro.

## Regla vigente (autorizada por Daniel, 2026-09-09)

> "Puedes escribir y cambiar y modificar lo que sea necesario dentro de las
> carpetas creadas (donde puedes duplicar los datos de los 5 clientes) para
> hacer la prueba, pero NUNCA uses las carpetas actuales para nada que no sea
> SOLO LECTURA. Solo en las carpetas creadas por vos, podes hacer
> modificaciones [...] manten un libro de movimientos."

En concreto:
- **Carpetas reales de EFFORT** (lo que Laura/Lili usan a diario) — **solo
  lectura**. Nunca `escribir()`, nunca ningún método de borrado (no existe
  ninguno en `DriveDeArchivos`, ver `packages/drive/src/puerto.ts`).
- **`/EFFORT Control 360/Entrada|Salida|Respaldo/`** (la carpeta nueva creada
  para este proyecto, vacía hasta ahora) — lectura y escritura, incluyendo
  copiar/duplicar ahí datos reales para pruebas.
- Esto no cambia la regla 5 de `CLAUDE.md` sobre no borrar nada — la
  refina: ahora sí se puede *leer* la carpeta real (antes ni eso), pero
  *escribir* sigue limitado exclusivamente a la carpeta nueva.

## Movimientos

- **2026-09-09, ~19:00** — Primera exploración de solo lectura de la cuenta
  real (`effort360@effort.com.py`), nunca hecha antes (hasta ahora solo se
  había verificado `GET /drive/root/children` → 200 OK como prueba de acceso,
  tarea 88, sin explorar contenido). **Por qué:** Daniel compartió los nombres
  de los 5 clientes piloto (Ecoagro, Dibec, SIPAR, Fumipro, Copesa) pero sin
  RUC ni razón social completa — datos obligatorios para sembrarlos (tarea 56)
  que no se pueden inventar. **Para qué:** buscar si esos datos ya existen en
  algún archivo real de EFFORT (registro de clientes, exportación SIGA) antes
  de pedírselos de nuevo a Daniel.
  **Resultado:** tres llamadas de solo lectura (`GET /users/effort360@.../drive/root/children`,
  `GET /sites/root`, `GET /sites/root/drive/root/children`), todas 200 OK,
  todas vacías o sin datos útiles. `effort360@effort.com.py` es la cuenta
  propia de Daniel dentro del tenant (confirmado en la bitácora del roadmap,
  2026-09-04) — su OneDrive está vacío, no es donde Laura/Lili trabajan a
  diario. El sitio raíz de SharePoint del tenant (`effortconsultora.sharepoint.com`,
  "Sitio de comunicación") también está vacío — es el auto-provisto por
  Microsoft 365, no un sitio de trabajo real. `GET /sites?search=*` dio 403
  (permiso no concedido para buscar sitios). **No se intentó adivinar ni
  probar acceder a la cuenta personal de Laura o Lili** — expandir el acceso
  a una cuenta o sitio específico sin que Daniel lo nombre primero se
  consideró fuera de lo autorizado. Conclusión: hace falta que Daniel diga
  dónde vive realmente el material de trabajo diario (¿OneDrive de Laura o
  Lili? ¿un sitio de Teams/SharePoint con otro nombre?) antes de seguir
  explorando.
