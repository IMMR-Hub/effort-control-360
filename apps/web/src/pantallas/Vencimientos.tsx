/**
 * Radar de vencimientos (tarea 104, pantalla 4 de 12).
 *
 * Existe por un hecho concreto: EFFORT pagó una multa de Gs. 6.000.000 por no
 * presentar a tiempo ante Abogacía. Los días restantes y el nivel de alerta
 * ya vienen calculados del servidor, en zona `America/Asuncion` — acá no se
 * recalcula nada, solo se muestra.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarCheck, CalendarClock, Plus } from 'lucide-react';

import { hoyEnParaguay } from '@effort/core';
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
import {
  ETIQUETA_NIVEL_ALERTA,
  ETIQUETA_TIPO_DOCUMENTO,
  OPCIONES_RIESGO,
  OPCIONES_TIPO_DOCUMENTO,
  TONO_NIVEL_ALERTA,
  TONO_RIESGO,
} from '../ui/etiquetas.js';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import {
  crearVencimiento,
  generarVencimientos,
  marcarPresentado,
  obtenerRadar,
  type NivelRiesgo,
  type ResumenDeGeneracion,
  type ResumenPorNivel,
  type TipoDocumento,
  type Vencimiento,
} from '../api/vencimientos.js';
import { useSesion } from '../contexts/SesionContext.js';

const ROLES_QUE_EDITAN = new Set(['direccion', 'responsable', 'coordinador']);

const RESUMEN_VACIO: ResumenPorNivel = {
  VENCIDO: 0,
  CRITICA: 0,
  ALTA: 0,
  MEDIA: 0,
  INFORMATIVA: 0,
  SIN_ALERTA: 0,
};

interface FormularioAlta {
  clienteId: string;
  tipoDocumento: TipoDocumento;
  descripcion: string;
  entidad: string;
  fechaEmision: string;
  fechaVencimiento: string;
  riesgo: NivelRiesgo;
  proximaAccion: string;
}

function formularioVacio(clienteId: string): FormularioAlta {
  return {
    clienteId,
    tipoDocumento: 'CONSTANCIA',
    descripcion: '',
    entidad: '',
    fechaEmision: '',
    fechaVencimiento: '',
    riesgo: 'MEDIO',
    proximaAccion: '',
  };
}

export default function Vencimientos() {
  const { sesion } = useSesion();
  const puedeEditar = ROLES_QUE_EDITAN.has(sesion?.rol ?? '');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [vencimientos, setVencimientos] = useState<readonly Vencimiento[]>([]);
  const [resumen, setResumen] = useState<ResumenPorNivel>(RESUMEN_VACIO);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioAlta>(formularioVacio(''));
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const periodoPorDefecto = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);
  const [periodoAGenerar, setPeriodoAGenerar] = useState(periodoPorDefecto);
  const [generando, setGenerando] = useState(false);
  const [resumenGeneracion, setResumenGeneracion] = useState<ResumenDeGeneracion | null>(null);

  async function generarDelPeriodo() {
    if (!periodoSchema.safeParse(periodoAGenerar).success) return;
    setGenerando(true);
    setError(null);
    try {
      setResumenGeneracion(await generarVencimientos(periodoAGenerar));
      await recargar();
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setGenerando(false);
    }
  }

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [{ clientes: listaDeClientes }, radar] = await Promise.all([
        listarClientes(),
        obtenerRadar(),
      ]);
      setClientes(listaDeClientes);
      setVencimientos(radar.vencimientos);
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

  const clientesActivos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);
  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string) => mapa.get(clienteId) ?? clienteId;
  }, [clientes]);

  const filas = useMemo(
    () => [...vencimientos].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)),
    [vencimientos],
  );

  function abrirAlta() {
    setFormulario(formularioVacio(clientesActivos[0]?.id ?? ''));
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  async function guardarAlta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario(null);
    try {
      await crearVencimiento(formulario.clienteId, {
        tipoDocumento: formulario.tipoDocumento,
        descripcion: formulario.descripcion.trim(),
        entidad: formulario.entidad.trim(),
        fechaEmision: formulario.fechaEmision === '' ? null : formulario.fechaEmision,
        fechaVencimiento: formulario.fechaVencimiento,
        riesgo: formulario.riesgo,
        proximaAccion: formulario.proximaAccion.trim() === '' ? null : formulario.proximaAccion.trim(),
      });
      setFormularioAbierto(false);
      await recargar();
    } catch (motivo) {
      setErrorFormulario(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setGuardando(false);
    }
  }

  async function manejarPresentar(vencimiento: Vencimiento) {
    const hoy = new Date().toISOString().slice(0, 10);
    const fecha = window.prompt(
      `¿Qué día se presentó "${vencimiento.descripcion}"? (AAAA-MM-DD)`,
      hoy,
    );
    if (!fecha || !fecha.trim()) return;
    try {
      await marcarPresentado(vencimiento.id, fecha.trim());
      await recargar();
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
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
          <h1 className="text-lg font-semibold">Vencimientos</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Obligaciones societarias, legales y tributarias, ordenadas por urgencia. Días restantes y
            nivel de alerta calculados en zona Paraguay.
          </p>
        </div>
        {puedeEditar && (
          <div className="flex flex-wrap items-end gap-3">
            <CampoTexto
              id="periodoAGenerar"
              etiqueta="Generar período"
              type="month"
              value={periodoAGenerar}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodoAGenerar(e.target.value)}
              className="w-40"
            />
            <Boton
              variante="secundario"
              icono={CalendarClock}
              onClick={() => void generarDelPeriodo()}
              disabled={generando}
            >
              {generando ? 'Generando…' : 'Generar del calendario'}
            </Boton>
            <Boton variante="primario" icono={Plus} onClick={abrirAlta}>
              Nuevo vencimiento
            </Boton>
          </div>
        )}
      </div>

      {resumenGeneracion && (
        <div
          role="status"
          className="rounded border border-borde-marca bg-superficie-tenue px-4 py-3 text-sm text-tinta-suave"
        >
          <p>
            Período {resumenGeneracion.periodo}: {resumenGeneracion.creados} vencimientos generados
            {resumenGeneracion.yaExistian > 0 && `, ${resumenGeneracion.yaExistian} ya existían`}.
          </p>
          {resumenGeneracion.creados === 0 && resumenGeneracion.yaExistian === 0 && (
            <p className="mt-1 text-tinta-tenue">
              No se generó nada. Falta cargar el calendario tributario y asignarle sus obligaciones
              a cada cliente — hasta entonces el sistema no tiene de dónde deducir qué vence.
            </p>
          )}
          {resumenGeneracion.omitidos.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {resumenGeneracion.omitidos.map((omision) => (
                <li key={`${omision.cliente}-${omision.obligacion}`} className="text-critico">
                  {omision.cliente} · {omision.obligacion}: {omision.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumen por nivel de alerta">
        <Indicador etiqueta="Vencidos" valor={resumen.VENCIDO} tono="critico" destacado={resumen.VENCIDO > 0} />
        <Indicador etiqueta="Críticos" valor={resumen.CRITICA} tono="critico" />
        <Indicador etiqueta="Altos" valor={resumen.ALTA} tono="parcial" />
        <Indicador etiqueta="Medios" valor={resumen.MEDIA} tono="pendiente" />
        <Indicador etiqueta="Informativos" valor={resumen.INFORMATIVA} tono="proceso" />
        <Indicador etiqueta="Sin alerta" valor={resumen.SIN_ALERTA} tono="completo" />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Radar de vencimientos" descripcion={`${filas.length} obligaciones activas`} />
        <Tabla etiqueta="Radar de vencimientos">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Tipo</Th>
              <Th>Descripción</Th>
              <Th>Entidad</Th>
              <Th>Vence</Th>
              <Th numerica>Días</Th>
              <Th>Alerta</Th>
              <Th>Riesgo</Th>
              {puedeEditar && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => (
              <tr key={v.id}>
                <Td className="font-medium">{nombreDeCliente(v.clienteId)}</Td>
                <Td className="text-tinta-suave">{ETIQUETA_TIPO_DOCUMENTO[v.tipoDocumento]}</Td>
                <Td>{v.descripcion}</Td>
                <Td className="text-tinta-suave">{v.entidad}</Td>
                <Td className="cifra text-tinta-suave">{v.fechaVencimiento}</Td>
                <Td numerica className={v.diasRestantes <= 2 ? 'font-semibold text-critico' : ''}>
                  {v.diasRestantes}
                </Td>
                <Td>
                  <Badge tono={TONO_NIVEL_ALERTA[v.nivelAlerta]} conIcono={false}>
                    {ETIQUETA_NIVEL_ALERTA[v.nivelAlerta]}
                  </Badge>
                </Td>
                <Td>
                  <Badge tono={TONO_RIESGO[v.riesgo]} conIcono={false}>{v.riesgo}</Badge>
                </Td>
                {puedeEditar && (
                  <Td>
                    <Boton
                      variante="fantasma"
                      icono={CalendarCheck}
                      aria-label={`Marcar presentado: ${v.descripcion}`}
                      onClick={() => void manejarPresentar(v)}
                    >
                      Presentar
                    </Boton>
                  </Td>
                )}
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 9 : 8} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  No hay obligaciones pendientes en el radar.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>

      {formularioAbierto && puedeEditar && (
        <Tarjeta className="max-w-2xl">
          <EncabezadoTarjeta
            titulo="Nuevo vencimiento"
            descripcion="Los días restantes y el nivel de alerta se calculan solos a partir de la fecha de vencimiento."
          />
          <form onSubmit={guardarAlta} className="space-y-4 px-5 py-4">
            {errorFormulario && (
              <p className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
                {errorFormulario}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoSelect
                id="clienteId"
                etiqueta="Cliente"
                opciones={clientesActivos.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
                value={formulario.clienteId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormulario({ ...formulario, clienteId: e.target.value })
                }
              />
              <CampoSelect
                id="tipoDocumento"
                etiqueta="Tipo de documento"
                opciones={OPCIONES_TIPO_DOCUMENTO}
                value={formulario.tipoDocumento}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormulario({ ...formulario, tipoDocumento: e.target.value as TipoDocumento })
                }
              />
              <CampoTexto
                id="descripcion"
                etiqueta="Descripción"
                required
                className="sm:col-span-2"
                value={formulario.descripcion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, descripcion: e.target.value })
                }
              />
              <CampoTexto
                id="entidad"
                etiqueta="Entidad"
                required
                placeholder="DNIT, Abogacía del Tesoro, IPS..."
                value={formulario.entidad}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, entidad: e.target.value })
                }
              />
              <CampoSelect
                id="riesgo"
                etiqueta="Riesgo"
                opciones={OPCIONES_RIESGO}
                value={formulario.riesgo}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormulario({ ...formulario, riesgo: e.target.value as NivelRiesgo })
                }
              />
              <CampoTexto
                id="fechaEmision"
                etiqueta="Fecha de emisión"
                type="date"
                value={formulario.fechaEmision}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, fechaEmision: e.target.value })
                }
              />
              <CampoTexto
                id="fechaVencimiento"
                etiqueta="Fecha de vencimiento"
                type="date"
                required
                value={formulario.fechaVencimiento}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, fechaVencimiento: e.target.value })
                }
              />
              <CampoTexto
                id="proximaAccion"
                etiqueta="Próxima acción"
                className="sm:col-span-2"
                value={formulario.proximaAccion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormulario({ ...formulario, proximaAccion: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Boton
                variante="fantasma"
                type="button"
                onClick={() => setFormularioAbierto(false)}
                disabled={guardando}
              >
                Cancelar
              </Boton>
              <Boton variante="primario" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Crear vencimiento'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
    </main>
  );
}
