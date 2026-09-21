/**
 * Primitivos de la interfaz.
 *
 * Estos componentes no conocen ningún dato de EFFORT: reciben todo por
 * propiedades. Por eso sobreviven al cambio de datos falsos a datos reales,
 * y por eso se construyen antes que las pantallas.
 *
 * Regla transversal: ningún estado se comunica solo con color. Cada badge
 * lleva texto, y los que importan llevan además un ícono. Un coordinador con
 * daltonismo tiene que poder operar esto igual que el resto.
 */

import { AlertTriangle, Check, CircleDashed, Clock, Minus } from 'lucide-react';

/* --- Marca ---------------------------------------------------------------- */

export function Logotipo({ compacto = false }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="bg-marca-600 px-2.5 py-1 font-logotipo text-xl leading-none tracking-wide text-tinta-sobre-marca">
        EFFORT
      </span>
      {!compacto && (
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-tinta-tenue">
          Control 360
        </span>
      )}
    </span>
  );
}

/* --- Superficies ---------------------------------------------------------- */

export function Tarjeta({ children, className = '', ...resto }) {
  return (
    <section
      className={`rounded-md border border-borde bg-superficie shadow-1 ${className}`}
      {...resto}
    >
      {children}
    </section>
  );
}

/**
 * @param {{
 *   titulo: import('react').ReactNode,
 *   descripcion?: import('react').ReactNode,
 *   acciones?: import('react').ReactNode,
 * }} props
 */
export function EncabezadoTarjeta({ titulo, descripcion, acciones }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borde px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-xs text-tinta-tenue">{descripcion}</p>}
      </div>
      {acciones}
    </header>
  );
}

/* --- Estados -------------------------------------------------------------- */

const ESTILOS_ESTADO = {
  completo: 'bg-completo-fondo text-completo border-completo-borde',
  parcial: 'bg-parcial-fondo text-parcial border-parcial-borde',
  critico: 'bg-critico-fondo text-critico border-critico-borde',
  proceso: 'bg-proceso-fondo text-proceso border-proceso-borde',
  pendiente: 'bg-pendiente-fondo text-pendiente border-pendiente-borde',
};

const ICONOS_ESTADO = {
  completo: Check,
  parcial: Clock,
  critico: AlertTriangle,
  proceso: CircleDashed,
  pendiente: Minus,
};

export function Badge({ tono = 'pendiente', children, conIcono = true }) {
  const Icono = ICONOS_ESTADO[tono];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${ESTILOS_ESTADO[tono]}`}
    >
      {conIcono && Icono && <Icono size={12} strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* --- Botones -------------------------------------------------------------- */

const ESTILOS_BOTON = {
  primario:
    'bg-marca-600 text-tinta-sobre-marca hover:bg-marca-700 active:bg-marca-800 border-transparent',
  secundario:
    'bg-superficie text-tinta border-borde-fuerte hover:bg-superficie-hundida active:bg-superficie-tenue',
  fantasma:
    'bg-transparent text-tinta-suave border-transparent hover:bg-superficie-hundida hover:text-tinta',
};

/**
 * @param {{
 *   variante?: string,
 *   icono?: import('lucide-react').LucideIcon | null,
 *   children?: import('react').ReactNode,
 *   className?: string,
 * } & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Boton({ variante = 'secundario', icono: Icono = null, children, className = '', ...resto }) {
  return (
    <button
      type="button"
      // min-h-9 mantiene el área táctil por encima del mínimo accesible en móvil.
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS_BOTON[variante]} ${className}`}
      {...resto}
    >
      {Icono && <Icono size={15} strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  );
}

/* --- Formularios ------------------------------------------------------------ */

/**
 * Campo de formulario con rótulo y error asociados por `aria-describedby`.
 *
 * El error se anuncia junto al campo, no en un cartel aparte: quien usa un
 * lector de pantalla tiene que enterarse de qué campo falló sin tener que
 * buscarlo.
 */
export function CampoTexto({ etiqueta, id, error = null, className = '', ...resto }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-tinta-suave">
        {etiqueta}
      </label>
      <input
        id={id}
        className={`min-h-9 rounded border bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none ${
          error ? 'border-critico' : 'border-borde-fuerte'
        }`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...resto}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-critico">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Selector de formulario, mismo contrato visual y de accesibilidad que
 * `CampoTexto` (rótulo asociado, error anunciado por `aria-describedby`).
 * `opciones` es `{ valor, etiqueta }[]`; `placeholder`, si se pasa, agrega una
 * primera opción deshabilitada con `value=""` para forzar una elección.
 *
 * @param {{
 *   etiqueta: import('react').ReactNode,
 *   id: string,
 *   opciones: { valor: string, etiqueta: string }[],
 *   placeholder?: string | null,
 *   error?: import('react').ReactNode | null,
 *   className?: string,
 * } & import('react').SelectHTMLAttributes<HTMLSelectElement>} props
 */
export function CampoSelect({
  etiqueta,
  id,
  opciones,
  placeholder = null,
  error = null,
  className = '',
  ...resto
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-tinta-suave">
        {etiqueta}
      </label>
      <select
        id={id}
        className={`min-h-9 rounded border bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none ${
          error ? 'border-critico' : 'border-borde-fuerte'
        }`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...resto}
      >
        {placeholder !== null && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-xs text-critico">
          {error}
        </p>
      )}
    </div>
  );
}

