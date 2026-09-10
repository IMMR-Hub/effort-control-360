/**
 * Pantalla de Alertas (tarea 104, pantalla 8 de 12).
 *
 * Radar consolidado de la cartera, ordenado por criticidad — la tabla la
 * alimenta el sistema (vencimientos, conciliaciones, balances), no un
 * usuario a mano, así que acá no hay alta, solo lectura y cierre. Cerrar
 * exige motivo: una alerta cerrada sin explicación no se distingue de una
 * que se ignoró.
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, RefreshCw } from 'lucide-react';

import { hoyEnParaguay } from '@effort/core';

import { Badge, Boton, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ETIQUETA_CRITICIDAD, TONO_CRITICIDAD } from '../ui/etiquetas.js';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { marcarPresentado } from '../api/vencimientos.js';
import {
  cerrarAlerta,
  evaluarAlertas,
  obtenerAlertas,
  type Alerta,
  type ResumenDeEvaluacion,
  type ResumenPorCriticidad,
} from '../api/alertas.js';
import { useSesion } from '../contexts/SesionContext.js';

const ROLES_QUE_CIERRAN = new Set(['direccion', 'responsable', 'coordinador']);
/** Mismos roles que la matriz de permisos deja pedir una evaluación. */
const ROLES_QUE_EVALUAN = new Set(['direccion', 'responsable']);

const RESUMEN_VACIO: ResumenPorCriticidad = { CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0 };

