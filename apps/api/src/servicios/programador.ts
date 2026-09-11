/**
 * Trabajos que corren solos, sin que nadie apriete un botón.
 *
 * Van dentro del mismo proceso de la API y no en un componente aparte: el
 * servicio ya está encendido las 24 horas, y agregar una máquina más para
 * ejecutar algo cada 15 minutos sería costo y una pieza más que puede fallar,
 * sin nada a cambio.
 *
 * Eso sí — vale saberlo antes de escalar: si algún día la API corre en más de
 * una instancia, cada una ejecutaría su propia copia del trabajo. Hoy es una
 * sola (ver `.do/app.yaml`, `instance_count: 1`). Cuando deje de serlo, esto
 * necesita un candado compartido en la base.
 */

import type { FastifyBaseLogger } from 'fastify';

import type { Dependencias } from '../servidor.js';
import { sincronizarDesdeOneDrive } from './sincronizadorDeOneDrive.js';

/** Cada cuánto se revisa la carpeta de EFFORT. Confirmado con Daniel. */
const CADA_15_MINUTOS = 15 * 60 * 1000;

/**
 * Espera antes de la primera corrida.
 *
 * Arrancar la sincronización en el mismo instante que el servidor haría que un
 * despliegue compita consigo mismo por la base justo cuando además tiene que
 * atender a la gente que está entrando.
 */
const ESPERA_INICIAL = 2 * 60 * 1000;

/**
 * Usuario al que se le atribuyen las importaciones automáticas.
 *
 * La bitácora exige saber quién hizo cada cosa, y "el sistema" es una respuesta
 * legítima siempre que sea distinguible de una persona. Se usa la cuenta del
 * sistema, no la de alguien del equipo: atribuirle a Laura una importación que
 * ella no hizo sería peor que no atribuirla.
 */
const CORREO_DEL_SISTEMA = 'effort360@effort.com.py';

export function programarSincronizacionDeOneDrive(
  deps: Dependencias,
  registrador: FastifyBaseLogger,
): void {
  if (!deps.drive || !deps.driveDeOrigen) {
    registrador.warn(
      'Sin credenciales de OneDrive: la sincronización automática queda apagada. ' +
        'El resto del sistema funciona igual.',
    );
    return;
  }

  // Una corrida por vez. Sin esto, una sincronización lenta (muchos archivos,
  // red lenta) se solaparía con la siguiente y las dos leerían y escribirían lo
  // mismo al mismo tiempo.
  let enCurso = false;

  async function correr(): Promise<void> {
    if (enCurso) {
      registrador.info('Sincronización de OneDrive salteada: la anterior sigue corriendo.');
      return;
    }
    enCurso = true;

    try {
      const usuario = await deps.usuarios.buscarPorEmail(CORREO_DEL_SISTEMA);
      if (!usuario) {
        registrador.error(
          `No existe el usuario ${CORREO_DEL_SISTEMA}: no se puede atribuir la importación a nadie.`,
        );
        return;
      }

      const resumen = await sincronizarDesdeOneDrive(
        {
          clientes: deps.clientes,
          documentos: deps.documentos,
          origen: deps.driveDeOrigen!,
          destino: deps.drive!,
          registrarEvidencia: (datos) => deps.evidencias.registrarOVincular(datos),
          huellasDeOrigen: (clienteId) => deps.evidencias.huellasDeOrigen(clienteId),
          ahora: deps.ahora,
        },
        usuario.id,
      );

      // Solo se escribe en la bitácora cuando hubo algo que contar: un evento
      // cada 15 minutos diciendo "no pasó nada" enterraría los que sí importan.
      if (resumen.nuevosEnTotal > 0 || resumen.fallos.length > 0) {
        await deps.bitacora.registrar({
          usuarioId: usuario.id,
          accion: 'evidencia.onedrive_sincronizado',
          entidad: 'evidencia',
          entidadId: null,
          clienteId: null,
          datosAntes: null,
          datosDespues: {
            nuevos: resumen.nuevosEnTotal,
            fallos: resumen.fallos.length,
            quedaronPendientes: resumen.quedaronPendientes,
            disparo: 'automático',
          },
          ipTruncada: null,
          agenteUsuario: 'sincronización automática',
          peticionId: null,
        });

        registrador.info(
          { nuevos: resumen.nuevosEnTotal, fallos: resumen.fallos.length },
          'Sincronización de OneDrive terminada.',
        );
      }
    } catch (error) {
      // Un fallo acá no puede tumbar el proceso: la API tiene que seguir
      // atendiendo aunque OneDrive esté caído.
      registrador.error({ err: error }, 'Falló la sincronización automática de OneDrive.');
    } finally {
      enCurso = false;
    }
  }

  const primera = setTimeout(() => {
    void correr();
    const periodico = setInterval(() => void correr(), CADA_15_MINUTOS);
    periodico.unref();
  }, ESPERA_INICIAL);

  // `unref` para que estos temporizadores no mantengan vivo el proceso durante
  // un cierre ordenado.
  primera.unref();
}
