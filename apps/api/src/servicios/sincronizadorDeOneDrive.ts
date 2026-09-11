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

import { clasificarPorNombre } from '@effort/core';
import type { ArchivoDrive, DriveDeArchivos } from '@effort/drive';

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

export interface DependenciasDelSincronizador {
  readonly clientes: RepositorioDeClientes;
  readonly documentos: RepositorioDeDocumentos;
  /** Drive de EFFORT (Laura). **Solo lectura.** */
  readonly origen: DriveDeArchivos;
  /** Drive propio del sistema. Acá sí se escribe. */
  readonly destino: DriveDeArchivos;
  readonly registrarEvidencia: (
    datos: AltaDeEvidencia,
  ) => Promise<{ evidencia: { id: string }; esNueva: boolean }>;
  /** Qué archivos del origen ya tiene ese cliente, para no volver a bajarlos. */
  readonly huellasDeOrigen: (clienteId: string) => Promise<readonly HuellaDeOrigen[]>;
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
}

/**
 * Período al que pertenece un archivo, deducido de su fecha de modificación.
 *
 * Es una aproximación declarada, no un dato extraído del documento: sin leer el
 * contenido no se puede saber a qué mes fiscal corresponde una factura. Se usa
 * la fecha de modificación porque es lo único confiable que da OneDrive, y
 * queda anotado en `DISCREPANCIAS.md` para que nadie lo confunda con el período
 * real del comprobante.
 */
function periodoDe(archivo: ArchivoDrive): string {
  const fecha = archivo.modificadoEn;
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

function tipoMimeDe(archivo: ArchivoDrive): string {
  return archivo.tipoMime ?? 'application/octet-stream';
}

export async function sincronizarDesdeOneDrive(
  deps: DependenciasDelSincronizador,
  usuarioId: string,
): Promise<ResumenDeSincronizacion> {
  const clientes = await deps.clientes.listar(null);
  const porCliente: ResumenPorCliente[] = [];
  const fallos: FalloDeSincronizacion[] = [];
  let nuevosEnTotal = 0;
  let descargas = 0;
  let quedaronPendientes = false;

  for (const cliente of clientes) {
    if (!cliente.activo || !cliente.carpetaOneDriveId) continue;

    let archivos: ArchivoDrive[];
    try {
      archivos = await deps.origen.listarRecursivoPorId(cliente.carpetaOneDriveId);
    } catch (error) {
      fallos.push({
        cliente: cliente.nombre,
        archivo: '(la carpeta entera)',
        motivo: error instanceof Error ? error.message : 'No se pudo leer la carpeta.',
      });
      continue;
    }

    // Lo que ya se tiene de este cliente, en una sola consulta. Es lo que
    // evita bajar cientos de archivos para descubrir que ya estaban.
    const conocidos = new Map<string, number | null>();
    for (const huella of await deps.huellasDeOrigen(cliente.id)) {
      conocidos.set(huella.itemIdOrigen, huella.modificadoEnOrigen?.getTime() ?? null);
    }

    let nuevos = 0;
    let yaEstaban = 0;
    let sinCambios = 0;
    let revisados = 0;

    for (const archivo of archivos) {
      if (descargas >= MAXIMO_DESCARGAS_POR_CORRIDA) {
        quedaronPendientes = true;
        break;
      }

      revisados += 1;

      // El atajo que hace viable correr esto cada 15 minutos: mismo archivo,
      // misma fecha de modificación, no se toca. Si la fecha cambió sí se baja,
      // porque el contenido pudo haber cambiado.
      if (conocidos.has(archivo.itemId)) {
        const fechaConocida = conocidos.get(archivo.itemId);
        if (fechaConocida === archivo.modificadoEn.getTime()) {
          sinCambios += 1;
          continue;
        }
      }

      try {
        const contenido = await deps.origen.leer(archivo.itemId);
        descargas += 1;
        const sha256 = createHash('sha256').update(contenido).digest('hex');

        // Se copia a la carpeta propia ANTES de registrar: si el registro
        // fallara, queda una copia de más (inofensiva), no un documento en la
        // base apuntando a un archivo que no existe.
        const carpetaDestino = `${CARPETA_DEL_SISTEMA}/${cliente.nombre}/${archivo.rutaCarpeta}`;
        const copia = await deps.destino.escribir(carpetaDestino, archivo.nombre, contenido);

        const evidencia = await deps.registrarEvidencia({
          clienteId: cliente.id,
          nombreArchivo: archivo.nombre,
          rutaOneDrive: `${carpetaDestino}/${archivo.nombre}`,
          itemIdOneDrive: copia.itemId,
          tipoMime: tipoMimeDe(archivo),
          tamanoBytes: BigInt(archivo.tamanoBytes),
          sha256,
          subidoPorUsuarioId: usuarioId,
          itemIdOrigen: archivo.itemId,
          modificadoEnOrigen: archivo.modificadoEn,
        });

        // Ese contenido ya estaba (mismo archivo con otro nombre, o importado
        // por el script viejo). Ya se le anotó de dónde viene, así que la
        // próxima corrida lo saltea sin bajarlo.
        if (!evidencia.esNueva) {
          yaEstaban += 1;
          continue;
        }

        await deps.documentos.registrar({
          clienteId: cliente.id,
          periodo: periodoDe(archivo),
          tipo: clasificarPorNombre(archivo.nombre),
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
        fallos.push({
          cliente: cliente.nombre,
          archivo: archivo.nombre,
          motivo: error instanceof Error ? error.message : 'Error desconocido.',
        });
      }
    }

    porCliente.push({ cliente: cliente.nombre, revisados, nuevos, yaEstaban, sinCambios });
  }

  return { clientes: porCliente, nuevosEnTotal, fallos, quedaronPendientes };
}
