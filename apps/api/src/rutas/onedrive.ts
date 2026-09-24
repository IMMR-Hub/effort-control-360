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
import { intentarSincronizar, sincronizarOneDrive } from '../servicios/sincronizacionIncremental.js';
import { autorizar, paramsId } from './comun.js';

export async function registrarRutasDeOneDrive(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  /**
   * Enlace para abrir, en el OneDrive de EFFORT, el archivo original de una
   * evidencia — por ejemplo, la declaración de la DNIT que prueba que un
   * vencimiento se presentó.
   *
   * Es la respuesta a "¿de dónde sacó el sistema que esto está presentado?":
   * cada afirmación tiene que poder abrirse y verse.
   *
   * Solo lectura: devuelve la dirección web del archivo, no lo baja ni lo
   * comparte. Apunta al ORIGINAL (la carpeta donde EFFORT trabaja), no a la
   * copia del sistema, porque el equipo tiene acceso a ese y no a la otra.
   */
  app.get('/api/v1/evidencias/:id/enlace', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const original = await deps.archivosDeOrigen.originalDeEvidencia(id);
    // El permiso se comprueba sobre el cliente dueño del archivo. Si no
    // existe, el mismo 404 que si no fuera suyo.
    if (!original) {
      autorizar(peticion, 'evidencia', 'ver');
      throw new ErrorDeAplicacion(404, 'No se encontró el archivo original.', 'no_encontrado');
    }
    autorizar(peticion, 'evidencia', 'ver', original.clienteId);

    if (!deps.driveDeOrigen) {
      throw new ErrorDeAplicacion(503, 'La conexión con OneDrive no está configurada.', 'drive_no_configurado');
    }

    return { url: await deps.driveDeOrigen.enlaceWeb(original.itemIdOrigen) };
  });

  app.post('/api/v1/onedrive/sincronizar', async (peticion) => {
    const sujeto = autorizar(peticion, 'actualizacion', 'crear');

    if (!deps.drive || !deps.driveDeOrigen) {
      throw new ErrorDeAplicacion(
        503,
        'La conexión con OneDrive no está configurada en este entorno.',
        'drive_no_configurado',
      );
    }

    const origen = deps.driveDeOrigen;
    const destino = deps.drive;
    const intento = await intentarSincronizar(() =>
      sincronizarOneDrive(
        {
          clientes: deps.clientes,
          documentos: deps.documentos,
          origen,
          destino,
          registrarEvidencia: (datos) => deps.evidencias.registrarOVincular(datos),
          huellasDeOrigen: (clienteId) => deps.archivosDeOrigen.huellas(clienteId),
          marcarArchivoDeOrigen: (datos) => deps.archivosDeOrigen.marcar(datos),
          ahora: deps.ahora,
        },
        sujeto.usuarioId,
      ),
    );
    if (intento.ocupado) {
      throw new ErrorDeAplicacion(
        409,
        'Ya hay una sincronización en curso. Esperá un momento y volvé a intentar.',
        'sincronizacion_en_curso',
      );
    }
    const resumen = intento.valor;

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
        modo: resumen.modo,
        duracionMs: resumen.duracionMs,
        disparo: 'manual',
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return resumen;
  });
}
