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

import { crearCalendario, DIVISORES_CONFIRMADOS_POR_EFFORT, feriadosParaguay, hoyEnParaguay } from '@effort/core';

import type { Dependencias } from '../servidor.js';
import { generarVencimientosDelPeriodo } from './generadorDeVencimientos.js';
import { enviarAvisosDeAlertas, VENTANA_DE_AVISOS_MS } from './avisosPorCorreo.js';
import { enviarRecordatorios } from './recordatorios.js';
import { intentarConCandado } from './candadoDeIva.js';
import { evaluarAlertas } from './motorDeAlertas.js';
import { detalleParaBitacora, sincronizarDesdeOneDrive } from './sincronizadorDeOneDrive.js';
import { liquidarIvaDesdeLibros } from './liquidacionDeIva.js';
import { detectarPresentaciones } from './detectorDePresentaciones.js';
import { extraerTextoDePdf } from './textoDePdf.js';

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

  const avisosEncendidos = deps.configuracion.AVISOS_POR_CORREO === 'si';
  const destinatariosDeAvisos = deps.configuracion.AVISOS_DESTINATARIOS ?? [];
  if (!avisosEncendidos) {
    registrador.info('AVISOS_POR_CORREO apagado: las alertas no se avisan por correo.');
  } else if (destinatariosDeAvisos.length === 0) {
    registrador.warn('AVISOS_POR_CORREO=si pero AVISOS_DESTINATARIOS está vacío: no sale ningún correo.');
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

      /*
       * El IVA se recalcula ANTES de evaluar alertas, y el orden importa: un
       * hallazgo nuevo —un comprobante cuyo IVA declarado no coincide— tiene que
       * avisar en esta misma vuelta y no una hora más tarde. Presentar una
       * declaración con una diferencia es de las cosas que no se deshacen: una
       * vez presentada, se rectifica.
       *
       * Un fallo acá no puede impedir que se evalúen las alertas de
       * vencimientos, que es lo que más caro sale no tener.
       */
      let ivaPeriodos = 0;
      let ivaHallazgos = 0;
      if (deps.drive && deps.libroRg90) {
        const drive = deps.drive;
        const libroRg90 = deps.libroRg90;
        const inicio = Date.now();
        const memoriaAntes = memoriaMB();
        try {
          // Comparte el candado con el botón "Recalcular": si alguien lo está
          // corriendo a mano, esta vuelta saltea el IVA y sigue con las alertas.
          const intento = await intentarConCandado(() =>
            liquidarIvaDesdeLibros(
              {
                clientes: deps.clientes,
                librosDelCliente: (clienteId) => libroRg90.librosDelCliente(clienteId),
                drive,
                guardarLiquidacion: (datos) => libroRg90.guardarLiquidacion(datos),
                guardarHallazgos: (datos) => libroRg90.guardarHallazgos(datos),
                divisores: DIVISORES_CONFIRMADOS_POR_EFFORT,
                ahora: deps.ahora,
              },
              usuario.id,
            ),
          );

          if (intento.ocupado) {
            registrador.info('Hay un cálculo de IVA en curso: esta vuelta no lo repite.');
          } else {
            const liquidacion = intento.valor;
            ivaPeriodos = liquidacion.periodosCalculados;
            ivaHallazgos = liquidacion.hallazgosNuevos;

            /*
             * Todo lo que el cálculo dejó afuera tiene que quedar escrito: si
             * nadie aprieta "Recalcular", el log es el único lugar donde se ve
             * que una planilla se descartó o un cliente no se calculó. La
             * memoria y la duración, porque este paso abre todas las planillas
             * de cada cliente en un contenedor de 512 MB (CLAUDE.md, lección 4).
             */
            registrador.info(
              {
                periodos: liquidacion.periodosCalculados,
                planillas: liquidacion.archivosLeidos,
                ignorados: liquidacion.archivosIgnorados,
                avisos: liquidacion.avisos.length + liquidacion.avisosOmitidos,
                primerAviso: liquidacion.avisos[0],
                clientesOmitidos: liquidacion.clientesOmitidos,
                fallos: liquidacion.fallos.length,
                hallazgosNuevos: liquidacion.hallazgosNuevos,
                memoriaMBAntes: memoriaAntes,
                memoriaMBDespues: memoriaMB(),
                segundos: Math.round((Date.now() - inicio) / 1000),
              },
              'Cálculo automático de IVA terminado.',
            );

            if (liquidacion.fallos.length > 0) {
              registrador.warn(
                { fallos: liquidacion.fallos.length, primero: liquidacion.fallos[0] },
                'Hay planillas RG 90 que no se pudieron leer.',
              );
            }
          }
        } catch (error) {
          registrador.error({ err: error }, 'Falló el cálculo automático de IVA desde los libros.');
        }
      }

      /*
       * Las presentaciones se detectan ANTES de evaluar alertas, por la misma
       * razón que el IVA: si la declaración ya está en OneDrive, la alerta de
       * "vencido sin presentar" no tiene que salir en esta vuelta, ni mucho
       * menos mandarse por correo.
       *
       * Un fallo acá no impide evaluar las alertas: sin el detector el sistema
       * avisa de más, que es la dirección segura.
       */
      let presentacionesMarcadas = 0;
      let presentadasFueraDeTermino = 0;
      if (deps.drive && deps.declaraciones) {
        const repo = deps.declaraciones;
        const drive = deps.drive;
        try {
          const detectadas = await detectarPresentaciones(
            {
              pdfsPorLeer: (limite) => repo.pdfsPorLeer(limite),
              leerArchivo: (itemId) => drive.leer(itemId),
              extraerTexto: extraerTextoDePdf,
              guardarLectura: (pdf, resultado) => repo.guardarLectura(pdf, resultado),
              presentacionesLeidas: () => repo.presentacionesLeidas(),
              vencimientosPendientes: () => repo.vencimientosPendientes(),
              marcarPresentado: async (id, fecha, evidenciaId, quien) => {
                await deps.vencimientos.marcarPresentado(id, fecha, evidenciaId, quien);
              },
              registrarEnBitacora: (entrada) =>
                deps.bitacora.registrar({
                  usuarioId: usuario.id,
                  accion: 'vencimiento.presentado',
                  entidad: 'vencimiento',
                  entidadId: entrada.vencimientoId,
                  clienteId: entrada.clienteId,
                  datosAntes: null,
                  datosDespues: {
                    estado: 'PRESENTADO',
                    fechaPresentacion: entrada.fechaDePresentacion,
                    evidenciaId: entrada.evidenciaId,
                    numeroDeOrden: entrada.numeroDeOrden,
                    fueraDeTermino: entrada.fueraDeTermino,
                    diasDeAtraso: entrada.diasDeAtraso,
                    fechaAproximada: entrada.fechaAproximada,
                    disparo: 'automático: declaración de la DNIT encontrada en OneDrive',
                  },
                  ipTruncada: null,
                  agenteUsuario: null,
                  peticionId: null,
                }),
            },
            usuario.id,
          );
          presentacionesMarcadas = detectadas.vencimientosMarcados;
          presentadasFueraDeTermino = detectadas.fueraDeTermino;

          registrador.info(
            { ...detectadas, memoriaMB: memoriaMB() },
            'Detección de presentaciones terminada.',
          );
        } catch (error) {
          registrador.error({ err: error }, 'Falló la detección de presentaciones.');
        }
      }

      const alertas = await evaluarAlertas(
        {
          alertas: deps.alertas,
          vencimientos: deps.vencimientos,
          procesoMensual: deps.procesoMensual,
          riesgoDeLibro: {
            porPeriodo: async () => deps.libroRg90?.riesgoPorPeriodo() ?? [],
          },
          declaracionesAjenas: deps.declaracionesAjenas ?? undefined,
        },
        deps.ahora(),
        periodo,
        usuario.id,
      );

      /*
       * Los avisos salen DESPUÉS de evaluar, para que una alerta recién
       * levantada se avise en la misma vuelta y no una hora más tarde.
       *
       * Solo con AVISOS_POR_CORREO=si (apagado por defecto desde el
       * 2026-09-16, por orden de Daniel), a la lista explícita de
       * destinatarios, con tope por corrida y solo de lo levantado en el último
       * día.
       */
      let avisos = { enviados: 0, fallidos: 0, yaAvisadas: 0, pendientesPorTope: 0 };
      if (deps.correo && avisosEncendidos && destinatariosDeAvisos.length > 0) {
        const clientes = await deps.clientes.listar(null);
        const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
        const ahora = deps.ahora();

        avisos = await enviarAvisosDeAlertas({
          alertas: deps.alertas,
          correo: deps.correo,
          yaEnviados: () => deps.envios.enviados(),
          registrarEnvio: (datos) => deps.envios.registrar(datos),
          destinatarios: destinatariosDeAvisos,
          tope: deps.configuracion.AVISOS_TOPE_POR_CORRIDA ?? 0,
          creadasDesde: new Date(ahora.getTime() - VENTANA_DE_AVISOS_MS),
          nombreDeCliente: (id) => (id ? nombres.get(id) ?? id : 'General'),
          ahora: deps.ahora,
        });

        if (avisos.pendientesPorTope > 0) {
          registrador.warn(
            { pendientes: avisos.pendientesPorTope },
            'Quedaron avisos sin mandar por el tope de la corrida: están en la pantalla de Alertas.',
          );
        }
      }

      if (
        generados > 0 ||
        alertas.creadas > 0 ||
        avisos.enviados > 0 ||
        ivaHallazgos > 0 ||
        presentacionesMarcadas > 0
      ) {
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
            alertasActualizadas: alertas.actualizadas,
            avisosEnviados: avisos.enviados,
            avisosFallidos: avisos.fallidos,
            ivaPeriodosCalculados: ivaPeriodos,
            ivaHallazgosNuevos: ivaHallazgos,
            presentacionesMarcadas,
            presentadasFueraDeTermino,
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
  // documentos del día y recién después se evalúe qué falta. Hasta el
  // 2026-09-16 este comentario decía eso pero la espera era de 5 minutos,
  // ANTES de la sincronización (10 minutos).
  const primera = setTimeout(() => {
    void correr();
    const periodico = setInterval(() => void correr(), CADA_HORA);
    periodico.unref();
  }, ESPERA_INICIAL + 5 * 60 * 1000);

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
          huellasDeOrigen: (clienteId) => deps.archivosDeOrigen.huellas(clienteId),
          marcarArchivoDeOrigen: (datos) => deps.archivosDeOrigen.marcar(datos),
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
          // El detalle (cliente, archivo, motivo) va acá, no solo el número:
          // un conteo sin detalle es invisible para quien mira la bitácora
          // (ver `detalleParaBitacora`).
          datosDespues: { ...detalleParaBitacora(resumen), disparo: 'automático' },
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

/**
 * Manda los recordatorios de documentación pendientes (tareas 96, 97 y 99).
 *
 * Apagado por defecto: hace falta `TRABAJOS_AUTOMATICOS=si` (el interruptor
 * general) Y `RECORDATORIOS_AUTOMATICOS=si` (el específico de esto). Sin el
 * segundo, no sale un solo correo aunque el resto de los trabajos automáticos
 * esté encendido — REGLA 0-bis de `CLAUDE.md`: ningún correo real hasta que
 * Daniel lo autorice, después de aprobar el texto y los destinatarios.
 *
 * Misma cadencia que el cálculo de vencimientos y alertas (una hora): un
 * recordatorio se calcula en días hábiles, no hace falta revisarlo cada
 * quince minutos.
 */
export function programarRecordatoriosDeSeguimiento(
  deps: Dependencias,
  registrador: FastifyBaseLogger,
): void {
  if (deps.configuracion.TRABAJOS_AUTOMATICOS === 'no') {
    registrador.warn(
      'TRABAJOS_AUTOMATICOS=no: los recordatorios de seguimiento no corren solos.',
    );
    return;
  }

  // `!== 'si'` y no `=== 'no'` a propósito: cualquier valor que no sea
  // explícitamente 'si' —incluido no venir seteado— tiene que frenar el
  // envío. Es la misma regla de fail-safe que ya usa AVISOS_POR_CORREO más
  // arriba, y acá importa todavía más: es la única barrera entre esto y un
  // correo real a un cliente.
  if (deps.configuracion.RECORDATORIOS_AUTOMATICOS !== 'si') {
    registrador.warn(
      'RECORDATORIOS_AUTOMATICOS no está en "si": no sale ningún recordatorio automático. ' +
        'La pantalla de Seguimiento sigue funcionando para cargarlos a mano.',
    );
    return;
  }

  if (!deps.correo) {
    registrador.warn(
      'Sin credenciales de correo: los recordatorios automáticos quedan apagados.',
    );
    return;
  }
  const correo = deps.correo;

  let enCurso = false;

  async function correr(): Promise<void> {
    if (enCurso) return;
    enCurso = true;

    try {
      const usuario = await deps.usuarios.buscarPorEmail(CORREO_DEL_SISTEMA);
      if (!usuario) {
        registrador.error(
          `No existe el usuario ${CORREO_DEL_SISTEMA}: no se puede atribuir el contacto automático a nadie.`,
        );
        return;
      }

      const ahora = deps.ahora();
      const hoy = hoyEnParaguay(ahora);
      const calendario = crearCalendario([...feriadosParaguay(hoy.anio), ...feriadosParaguay(hoy.anio + 1)]);

      const resumen = await enviarRecordatorios({
        reglasDeNotificacion: deps.reglasDeNotificacion,
        solicitudes: deps.solicitudes,
        recordatorios: deps.recordatorios,
        contactos: deps.contactos,
        usuarios: deps.usuarios,
        clientes: deps.clientes,
        alertas: deps.alertas,
        correo,
        calendario,
        hoy,
        ahora: deps.ahora,
        usuarioSistemaId: usuario.id,
      });

      if (resumen.evaluadas > 0) {
        await deps.bitacora.registrar({
          usuarioId: usuario.id,
          accion: 'recordatorio.enviados',
          entidad: 'solicitud_documentacion',
          entidadId: null,
          clienteId: null,
          datosAntes: null,
          datosDespues: { ...resumen, disparo: 'automático' },
          ipTruncada: null,
          agenteUsuario: 'recordatorios automáticos',
          peticionId: null,
        });

        registrador.info(resumen, 'Recordatorios de seguimiento: corrida terminada.');
      }
    } catch (error) {
      registrador.error({ err: error }, 'Falló el envío automático de recordatorios de seguimiento.');
    } finally {
      enCurso = false;
    }
  }

  const primera = setTimeout(() => {
    void correr();
    const periodico = setInterval(() => void correr(), CADA_HORA);
    periodico.unref();
  }, ESPERA_INICIAL + 10 * 60 * 1000);

  primera.unref();
}
