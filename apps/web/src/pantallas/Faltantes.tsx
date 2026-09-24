/**
 * Lista de lo que falta subir al OneDrive, por cliente y período (tarea 152).
 *
 * Pedido de Daniel: *"¿cómo se supone que uno puede controlar qué está y qué
 * no está cargado?"* y *"todo está presentado, solo que no subieron al
 * OneDrive; tendremos que hacer un update una vez que iniciemos con todos
 * los documentos faltantes para que lo suban, y que después no se
 * olviden"*. No es una alerta más — las alertas ya avisan vencimiento por
 * vencimiento (tarea 151) — es la vista consolidada para pasarle al equipo
 * como lista de carga pendiente.
 */

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

import { Badge, Boton, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import {
  obtenerFaltantes,
  type EstadoPlanillaRg90,
  type FaltanteDeClientePeriodo,
} from '../api/vencimientos.js';
import { actualizarAhora, type ResumenDeActualizacion } from '../api/actualizarAhora.js';
import { useSesion } from '../contexts/SesionContext.js';

/**
 * Quién puede apretar "Actualizar ahora": exactamente los roles que el
 * servidor deja encadenar sincronizar + recalcular IVA + evaluar alertas
 * (`evidencia.crear` + `liquidacion.crear` + `alerta.crear` juntos, ver
 * `rutas/actualizar-ahora.ts`) — direccion y responsable, que es quién va a
 * estar mostrando el sistema.
 */
const ROLES_QUE_ACTUALIZAN = new Set(['direccion', 'responsable']);

type TonoBadge = 'completo' | 'parcial' | 'critico' | 'proceso' | 'pendiente';

const ETIQUETA_ESTADO_RG90: Record<EstadoPlanillaRg90, string> = {
  NO_APLICA: 'No aplica',
  SIN_LIQUIDACION: 'Sin ninguna planilla',
  FALTA_COMPRAS: 'Falta compras',
  FALTA_VENTAS: 'Falta ventas',
  FALTAN_AMBAS: 'Faltan las dos',
  COMPLETA: 'Completa',
};

const TONO_ESTADO_RG90: Record<EstadoPlanillaRg90, TonoBadge> = {
  NO_APLICA: 'pendiente',
  SIN_LIQUIDACION: 'critico',
  FALTA_COMPRAS: 'parcial',
  FALTA_VENTAS: 'parcial',
  FALTAN_AMBAS: 'critico',
  COMPLETA: 'completo',
};

function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Sin dependencias nuevas: arma el texto a mano y dispara la descarga con un Blob. */
function descargarCsv(filas: readonly FaltanteDeClientePeriodo[]): void {
  const encabezado = ['Cliente', 'Período', 'Comprobantes sin presentar', 'Planilla RG 90'];
  const lineas = filas.map((f) => [
    f.clienteNombre,
    f.periodo,
    f.obligaciones.map((o) => o.descripcion).join(' | '),
    ETIQUETA_ESTADO_RG90[f.estadoPlanillaRg90],
  ]);
  // BOM al inicio: sin él, Excel en Windows desarma los acentos del archivo.
  const csv = `\uFEFF${[encabezado, ...lineas].map((fila) => fila.map(celdaCsv).join(',')).join('\r\n')}`;

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `faltantes-onedrive-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function Faltantes() {
  const { sesion } = useSesion();
  const puedeActualizar = ROLES_QUE_ACTUALIZAN.has(sesion?.rol ?? '');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<readonly FaltanteDeClientePeriodo[]>([]);

  const [actualizando, setActualizando] = useState(false);
  const [resumenActualizacion, setResumenActualizacion] = useState<ResumenDeActualizacion | null>(null);
  const [errorActualizacion, setErrorActualizacion] = useState<string | null>(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const { faltantes: lista } = await obtenerFaltantes();
      setFaltantes(lista);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  /**
   * Sincroniza OneDrive, recalcula IVA, detecta presentaciones y evalúa
   * alertas — y recién ahí vuelve a pedir la lista. Es lo que hace que subir
   * un comprobante durante la reunión se vea reflejado en el momento, en vez
   * de esperar hasta una hora a que corra solo.
   */
  async function manejarActualizarAhora() {
    setActualizando(true);
    setErrorActualizacion(null);
    try {
      setResumenActualizacion(await actualizarAhora());
      await recargar();
    } catch (motivo) {
      setErrorActualizacion(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setActualizando(false);
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  const totalObligaciones = useMemo(
    () => faltantes.reduce((total, f) => total + f.obligaciones.length, 0),
    [faltantes],
  );
  const conPlanillaIncompleta = useMemo(
    () =>
      faltantes.filter(
        (f) => f.estadoPlanillaRg90 !== 'NO_APLICA' && f.estadoPlanillaRg90 !== 'COMPLETA',
      ).length,
    [faltantes],
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Faltantes</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Por cliente y período, con vencimiento ya vencido: qué comprobante de presentación falta y
            si las planillas RG 90 de compras y ventas ya se cargaron. Lo que no aparece acá está al día.
          </p>
        </div>
        {puedeActualizar && (
          <Boton
            variante="primario"
            icono={RefreshCw}
            onClick={() => void manejarActualizarAhora()}
            disabled={actualizando}
          >
            {actualizando ? 'Actualizando…' : 'Actualizar ahora'}
          </Boton>
        )}
      </div>

      {actualizando && (
        <p
          role="status"
          className="rounded border border-borde-marca bg-superficie-tenue px-3 py-2 text-sm text-tinta-suave"
        >
          Releyendo OneDrive y recalculando el IVA de toda la cartera — con los libros reales de los 5
          clientes esto puede tardar varios minutos. No hace falta esperar mirando esta pantalla: se
          puede seguir trabajando en otra pestaña y volver después.
        </p>
      )}

      {errorActualizacion && (
        <p
          role="alert"
          className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico"
        >
          {errorActualizacion}
        </p>
      )}

      {resumenActualizacion && !errorActualizacion && (
        <div
          role="status"
          className="rounded border border-borde-marca bg-superficie-tenue px-4 py-3 text-sm text-tinta-suave"
        >
          <p>
            {resumenActualizacion.archivosNuevos} archivo(s) nuevo(s) de OneDrive ·{' '}
            {resumenActualizacion.presentacionesMarcadas} presentación(es) detectada(s) ·{' '}
            {resumenActualizacion.ivaOcupado
              ? 'IVA: ya había un cálculo en curso, no se repitió'
              : `${resumenActualizacion.ivaPeriodosCalculados} período(s) de IVA recalculados`}{' '}
            · {resumenActualizacion.alertasResueltas} alerta(s) resuelta(s).
          </p>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de lo que falta subir">
        <Indicador
          etiqueta="Cliente y período con algo pendiente"
          valor={faltantes.length}
          tono="critico"
          destacado={faltantes.length > 0}
        />
        <Indicador etiqueta="Comprobantes sin presentar" valor={totalObligaciones} tono="critico" />
        <Indicador etiqueta="Con planilla RG 90 incompleta" valor={conPlanillaIncompleta} tono="parcial" />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta
          titulo="Lo que falta subir"
          descripcion={`${faltantes.length} fila(s) — cliente y período con algo pendiente`}
          acciones={
            <Boton
              variante="secundario"
              icono={Download}
              onClick={() => descargarCsv(faltantes)}
              disabled={faltantes.length === 0}
            >
              Exportar CSV
            </Boton>
          }
        />
        <Tabla etiqueta="Lo que falta subir al OneDrive">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Período</Th>
              <Th>Comprobantes sin presentar</Th>
              <Th>Planilla RG 90</Th>
            </tr>
          </thead>
          <tbody>
            {faltantes.map((f) => (
              <tr key={`${f.clienteId}-${f.periodo}`}>
                <Td className="font-medium">{f.clienteNombre}</Td>
                <Td className="cifra text-tinta-suave">{f.periodo}</Td>
                <Td>
                  <ul className="space-y-0.5">
                    {f.obligaciones.map((o) => (
                      <li key={o.id}>
                        {o.descripcion}
                        <span className="ml-1.5 text-xs text-tinta-tenue">
                          ({o.diasDeAtraso} día(s) de atraso)
                        </span>
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td>
                  <Badge tono={TONO_ESTADO_RG90[f.estadoPlanillaRg90]}>
                    {ETIQUETA_ESTADO_RG90[f.estadoPlanillaRg90]}
                  </Badge>
                  {f.estadoPlanillaRg90 === 'FALTA_VENTAS' && (
                    <p className="mt-1 text-xs text-tinta-tenue">
                      Puede ser legítimo si el cliente no facturó ese mes.
                    </p>
                  )}
                </Td>
              </tr>
            ))}
            {faltantes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  No hay nada pendiente: todo lo vencido tiene su comprobante y sus planillas RG 90.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>
    </main>
  );
}
