/**
 * Pestaña «Pendientes»: todo lo abierto en una sola lista — los pedidos del
 * equipo y las solicitudes de documentación a clientes (diseño §5.1).
 *
 * El orden y los contadores vienen del servidor (`ordenarPendientes` y
 * `resumirPendientes` de `@effort/core`): la pantalla no reordena ni cuenta por
 * su cuenta, así lista y contadores no se contradicen. «Vencido» sale de
 * `recordatorioVencido`, la misma función que usa el servidor.
 */

import { useEffect, useMemo, useState } from 'react';

import { recordatorioVencido } from '@effort/core';

import { Badge, CampoSelect, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../../ui/Primitivos.jsx';
import {
  listarPendientes,
  type EstadoDePedido,
  type ItemDeBandeja,
  type ResumenDePendientes,
} from '../../api/seguimiento.js';
import { useSesion } from '../../contexts/SesionContext.js';
import { TODOS_LOS_CLIENTES } from '../../ui/FiltroDeCliente.js';
import {
  FiltroDeColaboradorSelector,
  coincideConColaborador,
  sufijoDeColaborador,
  useFiltroDeColaborador,
  type FiltroDeColaborador,
} from '../../ui/FiltroDeColaborador.js';
import { AccionesDePedido, AccionesDeSolicitud } from './AccionesRapidas.js';
import {
  ETIQUETA_PRIORIDAD,
  OPCIONES_PRIORIDAD,
  ROLES_QUE_ABREN,
  antiguedad,
  destinatariosPosibles,
  etiquetaDeEstado,
  formatearDia,
  mensajeDeError,
} from './comun.js';

const OPCIONES_TIPO = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'EQUIPO', etiqueta: 'Equipo' },
  { valor: 'CLIENTE', etiqueta: 'Cliente' },
];

const OPCIONES_FILTRO_PRIORIDAD = [{ valor: '', etiqueta: 'Todas' }, ...OPCIONES_PRIORIDAD];

/**
 * Filtro por colaborador (§5.3 bis): un pedido del equipo, por quién lo pidió;
 * una solicitud a un cliente, por la cartera de esa persona, como en «Clientes».
 */
function coincideConElColaborador(item: ItemDeBandeja, filtro: FiltroDeColaborador): boolean {
  if (filtro.cartera === null) return true;
  return item.tipo === 'EQUIPO'
    ? item.solicitanteUsuarioId === filtro.colaboradorId
    : coincideConColaborador(item.clienteId, filtro);
}

/** Pendientes no tiene filtro de cliente: el del colaborador nunca tiene que corregirlo. */
const sinCambioDeCliente = () => undefined;

function resumenEnTexto(resumen: ResumenDePendientes): string {
  const abiertos = `${resumen.total} ${resumen.total === 1 ? 'abierto' : 'abiertos'}`;
  const criticos = `${resumen.criticos} ${resumen.criticos === 1 ? 'crítico' : 'críticos'}`;
  return `${abiertos} · ${criticos} · ${resumen.vencidos} con recordatorio vencido`;
}

