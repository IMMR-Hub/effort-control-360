/**
 * Período de un documento, deducido de dónde está guardado y de cómo se llama.
 *
 * **Por qué existe (2026-11-01).** Hasta esta fecha el período salía de la fecha
 * de modificación que informa OneDrive. Al reordenar el OneDrive de EFFORT
 * (tarea 164) esa fecha pasó a ser la del día del ordenamiento en los archivos
 * renombrados. La fecha dice cuándo alguien tocó el archivo, no qué período
 * declara.
 *
 * Lo que sí dice el período es la estructura del manual
 * (`docs/MANUAL-DE-PROCEDIMIENTO-DE-DOCUMENTOS.md` v1.3, regla 2: «la carpeta es
 * el período que el documento declara, no el día en que se guardó») y el nombre
 * según la guía (`docs/GUIA-NOMENCLATURA-ARCHIVOS.md`: período `MMAAAA`).
 *
 * Orden de confianza, de más a menos:
 *
 *  1. **Carpeta.** `NNN PERIODO AAAA/DOCUMENTOS CONTABLES/MM MES/...` → `AAAA-MM`.
 *     `NNN PERIODO AAAA/DOCUMENTOS CONTABLES/CIERRE AAAA/...` → `AAAA-12`, que es
 *     como el sistema ya modela lo anual: una obligación anual del ejercicio AAAA
 *     se genera en el período `AAAA-12` (`correspondeAlPeriodo` en
 *     `apps/api/src/servicios/generadorDeVencimientos.ts`). El período se guarda
 *     como `AAAA-MM` (`periodoSchema`, columna `VARCHAR(7)`): no existe otra
 *     forma de escribir «el ejercicio 2024».
 *  2. **Nombre.** Seis cifras `MMAAAA` sueltas en el nombre, como pide la guía.
 *  3. **Fecha.** Último recurso, y declarado como tal en `origen`.
 *
 * Lo que la carpeta o el nombre no dicen con certeza devuelve `null`: un mes que
 * no coincide con su número (`03 ABRIL`), un `CIERRE` de otro año que su
 * `PERIODO`, dos `MMAAAA` distintos en el mismo nombre. Adivinar ahí sería peor
 * que pasar al paso siguiente.
 */

/** De dónde salió el período: es lo que permite saber cuánto confiar en él. */
export type OrigenDelPeriodo = 'CARPETA' | 'NOMBRE' | 'FECHA';

export interface PeriodoDeducido {
  /** `AAAA-MM`. */
  readonly periodo: string;
  readonly origen: OrigenDelPeriodo;
}

/**
 * Meses tal como los escribe el manual (`01 ENERO` … `09 SETIEMBRE` …
 * `12 DICIEMBRE`). `SEPTIEMBRE` también se acepta: es la otra grafía correcta
 * del mismo mes y no se confunde con ningún otro.
 */
const MESES: Readonly<Record<string, number>> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SETIEMBRE: 9,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

/**
 * `NNN PERIODO AAAA`. El código del cliente es opcional porque antes de la
 * versión 1.3 del manual la carpeta se llamaba `PERIODO 2026` a secas (así la
 * cita el comentario de `listarRecursivoPorId` en `packages/drive/src/puerto.ts`).
 */
const CARPETA_DE_PERIODO = /^(?:\d{3} )?PERIODO (\d{4})$/i;
const CARPETA_CONTABLE = /^DOCUMENTOS CONTABLES$/i;
const CARPETA_DE_MES = /^(\d{2}) ([A-Z]+)$/i;
const CARPETA_DE_CIERRE = /^CIERRE (\d{4})$/i;

function aPeriodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Período que declara la carpeta, o `null` si la ruta no lo dice.
 *
 * Acepta la ruta con o sin carpetas arriba (`021 COPESA/021 PERIODO 2025/...` o
 * `021 PERIODO 2025/...`): el adaptador de Graph da la ruta relativa a la
 * carpeta del cliente y el de pruebas desde la raíz del drive. Lo que haya
 * debajo del mes (`NC EMITIDAS 032026/`) no cambia el período.
 */
export function periodoPorCarpeta(rutaCarpeta: string): string | null {
  const carpetas = rutaCarpeta
    .split('/')
    .map((c) => c.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  const indice = carpetas.findIndex((c) => CARPETA_DE_PERIODO.test(c));
  if (indice < 0) return null;

  const anio = Number(CARPETA_DE_PERIODO.exec(carpetas[indice]!)![1]);
  if (!CARPETA_CONTABLE.test(carpetas[indice + 1] ?? '')) return null;

  const debajo = carpetas[indice + 2] ?? '';

  const cierre = CARPETA_DE_CIERRE.exec(debajo);
  if (cierre) {
    // `PERIODO 2025/.../CIERRE 2024` contradice el manual (4.4): no se elige.
    return Number(cierre[1]) === anio ? aPeriodo(anio, 12) : null;
  }

  const mes = CARPETA_DE_MES.exec(debajo);
  if (!mes) return null;
  const numero = Number(mes[1]);
  const porNombre = MESES[mes[2]!.toUpperCase()];
  // `03 ABRIL` no dice cuál de los dos meses es: no se adivina.
  if (porNombre === undefined || porNombre !== numero) return null;
  return aPeriodo(anio, numero);
}

/**
 * Período `MMAAAA` del nombre del archivo, según la guía, o `null`.
 *
 * Seis cifras exactas, sin otra cifra pegada: así `0000245` (un número de
 * comprobante) o `02092026` (una fecha, como en `CCT 02092026`) no se leen como
 * período. Un año suelto (`DDJJ IRE 2025`) no se toma: cuatro cifras pueden ser
 * cualquier cosa (un número de factura, «RG 90 2024»), y la guía no dice que
 * un año en el nombre sea siempre el ejercicio.
 */
export function periodoPorNombre(nombreArchivo: string): string | null {
  const sinExtension = nombreArchivo.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const encontrados = new Set<string>();
  for (const m of sinExtension.matchAll(/(?<!\d)(0[1-9]|1[0-2])(20\d{2})(?!\d)/g)) {
    encontrados.add(aPeriodo(Number(m[2]), Number(m[1])));
  }
  // Dos períodos distintos en el mismo nombre: no se elige uno.
  return encontrados.size === 1 ? [...encontrados][0]! : null;
}

/** `AAAA-MM` de una fecha, en UTC, como lo hacía el sincronizador hasta ahora. */
export function periodoPorFecha(fecha: Date): string {
  return aPeriodo(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1);
}

/**
 * Período de un documento: la carpeta; si no, el nombre; si no, la fecha.
 *
 * `fechaDeRespaldo` es la que se usa cuando ni la carpeta ni el nombre alcanzan.
 * Quien llama elige cuál: en OneDrive se prefiere `fileSystemInfo.lastModifiedDateTime`
 * si está (ver `ArchivoDrive.modificadoEnSistemaDeArchivos` en `@effort/drive`).
 */
export function deducirPeriodo(
  nombreArchivo: string,
  rutaCarpeta: string,
  fechaDeRespaldo: Date,
): PeriodoDeducido {
  const porCarpeta = periodoPorCarpeta(rutaCarpeta);
  if (porCarpeta) return { periodo: porCarpeta, origen: 'CARPETA' };

  const porNombre = periodoPorNombre(nombreArchivo);
  if (porNombre) return { periodo: porNombre, origen: 'NOMBRE' };

  return { periodo: periodoPorFecha(fechaDeRespaldo), origen: 'FECHA' };
}