export default function Alertas() {
  const { sesion } = useSesion();
  const puedeCerrar = ROLES_QUE_CIERRAN.has(sesion?.rol ?? '');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [alertas, setAlertas] = useState<readonly Alerta[]>([]);
  const [resumen, setResumen] = useState<ResumenPorCriticidad>(RESUMEN_VACIO);
  const [evaluando, setEvaluando] = useState(false);
  const [ultimaEvaluacion, setUltimaEvaluacion] = useState<ResumenDeEvaluacion | null>(null);

  const puedeEvaluar = ROLES_QUE_EVALUAN.has(sesion?.rol ?? '');

  async function evaluarAhora() {
    const hoy = hoyEnParaguay(new Date());
    const periodo = `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
    setEvaluando(true);
    setError(null);
    try {
      setUltimaEvaluacion(await evaluarAlertas(periodo));
      await recargar();
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setEvaluando(false);
    }
  }

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [{ clientes: listaDeClientes }, radar] = await Promise.all([
        listarClientes(),
        obtenerAlertas(),
      ]);
      setClientes(listaDeClientes);
      setAlertas(radar.alertas);
      setResumen(radar.resumen);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string | null) => (clienteId ? mapa.get(clienteId) ?? clienteId : '—');
  }, [clientes]);

  /**
   * Registra la presentación del vencimiento que originó la alerta.
   *
   * Al quedar presentado, el vencimiento sale del radar y la alerta se cierra
   * con un motivo que dice qué pasó -- en vez de quedar cerrada "porque sí",
   * que es lo que no permite rendir cuentas después.
   */
  async function manejarPresentar(alerta: Alerta) {
    if (!alerta.entidadRelacionadaId) return;

    const hoy = new Date().toISOString().slice(0, 10);
    const fecha = window.prompt(
      `¿Qué día se presentó "${alerta.titulo}"? (AAAA-MM-DD)`,
      alerta.fechaLimite ?? hoy,
    );
    if (!fecha || !fecha.trim()) return;

    try {
      await marcarPresentado(alerta.entidadRelacionadaId, fecha.trim());
      await cerrarAlerta(alerta.id, `Presentado el ${fecha.trim()}.`);
      await recargar();
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    }
  }

  async function manejarCerrar(alerta: Alerta) {
    const motivo = window.prompt(`¿Por qué se cierra "${alerta.titulo}"?`);
    if (!motivo || !motivo.trim()) return;
    try {
      await cerrarAlerta(alerta.id, motivo.trim());
      await recargar();
    } catch (motivo2) {
      setError(motivo2 instanceof ErrorDeApi ? motivo2.message : 'No se pudo conectar con el servidor.');
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-tinta-tenue">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-critico">{error}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[86rem] space-y-5 px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Alertas</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Vencimientos por vencer o vencidos y documentación faltante, consolidados por
            criticidad. Las genera el sistema, no un usuario a mano.
          </p>
        </div>
        {puedeEvaluar && (
          <Boton
            variante="secundario"
            icono={RefreshCw}
            onClick={() => void evaluarAhora()}
            disabled={evaluando}
          >
            {evaluando ? 'Evaluando…' : 'Evaluar ahora'}
          </Boton>
        )}
      </div>

      {ultimaEvaluacion && (
        <p
          role="status"
          className="rounded border border-borde-marca bg-superficie-tenue px-4 py-3 text-sm text-tinta-suave"
        >
          Se revisaron {ultimaEvaluacion.evaluadas} registros:{' '}
          {ultimaEvaluacion.creadas} alertas nuevas
          {ultimaEvaluacion.yaEstabanAbiertas > 0 &&
            `, ${ultimaEvaluacion.yaEstabanAbiertas} ya estaban abiertas`}
          .
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen por criticidad">
        <Indicador etiqueta="Críticas" valor={resumen.CRITICA} tono="critico" destacado={resumen.CRITICA > 0} />
        <Indicador etiqueta="Altas" valor={resumen.ALTA} tono="parcial" />
        <Indicador etiqueta="Medias" valor={resumen.MEDIA} tono="pendiente" />
        <Indicador etiqueta="Informativas" valor={resumen.INFORMATIVA} tono="proceso" />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Radar de alertas" descripcion={`${alertas.length} alertas activas`} />
        <Tabla etiqueta="Radar de alertas">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Criticidad</Th>
              <Th>Título</Th>
              <Th>Detalle</Th>
              <Th>Origen</Th>
              <Th>Vence</Th>
              {puedeCerrar && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={a.id}>
                <Td className="font-medium">{nombreDeCliente(a.clienteId)}</Td>
                <Td>
                  <Badge tono={TONO_CRITICIDAD[a.criticidad]} conIcono={false}>
                    {ETIQUETA_CRITICIDAD[a.criticidad]}
                  </Badge>
                </Td>
                <Td>{a.titulo}</Td>
                <Td className="max-w-xs text-tinta-suave">{a.detalle}</Td>
                <Td className="text-tinta-suave">{a.origen}</Td>
                <Td className="cifra text-tinta-suave">{a.fechaLimite ?? '—'}</Td>
                {puedeCerrar && (
                  <Td>
                    <div className="flex gap-1">
                      {/*
                        Cerrar una alerta de vencimiento sin registrar la
                        presentación sería tapar el aviso sin resolver nada: el
                        vencimiento sigue figurando como no presentado y la
                        alerta vuelve a levantarse en la próxima evaluación.
                        Por eso el camino corto es "registrar la presentación",
                        que además cierra la alerta sola.
                      */}
                      {a.entidadRelacionada === 'vencimiento' && a.entidadRelacionadaId && (
                        <Boton
                          variante="secundario"
                          icono={CalendarCheck}
                          aria-label={`Registrar la presentación de: ${a.titulo}`}
                          onClick={() => void manejarPresentar(a)}
                        >
                          Registrar presentación
                        </Boton>
                      )}
                      <Boton
                        variante="fantasma"
                        icono={CheckCircle2}
                        aria-label={`Cerrar alerta: ${a.titulo}`}
                        onClick={() => void manejarCerrar(a)}
                      >
                        Cerrar
                      </Boton>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
            {alertas.length === 0 && (
              <tr>
                <td colSpan={puedeCerrar ? 7 : 6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  No hay alertas activas en la cartera.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>
    </main>
  );
}