/* --- Indicadores ---------------------------------------------------------- */

/**
 * Indicador numérico.
 *
 * `valor` llega ya calculado y formateado desde arriba. Este componente no
 * hace cuentas: si hiciera aritmética, habría cálculo de negocio escondido
 * en la capa de presentación, que es exactamente donde nadie lo audita.
 */
/**
 * @param {{
 *   etiqueta: import('react').ReactNode,
 *   valor: import('react').ReactNode,
 *   detalle?: import('react').ReactNode,
 *   tono?: string,
 *   destacado?: boolean,
 *   icono?: import('lucide-react').LucideIcon | null,
 *   retardoMs?: number,
 * }} props
 */
export function Indicador({
  etiqueta,
  valor,
  detalle,
  tono = 'pendiente',
  destacado = false,
  icono: Icono = null,
  retardoMs = 0,
}) {
  const barra = {
    completo: 'bg-completo',
    parcial: 'bg-parcial',
    critico: 'bg-critico',
    proceso: 'bg-proceso',
    pendiente: 'bg-pendiente',
  }[tono];

  const iconoFondo = {
    completo: 'bg-completo-fondo text-completo',
    parcial: 'bg-parcial-fondo text-parcial',
    critico: 'bg-critico-fondo text-critico',
    proceso: 'bg-proceso-fondo text-proceso',
    pendiente: 'bg-pendiente-fondo text-pendiente',
  }[tono];

  return (
    <div
      className={`animar-entrada relative overflow-hidden rounded-md border bg-superficie px-4 py-3 shadow-1 transition-shadow duration-300 hover:shadow-2 ${
        destacado ? 'border-critico-borde' : 'border-borde'
      }`}
      style={{ '--retardo-entrada': `${retardoMs}ms` }}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${barra}`} aria-hidden="true" />
      {/* Absoluto y no en fila con la etiqueta a propósito: varias pantallas
          ubican esta tarjeta con `.closest('div')` desde el texto de la
          etiqueta, y eso depende de que siga siendo hijo directo del div
          exterior. Un `<div>` envolvente nuevo aquí sería el div más cercano
          y rompería esa búsqueda en todas ellas. */}
      {Icono && (
        <span
          className={`absolute right-3 top-3 flex h-6 w-6 shrink-0 items-center justify-center rounded ${iconoFondo}`}
          aria-hidden="true"
        >
          <Icono size={13} strokeWidth={2.25} />
        </span>
      )}
      <p className="max-w-[calc(100%-2rem)] text-[11px] font-medium uppercase tracking-wide text-tinta-tenue">{etiqueta}</p>
      <p className="cifra mt-1 text-2xl font-semibold leading-none text-tinta">{valor}</p>
      {detalle && <p className="mt-1.5 text-xs text-tinta-tenue">{detalle}</p>}
    </div>
  );
}

/**
 * Esqueleto de `Indicador`, misma huella (borde, alto, barra lateral) para
 * que el primer instante de carga no salte de tamaño cuando llegan los datos.
 */
export function IndicadorEsqueleto() {
  return (
    <div className="relative overflow-hidden rounded-md border border-borde bg-superficie px-4 py-3 shadow-1" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 w-1 bg-borde" />
      <div className="esqueleto h-2.5 w-24 rounded" />
      <div className="esqueleto mt-2.5 h-6 w-12 rounded" />
    </div>
  );
}

/** Esqueleto de una `Tarjeta` con tabla adentro: encabezado + filas. */
export function TarjetaEsqueleto({ filas = 4 }) {
  return (
    <Tarjeta aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b border-borde px-5 py-4">
        <div className="esqueleto h-3.5 w-40 rounded" />
        <div className="esqueleto h-2.5 w-56 rounded" />
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="esqueleto h-4 w-full rounded" />
        ))}
      </div>
    </Tarjeta>
  );
}

/* --- Tablas --------------------------------------------------------------- */

/**
 * `anchoMinimo` es una clase de Tailwind. El valor por defecto (52rem) es el
 * que tienen todas las tablas anchas del sistema; una tabla de dos o tres
 * columnas dentro de media pantalla lo sobrepasa y hace scroll sin ningún
 * motivo, y ahí se pasa `min-w-0`.
 */
export function Tabla({ children, etiqueta, anchoMinimo = 'min-w-[52rem]' }) {
  // El contenedor scrollea solo, para que la página nunca scrollee horizontal.
  // `[&_tbody_tr]` en vez de agregar la clase fila por fila: cualquier pantalla
  // que ya arma sus <tr> sigue funcionando sin tocarlas una por una.
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full ${anchoMinimo} border-collapse text-sm [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-superficie-hundida`}
        aria-label={etiqueta}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, numerica = false, className = '' }) {
  return (
    <th
      scope="col"
      data-tipo={numerica ? 'cifra' : undefined}
      className={`whitespace-nowrap border-b border-borde px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-tinta-tenue ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, numerica = false, className = '' }) {
  return (
    <td
      data-tipo={numerica ? 'cifra' : undefined}
      className={`border-b border-borde px-4 py-3 align-middle text-tinta ${className}`}
    >
      {children}
    </td>
  );
}
