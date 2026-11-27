/**
 * La lista del equipo, para «De», «Para», «Autor» y «Derivar». `GET /usuarios`
 * es solo de dirección: con `habilitado` en falso ni se pide.
 */

import { useEffect, useState } from 'react';

import { listarUsuarios, type Usuario } from '../../api/usuarios.js';
import { mensajeDeError } from './comun.js';

export function useUsuarios(habilitado: boolean): {
  readonly usuarios: readonly Usuario[];
  readonly error: string | null;
} {
  const [usuarios, setUsuarios] = useState<readonly Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!habilitado) return;
    let vigente = true;
    listarUsuarios()
      .then((respuesta) => {
        if (vigente) setUsuarios(respuesta.usuarios);
      })
      .catch((motivo: unknown) => {
        if (vigente) setError(mensajeDeError(motivo, 'No se pudo traer la lista del equipo.'));
      });
    return () => {
      vigente = false;
    };
  }, [habilitado]);

  return { usuarios, error };
}
