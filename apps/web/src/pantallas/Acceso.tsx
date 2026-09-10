/**
 * Pantalla de acceso, en dos pasos (tarea 102).
 *
 * Paso 1: correo + contraseña. Paso 2: código del segundo factor, solo si el
 * servidor lo pide (`segundoFactorRequerido`) — hay roles que no lo necesitan
 * (ver `requiereSegundoFactor` en `apps/api/src/seguridad/rbac.ts`). El
 * servidor ya redacta mensajes de error listos para mostrar (nunca revela si
 * un correo existe, ver `CREDENCIALES_INVALIDAS` en la ruta de acceso), así
 * que acá no se reinterpretan — se muestran tal cual llegan.
 */

import { useId, useState, type FormEvent } from 'react';

import { Boton, CampoTexto, Logotipo, Tarjeta } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { iniciarAltaDeSegundoFactor, type AltaDeSegundoFactor } from '../api/autenticacion.js';
import { useSesion } from '../contexts/SesionContext.js';

type Paso = 'contrasena' | 'segundoFactor' | 'altaSegundoFactor';

export function Acceso() {
  const { iniciarAcceso, confirmarSegundoFactor, confirmarAltaDeSegundoFactor } = useSesion();

  const [paso, setPaso] = useState<Paso>('contrasena');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [alta, setAlta] = useState<AltaDeSegundoFactor | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idEmail = useId();
  const idContrasena = useId();
  const idCodigo = useId();

  async function manejarPaso1(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const respuesta = await iniciarAcceso(email, contrasena);

      // El rol exige segundo factor y esta persona todavía no lo dio de alta.
      // La sesión que acaba de recibir no habilita nada más que esto.
      if (respuesta.segundoFactorPorConfigurar) {
        setAlta(await iniciarAltaDeSegundoFactor());
        setPaso('altaSegundoFactor');
        return;
      }

      if (respuesta.segundoFactorRequerido) {
        setPaso('segundoFactor');
      }
    } catch (excepcion) {
      setError(mensajeDeError(excepcion));
    } finally {
      setEnviando(false);
    }
  }

  async function manejarAltaDeSegundoFactor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await confirmarAltaDeSegundoFactor(codigo);
      // La sesión queda habilitada: el guardia de sesión deja de mostrar esto.
    } catch (excepcion) {
      setError(mensajeDeError(excepcion));
    } finally {
      setEnviando(false);
    }
  }

  async function manejarPaso2(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await confirmarSegundoFactor(codigo);
      // Si tuvo éxito, <SesionContext> ya actualizó `sesion` y quien envuelve
      // esta pantalla (el guardia de sesión) va a dejar de mostrarla.
    } catch (excepcion) {
      if (excepcion instanceof ErrorDeApi && excepcion.codigo === 'sin_sesion') {
        // La sesión intermedia del paso 1 venció o se perdió: no tiene
        // sentido seguir pidiendo un código para algo que ya no existe.
        setPaso('contrasena');
        setContrasena('');
        setCodigo('');
        setError('La sesión de acceso venció. Ingresá tu contraseña de nuevo.');
      } else {
        setError(mensajeDeError(excepcion));
      }
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
          {paso === 'contrasena' && (
            <form onSubmit={manejarPaso1} noValidate>
              <h1 className="mb-4 text-sm font-semibold text-tinta">Ingresar</h1>

              <div className="flex flex-col gap-4">
                <CampoTexto
                  etiqueta="Correo electrónico"
                  id={idEmail}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                />
                <CampoTexto
                  etiqueta="Contraseña"
                  id={idContrasena}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={contrasena}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContrasena(e.target.value)}
                />
              </div>

              <MensajeDeError mensaje={error} />

              <Boton
                type="submit"
                variante="primario"
                className="mt-5 w-full"
                disabled={enviando}
              >
                {enviando ? 'Ingresando…' : 'Ingresar'}
              </Boton>
            </form>
          )}

          {paso === 'altaSegundoFactor' && alta && (
            <form onSubmit={manejarAltaDeSegundoFactor} noValidate>
              <h1 className="mb-1 text-sm font-semibold text-tinta">
                Configurá tu verificación en dos pasos
              </h1>
              <p className="mb-4 text-xs text-tinta-tenue">
                Tu rol la exige. Cargá esta clave en tu aplicación de autenticación
                (Google Authenticator, Authy o similar) y confirmá con el código que te muestre.
              </p>

              <div className="mb-4 rounded border border-borde bg-lienzo p-3">
                <p className="mb-1 text-xs font-medium text-tinta-tenue">Tu clave</p>
                <code className="block break-all font-mono text-sm text-tinta">{alta.secreto}</code>
                <p className="mt-2 text-xs text-tinta-tenue">
                  Tipo de clave: <strong>basada en tiempo</strong>. Anotala en un lugar seguro:
                  no se vuelve a mostrar.
                </p>
              </div>

              <CampoTexto
                etiqueta="Código de tu aplicación"
                id={idCodigo}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                value={codigo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCodigo(e.target.value)}
              />

              <MensajeDeError mensaje={error} />

              <Boton type="submit" variante="primario" className="mt-5 w-full" disabled={enviando}>
                {enviando ? 'Confirmando…' : 'Confirmar y entrar'}
              </Boton>
            </form>
          )}

          {paso === 'segundoFactor' && (
            <form onSubmit={manejarPaso2} noValidate>
              <h1 className="mb-1 text-sm font-semibold text-tinta">Verificación en dos pasos</h1>
              <p className="mb-4 text-xs text-tinta-tenue">
                Ingresá el código de tu aplicación de autenticación.
              </p>

              <CampoTexto
                etiqueta="Código de verificación"
                id={idCodigo}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                value={codigo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCodigo(e.target.value)}
              />

              <MensajeDeError mensaje={error} />

              <Boton
                type="submit"
                variante="primario"
                className="mt-5 w-full"
                disabled={enviando}
              >
                {enviando ? 'Verificando…' : 'Verificar'}
              </Boton>

              <button
                type="button"
                className="mt-3 w-full text-center text-xs text-tinta-tenue underline-offset-2 hover:underline"
                onClick={() => {
                  setPaso('contrasena');
                  setCodigo('');
                  setError(null);
                }}
              >
                Volver
              </button>
            </form>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

function MensajeDeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="mt-3 text-sm text-critico">
      {mensaje}
    </p>
  );
}

/**
 * El servidor ya redacta mensajes listos para mostrar (`ErrorDeApi.message`).
 * Solo se cubre acá el caso de un error de red o de algo verdaderamente
 * inesperado, que no trae un mensaje pensado para una persona.
 */
function mensajeDeError(excepcion: unknown): string {
  if (excepcion instanceof ErrorDeApi) return excepcion.message;
  return 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
}
