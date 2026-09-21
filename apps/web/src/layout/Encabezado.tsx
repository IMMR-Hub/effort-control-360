/**
 * Barra lateral compartida por todas las pantallas autenticadas (tarea 104).
 *
 * Hasta el 2026-09-21 esto era una barra HORIZONTAL arriba de todo, con los
 * 13 enlaces en una fila que se envolvía en 2-3 líneas en una laptop común.
 * Daniel, con capturas de un mockup anterior en la mano: *"el menu es mas
 * util [así]... ocupa demasiado espacio y se tiene que scrolear para empezar
 * a ver lo que hay de información. La idea de un Dashboard es que tenga todo
 * a mano visible."* Tenía razón: una barra que crece hacia abajo compite por
 * el mismo espacio vertical que el panel necesita mostrar. Una barra lateral
 * fija a la izquierda usa espacio horizontal, que sobra en cualquier pantalla
 * de escritorio, y no empuja nada hacia abajo.
 *
 * El nombre del archivo/componente queda igual (`Encabezado`) para no romper
 * los imports de `Aplicacion.tsx`: es un cambio de layout, no de identidad.
 */

import {
  Bell,
  Building2,
  CalendarClock,
  Database,
  FileText,
  History,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Receipt,
  Send,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

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
  | 'iva'
  | 'alertas'
  | 'equipo'
  | 'reglas'
  | 'eventos'
  | 'panel';

interface EnlaceDeNav {
  readonly id: Pantalla;
  readonly etiqueta: string;
  readonly icono: LucideIcon;
  /**
   * Roles que pueden entrar. Sin esto, la pestaña aparece para todos.
   *
   * Es solo cosmético: quien decide de verdad es el servidor, que rechaza la
   * petición igual. Ocultar la pestaña evita que alguien la abra y se choque
   * con un error que no explica nada.
   */
  readonly soloRoles?: readonly string[];
}

/** Se completa a medida que la tarea 104 va reemplazando el resto de las pantallas. */
const ENLACES: readonly EnlaceDeNav[] = [
  { id: 'panel', etiqueta: 'Panel general', icono: LayoutDashboard },
  { id: 'seguimiento', etiqueta: 'Seguimiento', icono: MessageCircle },
  { id: 'clientes', etiqueta: 'Clientes', icono: Building2 },
  { id: 'documentos', etiqueta: 'Documentos / IVA', icono: FileText },
  { id: 'vencimientos', etiqueta: 'Vencimientos', icono: CalendarClock },
  { id: 'balances', etiqueta: 'Balances', icono: Landmark },
  { id: 'siga', etiqueta: 'SIGA / Conciliación', icono: Database },
  { id: 'liquidaciones', etiqueta: 'Liquidaciones', icono: Send },
  { id: 'iva', etiqueta: 'IVA', icono: Receipt },
  { id: 'alertas', etiqueta: 'Alertas', icono: Bell },
  { id: 'equipo', etiqueta: 'Equipo', icono: UserCog },
  { id: 'reglas', etiqueta: 'Reglas', icono: SlidersHorizontal },
  { id: 'eventos', etiqueta: 'Eventos', icono: History, soloRoles: ['direccion'] },
];

interface Props {
  readonly activa: Pantalla;
  readonly onCambiar: (pantalla: Pantalla) => void;
}

export function Encabezado({ activa, onCambiar }: Props) {
  const { cerrarSesion, sesion } = useSesion();
  const rol = sesion?.rol ?? '';
  const enlacesVisibles = ENLACES.filter(
    (enlace) => !enlace.soloRoles || enlace.soloRoles.includes(rol),
  );

  return (
    // Fila arriba de todo en una pantalla angosta, columna fija a la
    // izquierda desde `lg`: el mismo árbol de elementos, en el mismo orden
    // (logo, nav, salir), solo cambia la dirección del flex. Así no hace
    // falta mantener dos versiones del menú.
    <header className="sticky top-0 z-20 flex w-full items-center gap-1 border-b border-borde bg-superficie px-2 py-2 lg:h-dvh lg:w-60 lg:flex-col lg:items-stretch lg:gap-0 lg:border-b-0 lg:border-r lg:px-0 lg:py-0">
      <div className="flex items-center gap-2 px-2 py-1.5 lg:border-b lg:border-borde lg:px-4 lg:py-3.5">
        <Logotipo compacto />
      </div>

      <nav
        aria-label="Navegación principal"
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto lg:flex-none lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:px-2 lg:py-3"
      >
        {enlacesVisibles.map((enlace) => {
          const Icono = enlace.icono;
          const estaActiva = activa === enlace.id;
          return (
            <button
              key={enlace.id}
              type="button"
              onClick={() => onCambiar(enlace.id)}
              aria-current={estaActiva ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                estaActiva
                  ? 'bg-marca-600 text-tinta-sobre-marca'
                  : 'text-tinta-suave hover:bg-superficie-tenue hover:text-tinta'
              }`}
            >
              <Icono size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              {enlace.etiqueta}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 px-1 lg:border-t lg:border-borde lg:p-2">
        <Boton
          variante="fantasma"
          icono={LogOut}
          onClick={() => void cerrarSesion()}
          className="justify-start lg:w-full"
          aria-label="Cerrar sesión"
        >
          {/* Oculto en la barra angosta por espacio; el `aria-label` de
              arriba mantiene el mismo nombre accesible en los dos anchos. */}
          <span className="hidden lg:inline">Cerrar sesión</span>
        </Boton>
      </div>
    </header>
  );
}
