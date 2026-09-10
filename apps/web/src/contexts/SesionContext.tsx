/**
 * Estado global de sesión (tarea 102).
 *
 * El acceso en dos pasos deja un hueco a propósito: entre el paso 1
 * (contraseña) y el paso 2 (2FA), el servidor ya tiene una sesión creada pero
 * `segundoFactorSuperado: false` — y en ese estado `evaluarSesion()` no
 * devuelve `VIGENTE`, así que `GET /api/v1/yo` sigue dando 401. Por eso acá
 * no se marca `sesion` como establecida hasta después de un
 * `confirmarSegundoFactor()` exitoso (o de entrada, si el rol no necesita
 * segundo factor).
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  cerrarSesion as cerrarSesionApi,
  confirmarAltaDeSegundoFactor as confirmarAltaDeSegundoFactorApi,
  confirmarSegundoFactor as confirmarSegundoFactorApi,
  iniciarAcceso as iniciarAccesoApi,
  obtenerSesionActual,
  type RespuestaAcceso,
  type SesionActual,
} from '../api/autenticacion.js';

interface ContextoSesion {
  /** `undefined` mientras se resuelve la sesión inicial; `null` si no hay sesión. */
  readonly sesion: SesionActual | null | undefined;
  iniciarAcceso(email: string, contrasena: string): Promise<RespuestaAcceso>;
  /** Confirma el segundo factor y, si es válido, deja `sesion` establecida. */
  confirmarSegundoFactor(codigo: string): Promise<void>;
  /**
   * Confirma el alta del segundo factor (la primera vez, con el código recién
   * cargado en la aplicación de autenticación). La misma sesión con la que se
   * dio de alta queda habilitada, así que no hay que volver a ingresar.
   */
  confirmarAltaDeSegundoFactor(codigo: string): Promise<void>;
  cerrarSesion(): Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionActual | null | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    obtenerSesionActual()
      // Un fallo de red acá (el servidor no responde, sin conexión) no es
      // "hay sesión" ni debería dejar la pantalla cargando para siempre: se
      // trata como si no hubiera sesión, y el intento real (con su propio
      // mensaje de error) queda para cuando la persona intente ingresar.
      .catch(() => null)
      .then((resultado) => {
        if (vigente) setSesion(resultado);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const iniciarAcceso = useCallback(async (email: string, contrasena: string) => {
    const respuesta = await iniciarAccesoApi(email, contrasena);
    if (!respuesta.segundoFactorRequerido) {
      setSesion(await obtenerSesionActual());
    }
    return respuesta;
  }, []);

  const confirmarSegundoFactor = useCallback(async (codigo: string) => {
    await confirmarSegundoFactorApi(codigo);
    setSesion(await obtenerSesionActual());
  }, []);

  const confirmarAltaDeSegundoFactor = useCallback(async (codigo: string) => {
    await confirmarAltaDeSegundoFactorApi(codigo);
    setSesion(await obtenerSesionActual());
  }, []);

  const cerrarSesion = useCallback(async () => {
    await cerrarSesionApi();
    setSesion(null);
  }, []);

  return (
    <Contexto.Provider
      value={{
        sesion,
        iniciarAcceso,
        confirmarSegundoFactor,
        confirmarAltaDeSegundoFactor,
        cerrarSesion,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useSesion() se llamó fuera de <ProveedorDeSesion>.');
  }
  return contexto;
}
