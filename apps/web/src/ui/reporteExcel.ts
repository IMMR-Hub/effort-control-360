/**
 * Reportes en Excel: cada pantalla descarga lo que está mostrando.
 *
 * Pedido de EFFORT vía Daniel (2026-10-02): reportes generales, por cliente y
 * por rango de fechas, «todo pero por separado (…) si están en la página de
 * vencimientos pueden imprimir eso, si están en la página de seguimiento, eso».
 * Por eso no hay una pantalla de reportes aparte: el reporte ES la pantalla,
 * con los filtros que tenga puestos (cliente, fechas, nivel).
 *
 * Se arma con lo que la pantalla ya trajo del servidor, que ya viene recortado
 * por la cartera de quien mira: un reporte nunca trae más de lo que esa persona
 * ya puede ver, y no hace falta ninguna ruta ni permiso nuevo.
 *
 * `exceljs` (la misma librería con la que el sistema LEE los Excel de EFFORT)
 * pesa cerca de 1 MB: se carga recién cuando alguien aprieta «Descargar
 * Excel», no al abrir el sistema.
 */

/**
 * La pantalla todavía está trayendo datos: un Excel armado en ese instante
 * tendría el cliente nuevo en el título y las filas del anterior. El botón lo
 * muestra como «esperá», no como una falla.
 */
export class DatosTodaviaCargando extends Error {
  constructor() {
    super('Los datos todavía se están cargando.');
    this.name = 'DatosTodaviaCargando';
  }
}

/** Lo que puede ir en una celda. `null`/`undefined` = celda vacía. */
export type ValorDeCelda = string | number | bigint | null | undefined;

/**
 * - `texto`: tal cual.
 * - `entero`: número (días, cantidades), alineado a la derecha y sumable.
 * - `guaranies`: importe en guaraníes enteros, con separador de miles.
 * - `fecha`: `AAAA-MM-DD` → fecha de Excel (dd/mm/aaaa), ordenable y filtrable.
 */
export type FormatoDeColumna = 'texto' | 'entero' | 'guaranies' | 'fecha';

export interface ColumnaDeReporte<T> {
  readonly titulo: string;
  readonly valor: (fila: T) => ValorDeCelda;
  readonly formato?: FormatoDeColumna;
}

export interface HojaDeReporte {
  readonly nombre: string;
  readonly columnas: readonly ColumnaDeReporte<never>[];
  readonly filas: readonly unknown[];
}

export interface Reporte {
  /** Nombre de la pantalla: «Vencimientos», «Alertas»… También encabeza el archivo. */
  readonly titulo: string;
  /** Los filtros puestos, ya en palabras: «Cliente: GARSO S.A.», «Vencen: octubre de 2026». */
  readonly filtros: readonly string[];
  readonly hojas: readonly HojaDeReporte[];
}

/**
 * Arma una hoja con sus tipos: cada columna sabe leer una fila de `filas`.
 * Devuelve la forma sin tipo para poder juntar hojas de filas distintas en un
 * mismo reporte.
 */
export function hoja<T>(nombre: string, columnas: readonly ColumnaDeReporte<T>[], filas: readonly T[]): HojaDeReporte {
  return { nombre, columnas: columnas as readonly ColumnaDeReporte<never>[], filas };
}

const FILA_DE_ENCABEZADO = 5;
const ANCHO_MINIMO = 8;
const ANCHO_MAXIMO = 60;
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Excel no acepta `[]:*?/\` en el nombre de una hoja, ni más de 31 caracteres. */
export function nombreDeHojaValido(nombre: string): string {
  const limpio = nombre.replace(/[[\]:*?/\\]/g, '-').trim().slice(0, 31);
  return limpio === '' ? 'Hoja' : limpio;
}

/** Windows no acepta `\/:*?"<>|` en un nombre de archivo. */
export function nombreDeArchivo(reporte: Pick<Reporte, 'titulo'>, detalle: string | null, ahora: Date): string {
  const fecha = fechaEnParaguay(ahora);
  const partes = [reporte.titulo, detalle, fecha].filter((p): p is string => p !== null && p !== '');
  return `${partes.join(' - ').replace(/[\\/:*?"<>|]/g, '-')}.xlsx`;
}

/** `AAAA-MM-DD` del día en Paraguay (regla 3: vencimientos en `America/Asuncion`). */
function fechaEnParaguay(ahora: Date): string {
  // `en-CA` da exactamente AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(ahora);
}

function momentoEnParaguay(ahora: Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ahora);
}

/**
 * Convierte un valor a lo que va en la celda. Un importe que no entra exacto
 * en un número de Excel (más de 9 mil billones) va como texto: es preferible
 * que no se pueda sumar a que se redondee en silencio.
 */
function valorDeCelda(valor: ValorDeCelda, formato: FormatoDeColumna): string | number | Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (formato === 'fecha' && typeof valor === 'string') {
    const partes = FECHA_ISO.exec(valor);
    if (partes) return new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
    return valor;
  }
  if (formato === 'entero' || formato === 'guaranies') {
    let entero: bigint | null = null;
    if (typeof valor === 'bigint') entero = valor;
    else if (typeof valor === 'number' && Number.isInteger(valor)) entero = BigInt(valor);
    else if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) entero = BigInt(valor.trim());
    if (entero === null) return typeof valor === 'number' ? valor : String(valor);
    const maximo = BigInt(Number.MAX_SAFE_INTEGER);
    return entero <= maximo && entero >= -maximo ? Number(entero) : entero.toString();
  }
  return typeof valor === 'bigint' ? valor.toString() : valor;
}

