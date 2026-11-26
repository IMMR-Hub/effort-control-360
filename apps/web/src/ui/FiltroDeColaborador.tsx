/**
 * Filtro «Colaborador»: ver de una vez todos los clientes de una persona del equipo.
 *
 * Pedido de EFFORT vía Daniel (2026-11-26): además de filtrar por cliente y por fecha, que Laura, Lili y
 * Daniel puedan elegir a una persona y ver todos sus clientes. **Solo lo ve dirección**: el resto del equipo
 * ya ve únicamente su propia cartera, y la lista del equipo (`GET /usuarios`) es solo de dirección.
 *
 * Como el filtro de cliente, recorta lo que ya se trajo del servidor: no abre ningún acceso nuevo. La cartera
 * sale de `GET /usuarios/:id/clientes`, las asignaciones vigentes, la misma fuente que «Equipo → Editar».
 *
 * Al elegir a alguien, si el cliente elegido no es de esa persona, el filtro de cliente vuelve a «Todos»: si
 * no, la pantalla quedaría vacía sin que se entienda por qué.
 */

import { useEffect, useMemo, useState } from 'react';

import { listarUsuarios, obtenerCarteraDeUsuario, type Usuario } from '../api/usuarios.js';
import { useSesion } from '../contexts/SesionContext.js';
import { TODOS_LOS_CLIENTES, type FiltroDeCliente } from './FiltroDeCliente.js';
import { CampoSelect } from './Primitivos.jsx';

/** `''` = todo el equipo (sin filtro). */
export const TODO_EL_EQUIPO = '';

export interface FiltroDeColaborador {
  /** Solo dirección ve el selector; para el resto el filtro no existe y deja pasar todo. */
  readonly visible: boolean;
  readonly colaboradores: readonly Usuario[];
  readonly colaboradorId: string;
  readonly cambiar: (colaboradorId: string) => void;
  /**
   * Los clientes de la persona elegida, o `null` si no hay nadie elegido. Mientras su cartera se está
   * trayendo es un conjunto vacío: mejor una tabla vacía un instante que los clientes de otra persona.
   */
  readonly cartera: ReadonlySet<string> | null;
  readonly cargando: boolean;
  readonly error: string | null;
}

const CARTERA_VACIA: ReadonlySet<string> = new Set();

export function useFiltroDeColaborador(
  filtroDeCliente: FiltroDeCliente,
  cambiarFiltroDeCliente: (valor: FiltroDeCliente) => void,
  /** El que venía elegido en el Panel, si se llegó desde uno de sus indicadores. */
  colaboradorInicial: string = TODO_EL_EQUIPO,
): FiltroDeColaborador {
  const { sesion } = useSesion();
  const visible = sesion?.rol === 'direccion';

  const [colaboradores, setColaboradores] = useState<readonly Usuario[]>([]);
  const [colaboradorId, setColaboradorId] = useState(colaboradorInicial);
  const [carteraCargada, setCarteraCargada] = useState<{ id: string; clientes: ReadonlySet<string> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let vigente = true;
    listarUsuarios()
      .then(({ usuarios }) => {
        if (!vigente) return;
        setColaboradores(
          usuarios
            .filter((u) => u.activo)
            .slice()
            .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es')),
        );
      })
      // Sin la lista del equipo el selector no se muestra; la pantalla sigue funcionando igual.
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [visible]);

  useEffect(() => {
    if (colaboradorId === TODO_EL_EQUIPO) return;
    let vigente = true;
    setError(null);
    obtenerCarteraDeUsuario(colaboradorId)
      .then(({ clienteIds }) => {
        if (vigente) setCarteraCargada({ id: colaboradorId, clientes: new Set(clienteIds) });
      })
      .catch(() => {
        if (vigente) setError('No se pudo traer la cartera de esta persona.');
      });
    return () => {
      vigente = false;
    };
  }, [colaboradorId]);

  const cartera = useMemo<ReadonlySet<string> | null>(() => {
    if (!visible || colaboradorId === TODO_EL_EQUIPO) return null;
    return carteraCargada?.id === colaboradorId ? carteraCargada.clientes : CARTERA_VACIA;
  }, [visible, colaboradorId, carteraCargada]);

  const cargando = cartera !== null && carteraCargada?.id !== colaboradorId && error === null;

  useEffect(() => {
    if (cartera === null || cargando) return;
    if (filtroDeCliente !== TODOS_LOS_CLIENTES && !cartera.has(filtroDeCliente)) {
      cambiarFiltroDeCliente(TODOS_LOS_CLIENTES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartera, cargando]);

  return { visible, colaboradores, colaboradorId, cambiar: setColaboradorId, cartera, cargando, error };
}

/** `true` si el cliente es de la persona elegida, o si no hay nadie elegido. */
export function coincideConColaborador(clienteId: string | null | undefined, filtro: FiltroDeColaborador): boolean {
  if (filtro.cartera === null) return true;
  return clienteId != null && filtro.cartera.has(clienteId);
}

function nombreDelColaborador(filtro: FiltroDeColaborador): string | null {
  if (filtro.cartera === null) return null;
  const u = filtro.colaboradores.find((c) => c.id === filtro.colaboradorId);
  return u ? `${u.nombre} ${u.apellido}` : null;
}

/** `[«Colaborador: Ariana Campos»]` para la línea de filtros de un reporte, o `[]` si no hay nadie elegido. */
export function filtroDeColaboradorEnPalabras(filtro: FiltroDeColaborador): string[] {
  const nombre = nombreDelColaborador(filtro);
  return nombre ? [`Colaborador: ${nombre}`] : [];
}

/** « · colaborador: Ariana Campos» para las descripciones de las tablas, o `''`. */
export function sufijoDeColaborador(filtro: FiltroDeColaborador): string {
  const nombre = nombreDelColaborador(filtro);
  return nombre ? ` · colaborador: ${nombre}` : '';
}

export function FiltroDeColaboradorSelector({
  id,
  filtro,
  etiqueta = 'Colaborador',
}: {
  readonly id: string;
  readonly filtro: FiltroDeColaborador;
  readonly etiqueta?: string;
}) {
  if (!filtro.visible || filtro.colaboradores.length === 0) return null;
  return (
    <CampoSelect
      id={id}
      etiqueta={etiqueta}
      value={filtro.colaboradorId}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => filtro.cambiar(e.target.value)}
      opciones={[
        { valor: TODO_EL_EQUIPO, etiqueta: 'Todo el equipo' },
        ...filtro.colaboradores.map((u) => ({ valor: u.id, etiqueta: `${u.nombre} ${u.apellido}` })),
      ]}
      error={filtro.error}
      className="w-56"
    />
  );
}
