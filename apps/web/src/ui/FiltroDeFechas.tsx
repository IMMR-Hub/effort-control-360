/**
 * Selector de fechas que usan todas las pantallas.
 *
 * Daniel, 2026-09-15: buscar no solo por mes, también por fecha exacta y por
 * "últimos 15, 30, 60 o 90 días". Un solo componente para que todas las
 * pantallas se filtren igual; la lógica (qué rango cubre cada elección) vive
 * en `@effort/core`, con sus tests.
 */

import { useEffect, useMemo, useState } from 'react';

import {
  hoyEnParaguay,
  periodosDelRango,
  rangoDelFiltro,
  type DiasRecientes,
  type FiltroDeFechas,
} from '@effort/core';

import { CampoSelect, CampoTexto } from './Primitivos.jsx';

type Modo = 'todo' | 'mes' | 'dia' | 'rango' | 'ultimos-15' | 'ultimos-30' | 'ultimos-60' | 'ultimos-90';

function modoDe(filtro: FiltroDeFechas): Modo {
  return filtro.tipo === 'ultimos' ? (`ultimos-${filtro.dias}` as Modo) : filtro.tipo;
}

function hoyIso(): string {
  const hoy = hoyEnParaguay(new Date());
  return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}-${String(hoy.dia).padStart(2, '0')}`;
}

/** El mes en curso, en Paraguay. Es el filtro por defecto de las pantallas por período. */
export function filtroDelMesActual(): FiltroDeFechas {
  return { tipo: 'mes', periodo: hoyIso().slice(0, 7) };
}

interface Props {
  readonly id: string;
  readonly valor: FiltroDeFechas;
  readonly onCambiar: (filtro: FiltroDeFechas) => void;
  /** Si se ofrece "Todas las fechas". Las vistas de "qué falta" lo necesitan; las de un período, no. */
  readonly permitirTodo?: boolean;
}

export function FiltroDeFechasSelector({ id, valor, onCambiar, permitirTodo = false }: Props) {
  const modo = modoDe(valor);

  const opciones = [
    ...(permitirTodo ? [{ valor: 'todo', etiqueta: 'Todas las fechas' }] : []),
    { valor: 'mes', etiqueta: 'Por mes' },
    { valor: 'dia', etiqueta: 'Fecha exacta' },
    { valor: 'rango', etiqueta: 'Desde – hasta' },
    { valor: 'ultimos-15', etiqueta: 'Últimos 15 días' },
    { valor: 'ultimos-30', etiqueta: 'Últimos 30 días' },
    { valor: 'ultimos-60', etiqueta: 'Últimos 60 días' },
    { valor: 'ultimos-90', etiqueta: 'Últimos 90 días' },
  ];

  function cambiarModo(nuevo: Modo) {
    const hoy = hoyIso();
    if (nuevo === 'todo') onCambiar({ tipo: 'todo' });
    else if (nuevo === 'mes') onCambiar({ tipo: 'mes', periodo: hoy.slice(0, 7) });
    else if (nuevo === 'dia') onCambiar({ tipo: 'dia', fecha: hoy });
    else if (nuevo === 'rango') onCambiar({ tipo: 'rango', desde: `${hoy.slice(0, 7)}-01`, hasta: hoy });
    else onCambiar({ tipo: 'ultimos', dias: Number(nuevo.split('-')[1]) as DiasRecientes });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <CampoSelect
        id={`${id}-modo`}
        etiqueta="Mostrar"
        opciones={opciones}
        value={modo}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => cambiarModo(e.target.value as Modo)}
      />
      {valor.tipo === 'mes' && (
        <CampoTexto
          id={`${id}-mes`}
          etiqueta="Mes"
          type="month"
          value={valor.periodo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            e.target.value && onCambiar({ tipo: 'mes', periodo: e.target.value })
          }
        />
      )}
      {valor.tipo === 'dia' && (
        <CampoTexto
          id={`${id}-dia`}
          etiqueta="Fecha"
          type="date"
          value={valor.fecha}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            e.target.value && onCambiar({ tipo: 'dia', fecha: e.target.value })
          }
        />
      )}
      {valor.tipo === 'rango' && (
        <>
          <CampoTexto
            id={`${id}-desde`}
            etiqueta="Desde"
            type="date"
            value={valor.desde}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              e.target.value && onCambiar({ ...valor, desde: e.target.value })
            }
          />
          <CampoTexto
            id={`${id}-hasta`}
            etiqueta="Hasta"
            type="date"
            value={valor.hasta}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              e.target.value && onCambiar({ ...valor, hasta: e.target.value })
            }
          />
        </>
      )}
    </div>
  );
}

/**
 * Para las pantallas de trabajo sobre UN período fiscal (balances, conciliación
 * SIGA): el filtro puede ser un rango, pero un balance se edita y se aprueba
 * para un mes concreto. Devuelve los períodos que toca el rango y el elegido,
 * que por defecto es el más reciente.
 */
export function usePeriodoDelFiltro(filtro: FiltroDeFechas) {
  const periodos = useMemo(() => {
    if (filtro.tipo === 'mes') return [filtro.periodo];
    const rango = rangoDelFiltro(filtro, hoyEnParaguay(new Date()));
    return rango ? periodosDelRango(rango) : [hoyIso().slice(0, 7)];
  }, [filtro]);

  const [elegido, setElegido] = useState(periodos[periodos.length - 1]!);
  useEffect(() => {
    if (!periodos.includes(elegido)) setElegido(periodos[periodos.length - 1]!);
  }, [periodos, elegido]);

  return { periodos, periodo: periodos.includes(elegido) ? elegido : periodos[periodos.length - 1]!, elegirPeriodo: setElegido };
}

/** Botones con los períodos del rango. No se muestra si el rango toca uno solo. */
export function PeriodosDelRango({
  periodos,
  periodo,
  onElegir,
}: {
  readonly periodos: readonly string[];
  readonly periodo: string;
  readonly onElegir: (periodo: string) => void;
}) {
  if (periodos.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Períodos del rango">
      <span className="mr-1 text-xs text-tinta-tenue">Períodos del rango:</span>
      {periodos.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onElegir(p)}
          aria-pressed={p === periodo}
          className={`rounded px-2 py-1 text-xs font-medium ${
            p === periodo ? 'bg-marca-600 text-tinta-sobre-marca' : 'bg-superficie-tenue text-tinta-suave'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
