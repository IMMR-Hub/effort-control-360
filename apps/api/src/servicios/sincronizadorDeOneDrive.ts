/**
 * Sincronización de la carpeta real de EFFORT hacia el sistema.
 *
 * Recorre la carpeta de cada cliente en el OneDrive donde EFFORT trabaja a
 * diario, copia a la carpeta propia del sistema lo que todavía no estaba, y lo
 * registra como documento. Es lo que reemplaza a la importación manual de una
 * sola vez: antes había que correr un script con las rutas escritas a mano.
 *
 * Tres reglas que no se negocian, y que el código hace cumplir por construcción:
 *
 *  1. **De la carpeta de EFFORT solo se lee.** El adaptador de origen es una
 *     instancia distinta, apuntando al drive de la persona; el de destino es
 *     otra, apuntando al del sistema. No hay forma de escribir en el de origen
 *     ni por descuido. Ver `CLAUDE.md`, regla 5.
 *  2. **Nada se duplica.** La huella `sha256` del contenido es única en la
 *     base: un archivo que ya entró no vuelve a entrar, aunque lo hayan
 *     renombrado o movido de carpeta.
 *  3. **Un archivo que falla no frena a los demás.** Se registra qué falló y
 *     por qué, y la sincronización sigue. Con cientos de archivos, cortar todo
 *     por uno solo significa no importar nada.
 */

import { createHash } from 'node:crypto';

import { clasificarDocumento, deducirPeriodo, type OrigenDelPeriodo } from '@effort/core';
import type { ArchivoDrive, DriveDeArchivos } from '@effort/drive';

import { ACCIONES, type EntradaDeBitacora } from '../bitacora.js';
import type { RepositorioDeClientes } from '../puertos.js';
import type { RepositorioDeDocumentos } from '../puertos-dominio.js';

/** Carpeta propia del sistema. Lo único que este servicio puede escribir. */
const CARPETA_DEL_SISTEMA = 'EFFORT Control 360/Entrada';

/**
 * Tope de archivos DESCARGADOS por corrida.
 *
 * Cuenta descargas y no altas nuevas, que es la corrección que hizo falta al
 * probar contra el OneDrive real: un archivo ya conocido por su contenido pero
 * sin marca de origen igual hay que bajarlo para saberlo, y si esas descargas
 * no contaran, la corrida no terminaría nunca. Lo que no entra en una corrida
 * entra en la siguiente, y cada archivo bajado queda marcado para no volver a
 * bajarse.
 */
const MAXIMO_DESCARGAS_POR_CORRIDA = 150;

/**
 * Tope absoluto por corrida, pase lo que pase.
 *
 * El tope global se calcula a partir de cuántos clientes hay, para que a todos
 * les toque. Este es el techo que impide que con cincuenta clientes una corrida
 * se vuelva eterna.
 */
const TECHO_ABSOLUTO_POR_CORRIDA = 400;

/**
 * Tope de descargas **por cliente**, no solo del total.
 *
 * Sin esto, el primer cliente mata de hambre a los demás. El 2026-09-14 COPESA
 * —2.128 archivos— agotaba el presupuesto entero en cada corrida y los otros
 * cuatro clientes quedaban en cero para siempre: 73 corridas seguidas y ni un
 * documento de ECOAGRO, FUMIPRO, DIBEC o SIPAR.
 *
 * Repartirlo hace que todos avancen aunque uno sea enorme. Es más lento para el
 * cliente grande y muchísimo mejor para el conjunto: un sistema donde cuatro de
 * cinco clientes no tienen datos no sirve, por más completo que esté el quinto.
 */
const MAXIMO_DESCARGAS_POR_CLIENTE = 40;

