/**
 * IVA crédito y débito, calculado desde las planillas RG 90.
 *
 * La primera pantalla que muestra **plata calculada sobre documentos reales**.
 * Todo lo demás del sistema controla que las cosas lleguen y no se pasen las
 * fechas; esto responde la pregunta que EFFORT le hace al sistema todos los
 * meses: *cuánto IVA tiene este cliente a favor o a pagar*.
 *
 * Dos decisiones de diseño que vale explicar:
 *
 * **Los hallazgos van arriba, no al final.** Son las diferencias entre el IVA
 * declarado en un comprobante y el que corresponde por la regla. En los datos
 * reales del piloto aparecieron 166, de las cuales 49 arriesgan multa. Ponerlas
 * abajo de una tabla de saldos sería enterrar lo único accionable de la
 * pantalla.
 *
 * **Un cliente por vez.** El IVA es por contribuyente: una lista mezclando
 * cinco empresas no responde ninguna pregunta que alguien tenga.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, RefreshCw } from 'lucide-react';

import {
  describirFiltro,
  formatearGs,
  gs,
  hoyEnParaguay,
  periodosDelRango,
  rangoDelFiltro,
  type FiltroDeFechas,
} from '@effort/core';

import { Badge, Boton, CampoSelect, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  calcularIva,
  decidirHallazgo,
  listarHallazgos,
  listarLiquidacionesIva,
  type HallazgoDeLibro,
  type LiquidacionIva,
  type ResumenDeCalculo,
  type ResumenDeHallazgos,
} from '../api/liquidacionesIva.js';
import { useSesion } from '../contexts/SesionContext.js';
import { FiltroDeFechasSelector } from '../ui/FiltroDeFechas.js';

/** Mismos roles que la matriz de permisos deja calcular. */
const ROLES_QUE_CALCULAN = new Set(['direccion', 'responsable']);

/** Mismos roles que la matriz deja editar una liquidación: son los que deciden sobre un hallazgo. */
const ROLES_QUE_DECIDEN = new Set(['direccion', 'responsable', 'coordinador']);

const RESUMEN_VACIO: ResumenDeHallazgos = {
  total: 0,
  conRiesgoDeMulta: 0,
  enRevision: 0,
  aceptados: 0,
  ivaEnRiesgo: '0',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'Sin revisar',
  EN_REVISION: 'En revisión',
  ACEPTADO: 'Aceptado',
};

const TONO_ESTADO: Record<string, 'critico' | 'parcial' | 'completo'> = {
  PENDIENTE: 'critico',
  EN_REVISION: 'parcial',
  ACEPTADO: 'completo',
};

/** Qué significa cada riesgo, en las palabras que usaría EFFORT. */
const ETIQUETA_RIESGO: Record<string, string> = {
  CREDITO_DE_MAS: 'Crédito fiscal de más',
  DEBITO_DE_MENOS: 'IVA ingresado de menos',
  EN_CONTRA_DEL_CLIENTE: 'En contra del cliente',
  INCONSISTENCIA: 'El comprobante no cierra',
};

/**
 * El tono dice cuánto urge, no qué tan grande es la diferencia.
 *
 * Los dos primeros pueden derivar en una multa administrativa; los otros dos
 * cuestan plata o son un error de carga. Un guaraní de crédito de más urge más
 * que cien de diferencia a favor del fisco.
 */
const TONO_RIESGO: Record<string, 'critico' | 'parcial' | 'pendiente'> = {
  CREDITO_DE_MAS: 'critico',
  DEBITO_DE_MENOS: 'critico',
  EN_CONTRA_DEL_CLIENTE: 'parcial',
  INCONSISTENCIA: 'pendiente',
};

function importe(texto: string): string {
  return formatearGs(gs(texto));
}

