/**
 * Punto de entrada para correr el servidor como proceso real.
 *
 * `index.ts` expone `principal()` para que quien lo use decida cuándo
 * llamarlo (los tests nunca lo hacen, arman el servidor en memoria con
 * `construirServidor` + `.inject()`). Este archivo es el único lugar que
 * invoca `principal()` de verdad — usado por los tests end-to-end de
 * Playwright (`e2e/entorno-global.ts`) y, desde la tarea 107, por
 * `run_command` del servicio `api` en producción (`.do/app.yaml`).
 */

import { principal } from './index.js';

/*
 * Lo que sigue se agregó el 2026-09-12, después de una caída de horas en la que
 * el servicio se reiniciaba una y otra vez SIN DEJAR UNA SOLA LÍNEA en el log.
 * La ausencia de rastro fue el problema más caro del incidente: sin ella, la
 * causa se habría visto en dos minutos en vez de en dos horas.
 *
 * Un servidor que corre solo las 24 horas tiene que dejar dicho por qué se
 * muere. Node, por su cuenta, mata el proceso ante una promesa rechazada que
 * nadie atrapó — y lo hace sin contexto útil.
 */

/**
 * Promesa rechazada que nadie atrapó.
 *
 * Se registra y el proceso SIGUE. Es deliberado y vale justificarlo: desde que
 * existen trabajos de fondo (sincronización de OneDrive, cálculo de
 * vencimientos, avisos por correo), un descuido en cualquiera de ellos podría
 * tumbar la API entera — y con ella la posibilidad de que alguien entre a
 * trabajar. Un aviso por correo que falla no puede dejar a EFFORT sin sistema.
 */
process.on('unhandledRejection', (motivo) => {
  console.error('[FALLO NO ATRAPADO] Promesa rechazada sin manejar:', motivo);
});

/**
 * Excepción que escapó de todo.
 *
 * Acá sí se sale, y la diferencia con el caso de arriba es real: después de una
 * excepción no atrapada el estado del proceso puede haber quedado a medias, y
 * seguir sirviendo peticiones desde ahí es peor que reiniciar. Lo que cambia
 * respecto de antes es que ahora queda escrito qué pasó.
 */
process.on('uncaughtException', (error) => {
  console.error('[FALLO NO ATRAPADO] Excepción sin manejar:', error);
  process.exit(1);
});

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
