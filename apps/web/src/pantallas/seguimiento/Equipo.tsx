/**
 * Pestaña «Equipo»: los pedidos que los colaboradores les hacen a Laura y a
 * Lili, con su conversación (diseño §5.1).
 *
 * Dirección ve todos y escribe; cualquier otro rol ve solo los suyos (el
 * servidor recorta por la sesión) y en modo lectura: sin «Nuevo pedido», sin
 * acciones rápidas y sin «Soporte» (regla 12, `ROLES_QUE_ABREN`).
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { recordatorioVencido } from '@effort/core';

import { Badge, Boton, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../../ui/Primitivos.jsx';
import { listarClientes, type Cliente } from '../../api/clientes.js';
import { listarPedidosDelEquipo, listarSoporte, type PedidoDelEquipo } from '../../api/seguimiento.js';
import { useSesion } from '../../contexts/SesionContext.js';
import { AccionesDePedido } from './AccionesRapidas.js';
import { DetalleDePedido } from './DetalleDePedido.js';
import { FormularioDePedido } from './FormularioDePedido.js';
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_PRIORIDAD,
  ROLES_QUE_ABREN,
  destinatariosPosibles,
  formatearDia,
  mensajeDeError,
} from './comun.js';
import { useUsuarios } from './useUsuarios.js';

type Vista = 'abiertos' | 'cerrados' | 'soporte';

const VACIO: Record<Vista, string> = {
  abiertos: 'No hay pedidos abiertos',
  cerrados: 'No hay pedidos cerrados',
  soporte: 'No hay pedidos derivados a soporte',
};

function pedirLista(vista: Vista) {
  if (vista === 'soporte') return listarSoporte();
  return listarPedidosDelEquipo({
    estados: vista === 'abiertos' ? ['ABIERTO', 'EN_CURSO'] : ['RESUELTO', 'CANCELADO'],
  });
}

export default function Equipo({ pedidoInicial }: { readonly pedidoInicial?: string } = {}) {
  const { sesion } = useSesion();
  const puedeEscribir = ROLES_QUE_ABREN.has(sesion?.rol ?? '');
  const { usuarios, error: errorDeUsuarios } = useUsuarios(puedeEscribir);
  const destinatarios = useMemo(() => destinatariosPosibles(usuarios), [usuarios]);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);

  const [vista, setVista] = useState<Vista>('abiertos');
  const [pedidos, setPedidos] = useState<readonly PedidoDelEquipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [seleccionado, setSeleccionado] = useState<string | null>(pedidoInicial ?? null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    let vigente = true;
    pedirLista(vista)
      .then(({ pedidos: lista }) => {
        if (!vigente) return;
        setPedidos(lista);
        setError(null);
      })
      .catch((motivo: unknown) => {
        if (vigente) setError(mensajeDeError(motivo));
      });
    return () => {
      vigente = false;
    };
  }, [vista, recarga]);

  // Solo para elegir el cliente relacionado y nombrarlo en el detalle.
  useEffect(() => {
    if (!puedeEscribir) return;
    let vigente = true;
    listarClientes()
      .then(({ clientes: lista }) => {
        if (vigente) setClientes(lista);
      })
      .catch(() => {
        // Sin la lista se puede cargar igual un pedido sin cliente relacionado.
      });
    return () => {
      vigente = false;
    };
  }, [puedeEscribir]);

  const recargar = () => setRecarga((n) => n + 1);

  function cambiarVista(nueva: Vista) {
    setVista(nueva);
    setPedidos(null);
  }

  const ahora = new Date();
  const columnas = puedeEscribir ? 7 : 6;
  const vistas: readonly { valor: Vista; texto: string }[] = [
    { valor: 'abiertos', texto: 'Abiertos' },
    { valor: 'cerrados', texto: 'Cerrados' },
    ...(puedeEscribir ? [{ valor: 'soporte' as const, texto: 'Soporte' }] : []),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Pedidos del equipo</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Lo que cada colaborador le pide a dirección por correo, WhatsApp o llamada, con la conversación
          completa. Nada se borra: un pedido cancelado queda en «Cerrados».
        </p>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta
          titulo="Pedidos"
          descripcion={puedeEscribir ? 'Los de todo el equipo.' : 'Los tuyos.'}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" aria-label="Qué pedidos ver" role="group">
                {vistas.map((v) => (
                  <Boton
                    key={v.valor}
                    variante={vista === v.valor ? 'primario' : 'secundario'}
                    aria-pressed={vista === v.valor}
                    onClick={() => cambiarVista(v.valor)}
                  >
                    {v.texto}
                  </Boton>
                ))}
              </div>
              {puedeEscribir && (
                <Boton
                  variante="primario"
                  icono={Plus}
                  disabled={usuarios.length === 0}
                  onClick={() => setCreando(true)}
                >
                  Nuevo pedido
                </Boton>
              )}
            </div>
          }
        />

        {errorDeUsuarios && <p className="border-b border-borde px-5 py-2 text-sm text-critico">{errorDeUsuarios}</p>}

        {puedeEscribir && creando && (
          <FormularioDePedido
            usuarios={usuarios}
            clientes={clientes}
            usuarioActualId={sesion?.usuarioId ?? null}
            alCancelar={() => setCreando(false)}
            alCrear={(pedido) => {
              setCreando(false);
              setSeleccionado(pedido.id);
              if (vista === 'abiertos') recargar();
              else cambiarVista('abiertos');
            }}
          />
        )}

        {error && <p className="border-b border-borde px-5 py-2 text-sm text-critico">{error}</p>}

        {pedidos === null && !error ? (
          <p className="px-5 py-8 text-center text-sm text-tinta-tenue">Cargando…</p>
        ) : (
          <Tabla etiqueta="Pedidos del equipo">
            <thead>
              <tr>
                <Th>Prioridad</Th>
                <Th>Asunto</Th>
                <Th>De</Th>
                <Th>Para</Th>
                <Th>Recordar el</Th>
                <Th>Estado</Th>
                {puedeEscribir && <Th>Acciones</Th>}
              </tr>
            </thead>
            <tbody>
              {(pedidos ?? []).map((pedido) => {
                const prioridad = ETIQUETA_PRIORIDAD[pedido.prioridad];
                const estado = ETIQUETA_ESTADO_PEDIDO[pedido.estado];
                const abierto = pedido.estado === 'ABIERTO' || pedido.estado === 'EN_CURSO';
                const vencido = abierto && recordatorioVencido(pedido.recordarEl, ahora);
                const elegido = pedido.id === seleccionado;
                return (
                  <tr
                    key={pedido.id}
                    className={vencido ? 'bg-critico-fondo' : elegido ? 'bg-superficie-tenue' : ''}
                  >
                    <Td>
                      <Badge tono={prioridad.tono} conIcono={false}>{prioridad.texto}</Badge>
                    </Td>
                    <Td className="font-medium">
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => setSeleccionado(pedido.id)}
                      >
                        {pedido.asunto}
                      </button>
                    </Td>
                    <Td>{pedido.solicitanteNombre}</Td>
                    <Td className="text-tinta-suave">{pedido.destinatarioNombres.join(', ')}</Td>
                    <Td className="whitespace-nowrap text-tinta-suave">
                      {pedido.recordarEl ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{formatearDia(pedido.recordarEl)}</span>
                          {vencido && <Badge tono="critico">Vencido</Badge>}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td><Badge tono={estado.tono}>{estado.texto}</Badge></Td>
                    {puedeEscribir && (
                      <Td>
                        <AccionesDePedido
                          id={pedido.id}
                          estado={pedido.estado}
                          derivadoASoporte={pedido.derivadoASoporte}
                          destinatariosActuales={pedido.destinatarioUsuarioIds}
                          destinatarios={destinatarios}
                          alCambiar={recargar}
                        />
                      </Td>
                    )}
                  </tr>
                );
              })}
              {pedidos !== null && pedidos.length === 0 && (
                <tr>
                  <td colSpan={columnas} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                    {VACIO[vista]}
                  </td>
                </tr>
              )}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>

      {seleccionado && (
        <DetalleDePedido
          pedidoId={seleccionado}
          version={recarga}
          puedeEscribir={puedeEscribir}
          usuarios={usuarios}
          clientes={clientes}
          alCambiar={recargar}
        />
      )}
    </div>
  );
}
