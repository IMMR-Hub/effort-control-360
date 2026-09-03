/**
 * Encabezado compartido por todas las pantallas autenticadas (tarea 104).
 *
 * Antes cada pantalla dibujaba su propio `<header>` con el logotipo — viable
 * con una sola pantalla real (Seguimiento), no con doce. Se saca a un lugar
 * común apenas aparece la segunda pantalla (Clientes), antes de que la
 * duplicación se repita diez veces más.
 */

import { LogOut } from 'lucide-react';

import { Boton, Logotipo } from '../ui/Primitivos.jsx';
import { useSesion } from '../contexts/SesionContext.js';

export type Pantalla =
  | 'seguimiento'
  | 'clientes'
  | 'documentos'
  | 'vencimientos'
  | 'balances'
  | 'siga'
  | 'liquidaciones'
  | 'alertas'
  | 'equipo'
  | 'reglas'
  | 'eventos'
  | 'panel';

interface EnlaceDeNav {
  readonly id: Pantalla;
  readonly etiqueta: string;
}

/** Se completa a medida que la tarea 104 va reemplazando el resto de las pantallas. */
const ENLACES: readonly EnlaceDeNav[] = [
  { id: 'seguimiento', etiqueta: 'Seguimiento' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'documentos', etiqueta: 'Documentos / IVA' },
  { id: 'vencimientos', etiqueta: 'Vencimientos' },
  { id: 'balances', etiqueta: 'Balances' },
  { id: 'siga', etiqueta: 'SIGA / Conciliación' },
  { id: 'liquidaciones', etiqueta: 'Liquidaciones' },
  { id: 'alertas', etiqueta: 'Alertas' },
  { id: 'equipo', etiqueta: 'Equipo' },
  { id: 'reglas', etiqueta: 'Reglas' },
  { id: 'eventos', etiqueta: 'Eventos' },
  { id: 'panel', etiqueta: 'Panel general' },
];

interface Props {
  readonly activa: Pantalla;
  readonly onCambiar: (pantalla: Pantalla) => void;
}

export function Encabezado({ activa, onCambiar }: Props) {
  const { cerrarSesion } = useSesion();

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
      <div className="mx-auto flex max-w-[86rem] flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-6">
          <Logotipo />
          <nav aria-label="Navegación principal" className="flex items-center gap-1">
            {ENLACES.map((enlace) => (
              <button
                key={enlace.id}
                type="button"
                onClick={() => onCambiar(enlace.id)}
                aria-current={activa === enlace.id ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  activa === enlace.id
                    ? 'bg-marca-600 text-tinta-sobre-marca'
                    : 'text-tinta-suave hover:bg-superficie-tenue'
                }`}
              >
                {enlace.etiqueta}
              </button>
            ))}
          </nav>
        </div>
        <Boton variante="fantasma" icono={LogOut} onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </Boton>
      </div>
    </header>
  );
}
