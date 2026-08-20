/**
 * Mock de `fetch` compartido por los tests de pantalla, enrutado por
 * `(método, ruta)` y no por orden de llegada.
 *
 * Con una cola global (`mockResolvedValueOnce` encadenado) alcanza con que
 * una sola promesa de un test se resuelva un instante tarde para que "robe"
 * la respuesta que le tocaba al test siguiente — corriendo la cola para todo
 * lo que viene después, con fallas que no tienen nada que ver con el test que
 * las muestra. Extraído de `Acceso.test.tsx` (tarea 102) para las 11 pantallas
 * restantes de la tarea 104: el problema es el mismo en cada una.
 */

import { vi } from 'vitest';

export function respuestaJson(cuerpo: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

type ClaveRuta = `${string} ${string}`;

export function crearFetchMock() {
  const manejadores = new Map<ClaveRuta, () => Response>();

  const fetchMock = vi.fn((entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const ruta = new URL(String(entrada)).pathname;
    const metodo = (opciones?.method ?? 'GET').toUpperCase();
    const clave = `${metodo} ${ruta}` as ClaveRuta;
    const manejador = manejadores.get(clave);
    if (!manejador) {
      throw new Error(`Ruta no mockeada en este test: ${clave}`);
    }
    return Promise.resolve(manejador());
  });

  return {
    fetchMock,
    /** Reemplaza la respuesta de una ruta. Se puede llamar de nuevo para cambiarla a mitad de un test. */
    mockDeRuta(clave: ClaveRuta, fabrica: () => Response) {
      manejadores.set(clave, fabrica);
    },
    llamadasA(clave: ClaveRuta) {
      return fetchMock.mock.calls.filter(([entrada, opciones]) => {
        const ruta = new URL(String(entrada)).pathname;
        const metodo = String((opciones as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        return `${metodo} ${ruta}` === clave;
      });
    },
  };
}
