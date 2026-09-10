/**
 * Pantalla SIGA / Conciliación (tarea 104, pantalla 6 de 12).
 *
 * El sistema no toca SIGA — trabaja sobre sus exportaciones Excel/CSV/PDF.
 * Importar es siempre en dos pasos: primero `modo: 'simulacion'` (parsea y
 * valida, no persiste nada) y recién si el reporte se ve bien, "Confirmar
 * importación" manda `modo: 'real'`. La conciliación es de solo lectura:
 * compara documentos contra lo cargado en SIGA y señala diferencias, no las
 * ajusta.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, UploadCloud } from 'lucide-react';

import { formatearGs, gs } from '@effort/core';

import { Badge, Boton, CampoSelect, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  archivoABase64,
  importarArchivoSiga,
  listarExportaciones,
  obtenerConciliacion,
  type Conciliacion,
  type ExportacionSiga,
  type FormatoSiga,
  type ReporteDeImportacion,
  type TipoReporteSiga,
} from '../api/siga.js';
import { useSesion } from '../contexts/SesionContext.js';
import { hoyEnParaguay } from '@effort/core';
import { periodoSchema } from '@effort/schema';

const ROLES_QUE_IMPORTAN = new Set(['direccion', 'responsable', 'coordinador', 'auxiliar']);

const ETIQUETA_TIPO_REPORTE: Record<TipoReporteSiga, string> = {
  LIBRO_COMPRAS: 'Libro de compras',
  LIBRO_VENTAS: 'Libro de ventas',
  DETERMINACION_IVA: 'Determinación de IVA',
  COMPROBANTES_CARGADOS: 'Comprobantes cargados',
  RETENCIONES: 'Retenciones',
  MAYOR_CONTABLE: 'Mayor contable',
  SUMAS_Y_SALDOS: 'Sumas y saldos',
  BALANCE_GENERAL: 'Balance general',
  ESTADO_RESULTADOS: 'Estado de resultados',
  OTRO: 'Otro',
};

const OPCIONES_TIPO_REPORTE = Object.entries(ETIQUETA_TIPO_REPORTE).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}));

const OPCIONES_FORMATO: { valor: FormatoSiga; etiqueta: string }[] = [
  { valor: 'EXCEL', etiqueta: 'Excel (.xlsx)' },
  { valor: 'CSV', etiqueta: 'CSV' },
  { valor: 'PDF', etiqueta: 'PDF' },
];

const TONO_ESTADO_REVISION: Record<string, 'proceso' | 'parcial' | 'completo' | 'critico'> = {
  IMPORTADA: 'proceso',
  EN_REVISION: 'parcial',
  CONCILIADA: 'completo',
  CON_DIFERENCIAS: 'critico',
};

function mostrarGs(importe: string): string {
  return formatearGs(gs(importe));
}

export default function Siga() {
  const { sesion } = useSesion();
  const puedeImportar = ROLES_QUE_IMPORTAN.has(sesion?.rol ?? '');

  const periodoPorDefecto = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);

  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [periodo, setPeriodo] = useState(periodoPorDefecto);

  const [exportaciones, setExportaciones] = useState<readonly ExportacionSiga[]>([]);
  const [cargandoExportaciones, setCargandoExportaciones] = useState(false);
  const [conciliacion, setConciliacion] = useState<Conciliacion | null>(null);
  const [cargandoConciliacion, setCargandoConciliacion] = useState(false);

  const [tipoReporte, setTipoReporte] = useState<TipoReporteSiga>('LIBRO_COMPRAS');
  const [formato, setFormato] = useState<FormatoSiga>('EXCEL');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reporte, setReporte] = useState<ReporteDeImportacion | null>(null);
  const [importando, setImportando] = useState(false);
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function cargar() {
      setCargandoClientes(true);
      setError(null);
      try {
        const { clientes: lista } = await listarClientes();
        setClientes(lista);
        const primerActivo = lista.find((c) => c.activo);
        if (primerActivo) setClienteId(primerActivo.id);
      } catch (motivo) {
        setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
      } finally {
        setCargandoClientes(false);
      }
    }
    void cargar();
  }, []);

  async function recargarExportaciones() {
    if (!clienteId || !periodoSchema.safeParse(periodo).success) {
      setExportaciones([]);
      return;
    }
    setCargandoExportaciones(true);
    try {
      const { exportaciones: lista } = await listarExportaciones(clienteId, periodo);
      setExportaciones(lista);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargandoExportaciones(false);
    }
  }

  async function recargarConciliacion() {
    if (!clienteId || !periodoSchema.safeParse(periodo).success) {
      setConciliacion(null);
      return;
    }
    setCargandoConciliacion(true);
    try {
      const datos = await obtenerConciliacion(clienteId, periodo);
      setConciliacion(datos);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargandoConciliacion(false);
    }
  }

  useEffect(() => {
    setReporte(null);
    void recargarExportaciones();
    void recargarConciliacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, periodo]);

  const clientesActivos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);
  const nombreCliente = clientes.find((c) => c.id === clienteId)?.nombre ?? '';

  function manejarArchivoElegido(evento: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(evento.target.files?.[0] ?? null);
    setReporte(null);
    setErrorImportacion(null);
  }

  async function simular() {
    if (!archivo || !clienteId) return;
    setImportando(true);
    setErrorImportacion(null);
    try {
      const contenidoBase64 = await archivoABase64(archivo);
      const resultado = await importarArchivoSiga(clienteId, {
        periodo,
        tipoReporte,
        formato,
        nombreArchivo: archivo.name,
        contenidoBase64,
        modo: 'simulacion',
      });
      setReporte(resultado);
    } catch (motivo) {
      setErrorImportacion(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setImportando(false);
    }
  }

  async function confirmarImportacion() {
    if (!archivo || !clienteId) return;
    setImportando(true);
    setErrorImportacion(null);
    try {
      const contenidoBase64 = await archivoABase64(archivo);
      await importarArchivoSiga(clienteId, {
        periodo,
        tipoReporte,
        formato,
        nombreArchivo: archivo.name,
        contenidoBase64,
        modo: 'real',
      });
      setArchivo(null);
      setReporte(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
      await recargarExportaciones();
      await recargarConciliacion();
    } catch (motivo) {
      setErrorImportacion(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setImportando(false);
    }
  }

  if (cargandoClientes) {
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
          <h1 className="text-lg font-semibold">SIGA / Conciliación</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Qué se recibió que todavía no está cargado en SIGA, y qué hay en SIGA sin respaldo documental.
          </p>
        </div>
        <div className="flex gap-3">
          <CampoSelect
            id="cliente"
            etiqueta="Cliente"
            opciones={clientesActivos.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            value={clienteId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClienteId(e.target.value)}
            className="w-56"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="periodo" className="text-xs font-medium text-tinta-suave">
              Período
            </label>
            <input
              id="periodo"
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="min-h-9 w-40 rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none"
            />
          </div>
        </div>
      </div>

      {conciliacion && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen de la conciliación">
          <Indicador etiqueta="Recibidos" valor={conciliacion.totalRecibidos} tono="proceso" />
          <Indicador etiqueta="En SIGA" valor={conciliacion.totalEnSiga} tono="proceso" />
          <Indicador etiqueta="Coincidentes" valor={conciliacion.coincidentes} tono="completo" />
          <Indicador
            etiqueta="Sin identificación"
            valor={conciliacion.sinIdentificacion}
            tono="pendiente"
          />
          {/*
            Tres estados, no dos: "sin datos" no es lo mismo que "hay
            diferencias", y ninguno de los dos es "conciliado". Mostrarlo como
            un sí/no hacía que un período sin nada importado apareciera en
            verde.
          */}
          <Indicador
            etiqueta="Conciliado"
            valor={conciliacion.sinDatos ? 'Sin datos' : conciliacion.conciliado ? 'Sí' : 'No'}
            detalle={conciliacion.sinDatos ? 'Todavía no hay nada que comparar' : undefined}
            tono={conciliacion.sinDatos ? 'pendiente' : conciliacion.conciliado ? 'completo' : 'critico'}
            destacado={!conciliacion.conciliado && !conciliacion.sinDatos}
          />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Tarjeta>
          <EncabezadoTarjeta
            titulo="Exportaciones cargadas"
            descripcion={`${nombreCliente || 'Sin cliente'} · Período ${periodo}`}
          />
          {cargandoExportaciones ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-tenue">Cargando…</p>
          ) : (
            <Tabla etiqueta="Exportaciones de SIGA importadas">
              <thead>
                <tr>
                  <Th>Reporte</Th>
                  <Th>Formato</Th>
                  <Th numerica>Filas</Th>
                  <Th>Estado</Th>
                  <Th>Importada</Th>
                </tr>
              </thead>
              <tbody>
                {exportaciones.map((exp) => (
                  <tr key={exp.id}>
                    <Td className="font-medium">{ETIQUETA_TIPO_REPORTE[exp.tipoReporte]}</Td>
                    <Td className="text-tinta-suave">{exp.formato}</Td>
                    <Td numerica>{exp.filasLeidas}</Td>
                    <Td>
                      <Badge tono={TONO_ESTADO_REVISION[exp.estadoRevision] ?? 'pendiente'} conIcono={false}>
                        {exp.estadoRevision}
                      </Badge>
                    </Td>
                    <Td className="text-tinta-suave">
                      {new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(
                        new Date(exp.importadaEn),
                      )}
                    </Td>
                  </tr>
                ))}
                {exportaciones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                      Todavía no se importó ninguna exportación para este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </Tabla>
          )}

          {puedeImportar && (
            <div className="space-y-3 border-t border-borde px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                Importar exportación
              </p>
              {errorImportacion && (
                <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                  {errorImportacion}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoSelect
                  id="tipoReporte"
                  etiqueta="Tipo de reporte"
                  opciones={OPCIONES_TIPO_REPORTE}
                  value={tipoReporte}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setTipoReporte(e.target.value as TipoReporteSiga)
                  }
                />
                <CampoSelect
                  id="formato"
                  etiqueta="Formato"
                  opciones={OPCIONES_FORMATO}
                  value={formato}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormato(e.target.value as FormatoSiga)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="archivo" className="text-xs font-medium text-tinta-suave">
                  Archivo (Excel o CSV)
                </label>
                <input
                  id="archivo"
                  ref={inputArchivoRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={manejarArchivoElegido}
                  className="text-sm text-tinta-suave file:mr-3 file:rounded file:border-0 file:bg-marca-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-tinta-sobre-marca"
                />
              </div>

              {!reporte ? (
                <Boton
                  variante="secundario"
                  icono={UploadCloud}
                  disabled={!archivo || importando}
                  onClick={() => void simular()}
                >
                  {importando ? 'Leyendo…' : 'Simular (no guarda nada)'}
                </Boton>
              ) : (
                <div className="space-y-2 rounded border border-borde px-3 py-3">
                  <p className="text-sm text-tinta">
                    {reporte.totalFilas} filas · <span className="text-completo">{reporte.aceptados.length} aceptadas</span>{' '}
                    · <span className="text-critico">{reporte.rechazados.length} rechazadas</span>
                  </p>
                  {reporte.rechazados.length > 0 && (
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-tinta-tenue">
                      {reporte.rechazados.slice(0, 20).map((r) => (
                        <li key={r.numeroFila}>
                          Fila {r.numeroFila}: {r.motivo}
                        </li>
                      ))}
                      {reporte.rechazados.length > 20 && <li>… y {reporte.rechazados.length - 20} más.</li>}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <Boton
                      variante="primario"
                      icono={FileUp}
                      disabled={importando || reporte.aceptados.length === 0}
                      onClick={() => void confirmarImportacion()}
                    >
                      {importando ? 'Importando…' : `Confirmar importación (${reporte.aceptados.length})`}
                    </Boton>
                    <Boton variante="fantasma" onClick={() => setReporte(null)} disabled={importando}>
                      Volver a simular
                    </Boton>
                  </div>
                </div>
              )}
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta
            titulo="Conciliación"
            descripcion={
              conciliacion
                ? `Magnitud de las diferencias: ${mostrarGs(conciliacion.magnitudDeLasDiferencias)}`
                : 'Solo lectura: compara y señala, no ajusta nada.'
            }
          />
          {cargandoConciliacion ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-tenue">Cargando…</p>
          ) : !conciliacion ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-tenue">Elegí un cliente para conciliar.</p>
          ) : (
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                  Falta cargar en SIGA ({conciliacion.faltaCargarEnSiga.length})
                </p>
                {conciliacion.faltaCargarEnSiga.length === 0 ? (
                  <p className="text-sm text-tinta-tenue">Nada pendiente.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {conciliacion.faltaCargarEnSiga.map((c) => (
                      <li key={`${c.rucEmisor}-${c.timbrado}-${c.numeroComprobante}`} className="cifra text-tinta-suave">
                        {c.rucEmisor} · {c.timbrado} · {c.numeroComprobante} — {mostrarGs(c.total)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                  Sin respaldo documental ({conciliacion.sinRespaldoDocumental.length})
                </p>
                {conciliacion.sinRespaldoDocumental.length === 0 ? (
                  <p className="text-sm text-tinta-tenue">Nada pendiente.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {conciliacion.sinRespaldoDocumental.map((c) => (
                      <li key={`${c.rucEmisor}-${c.timbrado}-${c.numeroComprobante}`} className="cifra text-tinta-suave">
                        {c.rucEmisor} · {c.timbrado} · {c.numeroComprobante} — {mostrarGs(c.total)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-tenue">
                  Diferencias de monto ({conciliacion.diferenciasDeMonto.length})
                </p>
                {conciliacion.diferenciasDeMonto.length === 0 ? (
                  <p className="text-sm text-tinta-tenue">Nada pendiente.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {conciliacion.diferenciasDeMonto.map((d) => (
                      <li key={d.clave} className="cifra text-critico">
                        {d.clave}: recibido {mostrarGs(d.recibido)} vs. SIGA {mostrarGs(d.enSiga)} (diferencia{' '}
                        {mostrarGs(d.diferencia)})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Tarjeta>
      </div>
    </main>
  );
}
