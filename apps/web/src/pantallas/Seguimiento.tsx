/**
 * Seguimiento, «el centro de todo» (Daniel, 2026-11-27): tres pestañas.
 *
 *  - «Pendientes»: todo lo abierto, pedidos del equipo y de clientes juntos.
 *  - «Clientes»: la pantalla de seguimiento al cliente de siempre, sin cambios
 *    de comportamiento (`seguimiento/Clientes.tsx`).
 *  - «Equipo»: los pedidos de los colaboradores y su conversación.
 *
 * Separadas por dentro a propósito: lo interno del equipo nunca llega a la
 * constancia de gestión que se le muestra a un cliente (diseño §4 y §5.6).
 * Solo se monta la pestaña a la vista: al volver a una, trae lo de ahora.
 */

import { useRef, useState, type KeyboardEvent } from 'react';

import SeguimientoDeClientes from './seguimiento/Clientes.js';
import Equipo from './seguimiento/Equipo.js';
import Pendientes from './seguimiento/Pendientes.js';

export type PestanaDeSeguimiento = 'pendientes' | 'clientes' | 'equipo';

const PESTANAS: readonly { readonly id: PestanaDeSeguimiento; readonly texto: string }[] = [
  { id: 'pendientes', texto: 'Pendientes' },
  { id: 'clientes', texto: 'Clientes' },
  { id: 'equipo', texto: 'Equipo' },
];

export default function Seguimiento({
  clienteInicial,
  colaboradorInicial,
  pestanaInicial = 'pendientes',
}: {
  readonly clienteInicial?: string;
  readonly colaboradorInicial?: string;
  readonly pestanaInicial?: PestanaDeSeguimiento;
} = {}) {
  const [pestana, setPestana] = useState<PestanaDeSeguimiento>(pestanaInicial);
  const [pedidoAAbrir, setPedidoAAbrir] = useState<string | undefined>(undefined);
  const botones = useRef<Partial<Record<PestanaDeSeguimiento, HTMLButtonElement | null>>>({});

  function elegir(nueva: PestanaDeSeguimiento) {
    setPedidoAAbrir(undefined);
    setPestana(nueva);
  }

  // Flechas, Inicio y Fin mueven entre pestañas, como pide el patrón de pestañas accesibles.
  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const actual = PESTANAS.findIndex((p) => p.id === pestana);
    const destino =
      evento.key === 'ArrowRight' ? (actual + 1) % PESTANAS.length
      : evento.key === 'ArrowLeft' ? (actual - 1 + PESTANAS.length) % PESTANAS.length
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? PESTANAS.length - 1
      : null;
    if (destino === null) return;
    evento.preventDefault();
    const siguiente = PESTANAS[destino]!.id;
    elegir(siguiente);
    botones.current[siguiente]?.focus();
  }

  const clientesProps = {
    ...(clienteInicial !== undefined ? { clienteInicial } : {}),
    ...(colaboradorInicial !== undefined ? { colaboradorInicial } : {}),
  };

  return (
    <main className="mx-auto max-w-[86rem] space-y-5 px-5 py-6">
      <div
        role="tablist"
        aria-label="Seguimiento"
        className="flex gap-1 border-b border-borde"
        onKeyDown={alTeclear}
      >
        {PESTANAS.map((p) => {
          const activa = p.id === pestana;
          return (
            <button
              key={p.id}
              ref={(nodo) => {
                botones.current[p.id] = nodo;
              }}
              type="button"
              role="tab"
              id={`pestana-seguimiento-${p.id}`}
              aria-selected={activa}
              aria-controls={`panel-seguimiento-${p.id}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => elegir(p.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none ${
                activa
                  ? 'border-marca-600 text-tinta'
                  : 'border-transparent text-tinta-tenue hover:text-tinta'
              }`}
            >
              {p.texto}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-seguimiento-${pestana}`}
        aria-labelledby={`pestana-seguimiento-${pestana}`}
      >
        {pestana === 'pendientes' && (
          <Pendientes
            alAbrirPedido={(id) => {
              setPestana('equipo');
              setPedidoAAbrir(id);
            }}
          />
        )}
        {pestana === 'clientes' && <SeguimientoDeClientes {...clientesProps} />}
        {pestana === 'equipo' && <Equipo {...(pedidoAAbrir ? { pedidoInicial: pedidoAAbrir } : {})} />}
      </div>
    </main>
  );
}
