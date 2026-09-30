/**
 * Una fila por archivo en la lista de Documentos, no una por versión guardada.
 *
 * Encontrado revisando producción el 2026-09-30: cada vez que alguien de EFFORT
 * guarda un Excel en OneDrive, la sincronización lo trae de nuevo (bien: el
 * contenido cambió) y queda como un documento más. Un archivo que estuvieron
 * editando dos días aparecía 20 veces seguidas en la lista de COPESA.
 *
 * Esto NO borra ni esconde para siempre: las versiones siguen en la base y la
 * pantalla deja verlas. Solo agrupa lo que muestra, por la ruta del archivo en
 * OneDrive, y se queda con el más reciente. Un documento sin archivo (cargado a
 * mano) es siempre su propia fila.
 */

export interface DocumentoConRuta {
  readonly id: string;
  readonly recibidoEn: string;
  readonly rutaOneDrive?: string | null;
}

export interface DocumentosAgrupados<T> {
  /** El más reciente de cada archivo, en el orden en que llegaron. */
  readonly ultimas: readonly T[];
  /** Cuántas versiones tiene el archivo de cada fila de `ultimas` (por id). */
  readonly versiones: ReadonlyMap<string, number>;
  /** Versiones anteriores que no están en `ultimas`. */
  readonly anteriores: number;
}

export function agruparVersiones<T extends DocumentoConRuta>(
  documentos: readonly T[],
): DocumentosAgrupados<T> {
  const porArchivo = new Map<string, { ganador: T; cantidad: number }>();
  const clave = (doc: T) => (doc.rutaOneDrive ? `ruta:${doc.rutaOneDrive}` : `id:${doc.id}`);

  for (const doc of documentos) {
    const k = clave(doc);
    const previo = porArchivo.get(k);
    if (!previo) {
      porArchivo.set(k, { ganador: doc, cantidad: 1 });
      continue;
    }
    previo.cantidad += 1;
    // Gana la versión recibida más tarde; si empatan, la que ya estaba.
    if (doc.recibidoEn > previo.ganador.recibidoEn) previo.ganador = doc;
  }

  const ganadores = new Set([...porArchivo.values()].map((g) => g.ganador.id));
  const versiones = new Map([...porArchivo.values()].map((g) => [g.ganador.id, g.cantidad] as const));
  const ultimas = documentos.filter((doc) => ganadores.has(doc.id));

  return { ultimas, versiones, anteriores: documentos.length - ultimas.length };
}
