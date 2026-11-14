/**
 * Sincronización con OneDrive.
 *
 * Una sola ruta: disparar la sincronización a mano. La automática corre sola
 * cada 15 minutos (ver `index.ts`) y usa exactamente el mismo servicio — el
 * botón no es un camino paralelo, es el mismo con otro disparador.
 *
 * Con `clienteId` (2026-11-13) trae solo ese cliente: lista su carpeta entera y
 * ninguna otra. Es para cuando alguien acaba de subir algo de un cliente y no
 * quiere esperar la vuelta de 15 minutos.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { idSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { filtroDeClientes } from '../seguridad/rbac.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import {
  intentarSincronizar,
  sincronizarOneDrive,
  sincronizarUnCliente,
} from '../servicios/sincronizacionIncremental.js';
import { autorizar, paramsId } from './comun.js';

const cuerpoDeSincronizar = z.object({ clienteId: idSchema.optional() }).strict();

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
    const { clienteId } = cuerpoDeSincronizar.parse(peticion.body ?? {});
    // Con un cliente, el permiso se pide sobre ESE cliente: alguien con cartera
    // solo puede traer los suyos (rbac.ts, capa 2).
    const sujeto = autorizar(peticion, 'actualizacion', 'crear', clienteId ?? null);

    if (!deps.drive || !deps.driveDeOrigen) {
      throw new ErrorDeAplicacion(
        503,
        'La conexión con OneDrive no está configurada en este entorno.',
        'drive_no_configurado',
      );
    }

    if (clienteId) {
      const cliente = await deps.clientes.buscarPorId(clienteId, filtroDeClientes(sujeto));
      if (!cliente) throw new ErrorDeAplicacion(404, 'No existe ese cliente.', 'no_encontrado');
      if (!cliente.activo) {
        throw new ErrorDeAplicacion(409, 'Ese cliente está dado de baja: no se sincroniza.', 'cliente_inactivo');
      }
      if (!cliente.carpetaOneDriveId) {
        throw new ErrorDeAplicacion(409, 'Ese cliente no tiene una carpeta de OneDrive conectada.', 'sin_carpeta');
      }
    }

    const origen = deps.driveDeOrigen;
    const destino = deps.drive;
    const dependencias = {
      clientes: deps.clientes,
      documentos: deps.documentos,
      origen,
      destino,
      registrarEvidencia: (datos: Parameters<typeof deps.evidencias.registrarOVincular>[0]) =>
        deps.evidencias.registrarOVincular(datos),
      huellasDeOrigen: (id: string) => deps.archivosDeOrigen.huellas(id),
      marcarArchivoDeOrigen: (datos: Parameters<typeof deps.archivosDeOrigen.marcar>[0]) =>
        deps.archivosDeOrigen.marcar(datos),
      almacenDelPunto: deps.puntoDeSincronizacion ?? null,
      registrarEnBitacora: (entrada: Parameters<typeof registrarEvento>[2]) =>
        registrarEvento(deps.bitacora, peticion.log, entrada),
      ahora: deps.ahora,
    };
    const intento = await intentarSincronizar(
      () =>
        clienteId
          ? sincronizarUnCliente(dependencias, sujeto.usuarioId, clienteId)
          : sincronizarOneDrive(dependencias, sujeto.usuarioId),
      // Un pedido de un cliente cede el turno si la vuelta general está esperando.
      { alcance: clienteId ? 'cliente' : 'general' },
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
      clienteId: clienteId ?? null,
      datosDespues: {
        nuevos: resumen.nuevosEnTotal,
        fallos: resumen.fallos.length,
        quedaronPendientes: resumen.quedaronPendientes,
        modo: resumen.modo,
        duracionMs: resumen.duracionMs,
        disparo: clienteId ? 'manual, un cliente' : 'manual',
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return resumen;
  });
}
