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
 * Permiso: `actualizacion.crear`, que tienen todos los roles salvo `solo_lectura`
 * (2026-09-24, Daniel: el equipo tiene que poder refrescar su cliente sin
 * pedírselo a dirección). Todo lo demás es solo de dirección.
 */

import type { FastifyInstance } from 'fastify';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { intentarSincronizar, sincronizarOneDrive } from '../servicios/sincronizacionIncremental.js';
import { ejecutarCicloDeCalculo } from '../servicios/cicloDeCalculo.js';
import { autorizar } from './comun.js';

export async function registrarRutasDeActualizarAhora(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.post('/api/v1/actualizar-ahora', async (peticion) => {
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
        'Ya hay una sincronización en curso (la automática, o alguien apretó antes). Esperá un momento y volvé a intentar.',
        'sincronizacion_en_curso',
      );
    }
    const sincronizacion = intento.valor;

    const inicioDelCiclo = Date.now();
    const ciclo = await ejecutarCicloDeCalculo(deps, sujeto.usuarioId, 'manual');
    const cicloMs = Date.now() - inicioDelCiclo;

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
        modoDeSincronizacion: sincronizacion.modo,
        sincronizacionMs: sincronizacion.duracionMs,
        cicloMs,
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
      // Cuánto tardó cada parte: sin esto, «tarda mucho» es una impresión y no
      // un dato (tarea 158).
      modoDeSincronizacion: sincronizacion.modo,
      sincronizacionMs: sincronizacion.duracionMs,
      cicloMs,
    };
  });
}
