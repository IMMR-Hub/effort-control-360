/**
 * Barrera de sesión (tarea 102): sin sesión no hay pantalla real que ver.
 *
 * `sesion === undefined` mientras `<ProveedorDeSesion>` todavía está
 * confirmando si ya hay una sesión activa (la primera carga de la página);
 * `null` significa que ya se confirmó que no hay ninguna.
 */

import { useState } from 'react';

import { ProveedorDeSesion, useSesion } from './contexts/SesionContext.js';
import { Acceso } from './pantallas/Acceso.js';
import { Encabezado, type Pantalla } from './layout/Encabezado.js';
// La demo anterior sigue en src/App.jsx con sus datos inventados, sin tocar,
// hasta que cada una de sus pantallas tenga reemplazo contra la API real
// (tarea 104). Seguimiento.tsx y Clientes.tsx son las dos primeras ya reales.
import Seguimiento from './pantallas/Seguimiento.js';
import Clientes from './pantallas/Clientes.js';
import Documentos from './pantallas/Documentos.js';
import Vencimientos from './pantallas/Vencimientos.js';
import Balances from './pantallas/Balances.js';
import Siga from './pantallas/Siga.js';
import Liquidaciones from './pantallas/Liquidaciones.js';
import Alertas from './pantallas/Alertas.js';

const PANTALLAS: Record<Pantalla, () => JSX.Element> = {
  seguimiento: Seguimiento,
  clientes: Clientes,
  documentos: Documentos,
  vencimientos: Vencimientos,
  balances: Balances,
  siga: Siga,
  liquidaciones: Liquidaciones,
  alertas: Alertas,
};

function AppShell() {
  const [pantallaActiva, setPantallaActiva] = useState<Pantalla>('seguimiento');
  const PantallaActual = PANTALLAS[pantallaActiva];

  return (
    <div className="min-h-dvh bg-lienzo font-interfaz text-tinta">
      <Encabezado activa={pantallaActiva} onCambiar={setPantallaActiva} />
      <PantallaActual />
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

  return <AppShell />;
}

export function Aplicacion() {
  return (
    <ProveedorDeSesion>
      <Enrutador />
    </ProveedorDeSesion>
  );
}
