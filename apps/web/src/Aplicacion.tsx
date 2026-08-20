/**
 * Barrera de sesión (tarea 102): sin sesión no hay pantalla real que ver.
 *
 * `sesion === undefined` mientras `<ProveedorDeSesion>` todavía está
 * confirmando si ya hay una sesión activa (la primera carga de la página);
 * `null` significa que ya se confirmó que no hay ninguna.
 */

import { ProveedorDeSesion, useSesion } from './contexts/SesionContext.js';
import { Acceso } from './pantallas/Acceso.js';
// La demo anterior sigue en src/App.jsx con sus datos inventados, sin tocar,
// hasta que cada una de sus pantallas tenga reemplazo contra la API real
// (tarea 104). Seguimiento.jsx es la primera pantalla ya real (tarea 101).
import Seguimiento from './pantallas/Seguimiento.jsx';

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

  return <Seguimiento />;
}

export function Aplicacion() {
  return (
    <ProveedorDeSesion>
      <Enrutador />
    </ProveedorDeSesion>
  );
}