/**
 * Tamaño máximo de un archivo que se copia automáticamente.
 *
 * Esto no es una preferencia: es lo que tumbó el sistema entero el 2026-09-12.
 * `leer()` trae el archivo COMPLETO a memoria, y el servicio corre en un
 * contenedor de 512 MB. Un solo archivo suficientemente grande en la carpeta de
 * EFFORT hacía que el kernel matara el proceso — sin excepción, sin `SIGTERM` y
 * sin una línea en el log, porque un `SIGKILL` no se puede interceptar. Como la
 * corrida siguiente volvía a encontrar el MISMO archivo, el servicio quedó en
 * ciclo de reinicio y durante horas nadie pudo entrar al sistema.
 *
 * 25 MiB con la referencia real a la vista: el archivo más pesado que apareció
 * en el OneDrive de EFFORT hasta ahora es un estatuto escaneado de 5,7 MB. Lo
 * que pase de acá no se ignora — se anota como fallo con su tamaño, para que se
 * vea y se decida qué hacer, en vez de desaparecer en silencio.
 */
const LIMITE_BYTES_POR_ARCHIVO = 25 * 1024 * 1024;

export interface DependenciasDelSincronizador {
  readonly clientes: RepositorioDeClientes;
  readonly documentos: RepositorioDeDocumentos;
  /** Drive de EFFORT (Laura). **Solo lectura.** */
  readonly origen: DriveDeArchivos;
  /** Drive propio del sistema. Acá sí se escribe. */
  readonly destino: DriveDeArchivos;
  readonly registrarEvidencia: (datos: AltaDeEvidencia) => Promise<{
    evidencia: { id: string };
    esNueva: boolean;
    /** Nombre y ruta que tenía la evidencia, si se le actualizaron (ver `ResultadoDeRegistro`). */
    anterior?: { readonly nombreArchivo: string; readonly rutaOneDrive: string } | null;
  }>;
  /** Qué archivos del origen ya tiene ese cliente, para no volver a bajarlos. */
  readonly huellasDeOrigen: (clienteId: string) => Promise<readonly HuellaDeOrigen[]>;
  /**
   * Anota que este archivo del origen ya se miró.
   *
   * Va aparte de `registrarEvidencia` porque son preguntas distintas: la
   * evidencia es única por CONTENIDO, y varios archivos pueden compartirlo. Sin
   * esto, de cinco copias del mismo PDF solo quedaba marcada una y las otras
   * cuatro se volvían a bajar en cada corrida — para siempre.
   */
  readonly marcarArchivoDeOrigen: (datos: {
    clienteId: string;
    itemIdOrigen: string;
    modificadoEnOrigen: Date | null;
    evidenciaId: string;
  }) => Promise<void>;
  /**
   * Rastro de lo que cambia al reconocer un archivo que ya estaba (nombre y
   * ruta de la evidencia, tipo y período del documento). Quien conecta el
   * servicio pasa `registrarEvento`, que no tumba la corrida si falla.
   */
  readonly registrarEnBitacora: (entrada: EntradaDeBitacora) => Promise<void>;
  readonly ahora: () => Date;
}

export interface AltaDeEvidencia {
  readonly clienteId: string;
  readonly nombreArchivo: string;
  readonly rutaOneDrive: string;
  readonly itemIdOneDrive: string;
  readonly tipoMime: string;
  readonly tamanoBytes: bigint;
  readonly sha256: string;
  readonly subidoPorUsuarioId: string;
  readonly itemIdOrigen: string | null;
  readonly modificadoEnOrigen: Date | null;
}

export interface HuellaDeOrigen {
  readonly itemIdOrigen: string;
  readonly modificadoEnOrigen: Date | null;
  /** Ver `HuellaDeOrigen.rutaRegistrada` en `puertos-dominio.ts`. */
  readonly rutaRegistrada?: string | null;
}

export interface FalloDeSincronizacion {
  readonly cliente: string;
  readonly archivo: string;
  readonly motivo: string;
}

export interface ResumenPorCliente {
  readonly cliente: string;
  readonly revisados: number;
  readonly nuevos: number;
  readonly yaEstaban: number;
  /** Salteados sin descargar, por estar ya importados y sin cambios. */
  readonly sinCambios: number;
}

