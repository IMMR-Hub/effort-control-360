/**
 * Cambio de contraseña obligatorio en el primer acceso.
 *
 * Se muestra en lugar de la aplicación, no dentro de ella: mientras
 * `debeCambiarContrasena` esté en `true`, el servidor rechaza cualquier otra
 * ruta (guarda global en `apps/api/src/servidor.ts`), así que mostrar el panel
 * sería mostrar una pantalla que no puede cargar nada.
 *
 * Por qué es obligatorio y no un recordatorio: la contraseña inicial la fija
 * quien da de alta la cuenta. Hasta que la persona la cambia, hay alguien más
 * que la conoce, y la bitácora no puede afirmar que una acción la hizo ella.
 */

import { useId, useState, type FormEvent } from 'react';

import { Boton, CampoTexto, Logotipo, Tarjeta } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { cambiarContrasena } from '../api/autenticacion.js';
import { useSesion } from '../contexts/SesionContext.js';

export function CambioDeContrasena() {
  const { cerrarSesion } = useSesion();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const idActual = useId();
  const idNueva = useId();
  const idRepetida = useId();

  async function manejar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    // Se comprueba acá y no en el servidor porque es un error de tipeo, no una
    // regla del sistema: el servidor no tiene por qué conocer este campo.
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      await cambiarContrasena(actual, nueva);
      // El servidor cerró todas las sesiones, incluida esta. No queda nada que
      // hacer con ella salvo volver a la pantalla de acceso.
      setListo(true);
    } catch (excepcion) {
      setError(
        excepcion instanceof ErrorDeApi
          ? excepcion.message
          : 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-lienzo px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logotipo />
        </div>

        <Tarjeta className="p-6">
          {listo ? (
            <div>
              <h1 className="mb-1 text-sm font-semibold text-tinta">Contraseña actualizada</h1>
              <p className="mb-5 text-xs text-tinta-tenue">
                Por seguridad se cerraron todas las sesiones abiertas. Ingresá de nuevo con tu
                contraseña nueva.
              </p>
              <Boton
                type="button"
                variante="primario"
                className="w-full"
                onClick={() => void cerrarSesion()}
              >
                Ir a ingresar
              </Boton>
            </div>
          ) : (
            <form onSubmit={manejar} noValidate>
              <h1 className="mb-1 text-sm font-semibold text-tinta">Cambiá tu contraseña</h1>
              <p className="mb-4 text-xs text-tinta-tenue">
                Estás usando la contraseña con la que se creó tu cuenta. Cambiala por una que
                solo vos conozcas: hasta entonces no vas a poder usar el sistema.
              </p>

              <div className="flex flex-col gap-4">
                <CampoTexto
                  etiqueta="Contraseña actual"
                  id={idActual}
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={actual}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActual(e.target.value)}
                />
                <CampoTexto
                  etiqueta="Contraseña nueva"
                  id={idNueva}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={nueva}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNueva(e.target.value)}
                />
                <CampoTexto
                  etiqueta="Repetí la contraseña nueva"
                  id={idRepetida}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={repetida}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepetida(e.target.value)}
                />
              </div>

              <p className="mt-3 text-xs text-tinta-tenue">
                Al menos 12 caracteres. Una frase larga es más segura y más fácil de recordar que
                ocho caracteres con símbolos.
              </p>

              {error && (
                <p role="alert" className="mt-3 text-sm text-critico">
                  {error}
                </p>
              )}

              <Boton type="submit" variante="primario" className="mt-5 w-full" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Cambiar contraseña'}
              </Boton>
            </form>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