export default function Pendientes({
  alAbrirPedido,
}: {
  /** Lleva a la pestaña «Equipo» con ese pedido abierto. */
  readonly alAbrirPedido?: (pedidoId: string) => void;
} = {}) {
  const { sesion } = useSesion();
  const puedeEscribir = ROLES_QUE_ABREN.has(sesion?.rol ?? '');
  // Solo dirección ve el selector (lo decide el propio filtro); su lista del equipo sirve también para «Derivar».
  const colaborador = useFiltroDeColaborador(TODOS_LOS_CLIENTES, sinCambioDeCliente);
  const destinatarios = useMemo(() => destinatariosPosibles(colaborador.colaboradores), [colaborador.colaboradores]);

  const [datos, setDatos] = useState<{ items: readonly ItemDeBandeja[]; resumen: ResumenDePendientes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [tipo, setTipo] = useState('');
  const [prioridad, setPrioridad] = useState('');

  useEffect(() => {
    let vigente = true;
    listarPendientes()
      .then((respuesta) => {
        if (!vigente) return;
        setDatos(respuesta);
        setError(null);
      })
      .catch((motivo: unknown) => {
        if (vigente) setError(mensajeDeError(motivo));
      });
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const recargar = () => setRecarga((n) => n + 1);

  if (error && !datos) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-critico">{error}</p>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-tinta-tenue">Cargando…</p>
      </div>
    );
  }

  const ahora = new Date();
  // Filtrar no reordena: lo que queda sigue en el orden del servidor.
  const visibles = datos.items.filter(
    (item) =>
      (tipo === '' || item.tipo === tipo) &&
      (prioridad === '' || item.prioridad === prioridad) &&
      coincideConElColaborador(item, colaborador),
  );
  const filtrado = visibles.length !== datos.items.length;
  const columnas = puedeEscribir ? 8 : 7;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Pendientes de seguimiento</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Los pedidos del equipo y los pedidos de documentación a clientes que siguen abiertos, de lo más
          urgente a lo menos. «Recordar el» es solo una marca en esta pantalla: no manda ningún aviso.
        </p>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta
          titulo="Todo lo abierto"
          descripcion={`${resumenEnTexto(datos.resumen)}${filtrado ? ` · con estos filtros se ven ${visibles.length}` : ''}${sufijoDeColaborador(colaborador)}`}
          acciones={
            <div className="flex flex-wrap items-end gap-3">
              <FiltroDeColaboradorSelector id="filtroColaboradorPendientes" filtro={colaborador} />
              <CampoSelect
                id="filtroTipoPendientes"
                etiqueta="Tipo"
                opciones={OPCIONES_TIPO}
                value={tipo}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipo(e.target.value)}
              />
              <CampoSelect
                id="filtroPrioridadPendientes"
                etiqueta="Prioridad"
                opciones={OPCIONES_FILTRO_PRIORIDAD}
                value={prioridad}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrioridad(e.target.value)}
              />
            </div>
          }
        />
        {error && <p className="border-b border-borde px-5 py-2 text-sm text-critico">{error}</p>}
        <Tabla etiqueta="Pendientes de seguimiento">
          <thead>
            <tr>
              <Th>Tipo</Th>
              <Th>Prioridad</Th>
              <Th>De quién</Th>
              <Th>Asunto</Th>
              <Th>Recordar el</Th>
              <Th>Estado</Th>
              <Th>Antigüedad</Th>
              {puedeEscribir && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((item) => {
              const vencido = recordatorioVencido(item.recordarEl, ahora);
              const prioridadDelItem = ETIQUETA_PRIORIDAD[item.prioridad];
              const estado = etiquetaDeEstado(item.tipo, item.estado);
              return (
                <tr key={`${item.tipo}-${item.id}`} className={vencido ? 'bg-critico-fondo' : ''}>
                  <Td className="text-tinta-suave">{item.tipo === 'EQUIPO' ? 'Equipo' : 'Cliente'}</Td>
                  <Td>
                    <Badge tono={prioridadDelItem.tono} conIcono={false}>{prioridadDelItem.texto}</Badge>
                  </Td>
                  <Td>{item.deQuien}</Td>
                  <Td className="font-medium">
                    {item.tipo === 'EQUIPO' && alAbrirPedido ? (
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => alAbrirPedido(item.id)}
                      >
                        {item.titulo}
                      </button>
                    ) : (
                      item.titulo
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-tinta-suave">
                    {item.recordarEl ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{formatearDia(item.recordarEl)}</span>
                        {vencido && <Badge tono="critico">Vencido</Badge>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td><Badge tono={estado.tono}>{estado.texto}</Badge></Td>
                  <Td className="whitespace-nowrap text-tinta-suave">{antiguedad(item.creadoEn, ahora)}</Td>
                  {puedeEscribir && (
                    <Td>
                      {item.tipo === 'EQUIPO' ? (
                        <AccionesDePedido
                          id={item.id}
                          estado={item.estado as EstadoDePedido}
                          derivadoASoporte={item.derivadoASoporte}
                          destinatarios={destinatarios}
                          alCambiar={recargar}
                        />
                      ) : (
                        <AccionesDeSolicitud id={item.id} prioridad={item.prioridad} alCambiar={recargar} />
                      )}
                    </Td>
                  )}
                </tr>
              );
            })}
            {datos.items.length === 0 && (
              <tr>
                <td colSpan={columnas} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  No hay pendientes abiertos.
                </td>
              </tr>
            )}
            {datos.items.length > 0 && visibles.length === 0 && (
              <tr>
                <td colSpan={columnas} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  Ningún pendiente con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>
    </div>
  );
}