export interface ResumenDeSincronizacion {
  readonly clientes: readonly ResumenPorCliente[];
  readonly nuevosEnTotal: number;
  readonly fallos: readonly FalloDeSincronizacion[];
  /** True si se alcanzó el tope y quedaron archivos para la próxima corrida. */
  readonly quedaronPendientes: boolean;
  /**
   * Fallos que se arreglan reintentando (una carpeta que no se pudo leer, una
   * copia que se cortó). No cuenta los archivos demasiado grandes: esos son una
   * decisión, y reintentarlos no cambia nada. La sincronización por cambios
   * (tarea 158) solo da por visto un cambio si esto es cero.
   */
  readonly errores: number;
}

/**
 * Cuántos fallos se detallan en la bitácora, como mucho.
 *
 * Hasta el 2026-09-22 solo se guardaba `fallos.length`: la corrida se sabía
 * que fallaba 17 veces, pero nadie podía saber CUÁLES sin leer el código —
 * Daniel, 2026-09-22: "¿a que te referís con 17 fallos? Eso es básicamente que
 * todo colapsó?". No: son archivos de más de 25 MB que a propósito nunca se
 * bajan (`CLAUDE.md`, lección 4), pero el detalle se descartaba cada 15
 * minutos. El tope es para no escribir un JSON gigante si algún día son miles.
 */
const MAXIMO_FALLOS_DETALLADOS = 30;

/**
 * Arma el detalle de una corrida para la bitácora, legible sin leer el código.
 *
 * Separado de `sincronizarDesdeOneDrive` para poder probarlo sin un origen ni
 * un destino de Drive de verdad: es una transformación pura de datos que ya
 * existen en el resumen.
 */
export function detalleParaBitacora(
  resumen: ResumenDeSincronizacion,
): {
  readonly nuevos: number;
  readonly fallos: number;
  readonly fallosDetalle: readonly string[];
  readonly quedaronPendientes: boolean;
} {
  return {
    nuevos: resumen.nuevosEnTotal,
    fallos: resumen.fallos.length,
    fallosDetalle: resumen.fallos
      .slice(0, MAXIMO_FALLOS_DETALLADOS)
      .map((f) => `${f.cliente} — ${f.archivo}: ${f.motivo}`),
    quedaronPendientes: resumen.quedaronPendientes,
  };
}

/**
 * Período al que pertenece un archivo: por su carpeta, si no por su nombre, y
 * recién al final por una fecha (`deducirPeriodo` en `@effort/core`, donde está
 * la regla y su prueba).
 *
 * Hasta el 2026-11-01 salía solo de `lastModifiedDateTime`, y el ordenamiento
 * de octubre de 2026 demostró que esa fecha no sirve: al renombrar pasó a ser la
 * del día del ordenamiento. Sigue siendo una deducción sin leer el contenido —
 * la carpeta y el nombre los pone una persona—, pero ya no la fecha en que
 * alguien tocó el archivo. Para la fecha de último recurso se prefiere la del
 * sistema de archivos (`fileSystemInfo`), si el adaptador la trae.
 */
function periodoDe(archivo: ArchivoDrive): { periodo: string; origen: OrigenDelPeriodo } {
  return deducirPeriodo(
    archivo.nombre,
    archivo.rutaCarpeta,
    archivo.modificadoEnSistemaDeArchivos ?? archivo.modificadoEn,
  );
}

/** Dónde queda la copia de un archivo en la carpeta propia del sistema. */
function rutaDeLaCopia(nombreCliente: string, archivo: ArchivoDrive): { carpeta: string; ruta: string } {
  const carpeta = `${CARPETA_DEL_SISTEMA}/${nombreCliente}/${archivo.rutaCarpeta}`;
  return { carpeta, ruta: `${carpeta}/${archivo.nombre}` };
}

