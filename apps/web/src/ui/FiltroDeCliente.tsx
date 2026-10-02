/**
 * Filtro «Cliente» que comparten Vencimientos, Alertas y Liquidaciones.
 *
 * Pedido de EFFORT vía Daniel (2026-10-01): poder ver lo de un solo cliente.
 * Filtra lo que ya se trajo del servidor —que ya viene recortado por la cartera
 * de quien mira—, así que no abre ningún acceso nuevo.
 *
 * «Todos los clientes» es una opción más y no el `placeholder` de `CampoSelect`:
 * el placeholder queda deshabilitado, y una vez elegido un cliente no habría
 * forma de volver a ver todos.
 */

import { CampoSelect } from './Primitivos.jsx';

/** `''` = todos los clientes. */
export type FiltroDeCliente = string;

export const TODOS_LOS_CLIENTES: FiltroDeCliente = '';

export function coincideConCliente(clienteId: string | null | undefined, filtro: FiltroDeCliente): boolean {
  return filtro === TODOS_LOS_CLIENTES || clienteId === filtro;
}

export function FiltroDeClienteSelector({
  id,
  clientes,
  valor,
  onCambiar,
}: {
  readonly id: string;
  readonly clientes: readonly { readonly id: string; readonly nombre: string; readonly activo: boolean }[];
  readonly valor: FiltroDeCliente;
  readonly onCambiar: (valor: FiltroDeCliente) => void;
}) {
  return (
    <CampoSelect
      id={id}
      etiqueta="Cliente"
      value={valor}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCambiar(e.target.value)}
      opciones={[
        { valor: TODOS_LOS_CLIENTES, etiqueta: 'Todos los clientes' },
        ...clientes.filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: c.nombre })),
      ]}
      className="w-64"
    />
  );
}
