/**
 * Pantalla de Liquidaciones (tarea 104, pantalla 7 de 12).
 *
 * Ciclo completo del entregable mensual: generada → enviada → respondida.
 * "La preparamos", "se la mandamos" y "la recibió" no son lo mismo, y la
 * diferencia importa cuando un cliente reclama que nunca le llegó nada — por
 * eso enviar pide canal, destinatario y fecha, no un solo clic.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Send, MessageSquareReply } from 'lucide-react';

import { Badge, Boton, CampoSelect, CampoTexto, EncabezadoTarjeta, Indicador, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  crearLiquidacion,
  listarLiquidaciones,
  marcarEnviada,
  registrarRespuesta,
  type CanalRecepcion,
  type EstadoLiquidacion,
  type Liquidacion,
} from '../api/liquidaciones.js';
import { useSesion } from '../contexts/SesionContext.js';
import { hoyEnParaguay } from '@effort/core';

const ROLES_QUE_EDITAN = new Set(['direccion', 'responsable', 'coordinador']);

const TONO_ESTADO: Record<EstadoLiquidacion, 'pendiente' | 'proceso' | 'parcial' | 'completo' | 'critico'> = {
  PENDIENTE: 'pendiente',
  GENERADA: 'proceso',
  ENVIADA: 'proceso',
  RECLAMADA: 'critico',
  RESPONDIDA: 'completo',
  CONFIRMADA: 'completo',
};

const ETIQUETA_ESTADO: Record<EstadoLiquidacion, string> = {
  PENDIENTE: 'Pendiente',
  GENERADA: 'Generada',
  ENVIADA: 'Enviada',
  RECLAMADA: 'Reclamada',
  RESPONDIDA: 'Respondida',
  CONFIRMADA: 'Confirmada',
};

const ETIQUETA_CANAL: Record<CanalRecepcion, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  ONEDRIVE: 'OneDrive',
  FISICO_ESCANEADO: 'Físico escaneado',
  SISTEMA: 'Sistema',
};

const OPCIONES_CANAL = Object.entries(ETIQUETA_CANAL).map(([valor, etiqueta]) => ({ valor, etiqueta }));

type Panel =
  | { tipo: 'alta' }
  | { tipo: 'enviar'; liquidacion: Liquidacion }
  | { tipo: 'responder'; liquidacion: Liquidacion };

export default function Liquidaciones() {
  const { sesion } = useSesion();
  const puedeEditar = ROLES_QUE_EDITAN.has(sesion?.rol ?? '');

  const periodoPorDefecto = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);
  const [periodo, setPeriodo] = useState(periodoPorDefecto);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<readonly Liquidacion[]>([]);

  const [panel, setPanel] = useState<Panel | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorPanel, setErrorPanel] = useState<string | null>(null);

  const [clienteAlta, setClienteAlta] = useState('');
  const [tipoAlta, setTipoAlta] = useState('');
  const [canalEnvio, setCanalEnvio] = useState<CanalRecepcion>('EMAIL');
  const [destinatarioEnvio, setDestinatarioEnvio] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState('');
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [fechaRespuesta, setFechaRespuesta] = useState('');

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [{ clientes: listaDeClientes }, { liquidaciones: lista }] = await Promise.all([
        listarClientes(),
        listarLiquidaciones(periodo),
      ]);
      setClientes(listaDeClientes);
      setLiquidaciones(lista);
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

  const clientesActivos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);
  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string) => mapa.get(clienteId) ?? clienteId;
  }, [clientes]);

  const enviadas = liquidaciones.filter((l) => l.estado === 'ENVIADA' || l.estado === 'RESPONDIDA' || l.estado === 'CONFIRMADA').length;
  const respondidas = liquidaciones.filter((l) => l.estado === 'RESPONDIDA' || l.estado === 'CONFIRMADA').length;
  const reclamadas = liquidaciones.filter((l) => l.estado === 'RECLAMADA').length;

  function abrirAlta() {
    setClienteAlta(clientesActivos[0]?.id ?? '');
    setTipoAlta('');
    setErrorPanel(null);
    setPanel({ tipo: 'alta' });
  }

  function abrirEnvio(liquidacion: Liquidacion) {
    setCanalEnvio('EMAIL');
    setDestinatarioEnvio('');
    setFechaEnvio(new Date().toISOString().slice(0, 10));
    setErrorPanel(null);
    setPanel({ tipo: 'enviar', liquidacion });
  }

  function abrirRespuesta(liquidacion: Liquidacion) {
    setTextoRespuesta('');
    setFechaRespuesta(new Date().toISOString().slice(0, 10));
    setErrorPanel(null);
    setPanel({ tipo: 'responder', liquidacion });
  }

  async function guardarAlta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setErrorPanel(null);
    try {
      await crearLiquidacion(clienteAlta, { periodo, tipo: tipoAlta.trim() });
      setPanel(null);
      await recargar();
    } catch (motivo) {
      setErrorPanel(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (panel?.tipo !== 'enviar') return;
    setGuardando(true);
    setErrorPanel(null);
    try {
      await marcarEnviada(panel.liquidacion.id, {
        canal: canalEnvio,
        destinatario: destinatarioEnvio.trim(),
        fechaEnvio,
      });
      setPanel(null);
      await recargar();
    } catch (motivo) {
      setErrorPanel(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRespuesta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (panel?.tipo !== 'responder') return;
    setGuardando(true);
    setErrorPanel(null);
    try {
      await registrarRespuesta(panel.liquidacion.id, textoRespuesta.trim(), fechaRespuesta);
      setPanel(null);
      await recargar();
    } catch (motivo) {
      setErrorPanel(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
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
          <h1 className="text-lg font-semibold">Liquidaciones</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Generada, enviada y respondida son tres estados distintos — importa la diferencia si un
            cliente reclama que nunca le llegó nada.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <CampoTexto
            id="periodo"
            etiqueta="Período"
            value={periodo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodo(e.target.value)}
            pattern="\d{4}-\d{2}"
            placeholder="2026-03"
            className="w-40"
          />
          {puedeEditar && (
            <Boton variante="primario" icono={Plus} onClick={abrirAlta}>
              Nueva liquidación
            </Boton>
          )}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del período">
        <Indicador etiqueta="Total" valor={liquidaciones.length} tono="proceso" />
        <Indicador etiqueta="Enviadas" valor={enviadas} tono="proceso" />
        <Indicador etiqueta="Respondidas" valor={respondidas} tono="completo" />
        <Indicador etiqueta="Reclamadas" valor={reclamadas} tono="critico" destacado={reclamadas > 0} />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Liquidaciones del período" descripcion={`Período ${periodo}`} />
        <Tabla etiqueta="Liquidaciones del período">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th>Envío</Th>
              <Th>Respuesta</Th>
              {puedeEditar && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {liquidaciones.map((l) => (
              <tr key={l.id}>
                <Td className="font-medium">{nombreDeCliente(l.clienteId)}</Td>
                <Td className="text-tinta-suave">{l.tipo}</Td>
                <Td>
                  <Badge tono={TONO_ESTADO[l.estado]} conIcono={false}>{ETIQUETA_ESTADO[l.estado]}</Badge>
                </Td>
                <Td className="text-tinta-suave">
                  {l.fechaEnvio
                    ? `${new Date(l.fechaEnvio).toLocaleDateString('es-PY')} · ${l.canal ? ETIQUETA_CANAL[l.canal] : ''} · ${l.destinatario}`
                    : '—'}
                </Td>
                <Td className="text-tinta-suave">
                  {l.respondidaEn ? new Date(l.respondidaEn).toLocaleDateString('es-PY') : '—'}
                </Td>
                {puedeEditar && (
                  <Td>
                    <div className="flex gap-1">
                      {l.estado !== 'ENVIADA' && l.estado !== 'RESPONDIDA' && l.estado !== 'CONFIRMADA' && (
                        <Boton
                          variante="fantasma"
                          icono={Send}
                          aria-label={`Marcar enviada la liquidación de ${nombreDeCliente(l.clienteId)}`}
                          onClick={() => abrirEnvio(l)}
                        >
                          Enviar
                        </Boton>
                      )}
                      {(l.estado === 'ENVIADA' || l.estado === 'RECLAMADA') && (
                        <Boton
                          variante="fantasma"
                          icono={MessageSquareReply}
                          aria-label={`Registrar respuesta de ${nombreDeCliente(l.clienteId)}`}
                          onClick={() => abrirRespuesta(l)}
                        >
                          Respuesta
                        </Boton>
                      )}
                    </div>
                  </Td>
                )}
              </tr>
            ))}
            {liquidaciones.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 6 : 5} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  Todavía no hay liquidaciones para este período.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>

      {panel?.tipo === 'alta' && puedeEditar && (
        <Tarjeta className="max-w-lg">
          <EncabezadoTarjeta titulo="Nueva liquidación" descripcion={`Período ${periodo}`} />
          <form onSubmit={guardarAlta} className="space-y-4 px-5 py-4">
            {errorPanel && (
              <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                {errorPanel}
              </p>
            )}
            <CampoSelect
              id="clienteAlta"
              etiqueta="Cliente"
              opciones={clientesActivos.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              value={clienteAlta}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClienteAlta(e.target.value)}
            />
            <CampoTexto
              id="tipoAlta"
              etiqueta="Tipo"
              required
              placeholder="IVA, Ganancias, Renta..."
              value={tipoAlta}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTipoAlta(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" type="button" onClick={() => setPanel(null)} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton variante="primario" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Crear liquidación'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {panel?.tipo === 'enviar' && puedeEditar && (
        <Tarjeta className="max-w-lg">
          <EncabezadoTarjeta
            titulo={`Registrar envío — ${nombreDeCliente(panel.liquidacion.clienteId)}`}
            descripcion="Destinatario, canal y fecha: es la respuesta ante 'nunca me la mandaron'."
          />
          <form onSubmit={guardarEnvio} className="space-y-4 px-5 py-4">
            {errorPanel && (
              <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                {errorPanel}
              </p>
            )}
            <CampoSelect
              id="canalEnvio"
              etiqueta="Canal"
              opciones={OPCIONES_CANAL}
              value={canalEnvio}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCanalEnvio(e.target.value as CanalRecepcion)}
            />
            <CampoTexto
              id="destinatarioEnvio"
              etiqueta="Destinatario"
              required
              placeholder="cliente@ejemplo.com.py"
              value={destinatarioEnvio}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestinatarioEnvio(e.target.value)}
            />
            <CampoTexto
              id="fechaEnvio"
              etiqueta="Fecha de envío"
              type="date"
              required
              value={fechaEnvio}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaEnvio(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" type="button" onClick={() => setPanel(null)} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton variante="primario" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Registrar envío'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {panel?.tipo === 'responder' && puedeEditar && (
        <Tarjeta className="max-w-lg">
          <EncabezadoTarjeta
            titulo={`Registrar respuesta — ${nombreDeCliente(panel.liquidacion.clienteId)}`}
          />
          <form onSubmit={guardarRespuesta} className="space-y-4 px-5 py-4">
            {errorPanel && (
              <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                {errorPanel}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="textoRespuesta" className="text-xs font-medium text-tinta-suave">
                Qué respondió el cliente
              </label>
              <textarea
                id="textoRespuesta"
                rows={3}
                required
                value={textoRespuesta}
                onChange={(e) => setTextoRespuesta(e.target.value)}
                className="rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none"
              />
            </div>
            <CampoTexto
              id="fechaRespuesta"
              etiqueta="Fecha de la respuesta"
              type="date"
              required
              value={fechaRespuesta}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaRespuesta(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" type="button" onClick={() => setPanel(null)} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton variante="primario" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Registrar respuesta'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
    </main>
  );
}
