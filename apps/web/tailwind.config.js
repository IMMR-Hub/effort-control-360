/**
 * Tailwind mapeado a los tokens de `src/estilos/tokens.css`.
 *
 * Ninguna clase de la interfaz nombra un color directo: se usan nombres
 * semánticos (`bg-superficie`, `text-tinta`, `border-borde`). Así el modo
 * oscuro y cualquier ajuste de marca ocurren en un solo archivo, y no hay
 * que perseguir hexadecimales por 40 componentes.
 */

/** Construye un color con canales HSL sueltos, para que funcione `bg-x/50`. */
const conAlfa = (variable) => `hsl(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-tema="oscuro"]'],
  theme: {
    extend: {
      colors: {
        marca: {
          50: conAlfa('--marca-50'),
          100: conAlfa('--marca-100'),
          200: conAlfa('--marca-200'),
          300: conAlfa('--marca-300'),
          400: conAlfa('--marca-400'),
          500: conAlfa('--marca-500'),
          600: conAlfa('--marca-600'),
          700: conAlfa('--marca-700'),
          800: conAlfa('--marca-800'),
          900: conAlfa('--marca-900'),
          950: conAlfa('--marca-950'),
        },

        lienzo: conAlfa('--lienzo'),
        superficie: conAlfa('--superficie'),
        'superficie-elevada': conAlfa('--superficie-elevada'),
        'superficie-hundida': conAlfa('--superficie-hundida'),
        'superficie-tenue': conAlfa('--superficie-tenue'),

        tinta: conAlfa('--tinta'),
        'tinta-suave': conAlfa('--tinta-suave'),
        'tinta-tenue': conAlfa('--tinta-tenue'),
        'tinta-sobre-marca': conAlfa('--tinta-sobre-marca'),

        borde: conAlfa('--borde'),
        'borde-fuerte': conAlfa('--borde-fuerte'),
        'borde-marca': conAlfa('--borde-marca'),

        completo: conAlfa('--completo'),
        'completo-fondo': conAlfa('--completo-fondo'),
        'completo-borde': conAlfa('--completo-borde'),
        parcial: conAlfa('--parcial'),
        'parcial-fondo': conAlfa('--parcial-fondo'),
        'parcial-borde': conAlfa('--parcial-borde'),
        critico: conAlfa('--critico'),
        'critico-fondo': conAlfa('--critico-fondo'),
        'critico-borde': conAlfa('--critico-borde'),
        proceso: conAlfa('--proceso'),
        'proceso-fondo': conAlfa('--proceso-fondo'),
        'proceso-borde': conAlfa('--proceso-borde'),
        pendiente: conAlfa('--pendiente'),
        'pendiente-fondo': conAlfa('--pendiente-fondo'),
        'pendiente-borde': conAlfa('--pendiente-borde'),
      },

      fontFamily: {
        logotipo: 'var(--fuente-logotipo)',
        interfaz: 'var(--fuente-interfaz)',
      },

      boxShadow: {
        1: 'var(--sombra-1)',
        2: 'var(--sombra-2)',
        3: 'var(--sombra-3)',
        modal: 'var(--sombra-modal)',
      },

      ringColor: {
        foco: conAlfa('--anillo-foco'),
      },

      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
      },

      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
};
