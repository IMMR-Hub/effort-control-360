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

import { useEffect, useMemo, useState, type ComponentProps, type CSSProperties } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  FileClock,
  Landmark,
  SendHorizontal,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  dentroDelRango,
  describirFiltro,
  hoyEnParaguay,
  periodosDelRango,
  rangoDelFiltro,
  type FiltroDeFechas,
} from '@effort/core';

import {
  Badge,
  EncabezadoTarjeta,
  Indicador,
  IndicadorEsqueleto,
  Tabla,
  Tarjeta,
  TarjetaEsqueleto,
  Td,
  Th,
} from '../ui/Primitivos.jsx';
import { useConteoAnimado } from '../ui/useConteoAnimado.js';
import type { Pantalla } from '../layout/Encabezado.js';
import { FiltroDeFechasSelector } from '../ui/FiltroDeFechas.js';
import { ETIQUETA_NIVEL_ALERTA, ETIQUETA_CRITICIDAD, TONO_NIVEL_ALERTA, TONO_CRITICIDAD } from '../ui/etiquetas.js';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { obtenerAlertas, type Alerta } from '../api/alertas.js';
import {
  listarPresentados,
  obtenerRadar,
  type Vencimiento,
  type VencimientoPresentado,
} from '../api/vencimientos.js';
import { listarSolicitudesPorPeriodo, type SolicitudDocumentacion } from '../api/solicitudes.js';
import { listarBalances, type Balance } from '../api/balances.js';
import { listarLiquidaciones, type Liquidacion } from '../api/liquidaciones.js';
import type { FiltroDeNivel } from '../ui/etiquetas.js';

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

/**
 * `Indicador` con el número animado. Envuelve al primitivo en vez de
 * modificarlo: las otras ocho pantallas que usan `Indicador` siguen
 * recibiendo un número quieto, tal como lo tenían.
 */
function IndicadorAnimado({ valor, ...resto }: ComponentProps<typeof Indicador> & { valor: number }) {
  return <Indicador valor={useConteoAnimado(valor)} {...resto} />;
}

/**
 * `--retardo-entrada` es una variable CSS, no una propiedad que
 * `CSSProperties` conozca — el cast queda en un solo lugar en vez de
 * repetirse en cada `<Tarjeta>` que escalona su entrada.
 */
function estiloRetardo(ms: number): CSSProperties {
  return { '--retardo-entrada': `${ms}ms` } as CSSProperties;
}

