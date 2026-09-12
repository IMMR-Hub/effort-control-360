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

import { hoyEnParaguay } from '@effort/core';

import type { Dependencias } from '../servidor.js';
import { generarVencimientosDelPeriodo } from './generadorDeVencimientos.js';
import { enviarAvisosDeAlertas } from './avisosPorCorreo.js';
import { evaluarAlertas } from './motorDeAlertas.js';
import { sincronizarDesdeOneDrive } from './sincronizadorDeOneDrive.js';

/** Cada cuánto se revisa la carpeta de EFFORT. Confirmado con Daniel. */
const CADA_15_MINUTOS = 15 * 60 * 1000;

/**
 * Cada cuánto se generan vencimientos y se evalúan alertas.
 *
 * Una hora y no 15 minutos porque un vencimiento no aparece de un momento a
 * otro: lo que cambia seguido es qué documentos hay, no qué días vencen.
 */
const CADA_HORA = 60 * 60 * 1000;

/**
 * Espera antes de la primera corrida.
 *
 * Arrancar la sincronización en el mismo instante que el servidor haría que un
 * despliegue compita consigo mismo por la base justo cuando además tiene que
 * atender a la gente que está entrando.
 *
 * Subido de 2 a 10 minutos el 2026-09-12. Con 2 minutos, un trabajo que mata al
 * proceso arma un ciclo de reinicio perfecto: el contenedor nunca vive lo
 * suficiente como para que alguien entre, ni para apagar nada desde el panel.
 * Diez minutos no arreglan la causa, pero dejan una ventana para intervenir.
 */
const ESPERA_INICIAL = 10 * 60 * 1000;