/**
 * Qué cambiar en un documento cuando la sincronización reconoce su archivo
 * (mismo id o mismo contenido) con otro nombre o en otra carpeta. `null` si no
 * cambia nada.
 *
 * Reglas, todas a favor de no perder información:
 *
 *  - Solo documentos que entraron por OneDrive (`canalRecepcion`): uno cargado
 *    a mano lleva lo que escribió una persona.
 *  - **El tipo nunca baja a `OTRO`.** Un archivo sin renombrar que pasó de
 *    `RG 90 COMPRAS/` a `DOCUMENTOS CONTABLES/03 MARZO/` ya no tiene la pista de
 *    la carpeta vieja, y el nombre (`03 MARZO.xlsx`) no dice nada: se conserva
 *    el tipo que ya tenía, que es justamente esa pista.
 *  - **El período cambia solo si lo dice la carpeta o el nombre.** La fecha no
 *    alcanza para pisar uno que ya existe: es la base que se demostró poco
 *    confiable (`periodoDe`).
 */
export function cambiosAlReconocer(
  documento: { readonly tipo: string; readonly periodo: string; readonly canalRecepcion: string },
  archivo: ArchivoDrive,
): { tipo: string; periodo: string; origenDelPeriodo: OrigenDelPeriodo | null } | null {
  if (documento.canalRecepcion !== 'ONEDRIVE') return null;

  const tipoNuevo = clasificarDocumento(archivo.nombre, archivo.rutaCarpeta);
  const tipo = tipoNuevo === 'OTRO' ? documento.tipo : tipoNuevo;

  const deducido = periodoDe(archivo);
  const periodoConfiable = deducido.origen !== 'FECHA';
  const periodo = periodoConfiable ? deducido.periodo : documento.periodo;

  if (tipo === documento.tipo && periodo === documento.periodo) return null;
  return {
    tipo,
    periodo,
    origenDelPeriodo: periodo === documento.periodo ? null : deducido.origen,
  };
}

/**
 * Un archivo que ya estaba volvió a pasar por la sincronización: deja rastro
 * del nombre y la ruta nuevos, y recalcula tipo y período de sus documentos.
 * Va ANTES de marcar el archivo como visto: si algo falla, la corrida siguiente
 * lo vuelve a intentar en vez de saltearlo.
 */
async function reconocerArchivo(
  deps: DependenciasDelSincronizador,
  cliente: { readonly id: string },
  archivo: ArchivoDrive,
  rutaDeCopia: string,
  evidencia: { readonly id: string },
  anterior: { readonly nombreArchivo: string; readonly rutaOneDrive: string } | null,
  usuarioId: string,
): Promise<void> {
  if (anterior && (anterior.nombreArchivo !== archivo.nombre || anterior.rutaOneDrive !== rutaDeCopia)) {
    await deps.registrarEnBitacora({
      usuarioId,
      accion: ACCIONES.EVIDENCIA_RENOMBRADA_EN_ORIGEN,
      entidad: 'evidencia',
      entidadId: evidencia.id,
      clienteId: cliente.id,
      datosAntes: anterior,
      datosDespues: { nombreArchivo: archivo.nombre, rutaOneDrive: rutaDeCopia, itemIdOrigen: archivo.itemId },
    });
  }

  for (const documento of await deps.documentos.deEvidencia(evidencia.id, cliente.id)) {
    const cambios = cambiosAlReconocer(documento, archivo);
    if (!cambios) continue;

    const aplicado = await deps.documentos.reclasificarDesdeOrigen(
      documento.id,
      { tipo: documento.tipo, periodo: documento.periodo },
      { tipo: cambios.tipo, periodo: cambios.periodo },
      usuarioId,
    );
    if (!aplicado) continue;

    await deps.registrarEnBitacora({
      usuarioId,
      accion: ACCIONES.DOCUMENTO_RECLASIFICADO,
      entidad: 'documento',
      entidadId: documento.id,
      clienteId: cliente.id,
      datosAntes: { tipo: documento.tipo, periodo: documento.periodo },
      datosDespues: {
        tipo: cambios.tipo,
        periodo: cambios.periodo,
        origenDelPeriodo: cambios.origenDelPeriodo,
        nombreArchivo: archivo.nombre,
        rutaCarpeta: archivo.rutaCarpeta,
        criterio: 'archivo reconocido por la sincronización de OneDrive (sincronizadorDeOneDrive.ts)',
      },
    });
  }
}