export default function Panel({
  irA,
}: {
  irA?: (pantalla: Pantalla, opciones?: { nivel: FiltroDeNivel }) => void;
}) {
  const hoy = useMemo(() => hoyEnParaguay(new Date()), []);
  const mesActual = `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;

  /*
   * Arranca en "todas las fechas": el panel es lo primero que se ve al entrar,
   * y lo que tiene que mostrar es el estado de la cartera, no un mes. Con un
   * filtro elegido, lo que tiene fecha (vencimientos, alertas, presentaciones)
   * se recorta al rango, y lo que es por período fiscal toma los períodos que
   * el rango toca.
   */
  const [filtro, setFiltro] = useState<FiltroDeFechas>({ tipo: 'todo' });
  const rango = useMemo(() => rangoDelFiltro(filtro, hoy), [filtro, hoy]);
  const periodos = useMemo(() => (rango ? periodosDelRango(rango) : [mesActual]), [rango, mesActual]);
  const [presentados, setPresentados] = useState<readonly VencimientoPresentado[]>([]);

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
        porPeriodo,
        { presentados: listaDePresentados },
      ] = await Promise.all([
        listarClientes(),
        obtenerRadar(),
        obtenerAlertas(),
        // La API de estos tres es por período: se pide cada período que toca el
        // rango y se juntan. Un rango de 90 días son a lo sumo cuatro.
        Promise.all(
          periodos.map((p) =>
            Promise.all([listarSolicitudesPorPeriodo(p), listarBalances(p), listarLiquidaciones(p)]),
          ),
        ),
        listarPresentados(),
      ]);
      setClientes(listaDeClientes);
      setVencimientos(radar.vencimientos);
      setAlertas(listaDeAlertas);
      setSolicitudes(porPeriodo.flatMap(([s]) => s.solicitudes));
      setBalances(porPeriodo.flatMap(([, b]) => b.balances));
      setLiquidaciones(porPeriodo.flatMap(([, , l]) => l.liquidaciones));
      setPresentados(listaDePresentados);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodos.join(',')]);

  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string | null) => (clienteId ? mapa.get(clienteId) ?? clienteId : '—');
  }, [clientes]);

  const clientesActivos = clientes.filter((c) => c.activo).length;
  const vencimientosEnRango = vencimientos.filter((v) => dentroDelRango(v.fechaVencimiento, rango));
  const alertasEnRango = alertas.filter((a) => dentroDelRango(a.creadoEn ?? null, rango));
  const presentadosEnRango = presentados.filter((p) => dentroDelRango(p.fechaPresentacion, rango));
  const conAtraso = presentadosEnRango.filter((p) => p.diasDeAtraso > 0);
  const diasDeAtrasoTotales = conAtraso.reduce((suma, p) => suma + p.diasDeAtraso, 0);

  const vencidos = vencimientosEnRango.filter((v) => v.nivelAlerta === 'VENCIDO').length;
  const proximos = vencimientosEnRango.filter((v) => v.nivelAlerta === 'CRITICA' || v.nivelAlerta === 'ALTA').length;
  const alertasCriticas = alertasEnRango.filter((a) => a.criticidad === 'CRITICA').length;
  const detallePeriodos = periodos.length === 1 ? `Período ${periodos[0]}` : `Períodos ${periodos[0]} a ${periodos[periodos.length - 1]}`;
  const documentacionPendiente = solicitudes.filter((s) => ESTADOS_SOLICITUD_ABIERTA.has(s.estado)).length;
  const balancesPendientes = balances.filter((b) => ESTADOS_BALANCE_PENDIENTE.has(b.estado)).length;
  const liquidacionesSinEnviar = liquidaciones.filter((l) => ESTADOS_LIQUIDACION_SIN_ENVIAR.has(l.estado)).length;

  const alertasUrgentes = useMemo(
    () => [...alertasEnRango].filter((a) => a.criticidad === 'CRITICA' || a.criticidad === 'ALTA').slice(0, MAXIMO_EN_LISTAS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alertas, rango],
  );

  const vencimientosUrgentes = useMemo(
    () =>
      [...vencimientosEnRango]
        .filter((v) => v.nivelAlerta !== 'SIN_ALERTA')
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
        .slice(0, MAXIMO_EN_LISTAS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vencimientos, rango],
  );

  if (cargando) {
    // La misma forma que la pantalla real (8 indicadores + 2 tarjetas), para
    // que nada salte de tamaño cuando llegan los datos — y para que el primer
    // instante muestre una forma reconocible en vez de un texto centrado.
    return (
      <main className="mx-auto max-w-[86rem] space-y-5 px-5 py-6" aria-busy="true" aria-label="Cargando panel general">
        <div className="esqueleto h-16 max-w-2xl rounded" />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <IndicadorEsqueleto key={i} />)}
        </section>
        <div className="grid gap-5 lg:grid-cols-2">
          <TarjetaEsqueleto />
          <TarjetaEsqueleto />
        </div>
      </main>
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
          <p className="mt-1 text-xs text-tinta-tenue">Mostrando: {describirFiltro(filtro)}.</p>
        </div>
        <FiltroDeFechasSelector id="filtroPanel" valor={filtro} onCambiar={setFiltro} permitirTodo />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores generales">
        <IndicadorAnimado etiqueta="Clientes activos"
          onIr={irA ? () => irA('clientes') : null}
          irEtiqueta="Ver los clientes" valor={clientesActivos} tono="proceso" icono={Users} retardoMs={0} />
        <IndicadorAnimado
          etiqueta="Vencimientos vencidos"
          onIr={irA ? () => irA('vencimientos', { nivel: 'VENCIDO' }) : null}
          irEtiqueta="Ver los vencimientos vencidos"
          valor={vencidos}
          tono="critico"
          destacado={vencidos > 0}
          icono={AlertTriangle}
          retardoMs={40}
        />
        <IndicadorAnimado etiqueta="Vencimientos próximos"
          onIr={irA ? () => irA('vencimientos', { nivel: 'PROXIMOS' }) : null}
          irEtiqueta="Ver los vencimientos próximos" valor={proximos} tono="parcial" icono={Clock} retardoMs={80} />
        <IndicadorAnimado
          etiqueta="Alertas críticas"
          onIr={irA ? () => irA('alertas') : null}
          irEtiqueta="Ver las alertas críticas"
          valor={alertasCriticas}
          tono="critico"
          destacado={alertasCriticas > 0}
          icono={ShieldAlert}
          retardoMs={120}
        />
        <IndicadorAnimado
          etiqueta="Documentación pendiente"
          onIr={irA ? () => irA('seguimiento') : null}
          irEtiqueta="Ver el seguimiento de documentación"
          valor={documentacionPendiente}
          detalle={detallePeriodos}
          tono="pendiente"
          icono={FileClock}
          retardoMs={160}
        />
        <IndicadorAnimado
          etiqueta="Balances sin aprobar"
          onIr={irA ? () => irA('balances') : null}
          irEtiqueta="Ver los balances"
          valor={balancesPendientes}
          detalle={detallePeriodos}
          tono="pendiente"
          icono={Landmark}
          retardoMs={200}
        />
        <IndicadorAnimado
          etiqueta="Liquidaciones sin enviar"
          onIr={irA ? () => irA('liquidaciones') : null}
          irEtiqueta="Ver las liquidaciones"
          valor={liquidacionesSinEnviar}
          detalle={detallePeriodos}
          tono="pendiente"
          icono={SendHorizontal}
          retardoMs={240}
        />
        <IndicadorAnimado
          etiqueta="Presentadas con atraso"
          onIr={irA ? () => irA('vencimientos') : null}
          irEtiqueta="Ver las presentaciones con atraso"
          valor={conAtraso.length}
          detalle={
            presentadosEnRango.length === 0
              ? 'sin presentaciones registradas'
              : `de ${presentadosEnRango.length} presentadas · ${diasDeAtrasoTotales} días en total`
          }
          tono="parcial"
          icono={CalendarClock}
          retardoMs={280}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta className="animar-entrada" style={estiloRetardo(320)}>
          <EncabezadoTarjeta
            titulo="Alertas más urgentes"
            descripcion={alertasUrgentes.length === 0 ? 'Sin alertas críticas o altas activas' : `Las ${alertasUrgentes.length} más urgentes de ${alertasEnRango.length} activas — el resto, en la pantalla Alertas`}
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

        <Tarjeta className="animar-entrada" style={estiloRetardo(360)}>
          <EncabezadoTarjeta
            titulo="Vencimientos más urgentes"
            descripcion={vencimientosUrgentes.length === 0 ? 'Sin vencimientos con alerta activa' : `Los ${vencimientosUrgentes.length} más urgentes de ${vencimientosEnRango.length} en el radar — el resto, en la pantalla Vencimientos`}
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
