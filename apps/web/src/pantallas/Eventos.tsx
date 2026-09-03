/**
 * Pantalla de Eventos / event log (tarea 104, pantalla 11 de 12).
 *
 * Solo lectura, acotada a `direccion`/`responsable`/`revisor_balance` en la
 * matriz de RBAC — es la ruta que responde "¿quién aprobó este balance?" o
 * "¿cuándo se le cambió el rol a esta persona?" meses después. La pantalla
 * no reinterpreta ni traduce `accion`/`entidad`: son los códigos que el
 * propio sistema generó, y en un registro de auditoría el código exacto
 * importa más que una etiqueta bonita.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

import { Boton, CampoSelect, CampoTexto, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { listarEventos, type Evento } from '../api/eventos.js';

const LIMITE_POR_PAGINA = 50;

interface Filtro {
  entidad: string;
  entidadId: string;
  usuarioId: string;
  clienteId: string;
  desde: string;
  hasta: string;
}

const FILTRO_VACIO: Filtro = { entidad: '', entidadId: '', usuarioId: '', clienteId: '', desde: '', hasta: '' };

function formatearDetalle(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  try {
    return JSON.stringify(valor);
  } catch {
    return null;
  }
}

export default function Eventos() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [eventos, setEventos] = useState<readonly Evento[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const [filtroAplicado, setFiltroAplicado] = useState<Filtro>(FILTRO_VACIO);

  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string | null) => (clienteId ? mapa.get(clienteId) ?? clienteId : '—');
  }, [clientes]);

  async function buscar(aplicado: Filtro) {
    setCargando(true);
    setError(null);
    try {
      const { eventos: lista } = await listarEventos({
        entidad: aplicado.entidad.trim() || undefined,
        entidadId: aplicado.entidadId.trim() || undefined,
        usuarioId: aplicado.usuarioId.trim() || undefined,
        clienteId: aplicado.clienteId || undefined,
        desde: aplicado.desde || undefined,
        hasta: aplicado.hasta || undefined,
        limite: LIMITE_POR_PAGINA,
        desplazamiento: 0,
      });
      setEventos(lista);
      setHayMas(lista.length === LIMITE_POR_PAGINA);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { clientes: lista } = await listarClientes();
        setClientes(lista);
      } catch {
        // El filtro por cliente queda con la lista vacía; el historial se
        // puede seguir consultando por los demás campos.
      }
    })();
    void buscar(FILTRO_VACIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function manejarBusqueda(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setFiltroAplicado(filtro);
    void buscar(filtro);
  }

  function limpiar() {
    setFiltro(FILTRO_VACIO);
    setFiltroAplicado(FILTRO_VACIO);
    void buscar(FILTRO_VACIO);
  }

  async function cargarMas() {
    setCargandoMas(true);
    try {
      const { eventos: siguientes } = await listarEventos({
        entidad: filtroAplicado.entidad.trim() || undefined,
        entidadId: filtroAplicado.entidadId.trim() || undefined,
        usuarioId: filtroAplicado.usuarioId.trim() || undefined,
        clienteId: filtroAplicado.clienteId || undefined,
        desde: filtroAplicado.desde || undefined,
        hasta: filtroAplicado.hasta || undefined,
        limite: LIMITE_POR_PAGINA,
        desplazamiento: eventos.length,
      });
      setEventos((actual) => [...actual, ...siguientes]);
      setHayMas(siguientes.length === LIMITE_POR_PAGINA);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargandoMas(false);
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
        <h1 className="text-lg font-semibold">Eventos</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Historial de acciones del sistema — qué cambió, quién lo hizo y cuándo. Los códigos de acción y
          entidad se muestran tal como los generó el sistema.
        </p>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Filtros" />
        <form onSubmit={manejarBusqueda} className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <CampoTexto
            id="filtroEntidad"
            etiqueta="Entidad"
            placeholder="usuario, cliente, balance…"
            value={filtro.entidad}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, entidad: e.target.value })}
          />
          <CampoTexto
            id="filtroEntidadId"
            etiqueta="Id de la entidad"
            value={filtro.entidadId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, entidadId: e.target.value })}
          />
          <CampoTexto
            id="filtroUsuarioId"
            etiqueta="Id de usuario"
            value={filtro.usuarioId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, usuarioId: e.target.value })}
          />
          <CampoSelect
            id="filtroCliente"
            etiqueta="Cliente"
            placeholder="Todos"
            opciones={clientes.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            value={filtro.clienteId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltro({ ...filtro, clienteId: e.target.value })}
          />
          <CampoTexto
            id="filtroDesde"
            etiqueta="Desde"
            type="date"
            value={filtro.desde}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, desde: e.target.value })}
          />
          <CampoTexto
            id="filtroHasta"
            etiqueta="Hasta"
            type="date"
            value={filtro.hasta}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, hasta: e.target.value })}
          />
          <div className="flex items-end gap-2 sm:col-span-3">
            <Boton variante="primario" icono={Search} type="submit">
              Buscar
            </Boton>
            <Boton variante="secundario" type="button" onClick={limpiar}>
              Limpiar filtros
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Historial" descripcion={`${eventos.length} eventos${hayMas ? ' (hay más)' : ''}`} />
        <Tabla etiqueta="Historial de eventos">
          <thead>
            <tr>
              <Th>Fecha y hora</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Entidad</Th>
              <Th>Cliente</Th>
              <Th>Detalle</Th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((evento) => {
              const antes = formatearDetalle(evento.datosAntes);
              const despues = formatearDetalle(evento.datosDespues);
              return (
                <tr key={evento.id}>
                  <Td className="cifra text-tinta-suave">{new Date(evento.ocurridoEn).toLocaleString('es-PY')}</Td>
                  <Td className="cifra text-tinta-suave">{evento.usuarioId ?? '—'}</Td>
                  <Td className="cifra">{evento.accion}</Td>
                  <Td className="text-tinta-suave">
                    {evento.entidad}
                    {evento.entidadId && <span className="cifra text-tinta-tenue"> · {evento.entidadId}</span>}
                  </Td>
                  <Td className="text-tinta-suave">{nombreDeCliente(evento.clienteId)}</Td>
                  <Td className="max-w-sm text-xs text-tinta-tenue">
                    {antes && <div className="cifra">antes: {antes}</div>}
                    {despues && <div className="cifra">después: {despues}</div>}
                    {!antes && !despues && '—'}
                  </Td>
                </tr>
              );
            })}
            {eventos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  Ningún evento coincide con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
        {hayMas && (
          <div className="flex justify-center border-t border-borde px-5 py-3">
            <Boton variante="secundario" type="button" onClick={() => void cargarMas()} disabled={cargandoMas}>
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </Boton>
          </div>
        )}
      </Tarjeta>
    </main>
  );
}