function tipoMimeDe(archivo: ArchivoDrive): string {
  return archivo.tipoMime ?? 'application/octet-stream';
}

export async function sincronizarDesdeOneDrive(
  deps: DependenciasDelSincronizador,
  usuarioId: string,
): Promise<ResumenDeSincronizacion> {
  const clientes = await deps.clientes.listar(null);

  /*
   * El presupuesto de la corrida se calcula a partir de cuántos clientes hay,
   * no con un número fijo.
   *
   * Con un tope global fijo de 150 y uno por cliente de 40, el quinto cliente se
   * quedaba sin nada: 40+40+40+30 y se acabó. Pasó de verdad — SIPAR quedó en
   * cero mientras los otros cuatro avanzaban. Calcularlo así garantiza por
   * construcción que a todos les toque su parte, en vez de depender de que los
   * dos números casualmente encajen.
   */
  const activos = clientes.filter((c) => c.activo && c.carpetaOneDriveId).length;
  const presupuesto = Math.min(
    Math.max(MAXIMO_DESCARGAS_POR_CORRIDA, activos * MAXIMO_DESCARGAS_POR_CLIENTE),
    TECHO_ABSOLUTO_POR_CORRIDA,
  );

  const porCliente: ResumenPorCliente[] = [];
  const fallos: FalloDeSincronizacion[] = [];
  let nuevosEnTotal = 0;
  let descargas = 0;
  let quedaronPendientes = false;
  let errores = 0;

  for (const cliente of clientes) {
    if (!cliente.activo || !cliente.carpetaOneDriveId) continue;

    let archivos: ArchivoDrive[];
    try {
      archivos = await deps.origen.listarRecursivoPorId(cliente.carpetaOneDriveId);
    } catch (error) {
      errores += 1;
      fallos.push({
        cliente: cliente.nombre,
        archivo: '(la carpeta entera)',
        motivo: error instanceof Error ? error.message : 'No se pudo leer la carpeta.',
      });
      continue;
    }

    // Lo que ya se tiene de este cliente, en una sola consulta. Es lo que
    // evita bajar cientos de archivos para descubrir que ya estaban.
    const conocidos = new Map<string, { fecha: number | null; rutaRegistrada: string | null }>();
    for (const huella of await deps.huellasDeOrigen(cliente.id)) {
      conocidos.set(huella.itemIdOrigen, {
        fecha: huella.modificadoEnOrigen?.getTime() ?? null,
        rutaRegistrada: huella.rutaRegistrada ?? null,
      });
    }

    let nuevos = 0;
    let yaEstaban = 0;
    let sinCambios = 0;
    let revisados = 0;
    let descargasDeEsteCliente = 0;

    for (const archivo of archivos) {
      if (descargas >= presupuesto) {
        quedaronPendientes = true;
        break;
      }

      // Tope propio: sin esto, un cliente con miles de archivos se lleva el
      // presupuesto entero y los siguientes nunca arrancan.
      if (descargasDeEsteCliente >= MAXIMO_DESCARGAS_POR_CLIENTE) {
        quedaronPendientes = true;
        break;
      }

      revisados += 1;

      // El atajo que hace viable correr esto cada 15 minutos: mismo archivo,
      // misma fecha de modificación, no se toca. Si la fecha cambió sí se baja,
      // porque el contenido pudo haber cambiado.
      //
      // Y si la evidencia de ESTE archivo tiene anotada otra ruta, también se
      // baja aunque la fecha sea la misma: lo renombraron o lo movieron, y
      // hay que actualizar nombre, ruta, tipo y período (2026-11-01). Converge:
      // al reconocerlo la evidencia queda con la ruta actual y la corrida
      // siguiente lo saltea.
      const { ruta: rutaActual } = rutaDeLaCopia(cliente.nombre, archivo);
      const conocido = conocidos.get(archivo.itemId);
      if (conocido) {
        const renombrado = conocido.rutaRegistrada !== null && conocido.rutaRegistrada !== rutaActual;
        if (conocido.fecha === archivo.modificadoEn.getTime() && !renombrado) {
          sinCambios += 1;
          continue;
        }
      }

      // Antes de tocar la red: un archivo demasiado grande no se baja nunca.
      // La comprobación va acá y no dentro del `try` de más abajo a propósito —
      // no es un fallo al procesarlo, es una decisión de no procesarlo.
      if (archivo.tamanoBytes > LIMITE_BYTES_POR_ARCHIVO) {
        const mb = (archivo.tamanoBytes / 1024 / 1024).toFixed(1);
        fallos.push({
          cliente: cliente.nombre,
          archivo: archivo.nombre,
          motivo:
            `Pesa ${mb} MB y el máximo automático es ` +
            `${LIMITE_BYTES_POR_ARCHIVO / 1024 / 1024} MB. No se copió. ` +
            'Si hace falta tenerlo en el sistema, subilo a mano.',
        });
        continue;
      }

      try {
        const contenido = await deps.origen.leer(archivo.itemId);
        descargas += 1;
        descargasDeEsteCliente += 1;
        const sha256 = createHash('sha256').update(contenido).digest('hex');

        // Se copia a la carpeta propia ANTES de registrar: si el registro
        // fallara, queda una copia de más (inofensiva), no un documento en la
        // base apuntando a un archivo que no existe.
        const carpetaDestino = rutaDeLaCopia(cliente.nombre, archivo).carpeta;
        const copia = await deps.destino.escribir(carpetaDestino, archivo.nombre, contenido);

        const evidencia = await deps.registrarEvidencia({
          clienteId: cliente.id,
          nombreArchivo: archivo.nombre,
          rutaOneDrive: rutaActual,
          itemIdOneDrive: copia.itemId,
          tipoMime: tipoMimeDe(archivo),
          tamanoBytes: BigInt(archivo.tamanoBytes),
          sha256,
          subidoPorUsuarioId: usuarioId,
          itemIdOrigen: archivo.itemId,
          modificadoEnOrigen: archivo.modificadoEn,
        });

        if (!evidencia.esNueva) {
          await reconocerArchivo(
            deps, cliente, archivo, rutaActual, evidencia.evidencia, evidencia.anterior ?? null, usuarioId,
          );
        }

        // Se anota el archivo ANTES de decidir si hay documento nuevo: lo que
        // importa para no volver a bajarlo es haberlo mirado, no que su
        // contenido fuera nuevo.
        await deps.marcarArchivoDeOrigen({
          clienteId: cliente.id,
          itemIdOrigen: archivo.itemId,
          modificadoEnOrigen: archivo.modificadoEn,
          evidenciaId: evidencia.evidencia.id,
        });

        // Ese contenido ya estaba (mismo archivo con otro nombre, o importado
        // por el script viejo). Ya quedó anotado arriba, así que la próxima
        // corrida lo saltea sin bajarlo; su documento se actualizó en
        // `reconocerArchivo`.
        if (!evidencia.esNueva) {
          yaEstaban += 1;
          continue;
        }

        await deps.documentos.registrar({
          clienteId: cliente.id,
          periodo: periodoDe(archivo).periodo,
          tipo: clasificarDocumento(archivo.nombre, archivo.rutaCarpeta),
          canalRecepcion: 'ONEDRIVE',
          recibidoEn: archivo.modificadoEn,
          rucEmisor: null,
          timbrado: null,
          numeroComprobante: null,
          total: null,
          tasa: null,
          anulado: false,
          evidenciaId: evidencia.evidencia.id,
          observaciones: null,
          creadoPorUsuarioId: usuarioId,
        });

        nuevos += 1;
        nuevosEnTotal += 1;
      } catch (error) {
        errores += 1;
        fallos.push({
          cliente: cliente.nombre,
          archivo: archivo.nombre,
          motivo: error instanceof Error ? error.message : 'Error desconocido.',
        });
      }
    }

    porCliente.push({ cliente: cliente.nombre, revisados, nuevos, yaEstaban, sinCambios });
  }

  return { clientes: porCliente, nuevosEnTotal, fallos, quedaronPendientes, errores };
}
