/**
 * Pantalla de Balances (tarea 104, pantalla 5 de 12).
 *
 * La más sensible de las doce: por el ADR 0004
 * (`docs/adr/0004-el-sistema-no-aprueba-balances.md`) el sistema **nunca**
 * aprueba un balance solo. Esta pantalla puede ocultar el botón de aprobar
 * según el rol y el estado, y pedir una confirmación explícita antes de
 * llamar al servidor — pero la decisión real (cero bloqueantes, rol
 * habilitado, registro en la bitácora) vive en el servidor, en cuatro capas
 * independientes. Acá no se replica ni se adelanta ninguna de esas capas.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';

import { formatearGs, gs, hoyEnParaguay } from '@effort/core';

import { Badge, Boton, CampoTexto, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  aprobarBalance as aprobarBalanceApi,
  guardarBalance,
  listarBalances,
  obtenerBalance,
  type Balance,
  type CifrasDeBalance,
  type EstadoBalance,
  type Inconsistencia,
  type RevisionPrevia,
} from '../api/balances.js';
import { useSesion } from '../contexts/SesionContext.js';

const ROLES_QUE_EDITAN = new Set(['direccion', 'responsable', 'coordinador', 'revisor_balance']);
const ROLES_QUE_APRUEBAN = new Set(['direccion', 'revisor_balance']);

const TONO_ESTADO: Record<EstadoBalance, 'completo' | 'parcial' | 'pendiente' | 'critico' | 'proceso'> = {
  NO_APLICA: 'pendiente',
  PENDIENTE: 'pendiente',
  EN_PREPARACION: 'proceso',
  OBSERVADO: 'critico',
  LISTO_PARA_REVISION: 'proceso',
  EN_REVISION: 'proceso',
  APROBADO: 'completo',
};

const ETIQUETA_ESTADO: Record<EstadoBalance, string> = {
  NO_APLICA: 'No aplica',
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  OBSERVADO: 'Observado',
  LISTO_PARA_REVISION: 'Listo para revisión',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
};

const ETIQUETA_CODIGO: Record<Inconsistencia['codigo'], string> = {
  ECUACION_PATRIMONIAL_NO_CIERRA: 'La ecuación patrimonial no cierra (Activo = Pasivo + Patrimonio)',
  RESULTADO_NO_COINCIDE_CON_ESTADO_RESULTADOS: 'El resultado del ejercicio no coincide con el estado de resultados',
  RESULTADO_ESTADO_RESULTADOS_MAL_SUMADO: 'El estado de resultados no suma correctamente',
  DOCUMENTOS_FALTANTES: 'Documentos faltantes en el proceso mensual',
  DIFERENCIAS_CON_SIGA: 'Diferencias con la exportación de SIGA',
  LIQUIDACION_PENDIENTE_DE_ENVIO: 'Liquidación pendiente de envío',
  EXTRACTO_BANCARIO_FALTANTE: 'Falta el extracto bancario',
  CONCILIACION_BANCARIA_PENDIENTE: 'Conciliación bancaria pendiente',
};

/** Formatea un importe en texto (o `null`) para mostrar. `'—'` si no hay valor. */
function mostrarGs(importe: string | null): string {
  return importe === null ? '—' : formatearGs(gs(importe));
}

function contarBloqueantes(inconsistencias: readonly Inconsistencia[] | null): number {
  return (inconsistencias ?? []).filter((i) => i.gravedad === 'BLOQUEANTE').length;
}

interface FormularioBalance {
  activo: string;
  pasivo: string;
  patrimonioNeto: string;
  resultadoEjercicio: string;
  ingresos: string;
  costos: string;
  gastos: string;
  resultado: string;
}

const FORMULARIO_VACIO: FormularioBalance = {
  activo: '',
  pasivo: '',
  patrimonioNeto: '',
  resultadoEjercicio: '',
  ingresos: '',
  costos: '',
  gastos: '',
  resultado: '',
};

function aFormulario(balance: Balance): FormularioBalance {
  return {
    activo: balance.activo ?? '',
    pasivo: balance.pasivo ?? '',
    patrimonioNeto: balance.patrimonioNeto ?? '',
    resultadoEjercicio: balance.resultadoEjercicio ?? '',
    ingresos: '',
    costos: '',
    gastos: '',
    resultado: '',
  };
}

