/**
 * Pantalla Documentos / IVA (tarea 104, pantalla 3 de 12).
 *
 * Dos tableros, uno debajo del otro:
 *
 *  1. **Proceso mensual**: una fila por cliente activo, para el período
 *     elegido — "¿qué cliente está trabado y por qué?". Un cliente sin fila
 *     todavía (nadie abrió su seguimiento este mes) se muestra igual, marcado
 *     "Sin iniciar": guardar el panel de edición lo crea al vuelo (`asegurar`
 *     del lado del servidor), no hace falta un alta separada.
 *  2. **Documentos** del cliente seleccionado en el tablero de arriba, con
 *     alta y cambio de estado.
 *
 * Los importes (`total`, `ivaSaldoAPagar`, `ivaSaldoAFavor`) se formatean con
 * `gs()`/`formatearGs()` de `@effort/core` — nunca a mano.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertOctagon, Ban, CheckCircle2, FileText, Plus, Eye } from 'lucide-react';

import { formatearGs, gs, hoyEnParaguay } from '@effort/core';
import { periodoSchema } from '@effort/schema';

import {
  Badge,
  Boton,
  CampoSelect,
  CampoTexto,
  EncabezadoTarjeta,
  Indicador,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '../ui/Primitivos.jsx';
import { ErrorDeApi, urlDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  ETIQUETA_TIPO_DOCUMENTO,
  OPCIONES_RIESGO,
  OPCIONES_TIPO_DOCUMENTO,
  TONO_RIESGO,
} from '../ui/etiquetas.js';
import {
  actualizarProcesoMensual,
  cambiarEstadoDocumento,
  crearDocumento,
  listarDocumentos,
  listarProcesoMensualPorPeriodo,
  type CamposEditablesDeProceso,
  type CanalRecepcionDocumento,
  type Documento,
  type EstadoDocumento,
  type EstadoGeneral,
  type NivelRiesgo,
  type ProcesoMensual,
  type TasaIva,
  type TipoDocumento,
} from '../api/documentos.js';
import { useSesion } from '../contexts/SesionContext.js';

const ROLES_QUE_EDITAN_PROCESO = new Set(['direccion', 'responsable', 'coordinador', 'auxiliar']);
const ROLES_QUE_CREAN_DOCUMENTO = new Set(['direccion', 'responsable', 'coordinador', 'auxiliar']);
const ROLES_QUE_CAMBIAN_ESTADO = new Set(['direccion', 'responsable', 'coordinador']);

const TONO_ESTADO_GENERAL: Record<EstadoGeneral, 'completo' | 'parcial' | 'pendiente' | 'critico'> = {
  COMPLETO: 'completo',
  PARCIAL: 'parcial',
  PENDIENTE: 'pendiente',
  OBSERVADO: 'parcial',
  CRITICO: 'critico',
};

const TONO_ESTADO_DOCUMENTO: Record<EstadoDocumento, 'proceso' | 'parcial' | 'critico' | 'completo'> = {
  RECIBIDO: 'proceso',
  OBSERVADO: 'parcial',
  RECHAZADO: 'critico',
  DUPLICADO: 'critico',
  CARGADO_EN_SIGA: 'completo',
};

const ETIQUETA_TASA: Record<TasaIva, string> = { DIEZ: '10%', CINCO: '5%', EXENTA: 'Exenta' };

const ETIQUETA_CANAL: Record<CanalRecepcionDocumento, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  ONEDRIVE: 'OneDrive',
  FISICO_ESCANEADO: 'Físico escaneado',
  SISTEMA: 'Sistema',
};

const OPCIONES_ESTADO_GENERAL = Object.keys(TONO_ESTADO_GENERAL).map((v) => ({ valor: v, etiqueta: v }));
const OPCIONES_TASA = Object.entries(ETIQUETA_TASA).map(([valor, etiqueta]) => ({ valor, etiqueta }));
const OPCIONES_CANAL = Object.entries(ETIQUETA_CANAL).map(([valor, etiqueta]) => ({ valor, etiqueta }));

/** Formatea un importe en texto (o `null`) para mostrar. `'—'` si no hay valor. */
function mostrarGs(importe: string | null): string {
  return importe === null ? '—' : formatearGs(gs(importe));
}

