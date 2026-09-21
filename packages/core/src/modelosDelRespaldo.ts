/**
 * Qué modelos entran en un respaldo completo de la base, y en qué orden.
 *
 * Hasta el 2026-09-16 esta lista vivía duplicada en dos lugares
 * (`scripts/respaldar-base.mjs` para el respaldo manual y
 * `apps/api/src/servicios/respaldoAutomatico.ts` para el diario), y las dos
 * copias se habían ido separando del esquema real: les faltaban
 * `AsignacionCliente` (la cartera de clientes por persona), `SolicitudDocumentacion`
 * y `LecturaDeDeclaracion` (2.434 lecturas de PDF de la DNIT), y el respaldo
 * manual además tenía `contacto` y `solicitud`, que no son modelos de este
 * esquema — nunca fallaban, solo se salteaban en silencio.
 *
 * **Un respaldo "completo" que no lo es no se nota hasta el día que hace
 * falta restaurar.** Por eso esta lista tiene un test que la compara contra
 * `schema.prisma` en los dos sentidos: que no falte un modelo, y que no sobre
 * un nombre que ya no existe.
 */

/**
 * Modelos a respaldar, en orden de dependencia.
 *
 * El orden importa para restaurar: un `documento` referencia un `cliente`, así
 * que el cliente entra primero. Restaurar en el orden inverso a este falla por
 * claves foráneas.
 */
export const MODELOS_DEL_RESPALDO = [
  'usuario',
  'cliente',
  'asignacionCliente',
  'obligacionTributaria',
  'obligacionDeCliente',
  'reglaImpositiva',
  'reglaNotificacion',
  'evidencia',
  'archivoDeOrigen',
  'documento',
  'procesoMensual',
  'vencimiento',
  'balance',
  // Referencia a `cliente`, ya cargado arriba.
  'solicitudDocumentacion',
  'exportacionSiga',
  'comprobanteSiga',
  'liquidacion',
  'liquidacionIvaRg90',
  'hallazgoDeLibroRg90',
  // Referencia a `evidencia` y a `cliente`, ya cargados arriba.
  'lecturaDeDeclaracion',
  'alerta',
  // Referencia a `cliente`, `usuario` y `solicitudDocumentacion`, ya cargados.
  'registroContacto',
  // Referencia a `usuario` y a `cliente` (este último puede ser NULL: tiempo
  // interno). Es un dato que solo una persona puede volver a cargar, y no se
  // puede reconstruir desde ningún otro lado: las horas se autoreportan.
  'registroDeHoras',
  'envioNotificacion',
  'eventLog',
] as const;

/**
 * Modelos que se dejan afuera del respaldo, a propósito, con el motivo.
 *
 * No es un olvido: son las dos tablas del esquema que un volcado de datos no
 * necesita guardar. El test de este archivo exige que todo modelo del esquema
 * esté en `MODELOS_DEL_RESPALDO` o acá, con un motivo — así una tabla nueva no
 * puede quedar afuera en silencio.
 */
export const EXCLUIDOS_DEL_RESPALDO_A_PROPOSITO: Readonly<Record<string, string>> = {
  sesion:
    'Token de sesión: efímero y sensible. Se regenera con cada inicio de ' +
    'sesión, así que restaurar uno viejo no sirve de nada, y guardarlo en el ' +
    'respaldo es exponer un secreto que no hace falta exponer.',
  codigoRecuperacion:
    'Hash de un código de recuperación de contraseña, de un solo uso. Igual ' +
    'que la sesión: efímero, sensible, y sin ningún valor para restaurar.',
};

export type ModeloDelRespaldo = (typeof MODELOS_DEL_RESPALDO)[number];
