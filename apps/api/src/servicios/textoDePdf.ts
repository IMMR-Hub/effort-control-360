/**
 * Texto de las primeras páginas de un PDF.
 *
 * Usa `pdfjs-dist`, el lector de PDF de Mozilla: JavaScript puro, sin binarios
 * nativos que compilar en el contenedor. Se agregó el 2026-09-14 para leer las
 * declaraciones juradas de la DNIT, que traen el número de orden y la fecha de
 * presentación solo en el contenido, nunca en el nombre del archivo.
 *
 * Solo las dos primeras páginas: todo lo que identifica una presentación
 * (formulario, RUC, período, número de orden, fecha) está en la cabecera de la
 * primera. Leer un PDF entero de treinta páginas para eso es memoria gastada.
 *
 * `isEvalSupported: false` porque el contenido viene de afuera: un PDF no tiene
 * por qué poder ejecutar código en el servidor.
 */

const PAGINAS_A_LEER = 2;

export async function extraerTextoDePdf(contenido: Buffer): Promise<string> {
  // Importación dinámica: el módulo es grande y solo lo necesita el detector de
  // presentaciones. Cargarlo al arrancar sumaría memoria a un proceso que puede
  // no llegar a usarlo nunca.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const documento = await pdfjs.getDocument({
    data: new Uint8Array(contenido),
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  try {
    const partes: string[] = [];
    for (let numero = 1; numero <= Math.min(documento.numPages, PAGINAS_A_LEER); numero += 1) {
      const pagina = await documento.getPage(numero);
      const contenidoDePagina = await pagina.getTextContent();
      partes.push(
        contenidoDePagina.items.map((item: object) => ('str' in item ? String(item.str) : '')).join(' '),
      );
    }
    return partes.join('\n');
  } finally {
    // Sin esto, pdfjs retiene el documento en memoria hasta que el recolector
    // decida: en una vuelta de sesenta PDFs eso se nota.
    await documento.destroy();
  }
}