function largoParaAncho(valor: string | number | Date | null): number {
  if (valor === null) return 0;
  if (valor instanceof Date) return 10;
  if (typeof valor === 'number') return valor.toLocaleString('es-PY').length;
  return Math.max(...valor.split('\n').map((linea) => linea.length));
}

type ModuloExcel = typeof import('exceljs');

async function cargarExcel(): Promise<ModuloExcel> {
  const modulo = (await import('exceljs')) as ModuloExcel & { default?: ModuloExcel };
  // En el navegador llega la versión empaquetada (UMD) como `default`; en
  // Node (las pruebas), el módulo CommonJS directo.
  return modulo.default ?? modulo;
}

/** El archivo `.xlsx` en bytes. Separado de la descarga para poder probarlo. */
export async function armarLibroDeExcel(reporte: Reporte, ahora: Date): Promise<ArrayBuffer> {
  const ExcelJS = await cargarExcel();
  const libro = new ExcelJS.Workbook();
  libro.creator = 'EFFORT Control 360';
  libro.created = ahora;

  const usados = new Set<string>();
  for (const definicion of reporte.hojas) {
    // Dos hojas no pueden llamarse igual (ni distinto solo en mayúsculas).
    let nombre = nombreDeHojaValido(definicion.nombre);
    for (let n = 2; usados.has(nombre.toLowerCase()); n += 1) {
      nombre = `${nombreDeHojaValido(definicion.nombre).slice(0, 27)} (${n})`;
    }
    usados.add(nombre.toLowerCase());

    const hojaDeExcel = libro.addWorksheet(nombre, {
      views: [{ state: 'frozen', ySplit: FILA_DE_ENCABEZADO }],
    });
    const columnas = definicion.columnas;

    hojaDeExcel.getCell(1, 1).value = definicion.nombre === reporte.titulo ? reporte.titulo : `${reporte.titulo} — ${definicion.nombre}`;
    hojaDeExcel.getCell(1, 1).font = { bold: true, size: 14 };
    hojaDeExcel.getCell(2, 1).value = `EFFORT Control 360 · generado el ${momentoEnParaguay(ahora)} (hora de Paraguay)`;
    hojaDeExcel.getCell(2, 1).font = { italic: true, color: { argb: 'FF666666' } };
    hojaDeExcel.getCell(3, 1).value =
      reporte.filtros.length === 0 ? 'Sin filtros: todo lo que muestra la pantalla.' : `Filtros: ${reporte.filtros.join(' · ')}`;

    const anchos = columnas.map((c) => c.titulo.length);
    const encabezado = hojaDeExcel.getRow(FILA_DE_ENCABEZADO);
    columnas.forEach((columna, i) => {
      const celda = encabezado.getCell(i + 1);
      celda.value = columna.titulo;
      celda.font = { bold: true };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE7EE' } };
      celda.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
      celda.alignment = { vertical: 'middle', wrapText: true };
    });

    definicion.filas.forEach((fila, indice) => {
      const filaDeExcel = hojaDeExcel.getRow(FILA_DE_ENCABEZADO + 1 + indice);
      columnas.forEach((columna, i) => {
        const formato = columna.formato ?? 'texto';
        const valor = valorDeCelda(columna.valor(fila as never), formato);
        const celda = filaDeExcel.getCell(i + 1);
        celda.value = valor;
        if (valor instanceof Date) celda.numFmt = 'dd/mm/yyyy';
        else if (typeof valor === 'number' && formato === 'guaranies') celda.numFmt = '#,##0';
        anchos[i] = Math.max(anchos[i] ?? 0, largoParaAncho(valor));
      });
    });

    if (definicion.filas.length === 0) {
      hojaDeExcel.getCell(FILA_DE_ENCABEZADO + 1, 1).value = 'No hay filas con estos filtros.';
      hojaDeExcel.getCell(FILA_DE_ENCABEZADO + 1, 1).font = { italic: true, color: { argb: 'FF666666' } };
    } else if (columnas.length > 0) {
      hojaDeExcel.autoFilter = {
        from: { row: FILA_DE_ENCABEZADO, column: 1 },
        to: { row: FILA_DE_ENCABEZADO + definicion.filas.length, column: columnas.length },
      };
    }

    anchos.forEach((ancho, i) => {
      hojaDeExcel.getColumn(i + 1).width = Math.min(ANCHO_MAXIMO, Math.max(ANCHO_MINIMO, ancho + 2));
    });
  }

  if (reporte.hojas.length === 0) libro.addWorksheet('Reporte').getCell(1, 1).value = 'No hay nada para mostrar.';

  return (await libro.xlsx.writeBuffer()) as ArrayBuffer;
}

/**
 * Arma el archivo y lo baja con un nombre que dice qué es:
 * «Vencimientos - FUMIPRO S.A. - 2026-10-02.xlsx».
 */
export async function descargarReporte(reporte: Reporte, detalleDelNombre: string | null = null): Promise<void> {
  const ahora = new Date();
  const contenido = await armarLibroDeExcel(reporte, ahora);
  const archivo = new Blob([contenido], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombreDeArchivo(reporte, detalleDelNombre, ahora);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después: algunos navegadores todavía están leyendo el archivo
  // cuando `click()` vuelve.
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
}
