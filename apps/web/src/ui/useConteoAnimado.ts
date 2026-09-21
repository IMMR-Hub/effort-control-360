import { useEffect, useRef, useState } from 'react';

/**
 * Anima un número entero desde 0 hasta `valorFinal` al montarse o al cambiar
 * de valor. Vive aparte de `Indicador` a propósito: ese componente lo usan
 * ocho pantallas más, y ninguna necesita el conteo — solo el Panel general,
 * que es la primera pantalla que ve alguien nuevo.
 *
 * Respeta `prefers-reduced-motion` a mano: la guarda global de `tokens.css`
 * anula transiciones y animaciones CSS, pero esto mueve un número con
 * `requestAnimationFrame`, que esa regla no toca.
 */
export function useConteoAnimado(valorFinal: number, duracionMs = 600): number {
  const [valor, setValor] = useState(valorFinal);
  const anterior = useRef(valorFinal);

  useEffect(() => {
    const prefiereMenosMovimiento =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const desde = anterior.current;
    const hasta = valorFinal;
    anterior.current = valorFinal;

    if (prefiereMenosMovimiento || desde === hasta) {
      setValor(hasta);
      return;
    }

    let cuadro: number;
    const inicio = performance.now();

    const tick = (ahora: number) => {
      const proporcion = Math.min((ahora - inicio) / duracionMs, 1);
      // Ease-out cúbico: arranca rápido y frena, no es un contador de taxímetro.
      const suavizado = 1 - (1 - proporcion) ** 3;
      setValor(Math.round(desde + (hasta - desde) * suavizado));
      if (proporcion < 1) cuadro = requestAnimationFrame(tick);
    };

    cuadro = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(cuadro);
  }, [valorFinal, duracionMs]);

  return valor;
}