export default function LiquidacionIva() {
  const { sesion } = useSesion();
  const puedeCalcular = ROLES_QUE_CALCULAN.has(sesion?.rol ?? '');
  const puedeDecidir = ROLES_QUE_DECIDEN.has(sesion?.rol ?? '');

  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [liquidaciones, setLiquidaciones] = useState<readonly LiquidacionIva[]>([]);
  const [hallazgos, setHallazgos] = useState<readonly HallazgoDeLibro[]>([]);
  const [resumen, setResumen] = useState<ResumenDeHallazgos>(RESUMEN_VACIO);
  const [soloRiesgo, setSoloRiesgo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimoCalculo, setUltimoCalculo] = useState<ResumenDeCalculo | null>(null);

  // Por período fiscal: con un rango se muestran los períodos que toca.
  const [filtro, setFiltro] = useState<FiltroDeFechas>({ tipo: 'todo' });
  const periodosVisibles = useMemo(() => {
    const rango = rangoDelFiltro(filtro, hoyEnParaguay(new Date()));
    return rango ? new Set(periodosDelRango(rango)) : null;
  }, [filtro]);
  const enFiltro = (periodo: string) => periodosVisibles === null || periodosVisibles.has(periodo);
  // Hallazgo que se está aceptando: el motivo se pide en la misma fila, sin modal.
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [decidiendo, setDecidiendo] = useState(false);

  useEffect(() => {
    let vigente = true;
    listarClientes()
      .then(({ clientes: lista }) => {
        if (!vigente) return;
        setClientes(lista);
        // Se elige el primero solo: una pantalla que arranca vacía obliga a un
        // clic que no aporta nada.
        if (lista.length > 0 && !clienteId) setClienteId(lista[0]!.id);
        setCargando(false);
      })
      .catch((motivo) => {
        if (!vigente) return;
        setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // Solo al montar: la lista de clientes no cambia mientras se mira el IVA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clienteId) return;
    let vigente = true;
    setCargando(true);
    setError(null);

    Promise.all([listarLiquidacionesIva(clienteId), listarHallazgos(clienteId, soloRiesgo)])
      .then(([datosIva, datosHallazgos]) => {
        if (!vigente) return;
        setLiquidaciones(datosIva.liquidaciones);
        setHallazgos(datosHallazgos.hallazgos);
        setResumen(datosHallazgos.resumen);
        setCargando(false);
      })
      .catch((motivo) => {
        if (!vigente) return;
        setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
        setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [clienteId, soloRiesgo]);

  async function recalcular() {
    setCalculando(true);
    setError(null);
    try {
      setUltimoCalculo(await calcularIva());
      const [datosIva, datosHallazgos] = await Promise.all([
        listarLiquidacionesIva(clienteId),
        listarHallazgos(clienteId, soloRiesgo),
      ]);
      setLiquidaciones(datosIva.liquidaciones);
      setHallazgos(datosHallazgos.hallazgos);
      setResumen(datosHallazgos.resumen);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo recalcular el IVA.');
    } finally {
      setCalculando(false);
    }
  }

  async function decidir(id: string, decision: 'ACEPTADO' | 'EN_REVISION', nota?: string) {
    setDecidiendo(true);
    setError(null);
    try {
      await decidirHallazgo(id, decision, nota);
      const datos = await listarHallazgos(clienteId, soloRiesgo);
      setHallazgos(datos.hallazgos);
      setResumen(datos.resumen);
      setAceptando(null);
      setMotivo('');
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.message : 'No se pudo registrar la decisión.');
    } finally {
      setDecidiendo(false);
    }
  }

  const cliente = clientes.find((c) => c.id === clienteId);

  return (
    <div className="space-y-4">
      <Tarjeta>
        <EncabezadoTarjeta
          titulo="IVA crédito y débito"
          descripcion="Calculado desde las planillas RG 90 presentadas ante la DNIT. Ninguna cifra se carga a mano."
          acciones={
            puedeCalcular ? (
              <Boton variante="primario" icono={calculando ? RefreshCw : Calculator} onClick={recalcular} disabled={calculando}>
                {calculando ? 'Calculando…' : 'Recalcular desde los libros'}
              </Boton>
            ) : null
          }
        />

        <div className="px-5 py-4">
          <CampoSelect
            etiqueta="Cliente"
            id="cliente-iva"
            value={clienteId}
            onChange={(evento: { target: { value: string } }) => setClienteId(evento.target.value)}
            opciones={clientes.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          />
          <div className="mt-3">
            <FiltroDeFechasSelector id="filtroIva" valor={filtro} onCambiar={setFiltro} permitirTodo />
            <p className="mt-1 text-xs text-tinta-tenue">Períodos: {describirFiltro(filtro)}.</p>
          </div>
        </div>

        {ultimoCalculo && (
          <p className="px-5 pb-4 text-xs text-tinta-tenue">
            Último cálculo: {ultimoCalculo.archivosLeidos} planillas, {ultimoCalculo.filasInterpretadas} comprobantes,{' '}
            {ultimoCalculo.periodosCalculados} períodos
            {ultimoCalculo.hallazgosNuevos > 0 && `, ${ultimoCalculo.hallazgosNuevos} hallazgos nuevos`}
            {ultimoCalculo.fallos.length > 0 && ` · ${ultimoCalculo.fallos.length} planillas no se pudieron leer`}
            {(ultimoCalculo.archivosIgnorados ?? 0) > 0 &&
              ` · ${ultimoCalculo.archivosIgnorados} Excel ignorados por no ser planillas RG 90`}
            .
          </p>
        )}

        {ultimoCalculo?.clientesOmitidos && ultimoCalculo.clientesOmitidos.length > 0 && (
          <div className="px-5 pb-4 text-sm text-critico" role="alert">
            {ultimoCalculo.clientesOmitidos.map((omitido) => (
              <p key={omitido.cliente}>
                {omitido.cliente}: {omitido.motivo} Sus números no cambiaron; se reintenta en la próxima corrida.
              </p>
            ))}
          </div>
        )}

        {ultimoCalculo?.avisos && ultimoCalculo.avisos.length > 0 && (
          <details className="px-5 pb-4 text-xs text-tinta-tenue">
            <summary className="cursor-pointer">
              {ultimoCalculo.avisos.length + (ultimoCalculo.avisosOmitidos ?? 0)} avisos: planillas
              descartadas, filas que no se usaron o formatos que no se pueden leer
              {(ultimoCalculo.avisosOmitidos ?? 0) > 0 &&
                ` (se muestran los primeros ${ultimoCalculo.avisos.length})`}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {ultimoCalculo.avisos.map((aviso, i) => (
                <li key={i}>
                  {aviso.cliente} — {aviso.archivo}: {aviso.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}

        {error && (
          <p className="px-5 pb-4 text-sm text-critico" role="alert">
            {error}
          </p>
        )}
      </Tarjeta>

      {/* Lo accionable primero: son las que pueden costar una multa. */}
      <Tarjeta>
        <EncabezadoTarjeta
          titulo="Qué revisar antes de presentar"
          descripcion="Toda diferencia de IVA alerta, aunque sea de un guaraní. Cada una se acepta con motivo o se manda a revisar."
          acciones={
            <Boton variante="secundario" onClick={() => setSoloRiesgo(!soloRiesgo)}>
              {soloRiesgo ? 'Ver todos los hallazgos' : 'Ver solo los de riesgo'}
            </Boton>
          }
        />

        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-4">
          <Indicador
            etiqueta="Con riesgo de multa"
            valor={String(resumen.conRiesgoDeMulta)}
            tono={resumen.conRiesgoDeMulta > 0 ? 'critico' : 'completo'}
            destacado
          />
          <Indicador etiqueta="IVA en riesgo" valor={importe(resumen.ivaEnRiesgo)} tono="parcial" />
          <Indicador etiqueta="En revisión" valor={String(resumen.enRevision)} tono="parcial" />
          <Indicador etiqueta="Aceptados" valor={String(resumen.aceptados)} tono="completo" />
        </div>

        {hallazgos.filter((h) => enFiltro(h.periodo)).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-tinta-tenue">
            {cargando ? 'Cargando…' : 'No hay nada para revisar en este cliente.'}
          </p>
        ) : (
          <Tabla etiqueta="Hallazgos del libro">
            <thead>
              <tr>
                <Th>Período</Th>
                <Th>Riesgo</Th>
                <Th>Comprobante</Th>
                <Th>Contraparte</Th>
                <Th numerica>Diferencia</Th>
                <Th>Detalle</Th>
                <Th>Decisión</Th>
              </tr>
            </thead>
            <tbody>
              {hallazgos.filter((h) => enFiltro(h.periodo)).map((h) => (
                <tr key={h.id}>
                  <Td>{h.periodo}</Td>
                  <Td>
                    <Badge tono={TONO_RIESGO[h.riesgo] ?? 'pendiente'}>
                      {ETIQUETA_RIESGO[h.riesgo] ?? h.riesgo}
                    </Badge>
                  </Td>
                  <Td>
                    {h.numeroComprobante}
                    {h.tasa && <span className="ml-1 text-xs text-tinta-tenue">({h.tasa})</span>}
                  </Td>
                  <Td>{h.contraparte}</Td>
                  <Td numerica>{importe(h.diferencia)}</Td>
                  <Td>
                    <span className="text-xs text-tinta-tenue">{h.detalle}</span>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tono={TONO_ESTADO[h.estado] ?? 'critico'}>{ETIQUETA_ESTADO[h.estado] ?? h.estado}</Badge>
                      {h.notaDecision && <span className="text-xs text-tinta-tenue">{h.notaDecision}</span>}

                      {puedeDecidir && aceptando === h.id && (
                        <div className="flex flex-col gap-1">
                          <label htmlFor={`motivo-${h.id}`} className="text-xs text-tinta-tenue">
                            Motivo para aceptar
                          </label>
                          <input
                            id={`motivo-${h.id}`}
                            className="rounded border border-borde px-2 py-1 text-xs"
                            value={motivo}
                            maxLength={500}
                            onChange={(evento) => setMotivo(evento.target.value)}
                          />
                          <div className="flex gap-1">
                            <Boton
                              variante="primario"
                              disabled={decidiendo || motivo.trim().length < 5}
                              onClick={() => decidir(h.id, 'ACEPTADO', motivo.trim())}
                            >
                              Confirmar
                            </Boton>
                            <Boton variante="secundario" onClick={() => setAceptando(null)}>
                              Cancelar
                            </Boton>
                          </div>
                        </div>
                      )}

                      {puedeDecidir && aceptando !== h.id && (
                        <div className="flex gap-1">
                          {h.estado !== 'ACEPTADO' && (
                            <Boton
                              variante="secundario"
                              disabled={decidiendo}
                              onClick={() => {
                                setAceptando(h.id);
                                setMotivo('');
                              }}
                            >
                              Aceptar
                            </Boton>
                          )}
                          {h.estado !== 'EN_REVISION' && (
                            <Boton
                              variante="secundario"
                              disabled={decidiendo}
                              onClick={() => decidir(h.id, 'EN_REVISION')}
                            >
                              Revisar
                            </Boton>
                          )}
                        </div>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>

      <Tarjeta>
        <EncabezadoTarjeta
          titulo={cliente ? `IVA por período — ${cliente.nombre}` : 'IVA por período'}
          descripcion="Crédito de las compras, débito de las ventas, y el saldo que resulta."
        />

        {liquidaciones.filter((l) => enFiltro(l.periodo)).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-tinta-tenue">
            {cargando
              ? 'Cargando…'
              : 'Todavía no se calculó el IVA de este cliente. Usá "Recalcular desde los libros".'}
          </p>
        ) : (
          <Tabla etiqueta="IVA por período">
            <thead>
              <tr>
                <Th>Período</Th>
                <Th numerica>Compras</Th>
                <Th numerica>Crédito fiscal</Th>
                <Th numerica>Ventas</Th>
                <Th numerica>Débito fiscal</Th>
                <Th numerica>A pagar</Th>
                <Th numerica>A favor</Th>
                <Th numerica>A favor (declarado DNIT)</Th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.filter((l) => enFiltro(l.periodo)).map((l) => {
                // Coincide si no hay declaración leída (nada que contrastar) o
                // si los dos números son iguales. Cualquier otra cosa es una
                // diferencia real entre lo que EFFORT presentó y lo que este
                // sistema calculó desde las planillas — y eso merece verse.
                const difiere =
                  l.saldoAFavorDeclarado !== null && l.saldoAFavorDeclarado !== l.saldoAFavor;
                return (
                  <tr key={l.periodo}>
                    <Td>{l.periodo}</Td>
                    <Td numerica>{l.comprobantesCompras}</Td>
                    <Td numerica>{importe(l.creditoFiscal)}</Td>
                    <Td numerica>{l.comprobantesVentas}</Td>
                    <Td numerica>{importe(l.debitoFiscal)}</Td>
                    <Td numerica>
                      {l.saldoAPagar === '0' ? (
                        '—'
                      ) : (
                        <span className="font-semibold text-critico">{importe(l.saldoAPagar)}</span>
                      )}
                    </Td>
                    <Td numerica>{l.saldoAFavor === '0' ? '—' : importe(l.saldoAFavor)}</Td>
                    <Td numerica>
                      {l.saldoAFavorDeclarado === null ? (
                        <span className="text-tinta-tenue">sin declaración leída</span>
                      ) : (
                        <span
                          className={difiere ? 'inline-flex items-center gap-1 font-semibold text-critico' : ''}
                          title={
                            difiere
                              ? 'La DNIT ya tiene declarado un saldo distinto del que calcula este sistema.'
                              : undefined
                          }
                        >
                          {difiere && <AlertTriangle size={13} aria-hidden="true" />}
                          {l.saldoAFavorDeclarado === '0' ? '—' : importe(l.saldoAFavorDeclarado)}
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}

        {/*
          La simplificación se declara en la pantalla y no solo en el código:
          quien mire estos números tiene que saber qué NO contemplan.
        */}
        {liquidaciones.length > 0 && (
          <p className="flex items-start gap-2 border-t border-borde px-5 py-3 text-xs text-tinta-tenue">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Cada período se calcula por separado: el saldo a favor todavía no se arrastra al
              período siguiente. El crédito y el débito de cada mes sí son exactos.
            </span>
          </p>
        )}
      </Tarjeta>
    </div>
  );
}