export default function Balances() {
  const { sesion } = useSesion();
  const rol = sesion?.rol ?? '';
  const puedeEditar = ROLES_QUE_EDITAN.has(rol);
  const puedeAprobar = ROLES_QUE_APRUEBAN.has(rol);

  const periodoPorDefecto = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);
  const [periodo, setPeriodo] = useState(periodoPorDefecto);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [balances, setBalances] = useState<readonly Balance[]>([]);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [balanceSeleccionado, setBalanceSeleccionado] = useState<Balance | null>(null);
  const [revisionPrevia, setRevisionPrevia] = useState<RevisionPrevia | null>(null);
  const [formulario, setFormulario] = useState<FormularioBalance>(FORMULARIO_VACIO);

  const [guardando, setGuardando] = useState(false);
  const [errorPanel, setErrorPanel] = useState<string | null>(null);
  const [aprobando, setAprobando] = useState(false);

  async function cargarTablero() {
    setCargando(true);
    setError(null);
    try {
      const [{ clientes: listaDeClientes }, { balances: listaDeBalances }] = await Promise.all([
        listarClientes(),
        listarBalances(periodo),
      ]);
      setClientes(listaDeClientes);
      setBalances(listaDeBalances);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarTablero();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const filas = useMemo(
    () =>
      clientes
        .filter((c) => c.activo)
        .map((cliente) => ({
          cliente,
          balance: balances.find((b) => b.clienteId === cliente.id) ?? null,
        }))
        .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, 'es')),
    [clientes, balances],
  );

  const aprobados = filas.filter((f) => f.balance?.estado === 'APROBADO').length;
  const listosParaRevision = filas.filter((f) => f.balance?.estado === 'LISTO_PARA_REVISION').length;
  const conBloqueantes = filas.filter((f) => contarBloqueantes(f.balance?.inconsistencias ?? null) > 0).length;

  function seleccionarFila(clienteId: string) {
    setClienteSeleccionado(clienteId);
    const existente = balances.find((b) => b.clienteId === clienteId) ?? null;
    setBalanceSeleccionado(existente);
    setFormulario(existente ? aFormulario(existente) : FORMULARIO_VACIO);
    setRevisionPrevia(null);
    setErrorPanel(null);
  }

  async function guardarYRevisar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clienteSeleccionado) return;
    setGuardando(true);
    setErrorPanel(null);
    try {
      const cifras: CifrasDeBalance = {
        activo: formulario.activo || '0',
        pasivo: formulario.pasivo || '0',
        patrimonioNeto: formulario.patrimonioNeto || '0',
        resultadoEjercicio: formulario.resultadoEjercicio || '0',
        estadoResultados: {
          ingresos: formulario.ingresos || '0',
          costos: formulario.costos || '0',
          gastos: formulario.gastos || '0',
          resultado: formulario.resultado || '0',
        },
      };
      const { balance, revision } = await guardarBalance(clienteSeleccionado, periodo, cifras);
      setBalanceSeleccionado(balance);
      setRevisionPrevia(revision);
      await cargarTablero();
    } catch (motivo) {
      setErrorPanel(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function manejarAprobar() {
    if (!clienteSeleccionado || !balanceSeleccionado) return;
    const nombreCliente = clientes.find((c) => c.id === clienteSeleccionado)?.nombre ?? clienteSeleccionado;
    const confirmado = window.confirm(
      `¿Confirmás que revisaste el balance de ${nombreCliente} (${periodo}) y lo aprobás?\n\n` +
        'Esta acción queda registrada con tu nombre y la fecha, y no se puede deshacer desde acá.',
    );
    if (!confirmado) return;

    setAprobando(true);
    setErrorPanel(null);
    try {
      const { balance } = await aprobarBalanceApi(clienteSeleccionado, periodo);
      setBalanceSeleccionado(balance);
      await cargarTablero();
    } catch (motivo) {
      setErrorPanel(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setAprobando(false);
    }
  }

  const nombreClienteSeleccionado = clientes.find((c) => c.id === clienteSeleccionado)?.nombre ?? '';
  const inconsistenciasAMostrar = revisionPrevia?.inconsistencias ?? balanceSeleccionado?.inconsistencias ?? [];
  const bloqueantesAMostrar =
    revisionPrevia?.bloqueantes ?? contarBloqueantes(balanceSeleccionado?.inconsistencias ?? null);
  const estadoActual = balanceSeleccionado?.estado ?? null;

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
          <h1 className="text-lg font-semibold">Balances</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            El sistema prepara la revisión y arma el checklist. Aprobar es un acto humano: lo hace una
            persona identificada, nunca el sistema.
          </p>
        </div>
        <CampoTexto
          id="periodo"
          etiqueta="Período"
          value={periodo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodo(e.target.value)}
          pattern="\d{4}-\d{2}"
          placeholder="2026-03"
          className="w-40"
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del período">
        <Indicador etiqueta="Clientes" valor={filas.length} tono="proceso" />
        <Indicador etiqueta="Aprobados" valor={aprobados} tono="completo" />
        <Indicador etiqueta="Listos para revisión" valor={listosParaRevision} tono="proceso" />
        <Indicador etiqueta="Con bloqueantes" valor={conBloqueantes} tono="critico" destacado={conBloqueantes > 0} />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Balances por cliente" descripcion={`Período ${periodo}`} />
        <Tabla etiqueta="Balances por cliente">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th numerica>Activo</Th>
              <Th numerica>Pasivo</Th>
              <Th numerica>Patrimonio neto</Th>
              <Th numerica>Resultado</Th>
              <Th numerica>Bloqueantes</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ cliente, balance }) => (
              <tr
                key={cliente.id}
                onClick={() => seleccionarFila(cliente.id)}
                className={`cursor-pointer transition-colors hover:bg-superficie-tenue ${
                  cliente.id === clienteSeleccionado ? 'bg-superficie-tenue' : ''
                }`}
              >
                <Td className="font-medium">{cliente.nombre}</Td>
                <Td>
                  {balance ? (
                    <Badge tono={TONO_ESTADO[balance.estado]} conIcono={false}>
                      {ETIQUETA_ESTADO[balance.estado]}
                    </Badge>
                  ) : (
                    <Badge tono="pendiente" conIcono={false}>Sin iniciar</Badge>
                  )}
                </Td>
                <Td numerica className="cifra">{mostrarGs(balance?.activo ?? null)}</Td>
                <Td numerica className="cifra">{mostrarGs(balance?.pasivo ?? null)}</Td>
                <Td numerica className="cifra">{mostrarGs(balance?.patrimonioNeto ?? null)}</Td>
                <Td numerica className="cifra">{mostrarGs(balance?.resultadoEjercicio ?? null)}</Td>
                <Td
                  numerica
                  className={contarBloqueantes(balance?.inconsistencias ?? null) > 0 ? 'font-semibold text-critico' : ''}
                >
                  {balance ? contarBloqueantes(balance.inconsistencias) : '—'}
                </Td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  No hay clientes activos.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>

      {clienteSeleccionado && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {puedeEditar && (
            <Tarjeta>
              <EncabezadoTarjeta
                titulo={`Cifras — ${nombreClienteSeleccionado}`}
                descripcion={`Período ${periodo}${estadoActual ? ` · ${ETIQUETA_ESTADO[estadoActual]}` : ''}`}
              />
              <form onSubmit={guardarYRevisar} className="space-y-4 px-5 py-4">
                {errorPanel && (
                  <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                    {errorPanel}
                  </p>
                )}
                {estadoActual === 'APROBADO' && (
                  <p className="rounded border border-parcial-borde bg-parcial-fondo px-3 py-2 text-sm text-parcial">
                    Este balance ya está aprobado. Guardar cifras nuevas lo va a sacar de aprobado — la
                    aprobación se pierde y hay que volver a pedirla.
                  </p>
                )}

                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                    Balance general
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoTexto
                      id="activo"
                      etiqueta="Activo (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.activo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, activo: e.target.value })
                      }
                    />
                    <CampoTexto
                      id="pasivo"
                      etiqueta="Pasivo (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.pasivo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, pasivo: e.target.value })
                      }
                    />
                    <CampoTexto
                      id="patrimonioNeto"
                      etiqueta="Patrimonio neto (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.patrimonioNeto}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, patrimonioNeto: e.target.value })
                      }
                    />
                    <CampoTexto
                      id="resultadoEjercicio"
                      etiqueta="Resultado del ejercicio (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.resultadoEjercicio}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, resultadoEjercicio: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-xs text-tinta-tenue">Activo = Pasivo + Patrimonio neto, o el balance no cierra.</p>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                    Estado de resultados
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoTexto
                      id="ingresos"
                      etiqueta="Ingresos (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.ingresos}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, ingresos: e.target.value })
                      }
                    />
                    <CampoTexto
                      id="costos"
                      etiqueta="Costos (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.costos}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, costos: e.target.value })
                      }
                    />
                    <CampoTexto
                      id="gastos"
                      etiqueta="Gastos (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.gastos}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, gastos: e.target.value })
                      }
                    />
                    <CampoTexto
                      id="resultado"
                      etiqueta="Resultado (Gs.)"
                      inputMode="numeric"
                      required
                      value={formulario.resultado}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormulario({ ...formulario, resultado: e.target.value })
                      }
                    />
                  </div>
                </fieldset>

                <div className="flex justify-end">
                  <Boton variante="primario" type="submit" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar y revisar'}
                  </Boton>
                </div>
              </form>
            </Tarjeta>
          )}

          <Tarjeta className="self-start">
            <EncabezadoTarjeta
              titulo="Checklist de revisión"
              descripcion={
                estadoActual
                  ? `Estado: ${ETIQUETA_ESTADO[estadoActual]}`
                  : 'Todavía no se guardaron cifras para este período.'
              }
            />
            <div className="space-y-4 px-5 py-4">
              {inconsistenciasAMostrar.length === 0 ? (
                <p className="text-sm text-tinta-suave">
                  {balanceSeleccionado ? 'Sin inconsistencias detectadas.' : 'Guardá las cifras para ver el checklist.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {inconsistenciasAMostrar.map((inc, indice) => (
                    <li
                      key={`${inc.codigo}-${indice}`}
                      className="flex items-start gap-2 rounded border border-borde px-3 py-2 text-sm"
                    >
                      <Badge tono={inc.gravedad === 'BLOQUEANTE' ? 'critico' : 'parcial'} conIcono={false}>
                        {inc.gravedad === 'BLOQUEANTE' ? 'Bloqueante' : 'Advertencia'}
                      </Badge>
                      <span className="text-tinta-suave">
                        {ETIQUETA_CODIGO[inc.codigo]}
                        {inc.diferencia !== null && ` · diferencia: ${mostrarGs(inc.diferencia)}`}
                        {inc.detalle && ` — ${inc.detalle}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {estadoActual === 'APROBADO' && balanceSeleccionado?.aprobadoEn && (
                <p className="rounded border border-completo-borde bg-completo-fondo px-3 py-2 text-sm text-completo">
                  Aprobado el {new Date(balanceSeleccionado.aprobadoEn).toLocaleDateString('es-PY')}.
                </p>
              )}

              {puedeAprobar && estadoActual && estadoActual !== 'APROBADO' && (
                <Boton
                  variante="primario"
                  icono={ShieldCheck}
                  onClick={() => void manejarAprobar()}
                  disabled={aprobando || estadoActual !== 'LISTO_PARA_REVISION' || bloqueantesAMostrar > 0}
                >
                  {aprobando ? 'Aprobando…' : 'Aprobar balance'}
                </Boton>
              )}
              {puedeAprobar && estadoActual && estadoActual !== 'LISTO_PARA_REVISION' && estadoActual !== 'APROBADO' && (
                <p className="text-xs text-tinta-tenue">
                  Solo se puede aprobar un balance en estado "Listo para revisión", sin bloqueantes.
                </p>
              )}
            </div>
          </Tarjeta>
        </div>
      )}
    </main>
  );
}
