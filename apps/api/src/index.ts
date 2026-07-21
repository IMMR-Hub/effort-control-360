/**
 * Punto de entrada del servidor.
 *
 * Su único trabajo es cablear las dependencias reales y levantar el proceso.
 * Toda la lógica vive en módulos que no saben de `process.env` ni de puertos,
 * y por eso se pueden probar sin levantar nada.
 */

import { cargarConfiguracion } from './configuracion.js';
import { construirServidor, type Dependencias } from './servidor.js';
import { registrarRutasDeAutenticacion } from './rutas/autenticacion.js';
import { registrarRutasDeContactos } from './rutas/contactos.js';
import { AlmacenEnMemoria } from './seguridad/limites.js';

export async function arrancar(dependencias: Dependencias): Promise<void> {
  const app = await construirServidor(dependencias);

  await registrarRutasDeAutenticacion(app, dependencias);
  await registrarRutasDeContactos(app, dependencias);

  // Purga periódica del almacén de intentos: sin esto crece indefinidamente
  // mientras el proceso siga vivo.
  const purga = setInterval(
    () => dependencias.intentosDeAcceso.purgar(dependencias.ahora(), 15 * 60 * 1000),
    5 * 60 * 1000,
  );
  purga.unref();

  // Cierre ordenado: termina las peticiones en curso antes de salir, para no
  // cortar a alguien a mitad de guardar un contacto durante un despliegue.
  for (const senal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(senal, () => {
      app.log.info(`Señal ${senal} recibida, cerrando.`);
      void app.close().then(() => process.exit(0));
    });
  }

  await app.listen({ port: dependencias.configuracion.PORT, host: '0.0.0.0' });
}

export { cargarConfiguracion, construirServidor, AlmacenEnMemoria };
export type { Dependencias };
