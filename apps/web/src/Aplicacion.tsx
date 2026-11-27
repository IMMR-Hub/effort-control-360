/**
 * Barrera de sesión (tarea 102): sin sesión no hay pantalla real que ver.
 *
 * `sesion === undefined` mientras `<ProveedorDeSesion>` todavía está
 * confirmando si ya hay una sesión activa (la primera carga de la página);
 * `null` significa que ya se confirmó que no hay ninguna.
 */

import { useState } from 'react';

import type { FiltroDeNivel } from './ui/etiquetas.js';

import { ProveedorDeSesion, useSesion } from './contexts/SesionContext.js';
import { Acceso } from './pantallas/Acceso.js';
import { CambioDeContrasena } from './pantallas/CambioDeContrasena.js';
import { Encabezado, type Pantalla } from './layout/Encabezado.js';
import Seguimiento, { type PestanaDeSeguimiento } from './pantallas/Seguimiento.js';
import Clientes from './pantallas/Clientes.js';
import Documentos from './pantallas/Documentos.js';
import Vencimientos from './pantallas/Vencimientos.js';
import Faltantes from './pantallas/Faltantes.js';
import Balances from './pantallas/Balances.js';
import Siga from './pantallas/Siga.js';
import Liquidaciones from './pantallas/Liquidaciones.js';
import Alertas from './pantallas/Alertas.js';
import Equipo from './pantallas/Equipo.js';
import Reglas from './pantallas/Reglas.js';
import Eventos from './pantallas/Eventos.js';
import LiquidacionIva from './pantallas/LiquidacionIva.js';
import Panel, { precargarPanel } from './pantallas/Panel.js';
import Horas from './pantallas/Horas.js';

/**
 * Lo que recibe cada pantalla. Hoy solo el Panel lo usa —sus indicadores
 * llevan a su módulo—, pero cualquier pantalla puede navegar sin inventar su
 * propio mecanismo. Una función con menos parámetros sigue siendo asignable,
 * así que las otras once no se tocan.
 */
export interface PropsDePantalla {
  readonly irA: (pantalla: Pantalla, opciones?: OpcionesDeNavegacion) => void;
  /** Filtro con el que abre la pantalla si se llegó desde un indicador del Panel. */
  readonly nivelInicial?: FiltroDeNivel;
  /** El cliente y el colaborador elegidos en el Panel, para no perderlos al seguir un indicador. */
  readonly clienteInicial?: string;
  readonly colaboradorInicial?: string;
  /** Pestaña con la que abre Seguimiento si se llegó desde un indicador del Panel. */
  readonly pestanaInicial?: PestanaDeSeguimiento;
}

/**
 * Lo que un indicador del Panel le pide a la pantalla a la que lleva. Daniel, 2026-11-26: con un cliente
 * elegido en el Panel, «Vencimientos próximos» abría la lista de todos los clientes.
 */
export interface OpcionesDeNavegacion {
  readonly nivel?: FiltroDeNivel;
  readonly clienteId?: string;
  readonly colaboradorId?: string;
  readonly pestana?: PestanaDeSeguimiento;
}

const PANTALLAS: Record<Pantalla, (props: PropsDePantalla) => JSX.Element> = {
  seguimiento: Seguimiento,
  clientes: Clientes,
  documentos: Documentos,
  vencimientos: Vencimientos,
  faltantes: Faltantes,
  balances: Balances,
  siga: Siga,
  liquidaciones: Liquidaciones,
  iva: LiquidacionIva,
  alertas: Alertas,
  equipo: Equipo,
  reglas: Reglas,
  eventos: Eventos,
  horas: Horas,
  panel: Panel,
};

function AppShell() {
  const [pantallaActiva, setPantallaActiva] = useState<Pantalla>('panel');
  const [opcionesDeLlegada, setOpcionesDeLlegada] = useState<OpcionesDeNavegacion>({});
  const PantallaActual = PANTALLAS[pantallaActiva];
  const { nivel: nivelInicial, clienteId: clienteInicial, colaboradorId: colaboradorInicial, pestana: pestanaInicial } =
    opcionesDeLlegada;
  // Las pantallas leen sus opciones iniciales solo al montarse. Una llegada que pide pestaña cambia esta
  // clave y remonta la pantalla, así también cambia de pestaña si ya estaba abierta.
  const [llegadasConPestana, setLlegadasConPestana] = useState(0);

  // Un filtro pedido por un indicador vale solo para esa llegada: entrar
  // después por el menú tiene que abrir la pantalla completa.
  const irA = (pantalla: Pantalla, opciones?: OpcionesDeNavegacion) => {
    setOpcionesDeLlegada(opciones ?? {});
    if (opciones?.pestana) setLlegadasConPestana((n) => n + 1);
    setPantallaActiva(pantalla);
  };

  return (
    // Fila desde `lg` (barra lateral fija + contenido), columna abajo de eso
    // (barra arriba, contenido debajo) — mismo cambio de dirección que ya
    // hace `Encabezado` con su propio contenido.
    <div className="flex min-h-dvh flex-col bg-lienzo font-interfaz text-tinta lg:h-dvh lg:flex-row lg:overflow-hidden">
      <Encabezado activa={pantallaActiva} onCambiar={(pantalla) => irA(pantalla)} />
      {/* Un único scroll, el de esta columna — no el de toda la página — para
          que la barra lateral quede fija en vez de irse con el contenido. */}
      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        <PantallaActual
          key={`${pantallaActiva}:${llegadasConPestana}`}
          irA={irA}
          {...(nivelInicial ? { nivelInicial } : {})}
          {...(clienteInicial ? { clienteInicial } : {})}
          {...(colaboradorInicial ? { colaboradorInicial } : {})}
          {...(pestanaInicial ? { pestanaInicial } : {})}
        />
      </div>
    </div>
  );
}

function Enrutador() {
  const { sesion } = useSesion();

  if (sesion === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lienzo">
        <p className="text-sm text-tinta-tenue">Cargando…</p>
      </div>
    );
  }

  if (sesion === null) {
    return <Acceso />;
  }

  // Con la contraseña por cambiar el servidor rechaza todo lo demás, así que
  // mostrar el panel sería mostrar una pantalla incapaz de cargar nada.
  if (sesion.debeCambiarContrasena) {
    return <CambioDeContrasena />;
  }

  return <AppShell />;
}

export function Aplicacion() {
  return (
    // La primera pantalla siempre es el Panel: sus datos se piden mientras se
    // comprueba la sesión, no después.
    <ProveedorDeSesion precarga={precargarPanel}>
      <Enrutador />
    </ProveedorDeSesion>
  );
}
