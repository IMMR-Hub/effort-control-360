/**
 * Sincronización con OneDrive.
 *
 * Una sola ruta: disparar la sincronización a mano. La automática corre sola
 * cada 15 minutos (ver `index.ts`) y usa exactamente el mismo servicio — el
 * botón no es un camino paralelo, es el mismo con otro disparador.
 */

import type { FastifyInstance } from 'fastify';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { sincronizarDesdeOneDrive } from '../servicios/sincronizadorDeOneDrive.js';
import { autorizar } from './comun.js';

export async function registrarRutasDeOneDrive(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.post('/api/v1/onedrive/sincronizar', async (peticion) => {
    const sujeto = autorizar(peticion, 'evidencia', 'crear');

    if (!deps.drive || !deps.driveDeOrigen) {
      throw new ErrorDeAplicacion(
        503,
        'La conexión con OneDrive no está configurada en este entorno.',
        'drive_no_configurado',
      );
    }

    const resumen = await sincronizarDesdeOneDrive(
      {
        clientes: deps.clientes,
        documentos: deps.documentos,
        origen: deps.driveDeOrigen,
        destino: deps.drive,
        registrarEvidencia: (datos) => deps.evidencias.registrarOVincular(datos),
        huellasDeOrigen: (clienteId) => deps.evidencias.huellasDeOrigen(clienteId),
        ahora: deps.ahora,
      },
      sujeto.usuarioId,
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.ONEDRIVE_SINCRONIZADO,
      entidad: 'evidencia',
      entidadId: null,
      clienteId: null,
      datosDespues: {
        nuevos: resumen.nuevosEnTotal,
        fallos: resumen.fallos.length,
        quedaronPendientes: resumen.quedaronPendientes,
        disparo: 'manual',
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return resumen;
  });
}
