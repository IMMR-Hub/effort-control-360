/**
 * Un solo cálculo de IVA a la vez.
 *
 * El cálculo corre por dos caminos: el botón "Recalcular" de la pantalla de IVA
 * y la corrida automática de cada hora. Hasta el 2026-09-16 nada impedía que
 * los dos corrieran juntos, y dos cálculos simultáneos sobre los mismos
 * períodos pueden guardar hallazgos repetidos (el índice único deja pasar los
 * de tasa nula) y duplican el uso de memoria en un contenedor de 512 MB.
 *
 * El candado vive en memoria del proceso: alcanza porque la API corre en una
 * sola instancia. Si algún día corre en varias, esto tiene que pasar a la base.
 */

let ocupado = false;

export type ResultadoConCandado<T> = { readonly ocupado: true } | { readonly ocupado: false; readonly valor: T };

/**
 * Corre `tarea` si no hay otro cálculo en curso; si lo hay, no la corre y lo
 * dice. Quien llama decide qué hacer: la ruta responde 409, el programador
 * saltea el IVA en esa vuelta y sigue con las alertas.
 */
export async function intentarConCandado<T>(tarea: () => Promise<T>): Promise<ResultadoConCandado<T>> {
  if (ocupado) return { ocupado: true };
  ocupado = true;
  try {
    return { ocupado: false, valor: await tarea() };
  } finally {
    ocupado = false;
  }
}