/** `''` en un input numérico de dinero significa "sin cargar": se manda `null`. */
function textoANuloOImporte(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

interface FormularioProceso {
  comprobantesRetirados: boolean;
  fechaRetiro: string;
  documentosRecibidos: string;
  documentosFaltantes: string;
  documentosObservados: string;
  comprasCargadasSiga: boolean;
  ventasCargadasSiga: boolean;
  retencionesCargadas: boolean;
  extractosRecibidos: boolean;
  conciliacionBancariaRealizada: boolean;
  ivaRevisado: boolean;
  ivaSaldoAPagar: string;
  ivaSaldoAFavor: string;
  liquidacionGenerada: boolean;
  liquidacionEnviada: boolean;
  balanceAplica: boolean;
  estadoGeneral: EstadoGeneral;
  riesgo: NivelRiesgo;
  proximaAccion: string;
  fechaLimiteInterna: string;
  observaciones: string;
}

const PROCESO_VACIO: FormularioProceso = {
  comprobantesRetirados: false,
  fechaRetiro: '',
  documentosRecibidos: '0',
  documentosFaltantes: '0',
  documentosObservados: '0',
  comprasCargadasSiga: false,
  ventasCargadasSiga: false,
  retencionesCargadas: false,
  extractosRecibidos: false,
  conciliacionBancariaRealizada: false,
  ivaRevisado: false,
  ivaSaldoAPagar: '',
  ivaSaldoAFavor: '',
  liquidacionGenerada: false,
  liquidacionEnviada: false,
  balanceAplica: false,
  estadoGeneral: 'PENDIENTE',
  riesgo: 'BAJO',
  proximaAccion: '',
  fechaLimiteInterna: '',
  observaciones: '',
};

function aFormularioProceso(proceso: ProcesoMensual): FormularioProceso {
  return {
    comprobantesRetirados: proceso.comprobantesRetirados,
    fechaRetiro: proceso.fechaRetiro ?? '',
    documentosRecibidos: String(proceso.documentosRecibidos),
    documentosFaltantes: String(proceso.documentosFaltantes),
    documentosObservados: String(proceso.documentosObservados),
    comprasCargadasSiga: proceso.comprasCargadasSiga,
    ventasCargadasSiga: proceso.ventasCargadasSiga,
    retencionesCargadas: proceso.retencionesCargadas,
    extractosRecibidos: proceso.extractosRecibidos,
    conciliacionBancariaRealizada: proceso.conciliacionBancariaRealizada,
    ivaRevisado: proceso.ivaRevisado,
    ivaSaldoAPagar: proceso.ivaSaldoAPagar ?? '',
    ivaSaldoAFavor: proceso.ivaSaldoAFavor ?? '',
    liquidacionGenerada: proceso.liquidacionGenerada,
    liquidacionEnviada: proceso.liquidacionEnviada,
    balanceAplica: proceso.balanceAplica,
    estadoGeneral: proceso.estadoGeneral,
    riesgo: proceso.riesgo,
    proximaAccion: proceso.proximaAccion ?? '',
    fechaLimiteInterna: proceso.fechaLimiteInterna ?? '',
    observaciones: proceso.observaciones ?? '',
  };
}

interface FormularioDocumento {
  tipo: TipoDocumento;
  canalRecepcion: CanalRecepcionDocumento;
  recibidoEn: string;
  rucEmisor: string;
  timbrado: string;
  numeroComprobante: string;
  total: string;
  tasa: TasaIva | '';
  observaciones: string;
}

const DOCUMENTO_VACIO: FormularioDocumento = {
  tipo: 'FACTURA_COMPRA',
  canalRecepcion: 'ONEDRIVE',
  recibidoEn: '',
  rucEmisor: '',
  timbrado: '',
  numeroComprobante: '',
  total: '',
  tasa: '',
  observaciones: '',
};

export default function Documentos() {
  const { sesion } = useSesion();
  const rol = sesion?.rol ?? '';
  const puedeEditarProceso = ROLES_QUE_EDITAN_PROCESO.has(rol);
  const puedeCrearDocumento = ROLES_QUE_CREAN_DOCUMENTO.has(rol);
  const puedeCambiarEstado = ROLES_QUE_CAMBIAN_ESTADO.has(rol);

  const periodoPorDefecto = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);
  const [periodo, setPeriodo] = useState(periodoPorDefecto);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [procesos, setProcesos] = useState<readonly ProcesoMensual[]>([]);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<readonly Documento[]>([]);
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false);

  const [panelProceso, setPanelProceso] = useState(false);
  const [formularioProceso, setFormularioProceso] = useState<FormularioProceso>(PROCESO_VACIO);
  const [guardandoProceso, setGuardandoProceso] = useState(false);
  const [errorProceso, setErrorProceso] = useState<string | null>(null);

  const [formularioDocAbierto, setFormularioDocAbierto] = useState(false);
  const [formularioDoc, setFormularioDoc] = useState<FormularioDocumento>(DOCUMENTO_VACIO);
  const [guardandoDoc, setGuardandoDoc] = useState(false);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);

  async function cargarTablero() {
    // Con el selector nativo, un período a medio elegir (o recién borrado)
    // pasa por acá como '' o algo que no cumple AAAA-MM: no tiene sentido
    // pedirle nada al servidor todavía, y menos mostrar su error de validación.
    if (!periodoSchema.safeParse(periodo).success) {
      setClientes([]);
      setProcesos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [{ clientes: listaDeClientes }, { procesos: listaDeProcesos }] = await Promise.all([
        listarClientes(),
        listarProcesoMensualPorPeriodo(periodo),
      ]);
      setClientes(listaDeClientes);
      setProcesos(listaDeProcesos);
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

  async function cargarDocumentos(clienteId: string) {
    if (!periodoSchema.safeParse(periodo).success) {
      setDocumentos([]);
      return;
    }
    setCargandoDocumentos(true);
    try {
      const { documentos: lista } = await listarDocumentos(clienteId, periodo);
      setDocumentos(lista);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargandoDocumentos(false);
    }
  }

  useEffect(() => {
    if (clienteSeleccionado) void cargarDocumentos(clienteSeleccionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado, periodo]);

  /**
   * Preselecciona el primer cliente para que la tabla de documentos se vea al
   * entrar.
   *
   * Antes había que adivinar que la lista de documentos aparecía recién al
   * hacer clic en una fila del tablero de arriba, sin nada que lo indicara.
   * Daniel entró el 2026-09-10, eligió septiembre, no vio ningún documento y
   * concluyó —con razón— que no funcionaba: había 17 documentos de Fumipro y
   * 15 de Copesa en ese mismo período, a un clic no señalizado de distancia.
   */
  useEffect(() => {
    if (clienteSeleccionado === null && clientes.length > 0) {
      const primero = clientes.find((cliente) => cliente.activo);
      if (primero) setClienteSeleccionado(primero.id);
    }
  }, [clientes, clienteSeleccionado]);

  const filas = useMemo(
    () =>
      clientes
        .filter((c) => c.activo)
        .map((cliente) => ({
          cliente,
          proceso: procesos.find((p) => p.clienteId === cliente.id) ?? null,
        }))
        .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, 'es')),
    [clientes, procesos],
  );

  const completos = filas.filter((f) => f.proceso?.estadoGeneral === 'COMPLETO').length;
  const criticos = filas.filter((f) => f.proceso?.estadoGeneral === 'CRITICO').length;
  const sinIniciar = filas.filter((f) => f.proceso === null).length;

  function abrirPanelProceso(clienteId: string) {
    const existente = procesos.find((p) => p.clienteId === clienteId) ?? null;
    setClienteSeleccionado(clienteId);
    setFormularioProceso(existente ? aFormularioProceso(existente) : PROCESO_VACIO);
    setErrorProceso(null);
    setPanelProceso(true);
  }

  async function guardarProceso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clienteSeleccionado) return;
    setGuardandoProceso(true);
    setErrorProceso(null);
    try {
      const f = formularioProceso;
      const cambios: CamposEditablesDeProceso = {
        comprobantesRetirados: f.comprobantesRetirados,
        fechaRetiro: f.fechaRetiro === '' ? null : f.fechaRetiro,
        documentosRecibidos: Number(f.documentosRecibidos) || 0,
        documentosFaltantes: Number(f.documentosFaltantes) || 0,
        documentosObservados: Number(f.documentosObservados) || 0,
        comprasCargadasSiga: f.comprasCargadasSiga,
        ventasCargadasSiga: f.ventasCargadasSiga,
        retencionesCargadas: f.retencionesCargadas,
        extractosRecibidos: f.extractosRecibidos,
        conciliacionBancariaRealizada: f.conciliacionBancariaRealizada,
        ivaRevisado: f.ivaRevisado,
        ivaSaldoAPagar: textoANuloOImporte(f.ivaSaldoAPagar),
        ivaSaldoAFavor: textoANuloOImporte(f.ivaSaldoAFavor),
        liquidacionGenerada: f.liquidacionGenerada,
        liquidacionEnviada: f.liquidacionEnviada,
        balanceAplica: f.balanceAplica,
        estadoGeneral: f.estadoGeneral,
        riesgo: f.riesgo,
        proximaAccion: f.proximaAccion.trim() === '' ? null : f.proximaAccion.trim(),
        fechaLimiteInterna: f.fechaLimiteInterna === '' ? null : f.fechaLimiteInterna,
        observaciones: f.observaciones.trim() === '' ? null : f.observaciones.trim(),
      };

      await actualizarProcesoMensual(clienteSeleccionado, periodo, cambios);
      setPanelProceso(false);
      await cargarTablero();
    } catch (motivo) {
      setErrorProceso(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setGuardandoProceso(false);
    }
  }

  function abrirAltaDocumento() {
    setFormularioDoc(DOCUMENTO_VACIO);
    setErrorDoc(null);
    setFormularioDocAbierto(true);
  }

  async function guardarDocumento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clienteSeleccionado) return;
    setGuardandoDoc(true);
    setErrorDoc(null);
    try {
      const f = formularioDoc;
      await crearDocumento(clienteSeleccionado, {
        periodo,
        tipo: f.tipo,
        canalRecepcion: f.canalRecepcion,
        recibidoEn: f.recibidoEn === '' ? new Date().toISOString() : new Date(f.recibidoEn).toISOString(),
        rucEmisor: f.rucEmisor.trim() === '' ? null : f.rucEmisor.trim(),
        timbrado: f.timbrado.trim() === '' ? null : f.timbrado.trim(),
        numeroComprobante: f.numeroComprobante.trim() === '' ? null : f.numeroComprobante.trim(),
        total: textoANuloOImporte(f.total),
        tasa: f.tasa === '' ? null : f.tasa,
        observaciones: f.observaciones.trim() === '' ? null : f.observaciones.trim(),
      });
      setFormularioDocAbierto(false);
      await cargarDocumentos(clienteSeleccionado);
    } catch (motivo) {
      setErrorDoc(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardandoDoc(false);
    }
  }

  async function manejarCambioDeEstado(documento: Documento, estado: EstadoDocumento) {
    let motivo: string | null = null;
    if (estado === 'RECHAZADO') {
      motivo = window.prompt('¿Por qué se rechaza este documento?');
      if (!motivo || !motivo.trim()) return;
    }
    try {
      await cambiarEstadoDocumento(documento.id, estado, motivo);
      if (clienteSeleccionado) await cargarDocumentos(clienteSeleccionado);
    } catch (motivoError) {
      setError(
        motivoError instanceof ErrorDeApi ? motivoError.message : 'No se pudo conectar con el servidor.',
      );
    }
  }

  const nombreClienteSeleccionado =
    clientes.find((c) => c.id === clienteSeleccionado)?.nombre ?? '';

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
          <h1 className="text-lg font-semibold">Documentos / IVA</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Proceso mensual por cliente: qué se retiró, qué falta, y el saldo de IVA del período.
          </p>
        </div>
        <CampoTexto
          id="periodo"
          etiqueta="Período"
          type="month"
          value={periodo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodo(e.target.value)}
          className="w-40"
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del período">
        <Indicador etiqueta="Clientes" valor={filas.length} tono="proceso" />
        <Indicador etiqueta="Completos" valor={completos} tono="completo" />
        <Indicador etiqueta="Críticos" valor={criticos} tono="critico" destacado={criticos > 0} />
        <Indicador etiqueta="Sin iniciar" valor={sinIniciar} tono="pendiente" />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta
          titulo="Proceso mensual"
          descripcion={`Período ${periodo} · ${filas.length} clientes · hacé clic en un cliente para ver sus documentos`}
        />
        <Tabla etiqueta="Proceso mensual por cliente">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th>Riesgo</Th>
              <Th numerica>Recibidos</Th>
              <Th numerica>Faltantes</Th>
              <Th>SIGA C/V</Th>
              <Th>IVA</Th>
              <Th>Próxima acción</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ cliente, proceso }) => (
              <tr
                key={cliente.id}
                onClick={() => abrirPanelProceso(cliente.id)}
                className={`cursor-pointer transition-colors hover:bg-superficie-tenue ${
                  cliente.id === clienteSeleccionado ? 'bg-superficie-tenue' : ''
                }`}
              >
                <Td className="font-medium">{cliente.nombre}</Td>
                <Td>
                  {proceso ? (
                    <Badge tono={TONO_ESTADO_GENERAL[proceso.estadoGeneral]} conIcono={false}>
                      {proceso.estadoGeneral}
                    </Badge>
                  ) : (
                    <Badge tono="pendiente" conIcono={false}>Sin iniciar</Badge>
                  )}
                </Td>
                <Td>
                  {proceso && (
                    <Badge tono={TONO_RIESGO[proceso.riesgo]} conIcono={false}>{proceso.riesgo}</Badge>
                  )}
                </Td>
                <Td numerica>{proceso?.documentosRecibidos ?? '—'}</Td>
                <Td
                  numerica
                  className={proceso && proceso.documentosFaltantes > 0 ? 'font-semibold text-critico' : ''}
                >
                  {proceso?.documentosFaltantes ?? '—'}
                </Td>
                <Td className="text-tinta-suave">
                  {proceso ? `${proceso.comprasCargadasSiga ? '✓' : '—'} / ${proceso.ventasCargadasSiga ? '✓' : '—'}` : '—'}
                </Td>
                <Td className="cifra text-tinta-suave">
                  {proceso?.ivaSaldoAPagar
                    ? `${mostrarGs(proceso.ivaSaldoAPagar)} a pagar`
                    : proceso?.ivaSaldoAFavor
                      ? `${mostrarGs(proceso.ivaSaldoAFavor)} a favor`
                      : '—'}
                </Td>
                <Td className="text-tinta-suave">{proceso?.proximaAccion ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Tarjeta>

      {panelProceso && puedeEditarProceso && (
        <Tarjeta className="max-w-3xl">
          <EncabezadoTarjeta
            titulo={`Proceso mensual — ${nombreClienteSeleccionado}`}
            descripcion={`Período ${periodo}`}
          />
          <form onSubmit={guardarProceso} className="space-y-5 px-5 py-4">
            {errorProceso && (
              <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                {errorProceso}
              </p>
            )}

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                Retiro y documentación
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-tinta-suave">
                  <input
                    type="checkbox"
                    checked={formularioProceso.comprobantesRetirados}
                    onChange={(e) =>
                      setFormularioProceso({ ...formularioProceso, comprobantesRetirados: e.target.checked })
                    }
                  />
                  Comprobantes retirados
                </label>
                <CampoTexto
                  id="fechaRetiro"
                  etiqueta="Fecha de retiro"
                  type="date"
                  value={formularioProceso.fechaRetiro}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, fechaRetiro: e.target.value })
                  }
                />
                <div />
                <CampoTexto
                  id="documentosRecibidos"
                  etiqueta="Documentos recibidos"
                  type="number"
                  min={0}
                  value={formularioProceso.documentosRecibidos}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, documentosRecibidos: e.target.value })
                  }
                />
                <CampoTexto
                  id="documentosFaltantes"
                  etiqueta="Documentos faltantes"
                  type="number"
                  min={0}
                  value={formularioProceso.documentosFaltantes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, documentosFaltantes: e.target.value })
                  }
                />
                <CampoTexto
                  id="documentosObservados"
                  etiqueta="Documentos observados"
                  type="number"
                  min={0}
                  value={formularioProceso.documentosObservados}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, documentosObservados: e.target.value })
                  }
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                SIGA y conciliación
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['comprasCargadasSiga', 'Compras cargadas en SIGA'],
                    ['ventasCargadasSiga', 'Ventas cargadas en SIGA'],
                    ['retencionesCargadas', 'Retenciones cargadas'],
                    ['extractosRecibidos', 'Extractos recibidos'],
                    ['conciliacionBancariaRealizada', 'Conciliación bancaria realizada'],
                    ['ivaRevisado', 'IVA revisado'],
                  ] as const
                ).map(([campo, etiqueta]) => (
                  <label key={campo} className="flex items-center gap-2 text-sm text-tinta-suave">
                    <input
                      type="checkbox"
                      checked={formularioProceso[campo]}
                      onChange={(e) =>
                        setFormularioProceso({ ...formularioProceso, [campo]: e.target.checked })
                      }
                    />
                    {etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                IVA del período
              </legend>
              <p className="text-xs text-tinta-tenue">
                Uno de los dos, nunca ambos: un período con saldo a pagar y a favor a la vez no se
                puede liquidar.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoTexto
                  id="ivaSaldoAPagar"
                  etiqueta="Saldo a pagar (Gs.)"
                  inputMode="numeric"
                  placeholder="0"
                  value={formularioProceso.ivaSaldoAPagar}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, ivaSaldoAPagar: e.target.value })
                  }
                />
                <CampoTexto
                  id="ivaSaldoAFavor"
                  etiqueta="Saldo a favor (Gs.)"
                  inputMode="numeric"
                  placeholder="0"
                  value={formularioProceso.ivaSaldoAFavor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, ivaSaldoAFavor: e.target.value })
                  }
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                Liquidación, balance y riesgo
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-tinta-suave">
                  <input
                    type="checkbox"
                    checked={formularioProceso.liquidacionGenerada}
                    onChange={(e) =>
                      setFormularioProceso({ ...formularioProceso, liquidacionGenerada: e.target.checked })
                    }
                  />
                  Liquidación generada
                </label>
                <label className="flex items-center gap-2 text-sm text-tinta-suave">
                  <input
                    type="checkbox"
                    checked={formularioProceso.liquidacionEnviada}
                    onChange={(e) =>
                      setFormularioProceso({ ...formularioProceso, liquidacionEnviada: e.target.checked })
                    }
                  />
                  Liquidación enviada
                </label>
                <label className="flex items-center gap-2 text-sm text-tinta-suave">
                  <input
                    type="checkbox"
                    checked={formularioProceso.balanceAplica}
                    onChange={(e) =>
                      setFormularioProceso({ ...formularioProceso, balanceAplica: e.target.checked })
                    }
                  />
                  Balance aplica este período
                </label>
                <div />
                <CampoSelect
                  id="estadoGeneral"
                  etiqueta="Estado general"
                  opciones={OPCIONES_ESTADO_GENERAL}
                  value={formularioProceso.estadoGeneral}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormularioProceso({
                      ...formularioProceso,
                      estadoGeneral: e.target.value as EstadoGeneral,
                    })
                  }
                />
                <CampoSelect
                  id="riesgo"
                  etiqueta="Riesgo"
                  opciones={OPCIONES_RIESGO}
                  value={formularioProceso.riesgo}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormularioProceso({ ...formularioProceso, riesgo: e.target.value as NivelRiesgo })
                  }
                />
                <CampoTexto
                  id="fechaLimiteInterna"
                  etiqueta="Fecha límite interna"
                  type="date"
                  value={formularioProceso.fechaLimiteInterna}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, fechaLimiteInterna: e.target.value })
                  }
                />
                <CampoTexto
                  id="proximaAccion"
                  etiqueta="Próxima acción"
                  value={formularioProceso.proximaAccion}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioProceso({ ...formularioProceso, proximaAccion: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="observacionesProceso" className="text-xs font-medium text-tinta-suave">
                  Observaciones
                </label>
                <textarea
                  id="observacionesProceso"
                  rows={2}
                  value={formularioProceso.observaciones}
                  onChange={(e) =>
                    setFormularioProceso({ ...formularioProceso, observaciones: e.target.value })
                  }
                  className="rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none"
                />
              </div>
            </fieldset>

            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" type="button" onClick={() => setPanelProceso(false)} disabled={guardandoProceso}>
                Cancelar
              </Boton>
              <Boton variante="primario" type="submit" disabled={guardandoProceso}>
                {guardandoProceso ? 'Guardando…' : 'Guardar proceso mensual'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {clienteSeleccionado && (
        <Tarjeta>
          <EncabezadoTarjeta
            titulo={`Documentos — ${nombreClienteSeleccionado}`}
            descripcion={`Período ${periodo} · ${documentos.length} documento${documentos.length === 1 ? '' : 's'}`}
            acciones={
              <div className="flex flex-wrap items-end gap-3">
                {/* Cambiar de cliente sin volver a la tabla de arriba. */}
                <CampoSelect
                  id="clienteDeDocumentos"
                  etiqueta="Cliente"
                  opciones={clientes
                    .filter((cliente) => cliente.activo)
                    .map((cliente) => ({ valor: cliente.id, etiqueta: cliente.nombre }))}
                  value={clienteSeleccionado ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setClienteSeleccionado(e.target.value)
                  }
                  className="w-56"
                />
                {puedeCrearDocumento && (
                  <Boton variante="primario" icono={Plus} onClick={abrirAltaDocumento}>
                    Nuevo documento
                  </Boton>
                )}
              </div>
            }
          />
          {cargandoDocumentos ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-tenue">Cargando…</p>
          ) : (
            <Tabla etiqueta="Documentos del cliente">
              <thead>
                <tr>
                  <Th>Archivo</Th>
                  <Th>Tipo</Th>
                  <Th>Comprobante</Th>
                  <Th numerica>Total</Th>
                  <Th>Tasa</Th>
                  <Th>Estado</Th>
                  {puedeCambiarEstado && <Th>Acciones</Th>}
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc) => (
                  <tr key={doc.id}>
                    <Td>
                      {doc.evidenciaId ? (
                        <a
                          href={urlDeApi(`/api/v1/documentos/${doc.id}/archivo`)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-marca-600 underline-offset-2 hover:underline"
                        >
                          <Eye size={14} aria-hidden="true" />
                          Ver
                        </a>
                      ) : (
                        <span className="text-tinta-tenue">—</span>
                      )}
                    </Td>
                    <Td className="font-medium">{ETIQUETA_TIPO_DOCUMENTO[doc.tipo]}</Td>
                    <Td className="cifra text-tinta-suave">
                      {doc.numeroComprobante
                        ? `${doc.rucEmisor} · ${doc.timbrado} · ${doc.numeroComprobante}`
                        : '—'}
                    </Td>
                    <Td numerica className="cifra">{mostrarGs(doc.total)}</Td>
                    <Td className="text-tinta-suave">{doc.tasa ? ETIQUETA_TASA[doc.tasa] : '—'}</Td>
                    <Td>
                      <Badge tono={TONO_ESTADO_DOCUMENTO[doc.estado]} conIcono={false}>
                        {doc.estado}
                      </Badge>
                    </Td>
                    {puedeCambiarEstado && (
                      <Td>
                        <div className="flex gap-1">
                          {doc.estado !== 'CARGADO_EN_SIGA' && (
                            <Boton
                              variante="fantasma"
                              icono={CheckCircle2}
                              aria-label={`Marcar ${doc.numeroComprobante ?? doc.id} cargado en SIGA`}
                              onClick={() => void manejarCambioDeEstado(doc, 'CARGADO_EN_SIGA')}
                            >
                              SIGA
                            </Boton>
                          )}
                          {doc.estado !== 'OBSERVADO' && (
                            <Boton
                              variante="fantasma"
                              icono={AlertOctagon}
                              aria-label={`Observar ${doc.numeroComprobante ?? doc.id}`}
                              onClick={() => void manejarCambioDeEstado(doc, 'OBSERVADO')}
                            >
                              Observar
                            </Boton>
                          )}
                          {doc.estado !== 'RECHAZADO' && (
                            <Boton
                              variante="fantasma"
                              icono={Ban}
                              aria-label={`Rechazar ${doc.numeroComprobante ?? doc.id}`}
                              onClick={() => void manejarCambioDeEstado(doc, 'RECHAZADO')}
                            >
                              Rechazar
                            </Boton>
                          )}
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
                {documentos.length === 0 && (
                  <tr>
                    <td colSpan={puedeCambiarEstado ? 7 : 6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                      Todavía no hay documentos cargados para este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </Tabla>
          )}

          {formularioDocAbierto && puedeCrearDocumento && (
            <form onSubmit={guardarDocumento} className="space-y-4 border-t border-borde px-5 py-4">
              {errorDoc && (
                <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                  {errorDoc}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <CampoSelect
                  id="tipoDocumento"
                  etiqueta="Tipo"
                  opciones={OPCIONES_TIPO_DOCUMENTO}
                  value={formularioDoc.tipo}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormularioDoc({ ...formularioDoc, tipo: e.target.value as TipoDocumento })
                  }
                />
                <CampoSelect
                  id="canalRecepcion"
                  etiqueta="Canal de recepción"
                  opciones={OPCIONES_CANAL}
                  value={formularioDoc.canalRecepcion}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormularioDoc({
                      ...formularioDoc,
                      canalRecepcion: e.target.value as CanalRecepcionDocumento,
                    })
                  }
                />
                <CampoTexto
                  id="recibidoEn"
                  etiqueta="Recibido el"
                  type="date"
                  required
                  value={formularioDoc.recibidoEn}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioDoc({ ...formularioDoc, recibidoEn: e.target.value })
                  }
                />
                <CampoTexto
                  id="rucEmisor"
                  etiqueta="RUC emisor"
                  placeholder="80012345-6"
                  value={formularioDoc.rucEmisor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioDoc({ ...formularioDoc, rucEmisor: e.target.value })
                  }
                />
                <CampoTexto
                  id="timbrado"
                  etiqueta="Timbrado"
                  value={formularioDoc.timbrado}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioDoc({ ...formularioDoc, timbrado: e.target.value })
                  }
                />
                <CampoTexto
                  id="numeroComprobante"
                  etiqueta="Número de comprobante"
                  placeholder="001-001-0000001"
                  value={formularioDoc.numeroComprobante}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioDoc({ ...formularioDoc, numeroComprobante: e.target.value })
                  }
                />
                <CampoTexto
                  id="total"
                  etiqueta="Total (Gs.)"
                  inputMode="numeric"
                  placeholder="1100000"
                  value={formularioDoc.total}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormularioDoc({ ...formularioDoc, total: e.target.value })
                  }
                />
                <CampoSelect
                  id="tasa"
                  etiqueta="Tasa de IVA"
                  placeholder="Sin definir"
                  opciones={OPCIONES_TASA}
                  value={formularioDoc.tasa}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormularioDoc({ ...formularioDoc, tasa: e.target.value as TasaIva | '' })
                  }
                />
              </div>
              <p className="text-xs text-tinta-tenue">
                RUC, timbrado y número van juntos o ninguno de los tres — sin ellos, el documento no se
                puede conciliar contra SIGA ni detectar como duplicado.
              </p>
              <div className="flex justify-end gap-2">
                <Boton
                  variante="fantasma"
                  type="button"
                  onClick={() => setFormularioDocAbierto(false)}
                  disabled={guardandoDoc}
                >
                  Cancelar
                </Boton>
                <Boton variante="primario" type="submit" disabled={guardandoDoc} icono={FileText}>
                  {guardandoDoc ? 'Guardando…' : 'Registrar documento'}
                </Boton>
              </div>
            </form>
          )}
        </Tarjeta>
      )}
    </main>
  );
}
