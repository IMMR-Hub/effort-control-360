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
import { CheckCircle2 } from 'lucide-react';

import { Badge, Boton, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { cerrarAlerta, obtenerAlertas, type Alerta, type Criticidad, type ResumenPorCriticidad } from '../api/alertas.js';
import { useSesion } from '../contexts/SesionContext.js';

const ROLES_QUE_CIERRAN = new Set(['direccion', 'responsable', 'coordinador']);

const TONO_CRITICIDAD: Record<Criticidad, 'critico' | 'parcial' | 'pendiente' | 'proceso'> = {
  CRITICA: 'critico',
  ALTA: 'parcial',
  MEDIA: 'pendiente',
  INFORMATIVA: 'proceso',
};

const ETIQUETA_CRITICIDAD: Record<Criticidad, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  INFORMATIVA: 'Informativa',
};

const RESUMEN_VACIO: ResumenPorCriticidad = { CRITICA: 0, ALTA: 0, MEDIA: 0, INFORMATIVA: 0 };

export default function Alertas() {
  const { sesion } = useSesion();
  const puedeCerrar = ROLES_QUE_CIERRAN.has(sesion?.rol ?? '');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [alertas, setAlertas] = useState<readonly Alerta[]>([]);
  const [resumen, setResumen] = useState<ResumenPorCriticidad>(RESUMEN_VACIO);

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
      <div>
        <h1 className="text-lg font-semibold">Alertas</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Vencimientos vencidos, diferencias de conciliación y balances con inconsistencias —
          consolidados por criticidad. La genera el sistema, no un usuario a mano.
        </p>
      </div>

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
                    <Boton
                      variante="fantasma"
                      icono={CheckCircle2}
                      aria-label={`Cerrar alerta: ${a.titulo}`}
                      onClick={() => void manejarCerrar(a)}
                    >
                      Cerrar
                    </Boton>
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
