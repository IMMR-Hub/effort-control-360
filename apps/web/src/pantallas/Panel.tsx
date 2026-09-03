/**
 * Panel general (tarea 104, pantalla 12 de 12 — la última, porque agrega los
 * demás módulos).
 *
 * Solo lectura: ningún número de acá se puede tocar desde esta pantalla, se
 * edita en el módulo correspondiente (Vencimientos, Alertas, Balances,
 * Liquidaciones, Seguimiento). Todos los indicadores salen de un cálculo
 * sobre datos ya traídos de la API — ninguna cifra está escrita a mano,
 * misma regla que el resto del sistema (`CLAUDE.md`).
 */

import { useEffect, useMemo, useState } from 'react';
import { hoyEnParaguay } from '@effort/core';

import { Badge, CampoTexto, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ETIQUETA_NIVEL_ALERTA, ETIQUETA_CRITICIDAD, TONO_NIVEL_ALERTA, TONO_CRITICIDAD } from '../ui/etiquetas.js';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { obtenerAlertas, type Alerta } from '../api/alertas.js';
import { obtenerRadar, type Vencimiento } from '../api/vencimientos.js';
import { listarSolicitudesPorPeriodo, type SolicitudDocumentacion } from '../api/solicitudes.js';
import { listarBalances, type Balance } from '../api/balances.js';
import { listarLiquidaciones, type Liquidacion } from '../api/liquidaciones.js';

const ESTADOS_SOLICITUD_ABIERTA = new Set<SolicitudDocumentacion['estado']>([
  'ABIERTA',
  'RESPONDIDA_SIN_ENTREGA',
  'ESCALADA',
  'AGOTADA',
]);

const ESTADOS_BALANCE_PENDIENTE = new Set<Balance['estado']>([
  'PENDIENTE',
  'EN_PREPARACION',
  'OBSERVADO',
  'LISTO_PARA_REVISION',
  'EN_REVISION',
]);

const ESTADOS_LIQUIDACION_SIN_ENVIAR = new Set<Liquidacion['estado']>(['PENDIENTE', 'GENERADA']);

const MAXIMO_EN_LISTAS = 5;

