/**
 * "Actualizar ahora": sincronizar OneDrive, recalcular IVA, detectar
 * presentaciones y evaluar alertas, en una sola llamada.
 *
 * Existe por la demo con Laura y Lili (Daniel, 2026-09-23): que alguien suba
 * un comprobante a OneDrive y, apretando un botón, vea desaparecer la fila de
 * "falta" (pantalla Faltantes, tarea 152) sin esperar hasta una hora a que
 * corra solo. No es un camino paralelo — es exactamente lo que ya corren
 * `programador.ts` (cada hora) y el botón "Sincronizar ahora" de Documentos
 * (cada 15 minutos), disparado a mano y junto.
 *
 * Permiso: las tres acciones que encadena (`evidencia.crear`,
 * `liquidacion.crear`, `alerta.crear`) solo las tiene junto `direccion` y
 * `responsable` — que es exactamente quién va a estar mostrando el sistema.
 */

import type { FastifyInstance } from 'fastify';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { sincronizarDesdeOneDrive } from '../servicios/sincronizadorDeOneDrive.js';
import { ejecutarCicloDeCalculo } from '../servicios/cicloDeCalculo.js';
import { autorizar } from './comun.js';

export async function registrarRutasDeActualizarAhora(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.post('/api/v1/actualizar-ahora', async (peticion) => {
    const sujeto = autorizar(peticion, 'evidencia', 'crear');
    autorizar(peticion, 'liquidacion', 'crear');
    autorizar(peticion, 'alerta', 'crear');

    if (!deps.drive || !deps.driveDeOrigen) {
      throw new ErrorDeAplicacion(
        503,
        'La conexión con OneDrive no está configurada en este entorno.',
        'drive_no_configurado',
      );
    }

    const sincronizacion = await sincronizarDesdeOneDrive(
      {
        clientes: deps.clientes,
        documentos: deps.documentos,
        origen: deps.driveDeOrigen,
        destino: deps.drive,
        registrarEvidencia: (datos) => deps.evidencias.registrarOVincular(datos),
        huellasDeOrigen: (clienteId) => deps.archivosDeOrigen.huellas(clienteId),
        marcarArchivoDeOrigen: (datos) => deps.archivosDeOrigen.marcar(datos),
        ahora: deps.ahora,
      },
      sujeto.usuarioId,
    );

    const ciclo = await ejecutarCicloDeCalculo(deps, sujeto.usuarioId, 'manual');

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.ACTUALIZACION_MANUAL,
      entidad: 'sistema',
      entidadId: null,
      clienteId: null,
      datosDespues: {
        archivosNuevos: sincronizacion.nuevosEnTotal,
        archivosConFallo: sincronizacion.fallos.length,
        ivaPeriodosCalculados: ciclo.ivaPeriodosCalculados,
        ivaHallazgosNuevos: ciclo.ivaHallazgosNuevos,
        presentacionesMarcadas: ciclo.presentacionesMarcadas,
        alertasCreadas: ciclo.alertasCreadas,
        alertasActualizadas: ciclo.alertasActualizadas,
        alertasResueltas: ciclo.alertasResueltas,
        disparo: 'manual',
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return {
      archivosNuevos: sincronizacion.nuevosEnTotal,
      archivosConFallo: sincronizacion.fallos.length,
      ivaPeriodosCalculados: ciclo.ivaPeriodosCalculados,
      ivaHallazgosNuevos: ciclo.ivaHallazgosNuevos,
      ivaOcupado: ciclo.ivaOcupado,
      presentacionesMarcadas: ciclo.presentacionesMarcadas,
      presentadasFueraDeTermino: ciclo.presentadasFueraDeTermino,
      alertasCreadas: ciclo.alertasCreadas,
      alertasActualizadas: ciclo.alertasActualizadas,
      alertasResueltas: ciclo.alertasResueltas,
    };
  });
}