/** Memoria residente del proceso, en MB. Se registra en cada corrida. */
function memoriaMB(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

/**
 * Usuario al que se le atribuyen las importaciones automáticas.
 *
 * La bitácora exige saber quién hizo cada cosa, y "el sistema" es una respuesta
 * legítima siempre que sea distinguible de una persona. Se usa la cuenta del
 * sistema, no la de alguien del equipo: atribuirle a Laura una importación que
 * ella no hizo sería peor que no atribuirla.
 */
const CORREO_DEL_SISTEMA = 'effort360@effort.com.py';

/**
 * Genera los vencimientos del período y levanta las alertas que correspondan.
 *
 * Corre solo, y esto NO es un detalle de comodidad. Hasta el 2026-09-11 las dos
 * cosas dependían de que alguien entrara a la pantalla y apretara un botón: si
 * nadie lo hacía en octubre, no había vencimientos de octubre y por lo tanto
 * tampoco alertas. Un sistema que existe para que no se pase una fecha no puede
 * depender de que alguien se acuerde de pedirle que mire.
 *
 * Es seguro repetirlo: generar no duplica (restricción única por cliente,
 * obligación y período) y evaluar no reabre lo que ya está abierto.
 */
export function programarCalculoDeVencimientosYAlertas(
  deps: Dependencias,
  registrador: FastifyBaseLogger,
): void {
  if (deps.configuracion.TRABAJOS_AUTOMATICOS === 'no') {
    registrador.warn(
      'TRABAJOS_AUTOMATICOS=no: el cálculo de vencimientos y alertas no corre solo. ' +
        'Los botones de las pantallas siguen funcionando.',
    );
    return;
  }

  let enCurso = false;

  async function correr(): Promise<void> {
    if (enCurso) return;
    enCurso = true;

    try {
      const usuario = await deps.usuarios.buscarPorEmail(CORREO_DEL_SISTEMA);
      if (!usuario) {
        registrador.error(
          `No existe el usuario ${CORREO_DEL_SISTEMA}: no se puede atribuir el cálculo a nadie.`,
        );
        return;
      }

      const hoy = hoyEnParaguay(deps.ahora());
      const periodo = `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;

      // El mes anterior también: el IVA de septiembre se presenta en octubre,
      // así que en los primeros días del mes lo que urge es el período pasado.
      const anterior =
        hoy.mes === 1
          ? `${hoy.anio - 1}-12`
          : `${hoy.anio}-${String(hoy.mes - 1).padStart(2, '0')}`;

      let generados = 0;
      const sinRevisar = new Set<number>();
      for (const cual of [anterior, periodo]) {
        const resumen = await generarVencimientosDelPeriodo(
          { clientes: deps.clientes, obligaciones: deps.obligaciones, vencimientos: deps.vencimientos },
          cual,
          usuario.id,
        );
        generados += resumen.creados;
        for (const anio of resumen.aniosSinRevisarFeriados) sinRevisar.add(anio);
      }

      // Los feriados hay que revisarlos cada mes (regla de Daniel, 2026-09-12):
      // los móviles se trasladan por decreto y los extraordinarios aparecen
      // durante el año. Sin traslados cargados el cálculo no miente, pero avisa
      // antes de tiempo — y eso tiene que verse.
      if (sinRevisar.size > 0) {
        registrador.warn(
          { anios: [...sinRevisar] },
          'Hay años sin revisar el calendario de feriados. Los vencimientos de esos años ' +
            'se calculan con las fechas originales, sin los traslados por decreto.',
        );
      }

      const alertas = await evaluarAlertas(
        { alertas: deps.alertas, vencimientos: deps.vencimientos, procesoMensual: deps.procesoMensual },
        deps.ahora(),
        periodo,
        usuario.id,
      );

      // Los avisos salen DESPUÉS de evaluar, para que una alerta recién
      // levantada se avise en la misma vuelta y no una hora más tarde.
      let avisos = { enviados: 0, fallidos: 0, yaAvisadas: 0 };
      if (deps.correo) {
        const direccion = (await deps.usuarios.listar()).filter(
          (u) => u.rol === 'direccion' && u.activo,
        );
        const clientes = await deps.clientes.listar(null);
        const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));

        avisos = await enviarAvisosDeAlertas({
          alertas: deps.alertas,
          correo: deps.correo,
          yaEnviados: () => deps.envios.enviados(),
          registrarEnvio: (datos) => deps.envios.registrar(datos),
          destinatarios: direccion.map((u) => u.email),
          nombreDeCliente: (id) => (id ? nombres.get(id) ?? id : 'General'),
          ahora: deps.ahora,
        });
      }

      if (generados > 0 || alertas.creadas > 0 || avisos.enviados > 0) {
        await deps.bitacora.registrar({
          usuarioId: usuario.id,
          accion: 'alerta.evaluadas',
          entidad: 'alerta',
          entidadId: null,
          clienteId: null,
          datosAntes: null,
          datosDespues: {
            periodo,
            vencimientosGenerados: generados,
            alertasCreadas: alertas.creadas,
            alertasResueltas: alertas.resueltas,
            avisosEnviados: avisos.enviados,
            avisosFallidos: avisos.fallidos,
            disparo: 'automático',
          },
          ipTruncada: null,
          agenteUsuario: 'cálculo automático',
          peticionId: null,
        });

        registrador.info(
          { periodo, generados, alertas: alertas.creadas, avisos: avisos.enviados },
          'Cálculo automático de vencimientos, alertas y avisos terminado.',
        );
      }
    } catch (error) {
      registrador.error({ err: error }, 'Falló el cálculo automático de vencimientos y alertas.');
    } finally {
      enCurso = false;
    }
  }

  // Más tarde que la sincronización: conviene que primero entren los
  // documentos del día y recién después se evalúe qué falta.
  const primera = setTimeout(() => {
    void correr();
    const periodico = setInterval(() => void correr(), CADA_HORA);
    periodico.unref();
  }, 5 * 60 * 1000);

  primera.unref();
}

export function programarSincronizacionDeOneDrive(
  deps: Dependencias,
  registrador: FastifyBaseLogger,
): void {
  if (deps.configuracion.TRABAJOS_AUTOMATICOS === 'no') {
    registrador.warn(
      'TRABAJOS_AUTOMATICOS=no: la sincronización de OneDrive no corre sola. ' +
        'El botón "Sincronizar ahora" sigue funcionando.',
    );
    return;
  }

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

    // Este par de líneas existe por la caída del 2026-09-12: cuando el kernel
    // mata el proceso por memoria no queda NADA en el log, así que la única
    // forma de saber que fue memoria es haber anotado cuánta había justo antes.
    registrador.info({ memoriaMB: memoriaMB() }, 'Sincronización de OneDrive: empieza.');

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
          { nuevos: resumen.nuevosEnTotal, fallos: resumen.fallos.length, memoriaMB: memoriaMB() },
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