export default function Panel() {
  const periodoPorDefecto = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);
  const [periodo, setPeriodo] = useState(periodoPorDefecto);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [vencimientos, setVencimientos] = useState<readonly Vencimiento[]>([]);
  const [alertas, setAlertas] = useState<readonly Alerta[]>([]);
  const [solicitudes, setSolicitudes] = useState<readonly SolicitudDocumentacion[]>([]);
  const [balances, setBalances] = useState<readonly Balance[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<readonly Liquidacion[]>([]);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [
        { clientes: listaDeClientes },
        radar,
        { alertas: listaDeAlertas },
        { solicitudes: listaDeSolicitudes },
        { balances: listaDeBalances },
        { liquidaciones: listaDeLiquidaciones },
      ] = await Promise.all([
        listarClientes(),
        obtenerRadar(),
        obtenerAlertas(),
        listarSolicitudesPorPeriodo(periodo),
        listarBalances(periodo),
        listarLiquidaciones(periodo),
      ]);
      setClientes(listaDeClientes);
      setVencimientos(radar.vencimientos);
      setAlertas(listaDeAlertas);
      setSolicitudes(listaDeSolicitudes);
      setBalances(listaDeBalances);
      setLiquidaciones(listaDeLiquidaciones);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string | null) => (clienteId ? mapa.get(clienteId) ?? clienteId : '—');
  }, [clientes]);

  const clientesActivos = clientes.filter((c) => c.activo).length;
  const vencidos = vencimientos.filter((v) => v.nivelAlerta === 'VENCIDO').length;
  const proximos = vencimientos.filter((v) => v.nivelAlerta === 'CRITICA' || v.nivelAlerta === 'ALTA').length;
  const alertasCriticas = alertas.filter((a) => a.criticidad === 'CRITICA').length;
  const documentacionPendiente = solicitudes.filter((s) => ESTADOS_SOLICITUD_ABIERTA.has(s.estado)).length;
  const balancesPendientes = balances.filter((b) => ESTADOS_BALANCE_PENDIENTE.has(b.estado)).length;
  const liquidacionesSinEnviar = liquidaciones.filter((l) => ESTADOS_LIQUIDACION_SIN_ENVIAR.has(l.estado)).length;

  const alertasUrgentes = useMemo(
    () => [...alertas].filter((a) => a.criticidad === 'CRITICA' || a.criticidad === 'ALTA').slice(0, MAXIMO_EN_LISTAS),
    [alertas],
  );

  const vencimientosUrgentes = useMemo(
    () =>
      [...vencimientos]
        .filter((v) => v.nivelAlerta !== 'SIN_ALERTA')
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
        .slice(0, MAXIMO_EN_LISTAS),
    [vencimientos],
  );

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Panel general</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Resumen de la cartera. Cada número se edita en su propio módulo, acá solo se mira.
          </p>
        </div>
        <CampoTexto
          id="periodoPanel"
          etiqueta="Período"
          value={periodo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodo(e.target.value)}
          pattern="\d{4}-\d{2}"
          placeholder="2026-03"
          className="w-40"
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores generales">
        <Indicador etiqueta="Clientes activos" valor={clientesActivos} tono="proceso" />
        <Indicador etiqueta="Vencimientos vencidos" valor={vencidos} tono="critico" destacado={vencidos > 0} />
        <Indicador etiqueta="Vencimientos próximos" valor={proximos} tono="parcial" />
        <Indicador etiqueta="Alertas críticas" valor={alertasCriticas} tono="critico" destacado={alertasCriticas > 0} />
        <Indicador etiqueta="Documentación pendiente" valor={documentacionPendiente} detalle={`Período ${periodo}`} tono="pendiente" />
        <Indicador etiqueta="Balances sin aprobar" valor={balancesPendientes} detalle={`Período ${periodo}`} tono="pendiente" />
        <Indicador etiqueta="Liquidaciones sin enviar" valor={liquidacionesSinEnviar} detalle={`Período ${periodo}`} tono="pendiente" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta>
          <EncabezadoTarjeta
            titulo="Alertas más urgentes"
            descripcion={alertasUrgentes.length === 0 ? 'Sin alertas críticas o altas activas' : `${alertasUrgentes.length} de ${alertas.length} alertas activas`}
          />
          <Tabla etiqueta="Alertas más urgentes">
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Criticidad</Th>
                <Th>Título</Th>
              </tr>
            </thead>
            <tbody>
              {alertasUrgentes.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium">{nombreDeCliente(a.clienteId)}</Td>
                  <Td>
                    <Badge tono={TONO_CRITICIDAD[a.criticidad]} conIcono={false}>
                      {ETIQUETA_CRITICIDAD[a.criticidad]}
                    </Badge>
                  </Td>
                  <Td>{a.titulo}</Td>
                </tr>
              ))}
              {alertasUrgentes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                    Nada urgente por ahora.
                  </td>
                </tr>
              )}
            </tbody>
          </Tabla>
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta
            titulo="Vencimientos más urgentes"
            descripcion={vencimientosUrgentes.length === 0 ? 'Sin vencimientos con alerta activa' : `${vencimientosUrgentes.length} de ${vencimientos.length} en el radar`}
          />
          <Tabla etiqueta="Vencimientos más urgentes">
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Descripción</Th>
                <Th numerica>Días</Th>
                <Th>Alerta</Th>
              </tr>
            </thead>
            <tbody>
              {vencimientosUrgentes.map((v) => (
                <tr key={v.id}>
                  <Td className="font-medium">{nombreDeCliente(v.clienteId)}</Td>
                  <Td>{v.descripcion}</Td>
                  <Td numerica className={v.diasRestantes <= 2 ? 'font-semibold text-critico' : ''}>
                    {v.diasRestantes}
                  </Td>
                  <Td>
                    <Badge tono={TONO_NIVEL_ALERTA[v.nivelAlerta]} conIcono={false}>
                      {ETIQUETA_NIVEL_ALERTA[v.nivelAlerta]}
                    </Badge>
                  </Td>
                </tr>
              ))}
              {vencimientosUrgentes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                    Nada urgente por ahora.
                  </td>
                </tr>
              )}
            </tbody>
          </Tabla>
        </Tarjeta>
      </div>
    </main>
  );
}
